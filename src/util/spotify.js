import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "./constants";
import SpotifyWebApi from 'spotify-web-api-node';


export const getSpotifyToken = () => {

    const scopes = ['user-read-private', 'user-read-email'];
    const spotifyApi = new SpotifyWebApi({
        clientId: 'fcecfc72172e4cd267473117a17cbd4d',
        clientSecret: 'a6338157c9bb5ac9c71924cb2940e1a7',
        redirectUri: 'http://localhost:3000/callback'
    });


    console.log(spotifyApi);
};