const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import Customer model
const Customer = require('../models/Customer');

// Test customer credentials
const TEST_CUSTOMER = {
  email: 'dev.dobby1@gmail.com',
  password: 'Dobby@123', // Plain text password - will be hashed
  firstName: 'Dobby',
  lastName: 'Test',
  phone: '9999999001',
  role: 'customer',
  authProvider: 'local',
};

async function createTestCustomer() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ 
      email: TEST_CUSTOMER.email 
    });

    if (existingCustomer) {
      console.log('⚠️  Customer already exists!');
      console.log('\n📧 Email:', TEST_CUSTOMER.email);
      console.log('🔑 Password: Dobby@123');
      console.log('\n💡 You can use these credentials to login');
      
      // Update the password in case it was changed
      const hashedPassword = await bcrypt.hash(TEST_CUSTOMER.password, 10);
      existingCustomer.password = hashedPassword;
      await existingCustomer.save();
      console.log('✅ Password updated successfully');
      
      await mongoose.connection.close();
      return;
    }

    // Hash the password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(TEST_CUSTOMER.password, 10);

    // Create new customer
    console.log('👤 Creating test customer...');
    const customer = await Customer.create({
      ...TEST_CUSTOMER,
      password: hashedPassword,
    });

    console.log('\n✅ Test Customer Created Successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:    ', TEST_CUSTOMER.email);
    console.log('🔑 Password: ', TEST_CUSTOMER.password);
    console.log('👤 Name:     ', `${TEST_CUSTOMER.firstName} ${TEST_CUSTOMER.lastName}`);
    console.log('📱 Phone:    ', TEST_CUSTOMER.phone);
    console.log('═══════════════════════════════════════\n');
    console.log('💡 Use these credentials to login to the app');

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error creating test customer:', error.message);
    if (error.code === 11000) {
      console.log('\n⚠️  This email is already registered');
      console.log('📧 Email:', TEST_CUSTOMER.email);
      console.log('🔑 Password: Dobby@123');
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
console.log('\n🚀 Starting Test Customer Creation Script...\n');
createTestCustomer();
