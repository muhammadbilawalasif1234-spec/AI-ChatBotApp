// src/app-kit/ads/AdBlockManager.ts

import { StorageManager } from '../storage/StorageManager';

const ADS_BLOCK_STORAGE_KEY = 'user_manual_ads_block_enabled';

type AdBlockListener = (isBlocked: boolean) => void;

function parseBooleanSetting(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

class AdBlockManagerService {
  private isAdsBlocked = false;
  private hasHydrated = false;
  private hydrationPromise: Promise<boolean> | null = null;
  private listeners = new Set<AdBlockListener>();

  /**
   * Reads the user's saved manual preference on startup/reload.
   * Never flips or modifies the value automatically.
   */
  public async hydrate(): Promise<boolean> {
    if (this.hasHydrated) {
      return this.isAdsBlocked;
    }

    if (this.hydrationPromise) {
      return this.hydrationPromise;
    }

    this.hydrationPromise = (async () => {
      try {
        const saved = await StorageManager.getItem<unknown>(ADS_BLOCK_STORAGE_KEY);
        const parsed = parseBooleanSetting(saved);
        if (parsed !== null) {
          this.isAdsBlocked = parsed;
        }
      } catch {
        // Keep current state if storage read fails
      } finally {
        this.hasHydrated = true;
        this.hydrationPromise = null;
      }

      return this.isAdsBlocked;
    })();

    return this.hydrationPromise;
  }

  public isEnabled(): boolean {
    return this.isAdsBlocked;
  }

  /**
   * Updates Ads Block ONLY when explicitly changed by the user.
   */
  public async setEnabledByUser(enabled: boolean): Promise<void> {
    this.isAdsBlocked = Boolean(enabled);
    this.hasHydrated = true;

    try {
      await StorageManager.setItem(ADS_BLOCK_STORAGE_KEY, this.isAdsBlocked);
    } catch {
      // Keep in-memory state updated even if storage write fails
    }

    this.emit();
  }

  public subscribe(listener: AdBlockListener): () => void {
    this.listeners.add(listener);
    listener(this.isAdsBlocked);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isAdsBlocked);
      } catch {}
    });
  }
}

export const AdBlockManager = new AdBlockManagerService();