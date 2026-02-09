@echo off
cd /d "%~dp0"
echo ============================================
echo   Hebrew Font Editor - Starting...
echo ============================================
call venv\Scripts\activate
python backend\font_editor_server.py
pause
