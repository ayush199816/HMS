const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary using URL
cloudinary.config({
  cloud_name: 'dh6ywbcnc',
  api_key: '183768766165989',
  api_secret: 'b81YccrGG3e95AT2qoFLo0SgRMA'
});

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'medical-records/prescriptions',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    public_id: (req, file) => {
      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      return `prescription_${timestamp}_${randomString}`;
    },
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' },
      { quality: 70 },
      { flags: 'progressive' }
    ]
  }
});

// Create multer upload middleware
const upload = multer({ storage });

module.exports = {
  cloudinary,
  storage,
  upload
};
