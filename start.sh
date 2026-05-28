#!/bin/bash
cd "$(dirname "$0")"

ROOT="$(pwd)"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

echo "Starting Editing Assistant..."

# 选择 Python 解释器：优先项目 venv（与 cm/dev.sh 约定一致），其次系统 Python，最后裸 python3。
# 可通过环境变量 PYTHON 覆盖。
if [ -n "$PYTHON" ]; then
    :
elif [ -x "$ROOT/backend/venv/bin/python3" ]; then
    PYTHON="$ROOT/backend/venv/bin/python3"
elif [ -x "/usr/bin/python3" ]; then
    PYTHON="/usr/bin/python3"
else
    PYTHON="python3"
fi
if ! "$PYTHON" -c "import fastapi" >/dev/null 2>&1; then
    echo "❌ 当前 Python ($PYTHON) 缺少依赖，请运行:"
    echo "    /usr/bin/python3 -m venv backend/venv && backend/venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

# 启动后端
(cd "$ROOT/backend" && PYTHONUNBUFFERED=1 "$PYTHON" -m uvicorn main:app --reload --host 0.0.0.0 --port 8002) &
BACKEND_PID=$!

# 启动前端
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT TERM EXIT

sleep 3
echo ""
echo "  本机访问:   http://localhost:5175"
echo "  局域网访问: http://${LAN_IP}:5175"
echo "  后端:       http://localhost:8002"
echo ""
echo "Press Ctrl+C to stop"

wait
