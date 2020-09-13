
import Battle from './Room/battle';
import Party from './Room/party';
import Free from './Room/free';
import { generateRandomCode } from '../util/helpers';
import { COUCH_DB_URL } from '../util/constants';

// const nano = require('nano')(COUCH_DB_URL);

export class Game {
    constructor(){
        this.battleRooms = {};
        this.userRegistry = {}; //Key value pairs. Key = player.id value = roomCode

       // nano.db.create('BattleRooms');
    }

    initializeBattleRoom(access_token, refresh_token){
        const roomId = this.getUniqueId();
        const room = new Battle(roomId, access_token, refresh_token, this.emitter);
        this.battleRooms[roomId] = room;
        return roomId;
    };

    initializeFreeRoom(access_token, refresh_token){
        const roomId = this.getUniqueId();
        const room = new Free(roomId, access_token, refresh_token, this.emitter);
        this.battleRooms[roomId] = room;
        return roomId;
    };

    initializePartyRoom(access_token, refresh_token) {
        const roomId = this.getUniqueId();
        const room = new Party(roomId, access_token, refresh_token, this.emitter);
        this.battleRooms[roomId] = room;
        return roomId;
    };

    getRoomById(id){
        return this.battleRooms[id];
    }

    getAllRooms(asArray = false) {
        return asArray ? Object.entries(this.battleRooms) : this.battleRooms;
    }

    getUniqueId(){
        let unique = false;
        const id = generateRandomCode();

        unique = this.getRoomById(id) ? false : true;

        if (unique) {
            return id;
        } else {
            this.getUniqueId();
        }
    }

    removeRoom(id) {
        delete this.battleRooms[id];
    }

    removePlayer(id) {
        delete this.userRegistry[id];
    }

    getRoomByUser(userId) {
        return this.battleRooms[this.userRegistry[userId]];
    }

    addToRegistry(userId, roomCode) {
        this.userRegistry[userId] = roomCode;
    }

    endGame(roomCode){
        this.removeRoom(roomCode);
        const newRegistry = {};
        Object.keys(this.userRegistry).forEach(key => {
            if (this.userRegistry[key] !== roomCode) {
                newRegistry[key] = this.userRegistry[key];
            }
        });

        this.userRegistry = newRegistry;
        this.emitter.emitEvent(roomCode, "game exit");
    }

    setEmitter(emitter){
        this.emitter = emitter;
    }
}