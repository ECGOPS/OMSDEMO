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
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
// Initialize Firebase Admin
admin.initializeApp();
// mNotify API configuration
const MNOTIFY_API_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_KEY = 'Ubqq690QItJE6FRQf4jZdMYlM';
async function testSMS() {
    var _a, _b, _c;
    try {
        const phoneNumber = '0245003731'; // Test phone number
        const testMessage = "This is a test message from ECG Fault Master. Testing mNotify integration.";
        // Format phone number (remove +233 and ensure it starts with 0)
        const formattedPhoneNumber = phoneNumber.replace('+233', '0');
        console.log('Sending test SMS to:', formattedPhoneNumber);
        // Send SMS using mNotify
        const response = await axios_1.default.post(`${MNOTIFY_API_URL}?key=${MNOTIFY_API_KEY}`, {
            recipient: [formattedPhoneNumber],
            sender: 'ECG OUTAGE MANAGMENT SYSTEM',
            message: testMessage,
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
            message: testMessage,
            faultId: 'TEST',
            faultType: 'TEST',
            status: 'sent',
            messageId: response.data.message_id,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Test SMS sent successfully!');
    }
    catch (error) {
        console.error('Error sending test SMS:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
        // Log failed SMS
        await admin.firestore().collection('sms_logs').add({
            phoneNumber: '0245003731',
            message: "This is a test message from ECG Fault Master. Testing mNotify integration.",
            faultId: 'TEST',
            faultType: 'TEST',
            status: 'failed',
            error: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
// Run the test
testSMS();
//# sourceMappingURL=test-sms.js.map