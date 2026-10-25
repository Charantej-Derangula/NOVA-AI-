---
version: alpha
name: NOVA
description: A personal AI workspace with a restrained near-black canvas, purple light, and clear planning surfaces.
colors:
  background: "#08070c"
  surface: "#110e18"
  elevated: "#17131f"
  primary: "#b37aff"
  text: "#f5f1f8"
  muted: "#9b95a7"
  teal: "#68dacb"
  amber: "#eab96b"
  day-accent: "#70d3c2"
  day-highlight: "#bfdb8a"
  task-accent: "#f29a78"
  task-highlight: "#e7bb68"
typography:
  sans:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    lineHeight: "1.55"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  panel: "1.125rem"
spacing:
  page-gutter: "clamp(1rem, 4vw, 3.625rem)"
  page-max: "69.375rem"
  mobile-bottom-safe-area: "7rem"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "#08070c"
    typography: "{typography.sans}"
    rounded: "{rounded.md}"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  input:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.sans}"
    rounded: "{rounded.md}"
    height: "2.75rem"
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  current-week-chart:
    backgroundColor: "{colors.teal}"
    textColor: "#08070c"
  focus-chart:
    backgroundColor: "{colors.amber}"
    textColor: "#08070c"
  metadata:
    typography: "{typography.mono}"
    textColor: "{colors.muted}"
  day-command:
    backgroundColor: "{colors.day-accent}"
    textColor: "#08070c"
  day-progress:
    backgroundColor: "{colors.day-highlight}"
    textColor: "#08070c"
  task-queue:
    backgroundColor: "{colors.task-accent}"
    textColor: "#08070c"
  task-progress:
    backgroundColor: "{colors.task-highlight}"
    textColor: "#08070c"
---

# NOVA Design System

## Overview

### Creative North Star

NOVA should feel like a personal work console after dark: quiet, precise, and easy to scan, with a single violet signal for actions and a warm amber note for focus data. The supplied references are the visual authority for the near-black surfaces, focused purple chat treatment, and practical daily-planning layouts.

### Product context and register

- **Audience and primary job:** A person organizing conversations, daily plans, tasks, saved context, and project notes.
- **Target market(s) and evidence:** General personal productivity use; no region-specific business or regulatory workflow is defined in this prototype.
- **Locale(s) and language policy:** English UI; dates and numbers use browser locale formatting in the current prototype.
- **Usage scene:** Desktop workspace with a narrow-screen companion layout; people scan and edit lists throughout the day.
- **Register:** Product interface across all routes.
- **Memorable signature:** A restrained violet glow around the chat orb and selected actions; keep it localized.
- **Route signatures:** My Day uses a sea-glass timeline accent (`day-accent`, `day-highlight`) to make time and completion easy to read. Tasks uses a copper-and-ochre queue accent (`task-accent`, `task-highlight`) to make priority and forward action distinct from the violet Overview and Chat surfaces.
- **Daily history:** My Day is a date-aware planner, not a one-day buffer. Its date switcher browses saved local schedules; the task list remains the complete record.
- **Restraint:** Prioritize legibility and recognizable task patterns over decoration. The existing four-point mark stays unchanged in this typography pass; do not replace it with an N initial.
- **Anti-references:** Avoid light SaaS dashboards, neon gradients across every card, and tiny all-caps labels that compete with task content.
- **Token ownership/runtime mapping:** `src/App.css` owns NOVA surface, type, and route-accent tokens; `.day-page` and `.tasks-page` custom properties apply the route signatures above. `src/index.css` supplies Tailwind theme aliases. The readability scale is expressed as `--nova-type-*` variables in `src/App.css` and consumed by shared route styles.

## Colors

The background (`#08070c`) anchors the product. Cards rise through `#110e18` and `#17131f`; violet (`#b37aff`) marks brand navigation and Overview/Chat focus. My Day uses sea-glass (`#70d3c2`) and soft leaf (`#bfdb8a`) for the schedule and completion path. Tasks uses copper (`#f29a78`) and ochre (`#e7bb68`) for its action-first queue; priority markers remain semantic. Primary text is `#f5f1f8`; muted copy uses `#9b95a7`. Thin white strokes define panel edges. Keep contrast in text and controls; do not dim actionable content to create atmosphere.

## Typography

Use the existing Inter-first system stack for every route. Headlines use larger scale and moderate weight; body copy is 15px on wider screens and 14px on narrow screens, supporting text is 14px/13px, and captions stay at 12px/11px. Reserve 11px utility text for compact metadata, never for task descriptions or essential instructions. Keep line-height near 1.5 for prose and allow long task titles to wrap. Monospaced text is for short timestamps and keyboard hints only.

## Layout

The desktop shell has a fixed 276px navigation rail and a centered content column up to 1110px wide. Settings uses a centered 900px content area. Page gutters scale with viewport width. At 700px and below, navigation becomes a drawer, primary navigation moves to a safe-area-aware bottom bar, and timeline events stack as readable rows. At 390px and below, workspace cards, dashboard metrics, and scheduling forms use a single column. Preserve reachable controls and use a 112px mobile bottom content inset where the floating navigation overlaps the page.

## Elevation & Depth

Build hierarchy with tonal layers, a thin stroke, and quiet shadows. Use blur only for the sidebar, header, and floating mobile navigation. Reserve stronger glow for the chat orb or a selected action; static cards stay legible without glow.

## Shapes

Cards use 16–20px corners, forms and navigation controls use 9–13px corners, and the chat orb is circular. Buttons have at least a 44px minimum height on touch-oriented surfaces. Keep dividers thin and low contrast.

## Components

### Foundational visual states

Selected navigation uses a muted violet wash and a visible left edge. Focus-visible controls use a 2px violet outline with offset. Hover is quiet; disabled actions reduce opacity without changing geometry. Honor `prefers-reduced-motion` for transitions and animated details.

### Buttons and actions

Filled violet pills are for the primary action. Subtle bordered controls support secondary actions; text actions remain visually quiet but keep a readable hit area. Icon-only controls need accessible names.

### Navigation and data display

The desktop sidebar groups routes and recent conversations. The mobile bottom bar exposes the main routes with labels. Use clear section headings, readable task cards, a compact but labeled dashboard chart, and stacked schedule events on phones.

### Forms and overlays

Inputs use the same near-black surface and neutral border as cards. Preserve native keyboard behavior, visible focus, and sufficient hit areas. Search and task-entry controls should fill narrow screens without horizontal overflow.

### Iconography

Use Lucide React outline icons with consistent optical weight. Keep text labels beside actions when space allows; provide accessible names for icon-only controls.

### Motion

Use short transitions for selection and hover feedback only. There are no cursor-following or decorative pointer effects. Respect reduced-motion preferences.

### Content and data visualization

Use plain, calm language. Focus totals and the weekly chart derive from saved focus sessions and completed task timestamps. Do not create placeholder activities or imply a connected tracker. Violet and slate bars show the current and previous week; the day marker identifies today.

## Do's and Don'ts

- **Do:** Make task titles, instructions, and primary controls readable at a glance.
- **Do:** Keep the dark-purple NOVA identity consistent across every page.
- **Don't:** Shrink mobile body copy to fit a desktop density pattern.
- **Don't:** spread glow effects across every surface or invent backend activity in the interface.
