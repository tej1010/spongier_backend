const mongoose = require('mongoose');
const { UsersDBConnect } = require('../../database/mongoose');

const Schema = mongoose.Schema;

// Per-user daily streak activity log
const UserStreakSchema = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', index: true, required: true },
  dDate: { type: Date, required: true }, // normalized UTC date (00:00)
  sSource: { type: String, enum: ['login', 'request', 'manual'], default: 'request' }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

UserStreakSchema.index({ iUserId: 1, dDate: 1 }, { unique: true });

module.exports = UsersDBConnect.model('user_streaks', UserStreakSchema);
