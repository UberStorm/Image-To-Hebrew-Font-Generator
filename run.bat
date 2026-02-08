@echo off
REM ==============================================================
REM Hebrew Font Maker - Run Script
REM ==============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "VENV_PYTHON=%SCRIPT_DIR%venv\Scripts\python.exe"
set "VENV_PIP=%SCRIPT_DIR%venv\Scripts\pip.exe"

echo.
echo ==============================================================
echo  Hebrew Font Maker - Startup
echo ==============================================================
echo.

REM Check if venv python exists
if exist "%VENV_PYTHON%" goto VENV_READY

echo   Virtual environment not found. Running first-time installation...
echo.

REM Check Python is available
python --version >nul 2>&1
if errorlevel 1 goto NO_PYTHON

for /f "delims=" %%i in ('python --version 2^>^&1') do echo   + Found: %%i
echo.

REM Create venv
echo   [1/2] Creating virtual environment...
if exist "%SCRIPT_DIR%venv" rmdir /s /q "%SCRIPT_DIR%venv"
python -m venv "%SCRIPT_DIR%venv"
if not exist "%VENV_PYTHON%" goto VENV_FAIL
echo   + Virtual environment created
echo.

REM Install dependencies
echo   [2/2] Installing dependencies (this may take 1-2 minutes)...
echo.
"%VENV_PYTHON%" -m pip install --upgrade pip --quiet 2>nul
"%VENV_PIP%" install -r requirements.txt
if errorlevel 1 goto INSTALL_FAIL
echo.
echo   + Installation complete!
echo.

:VENV_READY
echo   Verifying venv...
"%VENV_PYTHON%" -c "import flask; import cv2; import fontTools; print('   + All packages OK')" 2>nul
if errorlevel 1 goto PACKAGES_MISSING
goto START_SERVER

:PACKAGES_MISSING
echo   ! Packages missing in venv. Reinstalling...
"%VENV_PIP%" install -r requirements.txt
if errorlevel 1 goto REINSTALL_FAIL

:START_SERVER
echo.
echo   Using Python: %VENV_PYTHON%
echo.
echo ==============================================================
echo.
echo   + Server starting... (browser will open automatically)
echo.
echo   URL: http://127.0.0.1:5000
echo.
echo ==============================================================
echo   Press Ctrl+C to stop the server
echo ==============================================================
echo.

"%VENV_PYTHON%" backend\app.py
goto END

:NO_PYTHON
echo   ERROR: Python is not installed or not in PATH!
echo   Please install Python 3.8+ from https://www.python.org
echo   Make sure to check "Add Python to PATH" during install.
goto FAIL

:VENV_FAIL
echo   ERROR: Failed to create virtual environment.
goto FAIL

:INSTALL_FAIL
echo.
echo   ERROR: Failed to install dependencies.
echo   Check your internet connection and try again.
goto FAIL

:REINSTALL_FAIL
echo   ERROR: Could not install packages. Delete the 'venv' folder and try again.
goto FAIL

:FAIL
echo.
pause
exit /b 1

:END
pause
