import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SpecimenRecord } from '../types/specimen';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  timestamp: string;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString(),
  };
  console.warn('Firestore Operation Status:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Test server-side Firestore connection on initialization
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'specimens', 'ping'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline o sin conectividad directa:', error.message);
      return false;
    }
    // Any permission or missing doc response confirms reachability
    return true;
  }
}

/**
 * Real-time subscription to specimens collection
 * Automatically notifies callback whenever iPad, mobile, or laptop makes changes
 */
export function subscribeToSpecimens(
  onUpdate: (specimens: SpecimenRecord[]) => void,
  onStatusChange?: (status: 'connected' | 'syncing' | 'offline' | 'error') => void
): () => void {
  const specimensCol = collection(db, 'specimens');

  onStatusChange?.('syncing');

  const unsubscribe = onSnapshot(
    specimensCol,
    (snapshot) => {
      onStatusChange?.('connected');
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const list: SpecimenRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.scientificName) {
          list.push({
            ...(data as SpecimenRecord),
            id: docSnap.id,
          });
        }
      });

      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'specimens');
      onStatusChange?.('offline');
    }
  );

  return unsubscribe;
}

/**
 * Save or update single specimen in cloud database
 */
export async function saveSpecimenToCloud(specimen: SpecimenRecord): Promise<void> {
  const path = `specimens/${specimen.id}`;
  try {
    const docRef = doc(db, 'specimens', specimen.id);
    // Sanitize undefined fields which Firestore rejects
    const cleanData = JSON.parse(JSON.stringify(specimen));
    cleanData.updatedAt = new Date().toISOString();
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete specimen from cloud database
 */
export async function deleteSpecimenFromCloud(specimenId: string): Promise<void> {
  const path = `specimens/${specimenId}`;
  try {
    const docRef = doc(db, 'specimens', specimenId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Seed or batch upload multiple specimens to cloud
 */
export async function batchSyncSpecimensToCloud(specimens: SpecimenRecord[]): Promise<void> {
  if (!Array.isArray(specimens) || specimens.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const s of specimens) {
      if (s && s.id) {
        const ref = doc(db, 'specimens', s.id);
        const clean = JSON.parse(JSON.stringify(s));
        clean.updatedAt = new Date().toISOString();
        batch.set(ref, clean, { merge: true });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'specimens/batch');
    // Fallback: save one by one
    for (const s of specimens) {
      try {
        await saveSpecimenToCloud(s);
      } catch {}
    }
  }
}
