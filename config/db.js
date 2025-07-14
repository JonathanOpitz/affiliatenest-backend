// config/db.js
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const dns = require('dns').promises;

const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is undefined');
    throw new Error('MONGODB_URI is not set');
  }

  if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
    console.log('Using cached MongoDB client');
    return cachedClient;
  }

  try {
    console.log('Attempting MongoDB connection with URI:', MONGODB_URI.replace(/:.*@/, ':****@'));
    if (MONGODB_URI.startsWith('mongodb+srv://')) {
      const parsedUrl = new URL(MONGODB_URI);
      const hostname = parsedUrl.hostname;
      console.log('Resolving DNS for:', hostname);
      const dnsResult = await dns.resolve(hostname).catch(err => {
        console.error('DNS resolution failed:', err.message);
        return null;
      });
      console.log('DNS resolved:', dnsResult || 'skipped');
    }

    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority',
    });
    await client.connect();
    console.log('MongoDB client connected');

    cachedClient = client;

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    console.log('Mongoose connected');
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error.message, error.stack);
    throw error;
  }
};

module.exports = { connectDB, cachedClient };