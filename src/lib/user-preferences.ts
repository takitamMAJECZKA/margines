/**
 * User-level preferences are stored in the browser only. This adapter keeps
 * the settings UI and vocabulary flows independent from the storage details.
 */
export type ThemePreference = "system" | "light" | "dark";
export type DefaultWordInputLanguage = "dictionary" | "polish";

export interface UserPreferences {
  theme: ThemePreference;
  defaultWordInputLanguage: DefaultWordInputLanguage;
  /** Whether flashcards show the saved Tatoeba/AI example sentence. */
  showStudyExamples: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  defaultWordInputLanguage: "dictionary",
  showStudyExamples: true,
};

const USER_PREFERENCES_KEY = "margines:user-preferences";
const USER_PREFERENCES_EVENT = "margines:user-preferences-change";

export function readUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;

  try {
    const stored = window.localStorage.getItem(USER_PREFERENCES_KEY);
    if (!stored) return DEFAULT_USER_PREFERENCES;

    const parsed = JSON.parse(stored) as Partial<UserPreferences>;
    return {
      theme:
        parsed.theme === "light" || parsed.theme === "dark"
          ? parsed.theme
          : "system",
      defaultWordInputLanguage:
        parsed.defaultWordInputLanguage === "polish" ? "polish" : "dictionary",
      showStudyExamples: parsed.showStudyExamples !== false,
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveUserPreferences(
  update: Partial<UserPreferences>,
): UserPreferences {
  const preferences = { ...readUserPreferences(), ...update };
  replaceUserPreferences(preferences);
  return preferences;
}

/** Replaces the browser cache after loading the signed-in user's cloud settings. */
export function replaceUserPreferences(
  preferences: UserPreferences,
): UserPreferences {
  try {
    window.localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(USER_PREFERENCES_EVENT));
  } catch {
    // Preferences still apply for the current screen if storage is unavailable.
  }
  return preferences;
}

export function subscribeUserPreferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(USER_PREFERENCES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(USER_PREFERENCES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readDefaultWordInputLanguage(): DefaultWordInputLanguage {
  return readUserPreferences().defaultWordInputLanguage;
}

export function readShowStudyExamples(): boolean {
  return readUserPreferences().showStudyExamples;
}
