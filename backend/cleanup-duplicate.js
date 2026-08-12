const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function cleanupDuplicateUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_management');
    console.log('Connected to MongoDB');

    // Find and delete the duplicate user
    const existingUser = await User.findOne({ email: 'ayush199816@gmail.com' });
    if (existingUser) {
      console.log('Found existing user:', {
        id: existingUser._id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role
      });
      
      await User.findByIdAndDelete(existingUser._id);
      console.log('Successfully deleted existing user');
    } else {
      console.log('No existing user found with email ayush199816@gmail.com');
    }

    // Show remaining users for verification
    const allUsers = await User.find({});
    console.log('\nRemaining users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

cleanupDuplicateUser();
