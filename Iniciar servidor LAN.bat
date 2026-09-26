@echo off
chcp 65001 >nul
title Isla Perdida - Servidor LAN
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 goto usepython
where py >nul 2>nul
if not errorlevel 1 goto usepy

echo.
echo   No se encontro Python. Instalalo desde https://www.python.org/downloads/
echo   y marca la casilla "Add Python to PATH" durante la instalacion.
echo.
goto fin

:usepython
python servidor.py %*
goto fin

:usepy
py servidor.py %*

:fin
pause
