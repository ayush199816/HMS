const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Department = require('../models/Department');
const { authenticate, authorize, hospitalAccess, departmentAccess } = require('../middleware/auth');

const router = express.Router();

// Get all staff for a hospital
router.get('/hospital/:hospitalId', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { role, departmentId } = req.query;
    
    let query = { 
      hospitalId: req.params.hospitalId,
      isActive: true 
    };

    if (role) {
      query.role = role;
    }

    if (departmentId) {
      query.departmentId = departmentId;
    }

    const staff = await User.find(query)
      .populate('departmentId', 'name departmentType')
      .select('-password')
      .sort({ name: 1 });

    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Server error fetching staff' });
  }
});

// Get staff by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const staff = await User.findById(req.params.id)
      .populate('hospitalId', 'name email phone address')
      .populate('departmentId', 'name description departmentType')
      .select('-password');

    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check access permissions
    if (req.user.role === 'super_admin') {
      return res.json({ staff });
    }

    if (req.user.hospitalId && req.user.hospitalId.toString() !== staff.hospitalId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ staff });
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({ message: 'Server error fetching staff member' });
  }
});

// Create new staff (Hospital Admin only)
router.post('/', [
  authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('role').isIn(['doctor', 'assistant_doctor', 'nurse', 'pathologist', 'diagnostic', 'pharmacist', 'billing_staff', 'receptionist', 'accounts']).withMessage('Invalid role'),
  body('hospitalId').notEmpty().withMessage('Hospital ID is required'),
  body('departmentId').notEmpty().withMessage('Department ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      email,
      password,
      phone,
      role,
      hospitalId,
      departmentId,
      // Doctor specific fields
      specialities,
      education,
      picture,
      otherHospitals,
      emergencyNumber,
      address,
      opdFees,
      emergencyFees,
      commissionPercentage,
      realOpdFees,
      realEmergencyFees,
      dailyVisitFee
    } = req.body;

    // Check if user is authorized to create staff
    if (req.user.role !== 'super_admin' && req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Access denied. Only hospital admins can create staff.' });
    }

    // For hospital admin, use their own hospitalId
    let targetHospitalId = hospitalId;
    if (req.user.role === 'hospital_admin') {
      if (!req.user.hospitalId) {
        return res.status(403).json({ message: 'Access denied. Hospital admin not assigned to any hospital.' });
      }
      
      // Extract the ObjectId from the populated hospital object
      const userHospitalObjectId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      targetHospitalId = userHospitalObjectId;
      
      console.log('Hospital Admin creating staff:', {
        userHospitalId: req.user.hospitalId,
        userHospitalObjectId: targetHospitalId,
        originalHospitalId: hospitalId
      });
    }

    // Check if department exists and belongs to the hospital
    const department = await Department.findById(departmentId);
    if (!department || department.hospitalId.toString() !== targetHospitalId) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate doctor-specific fields
    if (role === 'doctor') {
      if (!specialities || specialities.length === 0) {
        return res.status(400).json({ message: 'Specialities are required for doctors' });
      }
      if (!emergencyNumber) {
        return res.status(400).json({ message: 'Emergency number is required for doctors' });
      }
      if (!address) {
        return res.status(400).json({ message: 'Address is required for doctors' });
      }
      if (!opdFees || opdFees <= 0) {
        return res.status(400).json({ message: 'Valid OPD fees are required for doctors' });
      }
      if (!emergencyFees || emergencyFees <= 0) {
        return res.status(400).json({ message: 'Valid emergency fees are required for doctors' });
      }
      if (!realOpdFees || realOpdFees <= 0) {
        return res.status(400).json({ message: 'Valid real OPD fees are required for doctors' });
      }
      if (!realEmergencyFees || realEmergencyFees <= 0) {
        return res.status(400).json({ message: 'Valid real emergency fees are required for doctors' });
      }
    }

    // Create staff member
    const staffData = {
      name,
      email,
      password,
      phone,
      role,
      hospitalId: targetHospitalId,
      departmentId
    };

    // Add doctor-specific fields if role is doctor
    if (role === 'doctor') {
      staffData.specialities = specialities;
      staffData.education = education || [];
      staffData.picture = picture || '';
      staffData.otherHospitals = otherHospitals || [];
      staffData.emergencyNumber = emergencyNumber;
      staffData.address = address;
      staffData.opdFees = opdFees;
      staffData.emergencyFees = emergencyFees;
      staffData.commissionPercentage = commissionPercentage || 0;
      staffData.realOpdFees = realOpdFees;
      staffData.realEmergencyFees = realEmergencyFees;
      staffData.dailyVisitFee = dailyVisitFee || 500;
    }

    const staff = new User(staffData);
    await staff.save();

    // Update department with staff reference
    await Department.findByIdAndUpdate(
      departmentId,
      { $push: { staff: staff._id } }
    );

    const populatedStaff = await User.findById(staff._id)
      .populate('hospitalId', 'name')
      .populate('departmentId', 'name departmentType')
      .select('-password');

    res.status(201).json({
      message: 'Staff member created successfully',
      staff: populatedStaff
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server error creating staff member' });
  }
});

// Update staff
router.put('/:id', [
  authenticate,
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const staff = await User.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check permissions - handle populated hospitalId objects
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' &&
        (!req.user.hospitalId || userHospitalId !== staff.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      email,
      phone,
      // Doctor specific fields
      specialities,
      education,
      picture,
      otherHospitals,
      emergencyNumber,
      address,
      opdFees,
      emergencyFees,
      commissionPercentage,
      realOpdFees,
      realEmergencyFees,
      dailyVisitFee
    } = req.body;

    // Update fields
    if (name) staff.name = name;
    if (email) staff.email = email;
    if (phone) staff.phone = phone;

    // Update doctor-specific fields if role is doctor
    if (staff.role === 'doctor') {
      if (specialities) staff.specialities = specialities;
      if (education) staff.education = education;
      if (picture !== undefined) staff.picture = picture;
      if (otherHospitals) staff.otherHospitals = otherHospitals;
      if (emergencyNumber) staff.emergencyNumber = emergencyNumber;
      if (address) staff.address = address;
      if (opdFees) staff.opdFees = opdFees;
      if (emergencyFees) staff.emergencyFees = emergencyFees;
      if (commissionPercentage !== undefined) staff.commissionPercentage = commissionPercentage;
      if (realOpdFees) staff.realOpdFees = realOpdFees;
      if (realEmergencyFees) staff.realEmergencyFees = realEmergencyFees;
      if (dailyVisitFee !== undefined) staff.dailyVisitFee = dailyVisitFee;
    }

    await staff.save();

    const updatedStaff = await User.findById(staff._id)
      .populate('hospitalId', 'name')
      .populate('departmentId', 'name departmentType')
      .select('-password');

    res.json({
      message: 'Staff updated successfully',
      staff: updatedStaff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error updating staff' });
  }
});

// Deactivate staff
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== staff.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    staff.isActive = false;
    await staff.save();

    // Remove from department staff list
    if (staff.departmentId) {
      await Department.findByIdAndUpdate(
        staff.departmentId,
        { $pull: { staff: staff._id } }
      );
    }

    res.json({ message: 'Staff deactivated successfully' });
  } catch (error) {
    console.error('Deactivate staff error:', error);
    res.status(500).json({ message: 'Server error deactivating staff' });
  }
});

// Get doctors available for consultation
router.get('/doctors/available', authenticate, async (req, res) => {
  try {
    const { hospitalId } = req.query;

    let query = { 
      role: 'doctor',
      isActive: true 
    };

    if (hospitalId) {
      // Check hospital access - handle populated objects
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      
      if (req.user.role !== 'super_admin' && 
          (!req.user.hospitalId || userHospitalId !== hospitalId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      query.hospitalId = hospitalId;
    } else if (req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
    }

    const doctors = await User.find(query)
      .populate('hospitalId', 'name')
      .populate('departmentId', 'name')
      .select('name email phone specialities opdFees emergencyFees realOpdFees realEmergencyFees commissionPercentage')
      .sort({ name: 1 });

    res.json({ doctors });
  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({ message: 'Server error fetching available doctors' });
  }
});

// Get nurses available for assignment
router.get('/nurses/available', authenticate, async (req, res) => {
  try {
    const { hospitalId } = req.query;

    let query = { 
      role: 'nurse',
      isActive: true 
    };

    if (hospitalId) {
      // Check hospital access - handle populated objects
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      
      if (req.user.role !== 'super_admin' && 
          (!req.user.hospitalId || userHospitalId !== hospitalId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      query.hospitalId = hospitalId;
    } else if (req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
    }

    const nurses = await User.find(query)
      .populate('hospitalId', 'name')
      .populate('departmentId', 'name')
      .select('name email phone')
      .sort({ name: 1 });

    res.json({ nurses });
  } catch (error) {
    console.error('Get available nurses error:', error);
    res.status(500).json({ message: 'Server error fetching available nurses' });
  }
});

module.exports = router;
