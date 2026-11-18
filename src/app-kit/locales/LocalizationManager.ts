// src/app-kit/services/LocalizationManager.ts
import { StorageManager } from './StorageManager';

class LocalizationManagerService {
  private currentLanguage: string = 'en';
  private listeners: ((lang: string) => void)[] = [];

  constructor() {
    this.initLanguage();
  }

  private async initLanguage() {
    try {
      const savedLang = await StorageManager.getItem('selected_language');
      if (savedLang) {
        this.currentLanguage = savedLang;
        this.notifyListeners();
      }
    } catch (e) {}
  }

  private translations: Record<string, Record<string, string>> = {
    en: {
      appTitle: 'AI Chat App',
      trending: 'Trending 🔥',
      createVisuals: 'Create Visuals 🎨',
      nanoBanana: 'Nano Banana',
      nanoBananaSub: 'Edit, Blend & Bring Images to Life',
      eliteTools: 'Elite Tools ⚡',
      aiAssistants: 'AI Assistants 🤖',
      suggestions: 'Suggestions 💡',
      history: 'HISTORY',
      noHistory: 'No, history yet',
      art: 'Art',
      travel: 'Travel',
      social: 'Social',
      relationship: 'Relationship',
      letsStartChat: '✨ Let\'s Start Chat',
      selectLanguage: 'Select Language',
      privacyPolicy: 'Privacy Policy',
      rateUs: 'Rate Us',
      reportUs: 'Report Us',
      moreApps: 'More Apps',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      ob1Title: 'Discover More with AI',
      ob1Sub: 'Guiding you in every field, instantly',
      artPrompt: 'Write short story about witchcraft',
      travelPrompt: 'When is the best time to visit mountains.',
      relPrompt: 'How to check couple compatibility score',
      socPrompt: 'Suggest Family events for new year',
      ob2Title: 'Your Personal AI',
      ob2Sub: 'Smart help for every part of your life',
      poetTitle: 'Poet',
      poetSub: 'Transforming simple ideas into evocative poetic landscapes',
      translatorTitle: 'Language Translator',
      translatorSub: 'Break language barriers effortlessly',
      researchTitle: 'Research Assistant',
      researchSub: 'Ask questions and find answers fast',
      trainerTitle: 'Personal Trainer',
      trainerSub: 'Personalized training plans in seconds',
      philosopherTitle: 'Philosopher',
      philosopherSub: 'Thought-provoking insights at your fingertips',
      routineTitle: 'Routine Planner',
      routineSub: 'Smart schedules for a productive life',
      astrologerTitle: 'Astrologer',
      astrologerSub: 'AI insights for love, career, and Life',
      coachTitle: 'Relationship Coach',
      coachSub: 'Smart tips for love and communication',
      ob3Title: 'AI for Everything',
      ob3Sub: 'Insights, and advice for every need',
      digitalMarketing: 'Digital Marketing',
      horoscope: 'Horoscope',
      scienceChat: 'Science Chat',
      storyteller: 'Storyteller',
      valentinesDay: 'Valentine\'s Day',
      lifeCoach: 'Life Coach',
    },
    ar: {
      appTitle: 'تطبيق دردشة الذكاء الاصطناعي',
      trending: 'الأكثر رواجاً 🔥',
      createVisuals: 'إنشاء المرئيات 🎨',
      nanoBanana: 'نانو بنانا',
      nanoBananaSub: 'تعديل، دمج وإحياء الصور',
      eliteTools: 'أدوات النخبة ⚡',
      aiAssistants: 'مساعدو الذكاء الاصطناعي 🤖',
      suggestions: 'اقتراحات 💡',
      history: 'السجل',
      noHistory: 'لا يوجد سجل حتى الآن',
      art: 'فن',
      travel: 'سفر',
      social: 'اجتماعي',
      relationship: 'علاقات',
      letsStartChat: '✨ بدء الدردشة',
      selectLanguage: 'اختر اللغة',
      privacyPolicy: 'سياسة الخصوصية',
      rateUs: 'قيمنا',
      reportUs: 'أبلغ عنا',
      moreApps: 'المزيد من التطبيقات',
      darkMode: 'الوضع الداكن',
      lightMode: 'الوضع الفاتح',
      ob1Title: 'اكتشف المزيد مع الذكاء الاصطناعي',
      ob1Sub: 'إرشادك في كل مجال فورا',
      artPrompt: 'اكتب قصة قصيرة عن السحر',
      travelPrompt: 'متى هو أفضل وقت لزيارة الجبال',
      relPrompt: 'كيفية التحقق من توافق الزوجين',
      socPrompt: 'اقترح فعاليات عائلية للعام الجديد',
      ob2Title: 'ذكاؤك الاصطناعي الشخصي',
      ob2Sub: 'مساعدة ذكية لكل جانب من حياتك',
      poetTitle: 'شاعر',
      poetSub: 'تحويل الأفكار البسيطة إلى مناظر شعرية',
      translatorTitle: 'مترجم لغة',
      translatorSub: 'كسر حواجز اللغة بسهولة',
      researchTitle: 'مساعد بحث',
      researchSub: 'طرح الأسئلة والعثور على الإجابات بسرعة',
      trainerTitle: 'مدرب شخصي',
      trainerSub: 'خطط تدريب مخصصة في ثوانٍ',
      philosopherTitle: 'فيلسوف',
      philosopherSub: 'رؤى مثيرة للتفكير في متناول يدك',
      routineTitle: 'مخطط الروتين',
      routineSub: 'جداول ذكية لحياة منتجة',
      astrologerTitle: 'منجم',
      astrologerSub: 'رؤى الذكاء الاصطناعي للحب والعمل',
      coachTitle: 'مدرب علاقات',
      coachSub: 'نصائح ذكية للحب والتواصل',
      ob3Title: 'الذكاء الاصطناعي لكل شيء',
      ob3Sub: 'رؤى وننصائح لكل احتياج',
      digitalMarketing: 'التسويق الرقمي',
      horoscope: 'الأبراج',
      scienceChat: 'دردشة علمية',
      storyteller: 'راوي القصص',
      valentinesDay: 'عيد الحب',
      lifeCoach: 'مدرب الحياة',
    },
    // Fallbacks for other languages
  };

  public setLanguage(lang: string) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentLanguage));
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public subscribe(listener: (lang: string) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public t(key: string): string {
    const langDict = this.translations[this.currentLanguage] || this.translations['en'];
    return langDict[key] || this.translations['en'][key] || key;
  }
}

export const LocalizationManager = new LocalizationManagerService();