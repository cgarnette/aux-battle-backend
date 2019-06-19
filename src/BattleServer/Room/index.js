import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../../util/constants.js';
import request from 'request';
import * as _ from "lodash";

class Room {
    constructor(id, access_token, refresh_token, emitter){
        this.id = id;
        this.emitter = emitter;

        this.spotifyAccessToken = access_token;
        this.spotifyRefreshToken = refresh_token;

        this.checkToken.bind(this);
        this.refreshToken.bind(this);

        this.phase = "start";

        const refresh = () => this.refreshToken();
        this.checkToken(refresh);
    }

    checkToken(refresh, ms_time=1200000){
        this.intervalClock = setInterval( function() {
            refresh()
        }, ms_time);
    };

    refreshToken(){
        const refresh_token = this.spotifyRefreshToken;
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            headers: { 'Authorization': 'Basic ' + (new Buffer(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')) },
            form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
            },
            json: true
        };

        const emitter = this.emitter;
        const id = this.id;
        const spotifyAccessToken = this.spotifyAccessToken;
        const setAccessToken = (token) => this.setAccessToken(token);

        request.post(authOptions, function(error, response, body) {
            if (!error && response.statusCode === 200) {
                // console.log(body);
                setAccessToken(body.access_token);
                //Need to send new access token to game monitor

                emitter.refreshToken(this.monitor, spotifyAccessToken);
            }
        });
    }

    setAccessToken(token){
        this.spotifyAccessToken = token;
    }

    setMonitor(monitor){
        this.monitor = monitor;
    }
    getMonitor(){
        return this.monitor;
    }

}


export default Room;