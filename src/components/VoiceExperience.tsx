import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic,
  MicOff,
  ChevronLeft,
  ChevronDown,
  Volume2,
  VolumeX,
  FileText,
  Check,
  Copy,
  Edit3,
  AlertCircle,
  MoreHorizontal,
  Sparkles,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import { GoogleGenAI, Modality, type Session, type LiveServerMessage, type FunctionDeclaration } from '@google/genai'
import {
  resampleAudioBuffer,
  float32ToInt16PCM,
  pcmToBase64,
  base64ToFloat32PCM,
} from '../utils/geminiLiveAudio.ts'
import { SiriVoiceOrb } from './SiriVoiceOrb'
import type { KnowledgeItem } from '../types/index.ts'
import {
  novaToolDefinitions,
  extractStructuredActionDetails,
  extractNoteFromFollowup,
} from '../services/actionEngine'

export type VoiceMode = 'stt' | 'sts'

export type VoiceState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'waiting_for_ai'
  | 'speaking'
  | 'interrupted'
  | 'stopped'
  | 'permission_denied'
  | 'unsupported'
  | 'error'

export interface VoiceExperienceProps {
  mode: VoiceMode
  onClose: () => void
  onSendTranscript: (content: string) => void
  onUpdateDraft?: (content: string) => void
  initialDraft?: string
  memoryContext?: string
  onExecuteTool?: (name: string, args: Record<string, unknown>) => Promise<{ output: string }>
}

interface BrowserSpeechResult {
  isFinal: boolean
  0: { transcript: string }
}

interface BrowserSpeechEvent {
  resultIndex: number
  results: ArrayLike<BrowserSpeechResult>
}

interface BrowserSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: BrowserSpeechEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: string
}

// Custom Speech Bubble with horizontal text lines icon matching reference left control
const TranscriptBubbleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="13" x2="14" y2="13" />
  </svg>
)

// Rounded Pause icon matching reference center stop control in Screen B
const PausePillIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="6.5" y="5" width="3.5" height="14" rx="1.75" />
    <rect x="14" y="5" width="3.5" height="14" rx="1.75" />
  </svg>
)

// Dedicated 17-bar audio waveform for Screen B matching reference
const WaveformBars: React.FC<{ audioLevel: number; isSpeaking: boolean }> = ({ audioLevel, isSpeaking }) => {
  const barWeights = [
    0.18, 0.28, 0.42, 0.58, 0.72, 0.85, 0.94, 0.99,
    1.0,
    0.99, 0.94, 0.85, 0.72, 0.58, 0.42, 0.28, 0.18,
  ]

  return (
    <div
      className="flex items-center justify-center gap-[3.5px] h-9 my-1 select-none pointer-events-none"
      aria-label="Audio playback visualization"
    >
      {barWeights.map((weight, i) => {
        const dynamicHeight = isSpeaking
          ? Math.max(4, Math.round(weight * (6 + audioLevel * 30)))
          : Math.max(3, Math.round(weight * 8))

        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-[#9333ea] to-[#c084fc] transition-all duration-75"
            style={{
              height: `${dynamicHeight}px`,
              opacity: isSpeaking ? 0.95 : 0.45,
            }}
          />
        )
      })}
    </div>
  )
}

export const VoiceExperience: React.FC<VoiceExperienceProps> = ({
  mode,
  onClose,
  onSendTranscript,
  onUpdateDraft,
  initialDraft = '',
  memoryContext,
  onExecuteTool,
}) => {
  const [state, setState] = useState<VoiceState>('requesting')
  const [activeScreen, setActiveScreen] = useState<'listening' | 'speaking'>('listening')
  const [transcript, setTranscript] = useState(initialDraft)
  const [interimSpeech, setInterimSpeech] = useState('')
  const [assistantSpokenText, setAssistantSpokenText] = useState('')
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>(() => {
    if (initialDraft.trim()) {
      return [{
        id: 'init-1',
        role: 'user',
        text: initialDraft.trim(),
        time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      }]
    }
    return []
  })

  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isFallbackSTT, setIsFallbackSTT] = useState(false)
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false)
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editableTranscript, setEditableTranscript] = useState(initialDraft)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Viewport height tracking for responsive layout calculation
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)

    // Lock body-level scroll while voice experience is mounted
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      window.removeEventListener('resize', handleResize)
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [])

  // Audio Context & WebRTC / WebSocket references
  const orbRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const inputAudioContextRef = useRef<AudioContext | null>(null)
  const playbackAudioContextRef = useRef<AudioContext | null>(null)
  const inputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextScheduledTimeRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const liveSessionRef = useRef<Session | null>(null)
  const sessionTokenRef = useRef(0)
  const transcriptRef = useRef(initialDraft)
  const isMutedRef = useRef(false)
  const isSpeakerMutedRef = useRef(false)
  const stateRef = useRef(state)
  const lastAudioLevelRef = useRef(0)
  const executedToolCallsRef = useRef<Map<string, { output?: unknown; error?: string }>>(new Map())
  const lastUserSpeechRef = useRef('')
  const toolExecutedInTurnRef = useRef(false)
  const pendingNoteContextRef = useRef<{
    kind?: KnowledgeItem['kind']
    workspaceName?: string
    workspaceId?: string
  } | null>(null)

  const [prevVoiceState, setPrevVoiceState] = useState(state)
  if (state !== prevVoiceState) {
    setPrevVoiceState(state)
    if (state === 'speaking') {
      setActiveScreen('speaking')
    } else if (state === 'interrupted') {
      setActiveScreen('listening')
    }
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted
  }, [isSpeakerMuted])

  // Stop active scheduled audio buffer sources (playback queue)
  const stopAudioPlayback = useCallback(() => {
    const sources = activeAudioSourcesRef.current
    for (const source of sources) {
      try {
        source.stop()
        source.disconnect()
      } catch {
        // Ignore if already stopped
      }
    }
    activeAudioSourcesRef.current = []
    if (playbackAudioContextRef.current && playbackAudioContextRef.current.state !== 'closed') {
      nextScheduledTimeRef.current = playbackAudioContextRef.current.currentTime
    }
  }, [])

  // Decode and gaplessly schedule incoming 24kHz PCM audio chunks from Gemini Live
  const playAudioChunk = useCallback((base64Pcm: string) => {
    try {
      if (isSpeakerMutedRef.current) return

      let ctx = playbackAudioContextRef.current
      if (!ctx || ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctx = new AudioCtx({ sampleRate: 24000 })
        playbackAudioContextRef.current = ctx

        const outAnalyser = ctx.createAnalyser()
        outAnalyser.fftSize = 256
        outAnalyser.smoothingTimeConstant = 0.75
        outAnalyser.connect(ctx.destination)
        outputAnalyserRef.current = outAnalyser
      }

      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const float32Pcm = base64ToFloat32PCM(base64Pcm)
      if (float32Pcm.length === 0) return

      const buffer = ctx.createBuffer(1, float32Pcm.length, 24000)
      buffer.getChannelData(0).set(float32Pcm)

      const source = ctx.createBufferSource()
      source.buffer = buffer

      if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current)
      } else {
        source.connect(ctx.destination)
      }

      const now = ctx.currentTime
      const startTime = Math.max(nextScheduledTimeRef.current, now)
      source.start(startTime)
      nextScheduledTimeRef.current = startTime + buffer.duration
      activeAudioSourcesRef.current.push(source)

      setState('speaking')

      source.onended = () => {
        const sources = activeAudioSourcesRef.current
        const idx = sources.indexOf(source)
        if (idx > -1) sources.splice(idx, 1)
        if (sources.length === 0 && stateRef.current === 'speaking') {
          setState('listening')
        }
      }
    } catch (err) {
      console.warn('[NOVA Voice] Error playing audio chunk:', err)
    }
  }, [])

  // Clean release of all audio contexts, nodes, sessions, and streams
  const releaseAudioResources = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop and clear audio playback
    stopAudioPlayback()

    // Close Gemini Live session
    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.close()
      } catch {
        // Ignore
      }
      liveSessionRef.current = null
    }

    // Disconnect mic audio capture nodes
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null
      processorNodeRef.current.disconnect()
      processorNodeRef.current = null
    }

    if (silentGainRef.current) {
      silentGainRef.current.disconnect()
      silentGainRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore
      }
      recognitionRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    inputAnalyserRef.current = null
    outputAnalyserRef.current = null

    if (inputAudioContextRef.current) {
      void inputAudioContextRef.current.close().catch(() => undefined)
      inputAudioContextRef.current = null
    }

    if (playbackAudioContextRef.current) {
      void playbackAudioContextRef.current.close().catch(() => undefined)
      playbackAudioContextRef.current = null
    }

    setAudioLevel(0)
    lastAudioLevelRef.current = 0
  }, [stopAudioPlayback])

  // Setup audio analysis loop: binds both input mic and assistant playback to the orb visualizer
  const setupAudioAnalysis = useCallback((stream: MediaStream, sessionId: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return

      const inputAudioCtx = new AudioCtx({ sampleRate: 16000 })
      inputAudioContextRef.current = inputAudioCtx

      const analyser = inputAudioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75
      inputAnalyserRef.current = analyser

      const source = inputAudioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      // Audio capture script processor for 16kHz PCM streaming to Gemini Live
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1)
      processorNodeRef.current = processor

      processor.onaudioprocess = (e) => {
        if (sessionId !== sessionTokenRef.current || isMutedRef.current || !liveSessionRef.current) return
        const channelData = e.inputBuffer.getChannelData(0)
        const resampled = resampleAudioBuffer(channelData, inputAudioCtx.sampleRate, 16000)
        const int16Pcm = float32ToInt16PCM(resampled)
        const base64Chunk = pcmToBase64(int16Pcm)

        try {
          liveSessionRef.current.sendRealtimeInput({
            audio: {
              data: base64Chunk,
              mimeType: 'audio/pcm;rate=16000',
            },
          })
        } catch {
          // Socket write error or closed connection
        }
      }

      source.connect(processor)

      // Route processor to silent gain to prevent speaker feedback loop
      const silentGain = inputAudioCtx.createGain()
      silentGain.gain.value = 0
      silentGainRef.current = silentGain
      processor.connect(silentGain)
      silentGain.connect(inputAudioCtx.destination)

      const samples = new Uint8Array(analyser.fftSize)

      const updateLoop = () => {
        if (sessionId !== sessionTokenRef.current) return

        // Measure either output audio (when NOVA speaks) or input mic (when user speaks)
        const activeAnalyser =
          stateRef.current === 'speaking' && outputAnalyserRef.current
            ? outputAnalyserRef.current
            : inputAnalyserRef.current

        let rms = 0
        if (activeAnalyser && !isMutedRef.current) {
          activeAnalyser.getByteTimeDomainData(samples)
          let sumSquared = 0
          for (let i = 0; i < samples.length; i++) {
            const normalized = (samples[i] - 128) / 128
            sumSquared += normalized * normalized
          }
          rms = Math.sqrt(sumSquared / samples.length)
        }

        // Noise floor threshold and normalization
        const threshold = 0.015
        const level = isMutedRef.current ? 0 : Math.min(1, Math.max(0, (rms - threshold) * 5.2))

        if (Math.abs(level - lastAudioLevelRef.current) > 0.015 || (level === 0 && lastAudioLevelRef.current > 0)) {
          lastAudioLevelRef.current = level
          setAudioLevel(level)
        }

        animationFrameRef.current = window.requestAnimationFrame(updateLoop)
      }

      animationFrameRef.current = window.requestAnimationFrame(updateLoop)
    } catch {
      // AudioContext failure should not crash UI
    }
  }, [])

  // Start real Gemini Live session or honest STT fallback
  const startVoiceCapture = useCallback(async () => {
    const sessionId = sessionTokenRef.current + 1
    sessionTokenRef.current = sessionId

    releaseAudioResources()
    setState('requesting')
    setErrorMessage('')
    setIsFallbackSTT(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      setErrorMessage('Microphone access is not supported by this browser environment.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (sessionId !== sessionTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      setupAudioAnalysis(stream, sessionId)
    } catch (err) {
      if (sessionId !== sessionTokenRef.current) return
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      if (isDenied) {
        setState('permission_denied')
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser settings.')
      } else {
        setState('error')
        setErrorMessage('Could not open the microphone audio device. Please check connections.')
      }
      return
    }

    // Fetch ephemeral token from local server endpoint
    let ephemeralToken = ''
    let selectedModel = 'gemini-3.8-live'
    try {
      const res = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        if (data.code === 'MISSING_API_KEY') {
          if (mode === 'sts') {
            setState('error')
            setErrorMessage('GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to .env to enable real Gemini Live Speech-to-Speech.')
            return
          } else {
            setIsFallbackSTT(true)
          }
        } else {
          if (mode === 'sts') {
            setState('error')
            setErrorMessage(`Failed to initialize Gemini Live session: ${data.error || 'Server error'}`)
            return
          } else {
            setIsFallbackSTT(true)
          }
        }
      } else if (data.token) {
        ephemeralToken = data.token
        if (data.model) selectedModel = data.model
      }
    } catch {
      if (mode === 'sts') {
        setState('error')
        setErrorMessage('Could not reach backend /api/live-token. Ensure the local dev server is running.')
        return
      } else {
        setIsFallbackSTT(true)
      }
    }

    // Step 3: If token acquired, connect to Gemini Live over bidirectional WebSocket
    if (ephemeralToken) {
      try {
        const ai = new GoogleGenAI({ apiKey: ephemeralToken })
        executedToolCallsRef.current.clear()
        const session = await ai.live.connect({
          model: selectedModel,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: {
              parts: [
                {
                  text:
                    mode === 'stt'
                      ? 'You are an acoustic transcription assistant. Transcribe the user speech accurately.'
                      : `You are NOVA, a personal AI assistant. Keep responses natural, concise, and conversational. Speak in a helpful and engaging tone.

NOVA BUILT-IN CAPABILITIES & INTERNAL KNOWLEDGE:
- NOVA has a built-in Knowledge base, personal notes library, task manager, and memory system.
- NOVA is the user's personal note-taking and task application. NEVER ask what app, software, program, device, or phone tool the user wants to use. NEVER act like an external app finder or recommend third-party note apps. All notes and tasks are saved and managed directly inside NOVA using your tools.
- Phrases like "create a personal note", "make a note in my personal", "save a voice note", "voice note in my personal", "note in my personal", and "create a note" are requests to create a personal note in NOVA.
- "in my personal" means save a personal note (kind: "Personal note") in the user's default/personal workspace. Do NOT set workspaceName unless the user explicitly names a workspace.

TOOL DEFINITIONS & USAGE:
- create_task: Call this tool when the user asks to create, add, or schedule a task (e.g. "Create a task called Voice Test QA in Product Launch"). Pass the title and optional workspaceName (or workspaceId).
- list_tasks: Call this tool to list, find, or check user tasks.
- complete_task: Call this tool to complete a task.
- save_note: Call this tool when the user asks to save a note or knowledge (e.g. "Save a personal note titled Voice with body voice is perfect" or "Create a note called Voice Test. The content is voice is working."). Pass title (string), content or body (string), kind ("Personal note", "Project notes", or "Reference"), and optional workspaceName.
- search_notes: Call this tool to search user notes.
- save_memory: Call this tool to store long-term preferences or facts.

CRITICAL INSTRUCTIONS:
1. When the user asks you to create a task, save a note, or manage items and provides the details (e.g. "Create a note called Voice Test. The content is voice is working."):
   Invoke the appropriate tool immediately. NEVER say you do not have the ability to create tasks, manage projects, or save notes.
2. When the user asks to create or save a note or voice note (e.g. "voice note in my personal", "Note in my personal", "Create a personal note", "Make a note in my personal", "Save a voice note", "create a note") without title or content/body:
   Do NOT ask which app, program, or device they mean!
   Ask ONE short follow-up for the missing information: "Sure — what should I call the note, and what should it say?"
   Remember the user's answer in the conversation. When the user responds in the next turn with the title and content (e.g. "Voice Test. The content is voice is working."), immediately invoke save_note with that title and content, kind: "Personal note". Do not repeatedly ask for information already supplied.
3. NEVER claim, state, or confirm that a task or note has been saved unless the tool was executed and returned successfully.
4. Wait for the tool execution response before speaking your confirmation. Once the tool returns successfully, give a brief, natural spoken confirmation of what was created or saved. If the tool returns an error, state the error honestly.${
                          memoryContext ? `\n\nAuthorized User Memory Context:\n${memoryContext}` : ''
                        }`,
                },
              ],
            },
            tools: [{ functionDeclarations: novaToolDefinitions as unknown as FunctionDeclaration[] }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (sessionId === sessionTokenRef.current) {
                setState('listening')
              }
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (sessionId !== sessionTokenRef.current) return

              // Handle server-side tool calls from Gemini Live
              const toolCallMsg = msg as unknown as {
                toolCall?: {
                  functionCalls?: Array<{
                    id: string
                    name: string
                    args: Record<string, unknown>
                  }>
                }
              }

              if (toolCallMsg.toolCall?.functionCalls && onExecuteTool) {
                toolExecutedInTurnRef.current = true
                pendingNoteContextRef.current = null
                for (const call of toolCallMsg.toolCall.functionCalls) {
                  // Prevent duplicate execution of retried tool calls
                  if (executedToolCallsRef.current.has(call.id)) {
                    const cached = executedToolCallsRef.current.get(call.id)!
                    session.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: cached.error ? { error: cached.error } : { output: cached.output },
                        },
                      ],
                    })
                    continue
                  }

                  try {
                    const result = await onExecuteTool(call.name, call.args || {})
                    const cached = { output: result.output }
                    executedToolCallsRef.current.set(call.id, cached)
                    session.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { output: result.output },
                        },
                      ],
                    })
                  } catch (toolErr) {
                    const errStr = toolErr instanceof Error ? toolErr.message : String(toolErr)
                    const cached = { error: errStr }
                    executedToolCallsRef.current.set(call.id, cached)
                    session.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { error: errStr },
                        },
                      ],
                    })
                  }
                }
              }

              const content = msg.serverContent
              if (!content) return

              // Real-time user input transcription (interim hypothesis)
              if (content.interimInputTranscription?.text) {
                setInterimSpeech(content.interimInputTranscription.text)
              }

              // Finalized user speech turn
              if (content.inputTranscription?.text) {
                const text = content.inputTranscription.text.trim()
                if (text) {
                  lastUserSpeechRef.current = text
                  toolExecutedInTurnRef.current = false
                  setTranscript((prev) => {
                    const updated = prev ? `${prev} ${text}` : text
                    transcriptRef.current = updated
                    return updated
                  })
                  setEditableTranscript((prev) => (prev ? `${prev} ${text}` : text))
                  setInterimSpeech('')

                  // Track conversation turn
                  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())
                  setConversationTurns((prev) => [...prev, { id: 'u-' + Date.now(), role: 'user', text, time }])
                }
              }

              // Assistant output speech transcription
              if (content.outputTranscription?.text) {
                const aiText = content.outputTranscription.text.trim()
                if (aiText) {
                  setAssistantSpokenText((prev) => (prev ? `${prev} ${aiText}` : aiText))

                  // Track assistant conversation turn
                  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())
                  setConversationTurns((prev) => {
                    const last = prev[prev.length - 1]
                    if (last && last.role === 'assistant') {
                      return [...prev.slice(0, -1), { ...last, text: `${last.text} ${aiText}` }]
                    }
                    return [...prev, { id: 'a-' + Date.now(), role: 'assistant', text: aiText, time }]
                  })
                }
              }

              // Real audio chunks (24kHz PCM from Gemini)
              if (mode === 'sts' && content.modelTurn?.parts) {
                for (const part of content.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    playAudioChunk(part.inlineData.data)
                  }
                }
              }

              // Barge-in interruption signal from Gemini Live server
              if (content.interrupted) {
                stopAudioPlayback()
                setState('interrupted')
                setTimeout(() => {
                  if (stateRef.current === 'interrupted' && sessionId === sessionTokenRef.current) {
                    setState('listening')
                  }
                }, 300)
              }

              // Turn completion: if user requested note or task and Gemini Live did not invoke tool call, auto-persist via shared action engine
              if (content.turnComplete) {
                if (!toolExecutedInTurnRef.current && lastUserSpeechRef.current && onExecuteTool) {
                  const pendingSpeech = lastUserSpeechRef.current
                  lastUserSpeechRef.current = ''
                  const actionDetails = extractStructuredActionDetails(pendingSpeech)
                  if (actionDetails.actionType === 'note_create' && actionDetails.title && !actionDetails.isMalformed) {
                    toolExecutedInTurnRef.current = true
                    const kind = actionDetails.kind || pendingNoteContextRef.current?.kind || 'Personal note'
                    const workspaceName = actionDetails.workspaceName ?? pendingNoteContextRef.current?.workspaceName
                    const workspaceId = actionDetails.workspaceId ?? pendingNoteContextRef.current?.workspaceId
                    pendingNoteContextRef.current = null
                    void onExecuteTool('save_note', {
                      title: actionDetails.title,
                      content: actionDetails.content || actionDetails.title,
                      body: actionDetails.content || actionDetails.title,
                      kind,
                      tags: actionDetails.tags || [],
                      workspaceName,
                      workspaceId,
                    }).catch((err) => {
                      console.warn('[NOVA Voice] Auto-executed note persistence error:', err)
                    })
                  } else if (actionDetails.actionType === 'note_create' && (!actionDetails.title || actionDetails.isMalformed)) {
                    // Remember pending note context across voice turns
                    pendingNoteContextRef.current = {
                      kind: actionDetails.kind || 'Personal note',
                      workspaceName: actionDetails.workspaceName,
                      workspaceId: actionDetails.workspaceId,
                    }
                  } else if (pendingNoteContextRef.current) {
                    // Voice follow-up supplying title/body
                    const followUp = extractNoteFromFollowup(pendingSpeech)
                    if (followUp && followUp.title) {
                      toolExecutedInTurnRef.current = true
                      const pendingCtx = pendingNoteContextRef.current
                      pendingNoteContextRef.current = null
                      void onExecuteTool('save_note', {
                        title: followUp.title,
                        content: followUp.content || followUp.title,
                        body: followUp.content || followUp.title,
                        kind: pendingCtx.kind || 'Personal note',
                        workspaceName: pendingCtx.workspaceName,
                        workspaceId: pendingCtx.workspaceId,
                      }).catch((err) => {
                        console.warn('[NOVA Voice] Auto-executed follow-up note persistence error:', err)
                      })
                    }
                  } else if (actionDetails.actionType === 'task_create' && actionDetails.title && !actionDetails.isMalformed) {
                    toolExecutedInTurnRef.current = true
                    void onExecuteTool('create_task', {
                      title: actionDetails.title,
                      priority: actionDetails.priority || 'medium',
                      scheduledAt: actionDetails.scheduledAt,
                      estimateMinutes: actionDetails.estimateMinutes,
                      workspaceName: actionDetails.workspaceName,
                      workspaceId: actionDetails.workspaceId,
                    }).catch((err) => {
                      console.warn('[NOVA Voice] Auto-executed task persistence error:', err)
                    })
                  }
                }
              }
            },
            onerror: (err: unknown) => {
              if (sessionId !== sessionTokenRef.current) return
              const msg = err instanceof Error ? err.message : String(err)
              setState('error')
              setErrorMessage(`Gemini Live session error: ${msg}`)
            },
            onclose: () => {
              if (sessionId !== sessionTokenRef.current) return
              if (stateRef.current !== 'stopped' && stateRef.current !== 'error') {
                setState('stopped')
              }
            },
          },
        })

        if (sessionId === sessionTokenRef.current) {
          liveSessionRef.current = session
        } else {
          session.close()
        }
        return
      } catch (connectErr: unknown) {
        if (sessionId !== sessionTokenRef.current) return
        const msg = connectErr instanceof Error ? connectErr.message : String(connectErr)
        if (mode === 'sts') {
          setState('error')
          setErrorMessage(`Could not establish Gemini Live connection: ${msg}`)
          return
        } else {
          setIsFallbackSTT(true)
        }
      }
    }

    // Step 4: Fallback Speech-to-Text via browser Web Speech API (if STT mode & API key is not configured)
    if (mode === 'stt') {
      const browserWindow = window as Window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
      }
      const SpeechRecognitionApi = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition

      if (SpeechRecognitionApi) {
        const recognition = new SpeechRecognitionApi()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = navigator.language || 'en-US'

        recognition.onstart = () => {
          if (sessionId === sessionTokenRef.current) {
            setState('listening')
          }
        }

        recognition.onresult = (event) => {
          if (sessionId !== sessionTokenRef.current) return
          const finalParts: string[] = []
          const interimParts: string[] = []

          for (let i = 0; i < event.results.length; i++) {
            const piece = event.results[i][0]?.transcript.trim()
            if (!piece) continue
            if (event.results[i].isFinal) finalParts.push(piece)
            else interimParts.push(piece)
          }

          const combined = finalParts.join(' ').trim()
          const interim = interimParts.join(' ').trim()
          if (combined) {
            transcriptRef.current = combined
            setTranscript(combined)
            setEditableTranscript(combined)
          }
          setInterimSpeech(interim)
        }

        recognition.onerror = (event) => {
          if (sessionId !== sessionTokenRef.current) return
          if (event.error === 'not-allowed') {
            setState('permission_denied')
            setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser.')
          } else if (event.error === 'no-speech') {
            // Keep listening
          } else {
            setState('error')
            setErrorMessage(`Speech recognition error: ${event.error}`)
          }
        }

        recognition.onend = () => {
          if (sessionId === sessionTokenRef.current && stateRef.current === 'listening') {
            setState('stopped')
          }
        }

        recognition.start()
      } else {
        setState('listening')
        setErrorMessage('Speech recognition is not supported in this browser. Configure GEMINI_API_KEY for server-side Gemini Live transcription.')
      }
    }
  }, [mode, playAudioChunk, releaseAudioResources, setupAudioAnalysis, stopAudioPlayback, memoryContext, onExecuteTool])

  useEffect(() => {
    const timer = setTimeout(() => {
      void startVoiceCapture()
    }, 0)

    return () => {
      clearTimeout(timer)
      sessionTokenRef.current += 1
      releaseAudioResources()
    }
  }, [releaseAudioResources, startVoiceCapture])

  // Barge-in / Interrupt Speech-to-Speech playback immediately
  const handleInterrupt = useCallback(() => {
    stopAudioPlayback()
    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.sendRealtimeInput({ audioStreamEnd: true })
      } catch {
        // Ignore
      }
    }
    setState('interrupted')
    setTimeout(() => {
      if (stateRef.current === 'interrupted') {
        setState('listening')
        setActiveScreen('listening')
      }
    }, 300)
  }, [stopAudioPlayback])

  // Stop / Finish recording turn
  const handleStopOrReview = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
    }

    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.sendRealtimeInput({ audioStreamEnd: true })
      } catch {
        // Ignore
      }
    }

    if (mode === 'stt') {
      setState('stopped')
    } else {
      setState('waiting_for_ai')
    }
  }

  // Toggle Microphone Mute
  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next
        })
      }
      return next
    })
  }

  // Toggle Speaker Audio Playback
  const toggleSpeakerMute = () => {
    setIsSpeakerMuted((prev) => {
      const next = !prev
      if (next) {
        stopAudioPlayback()
      }
      return next
    })
  }

  // Comprehensive safe close handler: cleanly releases all audio capture, audio playback,
  // Gemini Live websocket sessions, analysis loops, and browser speech recognition instances
  const handleClose = useCallback(() => {
    sessionTokenRef.current += 1
    releaseAudioResources()
    onClose()
  }, [onClose, releaseAudioResources])

  // Send captured text to main chat
  const handleSendToChat = () => {
    const textToSend = isEditingTranscript ? editableTranscript.trim() : transcript.trim()
    if (!textToSend) return
    sessionTokenRef.current += 1
    releaseAudioResources()
    onSendTranscript(textToSend)
    onClose()
  }

  // Keep captured text in composer
  const handleKeepInComposer = () => {
    const textToKeep = isEditingTranscript ? editableTranscript.trim() : transcript.trim()
    if (textToKeep && onUpdateDraft) {
      onUpdateDraft(textToKeep)
    }
    sessionTokenRef.current += 1
    releaseAudioResources()
    onClose()
  }

  // Retry recording
  const handleRetry = () => {
    setTranscript('')
    transcriptRef.current = ''
    setInterimSpeech('')
    setEditableTranscript('')
    setIsEditingTranscript(false)
    setAssistantSpokenText('')
    stopAudioPlayback()
    void startVoiceCapture()
  }

  // Copy assistant response or full conversation
  const handleCopyText = (content: string) => {
    if (!content) return
    navigator.clipboard.writeText(content).then(() => {
      setCopiedNotification(true)
      setTimeout(() => setCopiedNotification(false), 2000)
    }).catch(() => undefined)
  }

  // Responsive Orb sizing based on viewport height to guarantee zero scroll
  const isSmallScreen = viewportHeight < 680
  const isMediumScreen = viewportHeight >= 680 && viewportHeight < 760

  const largeOrbSize = isSmallScreen ? (viewportHeight < 600 ? 150 : 180) : isMediumScreen ? 220 : 250
  const compactOrbSize = isSmallScreen ? (viewportHeight < 600 ? 95 : 110) : isMediumScreen ? 125 : 145

  // Screen selection: Screen B when NOVA is actively speaking or when response is showing and activeScreen is speaking
  const isSpeakingScreen = activeScreen === 'speaking' || state === 'speaking'

  return (
    <div
      ref={orbRef}
      className="voice-experience-screen fixed inset-0 z-50 flex flex-col justify-between w-full h-[100dvh] max-h-[100dvh] bg-[#07060a] text-[#ded6e8] select-none overflow-hidden px-4 sm:px-8 py-3 sm:py-5"
      role="region"
      aria-label="Voice Interaction"
    >
      {/* Background ambient lighting matching reference */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-violet-950/20 blur-[150px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      {/* TOP TOOLBAR: Compact aligned row matching reference */}
      <header className="voice-topbar w-full max-w-[760px] mx-auto flex items-center justify-between z-10 shrink-0">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-neutral-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          aria-label="Return to chat"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>

        {/* Center: Compact NOVA Model Selector Pill with Real-Time Session Status Indicator */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsModelMenuOpen((prev) => !prev)}
            className="px-3 sm:px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] text-white text-xs font-medium flex items-center gap-1.5 sm:gap-2 transition-colors active:scale-95"
            aria-label="Model selector and session status"
            aria-expanded={isModelMenuOpen}
            aria-haspopup="menu"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                state === 'listening'
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : state === 'speaking'
                  ? 'bg-violet-400 shadow-[0_0_6px_#a78bfa]'
                  : state === 'processing' || state === 'waiting_for_ai'
                  ? 'bg-amber-400 animate-pulse'
                  : state === 'requesting'
                  ? 'bg-amber-400/80 animate-ping'
                  : state === 'error' || state === 'permission_denied'
                  ? 'bg-rose-400'
                  : 'bg-neutral-500'
              }`}
              aria-hidden="true"
            />
            <span>NOVA 3.0</span>
            <ChevronDown size={13} className="text-neutral-400" />
          </button>

          {/* Model info dropdown popover */}
          {isModelMenuOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 rounded-2xl bg-[#14111f] border border-white/[0.1] shadow-2xl backdrop-blur-xl z-50 text-left"
              role="menu"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">Engine Configuration</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-mono">Live</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.04]">
                  <span className="text-white font-medium">Model:</span>
                  <span className="text-neutral-400 font-mono text-[11px]">gemini-3.8-live</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.04]">
                  <span className="text-white font-medium">Interaction:</span>
                  <span className="text-violet-300">
                    {isFallbackSTT ? 'Browser Speech (Fallback)' : mode === 'sts' ? 'Speech-to-Speech' : 'Speech-to-Text'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.04]">
                  <span className="text-white font-medium">Audio Quality:</span>
                  <span className="text-neutral-400 font-mono text-[11px]">24kHz PCM</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Tools: Speaker output control & Secondary action */}
        <div className="flex items-center gap-2">
          {/* Speaker Mute / Unmute Button */}
          <button
            type="button"
            onClick={toggleSpeakerMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              !isSpeakerMuted
                ? 'bg-[#5b21b6]/40 border border-[#8b5cf6]/40 text-[#c084fc] hover:bg-[#5b21b6]/60'
                : 'bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white'
            }`}
            aria-label={isSpeakerMuted ? 'Unmute speaker audio' : 'Mute speaker audio'}
          >
            {!isSpeakerMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Secondary Action: Edit/Notes in Screen A, More options in Screen B */}
          {!isSpeakingScreen ? (
            <button
              type="button"
              onClick={() => setShowTranscriptDrawer(true)}
              className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-neutral-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
              aria-label="Open conversation transcript"
            >
              <Edit3 size={17} />
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-neutral-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
                aria-label="More options"
                aria-expanded={isMoreMenuOpen}
              >
                <MoreHorizontal size={18} />
              </button>

              {isMoreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 p-2 rounded-2xl bg-[#14111f] border border-white/[0.1] shadow-2xl backdrop-blur-xl z-50 text-left space-y-1"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyText(assistantSpokenText)
                      setIsMoreMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <Copy size={14} />
                    <span>Copy response</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTranscriptDrawer(true)
                      setIsMoreMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <FileText size={14} />
                    <span>View transcript</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (assistantSpokenText) onSendTranscript(assistantSpokenText)
                      setIsMoreMenuOpen(false)
                      handleClose()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <Send size={14} />
                    <span>Send to text chat</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* MAIN VIEWPORT COMPOSITION: Clean, centered, and stationary */}
      <main className="voice-stage-viewport flex-1 flex flex-col items-center justify-center min-h-0 w-full max-w-[540px] mx-auto z-10 py-2 sm:py-3">
        {/* The Animated Siri Voice Orb - Stays continuously mounted across all state changes */}
        <div className="voice-orb-container flex items-center justify-center shrink-0 my-2 sm:my-3">
          <SiriVoiceOrb
            state={state}
            audioLevel={audioLevel}
            isMuted={isMuted}
            size={isSpeakingScreen ? compactOrbSize : largeOrbSize}
          />
        </div>

        {/* SCREEN A: Listening State Viewport Composition */}
        {!isSpeakingScreen ? (
          <div className="flex flex-col items-center justify-center text-center max-w-sm sm:max-w-md mx-auto space-y-1.5 sm:space-y-2 select-none animate-fadeIn">
            {/* Small uppercase eyebrow label */}
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-[#a78bfa] uppercase">
              A quiet space to think out loud
            </span>

            {/* Clear prominent heading */}
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-tight">
              {state === 'requesting'
                ? 'Connecting to NOVA...'
                : state === 'processing' || state === 'waiting_for_ai'
                ? 'Thinking...'
                : state === 'permission_denied'
                ? 'Microphone needed'
                : state === 'error'
                ? 'Connection issue'
                : state === 'stopped' || state === 'idle'
                ? 'Ready when you are'
                : 'I’m listening.'}
            </h2>

            {/* Short supporting line */}
            <p className="text-xs sm:text-sm text-[#9f94b3] max-w-xs sm:max-w-sm mx-auto leading-relaxed">
              {state === 'requesting'
                ? 'Initializing real-time audio session...'
                : state === 'processing' || state === 'waiting_for_ai'
                ? 'Working on your request.'
                : state === 'permission_denied'
                ? 'Please allow microphone access in your browser.'
                : state === 'stopped' || state === 'idle'
                ? 'Tap the microphone and speak naturally.'
                : errorMessage || 'Speak naturally. NOVA is listening.'}
            </p>

            {/* Real-time speech hypothesis bubble when user speaks */}
            {interimSpeech && (
              <div className="mt-2 px-3.5 py-1.5 rounded-full bg-violet-950/50 border border-violet-500/30 text-xs text-violet-200 animate-pulse max-w-xs truncate">
                "{interimSpeech}"
              </div>
            )}

            {/* If there was a previous assistant answer, allow user to view response card again */}
            {assistantSpokenText && (
              <button
                type="button"
                onClick={() => setActiveScreen('speaking')}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Sparkles size={12} className="text-violet-400" />
                <span>Show last response</span>
              </button>
            )}
          </div>
        ) : (
          /* SCREEN B: Assistant-Speaking State Viewport Composition */
          <div className="w-full flex flex-col items-center text-center animate-fadeIn">
            {/* Status label matching reference */}
            <p className="text-xs sm:text-sm font-medium text-[#c4b5fd] mb-1">
              NOVA is responding...
            </p>

            {/* Subtle Audio Waveform Visualizer */}
            <WaveformBars audioLevel={audioLevel} isSpeaking={state === 'speaking'} />

            {/* Compact Response Card */}
            <div className="w-full mt-3 p-4 sm:p-5 rounded-[20px] bg-[#120f1d]/90 border border-white/[0.08] backdrop-blur-md shadow-2xl flex flex-col gap-2.5 text-left transition-all max-w-[480px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-900/60 border border-violet-500/30 text-violet-200 text-[11px] font-bold">
                    N
                  </div>
                  <span className="text-xs font-semibold tracking-wider text-white">NOVA</span>
                </div>
                {transcript && (
                  <span className="text-[11px] text-neutral-400 max-w-[200px] truncate">
                    You: {transcript}
                  </span>
                )}
              </div>

              {/* Scrollable Response Body with Internal Scroll Only */}
              <div className="max-h-[110px] sm:max-h-[160px] overflow-y-auto pr-1 text-sm sm:text-[15px] leading-relaxed text-[#f1ebf8] select-text scrollbar-thin">
                {assistantSpokenText ? (
                  <p>{assistantSpokenText}</p>
                ) : (
                  <p className="text-neutral-400 italic">Listening and preparing response...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Non-intrusive error notice banner if an error occurs */}
        {errorMessage && state === 'error' && (
          <div className="mt-3 w-full max-w-md flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-900/40 border border-rose-500/30 text-rose-100 hover:bg-rose-800/40 text-[11px] font-medium transition-colors"
            >
              <RotateCcw size={11} />
              <span>Retry</span>
            </button>
          </div>
        )}
      </main>

      {/* BOTTOM CONTROLS: Clearly visible 3-button row matching reference */}
      <footer className="voice-controls-bar w-full max-w-[480px] mx-auto flex flex-col items-center gap-2 z-10 pb-2 sm:pb-3 shrink-0">
        <div className="flex items-center justify-center gap-7 sm:gap-9">
          {/* Left: Conversation / Transcript Control */}
          <button
            type="button"
            onClick={() => setShowTranscriptDrawer((prev) => !prev)}
            className={`w-[50px] h-[50px] sm:w-[54px] sm:h-[54px] rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              showTranscriptDrawer
                ? 'bg-violet-950/60 border border-violet-500/40 text-violet-200'
                : 'bg-[#151322] border border-white/[0.08] hover:bg-white/[0.08] text-neutral-300 hover:text-white'
            }`}
            title="Conversation transcript"
            aria-label="Conversation transcript"
          >
            <TranscriptBubbleIcon size={21} />
          </button>

          {/* Center: Large Glowing Microphone Control (Screen A) or Pause/Stop Control (Screen B) */}
          {!isSpeakingScreen ? (
            <button
              type="button"
              onClick={() => {
                if (state === 'stopped' || state === 'idle') {
                  handleRetry()
                } else if (state === 'listening') {
                  toggleMute()
                } else {
                  handleStopOrReview()
                }
              }}
              className={`w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full flex items-center justify-center text-white active:scale-95 transition-all ${
                isMuted
                  ? 'bg-gradient-to-b from-[#6b7280] to-[#374151] border-2 border-white/20 ring-4 ring-neutral-700/20'
                  : 'bg-gradient-to-b from-[#b072ff] to-[#7c3aed] border-2 border-white/40 ring-8 ring-violet-500/20 shadow-[0_0_36px_rgba(168,85,247,0.5)] hover:brightness-110'
              }`}
              title={state === 'stopped' || state === 'idle' ? 'Start listening' : isMuted ? 'Unmute microphone' : 'Tap to speak'}
              aria-label={state === 'stopped' || state === 'idle' ? 'Start listening' : isMuted ? 'Unmute microphone' : 'Tap to speak'}
            >
              {isMuted ? <MicOff size={28} /> : <Mic size={28} strokeWidth={2.2} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInterrupt}
              className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full bg-gradient-to-b from-[#b072ff] to-[#7c3aed] border-2 border-white/50 ring-8 ring-violet-500/25 shadow-[0_0_38px_rgba(168,85,247,0.55)] hover:brightness-110 flex items-center justify-center text-white active:scale-95 transition-all"
              title="Stop playback"
              aria-label="Stop playback"
            >
              <PausePillIcon size={26} />
            </button>
          )}

          {/* Right: Close / End-Session Control */}
          <button
            type="button"
            onClick={handleClose}
            className="w-[50px] h-[50px] sm:w-[54px] sm:h-[54px] rounded-full bg-[#151322] border border-white/[0.08] hover:bg-rose-950/40 hover:border-rose-500/30 text-neutral-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            title="End session"
            aria-label="End session"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Status label below controls matching reference */}
        <span className="text-xs text-[#9f94b3] font-medium tracking-wide">
          {!isSpeakingScreen
            ? state === 'stopped' || state === 'idle'
              ? 'Tap to start listening'
              : isMuted
              ? 'Microphone muted'
              : 'Tap to speak'
            : 'Tap to stop'}
        </span>
      </footer>

      {/* FULL CONVERSATION TRANSCRIPT DRAWER / MODAL */}
      {showTranscriptDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Conversation Transcript"
        >
          <div className="w-full max-w-lg bg-[#13101f] border border-white/[0.1] rounded-3xl p-5 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Conversation Transcript</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/60 border border-violet-500/20 text-violet-300 font-mono">
                  {conversationTurns.length} {conversationTurns.length === 1 ? 'turn' : 'turns'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscriptDrawer(false)}
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Close transcript"
              >
                <X size={16} />
              </button>
            </div>

            {/* STT Mode Edit Box */}
            {mode === 'stt' && (
              <div className="pt-3 pb-2">
                <div className="flex items-center justify-between mb-1 text-xs text-neutral-300 font-medium">
                  <span>Captured Words</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingTranscript((prev) => !prev)}
                    className="text-violet-300 hover:text-white inline-flex items-center gap-1 text-[11px]"
                  >
                    <Edit3 size={11} />
                    <span>{isEditingTranscript ? 'Done Editing' : 'Edit Text'}</span>
                  </button>
                </div>
                {isEditingTranscript ? (
                  <textarea
                    value={editableTranscript}
                    onChange={(e) => setEditableTranscript(e.target.value)}
                    className="w-full bg-white/[0.04] border border-violet-400/30 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none h-24"
                    aria-label="Edit transcript text"
                  />
                ) : (
                  <p className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-200">
                    {transcript || <span className="text-neutral-500 italic">No speech captured yet.</span>}
                  </p>
                )}
              </div>
            )}

            {/* Chronological Turns List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin pr-1 text-left">
              {conversationTurns.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 italic">
                  No dialogue yet. Speak into the microphone to begin.
                </div>
              ) : (
                conversationTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-2xl flex flex-col gap-1 text-xs sm:text-sm ${
                      turn.role === 'user'
                        ? 'bg-violet-950/30 border border-violet-500/20 text-[#f3edf9] ml-6'
                        : 'bg-white/[0.03] border border-white/[0.06] text-[#ded6e8] mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                      <span className={turn.role === 'user' ? 'text-violet-300' : 'text-neutral-300'}>
                        {turn.role === 'user' ? 'You' : 'NOVA'}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">{turn.time}</span>
                    </div>
                    <p className="leading-relaxed select-text">{turn.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const fullText = conversationTurns.map((t) => `${t.role === 'user' ? 'You' : 'NOVA'}: ${t.text}`).join('\n\n')
                  handleCopyText(fullText || transcript || assistantSpokenText)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                {copiedNotification ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedNotification ? 'Copied' : 'Copy All'}</span>
              </button>

              <div className="flex items-center gap-2">
                {mode === 'stt' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleKeepInComposer()
                        setShowTranscriptDrawer(false)
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-colors"
                    >
                      Keep in Composer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSendToChat()
                        setShowTranscriptDrawer(false)
                      }}
                      disabled={!transcript.trim() && !editableTranscript.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Send size={13} />
                      <span>Send to Chat</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const textToSend = assistantSpokenText || transcript
                      if (textToSend) onSendTranscript(textToSend)
                      setShowTranscriptDrawer(false)
                      handleClose()
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-violet-600/30 border border-violet-400/40 text-violet-100 hover:bg-violet-600/40 transition-colors"
                  >
                    <Send size={13} />
                    <span>Send to Chat</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
