require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./src/config/database');

async function seedAdmin() {
  await connectDB();

  const User = mongoose.connection.collection('users');

  const existing = await User.findOne({ email: 'samtech@gmail.com' });
  if (existing) {
    if (existing.role !== 'admin') {
      await User.updateOne({ _id: existing._id }, { $set: { role: 'admin' } });
      console.log('User already existed — promoted to admin.');
    } else {
      console.log('Admin already exists.');
    }
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('0246783840Sa@', 12);
  const referralCode = 'SAM' + Math.random().toString(36).substring(2, 6).toUpperCase();

  await User.insertOne({
    name: 'Sam Tech',
    email: 'samtech@gmail.com',
    password: hashedPassword,
    phoneNumber: '0246783840',
    role: 'admin',
    walletBalance: 0,
    referralCode,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Admin created successfully.');
  console.log('Email: samtech@gmail.com');
  console.log('Password: 0246783840Sa@');
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
