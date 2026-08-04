/**
 * @file DismissOnScroll.tsx — Closes open floating menus when the user scrolls.
 *
 * Radix-based popovers, dropdown menus and selects render inside
 * `[data-radix-popper-content-wrapper]`. When the user tries to scroll while
 * one of those is open, we dispatch an `Escape` keydown so the menu closes and
 * the page scrolls normally. Dialogs/sheets are untouched (they are not poppers).
 */
import { useEffect } from "react";

const DismissOnScroll = () => {
  useEffect(() => {
    const closeIfOpen = () => {
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
      }
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("wheel", closeIfOpen, opts);
    window.addEventListener("touchmove", closeIfOpen, opts);
    window.addEventListener("scroll", closeIfOpen, opts);

    return () => {
      window.removeEventListener("wheel", closeIfOpen, opts);
      window.removeEventListener("touchmove", closeIfOpen, opts);
      window.removeEventListener("scroll", closeIfOpen, opts);
    };
  }, []);

  return null;
};

export default DismissOnScroll;
