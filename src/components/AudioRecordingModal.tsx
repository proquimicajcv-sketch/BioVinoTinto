import React, { useState, useRef, useEffect } from 'react';
import { BioacousticRecord } from '../types/specimen';
import { playCustomAudio, SoundPlaybackController } from '../utils/audioBioacoustics';

interface AudioRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBioacoustics?: BioacousticRecord;
  onSave: (bioacoustics: BioacousticRecord) => void;
}

export const AudioRecordingModal: React.FC<AudioRecordingModalProps> = ({
  isOpen,
  onClose,
  initialBioacoustics,
  onSave,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(initialBioacoustics?.title || 'Canto de Anuncio');
  const [callType, setCallType] = useState(
    initialBioacoustics?.callType || 'Vocalización Territorial / Canto'
  );
  const [frequency, setFrequency] = useState(
    initialBioacoustics?.dominantFrequencyRange || '1.8 - 2.4 kHz'
  );
  const [pattern, setPattern] = useState(
    initialBioacoustics?.audioPatternDescription || '"Chack-chack" gutural monotonal'
  );
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(
    initialBioacoustics?.audioDataUrl || null
  );

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Preview Playback State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const playbackControllerRef = useRef<SoundPlaybackController | null>(null);

  useEffect(() => {
    return () => {
      playbackControllerRef.current?.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Start Mic Recording
  const startRecording = async () => {
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
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone access error:', err);
      alert('No se pudo acceder al micrófono. Por favor verifique los permisos de audio en su navegador.');
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // File Upload (WAV, MP3, M4A)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAudioDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Preview Playback
  const togglePlayPreview = () => {
    if (isPlayingPreview) {
      playbackControllerRef.current?.stop();
      setIsPlayingPreview(false);
    } else if (audioDataUrl) {
      setIsPlayingPreview(true);
      playbackControllerRef.current = playCustomAudio(
        audioDataUrl,
        undefined,
        () => setIsPlayingPreview(false)
      );
    }
  };

  const handleSave = () => {
    onSave({
      title,
      callType,
      dominantFrequencyRange: frequency,
      durationSeconds: recordingSeconds > 0 ? recordingSeconds : 24,
      audioPatternDescription: pattern,
      audioDataUrl: audioDataUrl || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#002217] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6cf8bb] text-[22px]">graphic_eq</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Registro de Audio Bioacústico</h3>
              <p className="text-[11px] text-[#79a28f] font-mono">
                Grabar con micrófono o subir archivo (.mp3, .wav, .m4a)
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

        <div className="p-5 flex flex-col gap-4">
          {/* Audio Input Options Mosaic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Live Mic Recording Card */}
            <div className="p-3.5 rounded-xl border border-[#c1c8c3] bg-[#f8faf4] flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-xs font-bold text-[#002217]">Grabar en Vivo en Campo</span>
              {isRecording ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2 text-red-600 font-mono text-xs font-bold animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span>00:{String(recordingSeconds).padStart(2, '0')} REC</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">stop</span>
                    <span>Detener Grabación</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-4 py-2 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#6cf8bb]">mic</span>
                  <span>Iniciar Grabación</span>
                </button>
              )}
            </div>

            {/* Audio File Upload Card */}
            <div className="p-3.5 rounded-xl border border-[#c1c8c3] bg-[#f8faf4] flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-xs font-bold text-[#002217]">Subir Archivo de Audio</span>
              <label className="px-4 py-2 rounded-xl bg-white hover:bg-[#edefe9] text-[#002217] border border-[#c1c8c3] text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#006c49]">upload_file</span>
                <span>Seleccionar Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[10px] text-[#717974]">MP3, WAV, M4A, OGG</span>
            </div>
          </div>

          {/* Audio Status & Preview Player */}
          {audioDataUrl && (
            <div className="p-3 rounded-xl bg-[#c1ecd7]/30 border border-[#006c49]/40 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={togglePlayPreview}
                  className="w-9 h-9 rounded-full bg-[#002217] text-[#6cf8bb] flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isPlayingPreview ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#002116] truncate">Audio listo para guardar</p>
                  <p className="text-[11px] text-[#006c49] font-mono">
                    {isPlayingPreview ? 'Reproduciendo audio...' : 'Haga clic para escuchar vista previa'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAudioDataUrl(null)}
                className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          )}

          {/* Bioacoustic Descriptor Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Título del Registro
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="p. ej. Canto de Anuncio / Canto Matutino"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Tipo de Vocalización
              </label>
              <input
                type="text"
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                placeholder="Canto reproductivo / Llamado de alarma"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Frecuencia Dominante
              </label>
              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="p. ej. 1.8 - 2.4 kHz"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono text-[#006c49] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Patrón Acústico
              </label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder='"Chack-chack" gutural / Silbido ascendente'
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e1e3dd]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#6cf8bb]">check</span>
              <span>Guardar Registro Acústico</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
