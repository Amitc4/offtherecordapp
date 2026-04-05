/**
 * @file useAccessibility.tsx — Accessibility settings context & hook.
 *
 * Provides a React context that stores and applies user accessibility
 * preferences across the entire application. Settings are persisted in
 * `localStorage` under the key `"a11y-settings"` so they survive page reloads.
 *
 * **Available settings:**
 * | Setting           | Values          | Effect                                          |
 * |-------------------|-----------------|-------------------------------------------------|
 * | `fontSize`        | 0 / 1 / 2      | Default → Large → Extra-large (CSS class on `<html>`) |
 * | `highContrast`    | boolean         | Toggles the `a11y-high-contrast` CSS class      |
 * | `reduceAnimations`| boolean         | Toggles `a11y-reduce-motion` (disables transitions) |
 * | `dyslexiaFont`    | boolean         | Toggles `a11y-dyslexia-font` (swaps to OpenDyslexic) |
 *
 * The actual visual changes are defined in `index.css` via the CSS classes
 * toggled on `document.documentElement`.
 *
 * **Usage:**
 * ```tsx
 * const { settings, setFontSize, toggleHighContrast } = useAccessibility();
 * ```
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/** Shape of the persisted accessibility preferences. */
interface AccessibilitySettings {
  fontSize: number; // 0 = default, 1 = large, 2 = x-large
  highContrast: boolean;
  reduceAnimations: boolean;
  dyslexiaFont: boolean;
}

/** Methods + state exposed by the context. */
interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setFontSize: (level: number) => void;
  toggleHighContrast: () => void;
  toggleReduceAnimations: () => void;
  toggleDyslexiaFont: () => void;
  resetAll: () => void;
}

/** Sensible defaults — no modifications applied. */
const defaultSettings: AccessibilitySettings = {
  fontSize: 0,
  highContrast: false,
  reduceAnimations: false,
  dyslexiaFont: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

/**
 * Hook to read / modify accessibility preferences.
 * Must be rendered inside `<AccessibilityProvider>`.
 */
export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
};

/**
 * Provider that:
 * 1. Restores settings from localStorage on mount.
 * 2. Applies matching CSS classes on `<html>` whenever settings change.
 * 3. Persists any change back to localStorage.
 */
export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem("a11y-settings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Sync settings → localStorage + DOM classes
  useEffect(() => {
    localStorage.setItem("a11y-settings", JSON.stringify(settings));

    const root = document.documentElement;

    // Font size
    root.classList.remove("a11y-font-large", "a11y-font-xlarge");
    if (settings.fontSize === 1) root.classList.add("a11y-font-large");
    if (settings.fontSize === 2) root.classList.add("a11y-font-xlarge");

    // High contrast
    root.classList.toggle("a11y-high-contrast", settings.highContrast);

    // Reduce animations
    root.classList.toggle("a11y-reduce-motion", settings.reduceAnimations);

    // Dyslexia font
    root.classList.toggle("a11y-dyslexia-font", settings.dyslexiaFont);
  }, [settings]);

  const setFontSize = (level: number) => setSettings(s => ({ ...s, fontSize: Math.max(0, Math.min(2, level)) }));
  const toggleHighContrast = () => setSettings(s => ({ ...s, highContrast: !s.highContrast }));
  const toggleReduceAnimations = () => setSettings(s => ({ ...s, reduceAnimations: !s.reduceAnimations }));
  const toggleDyslexiaFont = () => setSettings(s => ({ ...s, dyslexiaFont: !s.dyslexiaFont }));
  const resetAll = () => setSettings(defaultSettings);

  return (
    <AccessibilityContext.Provider value={{ settings, setFontSize, toggleHighContrast, toggleReduceAnimations, toggleDyslexiaFont, resetAll }}>
      {children}
    </AccessibilityContext.Provider>
  );
};
