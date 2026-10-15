@echo off
cd /d "%~dp0"
echo Starting local preview...
node tools\serve.js
pause
