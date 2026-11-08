import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Frame, Loading, withSounds, withStyles } from "arwes";

import usePlanets from "../hooks/usePlanets";
import useLaunches from "../hooks/useLaunches";

import Centered from "../components/Centered";
import Header from "../components/Header";
import Footer from "../components/Footer";

import Launch from "./Launch";
import History from "./History";
import Upcoming from "./Upcoming";

const SolarSystem = lazy(() => import("./SolarSystem"));

const styles = () => ({
  content: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    margin: "auto",
  },
  centered: {
    flex: 1,
    paddingTop: "20px",
    paddingBottom: "10px",
  },
});

const AppLayout = props => {
  const { sounds, classes } = props;
  const { pathname } = useLocation();
  const isSolar = pathname.startsWith("/solar-system");

  const [frameVisible, setFrameVisible] = useState(true);
  const animateFrame = () => {
    setFrameVisible(false);
    setTimeout(() => {
      setFrameVisible(true);
    }, 600);
  };

  const onSuccessSound = () => sounds.success && sounds.success.play();
  const onAbortSound = () => sounds.abort && sounds.abort.play();
  const onFailureSound = () => sounds.warning && sounds.warning.play();

  const {
    launches,
    isPendingLaunch,
    submitLaunch,
    abortLaunch,
  } = useLaunches(onSuccessSound, onAbortSound, onFailureSound);

  const planets = usePlanets();

  return <div className={classes.content}>
    <Header onNav={animateFrame} />
    <Centered className={classes.centered} style={isSolar ? { maxWidth: 1280, width: "calc(100% - 24px)" } : undefined}>
      <Frame animate
        show={frameVisible}
        corners={4}
        style={{visibility: frameVisible ? "visible" : "hidden"}}>
        {anim => {
          const launch = <Launch
            entered={anim.entered}
            planets={planets}
            submitLaunch={submitLaunch}
            isPendingLaunch={isPendingLaunch} />;
          return <div style={{padding: isSolar ? "12px" : "20px"}}>
            <Routes>
              <Route path="/" element={launch} />
              <Route path="/launch" element={launch} />
              <Route path="/upcoming" element={
                <Upcoming entered={anim.entered} launches={launches} abortLaunch={abortLaunch} />
              } />
              <Route path="/history" element={<History entered={anim.entered} launches={launches} />} />
              <Route path="/solar-system" element={
                <Suspense fallback={<Loading animate />}>
                  <SolarSystem entered={anim.entered} sounds={sounds} />
                </Suspense>
              } />
              <Route path="*" element={<Navigate to="/launch" replace />} />
            </Routes>
          </div>;
        }}
      </Frame>
    </Centered>
    <Footer />
  </div>;
};

export default withSounds()(withStyles(styles)(AppLayout));
