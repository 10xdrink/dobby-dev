const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Student = require('../models/Student');
const Address = require('../models/Address');

// Student email to seed addresses for
const STUDENT_EMAIL = 'minto71922@gmail.com';

// Sample addresses
const ADDRESSES = [
  {
    firstName: 'Minto',
    lastName: 'Student',
    email: STUDENT_EMAIL,
    phone: '+919876543210',
    addressLine: 'A-101, Sunshine Apartments, MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    zipCode: '400001',
    type: 'shipping',
    isDefault: true,
  },
  {
    firstName: 'Minto',
    lastName: 'Student',
    email: STUDENT_EMAIL,
    phone: '+919876543210',
    addressLine: 'Plot 45, Green Valley Society, Sector 12',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    zipCode: '560001',
    type: 'shipping',
    isDefault: false,
  },
  {
    firstName: 'Minto',
    lastName: 'Student',
    email: STUDENT_EMAIL,
    phone: '+919876543210',
    addressLine: '123, Park Street, Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    zipCode: '110001',
    type: 'billing',
    isDefault: false,
  },
  {
    firstName: 'Minto',
    lastName: 'Student',
    email: STUDENT_EMAIL,
    phone: '+919876543211',
    addressLine: 'B-204, Ocean View Residency, Marine Drive',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    zipCode: '400020',
    type: 'shipping',
    isDefault: false,
  },
];

async function seedStudentAddresses() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find student by email
    console.log(`\n🔍 Finding student: ${STUDENT_EMAIL}`);
    const student = await Student.findOne({ email: STUDENT_EMAIL });

    if (!student) {
      console.log('❌ Student not found!');
      console.log(`\n💡 Create this student first or use a different email.`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found student: ${student.firstName} ${student.lastName}`);
    console.log(`📝 Student ID: ${student._id}`);
    console.log(`📧 Email: ${student.email}`);
    console.log(`📱 Phone: ${student.phone}`);

    // Delete existing addresses for this student
    console.log('\n🗑️  Clearing existing addresses...');
    const deleteResult = await Address.deleteMany({ 
      customer: student._id,
      customerModel: 'Student'
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing addresses`);

    // Create new addresses
    console.log('\n📍 Creating addresses...');
    const createdAddresses = [];
    
    for (let i = 0; i < ADDRESSES.length; i++) {
      const addressData = {
        ...ADDRESSES[i],
        customer: student._id,
        customerModel: 'Student',
      };

      const address = await Address.create(addressData);
      createdAddresses.push(address);
      
      const defaultLabel = address.isDefault ? ' (DEFAULT)' : '';
      const typeLabel = address.type === 'billing' ? '💳 Billing' : '📦 Shipping';
      console.log(`  ${i + 1}. ${typeLabel}${defaultLabel}: ${address.city}, ${address.state}`);
    }

    console.log('\n✅ Successfully created addresses!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 Student Email:', STUDENT_EMAIL);
    console.log('📝 Total Addresses:', createdAddresses.length);
    console.log('═══════════════════════════════════════\n');
    
    console.log('📍 Address Summary:');
    createdAddresses.forEach((addr, idx) => {
      console.log(`\n${idx + 1}. ${addr.type.toUpperCase()}${addr.isDefault ? ' ⭐ DEFAULT' : ''}`);
      console.log(`   ${addr.addressLine}`);
      console.log(`   ${addr.city}, ${addr.state} ${addr.zipCode}`);
      console.log(`   ${addr.country}`);
    });

    console.log('\n\n💡 Now login as this student in the app to see these addresses!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('\n❌ Error seeding addresses:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
console.log('\n🚀 Starting Student Address Seeding Script...\n');
seedStudentAddresses();
