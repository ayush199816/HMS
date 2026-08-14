const express = require('express');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const FeeConfiguration = require('../models/FeeConfiguration');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get available doctors for appointment booking
router.get('/doctors', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required' });
    }

    const doctors = await User.find({
      role: 'doctor',
      hospitalId,
      isActive: true
    }).select('name email phone specialities');

    res.json({ doctors });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ message: 'Server error fetching doctors' });
  }
});

// Get patients for appointment booking
router.get('/patients', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required' });
    }

    const patients = await Patient.find({
      hospitalId,
      isActive: true
    }).select('name age phone aadharNumber');

    res.json({ patients });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error fetching patients' });
  }
});


// Get doctor's daily queue
router.get('/doctor/:doctorId/queue/:date', authenticate, async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const { type, dateRange } = req.query;
    const appointmentDate = new Date(date);

    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Check if doctor exists and belongs to the same hospital
    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isActive: true
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check hospital access
    if (req.user.role !== 'super_admin') {
      // Handle populated hospital ID objects
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      const doctorHospitalId = doctor.hospitalId._id ? doctor.hospitalId._id.toString() : doctor.hospitalId.toString();
      
      if (!req.user.hospitalId || userHospitalId !== doctorHospitalId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Build query based on appointment type and date range
    let query = { doctorId };

    // Handle different date ranges
    if (dateRange === 'upcoming') {
      // From today onwards for next 30 days
      const today = new Date(appointmentDate);
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 30);
      query.appointmentDate = {
        $gte: new Date(today).setHours(0, 0, 0, 0),
        $lte: new Date(futureDate).setHours(23, 59, 59, 999)
      };
    } else if (dateRange === 'past') {
      // Past 30 days
      const today = new Date(appointmentDate);
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 30);
      query.appointmentDate = {
        $gte: new Date(pastDate).setHours(0, 0, 0, 0),
        $lt: new Date(today).setHours(23, 59, 59, 999)
      };
    } else if (dateRange === 'all') {
      // All appointments (no date filter)
      // Just sort by date descending
    } else {
      // Default: today only
      query.appointmentDate = {
        $gte: new Date(appointmentDate).setHours(0, 0, 0, 0),
        $lt: new Date(appointmentDate).setHours(23, 59, 59, 999)
      };
    }

    // Filter by appointment type if specified
    if (type) {
      if (type === 'opd') {
        // Handle 'consultation' type as OPD appointments
        query.appointmentType = { $in: ['opd', 'consultation'] };
      } else {
        query.appointmentType = type;
      }
    }

    // Sort by appointment date (descending for 'all', ascending for others)
    const sortOrder = dateRange === 'all' ? -1 : 1;
    const queue = await Appointment.find(query)
      .populate('patientId', 'name age phone opdNumber')
      .populate('doctorId', 'name specialities')
      .sort({ appointmentDate: sortOrder, queueNumber: sortOrder });

    res.json({ 
      doctor: {
        id: doctor._id,
        name: doctor.name,
        specialities: doctor.specialities
      },
      date: appointmentDate,
      dateRange: dateRange || 'today',
      queue,
      totalPatients: queue.length
    });
  } catch (error) {
    console.error('Get doctor queue error:', error);
    res.status(500).json({ message: 'Server error fetching doctor queue' });
  }
});

// Create new appointment
router.post('/', [
  authenticate,
  authorize('receptionist', 'hospital_admin', 'super_admin'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
  body('symptoms').notEmpty().withMessage('Symptoms are required'),
  body('appointmentType').isIn(['consultation', 'follow_up', 'emergency', 'surgery', 'test']).withMessage('Invalid appointment type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      patientId,
      doctorId,
      appointmentDate,
      symptoms,
      appointmentType = 'consultation',
      notes = '',
      timeSlot,
      surgeryTypeId,
      assistantDoctorIds,
      assignedNurseIds
    } = req.body;

    // Check hospital access
    const hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify patient exists and belongs to the hospital
    console.log('Looking for patient with:', {
      patientId,
      hospitalId,
      userHospitalId: req.user.hospitalId
    });

    // First check if patient exists at all
    const anyPatient = await Patient.findOne({ _id: patientId });
    console.log('Any patient found:', anyPatient ? 'Yes' : 'No');
    if (anyPatient) {
      console.log('Patient details:', {
        id: anyPatient._id,
        name: anyPatient.name,
        hospitalId: anyPatient.hospitalId,
        isActive: anyPatient.isActive
      });
    }

    const patient = await Patient.findOne({
      _id: patientId,
      hospitalId: hospitalId
    });
    if (!patient) {
      console.log('Patient not found with hospital match');
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    console.log('Patient found successfully:', patient.name);

    // Verify doctor exists and belongs to the hospital
    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      hospitalId: hospitalId,
      isActive: true
    });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Verify assistant doctors if provided
    let assistantDoctorIdList = [];
    if (assistantDoctorIds) {
      const parsedAssistantIds = typeof assistantDoctorIds === 'string' ? JSON.parse(assistantDoctorIds) : assistantDoctorIds;
      
      const assistantDoctors = await User.find({
        _id: { $in: Array.isArray(parsedAssistantIds) ? parsedAssistantIds : [parsedAssistantIds] },
        hospitalId: hospitalId,
        role: 'doctor',
        isActive: true
      });

      if (assistantDoctors.length === 0) {
        return res.status(404).json({ message: 'No valid assistant doctors found' });
      }

      assistantDoctorIdList = assistantDoctors.map(d => d._id);
    }

    // Verify nurses if provided
    let nurseIdList = [];
    if (assignedNurseIds) {
      const parsedNurseIds = typeof assignedNurseIds === 'string' ? JSON.parse(assignedNurseIds) : assignedNurseIds;
      
      const nurses = await User.find({
        _id: { $in: Array.isArray(parsedNurseIds) ? parsedNurseIds : [parsedNurseIds] },
        hospitalId: hospitalId,
        role: 'nurse',
        isActive: true
      });

      if (nurses.length === 0) {
        return res.status(404).json({ message: 'No valid nurses found' });
      }

      nurseIdList = nurses.map(n => n._id);
    }

    // Check if patient already has an appointment with this doctor on the same date
    const existingAppointment = await Appointment.findOne({
      patientId,
      doctorId,
      appointmentDate: {
        $gte: new Date(appointmentDate).setHours(0, 0, 0, 0),
        $lt: new Date(appointmentDate).setHours(23, 59, 59, 999)
      },
      status: { $ne: 'cancelled' }
    });

    if (existingAppointment) {
      return res.status(400).json({ 
        message: 'Patient already has an appointment with this doctor on the same date' 
      });
    }

    // Calculate consultation fee automatically
    let calculatedFee = 0;
    
    if (appointmentType === 'surgery' && surgeryTypeId) {
      // Calculate surgery fee
      calculatedFee = await FeeConfiguration.calculateSurgeryFee(hospitalId, doctorId, surgeryTypeId);
    } else {
      // Calculate consultation fee using doctor-specific fees
      calculatedFee = await FeeConfiguration.calculateConsultationFee(hospitalId, appointmentType, doctorId);
    }

    console.log(`Calculated fee for ${appointmentType}: ${calculatedFee}`);

    // Create appointment
    const appointment = new Appointment({
      patientId,
      doctorId,
      hospitalId,
      appointmentDate: new Date(appointmentDate),
      symptoms,
      consultationFee: calculatedFee,
      appointmentType,
      notes,
      timeSlot: timeSlot || { start: null, end: null },
      assistantDoctorIds: assistantDoctorIdList,
      assignedNurseIds: nurseIdList,
      createdBy: req.user.id,
      // Don't set paymentMethod initially - will be set during payment processing
      paymentMethod: undefined
    });

    await appointment.save();

    // Update patient with OPD number if they don't have one
    if (!patient.opdNumber) {
      await patient.assignVisitNumber();
    }

    // Populate appointment details for response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patientId', 'name age phone aadharNumber')
      .populate('doctorId', 'name specialities')
      .populate('hospitalId', 'name')
      .populate('createdBy', 'name role');

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: populatedAppointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Server error creating appointment' });
  }
});

// Get appointments (with filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      date,
      doctorId,
      patientId,
      status,
      page = 1,
      limit = 20
    } = req.query;

    let query = {};

    // Hospital filter
    if (req.user.role !== 'super_admin') {
      query.hospitalId = req.user.hospitalId;
    }

    // Date filter
    if (date) {
      const targetDate = new Date(date);
      query.appointmentDate = {
        $gte: new Date(targetDate).setHours(0, 0, 0, 0),
        $lt: new Date(targetDate).setHours(23, 59, 59, 999)
      };
    }

    // Doctor filter
    if (doctorId) {
      query.doctorId = doctorId;
    }

    // Patient filter
    if (patientId) {
      query.patientId = patientId;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name age phone')
      .populate('doctorId', 'name specialities')
      .populate('hospitalId', 'name')
      .sort({ appointmentDate: 1, queueNumber: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.json({
      appointments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Server error fetching appointments' });
  }
});

// Update appointment status
router.patch('/:id/status', [
  authenticate,
  authorize('receptionist', 'hospital_admin', 'super_admin', 'doctor'),
  body('status').if(body('status').exists()).isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, paymentStatus, paymentMethod, paymentAmount } = req.body;

    console.log('Appointment status update request:', {
      id,
      body: req.body,
      status,
      paymentStatus,
      paymentMethod,
      paymentAmount
    });

    const appointment = await Appointment.findById(id)
      .populate('patientId', 'name')
      .populate('doctorId', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check permissions - simplified for payment updates
    if (req.user.role !== 'super_admin') {
      // Extract user hospital ID properly (handle populated object)
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      const appointmentHospitalId = appointment.hospitalId.toString();

      if (!req.user.hospitalId || userHospitalId !== appointmentHospitalId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Only update status if provided
    if (status) {
      appointment.status = status;
    }
    
    // Update payment information if provided
    if (paymentStatus) {
      appointment.paymentStatus = paymentStatus;
    }
    if (paymentMethod) {
      appointment.paymentMethod = paymentMethod;
    }
    if (paymentAmount) {
      appointment.paymentAmount = paymentAmount;
    }
    
    await appointment.save();

    // Create bill in Bill collection when payment is marked as paid
    // Only for OPD and Emergency appointments, NOT for surgery (surgery bills are created by billing department)
    if (paymentStatus === 'paid' && paymentAmount > 0 && !appointment.billId && appointment.appointmentType !== 'surgery') {
      const Bill = require('../models/Bill');
      const generateBillNumber = () => `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const bill = new Bill({
        billNumber: generateBillNumber(),
        patientId: appointment.patientId._id,
        amount: paymentAmount,
        description: `Appointment - ${appointment.appointmentType} (${appointment.patientId.name})`,
        type: appointment.appointmentType,
        referenceId: appointment._id,
        hospitalId: appointment.hospitalId,
        createdBy: req.user._id,
        status: 'paid',
        billDate: new Date(),
        paymentDetails: {
          paymentMethod: paymentMethod,
          utrNumber: req.body.utrNumber || null
        },
        items: [{
          name: `${appointment.appointmentType} Consultation`,
          quantity: 1,
          price: paymentAmount,
          total: paymentAmount
        }],
        paymentSources: [{
          sourceType: 'patient',
          amount: paymentAmount,
          paymentDate: new Date(),
          referenceNumber: req.body.utrNumber || null,
          paymentMethod: paymentMethod
        }]
      });
      
      await bill.save();
      
      // Link bill to appointment
      appointment.billId = bill._id;
      await appointment.save();
    }

    res.json({
      message: 'Appointment status updated successfully',
      appointment
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({ message: 'Server error updating appointment status' });
  }
});

// Cancel appointment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin') {
      if (!req.user.hospitalId || req.user.hospitalId.toString() !== appointment.hospitalId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ message: 'Server error cancelling appointment' });
  }
});

// Generate PDF bill for appointment
router.get('/:id/bill-pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('patientId')
      .populate('doctorId')
      .populate('hospitalId')
      .populate('billId')
      .populate('createdBy');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check hospital access
    if (req.user.role !== 'super_admin') {
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      const appointmentHospitalId = appointment.hospitalId._id ? appointment.hospitalId._id.toString() : appointment.hospitalId.toString();

      if (!req.user.hospitalId || userHospitalId !== appointmentHospitalId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { generateAppointmentBillPDF } = require('../utils/generateAppointmentBillPDF');

    const pdfBuffer = await generateAppointmentBillPDF(
      appointment,
      appointment.hospitalId,
      appointment.patientId,
      appointment.doctorId,
      appointment.billId,
      appointment.createdBy
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=appointment-bill-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate appointment bill PDF error:', error);
    res.status(500).json({ message: 'Server error generating PDF bill' });
  }
});

// Generate prescription PDF for appointment
router.get('/:id/prescription-pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('patientId')
      .populate('doctorId')
      .populate('hospitalId');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check hospital access
    if (req.user.role !== 'super_admin') {
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      const appointmentHospitalId = appointment.hospitalId._id ? appointment.hospitalId._id.toString() : appointment.hospitalId.toString();

      if (!req.user.hospitalId || userHospitalId !== appointmentHospitalId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { generateAppointmentPrescriptionPDF } = require('../utils/generateAppointmentPrescriptionPDF');
    const pdfBuffer = await generateAppointmentPrescriptionPDF(
      appointment,
      appointment.hospitalId,
      appointment.patientId,
      appointment.doctorId
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prescription-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate prescription PDF error:', error);
    res.status(500).json({ message: 'Server error generating prescription PDF' });
  }
});

module.exports = router;
