-- =========================================================================
-- MYSQL DATABASE SCHEMA (UPDATED)
-- Hệ thống Top System (TopEng Management System)
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `topsystemdb` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `topsystemdb`;

-- Disable foreign key checks during setup
SET FOREIGN_KEY_CHECKS = 0;

-- 1. DEPARTMENT TABLE
DROP TABLE IF EXISTS `Department`;
CREATE TABLE `Department` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `department_id` VARCHAR(36) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. POSITION TABLE
DROP TABLE IF EXISTS `Position`;
CREATE TABLE `Position` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `position_id` VARCHAR(36) NOT NULL UNIQUE,
    `position_name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CUSTOMER TABLE
DROP TABLE IF EXISTS `Customer`;
CREATE TABLE `Customer` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` VARCHAR(36) NOT NULL UNIQUE,
    `customer_name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. USER TABLE
DROP TABLE IF EXISTS `User`;
CREATE TABLE `User` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `department_id` VARCHAR(36) DEFAULT NULL,
    `position_id` VARCHAR(36) DEFAULT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `jandi_link` VARCHAR(255) DEFAULT NULL,
    `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(100) NOT NULL DEFAULT 'Staff',
    CONSTRAINT `fk_user_department` FOREIGN KEY (`department_id`) REFERENCES `Department` (`department_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_user_position` FOREIGN KEY (`position_id`) REFERENCES `Position` (`position_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. PROJECT TABLE
DROP TABLE IF EXISTS `Project`;
CREATE TABLE `Project` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(36) NOT NULL UNIQUE,
    `project_name` VARCHAR(255) NOT NULL,
    `project_description` TEXT DEFAULT NULL,
    `project_key` VARCHAR(10) DEFAULT NULL UNIQUE,
    `create_by` VARCHAR(36) DEFAULT NULL,
    `customer_id` VARCHAR(36) DEFAULT NULL,
    CONSTRAINT `fk_project_creator` FOREIGN KEY (`create_by`) REFERENCES `User` (`user_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_project_customer` FOREIGN KEY (`customer_id`) REFERENCES `Customer` (`customer_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PROJECT_MEMBER TABLE
DROP TABLE IF EXISTS `ProjectMember`;
CREATE TABLE `ProjectMember` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `role` VARCHAR(50) DEFAULT 'Member',
    UNIQUE KEY `unique_project_member` (`project_id`, `userId`),
    CONSTRAINT `fk_member_project` FOREIGN KEY (`project_id`) REFERENCES `Project` (`project_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_member_user` FOREIGN KEY (`userId`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6a. ISSUE TABLE (JIRA style)
DROP TABLE IF EXISTS `IssueComments`;
DROP TABLE IF EXISTS `IssueHistory`;
DROP TABLE IF EXISTS `IssueTag`;
DROP TABLE IF EXISTS `Issue`;
CREATE TABLE `Issue` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `issue_key` VARCHAR(50) NOT NULL UNIQUE,
    `project_id` VARCHAR(36) NOT NULL,
    `summary` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'TASK', -- STORY, TASK, BUG, EPIC
    `status` VARCHAR(50) NOT NULL DEFAULT 'TO_DO', -- BACKLOG, TO_DO, IN_PROGRESS, DONE
    `priority` VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    `reporter_id` VARCHAR(36) NOT NULL,
    `assignee_id` VARCHAR(36) DEFAULT NULL,
    `epic_id` INT DEFAULT NULL,
    `parent_id` INT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_issue_project` FOREIGN KEY (`project_id`) REFERENCES `Project` (`project_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_issue_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_issue_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `User` (`user_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_issue_parent` FOREIGN KEY (`parent_id`) REFERENCES `Issue` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_issue_epic` FOREIGN KEY (`epic_id`) REFERENCES `Issue` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6b. ISSUE COMMENTS TABLE
CREATE TABLE `IssueComments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `issue_id` INT NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_comments_issue` FOREIGN KEY (`issue_id`) REFERENCES `Issue` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6c. ISSUE HISTORY TABLE
CREATE TABLE `IssueHistory` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `issue_id` INT NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `field_changed` VARCHAR(50) NOT NULL,
    `old_value` TEXT DEFAULT NULL,
    `new_value` TEXT DEFAULT NULL,
    `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_history_issue` FOREIGN KEY (`issue_id`) REFERENCES `Issue` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_history_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TASK TABLE
DROP TABLE IF EXISTS `Task`;
CREATE TABLE `Task` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(36) NOT NULL UNIQUE,
    `project_id` VARCHAR(36) NOT NULL,
    `assignee_id` VARCHAR(36) DEFAULT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `priority` VARCHAR(50) NOT NULL DEFAULT 'Trung bình', -- Thấp, Trung bình, Cao
    `due_date` DATE DEFAULT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Todo', -- Todo, InProgress, Review, Done
    `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `update_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_task_project` FOREIGN KEY (`project_id`) REFERENCES `Project` (`project_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `User` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SUBTASK TABLE
DROP TABLE IF EXISTS `Subtask`;
CREATE TABLE `Subtask` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `task_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `is_done` BOOLEAN DEFAULT FALSE,
    CONSTRAINT `fk_subtask_task` FOREIGN KEY (`task_id`) REFERENCES `Task` (`task_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. NOTIFICYATIONS TABLE
DROP TABLE IF EXISTS `Notificyations`;
CREATE TABLE `Notificyations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT DEFAULT NULL,
    `link_url` TEXT DEFAULT NULL,
    `is_read` BOOLEAN DEFAULT FALSE,
    `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. ACTIVITY_LOGS TABLE
DROP TABLE IF EXISTS `ActivityLogs`;
CREATE TABLE `ActivityLogs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) DEFAULT NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `meta_data` JSON DEFAULT NULL,
    `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_log_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. DAILY REPORT TABLE
DROP TABLE IF EXISTS `DailyReport`;
CREATE TABLE `DailyReport` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `content` TEXT DEFAULT NULL,
    `file_url` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `project_id` VARCHAR(36) DEFAULT NULL,
    `status` VARCHAR(50) DEFAULT 'Pending',
    `comment` TEXT DEFAULT NULL,
    CONSTRAINT `fk_report_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_report_project` FOREIGN KEY (`project_id`) REFERENCES `Project` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. CHAT_ROOMS TABLE
DROP TABLE IF EXISTS `ChatRooms`;
CREATE TABLE `ChatRooms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_id` VARCHAR(36) NOT NULL UNIQUE,
    `type` VARCHAR(50) NOT NULL DEFAULT 'project', -- global, project, direct
    `room_name` VARCHAR(255) DEFAULT NULL,
    `project_id` VARCHAR(36) DEFAULT NULL,
    `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_chatroom_project` FOREIGN KEY (`project_id`) REFERENCES `Project` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. CHAT_ROOM_MEMBER TABLE
DROP TABLE IF EXISTS `ChatRoomMember`;
CREATE TABLE `ChatRoomMember` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `join_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_read_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_room_member` (`room_id`, `user_id`),
    CONSTRAINT `fk_crm_chatroom` FOREIGN KEY (`room_id`) REFERENCES `ChatRooms` (`room_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_member_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. MESSAGES TABLE
DROP TABLE IF EXISTS `Messages`;
CREATE TABLE `Messages` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `message_id` VARCHAR(36) NOT NULL UNIQUE,
    `room_id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(36) NOT NULL,
    `is_edited` BOOLEAN DEFAULT FALSE,
    `content` TEXT NOT NULL,
    `last_content` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_msg_chatroom` FOREIGN KEY (`room_id`) REFERENCES `ChatRooms` (`room_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_msg_sender` FOREIGN KEY (`sender_id`) REFERENCES `User` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. MESSAGES_ATTACHMENT TABLE
DROP TABLE IF EXISTS `MessagesAttachment`;
CREATE TABLE `MessagesAttachment` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `message_id` VARCHAR(36) NOT NULL,
    `file_url` TEXT NOT NULL,
    `file_type` VARCHAR(100) DEFAULT NULL,
    CONSTRAINT `fk_attachment_message` FOREIGN KEY (`message_id`) REFERENCES `Messages` (`message_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
