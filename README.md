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
git clone <repo>
cd LLMeter
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

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Persistent data is stored in `./data/` (bind mount). Back this directory up to preserve logs and settings.

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
