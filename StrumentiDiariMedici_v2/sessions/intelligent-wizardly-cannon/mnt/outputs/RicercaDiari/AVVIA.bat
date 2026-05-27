@echo off
chcp 65001 >nul 2>&1
title Strumenti Diari Medici v2.0

:: ============================================================
::  STRUMENTI DIARI MEDICI v2.0
::  Script di primo avvio / build / lancio
::
::  Non richiede diritti amministratore.
::  Al primo avvio scarica le librerie necessarie e compila.
::  Dai avvii successivi lancia direttamente il programma.
:: ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ── Se il JAR è già pronto, lancia e chiudi ─────────────────
if exist "RicercaDiari.jar" (
    echo Avvio Strumenti Diari Medici...
    start "" javaw -jar "%SCRIPT_DIR%RicercaDiari.jar"
    exit /b 0
)

:: ── Primo avvio: build ───────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     STRUMENTI DIARI MEDICI  — Primo avvio           ║
echo  ║     Verrà compilata l'applicazione (1-2 minuti).    ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  È necessaria una connessione a Internet per scaricare
echo  le librerie (circa 10 MB).  Poi funziona offline.
echo.
pause

:: ── Cerca javac (JDK) ───────────────────────────────────────
set "JAVAC_CMD=javac"
set "JAR_CMD=jar"
set "JAVA_CMD=java"

javac -version >nul 2>&1
if %errorlevel% equ 0 goto :FOUND_JDK

:: Cerca JDK in percorsi comuni
for %%P in (
    "C:\Program Files\Java\jdk*"
    "C:\Program Files\Eclipse Adoptium\jdk*"
    "C:\Program Files\Microsoft\jdk*"
    "%LOCALAPPDATA%\Programs\Eclipse Adoptium\jdk*"
    "%LOCALAPPDATA%\jdk*"
    "%USERPROFILE%\jdk*"
) do (
    for /d %%D in (%%P) do (
        if exist "%%D\bin\javac.exe" (
            set "JAVAC_CMD=%%D\bin\javac.exe"
            set "JAR_CMD=%%D\bin\jar.exe"
            set "JAVA_CMD=%%D\bin\java.exe"
            goto :FOUND_JDK
        )
    )
)

:: Nessun JDK trovato — scarica OpenJDK 11 portatile (no admin)
echo  JDK non trovato. Scaricamento OpenJDK 11 portatile...
echo  (Questa operazione avviene una sola volta, ~100 MB)
echo.

set "JDK_DIR=%USERPROFILE%\StrumentiDiari_JDK"
if exist "%JDK_DIR%\bin\javac.exe" (
    set "JAVAC_CMD=%JDK_DIR%\bin\javac.exe"
    set "JAR_CMD=%JDK_DIR%\bin\jar.exe"
    set "JAVA_CMD=%JDK_DIR%\bin\java.exe"
    goto :FOUND_JDK
)

mkdir "%JDK_DIR%" >nul 2>&1
echo  Scaricamento in corso...

powershell -NoProfile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$url='https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.22+7/OpenJDK11U-jdk_x64_windows_hotspot_11.0.22_7.zip';" ^
  "Invoke-WebRequest -Uri $url -OutFile '%TEMP%\jdk11.zip' -UseBasicParsing"

if not exist "%TEMP%\jdk11.zip" (
    echo.
    echo  ERRORE: impossibile scaricare il JDK.
    echo  Soluzioni alternative:
    echo   1. Installa Java JDK da: https://adoptium.net
    echo   2. Chiedi all'IT di installare il JDK
    echo   3. Copia il JDK in: %JDK_DIR%
    pause
    exit /b 1
)

echo  Estrazione JDK...
powershell -NoProfile -Command ^
  "Expand-Archive -Path '%TEMP%\jdk11.zip' -DestinationPath '%TEMP%\jdk11_extract' -Force"

for /d %%D in ("%TEMP%\jdk11_extract\jdk*") do (
    xcopy /E /Y "%%D\*" "%JDK_DIR%\" >nul
)
del "%TEMP%\jdk11.zip" >nul 2>&1

if not exist "%JDK_DIR%\bin\javac.exe" (
    echo  ERRORE: estrazione JDK fallita.
    pause
    exit /b 1
)

set "JAVAC_CMD=%JDK_DIR%\bin\javac.exe"
set "JAR_CMD=%JDK_DIR%\bin\jar.exe"
set "JAVA_CMD=%JDK_DIR%\bin\java.exe"
echo  JDK installato con successo.

:FOUND_JDK
echo  Java trovato. Proseguo con il download delle librerie...

:: ── Scarica PDFBox ──────────────────────────────────────────
set "LIB_DIR=%SCRIPT_DIR%lib"
mkdir "%LIB_DIR%" >nul 2>&1

if exist "%LIB_DIR%\pdfbox.jar" goto :LIBS_OK

echo  Scaricamento PDFBox (libreria PDF)...
powershell -NoProfile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/org/apache/pdfbox/pdfbox/1.8.17/pdfbox-1.8.17.jar' -OutFile '%LIB_DIR%\pdfbox.jar' -UseBasicParsing"

powershell -NoProfile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/org/apache/pdfbox/fontbox/1.8.17/fontbox-1.8.17.jar' -OutFile '%LIB_DIR%\fontbox.jar' -UseBasicParsing"

powershell -NoProfile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/commons-logging/commons-logging/1.2/commons-logging-1.2.jar' -OutFile '%LIB_DIR%\commons-logging.jar' -UseBasicParsing"

if not exist "%LIB_DIR%\pdfbox.jar" (
    echo.
    echo  ERRORE: impossibile scaricare PDFBox.
    echo  Verifica la connessione internet e riprova.
    pause
    exit /b 1
)

:LIBS_OK
echo  Librerie OK.

:: ── Compilazione ────────────────────────────────────────────
set "SRC=%SCRIPT_DIR%src\main\java\it\medico\diari\RicercaDiari.java"
set "BUILD=%SCRIPT_DIR%build\classes"
set "FATJAR=%SCRIPT_DIR%build\fatjar"
set "CP=%LIB_DIR%\pdfbox.jar;%LIB_DIR%\fontbox.jar;%LIB_DIR%\commons-logging.jar"

mkdir "%BUILD%" >nul 2>&1
mkdir "%FATJAR%" >nul 2>&1

echo  Compilazione in corso...
"%JAVAC_CMD%" -encoding UTF-8 -cp "%CP%" -d "%BUILD%" "%SRC%"

if %errorlevel% neq 0 (
    echo.
    echo  ERRORE di compilazione. Dettagli qui sopra.
    pause
    exit /b 1
)

:: ── Creazione fat JAR ────────────────────────────────────────
echo  Creazione del pacchetto eseguibile...

cd /d "%FATJAR%"
"%JAR_CMD%" xf "%LIB_DIR%\pdfbox.jar"
"%JAR_CMD%" xf "%LIB_DIR%\fontbox.jar"
"%JAR_CMD%" xf "%LIB_DIR%\commons-logging.jar"

:: Copia le classi compilate
xcopy /S /Y "%BUILD%\*" "%FATJAR%\" >nul

:: Manifest
echo Main-Class: it.medico.diari.RicercaDiari> "%SCRIPT_DIR%build\MANIFEST.MF"
echo.>> "%SCRIPT_DIR%build\MANIFEST.MF"

cd /d "%SCRIPT_DIR%"
"%JAR_CMD%" cfm "RicercaDiari.jar" "build\MANIFEST.MF" -C "%FATJAR%" .

if %errorlevel% neq 0 (
    echo.
    echo  ERRORE nella creazione del JAR.
    pause
    exit /b 1
)

:: ── Pulizia temporanei ───────────────────────────────────────
rmdir /S /Q "%SCRIPT_DIR%build" >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  Compilazione completata con successo!               ║
echo  ║  D'ora in poi basterà cliccare AVVIA.bat             ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── Lancia il programma ──────────────────────────────────────
start "" "%JAVA_CMD%" -jar "%SCRIPT_DIR%RicercaDiari.jar"

exit /b 0
