const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lostandfound');
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'Ammar@gmail.com' });
    if (!adminExists) {
      const admin = new User({
        name: 'Ammar',
        email: 'Ammar@gmail.com',
        password: 'Ammar123',
        phone: '03325400771',
        role: 'admin'
      });
      await admin.save();
      console.log('Admin user created successfully');
      console.log('Email: Ammar@gmail.com');
      console.log('Password: Ammar123');
    } else {
      console.log('Admin user already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();