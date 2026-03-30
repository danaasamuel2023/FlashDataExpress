require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/database');

const app = express();

// Trust proxy (Render uses a reverse proxy)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// CORS must be before helmet so preflight OPTIONS requests get handled
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://flashdata.store',
  'https://www.flashdata.store',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
}
app.use(cors({
  origin: allowedOrigins.filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
}));

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: { status: 'error', message: 'Too many requests. Please try again later.' }
});
app.use(limiter);

// Stricter rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { status: 'error', message: 'Too many attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'flash-data-express-api', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/user', require('./src/routes/user'));
app.use('/api/wallet', require('./src/routes/wallet'));
app.use('/api/purchase', require('./src/routes/purchase'));
app.use('/api/store', require('./src/routes/store'));
app.use('/api/shop', require('./src/routes/storePublic'));
app.use('/api/subagent', require('./src/routes/subagent'));
app.use('/api/withdrawal', require('./src/routes/withdrawal'));
app.use('/api/referral', require('./src/routes/referral'));
app.use('/api/webhook', require('./src/routes/webhook'));
app.use('/api/admin', require('./src/routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Flash Data Express API running on port ${PORT}`);

  // Start background jobs
  const { startOrderStatusChecker } = require('./src/jobs/orderStatusChecker');
  startOrderStatusChecker();
});
