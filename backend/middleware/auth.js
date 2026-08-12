const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .populate('hospitalId', 'name email phone address')
      .populate('departmentId', 'name description')
      .select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    if (user.isActive === false) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }
    // Treat undefined or true as active

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    console.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Server error in authentication.' });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Access denied. User not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Hospital access middleware - ensures user belongs to the hospital
const hospitalAccess = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      return next(); // Super admin can access all hospitals
    }

    const hospitalId = req.params.hospitalId || req.body.hospitalId || req.query.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital ID is required.' });
    }

    // Check if user has hospitalId and it matches
    if (!req.user.hospitalId) {
      console.error('User missing hospitalId:', req.user.id, req.user.role);
      return res.status(403).json({ message: 'Access denied. User not assigned to any hospital.' });
    }

    // Extract the actual ObjectId from populated object or use the direct ObjectId
    const userHospitalId = req.user.hospitalId._id ? req.user.hospitalId._id.toString() : req.user.hospitalId.toString();
    const requestedHospitalId = hospitalId.toString();

    if (userHospitalId !== requestedHospitalId) {
      console.error('Hospital access denied:', {
        userId: req.user.id,
        userRole: req.user.role,
        userHospitalId,
        requestedHospitalId,
        hospitalIdType: typeof req.user.hospitalId,
        hasIdProperty: !!req.user.hospitalId._id
      });
      return res.status(403).json({ message: 'Access denied. You can only access your own hospital.' });
    }

    next();
  } catch (error) {
    console.error('Hospital access middleware error:', error);
    res.status(500).json({ message: 'Server error in hospital access validation.' });
  }
};

// Department access middleware - ensures user belongs to the department
const departmentAccess = async (req, res, next) => {
  try {
    if (['super_admin', 'hospital_admin'].includes(req.user.role)) {
      return next(); // These roles can access all departments
    }

    const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
    
    if (!departmentId) {
      return res.status(400).json({ message: 'Department ID is required.' });
    }

    if (req.user.departmentId && req.user.departmentId.toString() !== departmentId) {
      return res.status(403).json({ message: 'Access denied. You can only access your own department.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error in department access validation.' });
  }
};

module.exports = {
  authenticate,
  authorize,
  hospitalAccess,
  departmentAccess
};
