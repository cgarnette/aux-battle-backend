import { loadCategoryDefaults, randomNumGen } from '../../util/helpers';
import {Player} from '../Player';
import * as _ from "lodash";
import Room from '.';

import { GAME_TYPE, PHASE, roundDefaults } from '../../util/constants';
import PlayerStore from '../PlayerStore';


/**
 * Esentially Battle Room 2.0
 * 
 * This should borrow from both battle and free for all game types. Ultimately, it will replace both.
 * 
 * Initiation should remain as-is
 * 
 * It should start off with default settings. There should be an option to take in settings (coming from host)
 * and have it override the settings of the room.
 * 
 * These settings should dictate how the room behaves.
 * 
 * For anything that is timed, it should let the monitor know, and once the monitor reaches the phase,
 * it starts the timer and once time is up, it alerts the room, which then alerts players.
 * 
 * The monitor should be the source of truth for all timed events, not the room.
 * 
 * 
 */
class Battle extends Room { // A room
    constructor(id, access_token, refresh_token, emitter) {
        super (id, access_token, refresh_token, emitter);

        this.playerStore = new PlayerStore('local');
        this.type = 'battle'

        this.phase = 'join';
        this.activeDJ = undefined;

        this.getId.bind(this);

        this.currentCategoryIndex = 0;

        const defaultCategories = loadCategoryDefaults();

        this.category = defaultCategories[this.currentCategoryIndex];
        
        this.roundNum = 1;
        this.submittedCategories = [];

        this.settings = {
            playDuration: .2,
            compNum: 2, //number of competitors
            timeToSelect: 60, 
            timeToVote: 15, 
            timeToSubmitCat: 30,
            numRounds: 3, 
            timedSelection: true, 
            timedVoting: true,
            timedCats: true,
            categorySelector: 'host', // either host or judges
            categories: defaultCategories
        };

    }

    getPlayerStore() {
        return this.playerStore;
    }

    setSettings(settings){
        console.log('setting game settings', settings);
        this.settings = settings;
        this.category = settings.categories[0];
        this.emitter.emitEvent(this.id, 'settings update', settings);
    }
    
    getId(){
        return this.id;
    }

    getToken(){
        return this.spotifyToken;
    }

    getRoundWinner(){

        const players = this.playerStore.getDJs();
        // getAllPlayers();

        players.sort( function(player1, player2) {
            if(player1.roundScore > player2.roundScore) {
                return -1;
            } else if (player1.roundScore < player2.roundScore) {
                return 1;
            } else {
                return 0;
            }
        });

        return players[0];
    }
    getGameWinner(){

        const players = this.playerStore.getAllPlayers();

        players.sort( function(player1, player2) {
            if(player1.gameScore > player2.gameScore) {
                return -1;
            } else if (player1.gameScore < player2.gameScore) {
                return 1;
            } else {
                return 0;
            }
        });

        return players[0];
    }
    getPhase(){
        return this.phase;
    }

    setPhase(newPhase){
        this.phase = newPhase;
    }

    setActiveDJ(id){ // Player whose song is about to play
        this.activeDJ = this.playerStore.getPlayerById(id);
    }
    getActiveDJ(){
        const player = this.activeDJ;
        return player;
    }

    getCategories(){
        return this.settings.categories;
    }

    getCategory(){
        return this.category;
    }

    getRoundNum(){
        return this.roundNum;
    }

    setEmitter(emitter){
        this.emitter = emitter;
    }

    checkPlayerTrackEntries(){
        const djs = this.playerStore.getDJs();
        const ready = !djs.find(dj => !dj.selectedTrack);
        if (ready) {
            this.emitter.wait({ gameCode: this.id }, { trackURI: undefined, currentTrack: undefined })
            setTimeout(() => this.emitter.roundPlay({ gameCode: this.id }), 5000);
        }
    }

    closeVoting() {
        this.roundOver = true;
        this.isVotingFinished();
    }

    isVotingFinished(){
        const djs = this.playerStore.getDJs();
        let totalScore = 0;
        djs.forEach(dj => totalScore += dj.roundScore);

        if (!this.roundOver) {
            this.roundOver = totalScore === this.playerStore.activePlayers - djs.length;
        }

        if (this.roundOver) {
            this.emitter.wait({ gameCode: this.id })
            setTimeout(() => this.emitter.roundOver({ gameCode: this.id }), 5000);
            this.roundOver = false;
        }
    }

    getPlayDuration() {
        return this.settings.playDuration;
    }

    startTrackSelect(){
        this.phase = PHASE.TRACK_SELECTION_PHASE;
        this.emitter.wait({ gameCode: this.id });
        setTimeout(() => this.emitter.trackSelect({ gameCode: this.id }), 5000);
    }

    triggerStartGame(){
        this.emitter.startGame({ gameCode: this.id });
    }

    nextCategory(){
        if (this.settings.categorySelector === 'judges') {
            if (this.submittedCategories.length < 1) {
                const defaults = loadCategoryDefaults()
                const index = randomNumGen(defaults.length);
                this.category = defaults[index];
            } else {
                const index = randomNumGen(this.submittedCategories.length);
                this.category = this.submittedCategories[index];
                this.submittedCategories = [];
            }
        } else if (this.settings.categorySelector === 'host') {
            if(this.currentCategoryIndex + 1 === this.settings.categories.length) {
                console.log("Category undefined", this.currentCategoryIndex);
                console.log("categories", this.settings.categories)
                this.category = undefined;
            } else {
                this.currentCategoryIndex += 1;
                this.category = this.settings.categories[this.currentCategoryIndex];
            }  
        } 
    }


    nextRound() {
        this.roundNum += 1;
        this.playerStore.newRound();
        this.nextCategory();
        
        this.emitter.wait({ gameCode: this.id }, roundDefaults);
        
        if (this.settings.categorySelector === 'judges') {
            if (this.settings.roundNum < this.roundNum) {
                return setTimeout(() => this.emitter.categorySubmit({ gameCode: this.id} ), 5000);
            }
        } else if (this.settings.categorySelector === 'host') {
            if (this.getCategory()) {
                return setTimeout(() => this.emitter.trackSelect({ gameCode: this.id }), 5000);
            }
        }

        this.emitter.gameOver({ gameCode: this.id });

    }
}


export default Battle;