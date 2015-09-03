package src.flash.src {
import flash.events.DataEvent;

public final class AudioEvent extends DataEvent {
    public var offset:int;

    public static const EVENT_PLAY:String = "play";
    public static const EVENT_PAUSE:String = "pause";
    public static const EVENT_PROGRESS:String = "progress";
    public static const EVENT_ENDED:String = "ended";
    public static const EVENT_ERROR:String = "error";
    public static const EVENT_VOLUME:String = "volumechange";
    public static const EVENT_STOP:String = "stop";
    public static const EVENT_LOADED:String = "loaded";
    public static const EVENT_LOADING:String = "loading";
    public static const EVENT_SWAP:String = "swap";

    public function AudioEvent(type:String, offset:int = -1, data:String = "") {
        super(type, false, false, data);
        this.offset = offset;
    }
}
}
