@echo off
chcp 65001 >nul
title CROSS — Export dati Firebase

echo.
echo  =============================================
echo   CROSS — Esportazione dati da Firebase
echo  =============================================
echo.

:: Vai nella cartella dove sta questo .bat (Datiexport_local\)
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Node.js non trovato nel sistema.
  echo  Scaricalo da https://nodejs.org e riprova.
  echo.
  pause
  exit /b 1
)

:: node_modules e package.json stanno nella cartella padre (CROSS\)
if not exist "..\node_modules" (
  echo  Installazione dipendenze ^(prima esecuzione^)...
  pushd ..
  call npm install --silent
  if errorlevel 1 (
    echo  ERRORE durante npm install.
    popd
    pause
    exit /b 1
  )
  popd
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
