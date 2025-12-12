const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MongoDB connection failed: MONGO_URI is not set');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI); 
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
