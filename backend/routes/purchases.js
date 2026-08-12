const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const Purchase = require('../models/Purchase');
const { generatePurchaseVoucherPDF } = require('../utils/generatePurchaseVoucherPDF');

const router = express.Router();

const generateBillNumber = async (hospitalId) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const count = await Purchase.countDocuments({ hospitalId });
  return `PUR-${dateStr}-${String(count + 1).padStart(4, '0')}`;
};

// List purchases
router.get('/', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const purchases = await Purchase.find({ hospitalId: userHospitalId })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(purchases);
  } catch (error) {
    console.error('List purchases error:', error);
    res.status(500).json({ message: 'Server error fetching purchases' });
  }
});

// Get unique categories and subcategories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const categories = await Purchase.distinct('particulars.category', { hospitalId: userHospitalId });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching categories' });
  }
});

router.get('/subcategories', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const { category } = req.query;
    const query = { hospitalId: userHospitalId };
    if (category) query['particulars.category'] = category;
    const subCategories = await Purchase.distinct('particulars.subCategory', query);
    res.json(subCategories);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching sub categories' });
  }
});

// Create purchase
router.post('/', [
  authenticate,
  body('vendorName').notEmpty().withMessage('Vendor name is required'),
  body('particulars').isArray({ min: 1 }).withMessage('At least one particular is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const { vendorName, vendorContact, purchaseDate, particulars } = req.body;

    const billNumber = await generateBillNumber(userHospitalId);

    const purchase = new Purchase({
      hospitalId: userHospitalId,
      createdBy: req.user.id,
      billNumber,
      vendorName,
      vendorContact: vendorContact || '',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      particulars: particulars.map(p => ({
        description: p.description,
        category: p.category,
        subCategory: p.subCategory || '',
        quantity: p.quantity || 1,
        rate: p.rate || 0,
        amount: p.amount || (p.quantity || 1) * (p.rate || 0)
      }))
    });

    await purchase.save();
    res.status(201).json(purchase);
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ message: 'Server error creating purchase' });
  }
});

// Add payment
router.post('/:id/payment', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const { amount, paymentMethod, referenceNumber, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    }

    const purchase = await Purchase.findOne({ _id: req.params.id, hospitalId: userHospitalId });
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (paymentMethod && paymentMethod !== 'cash' && !referenceNumber) {
      return res.status(400).json({ message: 'Reference number is required for non-cash payments' });
    }

    purchase.paymentSources.push({
      amount,
      paymentMethod: paymentMethod || 'cash',
      referenceNumber: referenceNumber || '',
      paymentDate: new Date(),
      notes: notes || ''
    });

    await purchase.save();
    res.json(purchase);
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Server error recording payment' });
  }
});

// Download payment voucher
router.get('/:id/voucher', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const purchase = await Purchase.findOne({ _id: req.params.id, hospitalId: userHospitalId })
      .populate('createdBy', 'name')
      .populate('hospitalId', 'name address phone');

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const pdfBuffer = await generatePurchaseVoucherPDF(purchase);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=voucher-${purchase.billNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Voucher error:', error);
    res.status(500).json({ message: 'Server error generating voucher' });
  }
});

module.exports = router;
