import { loadCategoryDefaults } from '../../util/helpers';
import {Player} from '../Player';
import * as _ from "lodash";
import Room from '.';

import { GAME_TYPE, PHASE, roundDefaults } from '../../util/constants';


class Battle extends Room { // A room
    constructor(id, access_token, refresh_token, emitter) {
        super (id, access_token, refresh_token, emitter);

        this.players = [];
        this.activePlayers = [];
        this.host = undefined; // id of host player
        this.phase = 'join';

        this.getId.bind(this);

        this.categories = loadCategoryDefaults();
        this.currentCategoryIndex = 0;
        this.type = GAME_TYPE.GAME_TYPE_BATTLE;

        this.roundNum = 1;
        this.playDuration = .2;

        this.submittedCategories = [];
    }
    
    getId(){
        return this.id;
    }
    getPlayers(){
        return this.players;
    }

    getActivePlayers() {
        return this.activePlayers;
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
        const player = this.getPlayerByUsername(host);
        this.host = player;
        console.log('found host', player);
        player.setType("host");
    }

    setKeeper(keeper) {
        const player = this.getPlayerById(keeper.id);
        player.gameState['auxKeeper'] = true;
        player.gameState['keeper'] = true;
        player.setType("battler");
    }

    addPlayer(id, username){
        const player = new Player(username, id);
        const existingPlayer = this.players.find(_player => _player.username.toLowerCase() === username.toLowerCase());

        if (!existingPlayer) {
            console.log('new', player);
            this.players.push(player);
            this.activePlayers.push(player);
        } else {
            console.log('existing', existingPlayer);
            existingPlayer.setId(id);
            this.activePlayers.push(existingPlayer);
        }
    }

    removePlayer(username) {
        this.activePlayers = this.activePlayers.filter(player => player.getUsername().toLowerCase() !== username.toLowerCase());
    }

    addToActive(player) {
        this.activePlayers.push(player);
    }

    setPhase(newPhase){
        this.phase = newPhase;
    }

    getPlayersByType(type){
        return this.activePlayers.filter(player => player.type === type);
    }

    getAllPlayersByType(type){
        return this.players.filter(player => player.type === type);
    }

    getPlayerById(id){
        return this.players.find(player => player.id === id);
    }

    getPlayerByUsername(username){
        return this.activePlayers.find(player => player.getUsername().toLowerCase() === username.toLowerCase());
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
        this.activePlayers.forEach(player => player.newRound());
        const nextCat = this.nextCategory();
        this.roundNum += 1;

        if (nextCat) {
            this.emitter.wait({ gameCode: this.id }, roundDefaults);
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
        const roundOver = (totalScore/5) === this.activePlayers.length - battlers.length;

        if (roundOver) {
            this.emitter.wait({ gameCode: this.id })
            setTimeout(() => this.emitter.roundOver({ gameCode: this.id }), 5000);
        }
    }

    setPlayDuration(playDuration) {
        this.playDuration = playDuration;
    }

    getPlayDuration() {
        return this.playDuration;
    }

    startTrackSelect(){
        if (this.activePlayers.length === 0) return;
        this.phase = PHASE.TRACK_SELECTION_PHASE;
        this.emitter.wait({gameCode: this.id});
        setTimeout(() => this.emitter.trackSelect({gameCode: this.id}), 5000);
    }

    triggerStartGame(){
        this.emitter.startGame({ gameCode: this.id });
    }
}


export default Battle;