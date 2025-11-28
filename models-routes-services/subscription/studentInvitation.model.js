// studentInvitation.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../database/mongoose');
const { eStudentInviteStatus } = require('../../data');

const StudentInvitationSchema = new Schema({
  // Subscription this invitation belongs to
  iSubscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'subscriptions',
    required: true
  },

  // User who created the invitation (school admin/teacher)
  iCreatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },

  // Student email
  sEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },

  // Invitation status
  eStatus: {
    type: String,
    enum: eStudentInviteStatus.value,
    default: eStudentInviteStatus.map.PENDING
  },

  // Invitation token for secure access
  sInvitationToken: {
    type: String,
    required: true,
    unique: true
  },

  // Token expiration
  dTokenExpiry: {
    type: Date,
    required: true
  },

  // Batch ID for grouping bulk invitations
  sBatchId: {
    type: String,
    required: true
  },

  // Error message if invitation failed
  sErrorMessage: String,

  // Attempt count for sending
  nAttemptCount: {
    type: Number,
    default: 0
  },

  // Last attempt timestamp
  dLastAttempt: Date
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Indexes for efficient querying
StudentInvitationSchema.index({ iSubscriptionId: 1, eStatus: 1 });
StudentInvitationSchema.index({ sEmail: 1 });
StudentInvitationSchema.index({ sInvitationToken: 1 }, { unique: true });
StudentInvitationSchema.index({ sBatchId: 1 });
StudentInvitationSchema.index({ dTokenExpiry: 1 });

const StudentInvitationModel = UsersDBConnect.model('studentInvitations', StudentInvitationSchema);

StudentInvitationModel.syncIndexes()
  .then(() => console.log('Student Invitation Model Indexes Synced'))
  .catch((err) => {
    if (err.code === 86) {
      console.log('Student Invitation Model Indexes: Some indexes already exist, skipping sync');
    } else {
      console.log('Student Invitation Model Indexes Sync Error:', err.message);
    }
  });

module.exports = StudentInvitationModel;
