import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log('Email:', email);
  console.log('Key length:', key?.length);
  console.log('Key starts with:', key?.substring(0, 30));

  const auth = new google.auth.JWT(
    email,
    undefined,
    key,
    ['https://www.googleapis.com/auth/drive']
  );

  try {
    console.log('Authorizing...');
    await auth.authorize();
    console.log('Authorized successfully!');

    const drive = google.drive({ version: 'v3', auth });
    console.log('Listing files...');
    const res = await drive.files.list({ pageSize: 1 });
    console.log('Files:', res.data.files);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

test();
