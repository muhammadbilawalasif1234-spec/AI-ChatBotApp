// src/app/screens/NanoBananaScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import {
  buildUserDirectedImageEditPrompt,
  editImageWithGemini,
  imageUriToBase64,
} from '../services/geminiService';
import { AdBlockManager } from '../../app-kit/ads/AdBlockManager';

interface NanoBananaScreenProps {
  onBack: () => void;
  libraryItems?: GeneratedItem[];
  onUpdateLibrary?: (items: GeneratedItem[]) => void;
  onOpenChatWithPrompt?: (topic: string, starterPrompt: string) => void;
}

interface EditPreset {
  id: string;
  name: string;
  subtitle: string;
  promptDirective: string;
  accentColor: string;
}

export interface GeneratedItem {
  id: string;
  styleId: string;
  styleName: string;
  specialistRole?: string;
  editRequirements?: string;
  sourceImageUri: string;
  sourceImageMimeType?: string;
  editedImageUri: string;
  imageUri: string;
  accentColor?: string;
  tintColor?: string;
  borderFrameColor?: string;
  aiDescription: string;
  timestamp: string;
}

const NANO_LIBRARY_STORAGE_KEY = '@ai_chat_assistant:nano_banana_library_v1';

const QUICK_REQUIREMENTS = [
  'Brighten & sharpen',
  'Warm golden light',
  'Clean studio look',
  'High contrast & clarity',
];

const EDIT_PRESETS: EditPreset[] = [
  {
    id: 'retouch',
    name: 'Smart Retouch',
    subtitle: 'Natural clarity & balance',
    promptDirective:
      'professional photo editing, natural exposure balance, crisp detail, clean color correction',
    accentColor: '#10B981',
  },
  {
    id: 'cinematic',
    name: 'Cinematic Grade',
    subtitle: 'Rich depth & warm tones',
    promptDirective:
      'cinematic color grading, rich tonal depth, soft film highlights, balanced shadows',
    accentColor: '#F59E0B',
  },
  {
    id: 'studio_3d',
    name: '3D Studio Polish',
    subtitle: 'Sculpted lighting & form',
    promptDirective:
      '3d studio render lighting, clean rim light, sharp edges, high-detail product/portrait finish',
    accentColor: '#3B82F6',
  },
  {
    id: 'cyber_neon',
    name: 'Neon Studio',
    subtitle: 'Bold contrast & vivid accents',
    promptDirective:
      'modern studio lighting, subtle cyan and magenta rim highlights, punchy contrast, crisp focus',
    accentColor: '#A855F7',
  },
];

export default function NanoBananaScreen({
  onBack,
  libraryItems: externalLibrary,
  onUpdateLibrary,
  onOpenChatWithPrompt,
}: NanoBananaScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const [localLibrary, setLocalLibrary] = useState<GeneratedItem[]>([]);
  const libraryItems = externalLibrary ?? localLibrary;

  const updateLibrary = (next: GeneratedItem[]) => {
    if (onUpdateLibrary) {
      onUpdateLibrary(next);
    } else {
      setLocalLibrary(next);
    }
    AsyncStorage.setItem(NANO_LIBRARY_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editRequirements, setEditRequirements] = useState<string>('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageMimeType, setSelectedImageMimeType] = useState('image/jpeg');
  const [selectedImageMeta, setSelectedImageMeta] = useState<string | null>(null);
  const [latestItem, setLatestItem] = useState<GeneratedItem | null>(null);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewItem, setPreviewItem] = useState<GeneratedItem | null>(null);
  const [modalViewMode, setModalViewMode] = useState<'compare' | 'edited'>('compare');
  const [isAdsBlocked, setIsAdsBlocked] = useState<boolean>(() => AdBlockManager.isEnabled());
  const [editedImageLoadingMap, setEditedImageLoadingMap] = useState<Record<string, boolean>>({});
  const [editedImageErrorMap, setEditedImageErrorMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!externalLibrary) {
      AsyncStorage.getItem(NANO_LIBRARY_STORAGE_KEY)
        .then((raw) => {
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setLocalLibrary(parsed);
            setLatestItem((prev) => prev ?? parsed[0] ?? null);
          }
        })
        .catch(() => {});
    } else if (externalLibrary.length > 0 && !latestItem) {
      setLatestItem(externalLibrary[0]);
    }
  }, [externalLibrary, latestItem]);

  useEffect(() => {
    const unsubscribe = AdBlockManager.subscribe((blocked) => {
      setIsAdsBlocked(blocked);
    });
    return () => unsubscribe();
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Allow camera access to capture a photo for editing.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const applySelectedAsset = (asset?: Asset) => {
    if (!asset?.uri) return;
    setSelectedImageUri(asset.uri);
    setSelectedImageMimeType(asset.type || 'image/jpeg');
    if (asset.width && asset.height) {
      setSelectedImageMeta(`${asset.width} × ${asset.height}`);
    } else {
      setSelectedImageMeta(null);
    }
  };

  const handleClearSourcePhoto = () => {
    setSelectedImageUri(null);
    setSelectedImageMimeType('image/jpeg');
    setSelectedImageMeta(null);
  };

  const handleOpenCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Camera Permission Needed', 'Please enable camera permission in device settings.');
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.9,
        maxWidth: 1536,
        maxHeight: 1536,
        saveToPhotos: true,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera Error', response.errorMessage || 'Unable to open camera.');
          return;
        }
        applySelectedAsset(response.assets?.[0]);
      }
    );
  };

  const handleOpenGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.9,
        maxWidth: 1536,
        maxHeight: 1536,
        selectionLimit: 1,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery Error', response.errorMessage || 'Unable to open gallery.');
          return;
        }
        applySelectedAsset(response.assets?.[0]);
      }
    );
  };

  const appendQuickRequirement = (presetLabel: string) => {
    setEditRequirements((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return presetLabel;
      const tokens = cleanPrev.split(',').map((t) => t.trim().toLowerCase());
      if (tokens.includes(presetLabel.toLowerCase())) return cleanPrev;
      return `${cleanPrev}, ${presetLabel.toLowerCase()}`;
    });
  };

  const handleReuseItemSettings = (item: GeneratedItem) => {
    setSelectedPresetId(
      EDIT_PRESETS.some((preset) => preset.id === item.styleId)
        ? item.styleId
        : null
    );
    setEditRequirements(item.editRequirements || '');
    if (item.sourceImageUri) {
      setSelectedImageUri(item.sourceImageUri);
      setSelectedImageMimeType(item.sourceImageMimeType || 'image/jpeg');
    }
    setPreviewItem(null);
  };

  const handleRefineInChat = (item: GeneratedItem) => {
    if (!onOpenChatWithPrompt) return;
    const starterPrompt = [
      `Help me refine this photo edit (${item.styleName}).`,
      item.editRequirements ? `My edit requirements: "${item.editRequirements}".` : '',
      `Current edit notes: ${item.aiDescription}`,
      'Suggest ways to improve the prompt, lighting, and visual polish.',
    ]
      .filter(Boolean)
      .join(' ');
    setPreviewItem(null);
    onOpenChatWithPrompt('Nano Banana Edit Assistant', starterPrompt);
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete Edit',
      'Remove this edited photo from your library?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const next = libraryItems.filter((item) => item.id !== id);
            updateLibrary(next);
            if (previewItem?.id === id) {
              setPreviewItem(null);
            }
            if (latestItem?.id === id) {
              setLatestItem(next[0] || null);
            }
          },
        },
      ]
    );
  };

  const handleClearLibrary = () => {
    Alert.alert(
      'Clear Library',
      'Delete all saved edits in Nano Banana?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            updateLibrary([]);
            setPreviewItem(null);
            setLatestItem(null);
          },
        },
      ]
    );
  };

  const runImageEdit = async () => {
    if (!selectedImageUri || isGenerating) return;

    const trimmedRequirements = editRequirements.trim();
    if (!trimmedRequirements) {
      Alert.alert(
        'Edit Requirements Needed',
        'Please enter what changes you want applied to your photo (or tap one of the quick presets).'
      );
      return;
    }

    setIsGenerating(true);

    const activePreset =
      EDIT_PRESETS.find((preset) => preset.id === selectedPresetId) || null;
    const itemId = Date.now().toString();
    setEditedImageLoadingMap((prev) => ({ ...prev, [itemId]: true }));
    setEditedImageErrorMap((prev) => ({ ...prev, [itemId]: false }));

    try {
      const promptText = buildUserDirectedImageEditPrompt(
        trimmedRequirements,
        activePreset?.promptDirective
      );

      const imageBase64 = await imageUriToBase64(selectedImageUri);
      const result = await editImageWithGemini(
        imageBase64,
        selectedImageMimeType,
        promptText
      );

      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const editedEntry: GeneratedItem = {
        id: itemId,
        styleId: activePreset?.id || 'custom',
        styleName: activePreset?.name || 'Custom Edit',
        specialistRole: activePreset?.subtitle,
        editRequirements: trimmedRequirements,
        sourceImageUri: selectedImageUri,
        sourceImageMimeType: selectedImageMimeType,
        editedImageUri: result.imageUri,
        imageUri: result.imageUri,
        accentColor: activePreset?.accentColor,
        aiDescription: result.description,
        timestamp,
      };

      const nextLibrary = [editedEntry, ...libraryItems];
      updateLibrary(nextLibrary);
      setLatestItem(editedEntry);
      setModalViewMode('compare');
      setPreviewItem(editedEntry);
    } catch (error) {
      Alert.alert(
        'Photo Edit Failed',
        error instanceof Error ? error.message : 'Could not edit this photo. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyEdit = () => {
    if (!selectedImageUri) {
      Alert.alert('Select Photo', 'Please pick a photo from Gallery or capture one with Camera first.');
      return;
    }

    if (!editRequirements.trim()) {
      Alert.alert(
        'Enter Edit Requirements',
        'Describe the edit you want on your photo before generating.'
      );
      return;
    }

    if (AdBlockManager.isEnabled()) {
      void runImageEdit();
      return;
    }

    setIsLoadingAd(true);
    try {
      const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
        requestNonPersonalizedAdsOnly: true,
      });

      let settled = false;

      const finishAndEdit = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setIsLoadingAd(false);
        void runImageEdit();
      };

      const timeoutId = setTimeout(finishAndEdit, 2500);

      const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (settled) return;
        clearTimeout(timeoutId);
        setIsLoadingAd(false);
        interstitial.show();
      });

      const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubClosed();
        finishAndEdit();
      });

      const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubLoaded();
        unsubError();
        finishAndEdit();
      });

      interstitial.load();
    } catch {
      setIsLoadingAd(false);
      void runImageEdit();
    }
  };

  const handleShareItem = async (item: GeneratedItem) => {
    try {
      await Share.share({
        message: [
          `Nano Banana Photo Edit (${item.styleName})`,
          item.editRequirements ? `Requirements: ${item.editRequirements}` : '',
          `Edited Image: ${item.editedImageUri || item.imageUri}`,
          '',
          item.aiDescription,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {}
  };

  const retryEditedImageLoad = (itemId: string) => {
    setEditedImageErrorMap((prev) => ({ ...prev, [itemId]: false }));
    setEditedImageLoadingMap((prev) => ({ ...prev, [itemId]: true }));
  };

  const activePreset =
    EDIT_PRESETS.find((preset) => preset.id === selectedPresetId) || null;

  const renderEditedImage = (
    item: GeneratedItem,
    imageStyle: any,
    showSpinner = true
  ) => {
    const uri = item.editedImageUri || item.imageUri;
    const isImgLoading = !!editedImageLoadingMap[item.id];
    const hasImgError = !!editedImageErrorMap[item.id];

    return (
      <View style={styles.imageHolder}>
        <Image
          source={{ uri: hasImgError ? item.sourceImageUri : uri }}
          style={imageStyle}
          onLoadStart={() =>
            setEditedImageLoadingMap((prev) => ({ ...prev, [item.id]: true }))
          }
          onLoadEnd={() =>
            setEditedImageLoadingMap((prev) => ({ ...prev, [item.id]: false }))
          }
          onError={() => {
            setEditedImageLoadingMap((prev) => ({ ...prev, [item.id]: false }));
            setEditedImageErrorMap((prev) => ({ ...prev, [item.id]: true }));
          }}
        />
        {showSpinner && isImgLoading && (
          <View style={styles.imageLoadingBadge}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
        {hasImgError && (
          <TouchableOpacity
            style={styles.imageFallbackBar}
            onPress={() => retryEditedImageLoad(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.imageFallbackText}>Showing original • Tap to retry edit</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Nano Banana Editor
        </Text>
        {libraryItems.length > 0 ? (
          <TouchableOpacity onPress={handleClearLibrary} style={styles.clearButton} activeOpacity={0.7}>
            <Text style={styles.clearButtonEmoji}>🗑️</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          1. Source Photo
        </Text>

        {selectedImageUri ? (
          <View
            style={[
              styles.sourceCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Image source={{ uri: selectedImageUri }} style={styles.sourcePreviewImage} />
            <View style={styles.sourceFooter}>
              <Text style={[styles.sourceMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                {selectedImageMeta ? `Photo selected (${selectedImageMeta})` : 'Photo selected'}
              </Text>
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={handleClearSourcePhoto}
                activeOpacity={0.8}
              >
                <Text style={styles.changePhotoBtnText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mediaRow}>
            <TouchableOpacity
              style={[styles.mediaHalfButton, { backgroundColor: '#107C61' }]}
              onPress={handleOpenCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.mediaButtonIcon}>📷</Text>
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mediaHalfButton,
                { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={handleOpenGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.mediaButtonIcon}>🖼️</Text>
              <Text style={[styles.mediaButtonTextGallery, { color: colors.text }]}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 10 }]}>
          2. Edit Requirements
        </Text>
        <TextInput
          style={[
            styles.requirementsInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Write exact edits you want (e.g., bright warm lighting, soft studio portrait, sharp details)..."
          placeholderTextColor={colors.textMuted}
          value={editRequirements}
          onChangeText={setEditRequirements}
          multiline
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsRow}
        >
          {QUICK_REQUIREMENTS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={[
                styles.quickChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => appendQuickRequirement(chip)}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickChipText, { color: colors.text }]}>+ {chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 12 }]}>
          3. Optional Style
        </Text>
        <Text style={[styles.presetSub, { color: colors.textMuted, marginBottom: 8 }]}>
          Your written instructions always take priority.
        </Text>

        <View style={styles.presetsGrid}>
          <TouchableOpacity
            style={[
              styles.presetCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedPresetId === null ? colors.primary : colors.border,
                borderWidth: selectedPresetId === null ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedPresetId(null)}
            activeOpacity={0.85}
          >
            <Text style={[styles.presetName, { color: colors.text }]} numberOfLines={1}>
              My Instructions
            </Text>
            <Text style={[styles.presetSub, { color: colors.textMuted }]} numberOfLines={1}>
              No extra style
            </Text>
          </TouchableOpacity>
          {EDIT_PRESETS.map((preset) => {
            const active = selectedPresetId === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? preset.accentColor : colors.border,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPresetId(preset.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.presetName, { color: colors.text }]} numberOfLines={1}>
                  {preset.name}
                </Text>
                <Text style={[styles.presetSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {preset.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.applyButton,
            {
              backgroundColor:
                selectedImageUri && editRequirements.trim()
                  ? activePreset?.accentColor || colors.primary
                  : '#334155',
            },
          ]}
          onPress={handleApplyEdit}
          disabled={isGenerating || isLoadingAd}
          activeOpacity={0.85}
        >
          {isGenerating || isLoadingAd ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.applyButtonText}>Apply Edit ✨</Text>
          )}
        </TouchableOpacity>

        {latestItem && (
          <View
            style={[
              styles.latestCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.latestHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.latestTitle, { color: colors.text }]} numberOfLines={1}>
                  {latestItem.styleName} • {latestItem.timestamp}
                </Text>
                {latestItem.editRequirements && (
                  <Text
                    style={[styles.latestRequirementLine, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {latestItem.editRequirements}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleDeleteItem(latestItem.id)}>
                <Text style={styles.deleteLabel}>Delete</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.beforeAfterRow}>
              <View style={styles.beforeAfterCol}>
                <Text style={[styles.paneLabel, { color: colors.textMuted }]}>Before</Text>
                <Image source={{ uri: latestItem.sourceImageUri }} style={styles.paneImage} />
              </View>
              <View style={styles.beforeAfterCol}>
                <Text
                  style={[
                    styles.paneLabel,
                    { color: latestItem.accentColor || '#107C61' },
                  ]}
                >
                  After
                </Text>
                {renderEditedImage(latestItem, styles.paneImage)}
              </View>
            </View>

            <Text style={[styles.notesText, { color: colors.textMuted }]} numberOfLines={4}>
              {latestItem.aiDescription}
            </Text>

            <View style={styles.latestActionRow}>
              <TouchableOpacity
                style={[styles.compactActionBtn, { borderColor: colors.border }]}
                onPress={() => handleReuseItemSettings(latestItem)}
                activeOpacity={0.8}
              >
                <Text style={[styles.compactActionBtnText, { color: colors.text }]}>
                  Reuse Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compactActionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setModalViewMode('compare');
                  setPreviewItem(latestItem);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.compactActionBtnText, { color: colors.text }]}>
                  Preview & Share ↗
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.libraryHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 10 }]}>
            Saved Edits
          </Text>
          {libraryItems.length > 0 && (
            <Text style={[styles.libraryCount, { color: colors.textMuted }]}>
              {libraryItems.length}
            </Text>
          )}
        </View>

        {libraryItems.length === 0 ? (
          <View
            style={[
              styles.emptyLibraryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyLibraryText, { color: colors.textMuted }]}>
              No edited photos yet
            </Text>
          </View>
        ) : (
          <View style={styles.libraryGrid}>
            {libraryItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.gridCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    setModalViewMode('compare');
                    setPreviewItem(item);
                  }}
                  activeOpacity={0.85}
                >
                  {renderEditedImage(item, styles.gridImage, false)}
                  <View style={styles.gridMeta}>
                    <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.editRequirements || item.styleName}
                    </Text>
                    <Text style={[styles.gridSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.styleName} • {item.timestamp}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.gridDeleteBtn, { borderTopColor: colors.border }]}
                  onPress={() => handleDeleteItem(item.id)}
                >
                  <Text style={styles.deleteLabel}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {!isAdsBlocked && (
        <View
          style={[
            styles.adWrapper,
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

      <Modal
        visible={previewItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                {previewItem?.styleName}
              </Text>
              <TouchableOpacity
                onPress={() => setPreviewItem(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {previewItem && (
              <>
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      {
                        backgroundColor:
                          modalViewMode === 'compare'
                            ? previewItem.accentColor || '#107C61'
                            : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setModalViewMode('compare')}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        { color: modalViewMode === 'compare' ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      Before / After
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      {
                        backgroundColor:
                          modalViewMode === 'edited'
                            ? previewItem.accentColor || '#107C61'
                            : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setModalViewMode('edited')}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        { color: modalViewMode === 'edited' ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      Full Edited
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 410 }}>
                  {modalViewMode === 'compare' ? (
                    <View style={styles.beforeAfterRow}>
                      <View style={styles.beforeAfterCol}>
                        <Text style={[styles.paneLabel, { color: colors.textMuted }]}>
                          Before
                        </Text>
                        <Image
                          source={{ uri: previewItem.sourceImageUri }}
                          style={styles.modalCompareImage}
                        />
                      </View>
                      <View style={styles.beforeAfterCol}>
                        <Text
                          style={[
                            styles.paneLabel,
                            { color: previewItem.accentColor || '#107C61' },
                          ]}
                        >
                          After
                        </Text>
                        {renderEditedImage(previewItem, styles.modalCompareImage)}
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.paneLabel,
                          { color: previewItem.accentColor || '#107C61' },
                        ]}
                      >
                        Edited Output
                      </Text>
                      {renderEditedImage(previewItem, styles.modalEditedImage)}
                    </>
                  )}

                  {previewItem.editRequirements && (
                    <Text style={[styles.modalReqText, { color: colors.text }]}>
                      Requirements: {previewItem.editRequirements}
                    </Text>
                  )}

                  <Text style={[styles.notesText, { color: colors.textMuted }]}>
                    {previewItem.aiDescription}
                  </Text>
                </ScrollView>

                <View style={styles.modalUtilityRow}>
                  <TouchableOpacity
                    style={[styles.utilityPill, { borderColor: colors.border }]}
                    onPress={() => handleReuseItemSettings(previewItem)}
                  >
                    <Text style={[styles.utilityPillText, { color: colors.text }]}>
                      ↺ Reuse Settings
                    </Text>
                  </TouchableOpacity>

                  {onOpenChatWithPrompt && (
                    <TouchableOpacity
                      style={[styles.utilityPill, { borderColor: colors.border }]}
                      onPress={() => handleRefineInChat(previewItem)}
                    >
                      <Text style={[styles.utilityPillText, { color: colors.text }]}>
                        💬 Refine in Chat
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => previewItem && handleShareItem(previewItem)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.text }]}>
                  Share ↗
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  { backgroundColor: previewItem?.accentColor || '#107C61' },
                ]}
                onPress={() => setPreviewItem(null)}
              >
                <Text style={styles.modalPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isGenerating && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#107C61" />
          <Text style={styles.fullScreenLoadingText}>Applying your edits...</Text>
        </View>
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: { height: 38, justifyContent: 'center', alignItems: 'center', paddingRight: 14 },
  backArrow: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginTop: -6 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  clearButton: { height: 38, width: 38, justifyContent: 'center', alignItems: 'center' },
  clearButtonEmoji: { fontSize: 18 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  sectionHeading: { fontSize: 15.5, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  sourceCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  sourcePreviewImage: { width: '100%', height: 180, resizeMode: 'cover' },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceMetaText: { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  changePhotoBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changePhotoBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  mediaRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  mediaHalfButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    elevation: 2,
  },
  mediaButtonIcon: { fontSize: 20, marginBottom: 4 },
  mediaButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  mediaButtonTextGallery: { fontSize: 14, fontWeight: '700' },
  requirementsInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 78,
    fontSize: 13.5,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  quickChipsRow: { gap: 8, paddingBottom: 6, marginBottom: 4 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 11.5, fontWeight: '600' },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  presetCard: {
    width: '48.5%',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  presetName: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  presetSub: { fontSize: 11.5 },
  applyButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '86%',
    marginBottom: 16,
    elevation: 4,
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  latestCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  latestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  latestTitle: { fontSize: 14, fontWeight: '700' },
  latestRequirementLine: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  deleteLabel: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  beforeAfterRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  beforeAfterCol: { flex: 1 },
  paneLabel: { fontSize: 11.5, fontWeight: '700', marginBottom: 5 },
  paneImage: { width: '100%', height: 126, borderRadius: 10, resizeMode: 'cover' },
  imageHolder: { position: 'relative' },
  imageLoadingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 12,
    padding: 6,
  },
  imageFallbackBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  imageFallbackText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  notesText: { fontSize: 12.5, lineHeight: 18 },
  latestActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  compactActionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  compactActionBtnText: { fontSize: 12, fontWeight: '700' },
  libraryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libraryCount: { fontSize: 12.5, fontWeight: '700' },
  emptyLibraryCard: {
    width: '100%',
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyLibraryText: { fontSize: 12.5, fontWeight: '500' },
  libraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  gridImage: { width: '100%', height: 132, resizeMode: 'cover' },
  gridMeta: { paddingHorizontal: 10, paddingVertical: 8 },
  gridTitle: { fontSize: 12.5, fontWeight: '700' },
  gridSub: { fontSize: 11, marginTop: 2 },
  gridDeleteBtn: {
    borderTopWidth: 1,
    paddingVertical: 7,
    alignItems: 'center',
  },
  adWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18, fontWeight: 'bold' },
  modeToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeToggleText: { fontSize: 12, fontWeight: '700' },
  modalCompareImage: {
    width: '100%',
    height: 165,
    borderRadius: 12,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  modalEditedImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    resizeMode: 'cover',
    marginBottom: 12,
  },
  modalReqText: { fontSize: 12.5, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  modalUtilityRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  utilityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  utilityPillText: { fontSize: 11.5, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalSecondaryBtnText: { fontSize: 14, fontWeight: '700' },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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
  fullScreenLoadingText: { marginTop: 14, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});