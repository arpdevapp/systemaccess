@echo off
echo 🚀 Starting SystemAccess Remote Access System...

REM Start the signaling server in a new window
echo 📡 Starting signaling server on port 3001...
start "Signaling Server" cmd /k "cd server && npm start"

REM Wait for server to start
timeout /t 5 /nobreak > nul

REM Start the React app in a new window
echo 🌐 Starting React app on port 5173...
start "React App" cmd /k "npm run dev"

echo.
echo 🎉 SystemAccess is now running!
echo.
echo 📱 React App: http://localhost:5173
echo 📡 Signaling Server: http://localhost:3001
echo 🏥 Health Check: http://localhost:3001/health
echo.
echo Both services are running in separate windows.
echo Close the windows to stop the services.
echo.
pause
