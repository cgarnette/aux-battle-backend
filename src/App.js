import { 
    APPLICATION_PORT, 
    SPOTIFY_CLIENT_ID, 
    SPOTIFY_CLIENT_SECRET, 
    SPOTIFY_REDIRECT_URL, 
    AUX_BATTLE_CLIENT_URL, 
    PHASE,
    GAME_TYPE
} from './util/constants.js';

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
        res.status(200).json({ roomCode: newRoomId });
    } else {
        res.status(500).json({error: "Tokens were not supplied"});
    }
});

app.get('/start/freeforall', (req, res) => {
    const access = req.query.access_token;
    const refresh = req.query.refresh_token;

    if (access && refresh) {
        const newRoomId = currentGame.initializeFreeRoom(access, refresh);
        console.log("successfully created free for all game");
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
    const redirect_uri = req.query.redirectURI ? AUX_BATTLE_CLIENT_URL + req.query.redirectURI : SPOTIFY_REDIRECT_URL;


    const newLocation = 'https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + SPOTIFY_CLIENT_ID +
    (scope ? '&scope=' + encodeURIComponent(scope) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri);

    res.setHeader('Access-Control-Allow-Origin', '*');

    res.redirect('https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + SPOTIFY_CLIENT_ID +
    (scope ? '&scope=' + encodeURIComponent(scope) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri));
});

app.get('/callback', (req, res) => {
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

  app.post('/battle/set_player_track', (req, res) => {
    const { roomCode, track, playerId } = req.body;
    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    playerStore.setSelectedTrack(playerId, track);

    // if (room.type !== GAME_TYPE.GAME_TYPE_FREE_FOR_ALL) {
    //   room.checkPlayerTrackEntries();  
    // }

    room.checkPlayerTrackEntries();  
    
    res.status(200).json({success: "submission successful"});
  });

  app.get('/battle/djs', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    const djs = playerStore.getDJs().map(dj => {
        const albumArt = dj.selectedTrack.album.images.length > 0 ? dj.selectedTrack.album.images[1 || 0].url : "";
        return {
            id: dj.id,
            username: dj.username,
            trackTitle: dj.selectedTrack.name,
            albumArt
        };
    });
    res.status(200).json({ djs: djs });
  });

  app.get('/vote', (req, res) => {
    const roomCode = req.query.roomCode;
    const djId = req.query.djId;

    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    const player = playerStore.getPlayerById(djId);

    player.roundScore += 5;

    room.isVotingFinished();

    console.log("vote has been cast!");
    res.status(200).json({success: "vote successful"});
  });

  app.get('/category/submit', (req, res) => {
      const roomCode = req.query.roomCode;
      const category = req.query.category;

      const room = currentGame.getRoomById(roomCode);

      const trimmedCat = category.trim();

      if (trimmedCat.length > 0) {
          // add it to the submitted categories array for the free for all
          room.addSubmittedCategory(trimmedCat);
      } else {
          res.status(200).json({ error: 'empty category' });
      }
  });

  app.get('/change', (req, res) => {
      const roomCode = req.query.roomCode;
      const phase = req.query.phase;

      const room = currentGame.getRoomById(roomCode);

      if (phase === PHASE.CATEGORY_SUBMISSIONS_PHASE) {
          room.categorySubmissionComplete();
      }
  });

  app.get('/freeforall/trackselect', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.startTrackSelect();

    res.status(200).json({success: "track selection started"});
});

app.get('/start/roundplay', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.startRoundPlay();

    res.status(200).json({success: "round play phase started"});
});

app.get('/vote/close', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.closeVoting();

    res.status(200).json({success: "round play phase started"});
});

app.get('/join/close', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.triggerStartGame();

    res.status(200).json({success: "Game Flow Started"});
});

  app.post('/settings', (req, res) => {
    const {roomCode, settings} = req.body;

    const room = currentGame.getRoomById(roomCode);

    console.log('settings received');
    room.setSettings(settings);
    return res.status(200).json({success: "update successful"});

    // if (settings.categories) {
    //     room.setCategories(settings.categories);
    //     if (settings.playDuration) {
    //         room.setPlayDuration(settings.playDuration);
    //     }
    //     res.status(200).json({success: "update successful"})
    // }
  });

  app.post('/update/user', (req, res) => {
      const { roomCode, state } = req.body;

      const room = currentGame.getRoomById(roomCode);
      const playerStore = room.getPlayerStore();

      const player = playerStore.getAllPlayers().find(_player => _player.username === state.username);
      console.log('username', state.username);
      player.gameState = state;

      res.status(200).send('success');
  });

  //////// Party Room Mode ///////////////
  app.get('/start/party', (req, res) => {
    const access = req.query.access_token;
    const refresh = req.query.refresh_token;

    if (access && refresh) {
        const newRoomId = currentGame.initializePartyRoom(access, refresh);
        console.log("successfully created game");
        res.status(200).json({roomCode: newRoomId});
    } else {
        res.status(500).json({error: "Tokens were not supplied"});
    }
});

// app.post('/party/next', (req, res) => {
//     const { roomCode, id } = req.body;
//     const room = currentGame.getRoomById(roomCode);
    
//     if (room.getMonitor().id === id) {
//         console.log("theyre asking for tracks");
//         room.setHostWaiting();
//     }
    

    
// });

app.post('/party/add', (req, res) => {
    const { roomCode, track } = req.body;
    const room = currentGame.getRoomById(roomCode);

    try {
        room.addTrack(track);
        res.status(200).json({success: "track added successfully"});
    } catch (error) {
        res.status(500).json({error: "unable to add track"});
    }
});
/////////////////////////////////////////////

const server = app.listen(80, () => console.log(`Aux Battle Backend listening on port ${APPLICATION_PORT}`));
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

const communicationManager = new SocketManager(io, currentGame);