const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToCloudinary } = require('../config/cloudinary');
const router = express.Router();

// Configure multer for memory storage (for image search)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Image search endpoint
router.post('/search-by-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    
    // For now, return a simple response
    // In production, integrate with Google Vision API or similar
    const keywords = "item"; // Mock response
    
    res.json({ 
      message: 'Image processed successfully',
      keywords: keywords,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;