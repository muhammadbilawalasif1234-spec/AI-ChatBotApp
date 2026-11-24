// src/app/screens/OnboardingScreen.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { PrimaryButton } from '../../app-kit/components/PrimaryButton';
import { useTheme } from '../../app-kit/theme/useTheme';
import { StorageManager } from '../../app-kit/storage/StorageManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';
import { AdBlockManager } from '../../app-kit/ads/AdBlockManager';

interface OnboardingScreenProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export const ONBOARDING_COMPLETED_KEY = 'has_completed_onboarding';

const BUBBLE_COUNT = 4;
const BUBBLE_STAGGER_DELAY_MS = 160;
const BUBBLE_DURATION_MS = 420;

// Ensure these exact filenames/extensions match what exists in src/app/assets/
const POET_IMAGE = require('../assets/poet.jpeg');
const LANGUAGE_TRANSLATOR_IMAGE = require('../assets/languageTranslator.jpeg');
const RESEARCH_IMAGE = require('../assets/research_assistant.png');
const PERSONAL_TRAINER_IMAGE = require('../assets/personalTrainer.jpeg');

export default function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [, setLangVersion] = useState(0);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const isFinishingRef = useRef(false);
  const { colors } = useTheme();

  const bubbleProgressRef = useRef<Animated.Value[]>(
    Array.from({ length: BUBBLE_COUNT }, () => new Animated.Value(0))
  );

  useEffect(() => {
    const unsubscribe = LocalizationManager.subscribe(() => {
      setLangVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  const runBubbleStaggerAnimation = useCallback(() => {
    bubbleProgressRef.current.forEach((anim) => {
      anim.stopAnimation();
      anim.setValue(0);
    });

    const animations = bubbleProgressRef.current.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: BUBBLE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.stagger(BUBBLE_STAGGER_DELAY_MS, animations).start();
  }, []);

  useEffect(() => {
    if (currentIndex === 0) {
      runBubbleStaggerAnimation();
    } else {
      bubbleProgressRef.current.forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }
  }, [currentIndex, runBubbleStaggerAnimation]);

  const ONBOARDING_STEPS = [
    {
      step: 1,
      title: LocalizationManager.t('ob1Title'),
      subtitle: LocalizationManager.t('ob1Sub'),
      layout: 'bubbles',
      cards: [
        { category: LocalizationManager.t('art'), prompt: LocalizationManager.t('artPrompt'), icon: '🎨', position: 'left', pillAlign: 'center' },
        { category: LocalizationManager.t('travel'), prompt: LocalizationManager.t('travelPrompt'), icon: '✈️', position: 'right', pillAlign: 'left' },
        { category: LocalizationManager.t('relationship'), prompt: LocalizationManager.t('relPrompt'), icon: '❤️', position: 'left', pillAlign: 'right' },
        { category: LocalizationManager.t('social'), prompt: LocalizationManager.t('socPrompt'), icon: '👥', position: 'right', pillAlign: 'left' },
      ],
    },
    {
      step: 2,
      title: LocalizationManager.t('ob2Title'),
      subtitle: LocalizationManager.t('ob2Sub'),
      layout: 'grid_images',
      cards: [
        { category: LocalizationManager.t('poetTitle'), prompt: LocalizationManager.t('poetSub'), image: POET_IMAGE },
        { category: LocalizationManager.t('translatorTitle'), prompt: LocalizationManager.t('translatorSub'), image: LANGUAGE_TRANSLATOR_IMAGE },
        { category: LocalizationManager.t('researchTitle'), prompt: LocalizationManager.t('researchSub'), image: RESEARCH_IMAGE },
        { category: LocalizationManager.t('trainerTitle'), prompt: LocalizationManager.t('trainerSub'), image: PERSONAL_TRAINER_IMAGE },
        { category: LocalizationManager.t('philosopherTitle'), prompt: LocalizationManager.t('philosopherSub'), image: require('../assets/philosopher.png') },
        { category: LocalizationManager.t('routineTitle'), prompt: LocalizationManager.t('routineSub'), image: require('../assets/routine_planner.png') },
        { category: LocalizationManager.t('astrologerTitle'), prompt: LocalizationManager.t('astrologerSub'), image: require('../assets/astrologer.png') },
        { category: LocalizationManager.t('coachTitle'), prompt: LocalizationManager.t('coachSub'), image: require('../assets/relationship_coach.png') },
      ],
    },
    {
      step: 3,
      title: LocalizationManager.t('ob3Title'),
      subtitle: LocalizationManager.t('ob3Sub'),
      layout: 'grid_categories',
      cards: [
        { category: LocalizationManager.t('digitalMarketing'), image: require('../assets/digital_marketing.png') },
        { category: LocalizationManager.t('horoscope'), image: require('../assets/horoscope.png') },
        { category: LocalizationManager.t('scienceChat'), image: require('../assets/science_chat.png') },
        { category: LocalizationManager.t('storyteller'), image: require('../assets/storyteller.png') },
        { category: LocalizationManager.t('valentinesDay'), image: require('../assets/valentines_day.png') },
        { category: LocalizationManager.t('lifeCoach'), image: require('../assets/life_coach.png') },
      ],
    },
  ];

  const triggerInterstitialAd = (onAdComplete: () => void) => {
    if (AdBlockManager.isEnabled()) {
      onAdComplete();
      return;
    }

    setIsLoadingAd(true);
    try {
      const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
        requestNonPersonalizedAdsOnly: true,
      });

      let isResolved = false;

      const cleanupListeners = () => {
        clearTimeout(safetyTimeout);
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };

      const completeOnce = () => {
        if (isResolved) return;
        isResolved = true;
        cleanupListeners();
        setIsLoadingAd(false);
        onAdComplete();
      };

      const safetyTimeout = setTimeout(() => {
        completeOnce();
      }, 2000);

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (isResolved) return;
        clearTimeout(safetyTimeout);
        setIsLoadingAd(false);
        interstitial.show();
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        completeOnce();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        completeOnce();
      });

      interstitial.load();
    } catch {
      setIsLoadingAd(false);
      onAdComplete();
    }
  };

  const finishOnboarding = async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;

    try {
      await Promise.all([
        StorageManager.setItem(ONBOARDING_COMPLETED_KEY, 'true'),
        AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify('true')),
      ]);
    } catch {}

    onFinish();
  };

  const handleNext = () => {
    if (isLoadingAd || isFinishingRef.current) return;

    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      horizontalScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    } else {
      triggerInterstitialAd(() => {
        void finishOnboarding();
      });
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const selectedIndex = Math.round(contentOffsetX / width);
    if (
      selectedIndex !== currentIndex &&
      selectedIndex >= 0 &&
      selectedIndex < ONBOARDING_STEPS.length
    ) {
      setCurrentIndex(selectedIndex);
    }
  };

  const renderBubbles = () => (
    <ScrollView
      contentContainerStyle={styles.verticalScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.bubblesContainer}>
        {ONBOARDING_STEPS[0].cards.map((item, index) => {
          const isRight = item.position === 'right';
          const progress =
            bubbleProgressRef.current[index] ?? new Animated.Value(1);

          const animatedCardStyle = {
            opacity: progress,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isRight ? 28 : -28, 0],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          };

          return (
            <Animated.View
              key={index}
              style={[
                styles.bubbleItemWrapper,
                isRight ? styles.alignRight : styles.alignLeft,
                animatedCardStyle,
              ]}
            >
              <View
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.primary,
                    alignSelf:
                      item.pillAlign === 'center'
                        ? 'center'
                        : item.pillAlign === 'right'
                        ? 'flex-end'
                        : 'flex-start',
                    marginRight: item.pillAlign === 'right' ? 24 : 0,
                    marginLeft: item.pillAlign === 'left' ? 24 : 0,
                  },
                ]}
              >
                <Text style={styles.pillIcon}>{item.icon}</Text>
                <Text style={[styles.pillText, { color: colors.text }]}>{item.category}</Text>
              </View>

              <View
                style={[
                  styles.promptBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.promptText, { color: colors.text }]}>{item.prompt}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderGridImages = (cards: any[]) => (
    <ScrollView
      contentContainerStyle={styles.verticalScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.gridImagesContainer}>
        {cards.map((item, index) => (
          <View key={index} style={[styles.gridImageCard, { borderColor: colors.border }]}>
            <Image source={item.image} style={styles.gridImage} />
            <View style={styles.gridImageOverlay}>
              <Text style={styles.gridImageCategory} numberOfLines={1}>
                {item.category}
              </Text>
              <Text style={styles.gridImagePrompt} numberOfLines={2}>
                {item.prompt}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderGridCategories = (cards: any[]) => (
    <ScrollView
      contentContainerStyle={styles.verticalScrollContentScreen3}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.gridCategoriesContainer}>
        {cards.map((item, index) => (
          <View key={index} style={styles.gridCategoryCard}>
            <View style={[styles.gridCategoryCircle, { borderColor: colors.border }]}>
              <Image source={item.image} style={styles.gridCategoryCircleImage} />
            </View>
            <Text style={[styles.gridCategoryText, { color: colors.text }]}>{item.category}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.topHeaderContainer}>
        {currentIndex === 0 ? (
          <TouchableOpacity
            onPress={() => {
              if (!isLoadingAd && !isFinishingRef.current) {
                void finishOnboarding();
              }
            }}
            style={styles.skipButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipButtonText, { color: colors.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.horizontalScroll}
        scrollEnabled={!isLoadingAd}
      >
        <View style={[styles.pageContainer, { width }]}>{renderBubbles()}</View>
        <View style={[styles.pageContainer, { width }]}>
          {renderGridImages(ONBOARDING_STEPS[1].cards)}
        </View>
        <View style={[styles.pageContainer, { width }]}>
          {renderGridCategories(ONBOARDING_STEPS[2].cards)}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footerContainer,
          { backgroundColor: colors.background, borderTopColor: colors.surface },
        ]}
      >
        <Text style={[styles.title, { color: colors.primary }]}>
          {ONBOARDING_STEPS[currentIndex].title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {ONBOARDING_STEPS[currentIndex].subtitle}
        </Text>

        <View style={styles.paginationRow}>
          {ONBOARDING_STEPS.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentIndex === idx
                  ? [styles.activeDot, { backgroundColor: colors.primary }]
                  : [styles.inactiveDot, { backgroundColor: colors.border }],
              ]}
            />
          ))}
        </View>

        <PrimaryButton
          title={currentIndex === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next ➔'}
          onPress={handleNext}
          style={styles.buttonStyle}
        />
      </View>

      {isLoadingAd && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.fullScreenLoadingText}>Loading Ad...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    minHeight: 46,
    zIndex: 10,
  },
  skipButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  skipButtonText: { fontSize: 15, fontWeight: '700' },
  horizontalScroll: { flex: 1 },
  pageContainer: { flex: 1, paddingHorizontal: 16 },
  verticalScrollContent: { paddingTop: 8, paddingBottom: 220 },
  verticalScrollContentScreen3: { paddingTop: 12, paddingBottom: 220 },
  bubblesContainer: { width: '100%', paddingBottom: 10 },
  bubbleItemWrapper: { width: '88%', marginBottom: 22 },
  alignLeft: { alignSelf: 'flex-start' },
  alignRight: { alignSelf: 'flex-end' },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: -10,
    zIndex: 3,
    elevation: 4,
  },
  pillIcon: { fontSize: 14, marginRight: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  promptBox: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
  },
  promptText: { fontSize: 14.5, fontWeight: '500', lineHeight: 20 },
  gridImagesContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridImageCard: {
    width: '48%',
    height: 175,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'transparent',
  },
  gridImageCategory: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridImagePrompt: {
    color: '#E2E8F0',
    fontSize: 10,
    lineHeight: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  gridCategoryCard: { width: '48%', alignItems: 'center', marginBottom: 26 },
  gridCategoryCircle: {
    width: 115,
    height: 115,
    borderRadius: 57.5,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 10,
  },
  gridCategoryCircleImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridCategoryText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  subtitle: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
  paginationRow: { flexDirection: 'row', marginBottom: 14 },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 4 },
  activeDot: { width: 24 },
  inactiveDot: { width: 6 },
  buttonStyle: { width: '100%', borderRadius: 24 },
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