"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { LANGUAGES, translations } from '@/utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState('en');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('app_language');
      if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
        setCurrentLang(savedLang);
      } else {
        setCurrentLang('en');
      }
    } catch (e) {
      console.error("Failed to load language preference:", e);
    }
  }, []);

  const changeLanguage = (langCode) => {
    if (LANGUAGES.some(l => l.code === langCode)) {
      setCurrentLang(langCode);
      try {
        localStorage.setItem('app_language', langCode);
      } catch (e) {}
    }
  };

  const t = (key, fallbackText = '') => {
    const dict = translations[currentLang] || translations.vi;
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    // Fallback to Vietnamese if available
    if (translations.vi && translations.vi[key] !== undefined) {
      return translations.vi[key];
    }
    return fallbackText || key;
  };

  const currentLanguageObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{
      currentLang,
      currentLanguageObj,
      languages: LANGUAGES,
      changeLanguage,
      t
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return a safe fallback if used outside Provider
    return {
      currentLang: 'en',
      currentLanguageObj: LANGUAGES.find(l => l.code === 'en') || LANGUAGES[1],
      languages: LANGUAGES,
      changeLanguage: () => {},
      t: (key, fallback = '') => translations.en[key] || fallback || key
    };
  }
  return context;
};
