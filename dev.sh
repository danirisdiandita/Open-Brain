#!/bin/bash

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting backend (uvicorn) and frontend (vite)..."

cd "$(dirname "$0")/backend"
python -m uvicorn app.main:app --reload &
BACKEND_PID=$!

cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."
echo ""

wait
