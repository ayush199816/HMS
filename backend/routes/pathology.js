const express = require('express');
const router = express.Router();
const multer = require('multer');
const PathologyTest = require('../models/PathologyTest');
const PathologyProvider = require('../models/PathologyProvider');
const PathologyTestBooking = require('../models/PathologyTestBooking');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// Get all pathology tests for a hospital
router.get('/tests', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, provider } = req.query;
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
    
    if (provider) {
      query.provider = provider;
    }
    
    const tests = await PathologyTest.find(query)
      .populate('provider', 'name code')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PathologyTest.countDocuments(query);
    
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
    console.error('Get pathology tests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single pathology test
router.get('/tests/:id', authenticate, async (req, res) => {
  try {
    const test = await PathologyTest.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    }).populate('provider');
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    res.json({ test });
  } catch (error) {
    console.error('Get pathology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new pathology test
router.post('/tests', authenticate, async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      description,
      sampleType,
      preparationInstructions,
      normalRange,
      units,
      pricing,
      provider
    } = req.body;
    
    // Check if test code already exists
    const existingTest = await PathologyTest.findOne({ 
      code: code.toUpperCase(), 
      hospitalId: req.user.hospitalId 
    });
    
    if (existingTest) {
      return res.status(400).json({ message: 'Test code already exists' });
    }
    
    // Verify provider exists and belongs to hospital
    const providerDoc = await PathologyProvider.findOne({
      _id: provider,
      hospitalId: req.user.hospitalId
    });
    
    if (!providerDoc) {
      return res.status(400).json({ message: 'Invalid provider' });
    }
    
    const test = new PathologyTest({
      name,
      code: code.toUpperCase(),
      category,
      description,
      sampleType,
      preparationInstructions,
      normalRange,
      units,
      pricing,
      provider,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });
    
    await test.save();
    await test.populate('provider', 'name code');
    
    res.status(201).json({ test });
  } catch (error) {
    console.error('Create pathology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update pathology test
router.put('/tests/:id', authenticate, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      sampleType,
      preparationInstructions,
      normalRange,
      units,
      pricing,
      provider
    } = req.body;
    
    // Verify provider exists and belongs to hospital
    if (provider) {
      const providerDoc = await PathologyProvider.findOne({
        _id: provider,
        hospitalId: req.user.hospitalId
      });
      
      if (!providerDoc) {
        return res.status(400).json({ message: 'Invalid provider' });
      }
    }
    
    const test = await PathologyTest.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      {
        name,
        category,
        description,
        sampleType,
        preparationInstructions,
        normalRange,
        units,
        pricing,
        provider
      },
      { new: true, runValidators: true }
    ).populate('provider');
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    res.json({ test });
  } catch (error) {
    console.error('Update pathology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete pathology test (soft delete)
router.delete('/tests/:id', authenticate, async (req, res) => {
  try {
    const test = await PathologyTest.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { isActive: false },
      { new: true }
    );
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete pathology test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pathology providers
router.get('/providers', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { hospitalId: req.user.hospitalId, isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }
    
    const providers = await PathologyProvider.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PathologyProvider.countDocuments(query);
    
    res.json({
      providers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pathology providers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new pathology provider
router.post('/providers', authenticate, async (req, res) => {
  try {
    const {
      name,
      code,
      contactPerson,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      gstNumber,
      licenseNumber,
      accreditation,
      specialization,
      turnaroundTime,
      samplePickup,
      homeCollection,
      emergencyServices
    } = req.body;
    
    // Check if provider code already exists
    const existingProvider = await PathologyProvider.findOne({ 
      code: code.toUpperCase(), 
      hospitalId: req.user.hospitalId 
    });
    
    if (existingProvider) {
      return res.status(400).json({ message: 'Provider code already exists' });
    }
    
    const provider = new PathologyProvider({
      name,
      code: code.toUpperCase(),
      contactPerson,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      gstNumber,
      licenseNumber,
      accreditation,
      specialization,
      turnaroundTime,
      samplePickup,
      homeCollection,
      emergencyServices,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });
    
    await provider.save();
    
    res.status(201).json({ provider });
  } catch (error) {
    console.error('Create pathology provider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update pathology provider
router.put('/providers/:id', authenticate, async (req, res) => {
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      gstNumber,
      licenseNumber,
      accreditation,
      specialization,
      turnaroundTime,
      samplePickup,
      homeCollection,
      emergencyServices
    } = req.body;
    
    const provider = await PathologyProvider.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      {
        name,
        contactPerson,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        gstNumber,
        licenseNumber,
        accreditation,
        specialization,
        turnaroundTime,
        samplePickup,
        homeCollection,
        emergencyServices
      },
      { new: true, runValidators: true }
    );
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    
    res.json({ provider });
  } catch (error) {
    console.error('Update pathology provider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete pathology provider (soft delete)
router.delete('/providers/:id', authenticate, async (req, res) => {
  try {
    const provider = await PathologyProvider.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { isActive: false },
      { new: true }
    );
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    
    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('Delete pathology provider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get test categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const categories = await PathologyTest.distinct('category', {
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
