You are building **LLMeter** — an open-source LLM API proxy and cost-monitoring platform.
Build the full MVP as a monorepo. Use the stack below exactly.

────────────────────────────────────────
STACK
────────────────────────────────────────
Backend  : Python · FastAPI · SQLAlchemy (async) · SQLite (dev) / PostgreSQL (prod)
Frontend : Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui
Auth     : Simple JWT — single user (username + hashed password stored in DB). No roles, no RBAC.
Proxy    : httpx async streaming

────────────────────────────────────────
PROJECT STRUCTURE
────────────────────────────────────────
llmeter/
├── backend/
│   ├── main.py
│   ├── config.py              # env vars, settings
│   ├── database.py            # SQLAlchemy async engine + session
│   ├── models/
│   │   ├── provider.py        # Provider ORM model
│   │   └── request_log.py     # RequestLog ORM model
│   ├── routers/
│   │   ├── auth.py            # POST /auth/login → JWT
│   │   ├── providers.py       # CRUD /api/providers
│   │   ├── logs.py            # GET /api/logs (paginated, filterable)
│   │   ├── analytics.py       # GET /api/analytics/summary
│   │   └── proxy.py           # ALL /v1/* → upstream provider
│   └── services/
│       ├── load_balancer.py   # weighted random selection
│       └── cost_calculator.py # token × price per provider
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── login/page.tsx
    │   └── dashboard/
    │       ├── layout.tsx          # sidebar nav shell
    │       ├── page.tsx            # analytics overview
    │       ├── providers/page.tsx  # provider CRUD
    │       └── logs/page.tsx       # request log table
    ├── components/
    │   ├── ui/                     # shadcn primitives
    │   ├── providers/
    │   │   ├── ProviderForm.tsx
    │   │   └── LoadBalanceVisual.tsx   # weight visualiser
    │   ├── analytics/
    │   │   ├── SummaryCards.tsx
    │   │   ├── TokenUsageChart.tsx
    │   │   └── CostByProviderChart.tsx
    │   └── logs/
    │       └── RequestTable.tsx
    └── lib/
        ├── api.ts              # typed fetch wrappers
        └── auth.ts             # JWT storage + middleware

────────────────────────────────────────
DATABASE MODELS
────────────────────────────────────────

Provider:
  id, name, base_url, api_key (encrypted at rest),
  model_aliases (JSON),       # e.g. {"gpt-4o": "gpt-4o"}
  cost_input_per_1k,          # USD
  cost_cache_per_1k,          # USD (0 if not applicable)
  cost_output_per_1k,         # USD
  weight (int 1–100),         # for load balancing
  is_active (bool),
  created_at, updated_at

RequestLog:
  id, request_id (uuid), provider_id (FK),
  model_requested, model_used,
  status_code,
  prompt_tokens, cache_tokens, completion_tokens, total_tokens,
  cost_usd (computed on write),
  latency_ms,                 # total round-trip
  ttfb_ms,                    # time to first byte
  error_message,
  created_at

Settings (single row):
  admin_username, admin_password_hash, jwt_secret

────────────────────────────────────────
FEATURE 1 — PROXY ENGINE  /v1/*
────────────────────────────────────────
- Accept any OpenAI-format request (chat/completions, embeddings, etc.)
- Select provider using weighted random load balancing
- Forward request to provider.base_url + path, injecting provider.api_key
- Stream response back to caller using StreamingResponse
- After stream ends: parse usage block, compute cost, write RequestLog row
- On provider error: try next provider (fallback), log with error_message

────────────────────────────────────────
FEATURE 2 — PROVIDER CRUD  /api/providers
────────────────────────────────────────
GET    /api/providers          → list all providers
POST   /api/providers          → create
GET    /api/providers/{id}     → get one
PATCH  /api/providers/{id}     → update
DELETE /api/providers/{id}     → delete

────────────────────────────────────────
FEATURE 3 — ANALYTICS  /api/analytics
────────────────────────────────────────
GET /api/analytics/summary?from=&to=
Response:
{
  total_requests,
  total_cost_usd,
  avg_latency_ms,
  avg_ttfb_ms,
  total_tokens,
  error_rate,
  requests_by_provider: [{provider_name, count, cost}],
  requests_by_model:    [{model, count, cost}],
  cost_over_time:       [{date, cost}],      // daily buckets
  tokens_over_time:     [{date, tokens}]
}

────────────────────────────────────────
FEATURE 4 — REQUEST LOGS  /api/logs
────────────────────────────────────────
GET /api/logs?page=&limit=&provider=&model=&status=&from=&to=&sort=created_at:desc
Response: { items: [...], total, page, limit }

────────────────────────────────────────
FRONTEND — DASHBOARD DESIGN
────────────────────────────────────────
Use shadcn/ui throughout. Tailwind only. No other UI libraries.
Colour palette: zinc neutrals for shell, violet-600 as brand accent.

SIDEBAR NAVIGATION:
  • LLMeter logo (violet) + version badge
  • Nav items: Overview · Providers · Request Logs · Settings
  • Bottom: logout button

LOGIN PAGE:
  • Centred card, LLMeter wordmark, username + password fields, submit button
  • Minimal, clean — no marketing copy

OVERVIEW PAGE  (dashboard/page.tsx):
  Top row — 5 KPI cards (shadcn Card):
    • Total Requests (with delta vs previous period)
    • Total Cost (USD, formatted)
    • Avg Latency (ms)
    • Avg TTFB (ms)
    • Error Rate (%)

  Middle row:
    • Cost over time — area chart (recharts AreaChart, violet fill)
    • Tokens over time — bar chart (recharts BarChart, stacked: prompt/cache/completion)

  Bottom row:
    • Cost by provider — horizontal bar chart
    • Top models by request count — horizontal bar chart

  Date range picker (shadcn Popover + Calendar) in the page header.

PROVIDERS PAGE  (dashboard/providers/page.tsx):

  LEFT PANEL — Provider list (Cards):
    Each card shows: name, base_url (truncated), active/inactive badge,
    total cost this month, request count.
    "+ Add Provider" button top-right opens the form panel.

  RIGHT PANEL — Provider form (slide-in Sheet or side panel):
    Fields: Name, Base URL, API Key (password input with show/hide toggle),
    Model aliases (key-value tag editor), Cost inputs (3 fields in a row:
    Input $/1k · Cache $/1k · Output $/1k), Weight slider, Active toggle.

  LOAD BALANCE VISUALISER (below the provider list, full width):
    Design approach: A horizontal segmented bar — each provider occupies a
    proportional segment coloured distinctly (violet, teal, amber, rose, etc.).
    Segment width = provider.weight / sum(all weights).
    Each segment shows: provider name + weight% centred inside it.
    Hovering a segment highlights it and shows a tooltip with full stats.
    Inactive providers are shown as a greyed-out pattern/hatch.
    Below the bar: a small legend row with coloured dots + provider names.
    Animate segment widths with CSS transition (300ms ease) when weights change.
    Label: "Load distribution" with a refresh-on-save behaviour.

REQUEST LOGS PAGE  (dashboard/logs/page.tsx):
  Full-width data table (shadcn Table):
  Columns:
    Timestamp | Provider | Model | Status | Total tokens |
    Prompt T | Cache T | Completion T | Cost (USD) | Latency | TTFB | Actions

  Row colour coding:
    • 2xx rows — default
    • 4xx rows — amber left border
    • 5xx rows — red left border

  Filter bar above table:
    Provider dropdown · Model input · Status select · Date range picker

  "Actions" cell: eye icon → opens a shadcn Dialog showing full request/response
  JSON, token breakdown, timing waterfall.

  Pagination: shadcn Pagination component.

────────────────────────────────────────
AUTH FLOW
────────────────────────────────────────
- POST /auth/login { username, password } → { access_token, token_type: "bearer" }
- All /api/* and /v1/* routes require Bearer token (except /auth/login and /health)
- Frontend stores JWT in httpOnly cookie via Next.js route handler
- Middleware redirects unauthenticated requests to /login

────────────────────────────────────────
SETUP & RUNNING
────────────────────────────────────────
backend/.env.example:
  DATABASE_URL=sqlite+aiosqlite:///./llmeter.db
  JWT_SECRET=change-me
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=changeme

Provide:
  • backend/requirements.txt
  • frontend/package.json with all deps
  • docker-compose.yml (backend + frontend services)
  • README.md with quickstart instructions
  • A database seed script that creates the admin user

────────────────────────────────────────
QUALITY REQUIREMENTS
────────────────────────────────────────
- All backend routes return typed Pydantic response models
- Frontend API calls use a typed fetch wrapper (lib/api.ts)
- All cost calculations happen server-side only
- API key values must never appear in analytics or log responses (masked: sk-...xxxx)
- Handle streaming errors gracefully — partial logs still get written
- Loading skeletons on all data-fetching components (shadcn Skeleton)
- Empty states with helpful copy on all list/table pages
- Responsive layout — sidebar collapses to bottom nav on mobile

Build the complete project. Start with the backend models and proxy engine, then the API routes, then the frontend shell and pages in order.
