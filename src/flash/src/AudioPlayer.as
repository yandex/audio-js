package {
import flash.events.Event;
import flash.events.EventDispatcher;
import flash.events.IOErrorEvent;
import flash.events.TimerEvent;
import flash.media.SoundChannel;
import flash.utils.Timer;

public final class AudioPlayer extends EventDispatcher {
    private static const updateInterval:Number = 30;
    private static var timer:Timer = new Timer(10);

    public var id:uint;
    public var isPlaying:Boolean = false;

    private var loaders:Array/*AudioLoader*/ = [];
    private var soundChannel:SoundChannel;

    private var activeLoader:int = 0;
    private var position:Number = 0;
    private var lastUpdate:Number = 0;

    public function AudioPlayer(id:uint) {
        timer.start();

        timer.addEventListener(TimerEvent.TIMER, this.onTick);

        this.id = id;

        this.addLoader();
        this.addLoader();

        this.setActive(0);
    }

    private function addLoader():void {
        var loader:AudioLoader = new AudioLoader();

        loader.addEventListener(AudioEvent.EVENT_LOADING, this.onLoadStart);
        loader.addEventListener(AudioEvent.EVENT_PROGRESS, this.onProgress);
        loader.addEventListener(AudioEvent.EVENT_LOADED, this.onLoaded);
        loader.addEventListener(IOErrorEvent.IO_ERROR, this.onLoadError);

        this.loaders.push(loader);
    }

    private function setActive(offset:uint):void {
        this.activeLoader = (this.activeLoader + offset) % this.loaders.length;
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_SWAP, offset));

        if (offset !== 0) {
            //INFO: если релизовывать концепцию множества загрузчиков, то это нужно доработать.
            this.stop(offset);
        }
    }

    private function getLoader(offset:uint = 0):AudioLoader {
        return this.loaders[(this.activeLoader + offset) % this.loaders.length];
    }

    private function getOffset(loader:AudioLoader):uint {
        return (this.loaders.length + this.loaders.indexOf(loader) - this.activeLoader) % this.loaders.length;
    }

    private function onProgress(event:Event):void {
        var offset:uint = event !== null && this.getOffset(event.currentTarget as AudioLoader) || 0;
        if (offset === 0) {
            if (this.soundChannel is SoundChannel) {
                this.position = this.soundChannel.position;
            }
        }

        var currentTime:Number = new Date().valueOf();
        if (currentTime - this.lastUpdate < updateInterval) {
            return;
        }

        this.lastUpdate = currentTime;
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_PROGRESS, offset));
    }

    private function onTick(event:Event):void {
        this.onProgress(null);
    }

    private function onLoaded(event:Event):void {
        var offset:uint = this.getOffset(event.currentTarget as AudioLoader);
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_LOADED, offset));
    }

    private function onLoadError(event:IOErrorEvent):void {
        var offset:uint = this.getOffset(event.currentTarget as AudioLoader);
        this.stop(offset);
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_ERROR, offset, event.text));
    }

    private function onLoadStart(event:Event):void {
        var offset:uint = event !== null && this.getOffset(event.currentTarget as AudioLoader) || 0;
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_LOADING, offset));

        if (offset > 0 || !this.isPlaying) {
            return;
        }

        this.soundChannel = this.getLoader().sound.play(this.position);
        this.soundChannel.addEventListener(Event.SOUND_COMPLETE, this.onPlayEnd);
        timer.addEventListener(TimerEvent.TIMER, this.onTick);

        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_PLAY, 0));
    }

    private function onPlayEnd(event:Event):void {
        this.pause(false);

        this.position = this.getDuration() * 1000;

        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_PROGRESS, 0));
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_ENDED, 0));
    }

    public function play(src:String, duration:Number):void {
        if (this.isPlaying) {
            this.stop();
        }

        this.position = 0;
        this.isPlaying = true;
        var loader:AudioLoader = this.getLoader();
        loader.preloaded = "";
        loader.load(src, duration);
    }

    public function stop(offset:uint = 0):void {
        if (offset === 0) {
            this.pause(false);
        }

        this.getLoader(offset).abort();
        this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_STOP, offset));
    }

    public function pause(trigger:Boolean = true):void {
        this.isPlaying = false;

        timer.removeEventListener(TimerEvent.TIMER, this.onTick);

        if (this.soundChannel is SoundChannel) {
            this.position = this.soundChannel.position;
            this.soundChannel.removeEventListener(Event.SOUND_COMPLETE, this.onPlayEnd);
            this.soundChannel.stop();
            this.soundChannel = null;
        }

        if (trigger) {
            this.dispatchEvent(new AudioEvent(AudioEvent.EVENT_PAUSE, 0));
        }
    }

    public function resume():void {
        this.isPlaying = true;

        if (this.getLoader().isLoading) {
            this.onLoadStart(null);
        }
    }

    public function preload(src:String, duration:Number, offset:uint = 1):Boolean {
        if (this.loaders.length < offset + 1) {
            return false;
        }

        var loader:AudioLoader = this.getLoader(offset);
        loader.preloaded = src;
        loader.load(src, duration);

        return true;
    }

    public function isPreloaded(src:String, offset:uint = 1):Boolean {
        var loader:AudioLoader = this.getLoader(offset);
        if (loader.preloaded !== src) {
            return false;
        }

        return loader.loaded > 0;
    }

    public function isPreloading(src:String, offset:uint = 1):Boolean {
        var loader:AudioLoader = this.getLoader(offset);
        return loader.preloaded === src;
    }

    public function playPreloaded(offset:uint = 1):Boolean {
        if (this.loaders.length < 1 + offset) {
            return false;
        }
        var loader:AudioLoader = this.getLoader(offset);
        if (loader.preloaded == "") {
            return false;
        }

        this.setActive(offset);

        this.position = 0;
        this.resume();

        return true;
    }

    public function getPosition():Number {
        return this.position / 1000;
    }

    public function setPosition(position:Number):void {
        if (!this.isPlaying) {
            this.position = position * 1000;
        } else if (this.soundChannel is SoundChannel) {
            this.pause(false);
            this.position = position * 1000;
            this.resume();
        }
    }

    public function getDuration(offset:uint = 0):Number {
        return this.getLoader(offset).duration / 1000;
    }

    public function getLoaded(offset:uint = 0):Number {
        return this.getLoader(offset).loaded / 1000;
    }

    public function getSrc(offset:uint = 0):String {
        var loader:AudioLoader = this.getLoader(offset);
        return loader.src;
    }
}
}
