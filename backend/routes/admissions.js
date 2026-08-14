const express = require('express');
const router = express.Router();
const Admission = require('../models/Admission');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Bed = require('../models/Bed');
const Bill = require('../models/Bill');
const Hospital = require('../models/Hospital');
const { authenticate } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// Get all admissions
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, patientId, doctorId } = req.query;
    const skip = (page - 1) * limit;

    let query = { hospitalId: req.user.hospitalId };

    if (status) {
      query.status = status;
    }

    if (patientId) {
      query.patientId = patientId;
    }

    if (doctorId) {
      query.doctorId = doctorId;
    }

    const admissions = await Admission.find(query)
      .populate('patientId', 'name phone age gender opdNumber')
      .populate('doctorIds', 'name')
      .populate('assignedNurses', 'name')
      .populate('vitalReports.recordedBy', 'name')
      .populate('medicineUpdates.administeredBy', 'name')
      .populate('createdBy', 'name')
      .populate({ path: 'dischargeSummary.createdBy', select: 'name' })
      .sort({ admissionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Admission.countDocuments(query);

    res.json({
      admissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get admissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single admission by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    })
      .populate('patientId', 'name phone age gender opdNumber email advanceBalance unpaidBalance')
      .populate('doctorIds', 'name')
      .populate('assignedNurses', 'name')
      .populate('bedId', 'bedNumber wardType pricePerDay')
      .populate('vitalReports.recordedBy', 'name')
      .populate('medicineUpdates.administeredBy', 'name')
      .populate('createdBy', 'name')
      .populate({ path: 'dischargeSummary.createdBy', select: 'name' })
      .populate('billIds');

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    res.json({ admission });
  } catch (error) {
    console.error('Get admission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new admission
router.post('/', authenticate, upload.single('prescriptionFile'), async (req, res) => {
  try {
    const {
      patientId,
      doctorIds,
      assistantDoctorIds,
      admissionReason,
      prescription,
      bedType,
      bedNumber,
      assignedNurses,
      hasInsurance,
      insuranceProvider,
      insuranceNumber,
      hasGovtScheme,
      schemeName,
      schemeNumber
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findOne({
      _id: patientId,
      hospitalId: req.user.hospitalId
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify doctors exist
    let doctorIdList = [];
    if (doctorIds) {
      // Parse JSON string if it's a string (from FormData)
      const parsedDoctorIds = typeof doctorIds === 'string' ? JSON.parse(doctorIds) : doctorIds;
      
      const doctors = await User.find({
        _id: { $in: Array.isArray(parsedDoctorIds) ? parsedDoctorIds : [parsedDoctorIds] },
        hospitalId: req.user.hospitalId,
        role: 'doctor'
      });

      if (doctors.length === 0) {
        return res.status(404).json({ message: 'No valid doctors found' });
      }

      if (doctors.length !== (Array.isArray(parsedDoctorIds) ? parsedDoctorIds.length : 1)) {
        return res.status(400).json({ message: 'One or more doctors not found' });
      }

      doctorIdList = doctors.map(d => d._id);
    } else {
      return res.status(400).json({ message: 'At least one doctor is required' });
    }

    // Verify assistant doctors if provided (optional - skip if invalid)
    let assistantDoctorIdList = [];
    if (assistantDoctorIds) {
      try {
        const parsedAssistantIds = typeof assistantDoctorIds === 'string' ? JSON.parse(assistantDoctorIds) : assistantDoctorIds;
        
        const assistantDoctors = await User.find({
          _id: { $in: Array.isArray(parsedAssistantIds) ? parsedAssistantIds : [parsedAssistantIds] },
          hospitalId: req.user.hospitalId,
          role: 'doctor'
        });

        if (assistantDoctors.length > 0) {
          assistantDoctorIdList = assistantDoctors.map(d => d._id);
        }
        // If no valid assistant doctors found, just skip them (they're optional)
      } catch (error) {
        // If parsing fails, skip assistant doctors
        console.log('Error parsing assistant doctor IDs:', error);
      }
    }

    // Verify nurses exist
    let nurseIds = [];
    if (assignedNurses) {
      // Parse JSON string if it's a string (from FormData)
      const parsedNurseIds = typeof assignedNurses === 'string' ? JSON.parse(assignedNurses) : assignedNurses;
      
      const nurses = await User.find({
        _id: { $in: Array.isArray(parsedNurseIds) ? parsedNurseIds : [parsedNurseIds] },
        hospitalId: req.user.hospitalId,
        role: 'nurse'
      });

      if (nurses.length !== (Array.isArray(parsedNurseIds) ? parsedNurseIds.length : 1)) {
        return res.status(400).json({ message: 'One or more nurses not found' });
      }

      nurseIds = nurses.map(n => n._id);
    }

    // Find and update bed status
    let bedId = null;
    if (bedNumber && bedType) {
      const bed = await Bed.findOne({
        bedNumber,
        wardType: bedType,
        hospitalId: req.user.hospitalId,
        status: 'available'
      });

      if (!bed) {
        return res.status(400).json({ message: 'Bed not available or already occupied' });
      }

      bedId = bed._id;
      bed.status = 'occupied';
      await bed.save();
    }

    // Upload prescription file if provided
    let prescriptionFileUrl = '';
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'prescriptions',
          resource_type: 'auto'
        });
        prescriptionFileUrl = result.secure_url;
      } catch (error) {
        console.error('Error uploading prescription:', error);
      }
    }

    const admission = new Admission({
      patientId,
      doctorIds: doctorIdList,
      assistantDoctorIds: assistantDoctorIdList,
      admissionReason,
      prescription,
      prescriptionFile: prescriptionFileUrl,
      bedType,
      bedNumber,
      bedId,
      bedHistory: [],
      assignedNurses: nurseIds,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id,
      hasInsurance: hasInsurance === 'true' || hasInsurance === true,
      insuranceProvider: hasInsurance ? insuranceProvider : '',
      insuranceNumber: hasInsurance ? insuranceNumber : '',
      hasGovtScheme: hasGovtScheme === 'true' || hasGovtScheme === true,
      schemeName: hasGovtScheme ? schemeName : '',
      schemeNumber: hasGovtScheme ? schemeNumber : ''
    });

    // Record initial bed assignment in history
    if (bed) {
      admission.bedHistory.push({
        bedId: bed._id,
        bedNumber: bed.bedNumber,
        bedType: bed.wardType,
        pricePerDay: bed.pricePerDay || 0,
        startDate: admission.admissionDate || new Date()
      });
    }

    await admission.save();

    // Link admission to bed
    if (bedId) {
      await Bed.findByIdAndUpdate(bedId, {
        currentAdmission: admission._id
      });
    }

    await admission.populate('patientId', 'name phone age gender');
    await admission.populate('doctorIds', 'name');
    await admission.populate('assignedNurses', 'name');

    res.status(201).json({ admission });
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update admission
router.put('/:id', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const {
      doctorId,
      admissionReason,
      prescription,
      bedType,
      bedNumber,
      assignedNurses,
      status,
      dischargeDate
    } = req.body;

    const bedOrDischargeChanged = bedType || bedNumber || status || dischargeDate;
    if (bedOrDischargeChanged) {
      const allowedRoles = ['receptionist', 'hospital_admin', 'accounts', 'super_admin'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: bed change / discharge restricted' });
      }
    }

    if (doctorId) {
      const doctor = await User.findOne({
        _id: doctorId,
        hospitalId: req.user.hospitalId,
        role: 'doctor'
      });

      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }

      admission.doctorIds = [doctorId];
    }

    if (assignedNurses) {
      const nurses = await User.find({
        _id: { $in: Array.isArray(assignedNurses) ? assignedNurses : [assignedNurses] },
        hospitalId: req.user.hospitalId,
        role: 'nurse'
      });

      if (nurses.length !== (Array.isArray(assignedNurses) ? assignedNurses.length : 1)) {
        return res.status(400).json({ message: 'One or more nurses not found' });
      }

      admission.assignedNurses = nurses.map(n => n._id);
    }

    if (admissionReason) admission.admissionReason = admissionReason;
    if (prescription) admission.prescription = prescription;

    // Bed change
    if (bedType || bedNumber) {
      const newBedType = bedType || admission.bedType;
      const newBedNumber = bedNumber || admission.bedNumber;

      if (newBedType && newBedNumber) {
        const newBed = await Bed.findOne({
          bedNumber: newBedNumber,
          wardType: newBedType,
          hospitalId: req.user.hospitalId,
          status: 'available'
        });

        if (!newBed) {
          return res.status(400).json({ message: 'Selected bed is not available' });
        }

        const now = new Date();

        // Free the current bed if it exists
        let currentBed = null;
        if (admission.bedId) {
          currentBed = await Bed.findById(admission.bedId);
          if (currentBed) {
            currentBed.status = 'available';
            currentBed.currentAdmission = null;
            await currentBed.save();
          }
        }

        // Close current bed history entry (or seed it for pre-existing admissions)
        if (currentBed) {
          const activeEntry = admission.bedHistory?.length
            ? admission.bedHistory[admission.bedHistory.length - 1]
            : null;

          const previousDayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 1);

          if (activeEntry && !activeEntry.endDate) {
            activeEntry.endDate = previousDayEnd;
          } else if (!activeEntry) {
            admission.bedHistory.push({
              bedId: currentBed._id,
              bedNumber: currentBed.bedNumber,
              bedType: currentBed.wardType,
              pricePerDay: currentBed.pricePerDay || 0,
              startDate: admission.admissionDate || now,
              endDate: previousDayEnd
            });
          }
        }

        // Occupy the new bed
        newBed.status = 'occupied';
        newBed.currentAdmission = admission._id;
        await newBed.save();

        // Record new bed assignment
        admission.bedHistory.push({
          bedId: newBed._id,
          bedNumber: newBed.bedNumber,
          bedType: newBed.wardType,
          pricePerDay: newBed.pricePerDay || 0,
          startDate: now
        });

        admission.bedId = newBed._id;
        admission.bedType = newBedType;
        admission.bedNumber = newBedNumber;
      }
    }

    // Discharge: free the bed and mark admission discharged
    const isDischarged = status === 'discharged' || dischargeDate;
    if (isDischarged) {
      if (admission.bedId) {
        const currentBed = await Bed.findById(admission.bedId);
        if (currentBed) {
          currentBed.status = 'available';
          currentBed.currentAdmission = null;
          await currentBed.save();
        }
      }

      // Close the active bed history entry
      const activeEntry = admission.bedHistory?.length
        ? admission.bedHistory[admission.bedHistory.length - 1]
        : null;
      if (activeEntry && !activeEntry.endDate) {
        activeEntry.endDate = dischargeDate ? new Date(dischargeDate) : new Date();
      }

      admission.status = 'discharged';
      if (dischargeDate) admission.dischargeDate = new Date(dischargeDate);
    } else if (status) {
      admission.status = status;
    }

    if (dischargeDate && !isDischarged) admission.dischargeDate = new Date(dischargeDate);

    await admission.save();
    await admission.populate('patientId', 'name phone age gender');
    await admission.populate('doctorIds', 'name');
    await admission.populate('assignedNurses', 'name');

    res.json({ admission });
  } catch (error) {
    console.error('Update admission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add vital report
router.post('/:id/vital-reports', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const {
      temperature,
      bloodPressure,
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      notes
    } = req.body;

    admission.vitalReports.push({
      temperature,
      bloodPressure,
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

// Add medicine update
router.post('/:id/medicine-updates', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const {
      medicineName,
      dosage,
      frequency,
      scheduledTime,
      administered,
      notes
    } = req.body;

    const medicineUpdate = {
      medicineName,
      dosage,
      frequency,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      administered: administered || false,
      notes
    };

    if (administered) {
      medicineUpdate.administeredBy = req.user.id;
      medicineUpdate.administeredAt = new Date();
    }

    admission.medicineUpdates.push(medicineUpdate);

    await admission.save();
    await admission.populate('medicineUpdates.administeredBy', 'name');

    res.json({ admission });
  } catch (error) {
    console.error('Add medicine update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update medicine administration status
router.put('/:id/medicine-updates/:medicineIndex', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const { administered, notes } = req.body;
    const medicineIndex = parseInt(req.params.medicineIndex);

    if (medicineIndex < 0 || medicineIndex >= admission.medicineUpdates.length) {
      return res.status(404).json({ message: 'Medicine update not found' });
    }

    admission.medicineUpdates[medicineIndex].administered = administered;
    admission.medicineUpdates[medicineIndex].notes = notes;

    if (administered) {
      admission.medicineUpdates[medicineIndex].administeredBy = req.user.id;
      admission.medicineUpdates[medicineIndex].administeredAt = new Date();
    }

    await admission.save();
    await admission.populate('medicineUpdates.administeredBy', 'name');

    res.json({ admission });
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save / update discharge summary
router.put('/:id/discharge-summary', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const allowedRoles = ['receptionist', 'hospital_admin', 'doctor', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      problemStatements,
      testsAndFindings,
      procedures,
      medications,
      followUpDates,
      conclusion
    } = req.body;

    admission.dischargeSummary = {
      problemStatements: problemStatements || [],
      testsAndFindings: testsAndFindings || [],
      procedures: procedures || [],
      medications: (medications || []).filter(m => m && m.name && m.name.trim()).map(m => ({
        name: m.name.trim(),
        duration: m.duration || '',
        howToTake: m.howToTake || ''
      })),
      followUpDates: followUpDates || [],
      conclusion: conclusion || '',
      generatedAt: new Date(),
      createdBy: req.user.id
    };

    await admission.save();
    await admission.populate('patientId', 'name phone age gender opdNumber emergencyNumber');
    await admission.populate('doctorIds', 'name');
    await admission.populate({ path: 'dischargeSummary.createdBy', select: 'name' });

    res.json({ admission });
  } catch (error) {
    console.error('Update discharge summary error:', error);
    res.status(500).json({ message: 'Server error saving discharge summary' });
  }
});

// Generate discharge summary PDF
router.get('/:id/discharge-summary-pdf', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    })
      .populate('patientId', 'name phone age gender opdNumber emergencyNumber')
      .populate('doctorIds', 'name')
      .populate('hospitalId')
      .populate({ path: 'dischargeSummary.createdBy', select: 'name' });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    if (!admission.dischargeSummary) {
      return res.status(400).json({ message: 'No discharge summary found for this admission' });
    }

    const generateDischargeSummaryPDF = require('../utils/generateDischargeSummaryPDF');
    const pdfBuffer = await generateDischargeSummaryPDF(
      admission,
      admission.hospitalId,
      admission.patientId
    );

    const p = admission.patientId || {};
    const visitId = p.opdNumber || p.emergencyNumber || 'NA';
    const safeName = (p.name || 'patient').replace(/\s+/g, '-');
    const apptDate = new Date(admission.dischargeDate || admission.admissionDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
    const filename = `discharge-summary-${safeName}-${apptDate}-${visitId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate discharge summary PDF error:', error);
    res.status(500).json({ message: 'Server error generating discharge summary PDF' });
  }
});

// Delete admission
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    await Admission.findByIdAndDelete(req.params.id);

    res.json({ message: 'Admission deleted successfully' });
  } catch (error) {
    console.error('Delete admission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
