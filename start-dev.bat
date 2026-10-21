@echo off
set PORT=5002
set NODE_ENV=development
echo Starting FinanzerPro on port 5002...
npx tsx server/index.ts
pause
