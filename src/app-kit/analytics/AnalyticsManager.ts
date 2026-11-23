// src/app-kit/analytics/AnalyticsManager.ts

type EventParams = Record<string, string | number | boolean | null | undefined>;

class AnalyticsManager {
  private isEnabled = true;

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  async logEvent(eventName: string, params?: EventParams): Promise<void> {
    if (!this.isEnabled || !eventName) {
      return;
    }

    try {
      const sanitizedParams: Record<string, string | number | boolean> = {};
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            sanitizedParams[key] = value;
          }
        });
      }

      // If you wire up a custom sink or analytics SDK later, guard the call like this:
      const externalLogger = (globalThis as { __APP_ANALYTICS_LOGGER__?: unknown })
        .__APP_ANALYTICS_LOGGER__;
      if (typeof externalLogger === 'function') {
        await (externalLogger as (name: string, data: Record<string, string | number | boolean>) => void | Promise<void>)(
          eventName,
          sanitizedParams
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[AnalyticsManager] Skipped event "${eventName}":`, error);
      }
    }
  }
}

export const analyticsManager = new AnalyticsManager();