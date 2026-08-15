const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Department = require('../models/Department');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Login route
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        hospitalId: user.hospitalId,
        departmentId: user.departmentId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('hospitalId', 'name email phone address')
      .populate('departmentId', 'name description')
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Debug: Log user object structure for hospital admin
    if (user.role === 'hospital_admin') {
      console.log('Hospital Admin User Object:', {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalIdType: typeof user.hospitalId,
        hospitalIdString: user.hospitalId?.toString(),
        departmentId: user.departmentId,
        isActive: user.isActive
      });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        hospitalId: user.hospitalId,
        departmentId: user.departmentId,
        isActive: user.isActive,
        // Include doctor-specific fields if applicable
        ...(user.role === 'doctor' && {
          specialities: user.specialities,
          education: user.education,
          opdFees: user.opdFees,
          emergencyFees: user.emergencyFees,
          commissionPercentage: user.commissionPercentage
        })
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error fetching user data' });
  }
});

// Create Super Admin (for initial setup)
router.post('/create-super-admin', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return res.status(400).json({ message: 'Super admin already exists' });
    }

    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create super admin
    const superAdmin = new User({
      name,
      email,
      password,
      phone,
      role: 'super_admin'
    });

    await superAdmin.save();

    // Generate token
    const token = generateToken(superAdmin._id);

    // Remove password from response
    superAdmin.password = undefined;

    res.status(201).json({
      message: 'Super admin created successfully',
      token,
      user: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
        phone: superAdmin.phone
      }
    });
  } catch (error) {
    console.error('Create super admin error:', error);
    res.status(500).json({ message: 'Server error creating super admin' });
  }
});

// Create Hospital Admin (by Super Admin only)
router.post('/create-hospital-admin', [
  authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('hospitalId').notEmpty().withMessage('Hospital ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is super admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admin can create hospital admin' });
    }

    const { name, email, password, phone, hospitalId } = req.body;

    // Check if hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create hospital admin
    const hospitalAdmin = new User({
      name,
      email,
      password,
      phone,
      role: 'hospital_admin',
      hospitalId
    });

    await hospitalAdmin.save();

    // Remove password from response
    hospitalAdmin.password = undefined;

    res.status(201).json({
      message: 'Hospital admin created successfully',
      user: hospitalAdmin
    });
  } catch (error) {
    console.error('Create hospital admin error:', error);
    res.status(500).json({ message: 'Server error creating hospital admin' });
  }
});

// Change password
router.post('/change-password', [
  authenticate,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

// Create Doctor (by Hospital Admin only)
router.post('/create-doctor', [
  authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('specialities').isArray().withMessage('Specialities must be an array'),
  body('departmentId').notEmpty().withMessage('Department ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is hospital admin
    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Only hospital admin can create doctors' });
    }

    const { name, email, password, phone, specialities, departmentId, education, opdFees, emergencyFees, commissionPercentage } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create doctor
    const doctor = new User({
      name,
      email,
      password,
      phone,
      role: 'doctor',
      hospitalId: req.user.hospitalId,
      departmentId,
      specialities,
      education: education || [],
      opdFees: opdFees || 500,
      emergencyFees: emergencyFees || 1000,
      commissionPercentage: commissionPercentage || 10
    });

    await doctor.save();

    // Remove password from response
    doctor.password = undefined;

    res.status(201).json({
      message: 'Doctor created successfully',
      user: doctor
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({ message: 'Server error creating doctor' });
  }
});

// Create Pathology Lab User (by Hospital Admin only)
router.post('/create-pathology-user', [
  authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('departmentId').notEmpty().withMessage('Department ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is hospital admin
    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Only hospital admin can create pathology lab users' });
    }

    const { name, email, password, phone, departmentId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create pathology lab user
    const pathologyUser = new User({
      name,
      email,
      password,
      phone,
      role: 'pathologist',
      hospitalId: req.user.hospitalId,
      departmentId
    });

    await pathologyUser.save();

    // Remove password from response
    pathologyUser.password = undefined;

    res.status(201).json({
      message: 'Pathology lab user created successfully',
      user: pathologyUser
    });
  } catch (error) {
    console.error('Create pathology user error:', error);
    res.status(500).json({ message: 'Server error creating pathology lab user' });
  }
});

// Create Staff User (by Hospital Admin only)
router.post('/create-staff', [
  authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('role').isIn(['receptionist', 'nurse', 'billing_staff', 'pharmacist']).withMessage('Invalid role'),
  body('departmentId').notEmpty().withMessage('Department ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is hospital admin
    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Only hospital admin can create staff users' });
    }

    const { name, email, password, phone, role, departmentId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create staff user
    const staffUser = new User({
      name,
      email,
      password,
      phone,
      role,
      hospitalId: req.user.hospitalId,
      departmentId
    });

    await staffUser.save();

    // Remove password from response
    staffUser.password = undefined;

    res.status(201).json({
      message: 'Staff user created successfully',
      user: staffUser
    });
  } catch (error) {
    console.error('Create staff user error:', error);
    res.status(500).json({ message: 'Server error creating staff user' });
  }
});

// Get all users for hospital admin
router.get('/users', authenticate, async (req, res) => {
  try {
    // Check if user is hospital admin
    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Only hospital admin can view users' });
    }

    const { page = 1, limit = 10, search, role } = req.query;
    const skip = (page - 1) * limit;

    let query = { hospitalId: req.user.hospitalId };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .populate('departmentId', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Update user status (activate/deactivate)
router.put('/users/:id/status', authenticate, async (req, res) => {
  try {
    // Check if user is hospital admin
    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Only hospital admin can update user status' });
    }

    const { isActive } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
});

// Deactivate user (hospital admin/super admin)
router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    const userHospitalId = req.user.hospitalId?._id
      ? req.user.hospitalId._id.toString()
      : req.user.hospitalId?.toString();
    if (req.user.role !== 'super_admin' &&
        (!userHospitalId || userHospitalId !== user.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    user.isActive = false;
    await user.save();

    // Remove from department staff list
    if (user.departmentId) {
      await Department.findByIdAndUpdate(
        user.departmentId,
        { $pull: { staff: user._id } }
      );
    }

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Server error deactivating user' });
  }
});

module.exports = router;
