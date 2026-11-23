// src/app-kit/billing/SubscriptionManager.ts

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
  type SubscriptionOffer,
} from 'react-native-iap';

const PRO_STORAGE_KEY = '@aichat_pro_entitlement';

export const SUBSCRIPTION_SKUS = Platform.select({
  android: ['pro_annual_3999', 'pro_weekly_499'],
  ios: ['pro_annual_3999', 'pro_weekly_499'],
  default: ['pro_annual_3999', 'pro_weekly_499'],
});

type StatusListener = (isPro: boolean) => void;
type GooglePlayPurchaseListener = (sku: string) => void;

function getOfferTokenForPlan(
  product: ProductSubscription | undefined,
  sku: string
): string | undefined {
  if (!product) return undefined;

  const offers: SubscriptionOffer[] = product.subscriptionOffers || [];
  const expectedPeriod = sku === 'pro_annual_3999' ? 'P1Y' : 'P1W';
  const hasPaidRecurringPhase = (offer: SubscriptionOffer) =>
    (offer.pricingPhasesAndroid?.pricingPhaseList || []).some(
      (phase) =>
        phase.billingPeriod === expectedPeriod &&
        Number.isFinite(Number(phase.priceAmountMicros)) &&
        Number(phase.priceAmountMicros) > 0 &&
        phase.recurrenceMode !== 3
    );
  const matchingOffer =
    offers.find(
      (offer) =>
        hasPaidRecurringPhase(offer) &&
        offer.pricingPhasesAndroid?.pricingPhaseList?.some(
          (phase) =>
            phase.billingPeriod === expectedPeriod &&
            phase.recurrenceMode === 1 &&
            Number(phase.priceAmountMicros) > 0
        )
    ) || offers.find(hasPaidRecurringPhase);

  const token = matchingOffer?.offerTokenAndroid;
  return token || undefined;
}

class BillingService {
  private isConnected = false;
  private isPro = false;
  private cachedSubscriptions: ProductSubscription[] = [];
  private listeners: Set<StatusListener> = new Set();
  private googlePlayPurchaseListeners: Set<GooglePlayPurchaseListener> = new Set();
  private purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener> | null = null;
  private purchaseErrorSub: ReturnType<typeof purchaseErrorListener> | null = null;

  async initialize(): Promise<void> {
    try {
      const savedStatus = await AsyncStorage.getItem(PRO_STORAGE_KEY);
      if (savedStatus === 'true') {
        this.setProStatus(true);
      }

      const connected = await initConnection();
      this.isConnected = Boolean(connected);

      if (this.isConnected) {
        this.attachListeners();
        await this.fetchPlans();
        await this.verifyActiveEntitlements();
      }
    } catch (error) {
      console.warn('[BillingService] Store initialization skipped/offline:', error);
      this.isConnected = false;
    }
  }

  private attachListeners(): void {
    if (this.purchaseUpdateSub && this.purchaseErrorSub) return;
    this.removeListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        if (
          purchase.purchaseState !== 'purchased' ||
          !SUBSCRIPTION_SKUS.includes(purchase.productId)
        ) {
          return;
        }

        const receipt =
          ('transactionReceipt' in purchase && purchase.transactionReceipt) ||
          ('purchaseToken' in purchase && purchase.purchaseToken);
        if (receipt) {
          await finishTransaction({ purchase, isConsumable: false });
          await this.grantProAccess();
          if (purchase.store === 'google' || purchase.storeId === 'play') {
            this.googlePlayPurchaseListeners.forEach((listener) => {
              listener(purchase.productId);
            });
          }
        }
      } catch (err) {
        console.warn('[BillingService] Error finishing transaction:', err);
      }
    });

    this.purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
      if (error.code !== ErrorCode.UserCancelled) {
        console.warn('[BillingService] Purchase listener error:', error.message);
      }
    });
  }

  private removeListeners(): void {
    this.purchaseUpdateSub?.remove();
    this.purchaseErrorSub?.remove();
    this.purchaseUpdateSub = null;
    this.purchaseErrorSub = null;
  }

  cleanup(): void {
    this.removeListeners();
    if (this.isConnected) {
      endConnection().catch(() => {});
      this.isConnected = false;
    }
  }

  async fetchPlans(): Promise<ProductSubscription[]> {
    try {
      if (!this.isConnected) {
        const connected = await initConnection();
        this.isConnected = Boolean(connected);
      }

      if (!this.isConnected) {
        this.cachedSubscriptions = [];
        return this.cachedSubscriptions;
      }

      this.attachListeners();
      const products = await fetchProducts({
        skus: SUBSCRIPTION_SKUS,
        type: 'subs',
      });

      this.cachedSubscriptions = (products as ProductSubscription[] | null) || [];
      return this.cachedSubscriptions;
    } catch (error) {
      console.warn('[BillingService] Could not fetch store subscriptions:', error);
      this.cachedSubscriptions = [];
      return [];
    }
  }

  async subscribeToPlan(sku: string, passedOfferToken?: string): Promise<void> {
    if (!this.isConnected) {
      try {
        const connected = await initConnection();
        this.isConnected = Boolean(connected);
      } catch {}
    }
    if (this.isConnected) this.attachListeners();

    // Resolve the matching paid plan offer when the caller has not supplied its token.
    let resolvedOfferToken = passedOfferToken;
    if (!resolvedOfferToken) {
      const matched = this.cachedSubscriptions.find((product) => product.id === sku);
      resolvedOfferToken = getOfferTokenForPlan(matched, sku);
    }

    // Production / Play Store Internal Testing Path
    if (this.isConnected && (Platform.OS !== 'android' || resolvedOfferToken)) {
      await requestPurchase({
        request: {
          google: {
            skus: [sku],
            subscriptionOffers: resolvedOfferToken
              ? [{ sku, offerToken: resolvedOfferToken }]
              : [],
          },
          apple: {
            sku,
          },
        },
        type: 'subs',
      });
      return;
    }

    // Local Debug / Sideloaded APK Fallback (when Play Console SKUs are not published yet)
    if (__DEV__) {
      await this.grantProAccess();
      return;
    }

    throw new Error('STORE_UNAVAILABLE');
  }

  async restorePurchases(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        const connected = await initConnection();
        this.isConnected = Boolean(connected);
      }

      if (this.isConnected) {
        const purchases = await getAvailablePurchases();
        const hasValidSub = purchases.some((p: any) =>
          SUBSCRIPTION_SKUS.includes(p.productId || p.id)
        );

        if (hasValidSub) {
          await this.grantProAccess();
          return true;
        }
      }

      const saved = await AsyncStorage.getItem(PRO_STORAGE_KEY);
      if (saved === 'true') {
        this.setProStatus(true);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[BillingService] Restore failed:', error);
      return false;
    }
  }

  async verifyActiveEntitlements(): Promise<boolean> {
    return this.restorePurchases();
  }

  async grantProAccess(): Promise<void> {
    await AsyncStorage.setItem(PRO_STORAGE_KEY, 'true');
    this.setProStatus(true);
  }

  async revokeProAccess(): Promise<void> {
    await AsyncStorage.removeItem(PRO_STORAGE_KEY);
    this.setProStatus(false);
  }

  getIsPro(): boolean {
    return this.isPro;
  }

  private setProStatus(status: boolean): void {
    this.isPro = status;
    this.listeners.forEach((listener) => listener(status));
  }

  subscribeToStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isPro);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeToGooglePlayPurchase(
    listener: GooglePlayPurchaseListener
  ): () => void {
    this.googlePlayPurchaseListeners.add(listener);
    return () => {
      this.googlePlayPurchaseListeners.delete(listener);
    };
  }
}

export const SubscriptionManager = new BillingService();