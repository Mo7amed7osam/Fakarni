import { normalizeArabicText } from './arabic';

const arabicFirstPersonTaskStarters: Array<[RegExp, string]> = [
  [/^اكلم(?=\s|$)/, 'كلم'],
  [/^اروح(?=\s|$)/, 'روح'],
  [/^اراجع(?=\s|$)/, 'راجع'],
  [/^اذاكر(?=\s|$)/, 'ذاكر'],
  [/^اخلص(?=\s|$)/, 'خلص'],
];

export function normalizeArabicReminderTitle(value: string) {
  let normalized = normalizeArabicText(value).trim();
  normalized = normalized.replace(/[\u064b-\u065f\u0670]/g, '');

  for (const [pattern, replacement] of arabicFirstPersonTaskStarters) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break;
    }
  }

  return normalized
    .replace(/\bايميل\b/g, 'الايميل')
    .replace(/\bايجار\b/g, 'الايجار')
    .replace(/\s+/g, ' ')
    .trim();
}
