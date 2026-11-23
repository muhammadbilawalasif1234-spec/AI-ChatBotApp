import { SubscriptionManager } from '../billing/SubscriptionManager';

class PremiumManager {
  private isInitialized: boolean = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await SubscriptionManager.initialize();
    this.isInitialized = true;
  }

  public getIsPremium(): boolean {
    return SubscriptionManager.getIsPro();
  }

  public async buyProduct(productId: string): Promise<boolean> {
    await SubscriptionManager.subscribeToPlan(productId);
    return true;
  }

  public async restorePurchases(): Promise<boolean> {
    return SubscriptionManager.restorePurchases();
  }
}

export const premiumManager = new PremiumManager();
