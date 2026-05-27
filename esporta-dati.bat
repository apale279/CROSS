@echo off
chcp 65001 >nul
title CROSS — Export dati Firebase

echo.
echo  =============================================
echo   CROSS — Esportazione dati da Firebase
echo  =============================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Node.js non trovato nel sistema.
  echo  Scaricalo da https://nodejs.org e riprova.
  echo.
  pause
  exit /b 1
)

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

node scripts/export-firebase.mjs

if errorlevel 1 (
  echo.
  echo  Si e' verificato un errore. Controlla il messaggio sopra.
  echo.
  pause
  exit /b 1
)

echo.
echo  Apertura cartella exports...
for /f "delims=" %%i in ('dir /b /ad /o-d exports 2^>nul') do (
  start explorer "%~dp0exports\%%i"
  goto :fine
)
:fine

echo.
pause
