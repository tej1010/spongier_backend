// bookmarks.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../database/mongoose');

const BookmarkSchema = new Schema({
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },
  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: true,
    index: true
  },
  // soft delete flag if ever needed later
  bDelete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Ensure a user can bookmark a video only once (ignoring soft-deleted ones)
BookmarkSchema.index({ iUserId: 1, iVideoId: 1 }, { unique: true, partialFilterExpression: { bDelete: false } });

const BookmarkModel = UsersDBConnect.model('bookmarks', BookmarkSchema);

module.exports = BookmarkModel;
