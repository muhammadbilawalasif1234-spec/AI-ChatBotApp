// src/app/screens/SettingsScreen.tsx

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Switch,
} from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { analyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';

interface SettingsScreenProps {
  onBack: () => void;
  onSelectLanguage?: () => void;
}

export default function SettingsScreen({ onBack, onSelectLanguage }: SettingsScreenProps) {
  const { colors, isDarkMode, toggleTheme } = useTheme();

  const handleOptionPress = (actionName: string, callback?: () => void) => {
    try {
      if (analyticsManager && typeof analyticsManager.logEvent === 'function') {
        analyticsManager.logEvent(`settings_${actionName}_clicked`);
      }
    } catch (e) {}
    if (callback) callback();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Perfectly Centered & Aligned Professional Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        {/* Updated header title to Settings / app title properly */}
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Settings Options Container Card */}
      <View style={styles.contentWrapper}>
        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          
          {/* Select Language */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={() => handleOptionPress('language', onSelectLanguage)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Text style={styles.menuEmoji}>🌐</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>{LocalizationManager.t('selectLanguage')}</Text>
          </TouchableOpacity>

          {/* Theme Mode Toggle */}
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={styles.menuEmoji}>{isDarkMode ? '🌙' : '☀️'}</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {isDarkMode ? LocalizationManager.t('darkMode') : LocalizationManager.t('lightMode')}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={() => {
                toggleTheme();
                try {
                  if (analyticsManager && typeof analyticsManager.logEvent === 'function') {
                    analyticsManager.logEvent('theme_toggled');
                  }
                } catch (e) {}
              }}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          {/* Privacy Policy */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={() => handleOptionPress('privacy_policy')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={styles.menuEmoji}>📄</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>{LocalizationManager.t('privacyPolicy')}</Text>
          </TouchableOpacity>

          {/* Rate Us */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={() => handleOptionPress('rate_us')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Text style={styles.menuEmoji}>⭐</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>{LocalizationManager.t('rateUs')}</Text>
          </TouchableOpacity>

          {/* Report Us */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.border }]} 
            onPress={() => handleOptionPress('report_us')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Text style={styles.menuEmoji}>❗</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>{LocalizationManager.t('reportUs')}</Text>
          </TouchableOpacity>

          {/* More Apps */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]} 
            onPress={() => handleOptionPress('more_apps')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Text style={styles.menuEmoji}>🟥</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>{LocalizationManager.t('moreApps')}</Text>
          </TouchableOpacity>

        </View>

        {/* Official Google Test Ad Banner replacing the old "Ad Space..." text box */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 18, 
    paddingVertical: 14, 
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: { 
    height: 38,
    justifyContent: 'center', 
    alignItems: 'center',
    paddingRight: 14,
  },
  backArrow: { 
    fontSize: 29, 
    fontWeight: 'bold', 
    textAlign: 'center',
    marginTop: -8,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    includeFontPadding: false, 
    textAlignVertical: 'center',
  },
  contentWrapper: { flex: 1, padding: 16, justifyContent: 'space-between', paddingBottom: 85 },
  menuCard: { borderRadius: 20, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuEmoji: { fontSize: 16 },
  menuText: { fontSize: 15, fontWeight: '600' },
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