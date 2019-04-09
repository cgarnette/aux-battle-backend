import dotenv from 'dotenv';

dotenv.config();

export const APPLICATION_PORT = process.env.APPLICATION_PORT;
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID; //'f1aea09e71b4447d8e120be81c492e78';
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET; //'0cdb63ec05984c4fa7bd79d3d81689e9';
// export const SPOTIFY_REDIRECT_URL = "http://localhost:3000/callback"
export const SPOTIFY_REDIRECT_URL = process.env.SPOTIFY_REDIRECT_URL; // "http://192.168.1.199:3000/callback"