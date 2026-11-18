// src/app/screens/NanoBananaScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { useTheme } from '../../app-kit/theme/useTheme';
import { sendMessageToGemini } from '../services/geminiService';

interface NanoBananaScreenProps {
  onBack: () => void;
  libraryItems: GeneratedItem[];
  onUpdateLibrary: (items: GeneratedItem[]) => void;
}

interface StyleOption {
  id: string;
  name: string;
  tag: string;
}

export interface GeneratedItem {
  id: string;
  styleName: string;
  imageUri: string;
  aiDescription: string;
  timestamp: string;
}

const STYLES: StyleOption[] = [
  { id: 'default', name: 'Default AI Enhance', tag: 'Natural AI' },
  { id: 'chronicle', name: 'Chronicle Story Art', tag: 'Story Art' },
  { id: 'monolith', name: 'Monolith 3D Sculpture', tag: '3D Sculpture' },
  { id: 'forge', name: 'Cyberpunk Studio', tag: 'Cyber Studio' },
];

export default function NanoBananaScreen({ onBack, libraryItems, onUpdateLibrary }: NanoBananaScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const [selectedStyle, setSelectedStyle] = useState<string>('default');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewItem, setPreviewItem] = useState<GeneratedItem | null>(null);

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera to take photos.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  };

  const handleOpenCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Camera Permission Needed', 'Please allow camera access in settings.');
      return;
    }

    launchCamera(
      { mediaType: 'photo', quality: 0.9, saveToPhotos: true },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera Error', response.errorMessage || 'Could not open camera.');
          return;
        }
        if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
          setSelectedImageUri(response.assets[0].uri);
        }
      }
    );
  };

  const handleOpenGallery = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.9, selectionLimit: 1 },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery Error', response.errorMessage || 'Unable to open gallery.');
          return;
        }
        if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
          setSelectedImageUri(response.assets[0].uri);
        }
      }
    );
  };

  // Professional Clear / Delete Library Handler with Confirmation
  const handleClearLibrary = () => {
    Alert.alert(
      'Clear Gallery Library',
      'Are you sure you want to delete all generated AI items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            onUpdateLibrary([]);
          },
        },
      ]
    );
  };

  const processRealAiGeneration = async () => {
    if (!selectedImageUri) return;
    setIsGenerating(true);

    const activeStyleObj = STYLES.find((s) => s.id === selectedStyle) || STYLES[0];

    try {
      // Call Gemini API for real AI analysis and creative transformation description based on style
      const promptText = `Analyze this uploaded photo context and provide a professional creative transformation report for a "${activeStyleObj.name}" style. Give lighting details, mood adjustment, and artistic feedback.`;
      
      const aiResponse = await sendMessageToGemini([
        { role: 'user', text: promptText }
      ]);

      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newArtwork: GeneratedItem = {
        id: Date.now().toString(),
        styleName: activeStyleObj.name,
        imageUri: selectedImageUri,
        aiDescription: aiResponse,
        timestamp: formattedTime,
      };

      onUpdateLibrary([newArtwork, ...libraryItems]);
      setPreviewItem(newArtwork);
    } catch (error: any) {
      Alert.alert('AI Processing Error', error?.message || 'Unable to connect to Gemini AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (!selectedImageUri) {
      Alert.alert('Select Photo', 'Please capture or select an image from gallery first.');
      return;
    }

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
          processRealAiGeneration();
        }
      }, 2500);

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
        processRealAiGeneration();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(safetyTimeout);
          unsubscribeLoaded();
          unsubscribeError();
          setIsLoadingAd(false);
          processRealAiGeneration();
        }
      });

      interstitial.load();
    } catch (e) {
      setIsLoadingAd(false);
      processRealAiGeneration();
    }
  };

  const handleShareArtwork = async (item: GeneratedItem) => {
    try {
      await Share.share({
        message: `My Nano Banana AI (${item.styleName}):\n\n${item.aiDescription}`,
      });
    } catch (e) {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header with Back Button, Title, and Clear Library Trash Button 🗑️ */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Nano Banana AI</Text>
        {libraryItems.length > 0 ? (
          <TouchableOpacity onPress={handleClearLibrary} style={styles.clearButton} activeOpacity={0.7}>
            <Text style={styles.clearButtonEmoji}>🗑️</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Upload Photo for Real AI Edit</Text>

        {selectedImageUri ? (
          <View style={[styles.selectedPreviewCard, { backgroundColor: colors.surface, borderColor: '#107C61' }]}>
            <Image source={{ uri: selectedImageUri }} style={styles.selectedPreviewImage} />
            <View style={styles.selectedPreviewOverlay}>
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>✓ Photo Ready</Text>
              </View>
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setSelectedImageUri(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.removeImageBtnText}>✕ Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.mediaButton, { backgroundColor: '#107C61' }]}
              onPress={handleOpenCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.mediaButtonIcon}>📷</Text>
              <Text style={styles.mediaButtonText}>Open Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaButtonGallery, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleOpenGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.mediaButtonIcon}>🖼️</Text>
              <Text style={[styles.mediaButtonTextGallery, { color: colors.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 14 }]}>Select AI Style</Text>

        <View style={styles.stylesGridContainer}>
          {STYLES.map((item) => {
            const isSelected = selectedStyle === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.styleBoxCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? '#107C61' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedStyle(item.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.styleBoxName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.styleBoxTag, { color: colors.textMuted }]}>{item.tag}</Text>
                {isSelected && <Text style={styles.selectedIndicator}>✓ Active</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.generateButton,
            { backgroundColor: selectedImageUri ? '#107C61' : '#334155' },
          ]}
          onPress={handleGenerate}
          activeOpacity={0.85}
        >
          <Text style={[styles.generateButtonText, { opacity: selectedImageUri ? 1 : 0.75 }]}>
            Process with Gemini AI ✨
          </Text>
        </TouchableOpacity>

        <View style={styles.libraryHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 10 }]}>Generated Library</Text>
          {libraryItems.length > 0 && (
            <Text style={[styles.libraryCountText, { color: colors.textMuted }]}>
              {libraryItems.length} {libraryItems.length === 1 ? 'item' : 'items'}
            </Text>
          )}
        </View>

        {libraryItems.length === 0 ? (
          <View style={[styles.libraryEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.libraryPlaceholderIcon}>🖼️</Text>
            <Text style={[styles.libraryText, { color: colors.textMuted }]}>No AI transformations yet</Text>
          </View>
        ) : (
          <View style={styles.libraryGrid}>
            {libraryItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.libraryGridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setPreviewItem(item)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item.imageUri }} style={styles.libraryGridImage} />
                <View style={styles.libraryGridFooter}>
                  <Text style={[styles.libraryGridStyle, { color: colors.text }]} numberOfLines={1}>
                    {item.styleName}
                  </Text>
                  <Text style={[styles.libraryGridTime, { color: colors.textMuted }]}>{item.timestamp}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Google Test Ad Banner */}
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
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      {/* Result Preview Modal with AI Analysis */}
      <Modal
        visible={previewItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {previewItem?.styleName} Result ✨
              </Text>
              <TouchableOpacity onPress={() => setPreviewItem(null)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {previewItem && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                <Image source={{ uri: previewItem.imageUri }} style={styles.modalResultImage} />
                <Text style={[styles.modalAiTitle, { color: colors.text }]}>Gemini AI Analysis:</Text>
                <Text style={[styles.modalAiText, { color: colors.textMuted }]}>
                  {previewItem.aiDescription}
                </Text>
              </ScrollView>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => previewItem && handleShareArtwork(previewItem)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.text }]}>Share ↗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: '#107C61' }]}
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
          <Text style={styles.fullScreenLoadingText}>Processing with Gemini AI...</Text>
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
  sectionHeading: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  mediaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 12,
    elevation: 3,
  },
  mediaButtonGallery: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  mediaButtonIcon: { fontSize: 22, marginBottom: 6 },
  mediaButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mediaButtonTextGallery: { fontSize: 15, fontWeight: '700' },
  selectedPreviewCard: {
    width: '100%',
    height: 175,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    marginBottom: 12,
  },
  selectedPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectedPreviewOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedBadge: { backgroundColor: 'rgba(16, 124, 97, 0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  selectedBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  removeImageBtn: { backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  removeImageBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  stylesGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  styleBoxCard: { width: '48%', borderRadius: 14, padding: 14, marginBottom: 10 },
  styleBoxName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  styleBoxTag: { fontSize: 11 },
  selectedIndicator: { position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 'bold', color: '#107C61' },
  generateButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '80%',
    marginBottom: 16,
    elevation: 4,
  },
  generateButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  libraryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  libraryCountText: { fontSize: 12, fontWeight: '600' },
  libraryEmptyCard: {
    width: '100%',
    height: 95,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  libraryPlaceholderIcon: { fontSize: 24, opacity: 0.45 },
  libraryText: { fontSize: 12, fontWeight: '500', marginTop: 6 },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  libraryGridCard: { width: '48%', borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
  libraryGridImage: { width: '100%', height: 135, resizeMode: 'cover' },
  libraryGridFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  libraryGridStyle: { fontSize: 12, fontWeight: '700', flex: 1 },
  libraryGridTime: { fontSize: 10, fontWeight: '500' },
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
  adHeaderBadgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 16, marginBottom: 4 },
  adBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, marginRight: 6 },
  adBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#000000' },
  adBadgeLabel: { fontSize: 10, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18, fontWeight: 'bold' },
  modalResultImage: { width: '100%', height: 210, borderRadius: 14, resizeMode: 'cover', marginBottom: 12 },
  modalAiTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  modalAiText: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  modalSecondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  modalSecondaryBtnText: { fontSize: 14, fontWeight: '700' },
  modalPrimaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
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