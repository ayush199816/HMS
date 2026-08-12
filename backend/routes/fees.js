const express = require('express');
const { body, validationResult } = require('express-validator');
const FeeConfiguration = require('../models/FeeConfiguration');
const Appointment = require('../models/Appointment');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get hospital fee configuration
router.get('/configuration', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required' });
    }

    let feeConfig = await FeeConfiguration.findOne({ hospitalId })
      .populate('doctorSurgeryFees.doctorId', 'name email')
      .populate('doctorSurgeryFees.surgeryTypeId', 'name category baseFee')
      .populate('discountRequests.requestedBy', 'name role')
      .populate('discountRequests.approvedBy', 'name role')
      .populate('discountRequests.appointmentId', 'consultationFee appointmentDate');

    if (!feeConfig) {
      // Create default configuration if not exists
      feeConfig = new FeeConfiguration({
        hospitalId,
        feeTypes: {
          opdConsultation: 500,
          emergencyConsultation: 1000,
          followUpConsultation: 300
        },
        surgeryTypes: [
          {
            name: 'General Surgery',
            category: 'general',
            baseFee: 15000,
            description: 'Basic surgical procedures'
          },
          {
            name: 'Appendectomy',
            category: 'general',
            baseFee: 25000,
            description: 'Appendix removal surgery'
          },
          {
            name: 'Gallbladder Removal',
            category: 'general',
            baseFee: 35000,
            description: 'Laparoscopic cholecystectomy'
          }
        ],
        createdBy: req.user.id
      });
      
      await feeConfig.save();
    }

    res.json({ feeConfiguration: feeConfig });
  } catch (error) {
    console.error('Get fee configuration error:', error);
    res.status(500).json({ message: 'Server error fetching fee configuration' });
  }
});

// Update consultation fees
router.patch('/consultation-fees', [
  authenticate,
  authorize('hospital_admin', 'super_admin'),
  body('opdConsultation').isNumeric().withMessage('OPD consultation fee must be a number'),
  body('emergencyConsultation').isNumeric().withMessage('Emergency consultation fee must be a number'),
  body('followUpConsultation').isNumeric().withMessage('Follow-up consultation fee must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { opdConsultation, emergencyConsultation, followUpConsultation } = req.body;
    const hospitalId = req.user.hospitalId;

    let feeConfig = await FeeConfiguration.findOne({ hospitalId });
    
    if (!feeConfig) {
      feeConfig = new FeeConfiguration({
        hospitalId,
        feeTypes: { opdConsultation, emergencyConsultation, followUpConsultation },
        createdBy: req.user.id
      });
    } else {
      feeConfig.feeTypes = { opdConsultation, emergencyConsultation, followUpConsultation };
    }

    await feeConfig.save();

    res.json({
      message: 'Consultation fees updated successfully',
      feeTypes: feeConfig.feeTypes
    });
  } catch (error) {
    console.error('Update consultation fees error:', error);
    res.status(500).json({ message: 'Server error updating consultation fees' });
  }
});

// Add surgery type
router.post('/surgery-types', [
  authenticate,
  authorize('hospital_admin', 'super_admin'),
  body('name').notEmpty().withMessage('Surgery name is required'),
  body('category').isIn(['general', 'cardiac', 'orthopedic', 'neuro', 'cosmetic', 'pediatric', 'gynecological', 'urological', 'eye', 'ent']).withMessage('Invalid surgery category'),
  body('baseFee').isNumeric().withMessage('Base fee must be a number'),
  body('description').notEmpty().withMessage('Description is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, baseFee, description, estimatedDuration = '' } = req.body;
    const hospitalId = req.user.hospitalId;

    let feeConfig = await FeeConfiguration.findOne({ hospitalId });
    
    if (!feeConfig) {
      feeConfig = new FeeConfiguration({
        hospitalId,
        surgeryTypes: [],
        createdBy: req.user.id
      });
    }

    // Check if surgery type already exists
    const existingSurgery = feeConfig.surgeryTypes.find(surgery => 
      surgery.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSurgery) {
      return res.status(400).json({ message: 'Surgery type with this name already exists' });
    }

    feeConfig.surgeryTypes.push({
      name,
      category,
      baseFee,
      description,
      estimatedDuration
    });

    await feeConfig.save();

    res.status(201).json({
      message: 'Surgery type added successfully',
      surgeryType: feeConfig.surgeryTypes[feeConfig.surgeryTypes.length - 1]
    });
  } catch (error) {
    console.error('Add surgery type error:', error);
    res.status(500).json({ message: 'Server error adding surgery type' });
  }
});

// Update doctor surgery fees
router.post('/doctor-surgery-fees', [
  authenticate,
  authorize('doctor', 'hospital_admin', 'super_admin'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('surgeryTypeId').notEmpty().withMessage('Surgery type ID is required'),
  body('customFee').isNumeric().withMessage('Custom fee must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { doctorId, surgeryTypeId, customFee } = req.body;
    const hospitalId = req.user.hospitalId;

    // Check permissions (doctors can only set their own fees)
    if (req.user.role === 'doctor' && req.user.id !== doctorId) {
      return res.status(403).json({ message: 'Doctors can only set their own surgery fees' });
    }

    let feeConfig = await FeeConfiguration.findOne({ hospitalId });
    
    if (!feeConfig) {
      return res.status(404).json({ message: 'Fee configuration not found' });
    }

    // Remove existing fee for this doctor and surgery type
    feeConfig.doctorSurgeryFees = feeConfig.doctorSurgeryFees.filter(fee => 
      !(fee.doctorId.toString() === doctorId && fee.surgeryTypeId.toString() === surgeryTypeId)
    );

    // Add new fee
    feeConfig.doctorSurgeryFees.push({
      doctorId,
      surgeryTypeId,
      customFee,
      effectiveFrom: new Date()
    });

    await feeConfig.save();

    res.status(201).json({
      message: 'Doctor surgery fee updated successfully',
      doctorSurgeryFee: feeConfig.doctorSurgeryFees[feeConfig.doctorSurgeryFees.length - 1]
    });
  } catch (error) {
    console.error('Update doctor surgery fee error:', error);
    res.status(500).json({ message: 'Server error updating doctor surgery fee' });
  }
});

// Calculate appointment fee
router.post('/calculate', authenticate, async (req, res) => {
  try {
    const { appointmentType, doctorId, surgeryTypeId } = req.body;
    const hospitalId = req.user.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required' });
    }

    let calculatedFee = 0;

    if (appointmentType === 'surgery' && surgeryTypeId) {
      // Calculate surgery fee
      calculatedFee = await FeeConfiguration.calculateSurgeryFee(hospitalId, doctorId, surgeryTypeId);
    } else {
      // Calculate consultation fee using doctor-specific fees
      calculatedFee = await FeeConfiguration.calculateConsultationFee(hospitalId, appointmentType, doctorId);
    }

    res.json({
      appointmentType,
      calculatedFee,
      hospitalId,
      doctorId
    });
  } catch (error) {
    console.error('Calculate fee error:', error);
    res.status(500).json({ message: 'Server error calculating fee' });
  }
});

// Request discount
router.post('/discount-request', [
  authenticate,
  authorize('receptionist', 'hospital_admin', 'super_admin'),
  body('appointmentId').notEmpty().withMessage('Appointment ID is required'),
  body('discountPercentage').isNumeric().withMessage('Discount percentage must be a number'),
  body('reason').notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentId, discountPercentage, reason } = req.body;
    const hospitalId = req.user.hospitalId;

    // Get appointment details
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check hospital access
    if (appointment.hospitalId.toString() !== hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await FeeConfiguration.createDiscountRequest(
      hospitalId,
      appointmentId,
      req.user.id,
      appointment.consultationFee,
      discountPercentage,
      reason
    );

    res.json({
      message: 'Discount request processed',
      ...result
    });
  } catch (error) {
    console.error('Discount request error:', error);
    res.status(500).json({ message: 'Server error processing discount request' });
  }
});

// Get pending discount requests
router.get('/discount-requests', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { status = 'pending' } = req.query;

    const feeConfig = await FeeConfiguration.findOne({ hospitalId })
      .populate('discountRequests.requestedBy', 'name role')
      .populate('discountRequests.approvedBy', 'name role')
      .populate('discountRequests.appointmentId', 'consultationFee appointmentDate');

    if (!feeConfig) {
      return res.json({ discountRequests: [] });
    }

    const filteredRequests = feeConfig.discountRequests.filter(request => 
      request.status === status
    );

    res.json({ discountRequests: filteredRequests });
  } catch (error) {
    console.error('Get discount requests error:', error);
    res.status(500).json({ message: 'Server error fetching discount requests' });
  }
});

// Process discount request (approve/reject)
router.patch('/discount-requests/:requestId', [
  authenticate,
  authorize('hospital_admin', 'super_admin'),
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('rejectionReason').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { status, rejectionReason = '' } = req.body;
    const hospitalId = req.user.hospitalId;

    const request = await FeeConfiguration.processDiscountRequest(
      hospitalId,
      requestId,
      req.user.id,
      status,
      rejectionReason
    );

    // If approved, update appointment fee
    if (status === 'approved') {
      const appointment = await Appointment.findById(request.appointmentId);
      if (appointment) {
        appointment.consultationFee = request.finalAmount;
        await appointment.save();
      }
    }

    res.json({
      message: `Discount request ${status} successfully`,
      discountRequest: request
    });
  } catch (error) {
    console.error('Process discount request error:', error);
    res.status(500).json({ message: 'Server error processing discount request' });
  }
});

// Get available surgery types
router.get('/surgery-types', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    
    const surgeryTypes = await FeeConfiguration.getAvailableSurgeryTypes(hospitalId);
    
    res.json({ surgeryTypes });
  } catch (error) {
    console.error('Get surgery types error:', error);
    res.status(500).json({ message: 'Server error fetching surgery types' });
  }
});

// Get doctor surgery fees
router.get('/doctor-surgery-fees/:doctorId', authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const hospitalId = req.user.hospitalId;
    
    const doctorFees = await FeeConfiguration.getDoctorSurgeryFees(hospitalId, doctorId);
    
    res.json({ doctorFees });
  } catch (error) {
    console.error('Get doctor surgery fees error:', error);
    res.status(500).json({ message: 'Server error fetching doctor surgery fees' });
  }
});

module.exports = router;
