@echo off
rem Development mode: API on :8000 (auto-reload) + Vite on :5173 (hot reload).
cd /d "%~dp0"
if not exist venv\Scripts\python.exe python -m venv venv
venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt
pushd frontend & call npm install --no-audit --no-fund & popd
start "Market Desk API" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000"
start "Market Desk Web" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo Open http://localhost:5173
