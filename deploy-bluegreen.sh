#!/bin/bash
set -euo pipefail

# ============================================================
# Zero-downtime-ish backend deploy for editing-assistant.
#
# Usage:
#   ./deploy-bluegreen.sh <user@host> all
#   ./deploy-bluegreen.sh <user@host> backend
#   ./deploy-bluegreen.sh <user@host> frontend
#
# The frontend container listens on 5177. Nginx inside that
# container proxies /api to either backend-blue or backend-green.
# Backend deployment starts the idle slot, checks /healthz, switches
# Nginx upstream, then stops the old slot after a short drain window.
# ============================================================

DEFAULT_REMOTE="root@8.222.87.126"
REMOTE="${1:-$DEFAULT_REMOTE}"
COMPONENT="${2:-all}"   # all | backend | frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"
REMOTE_DIR="/opt/editing-assistant"
COMPOSE="docker compose -f docker-compose.bluegreen.yml"
DRAIN_SECONDS="${DRAIN_SECONDS:-20}"

remote_host() {
    echo "$REMOTE" | cut -d@ -f2
}

check_ssh_access() {
    echo "==> Checking SSH access to $REMOTE..."
    if ssh -o BatchMode=yes -o ConnectTimeout=10 "$REMOTE" "echo ok" >/dev/null 2>&1; then
        return 0
    fi

    cat >&2 <<EOF
Cannot log in to $REMOTE with SSH public key authentication.

This deploy script needs passwordless SSH access because it runs rsync,
docker build, docker compose, and nginx reload commands on the server.

Fix one of these, then rerun this script:

1. Use the correct SSH user:
   ./deploy-bluegreen.sh <user>@$(remote_host) $COMPONENT

2. Add this Mac's public key to the server user's authorized_keys.
   If you have password login enabled:
   ssh-copy-id $REMOTE

   If password login is disabled, use the cloud console/VNC and append
   your local ~/.ssh/*.pub key to:
   /root/.ssh/authorized_keys

3. Test before deploying:
   ssh $REMOTE 'echo ok'
EOF
    exit 1
}

sync_files() {
    echo "==> Syncing project files to remote..."
    ssh "$REMOTE" "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami) $REMOTE_DIR"
    rsync -az --delete \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '__pycache__' \
        --exclude 'dist' \
        --exclude 'backend/data' \
        --exclude 'deploy/runtime/active_backend_slot' \
        --exclude 'deploy/runtime/nginx-backend-upstream.conf' \
        "$ROOT/" "$REMOTE:$REMOTE_DIR/"
    ssh "$REMOTE" "mkdir -p $REMOTE_DIR/deploy/runtime"
}

remote_run() {
    ssh "$REMOTE" "cd $REMOTE_DIR && $*"
}

active_slot() {
    ssh "$REMOTE" "cd $REMOTE_DIR && cat deploy/runtime/active_backend_slot 2>/dev/null || echo blue"
}

opposite_slot() {
    if [ "$1" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

build_backend() {
    local slot="$1"
    echo "==> Building backend image for $slot..."
    remote_run "docker build -t editing-assistant-backend:$slot ./backend"
}

build_frontend() {
    echo "==> Building frontend image..."
    remote_run "docker build -t editing-assistant-frontend:latest ./frontend"
}

write_upstream() {
    local slot="$1"
    echo "==> Pointing Nginx upstream to backend-$slot..."
    ssh "$REMOTE" "cd $REMOTE_DIR && printf '%s\n' 'upstream active_backend {' '    server backend-$slot:8004;' '    keepalive 32;' '}' > deploy/runtime/nginx-backend-upstream.conf"
}

wait_for_backend() {
    local slot="$1"
    local health_check
    health_check="import json, urllib.request; body = json.load(urllib.request.urlopen('http://127.0.0.1:8004/healthz', timeout=3)); raise SystemExit(0 if body.get('status') == 'ok' else 1)"
    echo "==> Waiting for backend-$slot /healthz..."
    for _ in $(seq 1 30); do
        if remote_run "$COMPOSE exec -T backend-$slot python -c \"$health_check\""; then
            echo "==> backend-$slot is healthy"
            return 0
        fi
        sleep 2
    done
    echo "backend-$slot did not become healthy in time" >&2
    return 1
}

reload_frontend_nginx() {
    echo "==> Starting/reloading frontend Nginx..."
    remote_run "$COMPOSE up -d frontend"
    remote_run "$COMPOSE exec -T frontend nginx -s reload"
}

deploy_backend() {
    local current
    local next
    current="$(active_slot)"
    next="$(opposite_slot "$current")"

    build_backend "$next"
    write_upstream "$current"

    echo "==> Starting backend-$next..."
    remote_run "$COMPOSE up -d backend-$next"
    wait_for_backend "$next"

    write_upstream "$next"
    reload_frontend_nginx
    remote_run "printf '%s\n' '$next' > deploy/runtime/active_backend_slot"

    if [ "$current" != "$next" ]; then
        echo "==> Draining backend-$current for ${DRAIN_SECONDS}s..."
        sleep "$DRAIN_SECONDS"
        echo "==> Stopping old backend-$current..."
        remote_run "$COMPOSE stop backend-$current || true"
    fi
}

deploy_frontend() {
    local current
    current="$(active_slot)"
    write_upstream "$current"
    build_frontend
    reload_frontend_nginx
}

initial_runtime_files() {
    local current
    current="$(active_slot)"
    write_upstream "$current"
    remote_run "printf '%s\n' '$current' > deploy/runtime/active_backend_slot"
}

case "$COMPONENT" in
    backend)
        check_ssh_access
        sync_files
        initial_runtime_files
        deploy_backend
        ;;
    frontend)
        check_ssh_access
        sync_files
        initial_runtime_files
        deploy_frontend
        ;;
    all)
        check_ssh_access
        sync_files
        initial_runtime_files
        build_frontend
        deploy_backend
        ;;
    *)
        echo "Unknown component: $COMPONENT (use all, backend, or frontend)" >&2
        exit 1
        ;;
esac

echo ""
echo "==> Done. Access the app at http://$(remote_host):5177"
