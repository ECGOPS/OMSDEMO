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
exports.getSignupData = exports.validateStaffId = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * SECURE API Endpoint for Staff ID Validation
 * This approach exposes ZERO data publicly
 * Only validates specific staff ID when provided
 */
exports.validateStaffId = (0, https_1.onCall)(async (request) => {
    const { staffId, email } = request.data;
    if (!staffId) {
        throw new Error('Staff ID is required');
    }
    try {
        // Query secure collection (requires admin privileges)
        const staffDoc = await db.collection('staffIds').doc(staffId).get();
        if (!staffDoc.exists) {
            return {
                exists: false,
                message: 'Staff ID not found'
            };
        }
        const staffData = staffDoc.data();
        if (!staffData) {
            return {
                exists: false,
                message: 'Staff ID not found'
            };
        }
        // Return only validation result, not the actual data
        return {
            exists: true,
            isValid: staffData.email === email,
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
 * SECURE API Endpoint for Getting Regions/Districts
 * Returns only the data needed for signup
 */
exports.getSignupData = (0, https_1.onCall)(async (request) => {
    try {
        // Get regions (minimal data)
        const regionsSnapshot = await db.collection('regions').get();
        const regions = regionsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));
        // Get districts (minimal data)
        const districtsSnapshot = await db.collection('districts').get();
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
//# sourceMappingURL=secure-signup-api.js.map