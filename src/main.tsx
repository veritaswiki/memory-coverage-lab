import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import "./styles.css";

declare global {
  interface Window {
    __memoryBenchRuntime?: {
      mount: () => void;
      unmount: () => void;
    };
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const rootContainer = rootElement;
let root: Root | null = null;

function mountApp() {
  if (!root) {
    root = createRoot(rootContainer);
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

function unmountApp() {
  root?.unmount();
  root = null;
}

window.__memoryBenchRuntime = {
  mount: mountApp,
  unmount: unmountApp,
};

mountApp();
