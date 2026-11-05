import React, { useState, useMemo } from 'react';
import { SpecimenRecord } from '../types/specimen';
import { ThemeSwitcher } from './ThemeSwitcher';
import { handleImageOfflineFallback } from '../utils/offlineImageCache';

interface SpecimenCatalogViewProps {
  specimens: SpecimenRecord[];
  onSelectSpecimen: (specimen: SpecimenRecord) => void;
  onOpenNew: () => void;
  onOpenMap: () => void;
  onOpenDarwinCore: () => void;
  onOpenSyncBackup?: () => void;
  onOpenStatistics?: () => void;
  onGoHome?: () => void;
  onEditSpecimen?: (specimen: SpecimenRecord) => void;
  onDeleteSpecimen?: (id: string) => void;
}

export const SpecimenCatalogView: React.FC<SpecimenCatalogViewProps> = ({
  specimens,
  onSelectSpecimen,
  onOpenNew,
  onOpenMap,
  onOpenDarwinCore,
  onOpenSyncBackup,
  onOpenStatistics,
  onGoHome,
  onEditSpecimen,
  onDeleteSpecimen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Quick stats calculation
  const groupStats = useMemo(() => {
    let totalSightings = 0;
    let totalIndividuals = 0;
    const counts: Record<string, { species: number; individuals: number; sightings: number }> = {
      Mammalia: { species: 0, individuals: 0, sightings: 0 },
      Amphibia: { species: 0, individuals: 0, sightings: 0 },
      Reptilia: { species: 0, individuals: 0, sightings: 0 },
      Plantae: { species: 0, individuals: 0, sightings: 0 },
      Aves: { species: 0, individuals: 0, sightings: 0 },
      Insecta: { species: 0, individuals: 0, sightings: 0 },
    };

    specimens.forEach((spec) => {
      const g = counts[spec.taxonGroup] ? spec.taxonGroup : null;
      const sList = spec.sightings || [];
      const sCount = sList.length;
      let indCount = 0;
      if (sList.length > 0) {
        sList.forEach((s) => (indCount += s.individualsCount || s.count || 0));
      }

      totalSightings += sCount;
      totalIndividuals += indCount;

      if (g) {
        counts[g].species += 1;
        counts[g].individuals += indCount;
        counts[g].sightings += sCount;
      }
    });

    return { counts, totalSightings, totalIndividuals };
  }, [specimens]);

  const filtered = specimens.filter((spec) => {
    const matchesGroup = selectedGroup === 'ALL' || spec.taxonGroup === selectedGroup;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      spec.scientificName.toLowerCase().includes(query) ||
      spec.commonName.toLowerCase().includes(query) ||
      spec.catalogNumber.toLowerCase().includes(query) ||
      spec.georeference.locality.toLowerCase().includes(query);
    return matchesGroup && matchesSearch;
  });

  const taxonCardList = [
    { id: 'Mammalia', label: 'Mamíferos', icon: 'pets', color: '#f59e0b', bg: '#fef3c7' },
    { id: 'Amphibia', label: 'Anfibios', icon: 'flutter_dash', color: '#10b981', bg: '#d1fae5' },
    { id: 'Reptilia', label: 'Reptiles', icon: 'pest_control', color: '#e11d48', bg: '#ffe4e6' },
    { id: 'Plantae', label: 'Plantas', icon: 'local_florist', color: '#16a34a', bg: '#dcfce7' },
    { id: 'Aves', label: 'Aves', icon: 'cruelty_free', color: '#0284c7', bg: '#e0f2fe' },
    { id: 'Insecta', label: 'Insectos', icon: 'bug_report', color: '#8b5cf6', bg: '#ede9fe' },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f8faf4] pb-20">
      {/* Top Header */}
      <header className="sticky top-0 inset-x-0 z-40 bg-[#f8faf4]/90 backdrop-blur-xl border-b border-[#e1e3dd]">
        <div className="h-16 px-4 flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-left hover:opacity-85 transition-all cursor-pointer group"
            title="Ir a Inicio / Portada"
          >
            <div className="w-9 h-9 rounded-xl bg-[#002217] flex items-center justify-center text-[#6cf8bb] group-hover:bg-[#006c49] transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">cottage</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[18px] text-[#002217] tracking-tight leading-tight group-hover:text-[#006c49] transition-colors">
                  BioVinoTinto
                </h1>
                <span className="text-[10px] font-mono text-[#006c49] font-bold bg-[#006c49]/10 px-1.5 py-0.5 rounded">
                  Inicio
                </span>
              </div>
              <p className="text-[11px] text-[#414844]">
                Elaborado por: <strong className="text-[#006c49] font-bold">Ing. Carvajal V.</strong>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3] text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                title="Ver estadísticas y gráficas detalladas"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">analytics</span>
                <span className="hidden sm:inline">Estadísticas</span>
              </button>
            )}
            <button
              onClick={onOpenMap}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3] text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">map</span>
              <span className="hidden sm:inline">Mapa Costa Rica</span>
            </button>
            <button
              onClick={onOpenNew}
              className="px-3.5 py-1.5 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1 shadow active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">add</span>
              <span>+ Agregar Especie</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {/* Banner with Stats & Darwin Core pill */}
        <div className="p-4 rounded-2xl bg-[#0f382a] text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6cf8bb] font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#6cf8bb] animate-pulse" />
              Base de Datos Científica Activa
            </span>
            <h2 className="text-[20px] font-bold leading-tight">
              Catálogo de Especímenes y Registros de Campo
            </h2>
            <p className="text-xs text-[#79a28f]">
              {specimens.length} especies curadas • {groupStats.totalSightings} avistamientos de campo • {groupStats.totalIndividuals} individuos contabilizados • Darwin Core
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="px-3 py-2 rounded-xl bg-[#6cf8bb] hover:bg-[#85f9c9] text-[#002116] text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                <span>Gráficas &amp; Estadísticas</span>
              </button>
            )}
            {onOpenSyncBackup && (
              <button
                onClick={onOpenSyncBackup}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#6cf8bb] text-xs font-mono font-bold flex items-center gap-1.5 border border-[#6cf8bb]/30 transition-all cursor-pointer"
                title="Copia de seguridad en JSON y sincronización"
              >
                <span className="material-symbols-outlined text-[16px]">sync_saved_locally</span>
                <span>Respaldo JSON</span>
              </button>
            )}
            <button
              onClick={onOpenDarwinCore}
              className="px-3 py-2 rounded-xl bg-[#002217] hover:bg-black text-[#c1ecd7] text-xs font-mono font-bold flex items-center gap-1.5 border border-[#6cf8bb]/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">download</span>
              <span>Darwin Core</span>
            </button>
          </div>
        </div>

        {/* ESPACIO DENTRO DE LA COLECCIÓN PARA CONTEO GENERAL, MAMÍFEROS, ANFIBIOS, REPTILES, PLANTAS, AVES, ETC. CON PEQUEÑAS GRÁFICAS */}
        <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#f0f2ec] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">calculate</span>
              <div>
                <h3 className="font-bold text-sm text-[#002217] leading-tight">
                  Panel de Conteo de Biodiversidad en la Colección
                </h3>
                <span className="text-[11px] text-[#717974]">
                  Conteo general: <strong>{specimens.length}</strong> especies registradas | <strong>{groupStats.totalSightings}</strong> avistamientos en campo | <strong>{groupStats.totalIndividuals}</strong> individuos en campo
                </span>
              </div>
            </div>

            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="text-xs font-bold text-[#006c49] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver estadísticas detalladas</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            )}
          </div>

          {/* Mini Cards con Conteos y Pequeñas Gráficas de Barra */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {taxonCardList.map((tax) => {
              const data = groupStats.counts[tax.id] || { species: 0, individuals: 0, sightings: 0 };
              const pct = specimens.length > 0 ? (data.species / specimens.length) * 100 : 0;
              const isSelected = selectedGroup === tax.id;

              return (
                <button
                  key={tax.id}
                  onClick={() => setSelectedGroup(isSelected ? 'ALL' : tax.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'ring-2 ring-[#006c49] bg-white border-[#006c49]'
                      : 'bg-[#fcfdfa] hover:bg-white border-[#e1e3dd] hover:border-[#006c49]/40'
                  }`}
                  title={`Filtrar por ${tax.label}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: tax.color }}>
                      {tax.icon}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                      style={{ backgroundColor: tax.bg, color: tax.color }}
                    >
                      {data.species}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-[#002217] block leading-tight">
                      {tax.label}
                    </span>
                    <span className="text-[10px] text-[#717974] block font-mono">
                      {data.sightings} avist. • {data.individuals} inds.
                    </span>
                  </div>

                  {/* Pequeña gráfica de barra de progreso */}
                  <div className="w-full bg-[#f0f2ec] rounded-full h-1.5 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, data.species > 0 ? 10 : 0)}%`,
                        backgroundColor: tax.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#717974] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre científico, común, localidad o catálogo..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717974] hover:text-[#191c19]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Taxon Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedGroup === 'ALL'
                  ? 'bg-[#002217] text-white shadow-sm'
                  : 'bg-white text-[#414844] border border-[#c1c8c3]/60 hover:bg-[#edefe9]'
              }`}
            >
              Todos ({specimens.length})
            </button>
            {taxonCardList.map((tax) => {
              const count = groupStats.counts[tax.id]?.species || 0;
              return (
                <button
                  key={tax.id}
                  onClick={() => setSelectedGroup(tax.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedGroup === tax.id
                      ? 'bg-[#002217] text-white shadow-sm'
                      : 'bg-white text-[#414844] border border-[#c1c8c3]/60 hover:bg-[#edefe9]'
                  }`}
                >
                  {tax.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Specimen Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {filtered.map((specimen) => {
            const sightingsCount = specimen.sightings?.length || 0;
            return (
              <div
                key={specimen.id}
                onClick={() => onSelectSpecimen(specimen)}
                className="bg-white rounded-2xl border border-[#c1c8c3]/70 overflow-hidden shadow-sm hover:shadow-md hover:border-[#006c49]/50 transition-all cursor-pointer flex flex-col group"
              >
                {/* Card Photo Header */}
                <div className="relative w-full h-44 bg-[#0f382a] overflow-hidden">
                  <img
                    src={specimen.heroImage || '/isthmohyla_nacientes.jpg'}
                    alt={specimen.scientificName}
                    onError={(e) => {
                      handleImageOfflineFallback(e.currentTarget as HTMLImageElement, '/isthmohyla_nacientes.jpg');
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  {/* Catalog Pill */}
                  <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md text-[#002217] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {specimen.catalogNumber}
                  </span>

                  {/* Group & Sightings badges */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {sightingsCount > 0 ? (
                      <span className="bg-[#0284c7] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        <span>{sightingsCount} {sightingsCount === 1 ? 'avist.' : 'avist.'}</span>
                      </span>
                    ) : (
                      <span className="bg-black/40 backdrop-blur-xs text-[#a5d0bc] font-mono text-[10px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        <span>0 avist.</span>
                      </span>
                    )}
                    <span className="bg-[#002217]/90 text-[#6cf8bb] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {specimen.taxonGroup}
                    </span>
                  </div>

                  {/* Bottom Image Caption */}
                  <div className="absolute bottom-2 left-2.5 right-2.5">
                    <h3 className="text-white font-bold text-sm italic truncate">
                      {specimen.scientificName}
                    </h3>
                    <p className="text-[#e1e3dd] text-xs truncate">
                      {specimen.commonName}
                    </p>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2.5 text-xs text-[#414844]">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[11px] text-[#717974] truncate">
                      <span className="material-symbols-outlined text-[14px] text-[#006c49]">place</span>
                      <span className="truncate">{specimen.georeference.locality}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#717974] truncate">
                      <span className="material-symbols-outlined text-[14px] text-[#16a34a]">landscape</span>
                      <span className="truncate">{specimen.georeference.lifeZone || 'Zona de Vida Holdridge'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f2ec] text-[11px]">
                    <span className="font-mono text-[#006c49] font-bold">
                      {specimen.georeference.elevationMeters} msnm
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {onEditSpecimen && (
                        <button
                          type="button"
                          onClick={() => onEditSpecimen(specimen)}
                          className="px-2 py-0.5 rounded-lg bg-[#f0f4ee] hover:bg-[#e2e8de] text-[#006c49] font-bold text-[11px] flex items-center gap-1 border border-[#c1c8c3]/40 transition-colors cursor-pointer"
                          title="Editar datos científicos de esta especie"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          <span>Editar</span>
                        </button>
                      )}
                      {onDeleteSpecimen && specimen.scientificName !== 'Isthmohyla nacientes' && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(specimen.id)}
                          className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] flex items-center gap-1 border border-red-200 transition-colors cursor-pointer"
                          title="Eliminar esta especie candidata"
                        >
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                          <span>Borrar</span>
                        </button>
                      )}
                      <span className="text-[#002217] font-bold group-hover:text-[#006c49] flex items-center gap-0.5 ml-1">
                        <span>Ver</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#c1c8c3]/60 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-[#717974]">search_off</span>
            <p className="font-bold text-sm text-[#002217]">No se encontraron especímenes</p>
            <p className="text-xs text-[#717974]">
              Prueba con otro término de búsqueda o selecciona "Todos".
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmación para Eliminar Especie */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-red-200 shadow-2xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <h3 className="font-bold text-base text-[#191c19]">¿Eliminar esta especie?</h3>
            <p className="text-xs text-[#414844]">
              Esta especie y sus avistamientos asociados se eliminarán de este equipo y de la base de datos en la nube.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f2ec]">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f0f2ec] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSpecimen && deleteConfirmId) {
                    onDeleteSpecimen(deleteConfirmId);
                  }
                  setDeleteConfirmId(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow cursor-pointer"
              >
                Sí, Eliminar Especie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
