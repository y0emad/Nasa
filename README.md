# Nasa
NASA mission control dashboard: schedule launches to habitable exoplanets, track upcoming and past missions. Node.js, Express, React, MongoDB, with CI via GitHub Actions.

# NASA Mission Control

A full-stack web app for planning and tracking space missions. Users can pick a
habitable exoplanet from NASA's Kepler data, schedule a launch, and view upcoming
and historical launches.

## Features
- Schedule new mission launches to habitable exoplanets
- View upcoming launches and mission history, and abort scheduled launches
- Habitable planet data loaded from the NASA Kepler exoplanet dataset
- Past launch data from the SpaceX API
- Secure HTTPS server with Helmet security headers
- Google OAuth 2.0 login (Passport.js) with cookie-based sessions
- Automated install, build and tests with GitHub Actions

## Tech Stack
Node.js, Express, TypeScript, React, MongoDB, Passport.js, Jest

## Getting Started
1. Clone the repo and run `npm install` in `client` and `server`
2. Create a `.env` file with `CLIENT_ID`, `CLIENT_SECRET`, `SESSION_SECRET_1`, `SESSION_SECRET_2`
3. Generate a local HTTPS certificate (see mkcert or OpenSSL)
4. Run `npm run dev`
