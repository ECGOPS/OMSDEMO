import axios from 'axios';

const MNOTIFY_API_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_KEY = 'Ubqq690QItJE6FRQf4jZdMYlM';

async function testSMS() {
  try {
    const phoneNumber = '0245003731';
    const testMessage = "This is a test message from ECG Fault Master. Testing mNotify integration.";
    
    console.log('Sending test SMS to:', phoneNumber);

    const response = await axios.post(
      `${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`,
      {
        recipient: [phoneNumber],
        sender: 'OPS STAFFS',
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
    console.log('Test SMS sent successfully!');
  } catch (error) {
    console.error('Error sending test SMS:', error.response?.data || error);
  }
}

testSMS(); 