# GitHub Actions — Required Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

## Required for CI (auto-provided)

| Secret | Value |
|--------|-------|
| `GITHUB_TOKEN` | Auto-provided by GitHub — used for ghcr.io push |

## Required for Deploy (add manually)

| Secret | Example | Description |
|--------|---------|-------------|
| `SSH_HOST` | `123.45.67.89` | Production server IP or hostname |
| `SSH_USER` | `deploy` | SSH username on server |
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Private key (generate with `ssh-keygen -t ed25519`) |
| `SSH_PORT` | `22` | SSH port (optional, default 22) |

## Optional — Alerts

| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK` | Slack webhook URL for deploy notifications |

## How to generate SSH deploy key

```bash
# On your local machine:
ssh-keygen -t ed25519 -C "openadeia-deploy" -f ~/.ssh/openadeia_deploy -N ""

# Copy public key to server:
ssh-copy-id -i ~/.ssh/openadeia_deploy.pub user@your-server.com

# Add private key to GitHub Secrets as SSH_PRIVATE_KEY:
cat ~/.ssh/openadeia_deploy
```

## Environment: production

The deploy job uses `environment: production` — create it in:
**Settings → Environments → New environment → "production"**

You can add required reviewers for extra safety.
