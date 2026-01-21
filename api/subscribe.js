// Vercel serverless function to handle email subscriptions with Google Sheets.
const { google } = require('googleapis');

// Email validation regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Initialize Google Sheets API.
function getGoogleSheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

module.exports = async (req, res) => {
  // Enable CORS.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    // Validate email.
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check for required environment variables.
    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('Missing required environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Get existing data to check for duplicates.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subscribers!A:C',
    });

    const rows = response.data.values || [];

    // Check if email already exists (skip header row).
    const existingRow = rows.slice(1).find(row => row[0]?.toLowerCase() === trimmedEmail);

    if (existingRow) {
      const status = existingRow[1];

      if (status === 'Active') {
        return res.status(200).json({ message: 'You are already subscribed!' });
      } else {
        // Reactivate unsubscribed user.
        const rowIndex = rows.findIndex(row => row[0]?.toLowerCase() === trimmedEmail);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Subscribers!B${rowIndex + 1}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Active']],
          },
        });
        return res.status(200).json({ message: 'Welcome back! You have been resubscribed.' });
      }
    }

    // Add new subscriber.
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Subscribers!A:C',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[trimmedEmail, 'Active', timestamp]],
      },
    });

    return res.status(200).json({ message: 'Successfully subscribed! Thank you.' });

  } catch (error) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: 'Failed to subscribe. Please try again later.' });
  }
};
