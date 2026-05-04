#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
REDIS_CONTAINER="redinside-redis"

start() {
    echo "Starting RedInside Music Studio..."

    # Check for API key
    if ! grep -q "MINIMAX_API_KEY=your_api_key_here\|MINIMAX_API_KEY=$" "$PROJECT_ROOT/config/.env" 2>/dev/null; then
        echo "✓ MINIMAX_API_KEY found"
    else
        echo "⚠ WARNING: MINIMAX_API_KEY not set in config/.env"
    fi

    # Start Redis (docker or brew)
    echo "Starting Redis..."
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        docker rm -f "$REDIS_CONTAINER" 2>/dev/null
        docker run -d --name "$REDIS_CONTAINER" -p 6379:6379 redis:7-alpine
    elif command -v redis-server &> /dev/null; then
        redis-server --daemonize yes --port 6379
    else
        echo "⚠ Redis not available. Install with: brew install redis"
        echo "  Or enable Docker and restart"
    fi
    sleep 1

    # Migrate database
    echo "Running database migrations..."
    cd "$BACKEND_DIR" && npm run db:migrate 2>/dev/null

    # Start backend
    echo "Starting backend (port 3000)..."
    cd "$BACKEND_DIR" && npm run dev &
    BACKEND_PID=$!

    # Start frontend (optional)
    echo "Starting frontend (port 5173)..."
    cd "$FRONTEND_DIR" && npm run dev &
    FRONTEND_PID=$!

    echo ""
    echo "✓ All services started!"
    echo "  Backend:  http://localhost:3000"
    echo "  Frontend: http://localhost:5173"
    echo "  Redis:    localhost:6379"
    echo ""
    echo "Run ./scripts/dev.sh logs to see output"
    echo "Run ./scripts/dev.sh stop to shut down"
    echo ""

    # Store PIDs
    echo "$BACKEND_PID" > "$PROJECT_ROOT/.backend.pid"
    echo "$FRONTEND_PID" > "$PROJECT_ROOT/.frontend.pid"
}

stop() {
    echo "Stopping RedInside Music Studio..."

    # Kill backend and frontend
    [ -f "$PROJECT_ROOT/.backend.pid" ] && kill $(cat "$PROJECT_ROOT/.backend.pid") 2>/dev/null
    [ -f "$PROJECT_ROOT/.frontend.pid" ] && kill $(cat "$PROJECT_ROOT/.frontend.pid") 2>/dev/null

    # Stop Redis
    docker stop "$REDIS_CONTAINER" 2>/dev/null
    docker rm "$REDIS_CONTAINER" 2>/dev/null
    pkill -f "redis-server.*6379" 2>/dev/null || true

    # Cleanup PID files
    rm -f "$PROJECT_ROOT/.backend.pid" "$PROJECT_ROOT/.frontend.pid"

    echo "✓ All services stopped"
}

logs() {
    echo "Backend logs (Ctrl+C to exit):"
    tail -f "$PROJECT_ROOT/backend/logs/*.log" 2>/dev/null || echo "No logs yet"
}

status() {
    echo "Service status:"
    docker ps --filter "name=$REDIS_CONTAINER" 2>/dev/null | grep -q "$REDIS_CONTAINER" && echo "✓ Redis running" || echo "✗ Redis not running"
    curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "✓ Backend running" || echo "✗ Backend not running"
    curl -s http://localhost:5173 >/dev/null 2>&1 && echo "✓ Frontend running" || echo "✗ Frontend not running"
}

case "$1" in
    start) start ;;
    stop) stop ;;
    status) status ;;
    logs) logs ;;
    *)
        echo "Usage: ./scripts/dev.sh {start|stop|status|logs}"
        echo ""
        echo "  start   - Start all services (backend, frontend, redis)"
        echo "  stop    - Stop all services"
        echo "  status  - Check which services are running"
        echo "  logs    - View backend logs"
        ;;
esac