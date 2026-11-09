import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Appear, Button, Frame, Heading, Loading, Paragraph, Words, withStyles } from "arwes";
import Clickable from "../components/Clickable";
import ExoplanetScene, { habitableZone, planetLook } from "../exoplanets/Scene";
import { httpGetExoplanets } from "../hooks/requests";
import styles from "./explorerStyles";

const number = (value, digits = 0) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });

const LOOK_NOTES = {
  icy: "Cold enough that the drawing shows it frozen over.",
  temperate: "In the range where liquid water could exist, so the drawing shows oceans and land.",
  arid: "On the warm side of the zone, so the drawing shows a drier world.",
  "mini-neptune": "Bigger than 1.7 Earths, so it may be a small gas world rather than a rocky one.",
};

const LOOK_COLORS = { icy: "#bcd6ee", temperate: "#4f8f7a", arid: "#c99a62", "mini-neptune": "#6fa8d0" };

const STAR_NAMES = { M: "red dwarf", K: "orange dwarf", G: "Sun-like star", F: "hot white star", A: "hot white star" };

const statsFor = (planet) => {
  const zone = habitableZone(planet.star.luminositySun);
  return [
    ["Size", `${number(planet.radiusEarth, 2)} × Earth`],
    ["Year", `${number(planet.orbitalPeriodDays, 1)} Earth days`],
    ["Distance from star", `${number(planet.orbitAu, 2)} AU`],
    ["Starlight received", `${number(planet.insolationEarth * 100)}% of Earth's`],
    ["Equilibrium temperature", `${number(planet.equilibriumTempK)} K (${number(planet.equilibriumTempK - 273.15)} °C)`],
    ["Habitable zone", `${number(zone.innerAu, 2)} – ${number(zone.outerAu, 2)} AU`],
    ["Star", `${planet.star.spectralClass}-type ${STAR_NAMES[planet.star.spectralClass]}`],
    ["Star temperature", `${number(planet.star.temperatureK)} K`],
    ["Star size", `${number(planet.star.radiusSun, 2)} × Sun`],
    ["Star brightness", `${number(planet.star.luminositySun * 100, 1)}% of the Sun`],
    ["Sky position", `RA ${number(planet.rightAscensionDeg, 2)}°, Dec ${number(planet.declinationDeg, 2)}°`],
  ];
};

const SizeCompare = ({ classes, planet }) => {
  const earth = 34;
  const size = Math.round(earth * planet.radiusEarth);
  return (
    <div className={classes.compare} aria-label={`${planet.name} is ${planet.radiusEarth} times the size of Earth`}>
      <div className={classes.compareItem}>
        <span className={classes.circle} style={{ width: earth, height: earth, background: "#3f7fc4" }} />
        Earth
      </div>
      <div className={classes.compareItem}>
        <span className={classes.circle} style={{ width: size, height: size, background: LOOK_COLORS[planetLook(planet)] }} />
        {planet.name}
      </div>
    </div>
  );
};

const Exoplanets = ({ classes, entered, sounds }) => {
  const [planets, setPlanets] = useState(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState("system");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    httpGetExoplanets()
      .then((data) => active && setPlanets(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (!planets?.length) return null;
    return planets.find((p) => p.id === params.get("planet")) ?? planets[0];
  }, [planets, params]);

  const select = useCallback(
    (id) => {
      sounds?.click?.play();
      setParams({ planet: id }, { replace: true });
    },
    [sounds, setParams],
  );

  const changeView = (next) => {
    sounds?.click?.play();
    setView(next);
  };

  if (error) {
    return <Paragraph>Could not load the exoplanet data. Please refresh the page.</Paragraph>;
  }

  if (!selected) {
    return <Loading animate />;
  }

  return (
    <Appear id="exoplanets" animate show={entered} style={{ display: "block", width: "100%" }}>
      <div className={classes.toolbar}>
        <Heading node="h2" className={classes.title}>
          <Words animate show={entered}>Habitable Exoplanets</Words>
        </Heading>
        <span className={classes.date}>{planets.length} confirmed by Kepler</span>
      </div>

      <div className={classes.chips} role="tablist" aria-label="Exoplanets">
        {planets.map((planet) => (
          <span
            key={planet.id}
            role="tab"
            tabIndex={0}
            aria-selected={selected.id === planet.id}
            className={`${classes.chip} ${selected.id === planet.id ? classes.chipActive : ""}`}
            onClick={() => select(planet.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && select(planet.id)}
          >
            <span className={classes.dot} style={{ background: planet.star.color }} />
            {planet.name}
          </span>
        ))}
      </div>

      <div className={classes.body}>
        <div className={classes.canvas}>
          <ExoplanetScene planet={selected} view={view} />
          <span className={classes.hint}>Green ring: the zone where liquid water could exist · drag to rotate</span>
        </div>

        <Frame animate show={entered} corners={2} className={classes.panel}>
          <div className={classes.panelInner}>
            <Heading node="h3" style={{ margin: "0 0 6px" }}>
              <span className={classes.dot} style={{ background: selected.star.color, width: 12, height: 12 }} />
              {selected.name}
            </Heading>
            <Paragraph style={{ fontSize: 14, margin: 0 }}>
              It goes around {selected.star.name}, a {STAR_NAMES[selected.star.spectralClass]}, once every{" "}
              {number(selected.orbitalPeriodDays)} days. {LOOK_NOTES[planetLook(selected)]}
            </Paragraph>

            <SizeCompare classes={classes} planet={selected} />

            <div className={classes.controls} style={{ marginTop: 8 }}>
              {[
                ["system", "Whole system"],
                ["planet", "Close-up"],
              ].map(([value, label]) => (
                <span
                  key={value}
                  role="button"
                  tabIndex={0}
                  aria-pressed={view === value}
                  className={`${classes.chip} ${view === value ? classes.chipActive : ""}`}
                  onClick={() => changeView(value)}
                  onKeyDown={(e) => e.key === "Enter" && changeView(value)}
                >
                  {label}
                </span>
              ))}
            </div>

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

            <Clickable>
              <Button
                animate
                show={entered}
                layer="success"
                onClick={() => navigate(`/launch?destination=${encodeURIComponent(selected.name)}`)}
              >
                Schedule a mission here
              </Button>
            </Clickable>

            <p className={classes.credit}>
              Data: NASA Kepler objects of interest. Star brightness and orbit size are worked out from the star&apos;s
              size, temperature and the starlight the planet gets. Surfaces are drawings: nobody has seen these planets
              up close.
            </p>
          </div>
        </Frame>
      </div>
    </Appear>
  );
};

export default withStyles(styles)(Exoplanets);
