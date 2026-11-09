const explorerStyles = (theme) => ({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
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
    gap: "6px",
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
    gap: "12px",
    alignItems: "stretch",
  },
  canvas: {
    position: "relative",
    overflow: "hidden",
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
    gap: "8px",
    alignItems: "center",
  },
  credit: {
    fontSize: 12,
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
    gap: "4px",
  },
  compare: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "28px",
    margin: "12px 0 4px",
    fontSize: 12,
    textAlign: "center",
  },
  compareItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
  circle: {
    borderRadius: "50%",
    boxShadow: "inset -6px -4px 10px rgba(0, 0, 0, 0.55)",
  },
  note: {
    fontSize: 12,
    opacity: 0.7,
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

export default explorerStyles;
