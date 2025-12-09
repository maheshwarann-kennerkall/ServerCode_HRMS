import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // For large data uploads
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'HRMS Service is running',
    timestamp: new Date().toISOString(),
    service: 'HRMSService',
    port: PORT
  });
});

// Routes
app.use('/api', router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('HRMS Service Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found in HRMS Service`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HRMS Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

export default app;