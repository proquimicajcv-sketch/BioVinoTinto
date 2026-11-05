import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SpecimenRecord, TaxonGroup } from '../types/specimen';
import {
  COSTA_RICA_CENTER,
  COSTA_RICA_HOTSPOTS,
  CONSERVATION_AREAS_CR,
  formatCoordinatesDMS,
  findNearestHotspot,
  estimateHoldridgeZone,
  isWithinCostaRica,
} from '../data/costaRicaData';

interface CostaRicaMapProps {
  specimens?: SpecimenRecord[];
  onSelectSpecimen?: (specimen: SpecimenRecord) => void;
  onOpenNewSpecimen?: (coords: { lat: number; lng: number; locality: string; lifeZone: string }) => void;
  // If provided, the map acts in "picker" mode
  pickerMode?: boolean;
  initialCoords?: { lat: number; lng: number };
  onCoordsChange?: (coords: {
    lat: number;
    lng: number;
    dms: string;
    locality?: string;
    lifeZone?: string;
    elevation?: number;
    province?: string;
  }) => void;
  isOnlineMode?: boolean;
}

export const CostaRicaMap: React.FC<CostaRicaMapProps> = ({
  specimens = [],
  onSelectSpecimen,
  onOpenNewSpecimen,
  pickerMode = false,
  initialCoords,
  onCoordsChange,
  isOnlineMode = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const manualPinMarkerRef = useRef<L.Marker | null>(null);
  const userGpsCircleRef = useRef<L.Circle | null>(null);

  const [activeLayer, setActiveLayer] = useState<'topo' | 'satellite' | 'streets'>('topo');
  const [selectedTaxon, setSelectedTaxon] = useState<string>('ALL');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>(
    initialCoords || { lat: COSTA_RICA_CENTER.latitude, lng: COSTA_RICA_CENTER.longitude }
  );
  const [currentDMS, setCurrentDMS] = useState(
    formatCoordinatesDMS(currentCoords.lat, currentCoords.lng).combined
  );
  const [locationStatusMessage, setLocationStatusMessage] = useState<string>('');
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState(false);

  const onCoordsChangeRef = useRef(onCoordsChange);
  useEffect(() => {
    onCoordsChangeRef.current = onCoordsChange;
  }, [onCoordsChange]);

  const handlePinPlacementRef = useRef<(lat: number, lng: number, fly?: boolean) => void>(() => {});

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentCoords.lat, currentCoords.lng],
      zoom: pickerMode && initialCoords ? 14 : COSTA_RICA_CENTER.zoom,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Click handler for offline / manual placement
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      handlePinPlacementRef.current(lat, lng, true);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenTopoMap, OpenStreetMap';
    let maxZoom = 17;

    if (activeLayer === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri, Earthstar Geographics';
      maxZoom = 18;
    } else if (activeLayer === 'streets') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap contributors &copy; CARTO';
      maxZoom = 19;
    }

    L.tileLayer(tileUrl, { attribution, maxZoom }).addTo(map);
  }, [activeLayer]);

  // Handle Pin Placement
  const handlePinPlacement = (lat: number, lng: number, fly = false) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setCurrentCoords({ lat, lng });
    const dmsInfo = formatCoordinatesDMS(lat, lng);
    setCurrentDMS(dmsInfo.combined);

    const nearest = findNearestHotspot(lat, lng);
    const predictedZone = estimateHoldridgeZone(nearest.elevation, lat, lng);

    onCoordsChangeRef.current?.({
      lat,
      lng,
      dms: dmsInfo.combined,
      locality: nearest.name,
      lifeZone: predictedZone.name,
      elevation: nearest.elevation,
      province: `${nearest.province}, Costa Rica`,
    });

    if (fly) {
      map.panTo([lat, lng]);
    }

    // Place or move draggable marker
    if (manualPinMarkerRef.current) {
      manualPinMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const customPinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:#002217; color:#6cf8bb; border:2px solid #ffffff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 14px rgba(0,0,0,0.35);">
              <span class="material-symbols-outlined" style="font-size:22px;">pin_drop</span>
            </div>
            <div style="width:3px; height:8px; background:#002217;"></div>
          </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });

      const marker = L.marker([lat, lng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', (event) => {
        const position = event.target.getLatLng();
        handlePinPlacement(position.lat, position.lng, false);
      });

      manualPinMarkerRef.current = marker;
    }
  };
  handlePinPlacementRef.current = handlePinPlacement;

  // Online GPS Geolocation handler
  const handleLocateMeOnline = () => {
    if (!navigator.geolocation) {
      setLocationStatusMessage('Geolocalización no disponible en su navegador.');
      return;
    }

    setIsLocating(true);
    setLocationStatusMessage('Obteniendo coordenadas satelitales GPS...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));

        const map = mapInstanceRef.current;
        if (!map) return;

        // Check if inside Costa Rica or outside
        if (isWithinCostaRica(latitude, longitude)) {
          setLocationStatusMessage(`Posición fijada en Costa Rica (±${Math.round(accuracy)}m)`);
          handlePinPlacement(latitude, longitude, false);
          map.flyTo([latitude, longitude], 15, { duration: 1.8 });

          // Accuracy circle
          if (userGpsCircleRef.current) {
            userGpsCircleRef.current.setLatLng([latitude, longitude]);
            userGpsCircleRef.current.setRadius(accuracy);
          } else {
            userGpsCircleRef.current = L.circle([latitude, longitude], {
              radius: accuracy,
              color: '#006c49',
              fillColor: '#6cf8bb',
              fillOpacity: 0.25,
              weight: 1.5,
            }).addTo(map);
          }
        } else {
          // Outside Costa Rica: simulate or fly to nearest CR hotspot
          setLocationStatusMessage(
            `Ubicación real fuera de CR (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°). Centrando en Estación La Selva, Sarapiquí.`
          );
          const defaultCr = COSTA_RICA_HOTSPOTS[0];
          handlePinPlacement(defaultCr.latitude, defaultCr.longitude, false);
          map.flyTo([defaultCr.latitude, defaultCr.longitude], 15, { duration: 1.8 });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        setLocationStatusMessage('GPS sin señal o permiso denegado. Usando punto de referencia.');
        const defaultCr = COSTA_RICA_HOTSPOTS[0];
        handlePinPlacement(defaultCr.latitude, defaultCr.longitude, false);
        mapInstanceRef.current?.flyTo([defaultCr.latitude, defaultCr.longitude], 14);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Reset to full Costa Rica view (Offline mode view)
  const handleShowFullCostaRica = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([COSTA_RICA_CENTER.latitude, COSTA_RICA_CENTER.longitude], 8, { duration: 1.4 });
    setLocationStatusMessage('Vista panorámica completa de Costa Rica.');
  };

  // Fly to specific biological hotspot
  const handleSelectHotspot = (hotspot: typeof COSTA_RICA_HOTSPOTS[0]) => {
    handlePinPlacement(hotspot.latitude, hotspot.longitude, false);
    mapInstanceRef.current?.flyTo([hotspot.latitude, hotspot.longitude], 15, { duration: 1.5 });
    setLocationStatusMessage(`Sitio: ${hotspot.name} (${hotspot.lifeZone})`);
    setShowHotspotsDrawer(false);
  };

  // Populate Specimen Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (pickerMode) return; // In picker mode we only want the manual pin

    const filtered = specimens.filter((s) => {
      if (selectedTaxon === 'ALL') return true;
      return s.taxonGroup === selectedTaxon;
    });

    filtered.forEach((specimen) => {
      const { latitude, longitude } = specimen.georeference;

      const getTaxonColor = (group: TaxonGroup) => {
        switch (group) {
          case 'Amphibia':
            return { bg: '#006c49', border: '#6cf8bb', icon: 'pest_control' };
          case 'Aves':
            return { bg: '#0284c7', border: '#e0f2fe', icon: 'flutter' };
          case 'Mammalia':
            return { bg: '#b45309', border: '#ffedd5', icon: 'pets' };
          case 'Insecta':
            return { bg: '#7c3aed', border: '#ede9fe', icon: 'bug_report' };
          default:
            return { bg: '#0f382a', border: '#c1ecd7', icon: 'eco' };
        }
      };

      const style = getTaxonColor(specimen.taxonGroup);

      const markerHtml = `
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${style.bg};
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          <span class="material-symbols-outlined" style="font-size: 20px;">${style.icon}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'specimen-leaflet-pin',
        html: markerHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([latitude, longitude], { icon });

      // Popup Content
      const popupContent = document.createElement('div');
      popupContent.className = 'p-1 font-sans text-sm min-w-[210px]';
      popupContent.innerHTML = `
        <div class="relative w-full h-24 rounded-lg overflow-hidden mb-2 bg-[#002217]">
          <img src="${specimen.heroImage || '/isthmohyla_nacientes.jpg'}" onerror="this.src='/isthmohyla_nacientes.jpg'" class="w-full h-full object-cover" alt="${specimen.scientificName}"/>
          <span class="absolute top-1 left-1 bg-white/90 text-[#002217] text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
            ${specimen.catalogNumber}
          </span>
        </div>
        <h4 class="font-bold italic text-[#002217] text-[14px] leading-tight">${specimen.scientificName}</h4>
        <p class="text-xs text-[#414844] truncate mb-1">${specimen.commonName}</p>
        <div class="text-[11px] font-mono text-[#006c49] mb-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">location_on</span>
          <span>${specimen.georeference.locality} (${specimen.georeference.elevationMeters}m)</span>
        </div>
        <button id="view-specimen-${specimen.id}" class="w-full py-1.5 bg-[#002217] text-[#ffffff] text-xs font-semibold rounded-lg flex items-center justify-center gap-1 hover:bg-[#0f382a] transition-colors">
          <span>Ver Ficha Científica</span>
          <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      `;

      marker.bindPopup(popupContent);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-specimen-${specimen.id}`);
        if (btn) {
          btn.onclick = () => onSelectSpecimen?.(specimen);
        }
      });

      marker.addTo(markersLayer);
    });
  }, [specimens, selectedTaxon, pickerMode]);

  // When initialCoords changes externally in pickerMode
  useEffect(() => {
    if (initialCoords && (initialCoords.lat !== currentCoords.lat || initialCoords.lng !== currentCoords.lng)) {
      handlePinPlacement(initialCoords.lat, initialCoords.lng, true);
    }
  }, [initialCoords?.lat, initialCoords?.lng]);

  const nearestHotspot = findNearestHotspot(currentCoords.lat, currentCoords.lng);
  const predictedHoldridge = estimateHoldridgeZone(nearestHotspot.elevation, currentCoords.lat, currentCoords.lng);

  return (
    <div className="relative w-full h-full min-h-[420px] flex flex-col bg-[#f8faf4] overflow-hidden">
      {/* Top Floating GIS Telemetry Bar */}
      <div className="absolute top-3 inset-x-3 z-[20] flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {/* Online/Offline GPS Mode Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-[#c1c8c3]/40 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnlineMode ? 'bg-[#006c49] animate-pulse' : 'bg-[#e48015]'
              }`}
            />
            <span className="font-semibold text-[#191c19]">
              {isOnlineMode ? 'Modo En Línea (GPS)' : 'Modo Offline (Manual)'}
            </span>
            {gpsAccuracy && isOnlineMode && (
              <span className="font-mono text-[11px] text-[#006c49] bg-[#6cf8bb]/30 px-1.5 py-0.2 rounded font-bold">
                ±{gpsAccuracy}m
              </span>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Online GPS Trigger */}
            <button
              onClick={handleLocateMeOnline}
              disabled={isLocating}
              title="Obtener coordenadas GPS en vivo y hacer zoom a mi sitio"
              className="px-3 py-1.5 rounded-full bg-[#002217] text-white hover:bg-[#0f382a] active:scale-95 shadow-md flex items-center gap-1 text-xs font-semibold transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[16px] text-[#6cf8bb] ${isLocating ? 'animate-spin' : ''}`}>
                {isLocating ? 'sync' : 'my_location'}
              </span>
              <span className="hidden sm:inline">Zoom a mi sitio</span>
            </button>

            {/* Offline Full Costa Rica View */}
            <button
              onClick={handleShowFullCostaRica}
              title="Ver mapa completo de Costa Rica para colocación manual"
              className="px-3 py-1.5 rounded-full bg-white text-[#002217] hover:bg-[#f2f4ee] active:scale-95 shadow-md flex items-center gap-1 text-xs font-semibold border border-[#c1c8c3]/50 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">public</span>
              <span className="hidden sm:inline">Todo Costa Rica</span>
            </button>

            {/* Biological Stations Selector */}
            <button
              onClick={() => setShowHotspotsDrawer(!showHotspotsDrawer)}
              title="Estaciones biológicas y áreas protegidas de Costa Rica"
              className="p-1.5 rounded-full bg-white text-[#002217] hover:bg-[#f2f4ee] active:scale-95 shadow-md border border-[#c1c8c3]/50 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">forest</span>
            </button>
          </div>
        </div>

        {/* Location Status Notice if any */}
        {locationStatusMessage && (
          <div className="self-start px-3 py-1 rounded-lg bg-[#002217]/90 text-white text-[11px] font-mono backdrop-blur-md shadow-sm border border-[#6cf8bb]/30 flex items-center gap-1.5 pointer-events-auto">
            <span className="material-symbols-outlined text-[13px] text-[#6cf8bb]">info</span>
            <span>{locationStatusMessage}</span>
          </div>
        )}
      </div>

      {/* Biological Stations Drawer / Menu */}
      {showHotspotsDrawer && (
        <div className="absolute top-16 right-3 z-[30] w-72 max-h-80 overflow-y-auto bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-[#c1c8c3] p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between pb-1 border-b border-[#e1e3dd] px-1">
            <span className="text-xs font-bold text-[#002217] uppercase tracking-wide flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-[#006c49]">explore</span>
              Estaciones de Costa Rica
            </span>
            <button
              onClick={() => setShowHotspotsDrawer(false)}
              className="text-[#414844] hover:text-[#191c19]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          {COSTA_RICA_HOTSPOTS.map((hotspot) => (
            <button
              key={hotspot.id}
              onClick={() => handleSelectHotspot(hotspot)}
              className="w-full text-left p-2 rounded-lg hover:bg-[#f2f4ee] transition-colors flex flex-col text-xs group cursor-pointer"
            >
              <span className="font-bold text-[#002217] group-hover:text-[#006c49]">
                {hotspot.name}
              </span>
              <span className="text-[11px] text-[#414844] truncate">{hotspot.subLocation}</span>
              <span className="font-mono text-[10px] text-[#006c49] mt-0.5">
                {hotspot.elevation} msnm • {hotspot.lifeZone}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-[1]" />

      {/* Floating Bottom Navigation & Pin Details */}
      <div className="absolute bottom-3 inset-x-3 z-[20] flex flex-col gap-2 pointer-events-none">
        {/* Taxon Filters (only in global view mode) */}
        {!pickerMode && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pointer-events-auto no-scrollbar">
            {[
              { id: 'ALL', label: 'Todos', icon: 'grid_view' },
              { id: 'Amphibia', label: 'Anfibios', icon: 'pest_control' },
              { id: 'Aves', label: 'Aves', icon: 'flutter' },
              { id: 'Mammalia', label: 'Mamíferos', icon: 'pets' },
              { id: 'Insecta', label: 'Insectos', icon: 'bug_report' },
            ].map((tax) => (
              <button
                key={tax.id}
                onClick={() => setSelectedTaxon(tax.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-md flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                  selectedTaxon === tax.id
                    ? 'bg-[#002217] text-white border border-[#6cf8bb]/40'
                    : 'bg-white/90 text-[#414844] hover:bg-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tax.icon}</span>
                <span>{tax.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Floating Coordinates & Action Pill */}
        <div className="p-3 rounded-xl bg-white/95 backdrop-blur-md shadow-lg border border-[#c1c8c3]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pointer-events-auto">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-red-600 text-[18px]">location_on</span>
              <span className="font-mono text-xs font-bold text-[#002217] truncate">
                {currentDMS}
              </span>
              <span className="font-mono text-[10px] text-[#006c49] bg-[#6cf8bb]/20 px-1.5 py-0.5 rounded font-semibold">
                WGS84
              </span>
            </div>
            <div className="text-[11px] text-[#414844] flex items-center gap-1.5 mt-0.5 truncate">
              <span className="font-semibold text-[#002217]">{nearestHotspot.name}</span>
              <span>•</span>
              <span className="text-[#006c49] font-bold bg-[#6cf8bb]/15 px-1.5 py-0.2 rounded font-mono text-[10px]">
                {predictedHoldridge.name || nearestHotspot.lifeZone}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Map Layer Switcher */}
            <div className="flex items-center bg-[#edefe9] p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setActiveLayer('topo')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeLayer === 'topo' ? 'bg-[#002217] text-white shadow-sm' : 'text-[#414844]'
                }`}
              >
                Topográfico
              </button>
              <button
                onClick={() => setActiveLayer('satellite')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeLayer === 'satellite' ? 'bg-[#002217] text-white shadow-sm' : 'text-[#414844]'
                }`}
              >
                Satélite
              </button>
              <button
                onClick={() => setActiveLayer('streets')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeLayer === 'streets' ? 'bg-[#002217] text-white shadow-sm' : 'text-[#414844]'
                }`}
              >
                Calles
              </button>
            </div>

            {/* Quick Register at this Spot */}
            {onOpenNewSpecimen && (
              <button
                onClick={() => {
                  const predictedZone = estimateHoldridgeZone(nearestHotspot.elevation, currentCoords.lat, currentCoords.lng);
                  onOpenNewSpecimen({
                    lat: currentCoords.lat,
                    lng: currentCoords.lng,
                    locality: nearestHotspot.name,
                    lifeZone: predictedZone.name || nearestHotspot.lifeZone,
                  });
                }}
                className="px-3.5 py-2 rounded-lg bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">add_circle</span>
                <span>Registrar en Punto</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
