"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markStaffIdAsRegistered = exports.deletePublicStaffId = exports.updatePublicStaffId = exports.syncStaffIdToPublic = exports.deletePublicDistrict = exports.updatePublicDistrict = exports.syncDistrictToPublic = exports.deletePublicRegion = exports.updatePublicRegion = exports.syncRegionToPublic = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
/**
 * Sync regions data to public collection for signup
 * Only syncs non-sensitive data: id, name
 */
exports.syncRegionToPublic = (0, firestore_1.onDocumentCreated)({
    document: 'regions/{regionId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const regionData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const regionId = event.params.regionId;
    if (!regionData)
        return;
    try {
        // Create public region document with minimal data
        await db.collection('public_regions').doc(regionId).set({
            id: regionId,
            name: regionData.name,
            // Only include non-sensitive fields
            // Exclude: population, coordinates, sensitive metadata
        });
        console.log(`Synced region ${regionId} to public collection`);
    }
    catch (error) {
        console.error('Error syncing region to public:', error);
    }
});
exports.updatePublicRegion = (0, firestore_1.onDocumentUpdated)({
    document: 'regions/{regionId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const newData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const regionId = event.params.regionId;
    if (!newData)
        return;
    try {
        await db.collection('public_regions').doc(regionId).set({
            id: regionId,
            name: newData.name,
        });
        console.log(`Updated public region ${regionId}`);
    }
    catch (error) {
        console.error('Error updating public region:', error);
    }
});
exports.deletePublicRegion = (0, firestore_1.onDocumentDeleted)({
    document: 'regions/{regionId}',
    region: 'us-central1'
}, async (event) => {
    const regionId = event.params.regionId;
    try {
        await db.collection('public_regions').doc(regionId).delete();
        console.log(`Deleted public region ${regionId}`);
    }
    catch (error) {
        console.error('Error deleting public region:', error);
    }
});
/**
 * Sync districts data to public collection for signup
 * Only syncs non-sensitive data: id, name, regionId
 */
exports.syncDistrictToPublic = (0, firestore_1.onDocumentCreated)({
    document: 'districts/{districtId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const districtData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const districtId = event.params.districtId;
    if (!districtData)
        return;
    try {
        await db.collection('public_districts').doc(districtId).set({
            id: districtId,
            name: districtData.name,
            regionId: districtData.regionId,
            // Only include non-sensitive fields
            // Exclude: population, coordinates, sensitive metadata
        });
        console.log(`Synced district ${districtId} to public collection`);
    }
    catch (error) {
        console.error('Error syncing district to public:', error);
    }
});
exports.updatePublicDistrict = (0, firestore_1.onDocumentUpdated)({
    document: 'districts/{districtId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const newData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const districtId = event.params.districtId;
    if (!newData)
        return;
    try {
        await db.collection('public_districts').doc(districtId).set({
            id: districtId,
            name: newData.name,
            regionId: newData.regionId,
        });
        console.log(`Updated public district ${districtId}`);
    }
    catch (error) {
        console.error('Error updating public district:', error);
    }
});
exports.deletePublicDistrict = (0, firestore_1.onDocumentDeleted)({
    document: 'districts/{districtId}',
    region: 'us-central1'
}, async (event) => {
    const districtId = event.params.districtId;
    try {
        await db.collection('public_districts').doc(districtId).delete();
        console.log(`Deleted public district ${districtId}`);
    }
    catch (error) {
        console.error('Error deleting public district:', error);
    }
});
/**
 * Sync staff IDs to public lookup collection for signup validation
 * Only syncs: staffId, email, isActive, isRegistered
 */
exports.syncStaffIdToPublic = (0, firestore_1.onDocumentCreated)({
    document: 'staffIds/{staffId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const staffData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const staffId = event.params.staffId;
    if (!staffData)
        return;
    try {
        await db.collection('public_staff_lookup').doc(staffId).set({
            staffId: staffId,
            email: staffData.email,
            isActive: staffData.isActive || true,
            isRegistered: staffData.isRegistered || false,
            // Only include fields needed for signup validation
            // Exclude: personal details, phone numbers, addresses, etc.
        });
        console.log(`Synced staff ID ${staffId} to public lookup`);
    }
    catch (error) {
        console.error('Error syncing staff ID to public:', error);
    }
});
exports.updatePublicStaffId = (0, firestore_1.onDocumentUpdated)({
    document: 'staffIds/{staffId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const newData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const staffId = event.params.staffId;
    if (!newData)
        return;
    try {
        await db.collection('public_staff_lookup').doc(staffId).set({
            staffId: staffId,
            email: newData.email,
            isActive: newData.isActive || true,
            isRegistered: newData.isRegistered || false,
        });
        console.log(`Updated public staff ID ${staffId}`);
    }
    catch (error) {
        console.error('Error updating public staff ID:', error);
    }
});
exports.deletePublicStaffId = (0, firestore_1.onDocumentDeleted)({
    document: 'staffIds/{staffId}',
    region: 'us-central1'
}, async (event) => {
    const staffId = event.params.staffId;
    try {
        await db.collection('public_staff_lookup').doc(staffId).delete();
        console.log(`Deleted public staff ID ${staffId}`);
    }
    catch (error) {
        console.error('Error deleting public staff ID:', error);
    }
});
/**
 * Mark staff ID as registered when user signs up
 */
exports.markStaffIdAsRegistered = (0, firestore_1.onDocumentCreated)({
    document: 'users/{userId}',
    region: 'us-central1'
}, async (event) => {
    var _a;
    const userData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const staffId = userData === null || userData === void 0 ? void 0 : userData.staffId;
    if (!staffId)
        return;
    try {
        await db.collection('public_staff_lookup').doc(staffId).update({
            isRegistered: true,
        });
        console.log(`Marked staff ID ${staffId} as registered`);
    }
    catch (error) {
        console.error('Error marking staff ID as registered:', error);
    }
});
//# sourceMappingURL=sync-public-data.js.map