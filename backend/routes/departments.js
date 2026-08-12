const express = require('express');
const { body, validationResult } = require('express-validator');
const Department = require('../models/Department');
const User = require('../models/User');
const { authenticate, authorize, hospitalAccess } = require('../middleware/auth');

const router = express.Router();

// Get all departments for a hospital
router.get('/hospital/:hospitalId', authenticate, hospitalAccess, async (req, res) => {
  try {
    const departments = await Department.find({ 
      hospitalId: req.params.hospitalId,
      isActive: true 
    })
    .populate('headOfDepartment', 'name email phone')
    .populate('staff', 'name role email phone')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error fetching departments' });
  }
});

// Get department by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('hospitalId', 'name email phone')
      .populate('headOfDepartment', 'name email phone')
      .populate('staff', 'name role email phone')
      .populate('createdBy', 'name email');

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check access permissions
    if (req.user.role === 'super_admin') {
      return res.json({ department });
    }

    if (req.user.hospitalId && req.user.hospitalId.toString() !== department.hospitalId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ department });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ message: 'Server error fetching department' });
  }
});

// Create new department (Hospital Admin only)
router.post('/', [
  authenticate,
  body('name').notEmpty().withMessage('Department name is required'),
  body('departmentType').isIn(['medical', 'diagnostic', 'pharmacy', 'billing', 'administrative', 'emergency']).withMessage('Invalid department type'),
  body('hospitalId').notEmpty().withMessage('Hospital ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, hospitalId, departmentType } = req.body;

    // Check if user is authorized to create departments
    if (req.user.role !== 'super_admin' && req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Access denied. Only hospital admins can create departments.' });
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
      
      console.log('Hospital Admin creating department:', {
        userHospitalId: req.user.hospitalId,
        userHospitalObjectId,
        targetHospitalId,
        originalHospitalId: hospitalId
      });
    }

    // For super admin, validate the provided hospitalId
    if (req.user.role === 'super_admin' && !hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required for super admin.' });
    }

    // Check if department already exists in this hospital
    const existingDepartment = await Department.findOne({
      name: name.trim(),
      hospitalId: targetHospitalId,
      isActive: true
    });

    if (existingDepartment) {
      return res.status(400).json({ message: 'Department with this name already exists in this hospital' });
    }

    // Create department
    const department = new Department({
      name: name.trim(),
      description: description || '',
      hospitalId: targetHospitalId,
      departmentType,
      createdBy: req.user.id
    });

    await department.save();

    // Update hospital with department reference
    const Hospital = require('../models/Hospital');
    await Hospital.findByIdAndUpdate(
      targetHospitalId,
      { $push: { departments: department._id } }
    );

    const populatedDepartment = await Department.findById(department._id)
      .populate('hospitalId', 'name')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Department created successfully',
      department: populatedDepartment
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Server error creating department' });
  }
});

// Update department
router.put('/:id', [
  authenticate,
  body('name').optional().notEmpty().withMessage('Department name cannot be empty'),
  body('departmentType').optional().isIn(['medical', 'diagnostic', 'pharmacy', 'billing', 'administrative', 'emergency']).withMessage('Invalid department type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if user is authorized to update departments
    if (req.user.role !== 'super_admin' && req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Access denied. Only hospital admins can update departments.' });
    }

    // Check hospital access for hospital admin
    if (req.user.role === 'hospital_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== department.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied. You can only update departments for your own hospital.' });
    }

    const { name, description, departmentType, headOfDepartment } = req.body;

    // Update fields
    if (name) department.name = name.trim();
    if (description !== undefined) department.description = description;
    if (departmentType) department.departmentType = departmentType;
    if (headOfDepartment) department.headOfDepartment = headOfDepartment;

    await department.save();

    const updatedDepartment = await Department.findById(department._id)
      .populate('hospitalId', 'name')
      .populate('headOfDepartment', 'name email phone');

    res.json({
      message: 'Department updated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Server error updating department' });
  }
});

// Deactivate department
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if user is authorized to delete departments
    if (req.user.role !== 'super_admin' && req.user.role !== 'hospital_admin') {
      return res.status(403).json({ message: 'Access denied. Only hospital admins can delete departments.' });
    }

    // Check hospital access for hospital admin
    if (req.user.role === 'hospital_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== department.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied. You can only delete departments for your own hospital.' });
    }

    department.isActive = false;
    await department.save();

    // Deactivate all staff in this department
    await User.updateMany(
      { departmentId: req.params.id },
      { isActive: false }
    );

    res.json({ message: 'Department deactivated successfully' });
  } catch (error) {
    console.error('Deactivate department error:', error);
    res.status(500).json({ message: 'Server error deactivating department' });
  }
});

// Get staff in department
router.get('/:id/staff', authenticate, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== department.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const staff = await User.find({ 
      departmentId: req.params.id,
      isActive: true 
    })
    .select('-password')
    .sort({ name: 1 });

    res.json({ staff });
  } catch (error) {
    console.error('Get department staff error:', error);
    res.status(500).json({ message: 'Server error fetching department staff' });
  }
});

module.exports = router;
