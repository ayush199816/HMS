const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Patient Information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  
  // Doctor Information
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  
  // Assistant Doctor(s)
  assistantDoctorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Assigned Nurse(s)
  assignedNurseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Hospital Information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  
  // Appointment Details
  appointmentDate: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  
  // Queue number for the day (per doctor)
  queueNumber: {
    type: Number,
    required: false // Temporarily make optional to debug
  },
  
  // Appointment Status
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  
  // Appointment Type
  appointmentType: {
    type: String,
    enum: ['consultation', 'follow_up', 'emergency', 'surgery', 'test'],
    default: 'consultation'
  },
  
  // Time slot (optional)
  timeSlot: {
    start: {
      type: String, // Format: "09:00"
      default: null
    },
    end: {
      type: String, // Format: "09:30"
      default: null
    }
  },
  
  // Notes
  notes: {
    type: String,
    default: ''
  },
  
  // Symptoms/Reason for visit
  symptoms: {
    type: String,
    required: [true, 'Symptoms or reason for visit is required']
  },
  
  // Payment Information
  consultationFee: {
    type: Number,
    required: true,
    min: 0
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'online'],
    default: undefined
  },
  
  paymentAmount: {
    type: Number,
    default: null
  },
  
  // Reference to Bill created for this appointment
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  
  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate queue number before saving
appointmentSchema.pre('save', async function(next) {
  console.log('Pre-save hook triggered, isNew:', this.isNew);
  console.log('Appointment data:', {
    doctorId: this.doctorId,
    appointmentDate: this.appointmentDate,
    appointmentType: this.appointmentType
  });
  
  if (this.isNew) {
    try {
      // Get the start and end of the appointment date
      const startOfDay = new Date(this.appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(this.appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('Date range:', { startOfDay, endOfDay });
      
      // Count existing appointments for this doctor on this date
      const existingAppointments = await this.constructor.countDocuments({
        doctorId: this.doctorId,
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        status: { $ne: 'cancelled' } // Don't count cancelled appointments
      });
      
      console.log('Existing appointments count:', existingAppointments);
      
      // Assign next queue number
      this.queueNumber = existingAppointments + 1;
      
      console.log('Assigned queue number:', this.queueNumber);
      
    } catch (error) {
      console.error('Error generating queue number:', error);
      return next(error);
    }
  }
  
  this.updatedAt = Date.now();
  next();
});

// Method to get appointment display string
appointmentSchema.methods.getDisplayString = function() {
  return `Queue #${this.queueNumber} - ${this.appointmentDate.toLocaleDateString()} at ${this.timeSlot?.start || 'TBD'}`;
};

// Method to check if appointment is today
appointmentSchema.methods.isToday = function() {
  const today = new Date();
  return this.appointmentDate.toDateString() === today.toDateString();
};

// Method to check if appointment is upcoming
appointmentSchema.methods.isUpcoming = function() {
  return this.appointmentDate > new Date() && this.status === 'scheduled';
};

// Static method to get doctor's daily queue
appointmentSchema.statics.getDoctorDailyQueue = async function(doctorId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await this.find({
    doctorId,
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $ne: 'cancelled' }
  })
  .populate('patientId', 'name age phone')
  .sort({ queueNumber: 1 });
};

// Static method to get patient appointments
appointmentSchema.statics.getPatientAppointments = async function(patientId) {
  return await this.find({ patientId })
    .populate('doctorId', 'name specialities')
    .populate('hospitalId', 'name')
    .sort({ appointmentDate: -1 });
};

module.exports = mongoose.model('Appointment', appointmentSchema);
