const mongoose = require('mongoose');

const feeConfigurationSchema = new mongoose.Schema({
  // Hospital Information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  
  // Fee Types
  feeTypes: {
    opdConsultation: {
      type: Number,
      required: true,
      min: 0,
      default: 500
    },
    emergencyConsultation: {
      type: Number,
      required: true,
      min: 0,
      default: 1000
    },
    followUpConsultation: {
      type: Number,
      required: true,
      min: 0,
      default: 300
    }
  },
  
  // Surgery Types Configuration
  surgeryTypes: [{
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['general', 'cardiac', 'orthopedic', 'neuro', 'cosmetic', 'pediatric', 'gynecological', 'urological', 'eye', 'ent'],
      required: true
    },
    baseFee: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    estimatedDuration: {
      type: String, // e.g., "2-3 hours"
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Doctor-specific Surgery Fees
  doctorSurgeryFees: [{
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    surgeryTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    customFee: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    effectiveFrom: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Discount Configuration
  discountSettings: {
    maxDiscountPercentage: {
      type: Number,
      default: 20, // Maximum 20% discount
      min: 0,
      max: 100
    },
    requiresApprovalAbove: {
      type: Number,
      default: 10 // Requires approval for discounts above 10%
    },
    approvalRoles: {
      type: [String],
      enum: ['hospital_admin', 'super_admin'],
      default: ['hospital_admin', 'super_admin']
    }
  },
  
  // Discount Requests
  discountRequests: [{
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    originalAmount: {
      type: Number,
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    discountAmount: {
      type: Number,
      required: true
    },
    finalAmount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
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

// Static method to calculate consultation fee
feeConfigurationSchema.statics.calculateConsultationFee = async function(hospitalId, appointmentType, doctorId) {
  const User = mongoose.model('User');
  
  // First, try to get doctor-specific fees
  if (doctorId) {
    try {
      const doctor = await User.findById(doctorId);
      if (doctor && doctor.role === 'doctor') {
        switch (appointmentType) {
          case 'consultation':
            return doctor.opdFees || 500;
          case 'emergency':
            return doctor.emergencyFees || 1000;
          case 'follow_up':
            // Follow-up is typically 50-70% of OPD fee
            return Math.round((doctor.opdFees || 500) * 0.6);
          default:
            return doctor.opdFees || 500;
        }
      }
    } catch (error) {
      console.error('Error fetching doctor fees:', error);
    }
  }
  
  // Fallback to hospital configuration if doctor fees not available
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    // Default fees if no configuration found
    const defaultFees = {
      consultation: 500,
      emergency: 1000,
      follow_up: 300
    };
    return defaultFees[appointmentType] || 500;
  }
  
  switch (appointmentType) {
    case 'consultation':
      return feeConfig.feeTypes.opdConsultation;
    case 'emergency':
      return feeConfig.feeTypes.emergencyConsultation;
    case 'follow_up':
      return feeConfig.feeTypes.followUpConsultation;
    default:
      return feeConfig.feeTypes.opdConsultation;
  }
};

// Static method to calculate surgery fee
feeConfigurationSchema.statics.calculateSurgeryFee = async function(hospitalId, doctorId, surgeryTypeId) {
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    return 0;
  }
  
  // Check for doctor-specific fee first
  const doctorFee = feeConfig.doctorSurgeryFees.find(fee => 
    fee.doctorId.toString() === doctorId.toString() && 
    fee.surgeryTypeId.toString() === surgeryTypeId.toString() && 
    fee.isActive
  );
  
  if (doctorFee) {
    return doctorFee.customFee;
  }
  
  // Fall back to base fee
  const surgeryType = feeConfig.surgeryTypes.find(surgery => 
    surgery._id.toString() === surgeryTypeId.toString() && 
    surgery.isActive
  );
  
  return surgeryType ? surgeryType.baseFee : 0;
};

// Static method to create discount request
feeConfigurationSchema.statics.createDiscountRequest = async function(
  hospitalId, 
  appointmentId, 
  requestedBy, 
  originalAmount, 
  discountPercentage, 
  reason
) {
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    throw new Error('Fee configuration not found for this hospital');
  }
  
  const discountAmount = (originalAmount * discountPercentage) / 100;
  const finalAmount = originalAmount - discountAmount;
  
  // Check if discount requires approval
  const requiresApproval = discountPercentage > feeConfig.discountSettings.requiresApprovalAbove;
  
  if (!requiresApproval) {
    // Auto-approve small discounts
    return {
      approved: true,
      discountAmount,
      finalAmount,
      message: 'Discount approved automatically'
    };
  }
  
  // Create approval request for larger discounts
  const newRequest = {
    appointmentId,
    requestedBy,
    originalAmount,
    discountPercentage,
    discountAmount,
    finalAmount,
    reason,
    status: 'pending'
  };
  
  feeConfig.discountRequests.push(newRequest);
  await feeConfig.save();
  
  return {
    approved: false,
    discountAmount,
    finalAmount,
    requestId: feeConfig.discountRequests[feeConfig.discountRequests.length - 1]._id,
    message: 'Discount request sent for approval'
  };
};

// Static method to approve/reject discount
feeConfigurationSchema.statics.processDiscountRequest = async function(
  hospitalId, 
  requestId, 
  approvedBy, 
  status, 
  rejectionReason = ''
) {
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    throw new Error('Fee configuration not found for this hospital');
  }
  
  const request = feeConfig.discountRequests.id(requestId);
  
  if (!request) {
    throw new Error('Discount request not found');
  }
  
  if (request.status !== 'pending') {
    throw new Error('Discount request already processed');
  }
  
  request.status = status;
  request.approvedBy = approvedBy;
  request.approvedAt = new Date();
  
  if (status === 'rejected') {
    request.rejectionReason = rejectionReason;
  }
  
  await feeConfig.save();
  
  return request;
};

// Static method to get available surgery types
feeConfigurationSchema.statics.getAvailableSurgeryTypes = async function(hospitalId) {
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    return [];
  }
  
  return feeConfig.surgeryTypes.filter(surgery => surgery.isActive);
};

// Static method to get doctor surgery fees
feeConfigurationSchema.statics.getDoctorSurgeryFees = async function(hospitalId, doctorId) {
  const feeConfig = await this.findOne({ hospitalId });
  
  if (!feeConfig) {
    return [];
  }
  
  return feeConfig.doctorSurgeryFees
    .filter(fee => fee.doctorId.toString() === doctorId.toString() && fee.isActive)
    .populate('surgeryTypeId');
};

module.exports = mongoose.model('FeeConfiguration', feeConfigurationSchema);
