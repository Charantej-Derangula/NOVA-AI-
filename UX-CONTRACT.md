# NOVA UX Contract

This contract describes the interface behavior for the current local NOVA prototype. Tasks, memories, notes, workspaces, focus totals, preferences, and chat history are saved in this browser's local storage when available. No server or model operation is implied by the UI.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native HTML select in task, schedule, memory, knowledge, and workspace forms | Component labels define the option names | Native select only | Keyboard operation, visible value, and native popup at desktop and narrow viewport |
| Date | Native browser date and time controls for scheduling | Date/time is stored as a local task schedule and formatted with browser locale | Native date/time inputs | Keyboard editing, visible value, locale, and native picker at desktop and narrow viewport |
| Daily history | My Day date switcher | Local calendar date selects the saved schedule for that day; the view returns to today at local midnight | Native date input plus previous/next day controls | Previous/next navigation, direct date selection, current-day return, and scheduled task visibility |
| Form | React form in the owning page component with `noValidate` and inline text errors | This contract and the page component | Task create/edit, schedule, memory create/edit, knowledge create/edit, workspace create/edit | Required fields, whitespace-only values, inline error announcement, valid save, cancel, narrow layout |
| Scrollbar | Global application stylesheet | `src/index.css` | Thin themed scrollbar with WebKit fallback | Standards properties and WebKit fallback are present; scrollable content remains reachable |
| Up next | `DashboardView` task queue | Incomplete task schedule, priority, creation time, and workspace | Overdue, scheduled, and flexible tasks | Completing a task updates the queue; overdue dates and times remain explicit; empty queue offers task creation |
| Voice input | `MessageComposer` voice experience | Explicit microphone action, browser speech recognition transcript, and live microphone analyser | Idle orb, permission request, listening, transcript review, recoverable error | No permission request before the user starts; Tab stays in the dialog; Escape/back preserves the draft; close discards only voice-added text; live audio animates the orb |

## Shared behavior

- Navigation uses the desktop sidebar and switches to a drawer with a labeled bottom bar on narrow screens.
- Search filters records saved in this browser immediately and does not call a remote service.
- Task, memory, knowledge, workspace, focus timer, preference, and conversation changes are written to local storage after each change. If storage is unavailable, the UI says changes may not persist.
- The dashboard timeline and weekly chart derive from scheduled tasks and their completion timestamps; they do not show invented meetings, scores, or sample productivity metrics.
- The Overview “Up next” queue contains the next three incomplete tasks across the task list. Overdue scheduled tasks appear first, most recently overdue before older overdue items; upcoming scheduled tasks follow by time, then flexible tasks by priority.
- Voice input opens as a portrait assistant surface. Microphone access begins only after the user activates its center control. Browser transcription is added to the chat composer for review; no generated assistant response or spoken reply is implied without a model connection.
- My Day filters the shared task list by the selected local calendar date. Midnight changes the active day; it does not delete or reset older tasks. Tasks keeps all saved tasks, and shows the creation date for items without a schedule.
- Empty states explain the next action without inserting fake starter records.
- Destructive actions ask for confirmation before removing local records. Users can export a JSON backup or clear all saved NOVA data from Settings.
- Invalid form submissions retain entered values and display a short correction message beside the form.
- Form fields expose their required state, validation state, and related error text to assistive technology.
- Icon-only actions have accessible names. Keyboard focus remains visible against the dark surface.
- The mobile content area reserves space for the fixed bottom navigation; key text and controls remain available without hover.

## Scope boundary

This prototype has no authoritative backend contract, permission model, deletion service, or AI response service. Local storage persists only in this browser profile; it is not encrypted or synced across devices. Do not imply that a model has responded. Any future integration must define its own loading, error, retry, and persistence behavior before the UI claims success.
