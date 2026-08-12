const express = require('express');
const router = express.Router();
const multer = require('multer');
const PathologyTestBooking = require('../models/PathologyTestBooking');
const PathologyTest = require('../models/PathologyTest');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// Get all pathology test bookings for a hospital
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      paymentStatus,
      sampleCollected,
      reportStatus,
      dateFrom,
      dateTo
    } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { hospitalId: req.user.hospitalId };
    
    if (search) {
      query.$or = [
        { 'tests.testName': { $regex: search, $options: 'i' } },
        { 'notes': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    if (sampleCollected === 'true') {
      query['sampleCollection.isCollected'] = true;
    } else if (sampleCollected === 'false') {
      query['sampleCollection.isCollected'] = false;
    }
    
    if (reportStatus) {
      query['reports.status'] = reportStatus;
    }
    
    if (dateFrom || dateTo) {
      query.bookingDate = {};
      if (dateFrom) query.bookingDate.$gte = new Date(dateFrom);
      if (dateTo) query.bookingDate.$lte = new Date(dateTo);
    }
    
    const bookings = await PathologyTestBooking.find(query)
      .populate('patientId', 'name phone age gender')
      .populate('doctorId', 'name')
      .populate('tests.testId', 'name code category')
      .populate('reports.testId', 'name code')
      .populate('sampleCollection.collectedBy', 'name')
      .populate('reports.reportedBy', 'name')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PathologyTestBooking.countDocuments(query);
    
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
    console.error('Get pathology bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single pathology test booking
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await PathologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    })
    .populate('patientId', 'name phone age gender address')
    .populate('doctorId', 'name')
    .populate('tests.testId', 'name code category description sampleType preparationInstructions')
    .populate('reports.testId', 'name code category normalRange units')
    .populate('sampleCollection.collectedBy', 'name')
    .populate('reports.reportedBy', 'name');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json({ booking });
  } catch (error) {
    console.error('Get pathology booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new pathology test booking
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      tests,
      preferredDate,
      preferredTime,
      urgency,
      homeCollection,
      collectionAddress,
      notes,
      discount,
      paymentMethod
    } = req.body;
    
    // Validate patient exists
    const patient = await Patient.findOne({
      _id: patientId,
      hospitalId: req.user.hospitalId
    });
    
    if (!patient) {
      return res.status(400).json({ message: 'Invalid patient' });
    }
    
    // Validate doctor exists
    const doctor = await User.findOne({
      _id: doctorId,
      hospitalId: req.user.hospitalId,
      role: 'doctor'
    });
    
    if (!doctor) {
      return res.status(400).json({ message: 'Invalid doctor' });
    }
    
    // Validate tests and get pricing
    const testDetails = await Promise.all(
      tests.map(async (test) => {
        const testDoc = await PathologyTest.findOne({
          _id: test.testId,
          hospitalId: req.user.hospitalId,
          isActive: true
        }).populate('provider');
        
        if (!testDoc) {
          throw new Error(`Invalid test: ${test.testId}`);
        }
        
        return {
          testId: testDoc._id,
          testName: testDoc.name,
          testCode: testDoc.code,
          category: testDoc.category,
          sampleType: testDoc.sampleType,
          price: testDoc.pricing.sellingPrice,
          costPrice: testDoc.pricing.costPrice
        };
      })
    );
    
    const totalAmount = testDetails.reduce((sum, test) => sum + test.price, 0);
    const totalCost = testDetails.reduce((sum, test) => sum + test.costPrice, 0);
    const finalAmount = totalAmount - (discount || 0);
    
    // Initialize reports array
    const reports = testDetails.map(test => ({
      testId: test.testId,
      status: 'pending'
    }));
    
    const booking = new PathologyTestBooking({
      patientId,
      doctorId,
      tests: testDetails,
      preferredDate: new Date(preferredDate),
      preferredTime,
      urgency,
      sampleCollection: {
        homeCollection: homeCollection || false,
        collectionAddress: homeCollection ? collectionAddress : undefined
      },
      reports,
      totalAmount,
      totalCost,
      discount: discount || 0,
      finalAmount,
      paymentMethod: paymentMethod || 'cash',
      notes,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });
    
    await booking.save();
    await booking.populate('patientId', 'name phone age gender');
    await booking.populate('doctorId', 'name');
    await booking.populate('tests.testId', 'name code category');

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
      description: `Pathology Tests - ${booking._id} (${booking.patientId.name})`,
      type: 'pathology',
      referenceId: booking._id,
      hospitalId: booking.hospitalId,
      createdBy: req.user._id,
      status: 'pending',
      billDate: new Date(),
      paymentDetails: {
        paymentMethod: paymentMethod || 'cash',
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
    console.error('Create pathology booking error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Update sample collection status
router.put('/:id/sample-collection', authenticate, async (req, res) => {
  try {
    const { isCollected, collectedDate, collectionNotes } = req.body;
    
    const booking = await PathologyTestBooking.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      {
        'sampleCollection.isCollected': isCollected,
        'sampleCollection.collectedDate': collectedDate ? new Date(collectedDate) : undefined,
        'sampleCollection.collectedBy': isCollected ? req.user.id : undefined,
        'sampleCollection.collectionNotes': collectionNotes,
        status: isCollected ? 'sample_collected' : 'booked'
      },
      { new: true, runValidators: true }
    ).populate('sampleCollection.collectedBy', 'name');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json({ booking });
  } catch (error) {
    console.error('Update sample collection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload pathology report
router.post('/:id/reports/:testId', authenticate, upload.single('report'), async (req, res) => {
  try {
    const { normalValues, patientValues, remarks } = req.body;
    
    const booking = await PathologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Find the specific test report
    const reportIndex = booking.reports.findIndex(
      report => report.testId.toString() === req.params.testId
    );
    
    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Test not found in booking' });
    }
    
    // Upload report to Cloudinary if file provided
    let reportUrl = booking.reports[reportIndex].reportUrl;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'pathology-reports',
        resource_type: 'auto'
      });
      reportUrl = result.secure_url;
    }
    
    // Update the report
    booking.reports[reportIndex] = {
      ...booking.reports[reportIndex],
      status: 'completed',
      reportUrl,
      reportDate: new Date(),
      reportedBy: req.user.id,
      normalValues,
      patientValues,
      remarks
    };
    
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
    await booking.populate('reports.testId', 'name code category');
    await booking.populate('reports.reportedBy', 'name');
    
    res.json({ booking });
  } catch (error) {
    console.error('Upload pathology report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create detailed pathology report
router.post('/:id/reports/:testId/detailed', authenticate, upload.array('images', 10), async (req, res) => {
  try {
    const { components, outcome, notes } = req.body;
    
    const booking = await PathologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Find the specific test report
    const reportIndex = booking.reports.findIndex(
      report => report.testId._id.toString() === req.params.testId
    );

    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Test not found in booking' });
    }

    console.log('Found report at index:', reportIndex);
    console.log('Existing report testId:', booking.reports[reportIndex].testId);
    console.log('Request testId param:', req.params.testId);

    // Parse components
    let parsedComponents = [];
    try {
      console.log('Parsing components:', components);
      parsedComponents = JSON.parse(components);
      console.log('Parsed components:', parsedComponents);

      // Remove the 'id' field from components (it's for frontend React state only)
      parsedComponents = parsedComponents.map(({ id, ...component }) => component);

      // Validate new component structure
      for (const component of parsedComponents) {
        if (!component.name || !component.patientLevel || !component.genericRange || !component.level) {
          return res.status(400).json({ message: 'Missing required component fields: name, patientLevel, genericRange, level' });
        }
      }
    } catch (error) {
      console.error('Error parsing components:', error);
      return res.status(400).json({ message: 'Invalid components format' });
    }
    
    // Upload images to Cloudinary with compression
    const uploadedImages = [];
    console.log('Starting image upload...');
    if (req.files && req.files.length > 0) {
      console.log('Found files to upload:', req.files.length);
      for (const file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'pathology-reports',
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
    console.log('Setting report fields...');
    console.log('parsedComponents:', parsedComponents);
    console.log('outcome:', outcome);
    console.log('notes:', notes);
    console.log('uploadedImages:', uploadedImages);

    booking.reports[reportIndex].status = 'completed';
    booking.reports[reportIndex].reportDate = new Date();
    booking.reports[reportIndex].reportedBy = req.user.id;
    booking.reports[reportIndex].components = parsedComponents;
    booking.reports[reportIndex].outcome = outcome;
    booking.reports[reportIndex].notes = notes;
    booking.reports[reportIndex].images = uploadedImages;
    booking.reports[reportIndex].reportType = 'detailed';

    // Mark reports array as modified for Mongoose
    booking.markModified('reports');

    console.log('After setting fields - components:', booking.reports[reportIndex].components);
    console.log('After setting fields - outcome:', booking.reports[reportIndex].outcome);
    console.log('Before save - report at index:', reportIndex);
    console.log('Report data before save:', JSON.stringify(booking.reports[reportIndex], null, 2));

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
    await booking.populate('reports.testId', 'name code category');
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

// Download pathology report
router.get('/:id/reports/:testId/download', authenticate, async (req, res) => {
  try {
    const booking = await PathologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    }).populate('patientId', 'name').populate('reports.testId', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    console.log('Looking for testId:', req.params.testId);
    console.log('Available reports:', booking.reports.map(r => ({
      testId: r.testId,
      testIdString: r.testId?._id?.toString() || r.testId?.toString(),
      status: r.status
    })));

    // Find the specific test report (handle both populated and non-populated testId)
    const report = booking.reports.find(
      report => {
        const testIdStr = report.testId._id ? report.testId._id.toString() : report.testId.toString();
        return testIdStr === req.params.testId;
      }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    console.log('Report data:', JSON.stringify(report, null, 2));

    // If report has images, return the first image URL
    if (report.images && report.images.length > 0) {
      return res.json({
        type: 'image',
        url: report.images[0].url,
        fileName: `pathology_report_${booking._id}_${report.testId}.jpg`
      });
    }

    // If report has components (detailed report), generate a simple text summary
    if (report.components && report.components.length > 0) {
      let reportText = `Pathology Report\n`;
      reportText += `================\n`;
      reportText += `Patient: ${booking.patientId?.name || 'N/A'}\n`;
      reportText += `Test: ${report.testId?.name || 'N/A'}\n`;
      reportText += `Report Date: ${report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}\n\n`;
      reportText += `Components:\n`;
      reportText += `-----------\n`;

      report.components.forEach((comp, index) => {
        reportText += `${index + 1}. ${comp.name}\n`;
        reportText += `   Patient Level: ${comp.patientLevel}\n`;
        reportText += `   Generic Range: ${comp.genericRange}\n`;
        reportText += `   Level: ${comp.level}\n`;
        if (comp.description) {
          reportText += `   Description: ${comp.description}\n`;
        }
        reportText += `\n`;
      });

      if (report.outcome) {
        reportText += `Overall Assessment:\n`;
        reportText += `-------------------\n${report.outcome}\n\n`;
      }

      if (report.notes) {
        reportText += `Additional Notes:\n`;
        reportText += `----------------\n${report.notes}\n`;
      }

      return res.json({
        type: 'text',
        content: reportText,
        fileName: `pathology_report_${booking._id}_${report.testId}.txt`
      });
    }

    // If report has a URL (simple report)
    if (report.reportUrl) {
      return res.json({
        type: 'url',
        url: report.reportUrl,
        fileName: `pathology_report_${booking._id}_${report.testId}.pdf`
      });
    }

    // If report is completed but has no content, return a basic summary
    if (report.status === 'completed') {
      let reportText = `Pathology Report\n`;
      reportText += `================\n`;
      reportText += `Patient: ${booking.patientId?.name || 'N/A'}\n`;
      reportText += `Test: ${report.testId?.name || 'N/A'}\n`;
      reportText += `Report Date: ${report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}\n`;
      reportText += `Status: ${report.status}\n`;
      reportText += `\nNote: Detailed report content not available.`;

      return res.json({
        type: 'text',
        content: reportText,
        fileName: `pathology_report_${booking._id}_${report.testId}.txt`
      });
    }

    return res.status(404).json({ message: 'No downloadable content found' });
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update report status
router.put('/:id/reports/:testId/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await PathologyTestBooking.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Find the specific test report
    const reportIndex = booking.reports.findIndex(
      report => report.testId.toString() === req.params.testId
    );
    
    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Test not found in booking' });
    }
    
    // Update the report status
    booking.reports[reportIndex].status = status;
    
    if (status === 'completed' || status === 'ready') {
      booking.reports[reportIndex].reportDate = new Date();
      booking.reports[reportIndex].reportedBy = req.user.id;
    }
    
    // Check if all reports are completed
    const allReportsCompleted = booking.reports.every(
      report => report.status === 'completed' || report.status === 'ready'
    );
    
    if (allReportsCompleted) {
      booking.status = 'completed';
    } else if (status === 'in_progress') {
      booking.status = 'in_progress';
    }
    
    await booking.save();
    await booking.populate('reports.testId', 'name code category');
    await booking.populate('reports.reportedBy', 'name');
    
    res.json({ booking });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payment status
router.put('/:id/payment', authenticate, async (req, res) => {
  try {
    const { paymentStatus, paymentMethod } = req.body;
    
    const booking = await PathologyTestBooking.findOneAndUpdate(
      { _id: req.params.id, hospitalId: req.user.hospitalId },
      { paymentStatus, paymentMethod },
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
          utrNumber: null,
          paymentDate: new Date(),
          paidBy: req.user.id
        },
        paymentSources: [{
          sourceType: 'patient',
          amount: booking.finalAmount,
          paymentDate: new Date(),
          referenceNumber: null,
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

// Generate PDF bill for pathology booking
router.get('/:id/bill-pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await PathologyTestBooking.findById(id)
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

    const { generatePathologyBillPDF } = require('../utils/generatePathologyBillPDF');

    const pdfBuffer = await generatePathologyBillPDF(
      booking,
      booking.hospitalId,
      booking.patientId,
      booking.doctorId,
      booking.billId,
      booking.createdBy
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=pathology-bill-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate pathology bill PDF error:', error);
    res.status(500).json({ message: 'Server error generating PDF bill' });
  }
});

// Get patient pathology history
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const bookings = await PathologyTestBooking.find({
      patientId: req.params.patientId,
      hospitalId: req.user.hospitalId
    })
    .populate('doctorId', 'name')
    .populate('tests.testId', 'name code category')
    .populate('reports.testId', 'name code')
    .sort({ bookingDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await PathologyTestBooking.countDocuments({
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
    console.error('Get patient pathology history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const [
      totalBookings,
      todayBookings,
      pendingSamples,
      pendingReports,
      completedReports,
      totalRevenue
    ] = await Promise.all([
      PathologyTestBooking.countDocuments({ hospitalId: req.user.hospitalId }),
      PathologyTestBooking.countDocuments({
        hospitalId: req.user.hospitalId,
        bookingDate: { $gte: startOfDay, $lte: endOfDay }
      }),
      PathologyTestBooking.countDocuments({
        hospitalId: req.user.hospitalId,
        'sampleCollection.isCollected': false,
        status: { $in: ['booked', 'sample_collected'] }
      }),
      PathologyTestBooking.countDocuments({
        hospitalId: req.user.hospitalId,
        'reports.status': 'pending'
      }),
      PathologyTestBooking.countDocuments({
        hospitalId: req.user.hospitalId,
        'reports.status': 'completed'
      }),
      PathologyTestBooking.aggregate([
        { $match: { hospitalId: req.user.hospitalId, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ])
    ]);
    
    res.json({
      totalBookings,
      todayBookings,
      pendingSamples,
      pendingReports,
      completedReports,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
