import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the service account key
const serviceAccount = JSON.parse(
  await readFile(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const auth = admin.auth();
const db = admin.firestore();

const adminUser = {
  email: 'admin@faultmaster.com',
  password: 'Admin@123',
  staffId: 'ADMIN001',
  displayName: 'System Administrator'
};

async function createAdminUser() {
  try {
    // Check if staff ID exists and is not assigned
    const staffIdDoc = await db.collection('staffIds').doc(adminUser.staffId).get();
    if (!staffIdDoc.exists) {
      throw new Error('Staff ID does not exist. Run createAdmin.js first.');
    }
    if (staffIdDoc.data().isAssigned) {
      throw new Error('Staff ID is already assigned to a user.');
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: adminUser.email,
      password: adminUser.password,
      displayName: adminUser.displayName
    });

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: adminUser.email,
      displayName: adminUser.displayName,
      staffId: adminUser.staffId,
      role: 'system_admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update staff ID as assigned
    await db.collection('staffIds').doc(adminUser.staffId).update({
      isAssigned: true,
      assignedTo: userRecord.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Admin user created successfully');
    console.log('Email:', adminUser.email);
    console.log('Password:', adminUser.password);
    console.log('Please change the password after first login');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser(); 