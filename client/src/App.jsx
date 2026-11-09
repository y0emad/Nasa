import {
  BrowserRouter as Router,
} from "react-router-dom";
import {
  Arwes,
  SoundsProvider,
  ThemeProvider,
  createSounds,
  createTheme,
} from "arwes";

import AppLayout from "./pages/AppLayout";

import { theme, resources, sounds } from "./settings";

const backgroundFor = (width) => {
  if (width <= 800) return resources.background.small;
  if (width <= 1400) return resources.background.medium;
  return resources.background.large;
};

const App = () => {
  const background = backgroundFor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2));
  return <ThemeProvider theme={createTheme(theme)}>
    <SoundsProvider sounds={createSounds(sounds)}>
      <Arwes animate background={background} pattern={resources.pattern}>
        {anim => (
          <Router>
            <AppLayout show={anim.entered} />
          </Router>
        )}
      </Arwes>
    </SoundsProvider>
  </ThemeProvider>;
};

export default App;
