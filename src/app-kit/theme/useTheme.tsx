// src/app-kit/theme/useTheme.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LightColors, DarkColors, spacing } from './colors';
import { StorageManager } from '../storage/StorageManager';

interface ThemeContextType {
  isDarkMode: boolean;
  colors: typeof DarkColors;
  spacing: typeof spacing;
  toggleTheme: () => Promise<void> | void;
}

export const APP_THEME_MODE_KEY = 'app_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  colors: DarkColors,
  spacing: spacing,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    let active = true;
    const loadSavedTheme = async () => {
      try {
        const savedTheme = await StorageManager.getItem<string>(APP_THEME_MODE_KEY);
        if (active && (savedTheme === 'dark' || savedTheme === 'light')) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch {}
    };
    void loadSavedTheme();

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback(async () => {
    setIsDarkMode((prev) => {
      const nextMode = !prev;
      void StorageManager.setItem(APP_THEME_MODE_KEY, nextMode ? 'dark' : 'light').catch(() => {});
      return nextMode;
    });
  }, []);

  const colors = isDarkMode ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, spacing, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);