import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Memory cache as fallback for serverless environments
let memorySpecimens: any[] | null = null;
let memoryLastModified: number = Date.now();

export default function handler(req: Request, res: Response) {
  const DB_DIR = path.resolve('data');
  const DB_FILE = path.join(DB_DIR, 'specimens-database.json');

  if (req.method === 'GET') {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.status(200).json({
            success: true,
            data: parsed,
            lastModified: memoryLastModified,
          });
        }
      }
    } catch (err) {
      console.warn('Error reading file in serverless:', err);
    }

    if (memorySpecimens && memorySpecimens.length > 0) {
      return res.status(200).json({
        success: true,
        data: memorySpecimens,
        lastModified: memoryLastModified,
      });
    }

    return res.status(200).json({ success: true, data: null });
  }

function mergeSpecimens(existingList: any[], incomingList: any[]): any[] {
  if (!Array.isArray(existingList) || existingList.length === 0) return incomingList;
  if (!Array.isArray(incomingList) || incomingList.length === 0) return existingList;

  const result: any[] = [...existingList];

  for (const incoming of incomingList) {
    const idx = result.findIndex(
      (e) => (incoming.id && e.id === incoming.id) ||
             (incoming.scientificName && e.scientificName === incoming.scientificName)
    );

    if (idx === -1) {
      result.push(incoming);
    } else {
      const existing = result[idx];

      const existingSightings = Array.isArray(existing.sightings) ? existing.sightings : [];
      const incomingSightings = Array.isArray(incoming.sightings) ? incoming.sightings : [];

      const sightingMap = new Map<string, any>();
      for (const s of existingSightings) {
        if (s && s.id) sightingMap.set(s.id, s);
      }
      for (const s of incomingSightings) {
        if (s && s.id) {
          const old = sightingMap.get(s.id);
          sightingMap.set(s.id, old ? { ...old, ...s } : s);
        }
      }

      const mergedSightings = Array.from(sightingMap.values()).sort((a, b) => {
        const dateA = a.date || a.timestamp || '';
        const dateB = b.date || b.timestamp || '';
        return dateB.localeCompare(dateA);
      });

      const existingPhotos = Array.isArray(existing.additionalPhotos) ? existing.additionalPhotos : [];
      const incomingPhotos = Array.isArray(incoming.additionalPhotos) ? incoming.additionalPhotos : [];
      const photoMap = new Map<string, any>();
      for (const p of existingPhotos) {
        if (p && (p.id || p.label)) photoMap.set(p.id || p.label, p);
      }
      for (const p of incomingPhotos) {
        if (p && (p.id || p.label)) {
          const key = p.id || p.label;
          const old = photoMap.get(key);
          photoMap.set(key, old ? { ...old, ...p } : p);
        }
      }
      const mergedPhotos = Array.from(photoMap.values());

      result[idx] = {
        ...existing,
        ...incoming,
        sightings: mergedSightings,
        additionalPhotos: mergedPhotos,
      };
    }
  }

  return result;
}

  if (req.method === 'POST') {
    try {
      const { specimens, lastModified } = req.body || {};
      if (!Array.isArray(specimens)) {
        return res.status(400).json({ success: false, error: 'Formato inválido' });
      }

      let finalSpecimens = specimens;
      if (fs.existsSync(DB_FILE)) {
        try {
          const content = fs.readFileSync(DB_FILE, 'utf-8');
          const currentData = JSON.parse(content);
          if (Array.isArray(currentData) && currentData.length > 0) {
            finalSpecimens = mergeSpecimens(currentData, specimens);
          }
        } catch {}
      } else if (memorySpecimens && memorySpecimens.length > 0) {
        finalSpecimens = mergeSpecimens(memorySpecimens, specimens);
      }

      memorySpecimens = finalSpecimens;
      memoryLastModified = Number(lastModified) || Date.now();

      try {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(finalSpecimens, null, 2), 'utf-8');
      } catch (e) {
        // May be read-only in some serverless environments, memory cache will serve it
      }

      return res.status(200).json({
        success: true,
        data: finalSpecimens,
        count: finalSpecimens.length,
        lastModified: memoryLastModified,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
