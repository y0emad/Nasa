import { Logo, Words, Header as ArwesHeader, withStyles } from "arwes";
import { NavLink, useLocation } from "react-router-dom";
import Clickable from "./Clickable";

const LINKS = [
  { to: "/launch", icon: "rocket_launch", label: "Launch" },
  { to: "/upcoming", icon: "update", label: "Upcoming" },
  { to: "/history", icon: "history", label: "History" },
  { to: "/solar-system", icon: "public", label: "Solar System", short: "Solar" },
];

const styles = (theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    maxWidth: 1280,
    width: "calc(100% - 24px)",
    margin: "0 auto",
    minHeight: 76,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: theme.color.content,
    textDecoration: "none",
    flexShrink: 0,
  },
  img: {
    height: 46,
    width: "auto",
  },
  logo: {
    display: "inherit",
  },
  banner: {
    fontWeight: "bold",
    fontSize: 26,
    whiteSpace: "nowrap",
  },
  nav: {
    display: "flex",
    marginLeft: "auto",
    gap: 4,
  },
  item: {
    display: "block",
  },
  link: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    fontSize: 19,
    whiteSpace: "nowrap",
    color: theme.color.content,
    textDecoration: "none",
    opacity: 0.75,
    transition: "opacity 0.2s, background 0.2s, text-shadow 0.2s",
    "& i": {
      fontSize: 22,
    },
    "&:hover": {
      opacity: 1,
      background: "rgba(161, 236, 251, 0.08)",
    },
    "&::after": {
      content: '""',
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 2,
      height: 2,
      background: theme.color.content,
      boxShadow: `0 0 8px ${theme.color.content}`,
      transform: "scaleX(0)",
      transition: "transform 0.25s",
    },
  },
  active: {
    opacity: 1,
    textShadow: "0 0 10px rgba(161, 236, 251, 0.65)",
    background: "rgba(161, 236, 251, 0.1)",
    "&::after": {
      transform: "scaleX(1)",
    },
  },
  full: {},
  short: {
    display: "none",
  },
  "@media (max-width: 1100px)": {
    banner: {
      display: "none",
    },
  },
  "@media (max-width: 760px)": {
    root: {
      width: "100%",
      minHeight: 0,
      gap: 0,
    },
    brand: {
      display: "none",
    },
    nav: {
      width: "100%",
      marginLeft: 0,
      gap: 0,
    },
    item: {
      flex: "1 1 0",
      minWidth: 0,
    },
    link: {
      flexDirection: "column",
      gap: 2,
      padding: "10px 2px 8px",
      fontSize: 12,
      letterSpacing: 0.5,
      "& i": {
        fontSize: 24,
      },
      "&::after": {
        left: "25%",
        right: "25%",
        bottom: 0,
      },
    },
    full: {
      display: "none",
    },
    short: {
      display: "inline",
    },
  },
});

const Header = ({ classes, onNav, maxWidth = 1000 }) => {
  const { pathname } = useLocation();
  return (
    <ArwesHeader animate>
      <div className={classes.root} style={{ maxWidth }}>
        <NavLink to="/launch" className={classes.brand} onClick={onNav}>
          <img src="/favicon.png" alt="" className={classes.img} />
          <Logo animate size={44} className={classes.logo} layer="header" />
          <Words animate className={classes.banner}>
            NASA Mission Control
          </Words>
        </NavLink>
        <nav className={classes.nav} aria-label="Main">
          {LINKS.map(({ to, icon, label, short }) => {
            const active = pathname === to || (to === "/launch" && pathname === "/");
            return (
              <Clickable key={to} className={classes.item} onClick={() => !active && onNav()}>
                <NavLink
                  to={to}
                  className={`${classes.link} ${active ? classes.active : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <i className="material-icons" aria-hidden="true">{icon}</i>
                  <span className={short ? classes.full : undefined}>{label}</span>
                  {short && <span className={classes.short}>{short}</span>}
                </NavLink>
              </Clickable>
            );
          })}
        </nav>
      </div>
    </ArwesHeader>
  );
};

export default withStyles(styles)(Header);
