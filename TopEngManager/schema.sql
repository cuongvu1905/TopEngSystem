-- =========================================================================
-- MYSQL DATABASE SCHEMA
-- Hệ thống Quản lý Doanh nghiệp (Enterprise Management System - MySQL Version)
-- =========================================================================

-- Disable foreign key checks during setup
SET FOREIGN_KEY_CHECKS = 0;

-- 1. ROLES TABLE
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS TABLE
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` VARCHAR(36) PRIMARY KEY, -- Using UUID strings
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role_id` INT DEFAULT NULL,
    `color` VARCHAR(7) DEFAULT '#1E40AF',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PROJECTS TABLE
DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
    `id` VARCHAR(36) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Khởi tạo', -- Khởi tạo, Lập kế hoạch, Thực thi, Giám sát, Kết thúc
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `created_by` VARCHAR(36) DEFAULT NULL,
    `is_public` BOOLEAN DEFAULT FALSE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_projects_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. PROJECT_MEMBERS TABLE
DROP TABLE IF EXISTS `project_members`;
CREATE TABLE `project_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `project_role` VARCHAR(50) NOT NULL DEFAULT 'Member', -- PM, Member
    `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_project_user` (`project_id`, `user_id`),
    CONSTRAINT `fk_members_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. PROJECT_ISSUES TABLE
DROP TABLE IF EXISTS `project_issues`;
CREATE TABLE `project_issues` (
    `id` VARCHAR(36) PRIMARY KEY,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Open', -- Open, InProgress, Resolved, Closed
    `reported_by` VARCHAR(36) NOT NULL,
    `report_url` VARCHAR(255) DEFAULT NULL, -- Link báo cáo
    `tag_team` BOOLEAN DEFAULT FALSE, -- Tag cả nhóm dự án
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_issues_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_issues_user` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PROJECT_ISSUE_TAGS TABLE (Members tagged in an issue)
DROP TABLE IF EXISTS `project_issue_tags`;
CREATE TABLE `project_issue_tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `issue_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    UNIQUE KEY `unique_issue_tagged_user` (`issue_id`, `user_id`),
    CONSTRAINT `fk_issue_tags_issue` FOREIGN KEY (`issue_id`) REFERENCES `project_issues` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_issue_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TASKS TABLE
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
    `id` VARCHAR(36) PRIMARY KEY,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `assignee_id` VARCHAR(36) DEFAULT NULL,
    `priority` VARCHAR(50) NOT NULL DEFAULT 'Trung bình', -- Thấp, Trung bình, Cao
    `status` VARCHAR(50) NOT NULL DEFAULT 'Todo', -- Todo, InProgress, Review, Done
    `due_date` DATE DEFAULT NULL,
    `created_by` VARCHAR(36) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_tasks_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tasks_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tasks_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SUBTASKS TABLE
DROP TABLE IF EXISTS `subtasks`;
CREATE TABLE `subtasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `is_done` BOOLEAN DEFAULT FALSE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_subtasks_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TASK_COMMENTS TABLE
DROP TABLE IF EXISTS `task_comments`;
CREATE TABLE `task_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_comments_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TASK_CHATS TABLE (Direct chat within task)
DROP TABLE IF EXISTS `task_chats`;
CREATE TABLE `task_chats` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_task_chats_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_chats_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. CHAT_ROOMS TABLE
DROP TABLE IF EXISTS `chat_rooms`;
CREATE TABLE `chat_rooms` (
    `id` VARCHAR(36) PRIMARY KEY,
    `type` VARCHAR(50) NOT NULL DEFAULT 'project', -- global, project, direct
    `name` VARCHAR(255) DEFAULT NULL,
    `project_id` VARCHAR(36) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_rooms_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. CHAT_ROOM_MEMBERS TABLE
DROP TABLE IF EXISTS `chat_room_members`;
CREATE TABLE `chat_room_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `last_read_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_room_user` (`room_id`, `user_id`),
    CONSTRAINT `fk_crm_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. MESSAGES TABLE
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
    `id` VARCHAR(36) PRIMARY KEY,
    `room_id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `is_edited` BOOLEAN DEFAULT FALSE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_messages_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. MESSAGE_ATTACHMENTS TABLE
DROP TABLE IF EXISTS `message_attachments`;
CREATE TABLE `message_attachments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `message_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) DEFAULT NULL,
    CONSTRAINT `fk_attachments_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. DOCUMENT_CATEGORIES TABLE
DROP TABLE IF EXISTS `document_categories`;
CREATE TABLE `document_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `type` VARCHAR(50) NOT NULL -- training, general, project_lifecycle
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. DOCUMENTS TABLE
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
    `id` VARCHAR(36) PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `category_id` INT DEFAULT NULL,
    `project_id` VARCHAR(36) DEFAULT NULL,
    `uploaded_by` VARCHAR(36) DEFAULT NULL,
    `project_phase` VARCHAR(50) DEFAULT NULL, -- Khởi tạo, Lập kế hoạch, Thực thi, Giám sát, Kết thúc
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_docs_category` FOREIGN KEY (`category_id`) REFERENCES `document_categories` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_docs_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_docs_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. DOCUMENT_VERSIONS TABLE
DROP TABLE IF EXISTS `document_versions`;
CREATE TABLE `document_versions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `document_id` VARCHAR(36) NOT NULL,
    `version_number` INT NOT NULL,
    `file_url` VARCHAR(255) NOT NULL,
    `uploaded_by` VARCHAR(36) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_versions_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_versions_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. ACTIVITY_LOGS TABLE (Audit Trail)
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) DEFAULT NULL,
    `action_type` VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, UPLOAD, etc.
    `entity_type` VARCHAR(50) NOT NULL, -- Project, Task, Document, User, etc.
    `entity_id` VARCHAR(36) DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `metadata` JSON DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. NOTIFICATIONS TABLE
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT DEFAULT NULL,
    `link_url` VARCHAR(255) DEFAULT NULL,
    `is_read` BOOLEAN DEFAULT FALSE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


-- =========================================================================
-- SEED INITIAL DATA
-- =========================================================================

-- Seed Roles
INSERT INTO `roles` (`id`, `name`, `description`) VALUES 
(1, 'Quản trị viên (Admin)', 'Toàn quyền cấu hình hệ thống, quản lý người dùng và nhật ký hệ thống'),
(2, 'Nhân sự (HR)', 'Quản lý người dùng, phân quyền, tra cứu dữ liệu nhân sự và xem công việc'),
(3, 'Nhân viên (Staff)', 'Xem dự án tham gia, thực hiện công việc được giao, đăng issue dự án'),
(4, 'Leader/Part Leader', 'Quản lý dự án, giao việc, giám sát tiến độ công việc và duyệt công việc'),
(5, 'Kinh doanh (Sales)', 'Tạo dự án mới, lập kế hoạch dự án, xóa dự án và theo dõi tiến độ'),
(6, 'Ban điều hành (BOD)', 'Xem tiến độ tất cả dự án, thêm/xóa/sửa dự án, xóa/chỉnh sửa công việc');

-- Seed Users
-- Passwords are hashed using md5 or bcrypt, for simplicity we store a placeholder hash (e.g. hashed version of '123456')
-- 'e10adc3949ba59abbe56e057f20f883e' is MD5 for '123456'
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role_id`, `color`, `created_at`) VALUES
('usr-admin', 'Alice Nguyễn (Admin)', 'alice.nguyen@company.com', 'e10adc3949ba59abbe56e057f20f883e', 1, '#D97706', NOW()),
('usr-hr', 'Trần Nhân Sự (HR)', 'hr.tran@company.com', 'e10adc3949ba59abbe56e057f20f883e', 2, '#8B5CF6', NOW()),
('usr-member1', 'Lê Nhân Viên 1 (Staff)', 'charlie.le@company.com', 'e10adc3949ba59abbe56e057f20f883e', 3, '#10B981', NOW()),
('usr-member2', 'Phạm Nhân Viên 2 (Staff)', 'david.pham@company.com', 'e10adc3949ba59abbe56e057f20f883e', 3, '#EC4899', NOW()),
('usr-pm', 'Trần Leader (Leader)', 'leader.tran@company.com', 'e10adc3949ba59abbe56e057f20f883e', 4, '#1E40AF', NOW()),
('usr-sales', 'Vũ Kinh Doanh (Sales)', 'sales.vu@company.com', 'e10adc3949ba59abbe56e057f20f883e', 5, '#EF4444', NOW()),
('usr-bod', 'Nguyễn Điều Hành (BOD)', 'bod.nguyen@company.com', 'e10adc3949ba59abbe56e057f20f883e', 6, '#10B981', NOW());

-- Seed Document Categories
INSERT INTO `document_categories` (`id`, `name`, `type`) VALUES
(1, 'Tài liệu đào tạo', 'training'),
(2, 'Tài liệu chung', 'general'),
(3, 'Tài liệu vòng đời dự án', 'project_lifecycle');

-- Seed Chat Rooms
INSERT INTO `chat_rooms` (`id`, `type`, `name`, `project_id`, `created_at`) VALUES
('room-global', 'global', '💬 Kênh thảo luận toàn công ty', NULL, NOW());
