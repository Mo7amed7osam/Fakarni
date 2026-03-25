import { ReminderCategory, UiLanguage } from '../types';
import { normalizeArabicText } from './arabic';

const categoryRules: Array<{
  category: ReminderCategory;
  keywords: string[];
}> = [
  {
    category: 'study',
    keywords: [
      'محاضره',
      'محاضرة',
      'جامعه',
      'جامعة',
      'مذاكره',
      'مذاكرة',
      'امتحان',
      'كويز',
      'واجب',
      'تسليم',
      'دكتور',
      'سكشن',
      'مشروع',
      'كورس',
      'دراسه',
      'دراسة',
      'study',
      'course',
      'class',
      'lecture',
      'homework',
      'assignment',
      'exam',
      'quiz',
      'submit',
      'project',
    ],
  },
  {
    category: 'work',
    keywords: [
      'شغل',
      'عميل',
      'كلاينت',
      'تاسك',
      'بريف',
      'تصميم',
      'برمجه',
      'برمجة',
      'دبلوي',
      'تيم',
      'تقرير',
      'ايميل',
      'ميل',
      'شيفت',
      'مكتب',
      'شركه',
      'شركة',
      'work',
      'client',
      'brief',
      'design',
      'code',
      'coding',
      'email',
      'shift',
      'office',
      'company',
      'team',
      'report',
    ],
  },
  {
    category: 'meeting',
    keywords: [
      'اجتماع',
      'ميتينج',
      'meeting',
      'مكالمه',
      'مكالمة',
      'كول',
      'call',
      'زوم',
      'zoom',
      'ميعاد',
      'مقابله',
      'مقابلة',
      'انترفيو',
      'meeting',
      'call',
      'zoom',
      'appointment',
      'interview',
    ],
  },
  {
    category: 'health',
    keywords: [
      'دوا',
      'دواء',
      'علاج',
      'دكتور',
      'عياده',
      'عيادة',
      'تحاليل',
      'تمرين',
      'جيم',
      'مشي',
      'مياه',
      'ميه',
      'مياة',
      'اشرب',
      'فطار',
      'غدا',
      'عشا',
      'نوم',
      'doctor',
      'medicine',
      'medication',
      'clinic',
      'analysis',
      'workout',
      'gym',
      'walk',
      'water',
      'sleep',
      'health',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'اشتري',
      'شراء',
      'سوبرماركت',
      'ماركت',
      'طلبات',
      'طلبات البيت',
      'مقاضي',
      'صيدليه',
      'صيدلية',
      'اكل',
      'أكل',
      'لبس',
      'هديه',
      'هدية',
      'buy',
      'shopping',
      'groceries',
      'market',
      'pharmacy',
      'food',
      'clothes',
      'gift',
    ],
  },
  {
    category: 'finance',
    keywords: [
      'ادفع',
      'دفع',
      'فاتوره',
      'فاتورة',
      'ايجار',
      'إيجار',
      'قسط',
      'حساب',
      'فلوس',
      'مرتب',
      'تحويل',
      'ميزانيه',
      'ميزانية',
      'محفظه',
      'محفظة',
      'pay',
      'bill',
      'rent',
      'installment',
      'salary',
      'money',
      'budget',
      'wallet',
      'transfer',
      'finance',
    ],
  },
  {
    category: 'personal',
    keywords: [
      'اتصل',
      'اكلم',
      'أكلم',
      'ماما',
      'بابا',
      'صاحبي',
      'صاحبتي',
      'عيد ميلاد',
      'مشوار',
      'خروج',
      'نادي',
      'بيت',
      'مذاكره نفسي',
      'call mom',
      'call dad',
      'mom',
      'dad',
      'friend',
      'birthday',
      'hangout',
      'personal',
      'home',
    ],
  },
];

export const reminderCategoryLabels: Record<ReminderCategory, string> = {
  study: 'دراسة',
  work: 'شغل',
  meeting: 'مواعيد',
  health: 'صحة',
  shopping: 'مشتريات',
  finance: 'فلوس',
  personal: 'شخصي',
  other: 'عام',
};

const reminderCategoryLabelsEnglish: Record<ReminderCategory, string> = {
  study: 'Study',
  work: 'Work',
  meeting: 'Meetings',
  health: 'Health',
  shopping: 'Shopping',
  finance: 'Finance',
  personal: 'Personal',
  other: 'General',
};

export function getReminderCategoryLabel(
  category: ReminderCategory,
  language: UiLanguage = 'ar-EG'
) {
  return language === 'en'
    ? reminderCategoryLabelsEnglish[category]
    : reminderCategoryLabels[category];
}

function escapeKeyword(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesKeyword(normalizedInput: string, keyword: string) {
  const normalizedKeyword = normalizeArabicText(keyword).toLowerCase();
  const isArabicSingleWord =
    /[ء-ي]/.test(normalizedKeyword) && !normalizedKeyword.includes(' ');
  const keywordPattern =
    isArabicSingleWord && !normalizedKeyword.startsWith('ال')
      ? `(?:ال)?${escapeKeyword(normalizedKeyword)}`
      : escapeKeyword(normalizedKeyword);
  const pattern = new RegExp(`(^|\\s)${keywordPattern}(?=\\s|$)`);
  return pattern.test(normalizedInput);
}

export function classifyReminderCategory(input: string): ReminderCategory {
  const normalized = normalizeArabicText(input).toLowerCase();

  if (/\bcall mom\b|\bcall dad\b|\bmom\b|\bdad\b|\bbirthday\b|\bhangout\b/.test(normalized)) {
    return 'personal';
  }

  const scored = categoryRules.map((rule) => ({
    category: rule.category,
    score: rule.keywords.reduce((sum, keyword) => {
      return includesKeyword(normalized, keyword) ? sum + 1 : sum;
    }, 0),
  }));

  const bestMatch = scored.sort((a, b) => b.score - a.score)[0];
  if (!bestMatch || bestMatch.score === 0) {
    return 'other';
  }

  return bestMatch.category;
}
