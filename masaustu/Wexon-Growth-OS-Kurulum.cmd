@echo off
chcp 65001 >nul
title Wexon Growth OS - Kurulum
rem Kurulumu bu Windows kullanicisinda calistirir. Surucu adimlarinda ayrica yonetici izni istenir.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kurulum.ps1" %*
echo.
pause
