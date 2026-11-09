import { useEffect, useState } from "react";
import { Words, withStyles } from "arwes";
import { httpGetSpaceToday } from "../hooks/requests";

const styles = (theme) => ({
  root: {
    marginTop: 32,
    paddingTop: 20,
    borderTop: "1px solid rgba(161, 236, 251, 0.2)",
  },
  body: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)",
    gap: "20px",
    marginTop: 12,
    alignItems: "start",
  },
  media: {
    display: "block",
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    border: "1px solid rgba(161, 236, 251, 0.3)",
    background: "#000509",
  },
  title: {
    margin: "0 0 4px",
    fontSize: 20,
    color: "#e6fbff",
  },
  meta: {
    fontFamily: '"Source Code Pro", monospace',
    fontSize: 12,
    opacity: 0.7,
    margin: "0 0 10px",
  },
  text: {
    fontSize: 14,
    lineHeight: 1.55,
    margin: 0,
  },
  clamped: {
    display: "-webkit-box",
    WebkitLineClamp: 5,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    marginTop: 10,
    fontSize: 14,
    "& a, & button": {
      color: theme.color.content,
      background: "none",
      border: "none",
      padding: 0,
      font: "inherit",
      cursor: "pointer",
      textDecoration: "underline",
    },
  },
  "@media (max-width: 700px)": {
    body: {
      gridTemplateColumns: "1fr",
    },
  },
});

const SOURCES = {
  apod: { label: "Astronomy Picture of the Day", link: "Open on apod.nasa.gov" },
  epic: { label: "NASA EPIC camera", link: "More from EPIC" },
};

const SpaceToday = ({ classes }) => {
  const [picture, setPicture] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    httpGetSpaceToday().then((data) => active && setPicture(data));
    return () => {
      active = false;
    };
  }, []);

  if (!picture) return null;

  const image = picture.mediaType === "image" ? picture.url : picture.thumbnailUrl;

  return (
    <section className={classes.root} aria-labelledby="space-today-title">
      <Words animate layer="header">Today from NASA</Words>
      <div className={classes.body}>
        <a href={picture.mediaType === "image" ? picture.hdUrl || picture.url : picture.url} target="_blank" rel="noreferrer">
          {image ? (
            <img className={classes.media} src={image} alt={picture.title} loading="lazy" decoding="async" />
          ) : (
            <span className={classes.media} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              Watch on NASA
            </span>
          )}
        </a>
        <div>
          <h3 id="space-today-title" className={classes.title}>{picture.title}</h3>
          <p className={classes.meta}>
            {SOURCES[picture.source]?.label ?? "NASA"} · {picture.date}
            {picture.copyright ? ` · © ${picture.copyright}` : ""}
          </p>
          <p className={`${classes.text} ${open ? "" : classes.clamped}`}>{picture.explanation}</p>
          <div className={classes.actions}>
            {picture.explanation.length > 260 && (
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                {open ? "Show less" : "Read more"}
              </button>
            )}
            <a href={picture.sourceUrl} target="_blank" rel="noreferrer">{SOURCES[picture.source]?.link ?? "Open on NASA"}</a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default withStyles(styles)(SpaceToday);
