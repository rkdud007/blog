#!/usr/bin/env node

// Script to send custom emails to all subscribers.
// Usage: node scripts/send-email.js

require('dotenv').config();
const { google } = require('googleapis');
const { Resend } = require('resend');
const readline = require('readline');

// Initialize Google Sheets API.
function getGoogleSheetsClient() {
  // Remove surrounding quotes if present and handle newlines.
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^["']|["']$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

// Fetch active subscribers from Google Sheets.
async function fetchSubscribers() {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  console.log('📋 Fetching subscribers from Google Sheets...');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Subscribers!A:C',
  });

  const rows = response.data.values || [];

  // Skip header row and filter for active subscribers.
  const activeSubscribers = rows
    .slice(1)
    .filter(row => row[1] === 'Active')
    .map(row => row[0])
    .filter(Boolean);

  console.log(`✓ Found ${activeSubscribers.length} active subscribers\n`);

  return activeSubscribers;
}

// Prompt user for input.
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Get multi-line input from user.
async function getMultilineInput(promptText) {
  console.log(promptText);
  console.log('(Type your content below. Press Ctrl+D when done)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const lines = [];

  return new Promise((resolve) => {
    rl.on('line', (line) => {
      lines.push(line);
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

// Send emails to all subscribers.
async function sendEmails(subscribers, subject, textBody, htmlBody) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log('📧 Sending emails...\n');

  let successCount = 0;
  let failCount = 0;

  const unsubscribeLink = `${process.env.BLOG_URL || 'https://piapark.me'}/unsubscribe`;

  // Add unsubscribe footer.
  const fullTextBody = `${textBody}

---
If you no longer wish to receive these emails, you can unsubscribe here: ${unsubscribeLink}

Pia Park
${process.env.BLOG_URL || 'https://piapark.me'}
`;

  const fullHtmlBody = `${htmlBody}
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
  <p>
    <a href="${unsubscribeLink}">Unsubscribe</a> from these emails.
  </p>
  <p>
    Pia Park<br>
    <a href="${process.env.BLOG_URL || 'https://piapark.me'}">${process.env.BLOG_URL || 'piapark.me'}</a>
  </p>
</div>
`;

  for (const email of subscribers) {
    try {
      await resend.emails.send({
        from: `${process.env.SENDER_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: subject,
        text: fullTextBody,
        html: fullHtmlBody,
      });

      console.log(`✓ Sent to ${email}`);
      successCount++;

      // Add a small delay to avoid rate limits.
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`✗ Failed to send to ${email}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✓ Successfully sent: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ✗ Failed: ${failCount}`);
  }
  console.log('\n✨ Done!\n');
}

// Main function.
async function main() {
  console.log('\n📬 Send Custom Email to All Subscribers\n');
  console.log('='.repeat(50) + '\n');

  // Validate environment.
  const required = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'RESEND_API_KEY',
    'FROM_EMAIL',
    'SENDER_NAME',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nMake sure you have a .env file with all required variables.');
    process.exit(1);
  }

  try {
    // Fetch subscribers.
    const subscribers = await fetchSubscribers();

    if (subscribers.length === 0) {
      console.log('⚠️  No active subscribers found. Exiting.\n');
      process.exit(0);
    }

    // Get email subject.
    const subject = await prompt('Email subject: ');
    if (!subject.trim()) {
      console.error('\n❌ Subject is required.\n');
      process.exit(1);
    }

    console.log('');

    // Get email body (text version).
    const textBody = await getMultilineInput('Email body (plain text):');

    console.log('\n');

    // Get email body (HTML version).
    const htmlBody = await getMultilineInput('Email body (HTML):');

    console.log('\n');

    // Confirm before sending.
    const confirm = await prompt(`Ready to send to ${subscribers.length} subscribers? (yes/no): `);

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled.\n');
      process.exit(0);
    }

    console.log('');

    // Send emails.
    await sendEmails(subscribers, subject, textBody, htmlBody);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script.
main();
