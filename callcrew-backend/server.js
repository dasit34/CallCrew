require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDatabase = require('./config/database');

const FRONTEND_OUT = path.join(__dirname, '..', 'callcrew-dashboard', 'out');
const HAS_FRONTEND = fs.existsSync(FRONTEND_OUT);

// Import routes
const onboardingRoutes = require('./routes/onboarding');
const callsRoutes = require('./routes/calls');
const adminRoutes = require('./routes/admin');
const twilioVoiceWebhook = require('./webhooks/twilioVoice');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
// Use raw body parser for Twilio webhooks (they send form data)
app.use('/webhooks/twilio', bodyParser.urlencoded({ extended: false }));
// Use JSON parser for API routes
app.use('/api', bodyParser.json());
// Default parser for other routes
app.use(bodyParser.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Trust proxy for proper IP detection behind Railway/load balancers
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/admin', adminRoutes);

// Twilio Webhooks
app.use('/webhooks/twilio', twilioVoiceWebhook);

// Frontend: serve static Next.js export (landing, onboarding, dashboard) and SPA fallback
if (HAS_FRONTEND) {
  app.use(
    express.static(FRONTEND_OUT, {
      extensions: ['html'],
      fallthrough: true,
      index: 'index.html',
    })
  );
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path === '/health')
      return next();
    res.sendFile(path.join(FRONTEND_OUT, 'index.html'));
  });
  console.log('✅ Frontend build served from', FRONTEND_OUT);
} else {
  console.log('⚠️ Frontend not served: build not found at', FRONTEND_OUT);
  app.get('/', (req, res) => {
    res.json({
      name: 'CallCrew Backend API',
      version: '1.0.0',
      description: 'AI Phone Receptionist System',
      endpoints: { health: '/health', api: '/api', webhooks: '/webhooks/twilio' },
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Track database connection status
let dbConnected = false;

// Middleware to check database connection
app.use('/api', (req, res, next) => {
  if (!dbConnected && !req.path.includes('/health')) {
    // Allow requests but warn in response if DB is down
    req.dbConnected = false;
  } else {
    req.dbConnected = true;
  }
  next();
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    const dbConnection = await connectDatabase();
    dbConnected = !!dbConnection;
    
    if (dbConnected) {
      console.log('✅ Database connected successfully');
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎉 CallCrew Backend Server Started!                     ║
║                                                           ║
║   📍 Local:    http://localhost:${PORT}                      ║
║   🌍 Network:  http://0.0.0.0:${PORT}                        ║
║                                                           ║
║   📚 API Docs: http://localhost:${PORT}                      ║
║   ❤️  Health:   http://localhost:${PORT}/health              ║
║                                                           ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(15)}                   ║
║   Database:    ${dbConnected ? '✅ Connected      ' : '❌ Not Connected  '}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
