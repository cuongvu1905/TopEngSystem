const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middlewares
app.use(cors());
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
