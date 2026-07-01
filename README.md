# OpenCreative

OpenCreative is a canvas-first AI workflow builder for creative projects. It combines a dashboard for organizing projects and folders, an infinite canvas for visual workflow design, reusable templates, and a floating agent chatbar that can inspect the current workspace and execute supported canvas actions.

**Status:** Active early product development. The core dashboard, project canvas, workflow nodes, templates, persistence, and action-capable agent foundation are implemented, but the app is not production hardened yet.

## What It Does

- Organize creative work into folders and projects.
- Build workflows on an infinite canvas with annotation tools and executable AI nodes.
- Use workflow nodes such as `prompt`, `source`, `generate`, and `output`.
- Save and reuse built-in or custom templates.
- Resize, move, duplicate, rename, delete, align, distribute, copy, paste, undo, and redo canvas items.
- Persist project workflow state, camera position, connections, and canvas UI settings.
- Use a floating OpenCreative Agent chatbar to create nodes, run workflows, select tools, manage selections, and create or restore checkpoints through tool/function calling.
- Upload assets to Supabase Storage and reference generated outputs in the canvas.

## Current Product Areas

### Dashboard

The dashboard is the home for project and folder management. It supports creating projects and folders, browsing folder contents, moving projects between folders, pinning/archive-style project organization where appropriate, renaming, duplicating, and deleting.

Relevant files:

- `src/app/page.tsx`
- `src/app/folder/[id]/page.tsx`
- `src/components/dashboard/*`
- `src/lib/projects/service.ts`

### Project Canvas

Each project opens into a full-screen canvas editor. The canvas has drawing and annotation tools, workflow nodes, a layer panel, properties editing, mini-map, zoom controls, alignment controls, output gallery, and autosave.

Relevant files:

- `src/app/project/[id]/project-canvas.tsx`
- `src/components/canvas/*`
- `src/lib/canvas/*`
- `src/types/canvas.ts`

### Templates

Templates can be inserted from the tools panel by clicking or dragging onto the canvas. Built-in templates currently include:

- Text to image
- Image to video
- Multi-variation

Custom templates are created from the current canvas selection and persisted in browser local storage.

Relevant files:

- `src/lib/canvas/presets.ts`
- `src/components/dashboard/panels/tools-panel.tsx`

### OpenCreative Agent

The agent is exposed as a floating chatbar over the project canvas. It sends the current app state to `/api/assistant`, receives tool/function-call style actions, and applies those actions directly to the canvas.

Supported agent actions include:

- Create workflow nodes and connections
- Run the workflow
- Select canvas tools
- Delete, duplicate, and rename the current selection
- Create checkpoints
- Restore checkpoints

The current implementation uses the `openai` JavaScript SDK against OpenRouter's OpenAI-compatible API endpoint. It is designed around agentic tool calls, but it is not yet a full standalone OpenAI Agents SDK runtime.

Relevant files:

- `src/components/dashboard/panels/ai-panel.tsx`
- `src/app/api/assistant/route.ts`
- `src/lib/ai/agents.ts`
- `src/lib/ai/openrouter.ts`
- `src/types/agent.ts`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS v4, lucide-react |
| Persistence | Supabase Postgres and Storage |
| AI API | OpenRouter via the OpenAI-compatible SDK |
| Canvas State | Local React context with undo/redo history |
| Templates | Built-ins in code, custom templates in local storage |

## Project Structure

```text
src/
  app/
    api/
      assistant/       Agent API route
      upload/          Asset upload API route
    folder/[id]/       Folder detail route
    project/[id]/      Project canvas route
    page.tsx           Dashboard route
  components/
    canvas/            Canvas, shapes, overlays, panels, controls
    dashboard/         Dashboard, folders, projects, left panels
    ui/                Shared UI primitives
  lib/
    ai/                OpenRouter client and agent action mapping
    canvas/            Canvas context, geometry, history, templates, runner
    command-palette/   Command registration and palette state
    projects/          Supabase-backed project/folder actions
    supabase/          Supabase clients and middleware
    toast/             Toast state
  types/
    agent.ts           Agent messages, actions, checkpoints
    canvas.ts          Canvas elements, nodes, workflow state

supabase/
  migrations/          Database and storage migrations
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `OPENROUTER_API_KEY` | OpenRouter API key for agent and generation requests |
| `NEXT_PUBLIC_SITE_URL` | Optional site URL used in OpenRouter request headers |

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Setup

Apply the migrations in `supabase/migrations` to create:

- `folders`
- `projects`
- the public `assets` storage bucket
- workflow JSON defaults for elements, connections, camera, and UI settings

The current demo storage policies are intentionally permissive for development. Review them before using this with real user data.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production app |
| `npm run start` | Start the production server |
| `npm run lint` | Run Next.js linting |

## Current Limitations

- Authentication and multi-user ownership are not fully implemented.
- Real-time collaboration is not implemented.
- Custom templates are stored in local storage, not Supabase.
- The agent has a practical tool-call bridge, but a fuller agent runtime and richer tool set are still planned.
- Supabase Storage policies are development-friendly and should be tightened for production.
- The UI/UX is still evolving quickly.

## Roadmap

- Strengthen the agent into a broader app operator with more contextual tools.
- Persist custom templates and agent chat/checkpoint history server-side.
- Add richer workflow execution, model configuration, and output handling.
- Improve production-grade lifecycle management for projects, folders, templates, chats, and assets.
- Add authentication, authorization, and user-owned data.
- Add real-time collaboration and presence.
- Continue polishing canvas interactions, responsive layout, and design consistency.
