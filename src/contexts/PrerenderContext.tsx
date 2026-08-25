import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

/**
 * Signal de pré-rendu.
 *
 * Un outil de capture externe (crawler headless) charge la page, attend que le
 * contenu réel soit présent, puis snapshote le HTML. Ce contexte centralise ce
 * signal pour toutes les pages publiques :
 *
 *  - `document.documentElement.dataset.prerenderStatus` = "loading" | "ready" | "error"
 *  - `data-prerender-ready="true"` posé sur <html> uniquement à l'état "ready"
 *  - `window.__PRERENDER_READY__` (boolean) et `window.__PRERENDER_ERROR__` (boolean)
 *
 * Le signal est réversible : une page qui repasse en chargement retire
 * `ready`, puis le repose une fois les données réellement peuplées.
 */
export type PrerenderState = "loading" | "ready" | "error";

/** Délai plafond : au-delà, la page est déclarée en erreur (jamais capturée). */
const PRERENDER_TIMEOUT_MS = 20000;

type Ctx = {
  report: (id: string, state: PrerenderState) => void;
  unregister: (id: string) => void;
};

const PrerenderContext = createContext<Ctx | null>(null);

declare global {
  interface Window {
    __PRERENDER_READY__?: boolean;
    __PRERENDER_ERROR__?: boolean;
  }
}

function applyMarker(state: PrerenderState) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-prerender-status", state);
  if (state === "ready") {
    el.setAttribute("data-prerender-ready", "true");
  } else {
    el.removeAttribute("data-prerender-ready");
  }
  if (state === "error") {
    el.setAttribute("data-prerender-error", "true");
  } else {
    el.removeAttribute("data-prerender-error");
  }
  window.__PRERENDER_READY__ = state === "ready";
  window.__PRERENDER_ERROR__ = state === "error";
}

function clearMarker() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.removeAttribute("data-prerender-status");
  el.removeAttribute("data-prerender-ready");
  el.removeAttribute("data-prerender-error");
  delete window.__PRERENDER_READY__;
  delete window.__PRERENDER_ERROR__;
}

export function PrerenderProvider({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const statesRef = useRef(new Map<string, PrerenderState>());
  const [tick, setTick] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const report = useCallback((id: string, state: PrerenderState) => {
    if (statesRef.current.get(id) === state) return;
    statesRef.current.set(id, state);
    setTick((t) => t + 1);
  }, []);

  const unregister = useCallback((id: string) => {
    if (!statesRef.current.has(id)) return;
    statesRef.current.delete(id);
    setTick((t) => t + 1);
  }, []);

  // Nouvelle route : on repart de zéro (signal réversible).
  useEffect(() => {
    setTimedOut(false);
    applyMarker("loading");
  }, [pathname, search]);

  const state: PrerenderState = useMemo(() => {
    const values = [...statesRef.current.values()];
    if (values.includes("error")) return "error";
    if (timedOut) return "error";
    if (values.length === 0) return "loading";
    return values.every((v) => v === "ready") ? "ready" : "loading";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, timedOut, pathname, search]);

  useEffect(() => {
    applyMarker(state);
  }, [state]);

  // Délai plafond, réarmé à chaque navigation.
  useEffect(() => {
    if (state === "ready" || state === "error") return;
    const t = window.setTimeout(() => setTimedOut(true), PRERENDER_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [state, pathname, search]);

  useEffect(() => clearMarker, []);

  const value = useMemo(() => ({ report, unregister }), [report, unregister]);

  return <PrerenderContext.Provider value={value}>{children}</PrerenderContext.Provider>;
}

let seq = 0;

/**
 * Déclare l'état de préparation d'une page publique.
 * Hors du layout public (admin, espaces privés), l'appel est un no-op.
 */
export function usePrerenderStatus(state: PrerenderState) {
  const ctx = useContext(PrerenderContext);
  const idRef = useRef<string>();
  if (!idRef.current) idRef.current = `p${++seq}`;

  useEffect(() => {
    if (!ctx) return;
    ctx.report(idRef.current!, state);
  }, [ctx, state]);

  useEffect(() => {
    if (!ctx) return;
    const id = idRef.current!;
    return () => ctx.unregister(id);
  }, [ctx]);
}
