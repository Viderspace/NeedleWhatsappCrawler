@echo off
REM start.cmd - Windows launcher for WhatsApp Data Collector

echo 🚀 Starting WhatsApp Data Collector...

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo 📁 Running from: %SCRIPT_DIR%

REM Start the Node.js server
echo 📱 Starting server...
start /B "" "bin\node.exe" "app\server.js"

echo 🔌 Server is starting in background...
echo.
echo 🌐 Waiting for server to start and detect port...

REM Wait for server to start and detect the port
timeout /t 5 /nobreak >nul

REM Try to detect the port by checking common ports
set PORT=3377
for /L %%i in (3000,1,3010) do (
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%%i/health' -TimeoutSec 1 -UseBasicParsing; if ($response.StatusCode -eq 200) { exit %%i } } catch { exit 0 }" >nul 2>&1
    if !errorlevel! neq 0 (
        set PORT=%%i
        goto :portfound
    )
)

:portfound
echo 🎯 Server detected on port %PORT%
echo.
echo 🌐 Opening browser at http://localhost:%PORT%...
start "" "http://localhost:%PORT%"

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


