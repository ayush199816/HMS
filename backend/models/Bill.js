const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['pathology', 'appointment', 'consultation', 'emergency', 'opd', 'radiology', 'surgery', 'admission', 'admission_advance', 'other'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
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
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'cancelled', 'refunded', 'insurance_applied', 'insurance_approved', 'refund_due'],
    default: 'pending'
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'online', 'other']
    },
    utrNumber: String,
    paymentDate: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Payment sources breakdown
  paymentSources: [{
    sourceType: {
      type: String,
      enum: ['patient', 'advance', 'insurance', 'govt_scheme', 'other'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    referenceNumber: String,
    notes: String,
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'online', 'other']
    },
    // Insurance specific fields
    insuranceProvider: String,
    policyNumber: String,
    claimNumber: String,
    // Govt scheme specific fields
    schemeName: String,
    schemeId: String,
    beneficiaryId: String
  }],
  // Advance payment tracking
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Insurance details
  insuranceDetails: {
    provider: String,
    policyNumber: String,
    claimNumber: String,
    claimStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending'
    },
    approvedAmount: {
      type: Number,
      default: 0
    }
  },
  // Govt scheme details
  govtSchemeDetails: {
    schemeName: String,
    schemeId: String,
    beneficiaryId: String,
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending'
    },
    approvedAmount: {
      type: Number,
      default: 0
    }
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: false
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  items: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    hasTax: {
      type: Boolean,
      default: false
    }
  }],
  notes: String
}, {
  timestamps: true
});

// Calculate total amount before saving
billSchema.pre('save', async function(next) {
  // Always calculate totalAmount
  this.totalAmount = (this.amount || 0) - (this.discount || 0) + (this.tax || 0);

  // Calculate total paid from payment sources
  const totalPaid = this.paymentSources?.reduce((sum, source) => {
    return sum + (source.amount || 0);
  }, 0) || 0;

  // Store totalPaid for reference
  this.totalPaid = totalPaid;

  // Calculate balance
  this.balanceAmount = this.totalAmount - totalPaid;

  // Determine bill status based on payments
  if (this.totalAmount === 0) {
    this.status = totalPaid > 0 ? 'paid' : 'pending';
  } else if (totalPaid >= this.totalAmount && this.totalAmount > 0) {
    // Fully paid
    this.status = 'paid';
  } else if (totalPaid > this.totalAmount) {
    // Overpaid - refund due
    this.status = 'refund_due';
  } else if (totalPaid > 0 && totalPaid < this.totalAmount) {
    // Partially paid
    this.status = 'partial';
  } else if (totalPaid === 0) {
    // Not paid
    this.status = 'pending';
  }

  // Update patient's unpaid balance on bill updates (when payments are recorded)
  if (this.patientId && !this.isNew) {
    const Patient = require('./Patient');
    const patient = await Patient.findById(this.patientId);

    if (patient) {
      // If bill is unpaid or partially paid, update unpaid balance
      if (this.status === 'pending' || this.status === 'partial') {
        // Calculate how much of this bill is still unpaid
        const unpaidAmount = this.balanceAmount;
        if (unpaidAmount > 0) {
          patient.unpaidBalance = unpaidAmount;
        }
      } else if (this.status === 'paid') {
        // If bill is paid, reduce unpaid balance
        patient.unpaidBalance = Math.max(0, patient.unpaidBalance - this.totalAmount);
      }

      await patient.save();
    }
  }

  next();
});

// Virtual fields for payment tracking
billSchema.virtual('paidAmount').get(function() {
  return this.paymentSources?.reduce((sum, source) => sum + (source.amount || 0), 0) || 0;
});

billSchema.virtual('balance').get(function() {
  return this.totalAmount - (this.paymentSources?.reduce((sum, source) => sum + (source.amount || 0), 0) || 0);
});

// Index for efficient queries
billSchema.index({ patientId: 1, hospitalId: 1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ status: 1 });
billSchema.index({ type: 1 });
billSchema.index({ referenceId: 1 });
billSchema.index({ billDate: -1 });

module.exports = mongoose.model('Bill', billSchema);
