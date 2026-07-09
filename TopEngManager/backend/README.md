# Node.js Express Backend for TopEngManager

Dịch vụ Backend viết bằng Node.js & Express, kết nối đến cơ sở dữ liệu MySQL và xử lý toàn bộ logic nghiệp vụ, xác thực và phân quyền cho hệ thống.

## Cấu trúc thư mục
```
backend/
├── config/
│   └── db.js            # Khởi tạo Connection Pool kết nối MySQL
├── controllers/         # Các Controller xử lý nghiệp vụ theo mô-đun
│   ├── authController.js
│   ├── chatController.js
│   ├── documentController.js
│   ├── issueController.js
│   ├── notificationController.js
│   ├── projectController.js
│   └── taskController.js
├── middlewares/         # Middleware trung gian (xử lý lỗi, xác thực...)
│   └── errorMiddleware.js
├── routes/              # Định nghĩa router liên kết endpoint với controller
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   ├── documentRoutes.js
│   ├── issueRoutes.js
│   ├── notificationRoutes.js
│   ├── projectRoutes.js
│   └── taskRoutes.js
├── .env                 # Cấu hình môi trường (cổng chạy, thông tin MySQL)
├── package.json
└── server.js            # Điểm khởi đầu của ứng dụng Express
```

## Cách chạy máy chủ Backend

1. **Cài đặt thư viện**:
   Di chuyển vào thư mục backend và chạy lệnh:
   ```bash
   npm install
   ```

2. **Cấu hình môi trường**:
   Mở tệp `.env` và thiết lập các thông số cơ sở dữ liệu MySQL của bạn:
   ```env
   PORT=5000
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=your_username
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=topsystemdb
   ```

3. **Khởi động server**:
   * Chạy chế độ phát triển (Tự động tải lại khi sửa code):
     ```bash
     npm run dev
     ```
   * Chạy chế độ production:
     ```bash
     npm run start
     ```

Dịch vụ Backend Express sẽ lắng nghe mặc định tại địa chỉ `http://localhost:5000` và Next.js BFF sẽ tự động chuyển hướng mọi yêu cầu `/api/db` đến dịch vụ này.
