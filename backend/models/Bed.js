const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema({
  bedNumber: {
    type: String,
    required: true
  },
  wardType: {
    type: String,
    enum: ['emergency', 'icu', 'general_ward', 'private_ward'],
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'reserved'],
    default: 'available'
  },
  floor: {
    type: Number
  },
  roomNumber: {
    type: String
  },
  pricePerDay: {
    type: Number,
    default: 0
  },
  amenities: [{
    type: String
  }],
  currentAdmission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admission'
  },
  assignedNurses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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

// Index for faster queries
bedSchema.index({ hospitalId: 1, wardType: 1 });
bedSchema.index({ hospitalId: 1, status: 1 });
bedSchema.index({ bedNumber: 1, hospitalId: 1 }, { unique: true });

module.exports = mongoose.model('Bed', bedSchema);
