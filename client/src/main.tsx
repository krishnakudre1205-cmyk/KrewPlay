import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./services/socket"; // 👈 Add this line
import App from "./App.tsx";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("ServiceWorker registration failed: ", err);
    });
  });
}

// Globally intercept all fetch requests to bypass Ngrok warning screen
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  config.headers = config.headers || {};
  
  if (config.headers instanceof Headers) {
    config.headers.append("ngrok-skip-browser-warning", "true");
  } else {
    // @ts-ignore
    config.headers["ngrok-skip-browser-warning"] = "true";
  }
  
  return originalFetch(resource, config);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);