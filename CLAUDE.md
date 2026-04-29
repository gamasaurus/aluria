# Aluria — AI System Analyst

## Project Overview
- **Type**: Next.js 16 App Router webapp
- **Purpose**: Conversational AI that guides users through defining system requirements (BRD generation)
- **Stack**: Next.js, Supabase (Auth, Postgres), OpenAI/Gemini, Tailwind CSS v4

## Tech Stack
- Next.js 16.2.4 with App Router
- Supabase (SSR + Browser clients)
- OpenAI GPT-4o or Google Gemini 2.0 Flash
- Tailwind CSS v4
- TypeScript

## Database Schema
See `supabase/schema.sql` for tables:
- `projects` — user project sessions
- `messages` — chat history per project
- `knowledge_bases` — extracted KB per project (json_content)

## Key Files
- `/api/chat` — Main AI conversation endpoint
- `/api/brd` — BRD generation endpoint
- `/lib/ai/stage.ts` — Stage resolution (problem → actors → process → functional → complete)
- `/lib/ai/prompt.ts` — AI system/user prompts
- `/components/chat/ChatPageClient.tsx` — Main chat UI

## Commands
```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint check
```

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=          # or
GEMINI_API_KEY=
```

## AGENT Instructions
- Use the `bash` tool for terminal commands, not `cd`
- Use `Read` tool to read files, not `cat`
- Use `grep` and `glob` for search, not `find`
- Never commit secrets — ensure `.env` is in `.gitignore`
- Run `npm run lint` after making code changes