import fs from "fs";
import path from "path";
import config from "./config";

type TranslationDict = Record<string, string>;
type TranslationParams = Record<string, string | number>;

const FALLBACK_LANGUAGE = "es";

function loadLocale(language: string): TranslationDict {
  const filePath = path.join(config.localesDir, `${language}.json`);
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content) as TranslationDict;
}

function resolveLanguage(language: string): string {
  const filePath = path.join(config.localesDir, `${language}.json`);
  if (fs.existsSync(filePath)) {
    return language;
  }
  return FALLBACK_LANGUAGE;
}

const activeLanguage = resolveLanguage(config.language);
const translations = loadLocale(activeLanguage);
const fallbackTranslations =
  activeLanguage === FALLBACK_LANGUAGE
    ? translations
    : loadLocale(FALLBACK_LANGUAGE);

function applyParams(text: string, params?: TranslationParams): string {
  if (!params) {
    return text;
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text
  );
}

export default function t(key: string, params?: TranslationParams): string {
  const text = translations[key] ?? fallbackTranslations[key] ?? key;
  return applyParams(text, params);
}
