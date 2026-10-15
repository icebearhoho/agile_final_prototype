@echo off
cd /d "%~dp0"
echo Applying data\fee-types.json into the bundle...
node tools\fee-types.js apply
echo.
echo Done. Refresh the browser (Ctrl+F5) to see the changes.
pause
