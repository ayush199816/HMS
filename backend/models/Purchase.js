const mongoose = require('mongoose');

const ParticularSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, default: '' },
  quantity: { type: Number, default: 1, min: 0 },
  rate: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const PaymentSourceSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, default: 'cash' },
  referenceNumber: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { _id: false });

const PurchaseSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  billNumber: { type: String, required: true, unique: true },
  vendorName: { type: String, required: true },
  vendorContact: { type: String, default: '' },
  purchaseDate: { type: Date, default: Date.now },
  particulars: [ParticularSchema],
  totalAmount: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
  paymentSources: [PaymentSourceSchema]
}, { timestamps: true });

PurchaseSchema.pre('save', function(next) {
  const total = this.particulars.reduce((sum, p) => sum + (p.amount || 0), 0);
  this.totalAmount = total;
  const paid = this.paymentSources.reduce((sum, s) => sum + (s.amount || 0), 0);
  this.totalPaid = paid;
  this.balanceAmount = Math.max(0, total - paid);

  if (this.balanceAmount === 0 && paid > 0) this.status = 'paid';
  else if (paid > 0 && paid < total) this.status = 'partial';
  else this.status = 'pending';

  next();
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
