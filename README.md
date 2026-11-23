# 🤖 AI Chat Assistant (React Native + Gemini AI)

A cross-platform mobile AI assistant built with **React Native CLI** and **TypeScript**, powered by the **Google Gemini API**. Designed with a modular `app-kit` architecture, multi-language localization, specialized AI personas, and integrated monetization.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini_API-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![iOS](https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=ios&logoColor=white)

---

## ✨ Key Features

- **Real-Time AI Conversations:** Instant, context-aware chat powered by the Google Gemini API (`src/app/services/geminiService.ts`).
- **Specialized AI Personas & Assistants:** Dedicated workflows for a Research Assistant, Routine Planner, Digital Marketing Advisor, Language Translator, Life Coach, Storyteller, Philosopher, and more.
- **Multi-Language Support:** Built-in localization manager (`src/app-kit/locales`) with a dedicated language selection screen.
- **Complete User Flow:** Smooth Splash, Onboarding, Main Dashboard, Chat, Nano Banana feature screen, Settings, and Premium upgrade screens.
- **Modular `app-kit` Architecture:** Reusable managers for theming (Dark/Light mode), persistent local storage, analytics, remote config, and in-app subscriptions.
- **AdMob Monetization:** Integrated Banner, Interstitial, Rewarded, and Native Ad components (`src/app-kit/ads`).

---

## 🔑 Gemini API setup

Create `src/app/config/secrets.local.ts` before building the app:

```ts
export const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
```

This local file is git-ignored. Restart Metro and rebuild the app after changing
the key. The chat uses Gemini 3.5 Flash-Lite first and falls back to other
supported Gemini models when a model is unavailable or temporarily rate-limited.

An API key embedded in a mobile app can be extracted from its bundle. Restrict
the key in Google AI Studio/Google Cloud and use a server-side proxy for
production apps; never commit a real key.

---

## 📱 Screenshots

| Onboarding | Home & AI Personas | AI Chat Screen |
| :---: | :---: | :---: |
| ![Onboarding](screenshots/onboarding.png) | ![Home](screenshots/home.png) | ![Chat](screenshots/chat.png) |

*(Note: Upload your app screenshots to a `screenshots/` folder in the root directory to render them above.)*

---

## 📂 Project Structure

```text
AIChatAssistant/
├── android/                  # Native Android configuration & Gradle files
├── ios/                      # Native iOS Xcode project & Podfile
├── src/
│   ├── app/
│   │   ├── assets/           # Persona icons & UI graphics
│   │   ├── config/           # API configuration setup
│   │   ├── screens/          # Splash, Onboarding, Main, Chat, Settings, Premium
│   │   └── services/         # Gemini API integration service
│   └── app-kit/
│       ├── ads/              # Banner, Interstitial, Native & Rewarded ad managers
│       ├── analytics/        # Event tracking manager
│       ├── billing/          # Subscription & IAP manager
│       ├── locales/          # Multi-language localization
│       ├── storage/          # Persistent local storage wrapper
│       └── theme/            # Colors, spacing & theme provider
├── __tests__/                # Unit & service tests (Jest)
└── App.tsx                   # Root application entry point