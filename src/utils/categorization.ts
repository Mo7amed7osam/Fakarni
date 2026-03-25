import { ReminderCategory } from '../types';
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

export function getReminderCategoryLabel(category: ReminderCategory) {
  return reminderCategoryLabels[category];
}

export function classifyReminderCategory(input: string): ReminderCategory {
  const normalized = normalizeArabicText(input);
  const scored = categoryRules.map((rule) => ({
    category: rule.category,
    score: rule.keywords.reduce((sum, keyword) => {
      return normalized.includes(normalizeArabicText(keyword)) ? sum + 1 : sum;
    }, 0),
  }));

  const bestMatch = scored.sort((a, b) => b.score - a.score)[0];
  if (!bestMatch || bestMatch.score === 0) {
    return 'other';
  }

  return bestMatch.category;
}
