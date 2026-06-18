#!/bin/bash
set -euo pipefail

# ============================================================
# Local blue-green deploy for the Mac that serves the team.
#
# Usage:
#   ./deploy-local-bluegreen.sh all
#   ./deploy-local-bluegreen.sh backend
#   ./deploy-local-bluegreen.sh frontend
#   ./deploy-local-bluegreen.sh status
#   ./deploy-local-bluegreen.sh stop
#
# Team members should use http://<this-mac-lan-ip>:5175.
# The local proxy serves frontend/dist and forwards /api to the
# active backend slot:
#   blue  -> 127.0.0.1:8101
#   green -> 127.0.0.1:8102
# ============================================================

COMPONENT="${1:-all}"   # all | backend | frontend | status | stop

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT/deploy/local-runtime"
ACTIVE_SLOT_FILE="$RUNTIME_DIR/active_backend_slot"
PROXY_PID_FILE="$RUNTIME_DIR/local-proxy.pid"
PROXY_LOG="$RUNTIME_DIR/local-proxy.log"
BLUE_PORT="${BACKEND_BLUE_PORT:-8101}"
GREEN_PORT="${BACKEND_GREEN_PORT:-8102}"
PROXY_PORT="${LOCAL_PROXY_PORT:-5175}"
DRAIN_SECONDS="${DRAIN_SECONDS:-20}"

mkdir -p "$RUNTIME_DIR"

pick_python() {
    if [ -n "${PYTHON:-}" ]; then
        echo "$PYTHON"
    elif [ -x "$ROOT/backend/venv/bin/python3" ]; then
        echo "$ROOT/backend/venv/bin/python3"
    elif [ -x "/usr/bin/python3" ]; then
        echo "/usr/bin/python3"
    else
        echo "python3"
    fi
}

PYTHON_BIN="$(pick_python)"

lan_ip() {
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
}

slot_port() {
    if [ "$1" = "green" ]; then
        echo "$GREEN_PORT"
    else
        echo "$BLUE_PORT"
    fi
}

active_slot() {
    cat "$ACTIVE_SLOT_FILE" 2>/dev/null || echo "blue"
}

opposite_slot() {
    if [ "$1" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

pid_file_for_slot() {
    echo "$RUNTIME_DIR/backend-$1.pid"
}

is_pid_alive() {
    local pid="$1"
    [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

pid_from_file() {
    local file="$1"
    cat "$file" 2>/dev/null || true
}

ensure_python_deps() {
    if ! "$PYTHON_BIN" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
        echo "Python ($PYTHON_BIN) is missing backend dependencies." >&2
        echo "Run:" >&2
        echo "  /usr/bin/python3 -m venv backend/venv" >&2
        echo "  backend/venv/bin/pip install -r backend/requirements.txt" >&2
        exit 1
    fi
}

ensure_port_free_for_slot() {
    local port="$1"
    local slot="$2"
    local pid_file
    local known_pid
    local listeners
    pid_file="$(pid_file_for_slot "$slot")"
    known_pid="$(pid_from_file "$pid_file")"
    listeners="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -z "$listeners" ]; then
        return 0
    fi
    if [ -n "$known_pid" ] && echo "$listeners" | grep -qx "$known_pid"; then
        return 0
    fi
    echo "Port $port is already used by another process:" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    exit 1
}

build_frontend() {
    echo "==> Building frontend..."
    (cd "$ROOT/frontend" && npm run build)
}

start_proxy() {
    local pid
    pid="$(pid_from_file "$PROXY_PID_FILE")"
    if is_pid_alive "$pid"; then
        if curl -fsS --max-time 2 "http://127.0.0.1:$PROXY_PORT/local-proxy-healthz" >/dev/null 2>&1; then
            echo "==> Local proxy already running on port $PROXY_PORT (pid $pid)"
            return 0
        fi
        echo "==> Stale proxy pid file found; proxy health check failed."
        echo "==> Stopping stale local proxy process (pid $pid)..."
        kill "$pid" 2>/dev/null || true
        rm -f "$PROXY_PID_FILE"
    fi
    if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
        echo "frontend/dist is missing; building frontend first..."
        build_frontend
    fi
    if lsof -tiTCP:"$PROXY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Port $PROXY_PORT is already in use. Stop the existing process before starting local blue-green proxy." >&2
        lsof -nP -iTCP:"$PROXY_PORT" -sTCP:LISTEN >&2 || true
        exit 1
    fi
    echo "==> Starting local proxy on port $PROXY_PORT..."
    (
        cd "$ROOT"
        ACTIVE_SLOT_FILE="$ACTIVE_SLOT_FILE" \
        BACKEND_BLUE_PORT="$BLUE_PORT" \
        BACKEND_GREEN_PORT="$GREEN_PORT" \
        LOCAL_PROXY_PORT="$PROXY_PORT" \
        nohup node scripts/local-bluegreen-proxy.mjs > "$PROXY_LOG" 2>&1 &
        echo $! > "$PROXY_PID_FILE"
    )
    for _ in $(seq 1 20); do
        if curl -fsS --max-time 2 "http://127.0.0.1:$PROXY_PORT/local-proxy-healthz" >/dev/null 2>&1; then
            return 0
        fi
        pid="$(pid_from_file "$PROXY_PID_FILE")"
        if ! is_pid_alive "$pid"; then
            echo "Local proxy failed to start. Last log lines:" >&2
            tail -80 "$PROXY_LOG" >&2 || true
            rm -f "$PROXY_PID_FILE"
            exit 1
        fi
        sleep 1
    done
    echo "Local proxy did not become healthy in time. Last log lines:" >&2
    tail -80 "$PROXY_LOG" >&2 || true
    exit 1
}

wait_for_backend() {
    local port="$1"
    echo "==> Waiting for backend on $port /healthz..."
    for _ in $(seq 1 45); do
        if curl -fsS --max-time 3 "http://127.0.0.1:$port/healthz" >/dev/null 2>&1; then
            echo "==> Backend on $port is healthy"
            return 0
        fi
        sleep 1
    done
    echo "Backend on $port did not become healthy in time" >&2
    return 1
}

start_backend_slot() {
    local slot="$1"
    local port
    local pid_file
    local log_file
    local pid
    port="$(slot_port "$slot")"
    pid_file="$(pid_file_for_slot "$slot")"
    log_file="$RUNTIME_DIR/backend-$slot.log"
    pid="$(pid_from_file "$pid_file")"

    ensure_python_deps
    ensure_port_free_for_slot "$port" "$slot"

    if is_pid_alive "$pid" && curl -fsS --max-time 2 "http://127.0.0.1:$port/healthz" >/dev/null 2>&1; then
        echo "==> backend-$slot already healthy on $port (pid $pid)"
        return 0
    fi

    echo "==> Starting backend-$slot on port $port..."
    (
        cd "$ROOT/backend"
        PYTHONUNBUFFERED=1 nohup "$PYTHON_BIN" -m uvicorn main:app --host 127.0.0.1 --port "$port" > "$log_file" 2>&1 &
        echo $! > "$pid_file"
    )
    if ! wait_for_backend "$port"; then
        echo "backend-$slot failed to start. Last log lines:" >&2
        tail -120 "$log_file" >&2 || true
        rm -f "$pid_file"
        exit 1
    fi
}

switch_active_slot() {
    local slot="$1"
    printf '%s\n' "$slot" > "$ACTIVE_SLOT_FILE"
    echo "==> Active backend slot is now $slot ($(slot_port "$slot"))"
}

stop_backend_slot() {
    local slot="$1"
    local pid_file
    local pid
    pid_file="$(pid_file_for_slot "$slot")"
    pid="$(pid_from_file "$pid_file")"
    if is_pid_alive "$pid"; then
        echo "==> Stopping backend-$slot (pid $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 2
        if is_pid_alive "$pid"; then
            echo "==> backend-$slot still running; sending TERM again..."
            kill "$pid" 2>/dev/null || true
        fi
    fi
    rm -f "$pid_file"
}

deploy_backend() {
    local current
    local next
    current="$(active_slot)"
    next="$(opposite_slot "$current")"
    start_proxy
    start_backend_slot "$next"
    switch_active_slot "$next"
    echo "==> Keeping old backend-$current alive for ${DRAIN_SECONDS}s so existing requests can finish..."
    sleep "$DRAIN_SECONDS"
    stop_backend_slot "$current"
}

deploy_frontend() {
    build_frontend
    start_proxy
    echo "==> Frontend build is live through local proxy."
}

print_status() {
    local current
    local proxy_pid
    current="$(active_slot)"
    proxy_pid="$(pid_from_file "$PROXY_PID_FILE")"
    echo "Active slot: $current ($(slot_port "$current"))"
    echo "Stable URL:  http://$(lan_ip):$PROXY_PORT"
    echo "Proxy:       ${proxy_pid:-not started}"
    lsof -nP -iTCP:"$PROXY_PORT" -sTCP:LISTEN 2>/dev/null || true
    lsof -nP -iTCP:"$BLUE_PORT" -sTCP:LISTEN 2>/dev/null || true
    lsof -nP -iTCP:"$GREEN_PORT" -sTCP:LISTEN 2>/dev/null || true
}

stop_all() {
    stop_backend_slot blue
    stop_backend_slot green
    local proxy_pid
    proxy_pid="$(pid_from_file "$PROXY_PID_FILE")"
    if is_pid_alive "$proxy_pid"; then
        echo "==> Stopping local proxy (pid $proxy_pid)..."
        kill "$proxy_pid" 2>/dev/null || true
    fi
    rm -f "$PROXY_PID_FILE"
}

case "$COMPONENT" in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_frontend
        deploy_backend
        ;;
    status)
        print_status
        ;;
    stop)
        stop_all
        ;;
    *)
        echo "Unknown command: $COMPONENT (use all, backend, frontend, status, or stop)" >&2
        exit 1
        ;;
esac

echo ""
echo "==> Done."
echo "    Services keep running in the background."
echo "    Stop them with: ./deploy-local-bluegreen.sh stop"
echo "    Local: http://localhost:$PROXY_PORT"
echo "    LAN:   http://$(lan_ip):$PROXY_PORT"
