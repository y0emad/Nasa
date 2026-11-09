import { useEffect, useMemo, useState } from "react";
import {
  withStyles,
  Appear,
  Link,
  Paragraph,
  Table,
  Words,
} from "arwes";

import Clickable from "../components/Clickable";

const styles = (theme) => ({
  link: {
    color: "red",
    textDecoration: "none",
  },
  countdown: {
    fontFamily: '"Source Code Pro", monospace',
    whiteSpace: "nowrap",
  },
  passed: {
    opacity: 0.6,
  },
  replay: {
    cursor: "pointer",
    font: "inherit",
    fontSize: 13,
    whiteSpace: "nowrap",
    color: theme.color.content,
    background: "rgba(0, 30, 36, 0.5)",
    border: "1px solid rgba(161, 236, 251, 0.4)",
    padding: "3px 10px",
    "&:hover": {
      background: "rgba(161, 236, 251, 0.15)",
    },
  },
});

const pad = (value) => String(value).padStart(2, "0");

const countdown = (launchDate, now) => {
  const ms = new Date(launchDate).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `T-${days > 0 ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const useNow = (interval = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
};

const Upcoming = props => {
  const {
    entered,
    launches,
    classes,
    abortLaunch,
    replayLaunch,
  } = props;
  const now = useNow();

  const upcoming = useMemo(() => launches?.filter((launch) => launch.upcoming) ?? [], [launches]);

  return <Appear id="upcoming" animate show={entered}>
    <Paragraph>Upcoming missions including both SpaceX launches and newly scheduled Zero to Mastery rockets.</Paragraph>
    <Words animate>Warning! Clicking on the ✖ aborts the mission.</Words>
    <Table animate show={entered}>
      <table className="responsive-table" style={{tableLayout: "fixed"}}>
        <thead>
          <tr>
            <th style={{width: "3rem"}}></th>
            <th style={{width: "3rem"}}>No.</th>
            <th style={{width: "9rem"}}>Date</th>
            <th style={{width: "11rem"}}>Countdown</th>
            <th>Mission</th>
            <th>Rocket</th>
            <th>Destination</th>
            <th style={{width: "6rem"}}></th>
          </tr>
        </thead>
        <tbody>
          {upcoming.map((launch) => {
            const left = countdown(launch.launchDate, now);
            return <tr key={String(launch.flightNumber)}>
              <td data-label="Abort">
                <Clickable style={{color:"red"}}>
                  <Link
                    className={classes.link}
                    onClick={() => abortLaunch(launch.flightNumber)}
                    aria-label={`Abort flight ${launch.flightNumber}`}
                  >
                    ✖
                  </Link>
                </Clickable>
              </td>
              <td data-label="No.">{launch.flightNumber}</td>
              <td data-label="Date">{new Date(launch.launchDate).toDateString()}</td>
              <td data-label="Countdown">
                <span className={`${classes.countdown} ${left ? "" : classes.passed}`} data-testid="countdown">
                  {left ?? "Window open"}
                </span>
              </td>
              <td data-label="Mission">{launch.mission}</td>
              <td data-label="Rocket">{launch.rocket}</td>
              <td data-label="Destination">{launch.destination}</td>
              <td data-label="Launch">
                <Clickable>
                  <button
                    type="button"
                    className={classes.replay}
                    onClick={() => replayLaunch(launch)}
                    aria-label={`Watch the launch of flight ${launch.flightNumber}`}
                  >
                    ▶ Watch
                  </button>
                </Clickable>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </Table>
  </Appear>;
}

export default withStyles(styles)(Upcoming);
