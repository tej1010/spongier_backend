// @ts-check

// bulkStudent.services.js
const crypto = require('crypto');
const SubscriptionModel = require('./model');
const StudentInvitationModel = require('./studentInvitation.model');
const UserModel = require('../user/model');
const { status, messages } = require('../../helper/api.responses');
const { handleServiceError } = require('../../helper/utilities.services');
const { sendMailNodeMailer } = require('../../helper/mail.services');

// Generate unique invitation token
const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate batch ID for grouping bulk operations
const generateBatchId = () => {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check subscription seat availability
const checkSeatAvailability = async (subscriptionId, requestedSeats = 1, lang = 'en') => {
  try {
    const subscription = await SubscriptionModel.findById(subscriptionId).read('primary');
    if (!subscription) {
      return { available: false, message: messages[lang].subscriptionNotFound };
    }

    // Count current allocated students
    const currentAllocated = subscription.aAllocatedStudents ? subscription.aAllocatedStudents.length : 0;
    const availableSeats = subscription.nSeats - currentAllocated;

    if (availableSeats < requestedSeats) {
      return {
        available: false,
        message: `Only ${availableSeats} seats available. Requested: ${requestedSeats}`,
        availableSeats
      };
    }

    return { available: true, availableSeats, subscription };
  } catch (error) {
    return { available: false, message: messages[lang].errorCheckingSeatAvailability };
  }
};

// Add individual student invitation
const addIndividualStudent = async (req, res) => {
  const lang = req.userLanguage;
  const { sEmail, iSubscriptionId, sName } = req.body;
  const iCreatedBy = req.user._id; // From auth middleware

  try {
    // Check if user already exists
    const existingUser = await UserModel.findOne({ sEmail, eStatus: 'active', bDelete: false }).read('primary');
    if (existingUser) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.userAlreadyExists || 'User already exists',
        data: {},
        error: {}
      });
    }

    // Check seat availability
    const seatCheck = await checkSeatAvailability(iSubscriptionId, 1);
    if (!seatCheck.available) {
      return res.status(status.BadRequest).json({
        success: false,
        message: seatCheck.message,
        data: {},
        error: {}
      });
    }

    // Check if invitation already exists
    const existingInvitation = await StudentInvitationModel.findOne({
      sEmail,
      iSubscriptionId,
      eStatus: { $in: ['pending', 'sent'] }
    }).read('primary');

    if (existingInvitation) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.invitationAlreadyExists || 'Invitation already exists for this email',
        data: {},
        error: {}
      });
    }

    // Create invitation
    const invitation = new StudentInvitationModel({
      iSubscriptionId,
      iCreatedBy,
      sEmail,
      sInvitationToken: generateInvitationToken(),
      dTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      sBatchId: generateBatchId()
    });

    await invitation.save();

    // Send invitation email
    const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.sInvitationToken}`;

    await sendMailNodeMailer({
      aTo: [sEmail],
      sSubject: messages[lang]?.studentInvitationSubject || 'You have been invited to join our platform',
      sTemplate: 'student-invitation-by-school',
      oTemplateBody: {
        sName: sName || 'Student',
        invitationLink,
        expiryDate: invitation.dTokenExpiry.toLocaleDateString()
      }
    });

    // Update invitation status
    invitation.eStatus = 'sent';
    invitation.dLastAttempt = new Date();
    invitation.nAttemptCount += 1;
    await invitation.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.studentInvitationSent || 'Student invitation sent successfully',
      data: { invitation },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorSendingInvitation' });
  }
};

// Bulk add students via CSV/array
const bulkAddStudents = async (req, res) => {
  const lang = req.userLanguage;
  const { emails, iSubscriptionId } = req.body;
  const iCreatedBy = req.user._id;

  try {
    // Check seat availability for all emails
    const seatCheck = await checkSeatAvailability(iSubscriptionId, emails.length);
    if (!seatCheck.available) {
      return res.status(status.BadRequest).json({
        success: false,
        message: seatCheck.message,
        data: {},
        error: {}
      });
    }

    // Pre-validate all records so that we halt the whole batch if any record is invalid
    const invalidRecords = [];

    for (const emailData of emails) {
      const { sEmail, sPhone } = emailData;

      /** @type {Array<Record<string, string>>} */
      const contactFilters = [{ sEmail }];

      if (sPhone) {
        contactFilters.push({ sPhone });
      }

      const userQuery = {
        eStatus: 'active',
        bDelete: false,
        $or: contactFilters
      };

      const existingUser = await UserModel.findOne(userQuery).read('primary');
      if (existingUser) {
        invalidRecords.push({
          sEmail,
          sPhone,
          reason: 'User already exists with provided email/phone'
        });
        continue;
      }

      const existingInvitation = await StudentInvitationModel.findOne({
        sEmail,
        iSubscriptionId,
        eStatus: { $in: ['pending', 'sent'] }
      }).read('primary');

      if (existingInvitation) {
        invalidRecords.push({
          sEmail,
          reason: 'Invitation already exists'
        });
      }
    }

    if (invalidRecords.length) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.bulkInvitationsValidationFailed || 'Bulk invitations halted due to invalid records',
        data: { invalidRecords },
        error: {}
      });
    }

    const batchId = generateBatchId();
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // Process each email
    for (const emailData of emails) {
      try {
        const { sEmail, sName } = emailData;

        // Create invitation
        const invitation = new StudentInvitationModel({
          iSubscriptionId,
          iCreatedBy,
          sEmail,
          sInvitationToken: generateInvitationToken(),
          dTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          sBatchId: batchId
        });

        await invitation.save();

        // Send invitation email
        const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.sInvitationToken}`;

        await sendMailNodeMailer({
          aTo: [sEmail],
          sSubject: messages[lang]?.studentInvitationSubject || 'You have been invited to join our platform',
          sTemplate: 'student-invitation-by-school',
          oTemplateBody: {
            sName: sName || 'Student',
            invitationLink,
            expiryDate: invitation.dTokenExpiry.toLocaleDateString()
          }
        });

        // Update invitation status
        invitation.eStatus = 'sent';
        invitation.dLastAttempt = new Date();
        invitation.nAttemptCount += 1;
        await invitation.save();

        // @ts-ignore
        results.successful.push({ sEmail, invitationId: invitation._id });
      } catch (error) {
        // @ts-ignore
        results.failed.push({ sEmail: emailData.sEmail, reason: error.message });
      }
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.bulkInvitationsProcessed || 'Bulk invitations processed',
      data: {
        batchId,
        total: emails.length,
        results
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorProcessingBulkInvitations' });
  }
};

// Accept student invitation
const acceptStudentInvitation = async (req, res) => {
  const lang = req.userLanguage;
  const { sInvitationToken, sName, sPassword, sPhone, iSchool, sSchool, iGradeId, aParents } = req.body;

  try {
    // Find and validate invitation
    const invitation = await StudentInvitationModel.findOne({
      sInvitationToken,
      eStatus: { $in: ['pending', 'sent'] },
      dTokenExpiry: { $gt: new Date() }
    }).read('primary').populate('iSubscriptionId');

    if (!invitation) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.invalidOrExpiredInvitation || 'Invalid or expired invitation',
        data: {},
        error: {}
      });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ sEmail: invitation.sEmail, eStatus: 'active', bDelete: false }).read('primary');
    if (existingUser) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.userAlreadyExists || 'User already exists',
        data: {},
        error: {}
      });
    }

    // Check seat availability
    const seatCheck = await checkSeatAvailability(invitation.iSubscriptionId, 1);
    if (!seatCheck.available) {
      return res.status(status.BadRequest).json({
        success: false,
        message: seatCheck.message,
        data: {},
        error: {}
      });
    }

    // Normalize optional parent links from payload

    const normalizedParents = await resolveUserIds(coerceIdList(aParents));

    // Create student user
    const student = new UserModel({
      sEmail: invitation.sEmail,
      sName,
      sPassword,
      sPhone,
      iSchool,
      sSchool,
      iGradeId,
      eRole: 'student',
      aParents: normalizedParents.length ? normalizedParents : undefined,
      iSubscriptionId: invitation.iSubscriptionId._id,
      bIsEmailVerified: true // Since they came through invitation
    });

    await student.save();

    // Inverse sync for parents
    if (normalizedParents.length) {
      await UserModel.updateMany({ _id: { $in: normalizedParents } }, { $addToSet: { aChildren: student._id } });
    }

    // Update subscription allocated students
    await SubscriptionModel.findByIdAndUpdate(
      invitation.iSubscriptionId._id,
      { $push: { aAllocatedStudents: student._id } }
    );

    // Update invitation status
    invitation.eStatus = 'accepted';
    await invitation.save();

    return res.status(status.OK).json({ success: true, message: messages[lang]?.invitationAccepted || 'Invitation accepted', data: { studentId: student._id }, error: {} });
  } catch (error) {
    return res.status(status.InternalServerError).json({ success: false, message: messages[lang]?.error || 'Error', data: {}, error: {} });
  }
};

async function resolveUserIds (candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const ids = [];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.match(/^[0-9a-fA-F]{24}$/)) { ids.push(c); continue; }
    if (typeof c === 'string' && c.includes('@')) {
      const u = await UserModel.findOne({ sEmail: c.toLowerCase().trim(), eRole: 'parent' }, { _id: 1 }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'string' && c.replace(/\D/g, '').length >= 8) {
      const u = await UserModel.findOne({ sPhone: c, eRole: 'parent' }, { _id: 1 }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'object') {
      const email = c.sEmail || c.email;
      const phone = c.sPhone || c.phone;
      if (email) {
        const u = await UserModel.findOne({ sEmail: String(email).toLowerCase().trim(), eRole: 'parent' }, { _id: 1 }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
      if (phone) {
        const u = await UserModel.findOne({ sPhone: String(phone), eRole: 'parent' }, { _id: 1 }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
    }
  }
  return Array.from(new Set(ids));
}
function coerceIdList (input) {
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object' && parsed._id) return [String(parsed._id)];
      } catch (_) { /* fall through */ }
    }
    return trimmed.split(',').map(s => s.replace(/^["'[]+|["'\]]+$/g, '').trim()).filter(Boolean);
  }
  if (typeof input === 'object') {
    if (input._id) return [String(input._id)];
    return [];
  }
  return [];
}
// Resend invitation
const resendInvitation = async (req, res) => {
  const lang = req.userLanguage;
  const { sInvitationId } = req.body;

  try {
    const invitation = await StudentInvitationModel.findById(sInvitationId).read('primary');
    if (!invitation) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.invitationNotFound || 'Invitation not found',
        data: {},
        error: {}
      });
    }

    if (invitation.eStatus === 'accepted') {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.invitationAlreadyAccepted || 'Invitation already accepted',
        data: {},
        error: {}
      });
    }

    // Generate new token and expiry
    invitation.sInvitationToken = generateInvitationToken();
    invitation.dTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invitation.eStatus = 'pending';

    await invitation.save();

    // Send new invitation email
    const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.sInvitationToken}`;

    await sendMailNodeMailer({
      aTo: [invitation.sEmail],
      sSubject: messages[lang]?.studentInvitationSubject || 'You have been invited to join our platform',
      sTemplate: 'student-invitation-by-school',
      oTemplateBody: {
        sName: 'Student',
        invitationLink,
        expiryDate: invitation.dTokenExpiry.toLocaleDateString()
      }
    });

    // Update invitation status
    invitation.eStatus = 'sent';
    invitation.dLastAttempt = new Date();
    invitation.nAttemptCount += 1;
    await invitation.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.invitationResent || 'Invitation resent successfully',
      data: { invitation },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorResendingInvitation' });
  }
};

// Get invitation status
const getInvitationStatus = async (req, res) => {
  const lang = req.userLanguage;
  const { iSubscriptionId, sBatchId } = req.query;

  try {
    const query = { iSubscriptionId };
    if (sBatchId) {
      query.sBatchId = sBatchId;
    }

    const invitations = await StudentInvitationModel.find(query)
      .populate('iCreatedBy', 'sName sEmail')
      .sort({ dCreatedAt: -1 })
      .read('primary')
      .lean();

    const statusSummary = {
      total: invitations.length,
      pending: invitations.filter(i => i.eStatus === 'pending').length,
      sent: invitations.filter(i => i.eStatus === 'sent').length,
      accepted: invitations.filter(i => i.eStatus === 'accepted').length,
      expired: invitations.filter(i => i.eStatus === 'expired').length,
      failed: invitations.filter(i => i.eStatus === 'failed').length
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.invitationStatusRetrieved || 'Invitation status retrieved successfully',
      data: { invitations, statusSummary },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingInvitationStatus' });
  }
};

module.exports = {
  addIndividualStudent,
  bulkAddStudents,
  acceptStudentInvitation,
  resendInvitation,
  getInvitationStatus
};
