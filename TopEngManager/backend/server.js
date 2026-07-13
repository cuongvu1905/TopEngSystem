const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { errorHandler } = require('./middlewares/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const issueRoutes = require('./routes/issueRoutes');
const chatRoutes = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dailyReportRoutes = require('./routes/dailyReportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middlewares
// Configure restrictive CORS policy for production environment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'Chính sách CORS của máy chủ không cho phép truy cập từ Origin được cung cấp.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow browser to download assets like uploaded images
}));
app.use(compression()); // Compress responses

// Configure basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // limit each IP to 1500 requests per windowMs
  message: { error: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Routes mapping
app.use('/api', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', issueRoutes);
app.use('/api', chatRoutes);
app.use('/api', documentRoutes);
app.use('/api', notificationRoutes);
app.use('/api', dailyReportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'topeng-manager-backend' });
});

// Error handling middleware
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Server Node.js running successfully on http://localhost:${PORT}`);
});
