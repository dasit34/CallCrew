#!/bin/bash

# CallCrew Development Startup Script
# This script starts both backend and frontend servers

set -e

echo "🚀 Starting CallCrew Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill existing processes on ports 3000 and 3001
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Clean frontend build cache
echo -e "${YELLOW}Cleaning frontend build cache...${NC}"
cd "$(dirname "$0")/callcrew-dashboard"
rm -rf .next
cd ..

# Start Backend
echo -e "${BLUE}📦 Starting Backend Server (Port 3000)...${NC}"
cd callcrew-backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running on http://localhost:3000${NC}"
else
    echo -e "${YELLOW}⚠️  Backend may still be starting...${NC}"
fi

# Start Frontend
echo -e "${BLUE}🎨 Starting Frontend Server (Port 3001)...${NC}"
cd callcrew-dashboard
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo -e "${YELLOW}Waiting for frontend to start...${NC}"
sleep 5

# Check if frontend is running
if curl -s http://localhost:3001 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is running on http://localhost:3001${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend may still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Development servers started!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📍 Backend:  ${BLUE}http://localhost:3000${NC}"
echo -e "📍 Frontend: ${BLUE}http://localhost:3001${NC}"
echo ""
echo -e "📋 Process IDs:"
echo -e "   Backend PID:  ${BACKEND_PID}"
echo -e "   Frontend PID: ${FRONTEND_PID}"
echo ""
echo -e "📝 Logs:"
echo -e "   Backend:  tail -f backend.log"
echo -e "   Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}To stop servers, run:${NC}"
echo -e "   kill $BACKEND_PID $FRONTEND_PID"
echo -e "   or: killall node"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop all servers${NC}"

# Save PIDs to file for easy cleanup
echo "$BACKEND_PID $FRONTEND_PID" > .dev-pids

# Wait for user interrupt
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .dev-pids; exit" INT

# Keep script running
wait
