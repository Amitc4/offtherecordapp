/**
 * @file main.tsx — Application entry point.
 *
 * Mounts the root React component (`<App />`) into the DOM element with
 * id="root" defined in index.html.  Also imports the global stylesheet
 * (index.css) which contains Tailwind directives and CSS custom properties
 * for the design system (colors, fonts, accessibility overrides, etc.).
 */
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
