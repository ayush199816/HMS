const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  admissionId: {
    type: String,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assistantDoctorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  admissionReason: {
    type: String,
    required: true
  },
  prescription: {
    type: String,
    default: ''
  },
  prescriptionFile: {
    type: String
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  dischargeDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['admitted', 'discharged', 'transferred'],
    default: 'admitted'
  },
  // Reference to Bills created for this admission (multiple bills supported)
  billIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }],
  bedType: {
    type: String,
    enum: ['icu', 'private_ward', 'general_ward', 'emergency'],
    required: true
  },
  bedNumber: {
    type: String
  },
  bedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed'
  },
  bedHistory: [{
    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed'
    },
    bedNumber: String,
    bedType: String,
    pricePerDay: {
      type: Number,
      default: 0
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    }
  }],
  assignedNurses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Insurance Information
  hasInsurance: {
    type: Boolean,
    default: false
  },
  insuranceProvider: {
    type: String
  },
  insuranceNumber: {
    type: String
  },
  // Government Scheme Information
  hasGovtScheme: {
    type: Boolean,
    default: false
  },
  schemeName: {
    type: String
  },
  schemeNumber: {
    type: String
  },
  vitalReports: [{
    date: {
      type: Date,
      default: Date.now
    },
    temperature: {
      type: Number
    },
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    },
    heartRate: {
      type: Number
    },
    respiratoryRate: {
      type: Number
    },
    oxygenSaturation: {
      type: Number
    },
    notes: {
      type: String
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  medicineUpdates: [{
    medicineName: {
      type: String,
      required: true
    },
    dosage: {
      type: String
    },
    frequency: {
      type: String
    },
    scheduledTime: {
      type: Date
    },
    administered: {
      type: Boolean,
      default: false
    },
    administeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    administeredAt: {
      type: Date
    },
    notes: {
      type: String
    }
  }],
  dischargeSummary: {
    problemStatements: [String],
    testsAndFindings: [String],
    procedures: [String],
    medications: [
      {
        name: { type: String, required: true },
        duration: { type: String },
        howToTake: { type: String }
      }
    ],
    followUpDates: [String],
    conclusion: { type: String, default: '' },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
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

// Generate admission ID before saving
admissionSchema.pre('save', async function(next) {
  if (!this.admissionId) {
    const year = new Date().getFullYear();
    const prefix = 'ADM';
    const sequence = await this.constructor.countDocuments({
      hospitalId: this.hospitalId,
      admissionDate: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    }) + 1;
    const paddedSequence = sequence.toString().padStart(4, '0');
    this.admissionId = `${prefix}${year}${paddedSequence}`;
  }
  next();
});

// Index for faster queries
admissionSchema.index({ patientId: 1, status: 1 });
admissionSchema.index({ hospitalId: 1, admissionDate: -1 });
admissionSchema.index({ admissionId: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
