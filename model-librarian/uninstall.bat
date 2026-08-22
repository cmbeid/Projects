@echo off
setlocal

cd /d "%~dp0"

if not exist ".venv" (
    echo No .venv found in this folder -- nothing to uninstall.
    pause
    exit /b 0
)

echo This will delete the virtual environment:
echo   %cd%\.venv
echo.
set /p CONFIRM=Continue? [y/N]
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

rmdir /s /q ".venv"
if exist ".venv" (
    echo.
    echo Failed to remove .venv completely. Close any programs using it -- a running
    echo Model Librarian, or a terminal with the venv activated -- and try again.
    pause
    exit /b 1
)

echo.
echo Removed .venv. Run install.bat again if you want to reinstall.
echo.
echo Note: your scanned index and settings live separately at
echo   %LOCALAPPDATA%\model-librarian
echo and are not touched by this script. Delete that folder yourself if you also
echo want to remove your index.
pause
