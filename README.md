# NOVA — Intelligent Executive AI Assistant

NOVA is a proactive, intelligent personal executive assistant and productivity workstation. It combines real-time bidirectional voice conversations, ultra-fast streaming typed chat, personal knowledge notes, task scheduling, multi-project workspaces, and selective long-term conversational memory with robust cloud persistence.

---

## 🌟 Key Capabilities

1. **Real-Time Gemini Live Voice Experience**
   - Bidirectional Speech-to-Speech (STS) and Speech-to-Text (STT) powered by Google Gemini Live (`gemini-3.8-live`).
   - Interactive, animated multi-layer Siri voice orb reacting to real-time audio amplitudes.
   - Built-in natural language action execution for creating tasks, saving personal notes, and organizing workspaces without requiring external apps.

2. **Ultra-Fast Typed Chat**
   - High-throughput streaming text generation powered by Groq Llama 3.3 70B (`openai/gpt-oss-120b`).
   - Server-Sent Events (SSE) streaming with low time-to-first-token.
   - Interactive presentation, document, code, and diagram capabilities.

3. **Autonomous Action Engine**
   - Context-aware natural language parsing: creates tasks, schedules reminders, adds personal notes, and manages workspaces directly from conversation.
   - Deterministic entity extraction with safeguards against duplicate creation or false success reporting.

4. **Dedicated Long-Term Memory (Hindsight Cloud)**
   - Selective retention filter that automatically preserves user preferences and non-sensitive facts while permanently rejecting credentials, passwords, and sensitive keys.
   - Fast semantic recall and reflection synthesis to ground future conversations in previous user context.
   - Strict user memory-bank isolation guaranteeing zero cross-user memory leakage.

5. **Cloud Persistence with Supabase & Offline Local Fallback**
   - PostgreSQL storage with strict Row Level Security (RLS) on all user data.
   - Seamless offline-first local storage cache ensuring uninterrupted productivity even when disconnected.

---

## 🔒 Security Architecture

NOVA is engineered from the ground up for strict credential isolation:

- **Server-Side Secret Isolation:** Secret API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `HINDSIGHT_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are kept strictly on the backend. They are **never** prefixed with `VITE_` and are never bundled into the client build.
- **Single-Use Ephemeral Tokens:** The frontend connects to Gemini Live via short-lived, single-use ephemeral tokens provisioned on-demand by the backend (`/api/live-token`), ensuring your master Google Gemini key is never exposed to visitors or browsers.
- **Client-Safe Public Variables:** Only public client variables (like `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`) are exposed to the browser, and all database tables enforce user-scoped Row Level Security (`auth.uid() = user_id`).
- **Secret Retention Gate:** Hindsight memory retention evaluates every fact against an explicit regex policy that strips and rejects API keys, private keys, authorization tokens, and credit card numbers before storage.

---

## 🚀 Quick Start & Local Setup

### Prerequisites

- **Node.js:** v20.0.0 or later (v22+ recommended)
- **npm:** v10.0.0 or later
- API Keys:
  - [Google AI Studio](https://aistudio.google.com/) (for Gemini Live Voice)
  - [Groq Console](https://console.groq.com/keys) (for ultra-fast text chat)
  - [Supabase](https://supabase.com/) project (for PostgreSQL cloud persistence)
  - [Hindsight](https://hindsight.vectorize.io/) API Key (optional, for cloud long-term memory)

### 1. Installation

```bash
git clone https://github.com/your-username/nova.git
cd nova
npm install
```

### 2. Environment Configuration

Copy the example environment configuration template:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure your credentials:

```bash
# Server-Side Only Secrets (Never prefix with VITE_)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_CHAT_MODEL=openai/gpt-oss-120b
PORT=3001

# Supabase Client Configuration (Public variables protected by RLS)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
# Or modern publishable key:
# VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here

# Hindsight Cloud (Optional - Long-Term Memory)
HINDSIGHT_API_KEY=your_hindsight_api_key_here
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
```

### 3. Database Migration (Supabase)

If using Supabase for cloud persistence:

1. Open your project on [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor**.
3. Open [`supabase/migrations/20261024000000_nova_schema.sql`](file:///Users/charantej/nova/supabase/migrations/20261024000000_nova_schema.sql).
4. Run the SQL script to create the 7 canonical tables (`workspaces`, `tasks`, `knowledge`, `memories`, `chat_sessions`, `chat_messages`, `user_preferences`) and enable user-scoped RLS policies.

### 4. Running Locally

You can run the development server in one command:

```bash
npm run dev
```

The Vite dev server includes embedded server middleware for `/api/health`, `/api/live-token`, `/api/chat`, and `/api/memory/*`. Navigate to `http://localhost:5173` to start using NOVA.

Alternatively, to run the standalone Node.js production API server independently:

```bash
npm run server
```

---

## 🛠 Available Scripts

All scripts defined in [`package.json`](file:///Users/charantej/nova/package.json):

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Starts the Vite development server with HMR and embedded API endpoints. |
| `npm run server` | `node --experimental-strip-types server/index.ts` | Runs the standalone Node.js API server on port 3001. |
| `npm run build` | `tsc -b && vite build` | Type-checks the project with TypeScript and compiles production assets into `dist/`. |
| `npm run lint` | `eslint .` | Runs ESLint across `src/`, `server/`, and `tests/`. |
| `npm test` | `node --experimental-strip-types --test tests/**/*.test.ts` | Runs the complete native Node.js test suite across all 83 test suites. |
| `npm run preview` | `vite preview` | Serves the built production bundle locally for inspection. |

---

## 🧪 Testing & Verification

NOVA includes comprehensive unit and integration test coverage across all features:

```bash
# Run the complete test suite
npm test

# Run isolated Hindsight integration tests
node --experimental-strip-types --test tests/hindsightIntegration.test.ts

# Run voice action execution tests
node --experimental-strip-types --test tests/voiceActionExecution.test.ts

# Run full project lint check
npm run lint

# Run TypeScript type check
npx tsc -b
```

---

## 📦 Production Deployment

### Frontend (Static Site / CDN)

The frontend can be built and deployed to any static host (Vercel, Netlify, Cloudflare Pages, AWS S3/CloudFront):

```bash
npm run build
```

Deploy the resulting `dist/` directory. Configure rewrite rules to route all paths to `index.html` (SPA routing). Set the client environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your hosting provider's dashboard.

### Backend (Node.js Service)

The standalone backend (`server/index.ts`) can be deployed to Google Cloud Run, Railway, Render, or a Docker container:

```bash
node --experimental-strip-types server/index.ts
```

Configure persistent server environment variables:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `PORT` (or defaults to 3001)
- `HINDSIGHT_API_KEY` (if using Hindsight memory)
- `HINDSIGHT_BASE_URL`

Ensure CORS and reverse-proxy headers allow your deployed frontend domain.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
