import dayjs from 'dayjs';

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function normalizeArabicDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => ARABIC_DIGIT_MAP[digit] ?? digit);
}

export function normalizeArabicText(value: string) {
  return normalizeArabicDigits(value)
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toArabicDateTimeLabel(date: string | Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function toArabicDateLabel(date: string | Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function toArabicTimeLabel(date: string | Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function relativeReminderLabel(offsetMinutes: number) {
  if (offsetMinutes === 0) {
    return 'في نفس الوقت';
  }

  if (offsetMinutes === 30) {
    return 'قبل نص ساعة';
  }

  if (offsetMinutes === 60) {
    return 'قبل ساعة';
  }

  if (offsetMinutes === 120) {
    return 'قبل ساعتين';
  }

  return `قبل ${offsetMinutes} دقيقة`;
}

export function toDayKey(date = new Date()) {
  return dayjs(date).format('YYYY-MM-DD');
}
