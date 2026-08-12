const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // Patient and Doctor Information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required']
  },
  
  // Prescription Type
  type: {
    type: String,
    required: true,
    enum: ['form', 'image'],
    default: 'form'
  },
  
  // Form-based prescription fields
  medicines: [{
    name: {
      type: String,
      required: function() { return this.type === 'form'; }
    },
    dosage: {
      type: String,
      required: function() { return this.type === 'form'; }
    },
    frequency: {
      type: String,
      default: 'daily',
      required: function() { return this.type === 'form'; }
    },
    customFrequency: {
      type: String,
      default: ''
    },
    instructions: {
      type: String,
      default: ''
    }
  }],
  
  // Image-based prescription fields
  prescriptionFile: {
    type: String, // File path or URL
    required: function() { return this.type === 'image'; }
  },
  
  // Common fields
  generalInstructions: {
    type: String,
    default: ''
  },
  followUpDate: {
    type: Date,
    default: null
  },
  
  // Hospital Information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
prescriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
