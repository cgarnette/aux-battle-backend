import { PHASE, GAME_TYPE } from '../util/constants';

export class SocketManager {
    constructor (socket, game){
        this.io = socket;
        this.game = game;
        this.game.setEmitter(this);
        this.initSockets();
    }

    initSockets() {
        const io = this.io;

        io.on('connection', (client) => {

            console.log("connected");

            // adds user to registry. Only necessary for party room mode
            client.on('add', data => {
                this.game.addToRegistry(client.id, data.gameCode);
                const room = this.game.getRoomById(data.gameCode);

                room.setMonitor(client.id);
                client.join(data.gameCode);
                io.to(client.id).emit("update", { property: "id", value: client.id });
            });

            client.on('get next', data => {
                const room = this.game.getRoomById(data.gameCode);
                if (room.getMonitor().id === client.id) {
                    // console.log("theyre asking for tracks");
                    // io.to(client.id).emit("update", { property: "trackURI", value: room.nextTrack() });
                    room.setHostWaiting();
                }
            });

            client.on('init', data => {
                this.init(client, data);
            });
            // Needs to be updated to allow to players to reconnect to game
            // and things about active game connects needs to be figured out
            client.on('join game', data => {
                this.join(client, data);
            });

            client.on('set settings', data => {
                const room = this.game.getRoomById(data.gameCode);
                if (data.categories) {
                    room.setCategories(data.categories);
                }
            });

            client.on('song-complete', data=> {
                this.wait(data);
                setTimeout(() => this.roundPlay(data), 5000);
            });

            client.on('voting-closed', data => {
                
            });

            client.on('start', data => {
                this.startGame(client, data);
            });
        
            client.on('phase over', data => {
                gameDriver.getRoom(data.gameCode).stopAcceptingAnswers();
                gameDriver.getRoom(data.gameCode).resolvePhase();
                io.sockets.in(data.gameCode).emit('phase over', "new phase coming soon");
            });

            client.on('disconnect', data => {
                const room = this.game.getRoomByUser(client.id);
                if (room) {
                    const monitor = room.getMonitor();

                    if ( room.getPhase() === PHASE.JOIN_PHASE) {
                        // TODO
                        // Send out updated list of players to monitor and host
                    }

                    if (monitor.id === client.id) {
                        this.game.endGame(room.id);
                    } else {
                        this.game.removePlayer(client.id);
                        console.log('players', room.getActivePlayers());
                        const playerToRemove = room.getPlayerById(client.id);
                        console.log('id to remove', client.id);
                        console.log('playerToRemove', playerToRemove);
                        room.removePlayer(playerToRemove.username);
                    }
                }
            });
        });
    }

    init(player, data){
        const room = this.game.getRoomById(data.gameCode);
        if (room) {
            room.setEmitter(this);
            player.join(data.gameCode);
            room.setMonitor(player);
            room.setPhase("join");
            player.emit("phase", { phase: room.getPhase() });

            // const test = setTimeout(() => this.startGame(player, data), 5000);

            this.game.addToRegistry(player.id, data.gameCode);
        } 
    }

    join(player, data){
        console.log("joining");
        const room = this.game.getRoomById(data.gameCode);

        if (room) {
            console.log('room exists');

            let freeForAll = false;

            if (room.type === GAME_TYPE.GAME_TYPE_PARTY) {
                player.join(data.gameCode);
                this.io.to(player.id).emit("phase", {
                    phase: PHASE.TRACK_SELECTION_PHASE,
                    info: {
                        id: player.id,
                        keeper: true,
                        roomType: GAME_TYPE.GAME_TYPE_PARTY
                    } 
                });

                this.game.addToRegistry(player.id, data.gameCode);
            } else if (room.type === GAME_TYPE.GAME_TYPE_FREE_FOR_ALL) {
                // Insert join actions for free for all game here.

                console.log('type freeforall');

                freeForAll = true;
                if (room.getPlayerByUsername(data.username)) {
                    console.log('step 1 inner');
                    player.emit( "phase", { phase: 'join', info: { error: 'Username Taken' } } );
                    return;
                }

                player.join(data.gameCode);
                this.game.addToRegistry(player.id, data.gameCode);

                const existingPlayer = room.getPlayers().find(_player => _player.username.toLowerCase() === data.username.toLowerCase());

                if (existingPlayer) {
                    existingPlayer.setId(player.id);

                    const oldState = existingPlayer.getGameState();
                    oldState.phase = room.getPhase();
                    oldState.id = player.id;
                    oldState.category = room.getCategory(); // May or may not need this part

                    room.addToActive(existingPlayer);
                    this.io.to(player.id).emit("state override", oldState);
                    return;
                } 
                room.addPlayer(player.id, data.username);

                this.io.to(player.id).emit("player joined", {id: player.id, freeForAll: true});
                this.io.to(room.getMonitor().id).emit("player joined", {players: room.getActivePlayers()});

            } else if (room.type === GAME_TYPE.GAME_TYPE_BATTLE) {
                console.log('room type battle');

                if (room.getPlayerByUsername(data.username)) {
                    console.log('step 1 inner');
                    player.emit( "phase", { phase: 'join', info: { error: 'Username Taken' } } );
                    return;
                }

                console.log('username not taken');
                
                player.join(data.gameCode);
                this.game.addToRegistry(player.id, data.gameCode);
                
                console.log('joined and added to registry');

                const existingPlayer = room.getPlayers().find(_player => _player.username.toLowerCase() === data.username.toLowerCase());
                if (existingPlayer) {
                    existingPlayer.setId(player.id);
                    const oldState = existingPlayer.getGameState();

                    if (oldState.host) {
                        oldState.phase = room.getPhase() === PHASE.JOIN_PHASE ? 'waiting-room' : room.getPhase();
                    } else {
                        oldState.phase = room.getPhase() === PHASE.JOIN_PHASE ? 'wait' : room.getPhase();
                    }
                    oldState.id = player.id;
                    oldState.category = room.getCategory();

                    room.addToActive(existingPlayer);
                    this.io.to(player.id).emit("state override", oldState);
                    return;
                } 
                room.addPlayer(player.id, data.username);

                const numPlayers = room.getActivePlayers().length;

                if(numPlayers === 1) {
                    room.setHost(data.username);
                    this.io.to(player.id).emit('set role', {host: true, categories: room.getCategories(), playDuration: room.getPlayDuration()});
                }
                this.io.to(player.id).emit("player joined", {id: player.id});
                this.io.to(room.getMonitor().id).emit("player joined", {players: room.getActivePlayers()});
                this.io.to(room.getHost().id).emit("player joined", {players: room.getActivePlayers()});
            }
            
        } else {
            this.io.to(player.id).emit("invalid", { error: "Invalid Room" });
        }
    
    }

    startGame(player, data){

        if (data.keepers) {
           this.setKeepers(data); 
        }
        
        this.io.in(data.gameCode).emit("phase", { phase: "game start" });
        const room = this.game.getRoomById(data.gameCode);

        room.setPhase("game start");

        if (room.type === GAME_TYPE.GAME_TYPE_FREE_FOR_ALL) {
            setTimeout(() => this.categorySubmit(data), 5000);
        } else {
            setTimeout(() => this.trackSelect(data), 5000);
        }  
    }

    setKeepers(data) {
        const room = this.game.getRoomById(data.gameCode);

        data.keepers.forEach(keeper => {
            room.setKeeper(keeper);
            this.io.to(keeper.id).emit('set role', {keeper: true});
        });
    }

    categorySubmit(data) {
        const room = this.game.getRoomById(data.gameCode);
        const players = room.getActivePlayers();
        const monitor = room.getMonitor();
        const category = room.getCategory();

        room.setPhase(PHASE.CATEGORY_SUBMISSIONS_PHASE);

        players.forEach(battler => this.io.to(battler.id).emit("phase", {
            phase: PHASE.CATEGORY_SUBMISSIONS_PHASE,
            info: {
            }
        }) );

        this.io.to(monitor.id).emit("phase", {
            phase: PHASE.CATEGORY_SUBMISSIONS_PHASE,
            info: {
            }
        });

    }

    trackSelect(data) {

        const room = this.game.getRoomById(data.gameCode);
        let battlers = room.getActivePlayers();
        const monitor = room.getMonitor();

        const category = room.getCategory();
        const roundNum = room.getRoundNum();
        const playDuration = room.getPlayDuration();

        room.setPhase(PHASE.TRACK_SELECTION_PHASE);

        if (room.type === GAME_TYPE.GAME_TYPE_BATTLE) {
            const judges = room.getPlayersByType("judge");
            battlers = room.getPlayersByType("battler");

            judges.forEach(judge => this.io.to(judge.id).emit("phase", {
                phase: PHASE.TRACK_SELECTION_PHASE,
                info: {
                    category
                }
            }) );
        }

        battlers.forEach(battler => this.io.to(battler.id).emit("phase", {
            phase: PHASE.TRACK_SELECTION_PHASE,
            info: {
                category,
                roundNum,
                showTrackSearch: true
            }
        }) );
        
        this.io.to(monitor.id).emit("phase", {
            phase: PHASE.TRACK_SELECTION_PHASE,
            info: {
                category,
                roundNum,
                playDuration
            }
        });

        console.log('battlers', battlers);
        room.setActivePlayer(battlers[0].id);
    }

    roundPlay(data) {

        const room = this.game.getRoomById(data.gameCode);

        if (!room) return;

        const battlers = room.type === GAME_TYPE.GAME_TYPE_FREE_FOR_ALL ? room.getActivePlayers() : room.getAllPlayersByType("battler");
        const player = room.getActivePlayer();

        if (!player) {
            room.setPhase("vote");
            this.io.to(room.getMonitor().id).emit("phase", { phase: "get ready" });

            setTimeout( () => {
                this.io.in(data.gameCode).emit("phase", { phase: "vote" });
            }, 5000);
            
        } else {
            const track = player.getSelectedTrack();
            const trackURI = track.uri;
            const albumArt = track.album.images.length > 1 ? track.album.images[1 || 0].url : "";
            room.setPhase("round-play");
            this.io.in(data.gameCode).emit("phase", {
                phase: "round-play", 
                info: {
                    trackURI,
                    albumArt,
                    artist: track.artists[0].name,
                    currentBattler: player.username,
                    trackTitle: track.name,
                    category: room.getCategory()
                }
            });
        }
        
        if (player) {
            const nextActiveIndex = battlers.findIndex(battler => battler.id === player.id) + 1;
            if(nextActiveIndex < battlers.length) {

                let playerFound = false;
                for (let i = nextActiveIndex; i < battlers.length; i++) {
                    if (battlers[i].selectedTrack) {
                        room.setActivePlayer(battlers[i].id);
                        playerFound = true;
                        break;
                    }
                }

                if (!playerFound) {
                    room.setActivePlayer(undefined);
                }
                
            } else {
                room.setActivePlayer(undefined);
            }
        } 
    }

    wait(data, extra) {
        const room = this.game.getRoomById(data.gameCode);
        room.setPhase("wait");
        if(extra) {
            this.io.in(data.gameCode).emit("phase", {
                phase: "wait",
                info: extra
             });
        } else {
            this.io.in(data.gameCode).emit("phase", {phase: "wait"});
        }
        
    }

    refreshToken(monitorId, token) {
        const id = monitorId ? (monitorId.id ? monitorId.id : monitorId) : undefined;
        this.io.to(id).emit("token", {token});
    }

    roundOver(data) {
        const room = this.game.getRoomById(data.gameCode);
        const winner = room.getRoundWinner();
        const albumArt = winner.selectedTrack.album.images.length > 1 ? winner.selectedTrack.album.images[1 || 0].url : "";
        const preview = winner.selectedTrack.preview_url;

        room.setPhase("round-over");
        this.io.in(data.gameCode).emit("phase", {
            phase: "round-over", 
            info: {
                winner: winner.username,
                category: room.getCategory(),
                albumArt,
                preview
            }
        });

        setTimeout(() => room.nextRound(), 10000);
    }

    gameOver(data) {
        const room = this.game.getRoomById(data.gameCode);
        const winner = room.getGameWinner();
        const albumArt = winner.previousTrack.album.images.length > 1 ? winner.previousTrack.album.images[1 || 0].url : "";
        const preview = winner.previousTrack.preview_url;

        room.setPhase("game-over");
        this.io.in(data.gameCode).emit("phase", {
            phase: "game-over", 
            info: {
                winner: winner.username,
                category: room.getCategory(),
                albumArt,
                preview
            }
        });

        setTimeout( () => {
            this.io.in(data.gameCode).emit("game exit")
        }, 20000);
    }

    emitEvent(roomCode, event, data) {
        console.log("emitting", event);
        if (data) {
            this.io.in(roomCode).emit(event, data);
        } else {
            this.io.in(roomCode).emit(event);
        }
    }
}