import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../graphics";
import LaunchScene, { TIMELINE } from "./LaunchScene";
import CruiseScene from "./CruiseScene";
import { createLaunchAudio } from "./launchAudio";
import "./launch.css";

const STATUS = {
  countdown: "Terminal count — all systems go",
  hold: "Hold — waiting for mission control",
  ignition: "Main engine ignition",
  liftoff: "Liftoff!",
  maxq: "Max Q — peak aerodynamic pressure",
  ascent: "Vehicle pitching downrange",
  separation: "MECO — stage separation confirmed",
  second: "Second stage burn",
  fairing: "Fairing separation",
  seco: "SECO — second engine cutoff",
  payload: "Spacecraft separation",
  pad: "On the pad — waiting for the launch window",
  scrubbed: "Launch scrubbed",
};

const pad2 = (value) => String(value).padStart(2, "0");

const clock = (t) => {
  const delta = t - TIMELINE.liftoff;
  const sign = delta < 0 ? "-" : "+";
  const total = Math.abs(Math.floor(delta));
  return `T${sign}${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

const missionClock = (ms) => {
  const sign = ms < 0 ? "-" : "+";
  const total = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(total / 86400);
  const time = `${pad2(Math.floor((total % 86400) / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
  return `T${sign}${days > 0 ? `${days}d ` : ""}${time}`;
};

const useNow = (active) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
};

const LaunchSequence = ({ run, sounds, onClose, onViewUpcoming, onFlyTo }) => {
  const mode = run.mode ?? "launch";
  const live = mode === "launch";
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const vibrate = useCallback((pattern) => !reducedMotion && navigator.vibrate?.(pattern), [reducedMotion]);
  const [telemetry, setTelemetry] = useState({ t: 0, phase: mode === "pad" ? "pad" : "countdown", altitude: 0, speed: 0 });
  const now = useNow(!live);
  const [sceneReady, setSceneReady] = useState(mode === "cruise");
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const played = useRef({});
  const audio = useRef(null);
  const lastBeep = useRef(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("launch-muted") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!live) return undefined;
    audio.current = createLaunchAudio();
    audio.current?.resume();
    return () => audio.current?.close();
  }, [live]);

  useEffect(() => {
    audio.current?.setMuted(muted);
    try {
      localStorage.setItem("launch-muted", muted ? "1" : "0");
    } catch {
      return;
    }
  }, [muted]);

  const onTelemetry = useCallback((next) => setTelemetry(next), []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!live) return;
    const once = (key, action) => {
      if (played.current[key]) return;
      played.current[key] = true;
      action();
    };
    const { phase } = telemetry;
    if (phase === "ignition") {
      once("ignition", () => {
        audio.current?.thud(0.8);
        vibrate([250, 80, 400, 80, 900, 60, 1200]);
      });
    }
    if (phase === "separation") {
      once("separation", () => {
        audio.current?.thud(0.5);
        vibrate(120);
      });
    }
    if (phase === "fairing") once("fairing", () => audio.current?.thud(0.25));
    if (phase === "payload") once("payload", () => audio.current?.thud(0.15));
    if (phase === "orbit") once("orbit", () => sounds?.success?.play());
    if (phase === "scrubbed") once("scrubbed", () => sounds?.warning?.play());
  }, [telemetry, sounds, vibrate, live]);

  useEffect(() => {
    const a = audio.current;
    if (!a || !live) return;
    const { t, phase: p, altitude } = telemetry;
    if (p === "countdown" && t < TIMELINE.ignition) {
      const second = Math.floor(t);
      if (second !== lastBeep.current) {
        lastBeep.current = second;
        a.beep(second >= 4 ? 1320 : 880, second >= 4 ? 0.22 : 0.1);
      }
    }
    const far = Math.min(0.92, altitude / 260);
    const thrust =
      p === "ignition" ? Math.min(1, (t - TIMELINE.ignition) / 1.4) * 0.85
        : ["liftoff", "maxq", "ascent"].includes(p) ? 1
          : ["second", "fairing"].includes(p) ? 0.4
            : p === "seco" ? Math.max(0, 0.4 - (t - TIMELINE.seco) * 1)
              : 0;
    a.setThrust(thrust, ["second", "fairing", "seco"].includes(p) ? 0.85 : far);
  }, [telemetry, live]);

  const { phase } = telemetry;
  const done = live && phase === "orbit";
  const scrubbed = phase === "scrubbed";
  const flying = live && telemetry.t >= TIMELINE.liftoff;
  const sinceLaunch = now - new Date(run.launchDate).getTime();

  const clockText = scrubbed ? "SCRUB" : live ? clock(telemetry.t) : missionClock(sinceLaunch);
  const status =
    mode === "cruise" || phase === "orbit"
      ? `Spacecraft en route to ${run.destination}`
      : !sceneReady && !scrubbed && telemetry.t >= 2.4
        ? "Preparing the vehicle"
        : STATUS[phase];

  return (
    <div
      className="launch-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Launch of ${run.mission}`}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-mode={mode}
    >
      {mode === "cruise" ? (
        <CruiseScene />
      ) : (
        <LaunchScene outcome={run.status} onTelemetry={onTelemetry} label={run.rocket} mode={mode} onReady={onSceneReady} />
      )}

      <div className="launch-hud">
        <div className="launch-top">
          <div className="launch-mission">
            <span className="launch-label">Mission</span>
            <strong>{run.mission || "Unnamed mission"}</strong>
            <span>
              {run.rocket} → {run.destination}
              {run.flightNumber ? ` · Flight #${run.flightNumber}` : ""}
            </span>
          </div>
          <div className="launch-buttons">
            {live && (
              <button
                type="button"
                className="launch-close"
                onClick={() => {
                  audio.current?.resume();
                  setMuted((m) => !m);
                }}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
              >
                {muted ? "🔇" : "🔊"}
              </button>
            )}
            <button type="button" className="launch-close" onClick={onClose} aria-label="Close launch view">
              {done || scrubbed || !live ? "✕" : "Skip ✕"}
            </button>
          </div>
        </div>

        <div className={`launch-clock ${phase === "hold" ? "is-hold" : ""} ${scrubbed ? "is-scrubbed" : ""}`}>
          {clockText}
        </div>
        <div className={`launch-status ${scrubbed ? "is-scrubbed" : ""}`}>{status}</div>

        {flying && !scrubbed && phase !== "orbit" && phase !== "payload" && (
          <div className="launch-telemetry">
            <div>
              <span className="launch-label">Altitude</span>
              <strong>{(telemetry.altitude * 0.12).toFixed(1)} km</strong>
            </div>
            <div>
              <span className="launch-label">Speed</span>
              <strong>{Math.round(telemetry.speed * 60).toLocaleString("en-US")} km/h</strong>
            </div>
          </div>
        )}

        {mode === "cruise" && (
          <div className="launch-card">
            <h3>In flight</h3>
            <p>
              Launched on {new Date(run.launchDate).toDateString()}. The spacecraft has been flying for{" "}
              {Math.max(1, Math.floor(sinceLaunch / 86400000) + 1)} day{sinceLaunch >= 86400000 ? "s" : ""} on its way to{" "}
              <strong>{run.destination}</strong>.
            </p>
            <div className="launch-actions">
              {onFlyTo && <button type="button" onClick={onFlyTo}>See {run.destination}</button>}
              <button type="button" className="secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {mode === "pad" && (
          <div className="launch-card">
            <h3>Waiting for launch</h3>
            <p>
              {run.mission} lifts off on {new Date(run.launchDate).toDateString()} and heads for{" "}
              <strong>{run.destination}</strong>.
            </p>
            <div className="launch-actions">
              {onFlyTo && <button type="button" onClick={onFlyTo}>See {run.destination}</button>}
              <button type="button" className="secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {done && (
          <div className="launch-card">
            <h3>Mission launched</h3>
            <p>
              {run.mission} is on its way to <strong>{run.destination}</strong>
              {run.flightNumber ? ` as flight #${run.flightNumber}` : ""}.
            </p>
            <div className="launch-actions">
              {onFlyTo && <button type="button" onClick={onFlyTo}>Fly to {run.destination}</button>}
              <button type="button" className={onFlyTo ? "secondary" : undefined} onClick={onViewUpcoming}>
                View upcoming missions
              </button>
              <button type="button" className="secondary" onClick={onClose}>Schedule another</button>
            </div>
          </div>
        )}

        {scrubbed && (
          <div className="launch-card is-scrubbed">
            <h3>Launch scrubbed</h3>
            <ul>
              {(run.errors ?? []).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            <div className="launch-actions">
              <button type="button" onClick={onClose}>Fix and try again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaunchSequence;
