const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['electronics', 'documents', 'accessories', 'clothing', 'keys', 'pets', 'others'],
    default: 'others'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  dateLostFound: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  imageUrl: {
    type: String,
    default: null
  },
  cloudinaryPublicId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['lost', 'found']
  },
  itemStatus: {
    type: String,
    enum: ['pending', 'claimed', 'returned'],
    default: 'pending'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Item', ItemSchema);