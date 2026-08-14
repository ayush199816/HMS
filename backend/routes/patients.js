const express = require('express');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { authenticate, authorize, hospitalAccess } = require('../middleware/auth');

const router = express.Router();

// Get all patients for a hospital
router.get('/hospital/:hospitalId', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { patientType, status, page = 1, limit = 10 } = req.query;
    
    let query = { 
      hospitalId: req.params.hospitalId
    };

    if (patientType) {
      query.patientType = patientType;
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const patients = await Patient.find(query)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await Patient.countDocuments(query);

    res.json({
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error fetching patients' });
  }
});

// Get patient by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('hospitalId', 'name email phone address')
      .populate('assignedDoctorId', 'name email phone specialities opdFees emergencyFees')
      .populate('createdBy', 'name role')
      .populate('bills.paymentDetails.paidBy', 'name role');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check access permissions
    if (req.user.role === 'super_admin') {
      return res.json({ patient });
    }

    // Handle populated hospital ID objects
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    
    if (req.user.hospitalId && userHospitalId !== patient.hospitalId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Server error fetching patient' });
  }
});

// Create new patient (Receptionist only)
router.post('/', [
  authenticate,
  authorize('receptionist', 'hospital_admin', 'super_admin'),
  body('name').notEmpty().withMessage('Patient name is required'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('Age must be between 0 and 150'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('aadharNumber').matches(/^\d{12}$/).withMessage('Aadhar number must be 12 digits'),
  body('currentIssues').notEmpty().withMessage('Current issues are required'),
  body('patientType').isIn(['opd', 'emergency']).withMessage('Patient type must be OPD or Emergency'),
  body('hospitalId').notEmpty().withMessage('Hospital ID is required'),
  // body('assignedDoctorId').notEmpty().withMessage('Assigned doctor is required') // Removed - not required during registration
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      age,
      phone,
      whatsappNumber,
      aadharNumber,
      ayushmanNumber,
      govtSchemeNumber,
      dateOfBirth,
      gender,
      insuranceProvider,
      insuranceNumber,
      email,
      previousIllnessHistory,
      currentIssues,
      patientType,
      hospitalId,
      assignedDoctorId
    } = req.body;

    // Check hospital access - handle populated objects
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || userHospitalId !== hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Hospital not found' });
    }

    // Doctor assignment is not required during patient registration
    // It will be assigned when creating appointments

    // Check if patient with same Aadhar number already exists in this hospital
    const existingPatient = await Patient.findOne({ 
      aadharNumber, 
      hospitalId,
      isActive: true 
    });
    if (existingPatient) {
      return res.status(400).json({ message: 'Patient with this Aadhar number already exists in this hospital' });
    }

    // Create patient (without doctor assignment)
    console.log('Creating patient with data:', {
      name,
      age,
      phone,
      patientType,
      hospitalId
    });

    const patient = new Patient({
      name,
      age,
      phone,
      whatsappNumber: whatsappNumber || phone,
      aadharNumber,
      ayushmanNumber: ayushmanNumber || '',
      govtSchemeNumber: govtSchemeNumber || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      insuranceProvider: insuranceProvider || '',
      insuranceNumber: insuranceNumber || '',
      email: email || '',
      gender: gender || 'male',
      previousIllnessHistory: previousIllnessHistory || '',
      currentIssues,
      patientType,
      hospitalId,
      // assignedDoctorId will be set when creating appointment
      createdBy: req.user.id
    });

    console.log('Patient object before save:', {
      name: patient.name,
      patientType: patient.patientType,
      opdNumber: patient.opdNumber,
      emergencyNumber: patient.emergencyNumber
    });

    await patient.save();

    console.log('Patient saved successfully:', {
      id: patient._id,
      opdNumber: patient.opdNumber,
      emergencyNumber: patient.emergencyNumber
    });

    // Update hospital with patient reference
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { patients: patient._id } }
    );

    const populatedPatient = await Patient.findById(patient._id)
      .populate('hospitalId', 'name')
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role');

    res.status(201).json({
      message: 'Patient created successfully',
      patient: populatedPatient
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Server error creating patient' });
  }
});

// Update patient
router.put('/:id', [
  authenticate,
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('age').optional().isInt({ min: 0, max: 150 }).withMessage('Age must be between 0 and 150'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('aadharNumber').optional().matches(/^\d{12}$/).withMessage('Aadhar number must be 12 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== patient.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      age,
      phone,
      whatsappNumber,
      aadharNumber,
      ayushmanNumber,
      govtSchemeNumber,
      dateOfBirth,
      insuranceProvider,
      insuranceNumber,
      email,
      previousIllnessHistory,
      currentIssues,
      assignedDoctorId,
      gender,
      status
    } = req.body;

    // Update fields
    if (name) patient.name = name;
    if (age) patient.age = age;
    if (phone) patient.phone = phone;
    if (whatsappNumber !== undefined) patient.whatsappNumber = whatsappNumber;
    if (aadharNumber) patient.aadharNumber = aadharNumber;
    if (ayushmanNumber !== undefined) patient.ayushmanNumber = ayushmanNumber;
    if (govtSchemeNumber !== undefined) patient.govtSchemeNumber = govtSchemeNumber;
    if (dateOfBirth) patient.dateOfBirth = new Date(dateOfBirth);
    if (insuranceProvider !== undefined) patient.insuranceProvider = insuranceProvider;
    if (insuranceNumber !== undefined) patient.insuranceNumber = insuranceNumber;
    if (email !== undefined) patient.email = email;
    if (previousIllnessHistory !== undefined) patient.previousIllnessHistory = previousIllnessHistory;
    if (currentIssues) patient.currentIssues = currentIssues;
    if (assignedDoctorId) {
      // Verify doctor belongs to same hospital
      const doctor = await User.findOne({ 
        _id: assignedDoctorId, 
        role: 'doctor',
        hospitalId: patient.hospitalId,
        isActive: true 
      });
      if (!doctor) {
        return res.status(400).json({ message: 'Invalid doctor assignment' });
      }
      patient.assignedDoctorId = assignedDoctorId;
    }
    if (gender) patient.gender = gender;
    if (status) patient.status = status;

    await patient.save();

    const updatedPatient = await Patient.findById(patient._id)
      .populate('hospitalId', 'name')
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role');

    res.json({
      message: 'Patient updated successfully',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ message: 'Server error updating patient' });
  }
});

// Get patient statistics
router.get('/hospital/:hospitalId/stats', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let matchQuery = { hospitalId: req.params.hospitalId };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const stats = await Patient.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalPatients: { $sum: 1 },
          opdPatients: {
            $sum: { $cond: [{ $eq: ['$patientType', 'opd'] }, 1, 0] }
          },
          emergencyPatients: {
            $sum: { $cond: [{ $eq: ['$patientType', 'emergency'] }, 1, 0] }
          },
          registeredPatients: {
            $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] }
          },
          inConsultationPatients: {
            $sum: { $cond: [{ $eq: ['$status', 'in_consultation'] }, 1, 0] }
          },
          treatmentCompletePatients: {
            $sum: { $cond: [{ $eq: ['$status', 'treatment_complete'] }, 1, 0] }
          },
          dischargedPatients: {
            $sum: { $cond: [{ $eq: ['$status', 'discharged'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$totalPaid' },
          balanceAmount: { $sum: '$balanceAmount' }
        }
      }
    ]);

    const dailyStats = await Patient.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      stats: stats[0] || {
        totalPatients: 0,
        opdPatients: 0,
        emergencyPatients: 0,
        registeredPatients: 0,
        inConsultationPatients: 0,
        treatmentCompletePatients: 0,
        dischargedPatients: 0,
        totalRevenue: 0,
        totalPaid: 0,
        balanceAmount: 0
      },
      dailyStats
    });
  } catch (error) {
    console.error('Get patient stats error:', error);
    res.status(500).json({ message: 'Server error fetching patient statistics' });
  }
});

// Search patients
router.get('/search/hospital/:hospitalId', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { query, patientType } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    let searchQuery = {
      hospitalId: req.params.hospitalId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { aadharNumber: { $regex: query, $options: 'i' } },
        { opdNumber: { $regex: query, $options: 'i' } },
        { emergencyNumber: { $regex: query, $options: 'i' } }
      ]
    };

    if (patientType) {
      searchQuery.patientType = patientType;
    }

    const patients = await Patient.find(searchQuery)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role')
      .limit(20)
      .sort({ createdAt: -1 });

    res.json({ patients });
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ message: 'Server error searching patients' });
  }
});

module.exports = router;
