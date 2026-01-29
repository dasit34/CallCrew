#!/bin/bash

# Stop CallCrew Development Servers

echo "🛑 Stopping CallCrew Development Servers..."

# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Kill all node processes (if needed)
# killall node 2>/dev/null || true

# Remove PID file
rm -f .dev-pids

echo "✅ All servers stopped"
