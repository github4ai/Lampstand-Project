import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AppErrorBoundary from "./components/ErrorBoundary/AppErrorBoundary";
import CloudAccessGate from "./components/Access/CloudAccessGate";

import "./index.css";
import "./styles/index.css";
import "highlight.js/styles/github-dark.css";

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
