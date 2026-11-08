import { useCallback, useEffect, useRef, useState } from "react";
import LaunchScene, { TIMELINE } from "./LaunchScene";
import "./launch.css";

const STATUS = {
  countdown: "Terminal count — all systems go",
  hold: "Hold — waiting for mission control",
  ignition: "Main engine ignition",
  liftoff: "Liftoff!",
  maxq: "Max Q — peak aerodynamic pressure",
  ascent: "Vehicle pitching downrange",
  separation: "MECO — stage separation confirmed",
  second: "Second stage ignition",
  orbit: "Orbit insertion — en route",
  scrubbed: "Launch scrubbed",
};

const clock = (t) => {
  const delta = t - TIMELINE.liftoff;
  const sign = delta < 0 ? "-" : "+";
  const total = Math.abs(Math.floor(delta));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60);
  return `T${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const LaunchSequence = ({ run, sounds, onClose, onViewUpcoming }) => {
  const [telemetry, setTelemetry] = useState({ t: 0, phase: "countdown", altitude: 0, speed: 0 });
  const played = useRef({});

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
    const play = (key, name) => {
      if (played.current[key]) return;
      played.current[key] = true;
      sounds?.[name]?.play();
    };
    if (telemetry.phase === "ignition") play("ignition", "deploy");
    if (telemetry.phase === "orbit") play("orbit", "success");
    if (telemetry.phase === "scrubbed") play("scrubbed", "warning");
  }, [telemetry.phase, sounds]);

  const { phase } = telemetry;
  const done = phase === "orbit";
  const scrubbed = phase === "scrubbed";
  const flying = telemetry.t >= TIMELINE.liftoff;

  return (
    <div className="launch-overlay" role="dialog" aria-modal="true" aria-label={`Launch of ${run.mission}`}>
      <LaunchScene outcome={run.status} onTelemetry={onTelemetry} />

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
          <button type="button" className="launch-close" onClick={onClose} aria-label="Close launch view">
            {done || scrubbed ? "✕" : "Skip ✕"}
          </button>
        </div>

        <div className={`launch-clock ${phase === "hold" ? "is-hold" : ""} ${scrubbed ? "is-scrubbed" : ""}`}>
          {scrubbed ? "SCRUB" : clock(telemetry.t)}
        </div>
        <div className={`launch-status ${scrubbed ? "is-scrubbed" : ""}`}>{STATUS[phase]}</div>

        {flying && !scrubbed && (
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

        {done && (
          <div className="launch-card">
            <h3>Mission launched</h3>
            <p>
              {run.mission} is on its way to <strong>{run.destination}</strong>
              {run.flightNumber ? ` as flight #${run.flightNumber}` : ""}.
            </p>
            <div className="launch-actions">
              <button type="button" onClick={onViewUpcoming}>View upcoming missions</button>
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
