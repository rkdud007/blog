// Vercel serverless function to handle email subscriptions with Google Sheets.
const { google } = require('googleapis');
const { Resend } = require('resend');

// Email validation regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Initialize Google Sheets API.
function getGoogleSheetsClient() {
  // Remove surrounding quotes if present and handle newlines.
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes.
  privateKey = privateKey.replace(/\\n/g, '\n'); // Convert \n to actual newlines.

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

// Send welcome email to new subscriber.
async function sendWelcomeEmail(email) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: `${process.env.SENDER_NAME} <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Welcome to piapark.me!',
    text: `Hi!

Thanks for subscribing. Thanks for putting interest in what I'm thinking and how I'm trying to live in this world.

Feel free to share your thoughts or feedback about me. I'm happy to talk about life, get connected personally and learn from you.

Best,
Pia Park
${process.env.BLOG_URL || 'https://piapark.me'}
`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #000;
    }
    p {
      margin-bottom: 15px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Welcome!</h1>

  <p>Hi!</p>

  <p>Thanks for subscribing. Thanks for putting interest in what I'm thinking and how I'm trying to live in this world.</p>

  <p>Feel free to share your thoughts or feedback about me. I'm happy to talk about life, get connected personally and learn from you.</p>

  <div class="footer">
    <p>
      Best,<br>
      Pia Park<br>
      <a href="${process.env.BLOG_URL || 'https://piapark.me'}">${process.env.BLOG_URL || 'piapark.me'}</a>
    </p>
  </div>
</body>
</html>
`,
  });
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
    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.SENDER_NAME) {
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

    // Send welcome email.
    try {
      await sendWelcomeEmail(trimmedEmail);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the subscription if email fails.
    }

    return res.status(200).json({ message: 'Successfully subscribed! Thank you.' });

  } catch (error) {
    console.error('Subscription error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    return res.status(500).json({
      error: 'Failed to subscribe. Please try again later.',
      // Only include debug info in development
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};
