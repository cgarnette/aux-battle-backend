import Battle from './battle.old';
import { GAME_TYPE, PHASE } from '../../util/constants';
import { randomNumGen } from '../../util/helpers';

export default class Free extends Battle {
    constructor(id, access_token, refresh_token, emitter) {
        super (id, access_token, refresh_token, emitter);

        this.type = GAME_TYPE.GAME_TYPE_FREE_FOR_ALL;
        this.submittedCategories = [];
        this.category = '';
        this.newRound = true;
    }


    addSubmittedCategory(category){
        console.log('adding category');
        if (this.type === GAME_TYPE.GAME_TYPE_FREE_FOR_ALL && this.phase === PHASE.CATEGORY_SUBMISSIONS_PHASE) {
           this.submittedCategories.push(category); 
           console.log('category added');
        }
        
    }

    getCategory(){

        if (this.newRound) {
            this.nextCategory();
            this.newRound = false;
        }
        
        return this.category;
    }

    nextCategory(){
        let index = 0;
        if (this.submittedCategories.length < 1) {
            index = randomNumGen(this.categories.length);
            this.category = this.categories[index];
        } else {
            const index = randomNumGen(this.submittedCategories.length);
            this.category = this.submittedCategories[index];
            this.submittedCategories = [];
        }
    }

    startRoundPlay(){
        this.emitter.wait({gameCode: this.id}, {trackURI: undefined, currentTrack: undefined})
        setTimeout(() => this.emitter.roundPlay({gameCode: this.id}), 5000);
    }

    nextRound(){

        if (this.activePlayers.length > 0) {
            this.roundNum += 1;
            this.activePlayers.forEach(player => player.newRound());
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
            setTimeout(() => this.emitter.categorySubmit({gameCode: this.id}), 5000);

        } else {
            this.emitter.gameOver({gameCode: this.id});
        } 
        
        this.newRound = true;
    }

    closeVoting(){
        this.emitter.wait({gameCode: this.id});
        setTimeout(() => this.emitter.roundOver({ gameCode: this.id }), 5000);
    }
}