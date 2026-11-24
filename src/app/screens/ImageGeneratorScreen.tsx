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
  Modal,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
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
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

async function requestGallerySavePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const sdkVersion =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10) || 0;

  if (sdkVersion >= 29) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Storage Permission',
      message: 'Allow storage permission to download generated images to your gallery.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function detectImageMimeFromBase64(base64: string, fallback = ''): string {
  const clean = (base64 || '').trim();
  if (clean.startsWith('iVBORw0KGgo')) return 'image/png';
  if (clean.startsWith('/9j/')) return 'image/jpeg';
  if (clean.startsWith('UklGR')) return 'image/webp';

  const lower = fallback.toLowerCase();
  if (lower.includes('image/png') || lower.includes('.png')) return 'image/png';
  if (lower.includes('image/webp') || lower.includes('.webp')) return 'image/webp';
  if (lower.startsWith('image/')) return fallback.split(';')[0];
  return 'image/jpeg';
}

function getImageExtension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function createTemporaryImagePath(extension: string): string {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${RNFS.CachesDirectoryPath}/generated-image-${uniqueId}.${extension}`;
}

async function stageImageForGallery(
  imageUrl: string
): Promise<{ uri: string; temporaryPath?: string }> {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URI.');
    }
    const base64Payload = (match[2] || '').trim();
    if (!base64Payload) {
      throw new Error('Image data URI is empty.');
    }
    const mime = detectImageMimeFromBase64(base64Payload, match[1]);
    const temporaryPath = createTemporaryImagePath(getImageExtension(mime));
    try {
      await RNFS.writeFile(temporaryPath, base64Payload, 'base64');
    } catch (error) {
      if (await RNFS.exists(temporaryPath)) {
        await RNFS.unlink(temporaryPath);
      }
      throw error;
    }
    return { uri: `file://${temporaryPath}`, temporaryPath };
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const extensionMatch = imageUrl.match(/\.(png|webp|jpe?g)(?:[?#]|$)/i);
    const extension = extensionMatch?.[1]?.toLowerCase() || 'jpg';
    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
    const temporaryPath = createTemporaryImagePath(normalizedExtension);
    try {
      const download = await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: temporaryPath,
        headers: { Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.9' },
      }).promise;
      if (download.statusCode < 200 || download.statusCode >= 300) {
        throw new Error(`Failed to download image (${download.statusCode}).`);
      }

      const file = await RNFS.stat(temporaryPath);
      if (Number(file.size) <= 0) {
        throw new Error('Downloaded image is empty.');
      }
    } catch (error) {
      if (await RNFS.exists(temporaryPath)) {
        await RNFS.unlink(temporaryPath);
      }
      throw error;
    }

    return { uri: `file://${temporaryPath}`, temporaryPath };
  }

  if (imageUrl.startsWith('file://')) {
    return { uri: imageUrl };
  }

  throw new Error('Unsupported image URI.');
}

async function saveImageDirectlyToGallery(imageUrl: string): Promise<string> {
  const hasPermission = await requestGallerySavePermission();
  if (!hasPermission) {
    throw new Error('Gallery permission was denied.');
  }

  const stagedImage = await stageImageForGallery(imageUrl);
  try {
    return await CameraRoll.save(stagedImage.uri, {
      type: 'photo',
      album: 'AI Chat Assistant',
    });
  } finally {
    if (
      stagedImage.temporaryPath &&
      await RNFS.exists(stagedImage.temporaryPath)
    ) {
      try {
        await RNFS.unlink(stagedImage.temporaryPath);
      } catch (error) {
        console.warn('Unable to remove temporary generated image file.', error);
      }
    }
  }
}

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<GeneratedVisualItem | null>(
    items[0] || null
  );
  const [enlargedItem, setEnlargedItem] = useState<GeneratedVisualItem | null>(null);
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

  const handleDownloadImage = async (item: GeneratedVisualItem) => {
    if (!item.imageUrl || downloadingId) return;

    setDownloadingId(item.id);
    try {
      await saveImageDirectlyToGallery(item.imageUrl);
      Alert.alert(
        'Downloaded to Gallery',
        'The generated image has been saved directly to your gallery.'
      );
    } catch (error: any) {
      Alert.alert(
        'Download Failed',
        error?.message || 'Unable to save image directly to gallery.'
      );
    } finally {
      setDownloadingId(null);
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
            if (enlargedItem?.id === id) {
              setEnlargedItem(null);
            }
          },
        },
      ]
    );
  };

  const handleShare = async (item: GeneratedVisualItem) => {
    try {
      await Share.share({
        message: `Image Generator (${item.style}, ${item.aspectRatio})\nPrompt: ${item.prompt}${
          item.imageUrl ? `\n${item.imageUrl}` : ''
        }`,
      });
    } catch {}
  };

  const isCurrentDownloading = activeResult ? downloadingId === activeResult.id : false;

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
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setEnlargedItem(activeResult)}
              >
                <Image
                  source={{ uri: activeResult.imageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  { backgroundColor: colors.primary },
                  isCurrentDownloading && { opacity: 0.7 },
                ]}
                onPress={() => handleDownloadImage(activeResult)}
                disabled={isCurrentDownloading}
                activeOpacity={0.85}
              >
                {isCurrentDownloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.downloadBtnText}>Download</Text>
                )}
              </TouchableOpacity>

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

      <Modal
        visible={enlargedItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlargedItem(null)}
      >
        <View style={styles.enlargedBackdrop}>
          <View style={styles.enlargedTopBar}>
            <TouchableOpacity
              style={styles.enlargedCloseBtn}
              onPress={() => setEnlargedItem(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.enlargedCloseText}>✕ Close</Text>
            </TouchableOpacity>
            {enlargedItem && (
              <View style={styles.enlargedRightActions}>
                <TouchableOpacity
                  style={[styles.enlargedCloseBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleDownloadImage(enlargedItem)}
                  disabled={downloadingId === enlargedItem.id}
                  activeOpacity={0.8}
                >
                  {downloadingId === enlargedItem.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.enlargedCloseText}>Download</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.enlargedCloseBtn}
                  onPress={() => handleShare(enlargedItem)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.enlargedCloseText}>Share ↗</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {enlargedItem?.imageUrl && (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.enlargedImageContainer}
              onPress={() => setEnlargedItem(null)}
            >
              <Image
                source={{ uri: enlargedItem.imageUrl }}
                style={styles.enlargedImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      </Modal>

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
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  downloadBtn: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 104,
  },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  shareBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#EF4444', fontSize: 12.5, fontWeight: '700' },
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
  enlargedBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  enlargedTopBar: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  enlargedRightActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  enlargedCloseBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  enlargedCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  enlargedImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enlargedImage: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.72,
    borderRadius: 12,
  },
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