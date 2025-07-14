// config/db.js
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

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
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 45000,
    });
    await client.connect();
    console.log('MongoDB client connected');

    cachedClient = client;

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 45000,
    });
    console.log('Mongoose connected');
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error.message, error.stack);
    throw error;
  }
};

module.exports = { connectDB, cachedClient };