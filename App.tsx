// App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, StatusBar, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { ThemeProvider, useTheme } from './src/app-kit/theme/useTheme';
import { StorageManager } from './src/app-kit/storage/StorageManager';
import { SubscriptionManager } from './src/app-kit/billing/SubscriptionManager';
import { AdBlockManager } from './src/app-kit/ads/AdBlockManager';
import { LocalizationManager } from './src/app-kit/locales/LocalizationManager';
import { setGeminiRuntimeApiKey } from './src/app/services/geminiService';
import SplashScreen from './src/app/screens/SplashScreen';
import LanguageScreen, {
  SELECTED_LANGUAGE_KEY,
  INITIAL_LANGUAGE_DONE_KEY,
} from './src/app/screens/LanguageScreen';
import OnboardingScreen, {
  ONBOARDING_COMPLETED_KEY,
} from './src/app/screens/OnboardingScreen';
import PremiumScreen from './src/app/screens/PremiumScreen';
import MainScreen, { MainCardAction } from './src/app/screens/MainScreen';
import ChatScreen, { Message } from './src/app/screens/ChatScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import NanoBananaScreen, { GeneratedItem } from './src/app/screens/NanoBananaScreen';
import ImageGeneratorScreen, { GeneratedVisualItem } from './src/app/screens/ImageGeneratorScreen';

type ScreenRoute =
  | 'splash'
  | 'language'
  | 'onboarding'
  | 'premium'
  | 'main'
  | 'chat'
  | 'settings'
  | 'nanobanana'
  | 'imagegenerator';

interface ActiveChatConfig {
  topic: string;
  starterPrompt?: string;
}

const IMAGE_GENERATOR_STORAGE_KEY = '@ai_chat_assistant:generated_images_v1';
const NANO_BANANA_STORAGE_KEY = '@ai_chat_assistant:nano_banana_library_v1';
const CHAT_SESSIONS_STORAGE_KEY = '@ai_chat_assistant:chat_sessions_v1';
const LAUNCH_COUNT_STORAGE_KEY = 'app_launch_count';

function initializeLocalGeminiKey(): void {
  try {
    const secretsModule = require('./src/app/config/secrets.local');
    const key =
      secretsModule?.GEMINI_API_KEY ||
      secretsModule?.LOCAL_GEMINI_API_KEY ||
      '';
    if (typeof key === 'string' && key.trim().length > 0) {
      setGeminiRuntimeApiKey(key.trim());
    }
  } catch {
    // Safe fallback when secrets.local.ts is not present
  }
}

async function readFlag(key: string): Promise<string | null> {
  try {
    const fromStorage = await StorageManager.getItem<unknown>(key);
    if (fromStorage !== null && fromStorage !== undefined) {
      return String(fromStorage);
    }
  } catch {}
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

function MainNavigator() {
  const [currentScreen, setCurrentScreen] = useState<ScreenRoute>('splash');
  const [isChangingLanguageFromSettings, setIsChangingLanguageFromSettings] = useState(false);
  const [isLoadingAppOpenAd, setIsLoadingAppOpenAd] = useState(false);
  const [activeChat, setActiveChat] = useState<ActiveChatConfig>({
    topic: 'AI Chat Assistant',
  });

  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  const [nanoBananaLibrary, setNanoBananaLibrary] = useState<GeneratedItem[]>([]);
  const [imageGeneratorLibrary, setImageGeneratorLibrary] = useState<GeneratedVisualItem[]>([]);

  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    initializeLocalGeminiKey();
    void LocalizationManager.hydrate();
    SubscriptionManager.initialize();
    void AdBlockManager.hydrate();

    AsyncStorage.getItem(IMAGE_GENERATOR_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setImageGeneratorLibrary(parsed);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(NANO_BANANA_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNanoBananaLibrary(parsed);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(CHAT_SESSIONS_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setChatSessions(parsed);
        }
      })
      .catch(() => {});

    return () => {
      SubscriptionManager.cleanup();
    };
  }, []);

  const handleUpdateNanoBananaItems = useCallback((nextItems: GeneratedItem[]) => {
    setNanoBananaLibrary(nextItems);
    AsyncStorage.setItem(NANO_BANANA_STORAGE_KEY, JSON.stringify(nextItems)).catch(() => {});
  }, []);

  const handleUpdateImageGeneratorItems = useCallback((nextItems: GeneratedVisualItem[]) => {
    setImageGeneratorLibrary(nextItems);
    AsyncStorage.setItem(IMAGE_GENERATOR_STORAGE_KEY, JSON.stringify(nextItems)).catch(() => {});
  }, []);

  const triggerAppOpenAdWithLoading = useCallback((onComplete: () => void) => {
    setIsLoadingAppOpenAd(true);
    let isResolved = false;

    const finishOnce = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(safetyTimeout);
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      setIsLoadingAppOpenAd(false);
      onComplete();
    };

    const safetyTimeout = setTimeout(() => {
      finishOnce();
    }, 2200);

    let unsubscribeLoaded = () => {};
    let unsubscribeClosed = () => {};
    let unsubscribeError = () => {};

    try {
      const appOpenAd = AppOpenAd.createForAdRequest(TestIds.APP_OPEN, {
        requestNonPersonalizedAdsOnly: true,
      });

      unsubscribeLoaded = appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        if (isResolved) return;
        clearTimeout(safetyTimeout);
        setIsLoadingAppOpenAd(false);
        appOpenAd.show();
      });

      unsubscribeClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        finishOnce();
      });

      unsubscribeError = appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
        finishOnce();
      });

      appOpenAd.load();
    } catch {
      finishOnce();
    }
  }, []);

  const handleSplashFinish = useCallback(async () => {
    await LocalizationManager.hydrate();
    const adsBlocked = await AdBlockManager.hydrate();

    const [onboardingDone, initialLangDone, savedLang, rawLaunchCount] = await Promise.all([
      readFlag(ONBOARDING_COMPLETED_KEY),
      readFlag(INITIAL_LANGUAGE_DONE_KEY),
      readFlag(SELECTED_LANGUAGE_KEY),
      StorageManager.getItem<number>(LAUNCH_COUNT_STORAGE_KEY).catch(() => 0),
    ]);

    const previousLaunches =
      typeof rawLaunchCount === 'number' ? rawLaunchCount : Number(rawLaunchCount || 0);
    const nextLaunchCount = previousLaunches + 1;
    try {
      await StorageManager.setItem(LAUNCH_COUNT_STORAGE_KEY, nextLaunchCount);
    } catch {}

    const hasCompletedFirstTimeFlow =
      onboardingDone === 'true' &&
      (initialLangDone === 'true' || Boolean(savedLang && savedLang.trim().length > 0));

    setIsChangingLanguageFromSettings(false);

    if (!hasCompletedFirstTimeFlow) {
      setCurrentScreen('language');
      return;
    }

    const isSecondOrLaterOpen = nextLaunchCount >= 2;
    if (isSecondOrLaterOpen && !adsBlocked) {
      triggerAppOpenAdWithLoading(() => {
        setCurrentScreen('main');
      });
    } else {
      setCurrentScreen('main');
    }
  }, [triggerAppOpenAdWithLoading]);

  const handleLanguageNext = useCallback(() => {
    if (isChangingLanguageFromSettings) {
      setIsChangingLanguageFromSettings(false);
      setCurrentScreen('settings');
      return;
    }
    setCurrentScreen('onboarding');
  }, [isChangingLanguageFromSettings]);

  const handleOpenLanguageFromSettings = useCallback(() => {
    setIsChangingLanguageFromSettings(true);
    setCurrentScreen('language');
  }, []);

  const openChatWith = useCallback((action?: MainCardAction | string) => {
    if (!action) {
      setActiveChat({ topic: 'AI Chat Assistant' });
    } else if (typeof action === 'string') {
      setActiveChat({ topic: action });
    } else {
      setActiveChat({
        topic: action.label,
        starterPrompt: action.starterPrompt,
      });
    }
    setCurrentScreen('chat');
  }, []);

  const handleUpdateMessages = useCallback((topicKey: string, newMessages: Message[]) => {
    setChatSessions((prev) => {
      const nextSessions = {
        ...prev,
        [topicKey]: newMessages,
      };
      AsyncStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(nextSessions)).catch(() => {});
      return nextSessions;
    });
  }, []);

  const activeTopicKey = activeChat.topic || 'AI Chat Assistant';
  const currentMessages = chatSessions[activeTopicKey] || [];

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.screenWrapper}>
        {currentScreen === 'splash' && (
          <SplashScreen onFinish={handleSplashFinish} />
        )}
        {currentScreen === 'language' && (
          <LanguageScreen onNext={handleLanguageNext} />
        )}
        {currentScreen === 'onboarding' && (
          <OnboardingScreen onFinish={() => setCurrentScreen('premium')} />
        )}
        {currentScreen === 'premium' && (
          <PremiumScreen onClose={() => setCurrentScreen('main')} />
        )}
        {currentScreen === 'main' && (
          <MainScreen
            onStartChat={openChatWith}
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenPremium={() => setCurrentScreen('premium')}
            onOpenNanoBanana={() => setCurrentScreen('nanobanana')}
            onOpenImageGenerator={() => setCurrentScreen('imagegenerator')}
            chatSessions={chatSessions}
          />
        )}
        {currentScreen === 'chat' && (
          <ChatScreen
            onBack={() => setCurrentScreen('main')}
            initialTopic={activeChat.topic}
            starterPrompt={activeChat.starterPrompt}
            messages={currentMessages}
            onUpdateMessages={(msgs) => handleUpdateMessages(activeTopicKey, msgs)}
          />
        )}
        {currentScreen === 'settings' && (
          <SettingsScreen
            onBack={() => setCurrentScreen('main')}
            onSelectLanguage={handleOpenLanguageFromSettings}
            onOpenChatWithTopic={(topic) => openChatWith(topic)}
          />
        )}
        {currentScreen === 'nanobanana' && (
          <NanoBananaScreen
            onBack={() => setCurrentScreen('main')}
            libraryItems={nanoBananaLibrary}
            onUpdateLibrary={handleUpdateNanoBananaItems}
            onOpenChatWithPrompt={(topic, starterPrompt) =>
              openChatWith({ label: topic, starterPrompt })
            }
          />
        )}
        {currentScreen === 'imagegenerator' && (
          <ImageGeneratorScreen
            onBack={() => setCurrentScreen('main')}
            items={imageGeneratorLibrary}
            onUpdateItems={handleUpdateImageGeneratorItems}
          />
        )}
      </View>

      {isLoadingAppOpenAd && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.fullScreenLoadingText}>Loading Ad...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },
  fullScreenLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  fullScreenLoadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});