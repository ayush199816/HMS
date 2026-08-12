const express = require('express');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Admission = require('../models/Admission');
const Bed = require('../models/Bed');
const User = require('../models/User');
const RadiologyTestBooking = require('../models/RadiologyTestBooking');
const PathologyTestBooking = require('../models/PathologyTestBooking');
const Bill = require('../models/Bill');
const Purchase = require('../models/Purchase');
const { authenticate, authorize, hospitalAccess } = require('../middleware/auth');

const router = express.Router();

// Get all appointments and admissions for billing
router.get('/billing-data', authenticate, async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const Bill = require('../models/Bill');

    // Get all appointments (OPD, Emergency, Surgery)
    const appointments = await Appointment.find({ 
      hospitalId: userHospitalId,
      status: { $in: ['scheduled', 'completed', 'in_progress'] }
    })
    .populate('patientId', 'name phone age opdNumber emergencyNumber')
    .populate('doctorId', 'name specialities dailyVisitFee')
    .populate('assistantDoctorIds', 'name specialities dailyVisitFee')
    .populate('assignedNurseIds', 'name')
    .populate('billId')
    .sort({ appointmentDate: -1 });

    // Get bills for appointments that have them
    const appointmentBillIds = appointments
      .filter(a => a.billId)
      .map(a => a.billId._id);
    
    let appointmentBills = [];
    if (appointmentBillIds.length > 0) {
      appointmentBills = await Bill.find({ _id: { $in: appointmentBillIds } })
        .populate('createdBy', 'name');
    }

    // Get radiology bookings with bills
    const radiologyBookings = await RadiologyTestBooking.find({ 
      hospitalId: userHospitalId,
      paymentStatus: 'paid'
    })
    .populate('patientId', 'name phone age opdNumber emergencyNumber')
    .populate('billId')
    .sort({ bookingDate: -1 });

    const radiologyBillIds = radiologyBookings
      .filter(r => r.billId)
      .map(r => r.billId._id);
    
    let radiologyBills = [];
    if (radiologyBillIds.length > 0) {
      radiologyBills = await Bill.find({ _id: { $in: radiologyBillIds } })
        .populate('createdBy', 'name');
    }

    // Get pathology bookings with bills
    const pathologyBookings = await PathologyTestBooking.find({ 
      hospitalId: userHospitalId,
      paymentStatus: 'paid'
    })
    .populate('patientId', 'name phone age opdNumber emergencyNumber')
    .populate('billId')
    .sort({ bookingDate: -1 });

    const pathologyBillIds = pathologyBookings
      .filter(p => p.billId)
      .map(p => p.billId._id);
    
    let pathologyBills = [];
    if (pathologyBillIds.length > 0) {
      pathologyBills = await Bill.find({ _id: { $in: pathologyBillIds } })
        .populate('createdBy', 'name');
    }

    // Get all active admissions
    const admissions = await Admission.find({ 
      hospitalId: userHospitalId,
      status: 'admitted'
    })
    .populate('patientId', 'name phone age opdNumber emergencyNumber')
    .populate('doctorIds', 'name specialities dailyVisitFee')
    .populate('assistantDoctorIds', 'name specialities dailyVisitFee')
    .populate('assignedNurses', 'name')
    .populate('bedId', 'bedNumber wardType pricePerDay')
    .populate('billIds')
    .sort({ admissionDate: -1 });

    res.json({ 
      appointments: appointments || [],
      admissions: admissions || [],
      appointmentBills: appointmentBills || [],
      radiologyBookings: radiologyBookings || [],
      radiologyBills: radiologyBills || [],
      pathologyBookings: pathologyBookings || [],
      pathologyBills: pathologyBills || []
    });
  } catch (error) {
    console.error('Get billing data error:', error);
    res.status(500).json({ message: 'Server error fetching billing data' });
  }
});

// Create general bill (for pathology, appointments, etc.)
router.post('/', [
  authenticate,
  body('amount').isFloat().withMessage('Amount must be a number'),
  body('description').notEmpty().withMessage('Description is required'),
  body('type').isIn(['pathology', 'appointment', 'consultation', 'surgery', 'admission', 'admission_advance', 'other']).withMessage('Invalid bill type'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  // Optional paymentMethod, but if provided must be one of supported methods
  body('paymentMethod').optional().isIn(['cash', 'upi', 'card', 'online']).withMessage('Invalid payment method'),
  // If paymentMethod is not cash, require referenceNumber (e.g., UTR/transaction id)
  body('referenceNumber').custom((value, { req }) => {
    if (req.body.paymentMethod && req.body.paymentMethod !== 'cash' && !value) {
      throw new Error('Reference number is required when payment method is not cash');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, description, type, referenceId, patientId, hospitalId, items, paymentSources, insuranceDetails, govtSchemeDetails, discount, advanceAmount, advanceFromBalance, assistantDoctorIds, taxDetails, isAdvanceBill, previousBills, claimFromInsurance, claimAmount, paymentMethod, referenceNumber } = req.body;

    // Restrict surgery and admission billing to billing department only
    if ((type === 'surgery' || type === 'admission' || type === 'admission_advance') &&
        !['billing_staff', 'hospital_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Surgery and admission billing can only be done by billing department'
      });
    }

    // For other bill types, allow receptionist as well
    if (!['billing_staff', 'hospital_admin', 'super_admin', 'receptionist'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify patient exists and user has access
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const patientHospitalId = patient.hospitalId.toString();

    if (req.user.role !== 'super_admin' && userHospitalId !== patientHospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create bill
    const Bill = require('../models/Bill');
    const discountAmount = discount || 0;
    const tax = 0;

    // For a final admission bill, compute the total advance already collected from previous advance bills
    let previousAdvanceTotal = 0;
    if (type === 'admission' && previousBills && previousBills.length > 0) {
      previousAdvanceTotal = previousBills.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
    }

    const advancePayment = (type === 'admission' && previousAdvanceTotal > 0)
      ? previousAdvanceTotal
      : (advanceAmount || 0);

    // For full & final bills, the frontend sends the remaining balance after advance and discount.
    // Reconstruct the gross bill amount so the bill reflects the full charge and the advance is recorded as a payment source.
    const grossAmount = (type === 'admission' && previousAdvanceTotal > 0)
      ? amount + previousAdvanceTotal + discountAmount
      : amount;
    const baseAmount = grossAmount - discountAmount + tax;

    // Apply patient unpaid balance to this bill
    let finalAmount = baseAmount;
    if (patient.unpaidBalance > 0) {
      finalAmount = baseAmount + patient.unpaidBalance;
    }

    // Use manually specified advance from balance, or auto-calculate if not provided
    let advanceFromBalanceToUse = advanceFromBalance || 0;
    if (advanceFromBalanceToUse === 0 && patient.advanceBalance > 0) {
      advanceFromBalanceToUse = Math.min(patient.advanceBalance, finalAmount);
    }

    // Total advance = advance payment (new or from previous bills) + advance from balance
    const totalAdvance = advancePayment + advanceFromBalanceToUse;

    const billData = {
      patientId,
      amount: finalAmount,
      description,
      type,
      referenceId,
      hospitalId: patient.hospitalId,
      createdBy: req.user.id,
      status: 'pending',
      billDate: new Date(),
      billNumber: await generateBillNumber(patient.hospitalId),
      discount: discountAmount,
      tax,
      totalAmount: finalAmount,
      advanceAmount: totalAdvance,
      items: items || [],
      paymentSources: paymentSources || []
    };

    // Only add insurance/govt scheme details if provided
    if (insuranceDetails) {
      billData.insuranceDetails = insuranceDetails;
    }
    if (govtSchemeDetails) {
      billData.govtSchemeDetails = govtSchemeDetails;
    }

    // Add assistant doctors and tax details for admission bills
    if (type === 'admission' || type === 'admission_advance') {
      if (assistantDoctorIds) {
        billData.assistantDoctorIds = assistantDoctorIds;
      }
      if (taxDetails) {
        billData.taxDetails = taxDetails;
      }
      if (isAdvanceBill) {
        billData.isAdvanceBill = true;
      }
      if (previousBills) {
        billData.previousBills = previousBills;
      }
      if (claimFromInsurance) {
        billData.claimFromInsurance = claimFromInsurance;
        billData.claimAmount = claimAmount || 0;
      }
    }

    const bill = new Bill(billData);

    // Runtime guard: if advance payment is provided and paymentMethod is non-cash, require referenceNumber
    if (advancePayment > 0 && paymentMethod && paymentMethod !== 'cash' && !referenceNumber) {
      return res.status(400).json({ message: 'Reference number is required for non-cash advance payments' });
    }

    // Add advance payments to payment sources (include payment method and reference when provided)
    if (advancePayment > 0) {
      const isFinalSettlement = (type === 'admission' && previousBills && previousBills.length > 0);
      bill.paymentSources.push({
        sourceType: 'advance',
        amount: advancePayment,
        paymentDate: new Date(),
        paymentMethod: paymentMethod || 'cash',
        referenceNumber: referenceNumber || '',
        notes: isFinalSettlement ? 'Advance applied from previous advance bills' : 'Advance payment collected at bill creation'
      });
    }

    // Add advance from patient balance if available
    if (advanceFromBalanceToUse > 0) {
      bill.paymentSources.push({
        sourceType: 'advance',
        amount: advanceFromBalanceToUse,
        paymentDate: new Date(),
        // advance from balance has no external reference number
        notes: 'Advance applied from patient balance'
      });
    }

    // Update patient's advance balance (reduce by amount used)
    if (advanceFromBalanceToUse > 0) {
      patient.advanceBalance -= advanceFromBalanceToUse;
      await patient.save();
    }

    // Reset patient's unpaid balance since it's been added to this bill
    if (patient.unpaidBalance > 0) {
      patient.unpaidBalance = 0;
      await patient.save();
    }

    await bill.save();
    await bill.populate('patientId', 'name phone age registeredNumber');
    await bill.populate('createdBy', 'name');

    // If this is an admission bill or advance bill, add bill to admission's billIds array
    if ((type === 'admission' || type === 'admission_advance') && referenceId) {
      const admission = await Admission.findById(referenceId);
      if (admission) {
        admission.billIds.push(bill._id);
        await admission.save();
      }
    }

    res.status(201).json({ 
      message: 'Bill created successfully',
      bill 
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate bill number
async function generateBillNumber(hospitalId) {
  const Bill = require('../models/Bill');
  const count = await Bill.countDocuments({ hospitalId });
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `BILL-${year}${month}-${String(count + 1).padStart(4, '0')}`;
}

// Add payment to existing bill
router.post('/:billId/payment', [
  authenticate,
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('sourceType').isIn(['patient', 'advance', 'insurance', 'govt_scheme', 'other']).withMessage('Invalid source type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, sourceType, paymentMethod, referenceNumber, notes, insuranceProvider, policyNumber, claimNumber, schemeName, schemeId, beneficiaryId } = req.body;
    const billId = req.params.billId;

    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create payment source object
    const paymentSource = {
      sourceType,
      amount,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'cash',
      referenceNumber,
      notes
    };

    // Add source-specific fields
    if (sourceType === 'insurance') {
      paymentSource.insuranceProvider = insuranceProvider;
      paymentSource.policyNumber = policyNumber;
      paymentSource.claimNumber = claimNumber;
      
      // Update insurance details
      bill.insuranceDetails = {
        provider: insuranceProvider,
        policyNumber,
        claimNumber,
        claimStatus: 'pending',
        approvedAmount: 0
      };
    }

    if (sourceType === 'govt_scheme') {
      paymentSource.schemeName = schemeName;
      paymentSource.schemeId = schemeId;
      paymentSource.beneficiaryId = beneficiaryId;
      
      // Update govt scheme details
      bill.govtSchemeDetails = {
        schemeName,
        schemeId,
        beneficiaryId,
        approvalStatus: 'pending',
        approvedAmount: 0
      };
    }

    if (sourceType === 'advance') {
      bill.advanceAmount = (bill.advanceAmount || 0) + amount;
    }

    bill.paymentSources.push(paymentSource);
     
    // Note: status will be recalculated in the pre-save hook based on totalAmount
    await bill.save();

    await bill.populate('patientId', 'name phone age registeredNumber');
    await bill.populate('createdBy', 'name');

    res.json({ 
      message: 'Payment recorded successfully',
      bill 
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update insurance claim status
router.patch('/:billId/insurance-status', [
  authenticate,
  body('claimStatus').isIn(['pending', 'approved', 'rejected', 'partial']).withMessage('Invalid claim status'),
  body('approvedAmount').isFloat({ min: 0 }).withMessage('Approved amount must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claimStatus, approvedAmount } = req.body;
    const billId = req.params.billId;

    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!bill.insuranceDetails) {
      return res.status(400).json({ message: 'No insurance details found for this bill' });
    }

    bill.insuranceDetails.claimStatus = claimStatus;
    bill.insuranceDetails.approvedAmount = approvedAmount;

    // If approved, add to payment sources if not already there
    if (claimStatus === 'approved' || claimStatus === 'partial') {
      const existingInsurancePayment = bill.paymentSources.find(p => p.sourceType === 'insurance');
      if (!existingInsurancePayment) {
        bill.paymentSources.push({
          sourceType: 'insurance',
          amount: approvedAmount,
          paymentDate: new Date(),
          insuranceProvider: bill.insuranceDetails.provider,
          policyNumber: bill.insuranceDetails.policyNumber,
          claimNumber: bill.insuranceDetails.claimNumber
        });
      } else {
        existingInsurancePayment.amount = approvedAmount;
      }
    }

    await bill.save();

    res.json({ 
      message: 'Insurance claim status updated successfully',
      bill 
    });
  } catch (error) {
    console.error('Update insurance status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update govt scheme approval status
router.patch('/:billId/scheme-status', [
  authenticate,
  body('approvalStatus').isIn(['pending', 'approved', 'rejected', 'partial']).withMessage('Invalid approval status'),
  body('approvedAmount').isFloat({ min: 0 }).withMessage('Approved amount must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approvalStatus, approvedAmount } = req.body;
    const billId = req.params.billId;

    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!bill.govtSchemeDetails) {
      return res.status(400).json({ message: 'No govt scheme details found for this bill' });
    }

    bill.govtSchemeDetails.approvalStatus = approvalStatus;
    bill.govtSchemeDetails.approvedAmount = approvedAmount;

    // If approved, add to payment sources if not already there
    if (approvalStatus === 'approved' || approvalStatus === 'partial') {
      const existingSchemePayment = bill.paymentSources.find(p => p.sourceType === 'govt_scheme');
      if (!existingSchemePayment) {
        bill.paymentSources.push({
          sourceType: 'govt_scheme',
          amount: approvedAmount,
          paymentDate: new Date(),
          schemeName: bill.govtSchemeDetails.schemeName,
          schemeId: bill.govtSchemeDetails.schemeId,
          beneficiaryId: bill.govtSchemeDetails.beneficiaryId
        });
      } else {
        existingSchemePayment.amount = approvedAmount;
      }
    }

    await bill.save();

    res.json({ 
      message: 'Scheme approval status updated successfully',
      bill 
    });
  } catch (error) {
    console.error('Update scheme status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete bill (only if in pending state)
router.delete('/:billId', authenticate, async (req, res) => {
  try {
    const billId = req.params.billId;
    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const billHospitalId = bill.hospitalId._id ? bill.hospitalId._id.toString() : bill.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== billHospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only allow deletion of pending bills
    if (bill.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending bills can be deleted' });
    }

    // If this is an admission bill, remove it from admission's billIds array
    if (bill.type === 'admission' && bill.referenceId) {
      const Admission = require('../models/Admission');
      const admission = await Admission.findById(bill.referenceId);
      if (admission) {
        admission.billIds = admission.billIds.filter(id => id.toString() !== billId);
        await admission.save();
      }
    }

    // Restore advance balance if advance was used
    if (bill.advanceAmount > 0) {
      const Patient = require('../models/Patient');
      const patient = await Patient.findById(bill.patientId);
      if (patient) {
        // Calculate advance used in this bill
        const advanceUsedInBill = bill.paymentSources?.reduce((sum, source) => {
          if (source.sourceType === 'advance') {
            return sum + (source.amount || 0);
          }
          return sum;
        }, 0) || 0;

        if (advanceUsedInBill > 0) {
          patient.advanceBalance += advanceUsedInBill;
          await patient.save();
        }
      }
    }

    await Bill.findByIdAndDelete(billId);

    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get financial statement (collections, refunds, purchases) for the hospital
router.get('/statement', authenticate, authorize('accounts', 'hospital_admin', 'super_admin'), async (req, res) => {
  try {
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();

    const [bills, purchases] = await Promise.all([
      Bill.find({ hospitalId: userHospitalId })
        .populate('patientId', 'name')
        .populate('createdBy', 'name')
        .sort({ billDate: -1 })
        .lean(),
      Purchase.find({ hospitalId: userHospitalId })
        .populate('createdBy', 'name')
        .sort({ purchaseDate: -1 })
        .lean()
    ]);

    const transactions = [];

    // Income from bills (appointment, pathology, radiology, admission, admission_advance)
    bills.forEach(bill => {
      const base = {
        type: bill.type,
        category: bill.type ? bill.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other',
        billNumber: bill.billNumber || '',
        patient: bill.patientId?.name || '-',
        description: bill.description || '-',
        createdBy: bill.createdBy?.name || '-'
      };

      (bill.paymentSources || []).forEach(source => {
        if (source.amount > 0) {
          transactions.push({
            ...base,
            id: `${bill._id}-${source._id || Date.now()}`,
            date: source.paymentDate || bill.billDate || bill.createdAt,
            source: 'collection',
            paymentMethod: source.paymentMethod || bill.paymentDetails?.paymentMethod || '-',
            referenceNumber: source.referenceNumber || bill.paymentDetails?.utrNumber || '',
            amount: source.amount
          });
        }
      });

      // Refunds shown as debits
      if (bill.status === 'refunded' && bill.totalPaid > 0) {
        transactions.push({
          ...base,
          id: `${bill._id}-refund`,
          date: bill.paymentDetails?.paymentDate || bill.billDate || bill.createdAt,
          source: 'refund',
          paymentMethod: bill.paymentDetails?.paymentMethod || '-',
          referenceNumber: bill.paymentDetails?.utrNumber || '',
          amount: -bill.totalPaid
        });
      }
    });

    // Purchases / expenses
    purchases.forEach(purchase => {
      const base = {
        type: 'purchase',
        category: 'Purchase',
        billNumber: purchase.billNumber || '',
        patient: purchase.vendorName || '-',
        description: 'Purchase payment',
        createdBy: purchase.createdBy?.name || '-'
      };

      (purchase.paymentSources || []).forEach(source => {
        if (source.amount > 0) {
          transactions.push({
            ...base,
            id: `${purchase._id}-${source._id || Date.now()}`,
            date: source.paymentDate || purchase.purchaseDate || purchase.createdAt,
            source: 'expense',
            paymentMethod: source.paymentMethod || '-',
            referenceNumber: source.referenceNumber || '',
            amount: -source.amount
          });
        }
      });
    });

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalCredit = transactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
    const totalDebit = transactions.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0);

    res.json({
      transactions,
      summary: {
        totalCredit,
        totalDebit,
        netBalance: totalCredit + totalDebit
      }
    });
  } catch (error) {
    console.error('Get statement error:', error);
    res.status(500).json({ message: 'Server error fetching statement' });
  }
});

// Get single bill by ID
router.get('/:billId', authenticate, async (req, res) => {
  try {
    const billId = req.params.billId;
    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId)
      .populate('patientId', 'name phone age opdNumber emergencyNumber')
      .populate('createdBy', 'name')
      .populate('hospitalId', 'name');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const billHospitalId = bill.hospitalId._id ? bill.hospitalId._id.toString() : bill.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== billHospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch related details based on bill type and referenceId
    let relatedDetails = {};
    if (bill.referenceId) {
      if (bill.type === 'consultation' || bill.type === 'emergency' || bill.type === 'opd') {
        const appointment = await Appointment.findById(bill.referenceId)
          .populate('doctorId', 'name specialities');
        if (appointment) {
          relatedDetails.doctorName = appointment.doctorId?.name;
          relatedDetails.doctorSpeciality = appointment.doctorId?.specialities?.[0];
        }
      } else if (bill.type === 'radiology') {
        const radiologyBooking = await RadiologyTestBooking.findById(bill.referenceId)
          .populate('doctorId', 'name');
        if (radiologyBooking) {
          relatedDetails.doctorName = radiologyBooking.doctorId?.name;
          relatedDetails.bookingId = radiologyBooking.bookingId;
        }
      } else if (bill.type === 'pathology') {
        const pathologyBooking = await PathologyTestBooking.findById(bill.referenceId)
          .populate('doctorId', 'name');
        if (pathologyBooking) {
          relatedDetails.doctorName = pathologyBooking.doctorId?.name;
        }
      }
    }

    res.json({ bill, relatedDetails });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ message: 'Server error fetching bill' });
  }
});

// Generate PDF bill for admission
router.get('/:billId/pdf', authenticate, async (req, res) => {
  try {
    const { billId } = req.params;
    const Bill = require('../models/Bill');
    
    const bill = await Bill.findById(billId)
      .populate('patientId')
      .populate('createdBy')
      .populate('hospitalId');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Allow generating PDFs for admission bills and other bill types (pathology, radiology, appointment, etc.)
    // Check hospital access first
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const billHospitalId = bill.hospitalId._id ? bill.hospitalId._id.toString() : bill.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== billHospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Use specialized generator for admission bills, otherwise use a generic one for other bill types
    const { generateAdmissionBillPDF } = require('../utils/generateAdmissionBillPDF');
    const { generateBillPDF } = require('../utils/generateBillPDF');

    let pdfBuffer;

    if (bill.type === 'admission') {
      // Fetch admission details
      const admission = await Admission.findById(bill.referenceId)
        .populate('doctorIds')
        .populate('assistantDoctorIds')
        .populate('bedId');

      if (!admission) {
        return res.status(404).json({ message: 'Admission not found' });
      }

      pdfBuffer = await generateAdmissionBillPDF(
        bill,
        admission,
        bill.hospitalId,
        bill.patientId,
        bill.createdBy
      );

      res.setHeader('Content-Disposition', `attachment; filename=admission-bill-${billId}.pdf`);
    } else {
      // For other bill types, attempt to fetch a related reference if available
      let related = null;
      try {
        if (bill.type === 'pathology') {
          related = await PathologyTestBooking.findById(bill.referenceId).populate('doctorId');
        } else if (bill.type === 'radiology') {
          related = await RadiologyTestBooking.findById(bill.referenceId).populate('doctorId');
        } else if (['consultation','appointment','opd','emergency'].includes(bill.type)) {
          related = await Appointment.findById(bill.referenceId).populate('doctorId');
        } else {
          // leave related as null for other/unknown types
        }
      } catch (err) {
        // ignore lookup errors and proceed with generic PDF generation
        related = null;
      }

      pdfBuffer = await generateBillPDF(
        bill,
        related,
        bill.hospitalId,
        bill.patientId,
        bill.createdBy
      );

      res.setHeader('Content-Disposition', `attachment; filename=${bill.type || 'bill'}-bill-${billId}.pdf`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate admission bill PDF error:', error);
    res.status(500).json({ message: 'Server error generating PDF bill' });
  }
});

// Create bill for patient
router.post('/patient/:patientId', [
  authenticate,
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('description').notEmpty().withMessage('Description is required'),
  // Optional paymentMethod, validate supported values
  body('paymentMethod').optional().isIn(['cash', 'upi', 'card', 'online']).withMessage('Invalid payment method'),
  // If paymentMethod is not cash, require referenceNumber/UTR
  body('referenceNumber').custom((value, { req }) => {
    if (req.body.paymentMethod && req.body.paymentMethod !== 'cash' && !value) {
      throw new Error('Reference number is required when payment method is not cash');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, description, paymentMethod = 'cash', referenceNumber, type = 'other' } = req.body;
    const patientId = req.params.patientId;

    // Restrict surgery and admission billing to billing department only
    if ((type === 'surgery' || type === 'admission') && 
        !['billing_staff', 'hospital_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Surgery and admission billing can only be done by billing department' 
      });
    }

    // For other bill types, allow receptionist as well
    if (!['billing_staff', 'hospital_admin', 'super_admin', 'receptionist'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Debug: Log permission check
    console.log('Billing permission check:', {
      userId: req.user.id,
      userRole: req.user.role,
      userHospitalId: req.user.hospitalId,
      patientId: patientId,
      patientHospitalId: patient.hospitalId,
      isSuperAdmin: req.user.role === 'super_admin',
      hospitalMatch: req.user.hospitalId && req.user.hospitalId.toString() === patient.hospitalId.toString()
    });

    // Extract user hospital ID properly (handle populated object)
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const patientHospitalId = patient.hospitalId.toString();

    console.log('Updated comparison:', {
      userHospitalId,
      patientHospitalId,
      match: userHospitalId === patientHospitalId
    });

    // Check permissions
    console.log('Permission check logic:', {
      isSuperAdmin: req.user.role === 'super_admin',
      hasHospitalId: !!req.user.hospitalId,
      hospitalIdsMatch: userHospitalId === patientHospitalId,
      shouldPass: req.user.role === 'super_admin' || (req.user.hospitalId && userHospitalId === patientHospitalId)
    });

    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || userHospitalId !== patientHospitalId)) {
      console.log('Access denied - permission check failed');
      return res.status(403).json({ 
        message: 'Access denied',
        debug: {
          userRole: req.user.role,
          userHospitalId: userHospitalId,
          patientHospitalId: patientHospitalId,
          isSuperAdmin: req.user.role === 'super_admin',
          hasHospitalId: !!req.user.hospitalId,
          hospitalIdsMatch: userHospitalId === patientHospitalId
        }
      });
    }

    console.log('Access granted - permission check passed');

    // Generate bill number
    const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const billData = {
      billNumber,
      amount: parseFloat(amount),
      description,
      status: 'pending',
      // Store payment details (UTR/reference and method) in the subdocument
      paymentDetails: {
        paymentMethod,
        utrNumber: referenceNumber || ''
      }
    };

    await patient.addBill(billData);

    const updatedPatient = await Patient.findById(patientId)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role');

    res.status(201).json({
      message: 'Bill created successfully',
      patient: updatedPatient,
      bill: patient.bills[patient.bills.length - 1]
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Server error creating bill' });
  }
});

// Mark bill as paid
router.post('/bill/:billId/pay', [
  authenticate,
  authorize('receptionist', 'billing_staff', 'hospital_admin', 'super_admin'),
  body('utrNumber').notEmpty().withMessage('UTR number is required'),
  body('paymentMethod').isIn(['cash', 'upi', 'card', 'online']).withMessage('Invalid payment method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { utrNumber, paymentMethod } = req.body;
    const billId = req.params.billId;

    // First try to find in standalone Bill collection
    const Bill = require('../models/Bill');
    let bill = await Bill.findById(billId).populate('patientId');
    
    // If not found in Bill collection, try to find in Patient model's bills array
    if (!bill) {
      const patient = await Patient.findOne({ 'bills._id': billId })
        .populate('assignedDoctorId', 'name email phone specialities')
        .populate('createdBy', 'name role');
      
      if (patient) {
        const billIndex = patient.bills.findIndex(b => b._id.toString() === billId);
        if (billIndex !== -1) {
          // This is a subdocument bill
          const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
          const patientHospitalId = patient.hospitalId.toString();

          // Check permissions
          if (req.user.role !== 'super_admin' && userHospitalId !== patientHospitalId) {
            return res.status(403).json({ message: 'Access denied' });
          }

          // Update payment details
          patient.bills[billIndex].paymentDetails = {
            paymentMethod,
            utrNumber: utrNumber || 'CASH_PAYMENT',
            paymentDate: new Date(),
            paidBy: req.user.id
          };
          patient.bills[billIndex].status = 'paid';
          patient.totalPaid += patient.bills[billIndex].amount;
          patient.balanceAmount = patient.totalAmount - patient.totalPaid;

          await patient.save();

          const updatedPatient = await Patient.findById(patient._id)
            .populate('assignedDoctorId', 'name email phone specialities')
            .populate('createdBy', 'name role');

          return res.json({
            message: 'Payment marked successfully',
            bill: updatedPatient.bills[billIndex],
            patient: updatedPatient
          });
        }
      }
      
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Extract user hospital ID properly (handle populated object)
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const billHospitalId = bill.hospitalId.toString();

    // Check permissions
    if (req.user.role !== 'super_admin' && userHospitalId !== billHospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update payment details
    bill.paymentDetails = {
      paymentMethod,
      utrNumber: utrNumber || 'CASH_PAYMENT',
      paymentDate: new Date(),
      paidBy: req.user.id
    };
    bill.status = 'paid';

    await bill.save();
    await bill.populate('patientId', 'name phone age');
    await bill.populate('paymentDetails.paidBy', 'name');

    // Update pathology booking payment status if this is a pathology bill
    if (bill.type === 'pathology' && bill.referenceId) {
      const PathologyTestBooking = require('../models/PathologyTestBooking');
      await PathologyTestBooking.findByIdAndUpdate(bill.referenceId, {
        paymentStatus: 'paid',
        paymentMethod: bill.paymentDetails.paymentMethod,
        paymentDate: new Date()
      });
    }

    res.json({
      message: 'Payment marked successfully',
      bill
    });
  } catch (error) {
    console.error('Mark bill paid error:', error);
    res.status(500).json({ message: 'Server error marking bill as paid' });
  }
});

// Get all bills for a hospital
router.get('/hospital/:hospitalId', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let matchQuery = { hospitalId: req.params.hospitalId };
    
    if (status) {
      matchQuery['bills.status'] = status;
    }

    const skip = (page - 1) * limit;

    const patients = await Patient.find(matchQuery)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role')
      .populate('bills.paymentDetails.paidBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    // Flatten bills from all patients
    const allBills = [];
    patients.forEach(patient => {
      patient.bills.forEach(bill => {
        if (!status || bill.status === status) {
          allBills.push({
            ...bill.toObject(),
            patient: {
              id: patient._id,
              name: patient.name,
              phone: patient.phone,
              aadharNumber: patient.aadharNumber,
              opdNumber: patient.opdNumber,
              emergencyNumber: patient.emergencyNumber,
              patientType: patient.patientType,
              assignedDoctor: patient.assignedDoctorId
            }
          });
        }
      });
    });

    // Sort bills by date
    allBills.sort((a, b) => new Date(b.billDate) - new Date(a.billDate));

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBills = allBills.slice(startIndex, endIndex);

    res.json({
      bills: paginatedBills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allBills.length,
        pages: Math.ceil(allBills.length / limit)
      }
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ message: 'Server error fetching bills' });
  }
});

// Get billing statistics for hospital
router.get('/hospital/:hospitalId/stats', authenticate, hospitalAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let matchQuery = { hospitalId: req.params.hospitalId };
    
    if (startDate || endDate) {
      matchQuery['bills.billDate'] = {};
      if (startDate) matchQuery['bills.billDate'].$gte = new Date(startDate);
      if (endDate) matchQuery['bills.billDate'].$lte = new Date(endDate);
    }

    const billingStats = await Patient.aggregate([
      { $match: { hospitalId: req.params.hospitalId } },
      { $unwind: '$bills' },
      ...(startDate || endDate ? [{
        $match: {
          'bills.billDate': matchQuery['bills.billDate'] || {}
        }
      }] : []),
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$bills.amount' },
          paidBills: {
            $sum: { $cond: [{ $eq: ['$bills.status', 'paid'] }, 1, 0] }
          },
          pendingBills: {
            $sum: { $cond: [{ $eq: ['$bills.status', 'pending'] }, 1, 0] }
          },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$bills.status', 'paid'] }, '$bills.amount', 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$bills.status', 'pending'] }, '$bills.amount', 0] }
          }
        }
      }
    ]);

    const paymentMethodStats = await Patient.aggregate([
      { $match: { hospitalId: req.params.hospitalId } },
      { $unwind: '$bills' },
      { $match: { 'bills.status': 'paid' } },
      ...(startDate || endDate ? [{
        $match: {
          'bills.billDate': matchQuery['bills.billDate'] || {}
        }
      }] : []),
      {
        $group: {
          _id: '$bills.paymentDetails.paymentMethod',
          count: { $sum: 1 },
          amount: { $sum: '$bills.amount' }
        }
      }
    ]);

    const dailyRevenue = await Patient.aggregate([
      { $match: { hospitalId: req.params.hospitalId } },
      { $unwind: '$bills' },
      { $match: { 'bills.status': 'paid' } },
      ...(startDate || endDate ? [{
        $match: {
          'bills.billDate': matchQuery['bills.billDate'] || {}
        }
      }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$bills.billDate' } },
          revenue: { $sum: '$bills.amount' },
          bills: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      stats: billingStats[0] || {
        totalBills: 0,
        totalAmount: 0,
        paidBills: 0,
        pendingBills: 0,
        paidAmount: 0,
        pendingAmount: 0
      },
      paymentMethodStats,
      dailyRevenue
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({ message: 'Server error fetching billing statistics' });
  }
});

// Cancel bill
router.post('/bill/:billId/cancel', [
  authenticate,
  authorize('receptionist', 'billing_staff', 'hospital_admin', 'super_admin')
], async (req, res) => {
  try {
    const billId = req.params.billId;

    // Find patient with this bill
    const patient = await Patient.findOne({ 'bills._id': billId });
    if (!patient) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || req.user.hospitalId.toString() !== patient.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bill = patient.bills.id(billId);
    
    if (bill.status === 'paid') {
      return res.status(400).json({ message: 'Cannot cancel a paid bill' });
    }

    bill.status = 'cancelled';
    await patient.save();

    const updatedPatient = await Patient.findById(patient._id)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role');

    res.json({
      message: 'Bill cancelled successfully',
      patient: updatedPatient,
      bill
    });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({ message: 'Server error cancelling bill' });
  }
});

// Get patient payment history
router.get('/patient/:patientId/history', authenticate, async (req, res) => {
  try {
    const Bill = require('../models/Bill');
    const Admission = require('../models/Admission');

    const patient = await Patient.findById(req.params.patientId)
      .populate('assignedDoctorId', 'name email phone specialities')
      .populate('createdBy', 'name role')
      .populate('bills.paymentDetails.paidBy', 'name role');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions - handle populated objects
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    
    if (req.user.role !== 'super_admin' && 
        (!req.user.hospitalId || userHospitalId !== patient.hospitalId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get embedded bills from patient record
    const patientBills = patient.bills.map(bill => ({
      ...bill.toObject(),
      patient: {
        name: patient.name,
        phone: patient.phone,
        aadharNumber: patient.aadharNumber,
      }
    }));

    // Get admission bills from Bill collection
    const admissions = await Admission.find({ patientId: req.params.patientId })
      .populate({
        path: 'billIds',
        populate: {
          path: 'paymentDetails.paidBy',
          select: 'name role'
        }
      });

    const admissionBills = [];
    admissions.forEach(admission => {
      if (admission.billIds && admission.billIds.length > 0) {
        admission.billIds.forEach(bill => {
          if (bill) {
            admissionBills.push({
              ...bill.toObject(),
              admissionId: admission.admissionId,
              patient: {
                name: patient.name,
                phone: patient.phone,
                aadharNumber: patient.aadharNumber,
              }
            });
          }
        });
      }
    });

    // Combine all bills and sort by date
    const paymentHistory = [...patientBills, ...admissionBills]
      .sort((a, b) => new Date(b.billDate) - new Date(a.billDate));

    res.json({ paymentHistory });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ message: 'Server error fetching payment history' });
  }
});

// Calculate bill for admission
router.post('/calculate-admission-bill', authenticate, async (req, res) => {
  try {
    const { admissionId, dischargeDate } = req.body;

    const admission = await Admission.findById(admissionId)
      .populate('patientId', 'name')
      .populate('doctorIds', 'name dailyVisitFee')
      .populate('assistantDoctorIds', 'name dailyVisitFee')
      .populate('bedId', 'bedNumber wardType pricePerDay');

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    
    if (req.user.role !== 'super_admin' && userHospitalId !== admission.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Calculate number of days (include both admission and discharge day)
    const admissionDate = new Date(admission.admissionDate);
    const discharge = dischargeDate ? new Date(dischargeDate) : new Date();

    // Use UTC methods to avoid timezone issues
    const admissionYear = admissionDate.getUTCFullYear();
    const admissionMonth = admissionDate.getUTCMonth();
    const admissionDay = admissionDate.getUTCDate();

    const dischargeYear = discharge.getUTCFullYear();
    const dischargeMonth = discharge.getUTCMonth();
    const dischargeDay = discharge.getUTCDate();

    // Create UTC dates at midnight
    const admissionDateUTC = Date.UTC(admissionYear, admissionMonth, admissionDay);
    const dischargeDateUTC = Date.UTC(dischargeYear, dischargeMonth, dischargeDay);

    const daysAdmitted = Math.floor((dischargeDateUTC - admissionDateUTC) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate bed charges from history (or current bed if no history)
    let bedCharges = 0;
    const bedBreakdown = [];

    if (admission.bedHistory && admission.bedHistory.length > 0) {
      admission.bedHistory.forEach(entry => {
        const start = new Date(entry.startDate);
        const end = entry.endDate ? new Date(entry.endDate) : discharge;

        const startYear = start.getUTCFullYear();
        const startMonth = start.getUTCMonth();
        const startDay = start.getUTCDate();

        const endYear = end.getUTCFullYear();
        const endMonth = end.getUTCMonth();
        const endDay = end.getUTCDate();

        const startUTC = Date.UTC(startYear, startMonth, startDay);
        const endUTC = Date.UTC(endYear, endMonth, endDay);

        const days = Math.floor((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1;
        const charge = (entry.pricePerDay || 0) * Math.max(0, days);
        bedCharges += charge;

        bedBreakdown.push({
          bedNumber: entry.bedNumber,
          wardType: entry.bedType,
          pricePerDay: entry.pricePerDay || 0,
          days,
          total: charge
        });
      });
    } else {
      // Fallback: use current bed for entire stay
      bedCharges = admission.bedId?.pricePerDay ? admission.bedId.pricePerDay * daysAdmitted : 0;
    }

    // Calculate doctor visit fees
    let doctorFees = 0;
    const doctorDetails = [];

    admission.doctorIds.forEach(doctor => {
      if (doctor.dailyVisitFee) {
        const fee = doctor.dailyVisitFee * daysAdmitted;
        doctorFees += fee;
        doctorDetails.push({
          name: doctor.name,
          role: 'Primary Doctor',
          dailyFee: doctor.dailyVisitFee,
          totalFee: fee
        });
      }
    });

    admission.assistantDoctorIds.forEach(doctor => {
      if (doctor.dailyVisitFee) {
        const fee = doctor.dailyVisitFee * daysAdmitted;
        doctorFees += fee;
        doctorDetails.push({
          name: doctor.name,
          role: 'Assistant Doctor',
          dailyFee: doctor.dailyVisitFee,
          totalFee: fee
        });
      }
    });

    const totalAmount = bedCharges + doctorFees;

    res.json({
      patientName: admission.patientId.name,
      admissionId: admission.admissionId,
      admissionDate: admission.admissionDate,
      dischargeDate: discharge,
      daysAdmitted,
      bedDetails: {
        bedNumber: admission.bedId?.bedNumber,
        wardType: admission.bedId?.wardType,
        pricePerDay: admission.bedId?.pricePerDay,
        total: bedCharges
      },
      doctorFees,
      doctorDetails,
      totalAmount,
      breakdown: {
        bedCharges,
        doctorFees,
        bedBreakdown
      },
      insuranceInfo: {
        hasInsurance: admission.hasInsurance,
        insuranceProvider: admission.insuranceProvider,
        insuranceNumber: admission.insuranceNumber
      },
      govtSchemeInfo: {
        hasGovtScheme: admission.hasGovtScheme,
        schemeName: admission.schemeName,
        schemeNumber: admission.schemeNumber
      }
    });
  } catch (error) {
    console.error('Calculate admission bill error:', error);
    res.status(500).json({ message: 'Server error calculating bill' });
  }
});

// Apply for TPA Insurance
router.post('/:billId/apply-insurance', authenticate, async (req, res) => {
  try {
    const Bill = require('../models/Bill');
    const { insuranceProvider, policyNumber } = req.body;

    const bill = await Bill.findById(req.params.billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update bill status and insurance details
    bill.status = 'insurance_applied';
    bill.insuranceDetails = {
      provider: insuranceProvider,
      policyNumber: policyNumber,
      claimStatus: 'pending',
      approvedAmount: 0
    };

    await bill.save();

    res.json({
      message: 'Insurance application submitted successfully',
      bill
    });
  } catch (error) {
    console.error('Apply insurance error:', error);
    res.status(500).json({ message: 'Server error applying for insurance' });
  }
});

// Approve Insurance
router.post('/:billId/approve-insurance', authenticate, async (req, res) => {
  try {
    const Bill = require('../models/Bill');
    const { approvedAmount, claimNumber } = req.body;

    const bill = await Bill.findById(req.params.billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update bill status and insurance approval
    bill.status = 'insurance_approved';
    bill.insuranceDetails.claimStatus = 'approved';
    bill.insuranceDetails.approvedAmount = approvedAmount;
    bill.insuranceDetails.claimNumber = claimNumber;

    await bill.save();

    res.json({
      message: 'Insurance approved successfully',
      bill
    });
  } catch (error) {
    console.error('Approve insurance error:', error);
    res.status(500).json({ message: 'Server error approving insurance' });
  }
});

// Mark Insurance Payment
router.post('/:billId/insurance-payment', authenticate, async (req, res) => {
  try {
    const Bill = require('../models/Bill');
    const { paymentMethod, referenceNumber, notes } = req.body;

    const bill = await Bill.findById(req.params.billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check hospital access
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    if (req.user.role !== 'super_admin' && userHospitalId !== bill.hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (bill.insuranceDetails.claimStatus !== 'approved') {
      return res.status(400).json({ message: 'Insurance must be approved before payment' });
    }

    // Add insurance payment source
    bill.paymentSources.push({
      sourceType: 'insurance',
      amount: bill.insuranceDetails.approvedAmount,
      paymentDate: new Date(),
      referenceNumber: referenceNumber,
      notes: notes,
      paymentMethod: paymentMethod,
      insuranceProvider: bill.insuranceDetails.provider,
      policyNumber: bill.insuranceDetails.policyNumber,
      claimNumber: bill.insuranceDetails.claimNumber
    });

    // Update payment details
    bill.paymentDetails = {
      paymentMethod: paymentMethod,
      utrNumber: referenceNumber,
      paymentDate: new Date(),
      paidBy: req.user._id
    };

    await bill.save();

    res.json({
      message: 'Insurance payment recorded successfully',
      bill
    });
  } catch (error) {
    console.error('Insurance payment error:', error);
    res.status(500).json({ message: 'Server error recording insurance payment' });
  }
});

module.exports = router;
