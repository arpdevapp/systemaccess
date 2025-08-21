#!/bin/bash

# SystemAccess Remote Access System Startup Script

echo "🚀 Starting SystemAccess Remote Access System..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Shutting down services..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start the signaling server in the background
echo "📡 Starting signaling server on port 3001..."
cd server
npm start &
SERVER_PID=$!
cd ..

# Wait a moment for server to start
sleep 3

# Check if server started successfully
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Failed to start signaling server. Please check the server logs."
    exit 1
fi

echo "✅ Signaling server started successfully!"

# Start the React app in the background
echo "🌐 Starting React app on port 5173..."
npm run dev &
CLIENT_PID=$!

# Wait a moment for client to start
sleep 5

echo ""
echo "🎉 SystemAccess is now running!"
echo ""
echo "📱 React App: http://localhost:5173"
echo "📡 Signaling Server: http://localhost:3001"
echo "🏥 Health Check: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait $SERVER_PID $CLIENT_PID
