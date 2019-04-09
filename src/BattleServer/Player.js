import * as _ from 'lodash';
export class Player {
    constructor(username, id){
        this.roundScore = 0;
        this.gameScore = 0;
        this.type = "judge";
        this.id = id;
        this.username = username;
    }

    newRound(){
        this.gameScore += this.roundScore;
        this.roundScore = 0;
        this.previousTrack = _.cloneDeep(this.selectedTrack);
        this.selectedTrack = undefined;
    }

    getGameScore(){
        return this.gameScore;
    }
    getRoundScore(){
        return this.roundScore;
    }

    getUsername(){
        return this.username;
    }
    getId(){
        return this.id;
    }

    setType(type){
        this.type = type;
    }

    setSelectedTrack(track){
        this.selectedTrack = track;
    }

    getSelectedTrack(){
        return this.selectedTrack;
    }

    addRoundPoint(){
        this.roundScore += 1;
    }
}