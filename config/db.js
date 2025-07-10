// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB:', process.env.MONGODB_URI.replace(/:.*@/, ':****@'));
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected to', conn.connection.db.namespace);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message, error.stack);
    process.exit(1);
  }
};

module.exports = connectDB;