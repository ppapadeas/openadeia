#!/usr/bin/env bash
# OpenAdeia — Deploy script
# Usage: ./scripts/deploy.sh user@server
#   or:  make deploy SERVER=user@server
set -euo pipefail

SERVER="${1:-}"
DEPLOY_DIR="/opt/openadeia"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"

if [[ -z "$SERVER" ]]; then
  echo "Usage: ./scripts/deploy.sh user@server"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenAdeia — Deploy → $SERVER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Upload compose files ─────────────────────────────────────────────
echo "→ Uploading docker-compose files..."
scp docker-compose.yml "$SERVER:$DEPLOY_DIR/docker-compose.yml"

# ── Remote deploy steps ──────────────────────────────────────────────
ssh "$SERVER" << EOF
  set -euo pipefail
  cd $DEPLOY_DIR

  echo "→ Pulling latest images..."
  docker compose pull api frontend

  echo "→ Restarting API..."
  docker compose up -d --no-deps --remove-orphans api
  sleep 8

  echo "→ Running migrations..."
  docker compose exec -T api npm run migrate

  echo "→ Restarting Frontend..."
  docker compose up -d --no-deps --remove-orphans frontend

  echo "→ Verifying health..."
  sleep 5
  STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health || echo "000")
  if [[ "\$STATUS" == "200" ]]; then
    echo "✅ API health check passed"
  else
    echo "⚠ API health check returned HTTP \$STATUS"
    docker compose logs --tail=30 api
    exit 1
  fi

  echo "→ Cleaning up old images..."
  docker image prune -f

  echo ""
  echo "✅ Deploy complete!"
  docker compose ps
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done!"
