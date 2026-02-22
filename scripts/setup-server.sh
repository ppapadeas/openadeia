#!/usr/bin/env bash
# OpenAdeia — First-time server setup
# Run: make setup-server SERVER=user@your-server.com
# Or:  ssh user@server 'bash -s' < scripts/setup-server.sh
set -euo pipefail

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenAdeia — Server Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── System packages ──────────────────────────────────────────────────
echo "→ Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl wget git unzip \
  ca-certificates gnupg lsb-release \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban

# ── Docker ───────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "✓ Docker installed"
else
  echo "✓ Docker already installed: $(docker --version)"
fi

# Docker Compose v2
if ! docker compose version &>/dev/null; then
  echo "→ Installing Docker Compose plugin..."
  sudo apt-get install -y -qq docker-compose-plugin
fi

# ── App directory ────────────────────────────────────────────────────
echo "→ Creating /opt/openadeia..."
sudo mkdir -p /opt/openadeia/backups
sudo chown -R "$USER:$USER" /opt/openadeia

# ── Firewall ─────────────────────────────────────────────────────────
echo "→ Configuring firewall..."
sudo ufw --force enable
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# Internal ports (not public)
sudo ufw deny 4000/tcp    # API (via nginx proxy)
sudo ufw deny 5432/tcp    # PostgreSQL
sudo ufw deny 6379/tcp    # Redis
sudo ufw deny 9000/tcp    # MinIO

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env to /opt/openadeia/.env"
echo "  2. Copy docker-compose.yml to /opt/openadeia/"
echo "  3. Run: cd /opt/openadeia && docker compose pull && docker compose up -d"
echo "  4. Run migrations: docker compose exec api npm run migrate"
echo "  5. Set up nginx reverse proxy: scripts/nginx-site.conf"
echo "  6. SSL: sudo certbot --nginx -d yourdomain.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
