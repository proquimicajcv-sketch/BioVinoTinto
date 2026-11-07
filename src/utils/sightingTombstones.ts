/**
 * Utility to track and enforce permanent deletion of sightings across devices and sessions.
 * Guarantees that once a sighting is explicitly deleted with PIN 5531, its specific ID is
 * remembered so it never resurrects, while allowing ALL new observations to be registered
 * smoothly and synchronize with statistics.
 */

const STORAGE_KEY = 'biobitacora_deleted_sighting_ids_v2';

// Known legacy/demo sightings to purge
const KNOWN_PURGED_IDS = new Set<string>([
  'sight-cascadas-vinotinto-20260828',
  'sight-test-laptop-1',
  'sight-1',
  'sight-2',
  'sight-dota-20261009',
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
          if (id && typeof id === 'string') ids.add(id.trim());
        });
      }
    }
  } catch (e) {
    console.warn('Error reading deleted sightings:', e);
  }
  return ids;
}

export function registerDeletedSighting(idOrSighting: string | { id?: string }): void {
  const deletedSet = getDeletedSightingIds();

  if (typeof idOrSighting === 'string') {
    if (idOrSighting.trim()) {
      deletedSet.add(idOrSighting.trim());
    }
  } else if (idOrSighting && idOrSighting.id) {
    deletedSet.add(idOrSighting.id.trim());
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}
  }
}

export function isSightingDeleted(s: any): boolean {
  if (!s) return true;
  if (!s.id) return false;

  const deletedSet = getDeletedSightingIds();
  return deletedSet.has(String(s.id).trim());
}

export function filterDeletedSightings<T extends any>(sightings: T[] | undefined | null): T[] {
  if (!Array.isArray(sightings)) return [];
  return sightings.filter((s) => !isSightingDeleted(s));
}
