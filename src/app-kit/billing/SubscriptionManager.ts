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
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
} from 'react-native-iap';

const PRO_STORAGE_KEY = '@aichat_pro_entitlement';

export const SUBSCRIPTION_SKUS = Platform.select({
  android: ['pro_annual_3999', 'pro_weekly_499'],
  ios: ['pro_annual_3999', 'pro_weekly_499'],
  default: ['pro_annual_3999', 'pro_weekly_499'],
});

type StatusListener = (isPro: boolean) => void;

class BillingService {
  private isConnected = false;
  private isPro = false;
  private cachedSubscriptions: ProductSubscription[] = [];
  private listeners: Set<StatusListener> = new Set();
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
    this.removeListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        const receipt = purchase.transactionReceipt || (purchase as any).purchaseToken;
        if (receipt) {
          await finishTransaction({ purchase, isConsumable: false });
          await this.grantProAccess();
        }
      } catch (err) {
        console.warn('[BillingService] Error finishing transaction:', err);
      }
    });

    this.purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
      if (error.code !== 'E_USER_CANCELLED') {
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

      if (!this.isConnected) return [];

      const products = await fetchProducts({
        skus: SUBSCRIPTION_SKUS,
        type: 'subs',
      });

      this.cachedSubscriptions = (products as ProductSubscription[]) || [];
      return this.cachedSubscriptions;
    } catch (error) {
      console.warn('[BillingService] Could not fetch store subscriptions:', error);
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

    // Attempt to resolve offerToken from cached store products if not explicitly passed
    let resolvedOfferToken = passedOfferToken;
    if (!resolvedOfferToken && this.cachedSubscriptions.length > 0) {
      const matched: any = this.cachedSubscriptions.find((p: any) => p.productId === sku || p.id === sku);
      const offers = matched?.subscriptionOfferDetails || matched?.subscriptionOfferDetailsAndroid;
      if (offers && offers.length > 0) {
        resolvedOfferToken = offers[0].offerToken;
      }
    }

    // Production / Play Store Internal Testing Path
    if (this.isConnected && (Platform.OS !== 'android' || resolvedOfferToken)) {
      await requestPurchase({
        request: {
          android: {
            skus: [sku],
            subscriptionOffers: resolvedOfferToken
              ? [{ sku, offerToken: resolvedOfferToken }]
              : [],
          },
          ios: {
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
}

export const SubscriptionManager = new BillingService();