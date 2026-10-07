# NASA Mission Control

![CI](https://github.com/y0emad/Nasa/actions/workflows/ci.yml/badge.svg)

A full-stack web app for planning and tracking space missions. Pick a habitable
exoplanet from NASA's Kepler data, schedule a launch, and view upcoming and past missions.

## Features

- Schedule mission launches to habitable exoplanets
- View upcoming launches and mission history, and abort scheduled launches
- Habitable planet data loaded from the NASA Kepler exoplanet dataset
- Automated install, build and tests with GitHub Actions

## Tech Stack

- **Frontend:** React
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
MONGO_URL=mongodb://localhost/nasa
```

`.env` is git-ignored and must never be committed.

### Run

```bash
# backend
npm run dev --prefix server

# frontend
npm start --prefix client
```

Open the URL printed in the terminal (the React dev server usually runs on `http://localhost:3000`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev --prefix server` | Start the server with nodemon |
| `npm start --prefix server` | Start the server |
| `npm start --prefix client` | Start the React dev server |
| `npm run build --prefix client` | Build the frontend |
| `npm test --prefix server` | Run server tests |

## Continuous Integration

Every push and pull request to `main` runs install, build and tests on Node 20 and 22.
