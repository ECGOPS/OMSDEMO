import { getPendingSyncItems, clearPendingSyncItem } from './db';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFirestore, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

let isOnline = navigator.onLine;
let syncInProgress = false;

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  syncPendingChanges();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

// Secure logging function that only logs in development
const secureLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

// Secure error logging that sanitizes sensitive data
const secureErrorLog = (message: string, error: any) => {
  if (process.env.NODE_ENV === 'development') {
    // Sanitize error object to remove sensitive data
    const sanitizedError = {
      message: error.message,
      code: error.code,
      name: error.name
    };
    console.error(message, sanitizedError);
  }
};

export async function syncPendingChanges() {
  if (syncInProgress) {
    secureLog('Sync already in progress');
    return;
  }

  if (!isOnline) {
    secureLog('Device is offline');
    return;
  }

  try {
    syncInProgress = true;
    const pendingItems = await getPendingSyncItems();
    const firestore = getFirestore();
    let successCount = 0;
    let failureCount = 0;

    for (const item of pendingItems) {
      try {
        // Handle VIT inspections specially
        if (item.type === 'vitInspections') {
          const docRef = doc(firestore, item.type, item.data.id);
          const docSnap = await getDoc(docRef);

          switch (item.action) {
            case 'create':
              if (!docSnap.exists()) {
                await setDoc(docRef, {
                  ...item.data,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  syncStatus: 'synced'
                });
              }
              break;

            case 'update':
              if (docSnap.exists()) {
                await updateDoc(docRef, {
                  ...item.data,
                  updatedAt: serverTimestamp(),
                  syncStatus: 'synced'
                });
              }
              break;

            case 'delete':
              if (docSnap.exists()) {
                await deleteDoc(docRef);
              }
              break;
          }
        } else {
          // Handle other types
          const docRef = doc(firestore, item.type, item.data.id);

          switch (item.action) {
            case 'create':
              await setDoc(docRef, {
                ...item.data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                syncStatus: 'synced'
              });
              break;

            case 'update':
              const docId = item.data.originalOfflineId || item.data.id;
              const updateRef = doc(firestore, item.type, docId);
              await updateDoc(updateRef, {
                ...item.data,
                updatedAt: serverTimestamp(),
                syncStatus: 'synced'
              });
              break;

            case 'delete':
              const deleteId = item.data.originalOfflineId || item.data.id;
              const deleteRef = doc(firestore, item.type, deleteId);
              await deleteDoc(deleteRef);
              break;
          }
        }

        // Remove from pending sync after successful sync
        await clearPendingSyncItem(item);
        successCount++;
      } catch (error) {
        secureErrorLog(`Sync failed for item`, error);
        failureCount++;
        
        // Update sync status to failed without exposing error details
        if (item.data.id) {
          const docRef = doc(firestore, item.type, item.data.id);
          try {
            await updateDoc(docRef, {
              syncStatus: 'failed',
              syncError: 'Operation failed'
            });
          } catch (updateError) {
            secureErrorLog('Failed to update sync status', updateError);
          }
        }
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully synced ${successCount} items`);
    }
    if (failureCount > 0) {
      toast.error(`Failed to sync ${failureCount} items`);
    }

    return { successCount, failureCount };
  } catch (error) {
    secureErrorLog('Sync operation failed', error);
    toast.error('Failed to sync changes');
    return { successCount: 0, failureCount: 0 };
  } finally {
    syncInProgress = false;
  }
}

// Start periodic sync when online
setInterval(() => {
  if (isOnline) {
    syncPendingChanges();
  }
}, 30000); // Check every 30 seconds

export function isAppOnline() {
  return isOnline;
} 