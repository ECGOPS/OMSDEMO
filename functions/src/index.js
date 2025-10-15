const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated and is a system admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const adminUser = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!adminUser.exists || adminUser.data().role !== 'system_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only system administrators can reset passwords');
  }

  const { userId } = data;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  // Get the user document
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const userData = userDoc.data();
  const userEmail = userData.email;

  if (!userEmail) {
    throw new functions.https.HttpsError('not-found', 'User email not found');
  }

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-8);

  try {
    // Update the user's password using the Admin SDK
    await admin.auth().updateUser(userId, {
      password: tempPassword
    });

    return { tempPassword };
  } catch (error) {
    console.error('Error resetting password:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reset password');
  }
}); 