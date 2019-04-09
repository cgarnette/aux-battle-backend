export class SocketManager {
    constructor (socket, game){
        this.io = socket;
        this.game = game;
        this.initSockets();
    }

    initSockets() {
        const io = this.io;

        io.on('connection', (client) => {

            console.log("connected");

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

                    if (monitor.id === client.id) {
                        this.game.endGame(room.id);
                    } else {
                        this.game.removePlayer(client.id);
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
        player.join(data.gameCode); //Client sends gamecode and is added to that channel;

        const room = this.game.getRoomById(data.gameCode);
        if (room) {
            room.addPlayer(player.id, data.username)
            const numPlayers = room.getPlayers().length;

            this.game.addToRegistry(player.id, data.gameCode);

            if(numPlayers === 1) {
                room.setHost(player.id);
                this.io.to(player.id).emit('set role', {host: true, categories: room.getCategories()});
            }
            this.io.to(player.id).emit("player joined", {id: player.id});
            this.io.to(room.getMonitor().id).emit("player joined", {players: room.getPlayers()});
            this.io.to(room.getHost()).emit("player joined", {players: room.getPlayers()});
        }
    
    }

    startGame(player, data){

        this.setKeepers(data);
        this.io.in(data.gameCode).emit("phase", { phase: "game start" });
        const room = this.game.getRoomById(data.gameCode);

        room.setPhase("game start");
        setTimeout(() => this.trackSelect(data), 5000);
    }

    setKeepers(data) {
        const room = this.game.getRoomById(data.gameCode);

        data.keepers.forEach(keeper => {
            room.setKeeper(keeper);
            this.io.to(keeper.id).emit('set role', {keeper: true});
        });
    }

    trackSelect(data) {

        const room = this.game.getRoomById(data.gameCode);
        const battlers = room.getPlayersByType("battler");
        const judges = room.getPlayersByType("judge");
        const monitor = room.getMonitor();

        const category = room.getCategory();
        const roundNum = room.getRoundNum();

        room.setPhase("track-selection");

        battlers.forEach(battler => this.io.to(battler.id).emit("phase", {
            phase: "track-selection",
            info: {
                category,
                roundNum,
                showTrackSearch: true
            }
        }) );
        judges.forEach(judge => this.io.to(judge.id).emit("phase", {
            phase: "track-selection",
            info: {
                category
            }
        }) );
        this.io.to(monitor.id).emit("phase", {
            phase: "track-selection",
            info: {
                category,
                roundNum
            }
        });
        room.setActivePlayer(battlers[0].id);
    }

    roundPlay(data) {

        const room = this.game.getRoomById(data.gameCode);
        const battlers = room.getPlayersByType("battler");
        const player = room.getActivePlayer();

        if (!player) {
            room.setPhase("vote");
            this.io.to(room.getMonitor().id).emit("phase", {phase: "get ready"});

            setTimeout( () => {
                this.io.in(data.gameCode).emit("phase", { phase: "vote" });
            }, 5000);
            
        } else {
            const track = player.getSelectedTrack()
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
                room.setActivePlayer(battlers[nextActiveIndex].id);
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

    refreshToken(data, token) {
        const room = this.game.getRoomById(data.gameCode);
        this.io.to(room.getMonitor().id).emit("token", {token});
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
}