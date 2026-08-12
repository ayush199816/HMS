const express = require('express');
const { body, validationResult } = require('express-validator');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all hospitals (Super Admin only)
router.get('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .populate('createdBy', 'name email')
      .populate('departments', 'name departmentType')
      .sort({ createdAt: -1 });

    res.json({ hospitals });
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ message: 'Server error fetching hospitals' });
  }
});

// Get hospital by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('departments', 'name departmentType')
      .populate('staff', 'name role email phone');

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    // Check access permissions
    if (req.user.role === 'super_admin') {
      return res.json({ hospital });
    }

    if (req.user.hospitalId && req.user.hospitalId.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ hospital });
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({ message: 'Server error fetching hospital' });
  }
});

// Create new hospital (Super Admin only)
router.post('/', [
  authenticate,
  authorize('super_admin'),
  body('name').notEmpty().withMessage('Hospital name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('pincode').notEmpty().withMessage('Pincode is required'),
  body('registrationNumber').notEmpty().withMessage('Registration number is required'),
  body('emergencyNumber').notEmpty().withMessage('Emergency number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      registrationNumber,
      emergencyNumber,
      logo,
      description,
      facilities
    } = req.body;

    // Check if hospital already exists
    const existingHospital = await Hospital.findOne({
      $or: [{ email }, { registrationNumber }]
    });

    if (existingHospital) {
      return res.status(400).json({ 
        message: 'Hospital with this email or registration number already exists' 
      });
    }

    // Create hospital
    const hospital = new Hospital({
      name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      registrationNumber,
      emergencyNumber,
      logo: logo || '',
      description: description || '',
      facilities: facilities || [],
      createdBy: req.user.id
    });

    await hospital.save();

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Delete the hospital we just created since admin creation will fail
      await Hospital.findByIdAndDelete(hospital._id);
      return res.status(400).json({ 
        message: 'A user with this email already exists. Please use a different email for the hospital.' 
      });
    }

    // Generate random password for hospital admin
    const generateRandomPassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const hospitalAdminPassword = generateRandomPassword();

    console.log('Creating hospital admin with:', {
      email: email,
      password: hospitalAdminPassword,
      name: `${name} Administrator`
    });

    // Create hospital admin using the hospital email
    const hospitalAdmin = new User({
      name: `${name} Administrator`,
      email: email, // Use the hospital email as admin email
      password: hospitalAdminPassword,
      phone: phone,
      role: 'hospital_admin',
      hospitalId: hospital._id
    });

    await hospitalAdmin.save();

    // Update hospital with admin reference
    hospital.staff.push(hospitalAdmin._id);
    await hospital.save();

    const adminCredentials = {
      email: email,
      password: hospitalAdminPassword,
      note: 'This is a randomly generated password. Please save it securely and change it after first login.'
    };

    console.log('Sending admin credentials in response:', adminCredentials);

    res.status(201).json({
      message: 'Hospital created successfully',
      hospital,
      adminCredentials
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000 && error.keyPattern?.email) {
      // Clean up the hospital if it was created
      if (hospital && hospital._id) {
        await Hospital.findByIdAndDelete(hospital._id).catch(() => {});
      }
      return res.status(400).json({ 
        message: 'A user with this email already exists. Please use a different email for the hospital.' 
      });
    }
    
    res.status(500).json({ message: 'Server error creating hospital' });
  }
});

// Update hospital (Super Admin or Hospital Admin)
router.put('/:id', [
  authenticate,
  body('name').optional().notEmpty().withMessage('Hospital name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== req.params.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      emergencyNumber,
      logo,
      description,
      facilities
    } = req.body;

    // Update fields
    if (name) hospital.name = name;
    if (email) hospital.email = email;
    if (phone) hospital.phone = phone;
    if (address) hospital.address = address;
    if (city) hospital.city = city;
    if (state) hospital.state = state;
    if (pincode) hospital.pincode = pincode;
    if (emergencyNumber) hospital.emergencyNumber = emergencyNumber;
    if (logo !== undefined) hospital.logo = logo;
    if (description !== undefined) hospital.description = description;
    if (facilities) hospital.facilities = facilities;

    await hospital.save();

    res.json({
      message: 'Hospital updated successfully',
      hospital
    });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ message: 'Server error updating hospital' });
  }
});

// Deactivate hospital (Super Admin only)
router.delete('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    hospital.isActive = false;
    await hospital.save();

    // Deactivate all staff associated with this hospital
    await User.updateMany(
      { hospitalId: req.params.id },
      { isActive: false }
    );

    res.json({ message: 'Hospital deactivated successfully' });
  } catch (error) {
    console.error('Deactivate hospital error:', error);
    res.status(500).json({ message: 'Server error deactivating hospital' });
  }
});

// Get hospital statistics
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== req.params.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    // Get staff statistics
    const staffStats = await User.aggregate([
      { $match: { hospitalId: hospital._id, isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Get department statistics
    const departmentStats = await Department.aggregate([
      { $match: { hospitalId: hospital._id, isActive: true } },
      { $group: { _id: '$departmentType', count: { $sum: 1 } } }
    ]);

    res.json({
      hospital: {
        id: hospital._id,
        name: hospital.name,
        totalStaff: staffStats.reduce((sum, stat) => sum + stat.count, 0),
        totalDepartments: departmentStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      staffBreakdown: staffStats,
      departmentBreakdown: departmentStats
    });
  } catch (error) {
    console.error('Get hospital stats error:', error);
    res.status(500).json({ message: 'Server error fetching hospital statistics' });
  }
});

module.exports = router;
