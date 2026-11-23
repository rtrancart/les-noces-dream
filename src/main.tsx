import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initGA4 } from "./lib/analytics";
import { initialiserSourceVisite } from "./lib/sourceVisite";

initialiserSourceVisite();
initGA4();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
