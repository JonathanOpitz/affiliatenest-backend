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
      console.log('Resolving SRV for:', hostname);
      try {
        const srvRecords = await dns.resolveSrv('_mongodb._tcp.' + hostname);
        console.log('SRV records resolved:', JSON.stringify(srvRecords));
        const aRecords = await dns.resolve(hostname).catch(() => []);
        console.log('A records resolved:', aRecords);
      } catch (err) {
        console.error('DNS resolution failed:', err.message, err.code);
      }
    } else {
      console.log('Using non-SRV URI, skipping DNS resolution');
    }

    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    await client.connect();
    console.log('MongoDB client connected:', client.options.servers);

    cachedClient = client;

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    console.log('Mongoose connected to database:', mongoose.connection.db.databaseName);
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error.message, error.stack);
    throw error;
  }
};

module.exports = { connectDB, cachedClient };
