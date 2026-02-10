// i18n scripts

export const defaultLang = 'en';

export const KNOWN_LANGUAGES = {
    fr: { lang: 'fr', emoji: "🇫🇷", label: "Français" },
    en: { lang: 'en', emoji: "🇬🇧", label: "English" },
}

const locales = {
    en: {
        'site.translatable': 'This is a text that can be translated in English or French',
    },
    fr: {
        'site.translatable': 'Ceci est un texte qui peut être traduit en anglais ou en français',
    },
}

// tr stands for translator
export function tr(text, lang) {
    return locales[lang][text] || locales[defaultLang][text];
}