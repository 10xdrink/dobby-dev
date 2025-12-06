const mongoose = require('mongoose');
require('dotenv').config();

async function fixAddressIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Address = mongoose.connection.collection('addresses');

    // Drop the old problematic index
    try {
      await Address.dropIndex('customer_1_type_1_isDefault_1');
      console.log('✅ Dropped old customer_type_isDefault index');
    } catch (error) {
      if (error.code === 27) {
        console.log('⚠️  Index does not exist, skipping...');
      } else {
        console.log('⚠️  Could not drop index:', error.message);
      }
    }

    // The new indexes will be created automatically when the server starts
    console.log('✅ Done! New indexes will be created on server restart.');
    console.log('👉 Please restart your backend server now.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAddressIndexes();
