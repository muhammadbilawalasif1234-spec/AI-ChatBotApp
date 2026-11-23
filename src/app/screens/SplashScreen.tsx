// src/app/screens/SplashScreen.tsx

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '../../app-kit/theme/useTheme';
import { AnalyticsManager } from '../../app-kit/services/AnalyticsManager';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    try {
      AnalyticsManager.logEvent('splash_screen_viewed');
    } catch {
      // Fallback if analytics is not initialized yet
    }

    const timer = setTimeout(() => {
      onFinishRef.current();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.contentContainer}>
        <View
          style={[
            styles.logoBox,
            { backgroundColor: colors.surface, borderColor: colors.primary },
          ]}
        >
          <Image
            source={require('../assets/chat-bot.jpg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>AI Chat App</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Smart AI Assistant</Text>
      </View>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textMuted }]}>
          Initializing experience...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  contentContainer: {
    alignItems: 'center',
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    elevation: 8,
  },
  logoImage: {
    width: '90%',
    height: '90%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
});