@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env copy /Y .env.example .env >nul

if not exist node_modules (
  echo Bagimliliklar kuruluyor, biraz bekleyin...
  call npm install
  if errorlevel 1 (
    echo npm install basarisiz. Node.js kurulu mu?
    pause
    exit /b 1
  )
)

call npx prisma generate
call npx prisma migrate deploy
if errorlevel 1 (
  call npx prisma migrate dev --name init
)

echo.
echo wexon-growth-os: http://127.0.0.1:3000
echo Bu pencereyi kapatmayin.
echo.

start "" "http://127.0.0.1:3000"
call npx next dev --hostname 127.0.0.1 --port 3000
if errorlevel 1 pause
