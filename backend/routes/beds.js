const express = require('express');
const router = express.Router();
const Bed = require('../models/Bed');
const Admission = require('../models/Admission');
const { authenticate } = require('../middleware/auth');

// Get all beds for a hospital
router.get('/', authenticate, async (req, res) => {
  try {
    const { wardType, status, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    let query = { hospitalId: req.user.hospitalId };

    if (wardType) {
      query.wardType = wardType;
    }

    if (status) {
      query.status = status;
    }

    const beds = await Bed.find(query)
      .populate('currentAdmission', 'patientId admissionDate')
      .populate('currentAdmission.patientId', 'name')
      .sort({ wardType: 1, bedNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bed.countDocuments(query);

    res.json({
      beds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get beds error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single bed by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const bed = await Bed.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    })
      .populate('currentAdmission', 'patientId admissionDate')
      .populate('currentAdmission.patientId', 'name');

    if (!bed) {
      return res.status(404).json({ message: 'Bed not found' });
    }

    res.json({ bed });
  } catch (error) {
    console.error('Get bed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new bed
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      bedNumber,
      wardType,
      floor,
      roomNumber,
      pricePerDay,
      amenities
    } = req.body;

    // Check if bed number already exists for this hospital
    const existingBed = await Bed.findOne({
      bedNumber,
      hospitalId: req.user.hospitalId
    });

    if (existingBed) {
      return res.status(400).json({ message: 'Bed number already exists' });
    }

    const bed = new Bed({
      bedNumber,
      wardType,
      floor,
      roomNumber,
      pricePerDay,
      amenities,
      hospitalId: req.user.hospitalId,
      createdBy: req.user.id
    });

    await bed.save();
    await bed.populate('currentAdmission', 'patientId admissionDate');

    res.status(201).json({ bed });
  } catch (error) {
    console.error('Create bed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update bed
router.put('/:id', authenticate, async (req, res) => {
  try {
    const bed = await Bed.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!bed) {
      return res.status(404).json({ message: 'Bed not found' });
    }

    const {
      bedNumber,
      wardType,
      status,
      floor,
      roomNumber,
      pricePerDay,
      amenities
    } = req.body;

    // Check if new bed number conflicts with existing bed
    if (bedNumber && bedNumber !== bed.bedNumber) {
      const existingBed = await Bed.findOne({
        bedNumber,
        hospitalId: req.user.hospitalId,
        _id: { $ne: req.params.id }
      });

      if (existingBed) {
        return res.status(400).json({ message: 'Bed number already exists' });
      }
    }

    if (bedNumber) bed.bedNumber = bedNumber;
    if (wardType) bed.wardType = wardType;
    if (status) bed.status = status;
    if (floor !== undefined) bed.floor = floor;
    if (roomNumber !== undefined) bed.roomNumber = roomNumber;
    if (pricePerDay !== undefined) bed.pricePerDay = pricePerDay;
    if (amenities) bed.amenities = amenities;

    await bed.save();
    await bed.populate('currentAdmission', 'patientId admissionDate');

    res.json({ bed });
  } catch (error) {
    console.error('Update bed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete bed
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const bed = await Bed.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });

    if (!bed) {
      return res.status(404).json({ message: 'Bed not found' });
    }

    // Check if bed is occupied
    if (bed.status === 'occupied') {
      return res.status(400).json({ message: 'Cannot delete occupied bed' });
    }

    await Bed.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bed deleted successfully' });
  } catch (error) {
    console.error('Delete bed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bed statistics
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const stats = await Bed.aggregate([
      { $match: { hospitalId: req.user.hospitalId } },
      {
        $group: {
          _id: '$wardType',
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } }
        }
      }
    ]);

    res.json({ stats });
  } catch (error) {
    console.error('Get bed stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
