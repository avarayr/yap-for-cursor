import * as CONFIG from "../config";

// --- Constants ---
const LOCAL_STORAGE_KEY = "asr_selected_language";
const CONTEXT_MENU_ID = "asr-language-context-menu";

// --- Supported Languages ---
// Updated based on the provided list
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "ru", name: "Russian" },
  { code: "ko", name: "Korean" },
  { code: "fr", name: "French" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "tr", name: "Turkish" },
  { code: "pl", name: "Polish" },
  { code: "ca", name: "Catalan" },
  { code: "nl", name: "Dutch" },
  { code: "ar", name: "Arabic" },
  { code: "sv", name: "Swedish" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
  { code: "hi", name: "Hindi" },
  { code: "fi", name: "Finnish" },
  { code: "vi", name: "Vietnamese" },
  { code: "he", name: "Hebrew" },
  { code: "uk", name: "Ukrainian" },
  { code: "el", name: "Greek" },
  { code: "ms", name: "Malay" },
  { code: "cs", name: "Czech" },
  { code: "ro", name: "Romanian" },
  { code: "da", name: "Danish" },
  { code: "hu", name: "Hungarian" },
  { code: "ta", name: "Tamil" },
  { code: "no", name: "Norwegian" },
  { code: "th", name: "Thai" },
  { code: "ur", name: "Urdu" },
  { code: "hr", name: "Croatian" },
  { code: "bg", name: "Bulgarian" },
  { code: "lt", name: "Lithuanian" },
  { code: "la", name: "Latin" },
  { code: "mi", name: "Maori" },
  { code: "ml", name: "Malayalam" },
  { code: "cy", name: "Welsh" },
  { code: "sk", name: "Slovak" },
  { code: "te", name: "Telugu" },
  { code: "fa", name: "Persian" },
  { code: "lv", name: "Latvian" },
  { code: "bn", name: "Bengali" },
  { code: "sr", name: "Serbian" },
  { code: "az", name: "Azerbaijani" },
  { code: "sl", name: "Slovenian" },
  { code: "kn", name: "Kannada" },
  { code: "et", name: "Estonian" },
  { code: "mk", name: "Macedonian" },
  { code: "br", name: "Breton" },
  { code: "eu", name: "Basque" },
  { code: "is", name: "Icelandic" },
  { code: "hy", name: "Armenian" },
  { code: "ne", name: "Nepali" },
  { code: "mn", name: "Mongolian" },
  { code: "bs", name: "Bosnian" },
  { code: "kk", name: "Kazakh" },
  { code: "sq", name: "Albanian" },
  { code: "sw", name: "Swahili" },
  { code: "gl", name: "Galician" },
  { code: "mr", name: "Marathi" },
  { code: "pa", name: "Punjabi" },
  { code: "si", name: "Sinhala" },
  { code: "km", name: "Khmer" },
  { code: "sn", name: "Shona" },
  { code: "yo", name: "Yoruba" },
  { code: "so", name: "Somali" },
  { code: "af", name: "Afrikaans" },
  { code: "oc", name: "Occitan" },
  { code: "ka", name: "Georgian" },
  { code: "be", name: "Belarusian" },
  { code: "tg", name: "Tajik" },
  { code: "sd", name: "Sindhi" },
  { code: "gu", name: "Gujarati" },
  { code: "am", name: "Amharic" },
  { code: "yi", name: "Yiddish" },
  { code: "lo", name: "Lao" },
  { code: "uz", name: "Uzbek" },
  { code: "fo", name: "Faroese" },
  { code: "ht", name: "Haitian Creole" },
  { code: "ps", name: "Pashto" },
  { code: "tk", name: "Turkmen" },
  { code: "nn", name: "Nynorsk" },
  { code: "mt", name: "Maltese" },
  { code: "sa", name: "Sanskrit" },
  { code: "lb", name: "Luxembourgish" },
  { code: "my", name: "Myanmar" },
  { code: "bo", name: "Tibetan" },
  { code: "tl", name: "Tagalog" },
  { code: "mg", name: "Malagasy" },
  { code: "as", name: "Assamese" },
  { code: "tt", name: "Tatar" },
  { code: "haw", name: "Hawaiian" },
  { code: "ln", name: "Lingala" },
  { code: "ha", name: "Hausa" },
  { code: "ba", name: "Bashkir" },
  { code: "jw", name: "Javanese" },
  { code: "su", name: "Sundanese" },
].toSorted((a, b) => a.name.localeCompare(b.name));

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// --- Language Persistence ---

/**
 * Retrieves the currently selected ASR language from localStorage.
 * Falls back to the default language specified in config.ts if none is set.
 *
 * @returns The selected language code.
 */
export function getSelectedLanguage(): LanguageCode {
  try {
    const storedLanguage = localStorage.getItem(LOCAL_STORAGE_KEY);
    // Validate if the stored language is one of the supported ones
    if (
      storedLanguage &&
      SUPPORTED_LANGUAGES.some((lang) => lang.code === storedLanguage)
    ) {
      return storedLanguage as LanguageCode;
    }
  } catch (error) {
    console.error("Error reading language from localStorage:", error);
  }
  // Fallback to english
  return "en";
}

/**
 * Stores the selected ASR language in localStorage.
 *
 * @param languageCode The language code to store.
 */
export function setSelectedLanguage(languageCode: LanguageCode): void {
  try {
    // Ensure the language is supported before storing
    if (SUPPORTED_LANGUAGES.some((lang) => lang.code === languageCode)) {
      localStorage.setItem(LOCAL_STORAGE_KEY, languageCode);
      console.log(`ASR language set to: ${languageCode}`);
    } else {
      console.warn(`Attempted to set unsupported language: ${languageCode}`);
    }
  } catch (error) {
    console.error("Error writing language to localStorage:", error);
  }
}

// --- Context Menu Creation and Handling ---

/**
 * Removes any existing context menu from the DOM.
 */
function removeExistingContextMenu(): void {
  const existingMenu = document.getElementById(CONTEXT_MENU_ID);
  existingMenu?.remove();
  // Remove the global click listener when the menu is removed
  document.removeEventListener("click", handleOutsideClick, true);
}

/**
 * Handles clicks outside the context menu to close it.
 * Must be captured phase (`true`) to preempt clicks on menu items.
 */
function handleOutsideClick(event: MouseEvent): void {
  const menu = document.getElementById(CONTEXT_MENU_ID);
  if (menu && !menu.contains(event.target as Node)) {
    removeExistingContextMenu();
  }
}

/**
 * Creates and displays the language selection context menu.
 *
 * @param targetElement The HTML element (e.g., the mic button) to position the menu relative to.
 * @param onSelect Callback function triggered when a language is selected. Receives the language code.
 */
export function createLanguageContextMenu(
  targetElement: HTMLElement,
  onSelect: (languageCode: LanguageCode) => void
): void {
  // Remove any previous menu first
  removeExistingContextMenu();

  const currentLanguage = getSelectedLanguage();

  const menu = document.createElement("div");
  menu.id = CONTEXT_MENU_ID;
  menu.className = "asr-context-menu"; // Add class for styling
  menu.style.position = "absolute";
  // Position off-screen initially to measure
  menu.style.visibility = "hidden";
  menu.style.top = "-10000px";
  menu.style.left = "-10000px";
  menu.style.zIndex = "10000"; // Ensure it's on top

  const title = document.createElement("div");
  title.className = "asr-context-menu-title";
  title.textContent = "Select Language";
  menu.appendChild(title);

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const item = document.createElement("div");
    item.className = "asr-context-menu-item";
    item.textContent = lang.name;
    item.dataset.langCode = lang.code; // Store code for easy access

    if (lang.code === currentLanguage) {
      item.classList.add("selected"); // Highlight current selection
    }

    item.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent outside click handler
      const selectedCode = (e.target as HTMLElement).dataset
        .langCode as LanguageCode;
      if (selectedCode) {
        onSelect(selectedCode);
      }
      removeExistingContextMenu(); // Close menu after selection
    });

    menu.appendChild(item);
  });

  // Append to body to measure dimensions
  document.body.appendChild(menu);

  // Get dimensions after rendering (while hidden)
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const targetRect = targetElement.getBoundingClientRect();

  // Calculate position: centered above the target element
  const verticalOffset = 5; // Small gap above the button
  const finalTop =
    targetRect.top - menuHeight - verticalOffset + window.scrollY; // Adjust for scroll
  const finalLeft =
    targetRect.left + targetRect.width / 2 - menuWidth / 2 + window.scrollX; // Adjust for scroll

  // Apply calculated position and make visible
  menu.style.top = `${finalTop}px`;
  menu.style.left = `${finalLeft}px`;
  menu.style.visibility = "visible";

  // Add a listener to close the menu when clicking outside
  // Use capture phase to catch clicks before they bubble up
  // Use setTimeout to allow the current event cycle to complete before adding listener
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick, true);
  }, 0);
}

// --- Basic Styling (Inject into the main styles later if preferred) ---
// Removed injectContextMenuStyles function as styles are now in styles.css
