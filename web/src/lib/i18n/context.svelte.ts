import { browser } from '$app/environment';
import { createContext } from 'svelte';
import { STRINGS, type Lang, type StringKey } from './strings';

const DEFAULT_LANGUAGE: Lang = 'de';
const STORAGE_KEY = 'macrosignal-language';

function readStoredLang(): Lang {
	if (!browser) return DEFAULT_LANGUAGE;
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored && stored in STRINGS ? (stored as Lang) : DEFAULT_LANGUAGE;
}

function interpolate(template: string, values: Record<string, string | number> = {}): string {
	return template
		.replace(
			/\{(\w+), plural, one \{([^{}]+)\} other \{([^{}]+)\}\}/g,
			(_, key: string, one: string, other: string) => (Number(values[key]) === 1 ? one : other)
		)
		.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export type I18nContext = {
	readonly lang: Lang;
	setLanguage: (language: Lang) => void;
	t: (key: StringKey, values?: Record<string, string | number>) => string;
};

export function createI18n(initialLang: Lang = readStoredLang()): I18nContext {
	let lang = $state(initialLang);

	return {
		get lang() {
			return lang;
		},
		setLanguage(language: Lang) {
			if (!(language in STRINGS)) return;
			lang = language;
			if (browser) localStorage.setItem(STORAGE_KEY, language);
		},
		t(key: StringKey, values: Record<string, string | number> = {}) {
			const template = STRINGS[lang][key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
			return interpolate(template, values);
		}
	};
}

export const [getI18n, setI18n] = createContext<I18nContext>();
