// src/app/screens/PremiumScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AnalyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { SubscriptionManager } from '../../app-kit/billing/SubscriptionManager';

interface PremiumScreenProps {
  onClose: () => void;
}

export default function PremiumScreen({ onClose }: PremiumScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'weekly'>('annual');
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const hasAlertedSuccess = useRef(false);

  const PRO_ITEMS = [
    { id: '1', title: 'Translator', image: require('../assets/language_translator.png') },
    { id: '2', title: 'Poet', image: require('../assets/poet.png') },
    { id: '3', title: 'Philosopher', image: require('../assets/philosopher.png') },
    { id: '4', title: 'Storyteller', image: require('../assets/storyteller.png') },
    { id: '5', title: 'Digital Marketing', image: require('../assets/digital_marketing.png') },
    { id: '6', title: 'Horoscope', image: require('../assets/horoscope.png') },
    { id: '7', title: 'Life Coach', image: require('../assets/life_coach.png') },
    { id: '8', title: 'Science Chat', image: require('../assets/science_chat.png') },
  ];

  useEffect(() => {
    SubscriptionManager.fetchPlans().then((products) => {
      if (products && products.length > 0) {
        setStoreProducts(products);
      }
    });

    const unsubscribePro = SubscriptionManager.subscribeToStatus((isPro) => {
      if (isPro && !hasAlertedSuccess.current) {
        hasAlertedSuccess.current = true;
        setIsProcessing(false);
        Alert.alert(
          'Welcome to PRO! 🎉',
          'Your free trial is active. All premium AI tools and ad-free access are now unlocked.',
          [{ text: 'Continue', onPress: onClose }]
        );
      }
    });

    return () => unsubscribePro();
  }, [onClose]);

  useEffect(() => {
    const itemWidth = 84;
    const totalWidth = itemWidth * PRO_ITEMS.length;

    const startScrolling = () => {
      scrollAnim.setValue(0);
      Animated.timing(scrollAnim, {
        toValue: -totalWidth,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => startScrolling());
    };

    startScrolling();
  }, [scrollAnim]);

  const getPlanDetails = (sku: string, fallbackPrice: string) => {
    const product: any = storeProducts.find((p) => (p.productId || p.id) === sku);
    if (!product) {
      return { price: fallbackPrice, offerToken: undefined };
    }

    const offerDetails =
      product.subscriptionOfferDetails || product.subscriptionOfferDetailsAndroid;

    if (offerDetails && offerDetails.length > 0) {
      const offer = offerDetails[0];
      const pricingPhases = offer.pricingPhases?.pricingPhaseList || [];
      const paidPhase = pricingPhases[pricingPhases.length - 1];
      return {
        price: paidPhase?.formattedPrice || product.localizedPrice || fallbackPrice,
        offerToken: offer.offerToken,
      };
    }

    return {
      price: product.localizedPrice || product.displayPrice || fallbackPrice,
      offerToken: undefined,
    };
  };

  const annualDetails = getPlanDetails('pro_annual_3999', '$39.99');
  const weeklyDetails = getPlanDetails('pro_weekly_499', '$4.99');

  const handleStartTrial = async () => {
    if (isProcessing) return;

    try {
      AnalyticsManager.logEvent(`premium_purchase_${selectedPlan}_clicked`);
    } catch {}

    const targetSku = selectedPlan === 'annual' ? 'pro_annual_3999' : 'pro_weekly_499';
    const offerToken =
      selectedPlan === 'annual' ? annualDetails.offerToken : weeklyDetails.offerToken;

    setIsProcessing(true);
    try {
      await SubscriptionManager.subscribeToPlan(targetSku, offerToken);
    } catch (error: any) {
      if (error?.code !== 'E_USER_CANCELLED') {
        Alert.alert(
          'Unable to Start Trial',
          'Google Play Billing could not process the request right now. Please ensure you are signed into Google Play Store and try again.'
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    const restored = await SubscriptionManager.restorePurchases();
    setIsRestoring(false);

    if (restored) {
      Alert.alert('Restored! 🎉', 'Your PRO subscription has been restored.', [
        { text: 'OK', onPress: onClose },
      ]);
    } else {
      Alert.alert(
        'No Active Subscription',
        'We could not find an active subscription linked to your Google Play account.'
      );
    }
  };

  const duplicatedItems = [...PRO_ITEMS, ...PRO_ITEMS];

  return (
    <View style={[styles.container, { backgroundColor: '#0B0F19' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Top Banner Image with Close Button */}
      <View style={styles.topImageContainer}>
        <ImageBackground
          source={require('../assets/chat-with-ai.jpeg')}
          style={styles.headerBackground}
          resizeMode="cover"
        >
          <View style={styles.darkOverlay} />
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.proTitle}>
          Get <Text style={{ color: '#10B981' }}>PRO</Text> Access
        </Text>

        {/* Infinite Circular Carousel */}
        <View style={styles.carouselWrapper}>
          <Animated.View
            style={[
              styles.autoScrollRow,
              { transform: [{ translateX: scrollAnim }] },
            ]}
          >
            {duplicatedItems.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.circularItem}>
                <View style={styles.circleContainer}>
                  <Image source={item.image} style={styles.circleImage} />
                </View>
                <Text style={styles.circleText} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Feature List */}
        <View style={styles.featureSection}>
          <View style={styles.featureRow}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
              ]}
            >
              <Text style={styles.featureEmoji}>🔒</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitleText}>Start your free trial</Text>
              <Text style={styles.featureSubText}>Experience all elite tools instantly</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#334155', backgroundColor: '#1E293B' },
              ]}
            >
              <Text style={styles.featureEmoji}>👑</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitleText}>Unlock Premium Features</Text>
              <Text style={styles.featureSubText}>
                Your free trial gives you full premium access
              </Text>
            </View>
          </View>

          <View style={[styles.featureRow, { marginBottom: 0 }]}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#334155', backgroundColor: '#1E293B' },
              ]}
            >
              <Text style={styles.featureEmoji}>🚫</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitleText}>Ads - Free Experience</Text>
              <Text style={styles.featureSubText}>
                Enjoy ads free experience in your free trial
              </Text>
            </View>
          </View>
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingContainer}>
          <TouchableOpacity
            style={[
              styles.priceCard,
              selectedPlan === 'annual' ? styles.priceCardSelected : styles.priceCardNormal,
            ]}
            onPress={() => setSelectedPlan('annual')}
            activeOpacity={0.8}
          >
            <View style={styles.priceCardHeader}>
              <Text style={[styles.planTitle, selectedPlan === 'annual' && { color: '#10B981' }]}>
                Annual Access
              </Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>BEST VALUE</Text>
              </View>
            </View>
            <Text style={styles.planPrice}>
              {annualDetails.price} <Text style={styles.planDuration}>/ year</Text>
            </Text>
            <Text style={styles.planSub}>Save 84%, billed annually after trial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.priceCard,
              selectedPlan === 'weekly' ? styles.priceCardSelected : styles.priceCardNormal,
            ]}
            onPress={() => setSelectedPlan('weekly')}
            activeOpacity={0.8}
          >
            <View style={styles.priceCardHeader}>
              <Text style={[styles.planTitle, selectedPlan === 'weekly' && { color: '#10B981' }]}>
                Weekly Access
              </Text>
            </View>
            <Text style={styles.planPrice}>
              {weeklyDetails.price} <Text style={styles.planDuration}>/ week</Text>
            </Text>
            <Text style={styles.planSub}>Cancel anytime in your store account</Text>
          </TouchableOpacity>
        </View>

        {/* Store Policy & Restore Links */}
        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={handleRestore} disabled={isRestoring}>
            <Text style={styles.legalLinkText}>
              {isRestoring ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <Text style={styles.legalLinkText}>Auto-renews unless canceled</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.startButton, isProcessing && { opacity: 0.7 }]}
          onPress={handleStartTrial}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>START FREE TRIAL      →</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.noPaymentText}>🛡️  No Payment Now • Cancel Anytime</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topImageContainer: { height: 200, width: '100%', overflow: 'hidden' },
  headerBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 15, 25, 0.45)' },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 },
  proTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 14,
  },
  carouselWrapper: { overflow: 'hidden', width: '100%', marginBottom: 18 },
  autoScrollRow: { flexDirection: 'row', alignItems: 'center' },
  circularItem: { alignItems: 'center', width: 72, marginRight: 12 },
  circleContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10B981',
    marginBottom: 6,
    backgroundColor: '#1E293B',
  },
  circleImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  circleText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  featureSection: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timelineIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  featureEmoji: { fontSize: 16 },
  featureTexts: { flex: 1 },
  featureTitleText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 1 },
  featureSubText: { color: '#94A3B8', fontSize: 11, lineHeight: 14 },
  pricingContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  priceCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    backgroundColor: '#1E293B',
  },
  priceCardNormal: { borderColor: '#334155' },
  priceCardSelected: { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' },
  priceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  badgeContainer: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: 'bold' },
  planPrice: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  planDuration: { color: '#94A3B8', fontSize: 11, fontWeight: 'normal' },
  planSub: { color: '#94A3B8', fontSize: 10, lineHeight: 13 },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  legalLinkText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDivider: { color: '#475569', marginHorizontal: 8, fontSize: 12 },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    alignItems: 'center',
  },
  startButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  noPaymentText: { color: '#94A3B8', fontSize: 11.5, fontWeight: '600' },
});