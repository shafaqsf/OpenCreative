# OpenCreative

OpenCreative is a **canvas-first AI workflow builder** for creative projects. It combines a dashboard for organizing projects and folders, an infinite SVG canvas for visual workflow design, reusable templates, and a floating AI agent chatbar that can inspect the current workspace and execute supported canvas actions.

**Status:** Active early product development. The core dashboard, project canvas, workflow nodes, templates, persistence, and action-capable agent foundation are implemented, but the app is not production hardened yet.

---

## Features

### Dashboard
- Create, rename, duplicate, and delete projects and folders
- Browse folder contents and move projects between folders
- Pin projects for quick access and archive projects to hide them
- Search and filter projects

### Infinite Canvas
- Full-screen SVG canvas with smooth pan (middle-click or Alt+click) and zoom (Ctrl+scroll)
- Drawing and annotation tools: Select, Rectangle, Ellipse, Triangle, Diamond, Star, Line, Arrow, Text, Freehand Draw
- Workflow nodes: **Prompt**, **Source**, **Generate**, **Output** — drag-and-drop or click to place
- Node connection system: drag from output ports to input ports with cycle detection
- Grid snapping and alignment guides
- Layer ordering (bring to front, send to back)
- Marquee selection, multi-select (Shift+click), copy/paste, duplicate
- Undo/redo history (up to 100 steps)
- Mini-map for canvas navigation
- Resizable left (tools/agent) and right (properties) panels

### Workflow Execution
- Connect Prompt/Source nodes to Generate nodes to define AI workflows
- Run workflows directly from the canvas toolbar
- Multi-variation support (multiple outputs per generate node)
- Auto-creates Output nodes when running a workflow
- Output gallery for viewing generated media
- Supports both image and video generation models

### Templates
- **Built-in templates:** Text to image, Image to video, Multi-variation
- **Custom templates:** Save selected canvas elements as reusable templates (stored in browser localStorage)
- Drag templates from the tools panel onto the canvas, or click to insert
- Pin, rename, duplicate, and delete custom templates

### AI Agent
- Floating chatbar over the project canvas with conversation history
- Sends current app state to `/api/assistant` and receives tool/function-call style actions
- Supported agent actions:
  - Create workflow nodes (prompt, source, generate) and connections
  - Move nodes and update positions
  - Connect existing nodes by ID
  - Update node properties
  - Create annotation shapes (rectangle, ellipse, text, etc.)
  - Set camera position and zoom
  - Run the workflow
  - Select canvas tools
  - Delete, duplicate, and rename selections
- Persistent chat history with pin/archive/delete support
- Uses OpenAI `gpt-4o-mini` via OpenRouter

### Persistence
- Projects and folders persisted in **Supabase Postgres**
- Generated media metadata saved to Supabase (`generated_media` table)
- Workflow state auto-saves (or manual save) to Supabase
- Agent chat history, messages, and workflow checkpoints persisted
- Asset uploads stored in Supabase Storage (`assets` bucket)
- Templates stored in browser localStorage

### Additional UI
- Command palette (Ctrl+K / Cmd+K)
- Toast notifications
- Right-click context menu on canvas
- Keyboard shortcuts for tools (V, R, O, T, D, L, A, S, G, H)
- Auto-save toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, lucide-react |
| Persistence | Supabase (Postgres + Storage) |
| AI API | OpenRouter via OpenAI-compatible SDK |
| Canvas State | Local React Context with undo/redo history |
| Templates | Built-in (code-generated) + custom (browser localStorage) |

---

## Prerequisites / Installation

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** (comes with Node.js)
- A **Supabase** project (free tier works)
- An **OpenRouter** API key

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Both `.env` and `.env.local` are supported (both are ignored via `.gitignore`).

Fill in the required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (found in Supabase dashboard > Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |
| `OPENROUTER_API_KEY` | Your OpenRouter API key for agent and generation requests |
| `NEXT_PUBLIC_SITE_URL` | Optional. Used in OpenRouter request headers (defaults to `http://localhost:3000`) |

---

## Configuration

### Next.js Config

The `next.config.ts` enables server actions with a 10 MB body size limit:

```ts
experimental: {
  serverActions: {
    bodySizeLimit: "10mb",
  },
}
```

### Supabase Setup

Apply the SQL migrations in `supabase/migrations/` in order to create the required database schema. The migrations are:

1. **001_initial_schema.sql** — `folders` and `projects` tables with UUID primary keys and JSONB workflow storage
2. **002_storage_bucket.sql** — Public `assets` storage bucket with permissive read/write/delete policies for development
3. **003_remove_ad_type.sql** — Removes legacy `ad_type` column (safe to run on fresh databases)
4. **004_workflow_defaults.sql** — Updated workflow JSON defaults including `connections` and `ui` fields
5. **005_generated_media_library.sql** — `generated_media` table for persisting AI outputs
6. **006_agent_chats.sql** — `agent_chats`, `agent_messages`, and `agent_checkpoints` tables for chat history
7. **007_disable_rls.sql** — Disables Row Level Security on all tables (development only; no auth implemented)

> **Note:** The current storage policies and RLS settings are intentionally permissive for development. Review and tighten them before using with real user data or in production.

---

## Usage / Running

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production app |
| `npm run start` | Start the production server |
| `npm run lint` | Run Next.js ESLint |

### How to Use

1. **Dashboard:** Create folders and projects from the dashboard home page.
2. **Project Canvas:** Click a project to open the full-screen canvas editor.
3. **Add Nodes:** Select a node type (Prompt, Source, Generate) from the left panel, then click on the canvas to place it.
4. **Connect Nodes:** Drag from the right edge (output port) of a node to the left edge (input port) of another.
5. **Configure Nodes:** Click a node and edit its properties in the right properties panel.
6. **Run Workflow:** Click the Play button in the toolbar or ask the AI agent.
7. **Use Templates:** Click or drag templates from the left panel onto the canvas.
8. **AI Agent:** Type commands in the floating chatbar at the bottom of the canvas (e.g., "Create a prompt-to-image workflow with a cinematic scene").
9. **Save:** Workflow state auto-saves; toggle auto-save off for manual saving.

---

## Testing

No test infrastructure is currently configured. There are no unit tests, integration tests, or end-to-end tests in the codebase.

---

## Project Structure

```text
opencreative/
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── eslint.config.mjs             # ESLint flat config (next/core-web-vitals)
├── next.config.ts                # Next.js configuration (10MB server action limit)
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS config (Tailwind CSS v4)
├── tsconfig.json                 # TypeScript configuration (path alias @/*)
│
├── public/                       # Static assets (currently empty)
│
├── supabase/
│   └── migrations/               # Database and storage migrations (7 files)
│
└── src/
    ├── middleware.ts             # Next.js middleware (Supabase session refresh)
    ├── app/
    │   ├── globals.css           # Global styles + Tailwind + canvas-grid utility
    │   ├── layout.tsx            # Root layout (Toast, CommandPalette providers)
    │   ├── page.tsx              # Dashboard home (folders + projects)
    │   ├── api/
    │   │   ├── assistant/route.ts  # AI Agent API endpoint
    │   │   └── upload/route.ts     # Asset upload endpoint
    │   ├── folder/[id]/
    │   │   └── page.tsx          # Folder detail page
    │   └── project/[id]/
    │       ├── page.tsx          # Project page (loads project data)
    │       └── project-canvas.tsx # Canvas editor (main client component)
    │
    ├── components/
    │   ├── canvas/
    │   │   ├── canvas.tsx        # Main SVG canvas (pointer events, drag/drop)
    │   │   ├── shape.tsx         # Shape rendering (rect, ellipse, text, etc.)
    │   │   ├── selection-overlay.tsx # Selection handles and resize controls
    │   │   ├── align-toolbar.tsx # Alignment toolbar
    │   │   ├── zoom-controls.tsx # Zoom in/out/reset controls
    │   │   ├── mini-map.tsx      # Canvas mini-map
    │   │   ├── properties-panel.tsx # Node/shape property editor
    │   │   └── output-gallery.tsx # Generated media gallery
    │   ├── dashboard/
    │   │   ├── sidebar.tsx       # Dashboard sidebar (folders list)
    │   │   ├── project-thumbnail.tsx # Project card component
    │   │   ├── project-pins.tsx  # Pinned projects section
    │   │   ├── dashboard-content.tsx # Main dashboard content
    │   │   ├── folder-content.tsx # Folder content grid
    │   │   ├── create-project-dialog.tsx
    │   │   ├── create-folder-dialog.tsx
    │   │   ├── dashboard-commands.tsx
    │   │   └── panels/
    │   │       ├── panel.tsx     # Collapsible panel wrapper
    │   │       ├── tools-panel.tsx # Tools, nodes, and templates panel
    │   │       ├── projects-panel.tsx
    │   │       ├── ai-panel.tsx  # AI Agent chatbar (floating)
    │   │       └── index.ts
    │   └── ui/
    │       ├── toast.tsx         # Toast notification component
    │       ├── resizable-handle.tsx # Draggable panel resize handle
    │       ├── context-menu.tsx  # Right-click context menu
    │       └── command-palette.tsx # Ctrl+K command palette
    │
    ├── lib/
    │   ├── ai/
    │   │   ├── openrouter.ts     # OpenAI client configured for OpenRouter
    │   │   └── agents.ts         # Agent system prompt, tool definitions, action parsing
    │   ├── canvas/
    │   │   ├── context.tsx       # Canvas state Context + Provider (elements, selection, tools)
    │   │   ├── use-history.ts    # Undo/redo history hook
    │   │   ├── clone.ts         # Element cloning utilities
    │   │   ├── geometry.ts      # Coordinate transforms (screen <-> world)
    │   │   ├── hit-test.ts      # Point-in-element hit testing
    │   │   ├── snap.ts          # Grid snapping and alignment guide computation
    │   │   ├── presets.ts       # Built-in + custom template management
    │   │   ├── generation-models.ts # AI model definitions (image + video)
    │   │   ├── run-workflow.ts  # Server action for AI generation via OpenRouter
    │   │   ├── workflow-engine.ts # Workflow prep, cycle detection, input collection
    │   │   └── use-keyboard-shortcuts.ts # Keyboard shortcut bindings
    │   ├── projects/
    │   │   ├── service.ts       # Server-side project/folder/agent CRUD (Supabase)
    │   │   └── client-service.ts # Client-side Supabase operations
    │   ├── supabase/
    │   │   ├── client.ts        # Browser Supabase client
    │   │   ├── server.ts        # Server Supabase client (with cookies)
    │   │   └── middleware.ts    # Supabase auth session update for middleware
    │   ├── command-palette/
    │   │   └── context.tsx      # Command palette state/registration context
    │   └── toast/
    │       └── context.tsx      # Toast notification state context
    │
    └── types/
        ├── index.ts            # Re-exports canvas types
        ├── canvas.ts           # CanvasElement, Connection, WorkflowState, Node types
        └── agent.ts            # AgentMessage, AgentAction, AgentResponse, Checkpoint types
```

---

## Current Limitations

- **Authentication and multi-user ownership are not fully implemented.** All data is accessible to anyone with access to the Supabase project.
- **Real-time collaboration** is not implemented.
- **Custom templates** are stored in browser localStorage, not in Supabase.
- **The AI agent** has a practical tool-call bridge, but a fuller agent runtime and richer tool set are still planned.
- **Supabase Storage policies** and RLS settings are development-friendly and should be tightened for production.
- **No testing infrastructure** is in place.
- The UI/UX is still evolving quickly.

---

## Roadmap

- Strengthen the agent into a broader app operator with more contextual tools
- Persist custom templates and agent chat/checkpoint history server-side
- Add richer workflow execution, model configuration, and output handling
- Improve production-grade lifecycle management for projects, folders, templates, chats, and assets
- Add authentication, authorization, and user-owned data
- Add real-time collaboration and presence
- Continue polishing canvas interactions, responsive layout, and design consistency
- Add test coverage (unit, integration, E2E)

---

## License

This project does not currently specify a license. All rights reserved by default.
