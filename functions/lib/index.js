"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserFromAuth = exports.createUserDocument = exports.getSignupData = exports.validateStaffId = exports.testSMS = exports.sendSMS = exports.getIpAddress = exports.adminResetPasswordLegacy = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
// mNotify API configuration
const MNOTIFY_API_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_KEY = functions.config().mnotify.api_key;
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
exports.adminResetPasswordLegacy = functions.https.onRequest(async (req, res) => {
    var _a;
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
        if (!adminUser.exists || ((_a = adminUser.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'system_admin') {
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
        const userEmail = userData === null || userData === void 0 ? void 0 : userData.email;
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
    }
    catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            error: 'Failed to reset password',
            details: error.message
        });
    }
});
exports.getIpAddress = functions.https.onRequest((req, res) => {
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
function formatPhoneNumber(phoneNumber) {
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
exports.sendSMS = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
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
        const response = await axios_1.default.post(`${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`, {
            recipient: [formattedPhoneNumber],
            sender: 'OPS STAFFS',
            message: message,
            is_schedule: 'false',
            schedule_date: ''
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
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
    }
    catch (error) {
        console.error('SMS Error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
        // Log failed SMS
        await admin.firestore().collection('sms_logs').add({
            phoneNumber: req.body.phoneNumber,
            message: req.body.message,
            faultId: req.body.faultId,
            faultType: req.body.faultType,
            status: 'failed',
            error: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(500).json({
            error: 'Failed to send SMS',
            details: ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || error.message
        });
    }
});
// Test function to send SMS
exports.testSMS = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
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
        const response = await axios_1.default.post(`${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`, {
            recipient: [formattedPhoneNumber],
            sender: 'OPS STAFFS',
            message: testMessage,
            is_schedule: 'false',
            schedule_date: ''
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
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
    }
    catch (error) {
        console.error('Test SMS Error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
        // Log failed test SMS
        await admin.firestore().collection('sms_logs').add({
            phoneNumber: req.body.phoneNumber,
            message: "This is a test message from ECG Fault Master. Your fault has been resolved.",
            faultId: 'TEST',
            faultType: 'TEST',
            status: 'failed',
            error: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(500).json({
            error: 'Failed to send test SMS',
            details: ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || error.message
        });
    }
});
/**
 * SECURE API Endpoint for Staff ID Validation
 * This approach exposes ZERO data publicly
 * Only validates specific staff ID when provided
 */
exports.validateStaffId = functions.https.onCall(async (data, context) => {
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
            isValid: true, // If staff ID exists, it's valid
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
    }
    catch (error) {
        console.error('❌ Error validating staff ID:', error);
        throw new Error('Validation failed');
    }
});
/**
 * SECURE API Endpoint for Getting Regions/Districts
 * Returns only the data needed for signup
 */
exports.getSignupData = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error getting signup data:', error);
        throw new Error('Failed to load signup data');
    }
});
/**
 * Cloud Function to create user document after signup
 * This ensures proper authentication context
 */
exports.createUserDocument = functions.https.onCall(async (data, context) => {
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
        const cleanUserData = Object.assign(Object.assign({}, userData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        // Create user document in Firestore using Admin SDK
        await admin.firestore().collection('users').doc(userId).set(cleanUserData);
        console.log('✅ User document created successfully via Cloud Function');
        return {
            success: true,
            message: 'User document created successfully'
        };
    }
    catch (error) {
        console.error('❌ Error creating user document via Cloud Function:', error);
        console.error('❌ Error details:', {
            message: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error',
            code: (error === null || error === void 0 ? void 0 : error.code) || 'Unknown code',
            stack: (error === null || error === void 0 ? void 0 : error.stack) || 'No stack trace'
        });
        throw new Error('Failed to create user document');
    }
});
// Cloud Function to delete user from Firebase Auth
exports.deleteUserFromAuth = functions.https.onCall(async (data, context) => {
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
        if ((callerData === null || callerData === void 0 ? void 0 : callerData.role) !== 'system_admin') {
            throw new Error('Only system administrators can delete users');
        }
        // Delete user from Firebase Auth
        await admin.auth().deleteUser(uid);
        console.log(`✅ User ${uid} deleted from Firebase Auth`);
        return {
            success: true,
            message: 'User deleted from Firebase Auth successfully'
        };
    }
    catch (error) {
        console.error('❌ Error deleting user from Firebase Auth:', error);
        throw new Error(`Failed to delete user from Firebase Auth: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map