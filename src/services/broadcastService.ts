import { collection, doc, getDocs, getFirestore, onSnapshot, query, setDoc, updateDoc, where, addDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export interface BroadcastMessage {
  id?: string;
  title: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string; // YouTube or Vimeo embed link
  createdAt: Timestamp | Date;
  active: boolean;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  targetRoles?: string[];
  targetRegions?: string[];
}

const COLLECTION = 'broadcastMessages';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) clean[k] = v;
  });
  return clean as T;
}

export const broadcastService = {
  async create(message: Omit<BroadcastMessage, 'id' | 'createdAt'>) {
    const db = getFirestore();
    // Firestore does not accept undefined field values
    const data = stripUndefined({
      ...message,
      createdAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, COLLECTION), data);
    // Optionally mark as active and ensure only one active
    if (message.active) {
      await this.setActive(ref.id);
    }
    return ref.id;
  },

  async update(id: string, updates: Partial<BroadcastMessage>) {
    const db = getFirestore();
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, stripUndefined(updates));
    if (updates.active) {
      await this.setActive(id);
    }
  },

  async remove(id: string) {
    const db = getFirestore();
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async setActive(id: string) {
    const db = getFirestore();
    // Deactivate all others
    const snapshot = await getDocs(collection(db, COLLECTION));
    const batchUpdates: Promise<any>[] = [];
    snapshot.forEach(d => {
      if (d.id === id) {
        batchUpdates.push(updateDoc(d.ref, { active: true }));
      } else if (d.data().active === true) {
        batchUpdates.push(updateDoc(d.ref, { active: false }));
      }
    });
    await Promise.all(batchUpdates);
  },

  async deactivate(id: string) {
    const db = getFirestore();
    await updateDoc(doc(db, COLLECTION, id), { active: false } as any);
  },

  async getActive(): Promise<BroadcastMessage | null> {
    const db = getFirestore();
    const q = query(collection(db, COLLECTION), where('active', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as any) } as BroadcastMessage;
  },

  subscribeActive(cb: (msg: BroadcastMessage | null) => void) {
    const db = getFirestore();
    const q = query(collection(db, COLLECTION), where('active', '==', true));
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        cb(null);
        return;
      }
      const d = snap.docs[0];
      cb({ id: d.id, ...(d.data() as any) } as BroadcastMessage);
    });
  },

  async list(): Promise<BroadcastMessage[]> {
    const db = getFirestore();
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as BroadcastMessage));
  },

  hasSeenLocal(messageId: string, userId?: string) {
    const key = this.seenKey(messageId, userId);
    return localStorage.getItem(key) === '1';
  },

  markSeenLocal(messageId: string, userId?: string) {
    const key = this.seenKey(messageId, userId);
    localStorage.setItem(key, '1');
  },

  async markSeenRemote(messageId: string) {
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const db = getFirestore();
      const ref = doc(db, `users/${uid}/seenBroadcasts/${messageId}`);
      await setDoc(ref, { seenAt: serverTimestamp() });
    } catch (_) {
      // swallow
    }
  },

  seenKey(messageId: string, userId?: string) {
    const uid = userId || getAuth().currentUser?.uid || 'anon';
    return `broadcast_seen_${messageId}_${uid}`;
  }
};


