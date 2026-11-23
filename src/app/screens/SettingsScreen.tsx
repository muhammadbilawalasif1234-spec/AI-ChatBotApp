// src/app/screens/SettingsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { StorageManager } from '../../app-kit/storage/StorageManager';
import { analyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';
import { AdBlockManager } from '../../app-kit/ads/AdBlockManager';

interface SettingsScreenProps {
  onBack: () => void;
  onSelectLanguage?: () => void;
  onOpenChatWithTopic?: (topic: string) => void;
}

export default function SettingsScreen({
  onBack,
  onSelectLanguage,
  onOpenChatWithTopic,
}: SettingsScreenProps) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [isAdsBlocked, setIsAdsBlocked] = useState<boolean>(() => AdBlockManager.isEnabled());

  useEffect(() => {
    let active = true;
    AdBlockManager.hydrate().then((persistedValue) => {
      if (active) {
        setIsAdsBlocked(persistedValue);
      }
    });

    const unsubscribe = AdBlockManager.subscribe((blocked) => {
      if (active) {
        setIsAdsBlocked(blocked);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleToggleTheme = async () => {
    await toggleTheme();

    try {
      if (analyticsManager && typeof analyticsManager.logEvent === 'function') {
        analyticsManager.logEvent('theme_toggled');
      }
    } catch {}
  };

  const handleToggleAdsBlock = async (nextValue: boolean) => {
    setIsAdsBlocked(nextValue);
    await AdBlockManager.setEnabledByUser(nextValue);

    try {
      await StorageManager.setItem('ads_block_enabled', nextValue);
    } catch {}

    try {
      if (analyticsManager && typeof analyticsManager.logEvent === 'function') {
        analyticsManager.logEvent(nextValue ? 'ads_block_enabled' : 'ads_block_disabled');
      }
    } catch {}
  };

  const showWorkingStatusAlert = (
    title: string,
    description: string,
    chatTopic?: string
  ) => {
    const buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'default' | 'destructive';
    }> = [{ text: 'OK', style: 'default' }];

    if (chatTopic && onOpenChatWithTopic) {
      buttons.unshift({
        text: 'Ask AI Assistant',
        onPress: () => onOpenChatWithTopic(chatTopic),
      });
    }

    Alert.alert(title, description, buttons);
  };

  const handleOptionPress = (actionName: string, callback?: () => void) => {
    try {
      if (analyticsManager && typeof analyticsManager.logEvent === 'function') {
        analyticsManager.logEvent(`settings_${actionName}_clicked`);
      }
    } catch {}

    if (callback) {
      callback();
      return;
    }

    switch (actionName) {
      case 'privacy_policy':
        showWorkingStatusAlert(
          'Privacy Policy',
          'Your messages and app settings are used to power your AI chat experience. External policy URL can be attached when published.'
        );
        break;
      case 'rate_us':
        showWorkingStatusAlert(
          'Rate Us',
          'Thank you for using the app. Google Play rating prompt hookup is ready for release builds.'
        );
        break;
      case 'report_us':
        showWorkingStatusAlert(
          'Report an Issue',
          'Share details of any bug or layout issue in chat so it can be tracked and fixed.',
          'Bug Report & Support'
        );
        break;
      case 'more_apps':
        showWorkingStatusAlert(
          'More Apps',
          'More apps from this developer will be listed here once connected.'
        );
        break;
      default:
        break;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Perfectly Centered & Aligned Professional Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Settings Options Container Card */}
      <View style={[styles.contentWrapper, isAdsBlocked && { paddingBottom: 16 }]}>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Select Language */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => handleOptionPress('language', onSelectLanguage)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Text style={styles.menuEmoji}>🌐</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {LocalizationManager.t('selectLanguage')}
              </Text>
            </View>
            <Text style={[styles.chevronText, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Theme Mode Toggle (Persisted and changed only by user) */}
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
              onValueChange={handleToggleTheme}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          {/* Ads Block Toggle (Changed only by user; never auto-changed on reload) */}
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={styles.menuEmoji}>🛡️</Text>
              </View>
              <View style={styles.menuTextColumn}>
                <Text style={[styles.menuText, { color: colors.text }]}>Ads Block</Text>
                <Text style={[styles.menuSubText, { color: colors.textMuted }]}>
                  {isAdsBlocked ? 'Enabled — Ads hidden across the app' : 'Off — Ads shown per rules'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAdsBlocked}
              onValueChange={handleToggleAdsBlock}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
              thumbColor={'#FFFFFF'}
            />
          </View>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => handleOptionPress('privacy_policy')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={styles.menuEmoji}>📄</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {LocalizationManager.t('privacyPolicy')}
              </Text>
            </View>
            <Text style={[styles.chevronText, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Rate Us */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => handleOptionPress('rate_us')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={styles.menuEmoji}>⭐</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {LocalizationManager.t('rateUs')}
              </Text>
            </View>
            <Text style={[styles.chevronText, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Report Us */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => handleOptionPress('report_us')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Text style={styles.menuEmoji}>❗</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {LocalizationManager.t('reportUs')}
              </Text>
            </View>
            <Text style={[styles.chevronText, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* More Apps */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => handleOptionPress('more_apps')}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={styles.menuEmoji}>🟥</Text>
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {LocalizationManager.t('moreApps')}
              </Text>
            </View>
            <Text style={[styles.chevronText, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Banner Ad only renders when Ads Block is OFF */}
        {!isAdsBlocked && (
          <View
            style={[
              styles.googleAdWrapper,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                borderTopColor: colors.border,
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
            />
          </View>
        )}
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuEmoji: { fontSize: 16 },
  menuTextColumn: { flex: 1 },
  menuText: { fontSize: 15, fontWeight: '600' },
  menuSubText: { fontSize: 11, marginTop: 2 },
  chevronText: { fontSize: 20, fontWeight: '600', paddingHorizontal: 4 },
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