import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp,
  serverTimestamp,
  getFirestore,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Collection names
const COLLECTIONS = {
  OP5_FAULTS: 'op5-faults',
  CONTROL_OUTAGES: 'control-outages',
  VIT_ASSETS: 'vit-assets',
  VIT_INSPECTIONS: 'vit-inspections',
  SUBSTATION_INSPECTIONS: 'substation-inspections',
  LOAD_MONITORING: 'load-monitoring',
  PENDING_SYNC: 'pending-sync'
};

// Generic CRUD operations
export async function addItem(collectionName: keyof typeof COLLECTIONS, item: any) {
  const docRef = doc(collection(db, COLLECTIONS[collectionName]));
  const itemWithTimestamps = {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(docRef, itemWithTimestamps);
  return docRef.id;
}

export async function updateItem(collectionName: keyof typeof COLLECTIONS, id: string, item: any) {
  const docRef = doc(db, COLLECTIONS[collectionName], id);
  const itemWithTimestamp = {
    ...item,
    updatedAt: serverTimestamp()
  };
  await updateDoc(docRef, itemWithTimestamp);
}

export async function deleteItem(collectionName: keyof typeof COLLECTIONS, id: string) {
  const docRef = doc(db, COLLECTIONS[collectionName], id);
  await deleteDoc(docRef);
}

export async function getItem(collectionName: keyof typeof COLLECTIONS, id: string) {
  const docRef = doc(db, COLLECTIONS[collectionName], id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function getAllItems(collectionName: keyof typeof COLLECTIONS) {
  const querySnapshot = await getDocs(collection(db, COLLECTIONS[collectionName]));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Query operations
export async function getItemsByDate(collectionName: keyof typeof COLLECTIONS, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, COLLECTIONS[collectionName]),
    where('occurrenceDate', '>=', Timestamp.fromDate(startOfDay)),
    where('occurrenceDate', '<=', Timestamp.fromDate(endOfDay))
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getItemsByRegion(collectionName: keyof typeof COLLECTIONS, regionId: string) {
  const q = query(
    collection(db, COLLECTIONS[collectionName]),
    where('regionId', '==', regionId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Sync operations
export async function addToPendingSync(type: string, action: 'create' | 'update' | 'delete', data: any) {
  const docRef = doc(collection(db, COLLECTIONS.PENDING_SYNC));
  await setDoc(docRef, {
    type,
    action,
    data,
    timestamp: serverTimestamp(),
    status: 'pending'
  });
}

export async function getPendingSyncItems() {
  const q = query(
    collection(db, COLLECTIONS.PENDING_SYNC),
    where('status', '==', 'pending')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function clearPendingSyncItem(id: string) {
  const docRef = doc(db, COLLECTIONS.PENDING_SYNC, id);
  await updateDoc(docRef, { status: 'completed' });
}

// Reset Firestore connection
export async function resetFirestoreConnection() {
  try {
    const db = getFirestore();
    // First disable the network
    await disableNetwork(db);
    // Then enable it again
    await enableNetwork(db);
    console.log('Firestore connection reset successfully');
  } catch (error) {
    console.error('Error resetting Firestore connection:', error);
    throw error;
  }
} 