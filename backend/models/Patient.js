const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Patient Information
  name: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: 0,
    max: 150
  },
  phone: {
    type: String,
    required: [true, 'Phone/WhatsApp number is required']
  },
  whatsappNumber: {
    type: String,
    default: function() { return this.phone; }
  },
  aadharNumber: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        return v === '' || /^\d{12}$/.test(v);
      },
      message: 'Aadhar number must be 12 digits'
    }
  },
  ayushmanNumber: {
    type: String,
    default: ''
  },
  govtSchemeNumber: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },
  insuranceProvider: {
    type: String,
    default: ''
  },
  insuranceNumber: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Medical Information
  previousIllnessHistory: {
    type: String,
    default: ''
  },
  currentIssues: {
    type: String,
    required: [true, 'Current issues being faced is required']
  },
  
  // Patient Type
  patientType: {
    type: String,
    required: true,
    enum: ['opd', 'emergency'],
    default: 'opd'
  },
  
  // Hospital Information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  
  // Assigned Doctor (optional - assigned during appointment)
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Visit Information
  visitDate: {
    type: Date,
    default: Date.now
  },
  opdNumber: {
    type: String
  },
  emergencyNumber: {
    type: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['registered', 'in_consultation', 'treatment_complete', 'discharged'],
    default: 'registered'
  },
  
  // Billing Information
  bills: [{
    billNumber: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    billDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending'
    },
    paymentDetails: {
      utrNumber: {
        type: String,
        default: ''
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'upi', 'card', 'online'],
        default: 'cash'
      },
      paymentDate: {
        type: Date
      },
      paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  }],
  
  // Total Amount
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Advance Payment Tracking (patient-level)
  advanceBalance: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Unused advance payments that can be applied to future bills'
  },

  // Unpaid Balance Tracking (patient-level)
  unpaidBalance: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Outstanding balance from unpaid bills that should be added to future bills'
  },
  
  // Appointments
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  
  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate OPD/Emergency number when patient is created or assigned for visit
patientSchema.pre('save', async function(next) {
  // Generate OPD/Emergency number for new patients
  if (this.isNew) {
    // Generate appropriate number based on patient type
    // Generate OPD number for all new patients
    if (!this.opdNumber) {
      const year = new Date().getFullYear();
      const prefix = 'OPD';
      
      try {
        let sequenceNumber = 1;
        let opdNumber;
        let isUnique = false;
        
        // Keep trying until we find a unique OPD number
        while (!isUnique) {
          const paddedSequence = sequenceNumber.toString().padStart(4, '0');
          opdNumber = `${prefix}${year}${paddedSequence}`;
          
          // Check if this OPD number already exists
          const existingPatient = await this.constructor.findOne({ opdNumber });
          if (!existingPatient) {
            isUnique = true;
            this.opdNumber = opdNumber;
          } else {
            sequenceNumber++;
          }
        }
      } catch (error) {
        console.error('Error generating OPD number:', error);
      }
    }
    
    // Generate emergency number for emergency patients
    if (this.patientType === 'emergency' && !this.emergencyNumber) {
      const year = new Date().getFullYear();
      const prefix = 'EMG';
      
      try {
        let sequenceNumber = 1;
        let emergencyNumber;
        let isUnique = false;
        
        // Keep trying until we find a unique emergency number
        while (!isUnique) {
          const paddedSequence = sequenceNumber.toString().padStart(4, '0');
          emergencyNumber = `${prefix}${year}${paddedSequence}`;
          
          // Check if this emergency number already exists
          const existingPatient = await this.constructor.findOne({ emergencyNumber });
          if (!existingPatient) {
            isUnique = true;
            this.emergencyNumber = emergencyNumber;
          } else {
            sequenceNumber++;
          }
        }
      } catch (error) {
        console.error('Error generating emergency number:', error);
      }
    }
  }
  
  // Calculate age from date of birth if provided
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let years = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      years--;
    }
    this.age = years;
  }

  // Update balance amount
  this.balanceAmount = this.totalAmount - this.totalPaid;
  
  this.updatedAt = Date.now();
  next();
});

// Method to assign OPD number when patient comes for visit
patientSchema.methods.assignVisitNumber = async function() {
  if (!this.opdNumber && this.patientType === 'opd') {
    const year = new Date().getFullYear();
    const prefix = 'OPD';
    
    const lastPatient = await this.constructor
      .findOne({ 
        patientType: 'opd',
        opdNumber: { $regex: `^${prefix}${year}` }
      })
      .sort({ createdAt: -1 });
    
    let sequenceNumber = 1;
    if (lastPatient && lastPatient.opdNumber) {
      const lastSequence = parseInt(lastPatient.opdNumber.substring(prefix.length + 4));
      sequenceNumber = lastSequence + 1;
    }
    
    const paddedSequence = sequenceNumber.toString().padStart(4, '0');
    this.opdNumber = `${prefix}${year}${paddedSequence}`;
    
    return this.save();
  }
  
  if (!this.emergencyNumber && this.patientType === 'emergency') {
    const year = new Date().getFullYear();
    const prefix = 'EMG';
    
    const lastPatient = await this.constructor
      .findOne({ 
        patientType: 'emergency',
        emergencyNumber: { $regex: `^${prefix}${year}` }
      })
      .sort({ createdAt: -1 });
    
    let sequenceNumber = 1;
    if (lastPatient && lastPatient.emergencyNumber) {
      const lastSequence = parseInt(lastPatient.emergencyNumber.substring(prefix.length + 4));
      sequenceNumber = lastSequence + 1;
    }
    
    const paddedSequence = sequenceNumber.toString().padStart(4, '0');
    this.emergencyNumber = `${prefix}${year}${paddedSequence}`;
    
    return this.save();
  }
  
  return this;
};

// Method to add a new bill
patientSchema.methods.addBill = function(billData) {
  this.bills.push(billData);
  this.totalAmount += billData.amount;
  this.balanceAmount = this.totalAmount - this.totalPaid;
  return this.save();
};

// Method to mark bill as paid
patientSchema.methods.markBillAsPaid = function(billId, paymentDetails) {
  const bill = this.bills.id(billId);
  if (bill) {
    bill.status = 'paid';
    bill.paymentDetails = { ...bill.paymentDetails, ...paymentDetails };
    bill.paymentDetails.paymentDate = new Date();
    this.totalPaid += bill.amount;
    this.balanceAmount = this.totalAmount - this.totalPaid;
  }
  return this.save();
};

// Only enforce uniqueness for actual generated numbers, not null/missing values
patientSchema.index(
  { opdNumber: 1 },
  { unique: true, partialFilterExpression: { opdNumber: { $exists: true, $ne: null } } }
);

patientSchema.index(
  { emergencyNumber: 1 },
  { unique: true, partialFilterExpression: { emergencyNumber: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model('Patient', patientSchema);
