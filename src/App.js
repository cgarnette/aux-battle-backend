import { APPLICATION_PORT, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URL } from './util/constants.js';
import Socket from 'socket.io';
import express from 'express';
import cors from 'cors';
import request from 'request';
import {Game} from './BattleServer/game';
import {SocketManager} from './BattleServer/socketManager';
import SpotifyWebApi from 'spotify-web-api-node';
import bodyParser from 'body-parser';
import axios from 'axios';
const path = require('path');

const currentGame = new Game();
const app = express();
app.use(cors())
app.use( bodyParser.json() ); 
app.use(express.json());  

app.get('/start', (req, res) => {
    const access = req.query.access_token;
    const refresh = req.query.refresh_token;

    if (access && refresh) {
        const newRoomId = currentGame.initializeBattleRoom(access, refresh);
        console.log("successfully created game");
        res.status(200).json({roomCode: newRoomId});
    } else {
        res.status(500).json({error: "Tokens were not supplied"});
    }
});

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

app.get('/spotify_login', (req, res) => {
    const scope = 'user-read-private user-read-email streaming user-read-birthdate user-read-email user-read-private';
    const redirect_uri = SPOTIFY_REDIRECT_URL


    const newLocation = 'https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + SPOTIFY_CLIENT_ID +
    (scope ? '&scope=' + encodeURIComponent(scope) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri);
    console.log(newLocation)
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.redirect('https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + SPOTIFY_CLIENT_ID +
    (scope ? '&scope=' + encodeURIComponent(scope) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri));
});

app.get('/callback', (req, res) => {
    const redirect_uri = SPOTIFY_REDIRECT_URL
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

  app.post('/battle/set_player_track', (req, res) => {
    const {roomCode, track, playerId} = req.body;
    const room = currentGame.getRoomById(roomCode);
    const player = room.getPlayerById(playerId);

    player.setSelectedTrack(track);

    room.checkPlayerTrackEntries();

    res.status(200).json({success: "submission successful"});
  });

  app.get('/battle/aux_keepers', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    const auxKeepers = room.getPlayersByType("battler").map(keeper => {
        const albumArt = keeper.selectedTrack.album.images.length > 0 ? keeper.selectedTrack.album.images[1 || 0].url : "";
        return {
            id: keeper.id,
            username: keeper.username,
            trackTitle: keeper.selectedTrack.name,
            albumArt
        };
    });

    res.status(200).json({keepers: auxKeepers});
  });

  app.get('/vote', (req, res) => {
    const roomCode = req.query.roomCode;
    const keeperId = req.query.keeperId;

    const room = currentGame.getRoomById(roomCode);

    const player = room.getPlayerById(keeperId);

    player.roundScore += 5;

    room.isVotingFinished();

    res.status(200).json({success: "vote successful"});
  });

  app.post('/settings', (req, res) => {
    const {roomCode, settings} = req.body;

    const room = currentGame.getRoomById(roomCode);

    if (settings.categories) {
        room.setCategories(settings.categories);
        res.status(200).json({success: "update successful"})
    }
  })


const server = app.listen(APPLICATION_PORT, () => console.log(`Aux Battle Backend listening on port ${APPLICATION_PORT}`));
const io = new Socket(server, {
    handlePreflightRequest: (req, res) => {
        const headers = {
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Origin": 'https://www.theauxbattle.com',//or the specific origin you want to give access to,
            "Access-Control-Allow-Credentials": true
        };
        res.writeHead(200, headers);
        res.end();
    }
});

// io.origins((origin, callback) => {
//     if (origin !== 'https://www.theauxbattle.com') {
//         console.log("origin", origin);
//         return callback('origin not allowed', false);
//     }
//     callback(null, true);
//   });

const communicationManager = new SocketManager(io, currentGame);