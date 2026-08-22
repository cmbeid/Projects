@echo off
setlocal

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Virtual environment not found. Run install.bat first.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" -m model_librarian
if errorlevel 1 (
    echo.
    echo Model Librarian exited with an error. See the output above.
    pause
    exit /b 1
)
