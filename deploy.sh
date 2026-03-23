#!/bin/bash
set -e

# ============================================================
# Deploy editing-assistant to a remote Linux host via Docker
# Syncs source to remote, builds images there, then runs.
# Usage:
#   ./deploy.sh <user@host>              # deploy both
#   ./deploy.sh <user@host> backend      # deploy backend only
#   ./deploy.sh <user@host> frontend     # deploy frontend only
# ============================================================

REMOTE="$1"
COMPONENT="${2:-all}"   # all | backend | frontend

if [ -z "$REMOTE" ]; then
    echo "Usage: $0 <user@host> [all|backend|frontend]"
    exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
REMOTE_DIR="/opt/editing-assistant"

sync_files() {
    echo "==> Syncing project files to remote..."
    ssh "$REMOTE" "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami) $REMOTE_DIR"
    rsync -az --delete \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '__pycache__' \
        --exclude 'dist' \
        --exclude 'backend/data' \
        "$ROOT/" "$REMOTE:$REMOTE_DIR/"
}

build_backend() {
    echo "==> Building backend image on remote..."
    ssh "$REMOTE" "cd $REMOTE_DIR && docker build -t editing-assistant-backend:latest ./backend"
}

build_frontend() {
    echo "==> Building frontend image on remote..."
    ssh "$REMOTE" "cd $REMOTE_DIR && docker build -t editing-assistant-frontend:latest ./frontend"
}

run_remote() {
    echo "==> Starting containers on remote host..."
    ssh "$REMOTE" "cd $REMOTE_DIR && docker compose down && docker compose up -d"
}

case "$COMPONENT" in
    backend)
        sync_files
        build_backend
        run_remote
        ;;
    frontend)
        sync_files
        build_frontend
        run_remote
        ;;
    all)
        sync_files
        build_backend
        build_frontend
        run_remote
        ;;
    *)
        echo "Unknown component: $COMPONENT (use all, backend, or frontend)"
        exit 1
        ;;
esac

echo ""
echo "==> Done! Access the app at http://$(echo $REMOTE | cut -d@ -f2):5177"
