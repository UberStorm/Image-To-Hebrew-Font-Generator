@echo off
REM ==============================================================
REM Hebrew Font Maker - Installation Only (No Server Start)
REM ==============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "VENV_PYTHON=%SCRIPT_DIR%venv\Scripts\python.exe"
set "VENV_PIP=%SCRIPT_DIR%venv\Scripts\pip.exe"

echo.
echo ==============================================================
echo  Hebrew Font Maker - Installation Script
echo ==============================================================
echo.

REM ============ STEP 1: Check Python ============
echo [STEP 1] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 goto NO_PYTHON

for /f "delims=" %%i in ('python --version 2^>^&1') do echo   + Found: %%i
echo.

REM ============ STEP 2: Create VENV ============
echo [STEP 2] Setting up Python Virtual Environment...

if exist "%VENV_PYTHON%" (
    echo   + Virtual environment already exists
    goto STEP3
)

if exist "%SCRIPT_DIR%venv" (
    echo   ! Removing broken venv folder...
    rmdir /s /q "%SCRIPT_DIR%venv"
)

echo   * Creating virtual environment...
python -m venv "%SCRIPT_DIR%venv"
if not exist "%VENV_PYTHON%" goto VENV_FAIL
echo   + Virtual environment created

:STEP3
echo.

REM ============ STEP 3: Install into VENV ============
echo [STEP 3] Installing dependencies into venv...
echo   * Using Python: %VENV_PYTHON%

"%VENV_PYTHON%" -m pip install --upgrade pip --quiet 2>nul

echo   * Installing packages (this may take 1-2 minutes)...
echo.
"%VENV_PIP%" install -r requirements.txt
if errorlevel 1 goto INSTALL_FAIL

echo.
echo   + All dependencies installed successfully into venv
echo.

REM ============ STEP 4: Validate Installation ============
echo [STEP 4] Validating installation (using venv python)...

"%VENV_PYTHON%" -c "import flask; print('   + Flask')" 2>nul || goto ERROR
"%VENV_PYTHON%" -c "import flask_cors; print('   + Flask-CORS')" 2>nul || goto ERROR
"%VENV_PYTHON%" -c "import cv2; print('   + OpenCV')" 2>nul || goto ERROR
"%VENV_PYTHON%" -c "import PIL; print('   + Pillow')" 2>nul || goto ERROR
"%VENV_PYTHON%" -c "import fontTools; print('   + fontTools')" 2>nul || goto ERROR
"%VENV_PYTHON%" -c "import numpy; print('   + NumPy')" 2>nul || goto ERROR

echo.
echo   + All packages validated successfully
echo.

REM ============ STEP 5: Check Project Structure ============
echo [STEP 5] Checking project structure...

if not exist "%SCRIPT_DIR%backend\app.py" goto MISSING_FILES
if not exist "%SCRIPT_DIR%frontend\index.html" goto MISSING_FILES
if not exist "%SCRIPT_DIR%config.py" goto MISSING_FILES

echo   + Project structure is valid
echo.

REM ============ Installation Complete ============
echo ==============================================================
echo.
echo   + INSTALLATION COMPLETE!
echo.
echo   To start the server, double-click: run.bat
echo.
echo ==============================================================
echo.
pause
exit /b 0

:NO_PYTHON
echo.
echo   ERROR: Python is not installed or not in PATH!
echo   Please install Python 3.8+ from https://www.python.org
echo   Make sure to check "Add Python to PATH" during install.
goto FAIL

:VENV_FAIL
echo   ERROR: Failed to create virtual environment.
echo   Try running: python -m venv venv
goto FAIL

:INSTALL_FAIL
echo.
echo   ERROR: Failed to install dependencies.
echo   Check your internet connection and try again.
goto FAIL

:MISSING_FILES
echo   ERROR: Project files missing (backend\app.py, frontend\index.html, or config.py)
goto FAIL

:ERROR
echo.
echo   ERROR: A package failed to import after installation.
goto FAIL

:FAIL
echo.
echo ==============================================================
echo   INSTALLATION ERROR
echo ==============================================================
echo   Try: delete the 'venv' folder and run install.bat again.
echo.
pause
exit /b 1
echo.
pause
exit /b 1

endlocal
