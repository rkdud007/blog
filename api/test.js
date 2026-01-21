// Simple test endpoint to verify Vercel functions are working.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test 1: Basic function works.
    const envCheck = {
      hasGoogleSheetId: !!process.env.GOOGLE_SHEET_ID,
      hasServiceEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
      privateKeyStart: process.env.GOOGLE_PRIVATE_KEY?.substring(0, 30) || 'missing'
    };

    // Test 2: Can we require googleapis?
    let googleapisLoaded = false;
    let googleapisError = null;
    try {
      const { google } = require('googleapis');
      googleapisLoaded = true;
    } catch (e) {
      googleapisError = e.message;
    }

    return res.status(200).json({
      message: 'Test endpoint working',
      env: envCheck,
      googleapis: {
        loaded: googleapisLoaded,
        error: googleapisError
      },
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
