# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build (TypeScript errors are ignored via next.config.mjs)
npm run lint      # ESLint
npm run start     # Start production server
```

No test runner is configured.

## Architecture

This is a full-stack **learning/study platform** built with Next.js (App Router), PostgreSQL (Neon serverless), and OpenAI. It supports courses, lessons, quizzes, projects, and an AI assistant.

### Stack

- **Framework**: Next.js 15 with App Router, React 19
- **Database**: PostgreSQL via Neon serverless (`@neondatabase/serverless` + `pg`)
- **Auth**: Custom session-based auth (bcrypt passwords, cookie-stored tokens)
- **Styling**: Tailwind CSS v4, Radix UI components
- **AI**: OpenAI API for assistant and chatbot features
- **Deployment**: Vercel

### Database (`lib/db.ts`)

Direct SQL via a tagged template literal helper — no ORM. A singleton `pg.Pool` is maintained in development. All queries go through the `sql` template tag which handles parameter binding and retries transient errors.

```ts
import { sql } from "@/lib/db";
const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
```

Schema is in `scripts/sql/`. Core tables: `users`, `courses`, `posts`, `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `user_quiz_progress`, `sessions`. Some assistant tables are created on-demand in API routes.

### Authentication (`lib/auth.ts`)

Session-based: 32-byte hex token stored in `sessions` table, sent as `httpOnly` cookie (`session_token`). Sessions expire after 7 days.

- Two roles: `USER` (default) and `ADMIN`
- Passwords use bcrypt (auto-upgrades legacy SHA-256 hashes on login)
- `getCurrentUser()` reads the cookie and joins `sessions → users`

### API Routes (`app/api/`)

All routes follow a consistent pattern:

```ts
export const runtime = "nodejs";
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// Admin check: if (user.user_role !== "ADMIN") ...
return NextResponse.json({ ok: true, data: ... });
```

Key route groups:
- `/api/auth/` — signup, login, logout, me
- `/api/posts/` — lessons/references (admin write, any read)
- `/api/quiz/` — quiz CRUD and submission
- `/api/projects/` — project-based learning content
- `/api/admin/` — admin analytics and AI assistant management
- `/api/assistant/` — AI assistant (ask endpoint)
- `/api/chatbot/` — chatbot chat, URL extraction, image analysis

### Content Types

`posts` table has a `type` field: `lesson`, `quiz`, or `reference`. Difficulty levels: `easy`, `medium`, `hard`, `project`. Rich text content is stored as HTML (edited via TipTap or Quill).

### AI Features (`lib/assistant-*.ts`, `lib/chatbot/`)

- AI assistant uses OpenAI with RAG: knowledge chunks + embeddings stored in DB
- Chatbot supports URL content extraction (Playwright), PDF/DOCX/XLSX parsing
- Admin UI at `/admin/assistant/` manages FAQs, knowledge base, review items, settings
- Usage limits tracked per user in `lib/assistant-limits.ts`

### UI Components

`components/ui/` contains Radix UI-based primitives (shadcn/ui pattern). Page-level components are colocated with their routes or in `components/`. The AI assistant floats as a persistent component rendered in `app/layout.tsx`.

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=          # Neon pooled connection string
DATABASE_URL_UNPOOLED= # Neon direct connection string
OPENAI_API_KEY=        # For assistant and chatbot
```

Optional tuning: `PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECT_TIMEOUT_MS`, `BCRYPT_COST`.
