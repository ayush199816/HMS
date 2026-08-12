const mongoose = require('mongoose');

const pathologyProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
  accreditation: {
    type: String,
    enum: ['NABL', 'CAP', 'ISO', 'Other', 'None'],
    default: 'None'
  },
  specialization: [{
    type: String,
    enum: ['Blood Test', 'Urine Test', 'Biopsy', 'Imaging', 'Microbiology', 'Biochemistry', 'Hematology', 'Molecular', 'Other']
  }],
  turnaroundTime: {
    type: Number, // in hours
    default: 24
  },
  samplePickup: {
    type: Boolean,
    default: false
  },
  homeCollection: {
    type: Boolean,
    default: false
  },
  emergencyServices: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster searches
pathologyProviderSchema.index({ name: 1, hospitalId: 1 });
pathologyProviderSchema.index({ code: 1 });
pathologyProviderSchema.index({ city: 1, hospitalId: 1 });

module.exports = mongoose.model('PathologyProvider', pathologyProviderSchema);
