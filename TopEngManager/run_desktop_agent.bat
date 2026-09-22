@echo off
chcp 65001 >nul
title TOPV Desktop Spotlight Agent (Port 20188)
color 0A

echo =====================================================================
echo    🌟 TOPV DESKTOP SPOTLIGHT AGENT - TRỢ LÝ HƯỚNG DẪN WINDOWS
echo =====================================================================
echo [INFO] Đang khởi chạy Desktop Agent trên cổng 20188...
echo [INFO] Agent sẽ giữ kết nối với Web TOPVSystem để chiếu đèn hướng dẫn.
echo.

python desktop_agent\server.py

pause
