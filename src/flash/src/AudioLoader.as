package {
import flash.events.Event;
import flash.events.EventDispatcher;
import flash.events.IOErrorEvent;
import flash.events.ProgressEvent;
import flash.media.Sound;
import flash.net.URLRequest;

public final class AudioLoader extends EventDispatcher {
    public var sound:Sound;

    private var _duration:int = 0;
    private var guessDuration:int = -1;
    public var loaded:int = 0;

    public var isLoading:Boolean = false;
    public var isLoaded:Boolean = false;
    public var preloaded:String = "";
    public var src:String = "";

    public function AudioLoader() {
    }

    public function get duration():int {
        if (this._duration > 0) {
            return this._duration
        } else {
            return this.guessDuration;
        }
    }

    public function load(src:String, duration:Number):void {
        this.abort();

        this.sound = new Sound();
        this._duration = duration;

        this.sound.addEventListener(Event.OPEN, this.onLoadingStart);
        this.sound.addEventListener(Event.COMPLETE, this.onLoadingEnd);
        this.sound.addEventListener(ProgressEvent.PROGRESS, this.onLoadingProgress);
        this.sound.addEventListener(IOErrorEvent.IO_ERROR, this.onError);

        this.sound.load(new URLRequest(src));
        this.src = src;
    }

    public function abort():void {
        if (!(this.sound is Sound)) {
            return;
        }

        this.sound.removeEventListener(Event.OPEN, this.onLoadingStart);
        this.sound.removeEventListener(Event.COMPLETE, this.onLoadingEnd);
        this.sound.removeEventListener(ProgressEvent.PROGRESS, this.onLoadingProgress);
        this.sound.removeEventListener(IOErrorEvent.IO_ERROR, this.onError);

        try {
            this.sound.close();
        } catch (e:Error) {
        }
        this.sound = null;

        this._duration = 0;
        this.loaded = 0;
        this.isLoaded = false;
        this.isLoading = false;
    }

    private function onLoadingStart(event:Event):void {
        this.isLoading = true;
        this.dispatchEvent(new Event(AudioEvent.EVENT_LOADING));
    }

    private function onLoadingEnd(event:Event):void {
        this._duration = this.sound.length;
        this.loaded = this.duration;
        this.isLoaded = true;

        this.dispatchEvent(new Event(AudioEvent.EVENT_PROGRESS));
        this.dispatchEvent(new Event(AudioEvent.EVENT_LOADED));
    }

    private function onLoadingProgress(event:ProgressEvent):void {
        //FIXME: it will give wrong values on VBR audio (Variable BitRate), and it gives imprecise values with CBR audio
        this.guessDuration = this.sound.length * event.bytesTotal / event.bytesLoaded;

        this.loaded = this.duration * event.bytesLoaded / event.bytesTotal;
        this.dispatchEvent(new Event(AudioEvent.EVENT_PROGRESS));
    }

    private function onError(event:IOErrorEvent):void {
        this.abort();
        this.dispatchEvent(event);
    }
}
}
