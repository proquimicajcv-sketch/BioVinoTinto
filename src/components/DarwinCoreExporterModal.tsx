import React, { useState } from 'react';
import { SpecimenRecord } from '../types/specimen';
import {
  formatDarwinCoreRecord,
  exportDarwinCoreJson,
  exportDarwinCoreCsv,
} from '../utils/darwinCoreExport';

interface DarwinCoreExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimen?: SpecimenRecord;
  allSpecimens: SpecimenRecord[];
}

export const DarwinCoreExporterModal: React.FC<DarwinCoreExporterModalProps & { onOpenExecutivePdf?: () => void }> = ({
  isOpen,
  onClose,
  specimen,
  allSpecimens,
  onOpenExecutivePdf,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'single' | 'all'>('single');
  const [obfuscateCoords, setObfuscateCoords] = useState(false);
  const targetSpecimen = specimen || allSpecimens[0];
  const dwcRecord = targetSpecimen ? formatDarwinCoreRecord(targetSpecimen, obfuscateCoords) : null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#0b281f] rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#002217] text-white flex items-center justify-between border-b border-[#6cf8bb]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006c49] text-[#6cf8bb] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">cloud_sync</span>
            </div>
            <div>
              <h2 className="font-bold text-[16px] leading-tight">
                Exportador de Informes: Darwin Core &amp; SINAC
              </h2>
              <p className="text-[11px] text-[#79a28f] font-mono">
                GBIF / TDWG Standard • Columnas estandarizadas &amp; Ficha Ejecutiva PDF
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

        {/* Tab Selector */}
        <div className="px-5 pt-3 pb-2 border-b border-[#e1e3dd] flex items-center justify-between gap-2 bg-[#f8faf4] dark:bg-[#08221a]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'single'
                  ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                  : 'text-[#414844] hover:bg-[#edefe9]'
              }`}
            >
              Ficha Actual ({targetSpecimen?.catalogNumber})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                  : 'text-[#414844] hover:bg-[#edefe9]'
              }`}
            >
              Colección Completa ({allSpecimens.length} Registros)
            </button>
          </div>

          {/* Interruptor de Geoprivacidad */}
          <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-[#0d3126] px-2.5 py-1 rounded-lg border border-[#c1c8c3] text-[11px] font-semibold text-[#002217]">
            <input
              type="checkbox"
              checked={obfuscateCoords}
              onChange={(e) => setObfuscateCoords(e.target.checked)}
              className="accent-[#006c49] w-3.5 h-3.5 rounded cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#006c49]">shield</span>
              <span>Oscurecer Coordenadas (2-5 km)</span>
            </span>
          </label>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* Status banner */}
          <div className="p-3 rounded-xl bg-[#c1ecd7]/30 border border-[#006c49]/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#006c49] text-[22px]">verified</span>
              <div>
                <p className="text-xs font-bold text-[#002116]">
                  Esquema Darwin Core Validado (occurrenceID, basisOfRecord, individualCount)
                </p>
                <p className="text-[11px] text-[#414844]">
                  {obfuscateCoords
                    ? '🛡️ Geoprivacidad activa: Coordenadas difuminadas en radio de 3.5 km para proteger nacientes.'
                    : 'Coordenadas WGS84 submétricas exactas listas para proyectos de investigación.'}
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] font-bold text-[#006c49] bg-[#6cf8bb]/40 px-2 py-0.5 rounded">
              DwC-A Sync
            </span>
          </div>

          {/* JSON Schema Viewer */}
          {activeTab === 'single' && dwcRecord && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-bold text-[#002217] uppercase">
                Campos Darwin Core Mapeados:
              </span>
              <div className="p-3 rounded-xl bg-[#0f382a] text-[#c1ecd7] font-mono text-[11px] overflow-x-auto max-h-52">
                <pre>{JSON.stringify(dwcRecord, null, 2)}</pre>
              </div>
            </div>
          )}

          {activeTab === 'all' && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#002217]">
                Registros listos para exportación masiva en lote:
              </span>
              <div className="border border-[#e1e3dd] rounded-xl overflow-hidden divide-y divide-[#e1e3dd] max-h-52 overflow-y-auto">
                {allSpecimens.map((spec) => (
                  <div key={spec.id} className="p-2.5 flex items-center justify-between bg-white text-xs">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-[#002217]">{spec.catalogNumber}</span>
                      <span className="text-[#414844] italic ml-2">{spec.scientificName}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#006c49] bg-[#edefe9] px-2 py-0.5 rounded">
                      {spec.georeference.locality.split(',')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Actions: Both Formats (PDF Executive SINAC and CSV Darwin Core) */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#e1e3dd]">
            <span className="text-xs font-bold text-[#002217] uppercase tracking-wide">
              Formatos de Exportación Oficiales:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Formato 1: CSV Darwin Core */}
              <button
                onClick={() =>
                  exportDarwinCoreCsv(
                    activeTab === 'single' && targetSpecimen ? [targetSpecimen] : allSpecimens,
                    obfuscateCoords
                  )
                }
                className="py-3 px-4 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px] text-[#6cf8bb]">table_chart</span>
                <div className="text-left">
                  <div className="leading-tight">CSV Darwin Core</div>
                  <div className="text-[10px] text-[#a5d0bc] font-normal">Columnas estandarizadas GBIF</div>
                </div>
              </button>

              {/* Formato 2: PDF Ficha Ejecutiva SINAC */}
              <button
                onClick={() => {
                  onClose();
                  if (onOpenExecutivePdf) {
                    onOpenExecutivePdf();
                  } else {
                    window.print();
                  }
                }}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#006c49] to-[#0f382a] hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px] text-[#6cf8bb]">picture_as_pdf</span>
                <div className="text-left">
                  <div className="leading-tight">PDF: Ficha Ejecutiva SINAC</div>
                  <div className="text-[10px] text-[#a5d0bc] font-normal">Para estudiantes / reportes oficiales</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
