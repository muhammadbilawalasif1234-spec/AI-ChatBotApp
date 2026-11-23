// src/app/screens/PremiumScreen.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { analyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { SubscriptionManager } from '../../app-kit/billing/SubscriptionManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';

interface PremiumScreenProps {
  onClose: () => void;
}

interface ParsedPlanQuote {
  formattedPrice: string;
  amountMicros: number | null;
  currencyCode: string | null;
  billingPeriod: string | null;
  hasFreeTrial: boolean;
  offerToken?: string;
  isFromStore: boolean;
}

const SKU_ANNUAL = 'pro_annual_3999';
const SKU_WEEKLY = 'pro_weekly_499';
type StoreRecord = Record<string, unknown>;

function formatAmountFromMicros(
  amountMicros: number,
  currencyCode: string | null,
  fallbackFormatted?: string
): string {
  if (fallbackFormatted && fallbackFormatted.trim().length > 0) {
    return fallbackFormatted.trim();
  }
  const majorValue = amountMicros / 1_000_000;
  if (currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: Number.isInteger(majorValue) ? 0 : 2,
      }).format(majorValue);
    } catch {
      return `${currencyCode} ${majorValue.toFixed(2)}`;
    }
  }
  return majorValue.toFixed(2);
}

function asRecord(value: unknown): StoreRecord | undefined {
  return value !== null && typeof value === 'object'
    ? (value as StoreRecord)
    : undefined;
}

function getPricingPhases(offer: StoreRecord): StoreRecord[] {
  const phasesContainer =
    asRecord(offer.pricingPhasesAndroid) ||
    asRecord(offer.pricingPhases);
  const phases = phasesContainer?.pricingPhaseList;
  return Array.isArray(phases)
    ? phases.map(asRecord).filter((phase): phase is StoreRecord => Boolean(phase))
    : [];
}

function getOffers(product: StoreRecord): StoreRecord[] {
  const offers =
    product.subscriptionOfferDetails ||
    product.subscriptionOfferDetailsAndroid ||
    product.subscriptionOffers;
  return Array.isArray(offers)
    ? offers.map(asRecord).filter((offer): offer is StoreRecord => Boolean(offer))
    : [];
}

function getPaidRecurringPhase(
  phases: StoreRecord[],
  expectedPeriod: 'P1Y' | 'P1W'
): StoreRecord | undefined {
  const paidPhases = phases.filter(
    (phase) =>
      phase.billingPeriod === expectedPeriod &&
      Number.isFinite(Number(phase.priceAmountMicros)) &&
      Number(phase.priceAmountMicros) > 0 &&
      Number(phase.recurrenceMode) !== 3
  );
  return (
    paidPhases.find((phase) => Number(phase.recurrenceMode) === 1) ||
    paidPhases[paidPhases.length - 1]
  );
}

function fallbackQuote(
  price: string,
  period: 'P1Y' | 'P1W'
): ParsedPlanQuote {
  return {
    formattedPrice: price,
    amountMicros: null,
    currencyCode: null,
    billingPeriod: period,
    hasFreeTrial: false,
    offerToken: undefined,
    isFromStore: false,
  };
}

function extractPlayPlanQuote(
  storeProducts: unknown[],
  sku: string,
  expectedPeriod: 'P1Y' | 'P1W',
  fallbackPrice: string
): ParsedPlanQuote {
  const product = storeProducts
    .map(asRecord)
    .find((candidate) =>
      candidate?.productId === sku ||
      candidate?.id === sku ||
      candidate?.sku === sku ||
      candidate?.product_id === sku
    );
  if (!product) return fallbackQuote(fallbackPrice, expectedPeriod);

  const eligibleOffers = getOffers(product)
    .map((offer) => ({ offer, phases: getPricingPhases(offer) }))
    .filter(({ phases }) => getPaidRecurringPhase(phases, expectedPeriod));

  const selectedOffer =
    eligibleOffers.find(({ phases }) =>
      getPaidRecurringPhase(phases, expectedPeriod)?.recurrenceMode === 1
    ) || eligibleOffers[0];
  if (!selectedOffer) return fallbackQuote(fallbackPrice, expectedPeriod);

  const recurringPhase = getPaidRecurringPhase(selectedOffer.phases, expectedPeriod);
  if (!recurringPhase) return fallbackQuote(fallbackPrice, expectedPeriod);

  const amountMicros = Number(recurringPhase.priceAmountMicros);
  const currencyCode =
    (typeof recurringPhase.priceCurrencyCode === 'string' &&
      recurringPhase.priceCurrencyCode) ||
    (typeof selectedOffer.offer.currency === 'string' &&
      selectedOffer.offer.currency) ||
    (typeof product.currency === 'string' && product.currency) ||
    null;
  const formattedStorePrice =
    typeof recurringPhase.formattedPrice === 'string'
      ? recurringPhase.formattedPrice
      : undefined;
  const rawToken =
    selectedOffer.offer.offerTokenAndroid ||
    selectedOffer.offer.offerToken ||
    product.offerTokenAndroid ||
    product.offerToken;

  return {
    formattedPrice: formatAmountFromMicros(
      amountMicros,
      currencyCode,
      formattedStorePrice
    ),
    amountMicros,
    currencyCode,
    billingPeriod: String(recurringPhase.billingPeriod || expectedPeriod),
    hasFreeTrial: selectedOffer.phases.some(
      (phase) =>
        Number(phase.priceAmountMicros) === 0 ||
        Number(phase.recurrenceMode) === 3
    ),
    offerToken: typeof rawToken === 'string' ? rawToken : undefined,
    isFromStore: true,
  };
}

export default function PremiumScreen({ onClose }: PremiumScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'weekly'>('annual');
  const [storeProducts, setStoreProducts] = useState<unknown[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [, setLanguageVersion] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const hasAlertedSuccess = useRef(false);
  const isRTL = LocalizationManager.isRTL();

  const PRO_ITEMS = useMemo(
    () => [
      { id: '1', title: 'languageTranslator', image: require('../assets/languageTranslator.jpeg') },
      { id: '2', title: 'poet', image: require('../assets/poet.jpeg') },
      { id: '3', title: 'philosopher', image: require('../assets/philosopher.png') },
      { id: '4', title: 'storyteller', image: require('../assets/storyteller.png') },
      { id: '5', title: 'digitalMarketing', image: require('../assets/digital_marketing.png') },
      { id: '6', title: 'horoscope', image: require('../assets/horoscope.png') },
      { id: '7', title: 'lifeCoach', image: require('../assets/life_coach.png') },
      { id: '8', title: 'scienceChat', image: require('../assets/science_chat.png') },
    ],
    []
  );

  useEffect(() => {
    const unsubscribe = LocalizationManager.subscribe(() => {
      setLanguageVersion((version) => version + 1);
    });
    return unsubscribe;
  }, []);

  const loadGooglePlayProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const products = await SubscriptionManager.fetchPlans();
      setStoreProducts(Array.isArray(products) ? products : []);
    } catch (error) {
      console.warn('[PremiumScreen] Could not load Google Play prices:', error);
      setStoreProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadGooglePlayProducts();

    const unsubscribePro = SubscriptionManager.subscribeToStatus((isPro) => {
      if (!isPro) {
        hasAlertedSuccess.current = false;
      } else {
        setIsProcessing(false);
      }

    });
    const unsubscribePurchase = SubscriptionManager.subscribeToGooglePlayPurchase(() => {
      setIsProcessing(false);
      if (!hasAlertedSuccess.current) {
        hasAlertedSuccess.current = true;
        Alert.alert(
          LocalizationManager.t('premiumSuccessTitle'),
          LocalizationManager.t('premiumSuccessMessage'),
          [{ text: LocalizationManager.t('continue'), onPress: onClose }]
        );
      }
    });

    return () => {
      unsubscribePro();
      unsubscribePurchase();
    };
  }, [loadGooglePlayProducts, onClose]);

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
      }).start(({ finished }) => {
        if (finished) startScrolling();
      });
    };

    startScrolling();
  }, [scrollAnim, PRO_ITEMS.length]);

  const annualQuote = useMemo(
    () => extractPlayPlanQuote(storeProducts, SKU_ANNUAL, 'P1Y', '$39.99'),
    [storeProducts]
  );

  const weeklyQuote = useMemo(
    () => extractPlayPlanQuote(storeProducts, SKU_WEEKLY, 'P1W', '$4.99'),
    [storeProducts]
  );

  const liveProductCount = [annualQuote, weeklyQuote].filter(
    (quote) => quote.isFromStore
  ).length;
  const hasLiveStorePrices = liveProductCount > 0;

  const annualSavingsLabel = useMemo(() => {
    if (
      annualQuote.isFromStore &&
      weeklyQuote.isFromStore &&
      annualQuote.amountMicros !== null &&
      weeklyQuote.amountMicros !== null &&
      annualQuote.currencyCode === weeklyQuote.currencyCode &&
      weeklyQuote.amountMicros > 0
    ) {
      const annualizedWeeklyMicros = weeklyQuote.amountMicros * 52;
      const savedPct = Math.round(
        ((annualizedWeeklyMicros - annualQuote.amountMicros) / annualizedWeeklyMicros) * 100
      );
      if (savedPct > 0 && savedPct < 100) {
        return LocalizationManager.t('premiumSaveVsWeekly', { percent: savedPct });
      }
    }
    return annualQuote.hasFreeTrial
      ? LocalizationManager.t('premiumBilledAnnuallyAfterTrial')
      : LocalizationManager.t(
          annualQuote.isFromStore
            ? 'premiumBilledAnnuallyViaPlay'
            : 'premiumBilledAnnually'
        );
  }, [annualQuote, weeklyQuote]);

  const weeklySubtitle = LocalizationManager.t(
    weeklyQuote.hasFreeTrial
      ? 'premiumBilledWeeklyAfterTrial'
      : weeklyQuote.isFromStore
        ? 'premiumBilledWeeklyViaPlay'
        : 'premiumBilledWeekly'
  );

  const handleStartTrial = async () => {
    if (isProcessing || isLoadingProducts || isRestoring) return;

    try {
      analyticsManager.logEvent(`premium_purchase_${selectedPlan}_clicked`);
    } catch {}

    const activeQuote = selectedPlan === 'annual' ? annualQuote : weeklyQuote;
    const targetSku = selectedPlan === 'annual' ? SKU_ANNUAL : SKU_WEEKLY;

    setIsProcessing(true);
    try {
      await SubscriptionManager.subscribeToPlan(targetSku, activeQuote.offerToken);
    } catch (error: any) {
      if (
        error?.code !== 'user-cancelled' &&
        error?.code !== 'E_USER_CANCELLED'
      ) {
        Alert.alert(
          LocalizationManager.t('premiumPurchaseErrorTitle'),
          LocalizationManager.t('premiumPurchaseErrorMessage', {
            price: activeQuote.formattedPrice,
            annualSku: SKU_ANNUAL,
            weeklySku: SKU_WEEKLY,
          })
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateTestPurchase = () => {
    if (!__DEV__ || isProcessing || isRestoring) return;
    setIsProcessing(true);

    const activeQuote = selectedPlan === 'annual' ? annualQuote : weeklyQuote;
    Alert.alert(
      LocalizationManager.t('premiumTestPurchaseTitle'),
      LocalizationManager.t('premiumSimulatePrompt', {
        plan: LocalizationManager.t(
          selectedPlan === 'annual' ? 'premiumAnnualAccess' : 'premiumWeeklyAccess'
        ),
        price: activeQuote.formattedPrice,
      }),
      [
        {
          text: LocalizationManager.t('cancel'),
          style: 'cancel',
          onPress: () => setIsProcessing(false),
        },
        {
          text: LocalizationManager.t('premiumSimulateSuccessButton'),
          onPress: () => {
            setIsProcessing(false);
            Alert.alert(
              LocalizationManager.t('premiumTestPurchaseTitle'),
              LocalizationManager.t('premiumSimulatedNoPurchaseMessage'),
              [{ text: LocalizationManager.t('ok') }]
            );
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    if (isRestoring || isProcessing) return;
    setIsRestoring(true);
    try {
      const restored = await SubscriptionManager.restorePurchases();
      if (restored) {
        Alert.alert(
          LocalizationManager.t('premiumRestoreSuccessTitle'),
          LocalizationManager.t('premiumRestoreSuccessMessage'),
          [{ text: LocalizationManager.t('ok'), onPress: onClose }]
        );
      } else {
        Alert.alert(
          LocalizationManager.t('premiumNoSubscriptionTitle'),
          LocalizationManager.t('premiumNoSubscriptionMessage')
        );
      }
    } catch (error) {
      console.warn('[PremiumScreen] Could not restore Google Play purchases:', error);
      Alert.alert(
        LocalizationManager.t('premiumRestoreUnavailableTitle'),
        LocalizationManager.t('premiumRestoreUnavailableMessage')
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const duplicatedItems = [...PRO_ITEMS, ...PRO_ITEMS];

  return (
    <View style={[styles.container, { backgroundColor: '#0B0F19' }]}>
      <StatusBar barStyle="light-content" />

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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.proTitle}>
          {LocalizationManager.t('premiumGetProAccess')}
        </Text>

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
                  {LocalizationManager.t(item.title)}
                </Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <View style={styles.featureSection}>
          <View style={[styles.featureRow, isRTL && styles.rowReverse]}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
              ]}
            >
              <Text style={styles.featureEmoji}>🔒</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={[styles.featureTitleText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumTrialFeatureTitle')}
              </Text>
              <Text style={[styles.featureSubText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumTrialFeatureDescription')}
              </Text>
            </View>
          </View>

          <View style={[styles.featureRow, isRTL && styles.rowReverse]}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#334155', backgroundColor: '#1E293B' },
              ]}
            >
              <Text style={styles.featureEmoji}>👑</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={[styles.featureTitleText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumFeaturesTitle')}
              </Text>
              <Text style={[styles.featureSubText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumFeaturesDescription')}
              </Text>
            </View>
          </View>

          <View style={[styles.featureRow, isRTL && styles.rowReverse, { marginBottom: 0 }]}>
            <View
              style={[
                styles.timelineIconBox,
                { borderColor: '#334155', backgroundColor: '#1E293B' },
              ]}
            >
              <Text style={styles.featureEmoji}>🚫</Text>
            </View>
            <View style={styles.featureTexts}>
              <Text style={[styles.featureTitleText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumAdFreeTitle')}
              </Text>
              <Text style={[styles.featureSubText, isRTL && styles.rtlText]}>
                {LocalizationManager.t('premiumAdFreeDescription')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pricingContainer}>
          <TouchableOpacity
            style={[
              styles.priceCard,
              selectedPlan === 'annual' ? styles.priceCardSelected : styles.priceCardNormal,
            ]}
            onPress={() => setSelectedPlan('annual')}
            activeOpacity={0.8}
          >
            <View style={[styles.priceCardHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.planTitle, selectedPlan === 'annual' && { color: '#10B981' }]}>
                {LocalizationManager.t('premiumAnnualAccess')}
              </Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {LocalizationManager.t('premiumBestValue')}
                </Text>
              </View>
            </View>
            {isLoadingProducts && !annualQuote.isFromStore ? (
              <ActivityIndicator size="small" color="#10B981" style={styles.priceSpinner} />
            ) : (
              <Text style={styles.planPrice}>
                {annualQuote.formattedPrice}{' '}
                <Text style={styles.planDuration}>
                  {LocalizationManager.t('premiumPerYear')}
                </Text>
              </Text>
            )}
            <Text style={[styles.planSub, isRTL && styles.rtlText]}>
              {annualSavingsLabel}
            </Text>
            {!isLoadingProducts && (
              <Text style={[styles.priceSource, isRTL && styles.rtlText]}>
                {LocalizationManager.t(
                  annualQuote.isFromStore ? 'premiumStorePrice' : 'premiumFallbackPrice'
                )}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.priceCard,
              selectedPlan === 'weekly' ? styles.priceCardSelected : styles.priceCardNormal,
            ]}
            onPress={() => setSelectedPlan('weekly')}
            activeOpacity={0.8}
          >
            <View style={[styles.priceCardHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.planTitle, selectedPlan === 'weekly' && { color: '#10B981' }]}>
                {LocalizationManager.t('premiumWeeklyAccess')}
              </Text>
            </View>
            {isLoadingProducts && !weeklyQuote.isFromStore ? (
              <ActivityIndicator size="small" color="#10B981" style={styles.priceSpinner} />
            ) : (
              <Text style={styles.planPrice}>
                {weeklyQuote.formattedPrice}{' '}
                <Text style={styles.planDuration}>
                  {LocalizationManager.t('premiumPerWeek')}
                </Text>
              </Text>
            )}
            <Text style={[styles.planSub, isRTL && styles.rtlText]}>{weeklySubtitle}</Text>
            {!isLoadingProducts && (
              <Text style={[styles.priceSource, isRTL && styles.rtlText]}>
                {LocalizationManager.t(
                  weeklyQuote.isFromStore ? 'premiumStorePrice' : 'premiumFallbackPrice'
                )}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.legalLinksRow, isRTL && styles.rowReverse]}>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring || isProcessing}
          >
            <Text style={styles.legalLinkText}>
              {isRestoring
                ? LocalizationManager.t('premiumRestoring')
                : LocalizationManager.t('premiumRestorePurchases')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <Text style={styles.legalLinkText}>
            {hasLiveStorePrices
              ? LocalizationManager.t('premiumStorePrice')
              : LocalizationManager.t('premiumAutoRenews')}
          </Text>
        </View>

        {__DEV__ && (
          <View style={styles.devTestBox}>
            <Text style={styles.devTestTitle}>
              {LocalizationManager.t('premiumBillingStatus')}:{' '}
              {hasLiveStorePrices
                ? LocalizationManager.t('premiumLiveStatus', { count: liveProductCount })
                : LocalizationManager.t('premiumFallbackStatus')}
            </Text>
            <View style={styles.devActionsRow}>
              <TouchableOpacity
                style={styles.devActionButton}
                onPress={loadGooglePlayProducts}
                disabled={isLoadingProducts}
              >
                <Text style={styles.devActionText}>
                  {LocalizationManager.t('premiumRefreshStore')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.devActionButton, styles.devSimulateButton]}
                onPress={handleSimulateTestPurchase}
              >
                <Text style={styles.devActionText}>
                  {LocalizationManager.t('premiumSimulateTrial')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            (isProcessing || isLoadingProducts) && { opacity: 0.7 },
          ]}
          onPress={handleStartTrial}
          disabled={isProcessing || isLoadingProducts || isRestoring}
          activeOpacity={0.8}
        >
          {isProcessing || isLoadingProducts ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>
              {(selectedPlan === 'annual' ? annualQuote.hasFreeTrial : weeklyQuote.hasFreeTrial)
                ? LocalizationManager.t('premiumStartFreeTrialButton')
                : LocalizationManager.t('premiumSubscribeButton', {
                    price:
                      selectedPlan === 'annual'
                        ? annualQuote.formattedPrice
                        : weeklyQuote.formattedPrice,
                  })}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.noPaymentText}>
          🛡️{' '}
          {(selectedPlan === 'annual' ? annualQuote.hasFreeTrial : weeklyQuote.hasFreeTrial)
            ? LocalizationManager.t('premiumFreeTrialViaPlay')
            : LocalizationManager.t(
                (selectedPlan === 'annual' ? annualQuote : weeklyQuote).isFromStore
                  ? 'premiumChargedViaPlay'
                  : 'premiumFallbackCheckoutNotice'
              )}
        </Text>
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
  darkOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 15, 25, 0.45)' },
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
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },
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
  priceSpinner: { alignSelf: 'flex-start', marginVertical: 6 },
  planPrice: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  planDuration: { color: '#94A3B8', fontSize: 11, fontWeight: 'normal' },
  planSub: { color: '#94A3B8', fontSize: 10, lineHeight: 13 },
  priceSource: { color: '#64748B', fontSize: 9, lineHeight: 12, marginTop: 3 },
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
  devTestBox: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  devTestTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  devActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  devActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  devSimulateButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: '#10B981',
  },
  devActionText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '700',
  },
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