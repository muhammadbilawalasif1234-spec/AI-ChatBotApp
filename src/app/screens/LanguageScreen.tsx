// src/app/screens/LanguageScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { StorageManager } from '../../app-kit/storage/StorageManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';
import { AdBlockManager } from '../../app-kit/ads/AdBlockManager';

interface LanguageScreenProps {
  onNext: () => void;
}

interface Language {
  id: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦' },
  { id: 'af', name: 'Afrikaans (Afrikaans)', flag: '🇿🇦' },
  { id: 'zh', name: 'Chinese (Simplified) (简体中文)', flag: '🇨🇳' },
  { id: 'cs', name: 'Czech (čeština)', flag: '🇨🇿' },
  { id: 'nl', name: 'Dutch (Nederlands)', flag: '🇳🇱' },
  { id: 'fr', name: 'French (français)', flag: '🇫🇷' },
];

export const SELECTED_LANGUAGE_KEY = 'selected_language';
export const INITIAL_LANGUAGE_DONE_KEY = 'has_completed_initial_language';

function persistLanguageInBackground(langId: string, markInitialDone = false): void {
  try {
    LocalizationManager.setLanguage(langId);
  } catch {}

  const tasks: Promise<unknown>[] = [
    StorageManager.setItem(SELECTED_LANGUAGE_KEY, langId).catch(() => {}),
    AsyncStorage.setItem(SELECTED_LANGUAGE_KEY, langId).catch(() => {}),
  ];

  if (markInitialDone) {
    tasks.push(
      StorageManager.setItem(INITIAL_LANGUAGE_DONE_KEY, 'true').catch(() => {}),
      AsyncStorage.setItem(INITIAL_LANGUAGE_DONE_KEY, 'true').catch(() => {})
    );
  }

  void Promise.allSettled(tasks);
}

export default function LanguageScreen({ onNext }: LanguageScreenProps) {
  const [selectedLang, setSelectedLang] = useState(
    LocalizationManager.getLanguage() || 'en'
  );
  const [isAdsBlocked, setIsAdsBlocked] = useState<boolean>(() =>
    AdBlockManager.isEnabled()
  );
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const adSlideAnim = useRef(new Animated.Value(140)).current;
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    const unsubscribe = AdBlockManager.subscribe((blocked) => {
      setIsAdsBlocked(blocked);
      if (blocked) {
        setIsAdLoaded(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdsBlocked) {
      setIsAdLoaded(false);
      adSlideAnim.setValue(140);
      return;
    }

    if (isAdLoaded) {
      adSlideAnim.setValue(140);
      Animated.timing(adSlideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      adSlideAnim.setValue(140);
    }
  }, [isAdLoaded, isAdsBlocked, adSlideAnim]);

  const handleSelectLanguage = (langId: string) => {
    setSelectedLang(langId);
    persistLanguageInBackground(langId, false);
  };

  const handleNextPress = () => {
    const langToSave = selectedLang || LocalizationManager.getLanguage() || 'en';
    persistLanguageInBackground(langToSave, true);
    onNext();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header with Top-Right Next Arrow Button */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {LocalizationManager.t('selectLanguage')}
        </Text>
        <TouchableOpacity
          style={[
            styles.nextIconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={handleNextPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.nextArrow, { color: colors.primary }]}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* Non-scrollable Language List Container with original card sizes */}
      <View style={styles.listContainer}>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Please select your preferred language:
        </Text>

        {LANGUAGES.map((lang) => {
          const isSelected = selectedLang === lang.id;
          return (
            <TouchableOpacity
              key={lang.id}
              style={[
                styles.languageCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSelectLanguage(lang.id)}
              activeOpacity={0.8}
            >
              <View style={styles.langInfo}>
                <Text style={styles.flagEmoji}>{lang.flag}</Text>
                <Text style={[styles.langText, { color: colors.text }]}>
                  {lang.name}
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? colors.primary : colors.textMuted },
                ]}
              >
                {isSelected && (
                  <View
                    style={[styles.radioInner, { backgroundColor: colors.primary }]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Keep bottom space empty until loaded; then slide smoothly up from the bottom */}
      {!isAdsBlocked && !isAdLoaded && (
        <View style={styles.hiddenAdLoader} pointerEvents="none">
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdLoaded={() => setIsAdLoaded(true)}
            onAdFailedToLoad={() => setIsAdLoaded(false)}
          />
        </View>
      )}

      {!isAdsBlocked && isAdLoaded && (
        <Animated.View
          style={[
            styles.googleAdWrapper,
            {
              backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
              borderTopColor: colors.border,
              transform: [{ translateY: adSlideAnim }],
            },
          ]}
        >
          <View style={styles.adHeaderBadgeRow}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
            <Text style={[styles.adBadgeLabel, { color: colors.textMuted }]}>
              Google Test Ad Unit
            </Text>
          </View>
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdFailedToLoad={() => setIsAdLoaded(false)}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  nextIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  nextArrow: { fontSize: 16, fontWeight: 'bold' },
  listContainer: { padding: 16, flex: 1 },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  langInfo: { flexDirection: 'row', alignItems: 'center' },
  flagEmoji: { fontSize: 22, marginRight: 12 },
  langText: { fontSize: 15, fontWeight: '600' },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  hiddenAdLoader: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  googleAdWrapper: {
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  adBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginRight: 6,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  adBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});