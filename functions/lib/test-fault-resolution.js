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
const axios_1 = __importDefault(require("axios"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin with project configuration
admin.initializeApp({
    projectId: 'ecg-faultmaster',
    credential: admin.credential.applicationDefault()
});
const BULKSMS_API_URL = 'https://pelrq3.api.infobip.com/sms/2/text/advanced';
const BULKSMS_API_KEY = '419263b1555f8d65a247896669771ec2-5f8ff6e0-c19d-4ea8-9c98-295d9ce0a784';
async function testFaultResolution() {
    var _a, _b, _c;
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
        const response = await axios_1.default.post(BULKSMS_API_URL, {
            messages: [{
                    destinations: [{
                            to: formattedPhoneNumber
                        }],
                    from: 'ECG OUTAGE MANAGMENT SYSTEM',
                    text: message
                }]
        }, {
            headers: {
                'Authorization': `App ${BULKSMS_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
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
    }
    catch (error) {
        console.error('Error sending resolution notification:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        // Log failed SMS
        await admin.firestore().collection('sms_logs').add({
            phoneNumber,
            message,
            faultId,
            faultType,
            status: 'failed',
            error: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
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
// Run the test
testFaultResolution();
//# sourceMappingURL=test-fault-resolution.js.map