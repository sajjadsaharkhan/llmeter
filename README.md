# LLMeter

A self-hosted proxy and observability layer for LLM APIs (OpenAI-compatible).  
Route requests through LLMeter to get unified cost tracking, latency monitoring, and request logs across every provider.

## Features

- **Transparent proxy** — drop-in replacement for any OpenAI-compatible endpoint (`base_url`)
- **Multi-provider** — configure multiple providers with weights for load balancing and fallback
- **Cost tracking** — per-request cost calculated from your pricing table; display in USD or Iranian Toman
- **Request logs** — full request/response history with filtering, search, and paginated export
- **Analytics dashboard** — KPI cards, cost-over-time charts, token usage, top models
- **API tokens** — issue scoped Bearer tokens for proxy authentication
- **Log retention** — configurable auto-deletion policy

## Quick Start (development)

```bash
git clone https://github.com/sajjadsaharkhan/llmeter.git
cd llmeter
cp .env.example .env   # edit secrets before starting

docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000  
- Default login: `admin` / `changeme`

## Production Deployment

### 1. Prepare secrets

```bash
cp .env.example .env
```

Edit `.env` and set real values for all three required fields:

| Variable | How to generate |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | any strong password |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` |

### 2. Set your public URLs

```env
# URL the browser uses to reach the backend
BACKEND_URL=http://your-server-ip:8000

# Allowed CORS origins (where the frontend is served from)
CORS_ORIGINS=http://your-server-ip:3000
```

### 3. Pull and start

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Images are pulled from `ghcr.io/sajjadsaharkhan/llmeter`. Persistent data is stored in `./data/` (bind mount). Back this directory up to preserve logs and settings.

### Putting a reverse proxy in front

For TLS and a clean domain, point nginx or Caddy at port `8000` (API) and `3000` (frontend). Update `BACKEND_URL` and `CORS_ORIGINS` to your public HTTPS URLs and rebuild.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | random | Secret used to sign auth tokens |
| `ADMIN_USERNAME` | `admin` | Dashboard login username |
| `ADMIN_PASSWORD` | `changeme` | Dashboard login password |
| `ENCRYPTION_KEY` | random | Key used to encrypt stored provider API keys |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed frontend origins |
| `BACKEND_URL` | `http://localhost:8000` | Public URL of the backend (used at frontend build time) |

## How to Use

### 1. Add a provider

Open the dashboard → **Settings → Providers** and click **Add Provider**. Fill in:

- **Name** — a label for this provider (e.g. `OpenAI`, `Azure`)
- **Base URL** — the OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1`)
- **API Key** — your upstream provider key (stored encrypted)
- **Weight** — relative traffic weight when multiple providers are configured

### 2. Create an API token

Go to **Settings → API Tokens** and click **Generate Token**. Copy the token — it is only shown once.  
Tokens gate access to the proxy endpoint. Each token can carry a label for identification.

### 3. Point your SDK at LLMeter

Replace the `base_url` in your SDK or HTTP client with the LLMeter backend URL and pass your LLMeter token as the API key:

```python
# Python — openai SDK
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",   # or your server URL
    api_key="<your-llmeter-token>",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

```typescript
// TypeScript — openai SDK
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "<your-llmeter-token>",
});
```

All OpenAI-compatible clients (LangChain, LiteLLM, etc.) work the same way — just set `base_url` / `baseURL` and `api_key`.

### 4. View logs and analytics

- **Dashboard** — cost, token usage, and latency KPIs with a cost-over-time chart. Use the date-range picker to scope the window.
- **Logs** — full request/response history with per-request cost, latency, model, and provider. Use the search bar and filters to drill down; the summary bar at the top reflects the current filter.

### 5. Configure pricing

Go to **Settings → Models** to set per-token input/output prices for each model. Costs are calculated from these values. If a model is missing, add it and set its price — requests will be costed retroactively on the next page load.

### 6. Set display currency

Go to **Settings → General** to switch between **USD** and **IRT** (Iranian Toman). All cost figures across the dashboard and logs update immediately.

## Architecture

```
Client SDK
    │  (OpenAI-compatible HTTP)
    ▼
LLMeter Backend  ──── SQLite (./data/llmeter.db)
    │
    ├── Load balancer (weight-based, retry on 429/5xx)
    │
    └── Upstream LLM Providers (OpenAI, Anthropic, etc.)
```

- **Backend**: FastAPI + SQLAlchemy async + aiosqlite  
- **Frontend**: Next.js 14 (App Router, standalone output)  
- **Database**: SQLite — sufficient for single-server deployments; all queries use DB-level aggregation
