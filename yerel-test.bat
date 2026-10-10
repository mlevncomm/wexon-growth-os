@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem YEREL TEST: canli Supabase yerine prisma/dev.db (SQLite) kullanir. Canli veriye dokunmaz.
rem Giris bilgileri .env.development.local dosyasindadir (ADMIN_EMAIL / ADMIN_PASSWORD).
if not exist .env.development.local (
  echo .env.development.local yok. Once Claude ile yerel test ortamini kurun.
  pause
  exit /b 1
)
if not exist node_modules call npm install
set DATABASE_URL=file:./dev.db
set DIRECT_URL=file:./dev.db
call npx prisma generate --schema prisma/schema.sqlite.prisma
call npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate
echo.
echo Yerel test: http://127.0.0.1:3000/arama  (Chrome ile acin)
echo Giris sonrasi Platform ekraninda Wexon.dev icin "Destek icin gir" deyin.
echo Bu pencereyi kapatmayin.
echo.
start "" "http://127.0.0.1:3000/arama"
call npx next dev --hostname 127.0.0.1 --port 3000
if errorlevel 1 pause
