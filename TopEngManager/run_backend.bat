@echo off
chcp 65001 > nul
title TopEng Manager - Backend (Express.js)
echo ====================================================================
echo             ĐANG KHỞI CHẠY BACKEND EXPRESS.JS...
echo ====================================================================
echo.
cd backend
call npm run dev
cd ..
pause
