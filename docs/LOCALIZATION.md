# Localization Documentation

## Overview

CabinetPro Web provides complete bilingual support for Persian (فارسی) and English, with proper RTL/LTR layout switching.

## Supported Languages

- **Persian (fa-IR)**: Default language with RTL layout
- **English (en-US)**: Alternative language with LTR layout

## Implementation

### i18next Configuration

The application uses **i18next** with **react-i18next** for React integration and **i18next-browser-languagedetector** for automatic language detection.

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fa: { translation: faTranslations },
      en: { translation: enTranslations },
    },
    fallbackLng: 'fa',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });
```

### Translation Files

Translation files are located in `src/i18n/locales/`:

- **fa.json**: Persian translations
- **en.json**: English translations

#### Structure

```json
{
  "app": {
    "name": "CabinetPro Web",
    "tagline": "طراحی و بهینه‌سازی برش کابینت"
  },
  "nav": {
    "dashboard": "داشبورد",
    "projects": "پروژه‌ها"
  },
  "cabinet": {
    "base": "کابینت زمینی",
    "wall": "کابینت هوایی"
  }
}
```

### Usage in Components

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
    </div>
  );
}
```

### Language Switching

The application provides a language switcher in the header:

```typescript
import { useI18n } from './hooks/useI18n';

function LanguageSwitcher() {
  const { language, changeLanguage } = useI18n();
  
  return (
    <button onClick={() => changeLanguage(language === 'fa' ? 'en' : 'fa')}>
      {language === 'fa' ? 'English' : 'فارسی'}
    </button>
  );
}
```

### RTL/LTR Support

The application automatically switches document direction:

```typescript
useEffect(() => {
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}, [language]);
```

**HTML Root Element:**

```html
<html lang="fa" dir="rtl">
  <!-- Persian RTL layout -->
</html>

<html lang="en" dir="ltr">
  <!-- English LTR layout -->
</html>
```

## Font Handling

### Persian Font

The application uses **Vazirmatn** for Persian text:

```html
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&display=swap" rel="stylesheet">
```

### Font Selection

```css
[dir='rtl'] {
  font-family: 'Vazirmatn', system-ui, sans-serif;
}

[dir='ltr'] {
  font-family: 'Inter', system-ui, sans-serif;
}
```

## Persistent Language Preference

The language preference is stored in IndexedDB:

```typescript
export async function updateLanguage(language: Language): Promise<void> {
  const settings = await getSettings();
  settings.language = language;
  await saveSettings(settings);
  
  // Update HTML direction
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}
```

## Technical Considerations

### Number Formatting

Persian uses Eastern Arabic numerals (۰۱۲۳۴۵۶۷۸۹):

```typescript
// In components
const persianNumber = (num: number) => {
  return num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
};
```

### Mixed Content

When displaying mixed Persian/English content (e.g., measurements):

```typescript
// Correct: Use logical order
<span>{t('dimensions.width')}: 80 {t('dimensions.cm')}</span>

// This renders as:
// RTL: عرض: ۸۰ سانتی‌متر
// LTR: Width: 80 cm
```

### CSS Logical Properties

Use logical CSS properties for better RTL/LTR support:

```css
/* Good - works in both directions */
margin-inline-start: 1rem;
padding-inline-end: 2rem;

/* Avoid - breaks in RTL */
margin-left: 1rem;
padding-right: 2rem;
```

## Translation Coverage

### Fully Translated
- ✅ Navigation and menus
- ✅ Buttons and actions
- ✅ Cabinet types and components
- ✅ Dimensions and units
- ✅ Status messages
- ✅ About page content

### Partially Translated
- ⚠️ Error messages (need expansion)
- ⚠️ Validation messages (need expansion)
- ⚠️ Export file names (need expansion)

### Not Yet Translated
- ❌ PDF export content
- ❌ Excel export headers
- ❌ Email templates
- ❌ Help text and tooltips

## Testing

### Language Switching Tests

```typescript
describe('Localization', () => {
  it('switches to Persian', async () => {
    await changeLanguage('fa');
    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
  });
  
  it('switches to English', async () => {
    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
  
  it('persists language preference', async () => {
    await changeLanguage('fa');
    const settings = await getSettings();
    expect(settings.language).toBe('fa');
  });
});
```

## Adding New Translations

1. Add key to `src/i18n/locales/fa.json`
2. Add same key to `src/i18n/locales/en.json`
3. Use the key in components with `t('key.path')`

Example:

```json
// fa.json
{
  "newFeature": {
    "title": "عنوان جدید"
  }
}

// en.json
{
  "newFeature": {
    "title": "New Feature"
  }
}

// Component
<h2>{t('newFeature.title')}</h2>
```

## Known Issues

1. **Mixed Direction Text**: Some technical terms may display incorrectly in mixed RTL/LTR context
2. **Number Formatting**: Automatic Persian numeral conversion not yet implemented
3. **PDF Export**: PDF library needs configuration for Persian font embedding
4. **Print Preview**: Print styles may need adjustment for RTL layout

## Future Enhancements

- Automatic Persian numeral conversion
- Additional languages (Arabic, Turkish)
- RTL-aware date formatting
- Bilingual export options
- Voice input in Persian
- Better mixed-direction text handling
