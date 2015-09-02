window.deps = {
  "audio/index.js": {
    "deps": [
      "audio/export.js",
      "audio/logger/export.js",
      "audio/fx/equalizer/export.js"
    ]
  },
  "audio/fx/equalizer/export.js": {
    "deps": [
      "audio/fx/export.js",
      "audio/fx/equalizer/equalizer.js"
    ]
  },
  "audio/fx/equalizer/equalizer.js": {
    "deps": [
      "audio/lib/async/events.js",
      "audio/lib/class/proxy.js",
      "audio/fx/equalizer/winamp.presets.js"
    ]
  },
  "audio/fx/equalizer/winamp.presets.js": {
    "deps": []
  },
  "audio/lib/class/proxy.js": {
    "deps": [
      "audio/lib/async/events.js"
    ]
  },
  "audio/lib/async/events.js": {
    "deps": [
      "audio/lib/data/merge.js"
    ]
  },
  "audio/lib/data/merge.js": {
    "deps": []
  },
  "audio/fx/export.js": {
    "deps": [
      "audio/export.js"
    ]
  },
  "audio/export.js": {
    "deps": [
      "audio/config.js",
      "audio/audio-player.js",
      "audio/lib/class/proxy.js"
    ]
  },
  "audio/audio-player.js": {
    "deps": [
      "audio/logger/logger.js",
      "audio/lib/async/events.js",
      "audio/lib/async/deferred.js",
      "audio/lib/browser/detect.js",
      "audio/config.js",
      "audio/lib/data/merge.js",
      "audio/lib/async/reject.js",
      "audio/error/audio-error.js",
      "audio/audio-static.js",
      "audio/html5/audio-html5.js",
      "audio/flash/audio-flash.js"
    ]
  },
  "audio/flash/audio-flash.js": {
    "deps": [
      "audio/config.js",
      "audio/lib/browser/swfobject.js",
      "audio/lib/browser/detect.js",
      "audio/logger/logger.js",
      "audio/flash/flash-manager.js",
      "audio/flash/flash-interface.js",
      "audio/lib/async/events.js"
    ]
  },
  "audio/flash/flash-interface.js": {
    "deps": [
      "audio/logger/logger.js"
    ]
  },
  "audio/logger/logger.js": {
    "deps": []
  },
  "audio/flash/flash-manager.js": {
    "deps": [
      "audio/logger/logger.js",
      "audio/config.js",
      "audio/audio-static.js",
      "audio/flash/loader.js",
      "audio/flash/flash-interface.js",
      "audio/lib/async/deferred.js",
      "audio/error/audio-error.js",
      "audio/lib/net/error/loader-error.js"
    ]
  },
  "audio/lib/net/error/loader-error.js": {
    "deps": [
      "audio/lib/class/clear-instance.js"
    ]
  },
  "audio/lib/class/clear-instance.js": {
    "deps": []
  },
  "audio/error/audio-error.js": {
    "deps": [
      "audio/lib/class/clear-instance.js"
    ]
  },
  "audio/lib/async/deferred.js": {
    "deps": [
      "audio/lib/async/promise.js",
      "audio/lib/noop.js"
    ]
  },
  "audio/lib/noop.js": {
    "deps": []
  },
  "audio/lib/async/promise.js": {
    "deps": [
      "../../node_modules/vow/lib/vow.js",
      "audio/lib/browser/detect.js"
    ]
  },
  "audio/lib/browser/detect.js": {
    "deps": []
  },
  "../../node_modules/vow/lib/vow.js": {
    "deps": []
  },
  "audio/flash/loader.js": {
    "deps": [
      "audio/lib/browser/swfobject.js",
      "audio/flash/flashblocknotifier.js",
      "audio/flash/flashembedder.js",
      "audio/lib/browser/detect.js"
    ]
  },
  "audio/flash/flashembedder.js": {
    "deps": [
      "audio/lib/browser/swfobject.js"
    ]
  },
  "audio/lib/browser/swfobject.js": {
    "deps": []
  },
  "audio/flash/flashblocknotifier.js": {
    "deps": [
      "audio/lib/browser/swfobject.js"
    ]
  },
  "audio/audio-static.js": {
    "deps": []
  },
  "audio/config.js": {
    "deps": []
  },
  "audio/html5/audio-html5.js": {
    "deps": [
      "audio/logger/logger.js",
      "audio/lib/browser/detect.js",
      "audio/lib/async/events.js",
      "audio/audio-static.js"
    ]
  },
  "audio/lib/async/reject.js": {
    "deps": [
      "audio/lib/noop.js",
      "audio/lib/async/promise.js"
    ]
  },
  "audio/logger/export.js": {
    "deps": [
      "audio/export.js",
      "audio/logger/logger.js"
    ]
  }
};
