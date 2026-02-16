#!/bin/bash

echo "🚀 AI Influencer Studio 시작..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    exit 1
fi

# Start backend
echo "📡 Backend API 시작 (포트 5000)..."
source venv/bin/activate
cd backend
python app.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Frontend 시작 (포트 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 서버 시작 완료!"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
