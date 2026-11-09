import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Appear, Button, Loading, Paragraph } from "arwes";
import Clickable from "../components/Clickable";
import SpaceToday from "../components/SpaceToday";

const Launch = props => {
  const [params] = useSearchParams();
  const destination = params.get("destination") ?? undefined;
  const selectorBody = useMemo(() => {
    return props.planets?.map(planet => 
      <option value={planet.kepler_name} key={planet._id}>{planet.kepler_name}</option>
    );
  }, [props.planets]);

  useEffect(() => {
    const prefetch = () => import("../launch/LaunchSequence");
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 6000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 3000);
    return () => clearTimeout(id);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  return <Appear id="launch" animate show={props.entered}>
    <Paragraph>Schedule a mission launch for interstellar travel to one of the Kepler Exoplanets.</Paragraph>
    <Paragraph>Only confirmed planets matching the following criteria are available for the earliest scheduled missions:</Paragraph>
    <ul>
      <li>Planetary radius &lt; 1.6 times Earth's radius</li>
      <li>Effective stellar flux &gt; 0.36 times Earth's value and &lt; 1.11 times Earth's value</li>
    </ul>
    <Paragraph>
      Not sure where to go? <Link to="/exoplanets" style={{ color: "inherit" }}>Explore the planets in 3D</Link> first.
    </Paragraph>

    <form className="launch-form" onSubmit={props.submitLaunch}>
      <label htmlFor="launch-day">Launch Date</label>
      <input type="date" id="launch-day" name="launch-day" min={today} max="2040-12-31" defaultValue={today} />
      <label htmlFor="mission-name">Mission Name</label>
      <input type="text" id="mission-name" name="mission-name" />
      <label htmlFor="rocket-name">Rocket Type</label>
      <input type="text" id="rocket-name" name="rocket-name" defaultValue="Explorer IS1" />
      <label htmlFor="planets-selector">Destination Exoplanet</label>
      <select id="planets-selector" name="planets-selector" key={props.planets?.length ?? 0} defaultValue={destination}>
        {selectorBody}
      </select>
      <Clickable>
        <Button animate 
          show={props.entered} 
          type="submit" 
          layer="success" 
          disabled={props.isPendingLaunch}>
          Launch Mission ✔
        </Button>
      </Clickable>
      {props.isPendingLaunch &&
        <Loading animate small />
      }
    </form>
    <SpaceToday />
  </Appear>
};

export default Launch;