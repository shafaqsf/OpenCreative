# OpenCreative

A creative hub built around an infinite canvas — think Excalidraw, but extensible with AI and real-time collaboration.

**Status:** Early development.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js](https://nextjs.org/) 15 (App Router) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Database & Auth | [Supabase](https://supabase.com/) |
| AI Inference | [OpenRouter](https://openrouter.ai/) |
| Agent Framework | [OpenAI Agents SDK](https://openai.com/) |

## Project Structure

```
src/
├── app/              # Next.js App Router pages & layouts
│   ├── globals.css   # Tailwind entry point
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/
│   ├── ai/
│   │   ├── agents.ts        # OpenAI Agent SDK (placeholder)
│   │   └── openrouter.ts    # OpenRouter client
│   └── supabase/
│       ├── client.ts        # Supabase browser client
│       ├── server.ts        # Supabase server client
│       └── middleware.ts    # Auth session middleware
├── middleware.ts     # Next.js middleware (auth)
└── types/
    └── index.ts      # Shared types
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Roadmap

- [x] Project scaffold & infrastructure
- [ ] Infinite canvas (Excalidraw-style)
- [ ] AI-powered creation tools
- [ ] Agentic workflows (OpenAI Agents SDK)
- [ ] Real-time collaboration (Supabase Realtime)
- [ ] Authentication & user accounts
