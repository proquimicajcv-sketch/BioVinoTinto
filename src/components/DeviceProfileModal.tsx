import React, { useState } from 'react';

interface DeviceProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  observerName: string;
  onSaveObserverName: (newName: string) => void;
  deviceName: string;
  onSaveDeviceName: (newName: string) => void;
  specimensCount: number;
  totalSightingsCount: number;
  onResetToInitial: () => void;
  onOpenSyncBackup: () => void;
}

export const DeviceProfileModal: React.FC<DeviceProfileModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  observerName,
  onSaveObserverName,
  deviceName,
  onSaveDeviceName,
  specimensCount,
  totalSightingsCount,
  onResetToInitial,
  onOpenSyncBackup,
}) => {
  if (!isOpen) return null;

  const [localObserver, setLocalObserver] = useState(observerName);
  const [localDeviceName, setLocalDeviceName] = useState(deviceName);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveObserverName(localObserver.trim() || 'Ing. Carvajal V.');
    onSaveDeviceName(localDeviceName.trim() || 'Mi Dispositivo de Campo');
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 1200);
  };

  const handleCopyShareLink = async () => {
    try {
      const url = window.location.origin + window.location.pathname;
      const shareText = `BioBitácora CR - Bitácora de Campo de Costa Rica: Abre este enlace en tu teléfono o computadora para registrar fauna y flora. Cada persona trabaja en su propio dispositivo sin cuentas ni cruce de datos: ${url}`;
      await navigator.clipboard.writeText(shareText);
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 3500);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#002217] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 flex items-center justify-center text-[#6cf8bb]">
              <span className="material-symbols-outlined text-[22px]">devices</span>
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Dispositivo &amp; Bitácora Privada</h3>
              <p className="text-[11px] text-[#79a28f] font-mono">
                Modo Autónomo Multi-Dispositivo • Sin cuentas requeridas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Toast de guardado */}
          {saveToast && (
            <div className="p-3 rounded-xl bg-[#002217] text-[#6cf8bb] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>¡Perfil de dispositivo actualizado correctamente!</span>
            </div>
          )}

          {/* Banner de Garantía: Datos Aislados por Dispositivo */}
          <div className="p-4 rounded-xl bg-[#c1ecd7]/35 border border-[#006c49]/40 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#006c49] text-[24px] flex-shrink-0 mt-0.5">
              security
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#002116] text-[13px] flex items-center gap-1.5">
                <span>Avistamientos 100% Independientes</span>
                <span className="px-2 py-0.5 rounded-full bg-[#006c49] text-white text-[10px] font-mono">
                  ACTIVO
                </span>
              </span>
              <p className="text-[#32453c] leading-relaxed">
                Cada celular, tablet o computadora funciona como una estación de campo <strong>totalmente autónoma</strong>.
                Tus avistamientos se guardan en la memoria de este dispositivo y <strong>no se mezclan ni se cruzan</strong> con los de otras personas.
                Nadie necesita registrarse ni crear cuenta para usar la app.
              </p>
            </div>
          </div>

          {/* Tarjeta de métricas del dispositivo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-[#f2f4ee] border border-[#e1e3dd] flex flex-col">
              <span className="text-[10px] text-[#717974] font-semibold uppercase">ID Dispositivo</span>
              <span className="font-mono text-xs font-extrabold text-[#002217] mt-0.5">{deviceId}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#f2f4ee] border border-[#e1e3dd] flex flex-col">
              <span className="text-[10px] text-[#717974] font-semibold uppercase">Especies</span>
              <span className="font-mono text-xs font-extrabold text-[#006c49] mt-0.5">{specimensCount} registradas</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#f2f4ee] border border-[#e1e3dd] flex flex-col">
              <span className="text-[10px] text-[#717974] font-semibold uppercase">Avistamientos</span>
              <span className="font-mono text-xs font-extrabold text-[#002217] mt-0.5">{totalSightingsCount} en sitio</span>
            </div>
          </div>

          {/* Formulario de Configuración del Observador en este Dispositivo */}
          <form onSubmit={handleSave} className="p-4 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-[#002217] font-bold text-sm">
              <span className="material-symbols-outlined text-[18px] text-[#006c49]">badge</span>
              <span>Identidad del Observador en este Dispositivo</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Nombre del Observador / Investigador Principal *
              </label>
              <input
                type="text"
                required
                value={localObserver}
                onChange={(e) => setLocalObserver(e.target.value)}
                placeholder="Ej: Ing. Carvajal V., Dra. Sofía Mora..."
                className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] bg-white text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
              <span className="text-[10px] text-[#717974] mt-0.5 block">
                Este nombre aparecerá automáticamente como observador predeterminado en los avistamientos registrados desde este equipo.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#002217] uppercase mb-1">
                Etiqueta o Nombre de este Dispositivo
              </label>
              <input
                type="text"
                value={localDeviceName}
                onChange={(e) => setLocalDeviceName(e.target.value)}
                placeholder="Ej: Mi Teléfono de Campo, Tablet Estación La Selva, Laptop Laboratorio..."
                className="w-full px-3 py-2 rounded-xl border border-[#c1c8c3] bg-white text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div className="pt-2 border-t border-[#e1e3dd] flex items-center justify-end">
              <button
                type="submit"
                className="py-2 px-4 rounded-xl bg-[#002217] hover:bg-[#003d2b] text-[#6cf8bb] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Guardar en este Dispositivo</span>
              </button>
            </div>
          </form>

          {/* Cómo compartir con otras personas sin mezclar */}
          <div className="p-3.5 rounded-xl bg-white border border-[#c1c8c3] flex flex-col gap-2">
            <span className="font-bold text-[#002217] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006c49] text-[18px]">share</span>
              ¿Cómo compartir con colegas o amigos?
            </span>
            <p className="text-[#414844] leading-relaxed">
              Copia el enlace de la aplicación y envíaselo por WhatsApp o correo. Al abrirlo en sus teléfonos o computadoras, <strong>cada uno tendrá automáticamente su propia bitácora limpia e independiente</strong>. No se les pedirá contraseña ni cuenta.
            </p>
            <button
              onClick={handleCopyShareLink}
              className="py-2.5 px-3 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#6cf8bb]">
                {isCopiedLink ? 'check' : 'content_copy'}
              </span>
              <span>{isCopiedLink ? '¡Enlace de Invitación Copiado!' : 'Copiar Enlace para Enviar a Colega'}</span>
            </button>
          </div>

          {/* Transferencia voluntaria de datos y Respaldo */}
          <div className="p-3.5 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-2">
            <span className="font-bold text-[#002217] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006c49] text-[18px]">swap_horiz</span>
              Intercambio Voluntario entre Investigadores
            </span>
            <p className="text-[#414844]">
              Si en algún momento deseas compartir tus avistamientos con un colega para que los revise o incorpore a su lista, puedes descargar tu archivo de respaldo JSON o Darwin Core y enviárselo directamente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenSyncBackup();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-[#f0f2ec] border border-[#c1c8c3] text-[#002217] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">sync_saved_locally</span>
                <span>Exportar / Importar Respaldo</span>
              </button>
            </div>
          </div>

          {/* Zona de Peligro / Restablecer dispositivo */}
          <div className="p-3 rounded-xl border border-red-200 bg-red-50/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-red-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                Restablecer Bitácora de este Dispositivo
              </span>
            </div>
            <p className="text-[11px] text-red-700">
              Si vas a prestar este dispositivo o deseas reiniciar tu inventario al catálogo de referencia limpio de Costa Rica, puedes restablecerlo. Esto no afecta los dispositivos de otras personas.
            </p>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="py-1.5 px-3 rounded-lg bg-white hover:bg-red-100 border border-red-300 text-red-700 font-bold self-start cursor-pointer transition-colors"
              >
                Restablecer datos de este equipo
              </button>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    onResetToInitial();
                    setShowResetConfirm(false);
                    onClose();
                  }}
                  className="py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                >
                  Confirmar Restablecimiento
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="py-1.5 px-3 rounded-lg bg-white border border-[#c1c8c3] text-[#414844] font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f2f4ee] border-t border-[#e1e3dd] flex items-center justify-between">
          <span className="text-[11px] text-[#717974] font-mono">
            {deviceId} • Privacidad Garantizada
          </span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-[#002217] hover:bg-[#003d2b] text-white text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
