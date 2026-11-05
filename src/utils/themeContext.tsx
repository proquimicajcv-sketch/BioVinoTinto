import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light' | 'red';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  isRedNight: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isDarkMode: true,
  isRedNight: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Por defecto 'dark' (Modo Nocturno de Campo) para evitar deslumbramiento en salidas nocturnas
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('biobitacora_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'red') {
      return saved as AppTheme;
    }
    return 'dark'; // Modo Nocturno de Campo por defecto según requerimiento explícito
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('biobitacora_theme', newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('red');
    else setTheme('dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-red', 'dark');

    if (theme === 'dark') {
      root.classList.add('dark', 'theme-dark');
      root.setAttribute('data-theme', 'dark');
      document.body.style.backgroundColor = '#061a14';
      document.body.style.color = '#e6fcf2';
    } else if (theme === 'red') {
      root.classList.add('dark', 'theme-red');
      root.setAttribute('data-theme', 'red');
      document.body.style.backgroundColor = '#0b0204';
      document.body.style.color = '#fecdd3';
    } else {
      root.classList.add('theme-light');
      root.setAttribute('data-theme', 'light');
      document.body.style.backgroundColor = '#f8faf4';
      document.body.style.color = '#191c19';
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDarkMode: theme === 'dark' || theme === 'red',
        isRedNight: theme === 'red',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
