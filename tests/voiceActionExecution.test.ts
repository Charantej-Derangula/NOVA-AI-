import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  executeToolCall,
  executeActionIntent,
  novaToolDefinitions,
  validateToolArguments,
  extractStructuredActionDetails,
  extractNoteFromFollowup,
  type ActionEngineContext,
  type TaskItem,
  type KnowledgeItem,
  type WorkspaceItem,
  type MemoryItem,
} from '../src/services/actionEngine.ts'

const rootDir = path.resolve(import.meta.dirname, '..')

const dummyMemory: MemoryItem = {
  id: 'mem-dummy',
  content: 'dummy',
  category: 'Context',
  createdAt: new Date().toISOString(),
}

const dummyKnowledge: KnowledgeItem = {
  id: 'know-dummy',
  title: 'dummy',
  content: 'dummy',
  kind: 'Personal note',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const dummyWorkspace: WorkspaceItem = {
  id: 'ws-dummy',
  name: 'dummy',
  kind: 'Project',
  createdAt: new Date().toISOString(),
}

const dummyTask: TaskItem = {
  id: 'task-dummy',
  title: 'dummy',
  completed: false,
  createdAt: new Date().toISOString(),
}

describe('Voice Action Execution & Deduplication Tests', () => {
  const voiceSrc = fs.readFileSync(path.join(rootDir, 'src/components/VoiceExperience.tsx'), 'utf-8')
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')

  test('Voice tool declarations expose workspaceName for create_task and save_note', () => {
    const createTaskDef = novaToolDefinitions.find((t) => t.name === 'create_task')
    assert.ok(createTaskDef, 'create_task must be defined in novaToolDefinitions')
    assert.ok(createTaskDef.parameters.properties.workspaceName, 'create_task must accept workspaceName')
    assert.ok(createTaskDef.parameters.properties.workspaceId, 'create_task must accept workspaceId')

    const saveNoteDef = novaToolDefinitions.find((t) => t.name === 'save_note')
    assert.ok(saveNoteDef, 'save_note must be defined in novaToolDefinitions')
    assert.ok(saveNoteDef.parameters.properties.workspaceName, 'save_note must accept workspaceName')
    assert.ok(saveNoteDef.parameters.properties.workspaceId, 'save_note must accept workspaceId')
  })

  test('Voice system instruction forbids refusal and explicitly commands tool invocation for tasks and notes', () => {
    assert.match(voiceSrc, /create_task:\s*Call this tool when the user asks to create/i)
    assert.match(voiceSrc, /save_note:\s*Call this tool when the user asks to save a note/i)
    assert.match(voiceSrc, /NEVER say you do not have the ability to create tasks/i)
    assert.match(voiceSrc, /Wait for the tool execution response before speaking/i)
  })

  test('Voice tool call deduplication prevents duplicate execution on repeated call IDs', () => {
    assert.match(voiceSrc, /executedToolCallsRef/)
    assert.match(voiceSrc, /if\s*\(executedToolCallsRef\.current\.has\(call\.id\)\)/)
    assert.match(voiceSrc, /executedToolCallsRef\.current\.set\(call\.id,\s*cached\)/)
  })

  test('onExecuteTool in App.tsx rejects on action error so Gemini Live only confirms genuine success', () => {
    assert.match(appSrc, /if\s*\(result\.status\s*===\s*'error'\)\s*\{\s*throw new Error/)
  })

  test('executeToolCall successfully creates task with workspace name resolution', async () => {
    const createdTasks: TaskItem[] = []
    const existingWorkspaces: WorkspaceItem[] = [
      {
        id: 'ws-prod-launch-123',
        name: 'Product Launch',
        kind: 'Project',
        color: '#6366f1',
        icon: 'rocket',
        taskCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]

    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: existingWorkspaces,
      activeWorkspaceId: null,
      onAddTask: async (draft) => {
        const task: TaskItem = {
          id: 'task-new-1',
          title: draft.title,
          completed: false,
          priority: draft.priority,
          scheduledAt: draft.scheduledAt,
          estimateMinutes: draft.estimateMinutes,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
        }
        createdTasks.push(task)
        return task
      },
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async () => dummyKnowledge,
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async (ws) => {
        const newWs: WorkspaceItem = {
          id: `ws-${Date.now()}`,
          name: ws.name,
          kind: ws.kind,
          createdAt: new Date().toISOString(),
        }
        existingWorkspaces.push(newWs)
        return newWs
      },
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    // Model passes workspaceName
    const res1 = await executeToolCall(
      'create_task',
      {
        title: 'Voice Test QA',
        workspaceName: 'Product Launch',
        priority: 'high',
      },
      mockCtx
    )

    assert.equal(res1.status, 'executed')
    assert.match(res1.response, /Voice Test QA/)
    assert.equal(createdTasks.length, 1)
    assert.equal(createdTasks[0].title, 'Voice Test QA')
    assert.equal(createdTasks[0].workspaceId, 'ws-prod-launch-123')
    assert.equal(createdTasks[0].priority, 'high')

    // Model passes workspaceId as the literal workspace name string
    const res2 = await executeToolCall(
      'create_task',
      {
        title: 'Voice Test QA 2',
        workspaceId: 'Product Launch',
      },
      mockCtx
    )

    assert.equal(res2.status, 'executed')
    assert.equal(createdTasks.length, 2)
    assert.equal(createdTasks[1].title, 'Voice Test QA 2')
    assert.equal(createdTasks[1].workspaceId, 'ws-prod-launch-123')
  })

  test('executeToolCall successfully saves note with workspace name resolution', async () => {
    const createdNotes: KnowledgeItem[] = []
    const existingWorkspaces: WorkspaceItem[] = [
      {
        id: 'ws-prod-launch-123',
        name: 'Product Launch',
        kind: 'Project',
        color: '#6366f1',
        icon: 'rocket',
        taskCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]

    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: existingWorkspaces,
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async (draft) => {
        const note: KnowledgeItem = {
          id: 'note-new-1',
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        createdNotes.push(note)
        return note
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    const res = await executeToolCall(
      'save_note',
      {
        title: 'Launch Checklist',
        content: 'finalize the prototype, test the app, and prepare the demo.',
        workspaceName: 'Product Launch',
      },
      mockCtx
    )

    assert.equal(res.status, 'executed')
    assert.match(res.response, /Launch Checklist/)
    assert.equal(createdNotes.length, 1)
    assert.equal(createdNotes[0].title, 'Launch Checklist')
    assert.equal(createdNotes[0].content, 'finalize the prototype, test the app, and prepare the demo.')
    assert.equal(createdNotes[0].workspaceId, 'ws-prod-launch-123')
  })

  test('executeToolCall reports validation errors truthfully for invalid inputs', async () => {
    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async () => dummyKnowledge,
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    // Missing title
    const res1 = await executeToolCall('create_task', {}, mockCtx)
    assert.equal(res1.status, 'error')
    assert.match(res1.error || '', /Missing required argument "title"/)

    // Invalid priority enum
    const res2 = await executeToolCall('create_task', { title: 'Test', priority: 'super-urgent' }, mockCtx)
    assert.equal(res2.status, 'error')
    assert.match(res2.error || '', /must be one of: low, medium, high/)
  })

  test('validateToolArguments accepts workspaceName cleanly without errors', () => {
    const valTask = validateToolArguments('create_task', {
      title: 'Voice Test QA',
      workspaceName: 'Product Launch',
      priority: 'high',
    })
    assert.equal(valTask.valid, true)
    assert.equal(valTask.cleanedArgs?.workspaceName, 'Product Launch')

    const valNote = validateToolArguments('save_note', {
      title: 'Voice Note',
      content: 'Note body',
      workspaceName: 'Product Launch',
    })
    assert.equal(valNote.valid, true)
    assert.equal(valNote.cleanedArgs?.workspaceName, 'Product Launch')
  })

  test('Voice note saving with title and body alias preserves title and body exactly', async () => {
    const createdNotes: KnowledgeItem[] = []
    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async (draft) => {
        const note: KnowledgeItem = {
          id: 'note-voice-1',
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        createdNotes.push(note)
        return note
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    // Model passes body instead of content, and kind as 'Personal note'
    const res = await executeToolCall(
      'save_note',
      {
        title: 'Voice',
        body: 'voice is perfect',
        kind: 'Personal note',
      },
      mockCtx
    )

    assert.equal(res.status, 'executed')
    assert.equal(createdNotes.length, 1)
    assert.equal(createdNotes[0].title, 'Voice')
    assert.equal(createdNotes[0].content, 'voice is perfect')
    assert.equal(createdNotes[0].kind, 'Personal note')
    assert.equal(res.recordId, 'note-voice-1')
    assert.match(res.response, /Note Saved & Persisted/)
  })

  test('Voice note duplicate avoidance prevents duplicate records when already existing', async () => {
    let addKnowledgeCallCount = 0
    const existingNote: KnowledgeItem = {
      id: 'note-existing-voice',
      title: 'Voice',
      content: 'voice is perfect',
      kind: 'Personal note',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [existingNote],
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async () => {
        addKnowledgeCallCount++
        return dummyKnowledge
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    const res = await executeToolCall(
      'save_note',
      {
        title: 'Voice',
        body: 'voice is perfect',
      },
      mockCtx
    )

    assert.equal(res.status, 'executed')
    assert.equal(res.recordId, 'note-existing-voice')
    assert.equal(addKnowledgeCallCount, 0, 'Must not create duplicate note when identical record exists')
    assert.match(res.response, /Note Already Saved & Verified/)
  })

  test('Voice note failed persistence returns real error instead of claiming success', async () => {
    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async () => {
        throw new Error('Supabase RLS: permission denied for table knowledge')
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    const res = await executeToolCall(
      'save_note',
      {
        title: 'Voice',
        body: 'voice is perfect',
      },
      mockCtx
    )

    assert.equal(res.status, 'error')
    assert.match(res.error || '', /permission denied/)
    assert.match(res.response, /Persistence Failed/)
  })

  test('Speech extraction correctly extracts title, body, and kind from voice phrasing', () => {
    const extracted1 = extractStructuredActionDetails('User requested a personal note titled Voice with body voice is perfect')
    assert.equal(extracted1.actionType, 'note_create')
    assert.equal(extracted1.title, 'Voice')
    assert.equal(extracted1.content, 'voice is perfect')
    assert.equal(extracted1.kind, 'Personal note')

    const extracted2 = extractStructuredActionDetails('Save a note titled Voice with body voice is perfect')
    assert.equal(extracted2.actionType, 'note_create')
    assert.equal(extracted2.title, 'Voice')
    assert.equal(extracted2.content, 'voice is perfect')
  })

  test('Speech extraction recognizes voice note and personal note phrases as NOVA note intents', () => {
    // 1. "voice note in my personal"
    const ext1 = extractStructuredActionDetails('voice note in my personal')
    assert.equal(ext1.actionType, 'note_create')
    assert.equal(ext1.kind, 'Personal note')
    assert.equal(ext1.workspaceName, undefined, '"my personal" must not be treated as a workspace name')
    assert.equal(ext1.isMalformed, true, 'Zero-argument note must be flagged as malformed to prompt for missing details')

    // 2. "Note in my personal"
    const ext2 = extractStructuredActionDetails('Note in my personal.')
    assert.equal(ext2.actionType, 'note_create')
    assert.equal(ext2.kind, 'Personal note')
    assert.equal(ext2.workspaceName, undefined)
    assert.equal(ext2.isMalformed, true)

    // 3. "Create a personal note"
    const ext3 = extractStructuredActionDetails('Create a personal note')
    assert.equal(ext3.actionType, 'note_create')
    assert.equal(ext3.kind, 'Personal note')
    assert.equal(ext3.isMalformed, true)

    // 4. "Make a note in my personal."
    const ext4 = extractStructuredActionDetails('Make a note in my personal.')
    assert.equal(ext4.actionType, 'note_create')
    assert.equal(ext4.kind, 'Personal note')
    assert.equal(ext4.workspaceName, undefined)
    assert.equal(ext4.isMalformed, true)

    // 5. "Save a voice note."
    const ext5 = extractStructuredActionDetails('Save a voice note.')
    assert.equal(ext5.actionType, 'note_create')
    assert.equal(ext5.kind, 'Personal note')
    assert.equal(ext5.isMalformed, true)

    // 6. "Create a note called Voice Test. The content is voice is working."
    const ext6 = extractStructuredActionDetails('Create a note called Voice Test. The content is voice is working.')
    assert.equal(ext6.actionType, 'note_create')
    assert.equal(ext6.title, 'Voice Test')
    assert.equal(ext6.content, 'voice is working.')
    assert.equal(ext6.kind, 'Personal note')
    assert.equal(ext6.workspaceName, undefined)
    assert.equal(ext6.isMalformed, false)
  })

  test('extractNoteFromFollowup extracts title and content from conversational follow-up turns', () => {
    const f1 = extractNoteFromFollowup('Voice Test. The content is voice is working.')
    assert.ok(f1)
    assert.equal(f1.title, 'Voice Test')
    assert.equal(f1.content, 'voice is working')

    const f2 = extractNoteFromFollowup('Voice Test. It says voice is working.')
    assert.ok(f2)
    assert.equal(f2.title, 'Voice Test')
    assert.equal(f2.content, 'voice is working')

    const f3 = extractNoteFromFollowup('Call it Voice Test. Voice is working.')
    assert.ok(f3)
    assert.equal(f3.title, 'Voice Test')
    assert.equal(f3.content, 'Voice is working')
  })

  test('Voice note intent without title/body triggers the single follow-up question without asking for external app', async () => {
    let addKnowledgeCalls = 0
    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async (draft) => {
        addKnowledgeCalls++
        return {
          id: 'note-persisted-1',
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    // "voice note in my personal"
    const res1 = await executeActionIntent({ ...mockCtx, prompt: 'voice note in my personal' })
    assert.equal(res1.status, 'needs_confirmation')
    assert.equal(res1.response, 'Sure — what should I call the note, and what should it say?')
    assert.equal(addKnowledgeCalls, 0)

    // "Note in my personal"
    const res2 = await executeActionIntent({ ...mockCtx, prompt: 'Note in my personal.' })
    assert.equal(res2.status, 'needs_confirmation')
    assert.equal(res2.response, 'Sure — what should I call the note, and what should it say?')
    assert.equal(addKnowledgeCalls, 0)

    // "Create a personal note"
    const res3 = await executeActionIntent({ ...mockCtx, prompt: 'Create a personal note' })
    assert.equal(res3.status, 'needs_confirmation')
    assert.equal(res3.response, 'Sure — what should I call the note, and what should it say?')
    assert.equal(addKnowledgeCalls, 0)
  })

  test('Multi-turn note request: User first says "create a note" and then provides title and content', async () => {
    const savedNotes: KnowledgeItem[] = []
    const mockCtx: ActionEngineContext = {
      prompt: '',
      tasks: [],
      memories: [],
      knowledge: savedNotes,
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async (draft) => {
        const note: KnowledgeItem = {
          id: 'note-multiturn-1',
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        savedNotes.push(note)
        return note
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    // Turn 1: User says "create a note"
    const turn1 = await executeActionIntent({ ...mockCtx, prompt: 'create a note' })
    assert.equal(turn1.status, 'needs_confirmation')
    assert.equal(turn1.response, 'Sure — what should I call the note, and what should it say?')
    assert.equal(savedNotes.length, 0, 'No note must be persisted on turn 1')

    // Turn 2: User provides title and content "Voice Test. The content is voice is working."
    const turn2 = await executeActionIntent({
      ...mockCtx,
      prompt: 'Create a note called Voice Test. The content is voice is working.',
    })
    assert.equal(turn2.status, 'executed')
    assert.match(turn2.response, /Note Saved & Persisted/)
    assert.equal(savedNotes.length, 1)
    assert.equal(savedNotes[0].title, 'Voice Test')
    assert.equal(savedNotes[0].content, 'voice is working.')
    assert.equal(savedNotes[0].kind, 'Personal note')
    assert.equal(savedNotes[0].workspaceId, undefined)
  })

  test('Successful note creation and verified persistence', async () => {
    const store: KnowledgeItem[] = []
    const mockCtx: ActionEngineContext = {
      prompt: 'Create a note called Voice Test. The content is voice is working.',
      tasks: [],
      memories: [],
      knowledge: store,
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async (draft) => {
        const item: KnowledgeItem = {
          id: 'note-verified-persistence-77',
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        store.push(item)
        return item
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    const res = await executeActionIntent(mockCtx)
    assert.equal(res.status, 'executed')
    assert.equal(res.recordId, 'note-verified-persistence-77')
    assert.match(res.response, /Note Saved & Persisted/)
    assert.match(res.response, /Voice Test/)
    assert.equal(store.length, 1)
    assert.equal(store[0].id, 'note-verified-persistence-77')
    assert.equal(store[0].title, 'Voice Test')
    assert.equal(store[0].content, 'voice is working.')
    assert.equal(store[0].kind, 'Personal note')
  })

  test('Failed persistence never produces a success confirmation', async () => {
    const mockCtx: ActionEngineContext = {
      prompt: 'Create a note called Voice Test. The content is voice is working.',
      tasks: [],
      memories: [],
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
      onAddTask: async () => dummyTask,
      onUpdateTask: async () => {},
      onDeleteTask: async () => {},
      onToggleTask: async () => {},
      onDeleteAllTasks: async () => {},
      onAddMemory: async () => dummyMemory,
      onUpdateMemory: async () => {},
      onDeleteMemory: async () => {},
      onAddKnowledge: async () => {
        throw new Error('Supabase insert failed: network timeout')
      },
      onUpdateKnowledge: async () => {},
      onDeleteKnowledge: async () => {},
      onAddWorkspace: async () => dummyWorkspace,
      onUpdateWorkspace: async () => {},
      onDeleteWorkspace: async () => {},
      onSelectWorkspace: () => {},
    }

    const res = await executeActionIntent(mockCtx)
    assert.equal(res.status, 'error')
    assert.match(res.error || '', /network timeout/)
    assert.match(res.response, /Persistence Failed/)
    assert.doesNotMatch(res.response, /Note Saved & Persisted/)
    assert.doesNotMatch(res.response, /✓/)
  })
})
