# NASA Mission Control

A full-stack web app for planning and tracking space missions. Pick a habitable
exoplanet from NASA's Kepler data, schedule a launch, and view upcoming and past missions.

## Features

- Schedule mission launches to habitable exoplanets
- View upcoming launches and mission history, and abort scheduled launches
- Explore a 3D solar system: the Sun and 8 planets in their positions for today, with speed controls and a facts panel for each planet
- Habitable planet data loaded from the NASA Kepler exoplanet dataset
- Automated install, build and tests with GitHub Actions

## Tech Stack

- **Frontend:** React 18, Vite, React Router, arwes, three.js (react-three-fiber)
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB
- **CI:** GitHub Actions

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
mean longitude for today's date, and the planet textures are generated procedurally in a Web Worker so the page
never freezes while they load. The 3D code is lazy-loaded, so the other pages do not download it.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev --prefix server` | Start the server with nodemon |
| `npm run build --prefix server` | Compile the server to `server/dist` |
| `npm start --prefix server` | Run the compiled server |
| `npm run dev --prefix client` | Start the Vite dev server on port 3000 |
| `npm run build --prefix client` | Build the frontend into `server/public` |
| `npm test --prefix server` | Run the server tests (needs a MongoDB, `MONGO_URI`) |

## CI/CD

Every pull request typechecks and builds both apps, runs the tests against MongoDB on Node 20 and 22,
and builds the Docker image. On every merge to `main` the image is also pushed to Docker Hub
(`yousefemad/nasa`), and the server picks it up within two minutes
([deploy/update.sh](deploy/update.sh)).

The image is multi-stage: it ships only the compiled server, production dependencies, the React build
and the Kepler CSV.
