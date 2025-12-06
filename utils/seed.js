// const Admin = require('../models/adminLogin');
// const bcrypt = require('bcrypt')

// module.exports = async function seedAdmin() {
//   const email = process.env.ADMIN_EMAIL;
//   const password = process.env.ADMIN_PASSWORD;

//   const existing = await Admin.findOne({ email });
//   if (!existing) {
//     const hash = await bcrypt.hash(password, 10);
//     await Admin.create({ email, password: hash });
//     console.log(' Admin created with email:', email);
//   }
// };

const Admin = require('../models/adminLogin');
const bcrypt = require('bcrypt');

module.exports = async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const phone = process.env.ADMIN_PHONE;

  // Build query to check if admin exists by email or phone
  const query = {};
  if (email) query.email = email.toLowerCase();
  if (phone) query.phone = phone;
  // If both exist, check for either
  if (email && phone) {
    const existing = await Admin.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) return;
  } else {
    const existing = await Admin.findOne(query);
    if (existing) return;
  }

  // Ensure at least one identifier is provided
  if (!email && !phone) {
    console.error(' Error: ADMIN_EMAIL or ADMIN_PHONE must be set in environment variables');
    return;
  }

  if (!password) {
    console.error(' Error: ADMIN_PASSWORD must be set in environment variables');
    return;
  }

  // Create admin with available identifiers
  const adminData = {
    password: await bcrypt.hash(password, 10),
  };

  if (email) adminData.email = email.toLowerCase();
  if (phone) adminData.phone = phone;

  await Admin.create(adminData);
  
  const identifiers = [];
  if (email) identifiers.push(`email: ${email}`);
  if (phone) identifiers.push(`phone: ${phone}`);
  
  console.log(' Admin created with:', identifiers.join(', '));
};