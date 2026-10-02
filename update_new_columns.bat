@echo off
title COMS Database Updater & Migrator
color 0B
echo.
echo ========================================================
echo   Church Office Management System (COMS)
echo   Master Database Synchronization & Column Updater
echo ========================================================
echo.

cd /d "%~dp0backend"

where node >nul 2>nul
if %errorlevel% equ 0 (
    if exist "scripts\update-new-columns.js" (
        echo Running synchronization script via Node.js...
        echo.
        node scripts\update-new-columns.js
        goto handle_result
    )
)

echo [Notice] Node.js runner not available, attempting MySQL CLI fallback...
where mysql >nul 2>nul
if %errorlevel% equ 0 (
    if exist "database\update_new_tables_and_columns.sql" (
        echo Executing database\update_new_tables_and_columns.sql via mysql CLI...
        mysql -u root -p coms_db < database\update_new_tables_and_columns.sql
        goto handle_result
    )
)

color 0C
echo [ERROR] Neither Node.js nor MySQL CLI could be executed.
echo Please ensure Node.js is installed or run database\update_new_tables_and_columns.sql directly in MySQL Workbench.
goto end

:handle_result
if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ========================================================
    echo  All tables, columns, and settings updated successfully!
    echo ========================================================
) else (
    color 0C
    echo.
    echo [ERROR] Update encountered an error.
    echo Please verify MySQL service is running and backend\.env credentials are correct.
)

:end
echo.
echo Press any key to close this window...
pause >nul
