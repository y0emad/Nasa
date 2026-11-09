# NASA Mission Control

A full-stack web app for planning and tracking space missions. Pick a habitable
exoplanet from NASA's Kepler data, schedule a launch, and view upcoming and past missions.

## Features

- Schedule mission launches to habitable exoplanets
- Watch a 3D launch sequence when you schedule a mission, with engine sound and camera shake
- Explore the 7 habitable Kepler exoplanets in 3D: each planet around its star, inside the zone where liquid water could exist
- Explore a 3D solar system: the Sun and 8 planets in their positions for today, with speed controls and a facts panel for each planet
- View upcoming launches with a live countdown, watch any of them launch again, and abort scheduled launches
- See today's picture from NASA on the launch page
- Respects reduced motion and lowers the 3D quality on weaker devices
- Server tests with Jest and Supertest, browser tests with Playwright, all run by GitHub Actions

## Tech Stack

- **Frontend:** React 18, Vite, React Router, arwes, three.js (react-three-fiber)
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB
- **Tests:** Jest, Supertest, Playwright
- **CI/CD:** GitHub Actions, Docker Hub

## Project Structure

```
Nasa/
├── client/    # React frontend
├── server/    # Express + TypeScript backend
└── .github/workflows/   # CI workflow
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- MongoDB running locally or a connection string

### Installation

```bash
git clone https://github.com/y0emad/Nasa.git
cd Nasa
npm install --prefix client
npm install --prefix server
```

### Environment variables

Create `server/.env`:

```
MONGO_URI=mongodb://localhost:27017/nasa
GET_LAUNCHES_API=https://ll.thespacedevs.com/2.3.0/launches
```

| Variable | Required | What it does |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string |
| `GET_LAUNCHES_API` | no | Where to import past launches from on the first start. Skipped when empty |
| `CSV_DIR` | no | Path to the Kepler CSV. Defaults to `src/data/kepler_data_cleaned.csv` |
| `NASA_API_KEY` | no | Key for api.nasa.gov, used for the picture of the day. Falls back to `DEMO_KEY` |
| `CORS_API_ORIGIN` | no | Only needed when the client runs on another origin |
| `PORT` | no | Defaults to `8000` |

`.env` is git-ignored and must never be committed.

### Run

```bash
# backend
npm run dev --prefix server

# frontend
npm run dev --prefix client
```

Open http://localhost:3000. The Vite dev server forwards API calls to the server on port 8000.

## Solar System

`/solar-system` renders the Sun and the planets with three.js. Planet data comes from the NASA Planetary Fact Sheet
and is served by `GET /solar-system/bodies` (and `GET /solar-system/bodies/:id`). Planet positions start from their
mean longitude for today's date. Planet images are from [Solar System Scope](https://www.solarsystemscope.com/textures/)
(CC BY 4.0), resized to keep the page light. The 3D code is lazy-loaded, so the other pages do not download it.

## Exoplanets

`/exoplanets` shows the confirmed Kepler planets that get between 36% and 111% of the starlight Earth gets.
`GET /exoplanets/all` reads them from the Kepler CSV and adds what the 3D view needs: the brightness of the star,
worked out from its size and temperature, the size of the orbit, worked out from that brightness and the starlight
the planet gets, and the colour and class of the star. The green ring in the scene is the same 36%–111% band, so
you can see where each planet sits inside it. The planet surfaces are drawings picked from the temperature and size.

After a launch, **Fly to** opens the planet you sent the mission to, and **Schedule a mission here** goes the
other way and fills in the launch form.

## Picture of the day

`GET /space-today` returns NASA's Astronomy Picture of the Day. When that API is down, it returns the latest
picture of the whole Earth from NASA's EPIC camera on the DSCOVR spacecraft instead. The answer is cached for an
hour, and if both sources fail the last good picture is served. The launch page hides the section if there is
nothing to show.

## Launch sequence

Scheduling a mission plays a 3D launch: countdown, tower arm retract, ignition, liftoff, max Q, stage separation
and second stage burn. The request to the server runs during the countdown. If it is still pending the count holds
at T-2, and if the server rejects the launch it is scrubbed before ignition and shows the reason.

**Watch** on the Upcoming page plays the same launch again for a mission that is already scheduled, without
sending anything to the server.

## Performance and accessibility

- With `prefers-reduced-motion`, the launch has no camera shake or vibration, the 3D views skip their fly-in,
  and the CSS transitions are turned off.
- On phones and devices with 4 CPU cores or less, the 3D scenes use fewer particles and stars and a lower pixel ratio.
- The server gzips its responses, the hashed files in `/assets` are cached for a year, and `index.html` is never cached.
- The background is WebP (778 KB → 38 KB for the large one), the font CSS does not block the first paint, and the
  app waits up to 1.2 s for the fonts before its first render, so the text does not jump.
- The launch code is only prefetched when the browser is idle.

Lighthouse 12 on the production build (Edge, simulated throttling):

| Page | Device | Performance (before → after) | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- | --- |
| /launch | Desktop | 82 → 89 | 100 | 100 | 100 |
| /launch | Mobile | 57 → 62 | 100 | 100 | 100 |
| /exoplanets | Desktop | 56 | 100 | 100 | 100 |
| /exoplanets | Mobile | 34 | 100 | 100 | 100 |
| /solar-system | Desktop | 34 → 56 | 100 | 100 | 100 |
| /solar-system | Mobile | 28 → 33 | 100 | 100 | 100 |

Layout shift went from 0.47 to 0.01 on the solar system page and from 0.12 to 0.01 on the launch page.

Lighthouse runs these pages without a GPU, so WebGL is drawn in software and counts as blocking time. On the
3D pages the performance score is lower than what a phone or laptop with a GPU gets.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev --prefix server` | Start the server with nodemon |
| `npm run build --prefix server` | Compile the server to `server/dist` |
| `npm start --prefix server` | Run the compiled server |
| `npm run dev --prefix client` | Start the Vite dev server on port 3000 |
| `npm run build --prefix client` | Build the frontend into `server/public` |
| `npm test --prefix server` | Run the server tests (needs a MongoDB, `MONGO_URI`) |
| `npm run test:e2e --prefix client` | Build the client and run the Playwright tests against it |

## CI/CD

Every pull request typechecks and builds both apps, runs the server tests against MongoDB on Node 20 and 22,
runs the Playwright tests in Chromium, and builds the Docker image.

The Playwright tests mock the API, so they need no database. They cover a launch that reaches orbit, a launch
that holds while the server is slow, a launch the server rejects, the exoplanet explorer, the countdown and replay
on the Upcoming page, the picture of the day, reduced motion, and the tab bar on a phone. On every merge to `main` the image is also pushed to Docker Hub
(`yousefemad/nasa`), and the server picks it up within two minutes
([deploy/update.sh](deploy/update.sh)).

The image is multi-stage: it ships only the compiled server, production dependencies, the React build
and the Kepler CSV.
