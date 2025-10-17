import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Sync regions data to public collection for signup
 * Only syncs non-sensitive data: id, name
 */
export const syncRegionToPublic = onDocumentCreated({
  document: 'regions/{regionId}',
  region: 'us-central1'
}, async (event) => {
  const regionData = event.data?.data();
  const regionId = event.params.regionId;

  if (!regionData) return;

  try {
    // Create public region document with minimal data
    await db.collection('public_regions').doc(regionId).set({
      id: regionId,
      name: regionData.name,
      // Only include non-sensitive fields
      // Exclude: population, coordinates, sensitive metadata
    });

    console.log(`Synced region ${regionId} to public collection`);
  } catch (error) {
    console.error('Error syncing region to public:', error);
  }
});

export const updatePublicRegion = onDocumentUpdated({
  document: 'regions/{regionId}',
  region: 'us-central1'
}, async (event) => {
  const newData = event.data?.after.data();
  const regionId = event.params.regionId;

  if (!newData) return;

  try {
    await db.collection('public_regions').doc(regionId).set({
      id: regionId,
      name: newData.name,
    });

    console.log(`Updated public region ${regionId}`);
  } catch (error) {
    console.error('Error updating public region:', error);
  }
});

export const deletePublicRegion = onDocumentDeleted({
  document: 'regions/{regionId}',
  region: 'us-central1'
}, async (event) => {
  const regionId = event.params.regionId;

  try {
    await db.collection('public_regions').doc(regionId).delete();
    console.log(`Deleted public region ${regionId}`);
  } catch (error) {
    console.error('Error deleting public region:', error);
  }
});

/**
 * Sync districts data to public collection for signup
 * Only syncs non-sensitive data: id, name, regionId
 */
export const syncDistrictToPublic = onDocumentCreated({
  document: 'districts/{districtId}',
  region: 'us-central1'
}, async (event) => {
  const districtData = event.data?.data();
  const districtId = event.params.districtId;

  if (!districtData) return;

  try {
    await db.collection('public_districts').doc(districtId).set({
      id: districtId,
      name: districtData.name,
      regionId: districtData.regionId,
      // Only include non-sensitive fields
      // Exclude: population, coordinates, sensitive metadata
    });

    console.log(`Synced district ${districtId} to public collection`);
  } catch (error) {
    console.error('Error syncing district to public:', error);
  }
});

export const updatePublicDistrict = onDocumentUpdated({
  document: 'districts/{districtId}',
  region: 'us-central1'
}, async (event) => {
  const newData = event.data?.after.data();
  const districtId = event.params.districtId;

  if (!newData) return;

  try {
    await db.collection('public_districts').doc(districtId).set({
      id: districtId,
      name: newData.name,
      regionId: newData.regionId,
    });

    console.log(`Updated public district ${districtId}`);
  } catch (error) {
    console.error('Error updating public district:', error);
  }
});

export const deletePublicDistrict = onDocumentDeleted({
  document: 'districts/{districtId}',
  region: 'us-central1'
}, async (event) => {
  const districtId = event.params.districtId;

  try {
    await db.collection('public_districts').doc(districtId).delete();
    console.log(`Deleted public district ${districtId}`);
  } catch (error) {
    console.error('Error deleting public district:', error);
  }
});

/**
 * Sync staff IDs to public lookup collection for signup validation
 * Only syncs: staffId, email, isActive, isRegistered
 */
export const syncStaffIdToPublic = onDocumentCreated({
  document: 'staffIds/{staffId}',
  region: 'us-central1'
}, async (event) => {
  const staffData = event.data?.data();
  const staffId = event.params.staffId;

  if (!staffData) return;

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
  } catch (error) {
    console.error('Error syncing staff ID to public:', error);
  }
});

export const updatePublicStaffId = onDocumentUpdated({
  document: 'staffIds/{staffId}',
  region: 'us-central1'
}, async (event) => {
  const newData = event.data?.after.data();
  const staffId = event.params.staffId;

  if (!newData) return;

  try {
    await db.collection('public_staff_lookup').doc(staffId).set({
      staffId: staffId,
      email: newData.email,
      isActive: newData.isActive || true,
      isRegistered: newData.isRegistered || false,
    });

    console.log(`Updated public staff ID ${staffId}`);
  } catch (error) {
    console.error('Error updating public staff ID:', error);
  }
});

export const deletePublicStaffId = onDocumentDeleted({
  document: 'staffIds/{staffId}',
  region: 'us-central1'
}, async (event) => {
  const staffId = event.params.staffId;

  try {
    await db.collection('public_staff_lookup').doc(staffId).delete();
    console.log(`Deleted public staff ID ${staffId}`);
  } catch (error) {
    console.error('Error deleting public staff ID:', error);
  }
});

/**
 * Mark staff ID as registered when user signs up
 */
export const markStaffIdAsRegistered = onDocumentCreated({
  document: 'users/{userId}',
  region: 'us-central1'
}, async (event) => {
  const userData = event.data?.data();
  const staffId = userData?.staffId;

  if (!staffId) return;

  try {
    await db.collection('public_staff_lookup').doc(staffId).update({
      isRegistered: true,
    });

    console.log(`Marked staff ID ${staffId} as registered`);
  } catch (error) {
    console.error('Error marking staff ID as registered:', error);
  }
});
