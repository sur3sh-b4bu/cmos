@echo off
rem Runs one backup and appends the result to backend\logs\backup.log.
rem Usage: run-backup.cmd ["C:\path\to\node.exe"]     (defaults to `node` on PATH)
setlocal
set "NODE_EXE=%~1"
if "%NODE_EXE%"=="" set "NODE_EXE=node"

cd /d "%~dp0..\.."
if not exist logs mkdir logs

echo [%date% %time%] backup started>> logs\backup.log
"%NODE_EXE%" scripts\backup.js >> logs\backup.log 2>&1
echo [%date% %time%] backup finished with code %errorlevel%>> logs\backup.log
exit /b %errorlevel%
