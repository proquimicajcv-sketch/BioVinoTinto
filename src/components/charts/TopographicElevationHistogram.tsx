import React, { useState } from 'react';

export interface ElevationFloorData {
  key: string;
  label: string;
  rangeLabel: string;
  minElevation: number;
  maxElevation: number;
  specimenCount: number;
  individualsCount: number;
  characteristicSpecies: string;
  typicalHabitats: string;
  gradientColors: [string, string];
}

interface TopographicElevationHistogramProps {
  bins: Record<string, number>;
  totalSpecimens: number;
  isDarkMode?: boolean;
}

export const TopographicElevationHistogram: React.FC<TopographicElevationHistogramProps> = ({
  bins,
  totalSpecimens,
  isDarkMode = false,
}) => {
  const [activeFloorKey, setActiveFloorKey] = useState<string | null>(null);

  // Define Costa Rica's 4 scientific topographic floors
  const floors: ElevationFloorData[] = [
    {
      key: 'Basal',
      label: 'Piso Basal (Tierras Bajas)',
      rangeLabel: '0 - 500 msnm',
      minElevation: 0,
      maxElevation: 500,
      specimenCount: bins['Basal (0 - 500 m)'] || 0,
      individualsCount: Math.round((bins['Basal (0 - 500 m)'] || 0) * 1.5),
      characteristicSpecies: 'Agalychnis callidryas, Dendropsophus ebraccatus, Lachesis stenophrys',
      typicalHabitats: 'Llanuras aluviales, manglares, bosques húmedos de Sarapiquí y Osa',
      gradientColors: ['#059669', '#10b981'], // Emerald
    },
    {
      key: 'Premontano',
      label: 'Piso Premontano',
      rangeLabel: '501 - 1,500 msnm',
      minElevation: 501,
      maxElevation: 1500,
      specimenCount: bins['Premontano (501 - 1,500 m)'] || 0,
      individualsCount: Math.round((bins['Premontano (501 - 1,500 m)'] || 0) * 2),
      characteristicSpecies: 'Craugastor fitzingeri, Bothriechis schlegelii, Espadarana prosoblepon',
      typicalHabitats: 'Valles intermontanos, cafetales de sombra, quebradas de media montaña',
      gradientColors: ['#0284c7', '#38bdf8'], // Sky blue
    },
    {
      key: 'MontanoBajo',
      label: 'Piso Montano Bajo',
      rangeLabel: '1,501 - 2,500 msnm',
      minElevation: 1501,
      maxElevation: 2500,
      specimenCount: bins['Montano Bajo (1,501 - 2,500 m)'] || 0,
      individualsCount: Math.round((bins['Montano Bajo (1,501 - 2,500 m)'] || 0) * 3),
      characteristicSpecies: 'Isthmohyla nacientes (Quebradas de Dota y Tarrazú), Craugastor melanostictus',
      typicalHabitats: 'Bosque nuboso ripario, nacientes cristalinas de montaña en Los Santos',
      gradientColors: ['#7c3aed', '#a78bfa'], // Violet / High Mountain Cloudforest
    },
    {
      key: 'Montano',
      label: 'Piso Montano & Páramo',
      rangeLabel: '> 2,500 msnm',
      minElevation: 2501,
      maxElevation: 3820,
      specimenCount: bins['Montano (> 2,500 m)'] || 0,
      individualsCount: Math.round((bins['Montano (> 2,500 m)'] || 0) * 1.2),
      characteristicSpecies: 'Isthmura peruviana, Bolitoglossa pesrubra, Sceloporus malachiticus',
      typicalHabitats: 'Robledales fríos de altura, Cerro de la Muerte, Páramo Chirripó (3,820m)',
      gradientColors: ['#d97706', '#f59e0b'], // Amber / Alpine Mountain
    },
  ];

  const maxCount = Math.max(...floors.map((f) => f.specimenCount), 1);
  const activeFloor = floors.find((f) => f.key === activeFloorKey) || floors[2]; // Default to Montano Bajo where Isthmohyla is!

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Topographic Altitude Profile Graphic (Simulating Costa Rica's Cross-Section) */}
      <div className={`relative p-4 rounded-2xl border overflow-hidden transition-all ${
        isDarkMode ? 'bg-[#0b281f] border-[#1a4537]' : 'bg-gradient-to-b from-[#f2f7f4] to-[#e8f1ec] border-[#c1c8c3]'
      }`}>
        {/* Mountain Silhouette Background SVG */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="w-full h-full">
            {/* Mountain slope representing Costa Rica's Continental Divide */}
            <path
              d="M0,190 L90,160 L180,120 L270,70 L360,20 L450,80 L540,140 L600,185 L600,200 L0,200 Z"
              fill={isDarkMode ? '#6cf8bb' : '#006c49'}
            />
            {/* Contour elevation isolines */}
            <path d="M0,150 Q270,40 600,150" fill="none" stroke="#6cf8bb" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M0,100 Q270,10 600,100" fill="none" stroke="#6cf8bb" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Header Indicator */}
        <div className="relative z-10 flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] dark:text-[#6cf8bb] text-[20px]">
              landscape
            </span>
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-[#e6fcf2]' : 'text-[#002217]'}`}>
              Perfil Topográfico de Costa Rica (0 a 3,820 msnm)
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40 text-[#717974] dark:text-[#a5d0bc] border border-[#c1c8c3]/40">
            Gradiente Altitudinal Herpetológico
          </span>
        </div>

        {/* Vertical Histogram Bars across the Topographic Profile */}
        <div className="relative z-10 grid grid-cols-4 gap-2.5 sm:gap-4 h-48 items-end pt-4 pb-2 border-b border-[#c1c8c3]/40">
          {floors.map((floor) => {
            const heightPct = Math.max(Math.round((floor.specimenCount / maxCount) * 80), 12);
            const isSelected = activeFloorKey === floor.key;
            const pctOfTotal = totalSpecimens > 0 ? ((floor.specimenCount / totalSpecimens) * 100).toFixed(0) : '0';

            return (
              <div
                key={floor.key}
                onMouseEnter={() => setActiveFloorKey(floor.key)}
                onClick={() => setActiveFloorKey(floor.key)}
                className="flex flex-col items-center justify-end h-full gap-2 cursor-pointer group"
              >
                {/* Number badge on top of bar */}
                <div className={`transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold shadow-xs flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#002217] text-[#6cf8bb] ring-2 ring-[#6cf8bb]'
                      : isDarkMode
                      ? 'bg-black/60 text-white'
                      : 'bg-white text-[#002217] border border-[#c1c8c3]'
                  }`}>
                    <span>{floor.specimenCount}</span>
                    <span className="text-[9px] opacity-75">({pctOfTotal}%)</span>
                  </span>
                </div>

                {/* Vertical Bar simulating mountain elevation block */}
                <div className="w-full max-w-[64px] bg-black/10 dark:bg-white/10 rounded-t-xl overflow-hidden flex flex-col justify-end h-full">
                  <div
                    className="w-full rounded-t-xl transition-all duration-700 relative shadow-md group-hover:brightness-110"
                    style={{
                      height: `${heightPct}%`,
                      background: `linear-gradient(to top, ${floor.gradientColors[0]}, ${floor.gradientColors[1]})`,
                      borderTop: isSelected ? '3px solid #ffffff' : 'none',
                    }}
                  >
                    {/* Inner texture lines */}
                    <div className="absolute inset-0 opacity-15 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,#fff_4px,#fff_6px)]" />
                  </div>
                </div>

                {/* Floor Label underneath */}
                <div className="text-center w-full">
                  <span className={`block font-bold text-[11px] truncate ${
                    isSelected ? 'text-[#006c49] dark:text-[#6cf8bb]' : isDarkMode ? 'text-[#c1ecd7]' : 'text-[#002217]'
                  }`}>
                    {floor.key}
                  </span>
                  <span className="block text-[9px] text-[#717974] dark:text-[#889990] font-mono">
                    {floor.rangeLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Altitudinal Floor Deep Info Banner */}
        <div className={`mt-3 p-3 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode
            ? 'bg-[#10382b]/80 border-[#6cf8bb]/30 text-[#e6fcf2]'
            : 'bg-white border-[#d1ded6] text-[#002217]'
        }`}>
          <div className="flex flex-col gap-1 max-w-lg">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeFloor.gradientColors[0] }}
              />
              <strong className="text-xs font-bold">{activeFloor.label} ({activeFloor.rangeLabel})</strong>
              <span className="text-[10px] font-mono text-[#006c49] dark:text-[#6cf8bb] font-bold bg-[#6cf8bb]/20 px-2 py-0.5 rounded">
                {activeFloor.specimenCount} especímenes catalogados
              </span>
            </div>
            <p className="text-[11px] text-[#414844] dark:text-[#a5d0bc] leading-snug">
              <strong>Hábitats típicos:</strong> {activeFloor.typicalHabitats}
            </p>
            <p className="text-[10px] text-[#717974] dark:text-[#889990] italic">
              <strong>Fauna representativa:</strong> {activeFloor.characteristicSpecies}
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 sm:border-l border-[#c1c8c3]/40 pt-2 sm:pt-0 sm:pl-3 shrink-0">
            <span className="text-[10px] text-[#717974] dark:text-[#a5d0bc] uppercase font-mono">
              Rango Altitudinal
            </span>
            <span className="text-sm font-black font-mono text-[#006c49] dark:text-[#6cf8bb]">
              {activeFloor.minElevation}m - {activeFloor.maxElevation}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
