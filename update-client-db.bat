@echo off
setlocal enabledelayedexpansion
title COMS Database Auto-Updater

echo =====================================================================
echo           COMS Client Database Auto-Update Engine
echo =====================================================================
echo.
echo Checking Node.js environment...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org or ensure it is in your system PATH.
    echo.
    pause
    exit /b 1
)

:: Navigate to backend folder
set "BACKEND_DIR=%~dp0backend"
if not exist "%BACKEND_DIR%" (
    set "BACKEND_DIR=%~dp0"
)

pushd "%BACKEND_DIR%"

echo Found backend directory at: %CD%
echo.
echo Running safe database schema synchronizer...
echo ---------------------------------------------------------------------

node scripts/sync-client-db.js

if %errorlevel% neq 0 (
    echo.
    echo [FAIL] Database sync failed with errors.
    popd
    pause
    exit /b %errorlevel%
)

echo.
echo [SUCCESS] Database schema and all tables/columns are fully up-to-date!
echo ---------------------------------------------------------------------
popd

echo.
echo Press any key to exit this window...
pause >nul
