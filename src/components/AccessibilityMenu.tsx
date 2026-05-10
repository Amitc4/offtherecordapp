/**
 * @file AccessibilityMenu.tsx — Floating accessibility settings panel + notifications.
 *
 * Renders two floating buttons pinned to the bottom-right (above the nav bar):
 * 1. **Accessibility button** – Opens a panel with font size, high contrast,
 *    reduce animations, and dyslexia font toggles. A dot indicator shows when
 *    any non-default setting is active.
 * 2. **Notifications bell** – Rendered via `NotificationsBell` component.
 *
 * The panel uses `useAccessibility()` to read/write settings which are
 * persisted in localStorage and applied as CSS classes on `<html>`.
 */
import { useState } from "react";
import { Accessibility, X, Type, Eye, Zap, BookOpen, RotateCcw, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccessibility } from "@/hooks/useAccessibility";
import NotificationsBell from "@/components/NotificationsBell";

const fontSizeLabels = ["Default", "Large", "Extra Large"];

const AccessibilityMenu = () => {
  const [open, setOpen] = useState(false);
  const { settings, setFontSize, toggleHighContrast, toggleReduceAnimations, toggleDyslexiaFont, resetAll } = useAccessibility();

  const hasChanges = settings.fontSize !== 0 || settings.highContrast || settings.reduceAnimations || settings.dyslexiaFont;

  return (
    <>
      {/* Floating buttons stack - right side above nav */}
      <div className="fixed right-3 bottom-20 z-[60] flex flex-col items-center gap-2 [body.chat-open_&]:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Accessibility menu"
        >
          <Accessibility size={20} />
          {hasChanges && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-primary" />
          )}
        </button>
        <NotificationsBell />
      </div>

      {/* Menu panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[61] bg-black/40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.95 }}
              transition={settings.reduceAnimations ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
              className="fixed right-3 bottom-[9rem] z-[62] w-72 rounded-2xl border border-border bg-card p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <Accessibility size={16} className="text-primary" />
                  Accessibility
                </h3>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Font Size */}
                <div className="rounded-xl bg-background p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Type size={14} className="text-primary" />
                    <span className="font-body text-xs font-semibold text-foreground">Font Size</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setFontSize(settings.fontSize - 1)}
                      disabled={settings.fontSize === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-body text-xs text-muted-foreground">{fontSizeLabels[settings.fontSize]}</span>
                    <button
                      onClick={() => setFontSize(settings.fontSize + 1)}
                      disabled={settings.fontSize === 2}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* High Contrast */}
                <button
                  onClick={toggleHighContrast}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 transition-colors ${settings.highContrast ? "bg-primary/15" : "bg-background"}`}
                >
                  <Eye size={14} className={settings.highContrast ? "text-primary" : "text-muted-foreground"} />
                  <span className="flex-1 text-left font-body text-xs font-semibold text-foreground">High Contrast</span>
                  <div className={`h-5 w-9 rounded-full transition-colors ${settings.highContrast ? "bg-primary" : "bg-muted"}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.highContrast ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </button>

                {/* Reduce Animations */}
                <button
                  onClick={toggleReduceAnimations}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 transition-colors ${settings.reduceAnimations ? "bg-primary/15" : "bg-background"}`}
                >
                  <Zap size={14} className={settings.reduceAnimations ? "text-primary" : "text-muted-foreground"} />
                  <span className="flex-1 text-left font-body text-xs font-semibold text-foreground">Reduce Animations</span>
                  <div className={`h-5 w-9 rounded-full transition-colors ${settings.reduceAnimations ? "bg-primary" : "bg-muted"}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.reduceAnimations ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </button>

                {/* Dyslexia Font */}
                <button
                  onClick={toggleDyslexiaFont}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 transition-colors ${settings.dyslexiaFont ? "bg-primary/15" : "bg-background"}`}
                >
                  <BookOpen size={14} className={settings.dyslexiaFont ? "text-primary" : "text-muted-foreground"} />
                  <span className="flex-1 text-left font-body text-xs font-semibold text-foreground">Dyslexia-Friendly Font</span>
                  <div className={`h-5 w-9 rounded-full transition-colors ${settings.dyslexiaFont ? "bg-primary" : "bg-muted"}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.dyslexiaFont ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </button>

                {/* Reset */}
                {hasChanges && (
                  <button
                    onClick={resetAll}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted p-2.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset All
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AccessibilityMenu;
