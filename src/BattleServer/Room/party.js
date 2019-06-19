
import Room from './';

class Party extends Room{
    constructor(id, access_token, refresh_token, emitter) {
        super(id, access_token, refresh_token, emitter);
        
        this.trackList = [];//['spotify:track:4F1yvJfQ7gJkrcgFJQDjOr', 'spotify:track:1BuZAIO8WZpavWVbbq3Lci', ];

        this.readyForNext = false;
        this.hostWaiting = false;
        this.type = "party";

        setInterval( () => {
            console.log("host waiting", this.hostWaiting);
            if (this.emitter && this.hostWaiting) {
                const track = this.nextTrack();
                if (track) {
                    this.emitter.emitEvent(this.id, 'update', {property: "nextToPlay", value: track});
                    this.hostWaiting = false; 
                }
            }
        }, 5000);

    }

    addTrack(track) {
        this.trackList.push(track);
        console.log("tracklist", this.trackList);
    }

    nextTrack(){
        const nextTrack = this.trackList.shift();
        console.log("next", nextTrack);
        return nextTrack;
    }

    getMonitor(){
        return {id: this.monitor};
    }

    setHostWaiting(){
        this.hostWaiting = true;
    }
};

export default Party;