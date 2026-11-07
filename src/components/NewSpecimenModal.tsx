import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { SpecimenRecord, TaxonGroup, BioacousticRecord, PhotoRecord, SightingEntry } from '../types/specimen';
import { CostaRicaMap } from './CostaRicaMap';
import {
  COSTA_RICA_HOTSPOTS,
  HOLDRIDGE_LIFE_ZONES_CR,
  estimateHoldridgeZone,
  formatCoordinatesDMS,
  findNearestHotspot,
  detectLocationAndLifeZone,
} from '../data/costaRicaData';
import { saveImageOfflineAndServer, getTaxonFallbackImage } from '../utils/offlineImageCache';
import { captureDeviceGps } from '../utils/deviceGps';
import { registerDeletedSighting } from '../utils/sightingTombstones';

interface NewSpecimenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (specimen: SpecimenRecord) => void;
  onDelete?: (id: string) => void;
  initialCoords?: { lat: number; lng: number; locality?: string; lifeZone?: string };
  editingSpecimen?: SpecimenRecord | null;
  defaultCollector?: string;
}

const SAMPLE_FIELD_IMAGES = [
  {
    name: 'Rana de las Nacientes (Los Santos)',
    url: '/isthmohyla_nacientes.jpg',
  },
  {
    name: 'Rana Ojos Rojos (Sarapiquí)',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvI7_6fTqgfYbPLKbGn0dFeW7hmnuRolqzd7Q_i2tcUFhIQO5UPw2MQBrfoR_PjDM-c7sqT6CdtQVsyoIP_fnDU9RXrw8NvRVtpA7JOiYHRcmwErrYso4uiDIH7IO1HdniMZq4nm1LM36RywajGzBnMXJI6ZBv8MEGSO_anGlnFjpGLL2LtKkDeBkJ6bAZ8qKDSvDv2NczPj54ygoDcje8UU6V8oi7EG7ddl-wRYqrXNZecg1XCf3y',
  },
  {
    name: 'Ranita Blue Jeans (La Selva)',
    url: 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Quetzal (Talamanca)',
    url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Mariposa Morfo (Monteverde)',
    url: 'https://images.unsplash.com/photo-1551085254-e96b210df58a?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Terciopelo (Caribe)',
    url: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Danta / Tapir (Corcovado)',
    url: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1000&q=80',
  },
];

export const NewSpecimenModal: React.FC<NewSpecimenModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCoords,
  editingSpecimen,
  defaultCollector,
}) => {
  if (!isOpen) return null;

  // Online / Offline GPS Mode State
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(true);

  // Initial Coordinates
  const defaultLat = initialCoords?.lat || editingSpecimen?.georeference.latitude || 10.4304;
  const defaultLng = initialCoords?.lng || editingSpecimen?.georeference.longitude || -84.0095;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [locality, setLocality] = useState(
    initialCoords?.locality || editingSpecimen?.georeference.locality || 'Estación Biológica La Selva, Sarapiquí'
  );
  const [province, setProvince] = useState(
    editingSpecimen?.georeference.province || 'Heredia, Costa Rica'
  );
  const [elevation, setElevation] = useState<number>(
    editingSpecimen?.georeference.elevationMeters || 68
  );
  const [lifeZone, setLifeZone] = useState(
    initialCoords?.lifeZone ||
      editingSpecimen?.georeference.lifeZone ||
      'Bosque Muy Húmedo Tropical (bmh-T)'
  );
  const [microhabitat, setMicrohabitat] = useState(
    editingSpecimen?.georeference.microhabitat || 'Estrato arbustivo / Arroyo de aguas lénticas'
  );

  // Ubicación & Modo de selección (Mapa automático vs Entrada manual)
  const [locationTab, setLocationTab] = useState<'map' | 'manual'>('map');
  const [autoLocationDetectedMsg, setAutoLocationDetectedMsg] = useState<string | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [gpsSourceUsed, setGpsSourceUsed] = useState<'DEVICE_GPS' | 'MAP_SELECTION' | 'MANUAL_COORDS'>('MAP_SELECTION');

  const handleCaptureDeviceLocation = async () => {
    setIsCapturingGps(true);
    setGpsErrorMsg(null);
    try {
      const res = await captureDeviceGps();
      setCoords({ lat: res.latitude, lng: res.longitude });
      setElevation(res.altitudeMeters);
      setLocality(res.locality);
      setProvince(res.province);
      setLifeZone(res.lifeZone);
      setGpsAccuracy(res.accuracyMeters);
      setGpsSourceUsed('DEVICE_GPS');
      setAutoLocationDetectedMsg(
        `📡 Coordenadas capturadas del sensor GPS de este dispositivo: ${res.combinedDMS} (Precisión: ±${res.accuracyMeters} m, Altitud: ${res.altitudeMeters} msnm) • ${res.locality}`
      );
      setTimeout(() => setAutoLocationDetectedMsg(null), 8000);
    } catch (err: any) {
      setGpsErrorMsg(err.message || 'Error al obtener GPS del dispositivo');
      setTimeout(() => setGpsErrorMsg(null), 6000);
    } finally {
      setIsCapturingGps(false);
    }
  };

  // Scientific taxonomy form state
  const [scientificName, setScientificName] = useState(
    editingSpecimen?.scientificName || ''
  );
  const [commonName, setCommonName] = useState(
    editingSpecimen?.commonName || ''
  );
  const [taxonGroup, setTaxonGroup] = useState<TaxonGroup>(
    editingSpecimen?.taxonGroup || 'Amphibia'
  );
  const [genus, setGenus] = useState(editingSpecimen?.taxonomy.genus || '');
  const [family, setFamily] = useState(editingSpecimen?.taxonomy.family || '');
  const [collector, setCollector] = useState(
    editingSpecimen?.collector || defaultCollector || 'Ing. Carvajal V.'
  );
  const [heroImage, setHeroImage] = useState(
    editingSpecimen?.heroImage || ''
  );
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [lhcMm, setLhcMm] = useState<number>(
    editingSpecimen?.morphometrics.snoutVentLengthMm || 0
  );

  // Deep Scientific Fields Requested by User
  const [colorationNotes, setColorationNotes] = useState(
    editingSpecimen?.morphometrics.colorationAndAnatomy || ''
  );
  const [ethologyNotes, setEthologyNotes] = useState(
    editingSpecimen?.morphometrics.ethologyAndReproduction || ''
  );
  const [courtshipNotes, setCourtshipNotes] = useState(
    editingSpecimen?.morphometrics.courtshipAndMating || ''
  );
  const [interspecificNotes, setInterspecificNotes] = useState(
    editingSpecimen?.morphometrics.interspecificRelations || ''
  );
  const [confirmedScienceNotes, setConfirmedScienceNotes] = useState(
    editingSpecimen?.morphometrics.confirmedScientificData || ''
  );
  const [initialLifeStage, setInitialLifeStage] = useState<string>('ADULTO');

  // BIOACOUSTICS MANAGEMENT
  const [hasBioacoustics, setHasBioacoustics] = useState<boolean>(
    editingSpecimen ? !!editingSpecimen.bioacoustics : false
  );
  const [audioTitle, setAudioTitle] = useState(
    editingSpecimen?.bioacoustics?.title || 'Canto de Anuncio'
  );
  const [audioCallType, setAudioCallType] = useState(
    editingSpecimen?.bioacoustics?.callType || 'Vocalización Territorial / Canto'
  );
  const [audioFrequency, setAudioFrequency] = useState(
    editingSpecimen?.bioacoustics?.dominantFrequencyRange || '1.8 - 2.4 kHz'
  );
  const [audioPattern, setAudioPattern] = useState(
    editingSpecimen?.bioacoustics?.audioPatternDescription || '"Chack-chack" gutural monotonal'
  );
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(
    editingSpecimen?.bioacoustics?.audioDataUrl || null
  );

  // Live recording in form
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micIntervalRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Additional Photos by URL & Local Capture
  const [additionalPhotosList, setAdditionalPhotosList] = useState<PhotoRecord[]>(
    editingSpecimen?.additionalPhotos || [
      {
        id: 'p1',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmGUVTb0cZNrQIy7d2kzAqkjo8reoJH1-m7Jq1KGQViK-JC4o4iBAgurcuMq32V-vTc_Tkm78xKpt_mBTogei0s7FFYCFaWYqs6URyffV2JUPVqp5EKLtRssA_cFs7gAn9UVpmWNnc2KlDkfxv-MF0jCFqXgfwKwt2GsYbhVuOuE9i0rTCa1a9JNYOxgjjbUHiEU9KMNZ0pRDAe7RB90yjf9U8diZY8agcW98GU6r_61NmLaCpSiAP',
        label: 'Ojo / Membrana',
        description: 'Detalle de la membrana nictitante dorada.',
      },
    ]
  );
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoLabel, setNewPhotoLabel] = useState('');
  const [newPhotoDesc, setNewPhotoDesc] = useState('');

  // Sightings / Entradas de Vistas (inicia en 0 para nuevas especies)
  const [sightingsList, setSightingsList] = useState<SightingEntry[]>(
    editingSpecimen?.sightings || []
  );
  const [newSightingLocality, setNewSightingLocality] = useState('');
  const [newSightingCount, setNewSightingCount] = useState(1);
  const [newSightingDate, setNewSightingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSightingTime, setNewSightingTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [newSightingBehavior, setNewSightingBehavior] = useState('');
  const [newSightingNotes, setNewSightingNotes] = useState('');
  const [showAddSighting, setShowAddSighting] = useState(false);
  const [editingSightingId, setEditingSightingId] = useState<string | null>(null);

  const [collectionDate, setCollectionDate] = useState<string>(
    editingSpecimen?.collectionDate || new Date().toISOString().slice(0, 10)
  );
  const [collectionTime, setCollectionTime] = useState<string>(
    editingSpecimen?.collectionTime ||
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
  );

  // Delete confirmation modal state
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  // Control de seguridad por clave para editar/eliminar avistamientos existentes
  const [sightingPinPrompt, setSightingPinPrompt] = useState<{
    action: 'delete' | 'edit';
    sighting: SightingEntry;
  } | null>(null);
  const [sightingEnteredPin, setSightingEnteredPin] = useState('');
  const [sightingPinError, setSightingPinError] = useState<string | null>(null);

  // Synchronize modal state whenever opened with an existing specimen or new coords
  useEffect(() => {
    if (isOpen) {
      if (editingSpecimen) {
        setCoords({
          lat: editingSpecimen.georeference.latitude,
          lng: editingSpecimen.georeference.longitude,
        });
        setLocality(editingSpecimen.georeference.locality);
        setProvince(editingSpecimen.georeference.province);
        setElevation(editingSpecimen.georeference.elevationMeters);
        setLifeZone(editingSpecimen.georeference.lifeZone);
        setMicrohabitat(editingSpecimen.georeference.microhabitat);
        setScientificName(editingSpecimen.scientificName);
        setCommonName(editingSpecimen.commonName);
        setTaxonGroup(editingSpecimen.taxonGroup);
        setGenus(editingSpecimen.taxonomy.genus);
        setFamily(editingSpecimen.taxonomy.family);
        setCollector(editingSpecimen.collector);
        setCollectionDate(editingSpecimen.collectionDate || new Date().toISOString().slice(0, 10));
        setCollectionTime(
          editingSpecimen.collectionTime ||
            `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
        );
        setHeroImage(editingSpecimen.heroImage);
        setUploadedBase64(null);
        setLhcMm(editingSpecimen.morphometrics.snoutVentLengthMm || 50.0);
        setColorationNotes(editingSpecimen.morphometrics.colorationAndAnatomy || '');
        setEthologyNotes(editingSpecimen.morphometrics.ethologyAndReproduction || '');
        setCourtshipNotes(editingSpecimen.morphometrics.courtshipAndMating || '');
        setInterspecificNotes(editingSpecimen.morphometrics.interspecificRelations || '');
        setConfirmedScienceNotes(editingSpecimen.morphometrics.confirmedScientificData || '');
        const isMuteGroup = editingSpecimen.taxonGroup === 'Reptilia' || editingSpecimen.taxonGroup === 'Plantae';
        setHasBioacoustics(isMuteGroup ? false : !!editingSpecimen.bioacoustics);
        setAudioTitle(editingSpecimen.bioacoustics?.title || 'Canto de Anuncio');
        setAudioCallType(editingSpecimen.bioacoustics?.callType || 'Vocalización Territorial');
        setAudioFrequency(editingSpecimen.bioacoustics?.dominantFrequencyRange || '1.8 - 2.4 kHz');
        setAudioPattern(editingSpecimen.bioacoustics?.audioPatternDescription || '');
        setAudioDataUrl(editingSpecimen.bioacoustics?.audioDataUrl || null);
        setAdditionalPhotosList(editingSpecimen.additionalPhotos || []);
        setSightingsList(editingSpecimen.sightings || []);
        setShowAddSighting(false);
        setEditingSightingId(null);
      } else {
        // Reset to clean state for a new specimen registration
        const defaultCoords = initialCoords
          ? { lat: initialCoords.lat, lng: initialCoords.lng }
          : { lat: 9.6608, lng: -84.0205 }; // Default Zona de los Santos / Dota
        setCoords(defaultCoords);
        const locInfo = detectLocationAndLifeZone(defaultCoords.lat, defaultCoords.lng);
        setLocality(initialCoords?.locality || locInfo.locality);
        setProvince(locInfo.province);
        setElevation(locInfo.elevation);
        setLifeZone(initialCoords?.lifeZone || locInfo.lifeZone);
        setMicrohabitat('Vegetación riparia y ramas caídas');
        setScientificName('');
        setCommonName('');
        setTaxonGroup('Amphibia');
        setGenus('');
        setFamily('');
        setCollector(defaultCollector || 'Ing. Carvajal V.');
        setCollectionDate(new Date().toISOString().slice(0, 10));
        setCollectionTime(
          `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
        );
        setHeroImage('');
        setUploadedBase64(null);
        setLhcMm(0);
        setColorationNotes('');
        setEthologyNotes('');
        setCourtshipNotes('');
        setInterspecificNotes('');
        setConfirmedScienceNotes('');
        setHasBioacoustics(false);
        setAudioTitle('Canto de Anuncio');
        setAudioCallType('Vocalización Territorial');
        setAudioFrequency('2.0 - 3.0 kHz');
        setAudioPattern('');
        setAudioDataUrl(null);
        setAdditionalPhotosList([]);
        setSightingsList([]);
        setShowAddSighting(false);
        setEditingSightingId(null);
      }
    }
  }, [isOpen, editingSpecimen, initialCoords]);

  // Coords change handler from the interactive map
  const handleCoordsChange = (newCoords: { lat: number; lng: number; dms: string }) => {
    setCoords({ lat: newCoords.lat, lng: newCoords.lng });
    const detected = detectLocationAndLifeZone(newCoords.lat, newCoords.lng);
    setLocality(detected.locality);
    setProvince(detected.province);
    setElevation(detected.elevation);
    setLifeZone(detected.lifeZone);

    setAutoLocationDetectedMsg(`📍 Ubicación leída automáticamente del mapa: ${detected.locality} (${detected.province}) • Zona de Vida Holdridge: ${detected.lifeZone}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 6000);
  };

  // Handler to apply manual coordinates to map and estimate Holdridge
  const handleApplyManualCoordsToMapAndHoldridge = () => {
    const detected = detectLocationAndLifeZone(coords.lat, coords.lng, elevation);
    setLifeZone(detected.lifeZone);
    if (!locality || locality === 'Estación Biológica La Selva, Sarapiquí') {
      setLocality(detected.locality);
      setProvince(detected.province);
    }
    setAutoLocationDetectedMsg(`✅ Coordenadas manuales aplicadas • Ubicación: ${detected.locality} • Zona de Vida: ${detected.lifeZone}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 5000);
  };

  // Auto-detect Holdridge based on current coords & elevation
  const handleAutoDetectHoldridge = () => {
    const predicted = estimateHoldridgeZone(elevation, coords.lat, coords.lng);
    setLifeZone(predicted.name);
    setAutoLocationDetectedMsg(`🌿 Zona de Vida de Holdridge actualizada: ${predicted.name}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 3500);
  };

  // File Upload Handler (camera / gallery)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setUploadedBase64(result);
      setHeroImage(result);

      // Guardar de inmediato en el servidor y caché offline para que sea visible en todos los dispositivos
      try {
        const permanentUrl = await saveImageOfflineAndServer(file, 'especie_nueva');
        setHeroImage(permanentUrl);
      } catch (err) {
        console.warn('Servidor offline o subiendo en segundo plano:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Audio Upload Handler
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAudioDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Live Mic Recording
  const startRecordingMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioDataUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingMic(true);
      setMicSeconds(0);

      micIntervalRef.current = setInterval(() => {
        setMicSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('No se pudo acceder al micrófono. Por favor verifique los permisos de audio.');
    }
  };

  const stopRecordingMic = () => {
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
    }
  };



  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleUploadCustomPhotoFromFile = async (file: File) => {
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const cleanPrefix = (newPhotoLabel.trim() || 'galeria').replace(/[^a-zA-Z0-9_-]/g, '_');
      const permanentUrl = await saveImageOfflineAndServer(file, cleanPrefix);
      const newEntry: PhotoRecord = {
        id: `photo-${Date.now()}`,
        url: permanentUrl,
        label: newPhotoLabel.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Vista adicional',
        description: newPhotoDesc.trim() || 'Fotografía de campo capturada/subida desde el dispositivo.',
      };
      setAdditionalPhotosList((prev) => [...prev, newEntry]);
      setNewPhotoUrl('');
      setNewPhotoLabel('');
      setNewPhotoDesc('');
    } catch (err: any) {
      alert('Error al subir la fotografía: ' + (err?.message || err));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddCustomPhoto = async () => {
    if (!newPhotoUrl.trim()) return;
    setIsUploadingPhoto(true);
    try {
      let finalPhotoUrl = newPhotoUrl.trim();
      if (finalPhotoUrl.startsWith('http://') || finalPhotoUrl.startsWith('https://')) {
        try {
          const resp = await fetch('/api/cache-remote-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: finalPhotoUrl,
              prefix: (newPhotoLabel || 'foto').replace(/\s+/g, '_'),
            }),
          });
          const data = await resp.json();
          if (data.success && data.localUrl) {
            finalPhotoUrl = data.localUrl;
          }
        } catch {}
      }
      const newEntry: PhotoRecord = {
        id: `photo-${Date.now()}`,
        url: finalPhotoUrl,
        label: newPhotoLabel.trim() || 'Vista adicional',
        description: newPhotoDesc.trim() || 'Fotografía de campo agregada por URL.',
      };
      setAdditionalPhotosList((prev) => [...prev, newEntry]);
      setNewPhotoUrl('');
      setNewPhotoLabel('');
      setNewPhotoDesc('');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemoveCustomPhoto = (id: string) => {
    setAdditionalPhotosList(additionalPhotosList.filter((p) => p.id !== id));
  };

  const handleAddSighting = () => {
    const dateFormatted = newSightingDate || new Date().toISOString().slice(0, 10);
    const timeFormatted = newSightingTime ? `${newSightingTime} CST` : '';
    const timestampFormatted = `${dateFormatted}${timeFormatted ? ` • ${timeFormatted}` : ''}`;

    const sightingPayload: SightingEntry = {
      id: editingSightingId || `sight-${Date.now()}`,
      timestamp: timestampFormatted,
      date: dateFormatted,
      observer: collector || 'Investigador de Campo',
      locality: newSightingLocality.trim() || locality,
      count: newSightingCount > 0 ? newSightingCount : 1,
      behaviorObserved: newSightingBehavior.trim() || 'Observación registrada en campo.',
      microhabitat: microhabitat,
      notes: newSightingNotes.trim() || undefined,
    };

    let updated: SightingEntry[] = [];
    if (editingSightingId) {
      updated = sightingsList.map((s) => (s.id === editingSightingId ? sightingPayload : s));
    } else {
      updated = [sightingPayload, ...sightingsList];
    }
    updated.sort((a, b) => (b.date || b.timestamp || '').localeCompare(a.date || a.timestamp || ''));

    setSightingsList(updated);
    setNewSightingLocality('');
    setNewSightingBehavior('');
    setNewSightingNotes('');
    setEditingSightingId(null);
    setShowAddSighting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalHero = (heroImage || '').trim();
    if (!finalHero) {
      finalHero = getTaxonFallbackImage(taxonGroup, scientificName);
    } else if (finalHero.startsWith('http://') || finalHero.startsWith('https://')) {
      try {
        const resp = await fetch('/api/cache-remote-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: finalHero,
            prefix: (scientificName || taxonGroup || 'especie').replace(/\s+/g, '_'),
          }),
        });
        const data = await resp.json();
        if (data.success && data.localUrl) {
          finalHero = data.localUrl;
        }
      } catch (err) {
        console.warn('Error cacheando imagen web:', err);
      }
    } else if (uploadedBase64 && uploadedBase64.startsWith('data:')) {
      try {
        finalHero = await saveImageOfflineAndServer(uploadedBase64, 'especie_nueva');
      } catch (err) {
        console.warn('Fallback al guardar foto offline:', err);
      }
    } else if (heroImage && heroImage.startsWith('data:')) {
      try {
        finalHero = await saveImageOfflineAndServer(heroImage, 'especie_nueva');
      } catch (err) {
        console.warn('Fallback al guardar foto offline:', err);
      }
    }

    const dms = formatCoordinatesDMS(coords.lat, coords.lng);
    const nearest = findNearestHotspot(coords.lat, coords.lng);

    const isMuteTaxon = taxonGroup === 'Reptilia' || taxonGroup === 'Plantae';
    const bioacousticsRecord: BioacousticRecord | undefined = (!isMuteTaxon && hasBioacoustics)
      ? {
          title: audioTitle,
          callType: audioCallType,
          dominantFrequencyRange: audioFrequency,
          durationSeconds: micSeconds > 0 ? micSeconds : 24,
          audioPatternDescription: audioPattern,
          audioDataUrl: audioDataUrl || undefined,
        }
      : undefined;

    const newRecord: SpecimenRecord = {
      id: editingSpecimen?.id || `cr-bio-${Date.now().toString().slice(-4)}`,
      catalogNumber:
        editingSpecimen?.catalogNumber ||
        `CAT. CR-BIO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      scientificName,
      commonName,
      taxonGroup,
      realm: 'Neotropical',
      collector,
      collectionDate:
        collectionDate.trim() ||
        editingSpecimen?.collectionDate ||
        new Date().toLocaleDateString('es-CR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      collectionTime:
        collectionTime.trim() ||
        editingSpecimen?.collectionTime ||
        `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')} CST`,
      institutionCode: 'UCR-MZ',
      curationStatus: 'Verificada',
      darwinCoreSync: true,
      fieldFolio: editingSpecimen?.fieldFolio || `Ficha Folio #${Math.floor(10 + Math.random() * 90)}`,

      iucnStatus: editingSpecimen?.iucnStatus || {
        code: 'LC',
        label: 'Preocupación Menor',
        trend: 'Población Estable',
      },
      citesStatus: editingSpecimen?.citesStatus || {
        appendix: 'Apéndice II',
        distribution: 'Nativa Mesoamericana',
      },

      taxonomy: {
        kingdom: taxonGroup === 'Plantae' ? 'Plantae' : 'Animalia',
        phylum: taxonGroup === 'Plantae' ? 'Tracheophyta' : taxonGroup === 'Insecta' ? 'Arthropoda' : 'Chordata',
        class: taxonGroup,
        order:
          taxonGroup === 'Reptilia'
            ? 'Squamata'
            : taxonGroup === 'Aves'
            ? 'Passeriformes'
            : taxonGroup === 'Mammalia'
            ? 'Carnivora'
            : taxonGroup === 'Insecta'
            ? 'Lepidoptera'
            : taxonGroup === 'Plantae'
            ? 'Polypodiales'
            : 'Anura',
        family,
        genus,
        species: scientificName.split(' ')[1] || 'sp.',
        taxonId: editingSpecimen?.taxonomy.taxonId || '8408',
      },

      heroImage: finalHero,
      heroImageDescription: `Espécimen de campo de ${scientificName} registrado en ${locality}.`,
      bioacoustics: bioacousticsRecord,

      georeference: {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDMS: dms.latDMS,
        longitudeDMS: dms.lngDMS,
        datum: 'WGS84',
        accuracyMeters: isOnlineMode ? 3.2 : 12.0,
        elevationMeters: elevation,
        locality,
        province,
        conservationArea: nearest.conservationArea,
        lifeZone,
        microhabitat,
      },

      morphometrics: {
        snoutVentLengthMm: Number(lhcMm) || 58.0,
        colorationAndAnatomy: colorationNotes,
        ethologyAndReproduction: ethologyNotes,
        courtshipAndMating: courtshipNotes,
        interspecificRelations: interspecificNotes,
        confirmedScientificData: confirmedScienceNotes,
        sympatricSpecies: [],
      },

      additionalPhotos: additionalPhotosList,
      sightings: editingSpecimen ? (sightingsList || []) : [],
    };

    try {
      if (collector.trim()) {
        localStorage.setItem('biobitacora_cr_observer_name', collector.trim());
      }
    } catch {}

    onSave(newRecord);
    onClose();
  };

  const coordsDMS = formatCoordinatesDMS(coords.lat, coords.lng);

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-3xl bg-[#f8faf4] rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#002217] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6cf8bb] text-[24px]">edit_note</span>
            <div>
              <h2 className="font-bold text-[17px] leading-tight">
                {editingSpecimen ? 'Editar Ficha de Especie' : 'Agregar Especie Posible / Candidata'}
              </h2>
              <p className="text-[11px] text-[#79a28f] font-mono">
                {editingSpecimen ? 'BioBitácora CR • Modificar Ficha' : 'Inicia con 0 avistamientos • Tú y el equipo registrarán avistamientos en campo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* FOTOGRAFÍA PRINCIPAL DEL ESPÉCIMEN */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">add_a_photo</span>
                Fotografía Principal de Campo
              </label>
              {heroImage && (
                <span className="text-[11px] font-mono text-[#006c49] font-bold bg-[#6cf8bb]/20 px-2.5 py-0.5 rounded-full border border-[#006c49]/20">
                  Fotografía cargada
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-48 h-36 rounded-xl bg-[#031d14] overflow-hidden border border-[#c1c8c3] flex-shrink-0 shadow-inner group flex items-center justify-center">
                {heroImage ? (
                  <>
                    <img
                      src={heroImage}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover blur-sm opacity-35 scale-110 pointer-events-none"
                    />
                    <img
                      src={heroImage}
                      alt="Espécimen preview"
                      referrerPolicy="no-referrer"
                      className="relative z-10 max-w-full max-h-full object-contain p-1.5 drop-shadow-md select-none"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#79a28f] gap-1 p-2 text-center text-xs">
                    <span className="material-symbols-outlined text-3xl">image</span>
                    <span>Sin fotografía</span>
                  </div>
                )}
                {heroImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeroImage('');
                      setUploadedBase64(null);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/90 text-white cursor-pointer transition-colors"
                    title="Quitar fotografía"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5 flex-1 w-full justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-lg bg-[#002217] hover:bg-[#0f382a] text-[#6cf8bb] text-xs font-bold flex items-center gap-1.5 border border-[#6cf8bb]/40 cursor-pointer transition-colors shadow-xs">
                      <span className="material-symbols-outlined text-[18px]">upload_file</span>
                      <span>Subir Fotografía del Dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-[#717974]">o ingresar enlace web:</span>
                  </div>

                  <input
                    type="url"
                    value={heroImage}
                    onChange={(e) => {
                      setHeroImage(e.target.value);
                      setUploadedBase64(null);
                    }}
                    placeholder="https://ejemplo.com/fotografia.jpg"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                  />
                </div>

                {/* Fotografías de muestra en Costa Rica */}
                <div className="flex flex-col gap-1 pt-1.5 border-t border-[#e1e3dd]">
                  <span className="text-[11px] font-mono text-[#414844]">
                    O selecciona una fotografía de muestra de campo:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {SAMPLE_FIELD_IMAGES.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setHeroImage(sample.url);
                          setUploadedBase64(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                          heroImage === sample.url
                            ? 'bg-[#002217] text-white border-[#002217]'
                            : 'bg-[#f2f4ee] hover:bg-[#e7e9e3] text-[#191c19] border-[#c1c8c3]/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px] text-[#006c49]">photo</span>
                        <span>{sample.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BIOACÚSTICA */}
          {taxonGroup === 'Reptilia' || taxonGroup === 'Plantae' ? (
            <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
                <span className="material-symbols-outlined text-[22px]">volume_off</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#002217]">
                  Bioacústica No Aplicable ({taxonGroup === 'Reptilia' ? 'Reptil / Serpiente' : 'Flora'})
                </p>
                <p className="text-[11px] text-[#414844]">
                  Este grupo no emite vocalizaciones. No se generará ni visualizará ninguna opción de reproducción de canto para este registro.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[20px]">graphic_eq</span>
                  Registro Bioacústico (Canto / Vocalización)
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHasBioacoustics(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      !hasBioacoustics
                        ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs'
                        : 'bg-white text-[#717974] border-[#c1c8c3]'
                    }`}
                  >
                    ❌ No aplica (Sin canto)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasBioacoustics(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      hasBioacoustics
                        ? 'bg-[#002217] text-[#6cf8bb] border-[#6cf8bb]/60 shadow-2xs'
                        : 'bg-white text-[#717974] border-[#c1c8c3]'
                    }`}
                  >
                    ✅ Sí aplica (Posee canto)
                  </button>
                </div>
              </div>

              {!hasBioacoustics ? (
                <div className="p-3 rounded-xl bg-[#f2f4ee] border border-[#e1e3dd] text-xs text-[#414844] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#717974] text-[18px]">volume_off</span>
                    <span>Bioacústica desactivada (no se agregará sonido ni reproductor).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasBioacoustics(true)}
                    className="text-[#006c49] font-bold hover:underline cursor-pointer text-[11px] whitespace-nowrap"
                  >
                    Activar bioacústica
                  </button>
                </div>
              ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#002217] block">Micrófono en Campo</span>
                      <span className="text-[11px] text-[#414844]">
                        {isRecordingMic ? `Grabando: 00:${String(micSeconds).padStart(2, '0')}` : 'Grabar audio en vivo'}
                      </span>
                    </div>
                    {isRecordingMic ? (
                      <button
                        type="button"
                        onClick={stopRecordingMic}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow active:scale-95 flex items-center gap-1 cursor-pointer animate-pulse"
                      >
                        <span className="material-symbols-outlined text-[16px]">stop</span>
                        <span>Detener</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecordingMic}
                        className="px-3 py-1.5 rounded-lg bg-[#002217] text-white text-xs font-bold shadow active:scale-95 flex items-center gap-1 hover:bg-[#0f382a] cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">mic</span>
                        <span>Grabar</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#002217] block">Subir Archivo</span>
                      <span className="text-[11px] text-[#414844]">
                        {audioDataUrl ? 'Audio cargado con éxito' : 'MP3, WAV o M4A'}
                      </span>
                    </div>
                    <label className="px-3 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-[#002217] text-xs font-bold shadow-sm hover:bg-[#edefe9] flex items-center gap-1 cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] text-[#006c49]">upload_file</span>
                      <span>Subir</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {audioDataUrl && (
                  <div className="p-2.5 rounded-lg bg-[#c1ecd7]/30 border border-[#006c49]/30 flex items-center justify-between text-xs">
                    <span className="text-[#002116] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#006c49]">audio_file</span>
                      Grabación personalizada vinculada
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudioDataUrl(null)}
                      className="text-red-600 font-bold hover:underline"
                    >
                      Remover audio
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          {/* GEORREFERENCIACIÓN Y ZONA DE VIDA (HOLDRIDGE) - MAPA AUTOMÁTICO & ENTRADA MANUAL */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">location_on</span>
                Ubicación Geográfica y Zona de Vida (Holdridge)
              </label>
              <span className="text-[11px] font-mono text-[#006c49] font-bold bg-[#6cf8bb]/20 px-2.5 py-0.5 rounded-full border border-[#006c49]/20">
                Datum WGS84 • Costa Rica
              </span>
            </div>

            {/* Botón de Captura GPS Directa del Dispositivo */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#002217] to-[#0f382a] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-[#6cf8bb]/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 flex items-center justify-center text-[#6cf8bb] flex-shrink-0">
                  <span className={`material-symbols-outlined text-[22px] ${isCapturingGps ? 'animate-spin' : ''}`}>
                    {isCapturingGps ? 'sync' : 'my_location'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-[#6cf8bb] flex items-center gap-1.5">
                    <span>GPS Satelital WGS84 del Dispositivo</span>
                    {gpsAccuracy && (
                      <span className="text-[10px] bg-[#6cf8bb] text-[#002217] px-2 py-0.5 rounded-full font-mono font-extrabold">
                        ±{gpsAccuracy}m
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-[#a5d0bc]">
                    {isCapturingGps
                      ? 'Conectando con satélites GPS en tiempo real...'
                      : gpsSourceUsed === 'DEVICE_GPS'
                      ? 'Coordenadas del sensor de este dispositivo fijadas con éxito.'
                      : 'Captura las coordenadas exactas de campo desde tu celular o laptop.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isCapturingGps}
                onClick={handleCaptureDeviceLocation}
                className="py-2 px-3.5 rounded-xl bg-[#6cf8bb] hover:bg-[#a5d0bc] text-[#002217] text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isCapturingGps ? 'satellite_alt' : 'near_me'}
                </span>
                <span>{isCapturingGps ? 'Obteniendo GPS...' : '📍 Usar GPS de este Dispositivo'}</span>
              </button>
            </div>

            {gpsErrorMsg && (
              <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-red-800 text-xs flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
                <span>{gpsErrorMsg}</span>
              </div>
            )}

            {/* Selector de Modo: Automático por Mapa vs Entrada Manual */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#edefe9] rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLocationTab('map')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  locationTab === 'map'
                    ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                    : 'text-[#414844] hover:text-[#191c19]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">map</span>
                <span>Opción 1: Marcar en el Mapa (Automático)</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationTab('manual')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  locationTab === 'manual'
                    ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                    : 'text-[#414844] hover:text-[#191c19]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">edit_location_alt</span>
                <span>Opción 2: Entrada Manual (Coordenadas y Lugar)</span>
              </button>
            </div>

            {locationTab === 'map' ? (
              <div className="flex flex-col gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#f0f4ee] border border-[#c1ecd7] text-xs text-[#002116] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">touch_app</span>
                    <span className="text-[11px]">
                      <strong>Modo Automático:</strong> Toca o haz clic sobre cualquier punto del mapa de Costa Rica para colocar la marca. El sistema leerá las coordenadas exactas y calculará de forma automática el lugar, altitud y la zona de vida de Holdridge.
                    </span>
                  </div>
                </div>

                {/* Mapa Interactivo */}
                <div className="rounded-xl overflow-hidden border border-[#c1c8c3] h-72 sm:h-80 relative shadow-sm">
                  <CostaRicaMap
                    pickerMode={true}
                    initialCoords={coords}
                    onCoordsChange={handleCoordsChange}
                    isOnlineMode={isOnlineMode}
                  />
                </div>
              </div>
            ) : (
              /* ENTRADA MANUAL DE COORDENADAS Y LUGAR */
              <div className="p-3.5 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-3">
                <div className="p-2.5 rounded-lg bg-[#fff8e1] border border-[#ffe082] text-xs text-[#78350f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#d97706] text-[18px]">edit_note</span>
                  <span>
                    <strong>Modo Manual:</strong> Puedes ingresar las coordenadas en grados decimales y el nombre del sitio. Luego haz clic en "Calcular Zona de Vida" o "Posicionar en el Mapa".
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Latitud (grados decimales N) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={coords.lat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCoords((prev) => ({ ...prev, lat: val }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
                      placeholder="ej. 9.6542"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Longitud (grados decimales W) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={coords.lng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCoords((prev) => ({ ...prev, lng: val }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
                      placeholder="ej. -83.9214"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Localidad / Sitio Específico *
                    </label>
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="Ej: Quebrada Las Nacientes, Santa María de Dota"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Provincia / Región *
                    </label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Ej: San José, Costa Rica"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Altitud aproximada (msnm)
                    </label>
                    <input
                      type="number"
                      value={elevation}
                      onChange={(e) => setElevation(Number(e.target.value) || 0)}
                      placeholder="ej. 1650"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Microhábitat / Estrato y Sustrato
                    </label>
                    <input
                      type="text"
                      value={microhabitat}
                      onChange={(e) => setMicrohabitat(e.target.value)}
                      placeholder="ej. Follaje ribereño a 45 cm del caudal"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                    {/* Botones de Sustrato Rápido */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { label: '🌊 En la quebrada', value: 'En la quebrada / corriente de agua' },
                        { label: '🪨 Sobre una roca', value: 'Sobre una roca húmeda en orilla' },
                        { label: '🌿 Sobre ramas', value: 'Sobre ramas a baja altura (<1 m)' },
                        { label: '🍃 Sobre hojas', value: 'Sobre hojas de vegetación riparia' },
                        { label: '🪵 En tronco caído', value: 'Sobre tronco caído húmedo' },
                        { label: '🌧️ En poza / naciente', value: 'En poza / nacimiento de agua' },
                        { label: '🍂 En hojarasca', value: 'En hojarasca del suelo' },
                      ].map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => setMicrohabitat(sub.value)}
                          className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-all cursor-pointer ${
                            microhabitat === sub.value
                              ? 'bg-[#002217] text-[#6cf8bb] border-[#6cf8bb]/60 shadow-xs'
                              : 'bg-white hover:bg-[#f0f2ec] text-[#414844] border-[#c1c8c3]'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {/* Selector de Estado Biológico / Etapa de Desarrollo */}
                    <div className="mt-3 pt-2 border-t border-[#e1e3dd]">
                      <label className="block text-[11px] font-bold text-[#002217] mb-1 uppercase tracking-wide">
                        Estado Biológico al Avistar:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'HUEVO', label: '🥚 Huevo' },
                          { id: 'RENACUAJO', label: '🐸 Renacuajo' },
                          { id: 'METAMORFO', label: '🔄 Metamorfo' },
                          { id: 'JUVENIL', label: '🌱 Juvenil' },
                          { id: 'ADULTO', label: '👑 Adulto' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setInitialLifeStage(st.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                              initialLifeStage === st.id
                                ? 'bg-[#002217] text-[#6cf8bb] border-[#6cf8bb]/60 shadow-xs font-bold'
                                : 'bg-white hover:bg-[#f0f2ec] text-[#414844] border-[#c1c8c3]'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#e1e3dd]">
                  <button
                    type="button"
                    onClick={handleApplyManualCoordsToMapAndHoldridge}
                    className="py-2 px-3 rounded-lg bg-[#006c49] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">auto_fix_high</span>
                    <span>Calcular Zona de Vida y Lugar con estas Coordenadas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationTab('map')}
                    className="py-2 px-3 rounded-lg bg-white border border-[#c1c8c3] text-[#002217] text-xs font-bold flex items-center gap-1.5 hover:bg-[#f0f2ec] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">pin_drop</span>
                    <span>Ver punto fijado en el mapa</span>
                  </button>
                </div>
              </div>
            )}

            {/* Resumen / Tarjeta de Confirmación de Ubicación y Zona de Vida */}
            <div className="p-3 bg-gradient-to-r from-[#f0f4ee] to-[#e7ece4] rounded-xl border border-[#c1ecd7] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[#006c49] font-bold text-[11px] uppercase">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Coordenadas Geográficas (DMS &amp; Decimal):</span>
                </div>
                <span className="font-bold text-[#002217] text-[13px] font-mono truncate">
                  {coordsDMS.combined}
                </span>
                <span className="text-[11px] text-[#414844] truncate">
                  📍 {locality} • {province} • {elevation} msnm
                </span>
              </div>

              {/* Zona de Vida de Holdridge Selector / Display */}
              <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[280px]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#002217] uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-[#006c49]">forest</span>
                    Zona de Vida Holdridge:
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoDetectHoldridge}
                    className="text-[10px] text-[#006c49] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Calcular automáticamente según coordenadas y altitud"
                  >
                    <span className="material-symbols-outlined text-[12px]">sync</span>
                    <span>Auto-detectar</span>
                  </button>
                </div>

                <select
                  value={lifeZone}
                  onChange={(e) => setLifeZone(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs font-semibold text-[#002217] focus:ring-2 focus:ring-[#006c49] shadow-xs"
                >
                  {HOLDRIDGE_LIFE_ZONES_CR.map((zone) => (
                    <option key={zone.code} value={zone.name}>
                      {zone.code} - {zone.name} ({zone.elevationRange})
                    </option>
                  ))}
                  <option value={lifeZone}>{lifeZone} (Actual)</option>
                </select>
                <span className="text-[10px] text-[#414844] italic truncate">
                  {HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.name === lifeZone)?.typicalRegions || 'Región ecológica de Costa Rica'}
                </span>
              </div>
            </div>

            {autoLocationDetectedMsg && (
              <div className="p-2.5 rounded-xl bg-[#c1ecd7]/40 border border-[#006c49]/40 text-xs text-[#002116] flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-medium">{autoLocationDetectedMsg}</span>
              </div>
            )}
          </div>

          {/* Taxonomy Grid con botones directos de búsqueda rápida con IA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Nombre Científico <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={scientificName}
                onChange={(e) => setScientificName(e.target.value)}
                placeholder="p. ej. Bothriechis schlegelii"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-sm italic font-semibold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Nombre Común / Vernáculo
              </label>
              <input
                type="text"
                value={commonName}
                onChange={(e) => setCommonName(e.target.value)}
                placeholder="p. ej. Víbora de pestañas / Oropel"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-sm text-[#191c19]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Grupo Taxonómico
              </label>
              <select
                value={taxonGroup}
                onChange={(e) => {
                  const newGroup = e.target.value as TaxonGroup;
                  setTaxonGroup(newGroup);
                  if (newGroup === 'Reptilia' || newGroup === 'Plantae' || newGroup === 'Insecta') {
                    setHasBioacoustics(false);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-sm text-[#191c19]"
              >
                <option value="Amphibia">Anfibio (Amphibia)</option>
                <option value="Aves">Ave (Aves)</option>
                <option value="Mammalia">Mamífero (Mammalia)</option>
                <option value="Insecta">Insecto / Artrópodo (Insecta)</option>
                <option value="Reptilia">Reptil / Serpiente (Reptilia)</option>
                <option value="Plantae">Flora (Plantae)</option>
              </select>
            </div>
          </div>

          {/* Temporalidad y Colector del Espécimen (Fecha y Hora de Colecta/Avistamiento) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#f0f4ee] border border-[#d1dcd4]">
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">calendar_today</span>
                Fecha de Colecta *
              </label>
              <input
                type="text"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                placeholder="ej. 2026-10-09 o 15 Febrero 2026"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-medium text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">schedule</span>
                Hora de Colecta
              </label>
              <input
                type="text"
                value={collectionTime}
                onChange={(e) => setCollectionTime(e.target.value)}
                placeholder="ej. 20:15 CST o 06:15 CST"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-medium text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">person</span>
                Nombre del Observador(a) / Colaborador(a) *
              </label>
              <input
                type="text"
                required
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                placeholder="Tu nombre (ej. Carlos Mora, Dra. Gómez...)"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-semibold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
              />
              <span className="text-[10px] text-[#717974] block mt-0.5">
                Tu nombre quedará asociado a este aporte para todos los colaboradores en directo.
              </span>
            </div>
          </div>

          {/* CAMPOS CIENTÍFICOS DETALLADOS */}
          <div className="flex flex-col gap-3.5">
            {/* Anatomía y Cromática */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">biotech</span>
                Cromática y Anatomía del Espécimen
              </label>
              <textarea
                rows={2}
                value={colorationNotes}
                onChange={(e) => setColorationNotes(e.target.value)}
                placeholder="Morfología diagnóstica, patrones de color, escamación/plumaje..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Etología y Comportamiento */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">psychology_alt</span>
                Etología y Comportamiento en Sitio
              </label>
              <textarea
                rows={2}
                value={ethologyNotes}
                onChange={(e) => setEthologyNotes(e.target.value)}
                placeholder="Horario de actividad diurna/nocturna, termorregulación, forrajeo..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Cortejo y Reproducción */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">favorite</span>
                Cortejo, Reproducción y Cuidado Parental
              </label>
              <textarea
                rows={2}
                value={courtshipNotes}
                onChange={(e) => setCourtshipNotes(e.target.value)}
                placeholder="Rituales nupciales, señales de atracción, amplexo/cópula, postura de huevos o gestación..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Relaciones Intra e Interespecíficas */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">group_work</span>
                Relaciones Intra e Interespecíficas (Competencia, Depredación y Defensas)
              </label>
              <textarea
                rows={2}
                value={interspecificNotes}
                onChange={(e) => setInterspecificNotes(e.target.value)}
                placeholder="Territorialidad entre machos, especies simpátricas, principales depredadores en CR y toxinas/defensas..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Datos Científicos Confirmados */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">menu_book</span>
                Datos Importantes de Investigación Científica Confirmada (UCR / OET / SINAC)
              </label>
              <textarea
                rows={2}
                value={confirmedScienceNotes}
                onChange={(e) => setConfirmedScienceNotes(e.target.value)}
                placeholder="Descubrimientos biológicos publicados, citas de estudios en La Selva, Monteverde, Sirena o UCR..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
          </div>

          {/* GALERÍA DE VISTAS Y FOTOGRAFÍAS */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3] flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">photo_library</span>
                Galería de Vistas y Fotografías ({additionalPhotosList.length})
              </label>
              <span className="text-[11px] text-[#006c49] font-mono font-bold bg-[#6cf8bb]/15 px-2 py-0.5 rounded-full border border-[#006c49]/20">
                Sincronización en vivo entre dispositivos
              </span>
            </div>

            {/* List of current additional photos */}
            {additionalPhotosList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {additionalPhotosList.map((photo) => (
                  <div key={photo.id} className="relative rounded-xl overflow-hidden border border-[#c1c8c3] bg-[#00170f] flex flex-col group shadow-2xs">
                    <div className="relative w-full h-24 flex items-center justify-center overflow-hidden">
                      <img src={photo.url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-30" />
                      <img src={photo.url} alt={photo.label} className="relative z-10 max-w-full max-h-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer z-20"
                        title="Eliminar foto"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                    <div className="p-1.5 bg-[#002217] text-white flex flex-col">
                      <span className="font-bold text-[11px] truncate">{photo.label}</span>
                      {photo.description && (
                        <span className="text-[10px] text-[#a5d0bc] truncate">{photo.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario para agregar fotografía: Del Equipo (dispositivo) o por URL */}
            <div className="p-3.5 rounded-xl bg-[#f4f7f2] border border-[#c1c8c3]/80 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e1e3dd] pb-2">
                <span className="text-xs font-bold text-[#002217] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">add_photo_alternate</span>
                  Agregar Nueva Fotografía o Vista de Campo:
                </span>
                {isUploadingPhoto && (
                  <span className="text-xs font-bold text-[#006c49] flex items-center gap-1 animate-pulse">
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    Subiendo y sincronizando foto...
                  </span>
                )}
              </div>

              {/* Botón directo para subir desde equipo / cámara */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="file"
                  id="modal-add-gallery-file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadCustomPhotoFromFile(file);
                    }
                  }}
                />
                <label
                  htmlFor="modal-add-gallery-file"
                  className="px-4 py-2 rounded-xl bg-[#006c49] hover:bg-[#00875a] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>📁 Subir Fotografía desde mi Equipo</span>
                </label>

                <span className="text-[11px] text-[#717974] font-medium text-center sm:text-left">
                  o pega un enlace público de internet abajo:
                </span>
              </div>

              {/* Campos opcionales de URL, Etiqueta y Descripción */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="url"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://... URL pública de la imagen (opcional)"
                  className="px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                />
                <input
                  type="text"
                  value={newPhotoLabel}
                  onChange={(e) => setNewPhotoLabel(e.target.value)}
                  placeholder="Etiqueta / Nombre (ej. Ojo, Flanco, Puesta, Hembra)"
                  className="px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  value={newPhotoDesc}
                  onChange={(e) => setNewPhotoDesc(e.target.value)}
                  placeholder="Descripción científica o notas de la fotografía..."
                  className="flex-1 w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                />
                {newPhotoUrl.trim() && (
                  <button
                    type="button"
                    onClick={handleAddCustomPhoto}
                    disabled={isUploadingPhoto}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#002217] hover:bg-[#0f382a] text-[#6cf8bb] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_link</span>
                    <span>Guardar Foto por URL</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* REGISTRO DE AVISTAMIENTOS (ENTRADAS DE VISTAS) */}
          <div className="p-3.5 rounded-xl bg-white border border-[#c1c8c3] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">visibility</span>
                Registro de Avistamientos / Entradas de Vistas ({sightingsList.length})
              </label>
              <button
                type="button"
                onClick={() => setShowAddSighting(!showAddSighting)}
                className="text-xs font-bold text-[#006c49] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>{showAddSighting ? 'Cancelar' : 'Nuevo Avistamiento'}</span>
              </button>
            </div>

            {/* Sightings List */}
            {sightingsList.length > 0 && (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {sightingsList.map((sight) => (
                  <div key={sight.id} className="p-2.5 rounded-lg bg-[#f8faf4] border border-[#c1c8c3]/60 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#002217] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-[#006c49]">pin_drop</span>
                        {sight.locality}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] text-[#006c49] font-bold bg-white px-2 py-0.5 rounded border border-[#e1e3dd]">
                          N={sight.count || 1} ind. • {sight.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const isAuthor =
                              collector &&
                              sight.observer &&
                              collector.trim().toLowerCase() === sight.observer.trim().toLowerCase();

                            if (isAuthor) {
                              setEditingSightingId(sight.id);
                              setNewSightingLocality(sight.locality);
                              setNewSightingCount(sight.count || 1);
                              setNewSightingDate(sight.date || new Date().toISOString().slice(0, 10));
                              setNewSightingTime(
                                sight.timestamp?.match(/\b([0-9]{1,2}:[0-9]{2})\b/)?.[1] || '20:00'
                              );
                              setNewSightingBehavior(sight.behaviorObserved || '');
                              setNewSightingNotes(sight.notes || '');
                              setShowAddSighting(true);
                            } else {
                              setSightingPinPrompt({ action: 'edit', sighting: sight });
                              setSightingEnteredPin('');
                              setSightingPinError(null);
                            }
                          }}
                          className="w-6 h-6 rounded bg-white border border-[#c1c8c3] text-[#006c49] hover:bg-[#006c49] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Editar este avistamiento"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSightingPinPrompt({ action: 'delete', sighting: sight });
                            setSightingEnteredPin('');
                            setSightingPinError(null);
                          }}
                          className="w-6 h-6 rounded bg-white border border-[#c1c8c3] text-[#717974] hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar este avistamiento (requiere clave de seguridad)"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[#414844]">{sight.behaviorObserved}</p>
                    {sight.notes && <p className="text-[11px] text-[#717974] italic">{sight.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit Sighting Form */}
            {showAddSighting && (
              <div className="p-3 rounded-lg bg-[#f0f4ee] border border-[#c1d0c4] flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#002217] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">
                      {editingSightingId ? 'edit_calendar' : 'add_location_alt'}
                    </span>
                    {editingSightingId ? 'Editar Observación en Sitio:' : 'Registrar Nueva Observación en Sitio:'}
                  </span>
                  {editingSightingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSightingId(null);
                        setNewSightingLocality('');
                        setNewSightingBehavior('');
                        setNewSightingNotes('');
                        setShowAddSighting(false);
                      }}
                      className="text-[11px] text-[#717974] hover:text-red-600 cursor-pointer"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                {/* Día y Hora para avistamientos anteriores o presentes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-[#c1c8c3]">
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Día / Fecha del Avistamiento *
                    </label>
                    <input
                      type="date"
                      value={newSightingDate}
                      onChange={(e) => setNewSightingDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#f8faf4] border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Hora del Avistamiento (CST) *
                    </label>
                    <input
                      type="time"
                      value={newSightingTime}
                      onChange={(e) => setNewSightingTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#f8faf4] border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19]"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[#717974]">Atajos:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setNewSightingDate(now.toISOString().slice(0, 10));
                        setNewSightingTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#e6f4ea] text-[#006c49] font-medium hover:bg-[#d2edd9]"
                    >
                      Hoy (Ahora)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date(Date.now() - 86400000);
                        setNewSightingDate(y.toISOString().slice(0, 10));
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#e1e3dd] text-[#414844] hover:bg-[#d0d3cb]"
                    >
                      Ayer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newSightingLocality}
                    onChange={(e) => setNewSightingLocality(e.target.value)}
                    placeholder={`Localidad (por defecto: ${locality})`}
                    className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newSightingCount}
                    onChange={(e) => setNewSightingCount(parseInt(e.target.value) || 1)}
                    placeholder="Cantidad de individuos"
                    className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                </div>
                <input
                  type="text"
                  value={newSightingBehavior}
                  onChange={(e) => setNewSightingBehavior(e.target.value)}
                  placeholder="Comportamiento observado (ej. Forrajeo nocturno, percha a 2m, en amplexo...)"
                  className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newSightingNotes}
                    onChange={(e) => setNewSightingNotes(e.target.value)}
                    placeholder="Notas ecológicas adicionales..."
                    className="flex-1 px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSighting}
                    className="px-3.5 py-1.5 rounded bg-[#006c49] hover:bg-[#005236] text-white font-bold text-xs cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {editingSightingId ? 'Actualizar Entrada' : 'Guardar Entrada'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e1e3dd]">
            {editingSpecimen && onDelete ? (
              <button
                type="button"
                onClick={() => setShowDeletePrompt(true)}
                className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">delete</span>
                <span>Eliminar Registro</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#6cf8bb]">save</span>
                <span>Guardar en Bitácora Científica</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Alert */}
      {showDeletePrompt && editingSpecimen && onDelete && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h4 className="font-bold text-center text-[#002217] text-base">
              ¿Eliminar este registro científico?
            </h4>
            <p className="text-xs text-center text-[#414844]">
              Se eliminará definitivamente la ficha de <strong className="italic">{editingSpecimen.scientificName}</strong> ({editingSpecimen.catalogNumber}). Esta acción no se puede deshacer.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeletePrompt(false)}
                className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f2f4ee] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(editingSpecimen.id);
                  setShowDeletePrompt(false);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seguridad por Clave para Avistamientos */}
      {sightingPinPrompt && (
        <div
          className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setSightingPinPrompt(null);
            setSightingEnteredPin('');
            setSightingPinError(null);
          }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#c1c8c3] flex flex-col gap-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#002217] text-[#6cf8bb] flex items-center justify-center mx-auto shadow-md">
              <span className="material-symbols-outlined text-[32px]">
                {sightingPinPrompt.action === 'delete' ? 'lock_person' : 'security'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#002217]">
                {sightingPinPrompt.action === 'delete'
                  ? 'Autorización para Eliminar Avistamiento'
                  : 'Autorización para Editar Avistamiento'}
              </h3>
              <p className="text-xs text-[#55605a] mt-1.5 leading-relaxed">
                {sightingPinPrompt.action === 'delete'
                  ? 'Para eliminar registros de campo se requiere introducir la clave de seguridad autorizada.'
                  : `Este avistamiento fue registrado por "${sightingPinPrompt.sighting.observer || 'otro observador'}". Para editarlo, introduce la clave autorizada.`}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (sightingEnteredPin !== '5531') {
                  setSightingPinError('Clave incorrecta. Acceso restringido.');
                  return;
                }
                const targetSight = sightingPinPrompt.sighting;
                const isDel = sightingPinPrompt.action === 'delete';
                setSightingPinPrompt(null);
                setSightingEnteredPin('');
                setSightingPinError(null);

                if (isDel) {
                  registerDeletedSighting(targetSight);
                  setSightingsList((prev) => prev.filter((s) => s.id !== targetSight.id));
                } else {
                  setEditingSightingId(targetSight.id);
                  setNewSightingLocality(targetSight.locality);
                  setNewSightingCount(targetSight.count || 1);
                  setNewSightingDate(targetSight.date || new Date().toISOString().slice(0, 10));
                  setNewSightingTime(
                    targetSight.timestamp?.match(/\b([0-9]{1,2}:[0-9]{2})\b/)?.[1] || '20:00'
                  );
                  setNewSightingBehavior(targetSight.behaviorObserved || '');
                  setNewSightingNotes(targetSight.notes || '');
                  setShowAddSighting(true);
                }
              }}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[11px] font-bold text-[#002217] uppercase tracking-wider">
                  Clave de Seguridad
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    maxLength={10}
                    value={sightingEnteredPin}
                    onChange={(e) => {
                      setSightingEnteredPin(e.target.value);
                      if (sightingPinError) setSightingPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-center text-xl tracking-[0.3em] font-mono font-bold bg-[#f8faf4] border-2 border-[#c1c8c3] rounded-xl text-[#002217] focus:outline-none focus:border-[#006c49] focus:bg-white transition-all"
                  />
                  <span className="absolute right-3 top-3.5 text-[#717974] material-symbols-outlined text-[20px] pointer-events-none">
                    password
                  </span>
                </div>
                {sightingPinError && (
                  <p className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{sightingPinError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSightingPinPrompt(null);
                    setSightingEnteredPin('');
                    setSightingPinError(null);
                  }}
                  className="py-2.5 px-4 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f0f2ec] cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!sightingEnteredPin.trim()}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer ${
                    sightingPinPrompt.action === 'delete'
                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                      : 'bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] disabled:opacity-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {sightingPinPrompt.action === 'delete' ? 'delete_forever' : 'check_circle'}
                  </span>
                  <span>{sightingPinPrompt.action === 'delete' ? 'Confirmar y Borrar' : 'Autorizar Edición'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
