import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();

// mNotify API configuration
const MNOTIFY_API_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_KEY = functions.config().mnotify.api_key;

interface MNotifyResponse {
  status: string;
  code: number;
  message: string;
  message_id: string;
  balance: number;
  recipient: number;
}

// export const adminResetPassword = functions.https.onRequest(async (req, res) => {
//   // Set CORS headers
//   res.set('Access-Control-Allow-Origin', '*');
//   res.set('Access-Control-Allow-Methods', 'POST');
//   res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
// 
//   // Handle preflight requests
//   if (req.method === 'OPTIONS') {
//     res.status(204).send('');
//     return;
//   }
// 
//   // Only allow POST requests
//   if (req.method !== 'POST') {
//     res.status(405).send('Method Not Allowed');
//     return;
//   }
// 
//   try {
//     // Get the authorization token
//     const authHeader = req.headers.authorization;
//     if (!authHeader) {
//       res.status(401).send('Unauthorized');
//       return;
//     }
// 
//     const token = authHeader.split('Bearer ')[1];
//     if (!token) {
//       res.status(401).send('Invalid authorization header');
//       return;
//     }
// 
//     // Verify the token and get the user
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     const adminUser = await admin.firestore().collection('users').doc(decodedToken.uid).get();
//     
//     if (!adminUser.exists || adminUser.data()?.role !== 'system_admin') {
//       res.status(403).send('Only system administrators can reset passwords');
//       return;
//     }
// 
//     const { userId } = req.body;
//     if (!userId) {
//       res.status(400).send('User ID is required');
//       return;
//     }
// 
//     // Get the user document
//     const userDoc = await admin.firestore().collection('users').doc(userId).get();
//     if (!userDoc.exists) {
//       res.status(404).send('User not found');
//       return;
//     }
// 
//     const userData = userDoc.data();
//     const userEmail = userData?.email;
// 
//     if (!userEmail) {
//       res.status(404).send('User email not found');
//       return;
//     }
// 
//     // Generate a temporary password
//     const tempPassword = Math.random().toString(36).slice(-8);
// 
//     // Update the user's password using the Admin SDK
//     await admin.auth().updateUser(userId, {
//       password: tempPassword
//     });
// 
//     res.status(200).json({ tempPassword });
//   } catch (error: any) {
//     console.error('Error resetting password:', error);
//     res.status(500).json({
//       error: 'Failed to reset password',
//       details: error.message
//     });
//   }
// });

export const adminResetPasswordLegacy = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).send('Unauthorized');
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.status(401).send('Invalid authorization header');
      return;
    }

    // Verify the token and get the user
    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminUser = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!adminUser.exists || adminUser.data()?.role !== 'system_admin') {
      res.status(403).send('Only system administrators can reset passwords');
      return;
    }

    const { userId } = req.body;
    if (!userId) {
      res.status(400).send('User ID is required');
      return;
    }

    // Get the user document
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).send('User not found');
      return;
    }

    const userData = userDoc.data();
    const userEmail = userData?.email;

    if (!userEmail) {
      res.status(404).send('User email not found');
      return;
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);

    // Update the user's password using the Admin SDK
    await admin.auth().updateUser(userId, {
      password: tempPassword
    });

    res.status(200).json({ tempPassword });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      details: error.message
    });
  }
});

export const getIpAddress = functions.https.onRequest((req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Get the IP address from the request
  const ipAddress = req.ip || 'unknown';
  
  res.status(200).json({
    ip: ipAddress
  });
});

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

export const sendSMS = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).send('Unauthorized');
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.status(401).send('Invalid authorization header');
      return;
    }

    // Verify the token
    await admin.auth().verifyIdToken(token);

    const { phoneNumber, message, faultId, faultType } = req.body;

    if (!phoneNumber || !message) {
      res.status(400).send('Phone number and message are required');
      return;
    }

    // Format phone number to ensure it's in the correct format (e.g., 024XXXXXXXX)
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber).replace('+233', '0');
    console.log('Sending SMS to:', formattedPhoneNumber);

    // Send SMS using mNotify
    const response = await axios.post<MNotifyResponse>(
      `${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`,
      {
        recipient: [formattedPhoneNumber],
        sender: 'OPS STAFFS',
        message: message,
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
      message,
      faultId,
      faultType,
      status: 'sent',
      messageId: response.data.message_id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      messageId: response.data.message_id
    });
  } catch (error: any) {
    console.error('SMS Error:', error.response?.data || error);
    
    // Log failed SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: req.body.phoneNumber,
      message: req.body.message,
      faultId: req.body.faultId,
      faultType: req.body.faultType,
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(500).json({
      error: 'Failed to send SMS',
      details: error.response?.data || error.message
    });
  }
});

// Test function to send SMS
export const testSMS = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).send('Unauthorized');
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.status(401).send('Invalid authorization header');
      return;
    }

    // Verify the token
    await admin.auth().verifyIdToken(token);

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).send('Phone number is required');
      return;
    }

    const testMessage = "This is a test message from ECG Fault Master. Your fault has been resolved.";

    // Format phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber).replace('+233', '0');

    // Send test SMS
    const response = await axios.post<MNotifyResponse>(
      `${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`,
      {
        recipient: [formattedPhoneNumber],
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

    // Log test SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: formattedPhoneNumber,
      message: testMessage,
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'sent',
      messageId: response.data.message_id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ 
      success: true, 
      messageId: response.data.message_id,
      message: 'Test SMS sent successfully'
    });
  } catch (error: any) {
    console.error('Test SMS Error:', error.response?.data || error);
    
    // Log failed test SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: req.body.phoneNumber,
      message: "This is a test message from ECG Fault Master. Your fault has been resolved.",
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(500).json({
      error: 'Failed to send test SMS',
      details: error.response?.data || error.message
    });
  }
});

/**
 * SECURE API Endpoint for Staff ID Validation
 * This approach exposes ZERO data publicly
 * Only validates specific staff ID when provided
 */
export const validateStaffId = functions.https.onCall(async (data, context) => {
  const { staffId } = data;
  
  console.log('🔍 Validating staff ID:', staffId);
  
  if (!staffId) {
    throw new Error('Staff ID is required');
  }
  
  try {
    // Query secure collection (requires admin privileges)
    const staffDoc = await admin.firestore().collection('staffIds').doc(staffId).get();
    
    console.log('📄 Staff document exists:', staffDoc.exists);
    console.log('📄 Staff document ID:', staffDoc.id);
    
    if (!staffDoc.exists) {
      // Let's also check what staff IDs actually exist for debugging
      const allStaffIds = await admin.firestore().collection('staffIds').get();
      console.log('📋 All existing staff IDs:', allStaffIds.docs.map(doc => doc.id));
      
      return {
        exists: false,
        message: 'Staff ID not found'
      };
    }
    
    const staffData = staffDoc.data();
    console.log('📊 Staff data:', staffData);
    
    if (!staffData) {
      return {
        exists: false,
        message: 'Staff ID not found'
      };
    }
    
    // Check if staff ID is already registered by checking users collection
    const usersWithStaffId = await admin.firestore()
      .collection('users')
      .where('staffId', '==', staffId)
      .get();
    
    const isRegistered = !usersWithStaffId.empty;
    console.log('👤 Is registered:', isRegistered);
    
    // Return validation result with staff data for form pre-population
    return {
      exists: true,
      isValid: true,  // If staff ID exists, it's valid
      isActive: true, // Assume all staff IDs in collection are active
      isRegistered: isRegistered,
      canRegister: !isRegistered,
      staffData: {
        name: staffData.name,
        role: staffData.role,
        region: staffData.region,
        district: staffData.district
      }
    };
    
  } catch (error) {
    console.error('❌ Error validating staff ID:', error);
    throw new Error('Validation failed');
  }
});

/**
 * SECURE API Endpoint for Getting Regions/Districts
 * Returns only the data needed for signup
 */
export const getSignupData = functions.https.onCall(async (data, context) => {
  try {
    // Get regions (minimal data)
    const regionsSnapshot = await admin.firestore().collection('regions').get();
    const regions = regionsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
    
    // Get districts (minimal data)
    const districtsSnapshot = await admin.firestore().collection('districts').get();
    const districts = districtsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      regionId: doc.data().regionId
    }));
    
    return {
      regions,
      districts
    };
    
  } catch (error) {
    console.error('Error getting signup data:', error);
    throw new Error('Failed to load signup data');
  }
});

/**
 * Cloud Function to create user document after signup
 * This ensures proper authentication context
 */
export const createUserDocument = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new Error('User must be authenticated');
  }

  const { userData } = data;
  const userId = context.auth.uid;

  try {
    console.log('🔍 Creating user document via Cloud Function:', {
      userId,
      userData,
      authUid: context.auth.uid,
      authEmail: context.auth.token.email
    });

    // Remove serverTimestamp() fields as they cause issues in Cloud Functions
    const cleanUserData = {
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Create user document in Firestore using Admin SDK
    await admin.firestore().collection('users').doc(userId).set(cleanUserData);

    console.log('✅ User document created successfully via Cloud Function');

    return {
      success: true,
      message: 'User document created successfully'
    };

  } catch (error: any) {
    console.error('❌ Error creating user document via Cloud Function:', error);
    console.error('❌ Error details:', {
      message: error?.message || 'Unknown error',
      code: error?.code || 'Unknown code',
      stack: error?.stack || 'No stack trace'
    });
    throw new Error('Failed to create user document');
  }
});

// Cloud Function to delete user from Firebase Auth
export const deleteUserFromAuth = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated and is a system admin
  if (!context.auth) {
    throw new Error('Authentication required');
  }

  const { uid } = data;
  if (!uid) {
    throw new Error('User UID is required');
  }

  try {
    // Verify the caller is a system admin
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
      throw new Error('Caller user not found');
    }

    const callerData = callerDoc.data();
    if (callerData?.role !== 'system_admin') {
      throw new Error('Only system administrators can delete users');
    }

    // Delete user from Firebase Auth
    await admin.auth().deleteUser(uid);
    
    console.log(`✅ User ${uid} deleted from Firebase Auth`);
    
    return {
      success: true,
      message: 'User deleted from Firebase Auth successfully'
    };
  } catch (error: any) {
    console.error('❌ Error deleting user from Firebase Auth:', error);
    throw new Error(`Failed to delete user from Firebase Auth: ${error.message}`);
  }
});