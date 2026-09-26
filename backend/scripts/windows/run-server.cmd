@echo off
rem Keeps the COMS API running: starts it, and if it ever exits (a crash, or
rem MySQL not being ready yet right after boot) waits 10 seconds and starts it
rem again, forever. Normal logging still goes to backend\logs\combined.log via
rem the app's own logger; this file only captures raw crash output.
rem
rem Usage: run-server.cmd ["C:\path\to\node.exe"]     (defaults to `node` on PATH)
setlocal
set "NODE_EXE=%~1"
if "%NODE_EXE%"=="" set "NODE_EXE=node"

cd /d "%~dp0..\.."
if not exist logs mkdir logs

:loop
echo [%date% %time%] starting COMS API>> logs\service.log
"%NODE_EXE%" src\server.js >nul 2>> logs\service-error.log
echo [%date% %time%] COMS API exited with code %errorlevel%, restarting in 10s>> logs\service.log
rem ping, not `timeout`: `timeout` errors out when there is no console (scheduled task).
ping -n 11 127.0.0.1 >nul
goto loop
