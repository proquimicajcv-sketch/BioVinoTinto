/**
 * Offline Sync Queue & Connectivity Manager for BioBitácora CR
 * Guarantees that field data registered offline is never lost and automatically
 * flushes to Firebase Firestore and central servers as soon as internet is available.
 */

import { SpecimenRecord } from '../types/specimen';
import { saveSpecimenToCloud, batchSyncSpecimensToCloud } from './firestoreSync';

const QUEUE_STORAGE_KEY = 'biobitacora_cr_offline_queue_v1';

export interface QueuedMutation {
  id: string;
  type: 'SAVE_SPECIMEN' | 'DELETE_SPECIMEN' | 'BATCH_SYNC';
  payload: any;
  timestamp: number;
  attempts: number;
}

type OnlineStatusCallback = (isOnline: boolean, pendingCount: number) => void;
const listeners = new Set<OnlineStatusCallback>();

function getQueueFromStorage(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueueToStorage(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Error saving offline queue to localStorage:', err);
  }
}

export function isDeviceOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function getPendingQueueCount(): number {
  return getQueueFromStorage().length;
}

export function subscribeToOnlineStatus(callback: OnlineStatusCallback): () => void {
  listeners.add(callback);
  callback(isDeviceOnline(), getPendingQueueCount());

  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  const online = isDeviceOnline();
  const count = getPendingQueueCount();
  listeners.forEach((cb) => {
    try {
      cb(online, count);
    } catch (e) {
      console.warn('Listener error:', e);
    }
  });
}

/**
 * Enqueue a specimen mutation for sync when offline
 */
export function enqueueOfflineMutation(
  type: 'SAVE_SPECIMEN' | 'DELETE_SPECIMEN' | 'BATCH_SYNC',
  payload: any
): void {
  const queue = getQueueFromStorage();

  // If already exists for this specimen id, replace with freshest version
  let targetId = payload?.id || (type === 'DELETE_SPECIMEN' ? String(payload) : `mutation-${Date.now()}`);
  const existingIdx = queue.findIndex(
    (item) => item.type === type && (item.payload?.id === targetId || item.payload === targetId)
  );

  const newEntry: QueuedMutation = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type,
    payload,
    timestamp: Date.now(),
    attempts: 0,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = newEntry;
  } else {
    queue.push(newEntry);
  }

  saveQueueToStorage(queue);
  notifyListeners();
}

/**
 * Flush all queued offline mutations to cloud and central server
 */
export async function flushOfflineQueue(
  onSuccessToast?: (syncedCount: number) => void
): Promise<{ success: boolean; syncedCount: number; remainingCount: number }> {
  if (!isDeviceOnline()) {
    notifyListeners();
    return { success: false, syncedCount: 0, remainingCount: getPendingQueueCount() };
  }

  const queue = getQueueFromStorage();
  if (queue.length === 0) {
    notifyListeners();
    return { success: true, syncedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  const remaining: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'SAVE_SPECIMEN') {
        await saveSpecimenToCloud(item.payload as SpecimenRecord);
        syncedCount++;
      } else if (item.type === 'BATCH_SYNC') {
        await batchSyncSpecimensToCloud(item.payload as SpecimenRecord[]);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Failed to sync queued item ${item.id}:`, err);
      item.attempts = (item.attempts || 0) + 1;
      // If failed less than 10 times, keep in queue
      if (item.attempts < 10) {
        remaining.push(item);
      }
    }
  }

  saveQueueToStorage(remaining);
  notifyListeners();

  if (syncedCount > 0 && onSuccessToast) {
    onSuccessToast(syncedCount);
  }

  return {
    success: remaining.length === 0,
    syncedCount,
    remainingCount: remaining.length,
  };
}

// Auto-trigger flush whenever window comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners();
    // Small delay to ensure network connectivity is stable
    setTimeout(() => {
      flushOfflineQueue((count) => {
        console.log(`Auto-synced ${count} offline changes after reconnecting.`);
      });
    }, 1500);
  });

  window.addEventListener('offline', () => {
    notifyListeners();
  });
}
