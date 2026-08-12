const express = require('express');
const router = express.Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const RadiologyTestBooking = require('../models/RadiologyTestBooking');
const RadiologyTest = require('../models/RadiologyTest');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// Get radiology bookings with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, scanCollected, reportStatus } = req.query;
    const skip = (page - 1) * limit;

    let query = { hospitalId: req.user.hospitalId };

    if (search) {
      query.$or = [
        { 'patientId.name': { $regex: search, $options: 'i' } },
        { 'patientId.phone': { $regex: search, $options: 'i' } },
        { 'patientId.opdNumber': { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (scanCollected === 'true') {
      query['scanCollection.isCollected'] = true;
    } else if (scanCollected === 'false') {
      query['scanCollection.isCollected'] = false;
    }

    if (reportStatus === 'completed') {
      query['reports.status'] = 'completed';
    } else if (reportStatus === 'pending') {
      query['reports.status'] = 'pending';
    }

    const bookings = await RadiologyTestBooking.find(query)
      .populate('patientId', 'name phone age gender opdNumber')
      .populate('doctorId', 'name')
      .populate('tests.testId', 'name code category bodyPart')
      .populate('reports.testId', 'name code category bodyPart')
      .populate('scanCollection.collectedBy', 'name')
      .populate('reports.reportedBy', 'name')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RadiologyTestBooking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get radiology bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single radiology booking by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await RadiologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    })
      .populate('patientId', 'name phone age gender opdNumber email')
      .populate('doctorId', 'name')
      .populate('tests.testId', 'name code category bodyPart')
      .populate('reports.testId', 'name code category bodyPart')
      .populate('scanCollection.collectedBy', 'name')
      .populate('reports.reportedBy', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get radiology booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', authenticate, async (req, res) => {
  try {
    const stats = await RadiologyTestBooking.aggregate([
      { $match: { hospitalId: req.user.hospitalId } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          todayBookings: {
            $sum: {
              $cond: [
                { $gte: ['$bookingDate', new Date(new Date().setHours(0, 0, 0, 0))] },
                1,
                0
              ]
            }
          },
          pendingScans: {
            $sum: { $cond: [{ $eq: ['$scanCollection.isCollected', false] }, 1, 0] }
          },
          pendingReports: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'scan_collected'] },
                1,
                0
              ]
            }
          },
          completedReports: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json(stats[0] || {
      totalBookings: 0,
      todayBookings: 0,
      pendingScans: 0,
      pendingReports: 0,
      completedReports: 0
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create radiology test booking
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, tests, preferredDate, preferredTime, urgency, notes, totalAmount, totalCost, finalAmount } = req.body;

    // Verify patient exists
    const patient = await Patient.findOne({ _id: patientId, hospitalId: req.user.hospitalId });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify doctor exists (optional)
    let doctor = null;
    if (doctorId) {
      doctor = await User.findOne({ _id: doctorId, hospitalId: req.user.hospitalId });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
    }

    // Get test details
    const testIds = tests.map(t => t.testId);
    const radiologyTests = await RadiologyTest.find({
      _id: { $in: testIds },
      hospitalId: req.user.hospitalId,
      isActive: true
    });

    if (radiologyTests.length !== testIds.length) {
      return res.status(400).json({ message: 'One or more tests not found' });
    }

    // Generate booking ID
    const bookingId = 'RAD' + Date.now().toString().slice(-8);

    // Create booking with test details
    const bookingTests = tests.map(t => {
      const test = radiologyTests.find(rt => rt._id.toString() === t.testId);
      return {
        testId: test._id,
        testName: test.name,
        testCode: test.code,
        category: test.category,
        bodyPart: test.bodyPart,
        price: test.pricing.sellingPrice,
        costPrice: test.pricing.costPrice
      };
    });

    // Create reports for each test
    const reports = bookingTests.map(t => ({
      testId: t.testId,
      status: 'pending'
    }));

    const booking = new RadiologyTestBooking({
      bookingId,
      patientId,
      doctorId: doctorId || null,
      tests: bookingTests,
      reports,
      preferredDate: new Date(preferredDate),
      preferredTime,
      urgency,
      notes,
      totalAmount: totalAmount || 0,
      totalCost: totalCost || 0,
      finalAmount: finalAmount || 0,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });

    await booking.save();
    await booking.populate('patientId', 'name phone age gender');
    await booking.populate('doctorId', 'name');
    await booking.populate('tests.testId', 'name code category bodyPart');

    // Create bill immediately with pending status
    const Bill = require('../models/Bill');
    
    // Generate unique bill number with retry logic
    let billNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const existingBill = await Bill.findOne({ billNumber });
      if (!existingBill) {
        break;
      }
      attempts++;
      // Small delay to avoid rapid collisions
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const bill = new Bill({
      billNumber: billNumber,
      patientId: booking.patientId._id,
      amount: booking.finalAmount,
      description: `Radiology Tests - ${booking.bookingId} (${booking.patientId.name})`,
      type: 'radiology',
      referenceId: booking._id,
      hospitalId: booking.hospitalId,
      createdBy: req.user._id,
      status: 'pending',
      billDate: new Date(),
      paymentDetails: {
        paymentMethod: 'cash',
        utrNumber: null
      },
      items: booking.tests.map(test => ({
        name: test.testName,
        quantity: 1,
        price: test.price,
        total: test.price
      })),
      paymentSources: [],
      totalPaid: 0,
      balanceAmount: booking.finalAmount
    });
    
    await bill.save();
    
    // Link bill to booking
    booking.billId = bill._id;
    await booking.save();

    res.status(201).json({ booking });
  } catch (error) {
    console.error('Create radiology booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update scan collection status
router.put('/:id/scan-collection', authenticate, async (req, res) => {
  try {
    const { isCollected, collectedDate, collectionNotes } = req.body;

    const booking = await RadiologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.scanCollection.isCollected = isCollected;
    booking.scanCollection.collectedDate = collectedDate ? new Date(collectedDate) : new Date();
    booking.scanCollection.collectedBy = req.user.id;
    booking.scanCollection.collectionNotes = collectionNotes || '';

    if (isCollected) {
      booking.status = 'scan_collected';
    } else {
      booking.status = 'booked';
    }

    await booking.save();
    await booking.populate('patientId', 'name phone age gender');
    await booking.populate('doctorId', 'name');
    await booking.populate('scanCollection.collectedBy', 'name');

    res.json({ booking });
  } catch (error) {
    console.error('Update scan collection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create detailed radiology report
router.post('/:id/reports/:testId/detailed', authenticate, upload.array('images', 10), async (req, res) => {
  try {
    const { observation, findings, impression } = req.body;

    const booking = await RadiologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Find the specific test report
    const reportIndex = booking.reports.findIndex(
      report => report.testId._id ? report.testId._id.toString() === req.params.testId : report.testId.toString() === req.params.testId
    );

    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Test not found in booking' });
    }

    // Upload images to Cloudinary with compression
    const uploadedImages = [];
    console.log('Starting image upload...');
    if (req.files && req.files.length > 0) {
      console.log('Found files to upload:', req.files.length);
      for (const file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'radiology-reports',
            resource_type: 'auto',
            transformation: [
              { quality: 'auto:good', fetch_format: 'auto' },
              { quality: 70 },
              { flags: 'progressive' },
              { width: 1200, crop: 'limit' }
            ]
          });
          uploadedImages.push({
            url: result.secure_url,
            publicId: result.public_id,
            originalName: file.originalname
          });
        } catch (error) {
          console.error('Error uploading image:', error);
        }
      }
    } else {
      console.log('No files to upload');
    }
    console.log('Image upload completed');

    // Update the report with detailed data
    booking.reports[reportIndex].status = 'completed';
    booking.reports[reportIndex].reportDate = new Date();
    booking.reports[reportIndex].reportedBy = req.user.id;
    booking.reports[reportIndex].observation = observation;
    booking.reports[reportIndex].findings = findings;
    booking.reports[reportIndex].impression = impression;
    booking.reports[reportIndex].images = uploadedImages;
    booking.reports[reportIndex].reportType = 'detailed';

    // Mark reports array as modified for Mongoose
    booking.markModified('reports');

    // Check if all reports are completed
    const allReportsCompleted = booking.reports.every(
      report => report.status === 'completed' || report.status === 'ready'
    );

    if (allReportsCompleted) {
      booking.status = 'completed';
    } else {
      booking.status = 'in_progress';
    }

    await booking.save();
    await booking.populate('reports.testId', 'name code category bodyPart');
    await booking.populate('reports.reportedBy', 'name');

    res.json({
      message: 'Detailed report created successfully',
      booking
    });
  } catch (error) {
    console.error('Create detailed report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download radiology report
router.get('/:id/reports/:testId/download', authenticate, async (req, res) => {
  try {
    const booking = await RadiologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    }).populate('patientId', 'name phone age gender').populate('reports.testId', 'name code category bodyPart');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Find the specific test report
    const report = booking.reports.find(
      report => report.testId._id ? report.testId._id.toString() === req.params.testId : report.testId.toString() === req.params.testId
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const patientName = booking.patientId?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'patient';
    const patientId = booking.patientId?._id?.toString().slice(-8) || 'unknown';
    const fileName = `${patientName}_${patientId}_report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // Register a font that supports more characters
    // Using standard fonts to avoid encoding issues
    doc.registerFont('Normal', 'Helvetica');
    doc.registerFont('Bold', 'Helvetica-Bold');
    
    // Set encoding to handle special characters
    doc.info.Producer = 'Hospital Management System';

    // Header
    doc.fontSize(20).font('Bold').text('RADIOLOGY REPORT', { align: 'center' });
    doc.moveDown();

    // Patient Information
    doc.fontSize(14).font('Bold').text('Patient Information');
    doc.fontSize(11).font('Normal').text(`Name: ${booking.patientId?.name || 'N/A'}`);
    doc.text(`Phone: ${booking.patientId?.phone || 'N/A'}`);
    doc.text(`Age: ${booking.patientId?.age || 'N/A'}`);
    doc.text(`Gender: ${booking.patientId?.gender || 'N/A'}`);
    doc.moveDown();

    // Test Information
    doc.fontSize(14).font('Bold').text('Test Information');
    doc.fontSize(11).font('Normal').text(`Test: ${report.testId?.name || 'N/A'}`);
    doc.text(`Category: ${report.testId?.category || 'N/A'}`);
    doc.text(`Body Part: ${report.testId?.bodyPart || 'N/A'}`);
    doc.text(`Report Date: ${report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
    doc.moveDown();

    // Observation - strip HTML tags and handle newlines
    if (report.observation) {
      const cleanText = report.observation.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/<br>/g, '\n').replace(/\n/g, ' ');
      doc.fontSize(14).font('Bold').text('Observation');
      doc.fontSize(11).font('Normal');
      // Use PDFKit's text wrapping with width parameter
      doc.text(cleanText, { align: 'left', width: 500, lineGap: 2 });
      doc.moveDown();
    }

    // Findings - strip HTML tags and handle newlines
    if (report.findings) {
      const cleanText = report.findings.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/<br>/g, '\n').replace(/\n/g, ' ');
      doc.fontSize(14).font('Bold').text('Findings');
      doc.fontSize(11).font('Normal');
      // Use PDFKit's text wrapping with width parameter
      doc.text(cleanText, { align: 'left', width: 500, lineGap: 2 });
      doc.moveDown();
    }

    // Impression - strip HTML tags and handle newlines
    if (report.impression) {
      const cleanText = report.impression.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/<br>/g, '\n').replace(/\n/g, ' ');
      doc.fontSize(14).font('Bold').text('Impression');
      doc.fontSize(11).font('Normal');
      // Use PDFKit's text wrapping with width parameter
      doc.text(cleanText, { align: 'left', width: 500, lineGap: 2 });
      doc.moveDown();
    }

    // Add scan images if available
    if (report.images && report.images.length > 0) {
      doc.fontSize(14).font('Bold').text('Scan Images');
      doc.moveDown();

      for (const img of report.images) {
        try {
          if (img.url) {
            // Download image from Cloudinary using axios
            const response = await axios.get(img.url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);
            
            doc.image(imageBuffer, { fit: [500, 400], align: 'center' });
            doc.moveDown();
          }
        } catch (err) {
          console.error('Error adding image to PDF:', err);
        }
      }
    }

    // Footer
    doc.fontSize(9).font('Helvetica').text(`Generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get patient radiology history
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const bookings = await RadiologyTestBooking.find({
      patientId: req.params.patientId,
      hospitalId: req.user.hospitalId
    })
      .populate('patientId', 'name phone age gender')
      .populate('doctorId', 'name')
      .populate('tests.testId', 'name code category bodyPart')
      .populate('reports.testId', 'name code category bodyPart')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RadiologyTestBooking.countDocuments({
      patientId: req.params.patientId,
      hospitalId: req.user.hospitalId
    });

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get patient radiology history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payment status
router.put('/:id/payment', authenticate, async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, transactionId } = req.body;

    const booking = await RadiologyTestBooking.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { paymentStatus, paymentMethod, transactionId },
      { new: true, runValidators: true }
    ).populate('patientId', 'name opdNumber');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update existing bill when payment is marked as paid
    if (paymentStatus === 'paid' && booking.billId) {
      const Bill = require('../models/Bill');
      await Bill.findByIdAndUpdate(booking.billId, {
        status: 'paid',
        paymentDetails: {
          paymentMethod,
          utrNumber: transactionId || null,
          paymentDate: new Date(),
          paidBy: req.user.id
        },
        paymentSources: [{
          sourceType: 'patient',
          amount: booking.finalAmount,
          paymentDate: new Date(),
          referenceNumber: transactionId || null,
          paymentMethod
        }],
        totalPaid: booking.finalAmount,
        balanceAmount: 0
      }, { runValidators: true });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate PDF bill for radiology booking
router.get('/:id/bill-pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await RadiologyTestBooking.findById(id)
      .populate('patientId')
      .populate('doctorId')
      .populate('hospitalId')
      .populate('billId')
      .populate('createdBy');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check hospital access
    if (req.user.role !== 'super_admin') {
      const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
      const bookingHospitalId = booking.hospitalId._id ? booking.hospitalId._id.toString() : booking.hospitalId.toString();

      if (!req.user.hospitalId || userHospitalId !== bookingHospitalId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { generateRadiologyBillPDF } = require('../utils/generateRadiologyBillPDF');

    const pdfBuffer = await generateRadiologyBillPDF(
      booking,
      booking.hospitalId,
      booking.patientId,
      booking.doctorId,
      booking.billId,
      booking.createdBy
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=radiology-bill-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate radiology bill PDF error:', error);
    res.status(500).json({ message: 'Server error generating PDF bill' });
  }
});

module.exports = router;
