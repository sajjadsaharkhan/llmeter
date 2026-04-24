#!/usr/bin/env bash
set -euo pipefail

# ── Usage ─────────────────────────────────────────────────────────────────────
# ./start.sh          — start in development mode (build locally)
# ./start.sh prod     — start in production mode  (pull from GHCR)
# ./start.sh down     — stop all services

MODE="${1:-dev}"

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { echo -e "${GREEN}[llmeter]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[llmeter]${RESET} $*"; }
error() { echo -e "${RED}[llmeter]${RESET} $*" >&2; exit 1; }

# ── Dependency check ──────────────────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || error "docker is not installed."
docker compose version >/dev/null 2>&1 || error "docker compose plugin is not installed."

# ── Load existing .env ────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
  # Export existing values without overriding vars already set in the shell
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

# ── Defaults ──────────────────────────────────────────────────────────────────
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://localhost:3001}"

# Auto-generate secrets if missing or still set to placeholder values
_is_placeholder() {
  [[ -z "${1:-}" || "$1" == change-me* ]]
}

if _is_placeholder "${JWT_SECRET:-}"; then
  JWT_SECRET=$(openssl rand -hex 32)
  info "Generated JWT_SECRET"
fi

if _is_placeholder "${ENCRYPTION_KEY:-}"; then
  ENCRYPTION_KEY=$(openssl rand -base64 32)
  info "Generated ENCRYPTION_KEY"
fi

# ── Write .env ────────────────────────────────────────────────────────────────
cat > "$ENV_FILE" <<EOF
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
BACKEND_URL=${BACKEND_URL}
CORS_ORIGINS=${CORS_ORIGINS}
EOF

info ".env written"

# ── Warn about insecure defaults in production ────────────────────────────────
if [ "$MODE" = "prod" ] && [ "$ADMIN_PASSWORD" = "changeme" ]; then
  warn "ADMIN_PASSWORD is still 'changeme' — set a strong password in .env before exposing this instance."
fi

# ── Run ───────────────────────────────────────────────────────────────────────
case "$MODE" in
  dev)
    info "Starting in ${BOLD}development${RESET} mode..."
    docker compose up --build -d
    ;;
  prod)
    info "Starting in ${BOLD}production${RESET} mode..."
    docker compose -f docker-compose.prod.yml pull
    docker compose -f docker-compose.prod.yml up -d
    ;;
  down)
    info "Stopping all services..."
    docker compose down 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    ;;
  *)
    error "Unknown mode '${MODE}'. Usage: ./start.sh [dev|prod|down]"
    ;;
esac

if [ "$MODE" != "down" ]; then
  echo ""
  info "Services are up:"
  echo -e "  Frontend  → ${BOLD}http://localhost:3000${RESET}"
  echo -e "  Backend   → ${BOLD}http://localhost:8000${RESET}"
  echo -e "  Login     → ${BOLD}${ADMIN_USERNAME}${RESET} / ${BOLD}${ADMIN_PASSWORD}${RESET}"
fi
