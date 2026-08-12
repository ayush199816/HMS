const mongoose = require('mongoose');

const radiologyTestBookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  tests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RadiologyTest',
      required: true
    },
    testName: {
      type: String,
      required: true
    },
    testCode: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    bodyPart: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    costPrice: {
      type: Number,
      required: true
    }
  }],
  bookingDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  preferredDate: {
    type: Date,
    required: true
  },
  preferredTime: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['routine', 'urgent', 'emergency'],
    default: 'routine'
  },
  scanCollection: {
    isCollected: {
      type: Boolean,
      default: false
    },
    collectedDate: {
      type: Date
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    collectionNotes: {
      type: String
    },
    homeCollection: {
      type: Boolean,
      default: false
    },
    collectionAddress: {
      type: String
    }
  },
  reports: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RadiologyTest',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'ready'],
      default: 'pending'
    },
    reportUrl: {
      type: String
    },
    reportDate: {
      type: Date
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    observation: {
      type: String
    },
    findings: {
      type: String
    },
    impression: {
      type: String
    },
    images: [{
      url: String,
      publicId: String,
      originalName: String
    }],
    reportType: {
      type: String,
      enum: ['simple', 'detailed'],
      default: 'simple'
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'online', 'insurance'],
    default: 'cash'
  },
  transactionId: {
    type: String
  },
  // Reference to Bill created for this booking
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  status: {
    type: String,
    enum: ['booked', 'scan_collected', 'in_progress', 'completed', 'cancelled'],
    default: 'booked'
  },
  notes: {
    type: String
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
radiologyTestBookingSchema.index({ patientId: 1, bookingDate: -1 });
radiologyTestBookingSchema.index({ doctorId: 1, bookingDate: -1 });
radiologyTestBookingSchema.index({ hospitalId: 1, bookingDate: -1 });
radiologyTestBookingSchema.index({ status: 1, bookingDate: -1 });
radiologyTestBookingSchema.index({ 'scanCollection.isCollected': 1, bookingDate: -1 });
radiologyTestBookingSchema.index({ 'reports.status': 1, bookingDate: -1 });

// Pre-save middleware to calculate total amounts
radiologyTestBookingSchema.pre('save', function(next) {
  if (this.isModified('tests')) {
    this.totalAmount = this.tests.reduce((sum, test) => sum + test.price, 0);
    this.totalCost = this.tests.reduce((sum, test) => sum + test.costPrice, 0);
    this.finalAmount = this.totalAmount - this.discount;
  }
  next();
});

// Method to check if all scans are collected
radiologyTestBookingSchema.methods.areAllScansCollected = function() {
  return this.scanCollection.isCollected;
};

// Method to check if all reports are ready
radiologyTestBookingSchema.methods.areAllReportsReady = function() {
  return this.reports.every(report => report.status === 'completed' || report.status === 'ready');
};

// Method to get report status summary
radiologyTestBookingSchema.methods.getReportStatusSummary = function() {
  const summary = {
    total: this.reports.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    ready: 0
  };

  this.reports.forEach(report => {
    summary[report.status.replace('_', '')]++;
  });

  return summary;
};

module.exports = mongoose.model('RadiologyTestBooking', radiologyTestBookingSchema);
