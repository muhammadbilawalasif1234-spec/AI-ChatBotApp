// App.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/app-kit/theme/useTheme';
import { SubscriptionManager } from './src/app-kit/billing/SubscriptionManager';
import SplashScreen from './src/app/screens/SplashScreen';
import LanguageScreen from './src/app/screens/LanguageScreen';
import OnboardingScreen from './src/app/screens/OnboardingScreen';
import PremiumScreen from './src/app/screens/PremiumScreen';
import MainScreen from './src/app/screens/MainScreen';
import ChatScreen, { Message } from './src/app/screens/ChatScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import NanoBananaScreen, { GeneratedItem } from './src/app/screens/NanoBananaScreen';

function MainNavigator() {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'language' | 'onboarding' | 'premium' | 'main' | 'chat' | 'settings' | 'nanobanana'>('splash');
  const [chatTopic, setChatTopic] = useState<string | undefined>(undefined);
  
  // Persistent chat sessions and Nano Banana library storage
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  const [nanoBananaLibrary, setNanoBananaLibrary] = useState<GeneratedItem[]>([]);

  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    SubscriptionManager.initialize();
    return () => {
      SubscriptionManager.cleanup();
    };
  }, []);

  const handleUpdateMessages = (topicKey: string, newMessages: Message[]) => {
    setChatSessions((prev) => ({
      ...prev,
      [topicKey]: newMessages,
    }));
  };

  const activeTopicKey = chatTopic || 'AI Chat Assistant';
  const currentMessages = chatSessions[activeTopicKey] || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.screenWrapper}>
        {currentScreen === 'splash' && (
          <SplashScreen onFinish={() => setCurrentScreen('language')} />
        )}
        {currentScreen === 'language' && (
          <LanguageScreen onNext={() => setCurrentScreen('onboarding')} />
        )}
        {currentScreen === 'onboarding' && (
          <OnboardingScreen onFinish={() => setCurrentScreen('premium')} />
        )}
        {currentScreen === 'premium' && (
          <PremiumScreen onClose={() => setCurrentScreen('main')} />
        )}
        {currentScreen === 'main' && (
          <MainScreen 
            onStartChat={(topic) => {
              setChatTopic(topic);
              setCurrentScreen('chat');
            }} 
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenPremium={() => setCurrentScreen('premium')}
            onOpenNanoBanana={() => setCurrentScreen('nanobanana')}
          />
        )}
        {currentScreen === 'chat' && (
          <ChatScreen 
            onBack={() => setCurrentScreen('main')} 
            initialTopic={chatTopic}
            messages={currentMessages}
            onUpdateMessages={(msgs) => handleUpdateMessages(activeTopicKey, msgs)}
          />
        )}
        {currentScreen === 'settings' && (
          <SettingsScreen 
            onBack={() => setCurrentScreen('main')} 
            onSelectLanguage={() => setCurrentScreen('language')}
          />
        )}
        {currentScreen === 'nanobanana' && (
          <NanoBananaScreen 
            onBack={() => setCurrentScreen('main')} 
            libraryItems={nanoBananaLibrary}
            onUpdateLibrary={setNanoBananaLibrary}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainNavigator />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },
});