(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
(function (process){
/**
 * @module vow
 * @author Filatov Dmitry <dfilatov@yandex-team.ru>
 * @version 0.4.10
 * @license
 * Dual licensed under the MIT and GPL licenses:
 *   * http://www.opensource.org/licenses/mit-license.php
 *   * http://www.gnu.org/licenses/gpl.html
 */

(function(global) {

var undef,
    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof setImmediate === 'function') { // ie10, nodejs >= 0.10
            return function(fn) {
                enqueueFn(fn) && setImmediate(callFns);
            };
        }

        if(typeof process === 'object' && process.nextTick) { // nodejs < 0.10
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        var MutationObserver = global.MutationObserver || global.WebKitMutationObserver; // modern browsers
        if(MutationObserver) {
            var num = 1,
                node = document.createTextNode('');

            new MutationObserver(callFns).observe(node, { characterData : true });

            return function(fn) {
                enqueueFn(fn) && (node.data = (num *= -1));
            };
        }

        if(global.postMessage) {
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__promise' + +new Date,
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                };
                (doc.documentElement || doc.body).appendChild(script);
            };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })(),
    throwException = function(e) {
        nextTick(function() {
            throw e;
        });
    },
    isFunction = function(obj) {
        return typeof obj === 'function';
    },
    isObject = function(obj) {
        return obj !== null && typeof obj === 'object';
    },
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    getArrayKeys = function(arr) {
        var res = [],
            i = 0, len = arr.length;
        while(i < len) {
            res.push(i++);
        }
        return res;
    },
    getObjectKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            obj.hasOwnProperty(i) && res.push(i);
        }
        return res;
    },
    defineCustomErrorType = function(name) {
        var res = function(message) {
            this.name = name;
            this.message = message;
        };

        res.prototype = new Error();

        return res;
    },
    wrapOnFulfilled = function(onFulfilled, idx) {
        return function(val) {
            onFulfilled.call(this, val, idx);
        };
    };

/**
 * @class Deferred
 * @exports vow:Deferred
 * @description
 * The `Deferred` class is used to encapsulate newly-created promise object along with functions that resolve, reject or notify it.
 */

/**
 * @constructor
 * @description
 * You can use `vow.defer()` instead of using this constructor.
 *
 * `new vow.Deferred()` gives the same result as `vow.defer()`.
 */
var Deferred = function() {
    this._promise = new Promise();
};

Deferred.prototype = /** @lends Deferred.prototype */{
    /**
     * Returns the corresponding promise.
     *
     * @returns {vow:Promise}
     */
    promise : function() {
        return this._promise;
    },

    /**
     * Resolves the corresponding promise with the given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.then(function(value) {
     *     // value is "'success'" here
     * });
     *
     * defer.resolve('success');
     * ```
     */
    resolve : function(value) {
        this._promise.isResolved() || this._promise._resolve(value);
    },

    /**
     * Rejects the corresponding promise with the given `reason`.
     *
     * @param {*} reason
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.fail(function(reason) {
     *     // reason is "'something is wrong'" here
     * });
     *
     * defer.reject('something is wrong');
     * ```
     */
    reject : function(reason) {
        if(this._promise.isResolved()) {
            return;
        }

        if(vow.isPromise(reason)) {
            reason = reason.then(function(val) {
                var defer = vow.defer();
                defer.reject(val);
                return defer.promise();
            });
            this._promise._resolve(reason);
        }
        else {
            this._promise._reject(reason);
        }
    },

    /**
     * Notifies the corresponding promise with the given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.progress(function(value) {
     *     // value is "'20%'", "'40%'" here
     * });
     *
     * defer.notify('20%');
     * defer.notify('40%');
     * ```
     */
    notify : function(value) {
        this._promise.isResolved() || this._promise._notify(value);
    }
};

var PROMISE_STATUS = {
    PENDING   : 0,
    RESOLVED  : 1,
    FULFILLED : 2,
    REJECTED  : 3
};

/**
 * @class Promise
 * @exports vow:Promise
 * @description
 * The `Promise` class is used when you want to give to the caller something to subscribe to,
 * but not the ability to resolve or reject the deferred.
 */

/**
 * @constructor
 * @param {Function} resolver See https://github.com/domenic/promises-unwrapping/blob/master/README.md#the-promise-constructor for details.
 * @description
 * You should use this constructor directly only if you are going to use `vow` as DOM Promises implementation.
 * In other case you should use `vow.defer()` and `defer.promise()` methods.
 * @example
 * ```js
 * function fetchJSON(url) {
 *     return new vow.Promise(function(resolve, reject, notify) {
 *         var xhr = new XMLHttpRequest();
 *         xhr.open('GET', url);
 *         xhr.responseType = 'json';
 *         xhr.send();
 *         xhr.onload = function() {
 *             if(xhr.response) {
 *                 resolve(xhr.response);
 *             }
 *             else {
 *                 reject(new TypeError());
 *             }
 *         };
 *     });
 * }
 * ```
 */
var Promise = function(resolver) {
    this._value = undef;
    this._status = PROMISE_STATUS.PENDING;

    this._fulfilledCallbacks = [];
    this._rejectedCallbacks = [];
    this._progressCallbacks = [];

    if(resolver) { // NOTE: see https://github.com/domenic/promises-unwrapping/blob/master/README.md
        var _this = this,
            resolverFnLen = resolver.length;

        resolver(
            function(val) {
                _this.isResolved() || _this._resolve(val);
            },
            resolverFnLen > 1?
                function(reason) {
                    _this.isResolved() || _this._reject(reason);
                } :
                undef,
            resolverFnLen > 2?
                function(val) {
                    _this.isResolved() || _this._notify(val);
                } :
                undef);
    }
};

Promise.prototype = /** @lends Promise.prototype */ {
    /**
     * Returns the value of the fulfilled promise or the reason in case of rejection.
     *
     * @returns {*}
     */
    valueOf : function() {
        return this._value;
    },

    /**
     * Returns `true` if the promise is resolved.
     *
     * @returns {Boolean}
     */
    isResolved : function() {
        return this._status !== PROMISE_STATUS.PENDING;
    },

    /**
     * Returns `true` if the promise is fulfilled.
     *
     * @returns {Boolean}
     */
    isFulfilled : function() {
        return this._status === PROMISE_STATUS.FULFILLED;
    },

    /**
     * Returns `true` if the promise is rejected.
     *
     * @returns {Boolean}
     */
    isRejected : function() {
        return this._status === PROMISE_STATUS.REJECTED;
    },

    /**
     * Adds reactions to the promise.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise} A new promise, see https://github.com/promises-aplus/promises-spec for details
     */
    then : function(onFulfilled, onRejected, onProgress, ctx) {
        var defer = new Deferred();
        this._addCallbacks(defer, onFulfilled, onRejected, onProgress, ctx);
        return defer.promise();
    },

    /**
     * Adds only a rejection reaction. This method is a shorthand for `promise.then(undefined, onRejected)`.
     *
     * @param {Function} onRejected Callback that will be called with a provided 'reason' as argument after the promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    'catch' : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds only a rejection reaction. This method is a shorthand for `promise.then(null, onRejected)`. It's also an alias for `catch`.
     *
     * @param {Function} onRejected Callback to be called with the value after promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    fail : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds a resolving reaction (for both fulfillment and rejection).
     *
     * @param {Function} onResolved Callback that will be invoked with the promise as an argument, after the promise has been resolved.
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    always : function(onResolved, ctx) {
        var _this = this,
            cb = function() {
                return onResolved.call(this, _this);
            };

        return this.then(cb, cb, ctx);
    },

    /**
     * Adds a progress reaction.
     *
     * @param {Function} onProgress Callback that will be called with a provided value when the promise has been notified
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    progress : function(onProgress, ctx) {
        return this.then(undef, undef, onProgress, ctx);
    },

    /**
     * Like `promise.then`, but "spreads" the array into a variadic value handler.
     * It is useful with the `vow.all` and the `vow.allResolved` methods.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise()]).spread(function(arg1, arg2) {
     *     // arg1 is "1", arg2 is "'two'" here
     * });
     *
     * defer1.resolve(1);
     * defer2.resolve('two');
     * ```
     */
    spread : function(onFulfilled, onRejected, ctx) {
        return this.then(
            function(val) {
                return onFulfilled.apply(this, val);
            },
            onRejected,
            ctx);
    },

    /**
     * Like `then`, but terminates a chain of promises.
     * If the promise has been rejected, this method throws it's "reason" as an exception in a future turn of the event loop.
     *
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     *
     * @example
     * ```js
     * var defer = vow.defer();
     * defer.reject(Error('Internal error'));
     * defer.promise().done(); // exception to be thrown
     * ```
     */
    done : function(onFulfilled, onRejected, onProgress, ctx) {
        this
            .then(onFulfilled, onRejected, onProgress, ctx)
            .fail(throwException);
    },

    /**
     * Returns a new promise that will be fulfilled in `delay` milliseconds if the promise is fulfilled,
     * or immediately rejected if the promise is rejected.
     *
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(delay) {
        var timer,
            promise = this.then(function(val) {
                var defer = new Deferred();
                timer = setTimeout(
                    function() {
                        defer.resolve(val);
                    },
                    delay);

                return defer.promise();
            });

        promise.always(function() {
            clearTimeout(timer);
        });

        return promise;
    },

    /**
     * Returns a new promise that will be rejected in `timeout` milliseconds
     * if the promise is not resolved beforehand.
     *
     * @param {Number} timeout
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promiseWithTimeout1 = defer.promise().timeout(50),
     *     promiseWithTimeout2 = defer.promise().timeout(200);
     *
     * setTimeout(
     *     function() {
     *         defer.resolve('ok');
     *     },
     *     100);
     *
     * promiseWithTimeout1.fail(function(reason) {
     *     // promiseWithTimeout to be rejected in 50ms
     * });
     *
     * promiseWithTimeout2.then(function(value) {
     *     // promiseWithTimeout to be fulfilled with "'ok'" value
     * });
     * ```
     */
    timeout : function(timeout) {
        var defer = new Deferred(),
            timer = setTimeout(
                function() {
                    defer.reject(new vow.TimedOutError('timed out'));
                },
                timeout);

        this.then(
            function(val) {
                defer.resolve(val);
            },
            function(reason) {
                defer.reject(reason);
            });

        defer.promise().always(function() {
            clearTimeout(timer);
        });

        return defer.promise();
    },

    _vow : true,

    _resolve : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        if(val === this) {
            this._reject(TypeError('Can\'t resolve promise with itself'));
            return;
        }

        this._status = PROMISE_STATUS.RESOLVED;

        if(val && !!val._vow) { // shortpath for vow.Promise
            val.isFulfilled()?
                this._fulfill(val.valueOf()) :
                val.isRejected()?
                    this._reject(val.valueOf()) :
                    val.then(
                        this._fulfill,
                        this._reject,
                        this._notify,
                        this);
            return;
        }

        if(isObject(val) || isFunction(val)) {
            var then;
            try {
                then = val.then;
            }
            catch(e) {
                this._reject(e);
                return;
            }

            if(isFunction(then)) {
                var _this = this,
                    isResolved = false;

                try {
                    then.call(
                        val,
                        function(val) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._resolve(val);
                        },
                        function(err) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._reject(err);
                        },
                        function(val) {
                            _this._notify(val);
                        });
                }
                catch(e) {
                    isResolved || this._reject(e);
                }

                return;
            }
        }

        this._fulfill(val);
    },

    _fulfill : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.FULFILLED;
        this._value = val;

        this._callCallbacks(this._fulfilledCallbacks, val);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _reject : function(reason) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.REJECTED;
        this._value = reason;

        this._callCallbacks(this._rejectedCallbacks, reason);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _notify : function(val) {
        this._callCallbacks(this._progressCallbacks, val);
    },

    _addCallbacks : function(defer, onFulfilled, onRejected, onProgress, ctx) {
        if(onRejected && !isFunction(onRejected)) {
            ctx = onRejected;
            onRejected = undef;
        }
        else if(onProgress && !isFunction(onProgress)) {
            ctx = onProgress;
            onProgress = undef;
        }

        var cb;

        if(!this.isRejected()) {
            cb = { defer : defer, fn : isFunction(onFulfilled)? onFulfilled : undef, ctx : ctx };
            this.isFulfilled()?
                this._callCallbacks([cb], this._value) :
                this._fulfilledCallbacks.push(cb);
        }

        if(!this.isFulfilled()) {
            cb = { defer : defer, fn : onRejected, ctx : ctx };
            this.isRejected()?
                this._callCallbacks([cb], this._value) :
                this._rejectedCallbacks.push(cb);
        }

        if(this._status <= PROMISE_STATUS.RESOLVED) {
            this._progressCallbacks.push({ defer : defer, fn : onProgress, ctx : ctx });
        }
    },

    _callCallbacks : function(callbacks, arg) {
        var len = callbacks.length;
        if(!len) {
            return;
        }

        var isResolved = this.isResolved(),
            isFulfilled = this.isFulfilled();

        nextTick(function() {
            var i = 0, cb, defer, fn;
            while(i < len) {
                cb = callbacks[i++];
                defer = cb.defer;
                fn = cb.fn;

                if(fn) {
                    var ctx = cb.ctx,
                        res;
                    try {
                        res = ctx? fn.call(ctx, arg) : fn(arg);
                    }
                    catch(e) {
                        defer.reject(e);
                        continue;
                    }

                    isResolved?
                        defer.resolve(res) :
                        defer.notify(res);
                }
                else {
                    isResolved?
                        isFulfilled?
                            defer.resolve(arg) :
                            defer.reject(arg) :
                        defer.notify(arg);
                }
            }
        });
    }
};

/** @lends Promise */
var staticMethods = {
    /**
     * Coerces the given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return vow.cast(value);
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, then the returned promise will be rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     */
    all : function(iterable) {
        return vow.all(iterable);
    },

    /**
     * Returns a promise, that will be fulfilled only when any of the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, then the returned promise will be rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    race : function(iterable) {
        return vow.anyResolved(iterable);
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, the returned promise will have `value`'s state.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        return vow.resolve(value);
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        return vow.reject(reason);
    }
};

for(var prop in staticMethods) {
    staticMethods.hasOwnProperty(prop) &&
        (Promise[prop] = staticMethods[prop]);
}

var vow = /** @exports vow */ {
    Deferred : Deferred,

    Promise : Promise,

    /**
     * Creates a new deferred. This method is a factory method for `vow:Deferred` class.
     * It's equivalent to `new vow.Deferred()`.
     *
     * @returns {vow:Deferred}
     */
    defer : function() {
        return new Deferred();
    },

    /**
     * Static equivalent to `promise.then`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     */
    when : function(value, onFulfilled, onRejected, onProgress, ctx) {
        return vow.cast(value).then(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.fail`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onRejected Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    fail : function(value, onRejected, ctx) {
        return vow.when(value, undef, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.always`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onResolved Callback that will be invoked with the promise as an argument, after the promise has been resolved.
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    always : function(value, onResolved, ctx) {
        return vow.when(value).always(onResolved, ctx);
    },

    /**
     * Static equivalent to `promise.progress`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onProgress Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callback execution
     * @returns {vow:Promise}
     */
    progress : function(value, onProgress, ctx) {
        return vow.when(value).progress(onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.spread`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Object} [ctx] Context of the callbacks execution
     * @returns {vow:Promise}
     */
    spread : function(value, onFulfilled, onRejected, ctx) {
        return vow.when(value).spread(onFulfilled, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.done`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will be invoked with a provided value after the promise has been fulfilled
     * @param {Function} [onRejected] Callback that will be invoked with a provided reason after the promise has been rejected
     * @param {Function} [onProgress] Callback that will be invoked with a provided value after the promise has been notified
     * @param {Object} [ctx] Context of the callbacks execution
     */
    done : function(value, onFulfilled, onRejected, onProgress, ctx) {
        vow.when(value).done(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Checks whether the given `value` is a promise-like object
     *
     * @param {*} value
     * @returns {Boolean}
     *
     * @example
     * ```js
     * vow.isPromise('something'); // returns false
     * vow.isPromise(vow.defer().promise()); // returns true
     * vow.isPromise({ then : function() { }); // returns true
     * ```
     */
    isPromise : function(value) {
        return isObject(value) && isFunction(value.then);
    },

    /**
     * Coerces the given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return value && !!value._vow?
            value :
            vow.resolve(value);
    },

    /**
     * Static equivalent to `promise.valueOf`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {*}
     */
    valueOf : function(value) {
        return value && isFunction(value.valueOf)? value.valueOf() : value;
    },

    /**
     * Static equivalent to `promise.isFulfilled`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isFulfilled : function(value) {
        return value && isFunction(value.isFulfilled)? value.isFulfilled() : true;
    },

    /**
     * Static equivalent to `promise.isRejected`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isRejected : function(value) {
        return value && isFunction(value.isRejected)? value.isRejected() : false;
    },

    /**
     * Static equivalent to `promise.isResolved`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isResolved : function(value) {
        return value && isFunction(value.isResolved)? value.isResolved() : true;
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, the returned promise will have `value`'s state.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        var res = vow.defer();
        res.resolve(value);
        return res.promise();
    },

    /**
     * Returns a promise that has already been fulfilled with the given `value`.
     * If `value` is a promise, the returned promise will be fulfilled with the fulfill/rejection value of `value`.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    fulfill : function(value) {
        var defer = vow.defer(),
            promise = defer.promise();

        defer.resolve(value);

        return promise.isFulfilled()?
            promise :
            promise.then(null, function(reason) {
                return reason;
            });
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     * If `reason` is a promise, the returned promise will be rejected with the fulfill/rejection value of `reason`.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        var defer = vow.defer();
        defer.reject(reason);
        return defer.promise();
    },

    /**
     * Invokes the given function `fn` with arguments `args`
     *
     * @param {Function} fn
     * @param {...*} [args]
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var promise1 = vow.invoke(function(value) {
     *         return value;
     *     }, 'ok'),
     *     promise2 = vow.invoke(function() {
     *         throw Error();
     *     });
     *
     * promise1.isFulfilled(); // true
     * promise1.valueOf(); // 'ok'
     * promise2.isRejected(); // true
     * promise2.valueOf(); // instance of Error
     * ```
     */
    invoke : function(fn, args) {
        var len = Math.max(arguments.length - 1, 0),
            callArgs;
        if(len) { // optimization for V8
            callArgs = Array(len);
            var i = 0;
            while(i < len) {
                callArgs[i++] = arguments[i];
            }
        }

        try {
            return vow.resolve(callArgs?
                fn.apply(global, callArgs) :
                fn.call(global));
        }
        catch(e) {
            return vow.reject(e);
        }
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are fulfilled.
     * If any of the `iterable` items gets rejected, the promise will be rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * with array:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise(), 3])
     *     .then(function(value) {
     *          // value is "[1, 2, 3]" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     *
     * @example
     * with object:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all({ p1 : defer1.promise(), p2 : defer2.promise(), p3 : 3 })
     *     .then(function(value) {
     *          // value is "{ p1 : 1, p2 : 2, p3 : 3 }" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     */
    all : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            len = keys.length,
            res = isPromisesArray? [] : {};

        if(!len) {
            defer.resolve(res);
            return defer.promise();
        }

        var i = len;
        vow._forEach(
            iterable,
            function(value, idx) {
                res[keys[idx]] = value;
                if(!--i) {
                    defer.resolve(res);
                }
            },
            defer.reject,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    /**
     * Returns a promise, that will be fulfilled only after all the items in `iterable` are resolved.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.allResolved([defer1.promise(), defer2.promise()]).spread(function(promise1, promise2) {
     *     promise1.isRejected(); // returns true
     *     promise1.valueOf(); // returns "'error'"
     *     promise2.isFulfilled(); // returns true
     *     promise2.valueOf(); // returns "'ok'"
     * });
     *
     * defer1.reject('error');
     * defer2.resolve('ok');
     * ```
     */
    allResolved : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            i = keys.length,
            res = isPromisesArray? [] : {};

        if(!i) {
            defer.resolve(res);
            return defer.promise();
        }

        var onResolved = function() {
                --i || defer.resolve(iterable);
            };

        vow._forEach(
            iterable,
            onResolved,
            onResolved,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    allPatiently : function(iterable) {
        return vow.allResolved(iterable).then(function() {
            var isPromisesArray = isArray(iterable),
                keys = isPromisesArray?
                    getArrayKeys(iterable) :
                    getObjectKeys(iterable),
                rejectedPromises, fulfilledPromises,
                len = keys.length, i = 0, key, promise;

            if(!len) {
                return isPromisesArray? [] : {};
            }

            while(i < len) {
                key = keys[i++];
                promise = iterable[key];
                if(vow.isRejected(promise)) {
                    rejectedPromises || (rejectedPromises = isPromisesArray? [] : {});
                    isPromisesArray?
                        rejectedPromises.push(promise.valueOf()) :
                        rejectedPromises[key] = promise.valueOf();
                }
                else if(!rejectedPromises) {
                    (fulfilledPromises || (fulfilledPromises = isPromisesArray? [] : {}))[key] = vow.valueOf(promise);
                }
            }

            if(rejectedPromises) {
                throw rejectedPromises;
            }

            return fulfilledPromises;
        });
    },

    /**
     * Returns a promise, that will be fulfilled if any of the items in `iterable` is fulfilled.
     * If all of the `iterable` items get rejected, the promise will be rejected (with the reason of the first rejected item).
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    any : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        var i = 0, reason;
        vow._forEach(
            iterable,
            defer.resolve,
            function(e) {
                i || (reason = e);
                ++i === len && defer.reject(reason);
            },
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Returns a promise, that will be fulfilled only when any of the items in `iterable` is fulfilled.
     * If any of the `iterable` items gets rejected, the promise will be rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    anyResolved : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        vow._forEach(
            iterable,
            defer.resolve,
            defer.reject,
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Static equivalent to `promise.delay`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(value, delay) {
        return vow.resolve(value).delay(delay);
    },

    /**
     * Static equivalent to `promise.timeout`.
     * If `value` is not a promise, then `value` is treated as a fulfilled promise.
     *
     * @param {*} value
     * @param {Number} timeout
     * @returns {vow:Promise}
     */
    timeout : function(value, timeout) {
        return vow.resolve(value).timeout(timeout);
    },

    _forEach : function(promises, onFulfilled, onRejected, onProgress, ctx, keys) {
        var len = keys? keys.length : promises.length,
            i = 0;

        while(i < len) {
            vow.when(
                promises[keys? keys[i] : i],
                wrapOnFulfilled(onFulfilled, i),
                onRejected,
                onProgress,
                ctx);
            ++i;
        }
    },

    TimedOutError : defineCustomErrorType('TimedOut')
};

var defineAsGlobal = true;
if(typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = vow;
    defineAsGlobal = false;
}

if(typeof modules === 'object' && isFunction(modules.define)) {
    modules.define('vow', function(provide) {
        provide(vow);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = vow;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.vow = vow);

})(this);

}).call(this,require('_process'))

},{"_process":1}],3:[function(require,module,exports){
var Logger = require('./logger/logger');
var logger = new Logger('AudioPlayer');

var Events = require('./lib/async/events');
var Deferred = require('./lib/async/deferred');
var detect = require('./lib/browser/detect');
var config = require('./config');
var merge = require('./lib/data/merge');
var reject = require('./lib/async/reject');

var AudioError = require('./error/audio-error');
var AudioStatic = require('./audio-static');

var playerId = 1;

//TODO: сделать интерфейс для возможности подключения новых типов
var audioTypes = {
    html5: require('./html5/audio-html5'),
    flash: require('./flash/audio-flash')
};

var detectString = "@" + detect.platform.version +
    " " + detect.platform.os +
    ":" + detect.browser.name +
    "/" + detect.browser.version;

audioTypes.flash.priority = 0;
audioTypes.html5.priority = config.html5.blacklist.some(function(item) { return detectString.match(item); }) ? -1 : 1;

logger.debug(null, "audioTypes", audioTypes);

/** Описание временных данных плеера
 * @typedef {Object} ya.Audio~AudioPlayerTimes
 *
 * @property {Number} duration - длительность трека
 * @property {Number} loaded - длительность загруженной части
 * @property {Number} position - позиция воспроизведения
 * @property {Number} played - длительность воспроизведения
 */

//------------------------------------------------------------------------- Common Events
/** Событие начала воспроизведения ({@link ya.Audio.EVENT_PLAY})
 * @event ya.Audio#play
 */
/** Событие завершения воспроизведения ({@link ya.Audio.EVENT_ENDED})
 * @event ya.Audio#ended
 */
/** Событие изменения громкости ({@link ya.Audio.EVENT_VOLUME})
 * @event ya.Audio#volumechange
 * @param {Number} volume - громкость
 */
/** Событие краха плеера ({@link ya.Audio.EVENT_CRASHED})
 * @event ya.Audio#crashed
 */
/** Событие смены статуса плеера ({@link ya.Audio.EVENT_STATE})
 * @event ya.Audio#state
 * @param {String} state - новый статус плеера
 */
/** Событие переключения активного плеера и прелоадера ({@link ya.Audio.EVENT_SWAP})
 * @event ya.Audio#swap
 */

//------------------------------------------------------------------------- Active Events
/** Событие остановки воспроизведения ({@link ya.Audio.EVENT_STOP})
 * @event ya.Audio#stop
 */
/** Событие начала воспроизведения ({@link ya.Audio.EVENT_PAUSE})
 * @event ya.Audio#pause
 */
/** Событие обновления позиции воспроизведения/загруженной части ({@link ya.Audio.EVENT_PROGRESS})
 * @event ya.Audio#progress
 * @param {ya.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека ({@link ya.Audio.EVENT_LOADING})
 * @event ya.Audio#loading
 */
/** Событие завершения загрузки трека ({@link ya.Audio.EVENT_LOADED})
 * @event ya.Audio#loaded
 */
/** Событие ошибки воспроизведения ({@link ya.Audio.EVENT_ERROR})
 * @event ya.Audio#error
 */

//------------------------------------------------------------------------- Preloader Events
/** Событие остановки воспроизведения ({@link ya.Audio.EVENT_STOP})
 * @event ya.Audio#preloader:stop
 */
/** Событие начала воспроизведения ({@link ya.Audio.EVENT_PAUSE})
 * @event ya.Audio#preloader:pause
 */
/** Событие обновления позиции воспроизведения/загруженной части ({@link ya.Audio.EVENT_PROGRESS})
 * @event ya.Audio#preloader:progress
 * @param {ya.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека ({@link ya.Audio.EVENT_LOADING})
 * @event ya.Audio#preloader:loading
 */
/** Событие завершения загрузки трека ({@link ya.Audio.EVENT_LOADED})
 * @event ya.Audio#preloader:loaded
 */
/** Событие ошибки воспроизведения ({@link ya.Audio.EVENT_ERROR})
 * @event ya.Audio#preloader:error
 */

/**
 * @class Аудио-плеер для браузера.
 * @alias ya.Audio
 * @param {String} [preferredType] - preferred player type (html5/flash)
 * @param {HTMLElement} [overlay] - dom element to show flash
 *
 * @extends Events
 * @mixes AudioStatic
 *
 * @fires ya.Audio#play
 * @fires ya.Audio#ended
 * @fires ya.Audio#volumechange
 * @fires ya.Audio#crashed
 * @fires ya.Audio#state
 * @fires ya.Audio#swap
 *
 * @fires ya.Audio#stop
 * @fires ya.Audio#pause
 * @fires ya.Audio#progress
 * @fires ya.Audio#loading
 * @fires ya.Audio#loaded
 * @fires ya.Audio#error
 *
 * @fires ya.Audio#preloader:stop
 * @fires ya.Audio#preloader:pause
 * @fires ya.Audio#preloader:progress
 * @fires ya.Audio#preloader:loading
 * @fires ya.Audio#preloader:loaded
 * @fires ya.Audio#preloader:error
 *
 * @constructor
 */
var AudioPlayer = function(preferredType, overlay) {
    this.name = playerId++;
    logger.debug(this, "constructor");

    Events.call(this);

    this.preferredType = preferredType;
    this.overlay = overlay;
    this.state = AudioPlayer.STATE_INIT;
    this._played = 0;
    this._lastSkip = 0;
    this._playId = null;

    this._whenReady = new Deferred();
    this.whenReady = this._whenReady.promise().then(function() {
        logger.info(this, "implementation found", this.implementation.type);

        this.implementation.on("*", function(event, offset, data) {
            this._populateEvents(event, offset, data);

            if (!offset) {
                switch (event) {
                    case AudioPlayer.EVENT_PLAY:
                        this._setState(AudioPlayer.STATE_PLAYING);
                        break;

                    case AudioPlayer.EVENT_SWAP:
                    case AudioPlayer.EVENT_STOP:
                    case AudioPlayer.EVENT_ENDED:
                    case AudioPlayer.EVENT_ERROR:
                        this._setState(AudioPlayer.STATE_IDLE);
                        break;

                    case AudioPlayer.EVENT_PAUSE:
                        this._setState(AudioPlayer.STATE_PAUSED);
                        break;

                    case AudioPlayer.EVENT_CRASHED:
                        this._setState(AudioPlayer.STATE_CRASHED);
                        break;
                }
            }
        }.bind(this));

        this._setState(AudioPlayer.STATE_IDLE);
    }.bind(this), function(e) {
        logger.error(this, AudioError.NO_IMPLEMENTATION, e);

        this._setState(AudioPlayer.STATE_CRASHED);
        throw e;
    }.bind(this));

    this._init(0);
};
Events.mixin(AudioPlayer);
merge(AudioPlayer, AudioStatic, true);

/**
 * Список доступных плееров
 * @type {Object}
 * @static
 */
AudioPlayer.info = {
    html5: audioTypes.html5.available,
    flash: audioTypes.flash.available
};

/**
 * Контекст для Web Audio API
 * @type {AudioContext}
 * @static
 */
AudioPlayer.audioContext = audioTypes.html5.audioContext;

/**
 * Установить статус плеера
 * @param {String} state - новый статус
 * @private
 */
AudioPlayer.prototype._setState = function(state) {
    logger.debug(this, "_setState", state);

    var changed = this.state !== state;
    this.state = state;

    if (changed) {
        logger.info(this, "newState", state);
        this.trigger(AudioPlayer.EVENT_STATE, state);
    }
};

/**
 * Инициализация плеера
 * @param {int} [retry=0] - количество попыток
 * @private
 */
AudioPlayer.prototype._init = function(retry) {
    retry = retry || 0;
    logger.info(this, "_init", retry);

    if (!this._whenReady.pending) {
        return;
    }

    if (retry > config.audio.retry) {
        logger.error(this, AudioError.NO_IMPLEMENTATION);
        this._whenReady.reject(new AudioError(AudioError.NO_IMPLEMENTATION));
    }

    var initSeq = [
        audioTypes.html5,
        audioTypes.flash
    ].sort(function(a, b) {
            if (a.available !== b.available) {
                return a.available ? -1 : 1;
            }

            if (a.AudioImplementation.type === this.preferredType) {
                return -1;
            }

            if (b.AudioImplementation.type === this.preferredType) {
                return 1;
            }

            return b.priority - a.priority;
        }.bind(this));

    var self = this;

    function init() {
        var type = initSeq.shift();

        if (!type) {
            self._init(retry + 1);
            return;
        }

        self._initType(type).then(self._whenReady.resolve, init);
    }

    init();
};

/**
 * Запуск реализации плеера с указанным типом
 * @param {{type: string, AudioImplementation: function}} type - объект описания типа инициализации.
 * @returns {Promise}
 * @private
 */
AudioPlayer.prototype._initType = function(type) {
    logger.info(this, "_initType", type);

    var deferred = new Deferred();
    try {
        /**
         * Текущая реализация аудио-плеера
         * @type {IAudioImplementation|null}
         * @private
         */
        this.implementation = new type.AudioImplementation(this.overlay);
        if (this.implementation.whenReady) {
            this.implementation.whenReady.then(deferred.resolve, deferred.reject);
        } else {
            deferred.resolve();
        }
    } catch(e) {
        deferred.reject(e);
        logger.warn(this, "_initTypeError", type, e);
    }

    return deferred.promise();
};

/**
 * Создание обещания, которое разрешается при одном из списка событий
 * @param {String} action - название действия
 * @param {Array.<String>} resolve - список ожидаемых событий для разрешения обещания
 * @param {Array.<String>} reject - список ожидаемый событий для отклонения обещания
 * @returns {Promise} -- также создаёт Deferred свойство с названием _when<Action>, которое живёт до момента разрешения
 * @private
 */
AudioPlayer.prototype._waitEvents = function(action, resolve, reject) {
    var deferred = new Deferred();
    var self = this;

    this[action] = deferred;

    var cleanupEvents = function() {
        resolve.forEach(function(event) {
            self.off(event, deferred.resolve);
        });
        reject.forEach(function(event) {
            self.off(event, deferred.reject);
        });
        delete self[action];
    };

    resolve.forEach(function(event) {
        self.on(event, deferred.resolve);
    });

    reject.forEach(function(event) {
        self.on(event, function(data) {
            var error = data instanceof Error ? data : new AudioError(data || event);
            deferred.reject(error);
        });
    });

    deferred.promise().then(cleanupEvents, cleanupEvents);

    return deferred.promise();
};

/**
 * Расширение событий аудио-плеера дополнительными свойствами. Подписывается на все события аудио-плеера,
 * триггерит итоговые события, разделяя их по типу активный плеер или прелоадер, дополняет события данными.
 * @param {String} event - событие
 * @param {int} offset - источник события. 0 - активный плеер. 1 - прелоадер.
 * @param {*} data - дополнительные данные события.
 * @private
 */
AudioPlayer.prototype._populateEvents = function(event, offset, data) {
    if (event !== AudioPlayer.EVENT_PROGRESS) {
        logger.debug(this, "_populateEvents", event, offset, data);
    }

    var outerEvent = (offset ? AudioPlayer.PRELOADER_EVENT : "") + event;

    switch (event) {
        case AudioPlayer.EVENT_CRASHED:
        case AudioPlayer.EVENT_SWAP:
            this.trigger(event, data);
            break;
        case AudioPlayer.EVENT_ERROR:
            this.trigger(outerEvent, data);
            break;
        case AudioPlayer.EVENT_VOLUME:
            this.trigger(event, this.getVolume());
            break;
        case AudioPlayer.EVENT_PROGRESS:
            this.trigger(outerEvent, {
                duration: this.getDuration(offset),
                loaded: this.getLoaded(offset),
                position: offset ? 0 : this.getPosition(),
                played: offset ? 0 : this.getPlayed()
            });
            break;
        default:
            this.trigger(outerEvent);
            break;
    }
};

/**
 * Генерация playId
 * @private
 */
AudioPlayer.prototype._generatePlayId = function() {
    this._playId = Math.random().toString().slice(2);
};

//------------------------------------------------------------------------- Common
/**
 * Возвращает обещание, разрешающееся после завершения инициализации.
 * @returns {Promise}
 */
//TODO: попробовать переделать класс на фабрику и убрать initPromise
AudioPlayer.prototype.initPromise = function() {
    return this.whenReady;
};

/**
 * Возвращает статус плеера
 * @returns {String}
 */
AudioPlayer.prototype.getState = function() {
    return this.state;
};

/**
 * Возвращает тип реализации плеера
 * @returns {String|null}
 */
AudioPlayer.prototype.getType = function() {
    return this.implementation && this.implementation.type;
};

/**
 * Возвращает ссылку на текущий трек
 * @param {int} [offset=0] - брать трек из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер.
 * @returns {IAudioImplementation|null}
 */
AudioPlayer.prototype.getSrc = function(offset) {
    return this.implementation && this.implementation.getSrc(offset);
};

//------------------------------------------------------------------------- Playback

/**
 * Запуск воспроизведения
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - длительность трека. Актуально для флеш-реализации, в ней пока трек грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.play = function(src, duration) {
    logger.info(this, "play", src, duration);

    this._played = 0;
    this._lastSkip = 0;
    this._generatePlayId();

    if (this._whenPlay) {
        this._whenPlay.reject("play");
    }
    if (this._whenPause) {
        this._whenPause.reject("play");
    }
    if (this._whenStop) {
        this._whenStop.reject("play");
    }

    var promise = this._waitEvents("_whenPlay", [AudioPlayer.EVENT_PLAY], [
        AudioPlayer.EVENT_STOP,
        AudioPlayer.EVENT_ERROR,
        AudioPlayer.EVENT_CRASHED
    ]);

    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(AudioPlayer.STATE_PAUSED);
    this.implementation.play(src, duration);

    return promise;
};

/**
 * Остановка воспроизведения
 * @param {int} [offset=0] - активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер.
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.stop = function(offset) {
    logger.info(this, "stop", offset);

    if (offset !== 0) {
        return this.implementation.stop(offset);
    }

    this._played = 0;
    this._lastSkip = 0;

    if (this._whenPlay) {
        this._whenPlay.reject("stop");
    }
    if (this._whenPause) {
        this._whenPause.reject("stop");
    }

    var promise;
    if (this._whenStop) {
        promise = this._whenStop.promise();
    } else {
        promise = this._waitEvents("_whenStop", [AudioPlayer.EVENT_STOP], [
            AudioPlayer.EVENT_PLAY,
            AudioPlayer.EVENT_ERROR,
            AudioPlayer.EVENT_CRASHED
        ]);
    }

    this.implementation.stop();

    return promise;
};

/**
 * Поставить плеер на паузу
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.pause = function() {
    logger.info(this, "pause");

    if (this.state !== AudioPlayer.STATE_PLAYING) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPlay) {
        this._whenPlay.reject("pause");
    }

    if (this._whenPause) {
        promise = this._whenPause.promise();
    } else {
        promise = this._waitEvents("_whenPause", [AudioPlayer.EVENT_PAUSE], [
            AudioPlayer.EVENT_STOP,
            AudioPlayer.EVENT_PLAY,
            AudioPlayer.EVENT_ERROR,
            AudioPlayer.EVENT_CRASHED
        ]);
    }

    this.implementation.pause();

    return promise;
};

/**
 * Снятие плеера с паузы
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.resume = function() {
    logger.info(this, "resume");

    if (this.state === AudioPlayer.STATE_PLAYING && !this._whenPause) {
        return Promise.resolve();
    }

    if (!(this.state === AudioPlayer.STATE_IDLE || this.state === AudioPlayer.STATE_PAUSED || this.state
        === AudioPlayer.STATE_PLAYING)) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPause) {
        this._whenPause.reject("resume");
    }

    if (this._whenPlay) {
        promise = this._whenPlay.promise();
    } else {
        promise = this._waitEvents("_whenPlay", [AudioPlayer.EVENT_PLAY], [
            AudioPlayer.EVENT_STOP,
            AudioPlayer.EVENT_ERROR,
            AudioPlayer.EVENT_CRASHED
        ]);
    }

    this.implementation.resume();

    return promise;
};

//abortable
/**
 * Запуск воспроизведения предзагруженного трека
 * @param {String} [src] - ссылка на трек, для проверки, что в прелоадере нужный трек
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.playPreloaded = function(src) {
    logger.info(this, "playPreloaded", src);

    if (!src) {
        src = this.getSrc(1);
    }

    if (!this.isPreloaded(src)) {
        logger.warn(this, "playPreloadedBadTrack", AudioError.NOT_PRELOADED);
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    this._played = 0;
    this._lastSkip = 0;
    this._generatePlayId();

    if (this._whenPlay) {
        this._whenPlay.reject("playPreloaded");
    }
    if (this._whenPause) {
        this._whenPause.reject("playPreloaded");
    }
    if (this._whenStop) {
        this._whenStop.reject("playPreloaded");
    }

    var promise = this._waitEvents("_whenPlay", [AudioPlayer.EVENT_PLAY], [
        AudioPlayer.EVENT_STOP,
        AudioPlayer.EVENT_ERROR,
        AudioPlayer.EVENT_CRASHED
    ]);
    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(AudioPlayer.STATE_PAUSED);
    var result = this.implementation.playPreloaded();

    if (!result) {
        logger.warn(this, "playPreloadedError", AudioError.NOT_PRELOADED);
        this._whenPlay.reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    return promise;
};

//------------------------------------------------------------------------- Preload
//abortable
/**
 * Предзагрузка трека
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - длительность трека. Актуально для флеш-реализации, в ней пока трек грузится
 * длительность определяется с погрешностью.
 * @returns {Promise}
 */
AudioPlayer.prototype.preload = function(src, duration) {
    logger.info(this, "preload", src, duration);

    if (this._whenPreload) {
        this._whenPreload.reject("preload");
    }

    var promise = this._waitEvents("_whenPreload", [
        AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_LOADING,
        AudioPlayer.EVENT_SWAP
    ], [
        AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_CRASHED,
        AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_ERROR,
        AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_STOP
    ]);

    promise.abort = function() {
        if (this._whenPreload) {
            this._whenPreload.reject.apply(this._whenPreload, arguments);
            this.stop(1);
        }
    }.bind(this);

    this.implementation.preload(src, duration);

    return promise;
};

/**
 * Проверка, что трек предзагружен
 * @param {String} src - ссылка на трек
 */
AudioPlayer.prototype.isPreloaded = function(src) {
    return this.implementation.isPreloaded(src);
};

/**
 * Проверка, что трек предзагружается
 * @param {String} src - ссылка на трек
 */
AudioPlayer.prototype.isPreloading = function(src) {
    return this.implementation.isPreloading(src, 1);
};

//------------------------------------------------------------------------- Timings
/**
 * Получение позиции воспроизведения
 * @returns {Number}
 */
AudioPlayer.prototype.getPosition = function() {
    return this.implementation.getPosition();
};

/**
 * Установка позиции воспроизведения
 * @param {Number} position - новая позиция воспроизведения
 * @returns {Number} -- конечная позиция воспроизведения
 */
AudioPlayer.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);

    if (this.implementation.type == "flash") {
        position = Math.max(0, Math.min(this.getLoaded(), position));
    } else {
        position = Math.max(0, Math.min(this.getDuration(), position));
    }

    this._played += this.getPosition() - this._lastSkip;
    this._lastSkip = position;

    this.implementation.setPosition(position);

    return position;
};

/**
 * Получение длительности трека
 * @param {Boolean|int} preloader - активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик
 * @returns {Number}
 */
AudioPlayer.prototype.getDuration = function(preloader) {
    return this.implementation.getDuration(preloader ? 1 : 0);
};

/**
 * Получение длительности загруженной части
 * @param {Boolean|int} preloader - активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик
 * @returns {Number}
 */
AudioPlayer.prototype.getLoaded = function(preloader) {
    return this.implementation.getLoaded(preloader ? 1 : 0);
};

/**
 * Получение длительности воспроизведения
 * @returns {Number}
 */
AudioPlayer.prototype.getPlayed = function() {
    var position = this.getPosition();
    this._played += position - this._lastSkip;
    this._lastSkip = position;

    return this._played;
};

//------------------------------------------------------------------------- Volume
/**
 * Получение громкости плеера
 * @returns {Number}
 */
AudioPlayer.prototype.getVolume = function() {
    if (!this.implementation) {
        return 0;
    }

    return this.implementation.getVolume();
};

/**
 * Установка громкости плеера
 * @param {Number} volume - новое значение громкости
 * @returns {Number} -- итоговое значение громкости
 */
AudioPlayer.prototype.setVolume = function(volume) {
    logger.info(this, "setVolume", volume);

    if (!this.implementation) {
        return 0;
    }

    return this.implementation.setVolume(volume);
};

/**
 * Проверка, что громкость управляется устройством, а не програмно
 * @returns {Boolean}
 */
AudioPlayer.prototype.isDeviceVolume = function() {
    if (!this.implementation) {
        return true;
    }

    return this.implementation.isDeviceVolume();
};

//------------------------------------------------------------------------- Web Audio API
/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 *
 * **Внимание!** - после включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode
 * @param {Boolean} state - запрашиваемый статус
 * @returns {Boolean} -- итоговый статус плеера
 */
AudioPlayer.prototype.toggleWebAudioAPI = function(state) {
    logger.info(this, "toggleWebAudioAPI", state);
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleWebAudioAPIFailed", this.implementation.type);
        return false;
    }

    return this.implementation.toggleWebAudioAPI(state);
};

/**
 * Аудио-препроцессор
 * @typedef {Object} ya.Audio~AudioPreprocessor
 *
 * @property {AudioNode} input - нода, в которую перенаправляется вывод аудио
 * @property {AudioNode} output - нода из которой вывод подаётся на усилитель
 */

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудио-элементу у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость
 * @param {ya.Audio~AudioPreprocessor} preprocessor - препроцессор
 * @returns {boolean} -- статус успеха
 */
AudioPlayer.prototype.setAudioPreprocessor = function(preprocessor) {
    logger.info(this, "setAudioPreprocessor");
    if (this.implementation.type !== "html5") {
        logger.warn(this, "setAudioPreprocessorFailed", this.implementation.type);
        return false;
    }

    return this.implementation.setAudioPreprocessor(preprocessor);
};

//------------------------------------------------------------------------- PlayId
/**
 * Получение playId
 * @returns {String}
 */
AudioPlayer.prototype.getPlayId = function() {
    return this._playId;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
AudioPlayer.prototype._logger = function() {
    return {
        index: this.implementation && this.implementation.name,
        src: this.implementation && this.implementation._logger(),
        type: this.implementation && this.implementation.type
    };
};

module.exports = AudioPlayer;

},{"./audio-static":4,"./config":5,"./error/audio-error":6,"./flash/audio-flash":10,"./html5/audio-html5":21,"./lib/async/deferred":23,"./lib/async/events":24,"./lib/async/reject":26,"./lib/browser/detect":27,"./lib/data/merge":32,"./logger/logger":37}],4:[function(require,module,exports){
/**
 * @namespace AudioStatic
 * @private
 */
var AudioStatic = {};

/** @type {String}
 * @const*/
AudioStatic.EVENT_PLAY = "play";
/** @type {String}
 * @const */
AudioStatic.EVENT_STOP = "stop";

/** @type {String}
 * @const */
AudioStatic.EVENT_PAUSE = "pause";
/** @type {String}
 * @const */
AudioStatic.EVENT_PROGRESS = "progress";

/** @type {String}
 * @const */
AudioStatic.EVENT_LOADING = "loading";
/** @type {String}
 * @const */
AudioStatic.EVENT_LOADED = "loaded";

/** @type {String}
 * @const */
AudioStatic.EVENT_VOLUME = "volumechange";

/** @type {String}
 * @const */
AudioStatic.EVENT_ENDED = "ended";
/** @type {String}
 * @const */
AudioStatic.EVENT_CRASHED = "crashed";
/** @type {String}
 * @const */
AudioStatic.EVENT_ERROR = "error";

/** @type {String}
 * @const */
AudioStatic.EVENT_STATE = "state";
/** @type {String}
 * @const */
AudioStatic.EVENT_SWAP = "swap";

/** @type {String}
 * @const */
AudioStatic.PRELOADER_EVENT = "preloader:";

/** @type {String}
 * @const */
AudioStatic.STATE_INIT = "init";
/** @type {String}
 * @const */
AudioStatic.STATE_CRASHED = "crashed";
/** @type {String}
 * @const */
AudioStatic.STATE_IDLE = "idle";
/** @type {String}
 * @const */
AudioStatic.STATE_PLAYING = "playing";
/** @type {String}
 * @const */
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;

},{}],5:[function(require,module,exports){
/**
 * Настойки библиотеки
 * @alias ya.Audio.config
 * @namespace
 */
var config = {
    /**
     * Общие настройки
     * @namespace
     */
    audio: {
        /**
         * Количество попыток реинициализации
         * @type {Number}
         */
        retry: 3
    },
    /**
     * Настройки подключения flash-плеера
     * @namespace
     */
    flash: {
        /**
         * Путь к .swf файлу флеш-плеера
         * @type {String}
         */
        path: "dist",
        /**
         * Имя .swf файла флеш-плеера
         * @type {String}
         */
        name: "player-2_0.swf",
        /**
         * Минимальная версия флеш-плеера
         * @type {String}
         */
        version: "9.0.28",
        /**
         * ID, который будет выставлен для элемента с flash-плеером
         * @type {String}
         */
        playerID: "YandexAudioFlashPlayer",
        /**
         * Имя функции-обработчика событий flash-плеера
         * @type {String}
         * @const
         */
        callback: "ya.Audio._flashCallback",
        /**
         * Таймаут инициализации
         * @type {Number}
         */
        initTimeout: 3000, // 3 sec
        /**
         * Таймаут загрузки
         * @type {Number}
         */
        loadTimeout: 5000,
        /**
         * Таймаут инициализации после клика
         * @type {Number}
         */
        clickTimeout: 1000,
        /**
         * Интервал проверки доступности flash-плеера
         * @type {Number}
         */
        heartBeatInterval: 1000
    },
    /**
     * Описание настроек html5 плеера
     * @namespace
     */
    html5: {
        /**
         * Список идентификаторов для которых лучше не использовать html5 плеер. Используется при
         * авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону
         * `@<platform.version> <platform.os>:<browser.name>/<browser.version>`
         * @type {Array.<Number>}
         */
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4"]
    }
};

module.exports = config;

},{}],6:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @class Класс ошибки аудио-пллеера
 * @alias ya.Audio.AudioError
 *
 * @param {String} message - текст ошибки
 *
 * @extends Error
 *
 * @constructor
 */
var AudioError = function(message) {
    ErrorClass.call(this, message);
};
AudioError.prototype = ErrorClass.create("AudioError");

/**
 * Не найдена реализация плеера или все доступные реализации потерпели крах при инициализации.
 * @type {string}
 * @const
 */
AudioError.NO_IMPLEMENTATION = "cannot find suitable implementation";
/**
 * Трек не был предзагружен или во время загрузки произошла ошибка.
 * @type {string}
 * @const
 */
AudioError.NOT_PRELOADED = "track is not preloaded";
/**
 * Действие не доступно из текущего состояния
 * @type {string}
 * @const
 */
AudioError.BAD_STATE = "action is not permited from current state";

/**
 * Flash-плеер был заблокирован
 * @type {string}
 * @const
 */
AudioError.FLASH_BLOCKER = "flash is rejected by flash blocker plugin";
/**
 * Flash-плеер потерпел крах при инициализации по неизвестным причинам
 * @type {string}
 * @const
 */
AudioError.FLASH_UNKNOWN_CRASH = "flash is crashed without reason";
/**
 * Flash-плеер потерпел крах при инициализации из-за таймаута
 * @type {string}
 * @const
 */
AudioError.FLASH_INIT_TIMEOUT = "flash init timed out";
/**
 * Внутренняя ошибка Flash-плеера
 * @type {string}
 * @const
 */
AudioError.FLASH_INTERNAL_ERROR = "flash internal error";
/**
 * Попытка вызвать недоступный экземляр Flash-плеера
 * @type {string}
 * @const
 */
AudioError.FLASH_EMMITER_NOT_FOUND = "flash event emmiter not found";
/**
 * Flash-плеер перестал отвечать на запросы
 * @type {string}
 * @const
 */
AudioError.FLASH_NOT_RESPONDING = "flash player doesn't response";

module.exports = AudioError;

},{"../lib/class/error-class":30}],7:[function(require,module,exports){
require('../export');

var AudioError = require('./audio-error');
var PlaybackError = require('./playback-error');

ya.Audio.AudioError = AudioError;
ya.Audio.PlaybackError = PlaybackError;

},{"../export":9,"./audio-error":6,"./playback-error":8}],8:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * Класс ошибки воспроизведения
 * @alias ya.Audio.PlaybackError
 *
 * @param {String} message - текст ошибки
 * @param {String} src - ссылка на трек
 *
 * @extends Error
 *
 * @enum {String}
 * @constructor
 */
var PlaybackError = function(message, src) {
    ErrorClass.call(this, message);

    this.src = src;
};

PlaybackError.prototype = ErrorClass.create("PlaybackError");

/**
 * Отмена соединенния
 * @type {string}
 * @const
 */
PlaybackError.CONNECTION_ABORTED = "Connection aborted";
/**
 * Сетевая ошибка
 * @type {string}
 * @const
 */
PlaybackError.NETWORK_ERROR = "Network error";
/**
 * Ошибка декодирования аудио
 * @type {string}
 * @const
 */
PlaybackError.DECODE_ERROR = "Decode error";
/**
 * Не доступный источник
 * @type {string}
 * @const
 */
PlaybackError.BAD_DATA = "Bad data";

/**
 * Таблица соответствия кодов ошибок html5 плеера
 * @enum {String}
 */
PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

module.exports = PlaybackError;

},{"../lib/class/error-class":30}],9:[function(require,module,exports){
if (typeof window.ya === "undefined") {
    window.ya = {};
}

var ya = window.ya;

//TODO: перенести в ya.music.Audio
if (typeof ya.Audio === "undefined") {
    ya.Audio = {};
}

var config = require('./config');
var AudioPlayer = require('./audio-player');
var Proxy = require('./lib/class/proxy');

ya.Audio = Proxy.createClass(AudioPlayer);
ya.Audio.config = config;

module.exports = ya.Audio;

},{"./audio-player":3,"./config":5,"./lib/class/proxy":31}],10:[function(require,module,exports){
var config = require('../config');
var swfobject = require('../lib/browser/swfobject');
var detect = require('../lib/browser/detect');
var Logger = require('../logger/logger');
var logger = new Logger('AudioFlash');
var FlashManager = require('./flash-manager');
var FlashInterface = require('./flash-interface');
var Events = require('../lib/async/events');

var playerId = 1;

var flashManager;

var flashVersion = swfobject.getFlashPlayerVersion();
detect.flashVersion = flashVersion.major + "." + flashVersion.minor + "." + flashVersion.release;

exports.available = swfobject.hasFlashPlayerVersion(config.flash.version);
logger.info(this, "detection", exports.available);

/**
 * @class Класс flash аудио-плеера
 * @extends IAudioImplementation
 *
 * @fires IAudioImplementation#play
 * @fires IAudioImplementation#ended
 * @fires IAudioImplementation#volumechange
 * @fires IAudioImplementation#crashed
 * @fires IAudioImplementation#swap
 *
 * @fires IAudioImplementation#stop
 * @fires IAudioImplementation#pause
 * @fires IAudioImplementation#progress
 * @fires IAudioImplementation#loading
 * @fires IAudioImplementation#loaded
 * @fires IAudioImplementation#error
 *
 * @param {HMTLElement} [overlay] - место для встраивания плеера (актуально только для flash-плеера)
 * @param {Boolean} [force=false] - создать новый экзепляр FlashManager
 * @constructor
 * @private
 */
var AudioFlash = function(overlay, force) {
    this.name = playerId++;
    logger.debug(this, "constructor");

    if (!flashManager || force) {
        flashManager = new FlashManager(overlay);
    }

    Events.call(this);

    this.whenReady = flashManager.createPlayer(this);
    this.whenReady.then(function(data) {
        logger.info(this, "ready", data);
    }.bind(this), function(e) {
        logger.error(this, "failed", e);
    }.bind(this));
};
Events.mixin(AudioFlash);

AudioFlash.type = AudioFlash.prototype.type = "flash";

Object.keys(FlashInterface.prototype).filter(function(key) {
    return FlashInterface.prototype.hasOwnProperty(key) && key[0] !== "_";
}).map(function(method) {
    AudioFlash.prototype[method] = function() {
        if (!/^get/.test(method)) {
            logger.debug(this, method);
        }

        if (!this.hasOwnProperty("id")) {
            logger.warn(this, "player is not ready");
            return null;
        }

        var args = [].slice.call(arguments);
        args.unshift(this.id);
        return flashManager.flash[method].apply(flashManager.flash, args);
    }
});

/**
 * Проиграть трек
 * @method AudioFlash#play
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 */

/**
 * Поставить трек на паузу
 * @method AudioFlash#pause
 */

/**
 * Снять трек с паузы
 * @method AudioFlash#resume
 */

/**
 * Остановить воспроизведение и загрузку трека
 * @method AudioFlash#stop
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */

/**
 * Предзагрузить трек
 * @method AudioFlash#preload
 * @param {String} src - Ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 */

/**
 * Проверить что трек предзагружается
 * @method AudioFlash#isPreloaded
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */

/**
 * Проверить что трек предзагружается
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */

/**
 * Проверить что трек начал предзагружаться
 * @method AudioFlash#isPreloading
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */

/**
 * Запустить воспроизведение предзагруженного трека
 * @method AudioFlash#playPreloaded
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean} -- доступность данного действия
 */

/**
 * Получить позицию воспроизведения
 * @method AudioFlash#getPosition
 * @returns {number}
 */

/**
 * Установить текущую позицию воспроизведения
 * @method AudioFlash#setPosition
 * @param {number} position
 */

/**
 * Получить длительность трека
 * @method AudioFlash#getDuration
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */

/**
 * Получить длительность загруженной части трека
 * @method AudioFlash#getLoaded
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */

/**
 * Получить текущее значение громкости
 * @method AudioFlash#getVolume
 * @returns {number}
 */

/**
 * Установить значение громкости
 * @method AudioFlash#setVolume
 * @param {number} volume
 */

/**
 * Получить ссылку на трек
 * @method AudioFlash#getSrc
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {String|Boolean} -- Ссылка на трек или false, если нет загружаемого трека
 */

/**
 * Проверить доступен ли программный контроль громкости
 * @returns {boolean}
 */
AudioFlash.prototype.isDeviceVolume = function() {
    return false;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
AudioFlash.prototype._logger = function() {
    try {
        if (!this.hasOwnProperty("id")) {
            return {
                main: "not ready",
                preloader: "not ready"
            };
        }
        return {
            main: this.getSrc(0),
            preloader: this.getSrc(1)
        };
    } catch(e) {
        return "";
    }
};

exports.AudioImplementation = AudioFlash;

},{"../config":5,"../lib/async/events":24,"../lib/browser/detect":27,"../lib/browser/swfobject":28,"../logger/logger":37,"./flash-interface":11,"./flash-manager":12}],11:[function(require,module,exports){
var config = require('../config');
var Logger = require('../logger/logger');
var logger = new Logger('FlashInterface');

/**
 * @class Описание внешнего интерфейса flash-плеера
 * @param {Object} flash - swf-объект
 * @constructor
 * @private
 */
var FlashInterface = function(flash) {
    this.flash = ya.Audio._flash = flash;
};

/**
 * Вызвать метод flash-плеера
 * @param {String} fn - название метода
 * @returns {*}
 * @private
 */
FlashInterface.prototype._callFlash = function(fn) {
    //logger.debug(this, fn, arguments);

    try {
        return this.flash.call.apply(this.flash, arguments);
    } catch(e) {
        logger.error(this, "_callFlashError", e);
        return null;
    }
};

/**
 * Проверка обратной связи с flash-плеером
 * @throws Ошибка доступа к flash-плееру
 * @private
 */
FlashInterface.prototype._heartBeat = function() {
    this._callFlash("heartBeat", -1);
};

/**
 * Добавить новый плеер
 * @returns {int} -- id нового плеера
 * @private
 */
FlashInterface.prototype._addPlayer = function() {
    return this._callFlash("addPlayer", -1);
};

/**
 * Установить громкость
 * @param {int} id - id плеера
 * @param {Number} volume - желаемая громкость
 */
FlashInterface.prototype.setVolume = function(id, volume) {
    this._callFlash("setVolume", -1, volume);
};

/**
 * Получить значение громкости
 * @returns {Number}
 */
FlashInterface.prototype.getVolume = function() {
    return this._callFlash("getVolume", -1);
};

/**
 * Запустить воспроизведение трека
 * @param {int} id - id плеера
 * @param {String} src - ссылка на трек
 * @param {Number} duration - длительность трека
 */
FlashInterface.prototype.play = function(id, src, duration) {
    this._callFlash("play", id, src, duration);
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} id - id плеера
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
FlashInterface.prototype.stop = function(id, offset) {
    this._callFlash("stop", id, offset || 0);
};

/**
 * Поставить трек на паузу
 * @param {int} id - id плеера
 */
FlashInterface.prototype.pause = function(id) {
    this._callFlash("pause", id);
};

/**
 * Снять трек с паузы
 * @param {int} id - id плеера
 */
FlashInterface.prototype.resume = function(id) {
    this._callFlash("resume", id);
};

/**
 * Предзагрузить трек
 * @param {int} id - id плеера
 * @param {String} src - ссылка на трек
 * @param {Number} duration - длительность трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 * @returns {Boolean} -- возможность данного действия
 */
FlashInterface.prototype.preload = function(id, src, duration, offset) {
    return this._callFlash("preload", id, src, duration, offset == null ? 1 : offset);
};

/**
 * Проверить что трек предзагружается
 * @param {int} id - id плеера
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: для текущего загрузчика, 1: для следующего загрузчика
 * @returns {Boolean}
 */
FlashInterface.prototype.isPreloaded = function(id, src, offset) {
    return this._callFlash("isPreloaded", id, src, offset == null ? 1 : offset);
};

/**
 * Проверить что трек начал предзагружаться
 * @param {int} id - id плеера
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: для текущего загрузчика, 1: для следующего загрузчика
 * @returns {Boolean}
 */
FlashInterface.prototype.isPreloading = function(id, src, offset) {
    return this._callFlash("isPreloading", id, src, offset == null ? 1 : offset);
};

/**
 * Запустить воспроизведение предзагруженного трека
 * @param {int} id - id плеера
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean} -- доступность данного действия
 */
FlashInterface.prototype.playPreloaded = function(id, offset) {
    return this._callFlash("playPreloaded", id, offset == null ? 1 : offset);
};

/**
 * Получить позицию воспроизведения
 * @param {int} id - id плеера
 * @returns {Number}
 */
FlashInterface.prototype.getPosition = function(id) {
    return this._callFlash("getPosition", id);
};

/**
 * Установить текущую позицию воспроизведения
 * @param {int} id - id плеера
 * @param {number} position
 */
FlashInterface.prototype.setPosition = function(id, position) {
    this._callFlash("setPosition", id, position);
};

/**
 * Получить длительность трека
 * @param {int} id - id плеера
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {Number}
 */
FlashInterface.prototype.getDuration = function(id, offset) {
    return this._callFlash("getDuration", id, offset || 0);
};

/**
 * Получить длительность загруженной части трека
 * @param {int} id - id плеера
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {Number}
 */
FlashInterface.prototype.getLoaded = function(id, offset) {
    return this._callFlash("getLoaded", id, offset || 0);
};

/**
 * Получить ссылку на трек
 * @param {int} id - id плеера
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {String}
 */
FlashInterface.prototype.getSrc = function(id, offset) {
    return this._callFlash("getSrc", id, offset || 0);
};

module.exports = FlashInterface;

},{"../config":5,"../logger/logger":37}],12:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('FlashBridge');

var config = require('../config');

var AudioStatic = require('../audio-static');
var flashLoader = require('./loader');
var FlashInterface = require('./flash-interface');

var Deferred = require('../lib/async/deferred');

var AudioError = require('../error/audio-error');
var LoaderError = require('../lib/net/error/loader-error');

/**
 * @class Загрузка flash-плеера и обработка событий
 * @param {HTMLElement} overlay - объект для загрузки и показа flash-плеера
 * @constructor
 * @private
 */
var FlashManager = function(overlay) { // singleton!
    logger.debug(this, "constructor", overlay);

    this.state = "init";
    this.overlay = overlay;
    this.emmiters = [];

    var deferred = this.deferred = new Deferred();
    /**
     * Обещание, которое разрешается при завершении инициализации
     * @type {Promise}
     */
    this.whenReady = this.deferred.promise();

    var callbackPath = config.flash.callback.split(".");
    var callbackName = callbackPath.pop();
    var callbackCont = window;
    callbackPath.forEach(function(part) {
        if (!callbackCont[part]) {
            callbackCont[part] = {};
        }
        callbackCont = callbackCont[part];
    });
    callbackCont[callbackName] = this._onEvent.bind(this);

    this.__loadTimeout = setTimeout(this._onLoadTimeout, config.flash.loadTimeout);
    flashLoader(config.flash.path + "/"
        + config.flash.name, config.flash.version, config.flash.playerID, this._onLoad.bind(this), {}, overlay);

    if (overlay) {
        var timeout;
        overlay.addEventListener("mousedown", function() { //KNOWLEDGE: only mousedown event and only wmode: transparent
            timeout = timeout || setTimeout(function() {
                    deferred.reject(new AudioError(AudioError.FLASH_NOT_RESPONDING));
                }, config.flash.clickTimeout);
        }, true);
    }

    this.whenReady.then(function(result) {
        timeout = timeout && clearTimeout(timeout);
        logger.info(this, "ready", result);
    }.bind(this), function(e) {
        flashManager = null; // если обломались удаляем экземпляр менеджера, чтобы можно было было пытаться снова
        logger.error(this, "failed", e);
    }.bind(this));
};

FlashManager.EVENT_INIT = "init";
FlashManager.EVENT_FAIL = "failed";

/**
 * Обработчик события загрузки плеера
 * @param data
 * @private
 */
FlashManager.prototype._onLoad = function(data) {
    logger.debug(this, "_onLoad", data);

    clearTimeout(this.__loadTimeout);
    delete this.__loadTimeout;

    if (data.success) {
        this.flash = new FlashInterface(data.ref);

        if (this.state === "ready") {
            this.deferred.resolve(data.ref);
        } else if (!this.overlay) {
            this.__initTimeout = setTimeout(this._onInitTimeout.bind(this), config.flash.initTimeout);
        }
    } else {
        this.state = "failed";
        this.deferred.reject(new AudioError(data.__fbn ? AudioError.FLASH_BLOCKER : AudioError.FLASH_UNKNOWN_CRASH));
    }
};

/**
 * Обработчик таймаута загрузки
 * @private
 */
FlashManager.prototype._onLoadTimeout = function() {
    this.state = "failed";
    this.deferred.reject(new LoaderError(LoaderError.TIMEOUT));
};

/**
 * Обработчик таймаута инициализации
 * @private
 */
FlashManager.prototype._onInitTimeout = function() {
    this.state = "failed";
    this.deferred.reject(new AudioError(AudioError.FLASH_INIT_TIMEOUT));
};

/**
 * Обработчик успешности инициализации
 * @private
 */
FlashManager.prototype._onInit = function() {
    logger.debug(this, "_onInit");

    this.state = "ready";

    if (this.__initTimeout) {
        clearTimeout(this.__initTimeout);
        delete this.__initTimeout;
    }

    if (this.flash) {
        this.deferred.resolve(this.flash);
        this.__heartbeat = setInterval(this._onHeartBeat.bind(this), 1000);
    }
};

/**
 * Обработчик событий, создаваемых flash-плеером
 * @param {String} event
 * @param {int} id - id плеера
 * @param {int} offset - 0: для текущего загрузчика, 1: для следующего загрузчика
 * @param {*} data - данные переданные вместе с событием
 * @private
 */
FlashManager.prototype._onEvent = function(event, id, offset, data) {
    if (event === "debug") {
        console.debug("flashDEBUG", id, offset, data);
    }

    if (this.state === "failed") {
        logger.warn(this, "onEventFailed", event, id, offset, data);
        return;
    }

    logger.debug(this, "onEvent", event, id, offset);

    if (event === FlashManager.EVENT_INIT) {
        return this._onInit();
    }

    if (event === FlashManager.EVENT_FAIL) {
        logger.warn(this, "failed", AudioError.FLASH_INTERNAL_ERROR);
        this.deferred.reject(new AudioError(AudioError.FLASH_INTERNAL_ERROR));
        return;
    }

    if (id == -1) {
        this.emmiters.forEach(function(emmiter) {
            emmiter.trigger(event, offset, data);
        });
    } else if (this.emmiters[id]) {
        this.emmiters[id].trigger(event, offset, data);
    } else {
        logger.error(this, AudioError.FLASH_EMMITER_NOT_FOUND, id);
    }
};

/**
 * Проверка доступности flash-плеера
 * @private
 */
FlashManager.prototype._onHeartBeat = function() {
    try {
        this.flash._heartBeat();
    } catch(e) {
        logger.error(this, "crashed", e);
        this._onEvent(AudioStatic.EVENT_CRASHED, -1, e);
    }
};

/**
 * Создание нового плеера
 * @param {AudioFlash} audioFlash - flash аудио-плеер, который будет обслуживать созданный плеер
 * @returns {Promise} -- обещание, которое разрешается после завершения создания плеера
 */
FlashManager.prototype.createPlayer = function(audioFlash) {
    logger.debug(this, "createPlayer");

    var promise = this.whenReady.then(function() {
        audioFlash.id = this.flash._addPlayer();
        this.emmiters[audioFlash.id] = audioFlash;
        return audioFlash.id;
    }.bind(this));

    promise.then(function(playerId) {
        logger.debug(this, "createPlayerSuccess", playerId);
    }.bind(this), function(err) {
        logger.error(this, "createPlayerError", err);
    }.bind(this));

    return promise;
};

module.exports = FlashManager;

},{"../audio-static":4,"../config":5,"../error/audio-error":6,"../lib/async/deferred":23,"../lib/net/error/loader-error":34,"../logger/logger":37,"./flash-interface":11,"./loader":15}],13:[function(require,module,exports){
/**
 * @ignore
 * @file
 * This is a wrapper for swfobject that detects FlashBlock in browser.
 *
 * Wrapper detects:
 *   - Chrome
 *     - FlashBlock (https://chrome.google.com/webstore/detail/cdngiadmnkhgemkimkhiilgffbjijcie)
 *     - FlashBlock (https://chrome.google.com/webstore/detail/gofhjkjmkpinhpoiabjplobcaignabnl)
 *     - FlashFree (https://chrome.google.com/webstore/detail/ebmieckllmmifjjbipnppinpiohpfahm)
 *   - Firefox Flashblock (https://addons.mozilla.org/ru/firefox/addon/flashblock/)
 *   - Opera >= 11.5 "Enable plugins on demand" setting
 *   - Safari ClickToFlash Extension (http://hoyois.github.com/safariextensions/clicktoplugin/)
 *   - Safari ClickToFlash Plugin (for Safari < 5.0.6) (http://rentzsch.github.com/clicktoflash/)
 *
 * Tested on:
 *   - Chrome 12
 *     - FlashBlock by Lex1 1.2.11.12
 *     - FlashBlock by josorek 0.9.31
 *     - FlashFree 1.1.3
 *   - Firefox 5.0.1 + Flashblock 1.5.15.1
 *   - Opera 11.5
 *   - Safari 5.1 + ClickToFlash (2.3.2)
 *
 * Also this wrapper can remove blocked swf and let you downgrade to other options.
 *
 * Feel free to contact me via email.
 *
 * Copyright 2011, Alexey Androsov
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) or GPL Version 3 (http://www.gnu.org/licenses/gpl.html) licenses.
 *
 * Thanks to flashblockdetector project (http://code.google.com/p/flashblockdetector)
 *
 * @requires swfobject
 * @author Alexey Androsov <doochik@ya.ru>
 * @version 1.0
 */

var swfobject = require('../lib/browser/swfobject');

function remove(node) {
    node.parentNode.removeChild(node);
}

/**
 * Модуль загрузки флеш-плеера с возможностью отслеживания блокировщиков
 * @namespace
 * @private
 */
var FlashBlockNotifier = {

    /**
     * CSS-class for swf wrapper.
     * @protected
     * @default fbn-swf-wrapper
     * @type String
     */
    __SWF_WRAPPER_CLASS: 'fbn-swf-wrapper',

    /**
     * Timeout for flash block detect
     * @default 500
     * @protected
     * @type Number
     */
    __TIMEOUT: 500,

    __TESTS: [
        // Chome FlashBlock extension (https://chrome.google.com/webstore/detail/cdngiadmnkhgemkimkhiilgffbjijcie)
        // Chome FlashBlock extension (https://chrome.google.com/webstore/detail/gofhjkjmkpinhpoiabjplobcaignabnl)
        function(swfNode, wrapperNode) {
            // we expect that swf is the only child of wrapper
            return wrapperNode.childNodes.length > 1
        }, // older Safari ClickToFlash (http://rentzsch.github.com/clicktoflash/)
        function(swfNode) {
            // IE has no swfNode.type
            return swfNode.type && swfNode.type != 'application/x-shockwave-flash'
        }, // FlashBlock for Firefox (https://addons.mozilla.org/ru/firefox/addon/flashblock/)
        // Chrome FlashFree (https://chrome.google.com/webstore/detail/ebmieckllmmifjjbipnppinpiohpfahm)
        function(swfNode) {
            // swf have been detached from DOM
            return !swfNode.parentNode;
        }, // Safari ClickToFlash Extension (http://hoyois.github.com/safariextensions/clicktoplugin/)
        function(swfNode) {
            return swfNode.parentNode.className.indexOf('CTFnodisplay') > -1;
        }
    ],

    /**
     * Embed SWF info page. This function has same options as swfobject.embedSWF except last param removeBlockedSWF.
     * @see http://code.google.com/p/swfobject/wiki/api
     * @param swfUrlStr
     * @param replaceElemIdStr
     * @param widthStr
     * @param heightStr
     * @param swfVersionStr
     * @param xiSwfUrlStr
     * @param flashvarsObj
     * @param parObj
     * @param attObj
     * @param callbackFn
     * @param {Boolean} [removeBlockedSWF=true] Remove swf if blocked
     */
    embedSWF: function(swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj,
                       parObj, attObj, callbackFn, removeBlockedSWF) {
        // var swfobject = window['swfobject'];

        if (!swfobject) {
            return;
        }

        swfobject.addDomLoadEvent(function() {
            var replaceElement = document.getElementById(replaceElemIdStr);
            if (!replaceElement) {
                return;
            }

            // We need to create div-wrapper because some flash block plugins replace swf with another content.
            // Also some flash requires wrapper to work properly.
            var wrapper = document.createElement('div');
            wrapper.className = FlashBlockNotifier.__SWF_WRAPPER_CLASS;

            replaceElement.parentNode.replaceChild(wrapper, replaceElement);
            wrapper.appendChild(replaceElement);

            swfobject.embedSWF(swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj, parObj, attObj, function(e) {
                // e.success === false means that browser don't have flash or flash is too old
                // @see http://code.google.com/p/swfobject/wiki/api
                if (!e || e.success === false) {
                    callbackFn(e);

                } else {
                    var swfElement = e['ref'];
                    // Opera 11.5 and above replaces flash with SVG button
                    // msie (and canary chrome 32.0) crashes on swfElement['getSVGDocument']()
                    var replacedBySVG = false;
                    try {
                        replacedBySVG = swfElement && swfElement['getSVGDocument'] && swfElement['getSVGDocument']();
                    } catch(err) {
                    }
                    if (replacedBySVG) {
                        onFailure(e);

                    } else {
                        //set timeout to let FlashBlock plugin detect swf and replace it some contents
                        window.setTimeout(function() {
                            var TESTS = FlashBlockNotifier.__TESTS;
                            for (var i = 0, j = TESTS.length; i < j; i++) {
                                if (TESTS[i](swfElement, wrapper)) {
                                    onFailure(e);
                                    return;
                                }
                            }
                            callbackFn(e);
                        }, FlashBlockNotifier.__TIMEOUT);
                    }
                }

                function onFailure(e) {
                    if (removeBlockedSWF !== false) {
                        //remove swf
                        swfobject.removeSWF(replaceElemIdStr);
                        //remove wrapper
                        remove(wrapper);

                        //remove extension artefacts

                        //ClickToFlash artefacts
                        var ctf = document.getElementById('CTFstack');
                        if (ctf) {
                            remove(ctf);
                        }

                        //Chrome FlashBlock artefact
                        var lastBodyChild = document.body.lastChild;
                        if (lastBodyChild && lastBodyChild.className == 'ujs_flashblock_placeholder') {
                            remove(lastBodyChild);
                        }
                    }
                    e.success = false;
                    e.__fbn = true;
                    callbackFn(e);
                }
            });
        });
    }
};

module.exports = FlashBlockNotifier;

},{"../lib/browser/swfobject":28}],14:[function(require,module,exports){
var swfobject = require('../lib/browser/swfobject');

/**
 * Модуль загрузки флеш-плеера
 * @namespace
 * @private
 */
var FlashEmbedder = {

    /**
     * CSS-class for swf wrapper.
     * @protected
     * @default femb-swf-wrapper
     * @type String
     */
    __SWF_WRAPPER_CLASS: 'femb-swf-wrapper',

    /**
     * Timeout for flash block detect
     * @default 500
     * @protected
     * @type Number
     */
    __TIMEOUT: 500,

    /**
     * Embed SWF info page. This function has same options as swfobject.embedSWF
     * @see http://code.google.com/p/swfobject/wiki/api
     * @param swfUrlStr
     * @param replaceElemIdStr
     * @param widthStr
     * @param heightStr
     * @param swfVersionStr
     * @param xiSwfUrlStr
     * @param flashvarsObj
     * @param parObj
     * @param attObj
     * @param callbackFn
     */
    embedSWF: function(swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj,
                       parObj, attObj, callbackFn) {
        swfobject.addDomLoadEvent(function() {
            var replaceElement = document.getElementById(replaceElemIdStr);
            if (!replaceElement) {
                return;
            }

            // We need to create div-wrapper because some flash block plugins replace swf with another content.
            // Also some flash requires wrapper to work properly.
            var wrapper = document.createElement('div');
            wrapper.className = FlashEmbedder.__SWF_WRAPPER_CLASS;

            replaceElement.parentNode.replaceChild(wrapper, replaceElement);
            wrapper.appendChild(replaceElement);

            swfobject.embedSWF(swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj, parObj, attObj, function(e) {
                // e.success === false means that browser don't have flash or flash is too old
                // @see http://code.google.com/p/swfobject/wiki/api
                if (!e || e.success === false) {
                    callbackFn(e);
                } else {
                    var swfElement = e['ref'];
                    // Opera 11.5 and above replaces flash with SVG button
                    // msie (and canary chrome 32.0) crashes on swfElement['getSVGDocument']()
                    var replacedBySVG = false;
                    try {
                        replacedBySVG = swfElement && swfElement['getSVGDocument'] && swfElement['getSVGDocument']();
                    } catch(err) {
                    }
                    if (replacedBySVG) {
                        onFailure(e);

                    } else {
                        //set timeout to let FlashBlock plugin detect swf and replace it some contents
                        window.setTimeout(function() {
                            callbackFn(e);
                        }, FlashEmbedder.__TIMEOUT);
                    }
                }

                function onFailure(e) {
                    e.success = false;
                    callbackFn(e);
                }
            });
        });
    }
};

module.exports = FlashEmbedder;

},{"../lib/browser/swfobject":28}],15:[function(require,module,exports){
var swfobject = require('../lib/browser/swfobject');
var FlashBlockNotifier = require('./flashblocknotifier');
var FlashEmbedder = require('./flashembedder');
var detect = require('../lib/browser/detect');

var winSafari = detect.platform.os === 'windows' && detect.browser.name === 'safari';

var CONTAINER_CLASS = "ya-flash-player-wrapper";

/**
 * Загрузчик флеш-плеера
 *
 * @alias FlashManager~flashLoader
 *
 * @param {string} url - Ссылка на плеера
 * @param {string} minVersion - минимальная версия плеера
 * @param {string|number} id - идентификатор нового плеера
 * @param {function} loadCallback - колбек для события загрузки
 * @param {object} flashVars - данные передаваемые во флеш
 * @param {HTMLElement} container - контейнер для видимого флеш-плеера
 * @param {string} sizeX - размер по горизонтали
 * @param {string} sizeY - размер по вертикали
 *
 * @returns {HTMLElement} -- Контейнер флеш-плеера
 */
module.exports = function(url, minVersion, id, loadCallback, flashVars, container, sizeX, sizeY) {
    var $flashPlayer = document.createElement("div");
    $flashPlayer.id = "wrapper_" + id;
    $flashPlayer.innerHTML = '<div id="' + id + '"></div>';

    sizeX = sizeX || "1000";
    sizeY = sizeY || "1000";

    var embedder,
        flashSizeX,
        flashSizeY,
        options;

    if (container && !winSafari) {
        embedder = FlashEmbedder;
        flashSizeX = sizeX; flashSizeY = sizeY;
        options = { allowscriptaccess: "always", wmode: "transparent" };

        $flashPlayer.className = CONTAINER_CLASS;
        $flashPlayer.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: hidden;';
        container.appendChild($flashPlayer);
    } else {
        embedder = FlashBlockNotifier;
        flashSizeX = flashSizeY = "1";
        options = { allowscriptaccess: "always" };

        $flashPlayer.style.cssText = 'position: absolute; left: -1px; top: -1px; width: 0px; height: 0px; overflow: hidden;';
        document.body.appendChild($flashPlayer);
    }

    embedder.embedSWF(
        url,
        id,
        flashSizeX,
        flashSizeY,
        minVersion,
        "",
        flashVars,
        options,
        {},
        loadCallback
    );

    return $flashPlayer;
};

},{"../lib/browser/detect":27,"../lib/browser/swfobject":28,"./flashblocknotifier":13,"./flashembedder":14}],16:[function(require,module,exports){
module.exports = [
    { // сохраняется в localstorage
        "id": "custom",
        "preamp": 0,
        "bands": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
        "id": "default",
        "preamp": 0,
        "bands": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
        "id": "Classical",
        "preamp": -0.5,
        "bands": [-0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -3.5, -3.5, -3.5, -4.5]
    },
    {
        "id": "Club",
        "preamp": -3.359999895095825,
        "bands": [-0.5, -0.5, 4, 2.5, 2.5, 2.5, 1.5, -0.5, -0.5, -0.5]
    },
    {
        "id": "Dance",
        "preamp": -2.1599998474121094,
        "bands": [4.5, 3.5, 1, -0.5, -0.5, -2.5, -3.5, -3.5, -0.5, -0.5]
    },
    {
        "id": "Full Bass",
        "preamp": -3.5999999046325684,
        "bands": [4, 4.5, 4.5, 2.5, 0.5, -2, -4, -5, -5.5, -5.5]
    },
    {
        "id": "Full Bass & Treble",
        "preamp": -5.039999961853027,
        "bands": [3.5, 2.5, -0.5, -3.5, -2, 0.5, 4, 5.5, 6, 6]
    },
    {
        "id": "Full Treble",
        "preamp": -6,
        "bands": [-4.5, -4.5, -4.5, -2, 1, 5.5, 8, 8, 8, 8]
    },
    {
        "id": "Laptop Speakers / Headphone",
        "preamp": -4.079999923706055,
        "bands": [2, 5.5, 2.5, -1.5, -1, 0.5, 2, 4.5, 6, 7]
    },
    {
        "id": "Large Hall",
        "preamp": -3.5999999046325684,
        "bands": [5, 5, 2.5, 2.5, -0.5, -2, -2, -2, -0.5, -0.5]
    },
    {
        "id": "Live",
        "preamp": -2.6399998664855957,
        "bands": [-2, -0.5, 2, 2.5, 2.5, 2.5, 2, 1, 1, 1]
    },
    {
        "id": "Party",
        "preamp": -2.6399998664855957,
        "bands": [3.5, 3.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 3.5, 3.5]
    },
    {
        "id": "Pop",
        "preamp": -3.119999885559082,
        "bands": [-0.5, 2, 3.5, 4, 2.5, -0.5, -1, -1, -0.5, -0.5]
    },
    {
        "id": "Reggae",
        "preamp": -4.079999923706055,
        "bands": [-0.5, -0.5, -0.5, -2.5, -0.5, 3, 3, -0.5, -0.5, -0.5]
    },
    {
        "id": "Rock",
        "preamp": -5.039999961853027,
        "bands": [4, 2, -2.5, -4, -1.5, 2, 4, 5.5, 5.5, 5.5]
    },
    {
        "id": "Ska",
        "preamp": -5.519999980926514,
        "bands": [-1, -2, -2, -0.5, 2, 2.5, 4, 4.5, 5.5, 4.5]
    },
    {
        "id": "Soft",
        "preamp": -4.799999713897705,
        "bands": [2, 0.5, -0.5, -1, -0.5, 2, 4, 4.5, 5.5, 6]
    },
    {
        "id": "Soft Rock",
        "preamp": -2.6399998664855957,
        "bands": [2, 2, 1, -0.5, -2, -2.5, -1.5, -0.5, 1, 4]
    },
    {
        "id": "Techno",
        "preamp": -3.8399999141693115,
        "bands": [4, 2.5, -0.5, -2.5, -2, -0.5, 4, 4.5, 4.5, 4]
    }
];

},{}],17:[function(require,module,exports){
var Events = require('../../lib/async/events');

/**
 * Описание настроек эквалайзера
 * @typedef {Object} ya.Audio.fx.Equalizer~EqualizerPreset
 *
 * @property {String} [id] - идентификатор настроек
 * @property {Number} preamp - предусилитель
 * @property {Array.<Number>} - значения для полос эквалайзера
 */

/**
 * Событие изменения полосы пропускания ({@link ya.Audio.fx.Equalizer.EVENT_CHANGE})
 * @event ya.Audio.fx.Equalizer#change
 * @param {Number} freq - частота полосы пропускания
 * @param {Number} value - значение усиления
 */

/**
 * Эквалайзер
 * @alias ya.Audio.fx.Equalizer
 * @param {AudioContext} audioContext - контекст Web Audio API
 * @param {Array.<Number>} bands - список частот для полос эквалайзера
 *
 * @extends Events
 *
 * @fires ya.Audio.fx.Equalizer#change
 *
 * @constructor
 */
var Equalizer = function(audioContext, bands) {
    Events.call(this);

    this.preamp = new EqualizerBand(audioContext, "highshelf", 0);
    this.preamp.on("*", this._onBandEvent.bind(this, this.preamp));

    var prev;
    this.bands = bands.map(function(frequency, idx) {
        var band = new EqualizerBand(
            audioContext,

            idx == 0 ? 'lowshelf'
                : idx + 1 < bands.length ? "peaking"
                : "highshelf",

            frequency
        );
        band.on("*", this._onBandEvent.bind(this, band));

        if (!prev) {
            this.preamp.filter.connect(band.filter);
        } else {
            prev.filter.connect(band.filter);
        }

        prev = band;
        return band;
    }.bind(this));

    this.input = this.preamp.filter;
    this.output = this.bands[this.bands.length - 1].filter;
};

Events.mixin(Equalizer);

/** @type {string}
 * @const
 */
Equalizer.EVENT_CHANGE = "change";

/** @type {Array.<Number>}
 * @const
 */
Equalizer.DEFAULT_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

/** @type {Object.<String, ya.Audio.fx.Equalizer~EqualizerPreset>}
 * @const
 */
Equalizer.DEFAULT_PRESETS = require('./default.presets.js');

/**
 * Обработка события полосы эквалайзера
 * @param {EqualizerBand} band - полоса эквалайзера
 * @param {String} event - событие
 * @param {*} data - данные события
 * @private
 */
Equalizer.prototype._onBandEvent = function(band, event, data) {
    this.trigger(event, band.getFreq(), data);
};

/**
 * Загрузить настройки
 * @param {ya.Audio.fx.Equalizer~EqualizerPreset} preset - настройки
 */
Equalizer.prototype.loadPreset = function(preset) {
    preset.bands.forEach(function(value, idx) {
        this.bands[idx].setValue(value);
    }.bind(this));
    this.preamp.setValue(preset.preamp);
};

/**
 * Сохранить текущие настройки
 * @returns {ya.Audio.fx.Equalizer~EqualizerPreset}
 */
Equalizer.prototype.savePreset = function() {
    return {
        preamp: this.preamp.getValue(),
        bands: this.bands.map(function(band) { return band.getValue(); })
    };
};

//TODO: проверить предположение (скорее всего нужна карта весов для различных частот или даже некая функция)
/**
 * **Экспериментально** - вычиляет оптимальное значние предусиления
 * @experimental
 * @returns {number}
 */
Equalizer.prototype.guessPreamp = function() {
    var v = 0;
    for (var k = 0, l = this.bands.length; k < l; k++) {
        v += this.bands[k].getValue();
    }

    return -v / 2;
};

// =================================================================

//  Фильтр эквалайзера

// =================================================================
/**
 * Событие изменения значения усиления ({@link ya.Audio.fx.Equalizer.EVENT_CHANGE})
 * @event ya.Audio.fx.Equalizer~EqualizerBand#change
 * @param {Number} value - новое значение
 */

/**
 * Полоса пропускания эквалайзера
 * @alias ya.Audio.fx.Equalizer~EqualizerBand
 *
 * @extends Events
 *
 * @param {AudioContext} audioContext - контекст Web Audio API
 * @param {String} type - тип фильтра
 * @param {Number} frequency - частота фильтра
 *
 * @fires ya.Audio.fx.Equalizer~EqualizerBand#change
 *
 * @constructor
 */
var EqualizerBand = function(audioContext, type, frequency) {
    Events.call(this);

    this.type = type;

    this.filter = audioContext.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = frequency;
    this.filter.Q.value = 1;
    this.filter.gain.value = 0;
};
Events.mixin(EqualizerBand);

/**
 * Получить частоту полосы пропускания
 * @returns {Number}
 */
EqualizerBand.prototype.getFreq = function() {
    return this.filter.frequency.value;
};

/**
 * Получить значение усиления
 * @returns {Number}
 */
EqualizerBand.prototype.getValue = function() {
    return this.filter.gain.value;
};

/**
 * Установить значение усиления
 * @param value
 */
EqualizerBand.prototype.setValue = function(value) {
    this.filter.gain.value = value;
    this.trigger(Equalizer.EVENT_CHANGE, value);
};

module.exports = Equalizer;

},{"../../lib/async/events":24,"./default.presets.js":16}],18:[function(require,module,exports){
require('../export');

ya.Audio.fx.Equalizer = require('./equalizer');

},{"../export":19,"./equalizer":17}],19:[function(require,module,exports){
require('../export');

ya.Audio.fx = {};

},{"../export":9}],20:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5Loader');

var Events = require('../lib/async/events');
var Deferred = require('../lib/async/deferred');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');
var noop = require('../lib/noop');

var loaderId = 1;

/**
 * @class Обёртка для нативного класса Audio
 * @constructor
 */
var AudioHTML5Loader = function() {
    this.name = loaderId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    this.promises = {};

    this.src = "";
    this.position = 0;

    this.lastUpdate = 0;
    this.notLoading = true;

    this.output = null;

    this.__startPlay = this._startPlay.bind(this);
    this.__restart = this._restart.bind(this);
    this.__startupAudio = this._startupAudio.bind(this);

    this.__updateProgress = this._updateProgress.bind(this);
    this.__onNativeLoading = this._onNativeLoading.bind(this);
    this.__onNativeEnded = this._onNativeEnded.bind(this);
    this.__onNativeError = this._onNativeError.bind(this);

    this.__onNativePause = this.trigger.bind(this, AudioStatic.EVENT_PAUSE);
    this.__onNativePlay = this.trigger.bind(this, AudioStatic.EVENT_PLAY);

    this._initAudio();
};
Events.mixin(AudioHTML5Loader);

AudioHTML5Loader._updateInterval = 250;

/**
 * Нативное событие начала воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_PLAY = "play";

/**
 * Нативное событие паузы
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_PAUSE = "pause";

/**
 * Нативное событие обновление позиции воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE = "timeupdate";

/**
 * Нативное событие завершения трека
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_ENDED = "ended";

/**
 * Нативное событие изменения длительности
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_DURATION = "durationchange";

/**
 * Нативное событие изменения длительности загруженной части
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_LOADING = "progress";

/**
 * Нативное событие доступности мета-данных трека
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_META = "loadedmetadata";

/**
 * Нативное событие возможности начать воспроизведение
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_CANPLAY = "canplay";

/**
 * Нативное событие ошибки
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_ERROR = "error";

AudioHTML5Loader.prototype._updateProgress = function() {
    var currentTime = +new Date();
    if (currentTime - this.lastUpdate < AudioHTML5Loader._updateInterval) {
        return;
    }

    this.lastUpdate = currentTime;
    this.trigger(AudioStatic.EVENT_PROGRESS);
};

AudioHTML5Loader.prototype._onNativeLoading = function() {
    this._updateProgress();

    if (this.audio.buffered.length) {
        var loaded = this.audio.buffered.end(0) - this.audio.buffered.start(0);

        if (this.notLoading && loaded) {
            this.notLoading = false;
            this.trigger(AudioStatic.EVENT_LOADING);
        }

        if (loaded >= this.audio.duration - 0.1) {
            this.trigger(AudioStatic.EVENT_LOADED);
        }
    }
};

AudioHTML5Loader.prototype._onNativeEnded = function() {
    this.trigger(AudioStatic.EVENT_PROGRESS);
    this.trigger(AudioStatic.EVENT_ENDED);
    this.ended = true;
};

AudioHTML5Loader.prototype._onNativeError = function(e) {
    if (!this.src) {
        return;
    }

    var error = new PlaybackError(this.audio.error
            ? PlaybackError.html5[this.audio.error.code]
            : e instanceof Error ? e.message : e,
        this.src);

    this.trigger(AudioStatic.EVENT_ERROR, error);
};

//---
AudioHTML5Loader.prototype._initAudio = function() {
    logger.debug(this, "_initAudio");

    this.muteEvents();

    this.audio = document.createElement("audio");
    this.audio.loop = false; // for IE
    this.audio.preload = this.audio.autobuffer = "auto"; // 100%

    document.body.addEventListener("mousedown", this.__startupAudio);
    document.body.addEventListener("keydown", this.__startupAudio);
    document.body.addEventListener("touchstart", this.__startupAudio);

    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);
};

AudioHTML5Loader.prototype._deinitAudio = function() {
    logger.debug(this, "_deinitAudio");

    this.muteEvents();

    document.body.removeEventListener("mousedown", this.__startupAudio);
    document.body.removeEventListener("keydown", this.__startupAudio);
    document.body.removeEventListener("touchstart", this.__startupAudio);

    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);

    this.audio = null;
};

AudioHTML5Loader.prototype._startupAudio = function() {
    logger.debug(this, "_startupAudio");

    document.body.removeEventListener("mousedown", this.__startupAudio);
    document.body.removeEventListener("keydown", this.__startupAudio);
    document.body.removeEventListener("touchstart", this.__startupAudio);

    //INFO: перед использованием объект Audio требуется инициализировать, в обработчике пользовательского события
    this.audio.play();

    //INFO: некоторые браузеры слишком упортно пытаются запустить воспроизведение - нужно ограничивать
    this.audio.pause();

    //INFO: IE (как всегда) не умеет правильно работать - приходится повторять по 2 раза...
    setTimeout(function() {
        this.audio.pause();

        //TODO: проверить, что не слишком рано разрешаем триггерить события
        this.unmuteEvents();
        logger.debug(this, "_startupAudio:ready");
    }.bind(this), 0);
};

//---
AudioHTML5Loader.prototype._waitFor = function(name, check, listen) {
    if (!this.promises[name]) {
        var deferred = new Deferred();
        this.promises[name] = deferred;

        if (check.call(this)) {
            deferred.resolve();
        } else {
            var listener = function() {
                if (check.call(this)) {
                    deferred.resolve();
                }
            }.bind(this);

            var clearListeners = function() {
                for (var i = 0, l = listen.length; i < l; i++) {
                    this.audio.removeEventListener(listen[i], listener);
                }
            }.bind(this);

            for (var i = 0, l = listen.length; i < l; i++) {
                this.audio.addEventListener(listen[i], listener);
            }

            deferred.promise().then(clearListeners, clearListeners);
        }
    }

    return this.promises[name].promise();
};

AudioHTML5Loader.prototype._cancelWait = function(name, reason) {
    var promise;
    if (promise = this.promises[name]) {
        delete this.promises[name];
        promise.reject(reason);
    }
};

AudioHTML5Loader.prototype._abortPromises = function(reason) {
    for (var key in this.promises) {
        if (this.promises.hasOwnProperty(key)) {
            this._cancelWait(key, reason);
        }
    }
};

//---
AudioHTML5Loader._promiseMetadataEvents = [AudioHTML5Loader.EVENT_NATIVE_META, AudioHTML5Loader.EVENT_NATIVE_CANPLAY];

AudioHTML5Loader.prototype._promiseMetadataCheck = function() {
    return this.audio.readyState > this.audio.HAVE_METADATA;
};

AudioHTML5Loader.prototype._promiseMetadata = function() {
    return this._waitFor("metadata", this._promiseMetadataCheck, AudioHTML5Loader._promiseMetadataEvents);
};

//---
AudioHTML5Loader._promiseLoadedEvents = [AudioHTML5Loader.EVENT_NATIVE_LOADING];

AudioHTML5Loader.prototype._promiseLoadedCheck = function() {
    var loaded = Math.min(this.position + 1, this.audio.duration);
    return this.audio.buffered.length
        && this.audio.buffered.end(0) - this.audio.buffered.start(0) >= loaded;
};

AudioHTML5Loader.prototype._promiseLoaded = function() {
    return this._waitFor("loaded", this._promiseLoadedCheck, AudioHTML5Loader._promiseLoadedEvents);
};

//---
AudioHTML5Loader._promisePlayingEvents = [AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE];

AudioHTML5Loader.prototype._promisePlayingCheck = function() {
    var time = Math.min(this.position + 0.2, this.audio.duration);
    return this.audio.currentTime >= time;
};

AudioHTML5Loader.prototype._promisePlaying = function() {
    return this._waitFor("playing", this._promisePlayingCheck, AudioHTML5Loader._promisePlayingEvents);
};

//---
AudioHTML5Loader.prototype._promiseStartPlaying = function() {
    if (!this.promises["startPlaying"]) {
        var deferred = new Deferred();
        this.promises["startPlaying"] = deferred;

        //INFO: если отменено ожидание загрузки или воспроизведения, то нужно отменить и это обещание
        var reject = this._cancelWait.bind(this, "startPlaying");

        this._promiseLoaded().then(function() {
            this._promisePlaying().then(function() {
                deferred.resolve();
                logger.debug(this, "startPlaying:success");
            }.bind(this), reject);

            setTimeout(function() {
                deferred.reject("timeout");
                this._cancelWait("playing", "timeout");
                logger.warn(this, "startPlaying:failed");
            }.bind(this), 1000);
        }.bind(this), reject);
    }

    return this.promises["startPlaying"].promise();
};

//---
AudioHTML5Loader.prototype.load = function(src) {
    logger.debug(this, "load", src);

    this._abortPromises("load");

    this.playing = false;
    this.notLoading = true;
    this.position = 0;

    this.src = src;
    this.audio.src = src;
    this.audio.load();
};

AudioHTML5Loader.prototype.stop = function() {
    logger.debug(this, "stop");

    this._abortPromises("stop");
    this.load("");
};

AudioHTML5Loader.prototype._startPlay = function() {
    logger.debug(this, "_startPlay");

    this.audio.currentTime = this.position;

    if (!this.playing) {
        return;
    }

    this.audio.play();

    //TODO: подумать нужно ли триггерить событие в случае успеха
    this._promiseStartPlaying().then(noop, this.__restart);
};

AudioHTML5Loader.prototype._restart = function(reason) {
    //TODO: подумать нужен ли тут какой-то счётик количества попыток
    if (reason && reason !== "timeout") {
        return;
    }

    logger.debug(this, "_restart", reason);

    //INFO: Запоминаем текущее состояние, т.к. оно сбросится после перезагрузки
    var position = this.position;
    var playing = this.playing;

    this.load(this.src);

    if (playing) {
        this.play(position);
    } else {
        this.setPosition(position);
    }
};

AudioHTML5Loader.prototype.play = function(position) {
    logger.debug(this, "play", position);

    this.playing = true;
    this.position = position == null ? this.position || 0 : position;
    this._promiseMetadata().then(this.__startPlay, noop);
};

AudioHTML5Loader.prototype.pause = function() {
    logger.debug(this, "pause");

    this.playing = false;
    this._cancelWait("startPlaying", "pause");
    this.audio.pause();
    this.position = this.audio.currentTime;
};

AudioHTML5Loader.prototype.setPosition = function(position) {
    logger.debug(this, "setPosition", position);

    this.position = position;

    this._promiseMetadata().then(function() {
        this.audio.currentTime = this.position;
    }.bind(this), noop);
};

//---
AudioHTML5Loader.prototype.createSource = function(audioContext) {
    if (this.output) {
        return;
    }

    logger.debug(this, "createSource");

    this.audio.crossOrigin = "anonymous";
    this.output = audioContext.createMediaElementSource(this.audio);
    this.output.connect(audioContext.destination);

    this._restart();
};

AudioHTML5Loader.prototype.destroySource = function() {
    /* !!!WARNING!!!
       Данный метод можно вызывать только в обработчике пользовательского события, т.к. свежесозданный
       элемент Audio нужно инициализировать - иначе будет недоступно воспроизведение. Инициализация элемента
       Audio возможна только в обработчике пользовательского события (клик, тач-событие или клавиатурное событие)
     */

    //INFO: единственный способ оторвать MediaElementSource от Audio - создать новый объект Audio

    if (!this.output) {
        return;
    }

    logger.warn(this, "destroySource");

    this.output.disconnect();
    this.output = null;

    this._abortPromises();

    this._deinitAudio();
    this._initAudio();

    this._restart();
};

//---
AudioHTML5Loader.prototype.destroy = function() {
    logger.debug(this, "destroy");

    if (this.output) {
        this.output.disconnect();
        this.output = null;
    }

    this._abortPromises();
    this._deinitAudio();

    this.__restart = null;
    this.__startPlay = null;
    this.promises = null;
};

module.exports = AudioHTML5Loader;

},{"../audio-static":4,"../error/playback-error":8,"../lib/async/deferred":23,"../lib/async/events":24,"../lib/noop":35,"../logger/logger":37}],21:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5');

var detect = require('../lib/browser/detect');
var Events = require('../lib/async/events');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');

var AudioHTML5Loader = require('./audio-html5-loader');

var playerId = 1;

exports.available = (function() {
    // ------------------------------------------------------------------------------ Базовая проверка поддержки браузером
    var html5_available = true;
    try {
        //some browsers doesn't understand new Audio()
        var audio = document.createElement('audio');
        var canPlay = audio.canPlayType("audio/mpeg");
        if (!canPlay || canPlay === 'no') {

            logger.warn(this, "HTML5 detection failed with reason", canPlay);
            html5_available = false;
        }
    } catch(e) {
        logger.warn(this, "HTML5 detection failed with error", e);
        html5_available = false;
    }

    logger.info(this, "detection", html5_available);
    return html5_available;
})();

try {
    var audioContext = new AudioContext();
    logger.info(this, "WenAudioAPI context created");
} catch(e) {
    audioContext = null;
    logger.info(this, "WenAudioAPI not detected");
}

/**
 * @class Класс html5 аудио-плеера
 * @extends IAudioImplementation
 *
 * @fires IAudioImplementation#play
 * @fires IAudioImplementation#ended
 * @fires IAudioImplementation#volumechange
 * @fires IAudioImplementation#crashed
 * @fires IAudioImplementation#swap
 *
 * @fires IAudioImplementation#stop
 * @fires IAudioImplementation#pause
 * @fires IAudioImplementation#progress
 * @fires IAudioImplementation#loading
 * @fires IAudioImplementation#loaded
 * @fires IAudioImplementation#error
 *
 * @constructor
 * @private
 */
var AudioHTML5 = function() {
    this.name = playerId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    this.webAudioApi = false;
    this.activeLoader = 0;
    this.loaders = [];

    this._addLoader();
    this._addLoader();

    this._setActive(0);
};
Events.mixin(AudioHTML5);
AudioHTML5.type = AudioHTML5.prototype.type = "html5";

/**
 * Добавить загрузчик аудио-файлов
 * @private
 */
AudioHTML5.prototype._addLoader = function() {
    logger.debug(this, "_addLoader");

    var self = this;
    var loader = new AudioHTML5Loader();
    loader.index = this.loaders.push(loader) - 1;

    loader.on("*", function(event, data) {
        var offset = (self.loaders.length + loader.index - self.activeLoader) % self.loaders.length;
        self.trigger(event, offset, data);
    });

    if (this.webAudioApi) {
        loader.createSource(audioContext);
    }
};

/**
 * Установить активный загрузчик
 * @param {int} offset - 0: текущий загрузчик, 1: следующий загрузчик
 * @private
 */
AudioHTML5.prototype._setActive = function(offset) {
    logger.debug(this, "_setActive", offset);

    this.activeLoader = (this.activeLoader + offset) % this.loaders.length;
    this.trigger(AudioStatic.EVENT_SWAP, offset);

    if (offset !== 0) {
        //INFO: если релизовывать концепцию множества загрузчиков, то это нужно доработать.
        this.stop(offset);
    }
};

/**
 * Получить загрузчик и отписать его от событий старта воспроизведения
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {Audio}
 * @private
 */
AudioHTML5.prototype._getLoader = function(offset) {
    offset = offset || 0;
    return this.loaders[(this.activeLoader + offset) % this.loaders.length];
};

/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 *
 * **Внимание!** - после включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode
 * @param {Boolean} state - запрашиваемый статус
 * @returns {Boolean} -- итоговый статус плеера
 */
AudioHTML5.prototype.toggleWebAudioAPI = function(state) {
    if (!audioContext) {
        logger.warn(this, "toggleWebAudioAPIError", state);
        return false;
    }

    logger.info(this, "toggleWebAudioAPI", state);

    if (this.webAudioApi == state) {
        return state;
    }

    if (state) {
        this.audioOutput = audioContext.createGain();
        this.audioOutput.gain.value = this.volume;
        this.audioOutput.connect(audioContext.destination);

        if (this.preprocessor) {
            this.preprocessor.output.connect(this.audioOutput);
        }

        this.loaders.forEach(function(loader) {
            loader.audio.volume = 1;
            loader.createSource(audioContext);

            loader.output.disconnect();
            loader.output.connect(this.preprocessor ? this.preprocessor.input : this.audioOutput);
        }.bind(this));

    } else if (this.audioOutput) {
        if (this.preprocessor) {
            this.preprocessor.output.disconnect();
        }

        this.audioOutput.disconnect();
        delete this.audioOutput;

        this.loaders.forEach(function(loader) {
            loader.audio.volume = this.volume;

            //INFO: после того как мы включили webAudioAPI его уже нельзя просто так выключить.
            loader.output.disconnect();
            loader.output.connect(audioContext.destination);
        }.bind(this));
    }

    this.webAudioApi = state;

    return state;
};

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудио-элементу у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость
 * @param {ya.Audio~AudioPreprocessor} preprocessor - препроцессор
 * @returns {boolean} -- статус успеха
 */
AudioHTML5.prototype.setAudioPreprocessor = function(preprocessor) {
    if (!this.webAudioApi) {
        logger.warn(this, "setAudioPreprocessorError", preprocessor);
        return false;
    }

    logger.info(this, "setAudioPreprocessor");

    if (this.preprocessor === preprocessor) {
        return true;
    }

    if (this.preprocessor) {
        this.preprocessor.output.disconnect();
    }

    this.preprocessor = preprocessor;

    if (!preprocessor) {
        this.loaders.forEach(function(loader) {
            loader.output.disconnect();
            loader.output.connect(this.audioOutput);
        }.bind(this));

        return true;
    }

    this.loaders.forEach(function(loader) {
        loader.output.disconnect();
        loader.output.connect(preprocessor.input);
    });

    preprocessor.output.connect(this.audioOutput);

    return true;
};

/**
 * Проиграть трек
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 */
AudioHTML5.prototype.play = function(src, duration) {
    logger.info(this, "play", src);

    var loader = this._getLoader();

    loader.load(src);
    loader.play();
};

/** Поставить трек на паузу */
AudioHTML5.prototype.pause = function() {
    logger.info(this, "pause");
    var loader = this._getLoader();
    loader.pause();
};

/** Снять трек с паузы */
AudioHTML5.prototype.resume = function() {
    logger.info(this, "resume");
    var loader = this._getLoader();
    loader.play();
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
AudioHTML5.prototype.stop = function(offset) {
    logger.info(this, "stop");
    var loader = this._getLoader(offset || 0);
    loader.stop();

    this.trigger(AudioStatic.EVENT_STOP, offset);
};

/**
 * Предзагрузить трек
 * @param {String} src - Ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 */
AudioHTML5.prototype.preload = function(src, duration, offset) {
    logger.info(this, "preload", src, offset);

    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(offset);
    loader.load(src);
};

/**
 * Проверить что трек предзагружается
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloaded = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(offset);
    return loader.src === src && !loader.notLoading;
};

/**
 * Проверить что трек начал предзагружаться
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloading = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(offset);
    return loader.src === src;
};

/**
 * Запустить воспроизведение предзагруженного трека
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean} -- доступность данного действия
 */
AudioHTML5.prototype.playPreloaded = function(offset) {
    logger.info(this, "playPreloaded", offset);
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(offset);

    if (!loader.src) {
        return false;
    }

    this._setActive(offset);
    loader.play();

    return true;
};

/**
 * Получить позицию воспроизведения
 * @returns {number}
 */
AudioHTML5.prototype.getPosition = function() {
    return this._getLoader().audio.currentTime;
};

/**
 * Установить текущую позицию воспроизведения
 * @param {number} position
 */
AudioHTML5.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);
    this._getLoader().setPosition(position - 0.001); //INFO: понять нафиг тут нужен 0.001
};

/**
 * Получить длительность трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getDuration = function(offset) {
    return this._getLoader(offset).audio.duration;
};

/**
 * Получить длительность загруженной части трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getLoaded = function(offset) {
    var loader = this._getLoader(offset);

    if (loader.audio.buffered.length) {
        return loader.audio.buffered.end(0) - loader.audio.buffered.start(0);
    }
    return 0;
};

/**
 * Получить текущее значение громкости
 * @returns {number}
 */
AudioHTML5.prototype.getVolume = function() {
    return this.volume;
};

/**
 * Установить значение громкости
 * @param {number} volume
 */
AudioHTML5.prototype.setVolume = function(volume) {
    logger.info(this, "setVolume", volume);
    this.volume = volume;

    if (this.webAudioApi) {
        this.audioOutput.gain.value = volume;
    } else {
        this.loaders.forEach(function(loader) {
            loader.audio.volume = volume;
        });
    }

    this.trigger(AudioStatic.EVENT_VOLUME);
};

/**
 * Получить ссылку на трек
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {String|Boolean} -- Ссылка на трек или false, если нет загружаемого трека
 */
AudioHTML5.prototype.getSrc = function(offset) {
    return this._getLoader(offset).src;
};

/**
 * Проверить доступен ли программный контроль громкости
 * @returns {boolean}
 */
AudioHTML5.prototype.isDeviceVolume = function() {
    return detect.onlyDeviceVolume;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
AudioHTML5.prototype._logger = function() {
    try {
        return {
            main: this.getSrc(0),
            preloader: this.getSrc(1)
        };
    } catch(e) {
        return "";
    }
};

exports.audioContext = audioContext;
exports.AudioImplementation = AudioHTML5;

},{"../audio-static":4,"../error/playback-error":8,"../lib/async/events":24,"../lib/browser/detect":27,"../logger/logger":37,"./audio-html5-loader":20}],22:[function(require,module,exports){
var YandexAudio = require('./export');
require('./error/export');
require('./lib/net/error/export');
require('./logger/export');
require('./fx/equalizer/export');

module.exports = YandexAudio;

},{"./error/export":7,"./export":9,"./fx/equalizer/export":18,"./lib/net/error/export":33,"./logger/export":36}],23:[function(require,module,exports){
var Promise = require('./promise');
var noop = require('../noop');

/**
 * @class Отложенное действие
 * @constructor
 * @private
 */
var Deferred = function() {
    var self = this;

    var _promise = new Promise(function(resolve, reject) {
        /**
         * Разрешить обещание
         * @method Deferred#resolve
         * @param {*} data - передать данные в обещание
         */
        self.resolve = resolve;

        /**
         * Отклонить обещание
         * @method Deferred#reject
         * @param {Error} error - передать ошибку
         */
        self.reject = reject;
    });

    var promise = _promise.then(function(data) {
        self.resolved = true;
        self.pending = false;
        return data;
    }, function(err) {
        self.rejected = true;
        self.pending = false;
        throw err;
    });
    promise["catch"](noop); // Don't throw errors to console

    /**
     * Выполнилось ли обещание
     * @type {boolean}
     */
    this.pending = true;

    /**
     * Отклонилось ли обещание
     * @type {boolean}
     */
    this.rejected = false;

    /**
     * Получить обещание
     * @method Deferred#promise
     * @returns {Promise}
     */
    this.promise = function() { return promise; };
};

/**
 * Ожидание выполнения списка обещаний
 * @param {...*} args - обещания, которые требуется ожидать
 * @returns AbortablePromise
 */
Deferred.when = function() {
    var deferred = new Deferred();

    var list = [].slice.call(arguments);
    var pending = list.length;

    var resolve = function() {
        pending--;

        if (pending <= 0) {
            deferred.resolve();
        }
    };

    list.forEach(function(promise) {
        promise.then(resolve, deferred.reject);
    });
    list = null;

    deferred.promise.abort = deferred.reject;

    return deferred.promise();
};

module.exports = Deferred;

},{"../noop":35,"./promise":25}],24:[function(require,module,exports){
var merge = require('../data/merge');

var LISTENERS_NAME = "_listeners";
var MUTE_OPTION = "_muted";

/**
 * Диспетчер событий
 * @constructor
 */
var Events = function() {
    /** Контейнер для списков слушателей событий
     * @alias Events#_listeners
     * @type {Object.<String, Array.<Function>>}
     * @private
     */
    this[LISTENERS_NAME] = {};

    /** Флаг включения/выключения событий
     * @alias Events#_mutes
     * @type {Boolean}
     * @private
     */
    this[MUTE_OPTION] = false;
};

/**
 * Расширить произвольный класс свойствами диспетчера событий
 * @param {Function} classConstructor - конструктор класса
 * @returns {Function} -- тот же конструктор класса, расширенный свойствами диспетчера событий
 */
Events.mixin = function(classConstructor) {
    merge(classConstructor.prototype, Events.prototype, true);
    return classConstructor;
};

/**
 * Расширить произвольный объект свойствами диспетчера событий
 * @param {Object} object - объект
 * @returns {Object} -- тот же объект, расширенный свойствами диспетчера событий
 */
Events.eventize = function(object) {
    merge(object, Events.prototype, true);
    Events.call(object);
    return object;
};

/**
 * Подписаться на событие
 * @param {String} event - имя события
 * @param {function} callback - обработчик события
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.on = function(event, callback) {
    if (!this[LISTENERS_NAME][event]) {
        this[LISTENERS_NAME][event] = [];
    }

    this[LISTENERS_NAME][event].push(callback);
    return this;
};

/**
 * Отписаться от события
 * @param {String} event - имя события
 * @param {function} callback - обработчик события
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.off = function(event, callback) {
    if (!this[LISTENERS_NAME][event]) {
        return this;
    }

    if (!callback) {
        delete this[LISTENERS_NAME][event];
        return this;
    }

    var callbacks = this[LISTENERS_NAME][event];
    for (var k = 0, l = callbacks.length; k < l; k++) {
        if (callbacks[k] === callback || callbacks[k].callback === callback) {
            callbacks.splice(k, 1);
            if (!callbacks.length) {
                delete this[LISTENERS_NAME][event];
            }
            break;
        }
    }

    return this;
};

/**
 * Подписаться на событие, отписаться сразу после первого возникновения события
 * @param {String} event - имя события
 * @param {function} callback - обработчик события
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.once = function(event, callback) {
    var self = this;

    var wrapper = function() {
        self.off(event, wrapper);
        callback.apply(this, arguments);
    };

    wrapper.callback = callback;
    self.on(event, wrapper);

    return this;
};

/**
 * Запустить событие
 * @param {String} event - имя события
 * @param {...args} args - параметры для передачи вместе с событием
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.trigger = function(event, args) {
    if (this[MUTE_OPTION]) {
        return this;
    }

    args = [].slice.call(arguments, 1);

    if (event !== "*") {
        Events.prototype.trigger.apply(this, ["*", event].concat(args));
    }

    if (!this[LISTENERS_NAME][event]) {
        return this;
    }

    var callbacks = [].concat(this[LISTENERS_NAME][event]);
    for (var k = 0, l = callbacks.length; k < l; k++) {
        callbacks[k].apply(null, args);
    }

    return this;
};

/**
 * Отписаться от всех слушателей событий
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.clearListeners = function() {
    for (var key in this[LISTENERS_NAME]) {
        if (this[LISTENERS_NAME].hasOwnProperty(key)) {
            delete this[LISTENERS_NAME][key];
        }
    }

    return this;
};

/**
 * Делегировать все события другому диспетчеру событий
 * @param {Events} acceptor - получатель событий
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.pipeEvents = function(acceptor) {
    this.on("*", Events.prototype.trigger.bind(acceptor));
    return this;
};

/**
 * Остановить запуск событий
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.muteEvents = function() {
    this[MUTE_OPTION] = true;
    return this;
};

/**
 * Возобновить запуск событий
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.unmuteEvents = function() {
    delete this[MUTE_OPTION];
    return this;
};

module.exports = Events;

},{"../data/merge":32}],25:[function(require,module,exports){
var vow = require('vow');
var detect = require('../browser/detect');

/**
 * {@link https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise|ES-6 Promise}
 * @constructor
 */
var Promise;
if (typeof window.Promise !== "function"
    || detect.browser.name === "msie" || detect.browser.name === "edge" // мелкие мягкие как всегда ничего не умеют делать правильно
) {
    Promise = vow.Promise;
} else {
    Promise = window.Promise;
}

module.exports = Promise;

/**
 * Создать обещание разрешённое переданными данными
 * @method Promise.resolve
 * @param {*} data - данные, которыми разрешить обещание
 * @static
 * @returns {Promise}
 */

/**
 * Создать обещание отклонённое переданными данными
 * @method Promise.reject
 * @param {*} data - данные, которыми отклонить обещание
 * @static
 * @returns {Promise}
 */

/**
 * Создать обещание, которое выполнится тогда, когда будут выполнены все переданные обещания.
 * @method Promise.all
 * @param {Array.<Promise>} promises - список обещаний
 * @static
 * @returns {Promise}
 */

/**
 * Создать обещание, которое выполнится тогда, когда будет выполнено хотя бы одно из переданных обещаний.
 * @method Promise.race
 * @param {Array.<Promise>} promises - список обещаний
 * @static
 * @returns {Promise}
 */

/**
 * Назначить обработчики разрешения и отклонения обещания
 * @method Promise#then
 * @param {function} callback - обработчик успеха
 * @param {null|function} [errback] - обработчик ошибки
 * @returns {Promise} -- новое обещание из результатов обработчика
 */

/**
 * Назначить обработчик отклонения обещания
 * @method Promise#catch
 * @param {function} errback -  обработчик ошибки
 * @returns {Promise} -- новое обещание из результатов обработчика
 */

//------------------------------------------------------------------------- AbortablePromise
/**
 * Обещание с возможностью отмены связанного с ним действия.
 * @class AbortablePromise
 * @extends Promise
 */

/**
 * Отмена действия связанного с обещаением
 * @abstract
 * @method AbortablePromise#abort
 * @param {String|Error} reason - причина отмены действия
 */

},{"../browser/detect":27,"vow":2}],26:[function(require,module,exports){
var noop = require('../noop');
var Promise = require('./promise');

module.exports = function(data) {
    var promise = Promise.reject(data);
    promise["catch"](noop);
    return promise;
};

},{"../noop":35,"./promise":25}],27:[function(require,module,exports){
var ua = navigator.userAgent.toLowerCase();

// ------------------------------------------------------------------------------ Browser detection
// Useragent RegExp
var rwebkit = /(webkit)[ \/]([\w.]+)/;
var ryabro = /(yabrowser)[ \/]([\w.]+)/;
var ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/;
var rmsie = /(msie) ([\w.]+)/;
var redge = /(edge)\/([\w.]+)/;
var rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
var rsafari = /^((?!chrome).)*version\/([\d\w\.]+).*(safari)/;

var match = rsafari.exec(ua) || ryabro.exec(ua) || redge.exec(ua) || rwebkit.exec(ua) || ropera.exec(ua) || rmsie.exec(ua) || ua.indexOf("compatible") < 0
    && rmozilla.exec(ua)
    || [];

var browser = {name: match[1] || "", version: match[2] || "0"};

if (match[3] === "safari") {
    browser.name = match[3];
}

if (browser.name === 'msie') {
    if (document.documentMode) { // IE8 or later
        browser.documentMode = document.documentMode;
    } else { // IE 5-7
        browser.documentMode = 5; // Assume quirks mode unless proven otherwise
        if (document.compatMode) {
            if (document.compatMode === "CSS1Compat") {
                browser.documentMode = 7; // standards mode
            }
        }
    }
}

//INFO: IE (как всегда) не корректно выставляет user-agent
if (browser.name === "mozilla" && browser.version.split(".")[0] === "11") {
    browser.name = "msie";
}

// ------------------------------------------------------------------------------ Platform detection
// Useragent RegExp
var rplatform = /(ipad|iphone|ipod|android|blackberry|playbook|windows ce|webos)/;
var rtablet = /(ipad|playbook)/;
var randroid = /(android)/;
var rmobile = /(mobile)/;

platform = rplatform.exec(ua) || [];
var tablet = rtablet.exec(ua) || !rmobile.exec(ua) && randroid.exec(ua) || [];

if (platform[1]) {
    platform[1] = platform[1].replace(/\s/g, "_"); // Change whitespace to underscore. Enables dot notation.
}

var platform = {
    type: platform[1] || "",
    tablet: !!tablet[1],
    mobile: platform[1] && !tablet[1] || false
};
if (!platform.type) {
    platform.type = 'pc';
}

platform.os = platform.type;
if (platform.type === 'ipad' || platform.type === 'iphone' || platform.type === 'ipod') {
    platform.os = 'ios';
} else if (platform.type === 'android') {
    platform.os = 'android';
} else if (navigator.appVersion.indexOf("Win") !== -1) {
    platform.os = "windows";
    platform.version = navigator.userAgent.match(/win[^ ]* ([^;]*)/i);
    platform.version = platform.version && platform.version[1];
} else if (navigator.appVersion.indexOf("Mac") !== -1) {
    platform.os = "macos";
} else if (navigator.appVersion.indexOf("X11") !== -1) {
    platform.os = "unix";
} else if (navigator.appVersion.indexOf("Linux") !== -1) {
    platform.os = "linux";
}

// ------------------------------------------------------------------------------ Детектирование блокировки громкости
var noVolume = true;
try {
    var audio = document.createElement('audio');
    audio.volume = 0.63;
    noVolume = Math.abs(audio.volume - 0.63) > 0.01;
} catch(e) {
    noVolume = true;
}

// ------------------------------------------------------------------------------ Экспорт
/**
 * Информация об окружении
 * @namespace
 * @private
 */
var detect = {
    /**
     * Информация о браузере
     * @type {object}
     * @property {string} name - название браузера
     * @property {string} version - версия
     * @property {number} [documentMode] - версия документа
     */
    browser: browser,

    /**
     * Информация о платформе
     * @type {object}
     * @property {string} os - тип операционной системы
     * @property {string} type - тип платформы
     * @property {boolean} tablet - планшет
     * @property {boolean} mobile - мобильный
     */
    platform: platform,

    /**
     * Настройка громкости
     * @type {boolean}
     */
    onlyDeviceVolume: noVolume
};

module.exports = detect;

},{}],28:[function(require,module,exports){
/**
 * @license SWFObject v2.2 <http://code.google.com/p/swfobject/>
 * is released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 * @private
*/
var swfobject = function() {
	var UNDEF = "undefined",
		OBJECT = "object",
		SHOCKWAVE_FLASH = "Shockwave Flash",
		SHOCKWAVE_FLASH_AX = "ShockwaveFlash.ShockwaveFlash",
		FLASH_MIME_TYPE = "application/x-shockwave-flash",
		EXPRESS_INSTALL_ID = "SWFObjectExprInst",
		ON_READY_STATE_CHANGE = "onreadystatechange",
		win = window,
		doc = document,
		nav = navigator,
		plugin = false,
		domLoadFnArr = [main],
		regObjArr = [],
		objIdArr = [],
		listenersArr = [],
		storedAltContent,
		storedAltContentId,
		storedCallbackFn,
		storedCallbackObj,
		isDomLoaded = false,
		isExpressInstallActive = false,
		dynamicStylesheet,
		dynamicStylesheetMedia,
		autoHideShow = true,
	/* Centralized function for browser feature detection
		- User agent string detection is only used when no good alternative is possible
		- Is executed directly for optimal performance
	*/
	ua = function() {
		var w3cdom = typeof doc.getElementById != UNDEF && typeof doc.getElementsByTagName != UNDEF && typeof doc.createElement != UNDEF,
			u = nav.userAgent.toLowerCase(),
			p = nav.platform.toLowerCase(),
			windows = p ? /win/.test(p) : /win/.test(u),
			mac = p ? /mac/.test(p) : /mac/.test(u),
			webkit = /webkit/.test(u) ? parseFloat(u.replace(/^.*webkit\/(\d+(\.\d+)?).*$/, "$1")) : false, // returns either the webkit version or false if not webkit
			ie = !+"\v1", // feature detection based on Andrea Giammarchi's solution: http://webreflection.blogspot.com/2009/01/32-bytes-to-know-if-your-browser-is-ie.html
			playerVersion = [0,0,0],
			d = null;
		if (typeof nav.plugins != UNDEF && typeof nav.plugins[SHOCKWAVE_FLASH] == OBJECT) {
			d = nav.plugins[SHOCKWAVE_FLASH].description;
			if (d && !(typeof nav.mimeTypes != UNDEF && nav.mimeTypes[FLASH_MIME_TYPE] && !nav.mimeTypes[FLASH_MIME_TYPE].enabledPlugin)) { // navigator.mimeTypes["application/x-shockwave-flash"].enabledPlugin indicates whether plug-ins are enabled or disabled in Safari 3+
				plugin = true;
				ie = false; // cascaded feature detection for Internet Explorer
				d = d.replace(/^.*\s+(\S+\s+\S+$)/, "$1");
				playerVersion[0] = parseInt(d.replace(/^(.*)\..*$/, "$1"), 10);
				playerVersion[1] = parseInt(d.replace(/^.*\.(.*)\s.*$/, "$1"), 10);
				playerVersion[2] = /[a-zA-Z]/.test(d) ? parseInt(d.replace(/^.*[a-zA-Z]+(.*)$/, "$1"), 10) : 0;
			}
		}
		else if (typeof win.ActiveXObject != UNDEF) {
			try {
				var a = new ActiveXObject(SHOCKWAVE_FLASH_AX);
				if (a) { // a will return null when ActiveX is disabled
					d = a.GetVariable("$version");
					if (d) {
						ie = true; // cascaded feature detection for Internet Explorer
						d = d.split(" ")[1].split(",");
						playerVersion = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
					}
				}
			}
			catch(e) {}
		}
		return { w3:w3cdom, pv:playerVersion, wk:webkit, ie:ie, win:windows, mac:mac };
	}(),
	/* Cross-browser onDomLoad
		- Will fire an event as soon as the DOM of a web page is loaded
		- Internet Explorer workaround based on Diego Perini's solution: http://javascript.nwbox.com/IEContentLoaded/
		- Regular onload serves as fallback
	*/
	onDomLoad = function() {
		if (!ua.w3) { return; }
		if ((typeof doc.readyState != UNDEF && doc.readyState == "complete") || (typeof doc.readyState == UNDEF && (doc.getElementsByTagName("body")[0] || doc.body))) { // function is fired after onload, e.g. when script is inserted dynamically
			callDomLoadFunctions();
		}
		if (!isDomLoaded) {
			if (typeof doc.addEventListener != UNDEF) {
				doc.addEventListener("DOMContentLoaded", callDomLoadFunctions, false);
			}
			if (ua.ie && ua.win) {
				doc.attachEvent(ON_READY_STATE_CHANGE, function() {
					if (doc.readyState == "complete") {
						doc.detachEvent(ON_READY_STATE_CHANGE, arguments.callee);
						callDomLoadFunctions();
					}
				});
				if (win == top) { // if not inside an iframe
					(function(){
						if (isDomLoaded) { return; }
						try {
							doc.documentElement.doScroll("left");
						}
						catch(e) {
							setTimeout(arguments.callee, 0);
							return;
						}
						callDomLoadFunctions();
					})();
				}
			}
			if (ua.wk) {
				(function(){
					if (isDomLoaded) { return; }
					if (!/loaded|complete/.test(doc.readyState)) {
						setTimeout(arguments.callee, 0);
						return;
					}
					callDomLoadFunctions();
				})();
			}
			addLoadEvent(callDomLoadFunctions);
		}
	}();
	function callDomLoadFunctions() {
		if (isDomLoaded) { return; }
		try { // test if we can really add/remove elements to/from the DOM; we don't want to fire it too early
			var t = doc.getElementsByTagName("body")[0].appendChild(createElement("span"));
			t.parentNode.removeChild(t);
		}
		catch (e) { return; }
		isDomLoaded = true;
		var dl = domLoadFnArr.length;
		for (var i = 0; i < dl; i++) {
			domLoadFnArr[i]();
		}
	}
	function addDomLoadEvent(fn) {
		if (isDomLoaded) {
			fn();
		}
		else {
			domLoadFnArr[domLoadFnArr.length] = fn; // Array.push() is only available in IE5.5+
		}
	}
	/* Cross-browser onload
		- Based on James Edwards' solution: http://brothercake.com/site/resources/scripts/onload/
		- Will fire an event as soon as a web page including all of its assets are loaded
	 */
	function addLoadEvent(fn) {
		if (typeof win.addEventListener != UNDEF) {
			win.addEventListener("load", fn, false);
		}
		else if (typeof doc.addEventListener != UNDEF) {
			doc.addEventListener("load", fn, false);
		}
		else if (typeof win.attachEvent != UNDEF) {
			addListener(win, "onload", fn);
		}
		else if (typeof win.onload == "function") {
			var fnOld = win.onload;
			win.onload = function() {
				fnOld();
				fn();
			};
		}
		else {
			win.onload = fn;
		}
	}
	/* Main function
		- Will preferably execute onDomLoad, otherwise onload (as a fallback)
	*/
	function main() {
		if (plugin) {
			testPlayerVersion();
		}
		else {
			matchVersions();
		}
	}
	/* Detect the Flash Player version for non-Internet Explorer browsers
		- Detecting the plug-in version via the object element is more precise than using the plugins collection item's description:
		  a. Both release and build numbers can be detected
		  b. Avoid wrong descriptions by corrupt installers provided by Adobe
		  c. Avoid wrong descriptions by multiple Flash Player entries in the plugin Array, caused by incorrect browser imports
		- Disadvantage of this method is that it depends on the availability of the DOM, while the plugins collection is immediately available
	*/
	function testPlayerVersion() {
		var b = doc.getElementsByTagName("body")[0];
		var o = createElement(OBJECT);
		o.setAttribute("type", FLASH_MIME_TYPE);
		var t = b.appendChild(o);
		if (t) {
			var counter = 0;
			(function(){
				if (typeof t.GetVariable != UNDEF) {
					var d = t.GetVariable("$version");
					if (d) {
						d = d.split(" ")[1].split(",");
						ua.pv = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
					}
				}
				else if (counter < 10) {
					counter++;
					setTimeout(arguments.callee, 10);
					return;
				}
				b.removeChild(o);
				t = null;
				matchVersions();
			})();
		}
		else {
			matchVersions();
		}
	}
	/* Perform Flash Player and SWF version matching; static publishing only
	*/
	function matchVersions() {
		var rl = regObjArr.length;
		if (rl > 0) {
			for (var i = 0; i < rl; i++) { // for each registered object element
				var id = regObjArr[i].id;
				var cb = regObjArr[i].callbackFn;
				var cbObj = {success:false, id:id};
				if (ua.pv[0] > 0) {
					var obj = getElementById(id);
					if (obj) {
						if (hasPlayerVersion(regObjArr[i].swfVersion) && !(ua.wk && ua.wk < 312)) { // Flash Player version >= published SWF version: Houston, we have a match!
							setVisibility(id, true);
							if (cb) {
								cbObj.success = true;
								cbObj.ref = getObjectById(id);
								cb(cbObj);
							}
						}
						else if (regObjArr[i].expressInstall && canExpressInstall()) { // show the Adobe Express Install dialog if set by the web page author and if supported
							var att = {};
							att.data = regObjArr[i].expressInstall;
							att.width = obj.getAttribute("width") || "0";
							att.height = obj.getAttribute("height") || "0";
							if (obj.getAttribute("class")) { att.styleclass = obj.getAttribute("class"); }
							if (obj.getAttribute("align")) { att.align = obj.getAttribute("align"); }
							// parse HTML object param element's name-value pairs
							var par = {};
							var p = obj.getElementsByTagName("param");
							var pl = p.length;
							for (var j = 0; j < pl; j++) {
								if (p[j].getAttribute("name").toLowerCase() != "movie") {
									par[p[j].getAttribute("name")] = p[j].getAttribute("value");
								}
							}
							showExpressInstall(att, par, id, cb);
						}
						else { // Flash Player and SWF version mismatch or an older Webkit engine that ignores the HTML object element's nested param elements: display alternative content instead of SWF
							displayAltContent(obj);
							if (cb) { cb(cbObj); }
						}
					}
				}
				else {	// if no Flash Player is installed or the fp version cannot be detected we let the HTML object element do its job (either show a SWF or alternative content)
					setVisibility(id, true);
					if (cb) {
						var o = getObjectById(id); // test whether there is an HTML object element or not
						if (o && typeof o.SetVariable != UNDEF) {
							cbObj.success = true;
							cbObj.ref = o;
						}
						cb(cbObj);
					}
				}
			}
		}
	}
	function getObjectById(objectIdStr) {
		var r = null;
		var o = getElementById(objectIdStr);
		if (o && o.nodeName == "OBJECT") {
			if (typeof o.SetVariable != UNDEF) {
				r = o;
			}
			else {
				var n = o.getElementsByTagName(OBJECT)[0];
				if (n) {
					r = n;
				}
			}
		}
		return r;
	}
	/* Requirements for Adobe Express Install
		- only one instance can be active at a time
		- fp 6.0.65 or higher
		- Win/Mac OS only
		- no Webkit engines older than version 312
	*/
	function canExpressInstall() {
		return !isExpressInstallActive && hasPlayerVersion("6.0.65") && (ua.win || ua.mac) && !(ua.wk && ua.wk < 312);
	}
	/* Show the Adobe Express Install dialog
		- Reference: http://www.adobe.com/cfusion/knowledgebase/index.cfm?id=6a253b75
	*/
	function showExpressInstall(att, par, replaceElemIdStr, callbackFn) {
		isExpressInstallActive = true;
		storedCallbackFn = callbackFn || null;
		storedCallbackObj = {success:false, id:replaceElemIdStr};
		var obj = getElementById(replaceElemIdStr);
		if (obj) {
			if (obj.nodeName == "OBJECT") { // static publishing
				storedAltContent = abstractAltContent(obj);
				storedAltContentId = null;
			}
			else { // dynamic publishing
				storedAltContent = obj;
				storedAltContentId = replaceElemIdStr;
			}
			att.id = EXPRESS_INSTALL_ID;
			if (typeof att.width == UNDEF || (!/%$/.test(att.width) && parseInt(att.width, 10) < 310)) { att.width = "310"; }
			if (typeof att.height == UNDEF || (!/%$/.test(att.height) && parseInt(att.height, 10) < 137)) { att.height = "137"; }
			doc.title = doc.title.slice(0, 47) + " - Flash Player Installation";
			var pt = ua.ie && ua.win ? "ActiveX" : "PlugIn",
				fv = "MMredirectURL=" + win.location.toString().replace(/&/g,"%26") + "&MMplayerType=" + pt + "&MMdoctitle=" + doc.title;
			if (typeof par.flashvars != UNDEF) {
				par.flashvars += "&" + fv;
			}
			else {
				par.flashvars = fv;
			}
			// IE only: when a SWF is loading (AND: not available in cache) wait for the readyState of the object element to become 4 before removing it,
			// because you cannot properly cancel a loading SWF file without breaking browser load references, also obj.onreadystatechange doesn't work
			if (ua.ie && ua.win && obj.readyState != 4) {
				var newObj = createElement("div");
				replaceElemIdStr += "SWFObjectNew";
				newObj.setAttribute("id", replaceElemIdStr);
				obj.parentNode.insertBefore(newObj, obj); // insert placeholder div that will be replaced by the object element that loads expressinstall.swf
				obj.style.display = "none";
				(function(){
					if (obj.readyState == 4) {
						obj.parentNode.removeChild(obj);
					}
					else {
						setTimeout(arguments.callee, 10);
					}
				})();
			}
			createSWF(att, par, replaceElemIdStr);
		}
	}
	/* Functions to abstract and display alternative content
	*/
	function displayAltContent(obj) {
		if (ua.ie && ua.win && obj.readyState != 4) {
			// IE only: when a SWF is loading (AND: not available in cache) wait for the readyState of the object element to become 4 before removing it,
			// because you cannot properly cancel a loading SWF file without breaking browser load references, also obj.onreadystatechange doesn't work
			var el = createElement("div");
			obj.parentNode.insertBefore(el, obj); // insert placeholder div that will be replaced by the alternative content
			el.parentNode.replaceChild(abstractAltContent(obj), el);
			obj.style.display = "none";
			(function(){
				if (obj.readyState == 4) {
					obj.parentNode.removeChild(obj);
				}
				else {
					setTimeout(arguments.callee, 10);
				}
			})();
		}
		else {
			obj.parentNode.replaceChild(abstractAltContent(obj), obj);
		}
	}
	function abstractAltContent(obj) {
		var ac = createElement("div");
		if (ua.win && ua.ie) {
			ac.innerHTML = obj.innerHTML;
		}
		else {
			var nestedObj = obj.getElementsByTagName(OBJECT)[0];
			if (nestedObj) {
				var c = nestedObj.childNodes;
				if (c) {
					var cl = c.length;
					for (var i = 0; i < cl; i++) {
						if (!(c[i].nodeType == 1 && c[i].nodeName == "PARAM") && !(c[i].nodeType == 8)) {
							ac.appendChild(c[i].cloneNode(true));
						}
					}
				}
			}
		}
		return ac;
	}
	/* Cross-browser dynamic SWF creation
	*/
	function createSWF(attObj, parObj, id) {
		var r, el = getElementById(id);
		if (ua.wk && ua.wk < 312) { return r; }
		if (el) {
			if (typeof attObj.id == UNDEF) { // if no 'id' is defined for the object element, it will inherit the 'id' from the alternative content
				attObj.id = id;
			}
			if (ua.ie && ua.win) { // Internet Explorer + the HTML object element + W3C DOM methods do not combine: fall back to outerHTML
				var att = "";
				for (var i in attObj) {
					if (attObj[i] != Object.prototype[i]) { // filter out prototype additions from other potential libraries
						if (i.toLowerCase() == "data") {
							parObj.movie = attObj[i];
						}
						else if (i.toLowerCase() == "styleclass") { // 'class' is an ECMA4 reserved keyword
							att += ' class="' + attObj[i] + '"';
						}
						else if (i.toLowerCase() != "classid") {
							att += ' ' + i + '="' + attObj[i] + '"';
						}
					}
				}
				var par = "";
				for (var j in parObj) {
					if (parObj[j] != Object.prototype[j]) { // filter out prototype additions from other potential libraries
						par += '<param name="' + j + '" value="' + parObj[j] + '" />';
					}
				}
				el.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"' + att + '>' + par + '</object>';
				objIdArr[objIdArr.length] = attObj.id; // stored to fix object 'leaks' on unload (dynamic publishing only)
				r = getElementById(attObj.id);
			}
			else { // well-behaving browsers
				var o = createElement(OBJECT);
				o.setAttribute("type", FLASH_MIME_TYPE);
				for (var m in attObj) {
					if (attObj[m] != Object.prototype[m]) { // filter out prototype additions from other potential libraries
						if (m.toLowerCase() == "styleclass") { // 'class' is an ECMA4 reserved keyword
							o.setAttribute("class", attObj[m]);
						}
						else if (m.toLowerCase() != "classid") { // filter out IE specific attribute
							o.setAttribute(m, attObj[m]);
						}
					}
				}
				for (var n in parObj) {
					if (parObj[n] != Object.prototype[n] && n.toLowerCase() != "movie") { // filter out prototype additions from other potential libraries and IE specific param element
						createObjParam(o, n, parObj[n]);
					}
				}
				el.parentNode.replaceChild(o, el);
				r = o;
			}
		}
		return r;
	}
	function createObjParam(el, pName, pValue) {
		var p = createElement("param");
		p.setAttribute("name", pName);
		p.setAttribute("value", pValue);
		el.appendChild(p);
	}
	/* Cross-browser SWF removal
		- Especially needed to safely and completely remove a SWF in Internet Explorer
	*/
	function removeSWF(id) {
		var obj = getElementById(id);
		if (obj && obj.nodeName == "OBJECT") {
			if (ua.ie && ua.win) {
				obj.style.display = "none";
				(function(){
					if (obj.readyState == 4) {
						removeObjectInIE(id);
					}
					else {
						setTimeout(arguments.callee, 10);
					}
				})();
			}
			else {
				obj.parentNode.removeChild(obj);
			}
		}
	}
	function removeObjectInIE(id) {
		var obj = getElementById(id);
		if (obj) {
			for (var i in obj) {
				if (typeof obj[i] == "function") {
					obj[i] = null;
				}
			}
			obj.parentNode.removeChild(obj);
		}
	}
	/* Functions to optimize JavaScript compression
	*/
	function getElementById(id) {
		var el = null;
		try {
			el = doc.getElementById(id);
		}
		catch (e) {}
		return el;
	}
	function createElement(el) {
		return doc.createElement(el);
	}
	/* Updated attachEvent function for Internet Explorer
		- Stores attachEvent information in an Array, so on unload the detachEvent functions can be called to avoid memory leaks
	*/
	function addListener(target, eventType, fn) {
		target.attachEvent(eventType, fn);
		listenersArr[listenersArr.length] = [target, eventType, fn];
	}
	/* Flash Player and SWF content version matching
	*/
	function hasPlayerVersion(rv) {
		var pv = ua.pv, v = rv.split(".");
		v[0] = parseInt(v[0], 10);
		v[1] = parseInt(v[1], 10) || 0; // supports short notation, e.g. "9" instead of "9.0.0"
		v[2] = parseInt(v[2], 10) || 0;
		return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2])) ? true : false;
	}
	/* Cross-browser dynamic CSS creation
		- Based on Bobby van der Sluis' solution: http://www.bobbyvandersluis.com/articles/dynamicCSS.php
	*/
	function createCSS(sel, decl, media, newStyle) {
		if (ua.ie && ua.mac) { return; }
		var h = doc.getElementsByTagName("head")[0];
		if (!h) { return; } // to also support badly authored HTML pages that lack a head element
		var m = (media && typeof media == "string") ? media : "screen";
		if (newStyle) {
			dynamicStylesheet = null;
			dynamicStylesheetMedia = null;
		}
		if (!dynamicStylesheet || dynamicStylesheetMedia != m) {
			// create dynamic stylesheet + get a global reference to it
			var s = createElement("style");
			s.setAttribute("type", "text/css");
			s.setAttribute("media", m);
			dynamicStylesheet = h.appendChild(s);
			if (ua.ie && ua.win && typeof doc.styleSheets != UNDEF && doc.styleSheets.length > 0) {
				dynamicStylesheet = doc.styleSheets[doc.styleSheets.length - 1];
			}
			dynamicStylesheetMedia = m;
		}
		// add style rule
		if (ua.ie && ua.win) {
			if (dynamicStylesheet && typeof dynamicStylesheet.addRule == OBJECT) {
				dynamicStylesheet.addRule(sel, decl);
			}
		}
		else {
			if (dynamicStylesheet && typeof doc.createTextNode != UNDEF) {
				dynamicStylesheet.appendChild(doc.createTextNode(sel + " {" + decl + "}"));
			}
		}
	}
	function setVisibility(id, isVisible) {
		if (!autoHideShow) { return; }
		var v = isVisible ? "visible" : "hidden";
		if (isDomLoaded && getElementById(id)) {
			getElementById(id).style.visibility = v;
		}
		else {
			createCSS("#" + id, "visibility:" + v);
		}
	}
	/* Filter to avoid XSS attacks
	*/
	function urlEncodeIfNecessary(s) {
		var regex = /[\\\"<>\.;]/;
		var hasBadChars = regex.exec(s) != null;
		return hasBadChars && typeof encodeURIComponent != UNDEF ? encodeURIComponent(s) : s;
	}
	/* Release memory to avoid memory leaks caused by closures, fix hanging audio/video threads and force open sockets/NetConnections to disconnect (Internet Explorer only)
	*/
	var cleanup = function() {
		if (ua.ie && ua.win) {
			window.attachEvent("onunload", function() {
				// remove listeners to avoid memory leaks
				var ll = listenersArr.length;
				for (var i = 0; i < ll; i++) {
					listenersArr[i][0].detachEvent(listenersArr[i][1], listenersArr[i][2]);
				}
				// cleanup dynamically embedded objects to fix audio/video threads and force open sockets and NetConnections to disconnect
				var il = objIdArr.length;
				for (var j = 0; j < il; j++) {
					removeSWF(objIdArr[j]);
				}
				// cleanup library's main closures to avoid memory leaks
				for (var k in ua) {
					ua[k] = null;
				}
				ua = null;
				for (var l in swfobject) {
					swfobject[l] = null;
				}
				swfobject = null;
			});
		}
	}();
	return {
		/* Public API
			- Reference: http://code.google.com/p/swfobject/wiki/documentation
		*/
		registerObject: function(objectIdStr, swfVersionStr, xiSwfUrlStr, callbackFn) {
			if (ua.w3 && objectIdStr && swfVersionStr) {
				var regObj = {};
				regObj.id = objectIdStr;
				regObj.swfVersion = swfVersionStr;
				regObj.expressInstall = xiSwfUrlStr;
				regObj.callbackFn = callbackFn;
				regObjArr[regObjArr.length] = regObj;
				setVisibility(objectIdStr, false);
			}
			else if (callbackFn) {
				callbackFn({success:false, id:objectIdStr});
			}
		},
		getObjectById: function(objectIdStr) {
			if (ua.w3) {
				return getObjectById(objectIdStr);
			}
		},
		embedSWF: function(swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj, parObj, attObj, callbackFn) {
			var callbackObj = {success:false, id:replaceElemIdStr};
			if (ua.w3 && !(ua.wk && ua.wk < 312) && swfUrlStr && replaceElemIdStr && widthStr && heightStr && swfVersionStr) {
				setVisibility(replaceElemIdStr, false);
				addDomLoadEvent(function() {
					widthStr += ""; // auto-convert to string
					heightStr += "";
					var att = {};
					if (attObj && typeof attObj === OBJECT) {
						for (var i in attObj) { // copy object to avoid the use of references, because web authors often reuse attObj for multiple SWFs
							att[i] = attObj[i];
						}
					}
					att.data = swfUrlStr;
					att.width = widthStr;
					att.height = heightStr;
					var par = {};
					if (parObj && typeof parObj === OBJECT) {
						for (var j in parObj) { // copy object to avoid the use of references, because web authors often reuse parObj for multiple SWFs
							par[j] = parObj[j];
						}
					}
					if (flashvarsObj && typeof flashvarsObj === OBJECT) {
						for (var k in flashvarsObj) { // copy object to avoid the use of references, because web authors often reuse flashvarsObj for multiple SWFs
							if (typeof par.flashvars != UNDEF) {
								par.flashvars += "&" + k + "=" + flashvarsObj[k];
							}
							else {
								par.flashvars = k + "=" + flashvarsObj[k];
							}
						}
					}
					if (hasPlayerVersion(swfVersionStr)) { // create SWF
						var obj = createSWF(att, par, replaceElemIdStr);
						if (att.id == replaceElemIdStr) {
							setVisibility(replaceElemIdStr, true);
						}
						callbackObj.success = true;
						callbackObj.ref = obj;
					}
					else if (xiSwfUrlStr && canExpressInstall()) { // show Adobe Express Install
						att.data = xiSwfUrlStr;
						showExpressInstall(att, par, replaceElemIdStr, callbackFn);
						return;
					}
					else { // show alternative content
						setVisibility(replaceElemIdStr, true);
					}
					if (callbackFn) { callbackFn(callbackObj); }
				});
			}
			else if (callbackFn) { callbackFn(callbackObj);	}
		},
		switchOffAutoHideShow: function() {
			autoHideShow = false;
		},
		ua: ua,
		getFlashPlayerVersion: function() {
			return { major:ua.pv[0], minor:ua.pv[1], release:ua.pv[2] };
		},
		hasFlashPlayerVersion: hasPlayerVersion,
		createSWF: function(attObj, parObj, replaceElemIdStr) {
			if (ua.w3) {
				return createSWF(attObj, parObj, replaceElemIdStr);
			}
			else {
				return undefined;
			}
		},
		showExpressInstall: function(att, par, replaceElemIdStr, callbackFn) {
			if (ua.w3 && canExpressInstall()) {
				showExpressInstall(att, par, replaceElemIdStr, callbackFn);
			}
		},
		removeSWF: function(objElemIdStr) {
			if (ua.w3) {
				removeSWF(objElemIdStr);
			}
		},
		createCSS: function(selStr, declStr, mediaStr, newStyleBoolean) {
			if (ua.w3) {
				createCSS(selStr, declStr, mediaStr, newStyleBoolean);
			}
		},
		addDomLoadEvent: addDomLoadEvent,
		addLoadEvent: addLoadEvent,
		getQueryParamValue: function(param) {
			var q = doc.location.search || doc.location.hash;
			if (q) {
				if (/\?/.test(q)) { q = q.split("?")[1]; } // strip question mark
				if (param == null) {
					return urlEncodeIfNecessary(q);
				}
				var pairs = q.split("&");
				for (var i = 0; i < pairs.length; i++) {
					if (pairs[i].substring(0, pairs[i].indexOf("=")) == param) {
						return urlEncodeIfNecessary(pairs[i].substring((pairs[i].indexOf("=") + 1)));
					}
				}
			}
			return "";
		},
		// For internal usage only
		expressInstallCallback: function() {
			if (isExpressInstallActive) {
				var obj = getElementById(EXPRESS_INSTALL_ID);
				if (obj && storedAltContent) {
					obj.parentNode.replaceChild(storedAltContent, obj);
					if (storedAltContentId) {
						setVisibility(storedAltContentId, true);
						if (ua.ie && ua.win) { storedAltContent.style.display = "block"; }
					}
					if (storedCallbackFn) { storedCallbackFn(storedCallbackObj); }
				}
				isExpressInstallActive = false;
			}
		}
	};
}();
module.exports = swfobject;

},{}],29:[function(require,module,exports){
/**
 * Создаёт экземпляр класса, но не запускает его конструктор
 * @param {function} OriginalClass - класс
 * @returns {OriginalClass}
 * @private
 */
var clearInstance = function(OriginalClass) {
    var ClearClass = function(){};
    ClearClass.prototype = OriginalClass.prototype;
    return new ClearClass();
};

module.exports = clearInstance;

},{}],30:[function(require,module,exports){
var clearInstance = require('./clear-instance');

/**
 * Classic Error acts like a fabric: Error.call(this, message) just create new object.
 * ErrorClass acts more like a class: ErrorClass.call(this, message) modify 'this' object.
 * @param {String} [message] - error message
 * @param {Number} [id] - error id
 * @extends Error
 * @constructor
 * @private
 */
var ErrorClass = function(message, id) {
    var err = new Error(message, id);
    err.name = this.name;

    this.message = err.message;
    this.stack = err.stack;
};

/**
 * Sugar. Just create inheritance from ErrorClass and define name property
 * @param {String} name - name of error type
 * @returns {ErrorClass}
 */
ErrorClass.create = function(name) {
    var errClass = clearInstance(ErrorClass);
    errClass.name = name;
    return errClass;
};

ErrorClass.prototype = clearInstance(Error);
ErrorClass.prototype.name = "ErrorClass";

module.exports = ErrorClass;

},{"./clear-instance":29}],31:[function(require,module,exports){
var Events = require('../async/events');

/**
 * @class Прокси-класс. Выдаёт наружу лишь публичные методы объекта и статические свойства.
 * Не копирует методы из Object.prototype. Все методы имеют привязку контекста к проксируемому объекту.
 *
 * @param {Object} [object] - объект, который требуется проксировать
 * @constructor
 * @private
 */
var Proxy = function(object) {
    if (object) {
        for (var key in object) {
            if (key[0] === "_"
                || typeof object[key] !== "function"
                || object[key] === Object.prototype[key]
                || object.hasOwnProperty(key)
                || Events.prototype.hasOwnProperty(key)) {
                continue;
            }

            this[key] = object[key].bind(object);
        }

        if (object.pipeEvents) {
            Events.call(this);

            this.on = Events.prototype.on;
            this.once = Events.prototype.once;
            this.off = Events.prototype.off;
            this.clearListeners = Events.prototype.clearListeners;

            object.pipeEvents(this);
        }
    }
};

/**
 * Экспортирует статические свойства из одного объекта в другой, исключая указанные, приватные и прототип
 * @param {Object} from - откуда копировать
 * @param {Object} to - куда копировать
 * @param {Array.<String>} [exclude] - свойства которые требуется исключить
 */
Proxy.exportStatic = function(from, to, exclude) {
    exclude = exclude || [];

    Object.keys(from).forEach(function(key) {
        if (!from.hasOwnProperty(key)
            || key[0] === "_"
            || key === "prototype"
            || exclude.indexOf(key) !== -1) {
            return;
        }

        to[key] = from[key];
    });
};

/**
 * Создание прокси-пласса привязанного к указанному классу. Можно назначить родительский класс.
 * У родительского класса появляется приватный метод _proxy, который выдаёт прокси-объект для
 * данного экземляра. Также появляется свойство __proxy, содержащее ссылку на созданный прокси-объект
 *
 * @param {function} OriginalClass - оригинальный класс
 * @param {function} ParentProxyClass - родительский класс
 * @returns {function} -- конструтор проксированного класса
 */
Proxy.createClass = function(OriginalClass, ParentProxyClass) {

    var ProxyClass = function() {
        var OriginalClassConstructor = function() {};
        OriginalClassConstructor.prototype = OriginalClass.prototype;

        var original = new OriginalClassConstructor();
        OriginalClass.apply(original, arguments);

        return original._proxy();
    };

    var ParentProxyClassConstructor = function() {};
    ParentProxyClassConstructor.prototype = (ParentProxyClass || Proxy).prototype;
    ProxyClass.prototype = new ParentProxyClassConstructor();

    var val;
    for (var k in OriginalClass.prototype) {
        val = OriginalClass.prototype[k];
        if (Object.prototype[k] == val || typeof val === "function" || k[0] === "_") {
            continue;
        }
        ProxyClass.prototype[k] = val;
    }

    var createProxy = function(original) {
        var proto = Proxy.prototype;
        Proxy.prototype = ProxyClass.prototype;
        var proxy = new Proxy(original);
        Proxy.prototype = proto;
        return proxy;
    };

    OriginalClass.prototype._proxy = function() {
        if (!this.__proxy) {
            this.__proxy = createProxy(this);
        }

        return this.__proxy;
    };

    Proxy.exportStatic(OriginalClass, ProxyClass);

    return ProxyClass;
};

module.exports = Proxy;

},{"../async/events":24}],32:[function(require,module,exports){
/**
 * Скопировать свойства всех перечисленных объектов в один.
 * @param {Object} initial - если последний аргумент true, то новый объект не создаётся, а используется данный
 * @param {...Object|Boolean} args - список объектов из которых копировать свойства. Последний аргумент может быть либо
 * объектом, либо true.
 * @returns {Object}
 * @private
 */
var merge = function (initial) {
    var args = [].slice.call(arguments, 1);
    var object;
    var key;

    if (args[args.length - 1] === true) {
        object = initial;
        args.pop();
    } else {
        object = {};
        for (key in initial) {
            if (initial.hasOwnProperty(key)) {
                object[key] = initial[key];
            }
        }
    }

    for (var k = 0, l = args.length; k < l; k++) {
        for (key in args[k]) {
            if (args[k].hasOwnProperty(key)) {
                object[key] = args[k][key];
            }
        }
    }

    return object;
};

module.exports = merge;

},{}],33:[function(require,module,exports){
require('../../../export');

var LoaderError = require('./loader-error');

ya.Audio.LoaderError = LoaderError;

},{"../../../export":9,"./loader-error":34}],34:[function(require,module,exports){
var ErrorClass = require('../../class/error-class');

/**
 * Класс ошибок загрузчика
 * @alias ya.Audio.LoaderError
 *
 * @param {String} message - текст ошибкки
 *
 * @extends Error
 *
 * @constructor
 */
var LoaderError = function(message) {
    ErrorClass.call(this, message);
};
LoaderError.prototype = ErrorClass.create("LoaderError");

/**
 * Таймаут загрузки
 * @type {string}
 * @const
 */
LoaderError.TIMEOUT = "request timeout";
/**
 * Ошибка запроса на загрузку
 * @type {string}
 * @const
 */
LoaderError.FAILED = "request failed";

module.exports = LoaderError;

},{"../../class/error-class":30}],35:[function(require,module,exports){
module.exports = function() {};

},{}],36:[function(require,module,exports){
require("../export");

var Logger = require('./logger');

ya.Audio.Logger = Logger;

},{"../export":9,"./logger":37}],37:[function(require,module,exports){
var LEVELS = ["debug", "log", "info", "warn", "error", "trace"];
var noop = require('../lib/noop');

/**
 * Настраиваемые логгер для аудио-плеера
 * @alias ya.Audio.Logger
 * @param {String} channel - имя канала, за который будет отвечать экземляр логгера
 * @constructor
 */
var Logger = function(channel) {
    this.channel = channel;
};

/**
 * Список игнорируемых каналов
 * @type {Array.<String>}
 */
Logger.ignores = [];

/**
 * Список отображаемых в консоли уровней лога
 * @type {Array.<String>}
 */
Logger.logLevels = [];

/**
 * Запись в лог с уровнем **debug**
 * @method ya.Audio.Logger#debug
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.debug = noop;

/**
 * Запись в лог с уровнем **log**
 * @method ya.Audio.Logger#log
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.log = noop;

/**
 * Запись в лог с уровнем **info**
 * @method ya.Audio.Logger#info
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.info = noop;

/**
 * Запись в лог с уровнем **warn**
 * @method ya.Audio.Logger#warn
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.warn = noop;

/**
 * Запись в лог с уровнем **error**
 * @method ya.Audio.Logger#error
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.error = noop;

/**
 * Запись в лог с уровнем **trace**
 * @method ya.Audio.Logger#trace
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.trace = noop;

/**
 * Сделать запись в лог
 * @param {String} level - уровень лога
 * @param {String} channel - канал
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.log = function(level, channel, context) {
    var data = [].slice.call(arguments, 3).map(function(dumpItem) {
        return dumpItem && dumpItem._logger && dumpItem._logger() || dumpItem;
    });

    var logEntry = {
        timestamp: +new Date(),
        level: level,
        channel: channel,
        context: context,
        message: data
    };

    if (Logger.ignores[channel] || Logger.logLevels.indexOf(level) === -1) {
        return;
    }

    Logger._dumpEntry(logEntry);
};

/**
 * Запись в логе
 * @typedef {Object} ya.Audio.Logger~LogEntry
 *
 * @property {Number} timestamp - время в timestamp формате
 * @property {String} level - уровень лога
 * @property {String} channel - канал
 * @property {Object} context - контекст вызова
 * @property {Array} message - дополнительные аргументы
 *
 * @private
 */

/**
 * Записать сообщение лога в консоль
 * @param {ya.Audio.Logger~LogEntry} logEntry - сообщение лога
 * @private
 */
Logger._dumpEntry = function(logEntry) {
    try {
        var level = logEntry.level;

        var name = logEntry.context && (logEntry.context.taskName || logEntry.context.name);
        var context = logEntry.context && (logEntry.context._logger ? logEntry.context._logger() : "");

        if (typeof console[level] !== "function") {
            console.log.apply(console, [
                level.toUpperCase(),
                Logger._formatTimestamp(logEntry.timestamp),
                "[" + logEntry.channel + (name ? ":" + name : "") + "]",
                context
            ].concat(logEntry.message));
        } else {
            console[level].apply(console, [
                Logger._formatTimestamp(logEntry.timestamp),
                "[" + logEntry.channel + (name ? ":" + name : "") + "]",
                context
            ].concat(logEntry.message));
        }
    } catch(e) {
    }
};

/**
 * Вспомогательная функция форматирования даты для вывода в коносоль
 * @param timestamp
 * @returns {string}
 * @private
 */
Logger._formatTimestamp = function(timestamp) {
    var date = new Date(timestamp);
    var ms = date.getMilliseconds();
    ms = ms > 100 ? ms : ms > 10 ? "0" + ms : "00" + ms;
    return date.toLocaleTimeString() + "." + ms;
};

LEVELS.forEach(function(level) {
    Logger.prototype[level] = function() {
        var args = [].slice.call(arguments);
        args.unshift(this.channel);
        args.unshift(level);
        Logger.log.apply(Logger, args);
    };
});

module.exports = Logger;

},{"../lib/noop":35}]},{},[22])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci5qcyIsInNyYy9meC9lcXVhbGl6ZXIvZXhwb3J0LmpzIiwic3JjL2Z4L2V4cG9ydC5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9jbGVhci1pbnN0YW5jZS5qcyIsInNyYy9saWIvY2xhc3MvZXJyb3ItY2xhc3MuanMiLCJzcmMvbGliL2NsYXNzL3Byb3h5LmpzIiwic3JjL2xpYi9kYXRhL21lcmdlLmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yLmpzIiwic3JjL2xpYi9ub29wLmpzIiwic3JjL2xvZ2dlci9leHBvcnQuanMiLCJzcmMvbG9nZ2VyL2xvZ2dlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOTFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hNQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2h1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKipcbiAqIEBtb2R1bGUgdm93XG4gKiBAYXV0aG9yIEZpbGF0b3YgRG1pdHJ5IDxkZmlsYXRvdkB5YW5kZXgtdGVhbS5ydT5cbiAqIEB2ZXJzaW9uIDAuNC4xMFxuICogQGxpY2Vuc2VcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBhbmQgR1BMIGxpY2Vuc2VzOlxuICogICAqIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwXG4gKiAgICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC5odG1sXG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuXG52YXIgdW5kZWYsXG4gICAgbmV4dFRpY2sgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBmbnMgPSBbXSxcbiAgICAgICAgICAgIGVucXVldWVGbiA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZucy5wdXNoKGZuKSA9PT0gMTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsRm5zID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZuc1RvQ2FsbCA9IGZucywgaSA9IDAsIGxlbiA9IGZucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm5zID0gW107XG4gICAgICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICBmbnNUb0NhbGxbaSsrXSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgaWYodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBpZTEwLCBub2RlanMgPj0gMC4xMFxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBzZXRJbW1lZGlhdGUoY2FsbEZucyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmIHByb2Nlc3MubmV4dFRpY2spIHsgLy8gbm9kZWpzIDwgMC4xMFxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBwcm9jZXNzLm5leHRUaWNrKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBNdXRhdGlvbk9ic2VydmVyID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7IC8vIG1vZGVybiBicm93c2Vyc1xuICAgICAgICBpZihNdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICAgICAgICB2YXIgbnVtID0gMSxcbiAgICAgICAgICAgICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuXG4gICAgICAgICAgICBuZXcgTXV0YXRpb25PYnNlcnZlcihjYWxsRm5zKS5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YSA6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgKG5vZGUuZGF0YSA9IChudW0gKj0gLTEpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZihnbG9iYWwucG9zdE1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHZhciBpc1Bvc3RNZXNzYWdlQXN5bmMgPSB0cnVlO1xuICAgICAgICAgICAgaWYoZ2xvYmFsLmF0dGFjaEV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGNoZWNrQXN5bmMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUG9zdE1lc3NhZ2VBc3luYyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKCdfX2NoZWNrQXN5bmMnLCAnKicpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5kZXRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzUG9zdE1lc3NhZ2VBc3luYykge1xuICAgICAgICAgICAgICAgIHZhciBtc2cgPSAnX19wcm9taXNlJyArICtuZXcgRGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgb25NZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZS5kYXRhID09PSBtc2cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbiAmJiBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyP1xuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIG9uTWVzc2FnZSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBnbG9iYWwucG9zdE1lc3NhZ2UobXNnLCAnKicpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuICAgICAgICBpZignb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0JykpIHsgLy8gaWU2LWllOFxuICAgICAgICAgICAgdmFyIGNyZWF0ZVNjcmlwdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0ID0gc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAoZG9jLmRvY3VtZW50RWxlbWVudCB8fCBkb2MuYm9keSkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgY3JlYXRlU2NyaXB0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7IC8vIG9sZCBicm93c2Vyc1xuICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBzZXRUaW1lb3V0KGNhbGxGbnMsIDApO1xuICAgICAgICB9O1xuICAgIH0pKCksXG4gICAgdGhyb3dFeGNlcHRpb24gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH0sXG4gICAgaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JztcbiAgICB9LFxuICAgIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyxcbiAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICB9LFxuICAgIGdldEFycmF5S2V5cyA9IGZ1bmN0aW9uKGFycikge1xuICAgICAgICB2YXIgcmVzID0gW10sXG4gICAgICAgICAgICBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgcmVzLnB1c2goaSsrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgZ2V0T2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgIGZvcih2YXIgaSBpbiBvYmopIHtcbiAgICAgICAgICAgIG9iai5oYXNPd25Qcm9wZXJ0eShpKSAmJiByZXMucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgZGVmaW5lQ3VzdG9tRXJyb3JUeXBlID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB2YXIgcmVzID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVzLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICB3cmFwT25GdWxmaWxsZWQgPSBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgaWR4KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgIG9uRnVsZmlsbGVkLmNhbGwodGhpcywgdmFsLCBpZHgpO1xuICAgICAgICB9O1xuICAgIH07XG5cbi8qKlxuICogQGNsYXNzIERlZmVycmVkXG4gKiBAZXhwb3J0cyB2b3c6RGVmZXJyZWRcbiAqIEBkZXNjcmlwdGlvblxuICogVGhlIGBEZWZlcnJlZGAgY2xhc3MgaXMgdXNlZCB0byBlbmNhcHN1bGF0ZSBuZXdseS1jcmVhdGVkIHByb21pc2Ugb2JqZWN0IGFsb25nIHdpdGggZnVuY3Rpb25zIHRoYXQgcmVzb2x2ZSwgcmVqZWN0IG9yIG5vdGlmeSBpdC5cbiAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICogQGRlc2NyaXB0aW9uXG4gKiBZb3UgY2FuIHVzZSBgdm93LmRlZmVyKClgIGluc3RlYWQgb2YgdXNpbmcgdGhpcyBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBgbmV3IHZvdy5EZWZlcnJlZCgpYCBnaXZlcyB0aGUgc2FtZSByZXN1bHQgYXMgYHZvdy5kZWZlcigpYC5cbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcHJvbWlzZSA9IG5ldyBQcm9taXNlKCk7XG59O1xuXG5EZWZlcnJlZC5wcm90b3R5cGUgPSAvKiogQGxlbmRzIERlZmVycmVkLnByb3RvdHlwZSAqL3tcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvbWlzZSA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHZhbHVlIGlzIFwiJ3N1Y2Nlc3MnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIucmVzb2x2ZSgnc3VjY2VzcycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSB8fCB0aGlzLl9wcm9taXNlLl9yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVqZWN0cyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UuZmFpbChmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgKiAgICAgLy8gcmVhc29uIGlzIFwiJ3NvbWV0aGluZyBpcyB3cm9uZydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5yZWplY3QoJ3NvbWV0aGluZyBpcyB3cm9uZycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBpZih0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodm93LmlzUHJvbWlzZShyZWFzb24pKSB7XG4gICAgICAgICAgICByZWFzb24gPSByZWFzb24udGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QodmFsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlLl9yZXNvbHZlKHJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlLl9yZWplY3QocmVhc29uKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBOb3RpZmllcyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLnByb2dyZXNzKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHZhbHVlIGlzIFwiJzIwJSdcIiwgXCInNDAlJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLm5vdGlmeSgnMjAlJyk7XG4gICAgICogZGVmZXIubm90aWZ5KCc0MCUnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBub3RpZnkgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSB8fCB0aGlzLl9wcm9taXNlLl9ub3RpZnkodmFsdWUpO1xuICAgIH1cbn07XG5cbnZhciBQUk9NSVNFX1NUQVRVUyA9IHtcbiAgICBQRU5ESU5HICAgOiAwLFxuICAgIFJFU09MVkVEICA6IDEsXG4gICAgRlVMRklMTEVEIDogMixcbiAgICBSRUpFQ1RFRCAgOiAzXG59O1xuXG4vKipcbiAqIEBjbGFzcyBQcm9taXNlXG4gKiBAZXhwb3J0cyB2b3c6UHJvbWlzZVxuICogQGRlc2NyaXB0aW9uXG4gKiBUaGUgYFByb21pc2VgIGNsYXNzIGlzIHVzZWQgd2hlbiB5b3Ugd2FudCB0byBnaXZlIHRvIHRoZSBjYWxsZXIgc29tZXRoaW5nIHRvIHN1YnNjcmliZSB0byxcbiAqIGJ1dCBub3QgdGhlIGFiaWxpdHkgdG8gcmVzb2x2ZSBvciByZWplY3QgdGhlIGRlZmVycmVkLlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlciBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2RvbWVuaWMvcHJvbWlzZXMtdW53cmFwcGluZy9ibG9iL21hc3Rlci9SRUFETUUubWQjdGhlLXByb21pc2UtY29uc3RydWN0b3IgZm9yIGRldGFpbHMuXG4gKiBAZGVzY3JpcHRpb25cbiAqIFlvdSBzaG91bGQgdXNlIHRoaXMgY29uc3RydWN0b3IgZGlyZWN0bHkgb25seSBpZiB5b3UgYXJlIGdvaW5nIHRvIHVzZSBgdm93YCBhcyBET00gUHJvbWlzZXMgaW1wbGVtZW50YXRpb24uXG4gKiBJbiBvdGhlciBjYXNlIHlvdSBzaG91bGQgdXNlIGB2b3cuZGVmZXIoKWAgYW5kIGBkZWZlci5wcm9taXNlKClgIG1ldGhvZHMuXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIGZ1bmN0aW9uIGZldGNoSlNPTih1cmwpIHtcbiAqICAgICByZXR1cm4gbmV3IHZvdy5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCwgbm90aWZ5KSB7XG4gKiAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAqICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gKiAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gKiAgICAgICAgIHhoci5zZW5kKCk7XG4gKiAgICAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAqICAgICAgICAgICAgIGlmKHhoci5yZXNwb25zZSkge1xuICogICAgICAgICAgICAgICAgIHJlc29sdmUoeGhyLnJlc3BvbnNlKTtcbiAqICAgICAgICAgICAgIH1cbiAqICAgICAgICAgICAgIGVsc2Uge1xuICogICAgICAgICAgICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCkpO1xuICogICAgICAgICAgICAgfVxuICogICAgICAgICB9O1xuICogICAgIH0pO1xuICogfVxuICogYGBgXG4gKi9cbnZhciBQcm9taXNlID0gZnVuY3Rpb24ocmVzb2x2ZXIpIHtcbiAgICB0aGlzLl92YWx1ZSA9IHVuZGVmO1xuICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlBFTkRJTkc7XG5cbiAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gW107XG5cbiAgICBpZihyZXNvbHZlcikgeyAvLyBOT1RFOiBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2RvbWVuaWMvcHJvbWlzZXMtdW53cmFwcGluZy9ibG9iL21hc3Rlci9SRUFETUUubWRcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPSByZXNvbHZlci5sZW5ndGg7XG5cbiAgICAgICAgcmVzb2x2ZXIoXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX3Jlc29sdmUodmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID4gMT9cbiAgICAgICAgICAgICAgICBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9IDpcbiAgICAgICAgICAgICAgICB1bmRlZixcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPiAyP1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX25vdGlmeSh2YWwpO1xuICAgICAgICAgICAgICAgIH0gOlxuICAgICAgICAgICAgICAgIHVuZGVmKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgUHJvbWlzZS5wcm90b3R5cGUgKi8ge1xuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBmdWxmaWxsZWQgcHJvbWlzZSBvciB0aGUgcmVhc29uIGluIGNhc2Ugb2YgcmVqZWN0aW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgdmFsdWVPZiA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZXNvbHZlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzICE9PSBQUk9NSVNFX1NUQVRVUy5QRU5ESU5HO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc0Z1bGZpbGxlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzID09PSBQUk9NSVNFX1NUQVRVUy5GVUxGSUxMRUQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZWplY3RlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzID09PSBQUk9NSVNFX1NUQVRVUy5SRUpFQ1RFRDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyByZWFjdGlvbnMgdG8gdGhlIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX0gQSBuZXcgcHJvbWlzZSwgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9wcm9taXNlcy1hcGx1cy9wcm9taXNlcy1zcGVjIGZvciBkZXRhaWxzXG4gICAgICovXG4gICAgdGhlbiA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrcyhkZWZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgb25seSBhIHJlamVjdGlvbiByZWFjdGlvbi4gVGhpcyBtZXRob2QgaXMgYSBzaG9ydGhhbmQgZm9yIGBwcm9taXNlLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhIHByb3ZpZGVkICdyZWFzb24nIGFzIGFyZ3VtZW50IGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICAnY2F0Y2gnIDogZnVuY3Rpb24ob25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgb25seSBhIHJlamVjdGlvbiByZWFjdGlvbi4gVGhpcyBtZXRob2QgaXMgYSBzaG9ydGhhbmQgZm9yIGBwcm9taXNlLnRoZW4obnVsbCwgb25SZWplY3RlZClgLiBJdCdzIGFsc28gYW4gYWxpYXMgZm9yIGBjYXRjaGAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aXRoIHRoZSB2YWx1ZSBhZnRlciBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmYWlsIDogZnVuY3Rpb24ob25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSByZXNvbHZpbmcgcmVhY3Rpb24gKGZvciBib3RoIGZ1bGZpbGxtZW50IGFuZCByZWplY3Rpb24pLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZXNvbHZlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIHRoZSBwcm9taXNlIGFzIGFuIGFyZ3VtZW50LCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsd2F5cyA6IGZ1bmN0aW9uKG9uUmVzb2x2ZWQsIGN0eCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgY2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25SZXNvbHZlZC5jYWxsKHRoaXMsIF90aGlzKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihjYiwgY2IsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBwcm9ncmVzcyByZWFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUHJvZ3Jlc3MgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgd2hlbiB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvZ3Jlc3MgOiBmdW5jdGlvbihvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgdW5kZWYsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExpa2UgYHByb21pc2UudGhlbmAsIGJ1dCBcInNwcmVhZHNcIiB0aGUgYXJyYXkgaW50byBhIHZhcmlhZGljIHZhbHVlIGhhbmRsZXIuXG4gICAgICogSXQgaXMgdXNlZnVsIHdpdGggdGhlIGB2b3cuYWxsYCBhbmQgdGhlIGB2b3cuYWxsUmVzb2x2ZWRgIG1ldGhvZHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpXSkuc3ByZWFkKGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgICAgKiAgICAgLy8gYXJnMSBpcyBcIjFcIiwgYXJnMiBpcyBcIid0d28nXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoJ3R3bycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHNwcmVhZCA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvbkZ1bGZpbGxlZC5hcHBseSh0aGlzLCB2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uUmVqZWN0ZWQsXG4gICAgICAgICAgICBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMaWtlIGB0aGVuYCwgYnV0IHRlcm1pbmF0ZXMgYSBjaGFpbiBvZiBwcm9taXNlcy5cbiAgICAgKiBJZiB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCwgdGhpcyBtZXRob2QgdGhyb3dzIGl0J3MgXCJyZWFzb25cIiBhcyBhbiBleGNlcHRpb24gaW4gYSBmdXR1cmUgdHVybiBvZiB0aGUgZXZlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICogZGVmZXIucmVqZWN0KEVycm9yKCdJbnRlcm5hbCBlcnJvcicpKTtcbiAgICAgKiBkZWZlci5wcm9taXNlKCkuZG9uZSgpOyAvLyBleGNlcHRpb24gdG8gYmUgdGhyb3duXG4gICAgICogYGBgXG4gICAgICovXG4gICAgZG9uZSA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdGhpc1xuICAgICAgICAgICAgLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eClcbiAgICAgICAgICAgIC5mYWlsKHRocm93RXhjZXB0aW9uKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBwcm9taXNlIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgaW4gYGRlbGF5YCBtaWxsaXNlY29uZHMgaWYgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkLFxuICAgICAqIG9yIGltbWVkaWF0ZWx5IHJlamVjdGVkIGlmIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGRlbGF5IDogZnVuY3Rpb24oZGVsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVyLFxuICAgICAgICAgICAgcHJvbWlzZSA9IHRoaXMudGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBkZWxheSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcHJvbWlzZS5hbHdheXMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBwcm9taXNlIHRoYXQgd2lsbCBiZSByZWplY3RlZCBpbiBgdGltZW91dGAgbWlsbGlzZWNvbmRzXG4gICAgICogaWYgdGhlIHByb21pc2UgaXMgbm90IHJlc29sdmVkIGJlZm9yZWhhbmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZVdpdGhUaW1lb3V0MSA9IGRlZmVyLnByb21pc2UoKS50aW1lb3V0KDUwKSxcbiAgICAgKiAgICAgcHJvbWlzZVdpdGhUaW1lb3V0MiA9IGRlZmVyLnByb21pc2UoKS50aW1lb3V0KDIwMCk7XG4gICAgICpcbiAgICAgKiBzZXRUaW1lb3V0KFxuICAgICAqICAgICBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgIGRlZmVyLnJlc29sdmUoJ29rJyk7XG4gICAgICogICAgIH0sXG4gICAgICogICAgIDEwMCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlV2l0aFRpbWVvdXQxLmZhaWwoZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICogICAgIC8vIHByb21pc2VXaXRoVGltZW91dCB0byBiZSByZWplY3RlZCBpbiA1MG1zXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlV2l0aFRpbWVvdXQyLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gcHJvbWlzZVdpdGhUaW1lb3V0IHRvIGJlIGZ1bGZpbGxlZCB3aXRoIFwiJ29rJ1wiIHZhbHVlXG4gICAgICogfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgdGltZW91dCA6IGZ1bmN0aW9uKHRpbWVvdXQpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChuZXcgdm93LlRpbWVkT3V0RXJyb3IoJ3RpbWVkIG91dCcpKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRpbWVvdXQpO1xuXG4gICAgICAgIHRoaXMudGhlbihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUodmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmVyLnByb21pc2UoKS5hbHdheXMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICBfdm93IDogdHJ1ZSxcblxuICAgIF9yZXNvbHZlIDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih2YWwgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlamVjdChUeXBlRXJyb3IoJ0NhblxcJ3QgcmVzb2x2ZSBwcm9taXNlIHdpdGggaXRzZWxmJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQ7XG5cbiAgICAgICAgaWYodmFsICYmICEhdmFsLl92b3cpIHsgLy8gc2hvcnRwYXRoIGZvciB2b3cuUHJvbWlzZVxuICAgICAgICAgICAgdmFsLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbCh2YWwudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgdmFsLmlzUmVqZWN0ZWQoKT9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0KHZhbC52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICAgICAgdmFsLnRoZW4oXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbm90aWZ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc09iamVjdCh2YWwpIHx8IGlzRnVuY3Rpb24odmFsKSkge1xuICAgICAgICAgICAgdmFyIHRoZW47XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoZW4gPSB2YWwudGhlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3Jlc29sdmUodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Jlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX25vdGlmeSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCB8fCB0aGlzLl9yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZnVsZmlsbCh2YWwpO1xuICAgIH0sXG5cbiAgICBfZnVsZmlsbCA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuRlVMRklMTEVEO1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHZhbDtcblxuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcywgdmFsKTtcbiAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IHVuZGVmO1xuICAgIH0sXG5cbiAgICBfcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5SRUpFQ1RFRDtcbiAgICAgICAgdGhpcy5fdmFsdWUgPSByZWFzb247XG5cbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9yZWplY3RlZENhbGxiYWNrcywgcmVhc29uKTtcbiAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IHVuZGVmO1xuICAgIH0sXG5cbiAgICBfbm90aWZ5IDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MsIHZhbCk7XG4gICAgfSxcblxuICAgIF9hZGRDYWxsYmFja3MgOiBmdW5jdGlvbihkZWZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICBpZihvblJlamVjdGVkICYmICFpc0Z1bmN0aW9uKG9uUmVqZWN0ZWQpKSB7XG4gICAgICAgICAgICBjdHggPSBvblJlamVjdGVkO1xuICAgICAgICAgICAgb25SZWplY3RlZCA9IHVuZGVmO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob25Qcm9ncmVzcyAmJiAhaXNGdW5jdGlvbihvblByb2dyZXNzKSkge1xuICAgICAgICAgICAgY3R4ID0gb25Qcm9ncmVzcztcbiAgICAgICAgICAgIG9uUHJvZ3Jlc3MgPSB1bmRlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYjtcblxuICAgICAgICBpZighdGhpcy5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgIGNiID0geyBkZWZlciA6IGRlZmVyLCBmbiA6IGlzRnVuY3Rpb24ob25GdWxmaWxsZWQpPyBvbkZ1bGZpbGxlZCA6IHVuZGVmLCBjdHggOiBjdHggfTtcbiAgICAgICAgICAgIHRoaXMuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKFtjYl0sIHRoaXMuX3ZhbHVlKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXRoaXMuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICAgICAgY2IgPSB7IGRlZmVyIDogZGVmZXIsIGZuIDogb25SZWplY3RlZCwgY3R4IDogY3R4IH07XG4gICAgICAgICAgICB0aGlzLmlzUmVqZWN0ZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKFtjYl0sIHRoaXMuX3ZhbHVlKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPD0gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzLnB1c2goeyBkZWZlciA6IGRlZmVyLCBmbiA6IG9uUHJvZ3Jlc3MsIGN0eCA6IGN0eCB9KTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfY2FsbENhbGxiYWNrcyA6IGZ1bmN0aW9uKGNhbGxiYWNrcywgYXJnKSB7XG4gICAgICAgIHZhciBsZW4gPSBjYWxsYmFja3MubGVuZ3RoO1xuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaXNSZXNvbHZlZCA9IHRoaXMuaXNSZXNvbHZlZCgpLFxuICAgICAgICAgICAgaXNGdWxmaWxsZWQgPSB0aGlzLmlzRnVsZmlsbGVkKCk7XG5cbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIGNiLCBkZWZlciwgZm47XG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2IgPSBjYWxsYmFja3NbaSsrXTtcbiAgICAgICAgICAgICAgICBkZWZlciA9IGNiLmRlZmVyO1xuICAgICAgICAgICAgICAgIGZuID0gY2IuZm47XG5cbiAgICAgICAgICAgICAgICBpZihmbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3R4ID0gY2IuY3R4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzID0gY3R4PyBmbi5jYWxsKGN0eCwgYXJnKSA6IGZuKGFyZyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLm5vdGlmeShyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRnVsZmlsbGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoYXJnKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KGFyZykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIubm90aWZ5KGFyZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG4vKiogQGxlbmRzIFByb21pc2UgKi9cbnZhciBzdGF0aWNNZXRob2RzID0ge1xuICAgIC8qKlxuICAgICAqIENvZXJjZXMgdGhlIGdpdmVuIGB2YWx1ZWAgdG8gYSBwcm9taXNlLCBvciByZXR1cm5zIHRoZSBgdmFsdWVgIGlmIGl0J3MgYWxyZWFkeSBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGNhc3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdm93LmNhc3QodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGVuIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWxsIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbGwoaXRlcmFibGUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IHdoZW4gYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZW4gdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJhY2UgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFueVJlc29sdmVkKGl0ZXJhYmxlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgaGF2ZSBgdmFsdWVgJ3Mgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZWplY3QocmVhc29uKTtcbiAgICB9XG59O1xuXG5mb3IodmFyIHByb3AgaW4gc3RhdGljTWV0aG9kcykge1xuICAgIHN0YXRpY01ldGhvZHMuaGFzT3duUHJvcGVydHkocHJvcCkgJiZcbiAgICAgICAgKFByb21pc2VbcHJvcF0gPSBzdGF0aWNNZXRob2RzW3Byb3BdKTtcbn1cblxudmFyIHZvdyA9IC8qKiBAZXhwb3J0cyB2b3cgKi8ge1xuICAgIERlZmVycmVkIDogRGVmZXJyZWQsXG5cbiAgICBQcm9taXNlIDogUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZGVmZXJyZWQuIFRoaXMgbWV0aG9kIGlzIGEgZmFjdG9yeSBtZXRob2QgZm9yIGB2b3c6RGVmZXJyZWRgIGNsYXNzLlxuICAgICAqIEl0J3MgZXF1aXZhbGVudCB0byBgbmV3IHZvdy5EZWZlcnJlZCgpYC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b3c6RGVmZXJyZWR9XG4gICAgICovXG4gICAgZGVmZXIgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZWZlcnJlZCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS50aGVuYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgd2hlbiA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cuY2FzdCh2YWx1ZSkudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZmFpbGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZmFpbCA6IGZ1bmN0aW9uKHZhbHVlLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlLCB1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuYWx3YXlzYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZXNvbHZlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIHRoZSBwcm9taXNlIGFzIGFuIGFyZ3VtZW50LCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsd2F5cyA6IGZ1bmN0aW9uKHZhbHVlLCBvblJlc29sdmVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5hbHdheXMob25SZXNvbHZlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UucHJvZ3Jlc3NgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblByb2dyZXNzIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvZ3Jlc3MgOiBmdW5jdGlvbih2YWx1ZSwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkucHJvZ3Jlc3Mob25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2Uuc3ByZWFkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBzcHJlYWQgOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLnNwcmVhZChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZG9uZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICovXG4gICAgZG9uZSA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHZvdy53aGVuKHZhbHVlKS5kb25lKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gYHZhbHVlYCBpcyBhIHByb21pc2UtbGlrZSBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2b3cuaXNQcm9taXNlKCdzb21ldGhpbmcnKTsgLy8gcmV0dXJucyBmYWxzZVxuICAgICAqIHZvdy5pc1Byb21pc2Uodm93LmRlZmVyKCkucHJvbWlzZSgpKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogdm93LmlzUHJvbWlzZSh7IHRoZW4gOiBmdW5jdGlvbigpIHsgfSk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGlzUHJvbWlzZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgaXNGdW5jdGlvbih2YWx1ZS50aGVuKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29lcmNlcyB0aGUgZ2l2ZW4gYHZhbHVlYCB0byBhIHByb21pc2UsIG9yIHJldHVybnMgdGhlIGB2YWx1ZWAgaWYgaXQncyBhbHJlYWR5IGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgY2FzdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiAhIXZhbHVlLl92b3c/XG4gICAgICAgICAgICB2YWx1ZSA6XG4gICAgICAgICAgICB2b3cucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnZhbHVlT2ZgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICB2YWx1ZU9mIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUudmFsdWVPZik/IHZhbHVlLnZhbHVlT2YoKSA6IHZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc0Z1bGZpbGxlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzRnVsZmlsbGVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNGdWxmaWxsZWQpPyB2YWx1ZS5pc0Z1bGZpbGxlZCgpIDogdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNSZWplY3RlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVqZWN0ZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc1JlamVjdGVkKT8gdmFsdWUuaXNSZWplY3RlZCgpIDogZmFsc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzUmVzb2x2ZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1Jlc29sdmVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNSZXNvbHZlZCk/IHZhbHVlLmlzUmVzb2x2ZWQoKSA6IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXNvbHZlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGhhdmUgYHZhbHVlYCdzIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIHJlcyA9IHZvdy5kZWZlcigpO1xuICAgICAgICByZXMucmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgIHJldHVybiByZXMucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgZnVsZmlsbGVkIHdpdGggdGhlIGZ1bGZpbGwvcmVqZWN0aW9uIHZhbHVlIG9mIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZ1bGZpbGwgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgICAgICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG5cbiAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2UuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgIHByb21pc2UgOlxuICAgICAgICAgICAgcHJvbWlzZS50aGVuKG51bGwsIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWFzb247XG4gICAgICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqIElmIGByZWFzb25gIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoIHRoZSBmdWxmaWxsL3JlamVjdGlvbiB2YWx1ZSBvZiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEludm9rZXMgdGhlIGdpdmVuIGZ1bmN0aW9uIGBmbmAgd2l0aCBhcmd1bWVudHMgYGFyZ3NgXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBwcm9taXNlMSA9IHZvdy5pbnZva2UoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgKiAgICAgfSwgJ29rJyksXG4gICAgICogICAgIHByb21pc2UyID0gdm93Lmludm9rZShmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgIHRocm93IEVycm9yKCk7XG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogcHJvbWlzZTEuaXNGdWxmaWxsZWQoKTsgLy8gdHJ1ZVxuICAgICAqIHByb21pc2UxLnZhbHVlT2YoKTsgLy8gJ29rJ1xuICAgICAqIHByb21pc2UyLmlzUmVqZWN0ZWQoKTsgLy8gdHJ1ZVxuICAgICAqIHByb21pc2UyLnZhbHVlT2YoKTsgLy8gaW5zdGFuY2Ugb2YgRXJyb3JcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpbnZva2UgOiBmdW5jdGlvbihmbiwgYXJncykge1xuICAgICAgICB2YXIgbGVuID0gTWF0aC5tYXgoYXJndW1lbnRzLmxlbmd0aCAtIDEsIDApLFxuICAgICAgICAgICAgY2FsbEFyZ3M7XG4gICAgICAgIGlmKGxlbikgeyAvLyBvcHRpbWl6YXRpb24gZm9yIFY4XG4gICAgICAgICAgICBjYWxsQXJncyA9IEFycmF5KGxlbik7XG4gICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2FsbEFyZ3NbaSsrXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gdm93LnJlc29sdmUoY2FsbEFyZ3M/XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkoZ2xvYmFsLCBjYWxsQXJncykgOlxuICAgICAgICAgICAgICAgIGZuLmNhbGwoZ2xvYmFsKSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgcmV0dXJuIHZvdy5yZWplY3QoZSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogd2l0aCBhcnJheTpcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpLCAzXSlcbiAgICAgKiAgICAgLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgICAvLyB2YWx1ZSBpcyBcIlsxLCAyLCAzXVwiIGhlcmVcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgyKTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogd2l0aCBvYmplY3Q6XG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbCh7IHAxIDogZGVmZXIxLnByb21pc2UoKSwgcDIgOiBkZWZlcjIucHJvbWlzZSgpLCBwMyA6IDMgfSlcbiAgICAgKiAgICAgLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgICAvLyB2YWx1ZSBpcyBcInsgcDEgOiAxLCBwMiA6IDIsIHAzIDogMyB9XCIgaGVyZVxuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKDIpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGgsXG4gICAgICAgICAgICByZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gbGVuO1xuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbHVlLCBpZHgpIHtcbiAgICAgICAgICAgICAgICByZXNba2V5c1tpZHhdXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGlmKCEtLWkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZlci5yZWplY3QsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcixcbiAgICAgICAgICAgIGtleXMpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbFJlc29sdmVkKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpXSkuc3ByZWFkKGZ1bmN0aW9uKHByb21pc2UxLCBwcm9taXNlMikge1xuICAgICAqICAgICBwcm9taXNlMS5pc1JlamVjdGVkKCk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqICAgICBwcm9taXNlMS52YWx1ZU9mKCk7IC8vIHJldHVybnMgXCInZXJyb3InXCJcbiAgICAgKiAgICAgcHJvbWlzZTIuaXNGdWxmaWxsZWQoKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogICAgIHByb21pc2UyLnZhbHVlT2YoKTsgLy8gcmV0dXJucyBcIidvaydcIlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlamVjdCgnZXJyb3InKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgnb2snKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBhbGxSZXNvbHZlZCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgaSA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKCFpKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG9uUmVzb2x2ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAtLWkgfHwgZGVmZXIucmVzb2x2ZShpdGVyYWJsZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgb25SZXNvbHZlZCxcbiAgICAgICAgICAgIG9uUmVzb2x2ZWQsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcixcbiAgICAgICAgICAgIGtleXMpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIGFsbFBhdGllbnRseSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYWxsUmVzb2x2ZWQoaXRlcmFibGUpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMsIGZ1bGZpbGxlZFByb21pc2VzLFxuICAgICAgICAgICAgICAgIGxlbiA9IGtleXMubGVuZ3RoLCBpID0gMCwga2V5LCBwcm9taXNlO1xuXG4gICAgICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGtleSA9IGtleXNbaSsrXTtcbiAgICAgICAgICAgICAgICBwcm9taXNlID0gaXRlcmFibGVba2V5XTtcbiAgICAgICAgICAgICAgICBpZih2b3cuaXNSZWplY3RlZChwcm9taXNlKSkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzIHx8IChyZWplY3RlZFByb21pc2VzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9KTtcbiAgICAgICAgICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcy5wdXNoKHByb21pc2UudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzW2tleV0gPSBwcm9taXNlLnZhbHVlT2YoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZighcmVqZWN0ZWRQcm9taXNlcykge1xuICAgICAgICAgICAgICAgICAgICAoZnVsZmlsbGVkUHJvbWlzZXMgfHwgKGZ1bGZpbGxlZFByb21pc2VzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9KSlba2V5XSA9IHZvdy52YWx1ZU9mKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYocmVqZWN0ZWRQcm9taXNlcykge1xuICAgICAgICAgICAgICAgIHRocm93IHJlamVjdGVkUHJvbWlzZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmdWxmaWxsZWRQcm9taXNlcztcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIGlmIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBpcyBmdWxmaWxsZWQuXG4gICAgICogSWYgYWxsIG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldCByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCAod2l0aCB0aGUgcmVhc29uIG9mIHRoZSBmaXJzdCByZWplY3RlZCBpdGVtKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFueSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChFcnJvcigpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSA9IDAsIHJlYXNvbjtcbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlLFxuICAgICAgICAgICAgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGkgfHwgKHJlYXNvbiA9IGUpO1xuICAgICAgICAgICAgICAgICsraSA9PT0gbGVuICYmIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IHdoZW4gYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGlzIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFueVJlc29sdmVkIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KEVycm9yKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSxcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5kZWxheWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkZWxheSA6IGZ1bmN0aW9uKHZhbHVlLCBkZWxheSkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpLmRlbGF5KGRlbGF5KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudGltZW91dGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHRpbWVvdXQgOiBmdW5jdGlvbih2YWx1ZSwgdGltZW91dCkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpLnRpbWVvdXQodGltZW91dCk7XG4gICAgfSxcblxuICAgIF9mb3JFYWNoIDogZnVuY3Rpb24ocHJvbWlzZXMsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgsIGtleXMpIHtcbiAgICAgICAgdmFyIGxlbiA9IGtleXM/IGtleXMubGVuZ3RoIDogcHJvbWlzZXMubGVuZ3RoLFxuICAgICAgICAgICAgaSA9IDA7XG5cbiAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgdm93LndoZW4oXG4gICAgICAgICAgICAgICAgcHJvbWlzZXNba2V5cz8ga2V5c1tpXSA6IGldLFxuICAgICAgICAgICAgICAgIHdyYXBPbkZ1bGZpbGxlZChvbkZ1bGZpbGxlZCwgaSksXG4gICAgICAgICAgICAgICAgb25SZWplY3RlZCxcbiAgICAgICAgICAgICAgICBvblByb2dyZXNzLFxuICAgICAgICAgICAgICAgIGN0eCk7XG4gICAgICAgICAgICArK2k7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgVGltZWRPdXRFcnJvciA6IGRlZmluZUN1c3RvbUVycm9yVHlwZSgnVGltZWRPdXQnKVxufTtcblxudmFyIGRlZmluZUFzR2xvYmFsID0gdHJ1ZTtcbmlmKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHZvdztcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5pZih0eXBlb2YgbW9kdWxlcyA9PT0gJ29iamVjdCcgJiYgaXNGdW5jdGlvbihtb2R1bGVzLmRlZmluZSkpIHtcbiAgICBtb2R1bGVzLmRlZmluZSgndm93JywgZnVuY3Rpb24ocHJvdmlkZSkge1xuICAgICAgICBwcm92aWRlKHZvdyk7XG4gICAgfSk7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmluZShmdW5jdGlvbihyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSB2b3c7XG4gICAgfSk7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuZGVmaW5lQXNHbG9iYWwgJiYgKGdsb2JhbC52b3cgPSB2b3cpO1xuXG59KSh0aGlzKTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb1BsYXllcicpO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbGliL2RhdGEvbWVyZ2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9yZWplY3QnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL2F1ZGlvLWVycm9yJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuL2F1ZGlvLXN0YXRpYycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC40L3RgtC10YDRhNC10LnRgSDQtNC70Y8g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPINC90L7QstGL0YUg0YLQuNC/0L7QslxudmFyIGF1ZGlvVHlwZXMgPSB7XG4gICAgaHRtbDU6IHJlcXVpcmUoJy4vaHRtbDUvYXVkaW8taHRtbDUnKSxcbiAgICBmbGFzaDogcmVxdWlyZSgnLi9mbGFzaC9hdWRpby1mbGFzaCcpXG59O1xuXG52YXIgZGV0ZWN0U3RyaW5nID0gXCJAXCIgKyBkZXRlY3QucGxhdGZvcm0udmVyc2lvbiArXG4gICAgXCIgXCIgKyBkZXRlY3QucGxhdGZvcm0ub3MgK1xuICAgIFwiOlwiICsgZGV0ZWN0LmJyb3dzZXIubmFtZSArXG4gICAgXCIvXCIgKyBkZXRlY3QuYnJvd3Nlci52ZXJzaW9uO1xuXG5hdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5ID0gMDtcbmF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHkgPSBjb25maWcuaHRtbDUuYmxhY2tsaXN0LnNvbWUoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gZGV0ZWN0U3RyaW5nLm1hdGNoKGl0ZW0pOyB9KSA/IC0xIDogMTtcblxubG9nZ2VyLmRlYnVnKG51bGwsIFwiYXVkaW9UeXBlc1wiLCBhdWRpb1R5cGVzKTtcblxuLyoqINCe0L/QuNGB0LDQvdC40LUg0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQv9C70LXQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXNcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHByb3BlcnR5IHtOdW1iZXJ9IGxvYWRlZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwb3NpdGlvbiAtINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHByb3BlcnR5IHtOdW1iZXJ9IHBsYXllZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ29tbW9uIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9QTEFZfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwbGF5XG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9FTkRFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jZW5kZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQs9GA0L7QvNC60L7RgdGC0LggKHtAbGluayB5YS5BdWRpby5FVkVOVF9WT0xVTUV9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3ZvbHVtZWNoYW5nZVxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINCz0YDQvtC80LrQvtGB0YLRjFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LrRgNCw0YXQsCDQv9C70LXQtdGA0LAgKHtAbGluayB5YS5BdWRpby5FVkVOVF9DUkFTSEVEfSlcbiAqIEBldmVudCB5YS5BdWRpbyNjcmFzaGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDRgdC80LXQvdGLINGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1NUQVRFfSlcbiAqIEBldmVudCB5YS5BdWRpbyNzdGF0ZVxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0g0L3QvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQv9C10YDQtdC60LvRjtGH0LXQvdC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuCDQv9GA0LXQu9C+0LDQtNC10YDQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1NXQVB9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3N3YXBcbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQWN0aXZlIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9TVE9QfSlcbiAqIEBldmVudCB5YS5BdWRpbyNzdG9wXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUEFVU0V9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3BhdXNlXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjRjyDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8v0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4ICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUFJPR1JFU1N9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3Byb2dyZXNzXG4gKiBAcGFyYW0ge3lhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BRElOR30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jbG9hZGluZ1xuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BREVEfSlcbiAqIEBldmVudCB5YS5BdWRpbyNsb2FkZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9FUlJPUn0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jZXJyb3JcbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUHJlbG9hZGVyIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9TVE9QfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6c3RvcFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1BBVVNFfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6cGF1c2VcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy/Qt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LggKHtAbGluayB5YS5BdWRpby5FVkVOVF9QUk9HUkVTU30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOnByb2dyZXNzXG4gKiBAcGFyYW0ge3lhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BRElOR30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOmxvYWRpbmdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0xPQURFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOmxvYWRlZFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0VSUk9SfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6ZXJyb3JcbiAqL1xuXG4vKipcbiAqIEBjbGFzcyDQkNGD0LTQuNC+LdC/0LvQtdC10YAg0LTQu9GPINCx0YDQsNGD0LfQtdGA0LAuXG4gKiBAYWxpYXMgeWEuQXVkaW9cbiAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZmVycmVkVHlwZV0gLSBwcmVmZXJyZWQgcGxheWVyIHR5cGUgKGh0bWw1L2ZsYXNoKVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW292ZXJsYXldIC0gZG9tIGVsZW1lbnQgdG8gc2hvdyBmbGFzaFxuICpcbiAqIEBleHRlbmRzIEV2ZW50c1xuICogQG1peGVzIEF1ZGlvU3RhdGljXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvI3BsYXlcbiAqIEBmaXJlcyB5YS5BdWRpbyNlbmRlZFxuICogQGZpcmVzIHlhLkF1ZGlvI3ZvbHVtZWNoYW5nZVxuICogQGZpcmVzIHlhLkF1ZGlvI2NyYXNoZWRcbiAqIEBmaXJlcyB5YS5BdWRpbyNzdGF0ZVxuICogQGZpcmVzIHlhLkF1ZGlvI3N3YXBcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8jc3RvcFxuICogQGZpcmVzIHlhLkF1ZGlvI3BhdXNlXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJvZ3Jlc3NcbiAqIEBmaXJlcyB5YS5BdWRpbyNsb2FkaW5nXG4gKiBAZmlyZXMgeWEuQXVkaW8jbG9hZGVkXG4gKiBAZmlyZXMgeWEuQXVkaW8jZXJyb3JcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOnN0b3BcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6cGF1c2VcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6cHJvZ3Jlc3NcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6bG9hZGluZ1xuICogQGZpcmVzIHlhLkF1ZGlvI3ByZWxvYWRlcjpsb2FkZWRcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6ZXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvUGxheWVyID0gZnVuY3Rpb24ocHJlZmVycmVkVHlwZSwgb3ZlcmxheSkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlZmVycmVkVHlwZSA9IHByZWZlcnJlZFR5cGU7XG4gICAgdGhpcy5vdmVybGF5ID0gb3ZlcmxheTtcbiAgICB0aGlzLnN0YXRlID0gQXVkaW9QbGF5ZXIuU1RBVEVfSU5JVDtcbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9wbGF5SWQgPSBudWxsO1xuXG4gICAgdGhpcy5fd2hlblJlYWR5ID0gbmV3IERlZmVycmVkKCk7XG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLl93aGVuUmVhZHkucHJvbWlzZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiaW1wbGVtZW50YXRpb24gZm91bmRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3B1bGF0ZUV2ZW50cyhldmVudCwgb2Zmc2V0LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKCFvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWTpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1A6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRU5ERUQ6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1I6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9JRExFKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUEFVU0U6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OLCBlKTtcblxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9DUkFTSEVEKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5faW5pdCgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9QbGF5ZXIpO1xubWVyZ2UoQXVkaW9QbGF5ZXIsIEF1ZGlvU3RhdGljLCB0cnVlKTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0LTQvtGB0YLRg9C/0L3Ri9GFINC/0LvQtdC10YDQvtCyXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQHN0YXRpY1xuICovXG5BdWRpb1BsYXllci5pbmZvID0ge1xuICAgIGh0bWw1OiBhdWRpb1R5cGVzLmh0bWw1LmF2YWlsYWJsZSxcbiAgICBmbGFzaDogYXVkaW9UeXBlcy5mbGFzaC5hdmFpbGFibGVcbn07XG5cbi8qKlxuICog0JrQvtC90YLQtdC60YHRgiDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuICogQHR5cGUge0F1ZGlvQ29udGV4dH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuYXVkaW9Db250ZXh0ID0gYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHQ7XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0g0L3QvtCy0YvQuSDRgdGC0LDRgtGD0YFcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fc2V0U3RhdGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zZXRTdGF0ZVwiLCBzdGF0ZSk7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHRoaXMuc3RhdGUgIT09IHN0YXRlO1xuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcblxuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwibmV3U3RhdGVcIiwgc3RhdGUpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9QbGF5ZXIuRVZFTlRfU1RBVEUsIHN0YXRlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtyZXRyeT0wXSAtINC60L7Qu9C40YfQtdGB0YLQstC+INC/0L7Qv9GL0YLQvtC6XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbihyZXRyeSkge1xuICAgIHJldHJ5ID0gcmV0cnkgfHwgMDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0XCIsIHJldHJ5KTtcblxuICAgIGlmICghdGhpcy5fd2hlblJlYWR5LnBlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChyZXRyeSA+IGNvbmZpZy5hdWRpby5yZXRyeSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTik7XG4gICAgICAgIHRoaXMuX3doZW5SZWFkeS5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTikpO1xuICAgIH1cblxuICAgIHZhciBpbml0U2VxID0gW1xuICAgICAgICBhdWRpb1R5cGVzLmh0bWw1LFxuICAgICAgICBhdWRpb1R5cGVzLmZsYXNoXG4gICAgXS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhLmF2YWlsYWJsZSAhPT0gYi5hdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS5hdmFpbGFibGUgPyAtMSA6IDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYi5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBpbml0KCkge1xuICAgICAgICB2YXIgdHlwZSA9IGluaXRTZXEuc2hpZnQoKTtcblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICAgIHNlbGYuX2luaXQocmV0cnkgKyAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuX2luaXRUeXBlKHR5cGUpLnRoZW4oc2VsZi5fd2hlblJlYWR5LnJlc29sdmUsIGluaXQpO1xuICAgIH1cblxuICAgIGluaXQoKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsCDRgSDRg9C60LDQt9Cw0L3QvdGL0Lwg0YLQuNC/0L7QvFxuICogQHBhcmFtIHt7dHlwZTogc3RyaW5nLCBBdWRpb0ltcGxlbWVudGF0aW9uOiBmdW5jdGlvbn19IHR5cGUgLSDQvtCx0YrQtdC60YIg0L7Qv9C40YHQsNC90LjRjyDRgtC40L/QsCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9pbml0VHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0VHlwZVwiLCB0eXBlKTtcblxuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHRyeSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotC10LrRg9GJ0LDRjyDRgNC10LDQu9C40LfQsNGG0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7SUF1ZGlvSW1wbGVtZW50YXRpb258bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24gPSBuZXcgdHlwZS5BdWRpb0ltcGxlbWVudGF0aW9uKHRoaXMub3ZlcmxheSk7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeSkge1xuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbi53aGVuUmVhZHkudGhlbihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdChlKTtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJfaW5pdFR5cGVFcnJvclwiLCB0eXBlLCBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/RgNC4INC+0LTQvdC+0Lwg0LjQtyDRgdC/0LjRgdC60LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb24gLSDQvdCw0LfQstCw0L3QuNC1INC00LXQudGB0YLQstC40Y9cbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IHJlc29sdmUgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9GFINGB0L7QsdGL0YLQuNC5INC00LvRjyDRgNCw0LfRgNC10YjQtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZWplY3QgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9C5INGB0L7QsdGL0YLQuNC5INC00LvRjyDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0YLQsNC60LbQtSDRgdC+0LfQtNCw0ZHRgiBEZWZlcnJlZCDRgdCy0L7QudGB0YLQstC+INGBINC90LDQt9Cy0LDQvdC40LXQvCBfd2hlbjxBY3Rpb24+LCDQutC+0YLQvtGA0L7QtSDQttC40LLRkdGCINC00L4g0LzQvtC80LXQvdGC0LAg0YDQsNC30YDQtdGI0LXQvdC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fd2FpdEV2ZW50cyA9IGZ1bmN0aW9uKGFjdGlvbiwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpc1thY3Rpb25dID0gZGVmZXJyZWQ7XG5cbiAgICB2YXIgY2xlYW51cEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHNlbGYub2ZmKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGV0ZSBzZWxmW2FjdGlvbl07XG4gICAgfTtcblxuICAgIHJlc29sdmUuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICB9KTtcblxuICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHNlbGYub24oZXZlbnQsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IGRhdGEgaW5zdGFuY2VvZiBFcnJvciA/IGRhdGEgOiBuZXcgQXVkaW9FcnJvcihkYXRhIHx8IGV2ZW50KTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZSgpLnRoZW4oY2xlYW51cEV2ZW50cywgY2xlYW51cEV2ZW50cyk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQtdC90LjQtSDRgdC+0LHRi9GC0LjQuSDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C80Lgg0YHQstC+0LnRgdGC0LLQsNC80LguINCf0L7QtNC/0LjRgdGL0LLQsNC10YLRgdGPINC90LAg0LLRgdC1INGB0L7QsdGL0YLQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwLFxuICog0YLRgNC40LPQs9C10YDQuNGCINC40YLQvtCz0L7QstGL0LUg0YHQvtCx0YvRgtC40Y8sINGA0LDQt9C00LXQu9GP0Y8g0LjRhSDQv9C+INGC0LjQv9GDINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALCDQtNC+0L/QvtC70L3Rj9C10YIg0YHQvtCx0YvRgtC40Y8g0LTQsNC90L3Ri9C80LguXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtINC40YHRgtC+0YfQvdC40Log0YHQvtCx0YvRgtC40Y8uIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fcG9wdWxhdGVFdmVudHMgPSBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKGV2ZW50ICE9PSBBdWRpb1BsYXllci5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfcG9wdWxhdGVFdmVudHNcIiwgZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfVxuXG4gICAgdmFyIG91dGVyRXZlbnQgPSAob2Zmc2V0ID8gQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UIDogXCJcIikgKyBldmVudDtcblxuICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVA6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1I6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9WT0xVTUU6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIHRoaXMuZ2V0Vm9sdW1lKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1M6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aGlzLmdldER1cmF0aW9uKG9mZnNldCksXG4gICAgICAgICAgICAgICAgbG9hZGVkOiB0aGlzLmdldExvYWRlZChvZmZzZXQpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvZmZzZXQgPyAwIDogdGhpcy5nZXRQb3NpdGlvbigpLFxuICAgICAgICAgICAgICAgIHBsYXllZDogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UGxheWVkKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqINCT0LXQvdC10YDQsNGG0LjRjyBwbGF5SWRcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fZ2VuZXJhdGVQbGF5SWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wbGF5SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc2xpY2UoMik7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ29tbW9uXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINC+0LHQtdGJ0LDQvdC40LUsINGA0LDQt9GA0LXRiNCw0Y7RidC10LXRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuLy9UT0RPOiDQv9C+0L/RgNC+0LHQvtCy0LDRgtGMINC/0LXRgNC10LTQtdC70LDRgtGMINC60LvQsNGB0YEg0L3QsCDRhNCw0LHRgNC40LrRgyDQuCDRg9Cx0YDQsNGC0YwgaW5pdFByb21pc2VcbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pbml0UHJvbWlzZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLndoZW5SZWFkeTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGU7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGC0LjQvyDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFR5cGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGU7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINGC0LXQutGD0YnQuNC5INGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtINCx0YDQsNGC0Ywg0YLRgNC10Log0LjQtyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwINC40LvQuCDQuNC3INC/0YDQtdC70L7QsNC00LXRgNCwLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHJldHVybnMge0lBdWRpb0ltcGxlbWVudGF0aW9ufG51bGx9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFNyYyhvZmZzZXQpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFBsYXliYWNrXG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5XCIsIHNyYywgZHVyYXRpb24pO1xuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGxheShzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC60LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzdG9wXCIsIG9mZnNldCk7XG5cbiAgICBpZiAob2Zmc2V0ICE9PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblN0b3AucHJvbWlzZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5TdG9wXCIsIFtBdWRpb1BsYXllci5FVkVOVF9TVE9QXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWSxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3AoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0L/Qu9C10LXRgCDQvdCwINC/0LDRg9C30YNcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBhdXNlXCIpO1xuXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkJBRF9TVEFURSkpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBhdXNlXCIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QYXVzZS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBhdXNlXCIsIFtBdWRpb1BsYXllci5FVkVOVF9QQVVTRV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGF1c2UoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQodC90Y/RgtC40LUg0L/Qu9C10LXRgNCwINGBINC/0LDRg9C30YtcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9JRExFIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCB8fCB0aGlzLnN0YXRlXG4gICAgICAgID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJyZXN1bWVcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGxheS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucmVzdW1lKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vYWJvcnRhYmxlXG4vKipcbiAqINCX0LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8g0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IFtzcmNdIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LosINC00LvRjyDQv9GA0L7QstC10YDQutC4LCDRh9GC0L4g0LIg0L/RgNC10LvQvtCw0LTQtdGA0LUg0L3Rg9C20L3Ri9C5INGC0YDQtdC6XG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgc3JjKTtcblxuICAgIGlmICghc3JjKSB7XG4gICAgICAgIHNyYyA9IHRoaXMuZ2V0U3JjKDEpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pc1ByZWxvYWRlZChzcmMpKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEJhZFRyYWNrXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5pbXBsZW1lbnRhdGlvbi5wbGF5UHJlbG9hZGVkKCk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInBsYXlQcmVsb2FkZWRFcnJvclwiLCBBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpO1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUHJlbG9hZFxuLy9hYm9ydGFibGVcbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQutCwINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsC4g0JDQutGC0YPQsNC70YzQvdC+INC00LvRjyDRhNC70LXRiC3RgNC10LDQu9C40LfQsNGG0LjQuCwg0LIg0L3QtdC5INC/0L7QutCwINGC0YDQtdC6INCz0YDRg9C30LjRgtGB0Y9cbiAqINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQvtC/0YDQtdC00LXQu9GP0LXRgtGB0Y8g0YEg0L/QvtCz0YDQtdGI0L3QvtGB0YLRjNGOLlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIGR1cmF0aW9uKTtcblxuICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QoXCJwcmVsb2FkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUHJlbG9hZFwiLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0xPQURJTkcsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVBcbiAgICBdLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQsXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9TVE9QXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QcmVsb2FkLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKDEpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wcmVsb2FkKHNyYywgZHVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttC10L1cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRlZChzcmMpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGluZyhzcmMsIDEpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFRpbWluZ3Ncbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0UG9zaXRpb24oKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0g0L3QvtCy0LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9IC0tINC60L7QvdC10YfQvdCw0Y8g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlID09IFwiZmxhc2hcIikge1xuICAgICAgICBwb3NpdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKHRoaXMuZ2V0TG9hZGVkKCksIHBvc2l0aW9uKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmdldER1cmF0aW9uKCksIHBvc2l0aW9uKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fcGxheWVkICs9IHRoaXMuZ2V0UG9zaXRpb24oKSAtIHRoaXMuX2xhc3RTa2lwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gcG9zaXRpb247XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblxuICAgIHJldHVybiBwb3NpdGlvbjtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge0Jvb2xlYW58aW50fSBwcmVsb2FkZXIgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldER1cmF0aW9uKHByZWxvYWRlciA/IDEgOiAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldExvYWRlZChwcmVsb2FkZXIgPyAxIDogMCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheWVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRQb3NpdGlvbigpO1xuICAgIHRoaXMuX3BsYXllZCArPSBwb3NpdGlvbiAtIHRoaXMuX2xhc3RTa2lwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gcG9zaXRpb247XG5cbiAgICByZXR1cm4gdGhpcy5fcGxheWVkO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFZvbHVtZVxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRWb2x1bWUoKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQvdC+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7TnVtYmVyfSAtLSDQuNGC0L7Qs9C+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFZvbHVtZVwiLCB2b2x1bWUpO1xuXG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnNldFZvbHVtZSh2b2x1bWUpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0LPRgNC+0LzQutC+0YHRgtGMINGD0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0YPRgdGC0YDQvtC50YHRgtCy0L7QvCwg0LAg0L3QtSDQv9GA0L7Qs9GA0LDQvNC90L5cbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNEZXZpY2VWb2x1bWUoKTtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBXZWIgQXVkaW8gQVBJXG4vKipcbiAqINCf0LXRgNC10LrQu9GO0YfQtdC90LjQtSDRgNC10LbQuNC80LAg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gV2ViIEF1ZGlvIEFQSS4g0JTQvtGB0YLRg9C/0LXQvSDRgtC+0LvRjNC60L4g0L/RgNC4IGh0bWw1LdGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqXG4gKiAqKtCS0L3QuNC80LDQvdC40LUhKiogLSDQv9C+0YHQu9C1INCy0LrQu9GO0YfQtdC90LjRjyDRgNC10LbQuNC80LAgV2ViIEF1ZGlvIEFQSSDQvtC9INC90LUg0L7RgtC60LvRjtGH0LDQtdGC0YHRjyDQv9C+0LvQvdC+0YHRgtGM0Y4sINGCLtC6LiDQtNC70Y8g0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y9cbiAqINGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAsINC60L7RgtC+0YDQvtC5INGC0YDQtdCx0YPQtdGC0YHRjyDQutC70LjQuiDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8uINCf0YDQuCDQvtGC0LrQu9GO0YfQtdC90LjQuCDQuNC3INCz0YDQsNGE0LAg0L7QsdGA0LDQsdC+0YLQutC4INC40YHQutC70Y7Rh9Cw0Y7RgtGB0Y9cbiAqINCy0YHQtSDQvdC+0LTRiyDQutGA0L7QvNC1INC90L7QtC3QuNGB0YLQvtGH0L3QuNC60L7QsiDQuCDQvdC+0LTRiyDQstGL0LLQvtC00LAsINGD0L/RgNCw0LLQu9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLRjNGOINC/0LXRgNC10LrQu9GO0YfQsNC10YLRgdGPINC90LAg0Y3Qu9C10LzQtdC90YLRiyBhdWRpbywg0LHQtdC3XG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBHYWluTm9kZVxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINC30LDQv9GA0LDRiNC40LLQsNC10LzRi9C5INGB0YLQsNGC0YPRgVxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINC40YLQvtCz0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElcIiwgc3RhdGUpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVXZWJBdWRpb0FQSShzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCQ0YPQtNC40L4t0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5BdWRpb35BdWRpb1ByZXByb2Nlc3NvclxuICpcbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBpbnB1dCAtINC90L7QtNCwLCDQsiDQutC+0YLQvtGA0YPRjiDQv9C10YDQtdC90LDQv9GA0LDQstC70Y/QtdGC0YHRjyDQstGL0LLQvtC0INCw0YPQtNC40L5cbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBvdXRwdXQgLSDQvdC+0LTQsCDQuNC3INC60L7RgtC+0YDQvtC5INCy0YvQstC+0LQg0L/QvtC00LDRkdGC0YHRjyDQvdCwINGD0YHQuNC70LjRgtC10LvRjFxuICovXG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0QXVkaW9QcmVwcm9jZXNzb3IocHJlcHJvY2Vzc29yKTtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBQbGF5SWRcbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1IHBsYXlJZFxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wbGF5SWQ7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBpbmRleDogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLm5hbWUsXG4gICAgICAgIHNyYzogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLl9sb2dnZXIoKSxcbiAgICAgICAgdHlwZTogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGVcbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1BsYXllcjtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBBdWRpb1N0YXRpY1xuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvU3RhdGljID0ge307XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0Ki9cbkF1ZGlvU3RhdGljLkVWRU5UX1BMQVkgPSBcInBsYXlcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9TVE9QID0gXCJzdG9wXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSA9IFwicGF1c2VcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyA9IFwicHJvZ3Jlc3NcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURJTkcgPSBcImxvYWRpbmdcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQgPSBcImxvYWRlZFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FID0gXCJ2b2x1bWVjaGFuZ2VcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VOREVEID0gXCJlbmRlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUQVRFID0gXCJzdGF0ZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NXQVAgPSBcInN3YXBcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlBSRUxPQURFUl9FVkVOVCA9IFwicHJlbG9hZGVyOlwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfSU5JVCA9IFwiaW5pdFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JRExFID0gXCJpZGxlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUExBWUlORyA9IFwicGxheWluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX1BBVVNFRCA9IFwicGF1c2VkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9TdGF0aWM7XG4iLCIvKipcbiAqINCd0LDRgdGC0L7QudC60Lgg0LHQuNCx0LvQuNC+0YLQtdC60LhcbiAqIEBhbGlhcyB5YS5BdWRpby5jb25maWdcbiAqIEBuYW1lc3BhY2VcbiAqL1xudmFyIGNvbmZpZyA9IHtcbiAgICAvKipcbiAgICAgKiDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBhdWRpbzoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0JrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0Log0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICByZXRyeTogM1xuICAgIH0sXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutC4INC/0L7QtNC60LvRjtGH0LXQvdC40Y8gZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGZsYXNoOiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQn9GD0YLRjCDQuiAuc3dmINGE0LDQudC70YMg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBwYXRoOiBcImRpc3RcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0LzRjyAuc3dmINGE0LDQudC70LAg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBuYW1lOiBcInBsYXllci0yXzAuc3dmXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQnNC40L3QuNC80LDQu9GM0L3QsNGPINCy0LXRgNGB0LjRjyDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHZlcnNpb246IFwiOS4wLjI4XCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJRCwg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQstGL0YHRgtCw0LLQu9C10L0g0LTQu9GPINGN0LvQtdC80LXQvdGC0LAg0YEgZmxhc2gt0L/Qu9C10LXRgNC+0LxcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHBsYXllcklEOiBcIllhbmRleEF1ZGlvRmxhc2hQbGF5ZXJcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0LzRjyDRhNGD0L3QutGG0LjQuC3QvtCx0YDQsNCx0L7RgtGH0LjQutCwINGB0L7QsdGL0YLQuNC5IGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKiBAY29uc3RcbiAgICAgICAgICovXG4gICAgICAgIGNhbGxiYWNrOiBcInlhLkF1ZGlvLl9mbGFzaENhbGxiYWNrXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgaW5pdFRpbWVvdXQ6IDMwMDAsIC8vIDMgc2VjXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQt9Cw0LPRgNGD0LfQutC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBsb2FkVGltZW91dDogNTAwMCxcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L7RgdC70LUg0LrQu9C40LrQsFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgY2xpY2tUaW1lb3V0OiAxMDAwLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvdGC0LXRgNCy0LDQuyDQv9GA0L7QstC10YDQutC4INC00L7RgdGC0YPQv9C90L7RgdGC0LggZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBoZWFydEJlYXRJbnRlcnZhbDogMTAwMFxuICAgIH0sXG4gICAgLyoqXG4gICAgICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6IGh0bWw1INC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBodG1sNToge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KHQv9C40YHQvtC6INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0L7QsiDQtNC70Y8g0LrQvtGC0L7RgNGL0YUg0LvRg9GH0YjQtSDQvdC1INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCBodG1sNSDQv9C70LXQtdGALiDQmNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0L/RgNC4XG4gICAgICAgICAqINCw0LLRgtC+LdC+0L/RgNC10LTQtdC70LXQvdC40Lgg0YLQuNC/0LAg0L/Qu9C10LXRgNCwLiDQmNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNGLINGB0YDQsNCy0L3QuNCy0LDRjtGC0YHRjyDRgdC+INGB0YLRgNC+0LrQvtC5INC/0L7RgdGC0YDQvtC10L3QvdC+0Lkg0L/QviDRiNCw0LHQu9C+0L3Rg1xuICAgICAgICAgKiBgQDxwbGF0Zm9ybS52ZXJzaW9uPiA8cGxhdGZvcm0ub3M+Ojxicm93c2VyLm5hbWU+Lzxicm93c2VyLnZlcnNpb24+YFxuICAgICAgICAgKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gICAgICAgICAqL1xuICAgICAgICBibGFja2xpc3Q6IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiXVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY29uZmlnO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi9saWIvY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiBAY2xhc3Mg0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LDRg9C00LjQvi3Qv9C70LvQtdC10YDQsFxuICogQGFsaWFzIHlhLkF1ZGlvLkF1ZGlvRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkF1ZGlvRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJBdWRpb0Vycm9yXCIpO1xuXG4vKipcbiAqINCd0LUg0L3QsNC50LTQtdC90LAg0YDQtdCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwINC40LvQuCDQstGB0LUg0LTQvtGB0YLRg9C/0L3Ri9C1INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0L7RgtC10YDQv9C10LvQuCDQutGA0LDRhSDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04gPSBcImNhbm5vdCBmaW5kIHN1aXRhYmxlIGltcGxlbWVudGF0aW9uXCI7XG4vKipcbiAqINCi0YDQtdC6INC90LUg0LHRi9C7INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvSDQuNC70Lgg0LLQviDQstGA0LXQvNGPINC30LDQs9GA0YPQt9C60Lgg0L/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEID0gXCJ0cmFjayBpcyBub3QgcHJlbG9hZGVkXCI7XG4vKipcbiAqINCU0LXQudGB0YLQstC40LUg0L3QtSDQtNC+0YHRgtGD0L/QvdC+INC40Lcg0YLQtdC60YPRidC10LPQviDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5CQURfU1RBVEUgPSBcImFjdGlvbiBpcyBub3QgcGVybWl0ZWQgZnJvbSBjdXJyZW50IHN0YXRlXCI7XG5cbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQsdGL0Lsg0LfQsNCx0LvQvtC60LjRgNC+0LLQsNC9XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfQkxPQ0tFUiA9IFwiZmxhc2ggaXMgcmVqZWN0ZWQgYnkgZmxhc2ggYmxvY2tlciBwbHVnaW5cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+INC90LXQuNC30LLQtdGB0YLQvdGL0Lwg0L/RgNC40YfQuNC90LDQvFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCA9IFwiZmxhc2ggaW5pdCB0aW1lZCBvdXRcIjtcbi8qKlxuICog0JLQvdGD0YLRgNC10L3QvdGP0Y8g0L7RiNC40LHQutCwIEZsYXNoLdC/0LvQtdC10YDQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SID0gXCJmbGFzaCBpbnRlcm5hbCBlcnJvclwiO1xuLyoqXG4gKiDQn9C+0L/Ri9GC0LrQsCDQstGL0LfQstCw0YLRjCDQvdC10LTQvtGB0YLRg9C/0L3Ri9C5INGN0LrQt9C10LzQu9GP0YAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElORyA9IFwiZmxhc2ggcGxheWVyIGRvZXNuJ3QgcmVzcG9uc2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0Vycm9yO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9hdWRpby1lcnJvcicpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuL3BsYXliYWNrLWVycm9yJyk7XG5cbnlhLkF1ZGlvLkF1ZGlvRXJyb3IgPSBBdWRpb0Vycm9yO1xueWEuQXVkaW8uUGxheWJhY2tFcnJvciA9IFBsYXliYWNrRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGFsaWFzIHlhLkF1ZGlvLlBsYXliYWNrRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBlbnVtIHtTdHJpbmd9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFBsYXliYWNrRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlLCBzcmMpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgICB0aGlzLnNyYyA9IHNyYztcbn07XG5cblBsYXliYWNrRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJQbGF5YmFja0Vycm9yXCIpO1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDRgdC+0LXQtNC40L3QtdC90L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVEID0gXCJDb25uZWN0aW9uIGFib3J0ZWRcIjtcbi8qKlxuICog0KHQtdGC0LXQstCw0Y8g0L7RiNC40LHQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUiA9IFwiTmV0d29yayBlcnJvclwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LTQtdC60L7QtNC40YDQvtCy0LDQvdC40Y8g0LDRg9C00LjQvlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUiA9IFwiRGVjb2RlIGVycm9yXCI7XG4vKipcbiAqINCd0LUg0LTQvtGB0YLRg9C/0L3Ri9C5INC40YHRgtC+0YfQvdC40LpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5CQURfREFUQSA9IFwiQmFkIGRhdGFcIjtcblxuLyoqXG4gKiDQotCw0LHQu9C40YbQsCDRgdC+0L7RgtCy0LXRgtGB0YLQstC40Y8g0LrQvtC00L7QsiDQvtGI0LjQsdC+0LogaHRtbDUg0L/Qu9C10LXRgNCwXG4gKiBAZW51bSB7U3RyaW5nfVxuICovXG5QbGF5YmFja0Vycm9yLmh0bWw1ID0ge1xuICAgIDE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELFxuICAgIDI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUixcbiAgICAzOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUixcbiAgICA0OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXliYWNrRXJyb3I7XG4iLCJpZiAodHlwZW9mIHdpbmRvdy55YSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbmRvdy55YSA9IHt9O1xufVxuXG52YXIgeWEgPSB3aW5kb3cueWE7XG5cbi8vVE9ETzog0L/QtdGA0LXQvdC10YHRgtC4INCyIHlhLm11c2ljLkF1ZGlvXG5pZiAodHlwZW9mIHlhLkF1ZGlvID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEuQXVkaW8gPSB7fTtcbn1cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgQXVkaW9QbGF5ZXIgPSByZXF1aXJlKCcuL2F1ZGlvLXBsYXllcicpO1xudmFyIFByb3h5ID0gcmVxdWlyZSgnLi9saWIvY2xhc3MvcHJveHknKTtcblxueWEuQXVkaW8gPSBQcm94eS5jcmVhdGVDbGFzcyhBdWRpb1BsYXllcik7XG55YS5BdWRpby5jb25maWcgPSBjb25maWc7XG5cbm1vZHVsZS5leHBvcnRzID0geWEuQXVkaW87XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvRmxhc2gnKTtcbnZhciBGbGFzaE1hbmFnZXIgPSByZXF1aXJlKCcuL2ZsYXNoLW1hbmFnZXInKTtcbnZhciBGbGFzaEludGVyZmFjZSA9IHJlcXVpcmUoJy4vZmxhc2gtaW50ZXJmYWNlJyk7XG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG52YXIgZmxhc2hNYW5hZ2VyO1xuXG52YXIgZmxhc2hWZXJzaW9uID0gc3dmb2JqZWN0LmdldEZsYXNoUGxheWVyVmVyc2lvbigpO1xuZGV0ZWN0LmZsYXNoVmVyc2lvbiA9IGZsYXNoVmVyc2lvbi5tYWpvciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLm1pbm9yICsgXCIuXCIgKyBmbGFzaFZlcnNpb24ucmVsZWFzZTtcblxuZXhwb3J0cy5hdmFpbGFibGUgPSBzd2ZvYmplY3QuaGFzRmxhc2hQbGF5ZXJWZXJzaW9uKGNvbmZpZy5mbGFzaC52ZXJzaW9uKTtcbmxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGV4cG9ydHMuYXZhaWxhYmxlKTtcblxuLyoqXG4gKiBAY2xhc3Mg0JrQu9Cw0YHRgSBmbGFzaCDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICogQGV4dGVuZHMgSUF1ZGlvSW1wbGVtZW50YXRpb25cbiAqXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGxheVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2VuZGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jdm9sdW1lY2hhbmdlXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jY3Jhc2hlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N3YXBcbiAqXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3RvcFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BhdXNlXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcHJvZ3Jlc3NcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkaW5nXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZXJyb3JcbiAqXG4gKiBAcGFyYW0ge0hNVExFbGVtZW50fSBbb3ZlcmxheV0gLSDQvNC10YHRgtC+INC00LvRjyDQstGB0YLRgNCw0LjQstCw0L3QuNGPINC/0LvQtdC10YDQsCAo0LDQutGC0YPQsNC70YzQvdC+INGC0L7Qu9GM0LrQviDQtNC70Y8gZmxhc2gt0L/Qu9C10LXRgNCwKVxuICogQHBhcmFtIHtCb29sZWFufSBbZm9yY2U9ZmFsc2VdIC0g0YHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDRjdC60LfQtdC/0LvRj9GAIEZsYXNoTWFuYWdlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9GbGFzaCA9IGZ1bmN0aW9uKG92ZXJsYXksIGZvcmNlKSB7XG4gICAgdGhpcy5uYW1lID0gcGxheWVySWQrKztcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIGlmICghZmxhc2hNYW5hZ2VyIHx8IGZvcmNlKSB7XG4gICAgICAgIGZsYXNoTWFuYWdlciA9IG5ldyBGbGFzaE1hbmFnZXIob3ZlcmxheSk7XG4gICAgfVxuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLndoZW5SZWFkeSA9IGZsYXNoTWFuYWdlci5jcmVhdGVQbGF5ZXIodGhpcyk7XG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVhZHlcIiwgZGF0YSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0ZsYXNoKTtcblxuQXVkaW9GbGFzaC50eXBlID0gQXVkaW9GbGFzaC5wcm90b3R5cGUudHlwZSA9IFwiZmxhc2hcIjtcblxuT2JqZWN0LmtleXMoRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleVswXSAhPT0gXCJfXCI7XG59KS5tYXAoZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQXVkaW9GbGFzaC5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIS9eZ2V0Ly50ZXN0KG1ldGhvZCkpIHtcbiAgICAgICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBtZXRob2QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KFwiaWRcIikpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheWVyIGlzIG5vdCByZWFkeVwiKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmlkKTtcbiAgICAgICAgcmV0dXJuIGZsYXNoTWFuYWdlci5mbGFzaFttZXRob2RdLmFwcGx5KGZsYXNoTWFuYWdlci5mbGFzaCwgYXJncyk7XG4gICAgfVxufSk7XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwYXVzZVxuICovXG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcmVzdW1lXG4gKi9cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc3RvcFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3ByZWxvYWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRlZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlQcmVsb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFBvc2l0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0UG9zaXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldER1cmF0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0TG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRWb2x1bWVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFZvbHVtZVxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFNyY1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDQtNC+0YHRgtGD0L/QtdC9INC70Lgg0L/RgNC+0LPRgNCw0LzQvNC90YvQuSDQutC+0L3RgtGA0L7Qu9GMINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYWluOiBcIm5vdCByZWFkeVwiLFxuICAgICAgICAgICAgICAgIHByZWxvYWRlcjogXCJub3QgcmVhZHlcIlxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogdGhpcy5nZXRTcmMoMCksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IHRoaXMuZ2V0U3JjKDEpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvRmxhc2g7XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoSW50ZXJmYWNlJyk7XG5cbi8qKlxuICogQGNsYXNzINCe0L/QuNGB0LDQvdC40LUg0LLQvdC10YjQvdC10LPQviDQuNC90YLQtdGA0YTQtdC50YHQsCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7T2JqZWN0fSBmbGFzaCAtIHN3Zi3QvtCx0YrQtdC60YJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoSW50ZXJmYWNlID0gZnVuY3Rpb24oZmxhc2gpIHtcbiAgICB0aGlzLmZsYXNoID0geWEuQXVkaW8uX2ZsYXNoID0gZmxhc2g7XG59O1xuXG4vKipcbiAqINCS0YvQt9Cy0LDRgtGMINC80LXRgtC+0LQgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZm4gLSDQvdCw0LfQstCw0L3QuNC1INC80LXRgtC+0LTQsFxuICogQHJldHVybnMgeyp9XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2NhbGxGbGFzaCA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy9sb2dnZXIuZGVidWcodGhpcywgZm4sIGFyZ3VtZW50cyk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5mbGFzaC5jYWxsLmFwcGx5KHRoaXMuZmxhc2gsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcIl9jYWxsRmxhc2hFcnJvclwiLCBlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC+0LHRgNCw0YLQvdC+0Lkg0YHQstGP0LfQuCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHRocm93cyDQntGI0LjQsdC60LAg0LTQvtGB0YLRg9C/0LAg0LogZmxhc2gt0L/Qu9C10LXRgNGDXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2hlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcImhlYXJ0QmVhdFwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7aW50fSAtLSBpZCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2FkZFBsYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJhZGRQbGF5ZXJcIiwgLTEpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC20LXQu9Cw0LXQvNCw0Y8g0LPRgNC+0LzQutC+0YHRgtGMXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbihpZCwgdm9sdW1lKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic2V0Vm9sdW1lXCIsIC0xLCB2b2x1bWUpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFZvbHVtZVwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oaWQsIHNyYywgZHVyYXRpb24pIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwbGF5XCIsIGlkLCBzcmMsIGR1cmF0aW9uKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic3RvcFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwYXVzZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInJlc3VtZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicHJlbG9hZFwiLCBpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkZWRcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkaW5nXCIsIGlkLCBzcmMsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicGxheVByZWxvYWRlZFwiLCBpZCwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0UG9zaXRpb25cIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkLCBwb3NpdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInNldFBvc2l0aW9uXCIsIGlkLCBwb3NpdGlvbik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0RHVyYXRpb25cIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldExvYWRlZFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0U3JjID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRTcmNcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hJbnRlcmZhY2U7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoQnJpZGdlJyk7XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi4vYXVkaW8tc3RhdGljJyk7XG52YXIgZmxhc2hMb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xudmFyIEZsYXNoSW50ZXJmYWNlID0gcmVxdWlyZSgnLi9mbGFzaC1pbnRlcmZhY2UnKTtcblxudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvYXVkaW8tZXJyb3InKTtcbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yJyk7XG5cbi8qKlxuICogQGNsYXNzINCX0LDQs9GA0YPQt9C60LAgZmxhc2gt0L/Qu9C10LXRgNCwINC4INC+0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3ZlcmxheSAtINC+0LHRitC10LrRgiDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDQuCDQv9C+0LrQsNC30LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaE1hbmFnZXIgPSBmdW5jdGlvbihvdmVybGF5KSB7IC8vIHNpbmdsZXRvbiFcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiLCBvdmVybGF5KTtcblxuICAgIHRoaXMuc3RhdGUgPSBcImluaXRcIjtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuZW1taXRlcnMgPSBbXTtcblxuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAvKipcbiAgICAgKiDQntCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQt9Cw0LLQtdGA0YjQtdC90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAqIEB0eXBlIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlKCk7XG5cbiAgICB2YXIgY2FsbGJhY2tQYXRoID0gY29uZmlnLmZsYXNoLmNhbGxiYWNrLnNwbGl0KFwiLlwiKTtcbiAgICB2YXIgY2FsbGJhY2tOYW1lID0gY2FsbGJhY2tQYXRoLnBvcCgpO1xuICAgIHZhciBjYWxsYmFja0NvbnQgPSB3aW5kb3c7XG4gICAgY2FsbGJhY2tQYXRoLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrQ29udFtwYXJ0XSkge1xuICAgICAgICAgICAgY2FsbGJhY2tDb250W3BhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2tDb250ID0gY2FsbGJhY2tDb250W3BhcnRdO1xuICAgIH0pO1xuICAgIGNhbGxiYWNrQ29udFtjYWxsYmFja05hbWVdID0gdGhpcy5fb25FdmVudC5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX2xvYWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkxvYWRUaW1lb3V0LCBjb25maWcuZmxhc2gubG9hZFRpbWVvdXQpO1xuICAgIGZsYXNoTG9hZGVyKGNvbmZpZy5mbGFzaC5wYXRoICsgXCIvXCJcbiAgICAgICAgKyBjb25maWcuZmxhc2gubmFtZSwgY29uZmlnLmZsYXNoLnZlcnNpb24sIGNvbmZpZy5mbGFzaC5wbGF5ZXJJRCwgdGhpcy5fb25Mb2FkLmJpbmQodGhpcyksIHt9LCBvdmVybGF5KTtcblxuICAgIGlmIChvdmVybGF5KSB7XG4gICAgICAgIHZhciB0aW1lb3V0O1xuICAgICAgICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oKSB7IC8vS05PV0xFREdFOiBvbmx5IG1vdXNlZG93biBldmVudCBhbmQgb25seSB3bW9kZTogdHJhbnNwYXJlbnRcbiAgICAgICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0IHx8IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HKSk7XG4gICAgICAgICAgICAgICAgfSwgY29uZmlnLmZsYXNoLmNsaWNrVGltZW91dCk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMud2hlblJlYWR5LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0ICYmIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCByZXN1bHQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBmbGFzaE1hbmFnZXIgPSBudWxsOyAvLyDQtdGB0LvQuCDQvtCx0LvQvtC80LDQu9C40YHRjCDRg9C00LDQu9GP0LXQvCDRjdC60LfQtdC80L/Qu9GP0YAg0LzQtdC90LXQtNC20LXRgNCwLCDRh9GC0L7QsdGLINC80L7QttC90L4g0LHRi9C70L4g0LHRi9C70L4g0L/Ri9GC0LDRgtGM0YHRjyDRgdC90L7QstCwXG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQgPSBcImluaXRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9GQUlMID0gXCJmYWlsZWRcIjtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIGRhdGFcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Mb2FkXCIsIGRhdGEpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkVGltZW91dCk7XG4gICAgZGVsZXRlIHRoaXMuX19sb2FkVGltZW91dDtcblxuICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFzaCA9IG5ldyBGbGFzaEludGVyZmFjZShkYXRhLnJlZik7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFwicmVhZHlcIikge1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKGRhdGEucmVmKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vdmVybGF5KSB7XG4gICAgICAgICAgICB0aGlzLl9faW5pdFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uSW5pdFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmluaXRUaW1lb3V0KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihkYXRhLl9fZmJuID8gQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSIDogQXVkaW9FcnJvci5GTEFTSF9VTktOT1dOX0NSQVNIKSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC30LDQs9GA0YPQt9C60LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgTG9hZGVyRXJyb3IoTG9hZGVyRXJyb3IuVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRiNC90L7RgdGC0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkluaXRcIik7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJyZWFkeVwiO1xuXG4gICAgaWYgKHRoaXMuX19pbml0VGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fX2luaXRUaW1lb3V0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0VGltZW91dDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mbGFzaCkge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUodGhpcy5mbGFzaCk7XG4gICAgICAgIHRoaXMuX19oZWFydGJlYXQgPSBzZXRJbnRlcnZhbCh0aGlzLl9vbkhlYXJ0QmVhdC5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5LCDRgdC+0LfQtNCw0LLQsNC10LzRi9GFIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25FdmVudCA9IGZ1bmN0aW9uKGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKGV2ZW50ID09PSBcImRlYnVnXCIpIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZyhcImZsYXNoREVCVUdcIiwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFwiZmFpbGVkXCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJvbkV2ZW50RmFpbGVkXCIsIGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQsIGlkLCBvZmZzZXQpO1xuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfSU5JVCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25Jbml0KCk7XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfRkFJTCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcImZhaWxlZFwiLCBBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlkID09IC0xKSB7XG4gICAgICAgIHRoaXMuZW1taXRlcnMuZm9yRWFjaChmdW5jdGlvbihlbW1pdGVyKSB7XG4gICAgICAgICAgICBlbW1pdGVyLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5lbW1pdGVyc1tpZF0pIHtcbiAgICAgICAgdGhpcy5lbW1pdGVyc1tpZF0udHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5GTEFTSF9FTU1JVEVSX05PVF9GT1VORCwgaWQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25IZWFydEJlYXQgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICB0aGlzLmZsYXNoLl9oZWFydEJlYXQoKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiY3Jhc2hlZFwiLCBlKTtcbiAgICAgICAgdGhpcy5fb25FdmVudChBdWRpb1N0YXRpYy5FVkVOVF9DUkFTSEVELCAtMSwgZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7QXVkaW9GbGFzaH0gYXVkaW9GbGFzaCAtIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgCwg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtCx0YHQu9GD0LbQuNCy0LDRgtGMINGB0L7Qt9C00LDQvdC90YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LDQtdGC0YHRjyDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPINGB0L7Qt9C00LDQvdC40Y8g0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuY3JlYXRlUGxheWVyID0gZnVuY3Rpb24oYXVkaW9GbGFzaCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclwiKTtcblxuICAgIHZhciBwcm9taXNlID0gdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgYXVkaW9GbGFzaC5pZCA9IHRoaXMuZmxhc2guX2FkZFBsYXllcigpO1xuICAgICAgICB0aGlzLmVtbWl0ZXJzW2F1ZGlvRmxhc2guaWRdID0gYXVkaW9GbGFzaDtcbiAgICAgICAgcmV0dXJuIGF1ZGlvRmxhc2guaWQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHByb21pc2UudGhlbihmdW5jdGlvbihwbGF5ZXJJZCkge1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVQbGF5ZXJTdWNjZXNzXCIsIHBsYXllcklkKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJjcmVhdGVQbGF5ZXJFcnJvclwiLCBlcnIpO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hNYW5hZ2VyO1xuIiwiLyoqXG4gKiBAaWdub3JlXG4gKiBAZmlsZVxuICogVGhpcyBpcyBhIHdyYXBwZXIgZm9yIHN3Zm9iamVjdCB0aGF0IGRldGVjdHMgRmxhc2hCbG9jayBpbiBicm93c2VyLlxuICpcbiAqIFdyYXBwZXIgZGV0ZWN0czpcbiAqICAgLSBDaHJvbWVcbiAqICAgICAtIEZsYXNoQmxvY2sgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gKiAgICAgLSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICogICAtIEZpcmVmb3ggRmxhc2hibG9jayAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAqICAgLSBPcGVyYSA+PSAxMS41IFwiRW5hYmxlIHBsdWdpbnMgb24gZGVtYW5kXCIgc2V0dGluZ1xuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggRXh0ZW5zaW9uIChodHRwOi8vaG95b2lzLmdpdGh1Yi5jb20vc2FmYXJpZXh0ZW5zaW9ucy9jbGlja3RvcGx1Z2luLylcbiAqICAgLSBTYWZhcmkgQ2xpY2tUb0ZsYXNoIFBsdWdpbiAoZm9yIFNhZmFyaSA8IDUuMC42KSAoaHR0cDovL3JlbnR6c2NoLmdpdGh1Yi5jb20vY2xpY2t0b2ZsYXNoLylcbiAqXG4gKiBUZXN0ZWQgb246XG4gKiAgIC0gQ2hyb21lIDEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IExleDEgMS4yLjExLjEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IGpvc29yZWsgMC45LjMxXG4gKiAgICAgLSBGbGFzaEZyZWUgMS4xLjNcbiAqICAgLSBGaXJlZm94IDUuMC4xICsgRmxhc2hibG9jayAxLjUuMTUuMVxuICogICAtIE9wZXJhIDExLjVcbiAqICAgLSBTYWZhcmkgNS4xICsgQ2xpY2tUb0ZsYXNoICgyLjMuMilcbiAqXG4gKiBBbHNvIHRoaXMgd3JhcHBlciBjYW4gcmVtb3ZlIGJsb2NrZWQgc3dmIGFuZCBsZXQgeW91IGRvd25ncmFkZSB0byBvdGhlciBvcHRpb25zLlxuICpcbiAqIEZlZWwgZnJlZSB0byBjb250YWN0IG1lIHZpYSBlbWFpbC5cbiAqXG4gKiBDb3B5cmlnaHQgMjAxMSwgQWxleGV5IEFuZHJvc292XG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgKGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwKSBvciBHUEwgVmVyc2lvbiAzIChodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWwpIGxpY2Vuc2VzLlxuICpcbiAqIFRoYW5rcyB0byBmbGFzaGJsb2NrZGV0ZWN0b3IgcHJvamVjdCAoaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2ZsYXNoYmxvY2tkZXRlY3RvcilcbiAqXG4gKiBAcmVxdWlyZXMgc3dmb2JqZWN0XG4gKiBAYXV0aG9yIEFsZXhleSBBbmRyb3NvdiA8ZG9vY2hpa0B5YS5ydT5cbiAqIEB2ZXJzaW9uIDEuMFxuICovXG5cbnZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcblxuZnVuY3Rpb24gcmVtb3ZlKG5vZGUpIHtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG59XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwINGBINCy0L7Qt9C80L7QttC90L7RgdGC0YzRjiDQvtGC0YHQu9C10LbQuNCy0LDQvdC40Y8g0LHQu9C+0LrQuNGA0L7QstGJ0LjQutC+0LJcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmYm4tc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmJuLXN3Zi13cmFwcGVyJyxcblxuICAgIC8qKlxuICAgICAqIFRpbWVvdXQgZm9yIGZsYXNoIGJsb2NrIGRldGVjdFxuICAgICAqIEBkZWZhdWx0IDUwMFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICBfX1RJTUVPVVQ6IDUwMCxcblxuICAgIF9fVEVTVFM6IFtcbiAgICAgICAgLy8gQ2hvbWUgRmxhc2hCbG9jayBleHRlbnNpb24gKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUsIHdyYXBwZXJOb2RlKSB7XG4gICAgICAgICAgICAvLyB3ZSBleHBlY3QgdGhhdCBzd2YgaXMgdGhlIG9ubHkgY2hpbGQgb2Ygd3JhcHBlclxuICAgICAgICAgICAgcmV0dXJuIHdyYXBwZXJOb2RlLmNoaWxkTm9kZXMubGVuZ3RoID4gMVxuICAgICAgICB9LCAvLyBvbGRlciBTYWZhcmkgQ2xpY2tUb0ZsYXNoIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBJRSBoYXMgbm8gc3dmTm9kZS50eXBlXG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS50eXBlICYmIHN3Zk5vZGUudHlwZSAhPSAnYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2gnXG4gICAgICAgIH0sIC8vIEZsYXNoQmxvY2sgZm9yIEZpcmVmb3ggKGh0dHBzOi8vYWRkb25zLm1vemlsbGEub3JnL3J1L2ZpcmVmb3gvYWRkb24vZmxhc2hibG9jay8pXG4gICAgICAgIC8vIENocm9tZSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBzd2YgaGF2ZSBiZWVuIGRldGFjaGVkIGZyb20gRE9NXG4gICAgICAgICAgICByZXR1cm4gIXN3Zk5vZGUucGFyZW50Tm9kZTtcbiAgICAgICAgfSwgLy8gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS5wYXJlbnROb2RlLmNsYXNzTmFtZS5pbmRleE9mKCdDVEZub2Rpc3BsYXknKSA+IC0xO1xuICAgICAgICB9XG4gICAgXSxcblxuICAgIC8qKlxuICAgICAqIEVtYmVkIFNXRiBpbmZvIHBhZ2UuIFRoaXMgZnVuY3Rpb24gaGFzIHNhbWUgb3B0aW9ucyBhcyBzd2ZvYmplY3QuZW1iZWRTV0YgZXhjZXB0IGxhc3QgcGFyYW0gcmVtb3ZlQmxvY2tlZFNXRi5cbiAgICAgKiBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgKiBAcGFyYW0gc3dmVXJsU3RyXG4gICAgICogQHBhcmFtIHJlcGxhY2VFbGVtSWRTdHJcbiAgICAgKiBAcGFyYW0gd2lkdGhTdHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0U3RyXG4gICAgICogQHBhcmFtIHN3ZlZlcnNpb25TdHJcbiAgICAgKiBAcGFyYW0geGlTd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gZmxhc2h2YXJzT2JqXG4gICAgICogQHBhcmFtIHBhck9ialxuICAgICAqIEBwYXJhbSBhdHRPYmpcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tGblxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbW92ZUJsb2NrZWRTV0Y9dHJ1ZV0gUmVtb3ZlIHN3ZiBpZiBibG9ja2VkXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4sIHJlbW92ZUJsb2NrZWRTV0YpIHtcbiAgICAgICAgLy8gdmFyIHN3Zm9iamVjdCA9IHdpbmRvd1snc3dmb2JqZWN0J107XG5cbiAgICAgICAgaWYgKCFzd2ZvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3Zm9iamVjdC5hZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcbiAgICAgICAgICAgIGlmICghcmVwbGFjZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gY3JlYXRlIGRpdi13cmFwcGVyIGJlY2F1c2Ugc29tZSBmbGFzaCBibG9jayBwbHVnaW5zIHJlcGxhY2Ugc3dmIHdpdGggYW5vdGhlciBjb250ZW50LlxuICAgICAgICAgICAgLy8gQWxzbyBzb21lIGZsYXNoIHJlcXVpcmVzIHdyYXBwZXIgdG8gd29yayBwcm9wZXJseS5cbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBURVNUUyA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1RFU1RTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqID0gVEVTVFMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChURVNUU1tpXShzd2ZFbGVtZW50LCB3cmFwcGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEJsb2NrTm90aWZpZXIuX19USU1FT1VUKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG9uRmFpbHVyZShlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdmVCbG9ja2VkU1dGICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgc3dmXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2ZvYmplY3QucmVtb3ZlU1dGKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgd3JhcHBlclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHdyYXBwZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBleHRlbnNpb24gYXJ0ZWZhY3RzXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2xpY2tUb0ZsYXNoIGFydGVmYWN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN0ZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdDVEZzdGFjaycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0Zikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0Nocm9tZSBGbGFzaEJsb2NrIGFydGVmYWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdEJvZHlDaGlsZCA9IGRvY3VtZW50LmJvZHkubGFzdENoaWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RCb2R5Q2hpbGQgJiYgbGFzdEJvZHlDaGlsZC5jbGFzc05hbWUgPT0gJ3Vqc19mbGFzaGJsb2NrX3BsYWNlaG9sZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShsYXN0Qm9keUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZS5fX2ZibiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuIiwidmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG4vKipcbiAqINCc0L7QtNGD0LvRjCDQt9Cw0LPRgNGD0LfQutC4INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoRW1iZWRkZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmZW1iLXN3Zi13cmFwcGVyXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgX19TV0ZfV1JBUFBFUl9DTEFTUzogJ2ZlbWItc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hFbWJlZGRlci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzd2ZFbGVtZW50ID0gZVsncmVmJ107XG4gICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIDExLjUgYW5kIGFib3ZlIHJlcGxhY2VzIGZsYXNoIHdpdGggU1ZHIGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAvLyBtc2llIChhbmQgY2FuYXJ5IGNocm9tZSAzMi4wKSBjcmFzaGVzIG9uIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVwbGFjZWRCeVNWRyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZWRCeVNWRyA9IHN3ZkVsZW1lbnQgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VkQnlTVkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRmFpbHVyZShlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9zZXQgdGltZW91dCB0byBsZXQgRmxhc2hCbG9jayBwbHVnaW4gZGV0ZWN0IHN3ZiBhbmQgcmVwbGFjZSBpdCBzb21lIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgRmxhc2hFbWJlZGRlci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5zdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hFbWJlZGRlcjtcbiIsInZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcbnZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSByZXF1aXJlKCcuL2ZsYXNoYmxvY2tub3RpZmllcicpO1xudmFyIEZsYXNoRW1iZWRkZXIgPSByZXF1aXJlKCcuL2ZsYXNoZW1iZWRkZXInKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcblxudmFyIHdpblNhZmFyaSA9IGRldGVjdC5wbGF0Zm9ybS5vcyA9PT0gJ3dpbmRvd3MnICYmIGRldGVjdC5icm93c2VyLm5hbWUgPT09ICdzYWZhcmknO1xuXG52YXIgQ09OVEFJTkVSX0NMQVNTID0gXCJ5YS1mbGFzaC1wbGF5ZXItd3JhcHBlclwiO1xuXG4vKipcbiAqINCX0LDQs9GA0YPQt9GH0LjQuiDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqXG4gKiBAYWxpYXMgRmxhc2hNYW5hZ2VyfmZsYXNoTG9hZGVyXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCAtINCh0YHRi9C70LrQsCDQvdCwINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IG1pblZlcnNpb24gLSDQvNC40L3QuNC80LDQu9GM0L3QsNGPINCy0LXRgNGB0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gaWQgLSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBsb2FkQ2FsbGJhY2sgLSDQutC+0LvQsdC10Log0LTQu9GPINGB0L7QsdGL0YLQuNGPINC30LDQs9GA0YPQt9C60LhcbiAqIEBwYXJhbSB7b2JqZWN0fSBmbGFzaFZhcnMgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9C1INCy0L4g0YTQu9C10YhcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lciAtINC60L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0LLQuNC00LjQvNC+0LPQviDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWCAtINGA0LDQt9C80LXRgCDQv9C+INCz0L7RgNC40LfQvtC90YLQsNC70LhcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWSAtINGA0LDQt9C80LXRgCDQv9C+INCy0LXRgNGC0LjQutCw0LvQuFxuICpcbiAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gLS0g0JrQvtC90YLQtdC50L3QtdGAINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHVybCwgbWluVmVyc2lvbiwgaWQsIGxvYWRDYWxsYmFjaywgZmxhc2hWYXJzLCBjb250YWluZXIsIHNpemVYLCBzaXplWSkge1xuICAgIHZhciAkZmxhc2hQbGF5ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICRmbGFzaFBsYXllci5pZCA9IFwid3JhcHBlcl9cIiArIGlkO1xuICAgICRmbGFzaFBsYXllci5pbm5lckhUTUwgPSAnPGRpdiBpZD1cIicgKyBpZCArICdcIj48L2Rpdj4nO1xuXG4gICAgc2l6ZVggPSBzaXplWCB8fCBcIjEwMDBcIjtcbiAgICBzaXplWSA9IHNpemVZIHx8IFwiMTAwMFwiO1xuXG4gICAgdmFyIGVtYmVkZGVyLFxuICAgICAgICBmbGFzaFNpemVYLFxuICAgICAgICBmbGFzaFNpemVZLFxuICAgICAgICBvcHRpb25zO1xuXG4gICAgaWYgKGNvbnRhaW5lciAmJiAhd2luU2FmYXJpKSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hFbWJlZGRlcjtcbiAgICAgICAgZmxhc2hTaXplWCA9IHNpemVYOyBmbGFzaFNpemVZID0gc2l6ZVk7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiLCB3bW9kZTogXCJ0cmFuc3BhcmVudFwiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLmNsYXNzTmFtZSA9IENPTlRBSU5FUl9DTEFTUztcbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IHJlbGF0aXZlOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCgkZmxhc2hQbGF5ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuICAgICAgICBmbGFzaFNpemVYID0gZmxhc2hTaXplWSA9IFwiMVwiO1xuICAgICAgICBvcHRpb25zID0geyBhbGxvd3NjcmlwdGFjY2VzczogXCJhbHdheXNcIiB9O1xuXG4gICAgICAgICRmbGFzaFBsYXllci5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogLTFweDsgdG9wOiAtMXB4OyB3aWR0aDogMHB4OyBoZWlnaHQ6IDBweDsgb3ZlcmZsb3c6IGhpZGRlbjsnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfVxuXG4gICAgZW1iZWRkZXIuZW1iZWRTV0YoXG4gICAgICAgIHVybCxcbiAgICAgICAgaWQsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG1pblZlcnNpb24sXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGZsYXNoVmFycyxcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAge30sXG4gICAgICAgIGxvYWRDYWxsYmFja1xuICAgICk7XG5cbiAgICByZXR1cm4gJGZsYXNoUGxheWVyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHsgLy8g0YHQvtGF0YDQsNC90Y/QtdGC0YHRjyDQsiBsb2NhbHN0b3JhZ2VcbiAgICAgICAgXCJpZFwiOiBcImN1c3RvbVwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZGVmYXVsdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2xhc3NpY2FsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0wLjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0zLjUsIC0zLjUsIC0zLjUsIC00LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJDbHViXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjM1OTk5OTg5NTA5NTgyNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgNCwgMi41LCAyLjUsIDIuNSwgMS41LCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRGFuY2VcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuMTU5OTk5ODQ3NDEyMTA5NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNC41LCAzLjUsIDEsIC0wLjUsIC0wLjUsIC0yLjUsIC0zLjUsIC0zLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIEJhc3NcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgNC41LCA0LjUsIDIuNSwgMC41LCAtMiwgLTQsIC01LCAtNS41LCAtNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzICYgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAyLjUsIC0wLjUsIC0zLjUsIC0yLCAwLjUsIDQsIDUuNSwgNiwgNl1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC02LFxuICAgICAgICBcImJhbmRzXCI6IFstNC41LCAtNC41LCAtNC41LCAtMiwgMSwgNS41LCA4LCA4LCA4LCA4XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGFwdG9wIFNwZWFrZXJzIC8gSGVhZHBob25lXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00LjA3OTk5OTkyMzcwNjA1NSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgNS41LCAyLjUsIC0xLjUsIC0xLCAwLjUsIDIsIDQuNSwgNiwgN11cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcmdlIEhhbGxcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNSwgNSwgMi41LCAyLjUsIC0wLjUsIC0yLCAtMiwgLTIsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMaXZlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWy0yLCAtMC41LCAyLCAyLjUsIDIuNSwgMi41LCAyLCAxLCAxLCAxXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUGFydHlcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAzLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIDMuNSwgMy41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUG9wXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjExOTk5OTg4NTU1OTA4MixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgMiwgMy41LCA0LCAyLjUsIC0wLjUsIC0xLCAtMSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlJlZ2dhZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0yLjUsIC0wLjUsIDMsIDMsIC0wLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMiwgLTIuNSwgLTQsIC0xLjUsIDIsIDQsIDUuNSwgNS41LCA1LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTa2FcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuNTE5OTk5OTgwOTI2NTE0LFxuICAgICAgICBcImJhbmRzXCI6IFstMSwgLTIsIC0yLCAtMC41LCAyLCAyLjUsIDQsIDQuNSwgNS41LCA0LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00Ljc5OTk5OTcxMzg5NzcwNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMC41LCAtMC41LCAtMSwgLTAuNSwgMiwgNCwgNC41LCA1LjUsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0IFJvY2tcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMiwgMSwgLTAuNSwgLTIsIC0yLjUsIC0xLjUsIC0wLjUsIDEsIDRdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJUZWNobm9cIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuODM5OTk5OTE0MTY5MzExNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMi41LCAtMC41LCAtMi41LCAtMiwgLTAuNSwgNCwgNC41LCA0LjUsIDRdXG4gICAgfVxuXTtcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi8uLi9saWIvYXN5bmMvZXZlbnRzJyk7XG5cbi8qKlxuICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6INGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXRcbiAqXG4gKiBAcHJvcGVydHkge1N0cmluZ30gW2lkXSAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90LDRgdGC0YDQvtC10LpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAgLSDQv9GA0LXQtNGD0YHQuNC70LjRgtC10LvRjFxuICogQHByb3BlcnR5IHtBcnJheS48TnVtYmVyPn0gLSDQt9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxIC0g0YfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICovXG5cbi8qKlxuICog0K3QutCy0LDQu9Cw0LnQt9C10YBcbiAqIEBhbGlhcyB5YS5BdWRpby5meC5FcXVhbGl6ZXJcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IGJhbmRzIC0g0YHQv9C40YHQvtC6INGH0LDRgdGC0L7RgiDQtNC70Y8g0L/QvtC70L7RgSDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplciA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgYmFuZHMpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlYW1wID0gbmV3IEVxdWFsaXplckJhbmQoYXVkaW9Db250ZXh0LCBcImhpZ2hzaGVsZlwiLCAwKTtcbiAgICB0aGlzLnByZWFtcC5vbihcIipcIiwgdGhpcy5fb25CYW5kRXZlbnQuYmluZCh0aGlzLCB0aGlzLnByZWFtcCkpO1xuXG4gICAgdmFyIHByZXY7XG4gICAgdGhpcy5iYW5kcyA9IGJhbmRzLm1hcChmdW5jdGlvbihmcmVxdWVuY3ksIGlkeCkge1xuICAgICAgICB2YXIgYmFuZCA9IG5ldyBFcXVhbGl6ZXJCYW5kKFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0LFxuXG4gICAgICAgICAgICBpZHggPT0gMCA/ICdsb3dzaGVsZidcbiAgICAgICAgICAgICAgICA6IGlkeCArIDEgPCBiYW5kcy5sZW5ndGggPyBcInBlYWtpbmdcIlxuICAgICAgICAgICAgICAgIDogXCJoaWdoc2hlbGZcIixcblxuICAgICAgICAgICAgZnJlcXVlbmN5XG4gICAgICAgICk7XG4gICAgICAgIGJhbmQub24oXCIqXCIsIHRoaXMuX29uQmFuZEV2ZW50LmJpbmQodGhpcywgYmFuZCkpO1xuXG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgICAgdGhpcy5wcmVhbXAuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJldi5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2ID0gYmFuZDtcbiAgICAgICAgcmV0dXJuIGJhbmQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnByZWFtcC5maWx0ZXI7XG4gICAgdGhpcy5vdXRwdXQgPSB0aGlzLmJhbmRzW3RoaXMuYmFuZHMubGVuZ3RoIC0gMV0uZmlsdGVyO1xufTtcblxuRXZlbnRzLm1peGluKEVxdWFsaXplcik7XG5cbi8qKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5FVkVOVF9DSEFOR0UgPSBcImNoYW5nZVwiO1xuXG4vKiogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5ERUZBVUxUX0JBTkRTID0gWzYwLCAxNzAsIDMxMCwgNjAwLCAxMDAwLCAzMDAwLCA2MDAwLCAxMjAwMCwgMTQwMDAsIDE2MDAwXTtcblxuLyoqIEB0eXBlIHtPYmplY3QuPFN0cmluZywgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldD59XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfUFJFU0VUUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5wcmVzZXRzLmpzJyk7XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNGPINC/0L7Qu9C+0YHRiyDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge0VxdWFsaXplckJhbmR9IGJhbmQgLSDQv9C+0LvQvtGB0LAg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRj1xuICogQHByaXZhdGVcbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5fb25CYW5kRXZlbnQgPSBmdW5jdGlvbihiYW5kLCBldmVudCwgZGF0YSkge1xuICAgIHRoaXMudHJpZ2dlcihldmVudCwgYmFuZC5nZXRGcmVxKCksIGRhdGEpO1xufTtcblxuLyoqXG4gKiDQl9Cw0LPRgNGD0LfQuNGC0Ywg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcGFyYW0ge3lhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9IHByZXNldCAtINC90LDRgdGC0YDQvtC50LrQuFxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmxvYWRQcmVzZXQgPSBmdW5jdGlvbihwcmVzZXQpIHtcbiAgICBwcmVzZXQuYmFuZHMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgIHRoaXMuYmFuZHNbaWR4XS5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnByZWFtcC5zZXRWYWx1ZShwcmVzZXQucHJlYW1wKTtcbn07XG5cbi8qKlxuICog0KHQvtGF0YDQsNC90LjRgtGMINGC0LXQutGD0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICogQHJldHVybnMge3lhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuc2F2ZVByZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByZWFtcDogdGhpcy5wcmVhbXAuZ2V0VmFsdWUoKSxcbiAgICAgICAgYmFuZHM6IHRoaXMuYmFuZHMubWFwKGZ1bmN0aW9uKGJhbmQpIHsgcmV0dXJuIGJhbmQuZ2V0VmFsdWUoKTsgfSlcbiAgICB9O1xufTtcblxuLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0Ywg0L/RgNC10LTQv9C+0LvQvtC20LXQvdC40LUgKNGB0LrQvtGA0LXQtSDQstGB0LXQs9C+INC90YPQttC90LAg0LrQsNGA0YLQsCDQstC10YHQvtCyINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YfQsNGB0YLQvtGCINC40LvQuCDQtNCw0LbQtSDQvdC10LrQsNGPINGE0YPQvdC60YbQuNGPKVxuLyoqXG4gKiAqKtCt0LrRgdC/0LXRgNC40LzQtdC90YLQsNC70YzQvdC+KiogLSDQstGL0YfQuNC70Y/QtdGCINC+0L/RgtC40LzQsNC70YzQvdC+0LUg0LfQvdCw0YfQvdC40LUg0L/RgNC10LTRg9GB0LjQu9C10L3QuNGPXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmd1ZXNzUHJlYW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHYgPSAwO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gdGhpcy5iYW5kcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgdiArPSB0aGlzLmJhbmRzW2tdLmdldFZhbHVlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIC12IC8gMjtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQpNC40LvRjNGC0YAg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LfQvdCw0YfQtdC90LjRjyDRg9GB0LjQu9C10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uZnguRXF1YWxpemVyLkVWRU5UX0NIQU5HRX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmQjY2hhbmdlXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSDQvdC+0LLQvtC1INC30L3QsNGH0LXQvdC40LVcbiAqL1xuXG4vKipcbiAqINCf0L7Qu9C+0YHQsCDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBhbGlhcyB5YS5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZFxuICpcbiAqIEBleHRlbmRzIEV2ZW50c1xuICpcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0g0YLQuNC/INGE0LjQu9GM0YLRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gZnJlcXVlbmN5IC0g0YfQsNGB0YLQvtGC0LAg0YTQuNC70YzRgtGA0LBcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmQjY2hhbmdlXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBFcXVhbGl6ZXJCYW5kID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCB0eXBlLCBmcmVxdWVuY3kpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMudHlwZSA9IHR5cGU7XG5cbiAgICB0aGlzLmZpbHRlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICB0aGlzLmZpbHRlci50eXBlID0gdHlwZTtcbiAgICB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3k7XG4gICAgdGhpcy5maWx0ZXIuUS52YWx1ZSA9IDE7XG4gICAgdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZSA9IDA7XG59O1xuRXZlbnRzLm1peGluKEVxdWFsaXplckJhbmQpO1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YfQsNGB0YLQvtGC0YMg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLmdldEZyZXEgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZnJlcXVlbmN5LnZhbHVlO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKiBAcGFyYW0gdmFsdWVcbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHRoaXMuZmlsdGVyLmdhaW4udmFsdWUgPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoRXF1YWxpemVyLkVWRU5UX0NIQU5HRSwgdmFsdWUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhbGl6ZXI7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEuQXVkaW8uZnguRXF1YWxpemVyID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXInKTtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5BdWRpby5meCA9IHt9O1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1TG9hZGVyJyk7XG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4uL2F1ZGlvLXN0YXRpYycpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9wbGF5YmFjay1lcnJvcicpO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9saWIvbm9vcCcpO1xuXG52YXIgbG9hZGVySWQgPSAxO1xuXG4vKipcbiAqIEBjbGFzcyDQntCx0ZHRgNGC0LrQsCDQtNC70Y8g0L3QsNGC0LjQstC90L7Qs9C+INC60LvQsNGB0YHQsCBBdWRpb1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBBdWRpb0hUTUw1TG9hZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5uYW1lID0gbG9hZGVySWQrKztcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuICAgIHRoaXMub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCAhPT0gQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMucHJvbWlzZXMgPSB7fTtcblxuICAgIHRoaXMuc3JjID0gXCJcIjtcbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcblxuICAgIHRoaXMubGFzdFVwZGF0ZSA9IDA7XG4gICAgdGhpcy5ub3RMb2FkaW5nID0gdHJ1ZTtcblxuICAgIHRoaXMub3V0cHV0ID0gbnVsbDtcblxuICAgIHRoaXMuX19zdGFydFBsYXkgPSB0aGlzLl9zdGFydFBsYXkuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fcmVzdGFydCA9IHRoaXMuX3Jlc3RhcnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fc3RhcnR1cEF1ZGlvID0gdGhpcy5fc3RhcnR1cEF1ZGlvLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MgPSB0aGlzLl91cGRhdGVQcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcgPSB0aGlzLl9vbk5hdGl2ZUxvYWRpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFbmRlZCA9IHRoaXMuX29uTmF0aXZlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFcnJvciA9IHRoaXMuX29uTmF0aXZlRXJyb3IuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX19vbk5hdGl2ZVBhdXNlID0gdGhpcy50cmlnZ2VyLmJpbmQodGhpcywgQXVkaW9TdGF0aWMuRVZFTlRfUEFVU0UpO1xuICAgIHRoaXMuX19vbk5hdGl2ZVBsYXkgPSB0aGlzLnRyaWdnZXIuYmluZCh0aGlzLCBBdWRpb1N0YXRpYy5FVkVOVF9QTEFZKTtcblxuICAgIHRoaXMuX2luaXRBdWRpbygpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1TG9hZGVyKTtcblxuQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwgPSAyNTA7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVkgPSBcInBsYXlcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC/0LDRg9C30YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UgPSBcInBhdXNlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjQtSDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSA9IFwidGltZXVwZGF0ZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FTkRFRCA9IFwiZW5kZWRcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04gPSBcImR1cmF0aW9uY2hhbmdlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4INC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HID0gXCJwcm9ncmVzc1wiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCDQvNC10YLQsC3QtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBID0gXCJsb2FkZWRtZXRhZGF0YVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvdCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVkgPSBcImNhbnBsYXlcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiA9IFwiZXJyb3JcIjtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3VwZGF0ZVByb2dyZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnRUaW1lID0gK25ldyBEYXRlKCk7XG4gICAgaWYgKGN1cnJlbnRUaW1lIC0gdGhpcy5sYXN0VXBkYXRlIDwgQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFVwZGF0ZSA9IGN1cnJlbnRUaW1lO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVMb2FkaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fdXBkYXRlUHJvZ3Jlc3MoKTtcblxuICAgIGlmICh0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICB2YXIgbG9hZGVkID0gdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuXG4gICAgICAgIGlmICh0aGlzLm5vdExvYWRpbmcgJiYgbG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLm5vdExvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FESU5HKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsb2FkZWQgPj0gdGhpcy5hdWRpby5kdXJhdGlvbiAtIDAuMSkge1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVFbmRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VOREVEKTtcbiAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZUVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgIGlmICghdGhpcy5zcmMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBlcnJvciA9IG5ldyBQbGF5YmFja0Vycm9yKHRoaXMuYXVkaW8uZXJyb3JcbiAgICAgICAgICAgID8gUGxheWJhY2tFcnJvci5odG1sNVt0aGlzLmF1ZGlvLmVycm9yLmNvZGVdXG4gICAgICAgICAgICA6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IGUsXG4gICAgICAgIHRoaXMuc3JjKTtcblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiwgZXJyb3IpO1xufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9pbml0QXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfaW5pdEF1ZGlvXCIpO1xuXG4gICAgdGhpcy5tdXRlRXZlbnRzKCk7XG5cbiAgICB0aGlzLmF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImF1ZGlvXCIpO1xuICAgIHRoaXMuYXVkaW8ubG9vcCA9IGZhbHNlOyAvLyBmb3IgSUVcbiAgICB0aGlzLmF1ZGlvLnByZWxvYWQgPSB0aGlzLmF1ZGlvLmF1dG9idWZmZXIgPSBcImF1dG9cIjsgLy8gMTAwJVxuXG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8pO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbyk7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvKTtcblxuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2RlaW5pdEF1ZGlvID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2RlaW5pdEF1ZGlvXCIpO1xuXG4gICAgdGhpcy5tdXRlRXZlbnRzKCk7XG5cbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbyk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaHN0YXJ0XCIsIHRoaXMuX19zdGFydHVwQXVkaW8pO1xuXG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9fb25OYXRpdmVQYXVzZSk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19vbk5hdGl2ZVBsYXkpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FTkRFRCwgdGhpcy5fX29uTmF0aXZlRW5kZWQpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9EVVJBVElPTiwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElORywgdGhpcy5fX29uTmF0aXZlTG9hZGluZyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9fb25OYXRpdmVFcnJvcik7XG5cbiAgICB0aGlzLmF1ZGlvID0gbnVsbDtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydHVwQXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc3RhcnR1cEF1ZGlvXCIpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8pO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbyk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvKTtcblxuICAgIC8vSU5GTzog0L/QtdGA0LXQtCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQtdC8INC+0LHRitC10LrRgiBBdWRpbyDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNGC0YwsINCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRj1xuICAgIHRoaXMuYXVkaW8ucGxheSgpO1xuXG4gICAgLy9JTkZPOiDQvdC10LrQvtGC0L7RgNGL0LUg0LHRgNCw0YPQt9C10YDRiyDRgdC70LjRiNC60L7QvCDRg9C/0L7RgNGC0L3QviDQv9GL0YLQsNGO0YLRgdGPINC30LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUgLSDQvdGD0LbQvdC+INC+0LPRgNCw0L3QuNGH0LjQstCw0YLRjFxuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcblxuICAgIC8vSU5GTzogSUUgKNC60LDQuiDQstGB0LXQs9C00LApINC90LUg0YPQvNC10LXRgiDQv9GA0LDQstC40LvRjNC90L4g0YDQsNCx0L7RgtCw0YLRjCAtINC/0YDQuNGF0L7QtNC40YLRgdGPINC/0L7QstGC0L7RgNGP0YLRjCDQv9C+IDIg0YDQsNC30LAuLi5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmF1ZGlvLnBhdXNlKCk7XG5cbiAgICAgICAgLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0YwsINGH0YLQviDQvdC1INGB0LvQuNGI0LrQvtC8INGA0LDQvdC+INGA0LDQt9GA0LXRiNCw0LXQvCDRgtGA0LjQs9Cz0LXRgNC40YLRjCDRgdC+0LHRi9GC0LjRj1xuICAgICAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc3RhcnR1cEF1ZGlvOnJlYWR5XCIpO1xuICAgIH0uYmluZCh0aGlzKSwgMCk7XG59O1xuXG4vLy0tLVxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3dhaXRGb3IgPSBmdW5jdGlvbihuYW1lLCBjaGVjaywgbGlzdGVuKSB7XG4gICAgaWYgKCF0aGlzLnByb21pc2VzW25hbWVdKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLnByb21pc2VzW25hbWVdID0gZGVmZXJyZWQ7XG5cbiAgICAgICAgaWYgKGNoZWNrLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChjaGVjay5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBjbGVhckxpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3Rlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFyTGlzdGVuZXJzLCBjbGVhckxpc3RlbmVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tuYW1lXS5wcm9taXNlKCk7XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fY2FuY2VsV2FpdCA9IGZ1bmN0aW9uKG5hbWUsIHJlYXNvbikge1xuICAgIHZhciBwcm9taXNlO1xuICAgIGlmIChwcm9taXNlID0gdGhpcy5wcm9taXNlc1tuYW1lXSkge1xuICAgICAgICBkZWxldGUgdGhpcy5wcm9taXNlc1tuYW1lXTtcbiAgICAgICAgcHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgICB9XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fYWJvcnRQcm9taXNlcyA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnByb21pc2VzKSB7XG4gICAgICAgIGlmICh0aGlzLnByb21pc2VzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoa2V5LCByZWFzb24pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VNZXRhZGF0YUV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCBBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZXTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VNZXRhZGF0YUNoZWNrID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8ucmVhZHlTdGF0ZSA+IHRoaXMuYXVkaW8uSEFWRV9NRVRBREFUQTtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTWV0YWRhdGEgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcIm1ldGFkYXRhXCIsIHRoaXMuX3Byb21pc2VNZXRhZGF0YUNoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTWV0YWRhdGFFdmVudHMpO1xufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VMb2FkZWRFdmVudHMgPSBbQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElOR107XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTG9hZGVkQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbG9hZGVkID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDEsIHRoaXMuYXVkaW8uZHVyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aFxuICAgICAgICAmJiB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmVuZCgwKSAtIHRoaXMuYXVkaW8uYnVmZmVyZWQuc3RhcnQoMCkgPj0gbG9hZGVkO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcImxvYWRlZFwiLCB0aGlzLl9wcm9taXNlTG9hZGVkQ2hlY2ssIEF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VMb2FkZWRFdmVudHMpO1xufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VQbGF5aW5nRXZlbnRzID0gW0F1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEVdO1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmdDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aW1lID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDAuMiwgdGhpcy5hdWRpby5kdXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPj0gdGltZTtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlUGxheWluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl93YWl0Rm9yKFwicGxheWluZ1wiLCB0aGlzLl9wcm9taXNlUGxheWluZ0NoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlUGxheWluZ0V2ZW50cyk7XG59O1xuXG4vLy0tLVxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VTdGFydFBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0gPSBkZWZlcnJlZDtcblxuICAgICAgICAvL0lORk86INC10YHQu9C4INC+0YLQvNC10L3QtdC90L4g0L7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC40LvQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8sINGC0L4g0L3Rg9C20L3QviDQvtGC0LzQtdC90LjRgtGMINC4INGN0YLQviDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgIHZhciByZWplY3QgPSB0aGlzLl9jYW5jZWxXYWl0LmJpbmQodGhpcywgXCJzdGFydFBsYXlpbmdcIik7XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZUxvYWRlZCgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlUGxheWluZygpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0YXJ0UGxheWluZzpzdWNjZXNzXCIpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpLCByZWplY3QpO1xuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChcInRpbWVvdXRcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcInBsYXlpbmdcIiwgXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic3RhcnRQbGF5aW5nOmZhaWxlZFwiKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVqZWN0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXS5wcm9taXNlKCk7XG59O1xuXG4vLy0tLVxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImxvYWRcIiwgc3JjKTtcblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoXCJsb2FkXCIpO1xuXG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgdGhpcy5ub3RMb2FkaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gc3JjO1xuICAgIHRoaXMuYXVkaW8ubG9hZCgpO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0b3BcIik7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwic3RvcFwiKTtcbiAgICB0aGlzLmxvYWQoXCJcIik7XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fc3RhcnRQbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3N0YXJ0UGxheVwiKTtcblxuICAgIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPSB0aGlzLnBvc2l0aW9uO1xuXG4gICAgaWYgKCF0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXVkaW8ucGxheSgpO1xuXG4gICAgLy9UT0RPOiDQv9C+0LTRg9C80LDRgtGMINC90YPQttC90L4g0LvQuCDRgtGA0LjQs9Cz0LXRgNC40YLRjCDRgdC+0LHRi9GC0LjQtSDQsiDRgdC70YPRh9Cw0LUg0YPRgdC/0LXRhdCwXG4gICAgdGhpcy5fcHJvbWlzZVN0YXJ0UGxheWluZygpLnRoZW4obm9vcCwgdGhpcy5fX3Jlc3RhcnQpO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Jlc3RhcnQgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvL1RPRE86INC/0L7QtNGD0LzQsNGC0Ywg0L3Rg9C20LXQvSDQu9C4INGC0YPRgiDQutCw0LrQvtC5LdGC0L4g0YHRh9GR0YLQuNC6INC60L7Qu9C40YfQtdGB0YLQstCwINC/0L7Qv9GL0YLQvtC6XG4gICAgaWYgKHJlYXNvbiAmJiByZWFzb24gIT09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfcmVzdGFydFwiLCByZWFzb24pO1xuXG4gICAgLy9JTkZPOiDQl9Cw0L/QvtC80LjQvdCw0LXQvCDRgtC10LrRg9GJ0LXQtSDRgdC+0YHRgtC+0Y/QvdC40LUsINGCLtC6LiDQvtC90L4g0YHQsdGA0L7RgdC40YLRgdGPINC/0L7RgdC70LUg0L/QtdGA0LXQt9Cw0LPRgNGD0LfQutC4XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbjtcbiAgICB2YXIgcGxheWluZyA9IHRoaXMucGxheWluZztcblxuICAgIHRoaXMubG9hZCh0aGlzLnNyYyk7XG5cbiAgICBpZiAocGxheWluZykge1xuICAgICAgICB0aGlzLnBsYXkocG9zaXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgIH1cbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlcIiwgcG9zaXRpb24pO1xuXG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb24gPT0gbnVsbCA/IHRoaXMucG9zaXRpb24gfHwgMCA6IHBvc2l0aW9uO1xuICAgIHRoaXMuX3Byb21pc2VNZXRhZGF0YSgpLnRoZW4odGhpcy5fX3N0YXJ0UGxheSwgbm9vcCk7XG59O1xuXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBhdXNlXCIpO1xuXG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgdGhpcy5fY2FuY2VsV2FpdChcInN0YXJ0UGxheWluZ1wiLCBcInBhdXNlXCIpO1xuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XG5cbiAgICB0aGlzLl9wcm9taXNlTWV0YWRhdGEoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmF1ZGlvLmN1cnJlbnRUaW1lID0gdGhpcy5wb3NpdGlvbjtcbiAgICB9LmJpbmQodGhpcyksIG5vb3ApO1xufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmNyZWF0ZVNvdXJjZSA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCkge1xuICAgIGlmICh0aGlzLm91dHB1dCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlU291cmNlXCIpO1xuXG4gICAgdGhpcy5hdWRpby5jcm9zc09yaWdpbiA9IFwiYW5vbnltb3VzXCI7XG4gICAgdGhpcy5vdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFFbGVtZW50U291cmNlKHRoaXMuYXVkaW8pO1xuICAgIHRoaXMub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgIHRoaXMuX3Jlc3RhcnQoKTtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3lTb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgICAvKiAhISFXQVJOSU5HISEhXG4gICAgICAg0JTQsNC90L3Ri9C5INC80LXRgtC+0LQg0LzQvtC20L3QviDQstGL0LfRi9Cy0LDRgtGMINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8sINGCLtC6LiDRgdCy0LXQttC10YHQvtC30LTQsNC90L3Ri9C5XG4gICAgICAg0Y3Qu9C10LzQtdC90YIgQXVkaW8g0L3Rg9C20L3QviDQuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0YLRjCAtINC40L3QsNGH0LUg0LHRg9C00LXRgiDQvdC10LTQvtGB0YLRg9C/0L3QviDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUuINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGN0LvQtdC80LXQvdGC0LBcbiAgICAgICBBdWRpbyDQstC+0LfQvNC+0LbQvdCwINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8gKNC60LvQuNC6LCDRgtCw0Yct0YHQvtCx0YvRgtC40LUg0LjQu9C4INC60LvQsNCy0LjQsNGC0YPRgNC90L7QtSDRgdC+0LHRi9GC0LjQtSlcbiAgICAgKi9cblxuICAgIC8vSU5GTzog0LXQtNC40L3RgdGC0LLQtdC90L3Ri9C5INGB0L/QvtGB0L7QsSDQvtGC0L7RgNCy0LDRgtGMIE1lZGlhRWxlbWVudFNvdXJjZSDQvtGCIEF1ZGlvIC0g0YHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDQvtCx0YrQtdC60YIgQXVkaW9cblxuICAgIGlmICghdGhpcy5vdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZGVzdHJveVNvdXJjZVwiKTtcblxuICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLm91dHB1dCA9IG51bGw7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKCk7XG5cbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuICAgIHRoaXMuX2luaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLy8tLS1cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJkZXN0cm95XCIpO1xuXG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoKTtcbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fX3Jlc3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX19zdGFydFBsYXkgPSBudWxsO1xuICAgIHRoaXMucHJvbWlzZXMgPSBudWxsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0hUTUw1TG9hZGVyO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBQbGF5YmFja0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvcGxheWJhY2stZXJyb3InKTtcblxudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSByZXF1aXJlKCcuL2F1ZGlvLWh0bWw1LWxvYWRlcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG5leHBvcnRzLmF2YWlsYWJsZSA9IChmdW5jdGlvbigpIHtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0g0JHQsNC30L7QstCw0Y8g0L/RgNC+0LLQtdGA0LrQsCDQv9C+0LTQtNC10YDQttC60Lgg0LHRgNCw0YPQt9C10YDQvtC8XG4gICAgdmFyIGh0bWw1X2F2YWlsYWJsZSA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgICAgLy9zb21lIGJyb3dzZXJzIGRvZXNuJ3QgdW5kZXJzdGFuZCBuZXcgQXVkaW8oKVxuICAgICAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgICAgICB2YXIgY2FuUGxheSA9IGF1ZGlvLmNhblBsYXlUeXBlKFwiYXVkaW8vbXBlZ1wiKTtcbiAgICAgICAgaWYgKCFjYW5QbGF5IHx8IGNhblBsYXkgPT09ICdubycpIHtcblxuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggcmVhc29uXCIsIGNhblBsYXkpO1xuICAgICAgICAgICAgaHRtbDVfYXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggZXJyb3JcIiwgZSk7XG4gICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGh0bWw1X2F2YWlsYWJsZSk7XG4gICAgcmV0dXJuIGh0bWw1X2F2YWlsYWJsZTtcbn0pKCk7XG5cbnRyeSB7XG4gICAgdmFyIGF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlbkF1ZGlvQVBJIGNvbnRleHQgY3JlYXRlZFwiKTtcbn0gY2F0Y2goZSkge1xuICAgIGF1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJXZW5BdWRpb0FQSSBub3QgZGV0ZWN0ZWRcIik7XG59XG5cbi8qKlxuICogQGNsYXNzINCa0LvQsNGB0YEgaHRtbDUg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBleHRlbmRzIElBdWRpb0ltcGxlbWVudGF0aW9uXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BsYXlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlbmRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3ZvbHVtZWNoYW5nZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2NyYXNoZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzd2FwXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N0b3BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwYXVzZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3Byb2dyZXNzXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGluZ1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2Vycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcbiAgICB0aGlzLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQgIT09IEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKSB7XG4gICAgICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gZmFsc2U7XG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAwO1xuICAgIHRoaXMubG9hZGVycyA9IFtdO1xuXG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvSFRNTDUpO1xuQXVkaW9IVE1MNS50eXBlID0gQXVkaW9IVE1MNS5wcm90b3R5cGUudHlwZSA9IFwiaHRtbDVcIjtcblxuLyoqXG4gKiDQlNC+0LHQsNCy0LjRgtGMINC30LDQs9GA0YPQt9GH0LjQuiDQsNGD0LTQuNC+LdGE0LDQudC70L7QslxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2FkZExvYWRlciA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9hZGRMb2FkZXJcIik7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGxvYWRlciA9IG5ldyBBdWRpb0hUTUw1TG9hZGVyKCk7XG4gICAgbG9hZGVyLmluZGV4ID0gdGhpcy5sb2FkZXJzLnB1c2gobG9hZGVyKSAtIDE7XG5cbiAgICBsb2FkZXIub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHZhciBvZmZzZXQgPSAoc2VsZi5sb2FkZXJzLmxlbmd0aCArIGxvYWRlci5pbmRleCAtIHNlbGYuYWN0aXZlTG9hZGVyKSAlIHNlbGYubG9hZGVycy5sZW5ndGg7XG4gICAgICAgIHNlbGYudHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIGxvYWRlci5jcmVhdGVTb3VyY2UoYXVkaW9Db250ZXh0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCw0LrRgtC40LLQvdGL0Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcGFyYW0ge2ludH0gb2Zmc2V0IC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fc2V0QWN0aXZlID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldEFjdGl2ZVwiLCBvZmZzZXQpO1xuXG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAodGhpcy5hY3RpdmVMb2FkZXIgKyBvZmZzZXQpICUgdGhpcy5sb2FkZXJzLmxlbmd0aDtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgLy9JTkZPOiDQtdGB0LvQuCDRgNC10LvQuNC30L7QstGL0LLQsNGC0Ywg0LrQvtC90YbQtdC/0YbQuNGOINC80L3QvtC20LXRgdGC0LLQsCDQt9Cw0LPRgNGD0LfRh9C40LrQvtCyLCDRgtC+INGN0YLQviDQvdGD0LbQvdC+INC00L7RgNCw0LHQvtGC0LDRgtGMLlxuICAgICAgICB0aGlzLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INC4INC+0YLQv9C40YHQsNGC0Ywg0LXQs9C+INC+0YIg0YHQvtCx0YvRgtC40Lkg0YHRgtCw0YDRgtCwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtBdWRpb31cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9nZXRMb2FkZXIgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcbiAgICByZXR1cm4gdGhpcy5sb2FkZXJzWyh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoXTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICpcbiAqICoq0JLQvdC40LzQsNC90LjQtSEqKiAtINC/0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoIWF1ZGlvQ29udGV4dCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRXJyb3JcIiwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSVwiLCBzdGF0ZSk7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSA9PSBzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICAgICAgbG9hZGVyLmF1ZGlvLnZvbHVtZSA9IDE7XG4gICAgICAgICAgICBsb2FkZXIuY3JlYXRlU291cmNlKGF1ZGlvQ29udGV4dCk7XG5cbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMucHJlcHJvY2Vzc29yID8gdGhpcy5wcmVwcm9jZXNzb3IuaW5wdXQgOiB0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5hdWRpb091dHB1dCkge1xuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuYXVkaW9PdXRwdXQ7XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDRgtC+0LPQviDQutCw0Log0LzRiyDQstC60LvRjtGH0LjQu9C4IHdlYkF1ZGlvQVBJINC10LPQviDRg9C20LUg0L3QtdC70YzQt9GPINC/0YDQvtGB0YLQviDRgtCw0Log0LLRi9C60LvRjtGH0LjRgtGMLlxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG59O1xuXG4vKipcbiAqINCf0L7QtNC60LvRjtGH0LXQvdC40LUg0LDRg9C00LjQviDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsC4g0JLRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6INCw0YPQtNC40L4t0Y3Qu9C10LzQtdC90YLRgyDRgyDQutC+0YLQvtGA0L7Qs9C+INCy0YvRgdGC0LDQstC70LXQvdCwXG4gKiAxMDAlINCz0YDQvtC80LrQvtGB0YLRjC4g0JLRi9GF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0LogR2Fpbk5vZGUsINC60L7RgtC+0YDQsNGPINGA0LXQs9GD0LvQuNGA0YPQtdGCINC40YLQvtCz0L7QstGD0Y4g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcGFyYW0ge3lhLkF1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yfSBwcmVwcm9jZXNzb3IgLSDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YBcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDRgdGC0LDRgtGD0YEg0YPRgdC/0LXRhdCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgaWYgKCF0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JFcnJvclwiLCBwcmVwcm9jZXNzb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3NvciA9PT0gcHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHRoaXMucHJlcHJvY2Vzc29yID0gcHJlcHJvY2Vzc29yO1xuXG4gICAgaWYgKCFwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChwcmVwcm9jZXNzb3IuaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgcHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlcIiwgc3JjKTtcblxuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcblxuICAgIGxvYWRlci5sb2FkKHNyYyk7XG4gICAgbG9hZGVyLnBsYXkoKTtcbn07XG5cbi8qKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuICAgIGxvYWRlci5wYXVzZSgpO1xufTtcblxuLyoqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRiyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuICAgIGxvYWRlci5wbGF5KCk7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQuCDQt9Cw0LPRgNGD0LfQutGDINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzdG9wXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0IHx8IDApO1xuICAgIGxvYWRlci5zdG9wKCk7XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1RPUCwgb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQuNGC0Ywg0YLRgNC10LpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbiwgb2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwcmVsb2FkXCIsIHNyYywgb2Zmc2V0KTtcblxuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgbG9hZGVyLmxvYWQoc3JjKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYywgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICByZXR1cm4gbG9hZGVyLnNyYyA9PT0gc3JjICYmICFsb2FkZXIubm90TG9hZGluZztcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKHNyYywgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICByZXR1cm4gbG9hZGVyLnNyYyA9PT0gc3JjO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKCFsb2FkZXIuc3JjKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUob2Zmc2V0KTtcbiAgICBsb2FkZXIucGxheSgpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoKS5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0UG9zaXRpb25cIiwgcG9zaXRpb24pO1xuICAgIHRoaXMuX2dldExvYWRlcigpLnNldFBvc2l0aW9uKHBvc2l0aW9uIC0gMC4wMDEpOyAvL0lORk86INC/0L7QvdGP0YLRjCDQvdCw0YTQuNCzINGC0YPRgiDQvdGD0LbQtdC9IDAuMDAxXG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KS5hdWRpby5kdXJhdGlvbjtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG5cbiAgICBpZiAobG9hZGVyLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbG9hZGVyLmF1ZGlvLmJ1ZmZlcmVkLmVuZCgwKSAtIGxvYWRlci5hdWRpby5idWZmZXJlZC5zdGFydCgwKTtcbiAgICB9XG4gICAgcmV0dXJuIDA7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZvbHVtZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBwYXJhbSB7bnVtYmVyfSB2b2x1bWVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcbiAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHZvbHVtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuc3JjO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBkZXRlY3Qub25seURldmljZVZvbHVtZTtcbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IHRoaXMuZ2V0U3JjKDApLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiB0aGlzLmdldFNyYygxKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvSFRNTDU7XG4iLCJ2YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKCcuL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbGliL25ldC9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbG9nZ2VyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC9lcXVhbGl6ZXIvZXhwb3J0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWWFuZGV4QXVkaW87XG4iLCJ2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG5cbi8qKlxuICogQGNsYXNzINCe0YLQu9C+0LbQtdC90L3QvtC1INC00LXQudGB0YLQstC40LVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIF9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQoNCw0LfRgNC10YjQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Jlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHsqfSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSDQv9C10YDQtdC00LDRgtGMINC+0YjQuNCx0LrRg1xuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG5cbiAgICB2YXIgcHJvbWlzZSA9IF9wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBzZWxmLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBzZWxmLnJlamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7IC8vIERvbid0IHRocm93IGVycm9ycyB0byBjb25zb2xlXG5cbiAgICAvKipcbiAgICAgKiDQktGL0L/QvtC70L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQntGC0LrQu9C+0L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucmVqZWN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcHJvbWlzZVxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcHJvbWlzZTsgfTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQstGL0L/QvtC70L3QtdC90LjRjyDRgdC/0LjRgdC60LAg0L7QsdC10YnQsNC90LjQuVxuICogQHBhcmFtIHsuLi4qfSBhcmdzIC0g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC+0LbQuNC00LDRgtGMXG4gKiBAcmV0dXJucyBBYm9ydGFibGVQcm9taXNlXG4gKi9cbkRlZmVycmVkLndoZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcblxuICAgIHZhciBsaXN0ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHZhciBwZW5kaW5nID0gbGlzdC5sZW5ndGg7XG5cbiAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwZW5kaW5nLS07XG5cbiAgICAgICAgaWYgKHBlbmRpbmcgPD0gMCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgIH0pO1xuICAgIGxpc3QgPSBudWxsO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZS5hYm9ydCA9IGRlZmVycmVkLnJlamVjdDtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmVycmVkO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vZGF0YS9tZXJnZScpO1xuXG52YXIgTElTVEVORVJTX05BTUUgPSBcIl9saXN0ZW5lcnNcIjtcbnZhciBNVVRFX09QVElPTiA9IFwiX211dGVkXCI7XG5cbi8qKlxuICog0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGB0L/QuNGB0LrQvtCyINGB0LvRg9GI0LDRgtC10LvQtdC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbGlzdGVuZXJzXG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBBcnJheS48RnVuY3Rpb24+Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTElTVEVORVJTX05BTUVdID0ge307XG5cbiAgICAvKiog0KTQu9Cw0LMg0LLQutC70Y7Rh9C10L3QuNGPL9Cy0YvQutC70Y7Rh9C10L3QuNGPINGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbXV0ZXNcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gZmFsc2U7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0LrQu9Cw0YHRgSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2xhc3NDb25zdHJ1Y3RvciAtINC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0tINGC0L7RgiDQttC1INC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKGNsYXNzQ29uc3RydWN0b3IpIHtcbiAgICBtZXJnZShjbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgcmV0dXJuIGNsYXNzQ29uc3RydWN0b3I7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0L7QsdGK0LXQutGCINGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IC0g0L7QsdGK0LXQutGCXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtLSDRgtC+0YIg0LbQtSDQvtCx0YrQtdC60YIsINGA0LDRgdGI0LjRgNC10L3QvdGL0Lkg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqL1xuRXZlbnRzLmV2ZW50aXplID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgbWVyZ2Uob2JqZWN0LCBFdmVudHMucHJvdG90eXBlLCB0cnVlKTtcbiAgICBFdmVudHMuY2FsbChvYmplY3QpO1xuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSA9IFtdO1xuICAgIH1cblxuICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3Nba10gPT09IGNhbGxiYWNrIHx8IGNhbGxiYWNrc1trXS5jYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1LCDQvtGC0L/QuNGB0LDRgtGM0YHRjyDRgdGA0LDQt9GDINC/0L7RgdC70LUg0L/QtdGA0LLQvtCz0L4g0LLQvtC30L3QuNC60L3QvtCy0LXQvdC40Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCB3cmFwcGVyKTtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgd3JhcHBlci5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHNlbGYub24oZXZlbnQsIHdyYXBwZXIpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0gey4uLmFyZ3N9IGFyZ3MgLSDQv9Cw0YDQsNC80LXRgtGA0Ysg0LTQu9GPINC/0LXRgNC10LTQsNGH0Lgg0LLQvNC10YHRgtC1INGBINGB0L7QsdGL0YLQuNC10LxcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihldmVudCwgYXJncykge1xuICAgIGlmICh0aGlzW01VVEVfT1BUSU9OXSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYgKGV2ZW50ICE9PSBcIipcIikge1xuICAgICAgICBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYXBwbHkodGhpcywgW1wiKlwiLCBldmVudF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tzID0gW10uY29uY2F0KHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSk7XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGNhbGxiYWNrc1trXS5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDQstGB0LXRhSDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpc1tMSVNURU5FUlNfTkFNRV0pIHtcbiAgICAgICAgaWYgKHRoaXNbTElTVEVORVJTX05BTUVdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCU0LXQu9C10LPQuNGA0L7QstCw0YLRjCDQstGB0LUg0YHQvtCx0YvRgtC40Y8g0LTRgNGD0LPQvtC80YMg0LTQuNGB0L/QtdGC0YfQtdGA0YMg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RXZlbnRzfSBhY2NlcHRvciAtINC/0L7Qu9GD0YfQsNGC0LXQu9GMINGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5waXBlRXZlbnRzID0gZnVuY3Rpb24oYWNjZXB0b3IpIHtcbiAgICB0aGlzLm9uKFwiKlwiLCBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYmluZChhY2NlcHRvcikpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzW01VVEVfT1BUSU9OXSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCS0L7Qt9C+0LHQvdC+0LLQuNGC0Ywg0LfQsNC/0YPRgdC6INGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS51bm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICBkZWxldGUgdGhpc1tNVVRFX09QVElPTl07XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50cztcbiIsInZhciB2b3cgPSByZXF1aXJlKCd2b3cnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9icm93c2VyL2RldGVjdCcpO1xuXG4vKipcbiAqIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9ydS9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9Qcm9taXNlfEVTLTYgUHJvbWlzZX1cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUHJvbWlzZTtcbmlmICh0eXBlb2Ygd2luZG93LlByb21pc2UgIT09IFwiZnVuY3Rpb25cIlxuICAgIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwibXNpZVwiIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwiZWRnZVwiIC8vINC80LXQu9C60LjQtSDQvNGP0LPQutC40LUg0LrQsNC6INCy0YHQtdCz0LTQsCDQvdC40YfQtdCz0L4g0L3QtSDRg9C80LXRjtGCINC00LXQu9Cw0YLRjCDQv9GA0LDQstC40LvRjNC90L5cbikge1xuICAgIFByb21pc2UgPSB2b3cuUHJvbWlzZTtcbn0gZWxzZSB7XG4gICAgUHJvbWlzZSA9IHdpbmRvdy5Qcm9taXNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDRgNCw0LfRgNC10YjRkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZXNvbHZlXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0YDQsNC30YDQtdGI0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDQvtGC0LrQu9C+0L3RkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZWplY3RcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSwg0LrQvtGC0L7RgNGL0LzQuCDQvtGC0LrQu9C+0L3QuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDQstGL0L/QvtC70L3QuNGC0YHRjyDRgtC+0LPQtNCwLCDQutC+0LPQtNCwINCx0YPQtNGD0YIg0LLRi9C/0L7Qu9C90LXQvdGLINCy0YHQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQvtCx0LXRidCw0L3QuNGPLlxuICogQG1ldGhvZCBQcm9taXNlLmFsbFxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTQtdGCINCy0YvQv9C+0LvQvdC10L3QviDRhdC+0YLRjyDQsdGLINC+0LTQvdC+INC40Lcg0L/QtdGA0LXQtNCw0L3QvdGL0YUg0L7QsdC10YnQsNC90LjQuS5cbiAqIEBtZXRob2QgUHJvbWlzZS5yYWNlXG4gKiBAcGFyYW0ge0FycmF5LjxQcm9taXNlPn0gcHJvbWlzZXMgLSDRgdC/0LjRgdC+0Log0L7QsdC10YnQsNC90LjQuVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgNCw0LfRgNC10YjQtdC90LjRjyDQuCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAbWV0aG9kIFByb21pc2UjdGhlblxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGF0LBcbiAqIEBwYXJhbSB7bnVsbHxmdW5jdGlvbn0gW2VycmJhY2tdIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQutC4XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI2NhdGNoXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBlcnJiYWNrIC0gINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBBYm9ydGFibGVQcm9taXNlXG4vKipcbiAqINCe0LHQtdGJ0LDQvdC40LUg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLQvNC10L3RiyDRgdCy0Y/Qt9Cw0L3QvdC+0LPQviDRgSDQvdC40Lwg0LTQtdC50YHRgtCy0LjRjy5cbiAqIEBjbGFzcyBBYm9ydGFibGVQcm9taXNlXG4gKiBAZXh0ZW5kcyBQcm9taXNlXG4gKi9cblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LTQtdC50YHRgtCy0LjRjyDRgdCy0Y/Qt9Cw0L3QvdC+0LPQviDRgSDQvtCx0LXRidCw0LXQvdC40LXQvFxuICogQGFic3RyYWN0XG4gKiBAbWV0aG9kIEFib3J0YWJsZVByb21pc2UjYWJvcnRcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0LTQtdC50YHRgtCy0LjRj1xuICovXG4iLCJ2YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QoZGF0YSk7XG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApO1xuICAgIHJldHVybiBwcm9taXNlO1xufTtcbiIsInZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIEJyb3dzZXIgZGV0ZWN0aW9uXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcndlYmtpdCA9IC8od2Via2l0KVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcnlhYnJvID0gLyh5YWJyb3dzZXIpWyBcXC9dKFtcXHcuXSspLztcbnZhciByb3BlcmEgPSAvKG9wZXJhKSg/Oi4qdmVyc2lvbik/WyBcXC9dKFtcXHcuXSspLztcbnZhciBybXNpZSA9IC8obXNpZSkgKFtcXHcuXSspLztcbnZhciByZWRnZSA9IC8oZWRnZSlcXC8oW1xcdy5dKykvO1xudmFyIHJtb3ppbGxhID0gLyhtb3ppbGxhKSg/Oi4qPyBydjooW1xcdy5dKykpPy87XG52YXIgcnNhZmFyaSA9IC9eKCg/IWNocm9tZSkuKSp2ZXJzaW9uXFwvKFtcXGRcXHdcXC5dKykuKihzYWZhcmkpLztcblxudmFyIG1hdGNoID0gcnNhZmFyaS5leGVjKHVhKSB8fCByeWFicm8uZXhlYyh1YSkgfHwgcmVkZ2UuZXhlYyh1YSkgfHwgcndlYmtpdC5leGVjKHVhKSB8fCByb3BlcmEuZXhlYyh1YSkgfHwgcm1zaWUuZXhlYyh1YSkgfHwgdWEuaW5kZXhPZihcImNvbXBhdGlibGVcIikgPCAwXG4gICAgJiYgcm1vemlsbGEuZXhlYyh1YSlcbiAgICB8fCBbXTtcblxudmFyIGJyb3dzZXIgPSB7bmFtZTogbWF0Y2hbMV0gfHwgXCJcIiwgdmVyc2lvbjogbWF0Y2hbMl0gfHwgXCIwXCJ9O1xuXG5pZiAobWF0Y2hbM10gPT09IFwic2FmYXJpXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBtYXRjaFszXTtcbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gJ21zaWUnKSB7XG4gICAgaWYgKGRvY3VtZW50LmRvY3VtZW50TW9kZSkgeyAvLyBJRTggb3IgbGF0ZXJcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgfSBlbHNlIHsgLy8gSUUgNS03XG4gICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNTsgLy8gQXNzdW1lIHF1aXJrcyBtb2RlIHVubGVzcyBwcm92ZW4gb3RoZXJ3aXNlXG4gICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuY29tcGF0TW9kZSA9PT0gXCJDU1MxQ29tcGF0XCIpIHtcbiAgICAgICAgICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IDc7IC8vIHN0YW5kYXJkcyBtb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vSU5GTzogSUUgKNC60LDQuiDQstGB0LXQs9C00LApINC90LUg0LrQvtGA0YDQtdC60YLQvdC+INCy0YvRgdGC0LDQstC70Y/QtdGCIHVzZXItYWdlbnRcbmlmIChicm93c2VyLm5hbWUgPT09IFwibW96aWxsYVwiICYmIGJyb3dzZXIudmVyc2lvbi5zcGxpdChcIi5cIilbMF0gPT09IFwiMTFcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwibXNpZVwiO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUGxhdGZvcm0gZGV0ZWN0aW9uXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcnBsYXRmb3JtID0gLyhpcGFkfGlwaG9uZXxpcG9kfGFuZHJvaWR8YmxhY2tiZXJyeXxwbGF5Ym9va3x3aW5kb3dzIGNlfHdlYm9zKS87XG52YXIgcnRhYmxldCA9IC8oaXBhZHxwbGF5Ym9vaykvO1xudmFyIHJhbmRyb2lkID0gLyhhbmRyb2lkKS87XG52YXIgcm1vYmlsZSA9IC8obW9iaWxlKS87XG5cbnBsYXRmb3JtID0gcnBsYXRmb3JtLmV4ZWModWEpIHx8IFtdO1xudmFyIHRhYmxldCA9IHJ0YWJsZXQuZXhlYyh1YSkgfHwgIXJtb2JpbGUuZXhlYyh1YSkgJiYgcmFuZHJvaWQuZXhlYyh1YSkgfHwgW107XG5cbmlmIChwbGF0Zm9ybVsxXSkge1xuICAgIHBsYXRmb3JtWzFdID0gcGxhdGZvcm1bMV0ucmVwbGFjZSgvXFxzL2csIFwiX1wiKTsgLy8gQ2hhbmdlIHdoaXRlc3BhY2UgdG8gdW5kZXJzY29yZS4gRW5hYmxlcyBkb3Qgbm90YXRpb24uXG59XG5cbnZhciBwbGF0Zm9ybSA9IHtcbiAgICB0eXBlOiBwbGF0Zm9ybVsxXSB8fCBcIlwiLFxuICAgIHRhYmxldDogISF0YWJsZXRbMV0sXG4gICAgbW9iaWxlOiBwbGF0Zm9ybVsxXSAmJiAhdGFibGV0WzFdIHx8IGZhbHNlXG59O1xuaWYgKCFwbGF0Zm9ybS50eXBlKSB7XG4gICAgcGxhdGZvcm0udHlwZSA9ICdwYyc7XG59XG5cbnBsYXRmb3JtLm9zID0gcGxhdGZvcm0udHlwZTtcbmlmIChwbGF0Zm9ybS50eXBlID09PSAnaXBhZCcgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwaG9uZScgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwb2QnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnaW9zJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnYW5kcm9pZCc7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJXaW5cIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIndpbmRvd3NcIjtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvd2luW14gXSogKFteO10qKS9pKTtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gcGxhdGZvcm0udmVyc2lvbiAmJiBwbGF0Zm9ybS52ZXJzaW9uWzFdO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJtYWNvc1wiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ1bml4XCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJMaW51eFwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibGludXhcIjtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCU0LXRgtC10LrRgtC40YDQvtCy0LDQvdC40LUg0LHQu9C+0LrQuNGA0L7QstC60Lgg0LPRgNC+0LzQutC+0YHRgtC4XG52YXIgbm9Wb2x1bWUgPSB0cnVlO1xudHJ5IHtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIGF1ZGlvLnZvbHVtZSA9IDAuNjM7XG4gICAgbm9Wb2x1bWUgPSBNYXRoLmFicyhhdWRpby52b2x1bWUgLSAwLjYzKSA+IDAuMDE7XG59IGNhdGNoKGUpIHtcbiAgICBub1ZvbHVtZSA9IHRydWU7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSDQrdC60YHQv9C+0YDRglxuLyoqXG4gKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQvtCxINC+0LrRgNGD0LbQtdC90LjQuFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIGRldGVjdCA9IHtcbiAgICAvKipcbiAgICAgKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQsdGA0LDRg9C30LXRgNC1XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtINC90LDQt9Cy0LDQvdC40LUg0LHRgNCw0YPQt9C10YDQsFxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB2ZXJzaW9uIC0g0LLQtdGA0YHQuNGPXG4gICAgICogQHByb3BlcnR5IHtudW1iZXJ9IFtkb2N1bWVudE1vZGVdIC0g0LLQtdGA0YHQuNGPINC00L7QutGD0LzQtdC90YLQsFxuICAgICAqL1xuICAgIGJyb3dzZXI6IGJyb3dzZXIsXG5cbiAgICAvKipcbiAgICAgKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQv9C70LDRgtGE0L7RgNC80LVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBvcyAtINGC0LjQvyDQvtC/0LXRgNCw0YbQuNC+0L3QvdC+0Lkg0YHQuNGB0YLQtdC80YtcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdHlwZSAtINGC0LjQvyDQv9C70LDRgtGE0L7RgNC80YtcbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IHRhYmxldCAtINC/0LvQsNC90YjQtdGCXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSBtb2JpbGUgLSDQvNC+0LHQuNC70YzQvdGL0LlcbiAgICAgKi9cbiAgICBwbGF0Zm9ybTogcGxhdGZvcm0sXG5cbiAgICAvKipcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60LAg0LPRgNC+0LzQutC+0YHRgtC4XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgb25seURldmljZVZvbHVtZTogbm9Wb2x1bWVcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZGV0ZWN0O1xuIiwiLyoqXG4gKiBAbGljZW5zZSBTV0ZPYmplY3QgdjIuMiA8aHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC8+XG4gKiBpcyByZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgPGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwPlxuICogQHByaXZhdGVcbiovXG52YXIgc3dmb2JqZWN0ID0gZnVuY3Rpb24oKSB7XG5cdHZhciBVTkRFRiA9IFwidW5kZWZpbmVkXCIsXG5cdFx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0XHRTSE9DS1dBVkVfRkxBU0ggPSBcIlNob2Nrd2F2ZSBGbGFzaFwiLFxuXHRcdFNIT0NLV0FWRV9GTEFTSF9BWCA9IFwiU2hvY2t3YXZlRmxhc2guU2hvY2t3YXZlRmxhc2hcIixcblx0XHRGTEFTSF9NSU1FX1RZUEUgPSBcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIsXG5cdFx0RVhQUkVTU19JTlNUQUxMX0lEID0gXCJTV0ZPYmplY3RFeHBySW5zdFwiLFxuXHRcdE9OX1JFQURZX1NUQVRFX0NIQU5HRSA9IFwib25yZWFkeXN0YXRlY2hhbmdlXCIsXG5cdFx0d2luID0gd2luZG93LFxuXHRcdGRvYyA9IGRvY3VtZW50LFxuXHRcdG5hdiA9IG5hdmlnYXRvcixcblx0XHRwbHVnaW4gPSBmYWxzZSxcblx0XHRkb21Mb2FkRm5BcnIgPSBbbWFpbl0sXG5cdFx0cmVnT2JqQXJyID0gW10sXG5cdFx0b2JqSWRBcnIgPSBbXSxcblx0XHRsaXN0ZW5lcnNBcnIgPSBbXSxcblx0XHRzdG9yZWRBbHRDb250ZW50LFxuXHRcdHN0b3JlZEFsdENvbnRlbnRJZCxcblx0XHRzdG9yZWRDYWxsYmFja0ZuLFxuXHRcdHN0b3JlZENhbGxiYWNrT2JqLFxuXHRcdGlzRG9tTG9hZGVkID0gZmFsc2UsXG5cdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlLFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0LFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEsXG5cdFx0YXV0b0hpZGVTaG93ID0gdHJ1ZSxcblx0LyogQ2VudHJhbGl6ZWQgZnVuY3Rpb24gZm9yIGJyb3dzZXIgZmVhdHVyZSBkZXRlY3Rpb25cblx0XHQtIFVzZXIgYWdlbnQgc3RyaW5nIGRldGVjdGlvbiBpcyBvbmx5IHVzZWQgd2hlbiBubyBnb29kIGFsdGVybmF0aXZlIGlzIHBvc3NpYmxlXG5cdFx0LSBJcyBleGVjdXRlZCBkaXJlY3RseSBmb3Igb3B0aW1hbCBwZXJmb3JtYW5jZVxuXHQqL1xuXHR1YSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB3M2Nkb20gPSB0eXBlb2YgZG9jLmdldEVsZW1lbnRCeUlkICE9IFVOREVGICYmIHR5cGVvZiBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUgIT0gVU5ERUYgJiYgdHlwZW9mIGRvYy5jcmVhdGVFbGVtZW50ICE9IFVOREVGLFxuXHRcdFx0dSA9IG5hdi51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcblx0XHRcdHAgPSBuYXYucGxhdGZvcm0udG9Mb3dlckNhc2UoKSxcblx0XHRcdHdpbmRvd3MgPSBwID8gL3dpbi8udGVzdChwKSA6IC93aW4vLnRlc3QodSksXG5cdFx0XHRtYWMgPSBwID8gL21hYy8udGVzdChwKSA6IC9tYWMvLnRlc3QodSksXG5cdFx0XHR3ZWJraXQgPSAvd2Via2l0Ly50ZXN0KHUpID8gcGFyc2VGbG9hdCh1LnJlcGxhY2UoL14uKndlYmtpdFxcLyhcXGQrKFxcLlxcZCspPykuKiQvLCBcIiQxXCIpKSA6IGZhbHNlLCAvLyByZXR1cm5zIGVpdGhlciB0aGUgd2Via2l0IHZlcnNpb24gb3IgZmFsc2UgaWYgbm90IHdlYmtpdFxuXHRcdFx0aWUgPSAhK1wiXFx2MVwiLCAvLyBmZWF0dXJlIGRldGVjdGlvbiBiYXNlZCBvbiBBbmRyZWEgR2lhbW1hcmNoaSdzIHNvbHV0aW9uOiBodHRwOi8vd2VicmVmbGVjdGlvbi5ibG9nc3BvdC5jb20vMjAwOS8wMS8zMi1ieXRlcy10by1rbm93LWlmLXlvdXItYnJvd3Nlci1pcy1pZS5odG1sXG5cdFx0XHRwbGF5ZXJWZXJzaW9uID0gWzAsMCwwXSxcblx0XHRcdGQgPSBudWxsO1xuXHRcdGlmICh0eXBlb2YgbmF2LnBsdWdpbnMgIT0gVU5ERUYgJiYgdHlwZW9mIG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0gPT0gT0JKRUNUKSB7XG5cdFx0XHRkID0gbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXS5kZXNjcmlwdGlvbjtcblx0XHRcdGlmIChkICYmICEodHlwZW9mIG5hdi5taW1lVHlwZXMgIT0gVU5ERUYgJiYgbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdICYmICFuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0uZW5hYmxlZFBsdWdpbikpIHsgLy8gbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCJdLmVuYWJsZWRQbHVnaW4gaW5kaWNhdGVzIHdoZXRoZXIgcGx1Zy1pbnMgYXJlIGVuYWJsZWQgb3IgZGlzYWJsZWQgaW4gU2FmYXJpIDMrXG5cdFx0XHRcdHBsdWdpbiA9IHRydWU7XG5cdFx0XHRcdGllID0gZmFsc2U7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRkID0gZC5yZXBsYWNlKC9eLipcXHMrKFxcUytcXHMrXFxTKyQpLywgXCIkMVwiKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblswXSA9IHBhcnNlSW50KGQucmVwbGFjZSgvXiguKilcXC4uKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMV0gPSBwYXJzZUludChkLnJlcGxhY2UoL14uKlxcLiguKilcXHMuKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMl0gPSAvW2EtekEtWl0vLnRlc3QoZCkgPyBwYXJzZUludChkLnJlcGxhY2UoL14uKlthLXpBLVpdKyguKikkLywgXCIkMVwiKSwgMTApIDogMDtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5BY3RpdmVYT2JqZWN0ICE9IFVOREVGKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgYSA9IG5ldyBBY3RpdmVYT2JqZWN0KFNIT0NLV0FWRV9GTEFTSF9BWCk7XG5cdFx0XHRcdGlmIChhKSB7IC8vIGEgd2lsbCByZXR1cm4gbnVsbCB3aGVuIEFjdGl2ZVggaXMgZGlzYWJsZWRcblx0XHRcdFx0XHRkID0gYS5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRpZSA9IHRydWU7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRcdFx0ZCA9IGQuc3BsaXQoXCIgXCIpWzFdLnNwbGl0KFwiLFwiKTtcblx0XHRcdFx0XHRcdHBsYXllclZlcnNpb24gPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaChlKSB7fVxuXHRcdH1cblx0XHRyZXR1cm4geyB3Mzp3M2Nkb20sIHB2OnBsYXllclZlcnNpb24sIHdrOndlYmtpdCwgaWU6aWUsIHdpbjp3aW5kb3dzLCBtYWM6bWFjIH07XG5cdH0oKSxcblx0LyogQ3Jvc3MtYnJvd3NlciBvbkRvbUxvYWRcblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIHRoZSBET00gb2YgYSB3ZWIgcGFnZSBpcyBsb2FkZWRcblx0XHQtIEludGVybmV0IEV4cGxvcmVyIHdvcmthcm91bmQgYmFzZWQgb24gRGllZ28gUGVyaW5pJ3Mgc29sdXRpb246IGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9JRUNvbnRlbnRMb2FkZWQvXG5cdFx0LSBSZWd1bGFyIG9ubG9hZCBzZXJ2ZXMgYXMgZmFsbGJhY2tcblx0Ki9cblx0b25Eb21Mb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF1YS53MykgeyByZXR1cm47IH1cblx0XHRpZiAoKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSAhPSBVTkRFRiAmJiBkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHx8ICh0eXBlb2YgZG9jLnJlYWR5U3RhdGUgPT0gVU5ERUYgJiYgKGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF0gfHwgZG9jLmJvZHkpKSkgeyAvLyBmdW5jdGlvbiBpcyBmaXJlZCBhZnRlciBvbmxvYWQsIGUuZy4gd2hlbiBzY3JpcHQgaXMgaW5zZXJ0ZWQgZHluYW1pY2FsbHlcblx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0fVxuXHRcdGlmICghaXNEb21Mb2FkZWQpIHtcblx0XHRcdGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdFx0ZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGNhbGxEb21Mb2FkRnVuY3Rpb25zLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRcdGRvYy5hdHRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmIChkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHtcblx0XHRcdFx0XHRcdGRvYy5kZXRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGFyZ3VtZW50cy5jYWxsZWUpO1xuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAod2luID09IHRvcCkgeyAvLyBpZiBub3QgaW5zaWRlIGFuIGlmcmFtZVxuXHRcdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZG9jLmRvY3VtZW50RWxlbWVudC5kb1Njcm9sbChcImxlZnRcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXRjaChlKSB7XG5cdFx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdFx0fSkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHVhLndrKSB7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChpc0RvbUxvYWRlZCkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAoIS9sb2FkZWR8Y29tcGxldGUvLnRlc3QoZG9jLnJlYWR5U3RhdGUpKSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0YWRkTG9hZEV2ZW50KGNhbGxEb21Mb2FkRnVuY3Rpb25zKTtcblx0XHR9XG5cdH0oKTtcblx0ZnVuY3Rpb24gY2FsbERvbUxvYWRGdW5jdGlvbnMoKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdHRyeSB7IC8vIHRlc3QgaWYgd2UgY2FuIHJlYWxseSBhZGQvcmVtb3ZlIGVsZW1lbnRzIHRvL2Zyb20gdGhlIERPTTsgd2UgZG9uJ3Qgd2FudCB0byBmaXJlIGl0IHRvbyBlYXJseVxuXHRcdFx0dmFyIHQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLmFwcGVuZENoaWxkKGNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTtcblx0XHRcdHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHsgcmV0dXJuOyB9XG5cdFx0aXNEb21Mb2FkZWQgPSB0cnVlO1xuXHRcdHZhciBkbCA9IGRvbUxvYWRGbkFyci5sZW5ndGg7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkbDsgaSsrKSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbaV0oKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWRkRG9tTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7XG5cdFx0XHRmbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvbUxvYWRGbkFycltkb21Mb2FkRm5BcnIubGVuZ3RoXSA9IGZuOyAvLyBBcnJheS5wdXNoKCkgaXMgb25seSBhdmFpbGFibGUgaW4gSUU1LjUrXG5cdFx0fVxuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgb25sb2FkXG5cdFx0LSBCYXNlZCBvbiBKYW1lcyBFZHdhcmRzJyBzb2x1dGlvbjogaHR0cDovL2Jyb3RoZXJjYWtlLmNvbS9zaXRlL3Jlc291cmNlcy9zY3JpcHRzL29ubG9hZC9cblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIGEgd2ViIHBhZ2UgaW5jbHVkaW5nIGFsbCBvZiBpdHMgYXNzZXRzIGFyZSBsb2FkZWRcblx0ICovXG5cdGZ1bmN0aW9uIGFkZExvYWRFdmVudChmbikge1xuXHRcdGlmICh0eXBlb2Ygd2luLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdHdpbi5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLmF0dGFjaEV2ZW50ICE9IFVOREVGKSB7XG5cdFx0XHRhZGRMaXN0ZW5lcih3aW4sIFwib25sb2FkXCIsIGZuKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5vbmxvYWQgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2YXIgZm5PbGQgPSB3aW4ub25sb2FkO1xuXHRcdFx0d2luLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmbk9sZCgpO1xuXHRcdFx0XHRmbigpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR3aW4ub25sb2FkID0gZm47XG5cdFx0fVxuXHR9XG5cdC8qIE1haW4gZnVuY3Rpb25cblx0XHQtIFdpbGwgcHJlZmVyYWJseSBleGVjdXRlIG9uRG9tTG9hZCwgb3RoZXJ3aXNlIG9ubG9hZCAoYXMgYSBmYWxsYmFjaylcblx0Ki9cblx0ZnVuY3Rpb24gbWFpbigpIHtcblx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHR0ZXN0UGxheWVyVmVyc2lvbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogRGV0ZWN0IHRoZSBGbGFzaCBQbGF5ZXIgdmVyc2lvbiBmb3Igbm9uLUludGVybmV0IEV4cGxvcmVyIGJyb3dzZXJzXG5cdFx0LSBEZXRlY3RpbmcgdGhlIHBsdWctaW4gdmVyc2lvbiB2aWEgdGhlIG9iamVjdCBlbGVtZW50IGlzIG1vcmUgcHJlY2lzZSB0aGFuIHVzaW5nIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXRlbSdzIGRlc2NyaXB0aW9uOlxuXHRcdCAgYS4gQm90aCByZWxlYXNlIGFuZCBidWlsZCBudW1iZXJzIGNhbiBiZSBkZXRlY3RlZFxuXHRcdCAgYi4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IGNvcnJ1cHQgaW5zdGFsbGVycyBwcm92aWRlZCBieSBBZG9iZVxuXHRcdCAgYy4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IG11bHRpcGxlIEZsYXNoIFBsYXllciBlbnRyaWVzIGluIHRoZSBwbHVnaW4gQXJyYXksIGNhdXNlZCBieSBpbmNvcnJlY3QgYnJvd3NlciBpbXBvcnRzXG5cdFx0LSBEaXNhZHZhbnRhZ2Ugb2YgdGhpcyBtZXRob2QgaXMgdGhhdCBpdCBkZXBlbmRzIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIERPTSwgd2hpbGUgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpcyBpbW1lZGlhdGVseSBhdmFpbGFibGVcblx0Ki9cblx0ZnVuY3Rpb24gdGVzdFBsYXllclZlcnNpb24oKSB7XG5cdFx0dmFyIGIgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO1xuXHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdHZhciB0ID0gYi5hcHBlbmRDaGlsZChvKTtcblx0XHRpZiAodCkge1xuXHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmICh0eXBlb2YgdC5HZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdHZhciBkID0gdC5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0dWEucHYgPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGNvdW50ZXIgPCAxMCkge1xuXHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yi5yZW1vdmVDaGlsZChvKTtcblx0XHRcdFx0dCA9IG51bGw7XG5cdFx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBQZXJmb3JtIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWF0Y2hpbmc7IHN0YXRpYyBwdWJsaXNoaW5nIG9ubHlcblx0Ki9cblx0ZnVuY3Rpb24gbWF0Y2hWZXJzaW9ucygpIHtcblx0XHR2YXIgcmwgPSByZWdPYmpBcnIubGVuZ3RoO1xuXHRcdGlmIChybCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmw7IGkrKykgeyAvLyBmb3IgZWFjaCByZWdpc3RlcmVkIG9iamVjdCBlbGVtZW50XG5cdFx0XHRcdHZhciBpZCA9IHJlZ09iakFycltpXS5pZDtcblx0XHRcdFx0dmFyIGNiID0gcmVnT2JqQXJyW2ldLmNhbGxiYWNrRm47XG5cdFx0XHRcdHZhciBjYk9iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDppZH07XG5cdFx0XHRcdGlmICh1YS5wdlswXSA+IDApIHtcblx0XHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdFx0XHRcdGlmIChvYmopIHtcblx0XHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHJlZ09iakFycltpXS5zd2ZWZXJzaW9uKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSkgeyAvLyBGbGFzaCBQbGF5ZXIgdmVyc2lvbiA+PSBwdWJsaXNoZWQgU1dGIHZlcnNpb246IEhvdXN0b24sIHdlIGhhdmUgYSBtYXRjaCFcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IGdldE9iamVjdEJ5SWQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZyBpZiBzZXQgYnkgdGhlIHdlYiBwYWdlIGF1dGhvciBhbmQgaWYgc3VwcG9ydGVkXG5cdFx0XHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRcdFx0YXR0LmRhdGEgPSByZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGw7XG5cdFx0XHRcdFx0XHRcdGF0dC53aWR0aCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0YXR0LmhlaWdodCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIHsgYXR0LnN0eWxlY2xhc3MgPSBvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7IH1cblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKSkgeyBhdHQuYWxpZ24gPSBvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIik7IH1cblx0XHRcdFx0XHRcdFx0Ly8gcGFyc2UgSFRNTCBvYmplY3QgcGFyYW0gZWxlbWVudCdzIG5hbWUtdmFsdWUgcGFpcnNcblx0XHRcdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgcCA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcmFtXCIpO1xuXHRcdFx0XHRcdFx0XHR2YXIgcGwgPSBwLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwbDsgaisrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKS50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cGFyW3Bbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKV0gPSBwW2pdLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIGlkLCBjYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHsgLy8gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtaXNtYXRjaCBvciBhbiBvbGRlciBXZWJraXQgZW5naW5lIHRoYXQgaWdub3JlcyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCdzIG5lc3RlZCBwYXJhbSBlbGVtZW50czogZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50IGluc3RlYWQgb2YgU1dGXG5cdFx0XHRcdFx0XHRcdGRpc3BsYXlBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikgeyBjYihjYk9iaik7IH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XHQvLyBpZiBubyBGbGFzaCBQbGF5ZXIgaXMgaW5zdGFsbGVkIG9yIHRoZSBmcCB2ZXJzaW9uIGNhbm5vdCBiZSBkZXRlY3RlZCB3ZSBsZXQgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgZG8gaXRzIGpvYiAoZWl0aGVyIHNob3cgYSBTV0Ygb3IgYWx0ZXJuYXRpdmUgY29udGVudClcblx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdHZhciBvID0gZ2V0T2JqZWN0QnlJZChpZCk7IC8vIHRlc3Qgd2hldGhlciB0aGVyZSBpcyBhbiBIVE1MIG9iamVjdCBlbGVtZW50IG9yIG5vdFxuXHRcdFx0XHRcdFx0aWYgKG8gJiYgdHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IG87XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpIHtcblx0XHR2YXIgciA9IG51bGw7XG5cdFx0dmFyIG8gPSBnZXRFbGVtZW50QnlJZChvYmplY3RJZFN0cik7XG5cdFx0aWYgKG8gJiYgby5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIG4gPSBvLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRcdGlmIChuKSB7XG5cdFx0XHRcdFx0ciA9IG47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0LyogUmVxdWlyZW1lbnRzIGZvciBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHQtIG9ubHkgb25lIGluc3RhbmNlIGNhbiBiZSBhY3RpdmUgYXQgYSB0aW1lXG5cdFx0LSBmcCA2LjAuNjUgb3IgaGlnaGVyXG5cdFx0LSBXaW4vTWFjIE9TIG9ubHlcblx0XHQtIG5vIFdlYmtpdCBlbmdpbmVzIG9sZGVyIHRoYW4gdmVyc2lvbiAzMTJcblx0Ki9cblx0ZnVuY3Rpb24gY2FuRXhwcmVzc0luc3RhbGwoKSB7XG5cdFx0cmV0dXJuICFpc0V4cHJlc3NJbnN0YWxsQWN0aXZlICYmIGhhc1BsYXllclZlcnNpb24oXCI2LjAuNjVcIikgJiYgKHVhLndpbiB8fCB1YS5tYWMpICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpO1xuXHR9XG5cdC8qIFNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2dcblx0XHQtIFJlZmVyZW5jZTogaHR0cDovL3d3dy5hZG9iZS5jb20vY2Z1c2lvbi9rbm93bGVkZ2ViYXNlL2luZGV4LmNmbT9pZD02YTI1M2I3NVxuXHQqL1xuXHRmdW5jdGlvbiBzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gdHJ1ZTtcblx0XHRzdG9yZWRDYWxsYmFja0ZuID0gY2FsbGJhY2tGbiB8fCBudWxsO1xuXHRcdHN0b3JlZENhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRpZiAob2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHsgLy8gc3RhdGljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IGFic3RyYWN0QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIGR5bmFtaWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gb2JqO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSByZXBsYWNlRWxlbUlkU3RyO1xuXHRcdFx0fVxuXHRcdFx0YXR0LmlkID0gRVhQUkVTU19JTlNUQUxMX0lEO1xuXHRcdFx0aWYgKHR5cGVvZiBhdHQud2lkdGggPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LndpZHRoKSAmJiBwYXJzZUludChhdHQud2lkdGgsIDEwKSA8IDMxMCkpIHsgYXR0LndpZHRoID0gXCIzMTBcIjsgfVxuXHRcdFx0aWYgKHR5cGVvZiBhdHQuaGVpZ2h0ID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC5oZWlnaHQpICYmIHBhcnNlSW50KGF0dC5oZWlnaHQsIDEwKSA8IDEzNykpIHsgYXR0LmhlaWdodCA9IFwiMTM3XCI7IH1cblx0XHRcdGRvYy50aXRsZSA9IGRvYy50aXRsZS5zbGljZSgwLCA0NykgKyBcIiAtIEZsYXNoIFBsYXllciBJbnN0YWxsYXRpb25cIjtcblx0XHRcdHZhciBwdCA9IHVhLmllICYmIHVhLndpbiA/IFwiQWN0aXZlWFwiIDogXCJQbHVnSW5cIixcblx0XHRcdFx0ZnYgPSBcIk1NcmVkaXJlY3RVUkw9XCIgKyB3aW4ubG9jYXRpb24udG9TdHJpbmcoKS5yZXBsYWNlKC8mL2csXCIlMjZcIikgKyBcIiZNTXBsYXllclR5cGU9XCIgKyBwdCArIFwiJk1NZG9jdGl0bGU9XCIgKyBkb2MudGl0bGU7XG5cdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGZ2O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBmdjtcblx0XHRcdH1cblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHRcdHZhciBuZXdPYmogPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0XHRyZXBsYWNlRWxlbUlkU3RyICs9IFwiU1dGT2JqZWN0TmV3XCI7XG5cdFx0XHRcdG5ld09iai5zZXRBdHRyaWJ1dGUoXCJpZFwiLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld09iaiwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG9iamVjdCBlbGVtZW50IHRoYXQgbG9hZHMgZXhwcmVzc2luc3RhbGwuc3dmXG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBhYnN0cmFjdCBhbmQgZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGRpc3BsYXlBbHRDb250ZW50KG9iaikge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIGVsKTtcblx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgb2JqKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWJzdHJhY3RBbHRDb250ZW50KG9iaikge1xuXHRcdHZhciBhYyA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0aWYgKHVhLndpbiAmJiB1YS5pZSkge1xuXHRcdFx0YWMuaW5uZXJIVE1MID0gb2JqLmlubmVySFRNTDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgbmVzdGVkT2JqID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRpZiAobmVzdGVkT2JqKSB7XG5cdFx0XHRcdHZhciBjID0gbmVzdGVkT2JqLmNoaWxkTm9kZXM7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0dmFyIGNsID0gYy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjbDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShjW2ldLm5vZGVUeXBlID09IDEgJiYgY1tpXS5ub2RlTmFtZSA9PSBcIlBBUkFNXCIpICYmICEoY1tpXS5ub2RlVHlwZSA9PSA4KSkge1xuXHRcdFx0XHRcdFx0XHRhYy5hcHBlbmRDaGlsZChjW2ldLmNsb25lTm9kZSh0cnVlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBhYztcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgU1dGIGNyZWF0aW9uXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgaWQpIHtcblx0XHR2YXIgciwgZWwgPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKHVhLndrICYmIHVhLndrIDwgMzEyKSB7IHJldHVybiByOyB9XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRpZiAodHlwZW9mIGF0dE9iai5pZCA9PSBVTkRFRikgeyAvLyBpZiBubyAnaWQnIGlzIGRlZmluZWQgZm9yIHRoZSBvYmplY3QgZWxlbWVudCwgaXQgd2lsbCBpbmhlcml0IHRoZSAnaWQnIGZyb20gdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0YXR0T2JqLmlkID0gaWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IC8vIEludGVybmV0IEV4cGxvcmVyICsgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgKyBXM0MgRE9NIG1ldGhvZHMgZG8gbm90IGNvbWJpbmU6IGZhbGwgYmFjayB0byBvdXRlckhUTUxcblx0XHRcdFx0dmFyIGF0dCA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialtpXSAhPSBPYmplY3QucHJvdG90eXBlW2ldKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJkYXRhXCIpIHtcblx0XHRcdFx0XHRcdFx0cGFyT2JqLm1vdmllID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyBjbGFzcz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7XG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnICcgKyBpICsgJz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFyID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW2pdICE9IE9iamVjdC5wcm90b3R5cGVbal0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0cGFyICs9ICc8cGFyYW0gbmFtZT1cIicgKyBqICsgJ1wiIHZhbHVlPVwiJyArIHBhck9ialtqXSArICdcIiAvPic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIicgKyBhdHQgKyAnPicgKyBwYXIgKyAnPC9vYmplY3Q+Jztcblx0XHRcdFx0b2JqSWRBcnJbb2JqSWRBcnIubGVuZ3RoXSA9IGF0dE9iai5pZDsgLy8gc3RvcmVkIHRvIGZpeCBvYmplY3QgJ2xlYWtzJyBvbiB1bmxvYWQgKGR5bmFtaWMgcHVibGlzaGluZyBvbmx5KVxuXHRcdFx0XHRyID0gZ2V0RWxlbWVudEJ5SWQoYXR0T2JqLmlkKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyB3ZWxsLWJlaGF2aW5nIGJyb3dzZXJzXG5cdFx0XHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHRcdFx0Zm9yICh2YXIgbSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW21dICE9IE9iamVjdC5wcm90b3R5cGVbbV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKG0udG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAobS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7IC8vIGZpbHRlciBvdXQgSUUgc3BlY2lmaWMgYXR0cmlidXRlXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKG0sIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAodmFyIG4gaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtuXSAhPSBPYmplY3QucHJvdG90eXBlW25dICYmIG4udG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllcyBhbmQgSUUgc3BlY2lmaWMgcGFyYW0gZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3JlYXRlT2JqUGFyYW0obywgbiwgcGFyT2JqW25dKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobywgZWwpO1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlT2JqUGFyYW0oZWwsIHBOYW1lLCBwVmFsdWUpIHtcblx0XHR2YXIgcCA9IGNyZWF0ZUVsZW1lbnQoXCJwYXJhbVwiKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgcE5hbWUpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcFZhbHVlKTtcblx0XHRlbC5hcHBlbmRDaGlsZChwKTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIFNXRiByZW1vdmFsXG5cdFx0LSBFc3BlY2lhbGx5IG5lZWRlZCB0byBzYWZlbHkgYW5kIGNvbXBsZXRlbHkgcmVtb3ZlIGEgU1dGIGluIEludGVybmV0IEV4cGxvcmVyXG5cdCovXG5cdGZ1bmN0aW9uIHJlbW92ZVNXRihpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaiAmJiBvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0cmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZU9iamVjdEluSUUoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb2JqW2ldID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdG9ialtpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBvcHRpbWl6ZSBKYXZhU2NyaXB0IGNvbXByZXNzaW9uXG5cdCovXG5cdGZ1bmN0aW9uIGdldEVsZW1lbnRCeUlkKGlkKSB7XG5cdFx0dmFyIGVsID0gbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0ZWwgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge31cblx0XHRyZXR1cm4gZWw7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRWxlbWVudChlbCkge1xuXHRcdHJldHVybiBkb2MuY3JlYXRlRWxlbWVudChlbCk7XG5cdH1cblx0LyogVXBkYXRlZCBhdHRhY2hFdmVudCBmdW5jdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHQtIFN0b3JlcyBhdHRhY2hFdmVudCBpbmZvcm1hdGlvbiBpbiBhbiBBcnJheSwgc28gb24gdW5sb2FkIHRoZSBkZXRhY2hFdmVudCBmdW5jdGlvbnMgY2FuIGJlIGNhbGxlZCB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0Ki9cblx0ZnVuY3Rpb24gYWRkTGlzdGVuZXIodGFyZ2V0LCBldmVudFR5cGUsIGZuKSB7XG5cdFx0dGFyZ2V0LmF0dGFjaEV2ZW50KGV2ZW50VHlwZSwgZm4pO1xuXHRcdGxpc3RlbmVyc0FycltsaXN0ZW5lcnNBcnIubGVuZ3RoXSA9IFt0YXJnZXQsIGV2ZW50VHlwZSwgZm5dO1xuXHR9XG5cdC8qIEZsYXNoIFBsYXllciBhbmQgU1dGIGNvbnRlbnQgdmVyc2lvbiBtYXRjaGluZ1xuXHQqL1xuXHRmdW5jdGlvbiBoYXNQbGF5ZXJWZXJzaW9uKHJ2KSB7XG5cdFx0dmFyIHB2ID0gdWEucHYsIHYgPSBydi5zcGxpdChcIi5cIik7XG5cdFx0dlswXSA9IHBhcnNlSW50KHZbMF0sIDEwKTtcblx0XHR2WzFdID0gcGFyc2VJbnQodlsxXSwgMTApIHx8IDA7IC8vIHN1cHBvcnRzIHNob3J0IG5vdGF0aW9uLCBlLmcuIFwiOVwiIGluc3RlYWQgb2YgXCI5LjAuMFwiXG5cdFx0dlsyXSA9IHBhcnNlSW50KHZbMl0sIDEwKSB8fCAwO1xuXHRcdHJldHVybiAocHZbMF0gPiB2WzBdIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID4gdlsxXSkgfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPT0gdlsxXSAmJiBwdlsyXSA+PSB2WzJdKSkgPyB0cnVlIDogZmFsc2U7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIENTUyBjcmVhdGlvblxuXHRcdC0gQmFzZWQgb24gQm9iYnkgdmFuIGRlciBTbHVpcycgc29sdXRpb246IGh0dHA6Ly93d3cuYm9iYnl2YW5kZXJzbHVpcy5jb20vYXJ0aWNsZXMvZHluYW1pY0NTUy5waHBcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlQ1NTKHNlbCwgZGVjbCwgbWVkaWEsIG5ld1N0eWxlKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLm1hYykgeyByZXR1cm47IH1cblx0XHR2YXIgaCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XG5cdFx0aWYgKCFoKSB7IHJldHVybjsgfSAvLyB0byBhbHNvIHN1cHBvcnQgYmFkbHkgYXV0aG9yZWQgSFRNTCBwYWdlcyB0aGF0IGxhY2sgYSBoZWFkIGVsZW1lbnRcblx0XHR2YXIgbSA9IChtZWRpYSAmJiB0eXBlb2YgbWVkaWEgPT0gXCJzdHJpbmdcIikgPyBtZWRpYSA6IFwic2NyZWVuXCI7XG5cdFx0aWYgKG5ld1N0eWxlKSB7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IG51bGw7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFkeW5hbWljU3R5bGVzaGVldCB8fCBkeW5hbWljU3R5bGVzaGVldE1lZGlhICE9IG0pIHtcblx0XHRcdC8vIGNyZWF0ZSBkeW5hbWljIHN0eWxlc2hlZXQgKyBnZXQgYSBnbG9iYWwgcmVmZXJlbmNlIHRvIGl0XG5cdFx0XHR2YXIgcyA9IGNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvY3NzXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJtZWRpYVwiLCBtKTtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gaC5hcHBlbmRDaGlsZChzKTtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgdHlwZW9mIGRvYy5zdHlsZVNoZWV0cyAhPSBVTkRFRiAmJiBkb2Muc3R5bGVTaGVldHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGRvYy5zdHlsZVNoZWV0c1tkb2Muc3R5bGVTaGVldHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbTtcblx0XHR9XG5cdFx0Ly8gYWRkIHN0eWxlIHJ1bGVcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUgPT0gT0JKRUNUKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUoc2VsLCBkZWNsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGRvYy5jcmVhdGVUZXh0Tm9kZSAhPSBVTkRFRikge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlVGV4dE5vZGUoc2VsICsgXCIge1wiICsgZGVjbCArIFwifVwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldFZpc2liaWxpdHkoaWQsIGlzVmlzaWJsZSkge1xuXHRcdGlmICghYXV0b0hpZGVTaG93KSB7IHJldHVybjsgfVxuXHRcdHZhciB2ID0gaXNWaXNpYmxlID8gXCJ2aXNpYmxlXCIgOiBcImhpZGRlblwiO1xuXHRcdGlmIChpc0RvbUxvYWRlZCAmJiBnZXRFbGVtZW50QnlJZChpZCkpIHtcblx0XHRcdGdldEVsZW1lbnRCeUlkKGlkKS5zdHlsZS52aXNpYmlsaXR5ID0gdjtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVDU1MoXCIjXCIgKyBpZCwgXCJ2aXNpYmlsaXR5OlwiICsgdik7XG5cdFx0fVxuXHR9XG5cdC8qIEZpbHRlciB0byBhdm9pZCBYU1MgYXR0YWNrc1xuXHQqL1xuXHRmdW5jdGlvbiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShzKSB7XG5cdFx0dmFyIHJlZ2V4ID0gL1tcXFxcXFxcIjw+XFwuO10vO1xuXHRcdHZhciBoYXNCYWRDaGFycyA9IHJlZ2V4LmV4ZWMocykgIT0gbnVsbDtcblx0XHRyZXR1cm4gaGFzQmFkQ2hhcnMgJiYgdHlwZW9mIGVuY29kZVVSSUNvbXBvbmVudCAhPSBVTkRFRiA/IGVuY29kZVVSSUNvbXBvbmVudChzKSA6IHM7XG5cdH1cblx0LyogUmVsZWFzZSBtZW1vcnkgdG8gYXZvaWQgbWVtb3J5IGxlYWtzIGNhdXNlZCBieSBjbG9zdXJlcywgZml4IGhhbmdpbmcgYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzL05ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3QgKEludGVybmV0IEV4cGxvcmVyIG9ubHkpXG5cdCovXG5cdHZhciBjbGVhbnVwID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0d2luZG93LmF0dGFjaEV2ZW50KFwib251bmxvYWRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBsaXN0ZW5lcnMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdHZhciBsbCA9IGxpc3RlbmVyc0Fyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGw7IGkrKykge1xuXHRcdFx0XHRcdGxpc3RlbmVyc0FycltpXVswXS5kZXRhY2hFdmVudChsaXN0ZW5lcnNBcnJbaV1bMV0sIGxpc3RlbmVyc0FycltpXVsyXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBkeW5hbWljYWxseSBlbWJlZGRlZCBvYmplY3RzIHRvIGZpeCBhdWRpby92aWRlbyB0aHJlYWRzIGFuZCBmb3JjZSBvcGVuIHNvY2tldHMgYW5kIE5ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3Rcblx0XHRcdFx0dmFyIGlsID0gb2JqSWRBcnIubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGlsOyBqKyspIHtcblx0XHRcdFx0XHRyZW1vdmVTV0Yob2JqSWRBcnJbal0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGNsZWFudXAgbGlicmFyeSdzIG1haW4gY2xvc3VyZXMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdGZvciAodmFyIGsgaW4gdWEpIHtcblx0XHRcdFx0XHR1YVtrXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dWEgPSBudWxsO1xuXHRcdFx0XHRmb3IgKHZhciBsIGluIHN3Zm9iamVjdCkge1xuXHRcdFx0XHRcdHN3Zm9iamVjdFtsXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3dmb2JqZWN0ID0gbnVsbDtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSgpO1xuXHRyZXR1cm4ge1xuXHRcdC8qIFB1YmxpYyBBUElcblx0XHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvZG9jdW1lbnRhdGlvblxuXHRcdCovXG5cdFx0cmVnaXN0ZXJPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdElkU3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIG9iamVjdElkU3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0dmFyIHJlZ09iaiA9IHt9O1xuXHRcdFx0XHRyZWdPYmouaWQgPSBvYmplY3RJZFN0cjtcblx0XHRcdFx0cmVnT2JqLnN3ZlZlcnNpb24gPSBzd2ZWZXJzaW9uU3RyO1xuXHRcdFx0XHRyZWdPYmouZXhwcmVzc0luc3RhbGwgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0cmVnT2JqLmNhbGxiYWNrRm4gPSBjYWxsYmFja0ZuO1xuXHRcdFx0XHRyZWdPYmpBcnJbcmVnT2JqQXJyLmxlbmd0aF0gPSByZWdPYmo7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkob2JqZWN0SWRTdHIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHtcblx0XHRcdFx0Y2FsbGJhY2tGbih7c3VjY2VzczpmYWxzZSwgaWQ6b2JqZWN0SWRTdHJ9KTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGdldE9iamVjdEJ5SWQ6IGZ1bmN0aW9uKG9iamVjdElkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcblx0XHRcdHZhciBjYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHRcdGlmICh1YS53MyAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSAmJiBzd2ZVcmxTdHIgJiYgcmVwbGFjZUVsZW1JZFN0ciAmJiB3aWR0aFN0ciAmJiBoZWlnaHRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIGZhbHNlKTtcblx0XHRcdFx0YWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdpZHRoU3RyICs9IFwiXCI7IC8vIGF1dG8tY29udmVydCB0byBzdHJpbmdcblx0XHRcdFx0XHRoZWlnaHRTdHIgKz0gXCJcIjtcblx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0aWYgKGF0dE9iaiAmJiB0eXBlb2YgYXR0T2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBhdHRPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0YXR0W2ldID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHQuZGF0YSA9IHN3ZlVybFN0cjtcblx0XHRcdFx0XHRhdHQud2lkdGggPSB3aWR0aFN0cjtcblx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gaGVpZ2h0U3RyO1xuXHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRpZiAocGFyT2JqICYmIHR5cGVvZiBwYXJPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIHBhck9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRwYXJbal0gPSBwYXJPYmpbal07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmbGFzaHZhcnNPYmogJiYgdHlwZW9mIGZsYXNodmFyc09iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrIGluIGZsYXNodmFyc09iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgZmxhc2h2YXJzT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihzd2ZWZXJzaW9uU3RyKSkgeyAvLyBjcmVhdGUgU1dGXG5cdFx0XHRcdFx0XHR2YXIgb2JqID0gY3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0XHRcdGlmIChhdHQuaWQgPT0gcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5yZWYgPSBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhpU3dmVXJsU3RyICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHRcdFx0XHRcdGF0dC5kYXRhID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHsgLy8gc2hvdyBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7XHR9XG5cdFx0fSxcblx0XHRzd2l0Y2hPZmZBdXRvSGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuXHRcdFx0YXV0b0hpZGVTaG93ID0gZmFsc2U7XG5cdFx0fSxcblx0XHR1YTogdWEsXG5cdFx0Z2V0Rmxhc2hQbGF5ZXJWZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7IG1ham9yOnVhLnB2WzBdLCBtaW5vcjp1YS5wdlsxXSwgcmVsZWFzZTp1YS5wdlsyXSB9O1xuXHRcdH0sXG5cdFx0aGFzRmxhc2hQbGF5ZXJWZXJzaW9uOiBoYXNQbGF5ZXJWZXJzaW9uLFxuXHRcdGNyZWF0ZVNXRjogZnVuY3Rpb24oYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2hvd0V4cHJlc3NJbnN0YWxsOiBmdW5jdGlvbihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHtcblx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlbW92ZVNXRjogZnVuY3Rpb24ob2JqRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmVtb3ZlU1dGKG9iakVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjcmVhdGVDU1M6IGZ1bmN0aW9uKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdGNyZWF0ZUNTUyhzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWRkRG9tTG9hZEV2ZW50OiBhZGREb21Mb2FkRXZlbnQsXG5cdFx0YWRkTG9hZEV2ZW50OiBhZGRMb2FkRXZlbnQsXG5cdFx0Z2V0UXVlcnlQYXJhbVZhbHVlOiBmdW5jdGlvbihwYXJhbSkge1xuXHRcdFx0dmFyIHEgPSBkb2MubG9jYXRpb24uc2VhcmNoIHx8IGRvYy5sb2NhdGlvbi5oYXNoO1xuXHRcdFx0aWYgKHEpIHtcblx0XHRcdFx0aWYgKC9cXD8vLnRlc3QocSkpIHsgcSA9IHEuc3BsaXQoXCI/XCIpWzFdOyB9IC8vIHN0cmlwIHF1ZXN0aW9uIG1hcmtcblx0XHRcdFx0aWYgKHBhcmFtID09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhaXJzID0gcS5zcGxpdChcIiZcIik7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocGFpcnNbaV0uc3Vic3RyaW5nKDAsIHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpKSA9PSBwYXJhbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHBhaXJzW2ldLnN1YnN0cmluZygocGFpcnNbaV0uaW5kZXhPZihcIj1cIikgKyAxKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fSxcblx0XHQvLyBGb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRcdGV4cHJlc3NJbnN0YWxsQ2FsbGJhY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGlzRXhwcmVzc0luc3RhbGxBY3RpdmUpIHtcblx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKEVYUFJFU1NfSU5TVEFMTF9JRCk7XG5cdFx0XHRcdGlmIChvYmogJiYgc3RvcmVkQWx0Q29udGVudCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdG9yZWRBbHRDb250ZW50LCBvYmopO1xuXHRcdFx0XHRcdGlmIChzdG9yZWRBbHRDb250ZW50SWQpIHtcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoc3RvcmVkQWx0Q29udGVudElkLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgc3RvcmVkQWx0Q29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiOyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9yZWRDYWxsYmFja0ZuKSB7IHN0b3JlZENhbGxiYWNrRm4oc3RvcmVkQ2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0oKTtcbm1vZHVsZS5leHBvcnRzID0gc3dmb2JqZWN0O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQHJldHVybnMge09yaWdpbmFsQ2xhc3N9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY2xlYXJJbnN0YW5jZSA9IGZ1bmN0aW9uKE9yaWdpbmFsQ2xhc3MpIHtcbiAgICB2YXIgQ2xlYXJDbGFzcyA9IGZ1bmN0aW9uKCl7fTtcbiAgICBDbGVhckNsYXNzLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuICAgIHJldHVybiBuZXcgQ2xlYXJDbGFzcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGVhckluc3RhbmNlO1xuIiwidmFyIGNsZWFySW5zdGFuY2UgPSByZXF1aXJlKCcuL2NsZWFyLWluc3RhbmNlJyk7XG5cbi8qKlxuICogQ2xhc3NpYyBFcnJvciBhY3RzIGxpa2UgYSBmYWJyaWM6IEVycm9yLmNhbGwodGhpcywgbWVzc2FnZSkganVzdCBjcmVhdGUgbmV3IG9iamVjdC5cbiAqIEVycm9yQ2xhc3MgYWN0cyBtb3JlIGxpa2UgYSBjbGFzczogRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpIG1vZGlmeSAndGhpcycgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIGVycm9yIG1lc3NhZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBbaWRdIC0gZXJyb3IgaWRcbiAqIEBleHRlbmRzIEVycm9yXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcnJvckNsYXNzID0gZnVuY3Rpb24obWVzc2FnZSwgaWQpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UsIGlkKTtcbiAgICBlcnIubmFtZSA9IHRoaXMubmFtZTtcblxuICAgIHRoaXMubWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIHRoaXMuc3RhY2sgPSBlcnIuc3RhY2s7XG59O1xuXG4vKipcbiAqIFN1Z2FyLiBKdXN0IGNyZWF0ZSBpbmhlcml0YW5jZSBmcm9tIEVycm9yQ2xhc3MgYW5kIGRlZmluZSBuYW1lIHByb3BlcnR5XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIG5hbWUgb2YgZXJyb3IgdHlwZVxuICogQHJldHVybnMge0Vycm9yQ2xhc3N9XG4gKi9cbkVycm9yQ2xhc3MuY3JlYXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBlcnJDbGFzcyA9IGNsZWFySW5zdGFuY2UoRXJyb3JDbGFzcyk7XG4gICAgZXJyQ2xhc3MubmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIGVyckNsYXNzO1xufTtcblxuRXJyb3JDbGFzcy5wcm90b3R5cGUgPSBjbGVhckluc3RhbmNlKEVycm9yKTtcbkVycm9yQ2xhc3MucHJvdG90eXBlLm5hbWUgPSBcIkVycm9yQ2xhc3NcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcnJvckNsYXNzO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2FzeW5jL2V2ZW50cycpO1xuXG4vKipcbiAqIEBjbGFzcyDQn9GA0L7QutGB0Lgt0LrQu9Cw0YHRgS4g0JLRi9C00LDRkdGCINC90LDRgNGD0LbRgyDQu9C40YjRjCDQv9GD0LHQu9C40YfQvdGL0LUg0LzQtdGC0L7QtNGLINC+0LHRitC10LrRgtCwINC4INGB0YLQsNGC0LjRh9C10YHQutC40LUg0YHQstC+0LnRgdGC0LLQsC5cbiAqINCd0LUg0LrQvtC/0LjRgNGD0LXRgiDQvNC10YLQvtC00Ysg0LjQtyBPYmplY3QucHJvdG90eXBlLiDQktGB0LUg0LzQtdGC0L7QtNGLINC40LzQtdGO0YIg0L/RgNC40LLRj9C30LrRgyDQutC+0L3RgtC10LrRgdGC0LAg0Log0L/RgNC+0LrRgdC40YDRg9C10LzQvtC80YMg0L7QsdGK0LXQutGC0YMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIC0g0L7QsdGK0LXQutGCLCDQutC+0YLQvtGA0YvQuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/RgNC+0LrRgdC40YDQvtCy0LDRgtGMXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBQcm94eSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgICAgICB8fCB0eXBlb2Ygb2JqZWN0W2tleV0gIT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgIHx8IG9iamVjdFtrZXldID09PSBPYmplY3QucHJvdG90eXBlW2tleV1cbiAgICAgICAgICAgICAgICB8fCBvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgICAgIHx8IEV2ZW50cy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzW2tleV0gPSBvYmplY3Rba2V5XS5iaW5kKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2JqZWN0LnBpcGVFdmVudHMpIHtcbiAgICAgICAgICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLm9uID0gRXZlbnRzLnByb3RvdHlwZS5vbjtcbiAgICAgICAgICAgIHRoaXMub25jZSA9IEV2ZW50cy5wcm90b3R5cGUub25jZTtcbiAgICAgICAgICAgIHRoaXMub2ZmID0gRXZlbnRzLnByb3RvdHlwZS5vZmY7XG4gICAgICAgICAgICB0aGlzLmNsZWFyTGlzdGVuZXJzID0gRXZlbnRzLnByb3RvdHlwZS5jbGVhckxpc3RlbmVycztcblxuICAgICAgICAgICAgb2JqZWN0LnBpcGVFdmVudHModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCt0LrRgdC/0L7RgNGC0LjRgNGD0LXRgiDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAg0LjQtyDQvtC00L3QvtCz0L4g0L7QsdGK0LXQutGC0LAg0LIg0LTRgNGD0LPQvtC5LCDQuNGB0LrQu9GO0YfQsNGPINGD0LrQsNC30LDQvdC90YvQtSwg0L/RgNC40LLQsNGC0L3Ri9C1INC4INC/0YDQvtGC0L7RgtC40L9cbiAqIEBwYXJhbSB7T2JqZWN0fSBmcm9tIC0g0L7RgtC60YPQtNCwINC60L7Qv9C40YDQvtCy0LDRgtGMXG4gKiBAcGFyYW0ge09iamVjdH0gdG8gLSDQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gW2V4Y2x1ZGVdIC0g0YHQstC+0LnRgdGC0LLQsCDQutC+0YLQvtGA0YvQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjRgdC60LvRjtGH0LjRgtGMXG4gKi9cblByb3h5LmV4cG9ydFN0YXRpYyA9IGZ1bmN0aW9uKGZyb20sIHRvLCBleGNsdWRlKSB7XG4gICAgZXhjbHVkZSA9IGV4Y2x1ZGUgfHwgW107XG5cbiAgICBPYmplY3Qua2V5cyhmcm9tKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBpZiAoIWZyb20uaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgfHwga2V5WzBdID09PSBcIl9cIlxuICAgICAgICAgICAgfHwga2V5ID09PSBcInByb3RvdHlwZVwiXG4gICAgICAgICAgICB8fCBleGNsdWRlLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L/RgNC+0LrRgdC4LdC/0LvQsNGB0YHQsCDQv9GA0LjQstGP0LfQsNC90L3QvtCz0L4g0Log0YPQutCw0LfQsNC90L3QvtC80YMg0LrQu9Cw0YHRgdGDLiDQnNC+0LbQvdC+INC90LDQt9C90LDRh9C40YLRjCDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgS5cbiAqINCjINGA0L7QtNC40YLQtdC70YzRgdC60L7Qs9C+INC60LvQsNGB0YHQsCDQv9C+0Y/QstC70Y/QtdGC0YHRjyDQv9GA0LjQstCw0YLQvdGL0Lkg0LzQtdGC0L7QtCBfcHJveHksINC60L7RgtC+0YDRi9C5INCy0YvQtNCw0ZHRgiDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCINC00LvRj1xuICog0LTQsNC90L3QvtCz0L4g0Y3QutC30LXQvNC70Y/RgNCwLiDQotCw0LrQttC1INC/0L7Rj9Cy0LvRj9C10YLRgdGPINGB0LLQvtC50YHRgtCy0L4gX19wcm94eSwg0YHQvtC00LXRgNC20LDRidC10LUg0YHRgdGL0LvQutGDINC90LAg0YHQvtC30LTQsNC90L3Ri9C5INC/0YDQvtC60YHQuC3QvtCx0YrQtdC60YJcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C5INC60LvQsNGB0YFcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFBhcmVudFByb3h5Q2xhc3MgLSDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgVxuICogQHJldHVybnMge2Z1bmN0aW9ufSAtLSDQutC+0L3RgdGC0YDRg9GC0L7RgCDQv9GA0L7QutGB0LjRgNC+0LLQsNC90L3QvtCz0L4g0LrQu9Cw0YHRgdCwXG4gKi9cblByb3h5LmNyZWF0ZUNsYXNzID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcywgUGFyZW50UHJveHlDbGFzcykge1xuXG4gICAgdmFyIFByb3h5Q2xhc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcblxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBuZXcgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yKCk7XG4gICAgICAgIE9yaWdpbmFsQ2xhc3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLl9wcm94eSgpO1xuICAgIH07XG5cbiAgICB2YXIgUGFyZW50UHJveHlDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlID0gKFBhcmVudFByb3h5Q2xhc3MgfHwgUHJveHkpLnByb3RvdHlwZTtcbiAgICBQcm94eUNsYXNzLnByb3RvdHlwZSA9IG5ldyBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IoKTtcblxuICAgIHZhciB2YWw7XG4gICAgZm9yICh2YXIgayBpbiBPcmlnaW5hbENsYXNzLnByb3RvdHlwZSkge1xuICAgICAgICB2YWwgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZVtrXTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGVba10gPT0gdmFsIHx8IHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiB8fCBrWzBdID09PSBcIl9cIikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVba10gPSB2YWw7XG4gICAgfVxuXG4gICAgdmFyIGNyZWF0ZVByb3h5ID0gZnVuY3Rpb24ob3JpZ2luYWwpIHtcbiAgICAgICAgdmFyIHByb3RvID0gUHJveHkucHJvdG90eXBlO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBQcm94eUNsYXNzLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KG9yaWdpbmFsKTtcbiAgICAgICAgUHJveHkucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9O1xuXG4gICAgT3JpZ2luYWxDbGFzcy5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fX3Byb3h5KSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJveHkgPSBjcmVhdGVQcm94eSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fcHJveHk7XG4gICAgfTtcblxuICAgIFByb3h5LmV4cG9ydFN0YXRpYyhPcmlnaW5hbENsYXNzLCBQcm94eUNsYXNzKTtcblxuICAgIHJldHVybiBQcm94eUNsYXNzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm94eTtcbiIsIi8qKlxuICog0KHQutC+0L/QuNGA0L7QstCw0YLRjCDRgdCy0L7QudGB0YLQstCwINCy0YHQtdGFINC/0LXRgNC10YfQuNGB0LvQtdC90L3Ri9GFINC+0LHRitC10LrRgtC+0LIg0LIg0L7QtNC40L0uXG4gKiBAcGFyYW0ge09iamVjdH0gaW5pdGlhbCAtINC10YHQu9C4INC/0L7RgdC70LXQtNC90LjQuSDQsNGA0LPRg9C80LXQvdGCIHRydWUsINGC0L4g0L3QvtCy0YvQuSDQvtCx0YrQtdC60YIg0L3QtSDRgdC+0LfQtNCw0ZHRgtGB0Y8sINCwINC40YHQv9C+0LvRjNC30YPQtdGC0YHRjyDQtNCw0L3QvdGL0LlcbiAqIEBwYXJhbSB7Li4uT2JqZWN0fEJvb2xlYW59IGFyZ3MgLSDRgdC/0LjRgdC+0Log0L7QsdGK0LXQutGC0L7QsiDQuNC3INC60L7RgtC+0YDRi9GFINC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAuINCf0L7RgdC70LXQtNC90LjQuSDQsNGA0LPRg9C80LXQvdGCINC80L7QttC10YIg0LHRi9GC0Ywg0LvQuNCx0L5cbiAqINC+0LHRitC10LrRgtC+0LwsINC70LjQsdC+IHRydWUuXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xudmFyIG1lcmdlID0gZnVuY3Rpb24gKGluaXRpYWwpIHtcbiAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBrZXk7XG5cbiAgICBpZiAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB0cnVlKSB7XG4gICAgICAgIG9iamVjdCA9IGluaXRpYWw7XG4gICAgICAgIGFyZ3MucG9wKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0ID0ge307XG4gICAgICAgIGZvciAoa2V5IGluIGluaXRpYWwpIHtcbiAgICAgICAgICAgIGlmIChpbml0aWFsLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IGluaXRpYWxba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGsgPSAwLCBsID0gYXJncy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgZm9yIChrZXkgaW4gYXJnc1trXSkge1xuICAgICAgICAgICAgaWYgKGFyZ3Nba10uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gYXJnc1trXVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJyZXF1aXJlKCcuLi8uLi8uLi9leHBvcnQnKTtcblxudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi9sb2FkZXItZXJyb3InKTtcblxueWEuQXVkaW8uTG9hZGVyRXJyb3IgPSBMb2FkZXJFcnJvcjtcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vLi4vY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiDQmtC70LDRgdGBINC+0YjQuNCx0L7QuiDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQGFsaWFzIHlhLkF1ZGlvLkxvYWRlckVycm9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgLSDRgtC10LrRgdGCINC+0YjQuNCx0LrQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIExvYWRlckVycm9yID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcbn07XG5Mb2FkZXJFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIkxvYWRlckVycm9yXCIpO1xuXG4vKipcbiAqINCi0LDQudC80LDRg9GCINC30LDQs9GA0YPQt9C60LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuTG9hZGVyRXJyb3IuVElNRU9VVCA9IFwicmVxdWVzdCB0aW1lb3V0XCI7XG4vKipcbiAqINCe0YjQuNCx0LrQsCDQt9Cw0L/RgNC+0YHQsCDQvdCwINC30LDQs9GA0YPQt9C60YNcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuTG9hZGVyRXJyb3IuRkFJTEVEID0gXCJyZXF1ZXN0IGZhaWxlZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvYWRlckVycm9yO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHt9O1xuIiwicmVxdWlyZShcIi4uL2V4cG9ydFwiKTtcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5cbnlhLkF1ZGlvLkxvZ2dlciA9IExvZ2dlcjtcbiIsInZhciBMRVZFTFMgPSBbXCJkZWJ1Z1wiLCBcImxvZ1wiLCBcImluZm9cIiwgXCJ3YXJuXCIsIFwiZXJyb3JcIiwgXCJ0cmFjZVwiXTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbGliL25vb3AnKTtcblxuLyoqXG4gKiDQndCw0YHRgtGA0LDQuNCy0LDQtdC80YvQtSDQu9C+0LPQs9C10YAg0LTQu9GPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAYWxpYXMgeWEuQXVkaW8uTG9nZ2VyXG4gKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbCAtINC40LzRjyDQutCw0L3QsNC70LAsINC30LAg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtGC0LLQtdGH0LDRgtGMINGN0LrQt9C10LzQu9GP0YAg0LvQvtCz0LPQtdGA0LBcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG59O1xuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQuNCz0L3QvtGA0LjRgNGD0LXQvNGL0YUg0LrQsNC90LDQu9C+0LJcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmlnbm9yZXMgPSBbXTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINCyINC60L7QvdGB0L7Qu9C4INGD0YDQvtCy0L3QtdC5INC70L7Qs9CwXG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKi9cbkxvZ2dlci5sb2dMZXZlbHMgPSBbXTtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZGVidWcqKlxuICogQG1ldGhvZCB5YS5BdWRpby5Mb2dnZXIjZGVidWdcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5kZWJ1ZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmxvZyoqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciNsb2dcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5sb2cgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKippbmZvKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI2luZm9cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5pbmZvID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqd2FybioqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciN3YXJuXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUud2FybiA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmVycm9yKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI2Vycm9yXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuZXJyb3IgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip0cmFjZSoqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciN0cmFjZVxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLnRyYWNlID0gbm9vcDtcblxuLyoqXG4gKiDQodC00LXQu9Cw0YLRjCDQt9Cw0L/QuNGB0Ywg0LIg0LvQvtCzXG4gKiBAcGFyYW0ge1N0cmluZ30gbGV2ZWwgLSDRg9GA0L7QstC10L3RjCDQu9C+0LPQsFxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwgLSDQutCw0L3QsNC7XG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5sb2cgPSBmdW5jdGlvbihsZXZlbCwgY2hhbm5lbCwgY29udGV4dCkge1xuICAgIHZhciBkYXRhID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpLm1hcChmdW5jdGlvbihkdW1wSXRlbSkge1xuICAgICAgICByZXR1cm4gZHVtcEl0ZW0gJiYgZHVtcEl0ZW0uX2xvZ2dlciAmJiBkdW1wSXRlbS5fbG9nZ2VyKCkgfHwgZHVtcEl0ZW07XG4gICAgfSk7XG5cbiAgICB2YXIgbG9nRW50cnkgPSB7XG4gICAgICAgIHRpbWVzdGFtcDogK25ldyBEYXRlKCksXG4gICAgICAgIGxldmVsOiBsZXZlbCxcbiAgICAgICAgY2hhbm5lbDogY2hhbm5lbCxcbiAgICAgICAgY29udGV4dDogY29udGV4dCxcbiAgICAgICAgbWVzc2FnZTogZGF0YVxuICAgIH07XG5cbiAgICBpZiAoTG9nZ2VyLmlnbm9yZXNbY2hhbm5lbF0gfHwgTG9nZ2VyLmxvZ0xldmVscy5pbmRleE9mKGxldmVsKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIExvZ2dlci5fZHVtcEVudHJ5KGxvZ0VudHJ5KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7Qs9C1XG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5BdWRpby5Mb2dnZXJ+TG9nRW50cnlcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gdGltZXN0YW1wIC0g0LLRgNC10LzRjyDQsiB0aW1lc3RhbXAg0YTQvtGA0LzQsNGC0LVcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBsZXZlbCAtINGD0YDQvtCy0LXQvdGMINC70L7Qs9CwXG4gKiBAcHJvcGVydHkge1N0cmluZ30gY2hhbm5lbCAtINC60LDQvdCw0LtcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IG1lc3NhZ2UgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICpcbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiDQl9Cw0L/QuNGB0LDRgtGMINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsCDQsiDQutC+0L3RgdC+0LvRjFxuICogQHBhcmFtIHt5YS5BdWRpby5Mb2dnZXJ+TG9nRW50cnl9IGxvZ0VudHJ5IC0g0YHQvtC+0LHRidC10L3QuNC1INC70L7Qs9CwXG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2R1bXBFbnRyeSA9IGZ1bmN0aW9uKGxvZ0VudHJ5KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIGxldmVsID0gbG9nRW50cnkubGV2ZWw7XG5cbiAgICAgICAgdmFyIG5hbWUgPSBsb2dFbnRyeS5jb250ZXh0ICYmIChsb2dFbnRyeS5jb250ZXh0LnRhc2tOYW1lIHx8IGxvZ0VudHJ5LmNvbnRleHQubmFtZSk7XG4gICAgICAgIHZhciBjb250ZXh0ID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC5fbG9nZ2VyID8gbG9nRW50cnkuY29udGV4dC5fbG9nZ2VyKCkgOiBcIlwiKTtcblxuICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGVbbGV2ZWxdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBsZXZlbC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIExvZ2dlci5fZm9ybWF0VGltZXN0YW1wKGxvZ0VudHJ5LnRpbWVzdGFtcCksXG4gICAgICAgICAgICAgICAgXCJbXCIgKyBsb2dFbnRyeS5jaGFubmVsICsgKG5hbWUgPyBcIjpcIiArIG5hbWUgOiBcIlwiKSArIFwiXVwiLFxuICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgIF0uY29uY2F0KGxvZ0VudHJ5Lm1lc3NhZ2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGVbbGV2ZWxdLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICB9XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDRhNC+0YDQvNCw0YLQuNGA0L7QstCw0L3QuNGPINC00LDRgtGLINC00LvRjyDQstGL0LLQvtC00LAg0LIg0LrQvtC90L7RgdC+0LvRjFxuICogQHBhcmFtIHRpbWVzdGFtcFxuICogQHJldHVybnMge3N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZm9ybWF0VGltZXN0YW1wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgIHZhciBtcyA9IGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCk7XG4gICAgbXMgPSBtcyA+IDEwMCA/IG1zIDogbXMgPiAxMCA/IFwiMFwiICsgbXMgOiBcIjAwXCIgKyBtcztcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoKSArIFwiLlwiICsgbXM7XG59O1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iXX0=
