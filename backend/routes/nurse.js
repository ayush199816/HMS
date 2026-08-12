const express = require('express');
const router = express.Router();
const Admission = require('../models/Admission');
const Bed = require('../models/Bed');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// Get nurse dashboard data
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const nurseId = req.user.id;
    const hospitalId = req.user.hospitalId;

    // Get all beds in the hospital
    const allBeds = await Bed.find({ hospitalId })
      .populate('currentAdmission', 'patientId admissionDate')
      .populate('currentAdmission.patientId', 'name phone age gender')
      .sort({ wardType: 1, bedNumber: 1 });

    // Get beds assigned to this nurse
    const assignedBeds = await Bed.find({
      hospitalId,
      assignedNurses: nurseId
    })
      .populate('currentAdmission', 'patientId admissionDate')
      .populate('currentAdmission.patientId', 'name phone age gender')
      .sort({ wardType: 1, bedNumber: 1 });

    // Get admissions where this nurse is assigned
    const admissions = await Admission.find({
      hospitalId,
      assignedNurses: nurseId,
      status: 'admitted'
    })
      .populate('patientId', 'name phone age gender opdNumber')
      .populate('doctorIds', 'name')
      .populate('bedId', 'bedNumber wardType floor roomNumber')
      .sort({ admissionDate: -1 });

    // Get OPD appointments for today assigned to this nurse's department
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get nurse's department
    const nurse = await User.findById(nurseId);
    const opdAppointments = await Appointment.find({
      hospitalId,
      departmentId: nurse.departmentId,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'scheduled'
    })
      .populate('patientId', 'name phone age gender')
      .populate('doctorId', 'name')
      .sort({ appointmentTime: 1 });

    // Get surgeries assigned to this nurse (using admissions with surgery-related data)
    // For now, we'll use admissions as a proxy for surgeries
    const surgeries = await Admission.find({
      hospitalId,
      assignedNurses: nurseId,
      status: 'admitted',
      admissionReason: { $regex: /surgery|operation/i }
    })
      .populate('patientId', 'name phone age gender')
      .populate('doctorIds', 'name')
      .sort({ admissionDate: -1 });

    res.json({
      allBeds,
      assignedBeds,
      admissions,
      opdAppointments,
      surgeries
    });
  } catch (error) {
    console.error('Get nurse dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add vital report for a patient
router.post('/vitals/:admissionId', authenticate, async (req, res) => {
  try {
    const { admissionId } = req.params;
    const {
      temperature,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      notes
    } = req.body;

    const admission = await Admission.findOne({
      _id: admissionId,
      hospitalId: req.user.hospitalId,
      assignedNurses: req.user.id
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found or you are not assigned to this patient' });
    }

    admission.vitalReports.push({
      temperature,
      bloodPressure: {
        systolic: bloodPressureSystolic,
        diastolic: bloodPressureDiastolic
      },
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      notes,
      recordedBy: req.user.id
    });

    await admission.save();
    await admission.populate('vitalReports.recordedBy', 'name');

    res.json({ admission });
  } catch (error) {
    console.error('Add vital report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get vital reports for a patient
router.get('/vitals/:admissionId', authenticate, async (req, res) => {
  try {
    const { admissionId } = req.params;

    const admission = await Admission.findOne({
      _id: admissionId,
      hospitalId: req.user.hospitalId,
      assignedNurses: req.user.id
    })
      .populate('vitalReports.recordedBy', 'name');

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found or you are not assigned to this patient' });
    }

    res.json({ vitalReports: admission.vitalReports });
  } catch (error) {
    console.error('Get vital reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
