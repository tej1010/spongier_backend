const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const axios = require('axios');
const { APP_NAME } = require('../config/common');
const { SMTP_FROM, FRONTEND_HOST_URL } = require('../config/defaultConfig');
const { eUserRoles } = require('../data');
const {
  ONE_SIGNAL_BASE_URL,
  ONE_SIGNAL_AUTH_KEY,
  EMAIL_SUBJECT_FOR_SEND_OTP,
  ONE_SIGNAL_APP_ID,
  AWS_REGION,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY
} = require('../config/thirdPartyConfig');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const DEFAULT_EMAIL_SUBJECT = `Notification from ${APP_NAME}`;

const hasStaticAwsCredentials =
  AWS_ACCESS_KEY && AWS_ACCESS_KEY !== 'aws-access-key-placeholder' &&
  AWS_SECRET_KEY && AWS_SECRET_KEY !== 'aws-secret-key-placeholder';

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: hasStaticAwsCredentials
    ? {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_KEY
    }
    : undefined
});

const getTemplate = ({ sTemplate, oTemplateBody }) => {
  const emailTemplatePath = path.join(__dirname, '..', 'views', sTemplate + '.ejs');
  const template = fs.readFileSync(emailTemplatePath, { encoding: 'utf-8' });
  return ejs.render(template, { ...oTemplateBody, appName: APP_NAME });
};

const sendMailNodeMailer = async ({ aTo, sSubject, sHTML = '', sTemplate, oTemplateBody = {} }) => {
  try {
    const htmlBody = sHTML || getTemplate({ sTemplate, oTemplateBody });
    const resolvedSubject =
      (typeof sSubject === 'string' && sSubject.trim().length > 0)
        ? sSubject
        : (EMAIL_SUBJECT_FOR_SEND_OTP || DEFAULT_EMAIL_SUBJECT);

    const command = new SendEmailCommand({
      Source: `${APP_NAME} <${SMTP_FROM}>`,
      Destination: {
        ToAddresses: aTo
      },
      Message: {
        Subject: {
          Data: resolvedSubject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          }
        }
      }
    });

    await sesClient.send(command);
  } catch (error) {
    console.error('SES send error', error);
    throw error;
  }
};

const sendMailOneSignal = async ({ aTo, sSubject, sTemplate, sHTML, oTemplateBody = {} }) => {
  try {
    const resolvedSubject =
      (typeof sSubject === 'string' && sSubject.trim().length > 0)
        ? sSubject
        : (EMAIL_SUBJECT_FOR_SEND_OTP || DEFAULT_EMAIL_SUBJECT);

    const options = {
      method: 'POST',
      url: `${ONE_SIGNAL_BASE_URL}/notifications?c=email`,
      headers: {
        accept: 'application/json',
        Authorization: ONE_SIGNAL_AUTH_KEY,
        'content-type': 'application/json'
      },
      data: {
        include_email_tokens: aTo,
        email_subject: resolvedSubject,
        app_id: ONE_SIGNAL_APP_ID,
        include_unsubscribed: true,
        email_body: sHTML || getTemplate({ sTemplate, oTemplateBody }) // html body
      }
    };
    await axios.request(options).catch(function (error) { console.error('OneSignal error', error.response.data); });
  } catch (error) {
    console.log('SENDDD MAILLLL', error);
  }
};

const formatRole = (role) => {
  if (!role) return 'account';
  const normalized = String(role).toLowerCase();
  if (normalized === eUserRoles.map.STUDENT) return 'student account';
  if (normalized === eUserRoles.map.PARENT) return 'parent account';
  if (normalized === eUserRoles.map.TEACHER) return 'teacher account';
  if (normalized === 'school' || normalized === 'schooladmin') return 'school account';
  if (normalized === eUserRoles.map.SPONSOR) return 'sponsor account';
  return `${normalized} account`;
};

const buildInvitationSubject = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === eUserRoles.map.STUDENT) return `Welcome to ${APP_NAME}! Your student access is ready`;
  if (normalized === eUserRoles.map.PARENT) return `You now have parent access on ${APP_NAME}`;
  if (normalized === eUserRoles.map.TEACHER) return `Your teacher workspace is live on ${APP_NAME}`;
  if (normalized === 'school' || normalized === 'schooladmin') return `Your school has been onboarded to ${APP_NAME}`;
  if (normalized === eUserRoles.map.SPONSOR) return `Your sponsor workspace is live on ${APP_NAME}`;
  return `You're invited to ${APP_NAME}`;
};

const buildInvitationUrl = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === eUserRoles.map.PARENT) return `${FRONTEND_HOST_URL}/parent-dashboard`;
  if (normalized === eUserRoles.map.TEACHER) return `${FRONTEND_HOST_URL}/teacher/login`;
  if (normalized === 'school' || normalized === 'schooladmin') return `${FRONTEND_HOST_URL}/school/login`;
  if (normalized === eUserRoles.map.SPONSOR) return `${FRONTEND_HOST_URL}/sponsor-dashboard`;
  return `${FRONTEND_HOST_URL}/login`;
};

const sendUserInvitationEmail = async ({
  name,
  email,
  role,
  temporaryPassword,
  actionUrl,
  ctaLabel,
  addedBy = 'admin'
}) => {
  if (!email) return;
  try {
    const roleLabel = formatRole(role);
    const subject = buildInvitationSubject(role);
    const invitationUrl = actionUrl || buildInvitationUrl(role);
    await sendMailNodeMailer({
      aTo: [email],
      sSubject: subject,
      sTemplate: 'user-invitation-by-admin',
      oTemplateBody: {
        recipientName: name || 'User',
        roleLabel,
        actionUrl: invitationUrl,
        ctaLabel: ctaLabel || 'Open Dashboard',
        temporaryPassword,
        addedBy: addedBy === 'admin' ? 'the Spongein Admin team' : addedBy
      }
    });
  } catch (error) {
    console.error('Error sending user invitation email:', error);
  }
};

/**
 * Send student invitation email with credentials
 * @param {Object} params - Email parameters
 * @param {string} params.studentName - Name of the student
 * @param {string} params.studentEmail - Email of the student
 * @param {string} params.password - Temporary password
 * @param {string} params.addedBy - Who added the student ('parent' or 'admin')
 * @returns {Promise<void>}
 */
const sendStudentInvitationEmail = async ({ studentName, studentEmail, password, addedBy }) => {
  try {
    const loginUrl = `${FRONTEND_HOST_URL}/login`;

    let subject = '';
    if (addedBy === 'parent') {
      subject = `Welcome! Your Parent Has Created Your ${APP_NAME} Account`;
    } else if (addedBy === 'admin') {
      subject = `Your Student Account Has Been Created on ${APP_NAME}`;
    } else {
      subject = `Welcome to ${APP_NAME} - Your Account Credentials`;
    }

    const templateBody = {
      studentName,
      email: studentEmail,
      password,
      addedBy,
      loginUrl
    };

    await sendMailNodeMailer({
      aTo: [studentEmail],
      sSubject: subject,
      sTemplate: 'student-credentials',
      oTemplateBody: templateBody
    });

    console.log(`Student invitation email sent to ${studentEmail} (added by ${addedBy})`);
  } catch (error) {
    console.error('Error sending student invitation email:', error);
    // Don't throw error to avoid blocking student creation
  }
};

const sendParentLinkNotificationEmail = async ({ parentName, parentEmail, studentName }) => {
  if (!parentEmail) return;
  try {
    await sendMailNodeMailer({
      aTo: [parentEmail],
      sSubject: `${studentName} is now linked to your ${APP_NAME} account`,
      sTemplate: 'parent-link-notification',
      oTemplateBody: {
        parentName,
        studentName,
        dashboardUrl: `${FRONTEND_HOST_URL}/parent-dashboard`
      }
    });
  } catch (error) {
    console.error('Error sending parent link notification email:', error);
  }
};

const sendAchievementEmail = async ({
  userName,
  userEmail,
  achievementTitle,
  achievementDescription,
  achievementType = 'achievement',
  metadata = {},
  ctaUrl = `${FRONTEND_HOST_URL}/student-portal/achievements`,
  ctaLabel = 'View Progress'
}) => {
  if (!userEmail) return;
  try {
    await sendMailNodeMailer({
      aTo: [userEmail],
      sSubject: `${achievementTitle} - ${APP_NAME}`,
      sTemplate: 'achievement-notification',
      oTemplateBody: {
        userName,
        achievementTitle,
        achievementDescription,
        achievementType,
        metadata,
        ctaUrl,
        ctaLabel
      }
    });
  } catch (error) {
    console.error('Error sending achievement email:', error);
  }
};

module.exports = {
  sendMailOneSignal,
  sendMailNodeMailer,
  sendUserInvitationEmail,
  sendStudentInvitationEmail,
  sendParentLinkNotificationEmail,
  sendAchievementEmail
};
