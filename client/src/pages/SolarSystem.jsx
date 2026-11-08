import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Appear, Button, Frame, Heading, Loading, Paragraph, Words, withStyles } from "arwes";
import Clickable from "../components/Clickable";
import SolarScene, { dateFromDays } from "../solar/Scene";
import { httpGetSolarSystem } from "../hooks/requests";

const SPEEDS = [
  { label: "Pause", value: 0 },
  { label: "1 day/s", value: 1 },
  { label: "10 days/s", value: 10 },
  { label: "100 days/s", value: 100 },
  { label: "1 year/s", value: 365 },
];

const styles = (theme) => ({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    margin: 0,
  },
  date: {
    fontFamily: '"Source Code Pro", monospace',
    fontSize: 14,
    color: theme.color.content,
    opacity: 0.85,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    cursor: "pointer",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: "3px 10px",
    border: "1px solid rgba(161, 236, 251, 0.35)",
    color: theme.color.content,
    background: "rgba(0, 30, 36, 0.5)",
    userSelect: "none",
    transition: "background 0.2s, color 0.2s",
    "&:hover": {
      background: "rgba(161, 236, 251, 0.15)",
    },
  },
  chipActive: {
    background: theme.color.content,
    color: "#000909",
    "&:hover": {
      background: theme.color.content,
    },
  },
  dot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginRight: 6,
    verticalAlign: "middle",
  },
  body: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
  },
  canvas: {
    position: "relative",
    flex: "1 1 auto",
    minWidth: 0,
    height: "min(68vh, 640px)",
    border: "1px solid rgba(161, 236, 251, 0.25)",
    background: "#000509",
  },
  hint: {
    position: "absolute",
    left: 10,
    bottom: 8,
    fontSize: 12,
    opacity: 0.6,
    pointerEvents: "none",
  },
  panel: {
    flex: "0 0 320px",
  },
  panelInner: {
    padding: "12px 16px",
    maxHeight: "calc(min(68vh, 640px) - 4px)",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  stats: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    margin: "10px 0",
    "& td": {
      padding: "4px 0",
      borderBottom: "1px solid rgba(161, 236, 251, 0.12)",
    },
    "& td:last-child": {
      textAlign: "right",
      fontFamily: '"Source Code Pro", monospace',
    },
  },
  facts: {
    paddingLeft: 18,
    fontSize: 14,
    "& li": {
      marginBottom: 6,
    },
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  credit: {
    fontSize: 11,
    opacity: 0.6,
    margin: "14px 0 0",
    "& a": {
      color: theme.color.content,
    },
  },
  toggle: {
    cursor: "pointer",
    fontSize: 13,
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  "@media (max-width: 900px)": {
    body: {
      flexDirection: "column",
    },
    canvas: {
      height: "58vh",
    },
    panel: {
      flex: "1 1 auto",
    },
    panelInner: {
      maxHeight: "none",
    },
  },
});

const number = (value, digits = 0) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const formatMass = (value) => value.replace(/\^(\d+)/,(_, digits) => [...digits].map((d) => SUPERSCRIPT[d]).join(""));

const formatDay = (hours) => (hours < 72 ? `${number(hours, 1)} h` : `${number(hours / 24, 1)} days`);
const formatYear = (days) => (days < 1000 ? `${number(days, 1)} days` : `${number(days / 365.25, 1)} years`);

const statsFor = (body) => {
  const rows = [
    ["Type", body.type],
    ["Diameter", `${number(body.diameterKm)} km`],
    ["Mass", `${formatMass(body.massKg)} kg`],
    ["Surface gravity", `${number(body.gravity, 1)} m/s²`],
  ];
  if (body.id !== "sun") {
    rows.push(
      ["Distance from Sun", `${number(body.distanceFromSunMillionKm, 1)} million km`],
      ["Length of day", formatDay(body.dayLengthHours)],
      ["Length of year", formatYear(body.orbitalPeriodDays)],
      ["Mean temperature", `${number(body.meanTempC)} °C`],
      ["Moons", number(body.moons)],
      ["Axial tilt", `${number(body.axialTiltDeg, 1)}°`],
    );
  } else {
    rows.push(
      ["Rotation at equator", formatDay(body.dayLengthHours)],
      ["Surface temperature", `${number(body.meanTempC)} °C`],
    );
  }
  return rows;
};

const SolarSystem = ({ classes, entered, sounds }) => {
  const [bodies, setBodies] = useState(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [speed, setSpeed] = useState(10);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const dateRef = useRef(null);

  useEffect(() => {
    let active = true;
    httpGetSolarSystem()
      .then((data) => active && setBodies(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const select = useCallback(
    (id) => {
      sounds?.click?.play();
      setSelectedId(id);
      setResetKey((k) => k + 1);
    },
    [sounds],
  );

  const overview = () => {
    sounds?.click?.play();
    setSelectedId(null);
    setResetKey((k) => k + 1);
  };

  const onTick = useCallback((days) => {
    if (dateRef.current) {
      dateRef.current.textContent = dateFromDays(days).toISOString().slice(0, 10);
    }
  }, []);

  const selected = useMemo(() => bodies?.find((b) => b.id === selectedId), [bodies, selectedId]);

  if (error) {
    return <Paragraph>Could not load the solar system data. Please refresh the page.</Paragraph>;
  }

  if (!bodies) {
    return <Loading animate />;
  }

  return (
    <Appear id="solar-system" animate show={entered} style={{ display: "block", width: "100%" }}>
      <div className={classes.toolbar}>
        <Heading node="h2" className={classes.title}>
          <Words animate show={entered}>Solar System</Words>
        </Heading>
        <span className={classes.date}>
          Simulated date: <span ref={dateRef}>{new Date().toISOString().slice(0, 10)}</span>
        </span>
      </div>

      <div className={classes.chips}>
        {bodies.map((body) => (
          <span
            key={body.id}
            role="button"
            tabIndex={0}
            className={`${classes.chip} ${selectedId === body.id ? classes.chipActive : ""}`}
            onClick={() => select(body.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && select(body.id)}
          >
            <span className={classes.dot} style={{ background: body.color }} />
            {body.name}
          </span>
        ))}
      </div>

      <div className={classes.body}>
        <div className={classes.canvas}>
          <SolarScene
            bodies={bodies}
            selectedId={selectedId}
            onSelect={select}
            speed={speed}
            showOrbits={showOrbits}
            showLabels={showLabels}
            onTick={onTick}
            resetKey={resetKey}
          />
          <span className={classes.hint}>Drag to rotate · scroll to zoom · click a planet</span>
        </div>

        <Frame animate show={entered} corners={2} className={classes.panel}>
          <div className={classes.panelInner}>
            {selected ? (
              <>
                <Heading node="h3" style={{ margin: "0 0 6px" }}>
                  <span className={classes.dot} style={{ background: selected.color, width: 12, height: 12 }} />
                  {selected.name}
                </Heading>
                <Paragraph style={{ fontSize: 14, margin: 0 }}>{selected.summary}</Paragraph>
                <table className={classes.stats}>
                  <tbody>
                    {statsFor(selected).map(([label, value]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Words animate layer="header">Did you know?</Words>
                <ul className={classes.facts}>
                  {selected.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                <Clickable>
                  <Button animate show={entered} onClick={overview}>
                    Back to overview
                  </Button>
                </Clickable>
              </>
            ) : (
              <>
                <Heading node="h3" style={{ margin: "0 0 6px" }}>Explore</Heading>
                <Paragraph style={{ fontSize: 14 }}>
                  The Sun and the eight planets, placed where they are today and moving at the speed you choose.
                  Pick a planet to fly to it and read its numbers.
                </Paragraph>
                <Paragraph style={{ fontSize: 12, opacity: 0.7 }}>
                  Sizes and distances are compressed so everything fits on screen. Real distances would make the
                  planets invisible dots.
                </Paragraph>
              </>
            )}

            <div style={{ marginTop: 14 }}>
              <Words animate layer="header">Simulation</Words>
              <div className={classes.controls} style={{ marginTop: 8 }}>
                {SPEEDS.map((option) => (
                  <span
                    key={option.value}
                    role="button"
                    tabIndex={0}
                    className={`${classes.chip} ${speed === option.value ? classes.chipActive : ""}`}
                    onClick={() => setSpeed(option.value)}
                    onKeyDown={(e) => e.key === "Enter" && setSpeed(option.value)}
                  >
                    {option.label}
                  </span>
                ))}
              </div>
              <div className={classes.controls} style={{ marginTop: 10 }}>
                <label className={classes.toggle}>
                  <input type="checkbox" checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} />
                  Orbits
                </label>
                <label className={classes.toggle}>
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                  Labels
                </label>
              </div>
              <p className={classes.credit}>
                Planet images:{" "}
                <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">
                  Solar System Scope
                </a>{" "}
                (CC BY 4.0). Data: NASA Planetary Fact Sheet.
              </p>
            </div>
          </div>
        </Frame>
      </div>
    </Appear>
  );
};

export default withStyles(styles)(SolarSystem);
