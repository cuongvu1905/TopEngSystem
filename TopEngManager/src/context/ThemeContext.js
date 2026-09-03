"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEME_STYLES = [
  {
    id: 'classic',
    nameKey: 'theme.styleClassic',
    defaultName: 'Classic',
    icon: 'fa-solid fa-shapes',
    accentColor: '#3b82f6'
  },
  {
    id: 'cyber',
    nameKey: 'theme.styleCyber',
    defaultName: 'Cyber',
    icon: 'fa-solid fa-bolt',
    accentColor: '#10b981'
  }
];

export const COLOR_MODES = [
  {
    id: 'light',
    nameKey: 'theme.modeLight',
    defaultName: 'Sáng (Light)',
    icon: 'fa-solid fa-sun',
    badge: 'Light'
  },
  {
    id: 'dark',
    nameKey: 'theme.modeDark',
    defaultName: 'Tối (Dark)',
    icon: 'fa-solid fa-moon',
    badge: 'Dark'
  }
];

export const THEMES = [
  {
    id: 'light',
    style: 'classic',
    mode: 'light',
    nameKey: 'theme.light',
    defaultName: 'Cổ điển Sáng (Classic Light)',
    icon: 'fa-solid fa-sun',
    badge: 'Classic Light',
    preview: { bg: '#f9fafb', card: '#ffffff', accent: '#1e40af', border: '#e5e7eb', text: '#1f2937' }
  },
  {
    id: 'dark',
    style: 'classic',
    mode: 'dark',
    nameKey: 'theme.dark',
    defaultName: 'Cổ điển Tối (Navy Dark)',
    icon: 'fa-solid fa-moon',
    badge: 'Navy Dark',
    preview: { bg: '#0f172a', card: '#1e293b', accent: '#3b82f6', border: '#334155', text: '#f8fafc' }
  },
  {
    id: 'cyber-light',
    style: 'cyber',
    mode: 'light',
    nameKey: 'theme.cyberLight',
    defaultName: 'Cyber Sáng (Cyber Light)',
    icon: 'fa-solid fa-terminal',
    badge: 'Cyber Light',
    preview: { bg: '#f1f5f9', card: '#ffffff', accent: '#059669', border: '#cbd5e1', text: '#0f172a' }
  },
  {
    id: 'trollllm',
    style: 'cyber',
    mode: 'dark',
    nameKey: 'theme.trollllm',
    defaultName: 'Cyber Tối (Cyber Midnight)',
    icon: 'fa-solid fa-bolt',
    badge: 'Cyber Dark',
    preview: { bg: '#090712', card: '#0f0c1f', accent: '#10b981', border: '#1e1736', text: '#ffffff' }
  }
];

export function getThemeIdFromStyleAndMode(style, mode) {
  if (style === 'cyber') {
    return mode === 'light' ? 'cyber-light' : 'trollllm';
  }
  return mode === 'light' ? 'light' : 'dark';
}

export function parseThemeId(themeId) {
  if (themeId === 'cyber-light') return { style: 'cyber', mode: 'light' };
  if (themeId === 'trollllm') return { style: 'cyber', mode: 'dark' };
  if (themeId === 'light') return { style: 'classic', mode: 'light' };
  return { style: 'classic', mode: 'dark' };
}

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [themeStyle, setThemeStyle] = useState('classic');
  const [themeMode, setThemeMode] = useState('dark');

  const applyTheme = (themeId) => {
    try {
      if (themeId === 'light') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', themeId);
      }
    } catch (e) {}
  };

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      let effectiveTheme = 'dark';
      if (savedTheme && ['light', 'dark', 'trollllm', 'cyber-light'].includes(savedTheme)) {
        effectiveTheme = savedTheme;
      }
      const { style, mode } = parseThemeId(effectiveTheme);
      setCurrentTheme(effectiveTheme);
      setThemeStyle(style);
      setThemeMode(mode);
      applyTheme(effectiveTheme);
    } catch (e) {
      console.error("Failed to load theme preference:", e);
    }
  }, []);

  const changeTheme = (themeId) => {
    const { style, mode } = parseThemeId(themeId);
    setCurrentTheme(themeId);
    setThemeStyle(style);
    setThemeMode(mode);
    applyTheme(themeId);
    try {
      localStorage.setItem('theme', themeId);
    } catch (e) {}
  };

  const changeStyleAndMode = (newStyle, newMode) => {
    const targetThemeId = getThemeIdFromStyleAndMode(newStyle, newMode);
    changeTheme(targetThemeId);
  };

  const changeThemeStyle = (newStyle) => {
    changeStyleAndMode(newStyle, themeMode);
  };

  const changeThemeMode = (newMode) => {
    changeStyleAndMode(themeStyle, newMode);
  };

  const currentThemeObj = THEMES.find(t => t.id === currentTheme) || THEMES[1];

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      currentThemeObj,
      themeStyle,
      themeMode,
      themeStyles: THEME_STYLES,
      colorModes: COLOR_MODES,
      themes: THEMES,
      changeTheme,
      changeThemeStyle,
      changeThemeMode,
      changeStyleAndMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      currentTheme: 'dark',
      currentThemeObj: THEMES[1],
      themeStyle: 'classic',
      themeMode: 'dark',
      themeStyles: THEME_STYLES,
      colorModes: COLOR_MODES,
      themes: THEMES,
      changeTheme: () => {},
      changeThemeStyle: () => {},
      changeThemeMode: () => {},
      changeStyleAndMode: () => {}
    };
  }
  return context;
};
