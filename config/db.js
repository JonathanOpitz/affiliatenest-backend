// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB:', process.env.MONGODB_URI.replace(/:.*@/, ':****@'));
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
    });
    console.log('MongoDB connected to', mongoose.connection.db.namespace);
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message, error.stack);
    throw error;
  }
};

module.exports = connectDB;