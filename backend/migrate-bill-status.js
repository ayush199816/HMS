const mongoose = require('mongoose');
const Bill = require('./models/Bill');
const Patient = require('./models/Patient');
const Admission = require('./models/Admission');
require('dotenv').config();

async function migrateBillStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hms');
    console.log('Connected to MongoDB');

    // Find the admission
    const admission = await Admission.findOne({ admissionId: 'ADM20260001' });
    if (!admission) {
      console.log('Admission not found');
      return;
    }

    console.log('Found admission:', admission._id);
    console.log('Patient ID:', admission.patientId);

    // Find the bill with advance payment
    const bill = await Bill.findOne({
      patientId: admission.patientId,
      advanceAmount: { $gt: 0 }
    }).sort({ createdAt: -1 });

    if (!bill) {
      console.log('No bill with advance payment found');
      return;
    }

    console.log('Found bill:', bill.billNumber);
    console.log('Bill amount:', bill.totalAmount);
    console.log('Advance amount:', bill.advanceAmount);
    console.log('Current status:', bill.status);

    // Calculate unused advance
    const unusedAdvance = bill.advanceAmount - bill.totalAmount;
    console.log('Unused advance:', unusedAdvance);

    // Update bill status to pending if it was marked as paid with only advance
    const actualPayments = bill.paymentSources?.reduce((sum, source) => {
      if (source.sourceType !== 'advance') {
        return sum + (source.amount || 0);
      }
      return sum;
    }, 0) || 0;

    if (actualPayments === 0 && bill.status === 'paid') {
      // Use updateOne to bypass pre-save hook validation
      await Bill.updateOne(
        { _id: bill._id },
        {
          $set: {
            status: 'pending',
            balanceAmount: bill.totalAmount - actualPayments
          }
        }
      );
      console.log('Updated bill status to pending');
    }

    // Update patient's advance balance
    const patient = await Patient.findById(admission.patientId);
    if (patient) {
      patient.advanceBalance = unusedAdvance;
      await patient.save();
      console.log('Updated patient advance balance to:', patient.advanceBalance);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateBillStatus();
