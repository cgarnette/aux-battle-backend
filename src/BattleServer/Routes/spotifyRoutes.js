import { 
    APPLICATION_PORT, 
    SPOTIFY_CLIENT_ID, 
    SPOTIFY_CLIENT_SECRET, 
    SPOTIFY_REDIRECT_URL, 
    AUX_BATTLE_CLIENT_URL, 
    PHASE,
    GAME_TYPE
} from '../../util/constants';
import currentGame from '../../App';

import request from 'request';
import express from 'express';
const app = express();

app.get('/spotify/search', async (req, res) => {
    const searchParam = req.query.searchParam;
    const roomCode = req.query.roomCode;
    const explicit = req.query.explicit;
    const token = currentGame.getRoomById(roomCode).spotifyAccessToken;

    let convertedSearch = searchParam;
    while(convertedSearch.split(" ").length > 1) {
        convertedSearch = convertedSearch.replace(" ", "%20");
    }

    const requestOptions = {
        url: `https://api.spotify.com/v1/search?q=${convertedSearch}&type=track`,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`
        }
    };
    
    request.get(requestOptions, (error, response, body) => {
        let tracks = body;
        if (explicit) {
            tracks = {
                tracks: {
                    items: body.tracks ? body.tracks.items.filter(track => track.explicit) : []
                } 
            }
        }
        res.status(200).send(tracks);
    });
});

app.get('/spotify/login', (req, res) => {
    const scope = 'user-read-private user-read-email streaming user-read-birthdate user-read-email user-read-private';
    const redirect_uri = req.query.redirectURI ? AUX_BATTLE_CLIENT_URL + req.query.redirectURI : SPOTIFY_REDIRECT_URL;

    res.setHeader('Access-Control-Allow-Origin', '*');

    res.redirect('https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + SPOTIFY_CLIENT_ID +
    (scope ? '&scope=' + encodeURIComponent(scope) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri));
});

app.get('/spotify/callback', (req, res) => {
    const redirect_uri = req.query.redirectURI ? `${AUX_BATTLE_CLIENT_URL}${req.query.redirectURI}` : SPOTIFY_REDIRECT_URL;
    // your application requests refresh and access tokens
    // after checking the state parameter
  
    const code = req.query.code || null;
  
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
        },
        json: true
    };
  
    request.post(authOptions, function(error, response, body) {
        console.log("error", error);
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token,
                refresh_token = body.refresh_token;

            res.status(200).json({access_token, refresh_token})
        } else {
            res.status(500).send({
                error: {
                    message: "Could Not Get Token",
                    error: error,
                }
            });
        }
    });
  });

  export default app;