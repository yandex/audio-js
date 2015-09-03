var AudioStatic = {};

AudioStatic.EVENT_PLAY = "play";
AudioStatic.EVENT_STOP = "stop";

AudioStatic.EVENT_PAUSE = "pause";

AudioStatic.EVENT_PROGRESS = "progress";
AudioStatic.EVENT_LOADING = "loading";
AudioStatic.EVENT_LOADED = "loaded";

AudioStatic.EVENT_VOLUME = "volumechange";

AudioStatic.EVENT_ENDED = "ended";
AudioStatic.EVENT_CRASHED = "crashed";
AudioStatic.EVENT_ERROR = "error";

AudioStatic.EVENT_STATE = "state";
AudioStatic.EVENT_SWAP = "swap";

AudioStatic.PRELOADER_EVENT = "preloader:";

AudioStatic.STATE_INIT = "init";
AudioStatic.STATE_CRASHED = "crashed";
AudioStatic.STATE_IDLE = "idle";
AudioStatic.STATE_PLAYING = "playing";
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;
