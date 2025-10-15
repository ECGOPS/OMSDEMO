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

async function checkCollection(collectionName) {
  try {
    console.log(`\nChecking collection: ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();
    console.log(`Found ${snapshot.size} documents in ${collectionName}`);
    
    snapshot.forEach((doc) => {
      console.log(`Document ID: ${doc.id}`);
      console.log('Data:', doc.data());
    });
  } catch (error) {
    console.error(`Error checking collection ${collectionName}:`, error);
  }
}

async function checkAllCollections() {
  const collections = [
    'users',
    'staffIds',
    'regions',
    'districts',
    'vitAssets',
    'vitInspections',
    'op5Faults',
    'controlOutages',
    'substationInspections',
    'loadMonitoring',
    'overheadLineInspections'
  ];

  for (const collection of collections) {
    await checkCollection(collection);
  }
}

checkAllCollections()
  .then(() => {
    console.log('\nDatabase check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error checking database:', error);
    process.exit(1);
  }); 