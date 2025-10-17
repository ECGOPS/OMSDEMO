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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStaffIdHashes = exports.validateStaffIdSecure = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * SECURE Staff ID Validation with Hashing
 * This approach exposes ZERO identifiable data
 * Uses hashed staff IDs for lookup
 */
exports.validateStaffIdSecure = (0, https_1.onCall)(async (request) => {
    const { staffId, email } = request.data;
    if (!staffId || !email) {
        throw new Error('Staff ID and email are required');
    }
    try {
        // Create hash of staff ID for lookup
        const staffIdHash = crypto.createHash('sha256').update(staffId).digest('hex');
        // Query using hash (no readable staff IDs exposed)
        const staffDoc = await db.collection('staffIdHashes').doc(staffIdHash).get();
        if (!staffDoc.exists) {
            return {
                exists: false,
                message: 'Invalid staff ID'
            };
        }
        const staffData = staffDoc.data();
        // Validate email match
        const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
        if (staffData.emailHash !== emailHash) {
            return {
                exists: true,
                isValid: false,
                message: 'Email does not match staff record'
            };
        }
        return {
            exists: true,
            isValid: true,
            isActive: staffData.isActive || true,
            isRegistered: staffData.isRegistered || false,
            canRegister: !staffData.isRegistered && (staffData.isActive || true)
        };
    }
    catch (error) {
        console.error('Error validating staff ID:', error);
        throw new Error('Validation failed');
    }
});
/**
 * Create staff ID hash collection (run once)
 */
exports.createStaffIdHashes = (0, https_1.onCall)(async (request) => {
    // This should only be run by admin
    const { adminToken } = request.data;
    if (adminToken !== 'your-secure-admin-token') {
        throw new Error('Unauthorized');
    }
    try {
        const staffIdsSnapshot = await db.collection('staffIds').get();
        for (const doc of staffIdsSnapshot.docs) {
            const staffData = doc.data();
            const staffIdHash = crypto.createHash('sha256').update(doc.id).digest('hex');
            const emailHash = crypto.createHash('sha256').update(staffData.email.toLowerCase()).digest('hex');
            await db.collection('staffIdHashes').doc(staffIdHash).set({
                emailHash: emailHash,
                isActive: staffData.isActive || true,
                isRegistered: staffData.isRegistered || false
            });
        }
        return { success: true, count: staffIdsSnapshot.size };
    }
    catch (error) {
        console.error('Error creating staff ID hashes:', error);
        throw new Error('Failed to create hashes');
    }
});
//# sourceMappingURL=hashed-staff-validation.js.map