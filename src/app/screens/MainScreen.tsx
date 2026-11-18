// src/app/screens/MainScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { AnalyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';

interface MainScreenProps {
  onStartChat: (topic?: string) => void;
  onOpenSettings?: () => void;
  onOpenPremium?: () => void;
  onOpenNanoBanana?: () => void;
}

const { width } = Dimensions.get('window');

export default function MainScreen({ onStartChat, onOpenSettings, onOpenPremium, onOpenNanoBanana }: MainScreenProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('Email');
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [, setLangVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = LocalizationManager.subscribe(() => {
      setLangVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  const TRENDING_ITEMS = [
    { id: '1', title: 'Chat with AI', subtitle: 'A caring companion who listens and understands', image: require('../assets/chat-with-ai.jpeg') },
    { id: '2', title: 'Social Media', subtitle: 'Ask, learn, and boost your online presence', image: require('../assets/social-media.jpeg') },
    { id: '3', title: 'Business Ideas', subtitle: 'Get creative, actionable suggestions instantly', image: require('../assets/business-idea.jpeg') },
  ];

  const AI_ASSISTANTS = [
    { id: '1', title: 'Language Translator', subtitle: 'Check, translate or practice for a new language', image: require('../assets/language_translator.png') },
    { id: '2', title: 'Poet', subtitle: 'Provides strategies for business planning and growth', image: require('../assets/poet.png') },
    { id: '3', title: 'Philosopher', subtitle: 'Provides innovative ideas and drafts', image: require('../assets/philosopher.png') },
  ];

  const ELITE_TOOLS = [
    { id: '1', title: 'Image Generator', subtitle: 'Create stunning visuals instantly with AI', image: require('../assets/storyteller.png') },
    { id: '2', title: 'Chat with AI', subtitle: 'A caring companion who listens and understands', image: require('../assets/chat-with-ai.jpeg') },
    { id: '3', title: 'Smart Video', subtitle: 'Discover trends, analytics, and insights instantly', image: require('../assets/science_chat.png') },
  ];

  const SUGGESTION_TABS = ['Email', 'Business & Marketing', 'Assistant'];

  const SUGGESTION_ITEMS = [
    { id: '1', title: 'Email Promote', icon: '✉️' },
    { id: '2', title: 'Newsletter', icon: '📰' },
    { id: '3', title: 'Mail Response', icon: '📩' },
    { id: '4', title: 'Email Subject', icon: '📧' },
    { id: '5', title: 'Marketing Email', icon: '📊' },
    { id: '6', title: 'Text Formalizer', icon: '📝' },
    { id: '7', title: 'Email Responder', icon: '💬' },
  ];

  const ART_PROMPTS = [
    { id: '1', title: 'Short story about witchcraft', icon: '📖' },
    { id: '2', title: 'Write lyrics about chasing dreams', icon: '🎵' },
    { id: '3', title: 'Create a playlist of Ricky Martins songs', icon: '🎶' },
    { id: '4', title: 'Write a poem about the mystery of sea', icon: '🌊' },
    { id: '5', title: 'Suggest comedy series for kids', icon: '🎬' },
    { id: '6', title: 'Recommend songs for Valentines day', icon: '💖' },
  ];

  const TRAVEL_PROMPTS = [
    { id: '1', title: 'Plan two days adventure trip', icon: '🛍️' },
    { id: '2', title: 'Suggest low calories Mexican snacks', icon: '📍' },
    { id: '3', title: 'When is the best time to visit mountains?', icon: '⛰️' },
    { id: '4', title: 'Suggest some fun activities for picnic', icon: '🧺' },
    { id: '5', title: 'Plan budget friendly 2-days trip', icon: '✨' },
    { id: '6', title: 'Suggest traditional festivals of America', icon: '⛺' },
    { id: '7', title: 'Provide advice for Europe trip.', icon: '💼' },
  ];

  const SOCIAL_PROMPTS = [
    { id: '1', title: 'Suggest gifts for Christmas.', icon: '🎄' },
    { id: '2', title: 'Suggest family events for new year.', icon: '🎉' },
    { id: '3', title: 'Write a short love note for crush.', icon: '💌' },
    { id: '4', title: 'Suggest outfit ideas for Halloween.', icon: '🎃' },
    { id: '5', title: 'List some fun facts about snakes.', icon: '🔍' },
    { id: '6', title: 'Write a heartfelt birthday note.', icon: '✉️' },
  ];

  const RELATIONSHIP_PROMPTS = [
    { id: '1', title: 'Dating tips for 1st time date.', icon: '👩‍❤️‍👨' },
    { id: '2', title: 'Give tips for emotional connection.', icon: '💬' },
    { id: '3', title: 'Ideas about strengthening connection.', icon: '💐' },
    { id: '4', title: 'Suggest outfit color for date.', icon: '👔' },
  ];

  const handleActionPress = (topicTitle?: string) => {
    try {
      AnalyticsManager.logEvent('main_screen_action_clicked');
    } catch (e) {}

    setIsLoadingAd(true);
    try {
      const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
        requestNonPersonalizedAdsOnly: true,
      });

      let isResolved = false;

      const safetyTimeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          setIsLoadingAd(false);
          onStartChat(topicTitle);
        }
      }, 2000);

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(safetyTimeout);
          setIsLoadingAd(false);
          interstitial.show();
        }
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        onStartChat(topicTitle);
      });

      interstitial.load();
    } catch (e) {
      setIsLoadingAd(false);
      onStartChat(topicTitle);
    }
  };

  const handleNanoBananaPress = () => {
    try {
      AnalyticsManager.logEvent('nanobanana_card_clicked');
    } catch (e) {}

    setIsLoadingAd(true);
    try {
      const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
        requestNonPersonalizedAdsOnly: true,
      });

      let isResolved = false;

      const safetyTimeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          setIsLoadingAd(false);
          if (onOpenNanoBanana) onOpenNanoBanana();
        }
      }, 2000);

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(safetyTimeout);
          setIsLoadingAd(false);
          interstitial.show();
        }
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        if (onOpenNanoBanana) onOpenNanoBanana();
      });

      interstitial.load();
    } catch (e) {
      setIsLoadingAd(false);
      if (onOpenNanoBanana) onOpenNanoBanana();
    }
  };

  const renderPromptSection = (titleKey: string, icon: string, items: typeof ART_PROMPTS) => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t(titleKey)} {icon}</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleActionPress(item.title)}
          activeOpacity={0.7}
        >
          <View style={styles.promptLeft}>
            <Text style={styles.promptIconEmoji}>{item.icon}</Text>
            <Text style={[styles.promptText, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={[styles.arrowIcon, { color: colors.textMuted }]}>↗</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Top Header */}
      <View style={styles.headerContainer}>
        <Text style={[styles.appTitle, { color: colors.text }]}>{LocalizationManager.t('appTitle')}</Text>
        <View style={styles.headerIconsRow}>
          <TouchableOpacity onPress={onOpenPremium} style={styles.iconButton} activeOpacity={0.7}>
            <Text style={styles.crownIcon}>👑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSettings} style={styles.iconButton} activeOpacity={0.7}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Trending 🔥 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('trending')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {TRENDING_ITEMS.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.trendingCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleActionPress(item.title)}>
              <Image source={item.image} style={styles.trendingCardImage} />
              <View style={styles.cardOverlayTransparent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Create Visuals 🎨 - Nano Banana Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('createVisuals')}</Text>
        </View>
        <TouchableOpacity style={[styles.bannerCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleNanoBananaPress} activeOpacity={0.85}>
          <Image source={require('../assets/cheetah-in-motion-stockcake.jpg')} style={styles.bannerImage} />
          <View style={styles.bannerOverlayTransparent}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.bannerTitle}>{LocalizationManager.t('nanoBanana')}</Text>
              <Text style={styles.bannerSubtitle} numberOfLines={1}>{LocalizationManager.t('nanoBananaSub')}</Text>
            </View>
            <View style={[styles.createButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.createButtonText}>Create ➔</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Elite Tools ⚡ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('eliteTools')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {ELITE_TOOLS.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.trendingCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleActionPress(item.title)}>
              <Image source={item.image} style={styles.trendingCardImage} />
              <View style={styles.cardOverlayTransparent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* AI Assistants 🤖 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('aiAssistants')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {AI_ASSISTANTS.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.trendingCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleActionPress(item.title)}>
              <Image source={item.image} style={styles.trendingCardImage} />
              <View style={styles.cardOverlayTransparent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Suggestions 💡 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('suggestions')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {SUGGESTION_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.suggestionTab,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.suggestionTabText, { color: isActive ? colors.primary : colors.text }]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Circular Suggestion Icons Grid */}
        <View style={styles.suggestionGridContainer}>
          {SUGGESTION_ITEMS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.suggestionItem} onPress={() => handleActionPress(item.title)}>
              <View style={[styles.suggestionCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.suggestionEmoji}>{item.icon}</Text>
              </View>
              <Text style={[styles.suggestionItemText, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* HISTORY */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{LocalizationManager.t('history')}</Text>
        </View>
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyText, { color: colors.textMuted }]}>{LocalizationManager.t('noHistory')}</Text>
        </View>

        {/* Category Prompt Lists */}
        {renderPromptSection('art', '🎨', ART_PROMPTS)}
        {renderPromptSection('travel', '✈️', TRAVEL_PROMPTS)}
        {renderPromptSection('social', '👥', SOCIAL_PROMPTS)}
        {renderPromptSection('relationship', '👩‍❤️‍👨', RELATIONSHIP_PROMPTS)}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating / Sticky "Let's Start Chat" Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={[styles.startChatButton, { backgroundColor: colors.primary }]} onPress={() => handleActionPress('AI Assistant')}>
          <Text style={styles.startChatText}>{LocalizationManager.t('letsStartChat')}</Text>
        </TouchableOpacity>
      </View>

      {/* Full-Screen Pure Black Loading Screen while Interstitial Ad is loading */}
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
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  appTitle: { fontSize: 22, fontWeight: '800' },
  headerIconsRow: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 14, padding: 4 },
  crownIcon: { fontSize: 20 },
  settingsIcon: { fontSize: 18 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  sectionContainer: { marginTop: 4 },
  sectionHeaderRow: { marginTop: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  horizontalScroll: { paddingRight: 10 },
  trendingCard: { width: 135, height: 165, borderRadius: 14, marginRight: 12, overflow: 'hidden', borderWidth: 1 },
  trendingCardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlayTransparent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'transparent' },
  cardTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 2, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardSubtitle: { color: '#E2E8F0', fontSize: 9, lineHeight: 12, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerCard: { width: '100%', height: 160, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerOverlayTransparent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', marginBottom: 2, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerSubtitle: { color: '#E2E8F0', fontSize: 10, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  createButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  suggestionTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, marginRight: 8 },
  suggestionTabText: { fontSize: 12, fontWeight: '700' },
  suggestionGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  suggestionItem: { width: '23%', alignItems: 'center', marginBottom: 12 },
  suggestionCircle: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 4 },
  suggestionEmoji: { fontSize: 22 },
  suggestionItemText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  historyCard: { width: '100%', height: 65, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  historyText: { fontSize: 12, fontWeight: '500' },
  promptCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1 },
  promptLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  promptIconEmoji: { fontSize: 16, marginRight: 10 },
  promptText: { fontSize: 13, fontWeight: '600', flex: 1 },
  arrowIcon: { fontSize: 14, fontWeight: 'bold' },
  floatingButtonContainer: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  startChatButton: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 26, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  startChatText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
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