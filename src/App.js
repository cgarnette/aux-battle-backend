import { 
    APPLICATION_PORT, 
} from './util/constants.js';

import Socket from 'socket.io';
import express from 'express';
import cors from 'cors';
import { Game } from './BattleServer/game';
import { SocketManager } from './BattleServer/socketManager';
import bodyParser from 'body-parser';
const path = require('path');

import spotifyRoutes from './BattleServer/Routes/spotifyRoutes';
import battleRoutes from './BattleServer/Routes/battleRoutes';

const currentGame = new Game();
const app = express();
app.use(cors())
app.use( bodyParser.json() ); 
app.use(express.json());  
app.use(spotifyRoutes);
app.use(battleRoutes);


app.get('/', (req, res) => {
    res.status(200).send("Ready to Connect")
});

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

export default currentGame;