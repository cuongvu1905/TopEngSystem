-- =========================================================================
-- MYSQL DEMO DATA INSERTION SCRIPT
-- Database: topsystemdb
-- =========================================================================

USE `topsystemdb`;

-- Disable foreign key checks during import
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (optional, but ensures fresh insert)
TRUNCATE TABLE `MessagesAttachment`;
TRUNCATE TABLE `Messages`;
TRUNCATE TABLE `ChatRoomMember`;
TRUNCATE TABLE `ChatRooms`;
TRUNCATE TABLE `IssueComments`;
TRUNCATE TABLE `IssueHistory`;
TRUNCATE TABLE `ActivityLogs`;
TRUNCATE TABLE `Notificyations`;
TRUNCATE TABLE `DailyReport`;
TRUNCATE TABLE `Subtask`;
TRUNCATE TABLE `Task`;
TRUNCATE TABLE `ProjectMember`;
TRUNCATE TABLE `Project`;
TRUNCATE TABLE `User`;
TRUNCATE TABLE `Customer`;
TRUNCATE TABLE `Position`;
TRUNCATE TABLE `Department`;

-- 1. INSERT DEPARTMENTS
INSERT INTO `Department` (`department_id`, `name`) VALUES
('dept-dev', 'Phòng Phát triển Phần mềm (R&D)'),
('dept-hr', 'Phòng Hành chính Nhân sự (HR)'),
('dept-sales', 'Phòng Kinh doanh (Sales)'),
('dept-mkt', 'Phòng Truyền thông Marketing'),
('dept-finance', 'Phòng Kế toán Tài chính');

-- 2. INSERT POSITIONS
INSERT INTO `Position` (`position_id`, `position_name`) VALUES
('pos-intern', 'Thực tập sinh (Intern)'),
('pos-staff', 'Nhân viên chính thức (Staff)'),
('pos-lead', 'Trưởng nhóm kỹ thuật (Technical Lead)'),
('pos-manager', 'Trưởng phòng (Manager)'),
('pos-director', 'Giám đốc bộ phận (Director)');

-- 3. INSERT USERS (3 Users with random/various Departments and Positions)
-- 'e10adc3949ba59abbe56e057f20f883e' is MD5 for '123456' (default password)
INSERT INTO `User` (`user_id`, `department_id`, `position_id`, `full_name`, `email`, `jandi_link`, `password`, `role`) VALUES
('usr-admin', 'dept-hr', 'pos-director', 'Alice Nguyễn (System Admin)', 'admin@company.com', 'https://jandi.com/connect/admin', 'e10adc3949ba59abbe56e057f20f883e', 'Quản trị viên (Admin)'),
('usr-john', 'dept-dev', 'pos-staff', 'John Doe (Developer)', 'john.doe@company.com', 'https://jandi.com/connect/john', 'e10adc3949ba59abbe56e057f20f883e', 'Nhân viên (Staff)'),
('usr-sarah', 'dept-sales', 'pos-lead', 'Sarah Smith (Sales Lead)', 'sarah.smith@company.com', 'https://jandi.com/connect/sarah', 'e10adc3949ba59abbe56e057f20f883e', 'Leader/Part Leader'),
('usr-david', 'dept-hr', 'pos-manager', 'David Miller (HR Manager)', 'david.miller@company.com', 'https://jandi.com/connect/david', 'e10adc3949ba59abbe56e057f20f883e', 'Quản trị viên (Admin)');

-- 4. INSERT CUSTOMERS
INSERT INTO `Customer` (`customer_id`, `customer_name`) VALUES
('cust-vng', 'Công ty Cổ phần VNG (VNG Corporation)'),
('cust-viettel', 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)');

-- 5. INSERT PROJECTS
INSERT INTO `Project` (`project_id`, `project_name`, `project_description`, `project_key`, `create_by`, `customer_id`) VALUES
('proj-crm', 'Hệ thống Quản lý Khách hàng CRM v1.0', 'Dự án phát triển phần mềm CRM phục vụ bộ phận kinh doanh chăm sóc khách hàng.', 'CRM', 'usr-sarah', 'cust-vng'),
('proj-ecommerce', 'Ứng dụng Mobile E-Commerce Viettel Pay', 'Xây dựng app mua sắm tích hợp cổng thanh toán trực tuyến.', 'PAY', 'usr-john', 'cust-viettel');

-- 6. INSERT PROJECT MEMBERS
INSERT INTO `ProjectMember` (`project_id`, `userId`, `role`) VALUES
('proj-crm', 'usr-john', 'Member'),
('proj-crm', 'usr-sarah', 'PM'),
('proj-ecommerce', 'usr-john', 'PM'),
('proj-ecommerce', 'usr-sarah', 'Member'),
('proj-ecommerce', 'usr-david', 'Member');

-- 7. INSERT TASKS
INSERT INTO `Task` (`task_id`, `project_id`, `assignee_id`, `title`, `description`, `priority`, `due_date`) VALUES
('task-db-design', 'proj-crm', 'usr-john', 'Thiết kế lược đồ cơ sở dữ liệu CRM', 'Thiết kế các bảng MySQL cho CRM và tạo mối quan hệ ràng buộc.', 'Cao', '2026-07-20'),
('task-api-dev', 'proj-crm', 'usr-john', 'Xây dựng API đăng nhập JWT', 'Viết API login, register, và phân quyền dựa trên JWT.', 'Trung bình', '2026-07-25'),
('task-ui-dashboard', 'proj-ecommerce', 'usr-sarah', 'Thiết kế UI màn hình Dashboard', 'Vẽ giao diện dashboard hiển thị biểu đồ trên Figma.', 'Thấp', '2026-08-01');

-- 8. INSERT SUBTASKS
INSERT INTO `Subtask` (`task_id`, `title`, `is_done`) VALUES
('task-db-design', 'Vẽ sơ đồ ERD chi tiết', 1),
('task-db-design', 'Viết file script SQL khởi tạo', 0),
('task-api-dev', 'Cài đặt passport-jwt', 0);

-- 9. INSERT NOTIFICATIONS
INSERT INTO `Notificyations` (`user_id`, `title`, `content`, `link_url`, `is_read`) VALUES
('usr-john', 'Dự án mới', 'Bạn vừa được thêm vào dự án Hệ thống Quản lý Khách hàng CRM.', '#projects', 0),
('usr-sarah', 'Công việc mới được giao', 'Bạn có công việc mới: Thiết kế UI màn hình Dashboard.', '#tasks', 0);

-- 10. INSERT CHAT ROOMS
INSERT INTO `ChatRooms` (`room_id`, `type`, `room_name`, `project_id`) VALUES
('room-crm', 'project', '📂 Nhóm thảo luận CRM', 'proj-crm'),
('room-ecommerce', 'project', '📂 Nhóm thảo luận E-Commerce', 'proj-ecommerce');

-- 11. INSERT CHAT ROOM MEMBERS
INSERT INTO `ChatRoomMember` (`user_id`, `room_id`) VALUES
('usr-john', 'room-crm'),
('usr-sarah', 'room-crm'),
('usr-john', 'room-ecommerce'),
('usr-sarah', 'room-ecommerce'),
('usr-david', 'room-ecommerce');

-- 12. INSERT MESSAGES
INSERT INTO `Messages` (`message_id`, `room_id`, `sender_id`, `content`, `is_edited`) VALUES
('msg-1', 'room-crm', 'usr-sarah', 'Chào cả nhà, chúng ta bắt đầu dự án CRM nhé!', 0),
('msg-2', 'room-crm', 'usr-john', 'Chào chị, em đang tiến hành thiết kế Database rồi ạ.', 0);

-- 13. INSERT JIRA STYLE ISSUES
INSERT INTO `Issue` (`id`, `issue_key`, `project_id`, `summary`, `description`, `type`, `status`, `priority`, `reporter_id`, `assignee_id`) VALUES
(1, 'CRM-I101', 'proj-crm', 'Thiết kế giao diện Dashboard tổng quan', 'Xây dựng layout Dashboard hiển thị các biểu đồ doanh thu và thống kê khách hàng.', 'STORY', 'DONE', 'HIGH', 'usr-sarah', 'usr-john'),
(2, 'CRM-I102', 'proj-crm', 'Lỗi kết nối API đồng bộ dữ liệu', 'API trả về status 500 khi đồng bộ lượng lớn khách hàng từ tệp Excel.', 'BUG', 'IN_PROGRESS', 'CRITICAL', 'usr-john', 'usr-john'),
(3, 'PAY-I101', 'proj-ecommerce', 'Tích hợp cổng thanh toán Viettel Pay SDK', 'Tải SDK và cấu hình các endpoints callback giao dịch.', 'TASK', 'TO_DO', 'MEDIUM', 'usr-john', 'usr-sarah');

-- 14. INSERT ISSUE COMMENTS
INSERT INTO `IssueComments` (`issue_id`, `user_id`, `content`) VALUES
(1, 'usr-john', 'Em đã thiết kế xong Figma và code React cơ bản rồi ạ.'),
(2, 'usr-sarah', 'Hãy kiểm tra lại bộ nhớ đệm và phân trang khi đọc file Excel nhé!');

-- 15. INSERT ISSUE HISTORY
INSERT INTO `IssueHistory` (`issue_id`, `user_id`, `field_changed`, `old_value`, `new_value`) VALUES
(1, 'usr-john', 'status', 'TO_DO', 'DONE'),
(2, 'usr-john', 'status', 'TO_DO', 'IN_PROGRESS');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
