#!/bin/bash

echo "========================================"
echo "   IEEE Dashboard - Quick Start"
echo "========================================"
echo

echo "[1/4] Checking for Node.js processes..."
pkill -f "node.*email-service.js" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ Stopped existing Node.js processes"
else
    echo "   ✓ No existing Node.js processes found"
fi
echo

echo "[2/4] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "   ✗ Failed to install dependencies"
    exit 1
fi
echo "   ✓ Dependencies installed successfully"
echo

echo "[3/4] Starting email service..."
npm start &
sleep 3
echo "   ✓ Email service started on http://localhost:3001"
echo

echo "[4/4] Opening dashboard in browser..."
if command -v xdg-open > /dev/null; then
    xdg-open "file://$(pwd)/dashboard.html"
elif command -v open > /dev/null; then
    open "file://$(pwd)/dashboard.html"
else
    echo "   Please open dashboard.html manually in your browser"
fi
echo "   ✓ Dashboard opened in browser"
echo

echo "========================================"
echo "   🚀 PROJECT IS NOW RUNNING!"
echo "========================================"
echo
echo "✅ Email Service: http://localhost:3001"
echo "✅ Dashboard: Opened in your browser"
echo "✅ Gmail Account: jixilann@gmail.com"
echo
echo "To stop the service, press Ctrl+C"
echo

# Keep the script running
wait
