#!/usr/bin/env bash
set -euo pipefail

# One-shot installer for a fresh Ubuntu/Debian VPS.
# Installs: Docker, Docker Compose plugin, Node.js 20, PM2.
# Run as a user with sudo. Re-runnable: skips steps already done.

log() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

log "Updating apt index"
$SUDO apt-get update -y

log "Installing base packages"
$SUDO apt-get install -y curl ca-certificates gnupg lsb-release ufw git build-essential

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "$USER" || true
else
  log "Docker already installed: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Compose plugin"
  $SUDO apt-get install -y docker-compose-plugin
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]]; then
  log "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y nodejs
else
  log "Node already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing PM2"
  $SUDO npm install -g pm2
else
  log "PM2 already installed: $(pm2 -v)"
fi

log "Done. You may need to log out and back in for the docker group to take effect."
