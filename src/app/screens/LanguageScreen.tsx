// src/app/screens/LanguageScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { StorageManager } from '../../app-kit/storage/StorageManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';

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

export default function LanguageScreen({ onNext }: LanguageScreenProps) {
  const [selectedLang, setSelectedLang] = useState(LocalizationManager.getLanguage());
  const { colors, isDarkMode } = useTheme();

  const handleSelectLanguage = async (langId: string) => {
    setSelectedLang(langId);
    LocalizationManager.setLanguage(langId);
    try {
      await StorageManager.setItem('selected_language', langId);
    } catch (e) {}
  };

  const handleNextPress = () => {
    onNext();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header with Top-Right Next Arrow Button */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {LocalizationManager.t('selectLanguage')}
        </Text>
        <TouchableOpacity 
          style={[styles.nextIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
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
                  borderColor: isSelected ? colors.primary : colors.border 
                },
              ]}
              onPress={() => handleSelectLanguage(lang.id)}
              activeOpacity={0.8}
            >
              <View style={styles.langInfo}>
                <Text style={styles.flagEmoji}>{lang.flag}</Text>
                <Text style={[styles.langText, { color: colors.text }]}>{lang.name}</Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: isSelected ? colors.primary : colors.textMuted }]}>
                {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Official Google Mobile Ads SDK Test Ad pinned at the bottom */}
      <View style={[styles.googleAdWrapper, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderTopColor: colors.border }]}>
        <View style={styles.adHeaderBadgeRow}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Ad</Text>
          </View>
          <Text style={[styles.adBadgeLabel, { color: colors.textMuted }]}>Google Test Ad Unit</Text>
        </View>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  nextIconButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  nextArrow: { fontSize: 16, fontWeight: 'bold' },
  listContainer: { padding: 16, flex: 1 },
  sectionSubtitle: { fontSize: 13, fontWeight: '500', marginBottom: 12, marginTop: 4, paddingHorizontal: 4 },
  languageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1 },
  langInfo: { flexDirection: 'row', alignItems: 'center' },
  flagEmoji: { fontSize: 22, marginRight: 12 },
  langText: { fontSize: 15, fontWeight: '600' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  googleAdWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
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