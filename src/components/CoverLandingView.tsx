import React from 'react';
import { SpecimenRecord } from '../types/specimen';
import { useTheme } from '../utils/themeContext';

interface CoverLandingViewProps {
  onOpenDetail: () => void;
  onOpenMap: () => void;
  onOpenCatalog: () => void;
  onOpenStatistics?: () => void;
  onOpenNewSpecimen: () => void;
  onOpenSyncBackup: () => void;
  onOpenDeviceProfile?: () => void;
  deviceId?: string;
  observerName?: string;
  specimensCount: number;
  totalSightingsCount?: number;
  totalIndividualsCount?: number;
  currentSpecimen: SpecimenRecord;
  cloudSyncStatus?: 'connected' | 'syncing' | 'offline';
  lastCloudSyncTime?: string;
}

export const CoverLandingView: React.FC<CoverLandingViewProps> = ({
  onOpenDetail,
  onOpenMap,
  onOpenCatalog,
  onOpenStatistics,
  onOpenNewSpecimen,
  onOpenSyncBackup,
  onOpenDeviceProfile,
  deviceId,
  observerName,
  specimensCount,
  totalSightingsCount = 0,
  totalIndividualsCount = 0,
  currentSpecimen,
  cloudSyncStatus = 'connected',
  lastCloudSyncTime,
}) => {
  const { theme, setTheme, isRedNight } = useTheme();

  // Fotografía emblema PERMANENTE de la portada: Rana de las Nacientes (Isthmohyla nacientes)
  const PERMANENT_COVER_IMAGE = '/isthmohyla_nacientes.jpg';

  const toggleRedNight = () => {
    setTheme(theme === 'red' ? 'dark' : 'red');
  };

  return (
    <div className={`relative min-h-[calc(100vh-64px)] w-full flex flex-col justify-between overflow-hidden text-white select-none transition-colors duration-500 ${
      isRedNight ? 'bg-[#0f0406]' : 'bg-[#00170f]'
    }`}>
      {/* Background High-Res Nature Hero Image - Rana de las Nacientes Emblem */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_top_20%] bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url('${PERMANENT_COVER_IMAGE}')` }}
      >
        {/* Nocturnal contrast overlays preserving vivid frog details, bright greens and amber eyes */}
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isRedNight
            ? 'bg-gradient-to-t from-[#140205] via-[#21050a]/60 to-[#140205]/75'
            : 'bg-gradient-to-t from-[#00170f] via-[#001f15]/55 to-[#00170f]/65'
        }`} />
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isRedNight
            ? 'bg-gradient-to-r from-[#140205]/85 via-transparent to-[#140205]/70'
            : 'bg-gradient-to-r from-[#00170f]/80 via-transparent to-[#00170f]/70'
        }`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,23,15,0.75)_90%)]" />
      </div>

      {/* Top Header / Heraldic Bar */}
      <header className="relative z-10 px-4 sm:px-6 pt-5 pb-2 max-w-5xl mx-auto w-full flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo y Nombre Institucional */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-[#6cf8bb]/40 flex items-center justify-center text-[#6cf8bb] shadow-lg">
              <span className="material-symbols-outlined text-[24px]">forest</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-[#a3e6ba] uppercase font-bold">
                REPÚBLICA DE COSTA RICA
              </span>
              <span className="text-xs sm:text-[13px] text-[#e1e3dd] font-medium tracking-wide">
                Sistema de Bitácora de Campo &amp; Taxonomía | <strong className="text-[#a3e6ba] font-bold">BioVinoTinto Project</strong>
              </span>
            </div>
          </div>

          {/* Pastillas de Estado y Configuración */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Elaborado por */}
            <div className="px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-[#6cf8bb]/30 flex items-center gap-2 shadow-sm transition-all">
              <div className="w-5 h-5 rounded-full bg-[#6cf8bb] text-[#002217] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[13px]">person</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[8px] sm:text-[9px] text-[#a5d0bc] uppercase tracking-wider font-semibold font-mono">
                  ELABORADO POR
                </span>
                <span className="text-xs font-bold text-white tracking-wide">
                  {observerName || 'Ing. Carvajal V.'}
                </span>
              </div>
            </div>

            {/* Pastilla Tema Noche Rojo */}
            <button
              onClick={toggleRedNight}
              className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                isRedNight
                  ? 'bg-[#3b080f]/90 border-[#f87171] text-[#fca5a5] shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                  : 'bg-black/50 border-white/20 text-white/90 hover:bg-black/70 hover:border-red-400'
              }`}
              title="Alternar Modo Noche Rojo (protege la visión nocturna en quebradas)"
            >
              <span className="text-red-400 text-sm">🌙</span>
              <span>Noche Rojo</span>
            </button>

            {/* Badge Nube en Vivo y Colaboración Multi-usuario */}
            <button
              onClick={onOpenSyncBackup}
              className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                cloudSyncStatus === 'connected'
                  ? 'bg-black/50 border-[#6cf8bb]/50 text-[#6cf8bb] hover:bg-[#00281a]'
                  : 'bg-black/60 border-amber-400 text-amber-300'
              }`}
              title="Colaboración multi-usuario en vivo entre iPad, Celular y Laptop"
            >
              <span className="w-2 h-2 rounded-full bg-[#6cf8bb] animate-pulse" />
              <span>En Vivo • Colaboración Activa</span>
            </button>

            {/* Badge Sincronizado */}
            <button
              onClick={onOpenSyncBackup}
              className="px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-[#6cf8bb]/50 text-[#6cf8bb] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Datos sincronizados con la nube"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">visibility</span>
              <span>Sincronizado</span>
            </button>
          </div>
        </div>

        {/* Sub-barra de Filtro Nocturno / Etiqueta de Modo */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRedNight}
            className={`px-3 py-1 rounded-full text-[11px] font-mono border backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 ${
              isRedNight
                ? 'bg-red-950/60 border-red-500/60 text-red-200 shadow-sm'
                : 'bg-black/40 border-white/15 text-[#a5d0bc] hover:border-[#6cf8bb]/40'
            }`}
            title="Filtro óptico para trabajo de campo nocturno"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>Filtro Rojo Ébano</span>
          </button>
        </div>
      </header>

      {/* Central Hero Body */}
      <div className="relative z-10 px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full flex flex-col gap-4 my-auto">
        {/* Main Title & Description */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#a3e6ba] drop-shadow-lg font-sans">
            BioVinoTinto
          </h1>

          <p className="text-sm sm:text-base text-[#e1e3dd] max-w-2xl font-light leading-relaxed">
            Plataforma de campo para el inventario biológico en Cascadas <strong className="text-white font-semibold">Vino Tinto</strong>, <strong className="text-white font-semibold">La Violeta</strong> de Dota. Gradiente altitudinal y monitoreo de <span className="italic text-[#a3e6ba]">Isthmohyla</span> en Talamanca.
          </p>
        </div>

        {/* Resumen Cuantitativo: Especies | Avistamientos | Individuos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 rounded-2xl bg-black/55 backdrop-blur-md border border-[#6cf8bb]/30 shadow-2xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-white/15 text-center">
          {/* Card 1: Especies */}
          <div className="p-3.5 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase font-mono text-[#a3e6ba] font-bold tracking-wider">
              ESPECIES
            </span>
            <span className="text-3xl sm:text-4xl font-black text-white leading-tight my-0.5">
              {specimensCount}
            </span>
            <span className="text-[10px] text-[#c1c8c3] font-mono">
              en catálogo (focal: <span className="italic text-[#a3e6ba]">Isthmohyla nacientes</span>)
            </span>
          </div>

          {/* Card 2: Avistamientos */}
          <div className="p-3.5 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase font-mono text-[#6cf8bb] font-bold tracking-wider">
              AVISTAMIENTOS
            </span>
            <span className="text-3xl sm:text-4xl font-black text-white leading-tight my-0.5">
              {totalSightingsCount}
            </span>
            <span className="text-[10px] text-[#c1c8c3] font-mono">
              entradas de campo (ej. en quebrada/roca)
            </span>
          </div>

          {/* Card 3: Individuos */}
          <div className="p-3.5 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase font-mono text-[#a3e6ba] font-bold tracking-wider">
              INDIVIDUOS
            </span>
            <span className="text-3xl sm:text-4xl font-black text-white leading-tight my-0.5">
              {totalIndividualsCount}
            </span>
            <span className="text-[10px] text-[#c1c8c3] font-mono">
              contabilizados (en área de estudio)
            </span>
          </div>
        </div>

        {/* Featured Focal Specimen Card (Isthmohyla nacientes) */}
        <div className="p-3.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl overflow-hidden border border-[#6cf8bb]/40 flex-shrink-0 shadow-inner bg-[#002217]">
              <img
                src={PERMANENT_COVER_IMAGE}
                alt="Isthmohyla nacientes"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/isthmohyla_nacientes.jpg';
                }}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                <span className="italic text-[#a3e6ba]">Isthmohyla nacientes</span> | Rana de las Nacientes
              </h2>
              <div className="mt-1">
                <button
                  onClick={onOpenDetail}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1e4834] hover:bg-[#285d43] border border-[#6cf8bb]/40 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">description</span>
                  <span>Abrir Ficha Científica</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[10px] font-mono text-[#a5d0bc] px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
              {currentSpecimen.catalogNumber || 'CAT. CR-BIO-2026-INAC'}
            </span>
          </div>
        </div>

        {/* Primary Interactive Shortcuts Grid (2x2 on tablet/desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Card 1: Mapa SIG */}
          <button
            onClick={onOpenMap}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md flex items-center gap-2.5 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">explore</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">Mapa SIG</span>
              <span className="text-[10px] text-[#c1c8c3] truncate">GPS y Holdridge</span>
            </div>
          </button>

          {/* Card 2: Registrar Nuevo */}
          <button
            onClick={onOpenNewSpecimen}
            className="p-3 rounded-xl bg-[#002e20]/80 hover:bg-[#003d2b] border border-[#6cf8bb]/30 backdrop-blur-md flex items-center gap-2.5 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#6cf8bb]/20 text-[#6cf8bb] flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">Nuevo Registro</span>
              <span className="text-[10px] text-[#a5d0bc] truncate">Toma en campo</span>
            </div>
          </button>

          {/* Card 3: Colección */}
          <button
            onClick={onOpenCatalog}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md flex items-center gap-2.5 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">Colección</span>
              <span className="text-[10px] text-[#c1c8c3] truncate">{specimensCount} especies</span>
            </div>
          </button>

          {/* Card 4: Estadísticas */}
          <button
            onClick={onOpenStatistics || onOpenCatalog}
            className="p-3 rounded-xl bg-[#004d33]/60 hover:bg-[#005a3c] border border-[#6cf8bb]/40 backdrop-blur-md flex items-center gap-2.5 text-left transition-all hover:scale-[1.02] shadow-md group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#6cf8bb]/20 text-[#6cf8bb] flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">analytics</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">Estadística</span>
              <span className="text-[10px] text-[#a5d0bc] truncate">Conteos e índices</span>
            </div>
          </button>
        </div>
      </div>

      {/* Footer Scientific Status Bar */}
      <footer className="relative z-10 px-4 sm:px-6 py-2.5 max-w-5xl mx-auto w-full border-t border-white/10 bg-black/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs text-[#a5d0bc]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">landscape</span>
            <span>Cascadas Vino Tinto • Talamanca</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">offline_pin</span>
            <span>Respaldo 100% Offline</span>
          </div>
        </div>

        <button
          onClick={onOpenSyncBackup}
          className="text-[#6cf8bb] hover:underline font-semibold flex items-center gap-1 cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-[15px]">database</span>
          <span>Gestor de Datos JSON &amp; Respaldo</span>
        </button>
      </footer>
    </div>
  );
};
