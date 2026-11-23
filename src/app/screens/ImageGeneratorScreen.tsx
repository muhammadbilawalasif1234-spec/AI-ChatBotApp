// src/app/screens/ImageGeneratorScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { sendMessageToGemini } from '../services/geminiService';
import { AdBlockManager } from '../../app-kit/ads/AdBlockManager';

export interface GeneratedVisualItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  imageUrl?: string;
  creativeSpec: string;
  timestamp: string;
}

interface ImageGeneratorScreenProps {
  onBack: () => void;
  items?: GeneratedVisualItem[];
  onUpdateItems?: (items: GeneratedVisualItem[]) => void;
}

const STORAGE_KEY = '@ai_chat_assistant:generated_images_v1';
const VISUAL_STYLES = ['Photorealistic', '3D Render', 'Digital Art', 'Minimalist'];
const ASPECT_RATIOS = ['1:1', '16:9', '9:16'];

export default function ImageGeneratorScreen({
  onBack,
  items: externalItems,
  onUpdateItems,
}: ImageGeneratorScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const [localItems, setLocalItems] = useState<GeneratedVisualItem[]>([]);
  const items = externalItems ?? localItems;

  const persistAndSetItems = (next: GeneratedVisualItem[]) => {
    if (onUpdateItems) {
      onUpdateItems(next);
    } else {
      setLocalItems(next);
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Photorealistic');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeResult, setActiveResult] = useState<GeneratedVisualItem | null>(
    items[0] || null
  );
  const [isAdsBlocked, setIsAdsBlocked] = useState<boolean>(() => AdBlockManager.isEnabled());

  useEffect(() => {
    if (!externalItems) {
      AsyncStorage.getItem(STORAGE_KEY)
        .then((raw) => {
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setLocalItems(parsed);
            setActiveResult((prev) => prev ?? parsed[0] ?? null);
          }
        })
        .catch(() => {});
    } else if (externalItems.length > 0 && !activeResult) {
      setActiveResult(externalItems[0]);
    }
  }, [externalItems]);

  useEffect(() => {
    const unsubscribe = AdBlockManager.subscribe((blocked) => {
      setIsAdsBlocked(blocked);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateImage = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      Alert.alert('Enter a Prompt', 'Describe the image you want to generate first.');
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const instruction = `Act as an AI image prompt & visual director. For the user prompt "${trimmedPrompt}" in "${selectedStyle}" style with aspect ratio "${selectedRatio}", provide:
1. An enhanced visual generation prompt.
2. Composition, lighting, and color palette details.`;

      const aiSpec = await sendMessageToGemini([
        { role: 'user', text: instruction },
      ]);

      const encodedSeed = encodeURIComponent(
        `${trimmedPrompt}-${selectedStyle}`.slice(0, 80)
      );
      const previewUrl = `https://image.pollinations.ai/prompt/${encodedSeed}?width=${
        selectedRatio === '16:9' ? 768 : selectedRatio === '9:16' ? 432 : 512
      }&height=${
        selectedRatio === '9:16' ? 768 : selectedRatio === '16:9' ? 432 : 512
      }&nologo=true`;

      const now = new Date();
      const created: GeneratedVisualItem = {
        id: Date.now().toString(),
        prompt: trimmedPrompt,
        style: selectedStyle,
        aspectRatio: selectedRatio,
        imageUrl: previewUrl,
        creativeSpec: aiSpec,
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextList = [created, ...items];
      persistAndSetItems(nextList);
      setActiveResult(created);
    } catch (err: any) {
      Alert.alert(
        'Generation Error',
        err?.message || 'Could not generate image details right now.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete Generated Image',
      'Are you sure you want to delete this generated image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const nextList = items.filter((entry) => entry.id !== id);
            persistAndSetItems(nextList);
            if (activeResult?.id === id) {
              setActiveResult(nextList[0] || null);
            }
          },
        },
      ]
    );
  };

  const handleShare = async (item: GeneratedVisualItem) => {
    try {
      await Share.share({
        message: `Image Generator (${item.style}, ${item.aspectRatio})\nPrompt: ${item.prompt}\n\n${item.creativeSpec}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Image Generator
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.text }]}>Describe Your Image</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="e.g., Futuristic city street at dusk with warm neon reflections..."
          placeholderTextColor={colors.textMuted}
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />

        <Text style={[styles.label, { color: colors.text }]}>Visual Style</Text>
        <View style={styles.chipRow}>
          {VISUAL_STYLES.map((styleName) => {
            const active = selectedStyle === styleName;
            return (
              <TouchableOpacity
                key={styleName}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedStyle(styleName)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary : colors.text },
                  ]}
                >
                  {styleName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Aspect Ratio</Text>
        <View style={styles.chipRow}>
          {ASPECT_RATIOS.map((ratio) => {
            const active = selectedRatio === ratio;
            return (
              <TouchableOpacity
                key={ratio}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedRatio(ratio)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary : colors.text },
                  ]}
                >
                  {ratio}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.generateBtn,
            { backgroundColor: colors.primary },
            isGenerating && { opacity: 0.7 },
          ]}
          onPress={handleGenerateImage}
          disabled={isGenerating}
          activeOpacity={0.85}
        >
          {isGenerating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateBtnText}>Generate Image ✨</Text>
          )}
        </TouchableOpacity>

        {activeResult && (
          <View
            style={[
              styles.resultCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                {activeResult.prompt}
              </Text>
              <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                {activeResult.style} • {activeResult.aspectRatio} • {activeResult.timestamp}
              </Text>
            </View>

            {activeResult.imageUrl && (
              <Image
                source={{ uri: activeResult.imageUrl }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}

            <Text style={[styles.specText, { color: colors.textMuted }]}>
              {activeResult.creativeSpec}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.shareBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={() => handleShare(activeResult)}
              >
                <Text style={[styles.shareBtnText, { color: colors.text }]}>
                  Share ↗
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: '#EF4444' }]}
                onPress={() => handleDeleteItem(activeResult.id)}
              >
                <Text style={styles.deleteBtnText}>Delete 🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {items.length > 0 && (
          <View style={styles.savedSection}>
            <Text style={[styles.label, { color: colors.text }]}>
              Saved Images ({items.length})
            </Text>
            {items.map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.savedRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1, marginRight: 10 }}
                  onPress={() => setActiveResult(entry)}
                >
                  <Text style={[styles.savedPrompt, { color: colors.text }]} numberOfLines={1}>
                    {entry.prompt}
                  </Text>
                  <Text style={[styles.savedMeta, { color: colors.textMuted }]}>
                    {entry.style} • {entry.aspectRatio}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteItem(entry.id)}>
                  <Text style={styles.savedDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 95 }} />
      </ScrollView>

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
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: { height: 38, justifyContent: 'center', paddingRight: 14 },
  backArrow: { fontSize: 26, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  scrollContent: { padding: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 6 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 88,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  generateBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  resultCard: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  resultHeader: { marginBottom: 10 },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultMeta: { fontSize: 11, marginTop: 2 },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#1E293B',
  },
  specText: { fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  shareBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  savedSection: { marginTop: 16 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  savedPrompt: { fontSize: 13, fontWeight: '600' },
  savedMeta: { fontSize: 11, marginTop: 2 },
  savedDeleteText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  googleAdWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
});