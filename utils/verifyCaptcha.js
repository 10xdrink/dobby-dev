const axios = require('axios');

module.exports = async function verifyCaptcha(token) {
  if (!token) return false;

  try {
    const params = new URLSearchParams();
    params.append('secret', process.env.RECAPTCHA_SECRET_KEY);
    params.append('response', token);

    const { data } = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    
    console.log(" Google Captcha Response:", data);

    return data?.success || false;
  } catch (err) {
    console.error('verifyCaptcha error:', err.message);
    return false;
  }
};
