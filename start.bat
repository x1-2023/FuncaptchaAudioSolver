@echo off
title Run Gemini Audio API Server

echo Starting the Node.js server (server.js)...
echo Ensure your .env file with GEMINI_API_KEY is present in this directory.
echo.
echo The server will run in this window.
echo Press Ctrl+C to stop the server.
echo.

REM Chạy file server Node.js
node server.js

echo.
echo Server stopped.
echo.
pause