const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const auth = require('../middleware/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const router = express.Router();

// Ensure temp uploads directory exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Get all items with filters
router.get('/', async (req, res) => {
  try {
    const { search, category, status, location, limit = 50 } = req.query;
    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') query.category = category;
    if (status && status !== 'all') query.status = status;
    if (location) query.location = { $regex: location, $options: 'i' };
    
    const items = await Item.find(query)
      .populate('reportedBy', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(items);
  } catch (error) {
    console.error('Error in GET /items:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email phone');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error in GET /items/:id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Report lost or found item (with Cloudinary upload)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    console.log('Creating new item...');
    console.log('User ID:', req.userId);
    
    const { title, description, category, location, dateLostFound, status } = req.body;
    
    // Validate required fields
    if (!title || !description || !category || !location || !status) {
      // Clean up temp file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['title', 'description', 'category', 'location', 'status']
      });
    }
    
    let imageUrl = null;
    let cloudinaryPublicId = null;
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        console.log('Uploading image to Cloudinary...');
        const uploadResult = await uploadToCloudinary(req.file.path, 'lostandfound/items');
        imageUrl = uploadResult.url;
        cloudinaryPublicId = uploadResult.publicId;
        console.log('Image uploaded successfully:', imageUrl);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue without image if upload fails
      }
    }
    
    const itemData = {
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      dateLostFound: dateLostFound || new Date(),
      status,
      reportedBy: req.userId,
      imageUrl: imageUrl,
      cloudinaryPublicId: cloudinaryPublicId
    };
    
    const item = new Item(itemData);
    await item.save();
    
    // Populate the reportedBy field before sending response
    await item.populate('reportedBy', 'name email phone');
    
    console.log('Item created successfully:', item._id);
    res.status(201).json(item);
  } catch (error) {
    console.error('Error in POST /items:', error);
    // Clean up temp file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update item
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    if (item.reportedBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { title, description, category, location, dateLostFound, status } = req.body;
    
    // Update fields
    if (title) item.title = title.trim();
    if (description) item.description = description.trim();
    if (category) item.category = category;
    if (location) item.location = location.trim();
    if (dateLostFound) item.dateLostFound = dateLostFound;
    if (status) item.status = status;
    
    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary
      if (item.cloudinaryPublicId) {
        try {
          await deleteFromCloudinary(item.cloudinaryPublicId);
        } catch (deleteError) {
          console.error('Error deleting old image:', deleteError);
        }
      }
      
      // Upload new image
      try {
        const uploadResult = await uploadToCloudinary(req.file.path, 'lostandfound/items');
        item.imageUrl = uploadResult.url;
        item.cloudinaryPublicId = uploadResult.publicId;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
      }
    }
    
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Error in PUT /items/:id:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete item (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Delete image from Cloudinary if exists
    if (item.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(item.cloudinaryPublicId);
        console.log('Deleted image from Cloudinary:', item.cloudinaryPublicId);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
      }
    }
    
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /items/:id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's items
router.get('/user/my-items', auth, async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.userId })
      .populate('reportedBy', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Error in GET /user/my-items:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;