import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AppErrorBoundary from "./components/ErrorBoundary/AppErrorBoundary";
import CloudAccessGate from "./components/Access/CloudAccessGate";

import "./index.css";
import "./styles/index.css";
import "highlight.js/styles/github-dark.css";

// Apply the saved appearance before React paints. Previously this happened only
// after visiting Settings, causing every fresh launch to show the legacy theme.
try {
  const saved = JSON.parse(localStorage.getItem("aios-studio-settings-v1") ?? "{}") as {
    theme?: string; accent?: string; compactUi?: boolean; reducedMotion?: boolean; highContrast?: boolean
  };
  document.documentElement.dataset.theme = saved.theme ?? "system";
  document.documentElement.dataset.accent = saved.accent ?? "cyan";
  document.documentElement.classList.toggle("compact-ui", Boolean(saved.compactUi));
  document.documentElement.classList.toggle("reduced-motion", Boolean(saved.reducedMotion));
  document.documentElement.classList.toggle("high-contrast", Boolean(saved.highContrast));
} catch {
  document.documentElement.dataset.theme = "system";
  document.documentElement.dataset.accent = "cyan";
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <CloudAccessGate><App /></CloudAccessGate>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
