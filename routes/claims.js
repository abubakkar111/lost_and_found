const express = require('express');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const auth = require('../middleware/auth');
const router = express.Router();

// Create a claim request
router.post('/', auth, async (req, res) => {
  try {
    const { itemId, message, proofDetails } = req.body;
    
    // Check if claim already exists
    const existingClaim = await Claim.findOne({ item: itemId, claimant: req.userId });
    if (existingClaim) {
      return res.status(400).json({ message: 'You have already claimed this item' });
    }
    
    const claim = new Claim({
      item: itemId,
      claimant: req.userId,
      message,
      proofDetails
    });
    
    await claim.save();
    
    // Update item status to claimed
    await Item.findByIdAndUpdate(itemId, { itemStatus: 'claimed' });
    
    // Get the item owner for notification
    const item = await Item.findById(itemId).populate('reportedBy');
    const io = req.app.get('io');
    if (io && item.reportedBy) {
      io.to(item.reportedBy._id.toString()).emit('new-claim', { claim, item });
    }
    
    res.status(201).json(claim);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get claims for user's items
router.get('/my-claims', auth, async (req, res) => {
  try {
    const claims = await Claim.find({ claimant: req.userId })
      .populate('item')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get claims for user's reported items
router.get('/received-claims', auth, async (req, res) => {
  try {
    const userItems = await Item.find({ reportedBy: req.userId });
    const claims = await Claim.find({ item: { $in: userItems.map(i => i._id) } })
      .populate('item')
      .populate('claimant', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all claims (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    
    const claims = await Claim.find()
      .populate('item')
      .populate('claimant', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update claim status
router.put('/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Claim.findById(req.params.id).populate('item');
    
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }
    
    if (claim.item.reportedBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    claim.status = status;
    await claim.save();
    
    const io = req.app.get('io');
    if (io) {
      io.to(claim.claimant.toString()).emit('claim-updated', { claim });
    }
    
    res.json(claim);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;