import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../util/constants.js';
import { loadCategoryDefaults } from '../util/helpers';
import request from 'request';
import {Player} from './Player';
import * as _ from "lodash";


export class Battle { // A room
    constructor(id, access_token, refresh_token) {
        this.id = id;
        this.players = [];

        this.spotifyAccessToken = access_token;
        this.spotifyRefreshToken = refresh_token;
        this.host = undefined; // id of host player


        this.getId.bind(this);
        this.checkToken.bind(this);
        this.refreshToken.bind(this);

        this.phase = "start";
        this.categories = loadCategoryDefaults();
        this.currentCategoryIndex = 0;

        this.roundNum = 1;

        const refresh = () => this.refreshToken();
        this.checkToken(refresh);
    }

    checkToken(refresh, ms_time=1200000){
        this.intervalClock = setInterval( function() {
            refresh()
        }, ms_time);
    };

    refreshToken(){
        const refresh_token = this.spotifyRefreshToken;
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            headers: { 'Authorization': 'Basic ' + (new Buffer(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')) },
            form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
            },
            json: true
        };

        const checkToken = (a, b) => this.checkToken(a, b);
        const refresh = () => this.refreshToken();

        request.post(authOptions, function(error, response, body) {
            if (!error && response.statusCode === 200) {
                // console.log(body);
                this.spotifyAccessToken = body.access_token;
                //Need to send new access token to game monitor

                // this.emitter.refreshToken({gameCode: this.id}, this.spotifyAccessToken);
                // clearInterval(this.intervalClock);
                // checkToken(refresh, body.expires_in);
            }
        });
    }
    
    getId(){
        return this.id;
    }
    getPlayers(){
        return this.players;
    }
    getToken(){
        return this.spotifyToken;
    }
    getHost(){
        return this.host;
    }

    getRoundWinner(){
        this.players.sort( function(player1, player2) {
            if(player1.roundScore > player2.roundScore) {
                return -1;
            } else if (player1.roundScore < player2.roundScore) {
                return 1;
            } else {
                return 0;
            }
        });

        return this.players[0];
    }
    getGameWinner(){
        this.players.sort( function(player1, player2) {
            if(player1.gameScore > player2.gameScore) {
                return -1;
            } else if (player1.gameScore < player2.gameScore) {
                return 1;
            } else {
                return 0;
            }
        });

        return this.players[0];
    }
    getPhase(){
        return this.phase;
    }

    setHost(host){
        this.host = host;
        const player = this.getPlayerById(host);
        player.setType("host");
    }

    setKeeper(keeper) {
        const player = this.getPlayerById(keeper.id)
        player.setType("battler");
    }

    addPlayer(id, username){
        const player = new Player(username, id);
        this.players.push(player);
    }

    setPhase(newPhase){
        this.phase = newPhase;
    }

    setMonitor(monitor){
        this.monitor = monitor;
    }
    getMonitor(){
        return this.monitor;
    }

    getPlayersByType(type){
        return this.players.filter(player => player.type === type);
    }

    getPlayerById(id){
        return this.players.find(player => player.id === id);
    }

    getCategory(){
        return this.categories[this.currentCategoryIndex];
    }

    nextCategory(){
        if(this.currentCategoryIndex + 1 === this.categories.length) return undefined;
        this.currentCategoryIndex += 1;
        return this.getCategory();
    }

    getCategories(){
        return this.categories;
    }

    startGame(){
        this.currentPlayer = this.getPlayersByType("battler");
    }

    setActivePlayer(id){ // Player whose song is about to play
        this.activePlayer = this.getPlayerById(id);
    }
    getActivePlayer(){
        const player = this.activePlayer;
        return player;
    }

    getRoundNum(){
        return this.roundNum;
    }

    nextRound(){
        this.players.forEach(player => player.newRound());
        const nextCat = this.nextCategory();
        this.roundNum += 1;

        if (nextCat) {
            this.emitter.wait({gameCode: this.id}, 
                {
                    albumArt: undefined,
                    artist: undefined,
                    category: undefined,
                    currentBattler: undefined,
                    currentTrack: undefined,
                    trackTitle: undefined,
                    trackURI: undefined,
                    winner: undefined,
                    voting: true,
                    preview: undefined
                }
            );
            setTimeout(() => this.emitter.trackSelect({gameCode: this.id}), 5000);

        } else {
            this.emitter.gameOver({gameCode: this.id});
        }
    }

    setCategories(categories){
        this.categories = categories;
    }

    setEmitter(emitter){
        this.emitter = emitter;
    }

    checkPlayerTrackEntries(){
        const battlers = this.getPlayersByType("battler");
        const ready = !battlers.find(battler => !battler.getSelectedTrack());
        if (ready) {
            this.emitter.wait({gameCode: this.id}, {trackURI: undefined, currentTrack: undefined})
            setTimeout(() => this.emitter.roundPlay({gameCode: this.id}), 5000);
        }
    }

    isVotingFinished(){
        const battlers = this.getPlayersByType("battler");
        let totalScore = 0;
        battlers.forEach(battler => totalScore += battler.roundScore);
        const roundOver = (totalScore/5) === this.getPlayers().length - battlers.length;

        if (roundOver) {
            this.emitter.roundOver({gameCode: this.id});
        }
    }
}