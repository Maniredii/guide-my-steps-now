
/**
 * Utility to provide supported language list for both OCR (Tesseract.js)
 * and Text-to-Speech (browser SpeechSynthesis).
 * 
 * Usage:
 *   const languageOptions = await getLanguageOptions();
 */

export interface LanguageOption {
  label: string;
  code: string;       // BCP-47 code for TTS
  tesseract?: string; // Tesseract code for OCR
  ttsSupported: boolean;
  ocrSupported: boolean;
}

// Expanded & reliable list of Tesseract.js language codes (official + community trained)
const TESSERACT_LANGUAGES: { [key: string]: { label: string; tesseract: string } } = {
  "eng":  { label: "English", tesseract: "eng" },
  "hin":  { label: "Hindi (हिन्दी)", tesseract: "hin" },
  "ben":  { label: "Bengali (বাংলা)", tesseract: "ben" },
  "tam":  { label: "Tamil (தமிழ்)", tesseract: "tam" },
  "tel":  { label: "Telugu (తెలుగు)", tesseract: "tel" },
  "kan":  { label: "Kannada (ಕನ್ನಡ)", tesseract: "kan" },
  "mal":  { label: "Malayalam (മലയാളം)", tesseract: "mal" },
  "mar":  { label: "Marathi (मराठी)", tesseract: "mar" },
  "guj":  { label: "Gujarati (ગુજરાતી)", tesseract: "guj" },
  "pan":  { label: "Punjabi (ਪੰਜਾਬੀ)", tesseract: "pan" },
  "urd":  { label: "Urdu (اردو)", tesseract: "urd" },
  "ori":  { label: "Odia (ଓଡ଼ିଆ)", tesseract: "ori" },
  "asm":  { label: "Assamese (অসমীয়া)", tesseract: "asm" },
  "nep":  { label: "Nepali (नेपाली)", tesseract: "nep" },
  "san":  { label: "Sanskrit (संस्कृत)", tesseract: "san" },
  "kok":  { label: "Konkani (कोंकणी)", tesseract: "kok" },
  "mai":  { label: "Maithili (मैथिली)", tesseract: "mai" },
  "es":   { label: "Spanish (Español)", tesseract: "spa" },
  "fr":   { label: "French (Français)", tesseract: "fra" },
  "de":   { label: "German (Deutsch)", tesseract: "deu" },
  "zh":   { label: "Chinese (中文)", tesseract: "chi_sim" },
  "ja":   { label: "Japanese (日本語)", tesseract: "jpn" },
  "ru":   { label: "Russian (Русский)", tesseract: "rus" },
  "ar":   { label: "Arabic (العربية)", tesseract: "ara" },
  "pt":   { label: "Portuguese (Português)", tesseract: "por" },
  "it":   { label: "Italian (Italiano)", tesseract: "ita" },
  // Add more as tested
};

const LANG_MAP: { code: string; tesseract: string; label: string }[] = [
  { code: "en-US", tesseract: "eng", label: "English (US)" },
  { code: "hi-IN", tesseract: "hin", label: "Hindi (हिन्दी)" },
  { code: "bn-IN", tesseract: "ben", label: "Bengali (বাংলা)" },
  { code: "ta-IN", tesseract: "tam", label: "Tamil (தமிழ்)" },
  { code: "te-IN", tesseract: "tel", label: "Telugu (తెలుగు)" },
  { code: "kn-IN", tesseract: "kan", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml-IN", tesseract: "mal", label: "Malayalam (മലയാളം)" },
  { code: "mr-IN", tesseract: "mar", label: "Marathi (मराठी)" },
  { code: "gu-IN", tesseract: "guj", label: "Gujarati (ગુજરાતી)" },
  { code: "pa-IN", tesseract: "pan", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ur-IN", tesseract: "urd", label: "Urdu (اردو)" },
  { code: "or-IN", tesseract: "ori", label: "Odia (ଓଡ଼ିଆ)" },
  { code: "as-IN", tesseract: "asm", label: "Assamese (অসমীয়া)" },
  { code: "ne-NP", tesseract: "nep", label: "Nepali (नेपाली)" },
  { code: "sa-IN", tesseract: "san", label: "Sanskrit (संस्कृत)" },
  { code: "kok-IN", tesseract: "kok", label: "Konkani (कोंकणी)" },
  { code: "mai-IN", tesseract: "mai", label: "Maithili (मैथिली)" },
  { code: "es-ES", tesseract: "spa", label: "Spanish (Español)" },
  { code: "fr-FR", tesseract: "fra", label: "French (Français)" },
  { code: "de-DE", tesseract: "deu", label: "German (Deutsch)" },
  { code: "zh-CN", tesseract: "chi_sim", label: "Chinese (中文)" },
  { code: "ja-JP", tesseract: "jpn", label: "Japanese (日本語)" },
  { code: "ru-RU", tesseract: "rus", label: "Russian (Русский)" },
  { code: "ar-SA", tesseract: "ara", label: "Arabic (العربية)" },
  { code: "pt-PT", tesseract: "por", label: "Portuguese (Português)" },
  { code: "it-IT", tesseract: "ita", label: "Italian (Italiano)" }
];

// Detects browser TTS languages and root codes as well
function findSystemTTSCodes(): Promise<string[]> {
  return new Promise(resolve => {
    if (!window.speechSynthesis) return resolve([]);
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices.map(v => v.lang));
    } else {
      // Safari loads voices async
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices.map(v => v.lang));
      };
      // fallback: after 1s still no voices, just resolve
      setTimeout(() => resolve(window.speechSynthesis.getVoices().map(v => v.lang)), 1000);
    }
  });
}

export async function getLanguageOptions(): Promise<LanguageOption[]> {
  const ttsCodes = await findSystemTTSCodes();
  // Also add base codes for more permissive matching (e.g., "hi" from "hi-IN")
  const ttsRoots = [...new Set(ttsCodes.map(code => code.split('-')[0]))];

  // Include a language as TTS-supported if there is *any* browser voice which matches its root code
  return LANG_MAP.map(opt => {
    const optRoot = opt.code.split('-')[0];
    // Permit both exact match and root match (helps with hi/hi-IN, etc)
    const hasTTS = ttsCodes.includes(opt.code) || ttsRoots.includes(optRoot);
    const hasOCR = !!TESSERACT_LANGUAGES[opt.tesseract];
    return {
      label: opt.label,
      code: opt.code,
      tesseract: opt.tesseract,
      ttsSupported: hasTTS,
      ocrSupported: hasOCR
    };
  }).filter(opt => opt.ocrSupported || opt.ttsSupported);
}
