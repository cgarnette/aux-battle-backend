import { loadCategoryDefaults } from '../../util/helpers';
import {Player} from '../Player';
import * as _ from "lodash";
import Room from './';

import { GAME_TYPE, PHASE } from '../../util/constants';


class Battle extends Room { // A room
    constructor(id, access_token, refresh_token, emitter) {
        super (id, access_token, refresh_token, emitter);

        this.players = [];
        this.host = undefined; // id of host player

        this.getId.bind(this);

        this.categories = loadCategoryDefaults();
        this.currentCategoryIndex = 0;
        this.type = GAME_TYPE.GAME_TYPE_BATTLE;

        this.roundNum = 1;
        this.playDuration = 1;

        this.submittedCategories = [];
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

    setPlayDuration(playDuration) {
        this.playDuration = playDuration;
    }

    getPlayDuration(playDuration) {
        return this.playDuration;
    }

    addSubmittedCategory(category){
        if (this.type === GAME_TYPE.GAME_TYPE_FREE_FOR_ALL && this.phase === PHASE.CATEGORY_SUBMISSIONS_PHASE) {
           this.submittedCategories.push(category); 
        }
        
    }
}


export default Battle;