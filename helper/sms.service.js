const axios = require('axios');
const { handleCatchError } = require('./utilities.services');
const { MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_BASE_URL } = require('../config/defaultConfig');

const normalizeSouthAfricanPhone = (sPhone) => {
  let formattedPhone = String(sPhone || '').trim();
  formattedPhone = formattedPhone.replace(/\s+/g, '');

  if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.substring(1);
  }

  if (/^0\d{9}$/.test(formattedPhone)) {
    formattedPhone = `27${formattedPhone.substring(1)}`;
  }

  if (!formattedPhone.startsWith('27')) {
    throw new Error('Only South African mobile numbers (country code 27) are supported');
  }

  const mobileNumber = formattedPhone.substring(2);

  if (mobileNumber.length !== 9) {
    const errorMsg = `Invalid South African mobile number length. Expected 9 digits after country code (27), got ${mobileNumber.length}. Full number: ${formattedPhone}, Mobile part: ${mobileNumber}`;
    if (mobileNumber.length === 8) {
      console.error('💡 Hint: South African mobile numbers should have 9 digits after country code 27. Example: 27821234567');
    }
    throw new Error(errorMsg);
  }

  if (!/^[6-8]\d{8}$/.test(mobileNumber)) {
    throw new Error('Invalid South African mobile number format. Must start with 6, 7, or 8');
  }

  return { formattedPhone, mobileNumber };
};

/**
 * Send SMS via MSG91 (South Africa only)
 * @param {Object} params - SMS parameters
 * @param {string} params.sPhone - Phone number. Accepted formats:
 *        +27721234567, 27721234567, 0721234567, 0683451290, 07821234567
 * @param {string} params.sMessage - Message content
 * @param {string} params.sTemplateId - Optional MSG91 template ID
 * @returns {Promise<Object>} - Response from MSG91
 */
const sendSMS = async ({ sPhone, sMessage, sTemplateId = null }) => {
  try {
    let formattedPhone;
    let mobileNumber;

    try {
      const normalized = normalizeSouthAfricanPhone(sPhone);
      formattedPhone = normalized.formattedPhone;
      mobileNumber = normalized.mobileNumber;
    } catch (err) {
      console.error('❌', err.message);
      return {
        success: false,
        message: err.message,
        error: err.message
      };
    }

    console.log('✅ Valid South African mobile number detected');
    console.log('📤 Attempting to send SMS to:', formattedPhone);
    console.log('📤 Country Code: 27 (South Africa)');
    console.log('📤 Mobile Number:', mobileNumber);
    console.log('📤 Using MSG91 Base URL:', MSG91_BASE_URL);
    console.log('📤 Auth Key present:', !!MSG91_AUTH_KEY);
    console.log('📤 Sender ID:', MSG91_SENDER_ID);

    const isOTP = /\d{4,6}/.test(sMessage);

    if (isOTP) {
      const otpCode = sMessage.match(/\d{4,6}/)?.[0];
      const otpExpiry = 15;

      const otpUrl = 'https://control.msg91.com/api/v5/otp';
      const queryParams = new URLSearchParams({
        authkey: MSG91_AUTH_KEY,
        mobile: mobileNumber,
        country: '27',
        otp_expiry: otpExpiry,
        template_id: sTemplateId || '',
        realTimeResponse: '1'
      });

      const otpPayload = {
        otp: otpCode
      };

      console.log('📤 Sending OTP to South Africa - Mobile:', mobileNumber, 'Country: 27');
      console.log('📤 OTP URL:', `${otpUrl}?${queryParams.toString()}`);
      console.log('📤 OTP Payload:', otpPayload);

      const response = await axios.post(
        `${otpUrl}?${queryParams.toString()}`,
        otpPayload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ OTP sent successfully via MSG91:', response.data);
      return {
        success: true,
        message: 'OTP sent successfully',
        data: response.data
      };
    } else {
      const smsUrl = 'https://control.msg91.com/api/sendhttp.php';
      const params = new URLSearchParams({
        authkey: MSG91_AUTH_KEY,
        mobiles: mobileNumber,
        message: sMessage,
        sender: MSG91_SENDER_ID,
        route: '4',
        country: '27'
      });

      if (sTemplateId) {
        params.append('DLT_TE_ID', sTemplateId);
      }

      console.log('📤 Sending SMS to South Africa - Mobile:', mobileNumber, 'Country: 27');
      console.log('📤 SMS URL:', `${smsUrl}?${params.toString()}`);

      const response = await axios.get(`${smsUrl}?${params.toString()}`);

      console.log('✅ SMS sent successfully via MSG91:', response.data);
      return {
        success: true,
        message: 'SMS sent successfully',
        data: response.data
      };
    }
  } catch (error) {
    handleCatchError(error);
    console.error('❌ Error sending SMS via MSG91:', error.response?.data || error.message);
    return {
      success: false,
      message: 'Failed to send SMS',
      error: error.response?.data || error.message
    };
  }
};

/**
 * Send OTP SMS via MSG91 (South Africa only)
 * @param {Object} params - OTP parameters
 * @param {string} params.sPhone - South African phone number with country code (e.g., +27821234567)
 * @param {string|number} params.OTP - OTP code
 * @returns {Promise<Object>} - Response from MSG91
 */
const sendOTPSMS = async ({ sPhone, OTP }) => {
  console.log('🔐 Sending OTP SMS - Phone:', sPhone, 'OTP:', OTP);
  const message = `Your OTP code is: ${OTP}. Valid for 15 minutes. Do not share with anyone.`;
  return await sendSMS({ sPhone, sMessage: message });
};

const verifyMSG91OTP = async ({ sPhone, OTP }) => {
  try {
    if (!OTP && OTP !== 0) {
      throw new Error('OTP value is required to verify via MSG91');
    }

    const { mobileNumber } = normalizeSouthAfricanPhone(sPhone);
    const otpVerifyUrl = 'https://control.msg91.com/api/v5/otp/verify';
    const trimmedOtp = String(OTP).trim();

    if (!trimmedOtp) {
      throw new Error('OTP value is required to verify via MSG91');
    }

    const queryParams = new URLSearchParams({
      authkey: MSG91_AUTH_KEY,
      mobile: mobileNumber,
      country: '27',
      otp: trimmedOtp,
      realTimeResponse: '1'
    });

    console.log('📥 Verifying OTP via MSG91 - Mobile:', mobileNumber);
    const response = await axios.post(
      `${otpVerifyUrl}?${queryParams.toString()}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ OTP verification synced with MSG91:', response.data);
    return {
      success: true,
      message: 'OTP verified successfully via MSG91',
      data: response.data
    };
  } catch (error) {
    handleCatchError(error);
    console.error('❌ Error verifying OTP via MSG91:', error.response?.data || error.message);
    return {
      success: false,
      message: 'Failed to verify OTP via MSG91',
      error: error.response?.data || error.message
    };
  }
};

module.exports = {
  sendSMS,
  sendOTPSMS,
  verifyMSG91OTP
};
