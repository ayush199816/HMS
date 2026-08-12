const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const { authenticate } = require('../middleware/auth');
const { cloudinary, storage } = require('../config/cloudinary');

const router = express.Router();

// Configure multer for file uploads using Cloudinary
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'), false);
    }
  }
});

// Helper function to check hospital access
const checkHospitalAccess = (user, recordHospitalId) => {
  if (user.role === 'super_admin') return true;
  
  const userHospitalId = user.hospitalId._id ? user.hospitalId._id.toString() : user.hospitalId.toString();
  const recordHospitalIdStr = recordHospitalId._id ? recordHospitalId._id.toString() : recordHospitalId.toString();
  
  return userHospitalId === recordHospitalIdStr;
};

// PRESCRIPTION ENDPOINTS

// Create new prescription (both form-based and image-based)
router.post('/prescriptions', authenticate, upload.single('file'), [
  body('type').isIn(['form', 'image']).withMessage('Invalid prescription type'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('appointmentId').notEmpty().withMessage('Appointment ID is required'),
  body('generalInstructions').optional().isString(),
  body('followUpDate').optional().isISO8601().withMessage('Invalid follow-up date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, patientId, doctorId, appointmentId, generalInstructions, followUpDate } = req.body;
    
    // Verify doctor authorization
    if (req.user.role !== 'super_admin' && req.user.id !== doctorId) {
      return res.status(403).json({ message: 'Unauthorized to create prescription for this doctor' });
    }

    let prescriptionData = {
      type,
      patientId,
      doctorId,
      appointmentId,
      generalInstructions: generalInstructions || '',
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      hospitalId: req.user.hospitalId
    };

    if (type === 'image') {
      // Handle image-based prescription
      if (!req.file) {
        return res.status(400).json({ message: 'Prescription file is required for image-based prescriptions' });
      }
      
      // Use Cloudinary URL from uploaded file
      prescriptionData.prescriptionFile = req.file.path;
    } else {
      // Handle form-based prescription
      const medicines = req.body.medicines;
      
      // Validate medicines array
      if (!Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ message: 'At least one medicine is required for form-based prescriptions' });
      }
      
      prescriptionData.medicines = medicines;
    }

    const prescription = new Prescription(prescriptionData);
    await prescription.save();

    // Populate related data for response
    await prescription.populate([
      { path: 'patientId', select: 'name opdNumber phone' },
      { path: 'doctorId', select: 'name specialities' },
      { path: 'appointmentId', select: 'appointmentDate status' }
    ]);

    res.status(201).json({
      message: 'Prescription created successfully',
      prescription
    });

  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ message: 'Server error creating prescription' });
  }
});

// Get prescriptions for a patient
router.get('/patient/:patientId/prescriptions', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const prescriptions = await Prescription.find({ 
      patientId,
      status: { $ne: 'deleted' }
    })
    .populate('doctorId', 'name specialities')
    .populate('appointmentId', 'appointmentDate status')
    .sort({ createdAt: -1 });

    // Check hospital access
    if (prescriptions.length > 0 && !checkHospitalAccess(req.user, prescriptions[0].hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      prescriptions
    });

  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ message: 'Server error fetching prescriptions' });
  }
});

// Get prescription by ID
router.get('/prescriptions/:id', authenticate, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patientId', 'name opdNumber phone')
      .populate('doctorId', 'name specialities')
      .populate('appointmentId', 'appointmentDate status');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check hospital access
    if (!checkHospitalAccess(req.user, prescription.hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      prescription
    });

  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({ message: 'Server error fetching prescription' });
  }
});

// Update prescription status
router.patch('/prescriptions/:id/status', authenticate, [
  body('status').isIn(['active', 'completed', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check hospital access
    if (!checkHospitalAccess(req.user, prescription.hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    prescription.status = req.body.status;
    await prescription.save();

    res.json({
      message: 'Prescription status updated successfully',
      prescription
    });

  } catch (error) {
    console.error('Update prescription status error:', error);
    res.status(500).json({ message: 'Server error updating prescription status' });
  }
});

// MEDICAL RECORDS ENDPOINTS

// Upload medical record (pathology, xray, ct, ultrasound, mri, ecg, surgery)
router.post('/upload', authenticate, upload.single('file'), [
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('appointmentId').notEmpty().withMessage('Appointment ID is required'),
  body('recordType').isIn(['pathology', 'xray', 'ct', 'ultrasound', 'mri', 'ecg', 'surgery']).withMessage('Invalid record type'),
  body('description').notEmpty().withMessage('Description is required'),
  body('reportDate').isISO8601().withMessage('Invalid report date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const { patientId, doctorId, appointmentId, recordType, description, reportDate } = req.body;
    
    // Verify doctor authorization
    if (req.user.role !== 'super_admin' && req.user.id !== doctorId) {
      return res.status(403).json({ message: 'Unauthorized to upload record for this doctor' });
    }

    const medicalRecord = new MedicalRecord({
      patientId,
      doctorId,
      appointmentId,
      recordType,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileUrl: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      description,
      reportDate: new Date(reportDate),
      hospitalId: req.user.hospitalId
    });

    // Add type-specific details if provided
    if (recordType === 'surgery') {
      const { procedureName, surgeonName, surgeryDate, anesthesiaType, complications, outcome } = req.body;
      medicalRecord.surgeryDetails = {
        procedureName,
        surgeonName,
        surgeryDate: new Date(surgeryDate),
        anesthesiaType,
        complications,
        outcome
      };
    } else if (recordType === 'pathology') {
      const { testType, normalRange, actualValue, unit } = req.body;
      medicalRecord.pathologyDetails = {
        testType,
        normalRange,
        actualValue,
        unit
      };
    } else if (['xray', 'ct', 'ultrasound', 'mri', 'ecg'].includes(recordType)) {
      const { bodyPart, contrastUsed, findings, impression } = req.body;
      medicalRecord.imagingDetails = {
        bodyPart,
        contrastUsed: contrastUsed === 'true',
        findings,
        impression
      };
    }

    await medicalRecord.save();

    // Populate related data for response
    await medicalRecord.populate([
      { path: 'patientId', select: 'name opdNumber phone' },
      { path: 'doctorId', select: 'name specialities' },
      { path: 'appointmentId', select: 'appointmentDate status' }
    ]);

    res.status(201).json({
      message: 'Medical record uploaded successfully',
      medicalRecord
    });

  } catch (error) {
    console.error('Upload medical record error:', error);
    res.status(500).json({ message: 'Server error uploading medical record' });
  }
});

// Get medical records for a patient by type
router.get('/patient/:patientId/:recordType', authenticate, async (req, res) => {
  try {
    const { patientId, recordType } = req.params;
    
    // Validate record type
    const validTypes = ['pathology', 'xray', 'ct', 'ultrasound', 'mri', 'ecg', 'surgery'];
    if (!validTypes.includes(recordType)) {
      return res.status(400).json({ message: 'Invalid record type' });
    }

    const medicalRecords = await MedicalRecord.find({ 
      patientId,
      recordType,
      status: { $ne: 'deleted' }
    })
    .populate('doctorId', 'name specialities')
    .populate('appointmentId', 'appointmentDate status')
    .sort({ reportDate: -1 });

    // Check hospital access
    if (medicalRecords.length > 0 && !checkHospitalAccess(req.user, medicalRecords[0].hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      medicalRecords
    });

  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({ message: 'Server error fetching medical records' });
  }
});

// Get medical record by ID
router.get('/records/:id', authenticate, async (req, res) => {
  try {
    const medicalRecord = await MedicalRecord.findById(req.params.id)
      .populate('patientId', 'name opdNumber phone')
      .populate('doctorId', 'name specialities')
      .populate('appointmentId', 'appointmentDate status');

    if (!medicalRecord) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    // Check hospital access
    if (!checkHospitalAccess(req.user, medicalRecord.hospitalId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      medicalRecord
    });

  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({ message: 'Server error fetching medical record' });
  }
});

// Download file endpoint
router.get('/download/:type/:id', authenticate, async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'prescription') {
      const prescription = await Prescription.findById(id)
        .populate('patientId', 'name')
        .populate('doctorId', 'name');

      if (!prescription) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      console.log('Prescription found:', prescription.type, prescription._id);

      // Check hospital access
      if (!checkHospitalAccess(req.user, prescription.hospitalId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (prescription.type === 'image' && prescription.prescriptionFile) {
        // Return the stored Cloudinary URL directly
        return res.json({ downloadUrl: prescription.prescriptionFile });
      } else if (prescription.type === 'form' && prescription.medicines) {
        // Generate text summary for form-based prescription
        let prescriptionText = `Prescription\n`;
        prescriptionText += `============\n`;
        prescriptionText += `Patient: ${prescription.patientId?.name || 'N/A'}\n`;
        prescriptionText += `Doctor: ${prescription.doctorId?.name || 'N/A'}\n`;
        prescriptionText += `Date: ${new Date(prescription.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n`;
        prescriptionText += `Medicines:\n`;
        prescriptionText += `----------\n`;

        prescription.medicines.forEach((med, index) => {
          prescriptionText += `${index + 1}. ${med.name || med.medicineName || 'N/A'}\n`;
          prescriptionText += `   Dosage: ${med.dosage || 'N/A'}\n`;
          prescriptionText += `   Frequency: ${med.frequency || 'N/A'}\n`;
          prescriptionText += `   Duration: ${med.duration || 'N/A'}\n`;
          if (med.instructions) {
            prescriptionText += `   Instructions: ${med.instructions}\n`;
          }
          prescriptionText += `\n`;
        });

        if (prescription.generalInstructions) {
          prescriptionText += `General Instructions:\n`;
          prescriptionText += `---------------------\n${prescription.generalInstructions}\n\n`;
        }

        if (prescription.followUpDate) {
          prescriptionText += `Follow-up Date: ${new Date(prescription.followUpDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
        }

        return res.json({
          type: 'text',
          content: prescriptionText,
          fileName: `prescription_${prescription._id}.txt`
        });
      }
    } else if (type === 'medical-record') {
      const medicalRecord = await MedicalRecord.findById(id);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      // Check hospital access
      if (!checkHospitalAccess(req.user, medicalRecord.hospitalId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (medicalRecord.fileUrl) {
        // Return the stored Cloudinary URL directly
        return res.json({ downloadUrl: medicalRecord.fileUrl });
      }
    }

    res.status(404).json({ message: 'File not found' });

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'Server error generating download URL' });
  }
});

module.exports = router;
