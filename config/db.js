// config/db.js
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;

const connectDB = async () => {
  if (cachedClient && cachedClient.topology.isConnected()) {
    console.log('Using cached MongoDB client');
    return cachedClient;
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 45000,
    });
    await client.connect();
    console.log('MongoDB client connected');
    cachedClient = client;

    // Set up Mongoose connection using the same client
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
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