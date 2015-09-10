package {
import flash.display.Sprite;
import flash.display.StageAlign;
import flash.display.StageScaleMode;
import flash.events.MouseEvent;
import flash.external.ExternalInterface;
import flash.media.SoundMixer;
import flash.media.SoundTransform;
import flash.system.Security;

[SWF(width="10", height="10")]
public final class AudioManager extends Sprite {
    private static var players:Array/*.<AudioFlash>*/ = [];
    private static var volume:Number = 0;

    public static const EVENT_INIT:String = "init";
    public static const EVENT_CLICK:String = "click";
    public static const EVENT_FAIL:String = "failed";

    private static const FLASH2JS_CALLBACK:String = "ya.Audio._flashCallback";
    private static const JS2FLASH_CALLBACK:String = "call";

    public function AudioManager() {
        Security.allowDomain("*");

        try {
            ExternalInterface.addCallback(JS2FLASH_CALLBACK, this[JS2FLASH_CALLBACK]);
        } catch (error:Error) {
            jsCall(EVENT_FAIL, -1, -1, error.message);
        }

        this.addEventListener(MouseEvent.CLICK, onClick);

        stage.scaleMode = StageScaleMode.EXACT_FIT;
        stage.align = StageAlign.TOP_LEFT;

        var overlay:Sprite = new Sprite();
        overlay.x = 0;
        overlay.y = 0;
        overlay.useHandCursor = true;
        overlay.buttonMode = true;
        overlay.graphics.beginFill(0, 0);
        overlay.graphics.drawRect(0, 0, stage.stageWidth, stage.stageHeight);
        overlay.graphics.endFill();
        this.addChild(overlay);

        jsCall(EVENT_INIT);
    }

    private static function onClick(event:MouseEvent):void {
        jsCall(EVENT_CLICK);
    }

    private static function jsCall(eventName:String, id:int = -1, offset:int = -1, error:String = ""):void {
        try {
            ExternalInterface.call(FLASH2JS_CALLBACK, eventName, id, offset, error);
        } catch (error:Error) {
            trace(error.message);
        }
    }

    private static function delegateEvent(event:AudioEvent):void {
        var player:int = players.indexOf(event.currentTarget);
        jsCall(event.type, player, event.offset, event.data);
    }

    public function call(methodName:String, id:int = -1, ...args):* {
        if (id !== -1) {
            var player:AudioPlayer = players[id];
            if (!player) {
                jsCall(AudioEvent.EVENT_ERROR, id, -1, "no such player");
                return null;
            }

            if (typeof player[methodName] === "function") {
                return player[methodName].apply(player, args);
            } else {
                jsCall(AudioEvent.EVENT_ERROR, id, -1, "no such method");
                return null;
            }
        } else {
            if (typeof this["export_" + methodName] === "function") {
                return this["export_" + methodName].apply(this, args);
            } else {
                jsCall(AudioEvent.EVENT_ERROR, id, -1, "no such method");
                return null;
            }
        }
    }

    private function export_addPlayer():uint {
        var player:AudioPlayer = new AudioPlayer(players.length);

        player.addEventListener(AudioEvent.EVENT_PLAY, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_PAUSE, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_ENDED, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_PROGRESS, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_ERROR, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_STOP, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_LOADED, delegateEvent);
        player.addEventListener(AudioEvent.EVENT_LOADING, delegateEvent);

        player.addEventListener(AudioEvent.EVENT_DEBUG, delegateEvent);

        players.push(player);
        return player.id;
    }

    private function export_setVolume(value:Number):void {
        value = Math.max(0, Math.min(1, value));
        if (0 < value && value < 0.01) {
            value = 0.01;
        }
        volume = value;
        SoundMixer.soundTransform = new SoundTransform(value, 0);
        jsCall(AudioEvent.EVENT_VOLUME);
    }

    private function export_getVolume():Number {
        return volume;
    }

    private function export_heartBeat():Boolean {
        return true;
    }
}
}
