const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'hospital_admin', 'doctor', 'assistant_doctor', 'nurse', 'pathologist', 'diagnostic', 'pharmacist', 'billing_staff', 'receptionist', 'accounts']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required']
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: function() { return this.role !== 'super_admin'; }
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: function() { 
      return ['doctor', 'assistant_doctor', 'nurse', 'pathologist', 'diagnostic', 'pharmacist', 'billing_staff'].includes(this.role);
    }
  },
  // Doctor specific fields
  specialities: [{
    type: String,
    required: function() { return this.role === 'doctor'; }
  }],
  education: [{
    degree: String,
    institution: String,
    year: String
  }],
  picture: {
    type: String,
    default: function() { return this.role === 'doctor' ? '' : null; }
  },
  otherHospitals: [{
    type: String
  }],
  emergencyNumber: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  address: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  opdFees: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },
  emergencyFees: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },
  commissionPercentage: {
    type: Number,
    default: 0,
    required: function() { return this.role === 'doctor'; }
  },
  realOpdFees: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },
  realEmergencyFees: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },
  dailyVisitFee: {
    type: Number,
    default: 500,
    required: function() { return this.role === 'doctor'; }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  staffId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate staff ID before saving
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.staffId && this.role !== 'super_admin') {
    const year = new Date().getFullYear();
    const prefix = 'STF';
    const count = await this.constructor.countDocuments({
      hospitalId: this.hospitalId,
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    this.staffId = `${prefix}${year}${sequence}`;
  }
  next();
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
