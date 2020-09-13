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
            ////////////////////// PARTY MODE ONLY ///////////////////////////
            //////////////////////////////////////////////////////////////////
            //////////////////////////////////////////////////////////////////
            client.on('add', data => {
                const room = this.game.getRoomById(data.gameCode);

                room.setMonitor(client.id);
                client.join(data.gameCode);
                io.to(client.id).emit("update", { property: "id", value: client.id });
            });

            // set waiting for next song
            client.on('get next', data => {
                const room = this.game.getRoomById(data.gameCode);
                if (room) {
                    room.setHostWaiting();
                }
            });
            //////////////////////////////////////////////////////////////////
            ///////////////////////////////////////////////////////////////////

            client.on('init', data => {
                this.init(client, data);
            });

            client.on('join game', data => {
                this.join(client, data);
            });

            client.on('song-complete', data=> {
                this.wait(data);
                setTimeout(() => this.roundPlay(data), 5000);
            });

            client.on('start', data => {
                this.startGame(data);
            });
        
            client.on('phase over', data => {
                io.sockets.in(data.gameCode).emit('phase over', "new phase coming soon");
            });

            client.on('disconnect', data => {
                const room = this.game.getRoomByUser(client.id);
                if (room) {
                    const monitor = room.getMonitor();

                    if (monitor.id === client.id) {
                        console.log("monitor has disconnected");
                        this.game.endGame(room.id)
                    } else if ( room.getPhase() === PHASE.JOIN_PHASE) {
                        const playerStore = room.getPlayerStore();

                        this.game.removePlayer(client.id);
                        playerStore.playerOnHold(client.id);
                        playerStore.removePlayer({ id: client.id });

                        this.io.to(playerStore.getHost().id).emit("player joined", { players: playerStore.getAllPlayers() });
                        this.io.to(monitor.id).emit("player joined", { players: playerStore.getAllPlayers() });
                    } else {
                        const playerStore = room.getPlayerStore();
                        playerStore.playerOnHold(client.id, true)
                    }
                }
            });
        });
    }

    init(monitor, data){
        const room = this.game.getRoomById(data.gameCode);
        if (room) {
            room.setEmitter(this);
            monitor.join(data.gameCode);
            room.setMonitor(monitor);
            room.setPhase("join");
            monitor.emit("phase", { phase: room.getPhase() });
        } 
    }

    join(player, data){
        console.log("joining");
        const room = this.game.getRoomById(data.gameCode);
        if (room) {
            console.log('room exists');
            const playerStore = room.getPlayerStore();
            const phase = room.getPhase();

            if (phase === 'join') { // The only time new users are allowed to join
                if (playerStore.getPlayerByUsername(data.username)) {
                    player.emit( "phase", { phase: 'join', info: { error: 'Username Taken' } } );
                    return;
                }

                this.game.addToRegistry(player.id, data.gameCode);
                playerStore.addPlayer({ id: player.id, username: data.username }, true);
                player.join(data.gameCode);

                const playerCount = playerStore.activePlayers;

                if(playerCount === 1) { // first player to join is the host
                    playerStore.setHost(data);
                    player.emit('set role', { host: true, settings: room.settings });
                    player.emit("player joined", { id: player.id, players: playerStore.getAllPlayers() });
                } else {
                    const host = playerStore.getHost();
                    player.emit("player joined", { id: player.id });
                    this.io.to(host.id).emit("player joined", { players: playerStore.getAllPlayers() });
                }
                this.io.to(room.getMonitor().id).emit("player joined", { players: playerStore.getAllPlayers() }); 
            } else { // Game is ongoing, only reconnecting/returning players allowed
                const successfullyAdded = playerStore.addPlayer({ id: player.id, username: data.username });
                if (successfullyAdded) {
                    player.join(data.gameCode);
                    this.io.to(room.getMonitor().id).emit("player joined", { players: playerStore.getAllPlayers() });
                }
            } 
        }
    }

    startGame(data){
        if (data.djs) {
           this.setDJs(data); 
        }

        console.log('start data', data);
        
        this.io.in(data.gameCode).emit("phase", { phase: "game start" });
        const room = this.game.getRoomById(data.gameCode);

        room.setPhase("game start");

        if (room.settings.categorySelector === 'judges') {
            setTimeout(() => this.categorySubmit(data), 5000);
        } else {
            setTimeout(() => this.trackSelect(data), 5000);
        }  
    }

    setDJs(data) {
        const room = this.game.getRoomById(data.gameCode);
        const playerStore = room.getPlayerStore();

        data.djs.forEach(dj => {
            playerStore.setDJ(dj.id);
            this.io.to(dj.id).emit('set role', { dj: true });
        });
    }

    categorySubmit(data) {
        const room = this.game.getRoomById(data.gameCode);
        room.setPhase(PHASE.CATEGORY_SUBMISSIONS_PHASE);
        this.io.in(data.gameCode).emit("phase", { phase: room.getPhase(), info: {} });
    }

    trackSelect(data) {
        const room = this.game.getRoomById(data.gameCode);

        const playerStore = room.getPlayerStore();
        const djs = playerStore.getDJs();
        const judges = playerStore.getJudges();
        const monitor = room.getMonitor();

        const category = room.getCategory();
        const roundNum = room.getRoundNum();
        const playDuration = room.getPlayDuration();

        room.setPhase(PHASE.TRACK_SELECTION_PHASE);

        judges.forEach(judge => this.io.to(judge.id).emit("phase", {
            phase: room.getPhase(),
            info: {
                category
            }
        }) );

        djs.forEach(dj => this.io.to(dj.id).emit("phase", {
            phase: room.getPhase(),
            info: {
                category,
                roundNum,
                showTrackSearch: true
            }
        }) );
        
        this.io.to(monitor.id).emit("phase", {
            phase: room.getPhase(),
            info: {
                category,
                roundNum,
                playDuration
            }
        });

        room.setActiveDJ(djs[0].id);
    }

    roundPlay(data) {
        const room = this.game.getRoomById(data.gameCode);

        if (!room) return;

        const playerStore = room.getPlayerStore();
        const djs = playerStore.getDJs()
        const player = room.getActiveDJ();

        if (!player) {
            room.setPhase("vote");
            this.io.to(room.getMonitor().id).emit("phase", { phase: "get ready" });

            setTimeout( () => {
                this.io.in(data.gameCode).emit("phase", { phase: "vote" });
            }, 5000);
            
        } else {
            const track = player.selectedTrack;
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

            const nextActiveIndex = djs.findIndex(dj => dj.id === player.id) + 1;
            if(nextActiveIndex < djs.length) {
                let playerFound = false;
                for (let i = nextActiveIndex; i < djs.length; i++) {
                    if (djs[i].selectedTrack) {
                        room.setActiveDJ(djs[i].id);
                        playerFound = true;
                        break;
                    }
                }

                if (!playerFound) {
                    room.setActiveDJ(undefined);
                }
                
            } else {
                room.setActiveDJ(undefined);
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
            this.io.in(data.gameCode).emit("phase", { phase: "wait" });
        }
        
    }

    refreshToken(monitorId, token) {
        const id = monitorId ? (monitorId.id ? monitorId.id : monitorId) : undefined;
        this.io.to(id).emit("token", { token });
    }

    roundOver(data) {
        const room = this.game.getRoomById(data.gameCode);
        const winner = room.getRoundWinner();
        console.log("winner", winner);
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

        let albumArt, preview;

        if (!!winner.previousTrack) {
            albumArt = winner.previousTrack.album.images.length > 1 ? winner.previousTrack.album.images[1 || 0].url : "";
            preview = winner.previousTrack.preview_url;
        } else {
            albumArt = winner.selectedTrack.album.images.length > 1 ? winner.selectedTrack.album.images[1 || 0].url : "";
            preview = winner.selectedTrack.preview_url;
        }

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