
import Room from './';

class Party extends Room{
    constructor(id, access_token, refresh_token, emitter) {
        super(id, access_token, refresh_token, emitter);
        
        this.trackList = [];

        this.readyForNext = false;
        this.hostWaiting = false;
        this.type = "party";

        setInterval( () => {
            console.log("host waiting", this.hostWaiting);
            if (this.emitter && this.hostWaiting) {
                const track = this.nextTrack();
                if (track) {
                    this.emitter.emitEvent(this.id, 'update', { property: "nextToPlay", value: track });
                    this.hostWaiting = false; 
                }
            }
        }, 5000);

    }

    addTrack(track) {
        this.trackList.push(track);
    }

    nextTrack(){
        const nextTrack = this.trackList.shift();
        return nextTrack;
    }

    getMonitor(){
        return { id: this.monitor };
    }

    setHostWaiting(){
        this.hostWaiting = true;
    }
};

export default Party;