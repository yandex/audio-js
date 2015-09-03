package src.flash.src {
import flash.events.Event;
import flash.events.EventDispatcher;
import flash.events.IOErrorEvent;
import flash.events.ProgressEvent;
import flash.media.Sound;
import flash.net.URLRequest;

public final class AudioLoader extends EventDispatcher {
    public var sound:Sound;

    public var duration:int = 0;
    public var loaded:int = 0;

    public var isLoading:Boolean = false;
    public var isLoaded:Boolean = false;
    public var preloaded:String = "";
    public var src:String = "";

    private var muted:Boolean = true;

    public function AudioLoader() {
    }

    public function load(src:String, duration:Number):void {
        this.abort();

        this.sound = new Sound();
        this.duration = duration;

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

        this.duration = 0;
        this.loaded = 0;
        this.isLoaded = false;
        this.isLoading = false;
    }

    private function onLoadingStart(event:Event):void {
        this.isLoading = true;
        this.dispatchEvent(new Event(AudioEvent.EVENT_LOADING));
    }

    private function onLoadingEnd(event:Event):void {
        this.duration = this.sound.length;
        this.loaded = this.duration;
        this.isLoaded = true;

        this.dispatchEvent(new Event(AudioEvent.EVENT_PROGRESS));
        this.dispatchEvent(new Event(AudioEvent.EVENT_LOADED));
    }

    private function onLoadingProgress(event:ProgressEvent):void {
        this.loaded = this.duration * event.bytesLoaded / event.bytesTotal;
        this.dispatchEvent(new Event(AudioEvent.EVENT_PROGRESS));
    }

    private function onError(event:IOErrorEvent):void {
        this.abort();
        this.dispatchEvent(event);
    }
}
}
