const express = require('express');
const router = express.Router();
const RadiologyTest = require('../models/RadiologyTest');
const RadiologyTestBooking = require('../models/RadiologyTestBooking');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// Get all radiology tests for a hospital
router.get('/tests', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;
    const skip = (page - 1) * limit;

    let query = { hospitalId: req.user.hospitalId, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const tests = await RadiologyTest.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RadiologyTest.countDocuments(query);

    res.json({
      tests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get radiology tests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single radiology test
router.get('/tests/:id', authenticate, async (req, res) => {
  try {
    const test = await RadiologyTest.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({ test });
  } catch (error) {
    console.error('Get radiology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new radiology test
router.post('/tests', authenticate, async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      description,
      bodyPart,
      preparationInstructions,
      contrastRequired,
      pricing
    } = req.body;

    // Check if test code already exists
    const existingTest = await RadiologyTest.findOne({
      code: code.toUpperCase(),
      hospitalId: req.user.hospitalId
    });

    if (existingTest) {
      return res.status(400).json({ message: 'Test code already exists' });
    }

    const test = new RadiologyTest({
      name,
      code: code.toUpperCase(),
      category,
      description,
      bodyPart,
      preparationInstructions,
      contrastRequired,
      pricing,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });

    await test.save();

    res.status(201).json({ test });
  } catch (error) {
    console.error('Create radiology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update radiology test
router.put('/tests/:id', authenticate, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      bodyPart,
      preparationInstructions,
      contrastRequired,
      pricing
    } = req.body;

    const test = await RadiologyTest.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    test.name = name;
    test.category = category;
    test.description = description;
    test.bodyPart = bodyPart;
    test.preparationInstructions = preparationInstructions;
    test.contrastRequired = contrastRequired;
    test.pricing = pricing;

    await test.save();

    res.json({ test });
  } catch (error) {
    console.error('Update radiology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete radiology test
router.delete('/tests/:id', authenticate, async (req, res) => {
  try {
    const test = await RadiologyTest.findOneAndDelete({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete radiology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get radiology test categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const categories = await RadiologyTest.distinct('category', {
      hospitalId: req.user.hospitalId,
      isActive: true
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
