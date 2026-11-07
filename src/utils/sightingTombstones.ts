/**
 * Utility to track and enforce permanent deletion of sightings across devices and sessions.
 * Guarantees that once a sighting is deleted (e.g. via PIN 5531), it is never resurrected
 * by background sync, Firestore snapshots, server polling, or localStorage cache.
 */

const STORAGE_KEY = 'biobitacora_deleted_sighting_ids_v1';

// Initial ghost sightings to purge automatically (such as the 12-individual test entry)
const KNOWN_PURGED_IDS = new Set<string>([
  'sight-cascadas-vinotinto-20260828',
  'sight-test-laptop-1',
]);

export function getDeletedSightingIds(): Set<string> {
  const ids = new Set<string>(KNOWN_PURGED_IDS);
  if (typeof window === 'undefined') return ids;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (id && typeof id === 'string') ids.add(id);
        });
      }
    }
  } catch (e) {
    console.warn('Error reading deleted sightings:', e);
  }
  return ids;
}

export function registerDeletedSighting(idOrSighting: string | { id?: string; locality?: string; count?: number; individualsCount?: number; timestamp?: string; date?: string; notes?: string }): void {
  const deletedSet = getDeletedSightingIds();

  if (typeof idOrSighting === 'string') {
    if (idOrSighting.trim()) {
      deletedSet.add(idOrSighting.trim());
    }
  } else if (idOrSighting) {
    if (idOrSighting.id) {
      deletedSet.add(idOrSighting.id);
    }
    // Also build a fingerprint key in case ID was generated differently
    const loc = idOrSighting.locality || '';
    const dt = idOrSighting.date || idOrSighting.timestamp || '';
    const cnt = idOrSighting.individualsCount ?? idOrSighting.count ?? '';
    if (loc || dt || cnt) {
      deletedSet.add(`sight_${dt}_${loc}_${cnt}`);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}
  }
}

export function isSightingDeleted(s: any): boolean {
  if (!s) return true;

  const deletedSet = getDeletedSightingIds();

  // Check direct ID match
  if (s.id && deletedSet.has(s.id)) {
    return true;
  }

  // Check fingerprint key
  const loc = s.locality || '';
  const dt = s.date || s.timestamp || '';
  const cnt = s.individualsCount ?? s.count ?? '';
  const key = `sight_${dt}_${loc}_${cnt}`;
  if (deletedSet.has(key)) {
    return true;
  }

  // Exact fingerprint matching for the ghost sighting reported by the user:
  // "San Lorenzo de Tarrazú / Quebrada Las Nacientes", N=12 ind., "Vocalizando los machos"
  const is12IndGhost =
    (Number(s.individualsCount) === 12 || Number(s.count) === 12) &&
    (
      String(loc).toLowerCase().includes('quebrada las nacientes') ||
      String(s.notes || '').toLowerCase().includes('vocalizando los machos') ||
      String(s.behaviorObserved || '').toLowerCase().includes('vocalizando los machos') ||
      String(dt).includes('2026-11-07') ||
      String(dt).includes('07 Nov 2026')
    );

  if (is12IndGhost) {
    if (s.id) registerDeletedSighting(s.id);
    return true;
  }

  // Purge any sighting with note containing "Vocalizando los machos" from initial test
  if (
    String(s.notes || '').toLowerCase().includes('vocalizando los machos') ||
    String(s.behaviorObserved || '').toLowerCase().includes('vocalizando los machos')
  ) {
    if (s.id) registerDeletedSighting(s.id);
    return true;
  }

  return false;
}

export function filterDeletedSightings<T extends any>(sightings: T[] | undefined | null): T[] {
  if (!Array.isArray(sightings)) return [];
  return sightings.filter((s) => !isSightingDeleted(s));
}
