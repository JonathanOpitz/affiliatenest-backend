// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

console.log('Server starting...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: !!process.env.JWT_SECRET,
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
  BASE_URL: process.env.BASE_URL,
});

// Middleware
app.set('trust proxy', 1);
app.use(cors({
  origin: ['http://localhost:3000', 'https://affiliatenest-dggekkgul-jonathans-projects-3fae278e.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json());

// Add version header
app.use((req, res, next) => {
  res.setHeader('X-App-Version', '1.0.7');
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({
    status: 'Server is running',
    version: '1.0.7'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({
    status: 'API is running',
    version: '1.0.7'
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/affiliate', require('./routes/affiliate'));

// Favicon endpoint
app.get('/favicon.ico', (req, res) => res.status(204).end());

module.exports = app;