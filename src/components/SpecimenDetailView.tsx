import React, { useState, useEffect } from 'react';
import {
  SpecimenRecord,
  BioacousticRecord,
  SightingEntry,
  VitalityStatus,
  VitalityCause,
  LifeStage,
  BiologicalSex,
} from '../types/specimen';
import {
  playFrogCall,
  playCustomAudio,
  generateSonogramWav,
  SoundPlaybackController,
} from '../utils/audioBioacoustics';
import { AudioRecordingModal } from './AudioRecordingModal';
import { CostaRicaMap } from './CostaRicaMap';
import { CachedImage } from './CachedImage';
import { ThemeSwitcher } from './ThemeSwitcher';
import { saveImageOfflineAndServer, handleImageOfflineFallback } from '../utils/offlineImageCache';
import {
  formatCoordinatesDMS,
  findNearestHotspot,
  estimateHoldridgeZone,
  HOLDRIDGE_LIFE_ZONES_CR,
  detectLocationAndLifeZone,
} from '../data/costaRicaData';
import { formatProtectedCoordinates } from '../utils/geoprivacy';
import { fetchLiveFieldWeather } from '../utils/weatherMoonService';

// Helper utilities for sighting date and time handling
function parseDateToYmd(dateStr?: string, timestampStr?: string): string {
  if (!dateStr && !timestampStr) {
    return new Date().toISOString().slice(0, 10);
  }
  // Check if dateStr is YYYY-MM-DD
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  // Search for YYYY-MM-DD anywhere in dateStr or timestampStr
  const isoMatch =
    (dateStr || '').match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    (timestampStr || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // Search for DD/MM/YYYY or DD-MM-YYYY
  const combo = `${dateStr || ''} ${timestampStr || ''}`;
  const slashMatch = combo.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Search for Spanish text date: "09 Oct 2026", "16 Feb 2026", "15 Febrero 2026"
  const textMatch =
    combo.match(/(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(\d{4})/i) ||
    combo.match(/(\d{1,2})\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(\d{4})/i);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const mStr = textMatch[2].toLowerCase();
    const year = textMatch[3];
    const monthMap: Record<string, string> = {
      ene: '01', enero: '01',
      feb: '02', febrero: '02',
      mar: '03', marzo: '03',
      abr: '04', abril: '04',
      may: '05', mayo: '05',
      jun: '06', junio: '06',
      jul: '07', julio: '07',
      ago: '08', agosto: '08',
      sep: '09', set: '09', septiembre: '09',
      oct: '10', octubre: '10',
      nov: '11', noviembre: '11',
      dic: '12', diciembre: '12',
    };
    for (const [prefix, num] of Object.entries(monthMap)) {
      if (mStr.startsWith(prefix)) {
        return `${year}-${num}-${day}`;
      }
    }
  }

  // Check for month-year pattern: e.g. "2026-03"
  if (dateStr && /^\d{4}-\d{2}$/.test(dateStr.trim())) {
    return `${dateStr.trim()}-01`;
  }

  return new Date().toISOString().slice(0, 10);
}

function parseTimeToHm(timestampStr?: string): string {
  if (!timestampStr) {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const match = timestampStr.match(/\b([0-9]{1,2}):([0-9]{2})\b/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return '20:00';
}

function formatSightingTimestamp(dateYmd: string, timeHm?: string): string {
  if (!dateYmd) return timeHm ? `${timeHm} CST` : '';
  const [year, month, day] = dateYmd.split('-');
  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  const mIdx = parseInt(month, 10) - 1;
  const mName = monthNames[mIdx] || month;

  try {
    const dObj = new Date(`${dateYmd}T12:00:00`);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dName = dayNames[dObj.getDay()];
    const timePart = timeHm ? `, ${timeHm} CST` : '';
    return `${day} ${mName} ${year}${timePart} (${dName})`;
  } catch {
    const timePart = timeHm ? `, ${timeHm} CST` : '';
    return `${day} ${mName} ${year}${timePart}`;
  }
}

interface SpecimenDetailViewProps {
  specimen: SpecimenRecord;
  onBack: () => void;
  onGoHome?: () => void;
  onEdit: (specimen: SpecimenRecord) => void;
  onSaveSpecimen?: (specimen: SpecimenRecord) => void;
  onOpenMap: (specimen: SpecimenRecord) => void;
  onOpenDarwinCoreModal: (specimen: SpecimenRecord) => void;
  onDelete?: (specimenId: string) => void;
  onUpdateBioacoustics: (specimenId: string, bioacoustics?: BioacousticRecord) => void;
  currentObserverName?: string;
}

export const SpecimenDetailView: React.FC<SpecimenDetailViewProps> = ({
  specimen,
  onBack,
  onGoHome,
  onEdit,
  onSaveSpecimen,
  onOpenMap,
  onOpenDarwinCoreModal,
  onDelete,
  onUpdateBioacoustics,
  currentObserverName,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPlaybackController, setAudioPlaybackController] = useState<SoundPlaybackController | null>(null);
  const [activePhotoModal, setActivePhotoModal] = useState<{
    id?: string;
    url: string;
    label: string;
    desc: string;
    sightingId?: string;
  } | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<{
    id: string;
    sightingId?: string;
    label: string;
    url: string;
    description: string;
  } | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoDesc, setEditPhotoDesc] = useState('');
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isGeoprivacyActive, setIsGeoprivacyActive] = useState(false);
  const [isLoadingSightingWeather, setIsLoadingSightingWeather] = useState(false);

  // Direct Sighting Modal State
  const [isAddSightingModalOpen, setIsAddSightingModalOpen] = useState(false);
  const [editingSightingId, setEditingSightingId] = useState<string | null>(null);
  const [isChangePhotoModalOpen, setIsChangePhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState(specimen.heroImage);
  const [newPhotoDescription, setNewPhotoDescription] = useState(specimen.heroImageDescription);
  const [sightingObserver, setSightingObserver] = useState(currentObserverName || 'Ing. Carvajal V.');
  const [sightingLocality, setSightingLocality] = useState(specimen.georeference.locality || '');
  const [sightingDate, setSightingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sightingTime, setSightingTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [sightingPrecision, setSightingPrecision] = useState<'exact' | 'month_year'>('exact');
  const [sightingMonthYear, setSightingMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [sightingCoords, setSightingCoords] = useState<{ lat: number; lng: number }>(() => ({
    lat: specimen.georeference.latitude,
    lng: specimen.georeference.longitude,
  }));
  const [sightingCoordsDms, setSightingCoordsDms] = useState(
    specimen.georeference.latitudeDMS && specimen.georeference.longitudeDMS
      ? `${specimen.georeference.latitudeDMS}, ${specimen.georeference.longitudeDMS}`
      : formatCoordinatesDMS(specimen.georeference.latitude, specimen.georeference.longitude).combined
  );
  const [sightingLifeZone, setSightingLifeZone] = useState(specimen.georeference.lifeZone || '');
  const [showSightingMap, setShowSightingMap] = useState(false);
  const [sightingCount, setSightingCount] = useState(1);
  const [sightingWeather, setSightingWeather] = useState('Soleado y cálido, 26°C');
  const [sightingMicrohabitat, setSightingMicrohabitat] = useState(specimen.georeference.microhabitat || '');
  const [sightingBehavior, setSightingBehavior] = useState('');
  const [sightingNotes, setSightingNotes] = useState('');
  const [sightingIsCurious, setSightingIsCurious] = useState(false);
  const [sightingCuriousTitle, setSightingCuriousTitle] = useState('');
  const [sightingCuriousDesc, setSightingCuriousDesc] = useState('');
  const [sightingCuriousPhoto, setSightingCuriousPhoto] = useState('');
  const [sightingVitality, setSightingVitality] = useState<VitalityStatus>('VIVO');
  const [sightingVitalityCause, setSightingVitalityCause] = useState<VitalityCause>('ATROPELLO');
  const [sightingVitalityDetail, setSightingVitalityDetail] = useState('');
  const [sightingLifeStage, setSightingLifeStage] = useState<LifeStage>('ADULTO');
  const [sightingSex, setSightingSex] = useState<BiologicalSex>('NO_APLICA');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([
    8, 16, 28, 20, 12, 32, 24, 12, 8, 20, 28, 16, 8, 24, 12, 8,
  ]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioPlaybackController?.stop();
    };
  }, [audioPlaybackController]);

  // Audio Playback toggle
  const toggleAudio = () => {
    if (!specimen.bioacoustics) return;

    if (isPlayingAudio) {
      audioPlaybackController?.stop();
      setIsPlayingAudio(false);
      setAudioPlaybackController(null);
    } else {
      setIsPlayingAudio(true);

      const onTick = (spectrum: number[]) => {
        if (spectrum.length > 0) {
          setWaveformHeights(
            spectrum.map((val) => Math.max(6, Math.floor(val * 32) + Math.floor(Math.random() * 8)))
          );
        }
      };

      const onEnd = () => {
        setIsPlayingAudio(false);
        setAudioPlaybackController(null);
      };

      let controller: SoundPlaybackController;
      if (specimen.bioacoustics.audioDataUrl) {
        controller = playCustomAudio(specimen.bioacoustics.audioDataUrl, onTick, onEnd);
      } else {
        controller = playFrogCall(onTick, onEnd);
      }

      setAudioPlaybackController(controller);
    }
  };

  // Suppress bioacoustics for silent organisms
  const handleSuppressBioacoustics = () => {
    if (window.confirm('¿Desea suprimir el módulo de audio para este espécimen (marcarlo como organismo sin canto/llamado)?')) {
      audioPlaybackController?.stop();
      setIsPlayingAudio(false);
      onUpdateBioacoustics(specimen.id, undefined);
    }
  };

  const handleOpenAddSighting = () => {
    const d = new Date();
    setSightingObserver(currentObserverName || 'Ing. Carvajal V.');
    setSightingLocality(specimen.georeference.locality || '');
    setSightingDate(d.toISOString().slice(0, 10));
    setSightingTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setSightingPrecision('exact');
    setSightingMonthYear(d.toISOString().slice(0, 7));
    setSightingCoords({
      lat: specimen.georeference.latitude,
      lng: specimen.georeference.longitude,
    });
    setSightingCoordsDms(
      specimen.georeference.latitudeDMS && specimen.georeference.longitudeDMS
        ? `${specimen.georeference.latitudeDMS}, ${specimen.georeference.longitudeDMS}`
        : formatCoordinatesDMS(specimen.georeference.latitude, specimen.georeference.longitude).combined
    );
    setSightingLifeZone(specimen.georeference.lifeZone || '');
    setShowSightingMap(false);
    setSightingCount(1);
    setSightingWeather('Soleado y cálido, 26°C');
    setSightingMicrohabitat(specimen.georeference.microhabitat || '');
    setSightingBehavior('');
    setSightingNotes('');
    setSightingIsCurious(false);
    setSightingCuriousTitle('');
    setSightingCuriousDesc('');
    setSightingCuriousPhoto('');
    setSightingVitality('VIVO');
    setSightingVitalityCause('ATROPELLO');
    setSightingVitalityDetail('');
    setSightingLifeStage('ADULTO');
    setSightingSex('NO_APLICA');
    setEditingSightingId(null);
    setIsAddSightingModalOpen(true);
  };

  const handleOpenEditSighting = (sight: SightingEntry) => {
    setEditingSightingId(sight.id);
    setSightingObserver(sight.observer || currentObserverName || 'Ing. Carvajal V.');
    setSightingLocality(sight.locality || specimen.georeference.locality || '');

    const parsedDate = parseDateToYmd(sight.date, sight.timestamp);
    const parsedTime = parseTimeToHm(sight.timestamp);
    setSightingDate(parsedDate);
    setSightingTime(parsedTime);

    const isMonthYear =
      (sight.date && /^\d{4}-\d{2}$/.test(sight.date)) ||
      (sight.timestamp && sight.timestamp.includes('(Aproximado)'));
    setSightingPrecision(isMonthYear ? 'month_year' : 'exact');
    setSightingMonthYear(isMonthYear && sight.date ? sight.date : parsedDate.slice(0, 7));

    setSightingCoordsDms(
      sight.coordinates ||
        `${specimen.georeference.latitudeDMS}, ${specimen.georeference.longitudeDMS}`
    );
    setSightingCount(sight.count || sight.individualsCount || 1);
    setSightingWeather(sight.weather || sight.weatherConditions || '');
    setSightingMicrohabitat(sight.microhabitat || '');
    setSightingBehavior(sight.behaviorObserved || '');
    setSightingNotes(sight.notes || '');
    setSightingIsCurious(!!(sight.isCuriousFinding || sight.curiousFindingTitle));
    setSightingCuriousTitle(sight.curiousFindingTitle || '');
    setSightingCuriousDesc(sight.curiousFindingDescription || '');
    setSightingCuriousPhoto(sight.curiousFindingPhoto || (sight.photoUrls ? sight.photoUrls[0] : ''));
    setSightingVitality(sight.vitalityStatus || 'VIVO');
    setSightingVitalityCause(sight.vitalityCause || 'ATROPELLO');
    setSightingVitalityDetail(sight.vitalityCauseDetail || '');
    setSightingLifeStage(sight.lifeStage || 'ADULTO');
    setSightingSex(sight.sex || 'NO_APLICA');
    setIsAddSightingModalOpen(true);
  };

  const handleSaveDirectSighting = (e: React.FormEvent) => {
    e.preventDefault();
    let formattedTimestamp = '';
    let recordDate = '';

    if (sightingPrecision === 'exact') {
      recordDate = sightingDate;
      formattedTimestamp = formatSightingTimestamp(sightingDate, sightingTime);
    } else {
      // Mes y Año aproximado (ej: 2026-03 -> Marzo 2026)
      recordDate = sightingMonthYear;
      const [year, month] = sightingMonthYear.split('-');
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ];
      const monthName = month ? monthNames[parseInt(month, 10) - 1] || month : '';
      formattedTimestamp = `${monthName} ${year} (Aproximado)`;
    }

    const sightingPayload: SightingEntry = {
      id: editingSightingId || 'sight-' + Date.now(),
      timestamp: formattedTimestamp,
      date: recordDate,
      observer: sightingObserver.trim() || currentObserverName || 'Ing. Carvajal V.',
      locality: sightingLocality.trim() || specimen.georeference.locality,
      coordinates: sightingCoordsDms,
      count: Number(sightingCount) || 1,
      individualsCount: Number(sightingCount) || 1,
      microhabitat: sightingMicrohabitat.trim() || specimen.georeference.microhabitat,
      weather: sightingWeather.trim(),
      weatherConditions: sightingWeather.trim(),
      behaviorObserved: sightingBehavior.trim() || 'Avistamiento de espécimen activo en su entorno silvestre.',
      notes: sightingNotes.trim()
        ? `${sightingNotes.trim()}${sightingLifeZone ? ` • Zona: ${sightingLifeZone}` : ''}`
        : (sightingLifeZone ? `Zona de Vida: ${sightingLifeZone}` : undefined),
      isCuriousFinding: sightingIsCurious,
      curiousFindingTitle: sightingIsCurious ? sightingCuriousTitle.trim() : undefined,
      curiousFindingDescription: sightingIsCurious ? sightingCuriousDesc.trim() : undefined,
      curiousFindingPhoto: sightingIsCurious ? sightingCuriousPhoto : undefined,
      photoUrls: sightingCuriousPhoto ? [sightingCuriousPhoto] : undefined,
      vitalityStatus: sightingVitality,
      vitalityCause: sightingVitality === 'MUERTO' ? sightingVitalityCause : undefined,
      vitalityCauseDetail: sightingVitality === 'MUERTO' ? sightingVitalityDetail.trim() : undefined,
      lifeStage: sightingLifeStage,
      sex: sightingSex,
    };

    let updatedList: SightingEntry[] = [];
    if (editingSightingId) {
      updatedList = (specimen.sightings || []).map((s) =>
        s.id === editingSightingId ? sightingPayload : s
      );
    } else {
      updatedList = [sightingPayload, ...(specimen.sightings || [])];
    }

    // Keep all sightings strictly sorted in chronological order of visit (descending)
    const combinedSightings = [...updatedList].sort((a, b) => {
      const keyA = `${parseDateToYmd(a.date, a.timestamp)} ${parseTimeToHm(a.timestamp)}`;
      const keyB = `${parseDateToYmd(b.date, b.timestamp)} ${parseTimeToHm(b.timestamp)}`;
      return keyB.localeCompare(keyA);
    });

    // Also update additionalPhotos if a curious photo was uploaded/updated
    let updatedPhotos = [...specimen.additionalPhotos];
    if (sightingCuriousPhoto) {
      const existsPhotoIndex = updatedPhotos.findIndex((p) => p.label.toLowerCase().includes('macho tuerto') || p.id === 'photo-4');
      if (existsPhotoIndex >= 0) {
        updatedPhotos[existsPhotoIndex] = {
          ...updatedPhotos[existsPhotoIndex],
          url: sightingCuriousPhoto,
          description: sightingCuriousDesc || updatedPhotos[existsPhotoIndex].description,
        };
      } else {
        updatedPhotos.push({
          id: 'photo-' + Date.now(),
          url: sightingCuriousPhoto,
          label: sightingCuriousTitle || 'Hallazgo Curioso',
          description: sightingCuriousDesc || 'Registro fotográfico de hallazgo curioso en campo.',
        });
      }
    }

    const updatedSpecimen: SpecimenRecord = {
      ...specimen,
      sightings: combinedSightings,
      additionalPhotos: updatedPhotos,
    };

    if (onSaveSpecimen) {
      onSaveSpecimen(updatedSpecimen);
    }

    setIsAddSightingModalOpen(false);
    setEditingSightingId(null);
    setSaveSuccessMsg(
      editingSightingId
        ? '¡Avistamiento editado y guardado permanentemente!'
        : sightingIsCurious
        ? '¡Hallazgo curioso y avistamiento guardados permanentemente y ordenados por fecha!'
        : '¡Nuevo avistamiento guardado permanentemente y ordenado por fecha de visita!'
    );
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleDeleteSighting = (sightingId: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este avistamiento?')) {
      const updatedSightings = (specimen.sightings || []).filter((s) => s.id !== sightingId);
      const updatedSpecimen: SpecimenRecord = {
        ...specimen,
        sightings: updatedSightings,
      };
      if (onSaveSpecimen) {
        onSaveSpecimen(updatedSpecimen);
      }
      setSaveSuccessMsg('Avistamiento eliminado y cambios guardados.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  const handleDirectPhotoUpload = async (photoId: string, file: File) => {
    if (!file) return;
    try {
      const isMacho = photoId === 'photo-4' || (specimen.additionalPhotos?.find((p) => p.id === photoId)?.label?.toLowerCase().includes('macho tuerto'));
      const prefix = isMacho ? 'macho_tuerto' : 'specimen_gallery';
      const permanentUrl = await saveImageOfflineAndServer(file, prefix);

      const updatedPhotos = (specimen.additionalPhotos || []).map((p) => {
        if (p.id === photoId) {
          return {
            ...p,
            url: permanentUrl,
          };
        }
        return p;
      });

      // Si es el macho tuerto, mantener sincronizados también los hallazgos curiosos
      let updatedSightings = specimen.sightings || [];
      if (isMacho) {
        updatedSightings = updatedSightings.map((s) => {
          if (s.id === 'sight-dota-20261009' || s.isCuriousFinding || s.curiousFindingTitle?.includes('Macho')) {
            return {
              ...s,
              curiousFindingPhoto: permanentUrl,
              photoUrls: [permanentUrl],
            };
          }
          return s;
        });
      }

      const updatedSpecimen: SpecimenRecord = {
        ...specimen,
        sightings: updatedSightings,
        additionalPhotos: updatedPhotos,
      };
      if (onSaveSpecimen) {
        onSaveSpecimen(updatedSpecimen);
      }
      setSaveSuccessMsg('¡Fotografía sustituida, guardada y sincronizada para todos los dispositivos!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error al subir foto:', err);
      alert('Error al guardar fotografía: ' + (err?.message || err));
    }
  };

  const handleSaveCuriousFindingPhoto = async (sightingId: string, newPhotoUrlOrFile: string | File, newDesc?: string) => {
    if (!newPhotoUrlOrFile) return;

    try {
      let finalUrl = '';
      if (typeof newPhotoUrlOrFile === 'string') {
        if (newPhotoUrlOrFile.startsWith('data:')) {
          finalUrl = await saveImageOfflineAndServer(newPhotoUrlOrFile, 'macho_tuerto');
        } else {
          finalUrl = newPhotoUrlOrFile;
        }
      } else if (newPhotoUrlOrFile instanceof File) {
        finalUrl = await saveImageOfflineAndServer(newPhotoUrlOrFile, 'macho_tuerto');
      }

      // 1. Update this sighting's curiousFindingPhoto
      const updatedSightings = (specimen.sightings || []).map((s) => {
        if (s.id === sightingId || s.id === 'sight-dota-20261009' || s.curiousFindingTitle?.includes('Macho')) {
          return {
            ...s,
            curiousFindingPhoto: finalUrl,
            photoUrls: [finalUrl],
            curiousFindingDescription: newDesc || s.curiousFindingDescription,
          };
        }
        return s;
      });

      // 2. Update photo-4 ("Hallazgo: Macho Tuerto") in additionalPhotos WITHOUT EVER touching photo-3 ("Detalle Ocular")
      let updatedPhotos = [...(specimen.additionalPhotos || [])];
      const p4Idx = updatedPhotos.findIndex(
        (p) => p.id === 'photo-4' || p.label.toLowerCase().includes('macho tuerto')
      );
      if (p4Idx >= 0) {
        updatedPhotos[p4Idx] = {
          ...updatedPhotos[p4Idx],
          url: finalUrl,
          description: newDesc || updatedPhotos[p4Idx].description,
        };
      } else {
        updatedPhotos.push({
          id: 'photo-4',
          url: finalUrl,
          label: 'Hallazgo: Macho Tuerto',
          description: newDesc || 'Hallazgo curioso en Santa María de Dota (Viernes 9): Macho adulto de Isthmohyla nacientes al que le falta un ojo (anoftalmia/cicatrización natural).',
        });
      }

      // 3. ABSOLUTELY PROTECT photo-3 "Detalle Ocular" so it NEVER gets changed or overwritten
      updatedPhotos = updatedPhotos.map((p) => {
        if (p.id === 'photo-3' || p.label === 'Detalle Ocular') {
          return {
            ...p,
            url: '/isthmohyla_nacientes_eye_zoom.jpg',
            label: 'Detalle Ocular',
            description: 'Macro zoom de alta precisión y nitidez del ojo de Isthmohyla nacientes. Se aprecia el iris cobrizo-dorado metálico característico con reticulaciones oscuras dendríticas, pupila horizontal adaptada a baja luminosidad en quebradas y piel verde esmeralda con gránulos cutáneos húmedos.',
          };
        }
        return p;
      });

      const updatedSpecimen: SpecimenRecord = {
        ...specimen,
        sightings: updatedSightings,
        additionalPhotos: updatedPhotos,
      };

      if (onSaveSpecimen) {
        onSaveSpecimen(updatedSpecimen);
      }
      setEditingPhoto(null);
      setSaveSuccessMsg('¡Fotografía del macho tuerto fijada y sincronizada permanentemente en todos los dispositivos!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Error al guardar foto de macho tuerto:', err);
      alert('Error al guardar foto: ' + (err?.message || err));
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f8faf4] pb-20">
      {/* Top Fixed Header */}
      <header className="sticky top-0 inset-x-0 z-50 bg-[#f8faf4]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              aria-label="Volver"
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#191c19] hover:bg-[#e7e9e3] transition-colors flex-shrink-0 cursor-pointer"
              title="Volver atrás"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>

            {/* Ícono superior para regresar SIEMPRE a la página de inicio (Portada) */}
            <button
              onClick={onGoHome || onBack}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#e7e9e3] transition-all cursor-pointer group"
              title="Ir a Página de Inicio / Portada"
            >
              <div className="w-8 h-8 rounded-lg bg-[#002217] flex items-center justify-center text-[#6cf8bb] group-hover:bg-[#006c49] transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[19px]">cottage</span>
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[9px] text-[#006c49] font-mono font-bold uppercase tracking-wider">Inicio</span>
                <span className="font-bold text-sm text-[#002217] truncate group-hover:text-[#006c49] transition-colors">
                  BioVinoTinto
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Selector de Tema / Modo Nocturno */}
            <ThemeSwitcher compact />

            {/* Botón explícito para regresar a Inicio */}
            <button
              onClick={onGoHome || onBack}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#002217] hover:bg-[#f2f4ee] border border-[#c1c8c3] text-xs text-[#002217] dark:text-[#6cf8bb] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              title="Regresar a Inicio"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">home</span>
              <span className="hidden sm:inline">Inicio</span>
            </button>

            {/* Quick Delete Header Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Eliminar este registro"
            >
              <span className="material-symbols-outlined text-[19px]">delete</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-3xl mx-auto w-full">
        {/* Interactive Hero Image */}
        <section className="relative w-full overflow-hidden bg-[#0f382a] shadow-md">
          <div className="relative w-full h-80 sm:h-96 overflow-hidden">
            <img
              src={specimen.heroImage || '/isthmohyla_nacientes.jpg'}
              alt={specimen.heroImageDescription}
              onError={(e) => {
                handleImageOfflineFallback(e.currentTarget as HTMLImageElement, '/isthmohyla_nacientes.jpg');
              }}
              className={`w-full h-full object-cover transition-transform duration-500 ease-out select-none cursor-pointer ${
                isZoomed ? 'scale-150' : 'scale-100 hover:scale-105'
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            />
            {/* Ambient Gradient Scrims */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#002217]/90 via-[#002217]/20 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#002217]/60 via-transparent to-transparent pointer-events-none" />

            {/* Live Inspection Badges Overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md shadow-sm pointer-events-auto">
                <span className="w-2 h-2 rounded-full bg-[#6cf8bb] animate-pulse" />
                <span className="font-mono text-[11px] font-bold text-[#002217] uppercase tracking-wider">
                  {specimen.catalogNumber}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm pointer-events-auto">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">verified</span>
                <span className="text-[11px] font-semibold text-[#191c19]">Curaduría Verificada</span>
              </div>
            </div>

            {/* Quick Interactive Zoom, Photo & Audio Tools */}
            <div className="absolute bottom-16 right-3 flex flex-col gap-2 z-10">
              <button
                aria-label="Ampliar imagen de espécimen"
                onClick={() => setIsZoomed(!isZoomed)}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-[#191c19] flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer hover:bg-white"
                title={isZoomed ? "Reducir zoom" : "Ampliar fotografía"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isZoomed ? 'zoom_out' : 'zoom_in'}
                </span>
              </button>

              <button
                aria-label="Cambiar fotografía del espécimen"
                onClick={() => {
                  setNewPhotoUrl(specimen.heroImage);
                  setNewPhotoDescription(specimen.heroImageDescription);
                  setIsChangePhotoModalOpen(true);
                }}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-[#006c49] flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer hover:bg-white"
                title="Actualizar o subir fotografía del espécimen"
              >
                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
              </button>

              {specimen.bioacoustics && (
                <button
                  aria-label="Reproducir vocalización bioacústica"
                  onClick={toggleAudio}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer ${
                    isPlayingAudio
                      ? 'bg-[#6cf8bb] text-[#00714d] ring-2 ring-[#006c49]'
                      : 'bg-[#006c49] text-white hover:bg-[#005236]'
                  }`}
                  title="Escuchar canto"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isPlayingAudio ? 'pause' : 'volume_up'}
                  </span>
                </button>
              )}
            </div>

            {/* Image Metadata Stamp */}
            <div className="absolute bottom-3 left-3 right-16 text-white pointer-events-none">
              <p className="font-mono text-[11px] opacity-90 flex items-center gap-1 drop-shadow-sm">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                <span>{specimen.collectionDate} • {specimen.collectionTime}</span>
              </p>
              <p className="font-mono text-[11px] opacity-80 flex items-center gap-1 drop-shadow-sm mt-0.5">
                <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                <span>Colector: {specimen.collector}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Taxonomic Title & Identity Header */}
        <section className="px-4 pt-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c1ecd7] text-[#002116] font-mono text-[11px] font-bold uppercase">
                {specimen.taxonGroup} • {specimen.realm}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7e9e3] text-[#414844] font-mono text-[11px] font-medium">
                <span className="material-symbols-outlined text-[14px] text-[#006c49]">cloud_done</span>
                Darwin Core Sync
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#002217] text-[#6cf8bb] font-mono text-[11px] font-bold shadow-xs">
                <span className="material-symbols-outlined text-[13px]">visibility</span>
                <span>{specimen.sightings?.length || 0} Avistamientos</span>
                <span className="text-white/60">•</span>
                <span>{specimen.sightings && specimen.sightings.length > 0 ? specimen.sightings.reduce((acc, s) => acc + (s.count || s.individualsCount || 0), 0) : 0} Inds.</span>
              </span>
            </div>
            <h2 className="text-[26px] font-bold italic text-[#002217] tracking-tight mt-1">
              {specimen.scientificName}
            </h2>
            <p className="text-[14px] text-[#414844] font-medium">
              {specimen.commonName}
            </p>
          </div>

          {/* Conservation & Biogeographic Status Mosaic */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="p-3 rounded-xl bg-[#f2f4ee] shadow-sm flex flex-col justify-between border border-[#e1e3dd]/60">
              <span className="font-mono text-[11px] text-[#414844] uppercase tracking-wider font-semibold">
                Estado UICN
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-7 h-7 rounded-full bg-[#006c49] text-white font-bold text-[12px] flex items-center justify-center flex-shrink-0">
                  {specimen.iucnStatus.code}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-[14px] text-[#191c19] leading-tight">
                    {specimen.iucnStatus.label}
                  </p>
                  <p className="text-[12px] text-[#414844]">
                    {specimen.iucnStatus.trend}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f2f4ee] shadow-sm flex flex-col justify-between border border-[#e1e3dd]/60">
              <span className="font-mono text-[11px] text-[#414844] uppercase tracking-wider font-semibold">
                CITES / Distribución
              </span>
              <div className="mt-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ffdcc3] text-[#2f1500] font-mono text-[11px] font-bold">
                  {specimen.citesStatus.appendix}
                </div>
                <p className="text-[13px] text-[#191c19] mt-1 truncate font-medium">
                  {specimen.citesStatus.distribution}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Complete Taxonomic Tree Card */}
        <section className="px-4 mt-4">
          <div className="p-3.5 rounded-xl bg-[#edefe9] shadow-sm border border-[#e1e3dd]/80">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] uppercase text-[#414844] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#002217]">account_tree</span>
                Jerarquía Taxonómica (NCBI / ITIS)
              </span>
              {specimen.taxonomy.taxonId && (
                <span className="font-mono text-[11px] text-[#006c49] font-bold">
                  Taxon ID: {specimen.taxonomy.taxonId}
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-1.5 font-mono text-[11px] text-[#191c19]">
              <span className="px-2 py-0.5 rounded bg-white shadow-sm">{specimen.taxonomy.kingdom}</span>
              <span className="text-[#c1c8c3] font-bold">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-white shadow-sm">{specimen.taxonomy.phylum}</span>
              <span className="text-[#c1c8c3] font-bold">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-white shadow-sm">{specimen.taxonomy.class}</span>
              <span className="text-[#c1c8c3] font-bold">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-white shadow-sm">{specimen.taxonomy.order}</span>
              <span className="text-[#c1c8c3] font-bold">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-white shadow-sm">{specimen.taxonomy.family}</span>
              <span className="text-[#c1c8c3] font-bold">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-[#c1ecd7] text-[#002116] font-bold">
                {specimen.taxonomy.genus}
              </span>
            </div>
          </div>
        </section>

        {/* BIOACOUSTIC MODULE (ACTIVE OR SUPPRESSED) */}
        {specimen.bioacoustics ? (
          <section className="px-4 mt-4">
            <div className="p-3.5 rounded-xl bg-[#0f382a] text-white shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAudio}
                    className="w-8 h-8 rounded-full bg-[#6cf8bb] text-[#00714d] flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isPlayingAudio ? 'pause' : 'graphic_eq'}
                    </span>
                  </button>
                  <div>
                    <h4 className="font-bold text-[15px] text-white">
                      {specimen.bioacoustics.title}
                    </h4>
                    <p className="font-mono text-[11px] text-[#79a28f]">
                      Frecuencia dominante: {specimen.bioacoustics.dominantFrequencyRange}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#002217] text-[#6ffbbe] font-semibold">
                    {isPlayingAudio ? '00:08 / 00:24' : '00:00 / 00:24'}
                  </span>
                </div>
              </div>

              {/* Dynamic Sound Wave Display */}
              <div
                onClick={toggleAudio}
                className="flex items-center gap-1 h-9 px-2 bg-[#002217]/50 rounded-lg justify-between cursor-pointer"
                title="Haga clic para reproducir/pausar vocalización"
              >
                {waveformHeights.map((h, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-[#6ffbbe] rounded-full transition-all duration-150"
                    style={{
                      height: `${h}px`,
                      opacity: isPlayingAudio ? (idx > 7 ? 0.6 : 1) : 0.45,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-[#79a28f] font-mono text-[11px]">
                <span className="truncate mr-2">Patrón: {specimen.bioacoustics.audioPatternDescription}</span>
                <button
                  onClick={() => generateSonogramWav(`Sonograma_${specimen.scientificName.replace(' ', '_')}.wav`)}
                  className="text-[#6ffbbe] flex items-center gap-1 font-semibold hover:underline flex-shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Sonograma .WAV</span>
                </button>
              </div>

              {/* Bioacoustic Actions (Grabar, Subir o Suprimir) */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <button
                  onClick={() => setIsAudioModalOpen(true)}
                  className="text-[#6cf8bb] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <span className="material-symbols-outlined text-[15px]">mic</span>
                  <span>{specimen.bioacoustics.audioDataUrl ? 'Cambiar Grabación' : 'Grabar / Subir Audio'}</span>
                </button>

                {/* BOTÓN PARA SUPRIMIR CANTO POR DEFECTO */}
                <button
                  onClick={handleSuppressBioacoustics}
                  className="text-red-300 hover:text-red-100 flex items-center gap-1 cursor-pointer"
                  title="Suprimir módulo si el organismo no posee canto o llamado"
                >
                  <span className="material-symbols-outlined text-[14px]">volume_off</span>
                  <span>Suprimir Canto (Organismo mudo)</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* Silent Organism Card with option to add audio */
          <section className="px-4 mt-4">
            <div className="p-3.5 rounded-xl bg-white border border-[#e1e3dd] shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#717974] text-[20px]">volume_off</span>
                <div>
                  <h4 className="font-bold text-xs text-[#002217]">Sin Registro Bioacústico</h4>
                  <p className="text-[11px] text-[#414844]">
                    Organismo sin vocalizaciones asignadas (mudo).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAudioModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">mic</span>
                <span>Grabar o Subir Audio</span>
              </button>
            </div>
          </section>
        )}

        {/* Geo-Location & Habitat Module */}
        <section className="px-4 mt-4">
          <div className="p-4 rounded-xl bg-white shadow-sm flex flex-col gap-3 border border-[#e1e3dd]/80">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[16px] text-[#002217] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">explore</span>
                Georreferenciación y Hábitat
              </h3>
              <div className="flex items-center gap-2">
                <label
                  className="flex items-center gap-1.5 cursor-pointer bg-[#f2f4ee] px-2 py-1 rounded-lg border border-[#c1c8c3] text-[11px] font-semibold text-[#002217]"
                  title="Oscurecer coordenadas (difuminar a radio de 2 a 5 km en modo público) para proteger naciente de especies amenazadas o microendémicas"
                >
                  <input
                    type="checkbox"
                    checked={isGeoprivacyActive}
                    onChange={(e) => setIsGeoprivacyActive(e.target.checked)}
                    className="accent-[#006c49] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px] text-[#006c49]">shield</span>
                    <span>Oscurecer Coordenadas</span>
                  </span>
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6cf8bb]/30 text-[#006c49] font-mono text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                  Precisión ±{isGeoprivacyActive ? '3,200' : specimen.georeference.accuracyMeters}m
                </span>
              </div>
            </div>

            {/* Geoprivacy Alert Banner */}
            {isGeoprivacyActive && (
              <div className="p-2.5 rounded-xl bg-[#e6f4ea] border border-[#a8dab5] text-[#003824] text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">security</span>
                <span>
                  <strong>Geoprivacidad de Naciente Activa:</strong> Coordenadas difuminadas a radio de ~3.2 km para evitar la extracción ilegal y proteger la naciente de <em>{specimen.scientificName}</em> en modo público.
                </span>
              </div>
            )}

            <div
              onClick={() => onOpenMap(specimen)}
              title="Haga clic para abrir el Mapa Científico de Costa Rica centrado en este espécimen"
              className="relative w-full h-44 rounded-lg bg-cover bg-center overflow-hidden shadow-inner flex items-end p-2.5 cursor-pointer group"
              style={{
                backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAkxxXeklAa2bUry9oBjeqq3PQmbv6HWeC7Ay8BQJ3KNcU5dBeGxUruPJLlcp1eVFgeDVoQB_UvVQ7Mjs1Ima4Enav6C9xiQt9UjKcppEUmnpguTULLFXuqw9y4ZduzkpB922OVf9MWNdGui84frHaWeVFmOW3ldeqMwELwfk8YhfUenAVz-ArKUZregBaTOjcxeYUssu8i79ajSEBzJyWrV3qddTnP289ZapXW-AV_0v_X0GtuCoc0')`,
              }}
            >
              <div className="absolute inset-0 bg-[#002217]/25 group-hover:bg-[#002217]/10 transition-colors" />

              <div className="absolute top-2.5 right-2.5 bg-[#002217]/80 text-white px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 group-hover:bg-[#002217] transition-colors">
                <span className="material-symbols-outlined text-[14px] text-[#6cf8bb]">zoom_in</span>
                <span>Explorar en Mapa</span>
              </div>

              <div className="relative z-10 w-full p-2 rounded bg-white/95 backdrop-blur-md shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">location_on</span>
                  <span className="font-mono text-[11px] text-[#191c19] truncate font-bold">
                    {(() => {
                      const prot = formatProtectedCoordinates(
                        specimen.georeference.latitude,
                        specimen.georeference.longitude,
                        specimen.id,
                        isGeoprivacyActive
                      );
                      return prot.displayCoordinates;
                    })()}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#006c49] font-bold flex-shrink-0">
                  {specimen.georeference.datum}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[#191c19] pt-1">
              <div className="p-2.5 rounded-lg bg-[#f2f4ee] flex flex-col">
                <span className="font-mono text-[11px] text-[#414844] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">pin_drop</span> Localidad
                </span>
                <span className="text-[13px] font-semibold mt-0.5 text-[#191c19] leading-tight">
                  {specimen.georeference.locality}
                </span>
                <span className="text-[11px] text-[#414844] mt-0.5">
                  {specimen.georeference.province}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f2f4ee] flex flex-col">
                <span className="font-mono text-[11px] text-[#414844] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">forest</span> Zona de Vida
                </span>
                <span className="text-[13px] font-semibold mt-0.5 text-[#191c19] leading-tight">
                  {specimen.georeference.lifeZone}
                </span>
                <span className="text-[11px] text-[#006c49] font-semibold mt-0.5">
                  {specimen.georeference.conservationArea}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f2f4ee] flex flex-col">
                <span className="font-mono text-[11px] text-[#414844] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">elevation</span> Elevación
                </span>
                <span className="text-[13px] font-semibold mt-0.5 text-[#191c19]">
                  {specimen.georeference.elevationMeters} msnm
                </span>
                <span className="text-[11px] text-[#414844] mt-0.5">
                  {specimen.georeference.elevationMeters < 500 ? 'Tierras bajas del Caribe' : 'Tierras altas'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f2f4ee] flex flex-col">
                <span className="font-mono text-[11px] text-[#414844] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">water</span> Microhábitat
                </span>
                <span className="text-[13px] font-semibold mt-0.5 text-[#191c19] leading-tight">
                  {specimen.georeference.microhabitat}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Scientific Field Notebook & Morphometrics */}
        <section className="px-4 mt-4">
          <div className="p-4 rounded-xl bg-white shadow-sm flex flex-col gap-3 border border-[#e1e3dd]/80">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[16px] text-[#002217] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">menu_book</span>
                Notas de Campo &amp; Morfometría
              </h3>
              <span className="font-mono text-[11px] text-[#414844] font-semibold">
                {specimen.fieldFolio}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#f2f4ee] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#414844] font-medium">
                  Longitud Hocico-Cloaca (LHC):
                </span>
                <span className="font-mono text-[13px] font-bold text-[#002217] px-2 py-0.5 rounded bg-[#e1e3dd]">
                  {specimen.morphometrics.snoutVentLengthMm?.toFixed(1) || 'N/A'} mm
                </span>
              </div>
              <p className="text-[13px] text-[#191c19] leading-relaxed">
                <strong className="font-bold text-[#002217]">Cromática y Anatomía: </strong>
                {specimen.morphometrics.colorationAndAnatomy}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#f2f4ee] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[#002217]">
                <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
                <span className="font-bold text-[14px]">Etología y Comportamiento</span>
              </div>
              <p className="text-[13px] text-[#191c19] leading-relaxed">
                {specimen.morphometrics.ethologyAndReproduction}
              </p>
            </div>

            {/* Cortejo y Reproducción */}
            {specimen.morphometrics.courtshipAndMating && (
              <div className="p-3 rounded-lg bg-[#f2f4ee] flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#002217]">
                  <span className="material-symbols-outlined text-[18px] text-[#006c49]">favorite</span>
                  <span className="font-bold text-[14px]">Cortejo, Reproducción &amp; Desove</span>
                </div>
                <p className="text-[13px] text-[#191c19] leading-relaxed">
                  {specimen.morphometrics.courtshipAndMating}
                </p>
              </div>
            )}

            {/* Relaciones Intra e Interespecíficas */}
            {specimen.morphometrics.interspecificRelations && (
              <div className="p-3 rounded-lg bg-[#f2f4ee] flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#002217]">
                  <span className="material-symbols-outlined text-[18px] text-[#006c49]">shield</span>
                  <span className="font-bold text-[14px]">Relaciones Intra/Interespecíficas, Depredación &amp; Defensas</span>
                </div>
                <p className="text-[13px] text-[#191c19] leading-relaxed">
                  {specimen.morphometrics.interspecificRelations}
                </p>
              </div>
            )}

            {/* Datos Científicos Confirmados (UCR, OET, SINAC) */}
            {specimen.morphometrics.confirmedScientificData && (
              <div className="p-3 rounded-lg bg-[#c1ecd7]/30 border border-[#006c49]/30 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#002116]">
                  <span className="material-symbols-outlined text-[18px] text-[#006c49]">verified</span>
                  <span className="font-bold text-[14px]">Investigación Científica Confirmada (UCR / OET / SINAC)</span>
                </div>
                <p className="text-[13px] text-[#191c19] leading-relaxed font-normal">
                  {specimen.morphometrics.confirmedScientificData}
                </p>
              </div>
            )}

            {specimen.morphometrics.sympatricSpecies.length > 0 && (
              <div className="p-3 rounded-lg bg-[#f2f4ee] flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#002217]">
                  <span className="material-symbols-outlined text-[18px]">group_work</span>
                  <span className="font-bold text-[14px]">Especies Simpátricas Registradas</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {specimen.morphometrics.sympatricSpecies.map((symp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-white shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold italic text-[#002217] truncate">
                          {symp.scientificName}
                        </p>
                        <p className="text-[11px] text-[#414844]">{symp.commonName}</p>
                      </div>
                      <span className="font-mono text-[11px] text-[#006c49] font-bold">
                        N={symp.count} ind.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Specimen Morphological Gallery Mosaic */}
        {specimen.additionalPhotos.length > 0 && (
          <section className="px-4 mt-4">
            <div className="p-4 rounded-xl bg-white shadow-sm flex flex-col gap-3 border border-[#e1e3dd]/80">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[16px] text-[#002217] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[20px]">photo_library</span>
                  Registros Fotográficos Complementarios
                </h3>
                <span className="font-mono text-[11px] text-[#414844] font-semibold">
                  {specimen.additionalPhotos.length} Archivos
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {specimen.additionalPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative rounded-lg overflow-hidden h-28 group bg-[#e7e9e3] border border-[#c1c8c3]/40 hover:border-[#006c49] transition-all"
                  >
                    <div
                      onClick={() =>
                        setActivePhotoModal({
                          id: photo.id,
                          url: photo.url,
                          label: photo.label,
                          desc: photo.description,
                        })
                      }
                      className="w-full h-full cursor-pointer"
                    >
                      <img
                        src={photo.url}
                        alt={photo.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const isMacho = photo.id === 'photo-4' || (photo.label && photo.label.toLowerCase().includes('macho tuerto'));
                          handleImageOfflineFallback(e.currentTarget as HTMLImageElement, isMacho ? '/hallazgo_macho_un_ojo.jpg' : '/isthmohyla_nacientes.jpg');
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Input de archivo nativo directo */}
                    <input
                      type="file"
                      id={`file-input-${photo.id}`}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDirectPhotoUpload(photo.id, file);
                        }
                      }}
                    />

                    {/* Botón táctil directo para sustituir foto */}
                    <label
                      htmlFor={`file-input-${photo.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-[#002217] hover:bg-[#006c49] active:scale-90 text-[#6cf8bb] flex items-center justify-center transition-all shadow-md cursor-pointer z-20 border border-[#6cf8bb]/60 hover:border-white"
                      title="Sustituir fotografía desde tu dispositivo"
                    >
                      <span className="material-symbols-outlined text-[17px]">edit</span>
                    </label>

                    <span className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#002217]/90 text-white font-mono text-[10px] truncate block pointer-events-none">
                      {photo.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ESPACIO PERMANENTE: HALLAZGOS CURIOSOS DE CAMPO (Ordenados por fecha de visita) */}
        {(() => {
          const curiousSightings = (specimen.sightings || [])
            .filter((s) => s.isCuriousFinding || s.curiousFindingTitle)
            .sort((a, b) => {
              const dateA = a.date || a.timestamp || '';
              const dateB = b.date || b.timestamp || '';
              return dateB.localeCompare(dateA);
            });

          if (curiousSightings.length === 0) return null;

          return (
            <section className="px-4 mt-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#fffdf5] via-[#fffbeb] to-[#fef3c7] border-2 border-[#f59e0b] shadow-md flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#fde68a] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#f59e0b] text-[#78350f] flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[20px] text-white">psychology_alt</span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[15px] text-[#78350f] tracking-tight flex items-center gap-1.5">
                        <span>Hallazgos Curiosos de Campo</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f59e0b] text-white text-[10px] font-mono font-bold">
                          {curiousSightings.length} {curiousSightings.length === 1 ? 'hallazgo' : 'hallazgos'}
                        </span>
                      </h3>
                      <span className="text-[11px] text-[#92400e]">
                        Observaciones y peculiaridades biológicas singulares ordenadas por fecha de visita
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {curiousSightings.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl bg-white border border-[#fcd34d] shadow-sm flex flex-col md:flex-row gap-3 items-start"
                    >
                      {/* Foto del hallazgo */}
                      {(c.curiousFindingPhoto || (c.photoUrls && c.photoUrls[0]) || '/hallazgo_macho_un_ojo.jpg') && (
                        <div
                          onClick={() =>
                            setActivePhotoModal({
                              id: `curious-${c.id}`,
                              url: c.curiousFindingPhoto || '/hallazgo_macho_un_ojo.jpg',
                              label: c.curiousFindingTitle || 'Macho cantor al que le falta un ojo (Anoftalmia)',
                              desc: c.curiousFindingDescription || c.behaviorObserved || '',
                              sightingId: c.id,
                            })
                          }
                          className="relative w-full md:w-36 h-36 rounded-xl overflow-hidden bg-[#241a0e] flex-shrink-0 cursor-pointer group border border-[#fde68a]"
                        >
                          <img
                            src={c.curiousFindingPhoto || '/hallazgo_macho_un_ojo.jpg'}
                            alt={c.curiousFindingTitle || 'Foto del hallazgo'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              handleImageOfflineFallback(e.currentTarget as HTMLImageElement, '/hallazgo_macho_un_ojo.jpg');
                            }}
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

                          {/* Botón directo para sustituir SOLO esta foto en esta escena */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentUrl = c.curiousFindingPhoto || '/hallazgo_macho_un_ojo.jpg';
                              setEditingPhoto({
                                id: `sighting-curious-${c.id}`,
                                sightingId: c.id,
                                label: c.curiousFindingTitle || 'Macho cantor al que le falta un ojo (Anoftalmia)',
                                url: currentUrl,
                                description: c.curiousFindingDescription || c.behaviorObserved || '',
                              });
                              setEditPhotoUrl(currentUrl);
                              setEditPhotoDesc(c.curiousFindingDescription || c.behaviorObserved || '');
                            }}
                            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-lg bg-[#002217] hover:bg-[#006c49] text-[#6cf8bb] flex items-center justify-center transition-all cursor-pointer z-20 border border-[#6cf8bb]/60 shadow-md active:scale-95"
                            title="Cambiar fotografía del macho tuerto en esta escena"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>

                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                          </div>
                          <span className="absolute bottom-1 left-1 bg-[#b45309] text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                            FOTO ADJUNTA
                          </span>
                        </div>
                      )}

                      {/* Información del hallazgo */}
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-mono text-[10px] text-[#b45309] font-bold bg-[#fef3c7] px-2 py-0.5 rounded-md border border-[#fde68a] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                            {c.timestamp}
                          </span>
                          <span className="text-[11px] font-semibold text-[#78350f] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">location_on</span>
                            {c.locality}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-[14px] text-[#78350f] leading-snug">
                          {c.curiousFindingTitle || 'Peculiaridad morfológica o etológica'}
                        </h4>

                        <p className="text-xs text-[#451a03] leading-relaxed">
                          {c.curiousFindingDescription || c.behaviorObserved}
                        </p>

                        {/* Botones directos para aplicar/subir foto de Macho Tuerto en esta escena */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-[#fde68a]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveCuriousFindingPhoto(c.id, '/hallazgo_macho_un_ojo.jpg');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#b45309] hover:bg-[#78350f] text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            title="Asignar la fotografía del macho tuerto (/hallazgo_macho_un_ojo.jpg) a esta escena"
                          >
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            <span>Asignar Foto Macho Tuerto</span>
                          </button>

                          <label
                            htmlFor={`file-input-curious-direct-${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer border border-[#6cf8bb]/40"
                            title="Subir imagen propia desde este dispositivo para este hallazgo"
                          >
                            <span className="material-symbols-outlined text-[14px]">upload_file</span>
                            <span>Subir Foto Propia</span>
                          </label>
                          <input
                            type="file"
                            id={`file-input-curious-direct-${c.id}`}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleSaveCuriousFindingPhoto(c.id, file);
                              }
                            }}
                          />
                        </div>

                        <div className="mt-1 pt-1.5 border-t border-[#fef3c7] flex flex-wrap items-center gap-2 text-[11px] text-[#92400e]">
                          {c.microhabitat && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">nature</span>
                              {c.microhabitat}
                            </span>
                          )}
                          {c.count && (
                            <span className="font-mono font-bold text-[#b45309]">
                              • Total en coro: N={c.count} individuos
                            </span>
                          )}
                          <span className="text-[#a16207]">
                            • Observador: {c.observer}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Success toast notification */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-2 p-3 rounded-xl bg-[#002217] text-[#6cf8bb] text-xs font-bold flex items-center justify-between shadow-lg border border-[#6cf8bb]/40 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{saveSuccessMsg}</span>
            </div>
            <button onClick={() => setSaveSuccessMsg(null)} className="text-white hover:text-[#6cf8bb]">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Registro de Avistamientos / Entradas de Vistas */}
        <section className="px-4 mt-4">
          <div className="p-4 rounded-xl bg-white shadow-sm flex flex-col gap-3 border border-[#e1e3dd]/80">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-[16px] text-[#002217] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">visibility</span>
                Historial de Avistamientos &amp; Entradas ({specimen.sightings?.length || 0} en total • {specimen.sightings && specimen.sightings.length > 0 ? specimen.sightings.reduce((acc, s) => acc + (s.count || s.individualsCount || 0), 0) : 0} individuos observados)
              </h3>
              <button
                onClick={handleOpenAddSighting}
                className="px-3 py-1.5 rounded-lg bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ Nuevo Avistamiento</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {specimen.sightings && specimen.sightings.length > 0 ? (
                [...specimen.sightings]
                  .sort((a, b) => {
                    const keyA = `${parseDateToYmd(a.date, a.timestamp)} ${parseTimeToHm(a.timestamp)}`;
                    const keyB = `${parseDateToYmd(b.date, b.timestamp)} ${parseTimeToHm(b.timestamp)}`;
                    return keyB.localeCompare(keyA);
                  })
                  .map((sight) => (
                  <div
                    key={sight.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 text-xs transition-colors ${
                      sight.isCuriousFinding || sight.curiousFindingTitle
                        ? 'bg-[#fffdf5] border-[#f59e0b] shadow-xs'
                        : 'bg-[#f2f4ee] border-[#e1e3dd] hover:border-[#006c49]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#002217] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px] text-[#006c49]">pin_drop</span>
                          {sight.locality}
                        </span>
                        {(sight.isCuriousFinding || sight.curiousFindingTitle) && (
                          <span className="px-1.5 py-0.5 rounded bg-[#f59e0b] text-white text-[9px] font-bold font-mono uppercase flex items-center gap-0.5 shadow-2xs">
                            <span className="material-symbols-outlined text-[11px]">psychology_alt</span>
                            Hallazgo Curioso
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] text-[#006c49] font-bold bg-white px-2 py-1 rounded-lg border border-[#e1e3dd]">
                          N={sight.count || sight.individualsCount || 1} ind. • {sight.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditSighting(sight)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#c1c8c3] text-[#006c49] hover:bg-[#006c49] hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          title="Editar día, hora y datos de este avistamiento"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSighting(sight.id)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#c1c8c3] text-[#717974] hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          title="Eliminar este avistamiento"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {(sight.curiousFindingTitle || sight.curiousFindingDescription) && (
                      <div className="p-2 rounded-lg bg-[#fef3c7] border border-[#fde68a] flex flex-col gap-1 text-[#78350f]">
                        <span className="font-bold text-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#b45309]">star</span>
                          {sight.curiousFindingTitle}
                        </span>
                        {sight.curiousFindingDescription && (
                          <p className="text-[11px] text-[#92400e] leading-snug">{sight.curiousFindingDescription}</p>
                        )}
                      </div>
                    )}

                    <p className="text-[#191c19] mt-0.5">{sight.behaviorObserved}</p>
                    {sight.microhabitat && (
                      <span className="text-[11px] text-[#414844]">
                        Hábitat: {sight.microhabitat} {sight.weather || sight.weatherConditions ? `• ${sight.weather || sight.weatherConditions}` : ''}
                      </span>
                    )}
                    {sight.notes && (
                      <p className="text-[11px] text-[#717974] italic border-t border-[#e1e3dd] pt-1">
                        Nota: {sight.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-[#f2f4ee] text-xs text-[#414844] flex items-center justify-between">
                  <span>Primer avistamiento de colecta registrado ({specimen.collectionDate}).</span>
                  <button
                    onClick={handleOpenAddSighting}
                    className="text-[#006c49] font-bold hover:underline cursor-pointer"
                  >
                    Añadir nuevo
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Primary & Secondary Action Commands */}
        <section className="px-4 mt-6 flex flex-col gap-2.5">

          {/* Primary CTA: Edit & Curate Specimen */}
          <button
            onClick={() => onEdit(specimen)}
            className="w-full h-11 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3] font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-[#006c49]">edit_note</span>
            <span>Editar Registro Científico</span>
          </button>

          {/* Secondary Split CTAs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenDarwinCoreModal(specimen)}
              className="h-11 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3]/60 font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#006c49]">file_download</span>
              <span>Exportar Darwin Core</span>
            </button>
            <button
              onClick={() => onOpenMap(specimen)}
              className="h-11 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3]/60 font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#006c49]">public</span>
              <span>Ver en Mapa Global</span>
            </button>
          </div>

          {/* THE REQUESTED DELETE BUTTON */}
          <div className="pt-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[13px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span>Eliminar Registro Científico</span>
            </button>
          </div>
        </section>
      </div>

      {/* Audio Recording / Upload Modal */}
      <AudioRecordingModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        initialBioacoustics={specimen.bioacoustics}
        onSave={(bio) => onUpdateBioacoustics(specimen.id, bio)}
      />

      {/* Delete Confirmation Alert Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h4 className="font-bold text-center text-[#002217] text-base">
              ¿Eliminar este registro científico?
            </h4>
            <p className="text-xs text-center text-[#414844]">
              Se eliminará definitivamente la ficha de <strong className="italic">{specimen.scientificName}</strong> ({specimen.catalogNumber}). Esta acción no se puede deshacer.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f2f4ee] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete?.(specimen.id);
                }}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Directo: Registrar Nuevo Avistamiento */}
      {isAddSightingModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e1e3dd] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#002217] text-[#6cf8bb] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">
                    {editingSightingId ? 'edit_calendar' : 'add_location_alt'}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#002217]">
                    {editingSightingId ? 'Editar Avistamiento Registrado' : 'Nuevo Avistamiento en Campo'}
                  </h4>
                  <span className="text-[11px] text-[#717974] italic">
                    {specimen.scientificName} • Permite registrar y editar hora y día
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddSightingModalOpen(false);
                  setEditingSightingId(null);
                }}
                className="w-8 h-8 rounded-full text-[#717974] hover:bg-[#f0f2ec] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDirectSighting} className="flex flex-col gap-3">
              {/* Fecha y Hora del Avistamiento (Día y Hora editables para avistamientos anteriores) */}
              <div className="p-3 rounded-xl bg-[#f0f5ee] border border-[#c1d0c4] flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-[11px] font-bold text-[#002217] uppercase flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">calendar_clock</span>
                    <span>Fecha y Hora del Avistamiento *</span>
                  </label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#c1c8c3] text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSightingPrecision('exact')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                        sightingPrecision === 'exact'
                          ? 'bg-[#006c49] text-white font-bold shadow-2xs'
                          : 'text-[#414844] hover:text-black'
                      }`}
                    >
                      Día y Hora Exactos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSightingPrecision('month_year')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                        sightingPrecision === 'month_year'
                          ? 'bg-[#006c49] text-white font-bold shadow-2xs'
                          : 'text-[#414844] hover:text-black'
                      }`}
                      title="Para avistamientos históricos sin hora fija"
                    >
                      Mes / Año Aprox.
                    </button>
                  </div>
                </div>

                {sightingPrecision === 'exact' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                        Día / Fecha del Avistamiento *
                      </label>
                      <input
                        type="date"
                        required
                        value={sightingDate}
                        onChange={(e) => setSightingDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] bg-white text-xs font-mono font-bold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                        Hora (Formato 24h CST) *
                      </label>
                      <input
                        type="time"
                        required
                        value={sightingTime}
                        onChange={(e) => setSightingTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] bg-white text-xs font-mono font-bold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                      Mes y Año del Avistamiento Anterior *
                    </label>
                    <input
                      type="month"
                      required
                      value={sightingMonthYear}
                      onChange={(e) => setSightingMonthYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] bg-white text-xs font-mono font-bold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                )}

                {/* Atajos para ingresar avistamientos pasados o actuales con un clic */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[#717974] font-medium">Atajos rápidos:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setSightingDate(now.toISOString().slice(0, 10));
                      setSightingTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      setSightingPrecision('exact');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#c1c8c3] text-[#006c49] font-semibold hover:bg-[#e6f4ea] cursor-pointer shadow-2xs"
                  >
                    Hoy (Ahora)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yesterday = new Date(Date.now() - 86400000);
                      setSightingDate(yesterday.toISOString().slice(0, 10));
                      setSightingPrecision('exact');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] cursor-pointer shadow-2xs"
                  >
                    Ayer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSightingDate('2026-10-09');
                      setSightingTime('20:15');
                      setSightingPrecision('exact');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] cursor-pointer shadow-2xs"
                  >
                    09 Oct 2026 (Dota)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSightingDate('2026-02-16');
                      setSightingTime('06:15');
                      setSightingPrecision('exact');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] cursor-pointer shadow-2xs"
                  >
                    16 Feb 2026 (Tarrazú)
                  </button>
                </div>
              </div>
              {/* Observador */}
              <div>
                <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                  Observador / Registrador *
                </label>
                <input
                  type="text"
                  required
                  value={sightingObserver}
                  onChange={(e) => setSightingObserver(e.target.value)}
                  placeholder="Nombre de quien realiza el avistamiento..."
                  className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                />
              </div>

              {/* Ubicación Geográfica, Coordenadas y Zona de Vida del Avistamiento */}
              <div className="p-3.5 rounded-2xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">location_on</span>
                    Ubicación y Zona de Vida del Avistamiento
                  </label>
                  <span className="text-[10px] font-mono font-bold text-[#006c49] bg-[#6cf8bb]/20 px-2 py-0.5 rounded-md">
                    WGS84 • Costa Rica
                  </span>
                </div>

                {/* Selector: Automático por Mapa vs Entrada Manual */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#edefe9] rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setShowSightingMap(true)}
                    className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      showSightingMap
                        ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                        : 'text-[#414844] hover:text-[#191c19]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">map</span>
                    <span>Mapa (Automático)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSightingMap(false)}
                    className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      !showSightingMap
                        ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                        : 'text-[#414844] hover:text-[#191c19]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_location_alt</span>
                    <span>Manual</span>
                  </button>
                </div>

                {showSightingMap ? (
                  <div className="flex flex-col gap-2">
                    <div className="p-2 rounded-lg bg-[#f0f4ee] border border-[#c1ecd7] text-[11px] text-[#002116] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#006c49] text-[16px]">touch_app</span>
                      <span>Toca en el mapa para colocar el avistamiento. El sistema leerá las coordenadas y la zona de vida automáticamente.</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-[#c1c8c3] h-60 relative shadow-sm">
                      <CostaRicaMap
                        pickerMode={true}
                        initialCoords={sightingCoords}
                        onCoordsChange={(newCoords) => {
                          setSightingCoords({ lat: newCoords.lat, lng: newCoords.lng });
                          const detected = detectLocationAndLifeZone(newCoords.lat, newCoords.lng);
                          setSightingLocality(detected.locality);
                          setSightingCoordsDms(detected.dms);
                          setSightingLifeZone(detected.lifeZone);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                        Latitud (Decimal N)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={sightingCoords.lat}
                        onChange={(e) => {
                          const lat = parseFloat(e.target.value);
                          if (!isNaN(lat)) {
                            const next = { ...sightingCoords, lat };
                            setSightingCoords(next);
                            setSightingCoordsDms(formatCoordinatesDMS(lat, sightingCoords.lng).combined);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] bg-white focus:ring-2 focus:ring-[#006c49]"
                        placeholder="ej. 9.6608"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                        Longitud (Decimal W)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={sightingCoords.lng}
                        onChange={(e) => {
                          const lng = parseFloat(e.target.value);
                          if (!isNaN(lng)) {
                            const next = { ...sightingCoords, lng };
                            setSightingCoords(next);
                            setSightingCoordsDms(formatCoordinatesDMS(sightingCoords.lat, lng).combined);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] bg-white focus:ring-2 focus:ring-[#006c49]"
                        placeholder="ej. -84.0205"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          const detected = detectLocationAndLifeZone(sightingCoords.lat, sightingCoords.lng);
                          setSightingLocality(detected.locality);
                          setSightingCoordsDms(detected.dms);
                          setSightingLifeZone(detected.lifeZone);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#006c49] hover:bg-[#003d2b] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                        <span>Calcular Lugar y Zona de Vida con estas coordenadas</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Localidad input */}
                <div>
                  <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                    Localidad / Punto de Avistamiento *
                  </label>
                  <input
                    type="text"
                    required
                    value={sightingLocality}
                    onChange={(e) => setSightingLocality(e.target.value)}
                    placeholder="Ej: Quebrada en Santa María de Dota, Los Santos"
                    className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs font-semibold text-[#191c19] bg-white focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                  />
                </div>

                {/* Coordenadas DMS & Zona de Vida */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Coordenadas Registradas
                    </label>
                    <span className="font-mono font-bold text-[#002217] block truncate bg-white px-2.5 py-1.5 rounded-lg border border-[#c1c8c3]">
                      {sightingCoordsDms || 'No calculadas'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Zona de Vida (Holdridge)
                    </label>
                    <input
                      type="text"
                      value={sightingLifeZone}
                      onChange={(e) => setSightingLifeZone(e.target.value)}
                      placeholder="Ej: Bosque Pluvial Montano Bajo (bp-MB)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#c1c8c3] bg-white text-xs text-[#002217] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                </div>
              </div>

              {/* Cantidad de Individuos y Clima */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                    Individuos (N) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sightingCount}
                    onChange={(e) => setSightingCount(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                    Clima / Temperatura
                  </label>
                  <input
                    type="text"
                    value={sightingWeather}
                    onChange={(e) => setSightingWeather(e.target.value)}
                    placeholder="Ej: Soleado 26°C"
                    className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                  />
                </div>
              </div>

              {/* Microhábitat */}
              <div>
                <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                  Microhábitat / Estrato
                </label>
                <input
                  type="text"
                  value={sightingMicrohabitat}
                  onChange={(e) => setSightingMicrohabitat(e.target.value)}
                  placeholder="Ej: Envés de hoja de Heliconia sobre charca..."
                  className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                />
              </div>

              {/* Condición de Vitalidad (Vivo / Muerto por atropello u otra causa) */}
              <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#002217] uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">vital_signs</span>
                    Condición de Vitalidad del Individuo *
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="vitality"
                        value="VIVO"
                        checked={sightingVitality === 'VIVO'}
                        onChange={() => setSightingVitality('VIVO')}
                        className="text-[#006c49] focus:ring-[#006c49]"
                      />
                      <span className="font-bold text-[#006c49]">Vivo</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="vitality"
                        value="MUERTO"
                        checked={sightingVitality === 'MUERTO'}
                        onChange={() => setSightingVitality('MUERTO')}
                        className="text-red-600 focus:ring-red-600"
                      />
                      <span className="font-bold text-red-600">Muerto</span>
                    </label>
                  </div>
                </div>

                {sightingVitality === 'MUERTO' && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex flex-col gap-2 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-red-800 uppercase mb-1">
                          Causa de Muerte
                        </label>
                        <select
                          value={sightingVitalityCause}
                          onChange={(e) => setSightingVitalityCause(e.target.value as VitalityCause)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="ATROPELLO">Atropello (Vial / Carretera)</option>
                          <option value="DEPREDACION">Depredación natural</option>
                          <option value="DESECACION">Desecación / Sequía</option>
                          <option value="ENFERMEDAD_HONGOS">Enfermedad / Quitridiomicosis</option>
                          <option value="CAUSA_DESCONOCIDA">Causa desconocida</option>
                          <option value="OTRO">Otro motivo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-red-800 uppercase mb-1">
                          Detalle / Ubicación del atropello
                        </label>
                        <input
                          type="text"
                          value={sightingVitalityDetail}
                          onChange={(e) => setSightingVitalityDetail(e.target.value)}
                          placeholder="Ej: Asfalto de carretera, borde de calzada..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-red-300 bg-white text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Estadio de Desarrollo & Sexo (Larva, Renacuajo, Huevo, Adulto, etc.) */}
              <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-2">
                <span className="text-[11px] font-bold text-[#002217] uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#006c49]">egg_alt</span>
                  Estadio de Desarrollo &amp; Sexo
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                      Estadio del individuo
                    </label>
                    <select
                      value={sightingLifeStage}
                      onChange={(e) => setSightingLifeStage(e.target.value as LifeStage)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#c1c8c3] bg-white text-xs font-semibold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                    >
                      <option value="ADULTO">Adulto</option>
                      <option value="SUBADULTO">Subadulto</option>
                      <option value="METAMORFO_JUVENIL">Juvenil / Metamorfo reciente</option>
                      <option value="LARVA_RENACUAJO">Larva / Renacuajo</option>
                      <option value="HUEVO">Huevo / Masa de huevos</option>
                      <option value="NO_APLICA">No aplica (No especificado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-1">
                      Sexo Biológico
                    </label>
                    <select
                      value={sightingSex}
                      onChange={(e) => setSightingSex(e.target.value as BiologicalSex)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#c1c8c3] bg-white text-xs font-semibold text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                    >
                      <option value="NO_APLICA">No aplica (Ocultar)</option>
                      <option value="MACHO">Macho</option>
                      <option value="HEMBRA">Hembra</option>
                      <option value="INDETERMINADO">Indeterminado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Comportamiento Observado */}
              <div>
                <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                  Comportamiento Observado *
                </label>
                <textarea
                  required
                  rows={2}
                  value={sightingBehavior}
                  onChange={(e) => setSightingBehavior(e.target.value)}
                  placeholder="Ej: Vocalizando activamente para delimitación territorial..."
                  className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                />
              </div>

              {/* Notas de Campo */}
              <div>
                <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                  Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  value={sightingNotes}
                  onChange={(e) => setSightingNotes(e.target.value)}
                  placeholder="Detalles morfológicos, presencia de crías, depredadores cercanos..."
                  className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                />
              </div>

              {/* Registro de Hallazgo Curioso Opcional */}
              <div className="p-3 rounded-xl bg-[#fff8e1] border border-[#ffe082] flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sightingIsCurious}
                    onChange={(e) => setSightingIsCurious(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f59e0b] focus:ring-[#f59e0b]"
                  />
                  <span className="text-xs font-bold text-[#92400e] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">psychology_alt</span>
                    ¿Marcar como Hallazgo Curioso de esta visita?
                  </span>
                </label>

                {sightingIsCurious && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-[#fde68a]">
                    <div>
                      <label className="block text-[10px] font-bold text-[#92400e] uppercase mb-1">
                        Título del Hallazgo Curioso *
                      </label>
                      <input
                        type="text"
                        required={sightingIsCurious}
                        value={sightingCuriousTitle}
                        onChange={(e) => setSightingCuriousTitle(e.target.value)}
                        placeholder="Ej: Macho cantor al que le falta un ojo..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#fde68a] bg-white text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#92400e] uppercase mb-1">
                        Descripción detallada del hallazgo *
                      </label>
                      <textarea
                        rows={2}
                        required={sightingIsCurious}
                        value={sightingCuriousDesc}
                        onChange={(e) => setSightingCuriousDesc(e.target.value)}
                        placeholder="Describe la peculiaridad observada, altura, distancia, comportamiento..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#fde68a] bg-white text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#92400e] uppercase mb-1">
                        Adjuntar Fotografía del Hallazgo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const isMacho = sightingCuriousTitle.toLowerCase().includes('macho') || sightingCuriousDesc.toLowerCase().includes('macho') || sightingCuriousTitle.toLowerCase().includes('ojo');
                              const permanentUrl = await saveImageOfflineAndServer(file, isMacho ? 'macho_tuerto' : 'sighting_curious');
                              setSightingCuriousPhoto(permanentUrl);
                            } catch (err) {
                              console.error('Error al guardar foto del hallazgo:', err);
                            }
                          }
                        }}
                        className="w-full text-xs text-[#92400e] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#92400e] file:text-white file:cursor-pointer cursor-pointer"
                      />
                      {sightingCuriousPhoto && (
                        <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-[#fde68a]">
                          <img src={sightingCuriousPhoto} alt="Previa" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e1e3dd]">
                <button
                  type="button"
                  onClick={() => setIsAddSightingModalOpen(false)}
                  className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f0f2ec] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-3 rounded-xl bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {editingSightingId ? 'check_circle' : 'save'}
                  </span>
                  <span>{editingSightingId ? 'Actualizar Avistamiento' : 'Guardar Avistamiento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Photo Modal */}
      {isChangePhotoModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-5 shadow-2xl border border-[#c1c8c3] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#e1e3dd] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#e8f5e9] text-[#006c49] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#002217] text-sm">Actualizar Fotografía</h3>
                  <p className="text-[11px] text-[#717974]">{specimen.scientificName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsChangePhotoModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f0f2ec] text-[#414844] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Preview */}
            <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-black/10 border border-[#c1c8c3] flex items-center justify-center">
              {newPhotoUrl ? (
                <img
                  src={newPhotoUrl}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                  onError={() => {}}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#717974]">
                  <span className="material-symbols-outlined text-3xl">image</span>
                  <span className="text-xs">Sin fotografía seleccionada</span>
                </div>
              )}
            </div>

            {/* File Upload Option */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Subir desde este dispositivo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const permanentUrl = await saveImageOfflineAndServer(file, 'hero_specimen');
                      setNewPhotoUrl(permanentUrl);
                    } catch (err) {
                      console.error('Error saving hero photo:', err);
                    }
                  }
                }}
                className="w-full text-xs text-[#414844] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#002217] file:text-[#6cf8bb] file:cursor-pointer hover:file:bg-[#003d2b] cursor-pointer"
              />
            </div>

            {/* URL Option */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                O pegar enlace URL de la imagen
              </label>
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://ejemplo.com/isthmohyla_nacientes.jpg"
                className="w-full px-3 py-2 text-xs bg-[#f8faf4] border border-[#c1c8c3] rounded-xl text-[#191c19] focus:outline-none focus:border-[#006c49]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Descripción / Pie de foto
              </label>
              <input
                type="text"
                value={newPhotoDescription}
                onChange={(e) => setNewPhotoDescription(e.target.value)}
                placeholder="Ej. Espécimen vivo de Isthmohyla nacientes en Quebrada Las Nacientes..."
                className="w-full px-3 py-2 text-xs bg-[#f8faf4] border border-[#c1c8c3] rounded-xl text-[#191c19] focus:outline-none focus:border-[#006c49]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e1e3dd]">
              <button
                type="button"
                onClick={() => setIsChangePhotoModalOpen(false)}
                className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f0f2ec] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newPhotoUrl) {
                    onSaveSpecimen?.({
                      ...specimen,
                      heroImage: newPhotoUrl,
                      heroImageDescription:
                        newPhotoDescription || `Fotografía de ${specimen.scientificName}`,
                    });
                    setIsChangePhotoModalOpen(false);
                    setSaveSuccessMsg('¡Fotografía del espécimen actualizada con éxito!');
                    setTimeout(() => setSaveSuccessMsg(null), 3000);
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Guardar Fotografía</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para sustituir / editar fotografía de la galería (ej. Detalle Ocular) */}
      {editingPhoto && (
        <div className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-5 shadow-2xl border border-[#c1c8c3] flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e1e3dd] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#002217] text-[#6cf8bb] flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[19px]">edit</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#002217] text-sm">Sustituir Fotografía</h3>
                  <p className="text-[11px] text-[#006c49] font-medium">{editingPhoto.label}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPhoto(null)}
                className="w-8 h-8 rounded-full hover:bg-[#f0f2ec] text-[#414844] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Vista previa de la foto */}
            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-black/10 border border-[#c1c8c3] flex items-center justify-center">
              {editPhotoUrl ? (
                <img
                  src={editPhotoUrl}
                  alt={editingPhoto.label}
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#717974]">
                  <span className="material-symbols-outlined text-3xl">image</span>
                  <span className="text-xs">Sin imagen seleccionada</span>
                </div>
              )}
            </div>

            {/* Subir archivo desde dispositivo */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Subir nueva imagen desde este dispositivo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const isMacho = editingPhoto?.id === 'photo-4' || editingPhoto?.sightingId || editingPhoto?.label?.toLowerCase().includes('macho tuerto');
                      const permanentUrl = await saveImageOfflineAndServer(file, isMacho ? 'macho_tuerto' : 'gallery_edit');
                      setEditPhotoUrl(permanentUrl);
                    } catch (err) {
                      console.error('Error saving image:', err);
                    }
                  }
                }}
                className="w-full text-xs text-[#414844] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#002217] file:text-[#6cf8bb] file:cursor-pointer hover:file:bg-[#003d2b] cursor-pointer"
              />
            </div>

            {/* Opción Enlace URL */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                O pegar dirección URL de la fotografía
              </label>
              <input
                type="url"
                value={editPhotoUrl}
                onChange={(e) => setEditPhotoUrl(e.target.value)}
                placeholder="/isthmohyla_nacientes_eye_zoom.jpg o https://..."
                className="w-full px-3 py-2 text-xs bg-[#f8faf4] border border-[#c1c8c3] rounded-xl text-[#191c19] focus:outline-none focus:border-[#006c49]"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Descripción / Pie de foto
              </label>
              <textarea
                rows={2}
                value={editPhotoDesc}
                onChange={(e) => setEditPhotoDesc(e.target.value)}
                placeholder="Detalle de la fotografía..."
                className="w-full px-3 py-2 text-xs bg-[#f8faf4] border border-[#c1c8c3] rounded-xl text-[#191c19] focus:outline-none focus:border-[#006c49]"
              />
            </div>

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e1e3dd]">
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f0f2ec] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editPhotoUrl) {
                    let updatedSightings = specimen.sightings || [];
                    let updatedPhotos = [...(specimen.additionalPhotos || [])];

                    if (editingPhoto.sightingId) {
                      // 1. UPDATE ONLY THIS SIGHTING'S PHOTO IN THIS EXACT SCENE
                      updatedSightings = updatedSightings.map((s) => {
                        if (s.id === editingPhoto.sightingId) {
                          return {
                            ...s,
                            curiousFindingPhoto: editPhotoUrl,
                            photoUrls: [editPhotoUrl],
                            curiousFindingDescription: editPhotoDesc || s.curiousFindingDescription,
                          };
                        }
                        return s;
                      });

                      // 2. Also update photo-4 ("Hallazgo: Macho Tuerto") if present
                      const p4Idx = updatedPhotos.findIndex(
                        (p) => p.id === 'photo-4' || p.label.toLowerCase().includes('macho tuerto')
                      );
                      if (p4Idx >= 0) {
                        updatedPhotos[p4Idx] = {
                          ...updatedPhotos[p4Idx],
                          url: editPhotoUrl,
                          description: editPhotoDesc || updatedPhotos[p4Idx].description,
                        };
                      }
                    } else {
                      // Regular additionalPhotos gallery update
                      updatedPhotos = updatedPhotos.map((p) => {
                        if (p.id === editingPhoto.id) {
                          return {
                            ...p,
                            url: editPhotoUrl,
                            description: editPhotoDesc || p.description,
                          };
                        }
                        return p;
                      });
                    }

                    // CRITICAL: Ensure photo-3 "Detalle Ocular" NEVER gets changed to macho tuerto!
                    const p3Idx = updatedPhotos.findIndex(
                      (p) => p.id === 'photo-3' || p.label === 'Detalle Ocular'
                    );
                    if (p3Idx >= 0 && updatedPhotos[p3Idx].url.includes('macho_un_ojo')) {
                      updatedPhotos[p3Idx] = {
                        ...updatedPhotos[p3Idx],
                        url: '/isthmohyla_nacientes_eye_zoom.jpg',
                        description:
                          'Macro zoom de alta precisión y nitidez del ojo de Isthmohyla nacientes.',
                      };
                    }

                    const updatedSpecimen: SpecimenRecord = {
                      ...specimen,
                      sightings: updatedSightings,
                      additionalPhotos: updatedPhotos,
                    };

                    if (onSaveSpecimen) {
                      onSaveSpecimen(updatedSpecimen);
                    }
                    setEditingPhoto(null);
                    setSaveSuccessMsg(
                      `¡Fotografía "${editingPhoto.label}" sustituida y guardada permanentemente en esta escena!`
                    );
                    setTimeout(() => setSaveSuccessMsg(null), 3500);
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Guardar y Sustituir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / High-Res Photo Modal */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActivePhotoModal(null)}
        >
          <div
            className="max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-h-[70vh] bg-black flex items-center justify-center">
              <img
                src={activePhotoModal.url}
                alt={activePhotoModal.label}
                className="max-h-[70vh] w-auto object-contain"
              />
              <button
                onClick={() => setActivePhotoModal(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#006c49] uppercase">
                  {activePhotoModal.label}
                </span>
                <button
                  onClick={() => {
                    if (activePhotoModal.sightingId) {
                      const sightingId = activePhotoModal.sightingId;
                      setActivePhotoModal(null);
                      setEditingPhoto({
                        id: `sighting-curious-${sightingId}`,
                        sightingId: sightingId,
                        label: activePhotoModal.label,
                        url: activePhotoModal.url,
                        description: activePhotoModal.desc,
                      });
                      setEditPhotoUrl(activePhotoModal.url);
                      setEditPhotoDesc(activePhotoModal.desc);
                      return;
                    }

                    const target =
                      (activePhotoModal.id ? specimen.additionalPhotos?.find((p) => p.id === activePhotoModal.id) : null) ||
                      specimen.additionalPhotos?.find((p) => p.label === activePhotoModal.label) ||
                      specimen.additionalPhotos?.find((p) => p.url === activePhotoModal.url) || {
                        id: activePhotoModal.id || 'photo-1',
                        label: activePhotoModal.label,
                        url: activePhotoModal.url,
                        description: activePhotoModal.desc,
                      };
                    setActivePhotoModal(null);
                    setEditingPhoto(target);
                    setEditPhotoUrl(target.url);
                    setEditPhotoDesc(target.description);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#002217] text-[#6cf8bb] text-xs font-bold hover:bg-[#003d2b] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>Sustituir fotografía</span>
                </button>
              </div>
              <p className="text-sm text-[#191c19]">{activePhotoModal.desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
