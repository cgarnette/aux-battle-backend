import app, { currentGame } from "../../App";

app.post('/battle/set_player_track', (req, res) => {
    const { roomCode, track, playerId } = req.body;
    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    playerStore.setSelectedTrack(playerId, track);

    // if (room.type !== GAME_TYPE.GAME_TYPE_FREE_FOR_ALL) {
    //   room.checkPlayerTrackEntries();  
    // }

    room.checkPlayerTrackEntries();  
    
    res.status(200).json({success: "submission successful"});
  });

  app.get('/battle/djs', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    const djs = playerStore.getDJs().map(dj => {
        const albumArt = dj.selectedTrack.album.images.length > 0 ? dj.selectedTrack.album.images[1 || 0].url : "";
        return {
            id: dj.id,
            username: dj.username,
            trackTitle: dj.selectedTrack.name,
            albumArt
        };
    });
    res.status(200).json({ djs: djs });
  });

  app.get('/vote', (req, res) => {
    const roomCode = req.query.roomCode;
    const djId = req.query.djId;

    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    const player = playerStore.getPlayerById(djId);

    player.roundScore += 5;

    room.isVotingFinished();

    console.log("vote has been cast!");
    res.status(200).json({success: "vote successful"});
  });

  app.get('/category/submit', (req, res) => {
      const roomCode = req.query.roomCode;
      const category = req.query.category;

      const room = currentGame.getRoomById(roomCode);

      const trimmedCat = category.trim();

      if (trimmedCat.length > 0) {
          // add it to the submitted categories array for the free for all
          room.addSubmittedCategory(trimmedCat);
      } else {
          res.status(200).json({ error: 'empty category' });
      }
  });

  app.get('/change', (req, res) => {
    const roomCode = req.query.roomCode;
    const phase = req.query.phase;

    const room = currentGame.getRoomById(roomCode);

    if (phase === PHASE.CATEGORY_SUBMISSIONS_PHASE) {
        room.categorySubmissionComplete();
    }
});

app.get('/start/roundplay', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.startRoundPlay();

    res.status(200).json({success: "round play phase started"});
});

app.get('/vote/close', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.closeVoting();

    res.status(200).json({success: "round play phase started"});
});

app.get('/join/close', (req, res) => {
    const roomCode = req.query.roomCode;
    const room = currentGame.getRoomById(roomCode);

    room.triggerStartGame();

    res.status(200).json({success: "Game Flow Started"});
});

app.post('/settings', (req, res) => {
    const {roomCode, settings} = req.body;

    const room = currentGame.getRoomById(roomCode);

    console.log('settings received');
    room.setSettings(settings);
    return res.status(200).json({success: "update successful"});
  });

app.post('/update/user', (req, res) => {
    const { roomCode, state } = req.body;

    const room = currentGame.getRoomById(roomCode);
    const playerStore = room.getPlayerStore();

    const player = playerStore.getAllPlayers().find(_player => _player.username === state.username);

    player.gameState = state;

    res.status(200).send('success');
});