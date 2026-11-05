import React, { useState } from 'react';
import { SpecimenRecord } from '../types/specimen';
import { exportDarwinCoreCsv } from '../utils/darwinCoreExport';

interface ExecutiveSinacReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimens: SpecimenRecord[];
  isGeoprivacyActive?: boolean;
}

export const ExecutiveSinacReportModal: React.FC<ExecutiveSinacReportModalProps> = ({
  isOpen,
  onClose,
  specimens,
  isGeoprivacyActive = false,
}) => {
  if (!isOpen) return null;

  const dateStr = new Date().toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalIndividuals = specimens.reduce((acc, s) => {
    const sightings = s.sightings || [];
    return acc + (sightings.length > 0 ? sightings.reduce((sub, item) => sub + (item.individualsCount || item.count || 0), 0) : 0);
  }, 0);

  const totalSightings = specimens.reduce((acc, s) => acc + (s.sightings?.length || 0), 0);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    exportDarwinCoreCsv(specimens);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white text-[#191c19] rounded-3xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal - No print */}
        <div className="px-5 py-4 bg-[#002217] text-white flex items-center justify-between no-print border-b border-[#6cf8bb]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006c49] text-[#6cf8bb] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            </div>
            <div>
              <h3 className="font-bold text-[16px] leading-tight">
                Ficha Ejecutiva de Investigación &amp; Reporte SINAC
              </h3>
              <p className="text-[11px] text-[#a5d0bc] font-mono">
                Formato Oficial de Auditoría de Campo • Exportación PDF / Darwin Core
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="px-3.5 py-1.5 rounded-xl bg-[#6cf8bb] hover:bg-[#52e8a6] text-[#002217] text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Abrir diálogo de impresión para guardar como PDF"
            >
              <span className="material-symbols-outlined text-[17px]">print</span>
              <span>Guardar como PDF / Imprimir</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Descargar archivo CSV Darwin Core"
            >
              <span className="material-symbols-outlined text-[17px] text-[#6cf8bb]">table_chart</span>
              <span>CSV Darwin Core</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Report Content - Visible on screen and printed as official PDF document */}
        <div className="p-6 sm:p-8 overflow-y-auto flex flex-col gap-6 bg-white text-[#191c19] text-xs leading-relaxed">
          {/* Institutional Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-[#002217] gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#002217] text-[#6cf8bb] flex items-center justify-center font-black text-xl shadow-md border border-[#006c49]">
                CR
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#006c49] font-extrabold">
                  República de Costa Rica • MINAE - SINAC
                </span>
                <h1 className="text-lg sm:text-xl font-black text-[#002217] leading-tight">
                  INFORME EJECUTIVO DE BIODIVERSIDAD &amp; BITÁCORA DE CAMPO
                </h1>
                <span className="text-[11px] text-[#414844] font-medium">
                  Sistema de Monitoreo Biológico BioBitácora Costa Rica • Estándar Darwin Core (DwC)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end bg-[#f8faf4] p-3 rounded-xl border border-[#c1c8c3] text-[11px]">
              <span><strong>Fecha de Emisión:</strong> {dateStr}</span>
              <span><strong>Auditor Responsable:</strong> Ing. Carvajal V.</span>
              <span className="font-mono text-[#006c49] font-bold">Folio: CR-BIO-DOC-2026</span>
            </div>
          </div>

          {/* Conservation Protocol & Geoprivacy Note */}
          <div className="p-3.5 rounded-xl bg-[#e6f4ea] border border-[#a8dab5] text-[#003824] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">shield</span>
              <div>
                <strong>Protocolo de Manejo de Fauna Silvestre:</strong> Colecta y avistamientos con validación taxonómica.
                {isGeoprivacyActive && (
                  <span className="block text-[11px] text-[#004d34] font-medium">
                    🔒 <strong>Geoprivacidad activa:</strong> Las coordenadas de especies amenazadas (e.g. <em>Isthmohyla nacientes</em>) están difuminadas a un radio de ±3.5 km para evitar colectas ilegales en la quebrada.
                  </span>
                )}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#006c49] text-white">
              VÁLIDO PARA REPORTES SINAC
            </span>
          </div>

          {/* Quantitative Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3]">
              <span className="text-[10px] text-[#717974] block uppercase font-mono">Especies Catalogadas</span>
              <strong className="text-xl font-black text-[#002217]">{specimens.length}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3]">
              <span className="text-[10px] text-[#717974] block uppercase font-mono">Individuos Totales</span>
              <strong className="text-xl font-black text-[#006c49]">{totalIndividuals}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3]">
              <span className="text-[10px] text-[#717974] block uppercase font-mono">Entradas de Campo</span>
              <strong className="text-xl font-black text-[#002217]">{totalSightings}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3]">
              <span className="text-[10px] text-[#717974] block uppercase font-mono">Estado Conservación</span>
              <strong className="text-xl font-black text-[#e11d48]">Listas Rojas CR</strong>
            </div>
          </div>

          {/* Species Table */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-sm text-[#002217] uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">format_list_bulleted</span>
              Detalle de Especímenes en el Inventario ({specimens.length} Registros)
            </h4>

            <div className="border border-[#c1c8c3] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#002217] text-white text-[10px] font-mono uppercase">
                    <th className="p-2.5">Catálogo</th>
                    <th className="p-2.5">Especie / Taxón</th>
                    <th className="p-2.5">Localidad &amp; Elevación</th>
                    <th className="p-2.5">Indiv. / Avist.</th>
                    <th className="p-2.5">UICN</th>
                    <th className="p-2.5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e1e3dd]">
                  {specimens.map((spec) => {
                    const sightingsCount = spec.sightings?.length || 0;
                    const individuals = spec.sightings && spec.sightings.length > 0
                      ? spec.sightings.reduce((acc, s) => acc + (s.individualsCount || s.count || 0), 0)
                      : 0;
                    return (
                      <tr key={spec.id} className="hover:bg-[#f8faf4] transition-colors">
                        <td className="p-2.5 font-mono font-bold text-[#006c49] text-[11px]">
                          {spec.catalogNumber}
                        </td>
                        <td className="p-2.5">
                          <strong className="italic text-[#002217] block">{spec.scientificName}</strong>
                          <span className="text-[10px] text-[#717974]">{spec.commonName} • [{spec.taxonGroup}]</span>
                        </td>
                        <td className="p-2.5 text-[11px]">
                          <span className="block font-medium">{spec.georeference.locality}</span>
                          <span className="text-[10px] text-[#717974] font-mono">
                            {spec.georeference.elevationMeters} msnm • {spec.georeference.lifeZone?.split('(')[0]}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] font-bold text-[#002217]">
                          N={individuals} ({sightingsCount} avist.)
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]">
                            {spec.iucnStatus?.code || 'LC'}
                          </span>
                        </td>
                        <td className="p-2.5 text-[10px] text-[#414844] font-mono">
                          {spec.collectionDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Certification */}
          <div className="pt-6 mt-4 border-t border-[#c1c8c3] grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#717974] uppercase font-mono">Auditoría Científica &amp; Digitalización</span>
              <div className="h-12 border-b border-dashed border-[#717974] flex items-end pb-1 font-serif text-sm italic text-[#002217]">
                Ing. Carvajal V.
              </div>
              <span className="text-[10px] text-[#414844] font-bold">Ing. Carvajal V.</span>
              <span className="text-[9px] text-[#717974]">Investigador / Ingeniero de Sistema BioBitácora CR</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#717974] uppercase font-mono">Institución Receptora / Validación</span>
              <div className="h-12 border-b border-dashed border-[#717974] flex items-end pb-1 font-mono text-xs text-[#717974]">
                UCR-MZ / Sistema Nacional de Áreas de Conservación
              </div>
              <span className="text-[10px] text-[#414844] font-bold">Colección Biológica Oficial</span>
              <span className="text-[9px] text-[#717974]">Darwin Core Archive Standard v1.4 Validado</span>
            </div>
          </div>
        </div>

        {/* Footer Actions - No print */}
        <div className="px-5 py-3.5 bg-[#f8faf4] border-t border-[#e1e3dd] flex items-center justify-between no-print">
          <span className="text-[11px] text-[#717974] font-mono">
            Usa "Guardar como PDF" en el menú de impresión para descargar en archivo PDF.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl bg-[#002217] hover:bg-[#093525] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">print</span>
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#edefe9] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
