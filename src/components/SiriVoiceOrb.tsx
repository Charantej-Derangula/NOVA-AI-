import React, { useEffect, useRef } from 'react'
import type { VoiceState } from './VoiceExperience'

interface SiriVoiceOrbProps {
  state: VoiceState
  audioLevel: number // 0 to 1
  isMuted?: boolean
  size?: number
  className?: string
}

interface HarmonicWave {
  speed: number
  freq: number
  phase: number
  amp: number
  color: string
}

/**
 * A Siri-style organic voice orb built with Canvas 2D.
 * Reacts to microphone and assistant playback audio levels in real time.
 * Persistently visible throughout all voice states (connecting, idle, listening, thinking, speaking).
 * Completely avoids React DOM attribute fighting to eliminate flashing, disappearing, or clipping.
 */
export const SiriVoiceOrb: React.FC<SiriVoiceOrbProps> = ({
  state,
  audioLevel,
  isMuted = false,
  size = 280,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const smoothedAudioRef = useRef(0)
  const timeRef = useRef(0)
  const propsRef = useRef({ state, audioLevel, isMuted, size })
  useEffect(() => {
    propsRef.current = { state, audioLevel, isMuted, size }
  })

  // Multi-frequency wave harmonics for fluid liquid surface:
  // violet, indigo, and a restrained amount of blue
  const wavesRef = useRef<HarmonicWave[]>([
    { speed: 1.0, freq: 2, phase: 0, amp: 0.065, color: 'rgba(139, 92, 246, 0.65)' }, // Violet
    { speed: 1.4, freq: 3, phase: Math.PI / 3, amp: 0.055, color: 'rgba(79, 70, 229, 0.6)' }, // Indigo
    { speed: 1.8, freq: 3, phase: Math.PI * 0.8, amp: 0.045, color: 'rgba(56, 189, 248, 0.45)' }, // Blue/Cyan accent
    { speed: 1.2, freq: 4, phase: Math.PI * 1.4, amp: 0.04, color: 'rgba(167, 139, 250, 0.55)' }, // Lavender/Violet
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let isMounted = true

    const render = () => {
      if (!isMounted) return

      const { state: currentState, audioLevel: currentAudio, isMuted: currentMuted, size: currentSize } = propsRef.current
      const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // 2x high-resolution retina rendering for crisp fluid edges on all devices
      const dpr = 2
      const displayWidth = currentSize
      const displayHeight = currentSize
      const targetCanvasW = displayWidth * 2
      const targetCanvasH = displayHeight * 2

      // Only resize canvas buffer when actual target pixel dimensions change
      if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
        canvas.width = targetCanvasW
        canvas.height = targetCanvasH
      }

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, displayWidth, displayHeight)

      const cx = displayWidth / 2
      const cy = displayHeight / 2
      const baseRadius = Math.min(cx, cy) * 0.62

      // Smooth audio interpolation (spring towards target level)
      const targetAudio = currentMuted ? 0 : Math.max(0, Math.min(1, currentAudio))
      const smoothingFactor = targetAudio > smoothedAudioRef.current ? 0.35 : 0.12
      smoothedAudioRef.current += (targetAudio - smoothedAudioRef.current) * smoothingFactor
      const smoothedLevel = prefersReducedMotion ? 0 : smoothedAudioRef.current

      // Time progression based on voice state
      let speedMultiplier = 0.7
      if (currentState === 'requesting') {
        speedMultiplier = 1.0 // Gentle connecting breathing
      } else if (currentState === 'listening') {
        speedMultiplier = 1.2 + smoothedLevel * 1.8
      } else if (currentState === 'speaking') {
        speedMultiplier = 1.5 + smoothedLevel * 2.0
      } else if (currentState === 'processing' || currentState === 'waiting_for_ai') {
        speedMultiplier = 2.0
      } else if (currentState === 'error' || currentState === 'permission_denied') {
        speedMultiplier = 0.35
      }

      if (prefersReducedMotion) speedMultiplier = 0.08

      timeRef.current += 0.016 * speedMultiplier
      const t = timeRef.current

      // Scale multiplier with gentle connecting breathing
      const connectingBreathing = currentState === 'requesting' ? Math.sin(t * 2.4) * 0.035 : 0
      const scaleMultiplier = 1 + connectingBreathing + ((currentState === 'speaking' || currentState === 'listening') ? smoothedLevel * 0.2 : 0)
      const orbRadius = baseRadius * scaleMultiplier

      // 1. Ambient Background Halo Glow - Restrained and close to orb
      const glowRadius = orbRadius * 1.35 + smoothedLevel * 18
      const glowGrad = ctx.createRadialGradient(cx, cy, orbRadius * 0.35, cx, cy, glowRadius)

      if (currentState === 'error' || currentState === 'permission_denied') {
        glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.32)')
        glowGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.12)')
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else {
        const glowOpacity = currentMuted ? 0.15 : 0.32 + smoothedLevel * 0.4
        glowGrad.addColorStop(0, `rgba(147, 51, 234, ${glowOpacity * 0.8})`)
        glowGrad.addColorStop(0.4, `rgba(79, 70, 229, ${glowOpacity * 0.5})`)
        glowGrad.addColorStop(0.75, `rgba(37, 99, 235, ${glowOpacity * 0.18})`)
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Helper function to build a smooth organic blob path using quadratic beziers
      const drawOrganicShape = (
        rBase: number,
        pointsCount: number,
        waveFreq: number,
        waveAmp: number,
        phaseOffset: number,
        rotation: number
      ) => {
        const points: { x: number; y: number }[] = []
        for (let i = 0; i < pointsCount; i++) {
          const theta = (i / pointsCount) * Math.PI * 2 + rotation
          // Combined harmonics for continuous liquid deformation
          const harmonic1 = Math.sin(theta * waveFreq + t * 2.0 + phaseOffset)
          const harmonic2 = Math.cos(theta * (waveFreq + 1) - t * 1.4 + phaseOffset * 1.3)
          const audioDeform = Math.sin(theta * 5 + t * 3.8) * smoothedLevel * 0.22
          const r = rBase * (1 + (harmonic1 * 0.6 + harmonic2 * 0.4) * waveAmp + audioDeform)
          points.push({
            x: cx + r * Math.cos(theta),
            y: cy + r * Math.sin(theta),
          })
        }

        ctx.beginPath()
        const first = points[0]
        const last = points[points.length - 1]
        const midX = (last.x + first.x) / 2
        const midY = (last.y + first.y) / 2
        ctx.moveTo(midX, midY)

        for (let i = 0; i < points.length; i++) {
          const curr = points[i]
          const next = points[(i + 1) % points.length]
          const xc = (curr.x + next.x) / 2
          const yc = (curr.y + next.y) / 2
          ctx.quadraticCurveTo(curr.x, curr.y, xc, yc)
        }
        ctx.closePath()
      }

      // 2. Base Liquid Core
      ctx.save()
      drawOrganicShape(orbRadius, 10, 2, 0.045 + smoothedLevel * 0.065, 0, t * 0.18)

      const coreGrad = ctx.createLinearGradient(
        cx - orbRadius * Math.cos(t * 0.4),
        cy - orbRadius * Math.sin(t * 0.4),
        cx + orbRadius * Math.cos(t * 0.4),
        cy + orbRadius * Math.sin(t * 0.4)
      )

      if (currentState === 'error' || currentState === 'permission_denied') {
        coreGrad.addColorStop(0, '#7f1d1d')
        coreGrad.addColorStop(0.5, '#450a0a')
        coreGrad.addColorStop(1, '#180303')
      } else if (currentMuted) {
        coreGrad.addColorStop(0, '#312e81')
        coreGrad.addColorStop(0.6, '#1e1b4b')
        coreGrad.addColorStop(1, '#0b0918')
      } else {
        coreGrad.addColorStop(0, '#4338ca') // Deep Indigo
        coreGrad.addColorStop(0.35, '#6d28d9') // Deep Violet
        coreGrad.addColorStop(0.7, '#3b82f6') // Blue accent
        coreGrad.addColorStop(1, '#05040a') // Deep dark edge
      }
      ctx.fillStyle = coreGrad
      ctx.fill()
      ctx.clip()

      // 3. Flowing Internal Fluid Ribbons
      ctx.globalCompositeOperation = 'screen'

      wavesRef.current.forEach((w, idx) => {
        const waveRadius = orbRadius * (0.86 - idx * 0.09)
        const rotationSpeed = (idx % 2 === 0 ? 1 : -1) * (0.25 + idx * 0.12)
        const rot = t * rotationSpeed + w.phase

        drawOrganicShape(
          waveRadius,
          8,
          w.freq,
          w.amp + smoothedLevel * 0.1,
          w.phase + t * w.speed,
          rot
        )

        const ribbonGrad = ctx.createRadialGradient(
          cx + Math.cos(rot + idx) * orbRadius * 0.3,
          cy + Math.sin(rot + idx) * orbRadius * 0.3,
          orbRadius * 0.1,
          cx,
          cy,
          orbRadius * 0.95
        )

        ribbonGrad.addColorStop(0, w.color)
        ribbonGrad.addColorStop(0.6, w.color.replace(/[\d.]+\)$/, '0.2)'))
        ribbonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = ribbonGrad
        ctx.fill()
      })

      // 4. Thinking/Processing Swirl Effect
      if (currentState === 'processing' || currentState === 'waiting_for_ai' || currentState === 'requesting') {
        const swirlAngle = t * (currentState === 'requesting' ? 1.8 : 3.0)
        const swirlGrad = ctx.createConicGradient(swirlAngle, cx, cy)
        swirlGrad.addColorStop(0, 'rgba(147, 51, 234, 0.4)')
        swirlGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.45)')
        swirlGrad.addColorStop(0.6, 'rgba(99, 102, 241, 0.45)')
        swirlGrad.addColorStop(0.85, 'rgba(167, 139, 250, 0.35)')
        swirlGrad.addColorStop(1, 'rgba(147, 51, 234, 0.4)')

        ctx.fillStyle = swirlGrad
        ctx.beginPath()
        ctx.arc(cx, cy, orbRadius * 0.92, 0, Math.PI * 2)
        ctx.fill()
      }

      // 5. Center Soft Light Flare
      const centerFlare = ctx.createRadialGradient(
        cx + Math.cos(t * 0.7) * orbRadius * 0.12,
        cy + Math.sin(t * 0.7) * orbRadius * 0.12,
        0,
        cx,
        cy,
        orbRadius * 0.65
      )
      centerFlare.addColorStop(0, `rgba(255, 255, 255, ${0.4 + smoothedLevel * 0.35})`)
      centerFlare.addColorStop(0.3, `rgba(196, 181, 253, ${0.3 + smoothedLevel * 0.25})`)
      centerFlare.addColorStop(0.7, 'rgba(109, 40, 217, 0.08)')
      centerFlare.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx.fillStyle = centerFlare
      ctx.beginPath()
      ctx.arc(cx, cy, orbRadius * 0.7, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore() // Remove clip from core

      // 6. Fresnel Luminous Edge (Rim Glow)
      ctx.save()
      drawOrganicShape(orbRadius, 10, 2, 0.045 + smoothedLevel * 0.065, 0, t * 0.18)
      ctx.lineWidth = 1.5 + smoothedLevel * 1.2
      ctx.strokeStyle =
        currentState === 'error' || currentState === 'permission_denied'
          ? 'rgba(248, 113, 113, 0.5)'
          : `rgba(224, 204, 255, ${0.55 + smoothedLevel * 0.35})`
      ctx.stroke()
      ctx.restore()

      // Crucial: Restore outer frame transform stack
      ctx.restore()

      animFrameRef.current = window.requestAnimationFrame(render)
    }

    animFrameRef.current = window.requestAnimationFrame(render)

    return () => {
      isMounted = false
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [])

  return (
    <div
      className={`voice-orb-wrapper relative flex items-center justify-center select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="pointer-events-none drop-shadow-[0_0_28px_rgba(139,92,246,0.28)] block"
      />
    </div>
  )
}
