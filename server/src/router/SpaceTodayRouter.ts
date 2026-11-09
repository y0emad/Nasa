import axios from 'axios';
import { Router } from 'express';

const APOD_URL = 'https://api.nasa.gov/planetary/apod';
const EPIC_URL = 'https://epic.gsfc.nasa.gov';
const FRESH_MS = 60 * 60 * 1000;

export interface SpaceToday {
  source: 'apod' | 'epic';
  date: string;
  title: string;
  explanation: string;
  mediaType: 'image' | 'video' | 'other';
  url: string;
  hdUrl: string | null;
  thumbnailUrl: string | null;
  copyright: string | null;
  sourceUrl: string;
}

let cached: { picture: SpaceToday; fetchedAt: number } | null = null;

export const resetSpaceTodayCache = () => {
  cached = null;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const apodPage = (date: string) => {
  const match = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `https://apod.nasa.gov/apod/ap${match[1]}${match[2]}${match[3]}.html` : 'https://apod.nasa.gov/apod/';
};

export const fromApod = (data: Record<string, unknown>): SpaceToday => {
  const url = text(data.url);
  const title = text(data.title);
  if (!url || !title) throw new Error('APOD response is missing the title or the url');
  const date = text(data.date) ?? '';
  return {
    source: 'apod',
    date,
    title,
    explanation: text(data.explanation) ?? '',
    mediaType: data.media_type === 'image' || data.media_type === 'video' ? data.media_type : 'other',
    url,
    hdUrl: text(data.hdurl),
    thumbnailUrl: text(data.thumbnail_url),
    copyright: text(data.copyright)?.replace(/\s+/g, ' ') ?? null,
    sourceUrl: apodPage(date),
  };
};

interface EpicImage {
  image: string;
  date: string;
  centroid_coordinates?: { lat: number; lon: number };
  dscovr_j2000_position?: { x: number; y: number; z: number };
}

export const fromEpic = (images: EpicImage[]): SpaceToday => {
  const latest = Array.isArray(images) ? images[images.length - 1] : undefined;
  const match = latest && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(latest.date);
  if (!latest || !match || !/^[\w-]+$/.test(latest.image)) throw new Error('EPIC response has no usable image');
  const [, year, month, day, time] = match;
  const folder = `${EPIC_URL}/archive/natural/${year}/${month}/${day}`;
  const p = latest.dscovr_j2000_position;
  const distance = p ? Math.round(Math.hypot(p.x, p.y, p.z) / 1000) * 1000 : null;
  const centre = latest.centroid_coordinates;
  return {
    source: 'epic',
    date: `${year}-${month}-${day}`,
    title: 'The whole Earth, seen from deep space',
    explanation:
      `NASA's EPIC camera on the DSCOVR spacecraft took this picture at ${time} UTC` +
      (distance ? `, from about ${distance.toLocaleString('en-US')} km away, between the Earth and the Sun.` : '.') +
      (centre ? ` The middle of the picture is ${centre.lat.toFixed(1)}° latitude, ${centre.lon.toFixed(1)}° longitude.` : ''),
    mediaType: 'image',
    url: `${folder}/jpg/${latest.image}.jpg`,
    hdUrl: `${folder}/png/${latest.image}.png`,
    thumbnailUrl: `${folder}/thumbs/${latest.image}.jpg`,
    copyright: null,
    sourceUrl: EPIC_URL,
  };
};

const fetchApod = async () => {
  const response = await axios.get(APOD_URL, {
    params: { api_key: process.env.NASA_API_KEY || 'DEMO_KEY', thumbs: true },
    timeout: 6000,
  });
  return fromApod(response.data);
};

const fetchEpic = async () => {
  const response = await axios.get(`${EPIC_URL}/api/natural`, { timeout: 6000 });
  return fromEpic(response.data);
};

const fetchPicture = async () => {
  try {
    return await fetchApod();
  } catch (error) {
    console.error(`APOD request failed, trying EPIC: ${error instanceof Error ? error.message : error}`);
    return fetchEpic();
  }
};

const router = Router();

router.get('/', async (_req, res) => {
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
    res.set('Cache-Control', 'public, max-age=1800');
    return res.status(200).json(cached.picture);
  }
  try {
    const picture = await fetchPicture();
    cached = { picture, fetchedAt: Date.now() };
    res.set('Cache-Control', 'public, max-age=1800');
    res.status(200).json(picture);
  } catch (error) {
    console.error(`EPIC request failed: ${error instanceof Error ? error.message : error}`);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=300');
      return res.status(200).json(cached.picture);
    }
    res.status(502).json({ msg: 'The NASA picture of the day is not available right now' });
  }
});

export default router;
