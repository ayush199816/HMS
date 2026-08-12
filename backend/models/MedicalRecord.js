const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
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
  
  // Record Type
  recordType: {
    type: String,
    required: true,
    enum: ['pathology', 'xray', 'ct', 'ultrasound', 'mri', 'ecg', 'surgery']
  },
  
  // File Information
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    default: ''
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  
  // Report Details
  description: {
    type: String,
    required: true
  },
  reportDate: {
    type: Date,
    required: true
  },
  
  // Additional fields for specific record types
  pathologyDetails: {
    testType: {
      type: String,
      default: ''
    },
    normalRange: {
      type: String,
      default: ''
    },
    actualValue: {
      type: String,
      default: ''
    },
    unit: {
      type: String,
      default: ''
    }
  },
  
  imagingDetails: {
    bodyPart: {
      type: String,
      default: ''
    },
    contrastUsed: {
      type: Boolean,
      default: false
    },
    findings: {
      type: String,
      default: ''
    },
    impression: {
      type: String,
      default: ''
    }
  },
  
  surgeryDetails: {
    procedureName: {
      type: String,
      required: function() { return this.recordType === 'surgery'; }
    },
    surgeonName: {
      type: String,
      required: function() { return this.recordType === 'surgery'; }
    },
    surgeryDate: {
      type: Date,
      required: function() { return this.recordType === 'surgery'; }
    },
    anesthesiaType: {
      type: String,
      default: ''
    },
    complications: {
      type: String,
      default: ''
    },
    outcome: {
      type: String,
      default: ''
    }
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
    enum: ['active', 'archived', 'deleted'],
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
medicalRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
