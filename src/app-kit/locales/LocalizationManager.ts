// src/app-kit/locales/LocalizationManager.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EN_TRANSLATIONS,
  LOCALE_DICTIONARY,
  SupportedLanguage,
  TranslationKey,
  isLanguageRTL,
  normalizeLanguage,
} from './translations';

type LanguageListener = (lang: SupportedLanguage) => void;

const LANGUAGE_STORAGE_KEY = 'selected_language';

class LocalizationManagerClass {
  private currentLanguage: SupportedLanguage = 'en';
  private listeners = new Set<LanguageListener>();
  private hydrated = false;

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  isRTL(): boolean {
    return isLanguageRTL(this.currentLanguage);
  }

  async hydrate(): Promise<SupportedLanguage> {
    if (this.hydrated) {
      return this.currentLanguage;
    }
    this.hydrated = true;
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) {
        const normalized = normalizeLanguage(saved);
        if (normalized !== this.currentLanguage) {
          this.currentLanguage = normalized;
          this.notify();
        }
      }
    } catch {}
    return this.currentLanguage;
  }

  setLanguage(langCode: string): SupportedLanguage {
    const normalized = normalizeLanguage(langCode);
    this.currentLanguage = normalized;
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalized).catch(() => {});
    this.notify();
    return normalized;
  }

  subscribe(listener: LanguageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  t(key: string, params?: Record<string, string | number>): string {
    const typedKey = key as TranslationKey;
    const localeEntry = LOCALE_DICTIONARY[this.currentLanguage]?.[typedKey];
    const fallbackEntry = EN_TRANSLATIONS[typedKey];
    let template = localeEntry ?? fallbackEntry ?? key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      });
    }

    return template;
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentLanguage);
      } catch {}
    });
  }
}

export const LocalizationManager = new LocalizationManagerClass();