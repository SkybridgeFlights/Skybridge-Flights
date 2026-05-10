import { useEffect, useMemo, useState } from 'react';
import trackerTranslations from '../data/trackerTranslations.json';

export const TRACKER_LANGUAGES = ['en', 'ar', 'de'];

export function normalizeTrackerLanguage(value, fallback = 'en') {
  const text = String(value || '').toLowerCase();
  if (text.startsWith('ar')) return 'ar';
  if (text.startsWith('de')) return 'de';
  if (text.startsWith('en')) return 'en';
  return TRACKER_LANGUAGES.includes(text) ? text : fallback;
}

export function getTrackerCopy(language = 'en') {
  return trackerTranslations[normalizeTrackerLanguage(language)] || trackerTranslations.en;
}

export function getTrackerDirection(language = 'en') {
  return normalizeTrackerLanguage(language) === 'ar' ? 'rtl' : 'ltr';
}

export function withTrackerLanguage(path, language = 'en') {
  if (!path) return path;
  const separator = String(path).includes('?') ? '&' : '?';
  return `${path}${separator}lang=${normalizeTrackerLanguage(language)}`;
}

export function getSiteLanguage(fallback = 'en') {
  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement.lang;
    if (htmlLang) return normalizeTrackerLanguage(htmlLang, fallback);
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('siteLanguage');
    if (stored) return normalizeTrackerLanguage(stored, fallback);
  }
  if (typeof navigator !== 'undefined') {
    return normalizeTrackerLanguage(navigator.language || navigator.userLanguage || '', fallback);
  }
  return normalizeTrackerLanguage(fallback, fallback);
}

export function useSiteLanguage(fallback = 'en') {
  const [language, setLanguage] = useState(() => getSiteLanguage(fallback));

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const refresh = () => setLanguage(getSiteLanguage(fallback));

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    const onStorage = (event) => {
      if (event.key === 'siteLanguage') refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('siteLanguageChange', refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('siteLanguageChange', refresh);
    };
  }, [fallback]);

  return useMemo(() => normalizeTrackerLanguage(language, fallback), [fallback, language]);
}

export default trackerTranslations;
