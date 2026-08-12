const mongoose = require('mongoose');

const radiologyTestSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    enum: [
      'X-Ray',
      'CT Scan',
      'MRI',
      'Ultrasound',
      'PET Scan',
      'Mammography',
      'DEXA Scan',
      'Fluoroscopy',
      'Angiography',
      'Other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  bodyPart: {
    type: String,
    required: true
  },
  preparationInstructions: {
    type: String,
    default: ''
  },
  contrastRequired: {
    type: Boolean,
    default: false
  },
  pricing: {
    costPrice: {
      type: Number,
      required: true,
      min: 0
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0
    },
    profitPercentage: {
      type: Number,
      default: 0,
      min: 0
    },
    pricingMethod: {
      type: String,
      enum: ['direct', 'percentage'],
      default: 'direct'
    }
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
radiologyTestSchema.index({ name: 1, hospitalId: 1 });
radiologyTestSchema.index({ code: 1 });
radiologyTestSchema.index({ category: 1, hospitalId: 1 });

// Method to calculate selling price based on profit percentage
radiologyTestSchema.methods.calculateSellingPrice = function() {
  if (this.pricing.pricingMethod === 'percentage') {
    return this.pricing.costPrice * (1 + this.pricing.profitPercentage / 100);
  }
  return this.pricing.sellingPrice;
};

// Method to update profit percentage
radiologyTestSchema.methods.updateProfitPercentage = function() {
  if (this.pricing.pricingMethod === 'direct') {
    const profit = this.pricing.sellingPrice - this.pricing.costPrice;
    this.pricing.profitPercentage = (profit / this.pricing.costPrice) * 100;
  }
};

// Pre-save middleware to ensure pricing consistency
radiologyTestSchema.pre('save', function(next) {
  if (this.pricing.pricingMethod === 'percentage') {
    this.pricing.sellingPrice = this.calculateSellingPrice();
  } else {
    this.updateProfitPercentage();
  }
  next();
});

module.exports = mongoose.model('RadiologyTest', radiologyTestSchema);
