# Sò đồ Quan hệ Thực thể (Entity Relationship Diagram - ERD)

Tài liệu này mô tả cấu trúc các bảng và mối quan hệ giữa các thực thể trong cơ sở dữ liệu MySQL của hệ thống TOPVSystem (TopEng Manager).

## Biểu đồ ERD (Mermaid)

```mermaid
erDiagram
    user {
        int id PK
        string user_id UK
        string department_id FK
        string position_id FK
        string full_name
        string email UK
        string jandi_link
        string password
        string role
        string session_token
        string last_login_ip
        string last_login_ua
        datetime last_login_at
        datetime create_at
    }

    department {
        int id PK
        string department_id UK
        string name
        string parent_id FK
    }

    position {
        int id PK
        string position_id UK
        string position_name
    }

    customer {
        int id PK
        string customer_id UK
        string customer_name
        string address
        string tax_code
    }

    project {
        int id PK
        string project_id UK
        string project_name
        string project_description
        string project_key UK
        string create_by FK
        string customer_id FK
        string status
        string start_date
        string end_date
        string visibility
    }

    projectmember {
        int id PK
        string project_id FK
        string userId FK
        string role
        string status
    }

    task {
        int id PK
        string task_key UK
        string project_id FK
        string title
        string description
        string status
        string priority
        string assignee_id FK
        datetime due_date
        datetime created_at
        datetime updated_at
    }

    issue {
        int id PK
        string issue_key UK
        string project_id FK
        string summary
        string description
        string type
        string status
        string priority
        string reporter_id FK
        string assignee_id FK
        int epic_id FK
        int parent_id FK
        datetime created_at
        datetime updated_at
    }

    issuecomments {
        int id PK
        int issue_id FK
        string user_id FK
        string comment
        datetime created_at
    }

    issuehistory {
        int id PK
        int issue_id FK
        string user_id FK
        string field_changed
        string old_value
        string new_value
        datetime changed_at
    }

    chatrooms {
        int id PK
        string room_id UK
        string type
        string room_name
        string project_id FK
        datetime create_at
    }

    chatroommember {
        int id PK
        string user_id FK
        string room_id FK
        datetime join_at
        datetime last_read_at
    }

    messages {
        int id PK
        string message_id UK
        string room_id FK
        string sender_id FK
        boolean is_edited
        string content
        datetime create_at
    }

    dailyreport {
        int id PK
        string user_id FK
        string content
        string file_url
        string project_id FK
        string status
        string comment
        datetime created_at
    }

    notificyations {
        int id PK
        string user_id FK
        string title
        string content
        string link_url
        boolean is_read
        datetime create_at
    }

    activitylogs {
        int id PK
        string user_id FK
        string action_type
        string entity_type
        string description
        string meta_data
        datetime create_at
    }

    user }o--o| department : "thuộc bộ phận"
    user }o--o| position : "đảm nhiệm chức vụ"
    department }o--o| department : "bộ phận cha (cấp trên)"
    project }o--o| user : "tạo bởi"
    project }o--o| customer : "thuộc khách hàng"
    projectmember }o--|| project : "thành viên dự án"
    projectmember }o--|| user : "nhân viên tham gia"
    task }o--|| project : "thuộc dự án"
    task }o--o| user : "phân công cho"
    issue }o--|| project : "thuộc dự án"
    issue }o--|| user : "báo cáo bởi (reporter)"
    issue }o--o| user : "giao cho (assignee)"
    issue }o--o| issue : "thuộc Epic / Task cha"
    issuecomments }o--|| issue : "bình luận trong issue"
    issuecomments }o--|| user : "bình luận bởi"
    issuehistory }o--|| issue : "lịch sử của"
    issuehistory }o--|| user : "thay đổi bởi"
    chatrooms }o--o| project : "kênh chat của dự án"
    chatroommember }o--|| user : "thành viên phòng chat"
    chatroommember }o--|| chatrooms : "phòng chat tham gia"
    messages }o--|| chatrooms : "gửi trong phòng chat"
    messages }o--|| user : "người gửi"
    dailyreport }o--|| user : "báo cáo bởi"
    dailyreport }o--o| project : "cho dự án"
    notificyations }o--|| user : "thông báo đến"
    activitylogs }o--o| user : "ghi chép hoạt động của"
```

## Chi tiết các Thực thể (Tables)

1. **user (Nhân viên / Tài khoản)**: Lưu trữ thông tin tài khoản nhân viên, phân quyền hệ thống và cơ cấu bộ phận.
2. **department (Phòng ban / Part)**: Tổ chức phân cấp phòng ban (Team -> Part).
3. **position (Chức vụ)**: Các vị trí chuyên môn của nhân sự.
4. **customer (Khách hàng)**: Đối tác liên quan đến dự án.
5. **project (Dự án)**: Thông tin cốt lõi về dự án công ty.
6. **projectmember (Thành viên Dự án)**: Bảng liên kết quản lý nhân viên tham gia vào dự án với vai trò tương ứng.
7. **task (Công việc)**: Các task cơ bản trong dự án.
8. **issue (Sự vụ / Task Jira style)**: Các yêu cầu, lỗi, Epic hoặc task chi tiết hỗ trợ quản lý quy trình.
9. **issuecomments (Bình luận)**: Trao đổi trong các sự vụ.
10. **issuehistory (Lịch sử thay đổi)**: Audit log theo dõi thay đổi thông tin của issue.
11. **chatrooms (Phòng chat)**: Các cuộc hội thoại nhóm hoặc cá nhân (tích hợp).
12. **chatroommember (Thành viên Phòng chat)**: Danh sách người dùng tham gia các phòng chat.
13. **messages (Tin nhắn)**: Nội dung tin nhắn chat.
14. **dailyreport (Báo cáo ngày)**: Báo cáo công việc hàng ngày gửi cho Team Leader duyệt.
15. **notificyations (Thông báo)**: Trung tâm thông báo đẩy cho người dùng.
16. **activitylogs (Nhật ký hệ thống)**: Log toàn bộ hành động bảo mật, đăng nhập, thay đổi nhân sự.
