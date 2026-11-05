import React from 'react';
import { useTheme, AppTheme } from '../utils/themeContext';

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  const themes: { id: AppTheme; label: string; icon: string; title: string; color: string }[] = [
    {
      id: 'dark',
      label: 'Noche',
      icon: 'dark_mode',
      title: 'Modo Nocturno de Campo (Cero Deslumbramiento)',
      color: '#6cf8bb',
    },
    {
      id: 'light',
      label: 'Día',
      icon: 'light_mode',
      title: 'Modo Diurno / Laboratorio',
      color: '#006c49',
    },
    {
      id: 'red',
      label: 'Roja',
      icon: 'visibility',
      title: 'Visión Nocturna Roja (Protege Rodopsina en Quebradas)',
      color: '#ef4444',
    },
  ];

  if (compact) {
    const current = themes.find((t) => t.id === theme) || themes[0];
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'red' : 'dark';

    return (
      <button
        onClick={() => setTheme(nextTheme)}
        className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
        title={`Tema actual: ${current.title}. Toca para cambiar.`}
      >
        <span className="material-symbols-outlined text-[16px]" style={{ color: current.color }}>
          {current.icon}
        </span>
        <span className="text-[11px] font-bold font-mono uppercase">{current.label}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center p-0.5 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 text-xs">
      {themes.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            title={t.title}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? 'bg-white/20 text-white shadow-xs'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ color: t.color }}>
              {t.icon}
            </span>
            <span className="hidden sm:inline text-[11px] font-mono">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
