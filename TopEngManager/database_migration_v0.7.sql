-- ====================================================================
--            CẬP NHẬT CƠ SỞ DỮ LIỆU TOPENG SYSTEM - PHIÊN BẢN v0.7
-- ====================================================================
-- Hướng dẫn:
-- Nếu bạn đang nâng cấp từ phiên bản cũ (v0.6 trở xuống) lên phiên bản v0.7,
-- vui lòng kết nối vào MySQL Server của bạn và chạy các câu lệnh dưới đây để 
-- thêm các trường thông tin cần thiết cho tính năng Quản lý khách hàng mới.
-- ====================================================================

-- 1. Bổ sung cột Địa chỉ (address) và Mã số thuế (tax_code) vào bảng Customer
ALTER TABLE `Customer` ADD COLUMN `address` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `Customer` ADD COLUMN `tax_code` VARCHAR(50) DEFAULT NULL;

-- 2. Cập nhật lại client Prisma (chạy lệnh này trong thư mục /backend của máy chủ)
-- Lệnh: npx prisma generate
