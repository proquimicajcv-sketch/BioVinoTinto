import React, { useState } from 'react';

export interface TaxonDonutItem {
  key: string;
  label: string;
  speciesCount: number;
  individualsCount: number;
  sightingsCount: number;
  color: string;
  icon: string;
}

interface TaxonDonutChartProps {
  data: TaxonDonutItem[];
  totalSpecies: number;
  totalIndividuals: number;
  selectedGroup?: string;
  onSelectGroup?: (groupKey: string) => void;
  isDarkMode?: boolean;
}

export const TaxonDonutChart: React.FC<TaxonDonutChartProps> = ({
  data,
  totalSpecies,
  totalIndividuals,
  selectedGroup = 'ALL',
  onSelectGroup,
  isDarkMode = false,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const activeKey = hoveredKey || (selectedGroup !== 'ALL' ? selectedGroup : null);
  const activeItem = data.find((d) => d.key === activeKey);

  // Filter items with at least 0 counts
  const validData = data.filter((d) => d.speciesCount > 0);
  const sumSpecies = validData.reduce((acc, curr) => acc + curr.speciesCount, 0) || totalSpecies || 1;

  // SVG dimensions
  const size = 260;
  const strokeWidth = 36;
  const radius = (size - strokeWidth) / 2 - 8;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute angles and strokeDashoffset
  let accumulatedAngle = 0;
  const slices = validData.map((item) => {
    const fraction = item.speciesCount / sumSpecies;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += fraction;
    return {
      ...item,
      fraction,
      percentage: (fraction * 100).toFixed(1),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-2">
      {/* Donut SVG Container */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 drop-shadow-sm select-none"
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={isDarkMode ? '#0a2e22' : '#f0f4ee'}
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {slices.map((slice) => {
            const isHovered = activeKey === slice.key;
            return (
              <circle
                key={slice.key}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 8 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                style={{
                  opacity: activeKey && !isHovered ? 0.35 : 1,
                  filter: isHovered ? 'drop-shadow(0px 2px 8px rgba(0,0,0,0.3))' : 'none',
                }}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onSelectGroup?.(slice.key === selectedGroup ? 'ALL' : slice.key)}
              />
            );
          })}
        </svg>

        {/* Center Content Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeItem ? (
            <div className="animate-in fade-in zoom-in-95 duration-150 flex flex-col items-center">
              <span className="material-symbols-outlined text-[20px]" style={{ color: activeItem.color }}>
                {activeItem.icon}
              </span>
              <span className={`text-xl font-black font-mono leading-none mt-0.5 ${isDarkMode ? 'text-white' : 'text-[#002217]'}`}>
                {activeItem.speciesCount}
              </span>
              <span className="text-[10px] font-bold text-[#717974] uppercase tracking-wider">
                {activeItem.label}
              </span>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full mt-0.5"
                style={{ backgroundColor: `${activeItem.color}25`, color: activeItem.color }}
              >
                {((activeItem.speciesCount / sumSpecies) * 100).toFixed(1)}%
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">donut_large</span>
              <span className={`text-2xl font-black font-mono leading-none mt-0.5 ${isDarkMode ? 'text-[#6cf8bb]' : 'text-[#002217]'}`}>
                {totalSpecies}
              </span>
              <span className="text-[10px] font-bold text-[#717974] uppercase tracking-wider">
                Especies
              </span>
              <span className="text-[9px] text-[#006c49] font-mono font-bold">
                {totalIndividuals} individuos
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Legend & Details List */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${isDarkMode ? 'text-[#a5d0bc]' : 'text-[#002217]'}`}>
          <span>Proporción de Taxones</span>
          <span className="font-mono text-[10px] text-[#717974]">Pasa el cursor o toca</span>
        </span>

        <div className="flex flex-col gap-1.5">
          {data.map((item) => {
            const isHovered = activeKey === item.key;
            const pct = sumSpecies > 0 ? ((item.speciesCount / sumSpecies) * 100).toFixed(1) : '0';

            return (
              <div
                key={item.key}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onSelectGroup?.(item.key === selectedGroup ? 'ALL' : item.key)}
                className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isHovered
                    ? isDarkMode
                      ? 'bg-[#103a2c] border-[#6cf8bb] shadow-md ring-1 ring-[#6cf8bb]'
                      : 'bg-[#f0fdf4] border-[#006c49] shadow-sm ring-1 ring-[#006c49]'
                    : isDarkMode
                    ? 'bg-[#0b281f]/60 border-[#1a4537] hover:border-[#6cf8bb]/40'
                    : 'bg-white border-[#e1e3dd] hover:border-[#c1c8c3]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex flex-col">
                    <span className={`font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-[#002217]'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-[#717974] font-mono">
                      {item.individualsCount} inds • {item.sightingsCount} avist.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold text-xs ${isDarkMode ? 'text-[#c1ecd7]' : 'text-[#191c19]'}`}>
                    {item.speciesCount} esp.
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{ backgroundColor: `${item.color}25`, color: item.color }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
