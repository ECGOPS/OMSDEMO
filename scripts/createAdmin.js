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

const db = admin.firestore();

async function createAdminStaffId() {
  try {
    // Create admin staff ID document
    await db.collection('staffIds').doc('ADMIN001').set({
      staffId: 'ADMIN001',
      role: 'system_admin',
      isAssigned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Admin staff ID created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin staff ID:', error);
    process.exit(1);
  }
}

createAdminStaffId(); 