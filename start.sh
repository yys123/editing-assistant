#!/bin/bash
# Start both backend and frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

echo "Starting Editing Assistant..."

# Backend
cd "$ROOT/backend"
python3 -m pip install -r requirements.txt -q 2>/dev/null || true
PYTHONUNBUFFERED=1 python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8004 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 3
echo ""
echo "  本机访问:   http://localhost:5177"
echo "  局域网访问: http://${LAN_IP}:5177"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
