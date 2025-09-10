@echo off
REM start.cmd - Windows launcher for WhatsApp Data Collector

setlocal ENABLEDELAYEDEXPANSION

echo 🚀 Starting WhatsApp Data Collector...

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo 📁 Running from: %SCRIPT_DIR%

REM Free port 3377 if in use
echo 🔍 Checking for process listening on port 3377...
set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3377" ^| findstr "LISTENING"') do (
    set "PID=%%p"
)
if defined PID (
    echo ⚠️  Port 3377 is in use by PID !PID!, attempting to terminate...
    taskkill /PID !PID! /F >nul 2>&1
    timeout /t 2 /nobreak >nul
) else (
    echo ✅ Port 3377 appears free.
)

REM Start the Node.js server
echo 📱 Starting server...
start /B "" "bin\node.exe" "app\server.js"

echo 🔌 Server is starting in background...
echo.
echo 🌐 Waiting for server to become healthy on port 3377...
timeout /t 5 /nobreak >nul

REM Verify health on 3377 and open it
set PORT=3377
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3377/health' -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 1 } else { exit 0 } } catch { exit 0 }" >nul 2>&1
if errorlevel 1 (
    echo 🎯 Server detected on port %PORT%
    echo.
    echo 🌐 Opening browser at http://localhost:%PORT%...
    start "" "http://localhost:%PORT%"
) else (
    echo ❌ Port 3377 did not respond as healthy.
    echo    Please ensure port 3377 is free and retry.
)

echo.
echo ✅ WhatsApp Data Collector is running!
echo    Open: http://localhost:%PORT%
echo.
echo Press any key to stop the server...

REM Wait for user input to stop
pause >nul

REM Try to stop the server (best effort)
echo 🔌 Stopping server...
taskkill /f /im node.exe >nul 2>&1

echo ✅ Server stopped. You can close this window.
pause


