@echo off
rem Market Desk: double-click to install, build, start and open the app.
rem Run "run.bat demo" to use clearly-labelled synthetic data instead of Yahoo.
title Market Desk
cd /d "%~dp0"

netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul && (echo Port 8000 is already in use, probably by an older Market Desk window. Close those windows and run this again. & pause & exit /b 1)

where python >nul 2>nul || (echo Python is not installed. Get it from https://www.python.org/downloads/ and tick "Add to PATH". & pause & exit /b 1)
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)

if not exist venv\Scripts\python.exe python -m venv venv || (echo Could not create the Python environment. & pause & exit /b 1)
echo Installing backend packages...
venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt || (echo Backend install failed. & pause & exit /b 1)

echo Installing and building the frontend...
pushd frontend
call npm install --no-audit --no-fund || (popd & echo Frontend install failed. & pause & exit /b 1)
call npm run build || (popd & echo Frontend build failed. & pause & exit /b 1)
popd

if /i "%~1"=="demo" set DEMO=1

echo.
echo Market Desk is starting at http://localhost:8000  (close this window to stop it)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8000"
cd backend
..\venv\Scripts\python.exe -m uvicorn app:app --port 8000
pause
