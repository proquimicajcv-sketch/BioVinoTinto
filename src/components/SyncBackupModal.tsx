import React, { useState } from 'react';
import { SpecimenRecord } from '../types/specimen';

interface SyncBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  specimens: SpecimenRecord[];
  onImportSpecimens: (imported: SpecimenRecord[], replace: boolean) => void;
  onSyncServer: () => Promise<void>;
  isSyncingServer: boolean;
  deviceId?: string;
  cloudSyncStatus?: 'connected' | 'syncing' | 'offline';
  lastCloudSyncTime?: string;
}

export const SyncBackupModal: React.FC<SyncBackupModalProps> = ({
  isOpen,
  onClose,
  specimens,
  onImportSpecimens,
  onSyncServer,
  isSyncingServer,
  deviceId,
  cloudSyncStatus = 'connected',
  lastCloudSyncTime,
}) => {
  if (!isOpen) return null;

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [showJsonTextarea, setShowJsonTextarea] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  const totalSightings = specimens.reduce((acc, s) => acc + Math.max(s.sightings?.length || 0, 1), 0);

  // Export entire database as JSON file
  const handleExportJSON = () => {
    const backupData = {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      country: 'Costa Rica',
      system: 'BioVinoTinto Project - Bitácora de Campo & Taxonomía',
      totalRecords: specimens.length,
      totalSightings,
      specimens,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BioVinoTinto_Respaldo_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportStatus(`Respaldo descargado exitosamente (${specimens.length} especies, ${totalSightings} avistamientos y fotos).`);
  };

  // Copy JSON directly to clipboard
  const handleCopyClipboard = async () => {
    try {
      const backupData = {
        version: '1.2',
        exportedAt: new Date().toISOString(),
        totalRecords: specimens.length,
        totalSightings,
        specimens,
      };
      await navigator.clipboard.writeText(JSON.stringify(backupData, null, 2));
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
      setImportStatus('¡JSON copiado al portapapeles! Puedes pegarlo en WhatsApp, correo, o en otro dispositivo.');
    } catch {
      setImportStatus('No se pudo copiar automáticamente. Usa la descarga de archivo.');
    }
  };

  // Import JSON string from text area
  const handleImportFromText = () => {
    try {
      if (!pastedJson.trim()) {
        throw new Error('Pega el texto JSON en el campo.');
      }
      const parsed = JSON.parse(pastedJson);
      let recordsToImport: SpecimenRecord[] = [];
      if (Array.isArray(parsed)) {
        recordsToImport = parsed;
      } else if (parsed && Array.isArray(parsed.specimens)) {
        recordsToImport = parsed.specimens;
      } else {
        throw new Error('Formato JSON incompatible.');
      }

      onImportSpecimens(recordsToImport, importMode === 'replace');
      setImportStatus(
        `¡Éxito! Se procesaron ${recordsToImport.length} registros en modo ${
          importMode === 'replace' ? 'reemplazo total' : 'fusión acumulada'
        }.`
      );
      setPastedJson('');
      setShowJsonTextarea(false);
    } catch (err: any) {
      setImportStatus(`Error al importar: ${err.message || 'JSON inválido'}`);
    }
  };

  // Import JSON file from device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let recordsToImport: SpecimenRecord[] = [];
        if (Array.isArray(parsed)) {
          recordsToImport = parsed;
        } else if (parsed && Array.isArray(parsed.specimens)) {
          recordsToImport = parsed.specimens;
        } else {
          throw new Error('Formato de archivo JSON incompatible.');
        }

        if (recordsToImport.length === 0) {
          throw new Error('El archivo no contiene registros de especímenes.');
        }

        onImportSpecimens(recordsToImport, importMode === 'replace');
        setImportStatus(
          `¡Éxito! Se procesaron ${recordsToImport.length} registros en modo ${
            importMode === 'replace' ? 'reemplazo total' : 'fusión acumulada'
          }.`
        );
      } catch (err: any) {
        setImportStatus(`Error al importar: ${err.message || 'JSON inválido'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#002217] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6cf8bb] text-[24px]">sync_saved_locally</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Persistencia &amp; Respaldo de Bitácora</h3>
              <p className="text-[11px] text-[#79a28f] font-mono">
                URLs de fotos, avistamientos y almacenamiento offline
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

        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Offline Resilience Banner */}
          <div className="p-3.5 rounded-xl bg-[#c1ecd7]/30 border border-[#006c49]/40 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[#006c49] text-[22px] flex-shrink-0 mt-0.5">
              offline_pin
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-[#002116] text-[13px]">
                Modo Offline 100% Autónomo
              </span>
              <p className="text-[#414844] leading-relaxed">
                Todas las URLs de fotos, entradas de avistamientos y datos de especies se conservan de forma permanente en la memoria de este dispositivo, incluso en selvas y montañas sin internet. Para transferirlos a otro equipo sin señal, descarga o copia el archivo JSON.
              </p>
            </div>
          </div>

          {/* Section 1: Multi-Device Real-Time Cloud Synchronization */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#002217] to-[#0a3826] text-white border border-[#6cf8bb]/40 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[#6cf8bb] text-[20px]">cloud_sync</span>
                Sincronización en Tiempo Real (Google Cloud Firestore)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-[#6cf8bb]/40 text-[#6cf8bb] text-xs font-mono font-bold">
                <span className={`w-2 h-2 rounded-full ${cloudSyncStatus === 'connected' ? 'bg-[#6cf8bb] animate-pulse' : 'bg-amber-400'}`} />
                {cloudSyncStatus === 'connected' ? 'En Vivo' : 'Conectando...'}
                {lastCloudSyncTime ? ` • ${lastCloudSyncTime}` : ''}
              </span>
            </div>

            <p className="text-xs text-[#c1ecd7] leading-relaxed">
              La base de datos en la nube está <strong>activada y enlazada permanentemente</strong>. Todo registro, fotografía o avistamiento que ingreses o edites desde tu <strong>iPad, celular o portátil</strong> se propaga de inmediato y en tiempo real a todos tus demás dispositivos sin riesgo de perderse.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-[#a5d0bc] pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">tablet_mac</span>
                <span>iPad sincronizado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">smartphone</span>
                <span>Celular sincronizado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">laptop</span>
                <span>Portátil sincronizada</span>
              </div>
            </div>

            <button
              onClick={onSyncServer}
              disabled={isSyncingServer}
              className="mt-1 py-2.5 px-4 rounded-xl bg-[#6cf8bb] hover:bg-[#8ffbc9] text-[#002116] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncingServer ? 'animate-spin' : ''}`}>
                {isSyncingServer ? 'sync' : 'cloud_sync'}
              </span>
              <span>{isSyncingServer ? 'Sincronizando con la nube...' : 'Forzar Sincronización Inmediata con la Nube'}</span>
            </button>
          </div>

          {/* Section 2: JSON Backup & Restore */}
          <div className="p-3.5 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-3">
            <span className="font-bold text-[#002217] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006c49] text-[18px]">data_object</span>
              Copia de Seguridad Portátil en Archivo JSON
            </span>

            {/* Export & Copy Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="py-2 px-3 rounded-lg bg-[#edefe9] hover:bg-[#e1e3dd] text-[#002217] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer border border-[#c1c8c3]/60"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">download</span>
                <span>Descargar Archivo JSON</span>
              </button>

              <button
                type="button"
                onClick={handleCopyClipboard}
                className="py-2 px-3 rounded-lg bg-[#edefe9] hover:bg-[#e1e3dd] text-[#002217] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer border border-[#c1c8c3]/60"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">
                  {copiedToast ? 'check' : 'content_copy'}
                </span>
                <span>{copiedToast ? '¡Copiado!' : 'Copiar Texto JSON'}</span>
              </button>
            </div>

            {/* Import Row */}
            <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-white border border-[#c1c8c3]/60">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-[#191c19]">Importar / Restaurar Respaldo</span>
                  <span className="text-[#717974] text-[11px]">Cargar archivo .json desde otro equipo</span>
                </div>
                {/* Merge vs Replace option */}
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="px-2 py-1 rounded bg-[#f2f4ee] border border-[#c1c8c3] text-[11px] font-medium text-[#191c19]"
                >
                  <option value="merge">Fusionar (sumar registros)</option>
                  <option value="replace">Reemplazar todo</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="py-2 px-3 rounded-lg bg-[#006c49] hover:bg-[#005236] text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer text-center">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Cargar Archivo .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowJsonTextarea(!showJsonTextarea)}
                  className="py-2 px-3 rounded-lg bg-[#edefe9] hover:bg-[#e1e3dd] text-[#002217] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#c1c8c3]/60"
                >
                  <span className="material-symbols-outlined text-[16px]">text_snippet</span>
                  <span>{showJsonTextarea ? 'Cerrar Pegado' : 'Pegar Texto JSON'}</span>
                </button>
              </div>

              {showJsonTextarea && (
                <div className="flex flex-col gap-2 pt-2 border-t border-[#e1e3dd]">
                  <textarea
                    rows={3}
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder="Pega aquí el contenido JSON copiado de otro dispositivo..."
                    className="w-full p-2 rounded bg-[#f8faf4] border border-[#c1c8c3] font-mono text-[11px] text-[#191c19]"
                  />
                  <button
                    type="button"
                    onClick={handleImportFromText}
                    className="py-1.5 px-3 rounded-lg bg-[#002217] text-[#6cf8bb] font-bold text-xs self-end cursor-pointer"
                  >
                    Procesar JSON Pegado
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          {importStatus && (
            <div className="p-3 rounded-xl bg-[#edefe9] border border-[#c1c8c3] text-[#002217] font-mono text-[11px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-[18px]">info</span>
              <span>{importStatus}</span>
            </div>
          )}

          {/* Action Close */}
          <div className="flex items-center justify-end pt-2 border-t border-[#e1e3dd]">
            <button
              onClick={onClose}
              className="py-2 px-5 rounded-xl bg-[#002217] text-white font-bold hover:bg-[#0f382a] cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
