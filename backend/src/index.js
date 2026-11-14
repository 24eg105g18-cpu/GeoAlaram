const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, getDBStatus } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const alarmRoutes = require('./routes/alarmRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      // or if origin matches allowed frontend
      if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev to avoid CORS friction
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the GeoAlarm API',
    documentation: '/api/health',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      alarms: '/api/alarms',
      health: '/api/health',
    },
  });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.status(200).json({
    status: 'ok',
    service: 'GeoAlarm Backend API',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/alarms', alarmRoutes);

// 404 Handler for undefined routes
app.use(notFound);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server function
let serverInstance;
const startServer = async () => {
  await connectDB();
  return new Promise((resolve) => {
    serverInstance = app.listen(PORT, () => {
      console.log(`[GeoAlarm] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[GeoAlarm] Health check URL: http://localhost:${PORT}/api/health`);
      resolve(serverInstance);
    });
  });
};

// Start automatically when run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
