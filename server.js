const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cache = require('memory-cache');
const AffiliateLink = require('./models/AffiliateLink');
const AffiliateProgram = require('./models/AffiliateProgram');
const { connectDB, cachedClient } = require('./config/db');

dotenv.config();
const app = express();
const port = process.env.PORT || 5004;

console.log('Server starting...');
console.log('Environment:', {
  MONGODB_URI: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:.*@/, ':****@') : 'undefined',
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: !!process.env.JWT_SECRET,
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
  BASE_URL: process.env.BASE_URL,
  PORT: port,
});

let connected = false;

const initDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await connectDB();
      connected = true;
      console.log('MongoDB connection established');
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  connected = false;
  console.error('MongoDB connection failed after retries');
};
initDB().catch(err => console.error('Initial MongoDB connection error:', err.message));

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

app.use((req, res, next) => {
  res.setHeader('X-App-Version', '1.0.14');
  next();
});

app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.json({
    status: 'Server is running',
    version: '1.0.14',
    mongodb: connected ? mongoose.connection.readyState : 'failed'
  });
});

app.get('/api/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({
    status: 'API is running',
    version: '1.0.14',
    mongodb: connected ? mongoose.connection.readyState : 'failed'
  });
});

app.get('/api/test', async (req, res) => {
  if (!connected || mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    console.log('Test endpoint hit');
    console.log('MongoDB connected:', mongoose.connection.readyState);
    console.log('Database:', mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected');
    res.json({
      status: 'ok',
      mongodb: mongoose.connection.readyState,
      database: mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected'
    });
  } catch (error) {
    console.error('Test endpoint error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/widget.js', async (req, res) => {
  if (!connected || mongoose.connection.readyState !== 1) {
    return res.status(500).send(`console.error("Database not connected");`);
  }
  const cacheKey = `widget_${req.query.link}`;
  const cachedScript = cache.get(cacheKey);
  if (cachedScript) {
    res.set('Content-Type', 'application/javascript');
    return res.send(cachedScript);
  }
  console.log('Widget request for link:', req.query.link);
  const { link } = req.query;
  try {
    if (!link) {
      console.log('No link provided');
      return res.status(400).send('console.error("No affiliate link provided");');
    }
    const affiliateLink = await AffiliateLink.findOne({ link });
    if (!affiliateLink) {
      console.log('Affiliate link not found:', link);
      return res.status(404).send('console.error("Invalid affiliate link");');
    }
    console.log('Found affiliate link:', affiliateLink);
    const program = await AffiliateProgram.findById(affiliateLink.programId);
    if (!program) {
      console.log('Program not found for ID:', affiliateLink.programId);
      return res.status(404).send('console.error("Affiliate program not found");');
    }
    console.log('Rendering widget for program:', program.name);
    const script = `
      (function() {
        try {
          const div = document.createElement('div');
          div.style.backgroundColor = '${program.widgetStyles.backgroundColor || '#ffffff'}';
          div.style.color = '${program.widgetStyles.textColor || '#1f2937'}';
          div.style.padding = '24px';
          div.style.borderRadius = '12px';
          div.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          div.style.maxWidth = '400px';
          div.style.margin = '0 auto';
          div.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
          div.style.lineHeight = '1.6';
          div.innerHTML = \`
            <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">Join ${program.name || 'Our Affiliate Program'}!</h3>
            <p style="font-size: 16px; margin-bottom: 16px;">Earn up to <span style="font-weight: 700; color: #2563eb;">${program.commissionRate || 20}% commission</span> for every successful referral!</p>
            <a href="https://affiliatenest-dggekkgul-jonathans-projects-3fae278e.vercel.app/signup?ref=${link}" style="display: inline-block; background-color: ${program.widgetStyles.buttonColor || '#2563eb'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#1d4ed8'" onmouseout="this.style.backgroundColor='${program.widgetStyles.buttonColor || '#2563eb'}'">Sign Up Now</a>
          \`;
          document.currentScript.parentNode.insertBefore(div, document.currentScript);
        } catch (e) {
          console.error('Widget render error:', e.message);
        }
      })();
    `;
    cache.put(cacheKey, script, 60 * 1000);
    res.set('Content-Type', 'application/javascript');
    res.send(script);
  } catch (error) {
    console.error('Widget endpoint error:', error.message, error.stack);
    res.status(500).send(`console.error("Widget error: ${error.message}");`);
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/affiliate', require('./routes/affiliate'));

app.get('/favicon.ico', (req, res) => res.status(204).end());

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;
