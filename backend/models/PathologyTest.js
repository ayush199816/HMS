const mongoose = require('mongoose');

const pathologyTestSchema = new mongoose.Schema({
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
      'Hematology',
      'Urine Examination', 
      'Semen Analysis',
      'Cytopathology',
      'Body Fluids',
      'Histopathology',
      'Microbiology',
      'Biochemistry',
      'Blood Bank',
      'Molecular',
      'Imaging',
      'Other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  sampleType: {
    type: String,
    required: true,
    enum: ['Blood', 'Urine', 'Stool', 'Sputum', 'Swab', 'Tissue', 'CSF', 'Other']
  },
  preparationInstructions: {
    type: String,
    default: ''
  },
  normalRange: {
    type: String,
    default: ''
  },
  units: {
    type: String,
    default: ''
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
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PathologyProvider',
    required: true
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
pathologyTestSchema.index({ name: 1, hospitalId: 1 });
pathologyTestSchema.index({ code: 1 });
pathologyTestSchema.index({ category: 1, hospitalId: 1 });

// Method to calculate selling price based on profit percentage
pathologyTestSchema.methods.calculateSellingPrice = function() {
  if (this.pricing.pricingMethod === 'percentage') {
    return this.pricing.costPrice * (1 + this.pricing.profitPercentage / 100);
  }
  return this.pricing.sellingPrice;
};

// Method to update profit percentage
pathologyTestSchema.methods.updateProfitPercentage = function() {
  if (this.pricing.pricingMethod === 'direct') {
    const profit = this.pricing.sellingPrice - this.pricing.costPrice;
    this.pricing.profitPercentage = (profit / this.pricing.costPrice) * 100;
  }
};

// Pre-save middleware to ensure pricing consistency
pathologyTestSchema.pre('save', function(next) {
  if (this.pricing.pricingMethod === 'percentage') {
    this.pricing.sellingPrice = this.calculateSellingPrice();
  } else {
    this.updateProfitPercentage();
  }
  next();
});

module.exports = mongoose.model('PathologyTest', pathologyTestSchema);
