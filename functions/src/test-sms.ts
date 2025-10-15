import * as admin from 'firebase-admin';
import axios from 'axios';

// Initialize Firebase Admin
admin.initializeApp();

// mNotify API configuration
const MNOTIFY_API_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_KEY = 'Ubqq690QItJE6FRQf4jZdMYlM';

async function testSMS() {
  try {
    const phoneNumber = '0245003731'; // Test phone number
    const testMessage = "This is a test message from ECG Fault Master. Testing mNotify integration.";
    
    // Format phone number (remove +233 and ensure it starts with 0)
    const formattedPhoneNumber = phoneNumber.replace('+233', '0');
    console.log('Sending test SMS to:', formattedPhoneNumber);

    // Send SMS using mNotify
    const response = await axios.post(
      `${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`,
      {
        recipient: [formattedPhoneNumber],
        sender: 'ECG OUTAGE MANAGMENT SYSTEM',
        message: testMessage,
        is_schedule: 'false',
        schedule_date: ''
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('mNotify API response:', response.data);

    // Log successful SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: formattedPhoneNumber,
      message: testMessage,
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'sent',
      messageId: response.data.message_id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Test SMS sent successfully!');
  } catch (error: any) {
    console.error('Error sending test SMS:', error.response?.data || error);
    
    // Log failed SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: '0245003731',
      message: "This is a test message from ECG Fault Master. Testing mNotify integration.",
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Run the test
testSMS(); 