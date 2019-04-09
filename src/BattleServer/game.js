
import {Battle} from './battle';
import { generateRandomCode } from '../util/helpers';

export class Game {
    constructor(){
        this.battleRooms = {};
        this.userRegistry = {}; //Key value pairs. Key = player.id value = roomCode
    }

    initializeBattleRoom(access_token, refresh_token){
        const roomId = this.getUniqueId();
        const room = new Battle(roomId, access_token, refresh_token);
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
    }
}