#!/usr/bin/env bash
# deploy.sh — pull latest images from GHCR and restart the production stack
#
# Usage:
#   ./deploy.sh                  # deploy latest (main) tag
#   ./deploy.sh abc1234          # deploy a specific git SHA tag
#   ./deploy.sh --no-pull        # restart with already-downloaded images
#   ./deploy.sh abc1234 --no-pull
#   IMAGE_TAG=abc1234 ./deploy.sh
#
# First-time setup on the server:
#   1. Copy .env.example to .env and fill in JWT_SECRET and ENCRYPTION_KEY
#   2. docker login ghcr.io -u <github-user> -p <PAT>
#   3. ./deploy.sh

set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
REGISTRY="ghcr.io/sajjadsaharkhan/llmeter"

# ── Parse arguments ───────────────────────────────────────────────────────────
NO_PULL=false
for arg in "$@"; do
  case "$arg" in
    --no-pull) NO_PULL=true ;;
    --*)       echo "Unknown flag: $arg"; exit 1 ;;
    *)         IMAGE_TAG="$arg" ;;
  esac
done
IMAGE_TAG="${IMAGE_TAG:-main}"
export IMAGE_TAG

echo ""
echo "▶ Deploying LLMeter — tag: ${IMAGE_TAG}${NO_PULL:+ (no-pull)}"
echo ""

# ── Require .env ──────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "✗ .env file not found."
  echo "  Copy .env.example to .env and fill in the required secrets, then re-run."
  exit 1
fi

# ── Pull new images ───────────────────────────────────────────────────────────
if [ "$NO_PULL" = false ]; then
  echo "▶ Pulling images from GHCR..."
  docker pull "${REGISTRY}/backend:${IMAGE_TAG}"
  docker pull "${REGISTRY}/frontend:${IMAGE_TAG}"
else
  echo "▶ Skipping image pull (--no-pull)"
fi

# ── Stop old app containers ───────────────────────────────────────────────────
echo "▶ Stopping old containers..."
$COMPOSE stop backend frontend nginx 2>/dev/null || true

# ── Ensure data directory exists for SQLite ───────────────────────────────────
mkdir -p data

# ── Auto-generate ADMIN_PASSWORD on first deploy if still placeholder ─────────
if grep -qE "^ADMIN_PASSWORD=(change-me|changeme|)$" .env 2>/dev/null; then
  GENERATED_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
  # Replace the placeholder line in-place (works on both GNU and BSD sed)
  sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${GENERATED_PASS}|" .env && rm -f .env.bak
  echo "▶ Generated admin password and saved to .env"
  echo "  ┌──────────────────────────────────────────┐"
  echo "  │  Admin username : admin                  │"
  printf "  │  Admin password : %-22s│\n" "${GENERATED_PASS}"
  echo "  └──────────────────────────────────────────┘"
  echo "  (This password will NOT be shown again — save it now)"
  echo ""
fi

# ── Start / restart all services ─────────────────────────────────────────────
echo "▶ Starting services..."
$COMPOSE up -d --no-build --remove-orphans

# ── Wait for services to become healthy (via nginx) ───────────────────────────
echo "▶ Waiting for services to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "▶ Services are healthy ✓"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ Services did not become healthy in 30 seconds"
    $COMPOSE logs --tail=20 backend
    $COMPOSE logs --tail=10 nginx
    exit 1
  fi
  sleep 1
done

# ── Remove dangling images ────────────────────────────────────────────────────
echo "▶ Pruning unused images..."
docker image prune -f

echo ""
echo "✓ Deployment complete — tag: ${IMAGE_TAG}"
echo "  Admin UI:  http://localhost:3000"
echo "  LLM Proxy: http://localhost:3000/proxy/v1"
echo ""
