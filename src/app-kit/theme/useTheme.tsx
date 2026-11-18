// src/app-kit/theme/useTheme.ts

import React, { createContext, useContext, useState, useEffect } from 'react';
import { LightColors, DarkColors, spacing } from './colors';
import { StorageManager } from '../services/StorageManager'; // Ya aapke project ka storage import path

interface ThemeContextType {
  isDarkMode: boolean;
  colors: typeof DarkColors;
  spacing: typeof spacing;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  colors: DarkColors,
  spacing: spacing,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // App load hote hi saved theme preference fetch karein
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedTheme = await StorageManager.getItem('app_theme_mode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (e) {}
    };
    loadSavedTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const nextMode = !isDarkMode;
      setIsDarkMode(nextMode);
      await StorageManager.setItem('app_theme_mode', nextMode ? 'dark' : 'light');
    } catch (e) {}
  };

  const colors = isDarkMode ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, spacing, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);