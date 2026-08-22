@echo off
setlocal

cd /d "%~dp0"

set VENV_DIR=.venv

where py >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON=py -3.11"
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set "PYTHON=python"
    ) else (
        echo Python was not found on PATH.
        echo Install Python 3.11 or newer from https://www.python.org/downloads/ and re-run this script.
        pause
        exit /b 1
    )
)

if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Creating virtual environment in %VENV_DIR% ...
    %PYTHON% -m venv %VENV_DIR%
    if errorlevel 1 (
        echo Failed to create the virtual environment. See the output above for details.
        pause
        exit /b 1
    )
) else (
    echo Virtual environment already exists in %VENV_DIR%, reusing it.
)

echo.
echo Installing model-librarian and its dependencies ...
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%VENV_DIR%\Scripts\python.exe" -m pip install -e ".[dev]"
if errorlevel 1 (
    echo.
    echo Install failed. See the output above for details.
    pause
    exit /b 1
)

echo.
echo Install complete. Run run.bat to start Model Librarian.
echo (STEP files work now with metadata only; the optional 3D-preview extra for
echo  STEP is not installed by this script -- see README.md if you want it.)
pause
