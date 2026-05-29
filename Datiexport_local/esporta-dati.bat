@echo off
chcp 65001 >nul
title CROSS — Export dati Firebase

echo.
echo  =============================================
echo   CROSS — Esportazione dati da Firebase
echo  =============================================
echo.

:: Vai nella cartella dove sta questo .bat
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Node.js non trovato nel sistema.
  echo  Scaricalo da https://nodejs.org e riprova.
  echo.
  pause
  exit /b 1
)

:: node_modules sta qui dentro (standalone)
if not exist "node_modules" (
  echo  Installazione dipendenze ^(prima esecuzione^)...
  call npm install --silent
  if errorlevel 1 (
    echo  ERRORE durante npm install.
    pause
    exit /b 1
  )
  echo  Fatto.
  echo.
)

node export-firebase.mjs

if errorlevel 1 (
  echo.
  echo  Si e' verificato un errore. Controlla il messaggio sopra.
  echo.
  pause
  exit /b 1
)

echo.
echo  Apertura cartella export...
for /f "delims=" %%i in ('dir /b /ad /o-d "%~dp0" 2^>nul') do (
  start explorer "%~dp0%%i"
  goto :fine
)
:fine

echo.
pause
