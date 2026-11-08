import { useCallback, useEffect, useState } from "react";

import {
  httpGetLaunches,
  httpSubmitLaunch,
  httpAbortLaunch,
} from "./requests";

const readErrors = async (response) => {
  try {
    const body = await response.json();
    if (Array.isArray(body.errors)) return body.errors;
    if (body.msg) return [body.msg];
  } catch {
    return ["Could not reach mission control. Check your connection and try again."];
  }
  return ["The launch was rejected by mission control."];
};

function useLaunches(onSuccessSound, onAbortSound, onFailureSound) {
  const [launches, saveLaunches] = useState([]);
  const [isPendingLaunch, setPendingLaunch] = useState(false);
  const [launchRun, setLaunchRun] = useState(null);

  const getLaunches = useCallback(async () => {
    const fetchedLaunches = await httpGetLaunches();
    saveLaunches(fetchedLaunches);
  }, []);

  useEffect(() => {
    getLaunches();
  }, [getLaunches]);

  const submitLaunch = useCallback(async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const launch = {
      launchDate: new Date(data.get("launch-day")),
      mission: data.get("mission-name"),
      rocket: data.get("rocket-name"),
      destination: data.get("planets-selector"),
    };

    setPendingLaunch(true);
    setLaunchRun({ id: Date.now(), ...launch, status: "pending" });

    const response = await httpSubmitLaunch(launch);

    if (response.ok) {
      const created = await response.json().catch(() => ({}));
      setLaunchRun((run) => run && { ...run, status: "success", flightNumber: created.flightNumber });
      e.target.reset?.();
      getLaunches();
    } else {
      const errors = await readErrors(response);
      setLaunchRun((run) => run && { ...run, status: "failed", errors });
    }
    setPendingLaunch(false);
  }, [getLaunches]);

  const closeLaunchRun = useCallback(() => setLaunchRun(null), []);

  const abortLaunch = useCallback(async (id) => {
    const response = await httpAbortLaunch(id);

    if (response.ok) {
      getLaunches();
      onAbortSound();
    } else {
      onFailureSound();
    }
  }, [getLaunches, onAbortSound, onFailureSound]);

  return {
    launches,
    isPendingLaunch,
    submitLaunch,
    abortLaunch,
    launchRun,
    closeLaunchRun,
    onLaunchSuccessSound: onSuccessSound,
    onLaunchFailureSound: onFailureSound,
  };
}

export default useLaunches;
