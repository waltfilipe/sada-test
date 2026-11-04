"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENT_SEASON, INTRO_STORAGE_KEY } from "@/lib/seasons";

const HOLD_MS = 1300;
const RELEASE_MS = 700;
const LEAVE_MS = 1150;

type Props = {
  /** Disparado quando o usuário completa o "segurar" — a capa começa a entrar. */
  onEnter: () => void;
  /** Disparado ao fim da animação de saída — o splash pode ser desmontado. */
  onDone: () => void;
};

/** Tela de abertura "segure para entrar", no estilo noir com a marca SADA. */
export function HubIntro({ onEnter, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const holding = useRef(false);
  const finished = useRef(false);
  const target = useRef({ x: 0, y: 0 });
  const callbacks = useRef({ onEnter, onDone });
  callbacks.current = { onEnter, onDone };
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const orb = orbRef.current;
    if (!root || !orb) return;

    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    target.current = { x: window.innerWidth * 0.9, y: window.innerHeight * 0.64 };
    const pos = { ...target.current };
    let progress = 0;
    let last = performance.now();
    let frame = 0;
    let leaveTimer = 0;

    const finish = () => {
      finished.current = true;
      holding.current = false;
      try {
        sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      root.style.setProperty("--ox", `${pos.x}px`);
      root.style.setProperty("--oy", `${pos.y}px`);
      setLeaving(true);
      callbacks.current.onEnter();
      leaveTimer = window.setTimeout(() => callbacks.current.onDone(), LEAVE_MS);
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!finished.current) {
        progress += holding.current ? dt / HOLD_MS : -dt / RELEASE_MS;
        progress = Math.max(0, Math.min(1, progress));
        root.style.setProperty("--p", progress.toFixed(4));
        root.classList.toggle("is-holding", holding.current);
        if (progress >= 1) finish();
      }
      pos.x += (target.current.x - pos.x) * 0.12;
      pos.y += (target.current.y - pos.y) * 0.12;
      orb.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const isHoldKey = (event: KeyboardEvent) => event.code === "Space" || event.code === "Enter";
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isHoldKey(event) || finished.current) return;
      event.preventDefault();
      holding.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isHoldKey(event)) holding.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      html.style.overflow = previousOverflow;
    };
  }, []);

  const point = (event: React.PointerEvent) => {
    target.current = { x: event.clientX, y: event.clientY };
  };
  const start = (event: React.PointerEvent) => {
    if (finished.current) return;
    point(event);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    holding.current = true;
  };
  const stop = () => {
    holding.current = false;
  };

  return (
    <div
      ref={rootRef}
      className={`sp${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-label="Abertura do SADA Scout"
      onPointerMove={point}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="sp-smoke" aria-hidden>
        <span className="sp-smoke-1" />
        <span className="sp-smoke-2" />
        <span className="sp-smoke-3" />
      </div>
      <div className="sp-grain" aria-hidden />

      <header className="sp-corner sp-corner-tl">
        <img src="/brand/sada-icon.png" alt="SADA" className="sp-icon" />
      </header>
      <span className="sp-corner sp-corner-tr" aria-hidden>
        <span className="sp-live" />
        Temporada {CURRENT_SEASON}
      </span>
      <svg className="sp-corner sp-corner-bl sp-wave" viewBox="0 0 48 16" aria-hidden>
        <path d="M1 8 C 7 1, 11 1, 17 8 S 27 15, 33 8 S 43 1, 47 8" />
      </svg>
      <span className="sp-corner sp-corner-br sp-plus" aria-hidden />

      <div className="sp-copy">
        <p>
          <span className="sp-line" style={{ "--l": 0 } as React.CSSProperties}>
            <strong>sada scout</strong>
          </span>
          <span className="sp-line" style={{ "--l": 1 } as React.CSSProperties}>
            <em>Dados de atletas,</em>
          </span>
          <span className="sp-line" style={{ "--l": 2 } as React.CSSProperties}>
            <em>Perfis, Projeções,</em>
          </span>
          <span className="sp-line" style={{ "--l": 3 } as React.CSSProperties}>
            <em>Decisões de Elenco</em>
          </span>
        </p>
      </div>

      <div ref={orbRef} className="sp-orb" aria-hidden>
        <svg viewBox="0 0 60 60">
          <circle className="sp-orb-track" cx="30" cy="30" r="22" />
          <circle className="sp-orb-ring" cx="30" cy="30" r="22" />
        </svg>
        <span className="sp-orb-core" />
      </div>

      <button type="button" className="sp-hold" aria-label="Segure para entrar (mantenha pressionado ou segure Espaço)">
        <span>Segure para entrar</span>
        <span className="sp-hold-bar" aria-hidden />
      </button>
    </div>
  );
}
