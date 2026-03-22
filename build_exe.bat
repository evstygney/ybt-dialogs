@echo off
cd /d "%~dp0"
python -m PyInstaller --noconfirm --clean pysyvit_ybt.spec
