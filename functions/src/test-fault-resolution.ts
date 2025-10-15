import axios from 'axios';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin with project configuration
admin.initializeApp({
  projectId: 'ecg-faultmaster',
  credential: admin.credential.applicationDefault()
});

const BULKSMS_API_URL = 'https://pelrq3.api.infobip.com/sms/2/text/advanced';
const BULKSMS_API_KEY = '419263b1555f8d65a247896669771ec2-5f8ff6e0-c19d-4ea8-9c98-295d9ce0a784';

interface BulkSMSResponse {
  messages: Array<{
    messageId: string;
    status: {
      groupName: string;
      name: string;
      description: string;
    };
  }>;
}

async function testFaultResolution() {
  const phoneNumber = '0245003731';
  const faultId = 'TEST-' + Date.now();
  const faultType = 'TEST_FAULT';
  const location = 'Test Substation, Accra';
  
  const message = `Your reported fault (ID: ${faultId}) at ${location} has been resolved. Thank you for your patience.`;

  try {
    // Format phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    console.log('Sending resolution notification to:', formattedPhoneNumber);

    // Send SMS using BulkSMS
    const response = await axios.post<BulkSMSResponse>(
      BULKSMS_API_URL,
      {
        messages: [{
          destinations: [{
            to: formattedPhoneNumber
          }],
          from: 'ECG OUTAGE MANAGMENT SYSTEM',
          text: message
        }]
      },
      {
        headers: {
          'Authorization': `App ${BULKSMS_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Log successful SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: formattedPhoneNumber,
      message,
      faultId,
      faultType,
      status: 'sent',
      bulksmsMessageId: response.data.messages[0].messageId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Resolution notification sent successfully:', response.data);
  } catch (error: any) {
    console.error('Error sending resolution notification:', error.response?.data || error.message);
    
    // Log failed SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber,
      message,
      faultId,
      faultType,
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Helper function to format phone numbers
function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If number starts with 0, replace with +233
  if (cleaned.startsWith('0')) {
    return '+233' + cleaned.substring(1);
  }
  
  // If number starts with 233, add +
  if (cleaned.startsWith('233')) {
    return '+' + cleaned;
  }
  
  // If number doesn't have country code, add +233
  if (cleaned.length === 10) {
    return '+233' + cleaned;
  }
  
  // Return as is if already in international format
  return '+' + cleaned;
}

// Run the test
testFaultResolution(); 