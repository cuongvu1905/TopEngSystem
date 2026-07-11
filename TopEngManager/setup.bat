@echo off
chcp 65001 > nul
title Thiết lập dự án TopEng Manager
echo ====================================================================
echo             THIẾT LẬP DỰ ÁN TOPENG MANAGER
echo ====================================================================
echo.
echo [*] Đang cài đặt các thư viện cho Frontend (Thư mục gốc)...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [LỖI] Không thể cài đặt các thư viện Frontend.
    echo Vui lòng đảm bảo rằng Node.js đã được cài đặt và cấu hình trong PATH.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Đã cài đặt thư viện Frontend thành công.
echo.
echo [*] Đang cài đặt các thư viện cho Backend (Thư mục /backend)...
cd backend
call npm install
if %ERRORLEVEL% neq 0 (
    echo [LỖI] Không thể cài đặt các thư viện Backend.
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..
echo [OK] Đã cài đặt thư viện Backend thành công.
echo.
echo ====================================================================
echo                     THIẾT LẬP THÀNH CÔNG!
echo ====================================================================
echo Các bước tiếp theo để khởi chạy:
echo 1. Hãy cài đặt MySQL Server (nếu chưa có) và đảm bảo cổng 3306 hoạt động.
echo 2. Import file 'Top_Sys.sql' và 'insertdemodata.sql' vào MySQL của bạn.
echo 3. Cập nhật mật khẩu MySQL của bạn trong file 'backend/.env' (dòng MYSQL_PASSWORD).
echo 4. Chạy dự án:
echo    - Click đúp vào file 'run_backend.bat' để chạy Backend Server.
echo    - Click đúp vào file 'run_frontend.bat' để chạy Frontend Next.js.
echo ====================================================================
pause
