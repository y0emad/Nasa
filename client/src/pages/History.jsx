import { useMemo, useState } from "react";
import { Appear, Button, Table, Paragraph, Words } from "arwes";
import Clickable from "../components/Clickable";

const FILTERS = [
  { id: "all", label: "All", layer: "primary" },
  { id: "success", label: "Successful", layer: "success" },
  { id: "failed", label: "Failed", layer: "alert" },
];

const byDateDesc = (a, b) => new Date(b.launchDate) - new Date(a.launchDate);

const History = props => {
  const [filter, setFilter] = useState("all");

  const { successful, failed } = useMemo(() => {
    const past = (props.launches ?? []).filter((launch) => !launch.upcoming);
    return {
      successful: past.filter((launch) => launch.success).sort(byDateDesc),
      failed: past.filter((launch) => !launch.success).sort(byDateDesc),
    };
  }, [props.launches]);

  const tableBody = useMemo(() => {
    const rows =
      filter === "success" ? successful : filter === "failed" ? failed : [...successful, ...failed];

    return rows.map((launch) => (
      <tr key={String(launch.flightNumber)}>
        <td data-label="Status">
          <span
            title={launch.success ? "Successful" : "Failed"}
            style={{ color: launch.success ? "greenyellow" : "red" }}
          >
            █
          </span>
        </td>
        <td data-label="No.">{launch.flightNumber}</td>
        <td data-label="Date">{new Date(launch.launchDate).toDateString()}</td>
        <td data-label="Mission">{launch.mission}</td>
        <td data-label="Rocket">{launch.rocket}</td>
        <td data-label="Customers">{launch.customers?.join(", ") || "—"}</td>
      </tr>
    ));
  }, [filter, successful, failed]);

  return <article id="history">
    <Appear animate show={props.entered}>
      <Paragraph>History of mission launches including SpaceX launches starting from the year 1957.</Paragraph>
      <Paragraph>
        <Words animate layer="success">{`${successful.length} successful`}</Words>
        {" · "}
        <Words animate layer="alert">{`${failed.length} failed`}</Words>
      </Paragraph>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        {FILTERS.map(({ id, label, layer }) => (
          <Clickable key={id}>
            <Button
              animate
              show={props.entered}
              layer={layer}
              disabled={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          </Clickable>
        ))}
      </div>

      <Table animate>
        <table className="responsive-table" style={{tableLayout: "fixed"}}>
          <thead>
            <tr>
              <th style={{width: "2rem"}}></th>
              <th style={{width: "3rem"}}>No.</th>
              <th style={{width: "9rem"}}>Date</th>
              <th>Mission</th>
              <th style={{width: "7rem"}}>Rocket</th>
              <th>Customers</th>
            </tr>
          </thead>
          <tbody>
            {tableBody}
          </tbody>
        </table>
      </Table>
    </Appear>
  </article>;
}

export default History;
