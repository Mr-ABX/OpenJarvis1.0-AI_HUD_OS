@echo off
echo Starting J.A.R.V.I.S...

:: Pull latest changes from git
echo Pulling latest code...
git pull origin main

:: Start Hybrid Server
echo Starting Hybrid Node/Python Server...
call npm install
npm run dev

echo J.A.R.V.I.S stopped.
pause

