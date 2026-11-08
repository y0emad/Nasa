import { useMemo } from "react";
import { 
  withStyles,
  Appear,
  Link,
  Paragraph,
  Table,
  Words,
} from "arwes";

import Clickable from "../components/Clickable";

const styles = () => ({
  link: {
    color: "red",
    textDecoration: "none",
  },
});

const Upcoming = props => {
  const { 
    entered,
    launches,
    classes,
    abortLaunch,
  } = props;

  const tableBody = useMemo(() => {
    return launches?.filter((launch) => launch.upcoming)
      .map((launch) => {
        return <tr key={String(launch.flightNumber)}>
          <td data-label="Abort">
            <Clickable style={{color:"red"}}>
              <Link className={classes.link} onClick={() => abortLaunch(launch.flightNumber)}>
                ✖
              </Link>
            </Clickable>
          </td>
          <td data-label="No.">{launch.flightNumber}</td>
          <td data-label="Date">{new Date(launch.launchDate).toDateString()}</td>
          <td data-label="Mission">{launch.mission}</td>
          <td data-label="Rocket">{launch.rocket}</td>
          <td data-label="Destination">{launch.destination}</td>
        </tr>;
      });
  }, [launches, abortLaunch, classes.link]);

  return <Appear id="upcoming" animate show={entered}>
    <Paragraph>Upcoming missions including both SpaceX launches and newly scheduled Zero to Mastery rockets.</Paragraph>
    <Words animate>Warning! Clicking on the ✖ aborts the mission.</Words>
    <Table animate show={entered}>
      <table className="responsive-table" style={{tableLayout: "fixed"}}>
        <thead>
          <tr>
            <th style={{width: "3rem"}}></th>
            <th style={{width: "3rem"}}>No.</th>
            <th style={{width: "10rem"}}>Date</th>
            <th style={{width: "11rem"}}>Mission</th>
            <th style={{width: "11rem"}}>Rocket</th>
            <th>Destination</th>
          </tr>
        </thead>
        <tbody>
          {tableBody}
        </tbody>
      </table>
    </Table>
  </Appear>;
}

export default withStyles(styles)(Upcoming);