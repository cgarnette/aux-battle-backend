
import _ from 'lodash';

class PlayerStore {

    constructor(type='local') {
        //type is either local or couchdb. Indicating where the storage is located
        this.type = type;
        this.players = [];
        this.activePlayers = 0;
    }

    updatePlayer(player) {
        if (this.type === 'local') {
            this.players = this.players.map(player_ => {
                if (player_.username === player.username) {
                    return player;
                }
                return player_;
            });
        }

    }

    /**
     * 
     * @param {*} player contains a username and id (id corresponds to socket.io client id)
     * 
     * check if they already exist. If so, take the new id and old settings to construct player. replace existing player. Send back settings to player
     * else take all the new settings, set any defaults necessary. Send back new settings to new player
     */
    addPlayer(player, newPlayersAllowed=false) {
        if (this.type === 'local') {
            if (newPlayersAllowed) {
                const newPlayer = {
                    roundScore: 0,
                    gameScore: 0,
                    type: "judge",
                    host: false,
                    id: player.id,
                    username: player.username,
                    gameState: {},
                    selectedTrack: undefined,
                    previousTrack: undefined
                };
                this.activePlayers ++;
                this.players.push(newPlayer);
                return true
            } else {
                const oldPlayer = this.getPlayerByUsername(player.username);
                if (oldPlayer) {
                    const rejoiningPlayer = { 
                        roundScore: oldPlayer.roundScore,
                        gameScore: oldPlayer.gameScore,
                        type: oldPlayer.type,
                        host: oldPlayer.host,
                        id: player.id,
                        username: player.username,
                        gameState: oldPlayer.gameState,
                        selectedTrack: oldPlayer.selectedTrack,
                        previousTrack: oldPlayer.previousTrack
                    };

                    this.players.push(rejoiningPlayer); 
                    this.activePlayers ++;
                    return true;
                } else {
                    return false;
                }
            }   
        }     
    }

    removePlayer(playerId) {
        if (this.type === 'local') {
            const host = this.getHost();

            if (playerId === host.id) {
                // Need to assign a new host
            } 

            this.players = this.players.filter(player_ => player_.id !== playerId);
        }
    }

    getPlayerByUsername(username) {
        if (this.type === 'local') {
            return this.players.find(player_ => player_.username.toLowerCase() === username.toLowerCase());
        }
        
    }

    getPlayerById(playerId) {
        if (this.type === 'local') {
            return this.players.find(player_ => player_.id === playerId);
        } 
    }

    /**
     * 
     * @param {*} playerId id of player that disconnected
     * Monitor starts a timer. Timer stops when either player has reconnected or when it expires. On expiration, player is removed from game entirely
     */
    playerOnHold(playerId, timer=false) {
        this.activePlayers --;

        if (timer) {
            // start timer to remove given player
        }
    }

    setGameState(playerId, state){
        const player = this.getPlayerById(playerId);
        if (player) {
            player.gameState = state;
        }
    }

    getGameState(playerId){
        const player = this.getPlayerById(playerId);
        if (player) {
            return player.gameState;
        }
        return {};
    }

    addPoint(player){
        thePlayer = this.getPlayerByUsername(player.username);
        thePlayer.roundScore += 1;
        this.setPlayer(thePlayer);
    }

    getAllPlayers() {
        return this.players;
    }

    getDJs() {
        const players = this.getAllPlayers();
        const djs = players.filter(player => player.type === 'dj')
        return djs;
    }

    getJudges() {
        const players = this.getAllPlayers();
        const judges = players.filter(player => player.type === 'judge')
        return judges;
    }

    getHost() {
        const players = this.getAllPlayers();
        const host = players.find(player => player.host)
        return host;
    }

    setHost(player) {
        const host = this.getPlayerByUsername(player.username);
        host.host = true;
        this.updatePlayer(host);
    }

    setDJ(playerId) {
        const player = this.getPlayerById(playerId);

        if (player) {
            player.type = 'dj';
            player.gameState.dj = true;
        }
    }

    newRound(){
        this.players.forEach(player => {
            player.gameScore += player.roundScore;
            player.roundScore = 0;
            player.previousTrack = _.cloneDeep(player.selectedTrack);
            player.selectedTrack = undefined;
        });
    }

    setSelectedTrack(playerId, track) {
        const player = this.getPlayerById(playerId);
        if (player) {
            player.selectedTrack = track;
        }
    }
}

export default PlayerStore;