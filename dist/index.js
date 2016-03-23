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
var Promise = require('./lib/async/promise');
var Deferred = require('./lib/async/deferred');
var detect = require('./lib/browser/detect');
var config = require('./config');
var merge = require('./lib/data/merge');
var reject = require('./lib/async/reject');

var AudioError = require('./error/audio-error');
var AudioStatic = require('./audio-static');

var playerId = 1;

// =================================================================

//  Настройка доступных типов реализаций и их приоритета

// =================================================================

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

//INFO: прям в момент инициализации всего модуля нельзя писать в лог - он проглатывает сообщения, т.к. еще нет возможности настроить логгер.
setTimeout(function() {
    logger.info({
        flash: {
            available: audioTypes.flash.available,
            priority: audioTypes.flash.priority
        },
        html5: {
            available: audioTypes.html5.available,
            priority: audioTypes.html5.priority,
            audioContext: !!audioTypes.html5.audioContext
        }
    }, "audioTypes");
}, 0);

// =================================================================

//  JSDOC: вспомогательные классы

// =================================================================

/**
 * Описание временных данных плеера.
 * @typedef {Object} Audio.AudioPlayerTimes
 * @property {Number} duration Длительность трека.
 * @property {Number} loaded Длительность загруженной части.
 * @property {Number} position Позиция воспроизведения.
 * @property {Number} played Длительность воспроизведения.
 */

// =================================================================

//  JSDOC: Общие события плеера

// =================================================================

/**
 * Событие начала воспроизведения.
 * @name Audio#EVENT_PLAY
 * @event
 */
/**
 * Событие завершения воспроизведения.
 * @name Audio#EVENT_ENDED
 * @event
 */
/**
 * Событие изменения громкости.
 * @name Audio#EVENT_VOLUME
 * @event
 * @param {Number} volume Новое значение громкости.
 */
/**
 * Событие краха плеера.
 * @name Audio#EVENT_CRASHED
 * @event
 */
/**
 * Событие смены статуса плеера
 * @name Audio#EVENT_STATE
 * @event
 * @param {String} state Новый статус плеера.
 */
/**
 * Событие переключения активного плеера и прелоадера.
 * @name Audio#EVENT_SWAP
 * @event
 */

// =================================================================

//  JSDOC: события активного плеера

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @name Audio#EVENT_STOP
 * @event
 */

/**
 * Событие паузы воспроизведения.
 * @name Audio#EVENT_PAUSE
 * @event
 */

/**
 * Событие обновления позиции воспроизведения/загруженной части.
 * @name Audio#EVENT_PROGRESS
 * @event
 * @param {Audio.AudioPlayerTimes} times Информация о временных данных трека.
 */

/**
 * Событие начала загрузки трека.
 * @name Audio#EVENT_LOADING
 * @event
 */

/**
 * Событие завершения загрузки трека.
 * @name Audio#EVENT_LOADED
 * @event
 */

/**
 * Событие ошибки воспроизведения.
 * @name Audio#EVENT_ERROR
 * @event
 */

// =================================================================

//  JSDOC: события предзагрузчика

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @name Audio#PRELOADER_EVENT+EVENT_STOP
 * @event
 */

/**
 * Событие обновления позиции загруженной части.
 * @name Audio#PRELOADER_EVENT+EVENT_PROGRESS
 * @event
 * @param {Audio.AudioPlayerTimes} times Информация о временных данных трека.
 */

/**
 * Событие начала загрузки трека.
 * @event
 * @name Audio#PRELOADER_EVENT+EVENT_LOADING
 */

/**
 * Событие завершения загрузки трека.
 * @event
 * @name Audio#PRELOADER_EVENT+EVENT_LOADED
 */

/**
 * Событие ошибки воспроизведения.
 * @event
 * @name Audio#PRELOADER_EVENT+EVENT_ERROR
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @class Аудиоплеер для браузера.
 * @name Audio
 * @param {String} [preferredType] Предпочитаемый тип плеера. Может принимать значения: "html5", "flash" или
 * любое ложное значение (false, null, undefined, 0, ""). Если выбранный тип плеера окажется недоступен, будет запущен
 * оставшийся тип. Если указано ложное значение либо параметр не передан, то API автоматически выберет поддерживаемый тип плеера.
 * @param {HTMLElement} [overlay] HTML-контейнер для отображения Flash-апплета.
 * @mixes AudioStatic
 * @extends Events
 * @extends <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>
 * @fires ya.music.Audio#EVENT_PLAY
 * @fires ya.music.Audio#EVENT_ENDED
 * @fires ya.music.Audio#EVENT_VOLUME
 * @fires ya.music.Audio#EVENT_CRASHED
 * @fires ya.music.Audio#EVENT_STATE
 * @fires ya.music.Audio#EVENT_SWAP
 *
 * @fires ya.music.Audio#EVENT_STOP
 * @fires ya.music.Audio#EVENT_PAUSE
 * @fires ya.music.Audio#EVENT_PROGRESS
 * @fires ya.music.Audio#EVENT_LOADING
 * @fires ya.music.Audio#EVENT_LOADED
 * @fires ya.music.Audio#EVENT_ERROR
 *
 * @fires ya.music.Audio#PRELOADER_EVENT+EVENT_STOP
 * @fires ya.music.Audio#PRELOADER_EVENT+EVENT_PROGRESS
 * @fires ya.music.Audio#PRELOADER_EVENT+EVENT_LOADING
 * @fires ya.music.Audio#PRELOADER_EVENT+EVENT_LOADED
 * @fires ya.music.Audio#PRELOADER_EVENT+EVENT_ERROR
 *
 * @constructor
 */
var AudioPlayer = function(preferredType, overlay) {
    this.name = playerId++;
    DEV && logger.debug(this, "constructor");

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

                    case AudioPlayer.EVENT_ENDED:
                    case AudioPlayer.EVENT_SWAP:
                    case AudioPlayer.EVENT_STOP:
                    case AudioPlayer.EVENT_ERROR:
                        logger.info(this, "onEnded", event, data);
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

// =================================================================

//  Статика

// =================================================================

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
 * Контекст для Web Audio API.
 * @type AudioContext
 * @field
 * @name Audio.audioContext
 * @static
 */
AudioPlayer.audioContext = audioTypes.html5.audioContext;

// =================================================================

//  Инициализация

// =================================================================

/**
 * Установить статус плеера.
 * @param {String} state Новый статус.
 * @private
 */
AudioPlayer.prototype._setState = function(state) {
    DEV && logger.debug(this, "_setState", state);

    if (state === AudioPlayer.STATE_PAUSED && this.state !== AudioPlayer.STATE_PLAYING) {
        return;
    }

    var changed = this.state !== state;
    this.state = state;

    if (changed) {
        logger.info(this, "newState", state);
        this.trigger(AudioPlayer.EVENT_STATE, state);
    }
};

/**
 * Инициализация плеера.
 * @param {int} [retry=0] Количество попыток.
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

// =================================================================

//  Обработка событий

// =================================================================

/**
 * Создание обещания, которое разрешается при одном из списка событий
 * @param {String} action - название действия
 * @param {Array.<String>} resolve - список ожидаемых событий для разрешения обещания
 * @param {Array.<String>} reject - список ожидаемый событий для отклонения обещания
 * @returns {Promise} -- также создает Deferred свойство с названием _when<Action>, которое живет до момента разрешения
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
        DEV && logger.debug(this, "_populateEvents", event, offset, data);
    }

    var outerEvent = (offset ? AudioPlayer.PRELOADER_EVENT : "") + event;

    switch (event) {
        case AudioPlayer.EVENT_CRASHED:
        case AudioPlayer.EVENT_SWAP:
            this.trigger(event, data);
            break;
        case AudioPlayer.EVENT_ERROR:
            logger.error(this, "error", outerEvent, data);
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

// =================================================================

//  Общие функции управления плеером

// =================================================================

/*
 INFO: данный метод было решено оставить, т.к. это удобнее чем использовать обещание - есть возможность в начале
 инициализации получить сразу ссылку на экземпляр плеера и обвешать его обработчиками событий. Плюс к тому при
 таком подходе реинициализацию делать проще - при ней не придется переназначать обработчики и обновлять везде ссылку
 на текущий экземпляр плеера.
 */

/**
 * @name Audio#initPromise
 * @function
 * @returns {Promise} обещание, разрешающееся после завершения инициализации.
 */
AudioPlayer.prototype.initPromise = function() {
    return this.whenReady;
};

/**
 * @name Audio#getState
 * @function
 * @returns {String} статус плеера.
 */
AudioPlayer.prototype.getState = function() {
    return this.state;
};

/**
 * @name Audio#getType
 * @function
 * @returns {String|null} тип реализации плеера.
 */
AudioPlayer.prototype.getType = function() {
    return this.implementation && this.implementation.type;
};

/**
 * @name Audio#getSrc
 * @function
 * @param {int} [offset=0] Брать трек из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер.
 * @returns {String|null} ссылку на текущий трек.
 */
AudioPlayer.prototype.getSrc = function(offset) {
    return this.implementation && this.implementation.getSrc(offset);
};

// =================================================================

//  Управление воспроизведением

// =================================================================
/**
 * Запуск воспроизведения.
 * @name Audio#play
 * @function
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность трека. Актуально для Flash-реализации, в ней пока трек грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.play = function(src, duration) {
    logger.info(this, "play", logger._showUrl(src), duration);

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
 * Перезапуск воспроизведения.
 * @name Audio#restart
 * @function
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда трек будет перезапущен.
 */
AudioPlayer.prototype.restart = function() {
    if (!this.getDuration()) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    this._generatePlayId();
    this.setPosition(0);
    this._played = 0;
    this._lastSkip = 0;
    return this.resume();
};

/**
 * Остановка воспроизведения.
 * @name Audio#stop
 * @function
 * @param {int} [offset=0] Активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер.
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда воспроизведение будет остановлено.
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
 * Поставить плеер на паузу.
 * @name Audio#pause
 * @function
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда плеер будет поставлен на паузу.
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
 * Снятие плеера с паузы.
 * @name Audio#resume
 * @function
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда начнется воспроизведение.
 */
AudioPlayer.prototype.resume = function() {
    logger.info(this, "resume");

    if (this.state === AudioPlayer.STATE_PLAYING && !this._whenPause) {
        return Promise.resolve();
    }

    if (!(this.state === AudioPlayer.STATE_IDLE || this.state === AudioPlayer.STATE_PAUSED
        || this.state === AudioPlayer.STATE_PLAYING)) {
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

        promise.abort = function() {
            if (this._whenPlay) {
                this._whenPlay.reject.apply(this._whenPlay, arguments);
                this.stop();
            }
        }.bind(this);
    }

    this.implementation.resume();

    return promise;
};

/**
 * Запуск воспроизведения предзагруженного трека.
 * @name Audio#playPreloaded
 * @function
 * @param {String} [src] Ссылка на трек (для проверки, что в прелоадере нужный трек).
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда начнется воспроизведение предзагруженного трека.
 */
AudioPlayer.prototype.playPreloaded = function(src) {
    logger.info(this, "playPreloaded", logger._showUrl(src));

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

// =================================================================

//  Предзагрузка

// =================================================================

/**
 * Предзагрузка трека.
 * @name Audio#preload
 * @function
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность трека. Актуально для Flash-реализации, в ней пока трек грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise} Promise-объект, который разрешится, когда начнется предзагрузка трека.
 */
AudioPlayer.prototype.preload = function(src, duration) {
    if (detect.browser.name === "msie" && detect.browser.version[0] == "9") {
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    logger.info(this, "preload", logger._showUrl(src), duration);

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
 * Проверка, что трек предзагружен.
 * @name Audio#isPreloading
 * @function
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если трек предварительно загружен, false - иначе.
 */
AudioPlayer.prototype.isPreloaded = function(src) {
    return this.implementation.isPreloaded(src);
};

/**
 * Проверка, что трек предзагружается.
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если трек начал предварительно загружаться, false - иначе.
 */
AudioPlayer.prototype.isPreloading = function(src) {
    return this.implementation.isPreloading(src, 1);
};

// =================================================================

//  Тайминги

// =================================================================

/**
 * Получение позиции воспроизведения.
 * @name Audio#getPosition
 * @function
 * @returns {Number} позиция воспроизведения (в секундах).
 */
AudioPlayer.prototype.getPosition = function() {
    return this.implementation.getPosition() || 0;
};

/**
 * Установка позиции воспроизведения.
 * @name Audio#setPosition
 * @function
 * @param {Number} position Новая позиция воспроизведения (в секундах).
 * @returns {Number} конечная позиция воспроизведения.
 */
AudioPlayer.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);

    if (this.implementation.type == "flash") {
        position = Math.max(0, Math.min(this.getLoaded() - 1, position));
    } else {
        position = Math.max(0, Math.min(this.getDuration() - 1, position));
    }

    this._played += this.getPosition() - this._lastSkip;
    this._lastSkip = position;

    this.implementation.setPosition(position);

    return position;
};

/**
 * @name Audio#getDuration
 * @function
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number} длительность трека (в секундах).
 */
AudioPlayer.prototype.getDuration = function(preloader) {
    return this.implementation.getDuration(preloader ? 1 : 0) || 0;
};

/**
 * @name Audio#getLoaded
 * @function
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number} длительность загруженной части (в секундах).
 */
AudioPlayer.prototype.getLoaded = function(preloader) {
    return this.implementation.getLoaded(preloader ? 1 : 0) || 0;
};

/**
 * @name Audio#getPlayed
 * @function
 * @returns {Number} длительность воспроизведения (в секундах).
 */
AudioPlayer.prototype.getPlayed = function() {
    var position = this.getPosition();
    this._played += position - this._lastSkip;
    this._lastSkip = position;

    return this._played;
};

// =================================================================

//  Громкость

// =================================================================

/**
 * @name Audio#getVolume
 * @function
 * @returns {Number} текущее значение громкости плеера.
 */
AudioPlayer.prototype.getVolume = function() {
    if (!this.implementation) {
        return 0;
    }

    return this.implementation.getVolume();
};

/**
 * Установка громкости плеера.
 * @name Audio#setVolume
 * @function
 * @param {Number} volume Новое значение громкости.
 * @returns {Number} итоговое значение громкости.
 */
AudioPlayer.prototype.setVolume = function(volume) {
    DEV && logger.debug(this, "setVolume", volume);

    if (!this.implementation) {
        return 0;
    }

    return this.implementation.setVolume(volume);
};

/**
 * Проверка, что громкость управляется устройством, а не программно.
 * @name Audio#isDeviceVolume
 * @function
 * @returns {Boolean} true, если громкость управляется устройством, false - иначе.
 */
AudioPlayer.prototype.isDeviceVolume = function() {
    if (!this.implementation) {
        return true;
    }

    return this.implementation.isDeviceVolume();
};

// =================================================================

//  Web Audio API

// =================================================================
AudioPlayer.prototype.toggleCrossDomain = function(state) {
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleCrossDomainFailed", this.implementation.type);
        return false;
    }

    this.implementation.toggleCrossDomain(state);
};

/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 * @name Audio#toggleWebAudioAPI
 * @function
 * <note type="attention"> после включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode. </note>
 * @param {Boolean} state Запрашиваемый статус.
 * @returns {Boolean} Итоговый статус плеера.
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
 * Аудио-препроцессор.
 * @typedef {Object} Audio.AudioPreprocessor
 *
 * @property {AudioNode} input Нода, в которую перенаправляется вывод аудио.
 * @property {AudioNode} output Нода, из которой вывод подается на усилитель.
 */

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудиоэлементу, у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость.
 * @name Audio#setAudioPreprocessor
 * @function
 * @param {Audio.AudioPreprocessor} preprocessor Препроцессор.
 * @returns {boolean} статус успеха.
 */
AudioPlayer.prototype.setAudioPreprocessor = function(preprocessor) {
    logger.info(this, "setAudioPreprocessor");
    if (this.implementation.type !== "html5") {
        logger.warn(this, "setAudioPreprocessorFailed", this.implementation.type);
        return false;
    }

    return this.implementation.setAudioPreprocessor(preprocessor);
};

// =================================================================

//  Логгирование

// =================================================================

/**
 * Генерация playId
 * @private
 */
AudioPlayer.prototype._generatePlayId = function() {
    this._playId = Math.random().toString().slice(2);
};

/**
 * @name Audio#getPlayId
 * @function
 * @returns {String} playId.
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

},{"./audio-static":4,"./config":5,"./error/audio-error":6,"./flash/audio-flash":10,"./html5/audio-html5":26,"./lib/async/deferred":28,"./lib/async/events":29,"./lib/async/promise":30,"./lib/async/reject":31,"./lib/browser/detect":32,"./lib/data/merge":37,"./logger/logger":42}],4:[function(require,module,exports){
/**
 * @namespace AudioStatic
 * @private
 */
var AudioStatic = {};

/**
 * Начало воспроизведения трека.
 * @type String
 * @const
 * @name Audio.EVENT_PLAY
 */
AudioStatic.EVENT_PLAY = "play";
/**
 * Остановка воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_STOP
 */
AudioStatic.EVENT_STOP = "stop";
/**
 * Пауза воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_PAUSE
 */
AudioStatic.EVENT_PAUSE = "pause";
/**
 * Обновление позиции воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_PROGRESS
 */
AudioStatic.EVENT_PROGRESS = "progress";
/**
 * Началась загрузка трека.
 * @type String
 * @const
 * @name Audio.EVENT_LOADED
 */
AudioStatic.EVENT_LOADING = "loading";
/**
 * Загрузка трека завершена.
 * @type String
 * @const
 * @name Audio.
 */
AudioStatic.EVENT_LOADED = "loaded";
/**
 * Изменение громкости.
 * @type String
 * @const
 * @name Audio.EVENT_VOLUME
 */
AudioStatic.EVENT_VOLUME = "volumechange";

/**
 * Воспроизведение трека завершено.
 * @type String
 * @const
 * @name Audio.EVENT_ENDED
 */
AudioStatic.EVENT_ENDED = "ended";
/**
 * Возникла ошибка при инициализации плеера.
 * @type String
 * @const
 * @name Audio.EVENT_CRASHED
 */
AudioStatic.EVENT_CRASHED = "crashed";
/**
 * Возникла ошибка при воспроизведении.
 * @type String
 * @const
 * @name Audio.EVENT_ERROR
 */
AudioStatic.EVENT_ERROR = "error";
/**
 * Изменение статуса плеера.
 * @type String
 * @const
 * @name Audio.EVENT_STATE
 */
AudioStatic.EVENT_STATE = "state";
/**
 * Переключение между текущим и предзагруженным треком.
 * @type String
 * @const
 * @name Audio.EVENT_SWAP
 */
AudioStatic.EVENT_SWAP = "swap";
/**
 * Событие предзагрузчика. Используется в качестве префикса.
 * @type String
 * @const
 * @name Audio.PRELOADER_EVENT
 */
AudioStatic.PRELOADER_EVENT = "preloader:";
/**
 * Плеер находится в состоянии инициализации.
 * @type String
 * @const
 * @name Audio.STATE_INIT
 */
AudioStatic.STATE_INIT = "init";
/**
 * Не удалось инициализировать плеер.
 * @type String
 * @const
 * @name Audio.STATE_CRASHED
 */
AudioStatic.STATE_CRASHED = "crashed";
/**
 * Плеер готов и ожидает.
 * @type String
 * @const
 * @name Audio.STATE_IDLE
 */
AudioStatic.STATE_IDLE = "idle";
/**
 * Плеер проигрывает трек.
 * @type String
 * @const
 * @name Audio.STATE_PLAYING
 */
AudioStatic.STATE_PLAYING = "playing";
/**
 * Плеер поставлен на паузу.
 * @type String
 * @const
 * @name Audio.STATE_PAUSED
 */
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;

},{}],5:[function(require,module,exports){
/**
 * @name Audio.config
 * @namespace Настройки библиотеки.
 */
var config = {

    // =================================================================

    //  Общие настройки

    // =================================================================

    /**
     * Общие настройки. Содержит поле:
     * <ul>
     *  <li><codeph>retry</codeph> {Number} — количество попыток реинициализации (по умолчанию 3).</li>
     * </ul>
     * @field
     * @name Audio.config.audio
     * @static
     * @type Object
     */
    audio: {
        /**
         * Количество попыток реинициализации
         * @type {Number}
         */
        retry: 3
    },

    // =================================================================

    //  Flash-плеер

    // =================================================================

    /**
     * Настройки подключения Flash-плеера. Содержит следующие поля:
     * <ul>
     *  <li><codeph>path</codeph> {String} — путь к .swf файлу Flash-плеера (по умолчанию 'dist').</li>
     *  <li><codeph>name</codeph> {String} — имя .swf файла Flash-пеера (по умолчанию 'player-2_1.swf').</li>
     *  <li><codeph>vesrion</codeph> {Number} — минимальная версия Flash-плеера (по умолчанию 9.0.28).</li>
     *  <li><codeph>playerID</codeph> {Number} — ID, который будет выставлен для элемента с Flash-плеером (по умолчанию 'YandexAudioFlashPlayer').</li>
     *  <li><codeph>callback</codeph> {String} — имя функции-обработчика событий flash-плеера.</li>
     *  <li><codeph>initTimeout</codeph> {Number} — таймаут инициализации (по умолчанию 3000).</li>
     *  <li><codeph>loadTimeout</codeph> {Number} — таймаут загрузки (по умолчанию 5000).</li>
     *  <li><codeph>clickTimeout</codeph> {Number} — таймаут инициализации после клика (по умолчанию 1000).</li>
     *  <li><codeph>heartBeatInterval</codeph> {Number} — интервал проверки доступности Flash-плеера (по умолчанию 1000).</li>
     * </ul>
     * @field
     * @type Object
     * @static
     * @name Audio.config.flash
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
        name: "player-2_1.swf",
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
        callback: "ya.music.Audio._flashCallback",
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

    // =================================================================

    //  HTML5-плеер

    // =================================================================

    /**
     * Описание настроек HTML5 плеера. Содержит поле:
     * <ul>
     *  <li><p><codeph>blacklist</codeph> {String[]} — список браузеров, для которых лучше не использовать HTML5 плеер. Используется при
     * автоопределении типа плеера. Идентификаторы сравниваются со строкой, построенной по шаблону
     * `@&lt;platform.version&gt; &lt;platform.os&gt;:&lt;browser.name&gt;/&lt;browser.version&gt;`</p>
     * <p>По умолчанию содержит следующие значения: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"].</p>
     * </li>
     * </ul>
     * @field
     * @type Object
     * @name Audio.config.html5
     * @static
     */
    html5: {
        /**
         * Список идентификаторов для которых лучше не использовать html5 плеер. Используется при
         * авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону
         * `@&lt;platform.version&gt; &lt;platform.os&gt;:&lt;browser.name&gt;/&lt;browser.version&gt;`
         * @type {Array.&lt;String&gt;}
         */
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"]
    }
};

module.exports = config;

},{}],6:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @name Audio.AudioError
 * @class Класс ошибки аудиопллеера.
 * @extends <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>
 * @param {String} message Текст ошибки.
 *
 * @constructor
 */
var AudioError = function(message) {
    ErrorClass.call(this, message);
};
AudioError.prototype = ErrorClass.create("AudioError");

/**
 * Не найдена реализация плеера или все доступные реализации потерпели крах при инициализации.
 * @type String
 * @const
 * @name Audio.AudioError.NO_IMPLEMENTATION
 */
AudioError.NO_IMPLEMENTATION = "cannot find suitable implementation";
/**
 * Трек не был предзагружен или во время загрузки произошла ошибка.
 * @type String
 * @const
 * @name Audio.AudioError.NOT_PRELOADED
 */
AudioError.NOT_PRELOADED = "track is not preloaded";
/**
 * Действие не доступно из текущего состояния.
 * @type String
 * @const
 * @name Audio.AudioError.BAD_STATE
 */
AudioError.BAD_STATE = "action is not permited from current state";

/**
 * Flash-плеер был заблокирован.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_BLOCKER
 */
AudioError.FLASH_BLOCKER = "flash is rejected by flash blocker plugin";
/**
 * Flash-плеер потерпел крах при инициализации по неизвестным причинам.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_UNKNOWN_CRASH
 */
AudioError.FLASH_UNKNOWN_CRASH = "flash is crashed without reason";
/**
 * Flash-плеер потерпел крах при инициализации из-за таймаута.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_INIT_TIMEOUT
 */
AudioError.FLASH_INIT_TIMEOUT = "flash init timed out";
/**
 * Внутренняя ошибка Flash-плеера.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_INTERNAL_ERROR
 */
AudioError.FLASH_INTERNAL_ERROR = "flash internal error";
/**
 * Попытка вызвать недоступный экземляр Flash-плеера.
 * @type String
 * @const @name Audio.AudioError.FLASH_EMMITER_NOT_FOUND
 */
AudioError.FLASH_EMMITER_NOT_FOUND = "flash event emmiter not found";
/**
 * Flash-плеер перестал отвечать на запросы.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_NOT_RESPONDING
 */
AudioError.FLASH_NOT_RESPONDING = "flash player doesn't response";

module.exports = AudioError;

},{"../lib/class/error-class":35}],7:[function(require,module,exports){
require('../export');

var AudioError = require('./audio-error');
var PlaybackError = require('./playback-error');

ya.music.Audio.AudioError = AudioError;
ya.music.Audio.PlaybackError = PlaybackError;

},{"../export":9,"./audio-error":6,"./playback-error":8}],8:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @name Audio.PlaybackError
 * @class Класс ошибки воспроизведения.
 * @extends <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>
 * @param String message Текст ошибки.
 * @param String src Ссылка на трек.
 *
 * @constructor
 */
var PlaybackError = function(message, src) {
    ErrorClass.call(this, message);

    this.src = src;
};

PlaybackError.prototype = ErrorClass.create("PlaybackError");

/**
 * Отмена соединенния.
 * @type String
 * @const
 * @name Audio.PlaybackError.CONNECTION_ABORTED
 */
PlaybackError.CONNECTION_ABORTED = "Connection aborted";
/**
 * Сетевая ошибка.
 * @type String
 * @const
 * @name Audio.PlaybackError.NETWORK_ERROR
 */
PlaybackError.NETWORK_ERROR = "Network error";
/**
 * Ошибка декодирования аудио.
 * @type String
 * @const
 * @name Audio.PlaybackError.DECODE_ERROR
 */
PlaybackError.DECODE_ERROR = "Decode error";
/**
 * Недоступный источник.
 * @type String
 * @const
 * @name Audio.PlaybackError.BAD_DATA
 */
PlaybackError.BAD_DATA = "Bad data";

/**
 * Не запускается воспроизведение.
 * @type String
 * @const
 * @name Audio.PlaybackError.DONT_START
 */
PlaybackError.DONT_START = "Playback start error";

/**
 * Таблица соответствия кодов ошибок HTML5 плеера. Содержит поля:
 * <ul>
 *  <li>1: PlaybackError.CONNECTION_ABORTED,</li>
 *  <li>2: PlaybackError.NETWORK_ERROR,</li>
 *  <li>3: PlaybackError.DECODE_ERROR,</li>
 *  <li>4: PlaybackError.BAD_DATA</li>
 * </ul>
 * @const
 * @type Object
 * @name Audio.PlaybackError.html5
 */
PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

//TODO: сделать классификатор ошибок flash-плеера

module.exports = PlaybackError;

},{"../lib/class/error-class":35}],9:[function(require,module,exports){
if (typeof DEV === "undefined") {
    window.DEV = true;
}

if (typeof window.ya === "undefined") {
    window.ya = {};
}

var ya = window.ya;

if (typeof ya.music === "undefined") {
    ya.music = {};
}

if (typeof ya.music.Audio === "undefined") {
    ya.music.Audio = {};
}

var config = require('./config');
var AudioPlayer = require('./audio-player');
var Proxy = require('./lib/class/proxy');

ya.music.Audio = Proxy.createClass(AudioPlayer);
ya.music.Audio.config = config;

module.exports = ya.music.Audio;

},{"./audio-player":3,"./config":5,"./lib/class/proxy":36}],10:[function(require,module,exports){
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

// =================================================================

//  Проверка доступности flash-плеера

// =================================================================

var flashVersion = swfobject.getFlashPlayerVersion();
detect.flashVersion = flashVersion.major + "." + flashVersion.minor + "." + flashVersion.release;

exports.available = swfobject.hasFlashPlayerVersion(config.flash.version);
logger.info(this, "detection", exports.available);

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Класс flash аудио-плеера
 * @extends IAudioImplementation
 *
 * @fires IAudioImplementation#EVENT_PLAY
 * @fires IAudioImplementation#EVENT_ENDED
 * @fires IAudioImplementation#EVENT_VOLUME
 * @fires IAudioImplementation#EVENT_CRASHED
 * @fires IAudioImplementation#EVENT_SWAP
 *
 * @fires IAudioImplementation#EVENT_STOP
 * @fires IAudioImplementation#EVENT_PAUSE
 * @fires IAudioImplementation#EVENT_PROGRESS
 * @fires IAudioImplementation#EVENT_LOADING
 * @fires IAudioImplementation#EVENT_LOADED
 * @fires IAudioImplementation#EVENT_ERROR
 *
 * @param {HTMLElement} [overlay] - место для встраивания плеера (актуально только для flash-плеера)
 * @param {Boolean} [force=false] - создать новый экзепляр FlashManager
 * @constructor
 * @private
 */
var AudioFlash = function(overlay, force) {
    this.name = playerId++;
    DEV && logger.debug(this, "constructor");

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

exports.type = AudioFlash.type = AudioFlash.prototype.type = "flash";

// =================================================================

//  Создание методов работы с плеером

// =================================================================

Object.keys(FlashInterface.prototype).filter(function(key) {
    return FlashInterface.prototype.hasOwnProperty(key) && key[0] !== "_";
}).map(function(method) {
    AudioFlash.prototype[method] = function() {
        if (!/^get/.test(method)) {
            DEV && logger.debug(this, method);
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

// =================================================================

//  JSDOC

// =================================================================

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

// =================================================================

//  Получение данных о плеере

// =================================================================

/**
 * Проверить доступен ли программный контроль громкости
 * @returns {boolean}
 */
AudioFlash.prototype.isDeviceVolume = function() {
    return false;
};

// =================================================================

//  Логгирование

// =================================================================

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
            main: logger._showUrl(this.getSrc(0)),
            preloader: logger._showUrl(this.getSrc(1))
        };
    } catch(e) {
        return "";
    }
};

exports.AudioImplementation = AudioFlash;

},{"../config":5,"../lib/async/events":29,"../lib/browser/detect":32,"../lib/browser/swfobject":33,"../logger/logger":42,"./flash-interface":11,"./flash-manager":12}],11:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('FlashInterface');

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Описание внешнего интерфейса flash-плеера
 * @param {Object} flash - swf-объект
 * @constructor
 * @private
 */
var FlashInterface = function(flash) {
    //FIXME: нужно придумать нормальный метод экспорта
    this.flash = ya.music.Audio._flash = flash;
};

// =================================================================

//  Общение с flash-плеером

// =================================================================

/**
 * Вызвать метод flash-плеера
 * @param {String} fn - название метода
 * @returns {*}
 * @private
 */
FlashInterface.prototype._callFlash = function(fn) {
    //DEV && logger.debug(this, fn, arguments);

    try {
        return this.flash.call.apply(this.flash, arguments);
    } catch(e) {
        logger.error(this, "_callFlashError", e, arguments[0], arguments[1], arguments[2]);
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

// =================================================================

//  Методы управления плеером

// =================================================================

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

// =================================================================

//  Предзагрузка

// =================================================================

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

// =================================================================

//  Получение данных о плеере

// =================================================================

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

},{"../logger/logger":42}],12:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('FlashManager');

var config = require('../config');

var AudioStatic = require('../audio-static');
var flashLoader = require('./loader');
var FlashInterface = require('./flash-interface');

var Promise = require('../lib/async/promise');
var Deferred = require('../lib/async/deferred');

var AudioError = require('../error/audio-error');
var LoaderError = require('../lib/net/error/loader-error');

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Загрузка flash-плеера и обработка событий
 * @param {HTMLElement} overlay - объект для загрузки и показа flash-плеера
 * @constructor
 * @private
 */
var FlashManager = function(overlay) { // singleton!
    DEV && logger.debug(this, "constructor", overlay);

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

    this.__loadTimeout = setTimeout(this._onLoadTimeout.bind(this), config.flash.loadTimeout);
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
        logger.error(this, "failed", e);
    }.bind(this));
};

FlashManager.EVENT_INIT = "init";
FlashManager.EVENT_FAIL = "failed";
FlashManager.EVENT_ERROR = "error";
FlashManager.EVENT_DEBUG = "debug";

// =================================================================

//  Обработчики событий инициализации flash

// =================================================================

/**
 * Обработчик события загрузки плеера
 * @param data
 * @private
 */
FlashManager.prototype._onLoad = function(data) {
    DEV && logger.debug(this, "_onLoad", data);

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
    DEV && logger.debug(this, "_onInit");

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

// =================================================================

//  Обработчики событий flash-плеера

// =================================================================

/**
 * Обработчик событий, создаваемых flash-плеером
 * @param {String} event
 * @param {int} id - id плеера
 * @param {int} offset - 0: для текущего загрузчика, 1: для следующего загрузчика
 * @param {*} data - данные переданные вместе с событием
 * @private
 */
FlashManager.prototype._onEvent = function(event, id, offset, data) {
    if (this.state === "failed") {
        logger.warn(this, "onEventFailed", event, id, offset, data);
        return;
    }

    if (event === FlashManager.EVENT_DEBUG) {
        logger.info(this, "flashDEBUG", id, offset, data);
    } else if (event === FlashManager.EVENT_ERROR) {
        logger.warn(this, "flashError", id, offset, data);
    } else {
        DEV && logger.debug(this, "onEvent", event, id, offset);
    }

    if (event === FlashManager.EVENT_INIT) {
        return this._onInit();
    }

    if (event === FlashManager.EVENT_FAIL) {
        logger.error(this, "failed", AudioError.FLASH_INTERNAL_ERROR);
        this.deferred.reject(new AudioError(AudioError.FLASH_INTERNAL_ERROR));
        return;
    }

    //INFO: в обработчике события переданного из флеша нельзя обращаться к флеш-объекту, поэтому делаем рассинхронизацию
    if (id == -1) {
        Promise.resolve().then(function() {
            this.emmiters.forEach(function(emmiter) {
                emmiter.trigger(event, offset, data);
            });
        }.bind(this));
    } else if (this.emmiters[id]) {
        Promise.resolve().then(function() {
            this.emmiters[id].trigger(event, offset, data);
        }.bind(this));
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

// =================================================================

//  Управление плеером

// =================================================================

/**
 * Создание нового плеера
 * @param {AudioFlash} audioFlash - flash аудио-плеер, который будет обслуживать созданный плеер
 * @returns {Promise} -- обещание, которое разрешается после завершения создания плеера
 */
FlashManager.prototype.createPlayer = function(audioFlash) {
    DEV && logger.debug(this, "createPlayer");

    var promise = this.whenReady.then(function() {
        audioFlash.id = this.flash._addPlayer();
        this.emmiters[audioFlash.id] = audioFlash;
        return audioFlash.id;
    }.bind(this));

    promise.then(function(playerId) {
        DEV && logger.debug(this, "createPlayerSuccess", playerId);
    }.bind(this), function(err) {
        logger.error(this, "createPlayerError", err);
    }.bind(this));

    return promise;
};

module.exports = FlashManager;

},{"../audio-static":4,"../config":5,"../error/audio-error":6,"../lib/async/deferred":28,"../lib/async/promise":30,"../lib/net/error/loader-error":39,"../logger/logger":42,"./flash-interface":11,"./loader":15}],13:[function(require,module,exports){
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
    embedSWF: function(
        swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj,
        parObj, attObj, callbackFn, removeBlockedSWF
    ) {
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

            swfobject.embedSWF(swfUrlStr,
                replaceElemIdStr,
                widthStr,
                heightStr,
                swfVersionStr,
                xiSwfUrlStr,
                flashvarsObj,
                parObj,
                attObj,
                function(e) {
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
                            replacedBySVG = swfElement && swfElement['getSVGDocument']
                                && swfElement['getSVGDocument']();
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

},{"../lib/browser/swfobject":33}],14:[function(require,module,exports){
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
    embedSWF: function(
        swfUrlStr, replaceElemIdStr, widthStr, heightStr, swfVersionStr, xiSwfUrlStr, flashvarsObj,
        parObj, attObj, callbackFn
    ) {
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

            swfobject.embedSWF(swfUrlStr,
                replaceElemIdStr,
                widthStr,
                heightStr,
                swfVersionStr,
                xiSwfUrlStr,
                flashvarsObj,
                parObj,
                attObj,
                function(e) {
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
                            replacedBySVG = swfElement && swfElement['getSVGDocument']
                                && swfElement['getSVGDocument']();
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

},{"../lib/browser/swfobject":33}],15:[function(require,module,exports){
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
        flashSizeX = sizeX;
        flashSizeY = sizeY;
        options = {allowscriptaccess: "always", wmode: "transparent"};

        $flashPlayer.className = CONTAINER_CLASS;
        $flashPlayer.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: hidden;';
        container.appendChild($flashPlayer);
    } else {
        embedder = FlashBlockNotifier;
        flashSizeX = flashSizeY = "1";
        options = {allowscriptaccess: "always"};

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

},{"../lib/browser/detect":32,"./flashblocknotifier":13,"./flashembedder":14}],16:[function(require,module,exports){
module.exports = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

},{}],17:[function(require,module,exports){
module.exports = [
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

},{}],18:[function(require,module,exports){
var Events = require('../../lib/async/events');
var EqualizerStatic = require('./equalizer-static');

// =================================================================

//  Конструктор

// =================================================================

/**
 * Событие изменения значения усиления.
 * @event Audio.fx.Equalizer.EqualizerBand#EVENT_CHANGE
 * @param {Number} value Новое значение.
 */

/**
 * @name Audio.fx.Equalizer.EqualizerBand
 * @class Полоса пропускания эквалайзера.
 * @extends Events
 *
 * @param {AudioContext} audioContext контекст Web Audio API.
 * @param {String} type Тип фильтра.
 * @param {Number} frequency Частота фильтра.
 *
 * @fires Audio.fx.Equalizer.EqualizerBand#EVENT_CHANGE
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

// =================================================================

//  Управление настройками

// =================================================================

/**
 * @name Audio.fx.Equalizer.EqualizerBand#getFreq
 * @function
 * @returns {Number} частоту полосы пропускания.
 */
EqualizerBand.prototype.getFreq = function() {
    return this.filter.frequency.value;
};

/**
 * @name Audio.fx.Equalizer.EqualizerBand#getValue
 * @function
 * @returns {Number} Значение усиления.
 */
EqualizerBand.prototype.getValue = function() {
    return this.filter.gain.value;
};

/**
 * Установить значение усиления.
 * @name Audio.fx.Equalizer.EqualizerBand#setValue
 * @function
 * @param {Number} value Значение.
 */
EqualizerBand.prototype.setValue = function(value) {
    this.filter.gain.value = value;
    this.trigger(EqualizerStatic.EVENT_CHANGE, value);
};

module.exports = EqualizerBand;

},{"../../lib/async/events":29,"./equalizer-static":19}],19:[function(require,module,exports){
/**
 * @namespace EqualizerStatic
 * @private
 */
var EqualizerStatic = {};

/** @type {String}
 * @const*/
EqualizerStatic.EVENT_CHANGE = "change";

module.exports = EqualizerStatic;

},{}],20:[function(require,module,exports){
var Events = require('../../lib/async/events');
var merge = require('../../lib/data/merge');

var EqualizerStatic = require('./equalizer-static');
var EqualizerBand = require('./equalizer-band');

/**
 * Описание настроек эквалайзера.
 * @typedef {Object} Audio.fx.Equalizer.EqualizerPreset
 * @property {String} [id] Идентификатор настроек.
 * @property {Number} preamp Предусилитель.
 * @property {Number[]} bands Значения для полос эквалайзера.
 */

/**
 * Событие изменения полосы пропускания
 * @event Audio.fx.Equalizer#EVENT_CHANGE
 *
 * @param {Number} freq Частота полосы пропускания.
 * @param {Number} value Значение усиления.
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @name Audio.fx.Equalizer
 * @class Эквалайзер.
 * @param {AudioContext} audioContext Контекст Web Audio API.
 * @param {Number[]} bands Список частот для полос эквалайзера.
 *
 * @extends Events
 * @mixes EqualizerStatic
 *
 * @fires ya.music.Audio.fx.Equalizer#EVENT_CHANGE
 *
 * @constructor
 */
var Equalizer = function(audioContext, bands) {
    Events.call(this);

    this.preamp = new EqualizerBand(audioContext, "highshelf", 0);
    this.preamp.on("*", this._onBandEvent.bind(this, this.preamp));

    bands = bands || Equalizer.DEFAULT_BANDS;

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
merge(Equalizer, EqualizerStatic, true);

// =================================================================

//  Настройки по-умолчанию

// =================================================================

/**
 * Набор частот эквалайзера применяющийся по умолчанию.
 * @type Number[]
 * @const 
 * @name Audio.fx.Equalizer.DEFAULT_BANDS
 */
Equalizer.DEFAULT_BANDS = require('./default.bands.js');

/**
 * Набор распространенных пресетов эквалайзера для набора частот по умолчанию.
 * @type Object|String|Audio.fx.Equalizer.EqualizerPreset
 * @const
 * @name Audio.fx.Equalizer.DEFAULT_PRESETS
 */
Equalizer.DEFAULT_PRESETS = require('./default.presets.js');

// =================================================================

//  Обработка событий

// =================================================================

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

// =================================================================

//  Загрузка и сохранение настроек

// =================================================================

/**
 * Загрузить настройки.
 * @function
 * @name Audio.fx.Equalizer#loadPreset
 * @param {Audio.fx.Equalizer.EqualizerPreset} preset Настройки.
 */
Equalizer.prototype.loadPreset = function(preset) {
    preset.bands.forEach(function(value, idx) {
        this.bands[idx].setValue(value);
    }.bind(this));
    this.preamp.setValue(preset.preamp);
};

/**
 * Сохранить текущие настройки.
 * @function
 * @name Audio.fx.Equalizer#savePreset
 * @returns {Audio.fx.Equalizer.EqualizerPreset}
 */
Equalizer.prototype.savePreset = function() {
    return {
        preamp: this.preamp.getValue(),
        bands: this.bands.map(function(band) { return band.getValue(); })
    };
};

// =================================================================

//  Математика

// =================================================================

//TODO: проверить предположение (скорее всего нужна карта весов для различных частот или даже некая функция)
/**
 * Вычиляет оптимальное значние предусиления. Функция является экспериментальной.
 * @experimental
 * @function
 * @name Audio.fx.Equalizer#guessPreamp
 * @returns {number} значние предусиления.
 */
Equalizer.prototype.guessPreamp = function() {
    var v = 0;
    for (var k = 0, l = this.bands.length; k < l; k++) {
        v += this.bands[k].getValue();
    }

    return -v / 2;
};

module.exports = Equalizer;

},{"../../lib/async/events":29,"../../lib/data/merge":37,"./default.bands.js":16,"./default.presets.js":17,"./equalizer-band":18,"./equalizer-static":19}],21:[function(require,module,exports){
require('../export');

ya.music.Audio.fx.Equalizer = require('./equalizer');

},{"../export":22,"./equalizer":20}],22:[function(require,module,exports){
require('../export');

ya.music.Audio.fx = {};

},{"../export":9}],23:[function(require,module,exports){
require('../export');

ya.music.Audio.fx.volumeLib = require('./volume-lib');

},{"../export":22,"./volume-lib":24}],24:[function(require,module,exports){
/**
 * @class Методы конвертации значений громкости.
 * @static
 * @name Audio.fx.volumeLib
 */
var volumeLib = {};

/**
 * Минимальное значение громкости при котором происходит отключение звука.
 * Ограничение в 0.01 подобрано эмпирически.
 * @type number
 * @field
 * @name Audio.fx.volumeLib.EPSILON
 */
volumeLib.EPSILON = 0.01;

/**
 * Коэффициент для преобразований громкости из относительной шкалы в децибелы.
 * @type Number
 * @private
 */
volumeLib._DBFS_COEF = 20 / Math.log(10);

/**
 * Вычисление значение громкости по значению на логарифмической шкале.
 * @function
 * @name Audio.fx.volumeLib#toExponent
 * @param {Number} value Значение на шкале.
 * @returns {Number} значение громкости.
 */
volumeLib.toExponent = function(value) {
    var volume = Math.pow(volumeLib.EPSILON, 1 - value);
    return volume > volumeLib.EPSILON ? volume : 0;
};

/**
 * @function
 * @name Audio.fx.volumeLib#fromExponent
 * @param {Number} volume Громкость.
 * @returns {Number} значения положения на логарифмической шкале по значению громкости.
 */
volumeLib.fromExponent = function(volume) {
    return 1 - Math.log(Math.max(volume, volumeLib.EPSILON)) / Math.log(volumeLib.EPSILON);
};

/**
 * @function
 * @name Audio.fx.volumeLib#toDBFS
 * @param {Number} volume Относительная громкость.
 * @returns {Number} значения dBFS из относительного значения громкости.
 */
volumeLib.toDBFS = function(volume) {
    return Math.log(volume) * volumeLib._DBFS_COEF;
};

/**
 * @function
 * @name Audio.fx.volumeLib#fromDBFS
 * @param {Number} dbfs Громкость в dBFS.
 * @returns {Number} значения относительной громкости из значения dBFS.
 */
volumeLib.fromDBFS = function(dbfs) {
    return Math.exp(dbfs / volumeLib._DBFS_COEF);
};

module.exports = volumeLib;

},{}],25:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5Loader');

var Events = require('../lib/async/events');
var Deferred = require('../lib/async/deferred');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');
var noop = require('../lib/noop');

var loaderId = 1;

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Обёртка для нативного класса Audio
 * @extends Events
 **
 * @fires IAudioImplementation#EVENT_PLAY
 * @fires IAudioImplementation#EVENT_ENDED
 * @fires IAudioImplementation#EVENT_STOP
 * @fires IAudioImplementation#EVENT_PAUSE
 * @fires IAudioImplementation#EVENT_PROGRESS
 * @fires IAudioImplementation#EVENT_LOADING
 * @fires IAudioImplementation#EVENT_LOADED
 * @fires IAudioImplementation#EVENT_ERROR
 *
 * @constructor
 * @private
 */
var AudioHTML5Loader = function() {
    this.name = loaderId++;
    DEV && logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            DEV && logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    /**
     * Контейнер для различных ожиданий событий
     * @type {Object.<String, Deferred>}
     * @private
     */
    this.promises = {};

    /**
     * Ссылка на трек
     * @type {string}
     * @private
     */
    this.src = "";
    /**
     * Назначенная позиция воспроизведения
     * @type {number}
     * @private
     */
    this.position = 0;

    /**
     * Время последнего обновления данных
     * @type {number}
     * @private
     */
    this.lastUpdate = 0;

    /**
     * Флаг начала загрузки
     * @type {boolean}
     * @private
     */
    this.notLoading = true;

    /**
     * Выход для Web Audio API
     * @type {AudioNode}
     * @private
     */
    this.output = null;

    //--- Сахар для защиты от утечек памяти
    this.__startPlay = this._startPlay.bind(this);
    this.__restart = this._restart.bind(this);
    this.__startupAudio = this._startupAudio.bind(this);

    this.__updateProgress = this._updateProgress.bind(this);
    this.__onNativeLoading = this._onNativeLoading.bind(this);
    this.__onNativeEnded = this._onNativeEnded.bind(this);
    this.__onNativeError = this._onNativeError.bind(this);
    this.__onNativePause = this._onNativePause.bind(this);

    this.__onNativePlay = this.trigger.bind(this, AudioStatic.EVENT_PLAY);

    this._initAudio();
};
Events.mixin(AudioHTML5Loader);

/**
 * Интервал обновления таймингов трека
 * @type {number}
 * @private
 * @const
 */
AudioHTML5Loader._updateInterval = 30;

// =================================================================

//  Нативные события Audio

// =================================================================

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

/**
 * Заглушка для __initListener'а на время ожидания пользовательского действия
 * @private
 */
AudioHTML5Loader._defaultInitListener = function() {};
AudioHTML5Loader._defaultInitListener.step = "user";

// =================================================================

//  Обработчики событий

// =================================================================

/**
 * Обработчик обновления таймингов трека
 * @private
 */
AudioHTML5Loader.prototype._updateProgress = function() {
    var currentTime = +new Date();
    if (currentTime - this.lastUpdate < AudioHTML5Loader._updateInterval) {
        return;
    }

    this.lastUpdate = currentTime;
    this.trigger(AudioStatic.EVENT_PROGRESS);
};

/**
 * Обработчик событий загрузки трека
 * @private
 */
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

/**
 * Обработчик события окончания трека
 * @private
 */
AudioHTML5Loader.prototype._onNativeEnded = function() {
    this.trigger(AudioStatic.EVENT_PROGRESS);
    this.trigger(AudioStatic.EVENT_ENDED);
    this.ended = true;
    this.playing = false;
    this.audio.pause();
};

/**
 * Обработчик ошибок воспроизведения
 * @param {Event} e - Событие ошибки
 * @private
 */
AudioHTML5Loader.prototype._onNativeError = function(e) {
    if (!this.src) {
        return;
    }

    if (this.audio.error.code == 2) {
        logger.warn(this, "Network error. Restarting...", logger._showUrl(this.src));
        this.position = this.audio.currentTime;
        this._restart();
        return;
    }

    var error = new PlaybackError(this.audio.error
            ? PlaybackError.html5[this.audio.error.code]
            : e instanceof Error ? e.message : e,
        this.src);

    this.playing = false;

    this.trigger(AudioStatic.EVENT_ERROR, error);
};

/**
 * Обработчик события паузы
 * @private
 */
AudioHTML5Loader.prototype._onNativePause = function() {
    if (!this.ended) {
        this.trigger(AudioStatic.EVENT_PAUSE);
    }
};

// =================================================================

//  Инициализация и деинициализация Audio

// =================================================================

/**
 * Инициализация слушателей пользовательских событий для инициализации плеера
 * @private
 */
AudioHTML5Loader.prototype._initUserEvents = function() {
    document.body.addEventListener("mousedown", this.__startupAudio, true);
    document.body.addEventListener("keydown", this.__startupAudio, true);
    document.body.addEventListener("touchstart", this.__startupAudio, true);
};

/**
 * Деинициализация слушателей пользовательских событий для инициализации плеера
 * @private
 */
AudioHTML5Loader.prototype._deinitUserEvents = function() {
    document.body.removeEventListener("mousedown", this.__startupAudio, true);
    document.body.removeEventListener("keydown", this.__startupAudio, true);
    document.body.removeEventListener("touchstart", this.__startupAudio, true);
};

/**
 * Инициализация слушателей нативных событий audio-элемента
 * @private
 */
AudioHTML5Loader.prototype._initNativeEvents = function() {
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);
};

/**
 * Деинициализация слушателей нативных событий audio-элемента
 * @private
 */
AudioHTML5Loader.prototype._deinitNativeEvents = function() {
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);
};

/**
 * Создание объекта Audio и назначение обработчиков событий
 * @private
 */
AudioHTML5Loader.prototype._initAudio = function() {
    DEV && logger.debug(this, "_initAudio");

    this.muteEvents();

    this.audio = document.createElement("audio");
    this.audio.loop = false; // for IE
    this.audio.preload = this.audio.autobuffer = "auto"; // 100%
    this.audio.autoplay = false;
    this.audio.src = "";

    this._initUserEvents();
    this.__initListener = AudioHTML5Loader._defaultInitListener;

    this._initNativeEvents();
};

/**
 * Отключение обработчиков событий и удаление объекта Audio
 * @private
 */
AudioHTML5Loader.prototype._deinitAudio = function() {
    DEV && logger.debug(this, "_deinitAudio");

    this.muteEvents();

    this._deinitUserEvents();
    this._deinitNativeEvents();

    this.audio = null;
};

/**
 * Инициализация объекта Audio. Для начала воспроизведение требуется любое пользовательское действие.
 *
 * Совершенно эзотеричный и магический метод. Для инициализации плеера требуется вызывать метод play в обработчике
 * пользовательского события. После этого требуется поставить плеер обратно на паузу, т.к. некоторые браузеры
 * в противном случае начинают проигрывать трек автоматически как только он загружается. При этом в некоторых браузерах
 * после вызова метода load событие play никогда не наступает, так что приходится слушать события получения метаданных
 * или ошибки загрузки (если src не указан). В некоторых браузерах также может не наступить событие pause. При этом
 * стоит ещё учитывать, что трек может грузиться из кеша, тогда события получения мета-данных и возможности
 * воспроизведения могут возникнуть быстрее события play или pause, так что нужно предусматривать прерывание процесса
 * инициализации.
 * @private
 */
AudioHTML5Loader.prototype._startupAudio = function() {
    DEV && logger.debug(this, "_startupAudio");

    this._deinitUserEvents();

    //INFO: после инициализационного вызова play нужно дождаться события и вызвать pause.
    this.__initListener = function(e) {
        if (!this.__initListener) {
            return;
        }

        this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__initListener);
        this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_CANPLAY, this.__initListener);
        this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_META, this.__initListener);
        this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__initListener);

        //INFO: после вызова pause нужно дождаться события, завершить инициализацию и разрешить передачу событий
        this.__initListener = function() {
            if (!this.__initListener) {
                return;
            }

            this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__initListener);
            delete this.__initListener;
            this.unmuteEvents();
            logger.info(this, "_startupAudio:ready");
        }.bind(this);
        this.__initListener.step = "pause";

        this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__initListener);
        this.audio.pause();

        DEV && logger.debug(this, "_startupAudio:play", e.type);
    }.bind(this);
    this.__initListener.step = "play";

    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_CANPLAY, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_META, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__initListener);

    //INFO: перед использованием объект Audio требуется инициализировать, в обработчике пользовательского события
    this.audio.load();
    this.audio.play();
};

/**
 * Если метод _startPlay вызван раньше, чем закончилась инициализация, нужно отменить текущий шаг инициализации.
 * @private
 */
AudioHTML5Loader.prototype._breakStartup = function(reason) {
    this._deinitUserEvents();
    this.unmuteEvents();

    if (!this.__initListener) {
        return;
    }

    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__initListener);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_CANPLAY, this.__initListener);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_META, this.__initListener);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__initListener);

    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__initListener);

    logger.warn(this, "_startupAudio:interrupted", this.__initListener.step, reason);
    delete this.__initListener;
};

// =================================================================

//  Методы ожидания различных событий и генерации обещаний

// =================================================================

/**
 * Дождаться определённого состояния плеера
 * @param {String} name - имя состояния
 * @param {Function} check - метод проверки, что мы находимся в нужном состоянии
 * @param {Array.<String>} listen - список событий, при которых может смениться состояние
 * @returns {Promise}
 * @private
 */
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

/**
 * Отмена ожидания состояния
 * @param {String} name - имя состояния
 * @param {String} reason - причина отмены ожидания
 * @todo reason сделать наследником класса Error
 * @private
 */
AudioHTML5Loader.prototype._cancelWait = function(name, reason) {
    var promise;
    if (promise = this.promises[name]) {
        delete this.promises[name];
        promise.reject(reason);
    }
};

/**
 * Отмена всех ожиданий
 * @param {String} reason - причина отмены ожидания
 * @todo reason сделать наследником класса Error
 * @private
 */
AudioHTML5Loader.prototype._abortPromises = function(reason) {
    for (var key in this.promises) {
        if (this.promises.hasOwnProperty(key)) {
            this._cancelWait(key, reason);
        }
    }
};

// =================================================================

//  Ожидание получения метаданных трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать готовности метаданных
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promiseMetadataEvents = [AudioHTML5Loader.EVENT_NATIVE_META, AudioHTML5Loader.EVENT_NATIVE_CANPLAY];

/**
 * Проверка получения метаданных
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promiseMetadataCheck = function() {
    return this.audio.readyState > this.audio.HAVE_METADATA;
};

/**
 * Ожидание получения метаданных
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseMetadata = function() {
    return this._waitFor("metadata", this._promiseMetadataCheck, AudioHTML5Loader._promiseMetadataEvents);
};

// =================================================================

//  Ожидание загрузки нужной части трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать загрузки
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promiseLoadedEvents = [AudioHTML5Loader.EVENT_NATIVE_LOADING];

/**
 * Проверка, что загружена нужная часть трека
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promiseLoadedCheck = function() {
    this.__loaderTimer = this.__loaderTimer && clearTimeout(this.__loaderTimer) || setTimeout(function() {
            this._cancelWait("loaded", "timeout");
        }.bind(this), 5000);

    //INFO: позицию нужно брать с большим запасом, т.к. данные записаны блоками и нам нужно дождаться загрузки блока
    var loaded = Math.min(this.position + 45, this.audio.duration);
    return this.audio.buffered.length
        && this.audio.buffered.end(0) - this.audio.buffered.start(0) >= loaded;
};

/**
 * Ожидание загрузки нужной части трека
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseLoaded = function() {
    var promise = this._waitFor("loaded", this._promiseLoadedCheck, AudioHTML5Loader._promiseLoadedEvents);

    if (!promise.cleanTimer) {
        promise.cleanTimer = function() {
            this.__loaderTimer = clearTimeout(this.__loaderTimer);
        }.bind(this);
        promise.then(promise.cleanTimer, promise.cleanTimer);
    }

    return promise;
};

// =================================================================

//  Ожидание проигрывания нужной части трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать проигрывания нужно части
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promisePlayingEvents = [AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE];

/**
 * Проверка, что проигрывается нужная часть трека
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promisePlayingCheck = function() {
    var time = Math.min(this.position + 0.2, this.audio.duration);
    return this.audio.currentTime >= time;
};

/**
 * Ожидание проигрывания нужной части трека
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promisePlaying = function() {
    return this._waitFor("playing", this._promisePlayingCheck, AudioHTML5Loader._promisePlayingEvents);
};

// =================================================================

//  Ожидание начала воспроизведения

// =================================================================

/**
 * Ожидание начала воспроиведения, перезапуск трека, если воспроизведение не началось
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseStartPlaying = function() {
    if (!this.promises["startPlaying"]) {
        var deferred = new Deferred();
        this.promises["startPlaying"] = deferred;

        //INFO: если отменено ожидание загрузки или воспроизведения, то нужно отменить и это обещание
        var reject = function(reason) {
            ready = true;
            this._cancelWait("startPlaying", reason);
        }.bind(this);

        var timer;
        var ready = false;
        var cleanTimer = function() {
            clearTimeout(timer);
        };

        this._promisePlaying().then(function() {
            ready = true;
            deferred.resolve();
            logger.info(this, "startPlaying:success");
        }.bind(this), reject);

        this._promiseLoaded().then(function() {
            if (ready) {
                return;
            }
            timer = setTimeout(function() {
                deferred.reject("timeout");
                this._cancelWait("playing", "timeout");
                logger.warn(this, "startPlaying:failed");
            }.bind(this), 5000);
        }.bind(this), reject);

        this._promisePlaying().then(cleanTimer, cleanTimer);
        deferred.promise().then(cleanTimer, cleanTimer);
    }

    return this.promises["startPlaying"].promise();
};

// =================================================================

//  Управление элементом Audio

// =================================================================

/**
 * Начать загрузку трека
 * @param {String} src
 */
AudioHTML5Loader.prototype.load = function(src) {
    DEV && logger.debug(this, "load", src);

    this._abortPromises("load");
    this._breakStartup("load");

    this.ended = false;
    this.playing = false;
    this.notLoading = true;
    this.position = 0;

    this.src = src;
    this.audio.src = src;
    this.audio.load();
};

/** Остановить воспроизведение и загрузку трека */
AudioHTML5Loader.prototype.stop = function() {
    DEV && logger.debug(this, "stop");

    this._abortPromises("stop");
    this._breakStartup("stop");

    this.load("");
};

/**
 * Начать воспроизведение трека
 * @private
 */
AudioHTML5Loader.prototype._startPlay = function() {
    DEV && logger.debug(this, "_startPlay");

    this.audio.currentTime = this.position;

    if (!this.playing) {
        return;
    }

    this._breakStartup("startPlay");
    this.audio.play();

    //THINK: нужно ли триггерить событие в случае успеха
    this._promiseStartPlaying().then(function() {
        this.retry = 0;
    }.bind(this), this.__restart);
};

/**
 * Перезапустить воспроизведение трека
 * @param {String} [reason] - если причина вызова указана и не равна "timeout" ничего не происходит
 * @private
 */
AudioHTML5Loader.prototype._restart = function(reason) {
    logger.info(this, "_restart", reason, this.position, this.playing);

    if (!this.src || reason && reason !== "timeout") {
        return;
    }

    this.retry++;

    if (this.retry > 5) {
        this.playing = false;
        this.trigger(AudioStatic.EVENT_ERROR, new PlaybackError(PlaybackError.DONT_START, this.src));
        return;
    }

    //INFO: Запоминаем текущее состояние, т.к. оно сбросится после перезагрузки
    var position = this.position;
    var playing = this.playing;

    this.load(this.src);

    if (playing) {
        this._play(position);
    } else {
        this.setPosition(position);
    }
};

/**
 * Воспроизведение трека/отмена паузы
 * @param {Number} [position] - позиция воспроизведения
 */
AudioHTML5Loader.prototype.play = function(position) {
    DEV && logger.debug(this, "play", position);
    this.retry = 0;
    return this._play(position);
};

/**
 * Воспроизведение трека/отмена паузы - внутренний метод
 * @param {Number} [position] - позиция воспроизведения
 * @private
 */
AudioHTML5Loader.prototype._play = function(position) {
    DEV && logger.debug(this, "_play", position);

    if (this.playing) {
        return;
    }

    this._breakStartup("play");

    this.ended = false;
    this.playing = true;
    this.position = position == null ? this.position || 0 : position;
    this._promiseMetadata().then(this.__startPlay, noop);
};

/** Пауза */
AudioHTML5Loader.prototype.pause = function() {
    DEV && logger.debug(this, "pause");

    this.playing = false;

    this._cancelWait("startPlaying", "pause");
    this._breakStartup("pause");

    this.audio.pause();
    this.position = this.audio.currentTime;
};

/**
 * Установить позицию воспроизведения
 * @param {Number} position - позиция воспроизведения
 */
AudioHTML5Loader.prototype.setPosition = function(position) {
    DEV && logger.debug(this, "setPosition", position);

    if (!isFinite(position)) {
        logger.warn(this, "setPositionFailed", position);
        return;
    }

    this.position = position;

    this._promiseMetadata().then(function() {
        this.audio.currentTime = this.position;
    }.bind(this), noop);
};

// =================================================================

//  Подключение/отключение источника для Web Audio API

// =================================================================
/**
 * Включить режим crossDomain для HTML5 плеера
 * @param {Boolean} state - включить/выключить
 */
AudioHTML5Loader.prototype.toggleCrossDomain = function(state) {
    if (state) {
        this.audio.crossOrigin = "anonymous";
    } else {
        this.audio.removeAttribute("crossOrigin");
    }

    this._restart();
};

/**
 * Создать источник для Web Audio API
 * !!!Внимание!!! - при использовании Web Audio API в браузере стоит учитывать, что все треки должны либо загружаться
 * с того же домена, либо для них должны быть правильно выставлены заголовки CORS.
 * При вызове данного метода трек будет перезапущен
 * @param {AudioContext} audioContext - контекст Web Audio API
 */
AudioHTML5Loader.prototype.createSource = function(audioContext) {
    if (this.output) {
        return;
    }

    DEV && logger.debug(this, "createSource");

    var needRestart = !this.audio.crossOrigin;

    this.audio.crossOrigin = "anonymous";
    this.output = audioContext.createMediaElementSource(this.audio);
    this.output.connect(audioContext.destination);

    if (needRestart) {
        this._restart();
    }
};

/**
 * Удалить источник для Web Audio API. Удаляет источник, пересоздаёт объект Audio.
 * !!!Внимание!!! - Данный метод можно вызывать только в обработчике пользовательского события, т.к. свежесозданный
 * элемент Audio нужно инициализировать - иначе будет недоступно воспроизведение. Инициализация элемента
 * Audio возможна только в обработчике пользовательского события (клик, тач-событие или клавиатурное событие)
 */
AudioHTML5Loader.prototype.destroySource = function() {
    //INFO: единственный способ оторвать MediaElementSource от Audio - создать новый объект Audio

    if (!this.output) {
        return;
    }

    logger.warn(this, "destroySource");

    this.output.disconnect();
    this.output = null;

    this._abortPromises("destroy");

    this._deinitAudio();
    this._initAudio();
    this._startupAudio();

    this._restart();
};

// =================================================================

//  Удаление всех обработчиков и объекта Audio

// =================================================================

/** Удаление всех обработчиков и объекта Audio. После вызова данного метода этот объект будет нельзя использовать */
AudioHTML5Loader.prototype.destroy = function() {
    DEV && logger.debug(this, "destroy");

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

AudioHTML5Loader.prototype._logger = function() {
    return {
        init: !!this.__initListener && this.__initListener.step,
        src: logger._showUrl(this.src),
        playing: this.playing,
        ended: this.ended,
        notLoading: this.notLoading,
        position: this.position
    };
};

module.exports = AudioHTML5Loader;

},{"../audio-static":4,"../error/playback-error":8,"../lib/async/deferred":28,"../lib/async/events":29,"../lib/noop":40,"../logger/logger":42}],26:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5');

var detect = require('../lib/browser/detect');
var Events = require('../lib/async/events');
var AudioStatic = require('../audio-static');

var AudioHTML5Loader = require('./audio-html5-loader');

var playerId = 1;

// =================================================================

//  Проверки доступности HTML5 Audio и Web Audio API

// =================================================================

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

if (detect.platform.mobile || detect.platform.tablet) {
    audioContext = null;
    logger.info(this, "WebAudioAPI not allowed for mobile");
} else {
    try {
        var audioContext = new AudioContext();
        logger.info(this, "WebAudioAPI context created");
    } catch(e) {
        audioContext = null;
        logger.info(this, "WebAudioAPI not detected");
    }
}

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Класс html5 аудио-плеера
 * @extends IAudioImplementation
 *
 * @fires IAudioImplementation#EVENT_PLAY
 * @fires IAudioImplementation#EVENT_ENDED
 * @fires IAudioImplementation#EVENT_VOLUME
 * @fires IAudioImplementation#EVENT_CRASHED
 * @fires IAudioImplementation#EVENT_SWAP
 *
 * @fires IAudioImplementation#EVENT_STOP
 * @fires IAudioImplementation#EVENT_PAUSE
 * @fires IAudioImplementation#EVENT_PROGRESS
 * @fires IAudioImplementation#EVENT_LOADING
 * @fires IAudioImplementation#EVENT_LOADED
 * @fires IAudioImplementation#EVENT_ERROR
 *
 * @constructor
 * @private
 */
var AudioHTML5 = function() {
    this.name = playerId++;
    DEV && logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            DEV && logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    this.webAudioApi = false;
    this.activeLoader = 0;
    this.volume = 1;
    this.loaders = [];

    this._addLoader();
    this._addLoader();

    this._setActive(0);
};
Events.mixin(AudioHTML5);
exports.type = AudioHTML5.type = AudioHTML5.prototype.type = "html5";

// =================================================================

//  Работа с загрузчиками

// =================================================================

/**
 * Добавить загрузчик аудио-файлов
 * @private
 */
AudioHTML5.prototype._addLoader = function() {
    DEV && logger.debug(this, "_addLoader");

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
    DEV && logger.debug(this, "_setActive", offset);

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

// =================================================================

//  Подключение Web Audio API

// =================================================================
/**
 * Включение режима CORS. ***ВАЖНО!*** - если включить режим CORS, аудио элемент не сможет загружать данные со
 * сторонних доменов, если в ответе не будет правильного заголовка Access-Control-Allow-Origin. Если не планируется
 * использование Web Audio API, не стоит включать этот режим.
 * @param state
 */
AudioHTML5.prototype.toggleCrossDomain = function(state) {
    this.loaders.forEach(function(loader) {
        loader.toggleCrossDomain(state);
    });
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
 * @param {ya.music.Audio~AudioPreprocessor} preprocessor - препроцессор
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

// =================================================================

//  Управление плеером

// =================================================================

/**
 * Проиграть трек
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 */
AudioHTML5.prototype.play = function(src, duration) {
    DEV && logger.debug(this, "play", src);

    var loader = this._getLoader();

    loader.load(src);
    loader.play(0);
};

/** Поставить трек на паузу */
AudioHTML5.prototype.pause = function() {
    DEV && logger.debug(this, "pause");
    var loader = this._getLoader();
    loader.pause();
};

/** Снять трек с паузы */
AudioHTML5.prototype.resume = function() {
    DEV && logger.debug(this, "resume");
    var loader = this._getLoader();
    loader.play();
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
AudioHTML5.prototype.stop = function(offset) {
    DEV && logger.debug(this, "stop", offset);
    var loader = this._getLoader(offset || 0);
    loader.stop();

    this.trigger(AudioStatic.EVENT_STOP, offset);
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
    DEV && logger.debug(this, "setPosition", position);
    this._getLoader().setPosition(position - 0.001); //THINK: legacy-код. Понять нафиг тут нужен 0.001
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
    DEV && logger.debug(this, "setVolume", volume);
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

// =================================================================

//  Предзагрузка

// =================================================================

/**
 * Предзагрузить трек
 * @param {String} src - Ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 */
AudioHTML5.prototype.preload = function(src, duration, offset) {
    DEV && logger.debug(this, "preload", src, offset);

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
    DEV && logger.debug(this, "playPreloaded", offset);
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(offset);

    if (!loader.src) {
        return false;
    }

    this._setActive(offset);
    loader.play();

    return true;
};

// =================================================================

//  Получение данных о плеере

// =================================================================

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

// =================================================================

//  Логирование

// =================================================================

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
AudioHTML5.prototype._logger = function() {
    try {
        return {
            main: logger._showUrl(this.getSrc(0)),
            preloader: logger._showUrl(this.getSrc(1))
        };
    } catch(e) {
        return "";
    }
};

exports.audioContext = audioContext;
exports.AudioImplementation = AudioHTML5;

},{"../audio-static":4,"../lib/async/events":29,"../lib/browser/detect":32,"../logger/logger":42,"./audio-html5-loader":25}],27:[function(require,module,exports){
var YandexAudio = require('./export');
require('./error/export');
require('./lib/net/error/export');
require('./logger/export');
require('./fx/equalizer/export');
require('./fx/volume/export');

module.exports = YandexAudio;

},{"./error/export":7,"./export":9,"./fx/equalizer/export":21,"./fx/volume/export":23,"./lib/net/error/export":38,"./logger/export":41}],28:[function(require,module,exports){
var Promise = require('./promise');
var noop = require('../noop');

/**
 * @classdesc Отложенное действие
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

},{"../noop":40,"./promise":30}],29:[function(require,module,exports){
var merge = require('../data/merge');

var LISTENERS_NAME = "_listeners";
var MUTE_OPTION = "_muted";

// =================================================================

//  Конструктор

// =================================================================

/**
 * @name Events
 * @class Диспетчер событий.
 * @noconstructor
 */
var Events = function() {
    /**
     * Контейнер для списков слушателей событий.
     * @alias Audio.Events#_listeners
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

// =================================================================

//  Всяческий сахар

// =================================================================

/**
 * Расширить произвольный класс свойствами диспетчера событий.
 * @param {Function} classConstructor Конструктор класса.
 * @returns {Function} тот же конструктор класса, расширенный свойствами диспетчера событий.
 * @static
 */
Events.mixin = function(classConstructor) {
    merge(classConstructor.prototype, Events.prototype, true);
    return classConstructor;
};

/**
 * Расширить произвольный объект свойствами диспетчера событий.
 * @param {Object} object Объект.
 * @returns {Object} тот же объект, расширенный свойствами диспетчера событий.
 */
Events.eventize = function(object) {
    merge(object, Events.prototype, true);
    Events.call(object);
    return object;
};

// =================================================================

//  Подписка и отписка от событий

// =================================================================

/**
 * Подписаться на событие (цепочный метод).
 * @param {String} event Имя события.
 * @param {function} callback Обработчик события.
 * @returns {Events} ссылку на контекст.
 */
Events.prototype.on = function(event, callback) {
    if (!this[LISTENERS_NAME][event]) {
        this[LISTENERS_NAME][event] = [];
    }

    this[LISTENERS_NAME][event].push(callback);
    return this;
};

/**
 * Отписаться от события (цепочный метод).
 * @param {String} event Имя события.
 * @param {function} callback Обработчик события.
 * @returns {Events} ссылку на контекст.
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
 * Подписаться на событие, отписаться сразу после первого возникновения события (цепочный метод).
 * @param {String} event Имя события.
 * @param {function} callback Обработчик события.
 * @returns {Events} ссылку на контекст.
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
 * Отписаться от всех слушателей событий (цепочный метод).
 * @returns {Events} ссылку на контекст.
 */
Events.prototype.clearListeners = function() {
    for (var key in this[LISTENERS_NAME]) {
        if (this[LISTENERS_NAME].hasOwnProperty(key)) {
            delete this[LISTENERS_NAME][key];
        }
    }

    return this;
};

// =================================================================

//  Триггер событий

// =================================================================

/**
 * Запустить событие (цепочный метод).
 * @param {String} event Имя события.
 * @param {...args} args Параметры для передачи вместе с событием.
 * @returns {Events} ссылку на контекст.
 * @private
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
 * Делегировать все события другому диспетчеру событий (цепочный метод).
 * @param {Events} acceptor Получатель событий.
 * @returns {Events} ссылку на контекст.
 * @private
 */
Events.prototype.pipeEvents = function(acceptor) {
    this.on("*", Events.prototype.trigger.bind(acceptor));
    return this;
};

// =================================================================

//  Включение/выключение триггера событий

// =================================================================

/**
 * Остановить запуск событий (цепочный метод).
 * @returns {Events} ссылку на контекст.
 */
Events.prototype.muteEvents = function() {
    this[MUTE_OPTION] = true;
    return this;
};

/**
 * Возобновить запуск событий (цепочный метод).
 * @returns {Events} ссылку на контекст.
 */
Events.prototype.unmuteEvents = function() {
    delete this[MUTE_OPTION];
    return this;
};

module.exports = Events;

},{"../data/merge":37}],30:[function(require,module,exports){
var vow = require('vow');
var detect = require('../browser/detect');

// =================================================================

// Promise

// =================================================================

/**
 * @see {@link https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise|ES 2015 Promise}
 * @class
 * @name Promise
 * @private
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
 * Создать обещание, разрешенное переданными данными.
 * @function
 * @name Promise.resolve
 * @param {*} data Данные, которыми разрешить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, отклоненное переданными данными.
 * @function
 * @name Promise.reject
 * @param {*} data Данные, которыми отклонить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, которое выполнится тогда, когда будут выполнены все переданные обещания.
 * @function
 * @name Promise.all
 * @param {Promise[]} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, которое выполнится тогда, когда будет выполнено хотя бы одно из переданных обещаний.
 * @name Promise.race
 * @function
 * @param {Promise[]} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Назначить обработчики разрешения и отклонения обещания.
 * @function
 * @name Promise#then
 * @param {function} callback Обработчик успеха.
 * @param {null|function} [errback] Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

/**
 * Назначить обработчик отклонения обещания.
 * @name Promise#catch
 * @function
 * @param {function} errback Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

// =================================================================

// AbortablePromise

// =================================================================

/**
 * @class Обещание с возможностью отмены связанного с ним действия.
 * <p>Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</xref>.</p>
 * @name AbortablePromise
 */

/**
 * Отмена действия связанного с обещанием. Абстрактный метод.
 * @abstract
 * @function
 * @name AbortablePromise#abort
 * @param {String|Error} reason Причина отмены действия.
 */

/**
 * Назначить обработчики разрешения и отклонения обещания.
 * <p>Унаследован от <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</xref>.</p>
 * @function
 * @name AbortablePromise#then
 * @inherited
 * @param {function} callback Обработчик успеха.
 * @param {null|function} [errback] Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

/**
 * Назначить обработчик отклонения обещания.
 * <p>Унаследован от <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</xref>.</p>
 * @name AbortablePromise#catch
 * @inherited
 * @function
 * @param {function} errback Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

},{"../browser/detect":32,"vow":2}],31:[function(require,module,exports){
var noop = require('../noop');
var Promise = require('./promise');

/**
 * Содание отклонённого обещания, которое не плюётся в консоль ошибкой
 * @param {Error} data - причина отклонения обещания
 * @returns {Promise}
 * @private
 */
var reject = function(data) {
    var promise = Promise.reject(data);
    promise["catch"](noop);
    return promise;
};

module.exports = reject;

},{"../noop":40,"./promise":30}],32:[function(require,module,exports){
var ua = navigator.userAgent.toLowerCase();

// =================================================================

//  Получение данных о браузере

// =================================================================

// Useragent RegExp
var ruc = /(ucbrowser)\/([\w.]+)/;
var rwebkit = /(webkit)[ \/]([\w.]+)/;
var ryabro = /(yabrowser)[ \/]([\w.]+)/;
var ropera = /(opr|opera)(?:.*version)?[ \/]([\w.]+)/;
var rmsie = /(msie) ([\w.]+)/;
var redge = /(edge)\/([\w.]+)/;
var rmmsie = /(iemobile)\/([\d\.]+)/;
var rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
var rsafari = /^((?!chrome).)*version\/([\d\w\.]+).*(safari)/;

var match = ruc.exec(ua)
    || rsafari.exec(ua)
    || ryabro.exec(ua)
    || redge.exec(ua)
    || rmmsie.exec(ua)
    || ropera.exec(ua)
    || rwebkit.exec(ua)
    || rmsie.exec(ua)
    || ua.indexOf("compatible") < 0 && rmozilla.exec(ua)
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

if (browser.name === "opr") {
    browser.name = "opera";
}

//INFO: IE (как всегда) не корректно выставляет user-agent
if (browser.name === "mozilla" && browser.version.split(".")[0] === "11") {
    browser.name = "msie";
}

// =================================================================

//  Получение данных о платформе

// =================================================================

// Useragent RegExp
var rplatform = /(windows phone|ipad|iphone|ipod|android|blackberry|playbook|windows ce|webos)/;
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
} else if (platform.type === "windows phone" || navigator.appVersion.indexOf("Win") !== -1) {
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

// =================================================================

//  Получение данных о возможности менять громкость

// =================================================================
var noVolume = true;
try {
    var audio = document.createElement('audio');
    audio.volume = 0.63;
    noVolume = Math.abs(audio.volume - 0.63) > 0.01;
} catch(e) {
    noVolume = true;
}

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

},{}],33:[function(require,module,exports){
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
	}();
	/* Cross-browser onDomLoad
		- Will fire an event as soon as the DOM of a web page is loaded
		- Internet Explorer workaround based on Diego Perini's solution: http://javascript.nwbox.com/IEContentLoaded/
		- Regular onload serves as fallback
	*/
	(function() {
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
	})();
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
	(function() {
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
	})();
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

},{}],34:[function(require,module,exports){
/**
 * Создаёт экземпляр класса, но не запускает его конструктор
 * @param {function} OriginalClass - класс
 * @returns {OriginalClass}
 * @private
 */
var clearInstance = function(OriginalClass) {
    var ClearClass = function() {};
    ClearClass.prototype = OriginalClass.prototype;
    return new ClearClass();
};

module.exports = clearInstance;

},{}],35:[function(require,module,exports){
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

},{"./clear-instance":34}],36:[function(require,module,exports){
var Events = require('../async/events');

//THINK: изучить как работает ES 2015 Proxy и попробовать использовать

/**
 * @classdesc Прокси-класс. Выдаёт наружу лишь публичные методы объекта и статические свойства.
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
 * @param {function} [ParentProxyClass=Proxy] - родительский класс
 * @returns {function} -- конструтор проксированного класса
 */
Proxy.createClass = function(OriginalClass, ParentProxyClass, excludeStatic) {

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

    if (!excludeStatic) {
        Proxy.exportStatic(OriginalClass, ProxyClass);
    }

    return ProxyClass;
};

module.exports = Proxy;

},{"../async/events":29}],37:[function(require,module,exports){
/**
 * Скопировать свойства всех перечисленных объектов в один.
 * @param {Object} initial - если последний аргумент true, то новый объект не создаётся, а используется данный
 * @param {...Object|Boolean} args - список объектов из которых копировать свойства. Последний аргумент может быть либо
 * объектом, либо true.
 * @returns {Object}
 * @private
 */
var merge = function(initial) {
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

},{}],38:[function(require,module,exports){
require('../../../export');

var LoaderError = require('./loader-error');

ya.music.Audio.LoaderError = LoaderError;

},{"../../../export":9,"./loader-error":39}],39:[function(require,module,exports){
var ErrorClass = require('../../class/error-class');

/**
 * @name Audio.LoaderError
 * @class Класс ошибок загрузчика.
 * <p>Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.</p>
 * @param {String} message Текст ошибки.
 *
 * @constructor
 */
var LoaderError = function(message) {
    ErrorClass.call(this, message);
};
LoaderError.prototype = ErrorClass.create("LoaderError");

/**
 * Таймаут загрузки.
 * @type String
 * @const
 * @name Audio.LoaderError.TIMEOUT
 */
LoaderError.TIMEOUT = "request timeout";
/**
 * Ошибка запроса на загрузку.
 * @type String
 * @const
 * @name Audio.LoaderError.FAILED
 */
LoaderError.FAILED = "request failed";

module.exports = LoaderError;

},{"../../class/error-class":35}],40:[function(require,module,exports){
/**
 * Заглушка в виде пустой функции на все случаи жизни
 * @private
 */
var noop = function() {};

module.exports = noop;

},{}],41:[function(require,module,exports){
require("../export");

var Logger = require('./logger');

ya.music.Audio.Logger = Logger;

},{"../export":9,"./logger":42}],42:[function(require,module,exports){
var LEVELS = ["debug", "log", "info", "warn", "error", "trace"];
var noop = require('../lib/noop');

// =================================================================

//  Конструктор

// =================================================================

/**
 * @name Audio.Logger
 * @class Настраиваемый логгер для аудиоплеера.
 * @param {String} channel Имя канала, за который будет отвечать экземляр логгера.
 * @constructor
 */
var Logger = function(channel) {
    this.channel = channel;
};

// =================================================================

//  Настройки

// =================================================================

/**
 * Список игнорируемых каналов.
 * @field
 * @type String[]
 * @name Audio.Logger.ignores
 */
Logger.ignores = [];

/**
 * Список отображаемых в консоли уровней лога.
 * @name Audio.Logger.logLevels
 * @field
 * @type String[]
 */
Logger.logLevels = [];

// =================================================================

//  Синтаксический сахар

// =================================================================

/**
 * Запись в лог с уровнем **debug**.
 * @function
 * @name Audio.Logger#debug
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.debug = noop;

/**
 * Запись в лог с уровнем **log**.
 * @name Audio.Logger#log
 * @function
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.log = noop;

/**
 * Запись в лог с уровнем **info**.
 * @function
 * @name Audio.Logger#info
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.info = noop;

/**
 * Запись в лог с уровнем **warn**.
 * @function
 * @name Audio.Logger#warn
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.warn = noop;

/**
 * Запись в лог с уровнем **error**.
 * @function
 * @name Audio.Logger#error
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.error = noop;

/**
 * Запись в лог с уровнем **trace**.
 * @function
 * @name Audio.Logger#trace
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.trace = noop;

/**
 * Метод для обработки ссылок передаваемых в лог.
 * @param url
 * @private
 */
Logger.prototype._showUrl = function(url) {
    return Logger.showUrl(url);
};

/**
 * Метод для обработки ссылок передаваемых в лог. Можно переопределять. По умолчанию не делает ничего.
 * @name Audio.Logger#showUrl
 * @param {String} url Ссылка.
 * @returns {String} ссылку.
 */
Logger.showUrl = function(url) {
    return url;
};

LEVELS.forEach(function(level) {
    Logger.prototype[level] = function() {
        var args = [].slice.call(arguments);
        args.unshift(this.channel);
        args.unshift(level);
        Logger.log.apply(Logger, args);
    };
});

// =================================================================

//  Запись данных в лог

// =================================================================

/**
 * Сделать запись в лог.
 * @function
 * @name Audio.Logger#log
 * @param {String} level Уровень лога.
 * @param {String} channel Канал.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
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
 * Запись в логе.
 * @typedef {Object} Audio.Logger.LogEntry
 * @property {Number} timestamp Время в timestamp формате.
 * @property {String} level Уровень лога.
 * @property {String} channel Канал.
 * @property {Object} context Контекст вызова.
 * @property {Array} message Дополнительные аргументы.
 *
 * @private
 */

/**
 * Записать сообщение лога в консоль
 * @param {ya.music.Audio.Logger~LogEntry} logEntry - сообщение лога
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

module.exports = Logger;

},{"../lib/noop":40}]},{},[27])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LmJhbmRzLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci1iYW5kLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXItc3RhdGljLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2V4cG9ydC5qcyIsInNyYy9meC9leHBvcnQuanMiLCJzcmMvZngvdm9sdW1lL2V4cG9ydC5qcyIsInNyYy9meC92b2x1bWUvdm9sdW1lLWxpYi5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9jbGVhci1pbnN0YW5jZS5qcyIsInNyYy9saWIvY2xhc3MvZXJyb3ItY2xhc3MuanMiLCJzcmMvbGliL2NsYXNzL3Byb3h5LmpzIiwic3JjL2xpYi9kYXRhL21lcmdlLmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yLmpzIiwic3JjL2xpYi9ub29wLmpzIiwic3JjL2xvZ2dlci9leHBvcnQuanMiLCJzcmMvbG9nZ2VyL2xvZ2dlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3akNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvNkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyoqXG4gKiBAbW9kdWxlIHZvd1xuICogQGF1dGhvciBGaWxhdG92IERtaXRyeSA8ZGZpbGF0b3ZAeWFuZGV4LXRlYW0ucnU+XG4gKiBAdmVyc2lvbiAwLjQuMTBcbiAqIEBsaWNlbnNlXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTCBsaWNlbnNlczpcbiAqICAgKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogICAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcblxudmFyIHVuZGVmLFxuICAgIG5leHRUaWNrID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZm5zID0gW10sXG4gICAgICAgICAgICBlbnF1ZXVlRm4gPSBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbnMucHVzaChmbikgPT09IDE7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2FsbEZucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBmbnNUb0NhbGwgPSBmbnMsIGkgPSAwLCBsZW4gPSBmbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZucyA9IFtdO1xuICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm5zVG9DYWxsW2krK10oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGlmKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicpIHsgLy8gaWUxMCwgbm9kZWpzID49IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0SW1tZWRpYXRlKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzLm5leHRUaWNrKSB7IC8vIG5vZGVqcyA8IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgcHJvY2Vzcy5uZXh0VGljayhjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgTXV0YXRpb25PYnNlcnZlciA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyOyAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgaWYoTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgICAgICAgdmFyIG51bSA9IDEsXG4gICAgICAgICAgICAgICAgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcblxuICAgICAgICAgICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2FsbEZucykub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGEgOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIChub2RlLmRhdGEgPSAobnVtICo9IC0xKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZ2xvYmFsLnBvc3RNZXNzYWdlKSB7XG4gICAgICAgICAgICB2YXIgaXNQb3N0TWVzc2FnZUFzeW5jID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBjaGVja0FzeW5jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1Bvc3RNZXNzYWdlQXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5wb3N0TWVzc2FnZSgnX19jaGVja0FzeW5jJywgJyonKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuZGV0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc1Bvc3RNZXNzYWdlQXN5bmMpIHtcbiAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ19fcHJvbWlzZScgKyArbmV3IERhdGUsXG4gICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGUuZGF0YSA9PT0gbXNnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24gJiYgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcj9cbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgZ2xvYmFsLnBvc3RNZXNzYWdlKG1zZywgJyonKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbiAgICAgICAgaWYoJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpKSB7IC8vIGllNi1pZThcbiAgICAgICAgICAgIHZhciBjcmVhdGVTY3JpcHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdCA9IHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgKGRvYy5kb2N1bWVudEVsZW1lbnQgfHwgZG9jLmJvZHkpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGNyZWF0ZVNjcmlwdCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbihmbikgeyAvLyBvbGQgYnJvd3NlcnNcbiAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0VGltZW91dChjYWxsRm5zLCAwKTtcbiAgICAgICAgfTtcbiAgICB9KSgpLFxuICAgIHRocm93RXhjZXB0aW9uID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9LFxuICAgIGlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogIT09IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCc7XG4gICAgfSxcbiAgICB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsXG4gICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiB0b1N0ci5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfSxcbiAgICBnZXRBcnJheUtleXMgPSBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdLFxuICAgICAgICAgICAgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7XG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGkrKyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGdldE9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICBmb3IodmFyIGkgaW4gb2JqKSB7XG4gICAgICAgICAgICBvYmouaGFzT3duUHJvcGVydHkoaSkgJiYgcmVzLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGRlZmluZUN1c3RvbUVycm9yVHlwZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdmFyIHJlcyA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlcy5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgd3JhcE9uRnVsZmlsbGVkID0gZnVuY3Rpb24ob25GdWxmaWxsZWQsIGlkeCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICBvbkZ1bGZpbGxlZC5jYWxsKHRoaXMsIHZhbCwgaWR4KTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4vKipcbiAqIEBjbGFzcyBEZWZlcnJlZFxuICogQGV4cG9ydHMgdm93OkRlZmVycmVkXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgRGVmZXJyZWRgIGNsYXNzIGlzIHVzZWQgdG8gZW5jYXBzdWxhdGUgbmV3bHktY3JlYXRlZCBwcm9taXNlIG9iamVjdCBhbG9uZyB3aXRoIGZ1bmN0aW9ucyB0aGF0IHJlc29sdmUsIHJlamVjdCBvciBub3RpZnkgaXQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBkZXNjcmlwdGlvblxuICogWW91IGNhbiB1c2UgYHZvdy5kZWZlcigpYCBpbnN0ZWFkIG9mIHVzaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gKlxuICogYG5ldyB2b3cuRGVmZXJyZWQoKWAgZ2l2ZXMgdGhlIHNhbWUgcmVzdWx0IGFzIGB2b3cuZGVmZXIoKWAuXG4gKi9cbnZhciBEZWZlcnJlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgUHJvbWlzZSgpO1xufTtcblxuRGVmZXJyZWQucHJvdG90eXBlID0gLyoqIEBsZW5kcyBEZWZlcnJlZC5wcm90b3R5cGUgKi97XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb21pc2UgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc29sdmVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIidzdWNjZXNzJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlc29sdmUoJ3N1Y2Nlc3MnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlamVjdHMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLmZhaWwoZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICogICAgIC8vIHJlYXNvbiBpcyBcIidzb21ldGhpbmcgaXMgd3JvbmcnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIucmVqZWN0KCdzb21ldGhpbmcgaXMgd3JvbmcnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZvdy5pc1Byb21pc2UocmVhc29uKSkge1xuICAgICAgICAgICAgcmVhc29uID0gcmVhc29uLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHZhbCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZShyZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTm90aWZpZXMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5wcm9ncmVzcyhmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIicyMCUnXCIsIFwiJzQwJSdcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5ub3RpZnkoJzIwJScpO1xuICAgICAqIGRlZmVyLm5vdGlmeSgnNDAlJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgbm90aWZ5IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fbm90aWZ5KHZhbHVlKTtcbiAgICB9XG59O1xuXG52YXIgUFJPTUlTRV9TVEFUVVMgPSB7XG4gICAgUEVORElORyAgIDogMCxcbiAgICBSRVNPTFZFRCAgOiAxLFxuICAgIEZVTEZJTExFRCA6IDIsXG4gICAgUkVKRUNURUQgIDogM1xufTtcblxuLyoqXG4gKiBAY2xhc3MgUHJvbWlzZVxuICogQGV4cG9ydHMgdm93OlByb21pc2VcbiAqIEBkZXNjcmlwdGlvblxuICogVGhlIGBQcm9taXNlYCBjbGFzcyBpcyB1c2VkIHdoZW4geW91IHdhbnQgdG8gZ2l2ZSB0byB0aGUgY2FsbGVyIHNvbWV0aGluZyB0byBzdWJzY3JpYmUgdG8sXG4gKiBidXQgbm90IHRoZSBhYmlsaXR5IHRvIHJlc29sdmUgb3IgcmVqZWN0IHRoZSBkZWZlcnJlZC5cbiAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZXIgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kI3RoZS1wcm9taXNlLWNvbnN0cnVjdG9yIGZvciBkZXRhaWxzLlxuICogQGRlc2NyaXB0aW9uXG4gKiBZb3Ugc2hvdWxkIHVzZSB0aGlzIGNvbnN0cnVjdG9yIGRpcmVjdGx5IG9ubHkgaWYgeW91IGFyZSBnb2luZyB0byB1c2UgYHZvd2AgYXMgRE9NIFByb21pc2VzIGltcGxlbWVudGF0aW9uLlxuICogSW4gb3RoZXIgY2FzZSB5b3Ugc2hvdWxkIHVzZSBgdm93LmRlZmVyKClgIGFuZCBgZGVmZXIucHJvbWlzZSgpYCBtZXRob2RzLlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiBmdW5jdGlvbiBmZXRjaEpTT04odXJsKSB7XG4gKiAgICAgcmV0dXJuIG5ldyB2b3cuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QsIG5vdGlmeSkge1xuICogICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gKiAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICogICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICogICAgICAgICB4aHIuc2VuZCgpO1xuICogICAgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgICBpZih4aHIucmVzcG9uc2UpIHtcbiAqICAgICAgICAgICAgICAgICByZXNvbHZlKHhoci5yZXNwb25zZSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgICAgICBlbHNlIHtcbiAqICAgICAgICAgICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcigpKTtcbiAqICAgICAgICAgICAgIH1cbiAqICAgICAgICAgfTtcbiAqICAgICB9KTtcbiAqIH1cbiAqIGBgYFxuICovXG52YXIgUHJvbWlzZSA9IGZ1bmN0aW9uKHJlc29sdmVyKSB7XG4gICAgdGhpcy5fdmFsdWUgPSB1bmRlZjtcbiAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5QRU5ESU5HO1xuXG4gICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IFtdO1xuXG4gICAgaWYocmVzb2x2ZXIpIHsgLy8gTk9URTogc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID0gcmVzb2x2ZXIubGVuZ3RoO1xuXG4gICAgICAgIHJlc29sdmVyKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDE/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID4gMj9cbiAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICB9IDpcbiAgICAgICAgICAgICAgICB1bmRlZik7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUgPSAvKiogQGxlbmRzIFByb21pc2UucHJvdG90eXBlICovIHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZnVsZmlsbGVkIHByb21pc2Ugb3IgdGhlIHJlYXNvbiBpbiBjYXNlIG9mIHJlamVjdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyAhPT0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuRlVMRklMTEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVqZWN0ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgcmVhY3Rpb25zIHRvIHRoZSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9IEEgbmV3IHByb21pc2UsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vcHJvbWlzZXMtYXBsdXMvcHJvbWlzZXMtc3BlYyBmb3IgZGV0YWlsc1xuICAgICAqL1xuICAgIHRoZW4gOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLl9hZGRDYWxsYmFja3MoZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKHVuZGVmaW5lZCwgb25SZWplY3RlZClgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCAncmVhc29uJyBhcyBhcmd1bWVudCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgJ2NhdGNoJyA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKG51bGwsIG9uUmVqZWN0ZWQpYC4gSXQncyBhbHNvIGFuIGFsaWFzIGZvciBgY2F0Y2hgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0byBiZSBjYWxsZWQgd2l0aCB0aGUgdmFsdWUgYWZ0ZXIgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZmFpbCA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcmVzb2x2aW5nIHJlYWN0aW9uIChmb3IgYm90aCBmdWxmaWxsbWVudCBhbmQgcmVqZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbihvblJlc29sdmVkLCBjdHgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgIGNiID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uUmVzb2x2ZWQuY2FsbCh0aGlzLCBfdGhpcyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oY2IsIGNiLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcHJvZ3Jlc3MgcmVhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblByb2dyZXNzIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIHdoZW4gdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24ob25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIHVuZGVmLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMaWtlIGBwcm9taXNlLnRoZW5gLCBidXQgXCJzcHJlYWRzXCIgdGhlIGFycmF5IGludG8gYSB2YXJpYWRpYyB2YWx1ZSBoYW5kbGVyLlxuICAgICAqIEl0IGlzIHVzZWZ1bCB3aXRoIHRoZSBgdm93LmFsbGAgYW5kIHRoZSBgdm93LmFsbFJlc29sdmVkYCBtZXRob2RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gICAgICogICAgIC8vIGFyZzEgaXMgXCIxXCIsIGFyZzIgaXMgXCIndHdvJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCd0d28nKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBzcHJlYWQgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25GdWxmaWxsZWQuYXBwbHkodGhpcywgdmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgdGhlbmAsIGJ1dCB0ZXJtaW5hdGVzIGEgY2hhaW4gb2YgcHJvbWlzZXMuXG4gICAgICogSWYgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWQsIHRoaXMgbWV0aG9kIHRocm93cyBpdCdzIFwicmVhc29uXCIgYXMgYW4gZXhjZXB0aW9uIGluIGEgZnV0dXJlIHR1cm4gb2YgdGhlIGV2ZW50IGxvb3AuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAqIGRlZmVyLnJlamVjdChFcnJvcignSW50ZXJuYWwgZXJyb3InKSk7XG4gICAgICogZGVmZXIucHJvbWlzZSgpLmRvbmUoKTsgLy8gZXhjZXB0aW9uIHRvIGJlIHRocm93blxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHRoaXNcbiAgICAgICAgICAgIC50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpXG4gICAgICAgICAgICAuZmFpbCh0aHJvd0V4Y2VwdGlvbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIGluIGBkZWxheWAgbWlsbGlzZWNvbmRzIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZCxcbiAgICAgKiBvciBpbW1lZGlhdGVseSByZWplY3RlZCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkZWxheSA6IGZ1bmN0aW9uKGRlbGF5KSB7XG4gICAgICAgIHZhciB0aW1lcixcbiAgICAgICAgICAgIHByb21pc2UgPSB0aGlzLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZGVsYXkpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHByb21pc2UuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVqZWN0ZWQgaW4gYHRpbWVvdXRgIG1pbGxpc2Vjb25kc1xuICAgICAqIGlmIHRoZSBwcm9taXNlIGlzIG5vdCByZXNvbHZlZCBiZWZvcmVoYW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDEgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCg1MCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDIgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCgyMDApO1xuICAgICAqXG4gICAgICogc2V0VGltZW91dChcbiAgICAgKiAgICAgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICBkZWZlci5yZXNvbHZlKCdvaycpO1xuICAgICAqICAgICB9LFxuICAgICAqICAgICAxMDApO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0MS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgcmVqZWN0ZWQgaW4gNTBtc1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0Mi50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHByb21pc2VXaXRoVGltZW91dCB0byBiZSBmdWxmaWxsZWQgd2l0aCBcIidvaydcIiB2YWx1ZVxuICAgICAqIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHRpbWVvdXQgOiBmdW5jdGlvbih0aW1lb3V0KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QobmV3IHZvdy5UaW1lZE91dEVycm9yKCd0aW1lZCBvdXQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB0aW1lb3V0KTtcblxuICAgICAgICB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBkZWZlci5wcm9taXNlKCkuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgX3ZvdyA6IHRydWUsXG5cbiAgICBfcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodmFsID09PSB0aGlzKSB7XG4gICAgICAgICAgICB0aGlzLl9yZWplY3QoVHlwZUVycm9yKCdDYW5cXCd0IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEO1xuXG4gICAgICAgIGlmKHZhbCAmJiAhIXZhbC5fdm93KSB7IC8vIHNob3J0cGF0aCBmb3Igdm93LlByb21pc2VcbiAgICAgICAgICAgIHZhbC5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgIHZhbC5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCh2YWwudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgICAgIHZhbC50aGVuKFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoaXNPYmplY3QodmFsKSB8fCBpc0Z1bmN0aW9uKHZhbCkpIHtcbiAgICAgICAgICAgIHZhciB0aGVuO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGVuID0gdmFsLnRoZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoZW4uY2FsbChcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3JlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgfHwgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsKTtcbiAgICB9LFxuXG4gICAgX2Z1bGZpbGwgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWw7XG5cbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MsIHZhbCk7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX3JlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gcmVhc29uO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MsIHJlYXNvbik7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX25vdGlmeSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzLCB2YWwpO1xuICAgIH0sXG5cbiAgICBfYWRkQ2FsbGJhY2tzIDogZnVuY3Rpb24oZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgaWYob25SZWplY3RlZCAmJiAhaXNGdW5jdGlvbihvblJlamVjdGVkKSkge1xuICAgICAgICAgICAgY3R4ID0gb25SZWplY3RlZDtcbiAgICAgICAgICAgIG9uUmVqZWN0ZWQgPSB1bmRlZjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9uUHJvZ3Jlc3MgJiYgIWlzRnVuY3Rpb24ob25Qcm9ncmVzcykpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUHJvZ3Jlc3M7XG4gICAgICAgICAgICBvblByb2dyZXNzID0gdW5kZWY7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2I7XG5cbiAgICAgICAgaWYoIXRoaXMuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBpc0Z1bmN0aW9uKG9uRnVsZmlsbGVkKT8gb25GdWxmaWxsZWQgOiB1bmRlZiwgY3R4IDogY3R4IH07XG4gICAgICAgICAgICB0aGlzLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0aGlzLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgIGNiID0geyBkZWZlciA6IGRlZmVyLCBmbiA6IG9uUmVqZWN0ZWQsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5fc3RhdHVzIDw9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcy5wdXNoKHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblByb2dyZXNzLCBjdHggOiBjdHggfSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2NhbGxDYWxsYmFja3MgOiBmdW5jdGlvbihjYWxsYmFja3MsIGFyZykge1xuICAgICAgICB2YXIgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDtcbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlzUmVzb2x2ZWQgPSB0aGlzLmlzUmVzb2x2ZWQoKSxcbiAgICAgICAgICAgIGlzRnVsZmlsbGVkID0gdGhpcy5pc0Z1bGZpbGxlZCgpO1xuXG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGkgPSAwLCBjYiwgZGVmZXIsIGZuO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNiID0gY2FsbGJhY2tzW2krK107XG4gICAgICAgICAgICAgICAgZGVmZXIgPSBjYi5kZWZlcjtcbiAgICAgICAgICAgICAgICBmbiA9IGNiLmZuO1xuXG4gICAgICAgICAgICAgICAgaWYoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN0eCA9IGNiLmN0eCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGN0eD8gZm4uY2FsbChjdHgsIGFyZykgOiBmbihhcmcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0Z1bGZpbGxlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKGFyZykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLm5vdGlmeShhcmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuLyoqIEBsZW5kcyBQcm9taXNlICovXG52YXIgc3RhdGljTWV0aG9kcyA9IHtcbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsbCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYWxsKGl0ZXJhYmxlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGVuIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByYWNlIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbnlSZXNvbHZlZChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXNvbHZlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGhhdmUgYHZhbHVlYCdzIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuZm9yKHZhciBwcm9wIGluIHN0YXRpY01ldGhvZHMpIHtcbiAgICBzdGF0aWNNZXRob2RzLmhhc093blByb3BlcnR5KHByb3ApICYmXG4gICAgICAgIChQcm9taXNlW3Byb3BdID0gc3RhdGljTWV0aG9kc1twcm9wXSk7XG59XG5cbnZhciB2b3cgPSAvKiogQGV4cG9ydHMgdm93ICovIHtcbiAgICBEZWZlcnJlZCA6IERlZmVycmVkLFxuXG4gICAgUHJvbWlzZSA6IFByb21pc2UsXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IGRlZmVycmVkLiBUaGlzIG1ldGhvZCBpcyBhIGZhY3RvcnkgbWV0aG9kIGZvciBgdm93OkRlZmVycmVkYCBjbGFzcy5cbiAgICAgKiBJdCdzIGVxdWl2YWxlbnQgdG8gYG5ldyB2b3cuRGVmZXJyZWQoKWAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm93OkRlZmVycmVkfVxuICAgICAqL1xuICAgIGRlZmVyIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVmZXJyZWQoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudGhlbmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHdoZW4gOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LmNhc3QodmFsdWUpLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmZhaWxgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbih2YWx1ZSwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSwgdW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmFsd2F5c2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbih2YWx1ZSwgb25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuYWx3YXlzKG9uUmVzb2x2ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnByb2dyZXNzYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24odmFsdWUsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLnByb2dyZXNzKG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnNwcmVhZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5zcHJlYWQob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRvbmVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2b3cud2hlbih2YWx1ZSkuZG9uZShvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGB2YWx1ZWAgaXMgYSBwcm9taXNlLWxpa2Ugb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdm93LmlzUHJvbWlzZSgnc29tZXRoaW5nJyk7IC8vIHJldHVybnMgZmFsc2VcbiAgICAgKiB2b3cuaXNQcm9taXNlKHZvdy5kZWZlcigpLnByb21pc2UoKSk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIHZvdy5pc1Byb21pc2UoeyB0aGVuIDogZnVuY3Rpb24oKSB7IH0pOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpc1Byb21pc2UgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIGlzRnVuY3Rpb24odmFsdWUudGhlbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvZXJjZXMgdGhlIGdpdmVuIGB2YWx1ZWAgdG8gYSBwcm9taXNlLCBvciByZXR1cm5zIHRoZSBgdmFsdWVgIGlmIGl0J3MgYWxyZWFkeSBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGNhc3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgISF2YWx1ZS5fdm93P1xuICAgICAgICAgICAgdmFsdWUgOlxuICAgICAgICAgICAgdm93LnJlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS52YWx1ZU9mYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgdmFsdWVPZiA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNGdWxmaWxsZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc0Z1bGZpbGxlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzRnVsZmlsbGVkKT8gdmFsdWUuaXNGdWxmaWxsZWQoKSA6IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzUmVqZWN0ZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNSZWplY3RlZCk/IHZhbHVlLmlzUmVqZWN0ZWQoKSA6IGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1Jlc29sdmVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZXNvbHZlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVzb2x2ZWQpPyB2YWx1ZS5pc1Jlc29sdmVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciByZXMgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgcmVzLnJlc29sdmUodmFsdWUpO1xuICAgICAgICByZXR1cm4gcmVzLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIGZ1bGZpbGxlZCB3aXRoIHRoZSBmdWxmaWxsL3JlamVjdGlvbiB2YWx1ZSBvZiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmdWxmaWxsIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICAgICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuXG4gICAgICAgIGRlZmVyLnJlc29sdmUodmFsdWUpO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICBwcm9taXNlIDpcbiAgICAgICAgICAgIHByb21pc2UudGhlbihudWxsLCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVhc29uO1xuICAgICAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKiBJZiBgcmVhc29uYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VzIHRoZSBnaXZlbiBmdW5jdGlvbiBgZm5gIHdpdGggYXJndW1lbnRzIGBhcmdzYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICAgKiBAcGFyYW0gey4uLip9IFthcmdzXVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgcHJvbWlzZTEgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICogICAgIH0sICdvaycpLFxuICAgICAqICAgICBwcm9taXNlMiA9IHZvdy5pbnZva2UoZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICB0aHJvdyBFcnJvcigpO1xuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2UxLmlzRnVsZmlsbGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMS52YWx1ZU9mKCk7IC8vICdvaydcbiAgICAgKiBwcm9taXNlMi5pc1JlamVjdGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIGluc3RhbmNlIG9mIEVycm9yXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaW52b2tlIDogZnVuY3Rpb24oZm4sIGFyZ3MpIHtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWF4KGFyZ3VtZW50cy5sZW5ndGggLSAxLCAwKSxcbiAgICAgICAgICAgIGNhbGxBcmdzO1xuICAgICAgICBpZihsZW4pIHsgLy8gb3B0aW1pemF0aW9uIGZvciBWOFxuICAgICAgICAgICAgY2FsbEFyZ3MgPSBBcnJheShsZW4pO1xuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNhbGxBcmdzW2krK10gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKGNhbGxBcmdzP1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KGdsb2JhbCwgY2FsbEFyZ3MpIDpcbiAgICAgICAgICAgICAgICBmbi5jYWxsKGdsb2JhbCkpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggYXJyYXk6XG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKSwgM10pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJbMSwgMiwgM11cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggb2JqZWN0OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoeyBwMSA6IGRlZmVyMS5wcm9taXNlKCksIHAyIDogZGVmZXIyLnByb21pc2UoKSwgcDMgOiAzIH0pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJ7IHAxIDogMSwgcDIgOiAyLCBwMyA6IDMgfVwiIGhlcmVcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgyKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGxlbiA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSA9IGxlbjtcbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgICAgICAgICAgcmVzW2tleXNbaWR4XV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBpZighLS1pKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGxSZXNvbHZlZChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihwcm9taXNlMSwgcHJvbWlzZTIpIHtcbiAgICAgKiAgICAgcHJvbWlzZTEuaXNSZWplY3RlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTEudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ2Vycm9yJ1wiXG4gICAgICogICAgIHByb21pc2UyLmlzRnVsZmlsbGVkKCk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqICAgICBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIHJldHVybnMgXCInb2snXCJcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZWplY3QoJ2Vycm9yJyk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoJ29rJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsUmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGkgPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighaSkge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvblJlc29sdmVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLS1pIHx8IGRlZmVyLnJlc29sdmUoaXRlcmFibGUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIG9uUmVzb2x2ZWQsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICBhbGxQYXRpZW50bHkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbFJlc29sdmVkKGl0ZXJhYmxlKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLCBmdWxmaWxsZWRQcm9taXNlcyxcbiAgICAgICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCwgaSA9IDAsIGtleSwgcHJvbWlzZTtcblxuICAgICAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XG4gICAgICAgICAgICAgICAgcHJvbWlzZSA9IGl0ZXJhYmxlW2tleV07XG4gICAgICAgICAgICAgICAgaWYodm93LmlzUmVqZWN0ZWQocHJvbWlzZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcyB8fCAocmVqZWN0ZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSk7XG4gICAgICAgICAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMucHVzaChwcm9taXNlLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlc1trZXldID0gcHJvbWlzZS52YWx1ZU9mKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYoIXJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgKGZ1bGZpbGxlZFByb21pc2VzIHx8IChmdWxmaWxsZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSkpW2tleV0gPSB2b3cudmFsdWVPZihwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyByZWplY3RlZFByb21pc2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVsZmlsbGVkUHJvbWlzZXM7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpZiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFsbCBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXQgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgKHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcmVqZWN0ZWQgaXRlbSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSAwLCByZWFzb247XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpIHx8IChyZWFzb24gPSBlKTtcbiAgICAgICAgICAgICAgICArK2kgPT09IGxlbiAmJiBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBpcyBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnlSZXNvbHZlZCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChFcnJvcigpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBkZWZlci5yZWplY3QsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZGVsYXlgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbih2YWx1ZSwgZGVsYXkpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS5kZWxheShkZWxheSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRpbWVvdXRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odmFsdWUsIHRpbWVvdXQpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS50aW1lb3V0KHRpbWVvdXQpO1xuICAgIH0sXG5cbiAgICBfZm9yRWFjaCA6IGZ1bmN0aW9uKHByb21pc2VzLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4LCBrZXlzKSB7XG4gICAgICAgIHZhciBsZW4gPSBrZXlzPyBrZXlzLmxlbmd0aCA6IHByb21pc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIGkgPSAwO1xuXG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHZvdy53aGVuKFxuICAgICAgICAgICAgICAgIHByb21pc2VzW2tleXM/IGtleXNbaV0gOiBpXSxcbiAgICAgICAgICAgICAgICB3cmFwT25GdWxmaWxsZWQob25GdWxmaWxsZWQsIGkpLFxuICAgICAgICAgICAgICAgIG9uUmVqZWN0ZWQsXG4gICAgICAgICAgICAgICAgb25Qcm9ncmVzcyxcbiAgICAgICAgICAgICAgICBjdHgpO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIFRpbWVkT3V0RXJyb3IgOiBkZWZpbmVDdXN0b21FcnJvclR5cGUoJ1RpbWVkT3V0Jylcbn07XG5cbnZhciBkZWZpbmVBc0dsb2JhbCA9IHRydWU7XG5pZih0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB2b3c7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuaWYodHlwZW9mIG1vZHVsZXMgPT09ICdvYmplY3QnICYmIGlzRnVuY3Rpb24obW9kdWxlcy5kZWZpbmUpKSB7XG4gICAgbW9kdWxlcy5kZWZpbmUoJ3ZvdycsIGZ1bmN0aW9uKHByb3ZpZGUpIHtcbiAgICAgICAgcHJvdmlkZSh2b3cpO1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24ocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmRlZmluZUFzR2xvYmFsICYmIChnbG9iYWwudm93ID0gdm93KTtcblxufSkodGhpcyk7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9QbGF5ZXInKTtcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9wcm9taXNlJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbGliL2RhdGEvbWVyZ2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9yZWplY3QnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL2F1ZGlvLWVycm9yJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuL2F1ZGlvLXN0YXRpYycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutCwINC00L7RgdGC0YPQv9C90YvRhSDRgtC40L/QvtCyINGA0LXQsNC70LjQt9Cw0YbQuNC5INC4INC40YUg0L/RgNC40L7RgNC40YLQtdGC0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy9UT0RPOiDRgdC00LXQu9Cw0YLRjCDQuNC90YLQtdGA0YTQtdC50YEg0LTQu9GPINCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyDQvdC+0LLRi9GFINGC0LjQv9C+0LJcbnZhciBhdWRpb1R5cGVzID0ge1xuICAgIGh0bWw1OiByZXF1aXJlKCcuL2h0bWw1L2F1ZGlvLWh0bWw1JyksXG4gICAgZmxhc2g6IHJlcXVpcmUoJy4vZmxhc2gvYXVkaW8tZmxhc2gnKVxufTtcblxudmFyIGRldGVjdFN0cmluZyA9IFwiQFwiICsgZGV0ZWN0LnBsYXRmb3JtLnZlcnNpb24gK1xuICAgIFwiIFwiICsgZGV0ZWN0LnBsYXRmb3JtLm9zICtcbiAgICBcIjpcIiArIGRldGVjdC5icm93c2VyLm5hbWUgK1xuICAgIFwiL1wiICsgZGV0ZWN0LmJyb3dzZXIudmVyc2lvbjtcblxuYXVkaW9UeXBlcy5mbGFzaC5wcmlvcml0eSA9IDA7XG5hdWRpb1R5cGVzLmh0bWw1LnByaW9yaXR5ID0gY29uZmlnLmh0bWw1LmJsYWNrbGlzdC5zb21lKGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIGRldGVjdFN0cmluZy5tYXRjaChpdGVtKTsgfSkgPyAtMSA6IDE7XG5cbi8vSU5GTzog0L/RgNGP0Lwg0LIg0LzQvtC80LXQvdGCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INCy0YHQtdCz0L4g0LzQvtC00YPQu9GPINC90LXQu9GM0LfRjyDQv9C40YHQsNGC0Ywg0LIg0LvQvtCzIC0g0L7QvSDQv9GA0L7Qs9C70LDRgtGL0LLQsNC10YIg0YHQvtC+0LHRidC10L3QuNGPLCDRgi7Qui4g0LXRidC1INC90LXRgiDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC90LDRgdGC0YDQvtC40YLRjCDQu9C+0LPQs9C10YAuXG5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHtcbiAgICAgICAgZmxhc2g6IHtcbiAgICAgICAgICAgIGF2YWlsYWJsZTogYXVkaW9UeXBlcy5mbGFzaC5hdmFpbGFibGUsXG4gICAgICAgICAgICBwcmlvcml0eTogYXVkaW9UeXBlcy5mbGFzaC5wcmlvcml0eVxuICAgICAgICB9LFxuICAgICAgICBodG1sNToge1xuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdWRpb1R5cGVzLmh0bWw1LmF2YWlsYWJsZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiBhdWRpb1R5cGVzLmh0bWw1LnByaW9yaXR5LFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0OiAhIWF1ZGlvVHlwZXMuaHRtbDUuYXVkaW9Db250ZXh0XG4gICAgICAgIH1cbiAgICB9LCBcImF1ZGlvVHlwZXNcIik7XG59LCAwKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDQstGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdGL0LUg0LrQu9Cw0YHRgdGLXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7Qv9C40YHQsNC90LjQtSDQstGA0LXQvNC10L3QvdGL0YUg0LTQsNC90L3Ri9GFINC/0LvQtdC10YDQsC5cbiAqIEB0eXBlZGVmIHtPYmplY3R9IEF1ZGlvLkF1ZGlvUGxheWVyVGltZXNcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBkdXJhdGlvbiDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsC5cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBsb2FkZWQg0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuC5cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwb3NpdGlvbiDQn9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAcHJvcGVydHkge051bWJlcn0gcGxheWVkINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDQntCx0YnQuNC1INGB0L7QsdGL0YLQuNGPINC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAbmFtZSBBdWRpbyNFVkVOVF9QTEFZXG4gKiBAZXZlbnRcbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAbmFtZSBBdWRpbyNFVkVOVF9FTkRFRFxuICogQGV2ZW50XG4gKi9cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINCz0YDQvtC80LrQvtGB0YLQuC5cbiAqIEBuYW1lIEF1ZGlvI0VWRU5UX1ZPTFVNRVxuICogQGV2ZW50XG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lINCd0L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LguXG4gKi9cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LrRgNCw0YXQsCDQv9C70LXQtdGA0LAuXG4gKiBAbmFtZSBBdWRpbyNFVkVOVF9DUkFTSEVEXG4gKiBAZXZlbnRcbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDRgdC80LXQvdGLINGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsFxuICogQG5hbWUgQXVkaW8jRVZFTlRfU1RBVEVcbiAqIEBldmVudFxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlINCd0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsC5cbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQv9C10YDQtdC60LvRjtGH0LXQvdC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuCDQv9GA0LXQu9C+0LDQtNC10YDQsC5cbiAqIEBuYW1lIEF1ZGlvI0VWRU5UX1NXQVBcbiAqIEBldmVudFxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQzog0YHQvtCx0YvRgtC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAbmFtZSBBdWRpbyNFVkVOVF9TVE9QXG4gKiBAZXZlbnRcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC/0LDRg9C30Ysg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQG5hbWUgQXVkaW8jRVZFTlRfUEFVU0VcbiAqIEBldmVudFxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPL9C30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuC5cbiAqIEBuYW1lIEF1ZGlvI0VWRU5UX1BST0dSRVNTXG4gKiBAZXZlbnRcbiAqIEBwYXJhbSB7QXVkaW8uQXVkaW9QbGF5ZXJUaW1lc30gdGltZXMg0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwLlxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsC5cbiAqIEBuYW1lIEF1ZGlvI0VWRU5UX0xPQURJTkdcbiAqIEBldmVudFxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwLlxuICogQG5hbWUgQXVkaW8jRVZFTlRfTE9BREVEXG4gKiBAZXZlbnRcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAbmFtZSBBdWRpbyNFVkVOVF9FUlJPUlxuICogQGV2ZW50XG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7RgdGC0LDQvdC+0LLQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBuYW1lIEF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9TVE9QXG4gKiBAZXZlbnRcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7Qt9C40YbQuNC4INC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuC5cbiAqIEBuYW1lIEF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9QUk9HUkVTU1xuICogQGV2ZW50XG4gKiBAcGFyYW0ge0F1ZGlvLkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsC5cbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LAuXG4gKiBAZXZlbnRcbiAqIEBuYW1lIEF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9MT0FESU5HXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LAuXG4gKiBAZXZlbnRcbiAqIEBuYW1lIEF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9MT0FERURcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAZXZlbnRcbiAqIEBuYW1lIEF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9FUlJPUlxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzINCQ0YPQtNC40L7Qv9C70LXQtdGAINC00LvRjyDQsdGA0LDRg9C30LXRgNCwLlxuICogQG5hbWUgQXVkaW9cbiAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZmVycmVkVHlwZV0g0J/RgNC10LTQv9C+0YfQuNGC0LDQtdC80YvQuSDRgtC40L8g0L/Qu9C10LXRgNCwLiDQnNC+0LbQtdGCINC/0YDQuNC90LjQvNCw0YLRjCDQt9C90LDRh9C10L3QuNGPOiBcImh0bWw1XCIsIFwiZmxhc2hcIiDQuNC70LhcbiAqINC70Y7QsdC+0LUg0LvQvtC20L3QvtC1INC30L3QsNGH0LXQvdC40LUgKGZhbHNlLCBudWxsLCB1bmRlZmluZWQsIDAsIFwiXCIpLiDQldGB0LvQuCDQstGL0LHRgNCw0L3QvdGL0Lkg0YLQuNC/INC/0LvQtdC10YDQsCDQvtC60LDQttC10YLRgdGPINC90LXQtNC+0YHRgtGD0L/QtdC9LCDQsdGD0LTQtdGCINC30LDQv9GD0YnQtdC9XG4gKiDQvtGB0YLQsNCy0YjQuNC50YHRjyDRgtC40L8uINCV0YHQu9C4INGD0LrQsNC30LDQvdC+INC70L7QttC90L7QtSDQt9C90LDRh9C10L3QuNC1INC70LjQsdC+INC/0LDRgNCw0LzQtdGC0YAg0L3QtSDQv9C10YDQtdC00LDQvSwg0YLQviBBUEkg0LDQstGC0L7QvNCw0YLQuNGH0LXRgdC60Lgg0LLRi9Cx0LXRgNC10YIg0L/QvtC00LTQtdGA0LbQuNCy0LDQtdC80YvQuSDRgtC40L8g0L/Qu9C10LXRgNCwLlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW292ZXJsYXldIEhUTUwt0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPIEZsYXNoLdCw0L/Qv9C70LXRgtCwLlxuICogQG1peGVzIEF1ZGlvU3RhdGljXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqIEBleHRlbmRzIDx4cmVmIHNjb3BlPVwiZXh0ZXJuYWxcIiBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3JcIj5FcnJvcjwveHJlZj5cbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1RBVEVcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9TV0FQXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QQVVTRVxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0VSUk9SXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9TVE9QXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfTE9BREVEXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBBdWRpb1BsYXllciA9IGZ1bmN0aW9uKHByZWZlcnJlZFR5cGUsIG92ZXJsYXkpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVmZXJyZWRUeXBlID0gcHJlZmVycmVkVHlwZTtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuc3RhdGUgPSBBdWRpb1BsYXllci5TVEFURV9JTklUO1xuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX3BsYXlJZCA9IG51bGw7XG5cbiAgICB0aGlzLl93aGVuUmVhZHkgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICB0aGlzLndoZW5SZWFkeSA9IHRoaXMuX3doZW5SZWFkeS5wcm9taXNlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJpbXBsZW1lbnRhdGlvbiBmb3VuZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24ub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50LCBvZmZzZXQsIGRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3BvcHVsYXRlRXZlbnRzKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuXG4gICAgICAgICAgICBpZiAoIW9mZnNldCkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9QTEFZOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VOREVEOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVA6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9FUlJPUjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwib25FbmRlZFwiLCBldmVudCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9JRExFKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUEFVU0U6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OLCBlKTtcblxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9DUkFTSEVEKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5faW5pdCgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9QbGF5ZXIpO1xubWVyZ2UoQXVkaW9QbGF5ZXIsIEF1ZGlvU3RhdGljLCB0cnVlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0YLQsNGC0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC00L7RgdGC0YPQv9C90YvRhSDQv9C70LXQtdGA0L7QslxuICogQHR5cGUge09iamVjdH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuaW5mbyA9IHtcbiAgICBodG1sNTogYXVkaW9UeXBlcy5odG1sNS5hdmFpbGFibGUsXG4gICAgZmxhc2g6IGF1ZGlvVHlwZXMuZmxhc2guYXZhaWxhYmxlXG59O1xuXG4vKipcbiAqINCa0L7QvdGC0LXQutGB0YIg0LTQu9GPIFdlYiBBdWRpbyBBUEkuXG4gKiBAdHlwZSBBdWRpb0NvbnRleHRcbiAqIEBmaWVsZFxuICogQG5hbWUgQXVkaW8uYXVkaW9Db250ZXh0XG4gKiBAc3RhdGljXG4gKi9cbkF1ZGlvUGxheWVyLmF1ZGlvQ29udGV4dCA9IGF1ZGlvVHlwZXMuaHRtbDUuYXVkaW9Db250ZXh0O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwLlxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlINCd0L7QstGL0Lkg0YHRgtCw0YLRg9GBLlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9zZXRTdGF0ZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zZXRTdGF0ZVwiLCBzdGF0ZSk7XG5cbiAgICBpZiAoc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCAmJiB0aGlzLnN0YXRlICE9PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgY2hhbmdlZCA9IHRoaXMuc3RhdGUgIT09IHN0YXRlO1xuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcblxuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwibmV3U3RhdGVcIiwgc3RhdGUpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9QbGF5ZXIuRVZFTlRfU1RBVEUsIHN0YXRlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsC5cbiAqIEBwYXJhbSB7aW50fSBbcmV0cnk9MF0g0JrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0LouXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbihyZXRyeSkge1xuICAgIHJldHJ5ID0gcmV0cnkgfHwgMDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0XCIsIHJldHJ5KTtcblxuICAgIGlmICghdGhpcy5fd2hlblJlYWR5LnBlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChyZXRyeSA+IGNvbmZpZy5hdWRpby5yZXRyeSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTik7XG4gICAgICAgIHRoaXMuX3doZW5SZWFkeS5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTikpO1xuICAgIH1cblxuICAgIHZhciBpbml0U2VxID0gW1xuICAgICAgICBhdWRpb1R5cGVzLmh0bWw1LFxuICAgICAgICBhdWRpb1R5cGVzLmZsYXNoXG4gICAgXS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgaWYgKGEuYXZhaWxhYmxlICE9PSBiLmF2YWlsYWJsZSkge1xuICAgICAgICAgICAgcmV0dXJuIGEuYXZhaWxhYmxlID8gLTEgOiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGEuQXVkaW9JbXBsZW1lbnRhdGlvbi50eXBlID09PSB0aGlzLnByZWZlcnJlZFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChiLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICAgICAgdmFyIHR5cGUgPSBpbml0U2VxLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgICAgICBzZWxmLl9pbml0KHJldHJ5ICsgMSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLl9pbml0VHlwZSh0eXBlKS50aGVuKHNlbGYuX3doZW5SZWFkeS5yZXNvbHZlLCBpbml0KTtcbiAgICB9XG5cbiAgICBpbml0KCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHQuiDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAg0YEg0YPQutCw0LfQsNC90L3Ri9C8INGC0LjQv9C+0LxcbiAqIEBwYXJhbSB7e3R5cGU6IHN0cmluZywgQXVkaW9JbXBsZW1lbnRhdGlvbjogZnVuY3Rpb259fSB0eXBlIC0g0L7QsdGK0LXQutGCINC+0L/QuNGB0LDQvdC40Y8g0YLQuNC/0LAg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5faW5pdFR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfaW5pdFR5cGVcIiwgdHlwZSk7XG5cbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICB0cnkge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KLQtdC60YPRidCw0Y8g0YDQtdCw0LvQuNC30LDRhtC40Y8g0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge0lBdWRpb0ltcGxlbWVudGF0aW9ufG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uID0gbmV3IHR5cGUuQXVkaW9JbXBsZW1lbnRhdGlvbih0aGlzLm92ZXJsYXkpO1xuICAgICAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi53aGVuUmVhZHkpIHtcbiAgICAgICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24ud2hlblJlYWR5LnRoZW4oZGVmZXJyZWQucmVzb2x2ZSwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZSk7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiX2luaXRUeXBlRXJyb3JcIiwgdHlwZSwgZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/RgNC4INC+0LTQvdC+0Lwg0LjQtyDRgdC/0LjRgdC60LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb24gLSDQvdCw0LfQstCw0L3QuNC1INC00LXQudGB0YLQstC40Y9cbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IHJlc29sdmUgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9GFINGB0L7QsdGL0YLQuNC5INC00LvRjyDRgNCw0LfRgNC10YjQtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZWplY3QgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9C5INGB0L7QsdGL0YLQuNC5INC00LvRjyDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0YLQsNC60LbQtSDRgdC+0LfQtNCw0LXRgiBEZWZlcnJlZCDRgdCy0L7QudGB0YLQstC+INGBINC90LDQt9Cy0LDQvdC40LXQvCBfd2hlbjxBY3Rpb24+LCDQutC+0YLQvtGA0L7QtSDQttC40LLQtdGCINC00L4g0LzQvtC80LXQvdGC0LAg0YDQsNC30YDQtdGI0LXQvdC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fd2FpdEV2ZW50cyA9IGZ1bmN0aW9uKGFjdGlvbiwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpc1thY3Rpb25dID0gZGVmZXJyZWQ7XG5cbiAgICB2YXIgY2xlYW51cEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHNlbGYub2ZmKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGV0ZSBzZWxmW2FjdGlvbl07XG4gICAgfTtcblxuICAgIHJlc29sdmUuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICB9KTtcblxuICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHNlbGYub24oZXZlbnQsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IGRhdGEgaW5zdGFuY2VvZiBFcnJvciA/IGRhdGEgOiBuZXcgQXVkaW9FcnJvcihkYXRhIHx8IGV2ZW50KTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZSgpLnRoZW4oY2xlYW51cEV2ZW50cywgY2xlYW51cEV2ZW50cyk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQtdC90LjQtSDRgdC+0LHRi9GC0LjQuSDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C80Lgg0YHQstC+0LnRgdGC0LLQsNC80LguINCf0L7QtNC/0LjRgdGL0LLQsNC10YLRgdGPINC90LAg0LLRgdC1INGB0L7QsdGL0YLQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwLFxuICog0YLRgNC40LPQs9C10YDQuNGCINC40YLQvtCz0L7QstGL0LUg0YHQvtCx0YvRgtC40Y8sINGA0LDQt9C00LXQu9GP0Y8g0LjRhSDQv9C+INGC0LjQv9GDINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALCDQtNC+0L/QvtC70L3Rj9C10YIg0YHQvtCx0YvRgtC40Y8g0LTQsNC90L3Ri9C80LguXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtINC40YHRgtC+0YfQvdC40Log0YHQvtCx0YvRgtC40Y8uIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fcG9wdWxhdGVFdmVudHMgPSBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKGV2ZW50ICE9PSBBdWRpb1BsYXllci5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BvcHVsYXRlRXZlbnRzXCIsIGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH1cblxuICAgIHZhciBvdXRlckV2ZW50ID0gKG9mZnNldCA/IEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCA6IFwiXCIpICsgZXZlbnQ7XG5cbiAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZXJyb3JcIiwgb3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9WT0xVTUU6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIHRoaXMuZ2V0Vm9sdW1lKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1M6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aGlzLmdldER1cmF0aW9uKG9mZnNldCksXG4gICAgICAgICAgICAgICAgbG9hZGVkOiB0aGlzLmdldExvYWRlZChvZmZzZXQpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvZmZzZXQgPyAwIDogdGhpcy5nZXRQb3NpdGlvbigpLFxuICAgICAgICAgICAgICAgIHBsYXllZDogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UGxheWVkKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGJ0LjQtSDRhNGD0L3QutGG0LjQuCDRg9C/0YDQsNCy0LvQtdC90LjRjyDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKlxuIElORk86INC00LDQvdC90YvQuSDQvNC10YLQvtC0INCx0YvQu9C+INGA0LXRiNC10L3QviDQvtGB0YLQsNCy0LjRgtGMLCDRgi7Qui4g0Y3RgtC+INGD0LTQvtCx0L3QtdC1INGH0LXQvCDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSAtINC10YHRgtGMINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LIg0L3QsNGH0LDQu9C1XG4g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/QvtC70YPRh9C40YLRjCDRgdGA0LDQt9GDINGB0YHRi9C70LrRgyDQvdCwINGN0LrQt9C10LzQv9C70Y/RgCDQv9C70LXQtdGA0LAg0Lgg0L7QsdCy0LXRiNCw0YLRjCDQtdCz0L4g0L7QsdGA0LDQsdC+0YLRh9C40LrQsNC80Lgg0YHQvtCx0YvRgtC40LkuINCf0LvRjtGBINC6INGC0L7QvNGDINC/0YDQuFxuINGC0LDQutC+0Lwg0L/QvtC00YXQvtC00LUg0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGOINC00LXQu9Cw0YLRjCDQv9GA0L7RidC1IC0g0L/RgNC4INC90LXQuSDQvdC1INC/0YDQuNC00LXRgtGB0Y8g0L/QtdGA0LXQvdCw0LfQvdCw0YfQsNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDQuCDQvtCx0L3QvtCy0LvRj9GC0Ywg0LLQtdC30LTQtSDRgdGB0YvQu9C60YNcbiDQvdCwINGC0LXQutGD0YnQuNC5INGN0LrQt9C10LzQv9C70Y/RgCDQv9C70LXQtdGA0LAuXG4gKi9cblxuLyoqXG4gKiBAbmFtZSBBdWRpbyNpbml0UHJvbWlzZVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0g0L7QsdC10YnQsNC90LjQtSwg0YDQsNC30YDQtdGI0LDRjtGJ0LXQtdGB0Y8g0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmluaXRQcm9taXNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlYWR5O1xufTtcblxuLyoqXG4gKiBAbmFtZSBBdWRpbyNnZXRTdGF0ZVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7U3RyaW5nfSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwLlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbn07XG5cbi8qKlxuICogQG5hbWUgQXVkaW8jZ2V0VHlwZVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9INGC0LjQvyDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRUeXBlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlO1xufTtcblxuLyoqXG4gKiBAbmFtZSBBdWRpbyNnZXRTcmNcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0g0JHRgNCw0YLRjCDRgtGA0LXQuiDQuNC3INCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0LjQu9C4INC40Lcg0L/RgNC10LvQvtCw0LTQtdGA0LAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9INGB0YHRi9C70LrRgyDQvdCwINGC0LXQutGD0YnQuNC5INGC0YDQtdC6LlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0U3JjID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRTcmMob2Zmc2V0KTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LXQvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQG5hbWUgQXVkaW8jcGxheVxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAuINCQ0LrRgtGD0LDQu9GM0L3QviDQtNC70Y8gRmxhc2gt0YDQtdCw0LvQuNC30LDRhtC40LgsINCyINC90LXQuSDQv9C+0LrQsCDRgtGA0LXQuiDQs9GA0YPQt9C40YLRgdGPXG4gKiDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0L7Qv9GA0LXQtNC10LvRj9C10YLRgdGPINGBINC/0L7Qs9GA0LXRiNC90L7RgdGC0YzRji5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlcIiwgbG9nZ2VyLl9zaG93VXJsKHNyYyksIGR1cmF0aW9uKTtcblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX2dlbmVyYXRlUGxheUlkKCk7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICB0aGlzLl93aGVuUGF1c2UucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHRoaXMuX3doZW5TdG9wLnJlamVjdChcInBsYXlcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QbGF5XCIsIFtBdWRpb1BsYXllci5FVkVOVF9QTEFZXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgIF0pO1xuXG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXkoc3JjLCBkdXJhdGlvbik7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQt9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQG5hbWUgQXVkaW8jcmVzdGFydFxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX0gUHJvbWlzZS3QvtCx0YrQtdC60YIsINC60L7RgtC+0YDRi9C5INGA0LDQt9GA0LXRiNC40YLRgdGPLCDQutC+0LPQtNCwINGC0YDQtdC6INCx0YPQtNC10YIg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvS5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnJlc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZ2V0RHVyYXRpb24oKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcbiAgICB0aGlzLnNldFBvc2l0aW9uKDApO1xuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHJldHVybiB0aGlzLnJlc3VtZSgpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC60LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQG5hbWUgQXVkaW8jc3RvcFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSDQkNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgC4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgC4gMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfSBQcm9taXNlLdC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YDQsNC30YDQtdGI0LjRgtGB0Y8sINC60L7Qs9C00LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INCx0YPQtNC10YIg0L7RgdGC0LDQvdC+0LLQu9C10L3Qvi5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0b3BcIiwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcChvZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuU3RvcC5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblN0b3BcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1NUT1BdLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcCgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC90LAg0L/QsNGD0LfRgy5cbiAqIEBuYW1lIEF1ZGlvI3BhdXNlXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfSBQcm9taXNlLdC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YDQsNC30YDQtdGI0LjRgtGB0Y8sINC60L7Qs9C00LAg0L/Qu9C10LXRgCDQsdGD0LTQtdGCINC/0L7RgdGC0LDQstC70LXQvSDQvdCwINC/0LDRg9C30YMuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGF1c2VcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblBhdXNlLnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGF1c2VcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BBVVNFXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVksXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wYXVzZSgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0LjQtSDQv9C70LXQtdGA0LAg0YEg0L/QsNGD0LfRiy5cbiAqIEBuYW1lIEF1ZGlvI3Jlc3VtZVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX0gUHJvbWlzZS3QvtCx0YrQtdC60YIsINC60L7RgtC+0YDRi9C5INGA0LDQt9GA0LXRiNC40YLRgdGPLCDQutC+0LPQtNCwINC90LDRh9C90LXRgtGB0Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1LlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9JRExFIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRFxuICAgICAgICB8fCB0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJyZXN1bWVcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGxheS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuXG4gICAgICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucmVzdW1lKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwLlxuICogQG5hbWUgQXVkaW8jcGxheVByZWxvYWRlZFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NyY10g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LogKNC00LvRjyDQv9GA0L7QstC10YDQutC4LCDRh9GC0L4g0LIg0L/RgNC10LvQvtCw0LTQtdGA0LUg0L3Rg9C20L3Ri9C5INGC0YDQtdC6KS5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfSBQcm9taXNlLdC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YDQsNC30YDQtdGI0LjRgtGB0Y8sINC60L7Qs9C00LAg0L3QsNGH0L3QtdGC0YHRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsC5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgbG9nZ2VyLl9zaG93VXJsKHNyYykpO1xuXG4gICAgaWYgKCFzcmMpIHtcbiAgICAgICAgc3JjID0gdGhpcy5nZXRTcmMoMSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzUHJlbG9hZGVkKHNyYykpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkQmFkVHJhY2tcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICB0aGlzLl93aGVuU3RvcC5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICBdKTtcbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXlQcmVsb2FkZWQoKTtcblxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEVycm9yXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LAg0YLRgNC10LrQsC5cbiAqIEBuYW1lIEF1ZGlvI3ByZWxvYWRcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQui5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPIEZsYXNoLdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX0gUHJvbWlzZS3QvtCx0YrQtdC60YIsINC60L7RgtC+0YDRi9C5INGA0LDQt9GA0LXRiNC40YLRgdGPLCDQutC+0LPQtNCwINC90LDRh9C90LXRgtGB0Y8g0L/RgNC10LTQt9Cw0LPRgNGD0LfQutCwINGC0YDQtdC60LAuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGlmIChkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiAmJiBkZXRlY3QuYnJvd3Nlci52ZXJzaW9uWzBdID09IFwiOVwiKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKSk7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwcmVsb2FkXCIsIGxvZ2dlci5fc2hvd1VybChzcmMpLCBkdXJhdGlvbik7XG5cbiAgICBpZiAodGhpcy5fd2hlblByZWxvYWQpIHtcbiAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0KFwicHJlbG9hZFwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblByZWxvYWRcIiwgW1xuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9MT0FESU5HLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TV0FQXG4gICAgXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVELFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UICsgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUFxuICAgIF0pO1xuXG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblByZWxvYWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QcmVsb2FkLnJlamVjdC5hcHBseSh0aGlzLl93aGVuUHJlbG9hZCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgxKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucHJlbG9hZChzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC9LlxuICogQG5hbWUgQXVkaW8jaXNQcmVsb2FkaW5nXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMg0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LouXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSwg0LXRgdC70Lgg0YLRgNC10Log0L/RgNC10LTQstCw0YDQuNGC0LXQu9GM0L3QviDQt9Cw0LPRgNGD0LbQtdC9LCBmYWxzZSAtINC40L3QsNGH0LUuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGVkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y8uXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUsINC10YHQu9C4INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQstCw0YDQuNGC0LXQu9GM0L3QviDQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPLCBmYWxzZSAtINC40L3QsNGH0LUuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRpbmcoc3JjLCAxKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQotCw0LnQvNC40L3Qs9C4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBuYW1lIEF1ZGlvI2dldFBvc2l0aW9uXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFBvc2l0aW9uKCkgfHwgMDtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBuYW1lIEF1ZGlvI3NldFBvc2l0aW9uXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiDQndC+0LLQsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKiBAcmV0dXJucyB7TnVtYmVyfSDQutC+0L3QtdGH0L3QsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgPT0gXCJmbGFzaFwiKSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXRMb2FkZWQoKSAtIDEsIHBvc2l0aW9uKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmdldER1cmF0aW9uKCkgLSAxLCBwb3NpdGlvbikpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCArPSB0aGlzLmdldFBvc2l0aW9uKCkgLSB0aGlzLl9sYXN0U2tpcDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IHBvc2l0aW9uO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cbiAgICByZXR1cm4gcG9zaXRpb247XG59O1xuXG4vKipcbiAqIEBuYW1lIEF1ZGlvI2dldER1cmF0aW9uXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciDQkNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouXG4gKiBAcmV0dXJucyB7TnVtYmVyfSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldER1cmF0aW9uKHByZWxvYWRlciA/IDEgOiAwKSB8fCAwO1xufTtcblxuLyoqXG4gKiBAbmFtZSBBdWRpbyNnZXRMb2FkZWRcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtCb29sZWFufGludH0gcHJlbG9hZGVyINCQ0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LggKNCyINGB0LXQutGD0L3QtNCw0YUpLlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24ocHJlbG9hZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0TG9hZGVkKHByZWxvYWRlciA/IDEgOiAwKSB8fCAwO1xufTtcblxuLyoqXG4gKiBAbmFtZSBBdWRpbyNnZXRQbGF5ZWRcbiAqIEBmdW5jdGlvblxuICogQHJldHVybnMge051bWJlcn0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5fcGxheWVkICs9IHBvc2l0aW9uIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHJldHVybiB0aGlzLl9wbGF5ZWQ7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQG5hbWUgQXVkaW8jZ2V0Vm9sdW1lXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsC5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRWb2x1bWUoKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LAuXG4gKiBAbmFtZSBBdWRpbyNzZXRWb2x1bWVcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSDQndC+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4LlxuICogQHJldHVybnMge051bWJlcn0g0LjRgtC+0LPQvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuC5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcblxuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRWb2x1bWUodm9sdW1lKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INCz0YDQvtC80LrQvtGB0YLRjCDRg9C/0YDQsNCy0LvRj9C10YLRgdGPINGD0YHRgtGA0L7QudGB0YLQstC+0LwsINCwINC90LUg0L/RgNC+0LPRgNCw0LzQvNC90L4uXG4gKiBAbmFtZSBBdWRpbyNpc0RldmljZVZvbHVtZVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSwg0LXRgdC70Lgg0LPRgNC+0LzQutC+0YHRgtGMINGD0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0YPRgdGC0YDQvtC50YHRgtCy0L7QvCwgZmFsc2UgLSDQuNC90LDRh9C1LlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNEZXZpY2VWb2x1bWUoKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBXZWIgQXVkaW8gQVBJXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlQ3Jvc3NEb21haW4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZUNyb3NzRG9tYWluRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnRvZ2dsZUNyb3NzRG9tYWluKHN0YXRlKTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICogQG5hbWUgQXVkaW8jdG9nZ2xlV2ViQXVkaW9BUElcbiAqIEBmdW5jdGlvblxuICogPG5vdGUgdHlwZT1cImF0dGVudGlvblwiPiDQv9C+0YHQu9C1INCy0LrQu9GO0YfQtdC90LjRjyDRgNC10LbQuNC80LAgV2ViIEF1ZGlvIEFQSSDQvtC9INC90LUg0L7RgtC60LvRjtGH0LDQtdGC0YHRjyDQv9C+0LvQvdC+0YHRgtGM0Y4sINGCLtC6LiDQtNC70Y8g0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y9cbiAqINGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAsINC60L7RgtC+0YDQvtC5INGC0YDQtdCx0YPQtdGC0YHRjyDQutC70LjQuiDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8uINCf0YDQuCDQvtGC0LrQu9GO0YfQtdC90LjQuCDQuNC3INCz0YDQsNGE0LAg0L7QsdGA0LDQsdC+0YLQutC4INC40YHQutC70Y7Rh9Cw0Y7RgtGB0Y9cbiAqINCy0YHQtSDQvdC+0LTRiyDQutGA0L7QvNC1INC90L7QtC3QuNGB0YLQvtGH0L3QuNC60L7QsiDQuCDQvdC+0LTRiyDQstGL0LLQvtC00LAsINGD0L/RgNCw0LLQu9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLRjNGOINC/0LXRgNC10LrQu9GO0YfQsNC10YLRgdGPINC90LAg0Y3Qu9C10LzQtdC90YLRiyBhdWRpbywg0LHQtdC3XG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBHYWluTm9kZS4gPC9ub3RlPlxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSDQl9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YEuXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0g0JjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwLlxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElcIiwgc3RhdGUpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVXZWJBdWRpb0FQSShzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCQ0YPQtNC40L4t0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGALlxuICogQHR5cGVkZWYge09iamVjdH0gQXVkaW8uQXVkaW9QcmVwcm9jZXNzb3JcbiAqXG4gKiBAcHJvcGVydHkge0F1ZGlvTm9kZX0gaW5wdXQg0J3QvtC00LAsINCyINC60L7RgtC+0YDRg9GOINC/0LXRgNC10L3QsNC/0YDQsNCy0LvRj9C10YLRgdGPINCy0YvQstC+0LQg0LDRg9C00LjQvi5cbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBvdXRwdXQg0J3QvtC00LAsINC40Lcg0LrQvtGC0L7RgNC+0Lkg0LLRi9Cy0L7QtCDQv9C+0LTQsNC10YLRgdGPINC90LAg0YPRgdC40LvQuNGC0LXQu9GMLlxuICovXG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvtGN0LvQtdC80LXQvdGC0YMsINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YwuXG4gKiBAbmFtZSBBdWRpbyNzZXRBdWRpb1ByZXByb2Nlc3NvclxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0F1ZGlvLkF1ZGlvUHJlcHJvY2Vzc29yfSBwcmVwcm9jZXNzb3Ig0J/RgNC10L/RgNC+0YbQtdGB0YHQvtGALlxuICogQHJldHVybnMge2Jvb2xlYW59INGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LAuXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRBdWRpb1ByZXByb2Nlc3NvciA9IGZ1bmN0aW9uKHByZXByb2Nlc3Nvcikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JcIik7XG4gICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSAhPT0gXCJodG1sNVwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JGYWlsZWRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnNldEF1ZGlvUHJlcHJvY2Vzc29yKHByZXByb2Nlc3Nvcik7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JvQvtCz0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JPQtdC90LXRgNCw0YbQuNGPIHBsYXlJZFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9nZW5lcmF0ZVBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BsYXlJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoKS5zbGljZSgyKTtcbn07XG5cbi8qKlxuICogQG5hbWUgQXVkaW8jZ2V0UGxheUlkXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm5zIHtTdHJpbmd9IHBsYXlJZC5cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wbGF5SWQ7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBpbmRleDogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLm5hbWUsXG4gICAgICAgIHNyYzogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLl9sb2dnZXIoKSxcbiAgICAgICAgdHlwZTogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGVcbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1BsYXllcjtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBBdWRpb1N0YXRpY1xuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvU3RhdGljID0ge307XG5cbi8qKlxuICog0J3QsNGH0LDQu9C+INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDRgtGA0LXQutCwLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkVWRU5UX1BMQVlcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUExBWSA9IFwicGxheVwiO1xuLyoqXG4gKiDQntGB0YLQsNC90L7QstC60LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkVWRU5UX1NUT1BcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RPUCA9IFwic3RvcFwiO1xuLyoqXG4gKiDQn9Cw0YPQt9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9QQVVTRVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSA9IFwicGF1c2VcIjtcbi8qKlxuICog0J7QsdC90L7QstC70LXQvdC40LUg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkVWRU5UX1BST0dSRVNTXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTID0gXCJwcm9ncmVzc1wiO1xuLyoqXG4gKiDQndCw0YfQsNC70LDRgdGMINC30LDQs9GA0YPQt9C60LAg0YLRgNC10LrQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9MT0FERURcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyA9IFwibG9hZGluZ1wiO1xuLyoqXG4gKiDQl9Cw0LPRgNGD0LfQutCwINGC0YDQtdC60LAg0LfQsNCy0LXRgNGI0LXQvdCwLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLlxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQgPSBcImxvYWRlZFwiO1xuLyoqXG4gKiDQmNC30LzQtdC90LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4LlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkVWRU5UX1ZPTFVNRVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUgPSBcInZvbHVtZWNoYW5nZVwiO1xuXG4vKipcbiAqINCS0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwINC30LDQstC10YDRiNC10L3Qvi5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9FTkRFRFxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FTkRFRCA9IFwiZW5kZWRcIjtcbi8qKlxuICog0JLQvtC30L3QuNC60LvQsCDQvtGI0LjQsdC60LAg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9DUkFTSEVEXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKlxuICog0JLQvtC30L3QuNC60LvQsCDQvtGI0LjQsdC60LAg0L/RgNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQuC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9FUlJPUlxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcbi8qKlxuICog0JjQt9C80LXQvdC10L3QuNC1INGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9TVEFURVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9TVEFURSA9IFwic3RhdGVcIjtcbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INC80LXQttC00YMg0YLQtdC60YPRidC40Lwg0Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3Ri9C8INGC0YDQtdC60L7QvC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5FVkVOVF9TV0FQXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NXQVAgPSBcInN3YXBcIjtcbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LrQsC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINCyINC60LDRh9C10YHRgtCy0LUg0L/RgNC10YTQuNC60YHQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5QUkVMT0FERVJfRVZFTlRcbiAqL1xuQXVkaW9TdGF0aWMuUFJFTE9BREVSX0VWRU5UID0gXCJwcmVsb2FkZXI6XCI7XG4vKipcbiAqINCf0LvQtdC10YAg0L3QsNGF0L7QtNC40YLRgdGPINCyINGB0L7RgdGC0L7Rj9C90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5TVEFURV9JTklUXG4gKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0lOSVQgPSBcImluaXRcIjtcbi8qKlxuICog0J3QtSDRg9C00LDQu9C+0YHRjCDQuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0YLRjCDQv9C70LXQtdGALlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLlNUQVRFX0NSQVNIRURcbiAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqXG4gKiDQn9C70LXQtdGAINCz0L7RgtC+0LIg0Lgg0L7QttC40LTQsNC10YIuXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uU1RBVEVfSURMRVxuICovXG5BdWRpb1N0YXRpYy5TVEFURV9JRExFID0gXCJpZGxlXCI7XG4vKipcbiAqINCf0LvQtdC10YAg0L/RgNC+0LjQs9GA0YvQstCw0LXRgiDRgtGA0LXQui5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5TVEFURV9QTEFZSU5HXG4gKi9cbkF1ZGlvU3RhdGljLlNUQVRFX1BMQVlJTkcgPSBcInBsYXlpbmdcIjtcbi8qKlxuICog0J/Qu9C10LXRgCDQv9C+0YHRgtCw0LLQu9C10L0g0L3QsCDQv9Cw0YPQt9GDLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLlNUQVRFX1BBVVNFRFxuICovXG5BdWRpb1N0YXRpYy5TVEFURV9QQVVTRUQgPSBcInBhdXNlZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvU3RhdGljO1xuIiwiLyoqXG4gKiBAbmFtZSBBdWRpby5jb25maWdcbiAqIEBuYW1lc3BhY2Ug0J3QsNGB0YLRgNC+0LnQutC4INCx0LjQsdC70LjQvtGC0LXQutC4LlxuICovXG52YXIgY29uZmlnID0ge1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCe0LHRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4LiDQodC+0LTQtdGA0LbQuNGCINC/0L7Qu9C1OlxuICAgICAqIDx1bD5cbiAgICAgKiAgPGxpPjxjb2RlcGg+cmV0cnk8L2NvZGVwaD4ge051bWJlcn0g4oCUINC60L7Qu9C40YfQtdGB0YLQstC+INC/0L7Qv9GL0YLQvtC6INGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCAo0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4gMykuPC9saT5cbiAgICAgKiA8L3VsPlxuICAgICAqIEBmaWVsZFxuICAgICAqIEBuYW1lIEF1ZGlvLmNvbmZpZy5hdWRpb1xuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKi9cbiAgICBhdWRpbzoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0JrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0Log0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICByZXRyeTogM1xuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gIEZsYXNoLdC/0LvQtdC10YBcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyBGbGFzaC3Qv9C70LXQtdGA0LAuINCh0L7QtNC10YDQttC40YIg0YHQu9C10LTRg9GO0YnQuNC1INC/0L7Qu9GPOlxuICAgICAqIDx1bD5cbiAgICAgKiAgPGxpPjxjb2RlcGg+cGF0aDwvY29kZXBoPiB7U3RyaW5nfSDigJQg0L/Rg9GC0Ywg0LogLnN3ZiDRhNCw0LnQu9GDIEZsYXNoLdC/0LvQtdC10YDQsCAo0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4gJ2Rpc3QnKS48L2xpPlxuICAgICAqICA8bGk+PGNvZGVwaD5uYW1lPC9jb2RlcGg+IHtTdHJpbmd9IOKAlCDQuNC80Y8gLnN3ZiDRhNCw0LnQu9CwIEZsYXNoLdC/0LXQtdGA0LAgKNC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOICdwbGF5ZXItMl8xLnN3ZicpLjwvbGk+XG4gICAgICogIDxsaT48Y29kZXBoPnZlc3Jpb248L2NvZGVwaD4ge051bWJlcn0g4oCUINC80LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPIEZsYXNoLdC/0LvQtdC10YDQsCAo0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4gOS4wLjI4KS48L2xpPlxuICAgICAqICA8bGk+PGNvZGVwaD5wbGF5ZXJJRDwvY29kZXBoPiB7TnVtYmVyfSDigJQgSUQsINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0LLRi9GB0YLQsNCy0LvQtdC9INC00LvRjyDRjdC70LXQvNC10L3RgtCwINGBIEZsYXNoLdC/0LvQtdC10YDQvtC8ICjQv9C+INGD0LzQvtC70YfQsNC90LjRjiAnWWFuZGV4QXVkaW9GbGFzaFBsYXllcicpLjwvbGk+XG4gICAgICogIDxsaT48Y29kZXBoPmNhbGxiYWNrPC9jb2RlcGg+IHtTdHJpbmd9IOKAlCDQuNC80Y8g0YTRg9C90LrRhtC40Lgt0L7QsdGA0LDQsdC+0YLRh9C40LrQsCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LAuPC9saT5cbiAgICAgKiAgPGxpPjxjb2RlcGg+aW5pdFRpbWVvdXQ8L2NvZGVwaD4ge051bWJlcn0g4oCUINGC0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4ICjQv9C+INGD0LzQvtC70YfQsNC90LjRjiAzMDAwKS48L2xpPlxuICAgICAqICA8bGk+PGNvZGVwaD5sb2FkVGltZW91dDwvY29kZXBoPiB7TnVtYmVyfSDigJQg0YLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuCAo0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4gNTAwMCkuPC9saT5cbiAgICAgKiAgPGxpPjxjb2RlcGg+Y2xpY2tUaW1lb3V0PC9jb2RlcGg+IHtOdW1iZXJ9IOKAlCDRgtCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0YHQu9C1INC60LvQuNC60LAgKNC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOIDEwMDApLjwvbGk+XG4gICAgICogIDxsaT48Y29kZXBoPmhlYXJ0QmVhdEludGVydmFsPC9jb2RlcGg+IHtOdW1iZXJ9IOKAlCDQuNC90YLQtdGA0LLQsNC7INC/0YDQvtCy0LXRgNC60Lgg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBGbGFzaC3Qv9C70LXQtdGA0LAgKNC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOIDEwMDApLjwvbGk+XG4gICAgICogPC91bD5cbiAgICAgKiBAZmllbGRcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG5hbWUgQXVkaW8uY29uZmlnLmZsYXNoXG4gICAgICovXG4gICAgZmxhc2g6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCf0YPRgtGMINC6IC5zd2Yg0YTQsNC50LvRgyDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHBhdGg6IFwiZGlzdFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPIC5zd2Yg0YTQsNC50LvQsCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIG5hbWU6IFwicGxheWVyLTJfMS5zd2ZcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCc0LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdmVyc2lvbjogXCI5LjAuMjhcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqIElELCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINCy0YvRgdGC0LDQstC70LXQvSDQtNC70Y8g0Y3Qu9C10LzQtdC90YLQsCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGxheWVySUQ6IFwiWWFuZGV4QXVkaW9GbGFzaFBsYXllclwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPINGE0YPQvdC60YbQuNC4LdC+0LHRgNCw0LHQvtGC0YfQuNC60LAg0YHQvtCx0YvRgtC40LkgZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgY2FsbGJhY2s6IFwieWEubXVzaWMuQXVkaW8uX2ZsYXNoQ2FsbGJhY2tcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBpbml0VGltZW91dDogMzAwMCwgLy8gMyBzZWNcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC30LDQs9GA0YPQt9C60LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGxvYWRUaW1lb3V0OiA1MDAwLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/QvtGB0LvQtSDQutC70LjQutCwXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBjbGlja1RpbWVvdXQ6IDEwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC90YLQtdGA0LLQsNC7INC/0YDQvtCy0LXRgNC60Lgg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGhlYXJ0QmVhdEludGVydmFsOiAxMDAwXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAgSFRNTDUt0L/Qu9C10LXRgFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCe0L/QuNGB0LDQvdC40LUg0L3QsNGB0YLRgNC+0LXQuiBIVE1MNSDQv9C70LXQtdGA0LAuINCh0L7QtNC10YDQttC40YIg0L/QvtC70LU6XG4gICAgICogPHVsPlxuICAgICAqICA8bGk+PHA+PGNvZGVwaD5ibGFja2xpc3Q8L2NvZGVwaD4ge1N0cmluZ1tdfSDigJQg0YHQv9C40YHQvtC6INCx0YDQsNGD0LfQtdGA0L7Qsiwg0LTQu9GPINC60L7RgtC+0YDRi9GFINC70YPRh9GI0LUg0L3QtSDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgSFRNTDUg0L/Qu9C10LXRgC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC/0YDQuFxuICAgICAqINCw0LLRgtC+0L7Qv9GA0LXQtNC10LvQtdC90LjQuCDRgtC40L/QsCDQv9C70LXQtdGA0LAuINCY0LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0Ysg0YHRgNCw0LLQvdC40LLQsNGO0YLRgdGPINGB0L4g0YHRgtGA0L7QutC+0LksINC/0L7RgdGC0YDQvtC10L3QvdC+0Lkg0L/QviDRiNCw0LHQu9C+0L3Rg1xuICAgICAqIGBAJmx0O3BsYXRmb3JtLnZlcnNpb24mZ3Q7ICZsdDtwbGF0Zm9ybS5vcyZndDs6Jmx0O2Jyb3dzZXIubmFtZSZndDsvJmx0O2Jyb3dzZXIudmVyc2lvbiZndDtgPC9wPlxuICAgICAqIDxwPtCf0L4g0YPQvNC+0LvRh9Cw0L3QuNGOINGB0L7QtNC10YDQttC40YIg0YHQu9C10LTRg9GO0YnQuNC1INC30L3QsNGH0LXQvdC40Y86IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiLCBcIjptc2llLzlcIl0uPC9wPlxuICAgICAqIDwvbGk+XG4gICAgICogPC91bD5cbiAgICAgKiBAZmllbGRcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAbmFtZSBBdWRpby5jb25maWcuaHRtbDVcbiAgICAgKiBAc3RhdGljXG4gICAgICovXG4gICAgaHRtbDU6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCh0L/QuNGB0L7QuiDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNC+0LIg0LTQu9GPINC60L7RgtC+0YDRi9GFINC70YPRh9GI0LUg0L3QtSDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgaHRtbDUg0L/Qu9C10LXRgC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC/0YDQuFxuICAgICAgICAgKiDQsNCy0YLQvi3QvtC/0YDQtdC00LXQu9C10L3QuNC4INGC0LjQv9CwINC/0LvQtdC10YDQsC4g0JjQtNC10L3RgtC40YTQuNC60LDRgtC+0YDRiyDRgdGA0LDQstC90LjQstCw0Y7RgtGB0Y8g0YHQviDRgdGC0YDQvtC60L7QuSDQv9C+0YHRgtGA0L7QtdC90L3QvtC5INC/0L4g0YjQsNCx0LvQvtC90YNcbiAgICAgICAgICogYEAmbHQ7cGxhdGZvcm0udmVyc2lvbiZndDsgJmx0O3BsYXRmb3JtLm9zJmd0OzombHQ7YnJvd3Nlci5uYW1lJmd0Oy8mbHQ7YnJvd3Nlci52ZXJzaW9uJmd0O2BcbiAgICAgICAgICogQHR5cGUge0FycmF5LiZsdDtTdHJpbmcmZ3Q7fVxuICAgICAgICAgKi9cbiAgICAgICAgYmxhY2tsaXN0OiBbXCJsaW51eDptb3ppbGxhXCIsIFwidW5peDptb3ppbGxhXCIsIFwibWFjb3M6bW96aWxsYVwiLCBcIjpvcGVyYVwiLCBcIkBOVCA1XCIsIFwiQE5UIDRcIiwgXCI6bXNpZS85XCJdXG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjb25maWc7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqIEBuYW1lIEF1ZGlvLkF1ZGlvRXJyb3JcbiAqIEBjbGFzcyDQmtC70LDRgdGBINC+0YjQuNCx0LrQuCDQsNGD0LTQuNC+0L/Qu9C70LXQtdGA0LAuXG4gKiBAZXh0ZW5kcyA8eHJlZiBzY29wZT1cImV4dGVybmFsXCIgaHJlZj1cImh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL3J1L2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yXCI+RXJyb3I8L3hyZWY+XG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSDQotC10LrRgdGCINC+0YjQuNCx0LrQuC5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkF1ZGlvRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJBdWRpb0Vycm9yXCIpO1xuXG4vKipcbiAqINCd0LUg0L3QsNC50LTQtdC90LAg0YDQtdCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwINC40LvQuCDQstGB0LUg0LTQvtGB0YLRg9C/0L3Ri9C1INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0L7RgtC10YDQv9C10LvQuCDQutGA0LDRhSDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTlxuICovXG5BdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OID0gXCJjYW5ub3QgZmluZCBzdWl0YWJsZSBpbXBsZW1lbnRhdGlvblwiO1xuLyoqXG4gKiDQotGA0LXQuiDQvdC1INCx0YvQuyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L0g0LjQu9C4INCy0L4g0LLRgNC10LzRjyDQt9Cw0LPRgNGD0LfQutC4INC/0YDQvtC40LfQvtGI0LvQsCDQvtGI0LjQsdC60LAuXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEXG4gKi9cbkF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCA9IFwidHJhY2sgaXMgbm90IHByZWxvYWRlZFwiO1xuLyoqXG4gKiDQlNC10LnRgdGC0LLQuNC1INC90LUg0LTQvtGB0YLRg9C/0L3QviDQuNC3INGC0LXQutGD0YnQtdCz0L4g0YHQvtGB0YLQvtGP0L3QuNGPLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkF1ZGlvRXJyb3IuQkFEX1NUQVRFXG4gKi9cbkF1ZGlvRXJyb3IuQkFEX1NUQVRFID0gXCJhY3Rpb24gaXMgbm90IHBlcm1pdGVkIGZyb20gY3VycmVudCBzdGF0ZVwiO1xuXG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0LHRi9C7INC30LDQsdC70L7QutC40YDQvtCy0LDQvS5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5BdWRpb0Vycm9yLkZMQVNIX0JMT0NLRVJcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSID0gXCJmbGFzaCBpcyByZWplY3RlZCBieSBmbGFzaCBibG9ja2VyIHBsdWdpblwiO1xuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINC/0L7RgtC10YDQv9C10Lsg0LrRgNCw0YUg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L4g0L3QtdC40LfQstC10YHRgtC90YvQvCDQv9GA0LjRh9C40L3QsNC8LlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkF1ZGlvRXJyb3IuRkxBU0hfVU5LTk9XTl9DUkFTSFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCA9IFwiZmxhc2ggaW5pdCB0aW1lZCBvdXRcIjtcbi8qKlxuICog0JLQvdGD0YLRgNC10L3QvdGP0Y8g0L7RiNC40LHQutCwIEZsYXNoLdC/0LvQtdC10YDQsC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5BdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SXG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IgPSBcImZsYXNoIGludGVybmFsIGVycm9yXCI7XG4vKipcbiAqINCf0L7Qv9GL0YLQutCwINCy0YvQt9Cy0LDRgtGMINC90LXQtNC+0YHRgtGD0L/QvdGL0Lkg0Y3QutC30LXQvNC70Y/RgCBGbGFzaC3Qv9C70LXQtdGA0LAuXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdCBAbmFtZSBBdWRpby5BdWRpb0Vycm9yLkZMQVNIX0VNTUlURVJfTk9UX0ZPVU5EXG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YsuXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElOR1xuICovXG5BdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HID0gXCJmbGFzaCBwbGF5ZXIgZG9lc24ndCByZXNwb25zZVwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvRXJyb3I7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2F1ZGlvLWVycm9yJyk7XG52YXIgUGxheWJhY2tFcnJvciA9IHJlcXVpcmUoJy4vcGxheWJhY2stZXJyb3InKTtcblxueWEubXVzaWMuQXVkaW8uQXVkaW9FcnJvciA9IEF1ZGlvRXJyb3I7XG55YS5tdXNpYy5BdWRpby5QbGF5YmFja0Vycm9yID0gUGxheWJhY2tFcnJvcjtcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vbGliL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICogQG5hbWUgQXVkaW8uUGxheWJhY2tFcnJvclxuICogQGNsYXNzINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBleHRlbmRzIDx4cmVmIHNjb3BlPVwiZXh0ZXJuYWxcIiBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3JcIj5FcnJvcjwveHJlZj5cbiAqIEBwYXJhbSBTdHJpbmcgbWVzc2FnZSDQotC10LrRgdGCINC+0YjQuNCx0LrQuC5cbiAqIEBwYXJhbSBTdHJpbmcgc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUGxheWJhY2tFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHNyYykge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xufTtcblxuUGxheWJhY2tFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIlBsYXliYWNrRXJyb3JcIik7XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINGB0L7QtdC00LjQvdC10L3QvdC40Y8uXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURURcbiAqL1xuUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURUQgPSBcIkNvbm5lY3Rpb24gYWJvcnRlZFwiO1xuLyoqXG4gKiDQodC10YLQtdCy0LDRjyDQvtGI0LjQsdC60LAuXG4gKiBAdHlwZSBTdHJpbmdcbiAqIEBjb25zdFxuICogQG5hbWUgQXVkaW8uUGxheWJhY2tFcnJvci5ORVRXT1JLX0VSUk9SXG4gKi9cblBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUiA9IFwiTmV0d29yayBlcnJvclwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LTQtdC60L7QtNC40YDQvtCy0LDQvdC40Y8g0LDRg9C00LjQvi5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5QbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUlxuICovXG5QbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUiA9IFwiRGVjb2RlIGVycm9yXCI7XG4vKipcbiAqINCd0LXQtNC+0YHRgtGD0L/QvdGL0Lkg0LjRgdGC0L7Rh9C90LjQui5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5QbGF5YmFja0Vycm9yLkJBRF9EQVRBXG4gKi9cblBsYXliYWNrRXJyb3IuQkFEX0RBVEEgPSBcIkJhZCBkYXRhXCI7XG5cbi8qKlxuICog0J3QtSDQt9Cw0L/Rg9GB0LrQsNC10YLRgdGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtS5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5QbGF5YmFja0Vycm9yLkRPTlRfU1RBUlRcbiAqL1xuUGxheWJhY2tFcnJvci5ET05UX1NUQVJUID0gXCJQbGF5YmFjayBzdGFydCBlcnJvclwiO1xuXG4vKipcbiAqINCi0LDQsdC70LjRhtCwINGB0L7QvtGC0LLQtdGC0YHRgtCy0LjRjyDQutC+0LTQvtCyINC+0YjQuNCx0L7QuiBIVE1MNSDQv9C70LXQtdGA0LAuINCh0L7QtNC10YDQttC40YIg0L/QvtC70Y86XG4gKiA8dWw+XG4gKiAgPGxpPjE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELDwvbGk+XG4gKiAgPGxpPjI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUiw8L2xpPlxuICogIDxsaT4zOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUiw8L2xpPlxuICogIDxsaT40OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBPC9saT5cbiAqIDwvdWw+XG4gKiBAY29uc3RcbiAqIEB0eXBlIE9iamVjdFxuICogQG5hbWUgQXVkaW8uUGxheWJhY2tFcnJvci5odG1sNVxuICovXG5QbGF5YmFja0Vycm9yLmh0bWw1ID0ge1xuICAgIDE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELFxuICAgIDI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUixcbiAgICAzOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUixcbiAgICA0OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBXG59O1xuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC60LvQsNGB0YHQuNGE0LjQutCw0YLQvtGAINC+0YjQuNCx0L7QuiBmbGFzaC3Qv9C70LXQtdGA0LBcblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5YmFja0Vycm9yO1xuIiwiaWYgKHR5cGVvZiBERVYgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cuREVWID0gdHJ1ZTtcbn1cblxuaWYgKHR5cGVvZiB3aW5kb3cueWEgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cueWEgPSB7fTtcbn1cblxudmFyIHlhID0gd2luZG93LnlhO1xuXG5pZiAodHlwZW9mIHlhLm11c2ljID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEubXVzaWMgPSB7fTtcbn1cblxuaWYgKHR5cGVvZiB5YS5tdXNpYy5BdWRpbyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHlhLm11c2ljLkF1ZGlvID0ge307XG59XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xudmFyIEF1ZGlvUGxheWVyID0gcmVxdWlyZSgnLi9hdWRpby1wbGF5ZXInKTtcbnZhciBQcm94eSA9IHJlcXVpcmUoJy4vbGliL2NsYXNzL3Byb3h5Jyk7XG5cbnlhLm11c2ljLkF1ZGlvID0gUHJveHkuY3JlYXRlQ2xhc3MoQXVkaW9QbGF5ZXIpO1xueWEubXVzaWMuQXVkaW8uY29uZmlnID0gY29uZmlnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHlhLm11c2ljLkF1ZGlvO1xuIiwidmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0ZsYXNoJyk7XG52YXIgRmxhc2hNYW5hZ2VyID0gcmVxdWlyZSgnLi9mbGFzaC1tYW5hZ2VyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcblxudmFyIHBsYXllcklkID0gMTtcblxudmFyIGZsYXNoTWFuYWdlcjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxudmFyIGZsYXNoVmVyc2lvbiA9IHN3Zm9iamVjdC5nZXRGbGFzaFBsYXllclZlcnNpb24oKTtcbmRldGVjdC5mbGFzaFZlcnNpb24gPSBmbGFzaFZlcnNpb24ubWFqb3IgKyBcIi5cIiArIGZsYXNoVmVyc2lvbi5taW5vciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLnJlbGVhc2U7XG5cbmV4cG9ydHMuYXZhaWxhYmxlID0gc3dmb2JqZWN0Lmhhc0ZsYXNoUGxheWVyVmVyc2lvbihjb25maWcuZmxhc2gudmVyc2lvbik7XG5sb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBleHBvcnRzLmF2YWlsYWJsZSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfU1dBUFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FUlJPUlxuICpcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFtvdmVybGF5XSAtINC80LXRgdGC0L4g0LTQu9GPINCy0YHRgtGA0LDQuNCy0LDQvdC40Y8g0L/Qu9C10LXRgNCwICjQsNC60YLRg9Cw0LvRjNC90L4g0YLQvtC70YzQutC+INC00LvRjyBmbGFzaC3Qv9C70LXQtdGA0LApXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZT1mYWxzZV0gLSDRgdC+0LfQtNCw0YLRjCDQvdC+0LLRi9C5INGN0LrQt9C10L/Qu9GP0YAgRmxhc2hNYW5hZ2VyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBBdWRpb0ZsYXNoID0gZnVuY3Rpb24ob3ZlcmxheSwgZm9yY2UpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIGlmICghZmxhc2hNYW5hZ2VyIHx8IGZvcmNlKSB7XG4gICAgICAgIGZsYXNoTWFuYWdlciA9IG5ldyBGbGFzaE1hbmFnZXIob3ZlcmxheSk7XG4gICAgfVxuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLndoZW5SZWFkeSA9IGZsYXNoTWFuYWdlci5jcmVhdGVQbGF5ZXIodGhpcyk7XG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVhZHlcIiwgZGF0YSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0ZsYXNoKTtcblxuZXhwb3J0cy50eXBlID0gQXVkaW9GbGFzaC50eXBlID0gQXVkaW9GbGFzaC5wcm90b3R5cGUudHlwZSA9IFwiZmxhc2hcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0L7Qt9C00LDQvdC40LUg0LzQtdGC0L7QtNC+0LIg0YDQsNCx0L7RgtGLINGBINC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbk9iamVjdC5rZXlzKEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZSkuZmlsdGVyKGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBGbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXlbMF0gIT09IFwiX1wiO1xufSkubWFwKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIEF1ZGlvRmxhc2gucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCEvXmdldC8udGVzdChtZXRob2QpKSB7XG4gICAgICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIG1ldGhvZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5ZXIgaXMgbm90IHJlYWR5XCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMuaWQpO1xuICAgICAgICByZXR1cm4gZmxhc2hNYW5hZ2VyLmZsYXNoW21ldGhvZF0uYXBwbHkoZmxhc2hNYW5hZ2VyLmZsYXNoLCBhcmdzKTtcbiAgICB9XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwYXVzZVxuICovXG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcmVzdW1lXG4gKi9cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc3RvcFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3ByZWxvYWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRlZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlQcmVsb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFBvc2l0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0UG9zaXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldER1cmF0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0TG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRWb2x1bWVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFZvbHVtZVxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFNyY1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0ZsYXNoLnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYWluOiBcIm5vdCByZWFkeVwiLFxuICAgICAgICAgICAgICAgIHByZWxvYWRlcjogXCJub3QgcmVhZHlcIlxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogbG9nZ2VyLl9zaG93VXJsKHRoaXMuZ2V0U3JjKDApKSxcbiAgICAgICAgICAgIHByZWxvYWRlcjogbG9nZ2VyLl9zaG93VXJsKHRoaXMuZ2V0U3JjKDEpKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLkF1ZGlvSW1wbGVtZW50YXRpb24gPSBBdWRpb0ZsYXNoO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdGbGFzaEludGVyZmFjZScpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J7Qv9C40YHQsNC90LjQtSDQstC90LXRiNC90LXQs9C+INC40L3RgtC10YDRhNC10LnRgdCwIGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtPYmplY3R9IGZsYXNoIC0gc3dmLdC+0LHRitC10LrRglxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hJbnRlcmZhY2UgPSBmdW5jdGlvbihmbGFzaCkge1xuICAgIC8vRklYTUU6INC90YPQttC90L4g0L/RgNC40LTRg9C80LDRgtGMINC90L7RgNC80LDQu9GM0L3Ri9C5INC80LXRgtC+0LQg0Y3QutGB0L/QvtGA0YLQsFxuICAgIHRoaXMuZmxhc2ggPSB5YS5tdXNpYy5BdWRpby5fZmxhc2ggPSBmbGFzaDtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YnQtdC90LjQtSDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCS0YvQt9Cy0LDRgtGMINC80LXRgtC+0LQgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZm4gLSDQvdCw0LfQstCw0L3QuNC1INC80LXRgtC+0LTQsFxuICogQHJldHVybnMgeyp9XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2NhbGxGbGFzaCA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy9ERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIGZuLCBhcmd1bWVudHMpO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxhc2guY2FsbC5hcHBseSh0aGlzLmZsYXNoLCBhcmd1bWVudHMpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJfY2FsbEZsYXNoRXJyb3JcIiwgZSwgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCDQvtCx0YDQsNGC0L3QvtC5INGB0LLRj9C30Lgg0YEgZmxhc2gt0L/Qu9C10LXRgNC+0LxcbiAqIEB0aHJvd3Mg0J7RiNC40LHQutCwINC00L7RgdGC0YPQv9CwINC6IGZsYXNoLdC/0LvQtdC10YDRg1xuICogQHByaXZhdGVcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLl9oZWFydEJlYXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJoZWFydEJlYXRcIiwgLTEpO1xufTtcblxuLyoqXG4gKiDQlNC+0LHQsNCy0LjRgtGMINC90L7QstGL0Lkg0L/Qu9C10LXRgFxuICogQHJldHVybnMge2ludH0gLS0gaWQg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLl9hZGRQbGF5ZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiYWRkUGxheWVyXCIsIC0xKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQnNC10YLQvtC00Ysg0YPQv9GA0LDQstC70LXQvdC40Y8g0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC20LXQu9Cw0LXQvNCw0Y8g0LPRgNC+0LzQutC+0YHRgtGMXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbihpZCwgdm9sdW1lKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic2V0Vm9sdW1lXCIsIC0xLCB2b2x1bWUpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFZvbHVtZVwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oaWQsIHNyYywgZHVyYXRpb24pIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwbGF5XCIsIGlkLCBzcmMsIGR1cmF0aW9uKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic3RvcFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwYXVzZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInJlc3VtZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFBvc2l0aW9uXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihpZCwgcG9zaXRpb24pIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRQb3NpdGlvblwiLCBpZCwgcG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldER1cmF0aW9uXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRMb2FkZWRcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQstC+0LfQvNC+0LbQvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcInByZWxvYWRcIiwgaWQsIHNyYywgZHVyYXRpb24sIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmlzUHJlbG9hZGVkID0gZnVuY3Rpb24oaWQsIHNyYywgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImlzUHJlbG9hZGVkXCIsIGlkLCBzcmMsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oaWQsIHNyYywgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImlzUHJlbG9hZGluZ1wiLCBpZCwgc3JjLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcInBsYXlQcmVsb2FkZWRcIiwgaWQsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0U3JjID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRTcmNcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hJbnRlcmZhY2U7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoTWFuYWdlcicpO1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4uL2F1ZGlvLXN0YXRpYycpO1xudmFyIGZsYXNoTG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbnZhciBGbGFzaEludGVyZmFjZSA9IHJlcXVpcmUoJy4vZmxhc2gtaW50ZXJmYWNlJyk7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL3Byb21pc2UnKTtcbnZhciBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xuXG52YXIgQXVkaW9FcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yL2F1ZGlvLWVycm9yJyk7XG52YXIgTG9hZGVyRXJyb3IgPSByZXF1aXJlKCcuLi9saWIvbmV0L2Vycm9yL2xvYWRlci1lcnJvcicpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0JfQsNCz0YDRg9C30LrQsCBmbGFzaC3Qv9C70LXQtdGA0LAg0Lgg0L7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBvdmVybGF5IC0g0L7QsdGK0LXQutGCINC00LvRjyDQt9Cw0LPRgNGD0LfQutC4INC4INC/0L7QutCw0LfQsCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoTWFuYWdlciA9IGZ1bmN0aW9uKG92ZXJsYXkpIHsgLy8gc2luZ2xldG9uIVxuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiLCBvdmVybGF5KTtcblxuICAgIHRoaXMuc3RhdGUgPSBcImluaXRcIjtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuZW1taXRlcnMgPSBbXTtcblxuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAvKipcbiAgICAgKiDQntCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQt9Cw0LLQtdGA0YjQtdC90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAqIEB0eXBlIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlKCk7XG5cbiAgICB2YXIgY2FsbGJhY2tQYXRoID0gY29uZmlnLmZsYXNoLmNhbGxiYWNrLnNwbGl0KFwiLlwiKTtcbiAgICB2YXIgY2FsbGJhY2tOYW1lID0gY2FsbGJhY2tQYXRoLnBvcCgpO1xuICAgIHZhciBjYWxsYmFja0NvbnQgPSB3aW5kb3c7XG4gICAgY2FsbGJhY2tQYXRoLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrQ29udFtwYXJ0XSkge1xuICAgICAgICAgICAgY2FsbGJhY2tDb250W3BhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2tDb250ID0gY2FsbGJhY2tDb250W3BhcnRdO1xuICAgIH0pO1xuICAgIGNhbGxiYWNrQ29udFtjYWxsYmFja05hbWVdID0gdGhpcy5fb25FdmVudC5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX2xvYWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkxvYWRUaW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mbGFzaC5sb2FkVGltZW91dCk7XG4gICAgZmxhc2hMb2FkZXIoY29uZmlnLmZsYXNoLnBhdGggKyBcIi9cIlxuICAgICAgICArIGNvbmZpZy5mbGFzaC5uYW1lLCBjb25maWcuZmxhc2gudmVyc2lvbiwgY29uZmlnLmZsYXNoLnBsYXllcklELCB0aGlzLl9vbkxvYWQuYmluZCh0aGlzKSwge30sIG92ZXJsYXkpO1xuXG4gICAgaWYgKG92ZXJsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQ7XG4gICAgICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbigpIHsgLy9LTk9XTEVER0U6IG9ubHkgbW91c2Vkb3duIGV2ZW50IGFuZCBvbmx5IHdtb2RlOiB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgfHwgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfTk9UX1JFU1BPTkRJTkcpKTtcbiAgICAgICAgICAgICAgICB9LCBjb25maWcuZmxhc2guY2xpY2tUaW1lb3V0KTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgJiYgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlYWR5XCIsIHJlc3VsdCk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQgPSBcImluaXRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9GQUlMID0gXCJmYWlsZWRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9ERUJVRyA9IFwiZGVidWdcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40Lkg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LggZmxhc2hcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIGRhdGFcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX29uTG9hZFwiLCBkYXRhKTtcblxuICAgIGNsZWFyVGltZW91dCh0aGlzLl9fbG9hZFRpbWVvdXQpO1xuICAgIGRlbGV0ZSB0aGlzLl9fbG9hZFRpbWVvdXQ7XG5cbiAgICBpZiAoZGF0YS5zdWNjZXNzKSB7XG4gICAgICAgIHRoaXMuZmxhc2ggPSBuZXcgRmxhc2hJbnRlcmZhY2UoZGF0YS5yZWYpO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBcInJlYWR5XCIpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQucmVzb2x2ZShkYXRhLnJlZik7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMub3ZlcmxheSkge1xuICAgICAgICAgICAgdGhpcy5fX2luaXRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkluaXRUaW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mbGFzaC5pbml0VGltZW91dCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoZGF0YS5fX2ZibiA/IEF1ZGlvRXJyb3IuRkxBU0hfQkxPQ0tFUiA6IEF1ZGlvRXJyb3IuRkxBU0hfVU5LTk9XTl9DUkFTSCkpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YLQsNC50LzQsNGD0YLQsCDQt9Cw0LPRgNGD0LfQutC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkxvYWRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IExvYWRlckVycm9yKExvYWRlckVycm9yLlRJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YLQsNC50LzQsNGD0YLQsCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Jbml0VGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfSU5JVF9USU1FT1VUKSk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGD0YHQv9C10YjQvdC+0YHRgtC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXQgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX29uSW5pdFwiKTtcblxuICAgIHRoaXMuc3RhdGUgPSBcInJlYWR5XCI7XG5cbiAgICBpZiAodGhpcy5fX2luaXRUaW1lb3V0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9faW5pdFRpbWVvdXQpO1xuICAgICAgICBkZWxldGUgdGhpcy5fX2luaXRUaW1lb3V0O1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZsYXNoKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVzb2x2ZSh0aGlzLmZsYXNoKTtcbiAgICAgICAgdGhpcy5fX2hlYXJ0YmVhdCA9IHNldEludGVydmFsKHRoaXMuX29uSGVhcnRCZWF0LmJpbmQodGhpcyksIDEwMDApO1xuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtGH0LjQutC4INGB0L7QsdGL0YLQuNC5IGZsYXNoLdC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5LCDRgdC+0LfQtNCw0LLQsNC10LzRi9GFIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25FdmVudCA9IGZ1bmN0aW9uKGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFwiZmFpbGVkXCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJvbkV2ZW50RmFpbGVkXCIsIGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0RFQlVHKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiZmxhc2hERUJVR1wiLCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfRVJST1IpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJmbGFzaEVycm9yXCIsIGlkLCBvZmZzZXQsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50LCBpZCwgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9JTklUKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vbkluaXQoKTtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9GQUlMKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9JTkZPOiDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INGB0L7QsdGL0YLQuNGPINC/0LXRgNC10LTQsNC90L3QvtCz0L4g0LjQtyDRhNC70LXRiNCwINC90LXQu9GM0LfRjyDQvtCx0YDQsNGJ0LDRgtGM0YHRjyDQuiDRhNC70LXRiC3QvtCx0YrQtdC60YLRgywg0L/QvtGN0YLQvtC80YMg0LTQtdC70LDQtdC8INGA0LDRgdGB0LjQvdGF0YDQvtC90LjQt9Cw0YbQuNGOXG4gICAgaWYgKGlkID09IC0xKSB7XG4gICAgICAgIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmVtbWl0ZXJzLmZvckVhY2goZnVuY3Rpb24oZW1taXRlcikge1xuICAgICAgICAgICAgICAgIGVtbWl0ZXIudHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5lbW1pdGVyc1tpZF0pIHtcbiAgICAgICAgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuZW1taXRlcnNbaWRdLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQsIGlkKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSGVhcnRCZWF0ID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdGhpcy5mbGFzaC5faGVhcnRCZWF0KCk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyYXNoZWRcIiwgZSk7XG4gICAgICAgIHRoaXMuX29uRXZlbnQoQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCwgLTEsIGUpO1xuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtBdWRpb0ZsYXNofSBhdWRpb0ZsYXNoIC0gZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGALCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0LHRgdC70YPQttC40LLQsNGC0Ywg0YHQvtC30LTQsNC90L3Ri9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YHQvtC30LTQsNC90LjRjyDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5jcmVhdGVQbGF5ZXIgPSBmdW5jdGlvbihhdWRpb0ZsYXNoKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclwiKTtcblxuICAgIHZhciBwcm9taXNlID0gdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgYXVkaW9GbGFzaC5pZCA9IHRoaXMuZmxhc2guX2FkZFBsYXllcigpO1xuICAgICAgICB0aGlzLmVtbWl0ZXJzW2F1ZGlvRmxhc2guaWRdID0gYXVkaW9GbGFzaDtcbiAgICAgICAgcmV0dXJuIGF1ZGlvRmxhc2guaWQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHByb21pc2UudGhlbihmdW5jdGlvbihwbGF5ZXJJZCkge1xuICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlUGxheWVyU3VjY2Vzc1wiLCBwbGF5ZXJJZCk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiY3JlYXRlUGxheWVyRXJyb3JcIiwgZXJyKTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsYXNoTWFuYWdlcjtcbiIsIi8qKlxuICogQGlnbm9yZVxuICogQGZpbGVcbiAqIFRoaXMgaXMgYSB3cmFwcGVyIGZvciBzd2ZvYmplY3QgdGhhdCBkZXRlY3RzIEZsYXNoQmxvY2sgaW4gYnJvd3Nlci5cbiAqXG4gKiBXcmFwcGVyIGRldGVjdHM6XG4gKiAgIC0gQ2hyb21lXG4gKiAgICAgLSBGbGFzaEJsb2NrIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9jZG5naWFkbW5raGdlbWtpbWtoaWlsZ2ZmYmppamNpZSlcbiAqICAgICAtIEZsYXNoQmxvY2sgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2dvZmhqa2pta3Bpbmhwb2lhYmpwbG9iY2FpZ25hYm5sKVxuICogICAgIC0gRmxhc2hGcmVlIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9lYm1pZWNrbGxtbWlmampiaXBucHBpbnBpb2hwZmFobSlcbiAqICAgLSBGaXJlZm94IEZsYXNoYmxvY2sgKGh0dHBzOi8vYWRkb25zLm1vemlsbGEub3JnL3J1L2ZpcmVmb3gvYWRkb24vZmxhc2hibG9jay8pXG4gKiAgIC0gT3BlcmEgPj0gMTEuNSBcIkVuYWJsZSBwbHVnaW5zIG9uIGRlbWFuZFwiIHNldHRpbmdcbiAqICAgLSBTYWZhcmkgQ2xpY2tUb0ZsYXNoIEV4dGVuc2lvbiAoaHR0cDovL2hveW9pcy5naXRodWIuY29tL3NhZmFyaWV4dGVuc2lvbnMvY2xpY2t0b3BsdWdpbi8pXG4gKiAgIC0gU2FmYXJpIENsaWNrVG9GbGFzaCBQbHVnaW4gKGZvciBTYWZhcmkgPCA1LjAuNikgKGh0dHA6Ly9yZW50enNjaC5naXRodWIuY29tL2NsaWNrdG9mbGFzaC8pXG4gKlxuICogVGVzdGVkIG9uOlxuICogICAtIENocm9tZSAxMlxuICogICAgIC0gRmxhc2hCbG9jayBieSBMZXgxIDEuMi4xMS4xMlxuICogICAgIC0gRmxhc2hCbG9jayBieSBqb3NvcmVrIDAuOS4zMVxuICogICAgIC0gRmxhc2hGcmVlIDEuMS4zXG4gKiAgIC0gRmlyZWZveCA1LjAuMSArIEZsYXNoYmxvY2sgMS41LjE1LjFcbiAqICAgLSBPcGVyYSAxMS41XG4gKiAgIC0gU2FmYXJpIDUuMSArIENsaWNrVG9GbGFzaCAoMi4zLjIpXG4gKlxuICogQWxzbyB0aGlzIHdyYXBwZXIgY2FuIHJlbW92ZSBibG9ja2VkIHN3ZiBhbmQgbGV0IHlvdSBkb3duZ3JhZGUgdG8gb3RoZXIgb3B0aW9ucy5cbiAqXG4gKiBGZWVsIGZyZWUgdG8gY29udGFjdCBtZSB2aWEgZW1haWwuXG4gKlxuICogQ29weXJpZ2h0IDIwMTEsIEFsZXhleSBBbmRyb3NvdlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIChodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocCkgb3IgR1BMIFZlcnNpb24gMyAoaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC5odG1sKSBsaWNlbnNlcy5cbiAqXG4gKiBUaGFua3MgdG8gZmxhc2hibG9ja2RldGVjdG9yIHByb2plY3QgKGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9mbGFzaGJsb2NrZGV0ZWN0b3IpXG4gKlxuICogQHJlcXVpcmVzIHN3Zm9iamVjdFxuICogQGF1dGhvciBBbGV4ZXkgQW5kcm9zb3YgPGRvb2NoaWtAeWEucnU+XG4gKiBAdmVyc2lvbiAxLjBcbiAqL1xuXG52YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG5cbmZ1bmN0aW9uIHJlbW92ZShub2RlKSB7XG4gICAgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xufVxuXG4vKipcbiAqINCc0L7QtNGD0LvRjCDQt9Cw0LPRgNGD0LfQutC4INGE0LvQtdGILdC/0LvQtdC10YDQsCDRgSDQstC+0LfQvNC+0LbQvdC+0YHRgtGM0Y4g0L7RgtGB0LvQtdC20LjQstCw0L3QuNGPINCx0LvQvtC60LjRgNC+0LLRidC40LrQvtCyXG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hCbG9ja05vdGlmaWVyID0ge1xuXG4gICAgLyoqXG4gICAgICogQ1NTLWNsYXNzIGZvciBzd2Ygd3JhcHBlci5cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQGRlZmF1bHQgZmJuLXN3Zi13cmFwcGVyXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgX19TV0ZfV1JBUFBFUl9DTEFTUzogJ2Zibi1zd2Ytd3JhcHBlcicsXG5cbiAgICAvKipcbiAgICAgKiBUaW1lb3V0IGZvciBmbGFzaCBibG9jayBkZXRlY3RcbiAgICAgKiBAZGVmYXVsdCA1MDBcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgX19USU1FT1VUOiA1MDAsXG5cbiAgICBfX1RFU1RTOiBbXG4gICAgICAgIC8vIENob21lIEZsYXNoQmxvY2sgZXh0ZW5zaW9uIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9jZG5naWFkbW5raGdlbWtpbWtoaWlsZ2ZmYmppamNpZSlcbiAgICAgICAgLy8gQ2hvbWUgRmxhc2hCbG9jayBleHRlbnNpb24gKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2dvZmhqa2pta3Bpbmhwb2lhYmpwbG9iY2FpZ25hYm5sKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlLCB3cmFwcGVyTm9kZSkge1xuICAgICAgICAgICAgLy8gd2UgZXhwZWN0IHRoYXQgc3dmIGlzIHRoZSBvbmx5IGNoaWxkIG9mIHdyYXBwZXJcbiAgICAgICAgICAgIHJldHVybiB3cmFwcGVyTm9kZS5jaGlsZE5vZGVzLmxlbmd0aCA+IDFcbiAgICAgICAgfSwgLy8gb2xkZXIgU2FmYXJpIENsaWNrVG9GbGFzaCAoaHR0cDovL3JlbnR6c2NoLmdpdGh1Yi5jb20vY2xpY2t0b2ZsYXNoLylcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSkge1xuICAgICAgICAgICAgLy8gSUUgaGFzIG5vIHN3Zk5vZGUudHlwZVxuICAgICAgICAgICAgcmV0dXJuIHN3Zk5vZGUudHlwZSAmJiBzd2ZOb2RlLnR5cGUgIT0gJ2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJ1xuICAgICAgICB9LCAvLyBGbGFzaEJsb2NrIGZvciBGaXJlZm94IChodHRwczovL2FkZG9ucy5tb3ppbGxhLm9yZy9ydS9maXJlZm94L2FkZG9uL2ZsYXNoYmxvY2svKVxuICAgICAgICAvLyBDaHJvbWUgRmxhc2hGcmVlIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9lYm1pZWNrbGxtbWlmampiaXBucHBpbnBpb2hwZmFobSlcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSkge1xuICAgICAgICAgICAgLy8gc3dmIGhhdmUgYmVlbiBkZXRhY2hlZCBmcm9tIERPTVxuICAgICAgICAgICAgcmV0dXJuICFzd2ZOb2RlLnBhcmVudE5vZGU7XG4gICAgICAgIH0sIC8vIFNhZmFyaSBDbGlja1RvRmxhc2ggRXh0ZW5zaW9uIChodHRwOi8vaG95b2lzLmdpdGh1Yi5jb20vc2FmYXJpZXh0ZW5zaW9ucy9jbGlja3RvcGx1Z2luLylcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIHN3Zk5vZGUucGFyZW50Tm9kZS5jbGFzc05hbWUuaW5kZXhPZignQ1RGbm9kaXNwbGF5JykgPiAtMTtcbiAgICAgICAgfVxuICAgIF0sXG5cbiAgICAvKipcbiAgICAgKiBFbWJlZCBTV0YgaW5mbyBwYWdlLiBUaGlzIGZ1bmN0aW9uIGhhcyBzYW1lIG9wdGlvbnMgYXMgc3dmb2JqZWN0LmVtYmVkU1dGIGV4Y2VwdCBsYXN0IHBhcmFtIHJlbW92ZUJsb2NrZWRTV0YuXG4gICAgICogQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICogQHBhcmFtIHN3ZlVybFN0clxuICAgICAqIEBwYXJhbSByZXBsYWNlRWxlbUlkU3RyXG4gICAgICogQHBhcmFtIHdpZHRoU3RyXG4gICAgICogQHBhcmFtIGhlaWdodFN0clxuICAgICAqIEBwYXJhbSBzd2ZWZXJzaW9uU3RyXG4gICAgICogQHBhcmFtIHhpU3dmVXJsU3RyXG4gICAgICogQHBhcmFtIGZsYXNodmFyc09ialxuICAgICAqIEBwYXJhbSBwYXJPYmpcbiAgICAgKiBAcGFyYW0gYXR0T2JqXG4gICAgICogQHBhcmFtIGNhbGxiYWNrRm5cbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZW1vdmVCbG9ja2VkU1dGPXRydWVdIFJlbW92ZSBzd2YgaWYgYmxvY2tlZFxuICAgICAqL1xuICAgIGVtYmVkU1dGOiBmdW5jdGlvbihcbiAgICAgICAgc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbiwgcmVtb3ZlQmxvY2tlZFNXRlxuICAgICkge1xuICAgICAgICAvLyB2YXIgc3dmb2JqZWN0ID0gd2luZG93Wydzd2ZvYmplY3QnXTtcblxuICAgICAgICBpZiAoIXN3Zm9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLFxuICAgICAgICAgICAgICAgIHJlcGxhY2VFbGVtSWRTdHIsXG4gICAgICAgICAgICAgICAgd2lkdGhTdHIsXG4gICAgICAgICAgICAgICAgaGVpZ2h0U3RyLFxuICAgICAgICAgICAgICAgIHN3ZlZlcnNpb25TdHIsXG4gICAgICAgICAgICAgICAgeGlTd2ZVcmxTdHIsXG4gICAgICAgICAgICAgICAgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgIHBhck9iaixcbiAgICAgICAgICAgICAgICBhdHRPYmosXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAgICAgLy8gQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3dmRWxlbWVudCA9IGVbJ3JlZiddO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtc2llIChhbmQgY2FuYXJ5IGNocm9tZSAzMi4wKSBjcmFzaGVzIG9uIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGxhY2VkQnlTVkcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZWRCeVNWRyA9IHN3ZkVsZW1lbnQgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VkQnlTVkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9zZXQgdGltZW91dCB0byBsZXQgRmxhc2hCbG9jayBwbHVnaW4gZGV0ZWN0IHN3ZiBhbmQgcmVwbGFjZSBpdCBzb21lIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBURVNUUyA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1RFU1RTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgaiA9IFRFU1RTLmxlbmd0aDsgaSA8IGo7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFRFU1RTW2ldKHN3ZkVsZW1lbnQsIHdyYXBwZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZsYXNoQmxvY2tOb3RpZmllci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdmVCbG9ja2VkU1dGICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIHN3ZlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3Zm9iamVjdC5yZW1vdmVTV0YocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgd3JhcHBlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZSh3cmFwcGVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIGV4dGVuc2lvbiBhcnRlZmFjdHNcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2xpY2tUb0ZsYXNoIGFydGVmYWN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjdGYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQ1RGc3RhY2snKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3RmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2hyb21lIEZsYXNoQmxvY2sgYXJ0ZWZhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdEJvZHlDaGlsZCA9IGRvY3VtZW50LmJvZHkubGFzdENoaWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0Qm9keUNoaWxkICYmIGxhc3RCb2R5Q2hpbGQuY2xhc3NOYW1lID09ICd1anNfZmxhc2hibG9ja19wbGFjZWhvbGRlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGxhc3RCb2R5Q2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGUuc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5fX2ZibiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuIiwidmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG4vKipcbiAqINCc0L7QtNGD0LvRjCDQt9Cw0LPRgNGD0LfQutC4INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoRW1iZWRkZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmZW1iLXN3Zi13cmFwcGVyXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgX19TV0ZfV1JBUFBFUl9DTEFTUzogJ2ZlbWItc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKFxuICAgICAgICBzd2ZVcmxTdHIsIHJlcGxhY2VFbGVtSWRTdHIsIHdpZHRoU3RyLCBoZWlnaHRTdHIsIHN3ZlZlcnNpb25TdHIsIHhpU3dmVXJsU3RyLCBmbGFzaHZhcnNPYmosXG4gICAgICAgIHBhck9iaiwgYXR0T2JqLCBjYWxsYmFja0ZuXG4gICAgKSB7XG4gICAgICAgIHN3Zm9iamVjdC5hZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcbiAgICAgICAgICAgIGlmICghcmVwbGFjZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gY3JlYXRlIGRpdi13cmFwcGVyIGJlY2F1c2Ugc29tZSBmbGFzaCBibG9jayBwbHVnaW5zIHJlcGxhY2Ugc3dmIHdpdGggYW5vdGhlciBjb250ZW50LlxuICAgICAgICAgICAgLy8gQWxzbyBzb21lIGZsYXNoIHJlcXVpcmVzIHdyYXBwZXIgdG8gd29yayBwcm9wZXJseS5cbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IEZsYXNoRW1iZWRkZXIuX19TV0ZfV1JBUFBFUl9DTEFTUztcblxuICAgICAgICAgICAgcmVwbGFjZUVsZW1lbnQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQod3JhcHBlciwgcmVwbGFjZUVsZW1lbnQpO1xuICAgICAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChyZXBsYWNlRWxlbWVudCk7XG5cbiAgICAgICAgICAgIHN3Zm9iamVjdC5lbWJlZFNXRihzd2ZVcmxTdHIsXG4gICAgICAgICAgICAgICAgcmVwbGFjZUVsZW1JZFN0cixcbiAgICAgICAgICAgICAgICB3aWR0aFN0cixcbiAgICAgICAgICAgICAgICBoZWlnaHRTdHIsXG4gICAgICAgICAgICAgICAgc3dmVmVyc2lvblN0cixcbiAgICAgICAgICAgICAgICB4aVN3ZlVybFN0cixcbiAgICAgICAgICAgICAgICBmbGFzaHZhcnNPYmosXG4gICAgICAgICAgICAgICAgcGFyT2JqLFxuICAgICAgICAgICAgICAgIGF0dE9iaixcbiAgICAgICAgICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlIHx8IGUuc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3dmRWxlbWVudCA9IGVbJ3JlZiddO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtc2llIChhbmQgY2FuYXJ5IGNocm9tZSAzMi4wKSBjcmFzaGVzIG9uIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGxhY2VkQnlTVkcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZWRCeVNWRyA9IHN3ZkVsZW1lbnQgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VkQnlTVkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9zZXQgdGltZW91dCB0byBsZXQgRmxhc2hCbG9jayBwbHVnaW4gZGV0ZWN0IHN3ZiBhbmQgcmVwbGFjZSBpdCBzb21lIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgRmxhc2hFbWJlZGRlci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsYXNoRW1iZWRkZXI7XG4iLCJ2YXIgRmxhc2hCbG9ja05vdGlmaWVyID0gcmVxdWlyZSgnLi9mbGFzaGJsb2Nrbm90aWZpZXInKTtcbnZhciBGbGFzaEVtYmVkZGVyID0gcmVxdWlyZSgnLi9mbGFzaGVtYmVkZGVyJyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG5cbnZhciB3aW5TYWZhcmkgPSBkZXRlY3QucGxhdGZvcm0ub3MgPT09ICd3aW5kb3dzJyAmJiBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSAnc2FmYXJpJztcblxudmFyIENPTlRBSU5FUl9DTEFTUyA9IFwieWEtZmxhc2gtcGxheWVyLXdyYXBwZXJcIjtcblxuLyoqXG4gKiDQl9Cw0LPRgNGD0LfRh9C40Log0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKlxuICogQGFsaWFzIEZsYXNoTWFuYWdlcn5mbGFzaExvYWRlclxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSDQodGB0YvQu9C60LAg0L3QsCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfSBtaW5WZXJzaW9uIC0g0LzQuNC90LjQvNCw0LvRjNC90LDRjyDQstC10YDRgdC40Y8g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IGlkIC0g0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YAg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtmdW5jdGlvbn0gbG9hZENhbGxiYWNrIC0g0LrQvtC70LHQtdC6INC00LvRjyDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4XG4gKiBAcGFyYW0ge29iamVjdH0gZmxhc2hWYXJzIC0g0LTQsNC90L3Ri9C1INC/0LXRgNC10LTQsNCy0LDQtdC80YvQtSDQstC+INGE0LvQtdGIXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgLSDQutC+0L3RgtC10LnQvdC10YAg0LTQu9GPINCy0LjQtNC40LzQvtCz0L4g0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ30gc2l6ZVggLSDRgNCw0LfQvNC10YAg0L/QviDQs9C+0YDQuNC30L7QvdGC0LDQu9C4XG4gKiBAcGFyYW0ge3N0cmluZ30gc2l6ZVkgLSDRgNCw0LfQvNC10YAg0L/QviDQstC10YDRgtC40LrQsNC70LhcbiAqXG4gKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9IC0tINCa0L7QvdGC0LXQudC90LXRgCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih1cmwsIG1pblZlcnNpb24sIGlkLCBsb2FkQ2FsbGJhY2ssIGZsYXNoVmFycywgY29udGFpbmVyLCBzaXplWCwgc2l6ZVkpIHtcbiAgICB2YXIgJGZsYXNoUGxheWVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAkZmxhc2hQbGF5ZXIuaWQgPSBcIndyYXBwZXJfXCIgKyBpZDtcbiAgICAkZmxhc2hQbGF5ZXIuaW5uZXJIVE1MID0gJzxkaXYgaWQ9XCInICsgaWQgKyAnXCI+PC9kaXY+JztcblxuICAgIHNpemVYID0gc2l6ZVggfHwgXCIxMDAwXCI7XG4gICAgc2l6ZVkgPSBzaXplWSB8fCBcIjEwMDBcIjtcblxuICAgIHZhciBlbWJlZGRlcixcbiAgICAgICAgZmxhc2hTaXplWCxcbiAgICAgICAgZmxhc2hTaXplWSxcbiAgICAgICAgb3B0aW9ucztcblxuICAgIGlmIChjb250YWluZXIgJiYgIXdpblNhZmFyaSkge1xuICAgICAgICBlbWJlZGRlciA9IEZsYXNoRW1iZWRkZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBzaXplWDtcbiAgICAgICAgZmxhc2hTaXplWSA9IHNpemVZO1xuICAgICAgICBvcHRpb25zID0ge2FsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiLCB3bW9kZTogXCJ0cmFuc3BhcmVudFwifTtcblxuICAgICAgICAkZmxhc2hQbGF5ZXIuY2xhc3NOYW1lID0gQ09OVEFJTkVSX0NMQVNTO1xuICAgICAgICAkZmxhc2hQbGF5ZXIuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBmbGFzaFNpemVZID0gXCIxXCI7XG4gICAgICAgIG9wdGlvbnMgPSB7YWxsb3dzY3JpcHRhY2Nlc3M6IFwiYWx3YXlzXCJ9O1xuXG4gICAgICAgICRmbGFzaFBsYXllci5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogLTFweDsgdG9wOiAtMXB4OyB3aWR0aDogMHB4OyBoZWlnaHQ6IDBweDsgb3ZlcmZsb3c6IGhpZGRlbjsnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfVxuXG4gICAgZW1iZWRkZXIuZW1iZWRTV0YoXG4gICAgICAgIHVybCxcbiAgICAgICAgaWQsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG1pblZlcnNpb24sXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGZsYXNoVmFycyxcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAge30sXG4gICAgICAgIGxvYWRDYWxsYmFja1xuICAgICk7XG5cbiAgICByZXR1cm4gJGZsYXNoUGxheWVyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gWzYwLCAxNzAsIDMxMCwgNjAwLCAxMDAwLCAzMDAwLCA2MDAwLCAxMjAwMCwgMTQwMDAsIDE2MDAwXTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImRlZmF1bHRcIixcbiAgICAgICAgXCJwcmVhbXBcIjogMCxcbiAgICAgICAgXCJiYW5kc1wiOiBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkNsYXNzaWNhbFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMC41LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMy41LCAtMy41LCAtMy41LCAtNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2x1YlwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4zNTk5OTk4OTUwOTU4MjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIDQsIDIuNSwgMi41LCAyLjUsIDEuNSwgLTAuNSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkRhbmNlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjE1OTk5OTg0NzQxMjEwOTQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQuNSwgMy41LCAxLCAtMC41LCAtMC41LCAtMi41LCAtMy41LCAtMy41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDQuNSwgNC41LCAyLjUsIDAuNSwgLTIsIC00LCAtNSwgLTUuNSwgLTUuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgQmFzcyAmIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMi41LCAtMC41LCAtMy41LCAtMiwgMC41LCA0LCA1LjUsIDYsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTQuNSwgLTQuNSwgLTQuNSwgLTIsIDEsIDUuNSwgOCwgOCwgOCwgOF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcHRvcCBTcGVha2VycyAvIEhlYWRwaG9uZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDUuNSwgMi41LCAtMS41LCAtMSwgMC41LCAyLCA0LjUsIDYsIDddXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMYXJnZSBIYWxsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzUsIDUsIDIuNSwgMi41LCAtMC41LCAtMiwgLTIsIC0yLCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGl2ZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi42Mzk5OTk4NjY0ODU1OTU3LFxuICAgICAgICBcImJhbmRzXCI6IFstMiwgLTAuNSwgMiwgMi41LCAyLjUsIDIuNSwgMiwgMSwgMSwgMV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBhcnR5XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMy41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAzLjUsIDMuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBvcFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4xMTk5OTk4ODU1NTkwODIsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIDIsIDMuNSwgNCwgMi41LCAtMC41LCAtMSwgLTEsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSZWdnYWVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTQuMDc5OTk5OTIzNzA2MDU1LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMi41LCAtMC41LCAzLCAzLCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUm9ja1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIsIC0yLjUsIC00LCAtMS41LCAyLCA0LCA1LjUsIDUuNSwgNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU2thXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjUxOTk5OTk4MDkyNjUxNCxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTEsIC0yLCAtMiwgLTAuNSwgMiwgMi41LCA0LCA0LjUsIDUuNSwgNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC43OTk5OTk3MTM4OTc3MDUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDAuNSwgLTAuNSwgLTEsIC0wLjUsIDIsIDQsIDQuNSwgNS41LCA2XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdCBSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDIsIDEsIC0wLjUsIC0yLCAtMi41LCAtMS41LCAtMC41LCAxLCA0XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiVGVjaG5vXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjgzOTk5OTkxNDE2OTMxMTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIuNSwgLTAuNSwgLTIuNSwgLTIsIC0wLjUsIDQsIDQuNSwgNC41LCA0XVxuICAgIH1cbl07XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIEVxdWFsaXplclN0YXRpYyA9IHJlcXVpcmUoJy4vZXF1YWxpemVyLXN0YXRpYycpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQt9C90LDRh9C10L3QuNGPINGD0YHQuNC70LXQvdC40Y8uXG4gKiBAZXZlbnQgQXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplckJhbmQjRVZFTlRfQ0hBTkdFXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUg0J3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1LlxuICovXG5cbi8qKlxuICogQG5hbWUgQXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplckJhbmRcbiAqIEBjbGFzcyDQn9C+0LvQvtGB0LAg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyDRjdC60LLQsNC70LDQudC30LXRgNCwLlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUEkuXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSDQotC40L8g0YTQuNC70YzRgtGA0LAuXG4gKiBAcGFyYW0ge051bWJlcn0gZnJlcXVlbmN5INCn0LDRgdGC0L7RgtCwINGE0LjQu9GM0YLRgNCwLlxuICpcbiAqIEBmaXJlcyBBdWRpby5meC5FcXVhbGl6ZXIuRXF1YWxpemVyQmFuZCNFVkVOVF9DSEFOR0VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplckJhbmQgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQsIHR5cGUsIGZyZXF1ZW5jeSkge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy50eXBlID0gdHlwZTtcblxuICAgIHRoaXMuZmlsdGVyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgIHRoaXMuZmlsdGVyLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuZmlsdGVyLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICB0aGlzLmZpbHRlci5RLnZhbHVlID0gMTtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gMDtcbn07XG5FdmVudHMubWl4aW4oRXF1YWxpemVyQmFuZCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQvdCw0YHRgtGA0L7QudC60LDQvNC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQG5hbWUgQXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplckJhbmQjZ2V0RnJlcVxuICogQGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7TnVtYmVyfSDRh9Cw0YHRgtC+0YLRgyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjy5cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0RnJlcSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWU7XG59O1xuXG4vKipcbiAqIEBuYW1lIEF1ZGlvLmZ4LkVxdWFsaXplci5FcXVhbGl6ZXJCYW5kI2dldFZhbHVlXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INCX0L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRjy5cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPLlxuICogQG5hbWUgQXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplckJhbmQjc2V0VmFsdWVcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlINCX0L3QsNGH0LXQvdC40LUuXG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKEVxdWFsaXplclN0YXRpYy5FVkVOVF9DSEFOR0UsIHZhbHVlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyQmFuZDtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBFcXVhbGl6ZXJTdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSB7fTtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuRXF1YWxpemVyU3RhdGljLkVWRU5UX0NIQU5HRSA9IFwiY2hhbmdlXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyU3RhdGljO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4uLy4uL2xpYi9kYXRhL21lcmdlJyk7XG5cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSByZXF1aXJlKCcuL2VxdWFsaXplci1zdGF0aWMnKTtcbnZhciBFcXVhbGl6ZXJCYW5kID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXItYmFuZCcpO1xuXG4vKipcbiAqINCe0L/QuNGB0LDQvdC40LUg0L3QsNGB0YLRgNC+0LXQuiDRjdC60LLQsNC70LDQudC30LXRgNCwLlxuICogQHR5cGVkZWYge09iamVjdH0gQXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplclByZXNldFxuICogQHByb3BlcnR5IHtTdHJpbmd9IFtpZF0g0JjQtNC10L3RgtC40YTQuNC60LDRgtC+0YAg0L3QsNGB0YLRgNC+0LXQui5cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAg0J/RgNC10LTRg9GB0LjQu9C40YLQtdC70YwuXG4gKiBAcHJvcGVydHkge051bWJlcltdfSBiYW5kcyDQl9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LAuXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBldmVudCBBdWRpby5meC5FcXVhbGl6ZXIjRVZFTlRfQ0hBTkdFXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXEg0KfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y8uXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUg0JfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPLlxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQG5hbWUgQXVkaW8uZnguRXF1YWxpemVyXG4gKiBAY2xhc3Mg0K3QutCy0LDQu9Cw0LnQt9C10YAuXG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0INCa0L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSS5cbiAqIEBwYXJhbSB7TnVtYmVyW119IGJhbmRzINCh0L/QuNGB0L7QuiDRh9Cw0YHRgtC+0YIg0LTQu9GPINC/0L7Qu9C+0YEg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsC5cbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqIEBtaXhlcyBFcXVhbGl6ZXJTdGF0aWNcbiAqXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyI0VWRU5UX0NIQU5HRVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCBiYW5kcykge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVhbXAgPSBuZXcgRXF1YWxpemVyQmFuZChhdWRpb0NvbnRleHQsIFwiaGlnaHNoZWxmXCIsIDApO1xuICAgIHRoaXMucHJlYW1wLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIHRoaXMucHJlYW1wKSk7XG5cbiAgICBiYW5kcyA9IGJhbmRzIHx8IEVxdWFsaXplci5ERUZBVUxUX0JBTkRTO1xuXG4gICAgdmFyIHByZXY7XG4gICAgdGhpcy5iYW5kcyA9IGJhbmRzLm1hcChmdW5jdGlvbihmcmVxdWVuY3ksIGlkeCkge1xuICAgICAgICB2YXIgYmFuZCA9IG5ldyBFcXVhbGl6ZXJCYW5kKFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0LFxuXG4gICAgICAgICAgICBpZHggPT0gMCA/ICdsb3dzaGVsZidcbiAgICAgICAgICAgICAgICA6IGlkeCArIDEgPCBiYW5kcy5sZW5ndGggPyBcInBlYWtpbmdcIlxuICAgICAgICAgICAgICAgIDogXCJoaWdoc2hlbGZcIixcblxuICAgICAgICAgICAgZnJlcXVlbmN5XG4gICAgICAgICk7XG4gICAgICAgIGJhbmQub24oXCIqXCIsIHRoaXMuX29uQmFuZEV2ZW50LmJpbmQodGhpcywgYmFuZCkpO1xuXG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgICAgdGhpcy5wcmVhbXAuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJldi5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2ID0gYmFuZDtcbiAgICAgICAgcmV0dXJuIGJhbmQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnByZWFtcC5maWx0ZXI7XG4gICAgdGhpcy5vdXRwdXQgPSB0aGlzLmJhbmRzW3RoaXMuYmFuZHMubGVuZ3RoIC0gMV0uZmlsdGVyO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXIpO1xubWVyZ2UoRXF1YWxpemVyLCBFcXVhbGl6ZXJTdGF0aWMsIHRydWUpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4INC/0L4t0YPQvNC+0LvRh9Cw0L3QuNGOXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNCx0L7RgCDRh9Cw0YHRgtC+0YIg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsCDQv9GA0LjQvNC10L3Rj9GO0YnQuNC50YHRjyDQv9C+INGD0LzQvtC70YfQsNC90LjRji5cbiAqIEB0eXBlIE51bWJlcltdXG4gKiBAY29uc3QgXG4gKiBAbmFtZSBBdWRpby5meC5FcXVhbGl6ZXIuREVGQVVMVF9CQU5EU1xuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9CQU5EUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5iYW5kcy5qcycpO1xuXG4vKipcbiAqINCd0LDQsdC+0YAg0YDQsNGB0L/RgNC+0YHRgtGA0LDQvdC10L3QvdGL0YUg0L/RgNC10YHQtdGC0L7QsiDRjdC60LLQsNC70LDQudC30LXRgNCwINC00LvRjyDQvdCw0LHQvtGA0LAg0YfQsNGB0YLQvtGCINC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOLlxuICogQHR5cGUgT2JqZWN0fFN0cmluZ3xBdWRpby5meC5FcXVhbGl6ZXIuRXF1YWxpemVyUHJlc2V0XG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLmZ4LkVxdWFsaXplci5ERUZBVUxUX1BSRVNFVFNcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfUFJFU0VUUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5wcmVzZXRzLmpzJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40Y8g0L/QvtC70L7RgdGLINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBwYXJhbSB7RXF1YWxpemVyQmFuZH0gYmFuZCAtINC/0L7Qu9C+0YHQsCDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1INGB0L7QsdGL0YLQuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLl9vbkJhbmRFdmVudCA9IGZ1bmN0aW9uKGJhbmQsIGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBiYW5kLmdldEZyZXEoKSwgZGF0YSk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JfQsNCz0YDRg9C30LrQsCDQuCDRgdC+0YXRgNCw0L3QtdC90LjQtSDQvdCw0YHRgtGA0L7QtdC6XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30LjRgtGMINC90LDRgdGC0YDQvtC50LrQuC5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uZnguRXF1YWxpemVyI2xvYWRQcmVzZXRcbiAqIEBwYXJhbSB7QXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplclByZXNldH0gcHJlc2V0INCd0LDRgdGC0YDQvtC50LrQuC5cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5sb2FkUHJlc2V0ID0gZnVuY3Rpb24ocHJlc2V0KSB7XG4gICAgcHJlc2V0LmJhbmRzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIGlkeCkge1xuICAgICAgICB0aGlzLmJhbmRzW2lkeF0uc2V0VmFsdWUodmFsdWUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5wcmVhbXAuc2V0VmFsdWUocHJlc2V0LnByZWFtcCk7XG59O1xuXG4vKipcbiAqINCh0L7RhdGA0LDQvdC40YLRjCDRgtC10LrRg9GJ0LjQtSDQvdCw0YHRgtGA0L7QudC60LguXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLmZ4LkVxdWFsaXplciNzYXZlUHJlc2V0XG4gKiBAcmV0dXJucyB7QXVkaW8uZnguRXF1YWxpemVyLkVxdWFsaXplclByZXNldH1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5zYXZlUHJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJlYW1wOiB0aGlzLnByZWFtcC5nZXRWYWx1ZSgpLFxuICAgICAgICBiYW5kczogdGhpcy5iYW5kcy5tYXAoZnVuY3Rpb24oYmFuZCkgeyByZXR1cm4gYmFuZC5nZXRWYWx1ZSgpOyB9KVxuICAgIH07XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQsNGC0LXQvNCw0YLQuNC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0Ywg0L/RgNC10LTQv9C+0LvQvtC20LXQvdC40LUgKNGB0LrQvtGA0LXQtSDQstGB0LXQs9C+INC90YPQttC90LAg0LrQsNGA0YLQsCDQstC10YHQvtCyINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YfQsNGB0YLQvtGCINC40LvQuCDQtNCw0LbQtSDQvdC10LrQsNGPINGE0YPQvdC60YbQuNGPKVxuLyoqXG4gKiDQktGL0YfQuNC70Y/QtdGCINC+0L/RgtC40LzQsNC70YzQvdC+0LUg0LfQvdCw0YfQvdC40LUg0L/RgNC10LTRg9GB0LjQu9C10L3QuNGPLiDQpNGD0L3QutGG0LjRjyDRj9Cy0LvRj9C10YLRgdGPINGN0LrRgdC/0LXRgNC40LzQtdC90YLQsNC70YzQvdC+0LkuXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLmZ4LkVxdWFsaXplciNndWVzc1ByZWFtcFxuICogQHJldHVybnMge251bWJlcn0g0LfQvdCw0YfQvdC40LUg0L/RgNC10LTRg9GB0LjQu9C10L3QuNGPLlxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmd1ZXNzUHJlYW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHYgPSAwO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gdGhpcy5iYW5kcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgdiArPSB0aGlzLmJhbmRzW2tdLmdldFZhbHVlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIC12IC8gMjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciA9IHJlcXVpcmUoJy4vZXF1YWxpemVyJyk7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEubXVzaWMuQXVkaW8uZnggPSB7fTtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5tdXNpYy5BdWRpby5meC52b2x1bWVMaWIgPSByZXF1aXJlKCcuL3ZvbHVtZS1saWInKTtcbiIsIi8qKlxuICogQGNsYXNzINCc0LXRgtC+0LTRiyDQutC+0L3QstC10YDRgtCw0YbQuNC4INC30L3QsNGH0LXQvdC40Lkg0LPRgNC+0LzQutC+0YHRgtC4LlxuICogQHN0YXRpY1xuICogQG5hbWUgQXVkaW8uZngudm9sdW1lTGliXG4gKi9cbnZhciB2b2x1bWVMaWIgPSB7fTtcblxuLyoqXG4gKiDQnNC40L3QuNC80LDQu9GM0L3QvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0YDQuCDQutC+0YLQvtGA0L7QvCDQv9GA0L7QuNGB0YXQvtC00LjRgiDQvtGC0LrQu9GO0YfQtdC90LjQtSDQt9Cy0YPQutCwLlxuICog0J7Qs9GA0LDQvdC40YfQtdC90LjQtSDQsiAwLjAxINC/0L7QtNC+0LHRgNCw0L3QviDRjdC80L/QuNGA0LjRh9C10YHQutC4LlxuICogQHR5cGUgbnVtYmVyXG4gKiBAZmllbGRcbiAqIEBuYW1lIEF1ZGlvLmZ4LnZvbHVtZUxpYi5FUFNJTE9OXG4gKi9cbnZvbHVtZUxpYi5FUFNJTE9OID0gMC4wMTtcblxuLyoqXG4gKiDQmtC+0Y3RhNGE0LjRhtC40LXQvdGCINC00LvRjyDQv9GA0LXQvtCx0YDQsNC30L7QstCw0L3QuNC5INCz0YDQvtC80LrQvtGB0YLQuCDQuNC3INC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtC5INGI0LrQsNC70Ysg0LIg0LTQtdGG0LjQsdC10LvRiy5cbiAqIEB0eXBlIE51bWJlclxuICogQHByaXZhdGVcbiAqL1xudm9sdW1lTGliLl9EQkZTX0NPRUYgPSAyMCAvIE1hdGgubG9nKDEwKTtcblxuLyoqXG4gKiDQktGL0YfQuNGB0LvQtdC90LjQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCDQv9C+INC30L3QsNGH0LXQvdC40Y4g0L3QsCDQu9C+0LPQsNGA0LjRhNC80LjRh9C10YHQutC+0Lkg0YjQutCw0LvQtS5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uZngudm9sdW1lTGliI3RvRXhwb25lbnRcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSDQl9C90LDRh9C10L3QuNC1INC90LAg0YjQutCw0LvQtS5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4LlxuICovXG52b2x1bWVMaWIudG9FeHBvbmVudCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHZvbHVtZSA9IE1hdGgucG93KHZvbHVtZUxpYi5FUFNJTE9OLCAxIC0gdmFsdWUpO1xuICAgIHJldHVybiB2b2x1bWUgPiB2b2x1bWVMaWIuRVBTSUxPTiA/IHZvbHVtZSA6IDA7XG59O1xuXG4vKipcbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uZngudm9sdW1lTGliI2Zyb21FeHBvbmVudFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSDQk9GA0L7QvNC60L7RgdGC0YwuXG4gKiBAcmV0dXJucyB7TnVtYmVyfSDQt9C90LDRh9C10L3QuNGPINC/0L7Qu9C+0LbQtdC90LjRjyDQvdCwINC70L7Qs9Cw0YDQuNGE0LzQuNGH0LXRgdC60L7QuSDRiNC60LDQu9C1INC/0L4g0LfQvdCw0YfQtdC90LjRjiDQs9GA0L7QvNC60L7RgdGC0LguXG4gKi9cbnZvbHVtZUxpYi5mcm9tRXhwb25lbnQgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICByZXR1cm4gMSAtIE1hdGgubG9nKE1hdGgubWF4KHZvbHVtZSwgdm9sdW1lTGliLkVQU0lMT04pKSAvIE1hdGgubG9nKHZvbHVtZUxpYi5FUFNJTE9OKTtcbn07XG5cbi8qKlxuICogQGZ1bmN0aW9uXG4gKiBAbmFtZSBBdWRpby5meC52b2x1bWVMaWIjdG9EQkZTXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lINCe0YLQvdC+0YHQuNGC0LXQu9GM0L3QsNGPINCz0YDQvtC80LrQvtGB0YLRjC5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INC30L3QsNGH0LXQvdC40Y8gZEJGUyDQuNC3INC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtCz0L4g0LfQvdCw0YfQtdC90LjRjyDQs9GA0L7QvNC60L7RgdGC0LguXG4gKi9cbnZvbHVtZUxpYi50b0RCRlMgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICByZXR1cm4gTWF0aC5sb2codm9sdW1lKSAqIHZvbHVtZUxpYi5fREJGU19DT0VGO1xufTtcblxuLyoqXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLmZ4LnZvbHVtZUxpYiNmcm9tREJGU1xuICogQHBhcmFtIHtOdW1iZXJ9IGRiZnMg0JPRgNC+0LzQutC+0YHRgtGMINCyIGRCRlMuXG4gKiBAcmV0dXJucyB7TnVtYmVyfSDQt9C90LDRh9C10L3QuNGPINC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtC5INCz0YDQvtC80LrQvtGB0YLQuCDQuNC3INC30L3QsNGH0LXQvdC40Y8gZEJGUy5cbiAqL1xudm9sdW1lTGliLmZyb21EQkZTID0gZnVuY3Rpb24oZGJmcykge1xuICAgIHJldHVybiBNYXRoLmV4cChkYmZzIC8gdm9sdW1lTGliLl9EQkZTX0NPRUYpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB2b2x1bWVMaWI7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvSFRNTDVMb2FkZXInKTtcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi4vYXVkaW8tc3RhdGljJyk7XG52YXIgUGxheWJhY2tFcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yL3BsYXliYWNrLWVycm9yJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL2xpYi9ub29wJyk7XG5cbnZhciBsb2FkZXJJZCA9IDE7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQntCx0ZHRgNGC0LrQsCDQtNC70Y8g0L3QsNGC0LjQstC90L7Qs9C+INC60LvQsNGB0YHQsCBBdWRpb1xuICogQGV4dGVuZHMgRXZlbnRzXG4gKipcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FUlJPUlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBsb2FkZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuICAgIHRoaXMub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCAhPT0gQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAvKipcbiAgICAgKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGA0LDQt9C70LjRh9C90YvRhSDQvtC20LjQtNCw0L3QuNC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBEZWZlcnJlZD59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnByb21pc2VzID0ge307XG5cbiAgICAvKipcbiAgICAgKiDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnNyYyA9IFwiXCI7XG4gICAgLyoqXG4gICAgICog0J3QsNC30L3QsNGH0LXQvdC90LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5wb3NpdGlvbiA9IDA7XG5cbiAgICAvKipcbiAgICAgKiDQktGA0LXQvNGPINC/0L7RgdC70LXQtNC90LXQs9C+INC+0LHQvdC+0LLQu9C10L3QuNGPINC00LDQvdC90YvRhVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmxhc3RVcGRhdGUgPSAwO1xuXG4gICAgLyoqXG4gICAgICog0KTQu9Cw0LMg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60LhcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMubm90TG9hZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQktGL0YXQvtC0INC00LvRjyBXZWIgQXVkaW8gQVBJXG4gICAgICogQHR5cGUge0F1ZGlvTm9kZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMub3V0cHV0ID0gbnVsbDtcblxuICAgIC8vLS0tINCh0LDRhdCw0YAg0LTQu9GPINC30LDRidC40YLRiyDQvtGCINGD0YLQtdGH0LXQuiDQv9Cw0LzRj9GC0LhcbiAgICB0aGlzLl9fc3RhcnRQbGF5ID0gdGhpcy5fc3RhcnRQbGF5LmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX3Jlc3RhcnQgPSB0aGlzLl9yZXN0YXJ0LmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX3N0YXJ0dXBBdWRpbyA9IHRoaXMuX3N0YXJ0dXBBdWRpby5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX3VwZGF0ZVByb2dyZXNzID0gdGhpcy5fdXBkYXRlUHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVMb2FkaW5nID0gdGhpcy5fb25OYXRpdmVMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlRW5kZWQgPSB0aGlzLl9vbk5hdGl2ZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlRXJyb3IgPSB0aGlzLl9vbk5hdGl2ZUVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlUGF1c2UgPSB0aGlzLl9vbk5hdGl2ZVBhdXNlLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fb25OYXRpdmVQbGF5ID0gdGhpcy50cmlnZ2VyLmJpbmQodGhpcywgQXVkaW9TdGF0aWMuRVZFTlRfUExBWSk7XG5cbiAgICB0aGlzLl9pbml0QXVkaW8oKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9IVE1MNUxvYWRlcik7XG5cbi8qKlxuICog0JjQvdGC0LXRgNCy0LDQuyDQvtCx0L3QvtCy0LvQtdC90LjRjyDRgtCw0LnQvNC40L3Qs9C+0LIg0YLRgNC10LrQsFxuICogQHR5cGUge251bWJlcn1cbiAqIEBwcml2YXRlXG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwgPSAzMDtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgtC40LLQvdGL0LUg0YHQvtCx0YvRgtC40Y8gQXVkaW9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSA9IFwicGxheVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L/QsNGD0LfRi1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSA9IFwicGF1c2VcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFID0gXCJ0aW1ldXBkYXRlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VOREVEID0gXCJlbmRlZFwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9EVVJBVElPTiA9IFwiZHVyYXRpb25jaGFuZ2VcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcgPSBcInByb2dyZXNzXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4INC80LXRgtCwLdC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEgPSBcImxvYWRlZG1ldGFkYXRhXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC90LDRh9Cw0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LVcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSA9IFwiY2FucGxheVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKipcbiAqINCX0LDQs9C70YPRiNC60LAg0LTQu9GPIF9faW5pdExpc3RlbmVyJ9CwINC90LAg0LLRgNC10LzRjyDQvtC20LjQtNCw0L3QuNGPINC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fZGVmYXVsdEluaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKCkge307XG5BdWRpb0hUTUw1TG9hZGVyLl9kZWZhdWx0SW5pdExpc3RlbmVyLnN0ZXAgPSBcInVzZXJcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtCx0L3QvtCy0LvQtdC90LjRjyDRgtCw0LnQvNC40L3Qs9C+0LIg0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3VwZGF0ZVByb2dyZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnRUaW1lID0gK25ldyBEYXRlKCk7XG4gICAgaWYgKGN1cnJlbnRUaW1lIC0gdGhpcy5sYXN0VXBkYXRlIDwgQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFVwZGF0ZSA9IGN1cnJlbnRUaW1lO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5INC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlTG9hZGluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3VwZGF0ZVByb2dyZXNzKCk7XG5cbiAgICBpZiAodGhpcy5hdWRpby5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGxvYWRlZCA9IHRoaXMuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gdGhpcy5hdWRpby5idWZmZXJlZC5zdGFydCgwKTtcblxuICAgICAgICBpZiAodGhpcy5ub3RMb2FkaW5nICYmIGxvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5ub3RMb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9hZGVkID49IHRoaXMuYXVkaW8uZHVyYXRpb24gLSAwLjEpIHtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQvtC60L7QvdGH0LDQvdC40Y8g0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlRW5kZWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9FTkRFRCk7XG4gICAgdGhpcy5lbmRlZCA9IHRydWU7XG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgdGhpcy5hdWRpby5wYXVzZSgpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC+0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge0V2ZW50fSBlIC0g0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICBpZiAoIXRoaXMuc3JjKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hdWRpby5lcnJvci5jb2RlID09IDIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJOZXR3b3JrIGVycm9yLiBSZXN0YXJ0aW5nLi4uXCIsIGxvZ2dlci5fc2hvd1VybCh0aGlzLnNyYykpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fcmVzdGFydCgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGVycm9yID0gbmV3IFBsYXliYWNrRXJyb3IodGhpcy5hdWRpby5lcnJvclxuICAgICAgICAgICAgPyBQbGF5YmFja0Vycm9yLmh0bWw1W3RoaXMuYXVkaW8uZXJyb3IuY29kZV1cbiAgICAgICAgICAgIDogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogZSxcbiAgICAgICAgdGhpcy5zcmMpO1xuXG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfRVJST1IsIGVycm9yKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8g0L/QsNGD0LfRi1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlUGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZW5kZWQpIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BBVVNFKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0Lgg0LTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC40YUg0YHQvtCx0YvRgtC40Lkg0LTQu9GPINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXRVc2VyRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbn07XG5cbi8qKlxuICog0JTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQuNGFINGB0L7QsdGL0YLQuNC5INC00LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9kZWluaXRVc2VyRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L3QsNGC0LjQstC90YvRhSDRgdC+0LHRi9GC0LjQuSBhdWRpby3RjdC70LXQvNC10L3RgtCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5faW5pdE5hdGl2ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuLyoqXG4gKiDQlNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L3QsNGC0LjQstC90YvRhSDRgdC+0LHRi9GC0LjQuSBhdWRpby3RjdC70LXQvNC10L3RgtCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0TmF0aXZlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9fb25OYXRpdmVQYXVzZSk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19vbk5hdGl2ZVBsYXkpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FTkRFRCwgdGhpcy5fX29uTmF0aXZlRW5kZWQpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9EVVJBVElPTiwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElORywgdGhpcy5fX29uTmF0aXZlTG9hZGluZyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9fb25OYXRpdmVFcnJvcik7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L7QsdGK0LXQutGC0LAgQXVkaW8g0Lgg0L3QsNC30L3QsNGH0LXQvdC40LUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINGB0L7QsdGL0YLQuNC5XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5faW5pdEF1ZGlvID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9pbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XG4gICAgdGhpcy5hdWRpby5sb29wID0gZmFsc2U7IC8vIGZvciBJRVxuICAgIHRoaXMuYXVkaW8ucHJlbG9hZCA9IHRoaXMuYXVkaW8uYXV0b2J1ZmZlciA9IFwiYXV0b1wiOyAvLyAxMDAlXG4gICAgdGhpcy5hdWRpby5hdXRvcGxheSA9IGZhbHNlO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gXCJcIjtcblxuICAgIHRoaXMuX2luaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IEF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXI7XG5cbiAgICB0aGlzLl9pbml0TmF0aXZlRXZlbnRzKCk7XG59O1xuXG4vKipcbiAqINCe0YLQutC70Y7Rh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuSDQuCDRg9C00LDQu9C10L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0QXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2RlaW5pdEF1ZGlvXCIpO1xuXG4gICAgdGhpcy5tdXRlRXZlbnRzKCk7XG5cbiAgICB0aGlzLl9kZWluaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fZGVpbml0TmF0aXZlRXZlbnRzKCk7XG5cbiAgICB0aGlzLmF1ZGlvID0gbnVsbDtcbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L7QsdGK0LXQutGC0LAgQXVkaW8uINCU0LvRjyDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdCx0YPQtdGC0YHRjyDQu9GO0LHQvtC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtC1INC00LXQudGB0YLQstC40LUuXG4gKlxuICog0KHQvtCy0LXRgNGI0LXQvdC90L4g0Y3Qt9C+0YLQtdGA0LjRh9C90YvQuSDQuCDQvNCw0LPQuNGH0LXRgdC60LjQuSDQvNC10YLQvtC0LiDQlNC70Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwINGC0YDQtdCx0YPQtdGC0YHRjyDQstGL0LfRi9Cy0LDRgtGMINC80LXRgtC+0LQgcGxheSDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1XG4gKiDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPLiDQn9C+0YHQu9C1INGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPINC/0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC+0LHRgNCw0YLQvdC+INC90LAg0L/QsNGD0LfRgywg0YIu0LouINC90LXQutC+0YLQvtGA0YvQtSDQsdGA0LDRg9C30LXRgNGLXG4gKiDQsiDQv9GA0L7RgtC40LLQvdC+0Lwg0YHQu9GD0YfQsNC1INC90LDRh9C40L3QsNGO0YIg0L/RgNC+0LjQs9GA0YvQstCw0YLRjCDRgtGA0LXQuiDQsNCy0YLQvtC80LDRgtC40YfQtdGB0LrQuCDQutCw0Log0YLQvtC70YzQutC+INC+0L0g0LfQsNCz0YDRg9C20LDQtdGC0YHRjy4g0J/RgNC4INGN0YLQvtC8INCyINC90LXQutC+0YLQvtGA0YvRhSDQsdGA0LDRg9C30LXRgNCw0YVcbiAqINC/0L7RgdC70LUg0LLRi9C30L7QstCwINC80LXRgtC+0LTQsCBsb2FkINGB0L7QsdGL0YLQuNC1IHBsYXkg0L3QuNC60L7Qs9C00LAg0L3QtSDQvdCw0YHRgtGD0L/QsNC10YIsINGC0LDQuiDRh9GC0L4g0L/RgNC40YXQvtC00LjRgtGB0Y8g0YHQu9GD0YjQsNGC0Ywg0YHQvtCx0YvRgtC40Y8g0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCw0LTQsNC90L3Ri9GFXG4gKiDQuNC70Lgg0L7RiNC40LHQutC4INC30LDQs9GA0YPQt9C60LggKNC10YHQu9C4IHNyYyDQvdC1INGD0LrQsNC30LDQvSkuINCSINC90LXQutC+0YLQvtGA0YvRhSDQsdGA0LDRg9C30LXRgNCw0YUg0YLQsNC60LbQtSDQvNC+0LbQtdGCINC90LUg0L3QsNGB0YLRg9C/0LjRgtGMINGB0L7QsdGL0YLQuNC1IHBhdXNlLiDQn9GA0Lgg0Y3RgtC+0LxcbiAqINGB0YLQvtC40YIg0LXRidGRINGD0YfQuNGC0YvQstCw0YLRjCwg0YfRgtC+INGC0YDQtdC6INC80L7QttC10YIg0LPRgNGD0LfQuNGC0YzRgdGPINC40Lcg0LrQtdGI0LAsINGC0L7Qs9C00LAg0YHQvtCx0YvRgtC40Y8g0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCwLdC00LDQvdC90YvRhSDQuCDQstC+0LfQvNC+0LbQvdC+0YHRgtC4XG4gKiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8g0LzQvtCz0YPRgiDQstC+0LfQvdC40LrQvdGD0YLRjCDQsdGL0YHRgtGA0LXQtSDRgdC+0LHRi9GC0LjRjyBwbGF5INC40LvQuCBwYXVzZSwg0YLQsNC6INGH0YLQviDQvdGD0LbQvdC+INC/0YDQtdC00YPRgdC80LDRgtGA0LjQstCw0YLRjCDQv9GA0LXRgNGL0LLQsNC90LjQtSDQv9GA0L7RhtC10YHRgdCwXG4gKiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydHVwQXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3N0YXJ0dXBBdWRpb1wiKTtcblxuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcblxuICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQvtC90L3QvtCz0L4g0LLRi9C30L7QstCwIHBsYXkg0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8g0Lgg0LLRi9C30LLQsNGC0YwgcGF1c2UuXG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQstGL0LfQvtCy0LAgcGF1c2Ug0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8sINC30LDQstC10YDRiNC40YLRjCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjiDQuCDRgNCw0LfRgNC10YjQuNGC0Ywg0L/QtdGA0LXQtNCw0YfRgyDRgdC+0LHRi9GC0LjQuVxuICAgICAgICB0aGlzLl9faW5pdExpc3RlbmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX19pbml0TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fX2luaXRMaXN0ZW5lcjtcbiAgICAgICAgICAgIHRoaXMudW5tdXRlRXZlbnRzKCk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW86cmVhZHlcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwID0gXCJwYXVzZVwiO1xuXG4gICAgICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcblxuICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3N0YXJ0dXBBdWRpbzpwbGF5XCIsIGUudHlwZSk7XG4gICAgfS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19pbml0TGlzdGVuZXIuc3RlcCA9IFwicGxheVwiO1xuXG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIC8vSU5GTzog0L/QtdGA0LXQtCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQtdC8INC+0LHRitC10LrRgiBBdWRpbyDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNGC0YwsINCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRj1xuICAgIHRoaXMuYXVkaW8ubG9hZCgpO1xuICAgIHRoaXMuYXVkaW8ucGxheSgpO1xufTtcblxuLyoqXG4gKiDQldGB0LvQuCDQvNC10YLQvtC0IF9zdGFydFBsYXkg0LLRi9C30LLQsNC9INGA0LDQvdGM0YjQtSwg0YfQtdC8INC30LDQutC+0L3Rh9C40LvQsNGB0Ywg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8sINC90YPQttC90L4g0L7RgtC80LXQvdC40YLRjCDRgtC10LrRg9GJ0LjQuSDRiNCw0LMg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fYnJlYWtTdGFydHVwID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgdGhpcy5fZGVpbml0VXNlckV2ZW50cygpO1xuICAgIHRoaXMudW5tdXRlRXZlbnRzKCk7XG5cbiAgICBpZiAoIXRoaXMuX19pbml0TGlzdGVuZXIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG5cbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgbG9nZ2VyLndhcm4odGhpcywgXCJfc3RhcnR1cEF1ZGlvOmludGVycnVwdGVkXCIsIHRoaXMuX19pbml0TGlzdGVuZXIuc3RlcCwgcmVhc29uKTtcbiAgICBkZWxldGUgdGhpcy5fX2luaXRMaXN0ZW5lcjtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQnNC10YLQvtC00Ysg0L7QttC40LTQsNC90LjRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YHQvtCx0YvRgtC40Lkg0Lgg0LPQtdC90LXRgNCw0YbQuNC4INC+0LHQtdGJ0LDQvdC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQlNC+0LbQtNCw0YLRjNGB0Y8g0L7Qv9GA0LXQtNC10LvRkdC90L3QvtCz0L4g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSDQuNC80Y8g0YHQvtGB0YLQvtGP0L3QuNGPXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjaGVjayAtINC80LXRgtC+0LQg0L/RgNC+0LLQtdGA0LrQuCwg0YfRgtC+INC80Ysg0L3QsNGF0L7QtNC40LzRgdGPINCyINC90YPQttC90L7QvCDRgdC+0YHRgtC+0Y/QvdC40LhcbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IGxpc3RlbiAtINGB0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSwg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC10YIg0YHQvNC10L3QuNGC0YzRgdGPINGB0L7RgdGC0L7Rj9C90LjQtVxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fd2FpdEZvciA9IGZ1bmN0aW9uKG5hbWUsIGNoZWNrLCBsaXN0ZW4pIHtcbiAgICBpZiAoIXRoaXMucHJvbWlzZXNbbmFtZV0pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMucHJvbWlzZXNbbmFtZV0gPSBkZWZlcnJlZDtcblxuICAgICAgICBpZiAoY2hlY2suY2FsbCh0aGlzKSkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcblxuICAgICAgICAgICAgdmFyIGNsZWFyTGlzdGVuZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihsaXN0ZW5baV0sIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihsaXN0ZW5baV0sIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmZXJyZWQucHJvbWlzZSgpLnRoZW4oY2xlYXJMaXN0ZW5lcnMsIGNsZWFyTGlzdGVuZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnByb21pc2VzW25hbWVdLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINC+0LbQuNC00LDQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtINC40LzRjyDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0L7QttC40LTQsNC90LjRj1xuICogQHRvZG8gcmVhc29uINGB0LTQtdC70LDRgtGMINC90LDRgdC70LXQtNC90LjQutC+0Lwg0LrQu9Cw0YHRgdCwIEVycm9yXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fY2FuY2VsV2FpdCA9IGZ1bmN0aW9uKG5hbWUsIHJlYXNvbikge1xuICAgIHZhciBwcm9taXNlO1xuICAgIGlmIChwcm9taXNlID0gdGhpcy5wcm9taXNlc1tuYW1lXSkge1xuICAgICAgICBkZWxldGUgdGhpcy5wcm9taXNlc1tuYW1lXTtcbiAgICAgICAgcHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQstGB0LXRhSDQvtC20LjQtNCw0L3QuNC5XG4gKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC+0LbQuNC00LDQvdC40Y9cbiAqIEB0b2RvIHJlYXNvbiDRgdC00LXQu9Cw0YLRjCDQvdCw0YHQu9C10LTQvdC40LrQvtC8INC60LvQsNGB0YHQsCBFcnJvclxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2Fib3J0UHJvbWlzZXMgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5wcm9taXNlcykge1xuICAgICAgICBpZiAodGhpcy5wcm9taXNlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB0aGlzLl9jYW5jZWxXYWl0KGtleSwgcmVhc29uKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhSDRgtGA0LXQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5INC/0LvQtdC10YDQsCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20L3QviDQvtC20LjQtNCw0YLRjCDQs9C+0YLQvtCy0L3QvtGB0YLQuCDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZU1ldGFkYXRhRXZlbnRzID0gW0F1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVldO1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCw0LTQsNC90L3Ri9GFXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTWV0YWRhdGFDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmF1ZGlvLnJlYWR5U3RhdGUgPiB0aGlzLmF1ZGlvLkhBVkVfTUVUQURBVEE7XG59O1xuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCw0LTQsNC90L3Ri9GFXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTWV0YWRhdGEgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcIm1ldGFkYXRhXCIsIHRoaXMuX3Byb21pc2VNZXRhZGF0YUNoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTWV0YWRhdGFFdmVudHMpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0LfQsNCz0YDRg9C30LrQuCDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5INC/0LvQtdC10YDQsCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20L3QviDQvtC20LjQtNCw0YLRjCDQt9Cw0LPRgNGD0LfQutC4XG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTG9hZGVkRXZlbnRzID0gW0F1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkddO1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDQt9Cw0LPRgNGD0LbQtdC90LAg0L3Rg9C20L3QsNGPINGH0LDRgdGC0Ywg0YLRgNC10LrQsFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZUxvYWRlZENoZWNrID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fX2xvYWRlclRpbWVyID0gdGhpcy5fX2xvYWRlclRpbWVyICYmIGNsZWFyVGltZW91dCh0aGlzLl9fbG9hZGVyVGltZXIpIHx8IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLl9jYW5jZWxXYWl0KFwibG9hZGVkXCIsIFwidGltZW91dFwiKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpLCA1MDAwKTtcblxuICAgIC8vSU5GTzog0L/QvtC30LjRhtC40Y4g0L3Rg9C20L3QviDQsdGA0LDRgtGMINGBINCx0L7Qu9GM0YjQuNC8INC30LDQv9Cw0YHQvtC8LCDRgi7Qui4g0LTQsNC90L3Ri9C1INC30LDQv9C40YHQsNC90Ysg0LHQu9C+0LrQsNC80Lgg0Lgg0L3QsNC8INC90YPQttC90L4g0LTQvtC20LTQsNGC0YzRgdGPINC30LDQs9GA0YPQt9C60Lgg0LHQu9C+0LrQsFxuICAgIHZhciBsb2FkZWQgPSBNYXRoLm1pbih0aGlzLnBvc2l0aW9uICsgNDUsIHRoaXMuYXVkaW8uZHVyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aFxuICAgICAgICAmJiB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmVuZCgwKSAtIHRoaXMuYXVkaW8uYnVmZmVyZWQuc3RhcnQoMCkgPj0gbG9hZGVkO1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC30LDQs9GA0YPQt9C60Lgg0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZUxvYWRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEZvcihcImxvYWRlZFwiLCB0aGlzLl9wcm9taXNlTG9hZGVkQ2hlY2ssIEF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VMb2FkZWRFdmVudHMpO1xuXG4gICAgaWYgKCFwcm9taXNlLmNsZWFuVGltZXIpIHtcbiAgICAgICAgcHJvbWlzZS5jbGVhblRpbWVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLl9fbG9hZGVyVGltZXIgPSBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRlclRpbWVyKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBwcm9taXNlLnRoZW4ocHJvbWlzZS5jbGVhblRpbWVyLCBwcm9taXNlLmNsZWFuVGltZXIpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0L/RgNC+0LjQs9GA0YvQstCw0L3QuNGPINC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0YHQvtCx0YvRgtC40Lkg0L/Qu9C10LXRgNCwINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQvdC+INC+0LbQuNC00LDRgtGMINC/0YDQvtC40LPRgNGL0LLQsNC90LjRjyDQvdGD0LbQvdC+INGH0LDRgdGC0LhcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VQbGF5aW5nRXZlbnRzID0gW0F1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEVdO1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDQv9GA0L7QuNCz0YDRi9Cy0LDQtdGC0YHRjyDQvdGD0LbQvdCw0Y8g0YfQsNGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlUGxheWluZ0NoZWNrID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRpbWUgPSBNYXRoLm1pbih0aGlzLnBvc2l0aW9uICsgMC4yLCB0aGlzLmF1ZGlvLmR1cmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5jdXJyZW50VGltZSA+PSB0aW1lO1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC/0YDQvtC40LPRgNGL0LLQsNC90LjRjyDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlUGxheWluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl93YWl0Rm9yKFwicGxheWluZ1wiLCB0aGlzLl9wcm9taXNlUGxheWluZ0NoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlUGxheWluZ0V2ZW50cyk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQstC10LTQtdC90LjRjywg0L/QtdGA0LXQt9Cw0L/Rg9GB0Log0YLRgNC10LrQsCwg0LXRgdC70Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC90LUg0L3QsNGH0LDQu9C+0YHRjFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVN0YXJ0UGxheWluZyA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXSA9IGRlZmVycmVkO1xuXG4gICAgICAgIC8vSU5GTzog0LXRgdC70Lgg0L7RgtC80LXQvdC10L3QviDQvtC20LjQtNCw0L3QuNC1INC30LDQs9GA0YPQt9C60Lgg0LjQu9C4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjywg0YLQviDQvdGD0LbQvdC+INC+0YLQvNC10L3QuNGC0Ywg0Lgg0Y3RgtC+INC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgdmFyIHJlamVjdCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgcmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcInN0YXJ0UGxheWluZ1wiLCByZWFzb24pO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgdmFyIHRpbWVyO1xuICAgICAgICB2YXIgcmVhZHkgPSBmYWxzZTtcbiAgICAgICAgdmFyIGNsZWFuVGltZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZVBsYXlpbmcoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJzdGFydFBsYXlpbmc6c3VjY2Vzc1wiKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpLCByZWplY3QpO1xuXG4gICAgICAgIHRoaXMuX3Byb21pc2VMb2FkZWQoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHJlYWR5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChcInRpbWVvdXRcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcInBsYXlpbmdcIiwgXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic3RhcnRQbGF5aW5nOmZhaWxlZFwiKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSwgNTAwMCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVqZWN0KTtcblxuICAgICAgICB0aGlzLl9wcm9taXNlUGxheWluZygpLnRoZW4oY2xlYW5UaW1lciwgY2xlYW5UaW1lcik7XG4gICAgICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFuVGltZXIsIGNsZWFuVGltZXIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnByb21pc2VzW1wic3RhcnRQbGF5aW5nXCJdLnByb21pc2UoKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDRjdC70LXQvNC10L3RgtC+0LwgQXVkaW9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQndCw0YfQsNGC0Ywg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwibG9hZFwiLCBzcmMpO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImxvYWRcIik7XG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwibG9hZFwiKTtcblxuICAgIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICB0aGlzLm5vdExvYWRpbmcgPSB0cnVlO1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuXG4gICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5sb2FkKCk7XG59O1xuXG4vKiog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzdG9wXCIpO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcInN0b3BcIik7XG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwic3RvcFwiKTtcblxuICAgIHRoaXMubG9hZChcIlwiKTtcbn07XG5cbi8qKlxuICog0J3QsNGH0LDRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fc3RhcnRQbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zdGFydFBsYXlcIik7XG5cbiAgICB0aGlzLmF1ZGlvLmN1cnJlbnRUaW1lID0gdGhpcy5wb3NpdGlvbjtcblxuICAgIGlmICghdGhpcy5wbGF5aW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJzdGFydFBsYXlcIik7XG4gICAgdGhpcy5hdWRpby5wbGF5KCk7XG5cbiAgICAvL1RISU5LOiDQvdGD0LbQvdC+INC70Lgg0YLRgNC40LPQs9C10YDQuNGC0Ywg0YHQvtCx0YvRgtC40LUg0LIg0YHQu9GD0YfQsNC1INGD0YHQv9C10YXQsFxuICAgIHRoaXMuX3Byb21pc2VTdGFydFBsYXlpbmcoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnJldHJ5ID0gMDtcbiAgICB9LmJpbmQodGhpcyksIHRoaXMuX19yZXN0YXJ0KTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQt9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBbcmVhc29uXSAtINC10YHQu9C4INC/0YDQuNGH0LjQvdCwINCy0YvQt9C+0LLQsCDRg9C60LDQt9Cw0L3QsCDQuCDQvdC1INGA0LDQstC90LAgXCJ0aW1lb3V0XCIg0L3QuNGH0LXQs9C+INC90LUg0L/RgNC+0LjRgdGF0L7QtNC40YJcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9yZXN0YXJ0ID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfcmVzdGFydFwiLCByZWFzb24sIHRoaXMucG9zaXRpb24sIHRoaXMucGxheWluZyk7XG5cbiAgICBpZiAoIXRoaXMuc3JjIHx8IHJlYXNvbiAmJiByZWFzb24gIT09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnJldHJ5Kys7XG5cbiAgICBpZiAodGhpcy5yZXRyeSA+IDUpIHtcbiAgICAgICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiwgbmV3IFBsYXliYWNrRXJyb3IoUGxheWJhY2tFcnJvci5ET05UX1NUQVJULCB0aGlzLnNyYykpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9JTkZPOiDQl9Cw0L/QvtC80LjQvdCw0LXQvCDRgtC10LrRg9GJ0LXQtSDRgdC+0YHRgtC+0Y/QvdC40LUsINGCLtC6LiDQvtC90L4g0YHQsdGA0L7RgdC40YLRgdGPINC/0L7RgdC70LUg0L/QtdGA0LXQt9Cw0LPRgNGD0LfQutC4XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbjtcbiAgICB2YXIgcGxheWluZyA9IHRoaXMucGxheWluZztcblxuICAgIHRoaXMubG9hZCh0aGlzLnNyYyk7XG5cbiAgICBpZiAocGxheWluZykge1xuICAgICAgICB0aGlzLl9wbGF5KHBvc2l0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCS0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwL9C+0YLQvNC10L3QsCDQv9Cw0YPQt9GLXG4gKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGxheVwiLCBwb3NpdGlvbik7XG4gICAgdGhpcy5yZXRyeSA9IDA7XG4gICAgcmV0dXJuIHRoaXMuX3BsYXkocG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiDQktC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsC/QvtGC0LzQtdC90LAg0L/QsNGD0LfRiyAtINCy0L3Rg9GC0YDQtdC90L3QuNC5INC80LXRgtC+0LRcbiAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcGxheSA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9wbGF5XCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2JyZWFrU3RhcnR1cChcInBsYXlcIik7XG5cbiAgICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb24gPT0gbnVsbCA/IHRoaXMucG9zaXRpb24gfHwgMCA6IHBvc2l0aW9uO1xuICAgIHRoaXMuX3Byb21pc2VNZXRhZGF0YSgpLnRoZW4odGhpcy5fX3N0YXJ0UGxheSwgbm9vcCk7XG59O1xuXG4vKiog0J/QsNGD0LfQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgXCJwYXVzZVwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwYXVzZVwiKTtcblxuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAoIWlzRmluaXRlKHBvc2l0aW9uKSkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInNldFBvc2l0aW9uRmFpbGVkXCIsIHBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcblxuICAgIHRoaXMuX3Byb21pc2VNZXRhZGF0YSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPSB0aGlzLnBvc2l0aW9uO1xuICAgIH0uYmluZCh0aGlzKSwgbm9vcCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC00LrQu9GO0YfQtdC90LjQtS/QvtGC0LrQu9GO0YfQtdC90LjQtSDQuNGB0YLQvtGH0L3QuNC60LAg0LTQu9GPIFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JLQutC70Y7Rh9C40YLRjCDRgNC10LbQuNC8IGNyb3NzRG9tYWluINC00LvRjyBIVE1MNSDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQstC60LvRjtGH0LjRgtGML9Cy0YvQutC70Y7Rh9C40YLRjFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS50b2dnbGVDcm9zc0RvbWFpbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlQXR0cmlidXRlKFwiY3Jvc3NPcmlnaW5cIik7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQuNGB0YLQvtGH0L3QuNC6INC00LvRjyBXZWIgQXVkaW8gQVBJXG4gKiAhISHQktC90LjQvNCw0L3QuNC1ISEhIC0g0L/RgNC4INC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC4IFdlYiBBdWRpbyBBUEkg0LIg0LHRgNCw0YPQt9C10YDQtSDRgdGC0L7QuNGCINGD0YfQuNGC0YvQstCw0YLRjCwg0YfRgtC+INCy0YHQtSDRgtGA0LXQutC4INC00L7Qu9C20L3RiyDQu9C40LHQviDQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiDRgSDRgtC+0LPQviDQttC1INC00L7QvNC10L3QsCwg0LvQuNCx0L4g0LTQu9GPINC90LjRhSDQtNC+0LvQttC90Ysg0LHRi9GC0Ywg0L/RgNCw0LLQuNC70YzQvdC+INCy0YvRgdGC0LDQstC70LXQvdGLINC30LDQs9C+0LvQvtCy0LrQuCBDT1JTLlxuICog0J/RgNC4INCy0YvQt9C+0LLQtSDQtNCw0L3QvdC+0LPQviDQvNC10YLQvtC00LAg0YLRgNC10Log0LHRg9C00LXRgiDQv9C10YDQtdC30LDQv9GD0YnQtdC9XG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiBXZWIgQXVkaW8gQVBJXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmNyZWF0ZVNvdXJjZSA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCkge1xuICAgIGlmICh0aGlzLm91dHB1dCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVNvdXJjZVwiKTtcblxuICAgIHZhciBuZWVkUmVzdGFydCA9ICF0aGlzLmF1ZGlvLmNyb3NzT3JpZ2luO1xuXG4gICAgdGhpcy5hdWRpby5jcm9zc09yaWdpbiA9IFwiYW5vbnltb3VzXCI7XG4gICAgdGhpcy5vdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFFbGVtZW50U291cmNlKHRoaXMuYXVkaW8pO1xuICAgIHRoaXMub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgIGlmIChuZWVkUmVzdGFydCkge1xuICAgICAgICB0aGlzLl9yZXN0YXJ0KCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQo9C00LDQu9C40YLRjCDQuNGB0YLQvtGH0L3QuNC6INC00LvRjyBXZWIgQXVkaW8gQVBJLiDQo9C00LDQu9GP0LXRgiDQuNGB0YLQvtGH0L3QuNC6LCDQv9C10YDQtdGB0L7Qt9C00LDRkdGCINC+0LHRitC10LrRgiBBdWRpby5cbiAqICEhIdCS0L3QuNC80LDQvdC40LUhISEgLSDQlNCw0L3QvdGL0Lkg0LzQtdGC0L7QtCDQvNC+0LbQvdC+INCy0YvQt9GL0LLQsNGC0Ywg0YLQvtC70YzQutC+INCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRjywg0YIu0LouINGB0LLQtdC20LXRgdC+0LfQtNCw0L3QvdGL0LlcbiAqINGN0LvQtdC80LXQvdGCIEF1ZGlvINC90YPQttC90L4g0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNGC0YwgLSDQuNC90LDRh9C1INCx0YPQtNC10YIg0L3QtdC00L7RgdGC0YPQv9C90L4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1LiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRjdC70LXQvNC10L3RgtCwXG4gKiBBdWRpbyDQstC+0LfQvNC+0LbQvdCwINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8gKNC60LvQuNC6LCDRgtCw0Yct0YHQvtCx0YvRgtC40LUg0LjQu9C4INC60LvQsNCy0LjQsNGC0YPRgNC90L7QtSDRgdC+0LHRi9GC0LjQtSlcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuZGVzdHJveVNvdXJjZSA9IGZ1bmN0aW9uKCkge1xuICAgIC8vSU5GTzog0LXQtNC40L3RgdGC0LLQtdC90L3Ri9C5INGB0L/QvtGB0L7QsSDQvtGC0L7RgNCy0LDRgtGMIE1lZGlhRWxlbWVudFNvdXJjZSDQvtGCIEF1ZGlvIC0g0YHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDQvtCx0YrQtdC60YIgQXVkaW9cblxuICAgIGlmICghdGhpcy5vdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZGVzdHJveVNvdXJjZVwiKTtcblxuICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLm91dHB1dCA9IG51bGw7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwiZGVzdHJveVwiKTtcblxuICAgIHRoaXMuX2RlaW5pdEF1ZGlvKCk7XG4gICAgdGhpcy5faW5pdEF1ZGlvKCk7XG4gICAgdGhpcy5fc3RhcnR1cEF1ZGlvKCk7XG5cbiAgICB0aGlzLl9yZXN0YXJ0KCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQtNCw0LvQtdC90LjQtSDQstGB0LXRhSDQvtCx0YDQsNCx0L7RgtGH0LjQutC+0LIg0Lgg0L7QsdGK0LXQutGC0LAgQXVkaW9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqINCj0LTQsNC70LXQvdC40LUg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINC4INC+0LHRitC10LrRgtCwIEF1ZGlvLiDQn9C+0YHQu9C1INCy0YvQt9C+0LLQsCDQtNCw0L3QvdC+0LPQviDQvNC10YLQvtC00LAg0Y3RgtC+0YIg0L7QsdGK0LXQutGCINCx0YPQtNC10YIg0L3QtdC70YzQt9GPINC40YHQv9C+0LvRjNC30L7QstCw0YLRjCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJkZXN0cm95XCIpO1xuXG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoKTtcbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fX3Jlc3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX19zdGFydFBsYXkgPSBudWxsO1xuICAgIHRoaXMucHJvbWlzZXMgPSBudWxsO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluaXQ6ICEhdGhpcy5fX2luaXRMaXN0ZW5lciAmJiB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsXG4gICAgICAgIHNyYzogbG9nZ2VyLl9zaG93VXJsKHRoaXMuc3JjKSxcbiAgICAgICAgcGxheWluZzogdGhpcy5wbGF5aW5nLFxuICAgICAgICBlbmRlZDogdGhpcy5lbmRlZCxcbiAgICAgICAgbm90TG9hZGluZzogdGhpcy5ub3RMb2FkaW5nLFxuICAgICAgICBwb3NpdGlvbjogdGhpcy5wb3NpdGlvblxuICAgIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvSFRNTDVMb2FkZXI7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvSFRNTDUnKTtcblxudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4uL2F1ZGlvLXN0YXRpYycpO1xuXG52YXIgQXVkaW9IVE1MNUxvYWRlciA9IHJlcXVpcmUoJy4vYXVkaW8taHRtbDUtbG9hZGVyJyk7XG5cbnZhciBwbGF5ZXJJZCA9IDE7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0L7QstC10YDQutC4INC00L7RgdGC0YPQv9C90L7RgdGC0LggSFRNTDUgQXVkaW8g0LggV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnRzLmF2YWlsYWJsZSA9IChmdW5jdGlvbigpIHtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0g0JHQsNC30L7QstCw0Y8g0L/RgNC+0LLQtdGA0LrQsCDQv9C+0LTQtNC10YDQttC60Lgg0LHRgNCw0YPQt9C10YDQvtC8XG4gICAgdmFyIGh0bWw1X2F2YWlsYWJsZSA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgICAgLy9zb21lIGJyb3dzZXJzIGRvZXNuJ3QgdW5kZXJzdGFuZCBuZXcgQXVkaW8oKVxuICAgICAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgICAgICB2YXIgY2FuUGxheSA9IGF1ZGlvLmNhblBsYXlUeXBlKFwiYXVkaW8vbXBlZ1wiKTtcbiAgICAgICAgaWYgKCFjYW5QbGF5IHx8IGNhblBsYXkgPT09ICdubycpIHtcblxuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggcmVhc29uXCIsIGNhblBsYXkpO1xuICAgICAgICAgICAgaHRtbDVfYXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggZXJyb3JcIiwgZSk7XG4gICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGh0bWw1X2F2YWlsYWJsZSk7XG4gICAgcmV0dXJuIGh0bWw1X2F2YWlsYWJsZTtcbn0pKCk7XG5cbmlmIChkZXRlY3QucGxhdGZvcm0ubW9iaWxlIHx8IGRldGVjdC5wbGF0Zm9ybS50YWJsZXQpIHtcbiAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgbm90IGFsbG93ZWQgZm9yIG1vYmlsZVwiKTtcbn0gZWxzZSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIGF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJXZWJBdWRpb0FQSSBjb250ZXh0IGNyZWF0ZWRcIik7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGF1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgbm90IGRldGVjdGVkXCIpO1xuICAgIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCa0LvQsNGB0YEgaHRtbDUg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBleHRlbmRzIElBdWRpb0ltcGxlbWVudGF0aW9uXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BMQVlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FTkRFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1ZPTFVNRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0NSQVNIRURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TV0FQXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QQVVTRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMud2ViQXVkaW9BcGkgPSBmYWxzZTtcbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9IDA7XG4gICAgdGhpcy52b2x1bWUgPSAxO1xuICAgIHRoaXMubG9hZGVycyA9IFtdO1xuXG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvSFRNTDUpO1xuZXhwb3J0cy50eXBlID0gQXVkaW9IVE1MNS50eXBlID0gQXVkaW9IVE1MNS5wcm90b3R5cGUudHlwZSA9IFwiaHRtbDVcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCg0LDQsdC+0YLQsCDRgSDQt9Cw0LPRgNGD0LfRh9C40LrQsNC80LhcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQlNC+0LHQsNCy0LjRgtGMINC30LDQs9GA0YPQt9GH0LjQuiDQsNGD0LTQuNC+LdGE0LDQudC70L7QslxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2FkZExvYWRlciA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfYWRkTG9hZGVyXCIpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBsb2FkZXIgPSBuZXcgQXVkaW9IVE1MNUxvYWRlcigpO1xuICAgIGxvYWRlci5pbmRleCA9IHRoaXMubG9hZGVycy5wdXNoKGxvYWRlcikgLSAxO1xuXG4gICAgbG9hZGVyLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgICB2YXIgb2Zmc2V0ID0gKHNlbGYubG9hZGVycy5sZW5ndGggKyBsb2FkZXIuaW5kZXggLSBzZWxmLmFjdGl2ZUxvYWRlcikgJSBzZWxmLmxvYWRlcnMubGVuZ3RoO1xuICAgICAgICBzZWxmLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICBsb2FkZXIuY3JlYXRlU291cmNlKGF1ZGlvQ29udGV4dCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQsNC60YLQuNCy0L3Ri9C5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX3NldEFjdGl2ZSA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0QWN0aXZlXCIsIG9mZnNldCk7XG5cbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9ICh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TV0FQLCBvZmZzZXQpO1xuXG4gICAgaWYgKG9mZnNldCAhPT0gMCkge1xuICAgICAgICAvL0lORk86INC10YHQu9C4INGA0LXQu9C40LfQvtCy0YvQstCw0YLRjCDQutC+0L3RhtC10L/RhtC40Y4g0LzQvdC+0LbQtdGB0YLQstCwINC30LDQs9GA0YPQt9GH0LjQutC+0LIsINGC0L4g0Y3RgtC+INC90YPQttC90L4g0LTQvtGA0LDQsdC+0YLQsNGC0YwuXG4gICAgICAgIHRoaXMuc3RvcChvZmZzZXQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0Lgg0L7RgtC/0LjRgdCw0YLRjCDQtdCz0L4g0L7RgiDRgdC+0LHRi9GC0LjQuSDRgdGC0LDRgNGC0LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge0F1ZGlvfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2dldExvYWRlciA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuICAgIHJldHVybiB0aGlzLmxvYWRlcnNbKHRoaXMuYWN0aXZlTG9hZGVyICsgb2Zmc2V0KSAlIHRoaXMubG9hZGVycy5sZW5ndGhdO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC60LvRjtGH0LXQvdC40LUgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwIENPUlMuICoqKtCS0JDQltCd0J4hKioqIC0g0LXRgdC70Lgg0LLQutC70Y7Rh9C40YLRjCDRgNC10LbQuNC8IENPUlMsINCw0YPQtNC40L4g0Y3Qu9C10LzQtdC90YIg0L3QtSDRgdC80L7QttC10YIg0LfQsNCz0YDRg9C20LDRgtGMINC00LDQvdC90YvQtSDRgdC+XG4gKiDRgdGC0L7RgNC+0L3QvdC40YUg0LTQvtC80LXQvdC+0LIsINC10YHQu9C4INCyINC+0YLQstC10YLQtSDQvdC1INCx0YPQtNC10YIg0L/RgNCw0LLQuNC70YzQvdC+0LPQviDQt9Cw0LPQvtC70L7QstC60LAgQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luLiDQldGB0LvQuCDQvdC1INC/0LvQsNC90LjRgNGD0LXRgtGB0Y9cbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC1IFdlYiBBdWRpbyBBUEksINC90LUg0YHRgtC+0LjRgiDQstC60LvRjtGH0LDRgtGMINGN0YLQvtGCINGA0LXQttC40LwuXG4gKiBAcGFyYW0gc3RhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlQ3Jvc3NEb21haW4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIudG9nZ2xlQ3Jvc3NEb21haW4oc3RhdGUpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKlxuICogKirQktC90LjQvNCw0L3QuNC1ISoqIC0g0L/QvtGB0LvQtSDQstC60LvRjtGH0LXQvdC40Y8g0YDQtdC20LjQvNCwIFdlYiBBdWRpbyBBUEkg0L7QvSDQvdC1INC+0YLQutC70Y7Rh9Cw0LXRgtGB0Y8g0L/QvtC70L3QvtGB0YLRjNGOLCDRgi7Qui4g0LTQu9GPINGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPXG4gKiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLCDQutC+0YLQvtGA0L7QuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LrQu9C40Log0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GPLiDQn9GA0Lgg0L7RgtC60LvRjtGH0LXQvdC40Lgg0LjQtyDQs9GA0LDRhNCwINC+0LHRgNCw0LHQvtGC0LrQuCDQuNGB0LrQu9GO0YfQsNGO0YLRgdGPXG4gKiDQstGB0LUg0L3QvtC00Ysg0LrRgNC+0LzQtSDQvdC+0LQt0LjRgdGC0L7Rh9C90LjQutC+0LIg0Lgg0L3QvtC00Ysg0LLRi9Cy0L7QtNCwLCDRg9C/0YDQsNCy0LvQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0YzRjiDQv9C10YDQtdC60LvRjtGH0LDQtdGC0YHRjyDQvdCwINGN0LvQtdC80LXQvdGC0YsgYXVkaW8sINCx0LXQt1xuICog0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gR2Fpbk5vZGVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YFcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQuNGC0L7Qs9C+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICghYXVkaW9Db250ZXh0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElFcnJvclwiLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpID09IHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gMTtcbiAgICAgICAgICAgIGxvYWRlci5jcmVhdGVTb3VyY2UoYXVkaW9Db250ZXh0KTtcblxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QodGhpcy5wcmVwcm9jZXNzb3IgPyB0aGlzLnByZXByb2Nlc3Nvci5pbnB1dCA6IHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmF1ZGlvT3V0cHV0KSB7XG4gICAgICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICAgICAgdGhpcy5wcmVwcm9jZXNzb3Iub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICBkZWxldGUgdGhpcy5hdWRpb091dHB1dDtcblxuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICAgICAgLy9JTkZPOiDQv9C+0YHQu9C1INGC0L7Qs9C+INC60LDQuiDQvNGLINCy0LrQu9GO0YfQuNC70Lggd2ViQXVkaW9BUEkg0LXQs9C+INGD0LbQtSDQvdC10LvRjNC30Y8g0L/RgNC+0YHRgtC+INGC0LDQuiDQstGL0LrQu9GO0YfQuNGC0YwuXG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIHRoaXMud2ViQXVkaW9BcGkgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbn07XG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBpZiAoIXRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckVycm9yXCIsIHByZXByb2Nlc3Nvcik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yID09PSBwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wcmVwcm9jZXNzb3IgPSBwcmVwcm9jZXNzb3I7XG5cbiAgICBpZiAoIXByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHByZXByb2Nlc3Nvci5pbnB1dCk7XG4gICAgfSk7XG5cbiAgICBwcmVwcm9jZXNzb3Iub3V0cHV0LmNvbm5lY3QodGhpcy5hdWRpb091dHB1dCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGxheVwiLCBzcmMpO1xuXG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuXG4gICAgbG9hZGVyLmxvYWQoc3JjKTtcbiAgICBsb2FkZXIucGxheSgwKTtcbn07XG5cbi8qKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJwYXVzZVwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKCk7XG4gICAgbG9hZGVyLnBhdXNlKCk7XG59O1xuXG4vKiog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicmVzdW1lXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcbiAgICBsb2FkZXIucGxheSgpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzdG9wXCIsIG9mZnNldCk7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQgfHwgMCk7XG4gICAgbG9hZGVyLnN0b3AoKTtcblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TVE9QLCBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKCkuYXVkaW8uY3VycmVudFRpbWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGC0LXQutGD0YnRg9GOINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0UG9zaXRpb25cIiwgcG9zaXRpb24pO1xuICAgIHRoaXMuX2dldExvYWRlcigpLnNldFBvc2l0aW9uKHBvc2l0aW9uIC0gMC4wMDEpOyAvL1RISU5LOiBsZWdhY3kt0LrQvtC0LiDQn9C+0L3Rj9GC0Ywg0L3QsNGE0LjQsyDRgtGD0YIg0L3Rg9C20LXQvSAwLjAwMVxufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuYXVkaW8uZHVyYXRpb247XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKGxvYWRlci5hdWRpby5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGxvYWRlci5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSBsb2FkZXIuYXVkaW8uYnVmZmVyZWQuc3RhcnQoMCk7XG4gICAgfVxuICAgIHJldHVybiAwO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52b2x1bWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge251bWJlcn0gdm9sdW1lXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcbiAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHZvbHVtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24sIG9mZnNldCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJwcmVsb2FkXCIsIHNyYywgb2Zmc2V0KTtcblxuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgbG9hZGVyLmxvYWQoc3JjKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYywgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICByZXR1cm4gbG9hZGVyLnNyYyA9PT0gc3JjICYmICFsb2FkZXIubm90TG9hZGluZztcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKHNyYywgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICByZXR1cm4gbG9hZGVyLnNyYyA9PT0gc3JjO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGxheVByZWxvYWRlZFwiLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG5cbiAgICBpZiAoIWxvYWRlci5zcmMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuX3NldEFjdGl2ZShvZmZzZXQpO1xuICAgIGxvYWRlci5wbGF5KCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQtdC10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfEJvb2xlYW59IC0tINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6INC40LvQuCBmYWxzZSwg0LXRgdC70Lgg0L3QtdGCINC30LDQs9GA0YPQttCw0LXQvNC+0LPQviDRgtGA0LXQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KS5zcmM7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDQtNC+0YHRgtGD0L/QtdC9INC70Lgg0L/RgNC+0LPRgNCw0LzQvNC90YvQuSDQutC+0L3RgtGA0L7Qu9GMINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGRldGVjdC5vbmx5RGV2aWNlVm9sdW1lO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCb0L7Qs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogbG9nZ2VyLl9zaG93VXJsKHRoaXMuZ2V0U3JjKDApKSxcbiAgICAgICAgICAgIHByZWxvYWRlcjogbG9nZ2VyLl9zaG93VXJsKHRoaXMuZ2V0U3JjKDEpKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvSFRNTDU7XG4iLCJ2YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKCcuL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbGliL25ldC9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbG9nZ2VyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC9lcXVhbGl6ZXIvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2Z4L3ZvbHVtZS9leHBvcnQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBZYW5kZXhBdWRpbztcbiIsInZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0YLQu9C+0LbQtdC90L3QvtC1INC00LXQudGB0YLQstC40LVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIF9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQoNCw0LfRgNC10YjQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Jlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHsqfSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSDQv9C10YDQtdC00LDRgtGMINC+0YjQuNCx0LrRg1xuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG5cbiAgICB2YXIgcHJvbWlzZSA9IF9wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBzZWxmLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBzZWxmLnJlamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7IC8vIERvbid0IHRocm93IGVycm9ycyB0byBjb25zb2xlXG5cbiAgICAvKipcbiAgICAgKiDQktGL0L/QvtC70L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQntGC0LrQu9C+0L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucmVqZWN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcHJvbWlzZVxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcHJvbWlzZTsgfTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQstGL0L/QvtC70L3QtdC90LjRjyDRgdC/0LjRgdC60LAg0L7QsdC10YnQsNC90LjQuVxuICogQHBhcmFtIHsuLi4qfSBhcmdzIC0g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC+0LbQuNC00LDRgtGMXG4gKiBAcmV0dXJucyBBYm9ydGFibGVQcm9taXNlXG4gKi9cbkRlZmVycmVkLndoZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcblxuICAgIHZhciBsaXN0ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHZhciBwZW5kaW5nID0gbGlzdC5sZW5ndGg7XG5cbiAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwZW5kaW5nLS07XG5cbiAgICAgICAgaWYgKHBlbmRpbmcgPD0gMCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgIH0pO1xuICAgIGxpc3QgPSBudWxsO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZS5hYm9ydCA9IGRlZmVycmVkLnJlamVjdDtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmVycmVkO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vZGF0YS9tZXJnZScpO1xuXG52YXIgTElTVEVORVJTX05BTUUgPSBcIl9saXN0ZW5lcnNcIjtcbnZhciBNVVRFX09QVElPTiA9IFwiX211dGVkXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQG5hbWUgRXZlbnRzXG4gKiBAY2xhc3Mg0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5LlxuICogQG5vY29uc3RydWN0b3JcbiAqL1xudmFyIEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qKlxuICAgICAqINCa0L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0YHQv9C40YHQutC+0LIg0YHQu9GD0YjQsNGC0LXQu9C10Lkg0YHQvtCx0YvRgtC40LkuXG4gICAgICogQGFsaWFzIEF1ZGlvLkV2ZW50cyNfbGlzdGVuZXJzXG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBBcnJheS48RnVuY3Rpb24+Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTElTVEVORVJTX05BTUVdID0ge307XG5cbiAgICAvKiog0KTQu9Cw0LMg0LLQutC70Y7Rh9C10L3QuNGPL9Cy0YvQutC70Y7Rh9C10L3QuNGPINGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbXV0ZXNcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gZmFsc2U7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JLRgdGP0YfQtdGB0LrQuNC5INGB0LDRhdCw0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC60LvQsNGB0YEg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjbGFzc0NvbnN0cnVjdG9yINCa0L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSDRgtC+0YIg0LbQtSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsCwg0YDQsNGB0YjQuNGA0LXQvdC90YvQuSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuS5cbiAqIEBzdGF0aWNcbiAqL1xuRXZlbnRzLm1peGluID0gZnVuY3Rpb24oY2xhc3NDb25zdHJ1Y3Rvcikge1xuICAgIG1lcmdlKGNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlLCBFdmVudHMucHJvdG90eXBlLCB0cnVlKTtcbiAgICByZXR1cm4gY2xhc3NDb25zdHJ1Y3Rvcjtcbn07XG5cbi8qKlxuICog0KDQsNGB0YjQuNGA0LjRgtGMINC/0YDQvtC40LfQstC+0LvRjNC90YvQuSDQvtCx0YrQtdC60YIg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LkuXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0INCe0LHRitC10LrRgi5cbiAqIEByZXR1cm5zIHtPYmplY3R9INGC0L7RgiDQttC1INC+0LHRitC10LrRgiwg0YDQsNGB0YjQuNGA0LXQvdC90YvQuSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuS5cbiAqL1xuRXZlbnRzLmV2ZW50aXplID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgbWVyZ2Uob2JqZWN0LCBFdmVudHMucHJvdG90eXBlLCB0cnVlKTtcbiAgICBFdmVudHMuY2FsbChvYmplY3QpO1xuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC00L/QuNGB0LrQsCDQuCDQvtGC0L/QuNGB0LrQsCDQvtGCINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1ICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50INCY0LzRjyDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPLlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSA9IFtdO1xuICAgIH1cblxuICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjRjyAo0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0KS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCDQmNC80Y8g0YHQvtCx0YvRgtC40Y8uXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjy5cbiAqIEByZXR1cm5zIHtFdmVudHN9INGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YIuXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tzID0gdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gY2FsbGJhY2tzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBpZiAoY2FsbGJhY2tzW2tdID09PSBjYWxsYmFjayB8fCBjYWxsYmFja3Nba10uY2FsbGJhY2sgPT09IGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFja3Muc3BsaWNlKGssIDEpO1xuICAgICAgICAgICAgaWYgKCFjYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtSwg0L7RgtC/0LjRgdCw0YLRjNGB0Y8g0YHRgNCw0LfRgyDQv9C+0YHQu9C1INC/0LXRgNCy0L7Qs9C+INCy0L7Qt9C90LjQutC90L7QstC10L3QuNGPINGB0L7QsdGL0YLQuNGPICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50INCY0LzRjyDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPLlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHdyYXBwZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIHdyYXBwZXIpO1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICB3cmFwcGVyLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgc2VsZi5vbihldmVudCwgd3JhcHBlcik7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDQstGB0LXRhSDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuSAo0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0KS5cbiAqIEByZXR1cm5zIHtFdmVudHN9INGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YIuXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpc1tMSVNURU5FUlNfTkFNRV0pIHtcbiAgICAgICAgaWYgKHRoaXNbTElTVEVORVJTX05BTUVdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KLRgNC40LPQs9C10YAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0YHQvtCx0YvRgtC40LUgKNGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCkuXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQg0JjQvNGPINGB0L7QsdGL0YLQuNGPLlxuICogQHBhcmFtIHsuLi5hcmdzfSBhcmdzINCf0LDRgNCw0LzQtdGC0YDRiyDQtNC70Y8g0L/QtdGA0LXQtNCw0YfQuCDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvC5cbiAqIEByZXR1cm5zIHtFdmVudHN9INGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YIuXG4gKiBAcHJpdmF0ZVxuICovXG5FdmVudHMucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihldmVudCwgYXJncykge1xuICAgIGlmICh0aGlzW01VVEVfT1BUSU9OXSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYgKGV2ZW50ICE9PSBcIipcIikge1xuICAgICAgICBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYXBwbHkodGhpcywgW1wiKlwiLCBldmVudF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tzID0gW10uY29uY2F0KHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSk7XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGNhbGxiYWNrc1trXS5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0JTQtdC70LXQs9C40YDQvtCy0LDRgtGMINCy0YHQtSDRgdC+0LHRi9GC0LjRjyDQtNGA0YPQs9C+0LzRgyDQtNC40YHQv9C10YLRh9C10YDRgyDRgdC+0LHRi9GC0LjQuSAo0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0KS5cbiAqIEBwYXJhbSB7RXZlbnRzfSBhY2NlcHRvciDQn9C+0LvRg9GH0LDRgtC10LvRjCDRgdC+0LHRi9GC0LjQuS5cbiAqIEByZXR1cm5zIHtFdmVudHN9INGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YIuXG4gKiBAcHJpdmF0ZVxuICovXG5FdmVudHMucHJvdG90eXBlLnBpcGVFdmVudHMgPSBmdW5jdGlvbihhY2NlcHRvcikge1xuICAgIHRoaXMub24oXCIqXCIsIEV2ZW50cy5wcm90b3R5cGUudHJpZ2dlci5iaW5kKGFjY2VwdG9yKSk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JLQutC70Y7Rh9C10L3QuNC1L9Cy0YvQutC70Y7Rh9C10L3QuNC1INGC0YDQuNCz0LPQtdGA0LAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LkgKNGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCkuXG4gKiBAcmV0dXJucyB7RXZlbnRzfSDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCLlxuICovXG5FdmVudHMucHJvdG90eXBlLm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzW01VVEVfT1BUSU9OXSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCS0L7Qt9C+0LHQvdC+0LLQuNGC0Ywg0LfQsNC/0YPRgdC6INGB0L7QsdGL0YLQuNC5ICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqL1xuRXZlbnRzLnByb3RvdHlwZS51bm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICBkZWxldGUgdGhpc1tNVVRFX09QVElPTl07XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50cztcbiIsInZhciB2b3cgPSByZXF1aXJlKCd2b3cnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9icm93c2VyL2RldGVjdCcpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBQcm9taXNlXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZXxFUyAyMDE1IFByb21pc2V9XG4gKiBAY2xhc3NcbiAqIEBuYW1lIFByb21pc2VcbiAqIEBwcml2YXRlXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFByb21pc2U7XG5pZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlICE9PSBcImZ1bmN0aW9uXCJcbiAgICB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcImVkZ2VcIiAvLyDQvNC10LvQutC40LUg0LzRj9Cz0LrQuNC1INC60LDQuiDQstGB0LXQs9C00LAg0L3QuNGH0LXQs9C+INC90LUg0YPQvNC10Y7RgiDQtNC10LvQsNGC0Ywg0L/RgNCw0LLQuNC70YzQvdC+XG4pIHtcbiAgICBQcm9taXNlID0gdm93LlByb21pc2U7XG59IGVsc2Uge1xuICAgIFByb21pc2UgPSB3aW5kb3cuUHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUsINGA0LDQt9GA0LXRiNC10L3QvdC+0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LzQuCDQtNCw0L3QvdGL0LzQuC5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgUHJvbWlzZS5yZXNvbHZlXG4gKiBAcGFyYW0geyp9IGRhdGEg0JTQsNC90L3Ri9C1LCDQutC+0YLQvtGA0YvQvNC4INGA0LDQt9GA0LXRiNC40YLRjCDQvtCx0LXRidCw0L3QuNC1LlxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9IFByb21pc2Ut0L7QsdGK0LXQutGCLlxuICogQHByaXZhdGVcbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUsINC+0YLQutC70L7QvdC10L3QvdC+0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LzQuCDQtNCw0L3QvdGL0LzQuC5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgUHJvbWlzZS5yZWplY3RcbiAqIEBwYXJhbSB7Kn0gZGF0YSDQlNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0L7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LUuXG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZS3QvtCx0YrQtdC60YIuXG4gKiBAcHJpdmF0ZVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTRg9GCINCy0YvQv9C+0LvQvdC10L3RiyDQstGB0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0L7QsdC10YnQsNC90LjRjy5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgUHJvbWlzZS5hbGxcbiAqIEBwYXJhbSB7UHJvbWlzZVtdfSBwcm9taXNlcyDQodC/0LjRgdC+0Log0L7QsdC10YnQsNC90LjQuS5cbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlLdC+0LHRitC10LrRgi5cbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDQstGL0L/QvtC70L3QuNGC0YHRjyDRgtC+0LPQtNCwLCDQutC+0LPQtNCwINCx0YPQtNC10YIg0LLRi9C/0L7Qu9C90LXQvdC+INGF0L7RgtGPINCx0Ysg0L7QtNC90L4g0LjQtyDQv9C10YDQtdC00LDQvdC90YvRhSDQvtCx0LXRidCw0L3QuNC5LlxuICogQG5hbWUgUHJvbWlzZS5yYWNlXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7UHJvbWlzZVtdfSBwcm9taXNlcyDQodC/0LjRgdC+0Log0L7QsdC10YnQsNC90LjQuS5cbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlLdC+0LHRitC10LrRgi5cbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgNCw0LfRgNC10YjQtdC90LjRjyDQuCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPLlxuICogQGZ1bmN0aW9uXG4gKiBAbmFtZSBQcm9taXNlI3RoZW5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrINCe0LHRgNCw0LHQvtGC0YfQuNC6INGD0YHQv9C10YXQsC5cbiAqIEBwYXJhbSB7bnVsbHxmdW5jdGlvbn0gW2VycmJhY2tdINCe0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSDQvdC+0LLQvtC1INC+0LHQtdGJ0LDQvdC40LUg0LjQtyDRgNC10LfRg9C70YzRgtCw0YLQvtCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LAuXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRjy5cbiAqIEBuYW1lIFByb21pc2UjY2F0Y2hcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtmdW5jdGlvbn0gZXJyYmFjayDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwLlxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIEFib3J0YWJsZVByb21pc2VcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3Mg0J7QsdC10YnQsNC90LjQtSDRgSDQstC+0LfQvNC+0LbQvdC+0YHRgtGM0Y4g0L7RgtC80LXQvdGLINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC90LjQvCDQtNC10LnRgdGC0LLQuNGPLlxuICogPHA+0KDQsNGB0YjQuNGA0Y/QtdGCIDx4cmVmIHNjb3BlPVwiZXh0ZXJuYWxcIiBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZVwiPlByb21pc2U8L3hyZWY+LjwvcD5cbiAqIEBuYW1lIEFib3J0YWJsZVByb21pc2VcbiAqL1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQtNC10LnRgdGC0LLQuNGPINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC+0LHQtdGJ0LDQvdC40LXQvC4g0JDQsdGB0YLRgNCw0LrRgtC90YvQuSDQvNC10YLQvtC0LlxuICogQGFic3RyYWN0XG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEFib3J0YWJsZVByb21pc2UjYWJvcnRcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSByZWFzb24g0J/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC00LXQudGB0YLQstC40Y8uXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgNCw0LfRgNC10YjQtdC90LjRjyDQuCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPLlxuICogPHA+0KPQvdCw0YHQu9C10LTQvtCy0LDQvSDQvtGCIDx4cmVmIHNjb3BlPVwiZXh0ZXJuYWxcIiBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZVwiPlByb21pc2U8L3hyZWY+LjwvcD5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQWJvcnRhYmxlUHJvbWlzZSN0aGVuXG4gKiBAaW5oZXJpdGVkXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayDQntCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGF0LAuXG4gKiBAcGFyYW0ge251bGx8ZnVuY3Rpb259IFtlcnJiYWNrXSDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwLlxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y8uXG4gKiA8cD7Qo9C90LDRgdC70LXQtNC+0LLQsNC9INC+0YIgPHhyZWYgc2NvcGU9XCJleHRlcm5hbFwiIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9ydS9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9Qcm9taXNlXCI+UHJvbWlzZTwveHJlZj4uPC9wPlxuICogQG5hbWUgQWJvcnRhYmxlUHJvbWlzZSNjYXRjaFxuICogQGluaGVyaXRlZFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBlcnJiYWNrINCe0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSDQvdC+0LLQvtC1INC+0LHQtdGJ0LDQvdC40LUg0LjQtyDRgNC10LfRg9C70YzRgtCw0YLQvtCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LAuXG4gKi9cbiIsInZhciBub29wID0gcmVxdWlyZSgnLi4vbm9vcCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcblxuLyoqXG4gKiDQodC+0LTQsNC90LjQtSDQvtGC0LrQu9C+0L3RkdC90L3QvtCz0L4g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNC+0LUg0L3QtSDQv9C70Y7RkdGC0YHRjyDQsiDQutC+0L3RgdC+0LvRjCDQvtGI0LjQsdC60L7QuVxuICogQHBhcmFtIHtFcnJvcn0gZGF0YSAtINC/0YDQuNGH0LjQvdCwINC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xudmFyIHJlamVjdCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgcHJvbWlzZSA9IFByb21pc2UucmVqZWN0KGRhdGEpO1xuICAgIHByb21pc2VbXCJjYXRjaFwiXShub29wKTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcmVqZWN0O1xuIiwidmFyIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQsdGA0LDRg9C30LXRgNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIFVzZXJhZ2VudCBSZWdFeHBcbnZhciBydWMgPSAvKHVjYnJvd3NlcilcXC8oW1xcdy5dKykvO1xudmFyIHJ3ZWJraXQgPSAvKHdlYmtpdClbIFxcL10oW1xcdy5dKykvO1xudmFyIHJ5YWJybyA9IC8oeWFicm93c2VyKVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcm9wZXJhID0gLyhvcHJ8b3BlcmEpKD86Lip2ZXJzaW9uKT9bIFxcL10oW1xcdy5dKykvO1xudmFyIHJtc2llID0gLyhtc2llKSAoW1xcdy5dKykvO1xudmFyIHJlZGdlID0gLyhlZGdlKVxcLyhbXFx3Ll0rKS87XG52YXIgcm1tc2llID0gLyhpZW1vYmlsZSlcXC8oW1xcZFxcLl0rKS87XG52YXIgcm1vemlsbGEgPSAvKG1vemlsbGEpKD86Lio/IHJ2OihbXFx3Ll0rKSk/LztcbnZhciByc2FmYXJpID0gL14oKD8hY2hyb21lKS4pKnZlcnNpb25cXC8oW1xcZFxcd1xcLl0rKS4qKHNhZmFyaSkvO1xuXG52YXIgbWF0Y2ggPSBydWMuZXhlYyh1YSlcbiAgICB8fCByc2FmYXJpLmV4ZWModWEpXG4gICAgfHwgcnlhYnJvLmV4ZWModWEpXG4gICAgfHwgcmVkZ2UuZXhlYyh1YSlcbiAgICB8fCBybW1zaWUuZXhlYyh1YSlcbiAgICB8fCByb3BlcmEuZXhlYyh1YSlcbiAgICB8fCByd2Via2l0LmV4ZWModWEpXG4gICAgfHwgcm1zaWUuZXhlYyh1YSlcbiAgICB8fCB1YS5pbmRleE9mKFwiY29tcGF0aWJsZVwiKSA8IDAgJiYgcm1vemlsbGEuZXhlYyh1YSlcbiAgICB8fCBbXTtcblxudmFyIGJyb3dzZXIgPSB7bmFtZTogbWF0Y2hbMV0gfHwgXCJcIiwgdmVyc2lvbjogbWF0Y2hbMl0gfHwgXCIwXCJ9O1xuXG5pZiAobWF0Y2hbM10gPT09IFwic2FmYXJpXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBtYXRjaFszXTtcbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gJ21zaWUnKSB7XG4gICAgaWYgKGRvY3VtZW50LmRvY3VtZW50TW9kZSkgeyAvLyBJRTggb3IgbGF0ZXJcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgfSBlbHNlIHsgLy8gSUUgNS03XG4gICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNTsgLy8gQXNzdW1lIHF1aXJrcyBtb2RlIHVubGVzcyBwcm92ZW4gb3RoZXJ3aXNlXG4gICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuY29tcGF0TW9kZSA9PT0gXCJDU1MxQ29tcGF0XCIpIHtcbiAgICAgICAgICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IDc7IC8vIHN0YW5kYXJkcyBtb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmIChicm93c2VyLm5hbWUgPT09IFwib3ByXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBcIm9wZXJhXCI7XG59XG5cbi8vSU5GTzogSUUgKNC60LDQuiDQstGB0LXQs9C00LApINC90LUg0LrQvtGA0YDQtdC60YLQvdC+INCy0YvRgdGC0LDQstC70Y/QtdGCIHVzZXItYWdlbnRcbmlmIChicm93c2VyLm5hbWUgPT09IFwibW96aWxsYVwiICYmIGJyb3dzZXIudmVyc2lvbi5zcGxpdChcIi5cIilbMF0gPT09IFwiMTFcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwibXNpZVwiO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LDRgtGE0L7RgNC80LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gVXNlcmFnZW50IFJlZ0V4cFxudmFyIHJwbGF0Zm9ybSA9IC8od2luZG93cyBwaG9uZXxpcGFkfGlwaG9uZXxpcG9kfGFuZHJvaWR8YmxhY2tiZXJyeXxwbGF5Ym9va3x3aW5kb3dzIGNlfHdlYm9zKS87XG52YXIgcnRhYmxldCA9IC8oaXBhZHxwbGF5Ym9vaykvO1xudmFyIHJhbmRyb2lkID0gLyhhbmRyb2lkKS87XG52YXIgcm1vYmlsZSA9IC8obW9iaWxlKS87XG5cbnBsYXRmb3JtID0gcnBsYXRmb3JtLmV4ZWModWEpIHx8IFtdO1xudmFyIHRhYmxldCA9IHJ0YWJsZXQuZXhlYyh1YSkgfHwgIXJtb2JpbGUuZXhlYyh1YSkgJiYgcmFuZHJvaWQuZXhlYyh1YSkgfHwgW107XG5cbmlmIChwbGF0Zm9ybVsxXSkge1xuICAgIHBsYXRmb3JtWzFdID0gcGxhdGZvcm1bMV0ucmVwbGFjZSgvXFxzL2csIFwiX1wiKTsgLy8gQ2hhbmdlIHdoaXRlc3BhY2UgdG8gdW5kZXJzY29yZS4gRW5hYmxlcyBkb3Qgbm90YXRpb24uXG59XG5cbnZhciBwbGF0Zm9ybSA9IHtcbiAgICB0eXBlOiBwbGF0Zm9ybVsxXSB8fCBcIlwiLFxuICAgIHRhYmxldDogISF0YWJsZXRbMV0sXG4gICAgbW9iaWxlOiBwbGF0Zm9ybVsxXSAmJiAhdGFibGV0WzFdIHx8IGZhbHNlXG59O1xuaWYgKCFwbGF0Zm9ybS50eXBlKSB7XG4gICAgcGxhdGZvcm0udHlwZSA9ICdwYyc7XG59XG5cbnBsYXRmb3JtLm9zID0gcGxhdGZvcm0udHlwZTtcbmlmIChwbGF0Zm9ybS50eXBlID09PSAnaXBhZCcgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwaG9uZScgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwb2QnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnaW9zJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnYW5kcm9pZCc7XG59IGVsc2UgaWYgKHBsYXRmb3JtLnR5cGUgPT09IFwid2luZG93cyBwaG9uZVwiIHx8IG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJXaW5cIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIndpbmRvd3NcIjtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvd2luW14gXSogKFteO10qKS9pKTtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gcGxhdGZvcm0udmVyc2lvbiAmJiBwbGF0Zm9ybS52ZXJzaW9uWzFdO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJtYWNvc1wiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ1bml4XCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJMaW51eFwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibGludXhcIjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvNC10L3Rj9GC0Ywg0LPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG52YXIgbm9Wb2x1bWUgPSB0cnVlO1xudHJ5IHtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIGF1ZGlvLnZvbHVtZSA9IDAuNjM7XG4gICAgbm9Wb2x1bWUgPSBNYXRoLmFicyhhdWRpby52b2x1bWUgLSAwLjYzKSA+IDAuMDE7XG59IGNhdGNoKGUpIHtcbiAgICBub1ZvbHVtZSA9IHRydWU7XG59XG5cbi8qKlxuICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L7QsSDQvtC60YDRg9C20LXQvdC40LhcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBkZXRlY3QgPSB7XG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LHRgNCw0YPQt9C10YDQtVxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG5hbWUgLSDQvdCw0LfQstCw0L3QuNC1INCx0YDQsNGD0LfQtdGA0LBcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdmVyc2lvbiAtINCy0LXRgNGB0LjRj1xuICAgICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbZG9jdW1lbnRNb2RlXSAtINCy0LXRgNGB0LjRjyDQtNC+0LrRg9C80LXQvdGC0LBcbiAgICAgKi9cbiAgICBicm93c2VyOiBicm93c2VyLFxuXG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0L/Qu9Cw0YLRhNC+0YDQvNC1XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gb3MgLSDRgtC40L8g0L7Qv9C10YDQsNGG0LjQvtC90L3QvtC5INGB0LjRgdGC0LXQvNGLXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHR5cGUgLSDRgtC40L8g0L/Qu9Cw0YLRhNC+0YDQvNGLXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSB0YWJsZXQgLSDQv9C70LDQvdGI0LXRglxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbW9iaWxlIC0g0LzQvtCx0LjQu9GM0L3Ri9C5XG4gICAgICovXG4gICAgcGxhdGZvcm06IHBsYXRmb3JtLFxuXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINCz0YDQvtC80LrQvtGB0YLQuFxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG9ubHlEZXZpY2VWb2x1bWU6IG5vVm9sdW1lXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRldGVjdDtcbiIsIi8qKlxuICogQGxpY2Vuc2UgU1dGT2JqZWN0IHYyLjIgPGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3QvPlxuICogaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlIDxodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocD5cbiAqIEBwcml2YXRlXG4qL1xudmFyIHN3Zm9iamVjdCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgVU5ERUYgPSBcInVuZGVmaW5lZFwiLFxuXHRcdE9CSkVDVCA9IFwib2JqZWN0XCIsXG5cdFx0U0hPQ0tXQVZFX0ZMQVNIID0gXCJTaG9ja3dhdmUgRmxhc2hcIixcblx0XHRTSE9DS1dBVkVfRkxBU0hfQVggPSBcIlNob2Nrd2F2ZUZsYXNoLlNob2Nrd2F2ZUZsYXNoXCIsXG5cdFx0RkxBU0hfTUlNRV9UWVBFID0gXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiLFxuXHRcdEVYUFJFU1NfSU5TVEFMTF9JRCA9IFwiU1dGT2JqZWN0RXhwckluc3RcIixcblx0XHRPTl9SRUFEWV9TVEFURV9DSEFOR0UgPSBcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLFxuXHRcdHdpbiA9IHdpbmRvdyxcblx0XHRkb2MgPSBkb2N1bWVudCxcblx0XHRuYXYgPSBuYXZpZ2F0b3IsXG5cdFx0cGx1Z2luID0gZmFsc2UsXG5cdFx0ZG9tTG9hZEZuQXJyID0gW21haW5dLFxuXHRcdHJlZ09iakFyciA9IFtdLFxuXHRcdG9iaklkQXJyID0gW10sXG5cdFx0bGlzdGVuZXJzQXJyID0gW10sXG5cdFx0c3RvcmVkQWx0Q29udGVudCxcblx0XHRzdG9yZWRBbHRDb250ZW50SWQsXG5cdFx0c3RvcmVkQ2FsbGJhY2tGbixcblx0XHRzdG9yZWRDYWxsYmFja09iaixcblx0XHRpc0RvbUxvYWRlZCA9IGZhbHNlLFxuXHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSBmYWxzZSxcblx0XHRkeW5hbWljU3R5bGVzaGVldCxcblx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhLFxuXHRcdGF1dG9IaWRlU2hvdyA9IHRydWUsXG5cdC8qIENlbnRyYWxpemVkIGZ1bmN0aW9uIGZvciBicm93c2VyIGZlYXR1cmUgZGV0ZWN0aW9uXG5cdFx0LSBVc2VyIGFnZW50IHN0cmluZyBkZXRlY3Rpb24gaXMgb25seSB1c2VkIHdoZW4gbm8gZ29vZCBhbHRlcm5hdGl2ZSBpcyBwb3NzaWJsZVxuXHRcdC0gSXMgZXhlY3V0ZWQgZGlyZWN0bHkgZm9yIG9wdGltYWwgcGVyZm9ybWFuY2Vcblx0Ki9cblx0dWEgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdzNjZG9tID0gdHlwZW9mIGRvYy5nZXRFbGVtZW50QnlJZCAhPSBVTkRFRiAmJiB0eXBlb2YgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lICE9IFVOREVGICYmIHR5cGVvZiBkb2MuY3JlYXRlRWxlbWVudCAhPSBVTkRFRixcblx0XHRcdHUgPSBuYXYudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG5cdFx0XHRwID0gbmF2LnBsYXRmb3JtLnRvTG93ZXJDYXNlKCksXG5cdFx0XHR3aW5kb3dzID0gcCA/IC93aW4vLnRlc3QocCkgOiAvd2luLy50ZXN0KHUpLFxuXHRcdFx0bWFjID0gcCA/IC9tYWMvLnRlc3QocCkgOiAvbWFjLy50ZXN0KHUpLFxuXHRcdFx0d2Via2l0ID0gL3dlYmtpdC8udGVzdCh1KSA/IHBhcnNlRmxvYXQodS5yZXBsYWNlKC9eLip3ZWJraXRcXC8oXFxkKyhcXC5cXGQrKT8pLiokLywgXCIkMVwiKSkgOiBmYWxzZSwgLy8gcmV0dXJucyBlaXRoZXIgdGhlIHdlYmtpdCB2ZXJzaW9uIG9yIGZhbHNlIGlmIG5vdCB3ZWJraXRcblx0XHRcdGllID0gIStcIlxcdjFcIiwgLy8gZmVhdHVyZSBkZXRlY3Rpb24gYmFzZWQgb24gQW5kcmVhIEdpYW1tYXJjaGkncyBzb2x1dGlvbjogaHR0cDovL3dlYnJlZmxlY3Rpb24uYmxvZ3Nwb3QuY29tLzIwMDkvMDEvMzItYnl0ZXMtdG8ta25vdy1pZi15b3VyLWJyb3dzZXItaXMtaWUuaHRtbFxuXHRcdFx0cGxheWVyVmVyc2lvbiA9IFswLDAsMF0sXG5cdFx0XHRkID0gbnVsbDtcblx0XHRpZiAodHlwZW9mIG5hdi5wbHVnaW5zICE9IFVOREVGICYmIHR5cGVvZiBuYXYucGx1Z2luc1tTSE9DS1dBVkVfRkxBU0hdID09IE9CSkVDVCkge1xuXHRcdFx0ZCA9IG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0uZGVzY3JpcHRpb247XG5cdFx0XHRpZiAoZCAmJiAhKHR5cGVvZiBuYXYubWltZVR5cGVzICE9IFVOREVGICYmIG5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXSAmJiAhbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdLmVuYWJsZWRQbHVnaW4pKSB7IC8vIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiXS5lbmFibGVkUGx1Z2luIGluZGljYXRlcyB3aGV0aGVyIHBsdWctaW5zIGFyZSBlbmFibGVkIG9yIGRpc2FibGVkIGluIFNhZmFyaSAzK1xuXHRcdFx0XHRwbHVnaW4gPSB0cnVlO1xuXHRcdFx0XHRpZSA9IGZhbHNlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0ZCA9IGQucmVwbGFjZSgvXi4qXFxzKyhcXFMrXFxzK1xcUyskKS8sIFwiJDFcIik7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMF0gPSBwYXJzZUludChkLnJlcGxhY2UoL14oLiopXFwuLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzFdID0gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipcXC4oLiopXFxzLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzJdID0gL1thLXpBLVpdLy50ZXN0KGQpID8gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipbYS16QS1aXSsoLiopJC8sIFwiJDFcIiksIDEwKSA6IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4uQWN0aXZlWE9iamVjdCAhPSBVTkRFRikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGEgPSBuZXcgQWN0aXZlWE9iamVjdChTSE9DS1dBVkVfRkxBU0hfQVgpO1xuXHRcdFx0XHRpZiAoYSkgeyAvLyBhIHdpbGwgcmV0dXJuIG51bGwgd2hlbiBBY3RpdmVYIGlzIGRpc2FibGVkXG5cdFx0XHRcdFx0ZCA9IGEuR2V0VmFyaWFibGUoXCIkdmVyc2lvblwiKTtcblx0XHRcdFx0XHRpZiAoZCkge1xuXHRcdFx0XHRcdFx0aWUgPSB0cnVlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0XHRcdGQgPSBkLnNwbGl0KFwiIFwiKVsxXS5zcGxpdChcIixcIik7XG5cdFx0XHRcdFx0XHRwbGF5ZXJWZXJzaW9uID0gW3BhcnNlSW50KGRbMF0sIDEwKSwgcGFyc2VJbnQoZFsxXSwgMTApLCBwYXJzZUludChkWzJdLCAxMCldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2F0Y2goZSkge31cblx0XHR9XG5cdFx0cmV0dXJuIHsgdzM6dzNjZG9tLCBwdjpwbGF5ZXJWZXJzaW9uLCB3azp3ZWJraXQsIGllOmllLCB3aW46d2luZG93cywgbWFjOm1hYyB9O1xuXHR9KCk7XG5cdC8qIENyb3NzLWJyb3dzZXIgb25Eb21Mb2FkXG5cdFx0LSBXaWxsIGZpcmUgYW4gZXZlbnQgYXMgc29vbiBhcyB0aGUgRE9NIG9mIGEgd2ViIHBhZ2UgaXMgbG9hZGVkXG5cdFx0LSBJbnRlcm5ldCBFeHBsb3JlciB3b3JrYXJvdW5kIGJhc2VkIG9uIERpZWdvIFBlcmluaSdzIHNvbHV0aW9uOiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vSUVDb250ZW50TG9hZGVkL1xuXHRcdC0gUmVndWxhciBvbmxvYWQgc2VydmVzIGFzIGZhbGxiYWNrXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAoIXVhLnczKSB7IHJldHVybjsgfVxuXHRcdGlmICgodHlwZW9mIGRvYy5yZWFkeVN0YXRlICE9IFVOREVGICYmIGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikgfHwgKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSA9PSBVTkRFRiAmJiAoZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXSB8fCBkb2MuYm9keSkpKSB7IC8vIGZ1bmN0aW9uIGlzIGZpcmVkIGFmdGVyIG9ubG9hZCwgZS5nLiB3aGVuIHNjcmlwdCBpcyBpbnNlcnRlZCBkeW5hbWljYWxseVxuXHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHR9XG5cdFx0aWYgKCFpc0RvbUxvYWRlZCkge1xuXHRcdFx0aWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgY2FsbERvbUxvYWRGdW5jdGlvbnMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdFx0ZG9jLmF0dGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikge1xuXHRcdFx0XHRcdFx0ZG9jLmRldGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgYXJndW1lbnRzLmNhbGxlZSk7XG5cdFx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICh3aW4gPT0gdG9wKSB7IC8vIGlmIG5vdCBpbnNpZGUgYW4gaWZyYW1lXG5cdFx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRkb2MuZG9jdW1lbnRFbGVtZW50LmRvU2Nyb2xsKFwibGVmdFwiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoKGUpIHtcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAwKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9KSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEud2spIHtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICghL2xvYWRlZHxjb21wbGV0ZS8udGVzdChkb2MucmVhZHlTdGF0ZSkpIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRhZGRMb2FkRXZlbnQoY2FsbERvbUxvYWRGdW5jdGlvbnMpO1xuXHRcdH1cblx0fSkoKTtcblx0ZnVuY3Rpb24gY2FsbERvbUxvYWRGdW5jdGlvbnMoKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdHRyeSB7IC8vIHRlc3QgaWYgd2UgY2FuIHJlYWxseSBhZGQvcmVtb3ZlIGVsZW1lbnRzIHRvL2Zyb20gdGhlIERPTTsgd2UgZG9uJ3Qgd2FudCB0byBmaXJlIGl0IHRvbyBlYXJseVxuXHRcdFx0dmFyIHQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLmFwcGVuZENoaWxkKGNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTtcblx0XHRcdHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHsgcmV0dXJuOyB9XG5cdFx0aXNEb21Mb2FkZWQgPSB0cnVlO1xuXHRcdHZhciBkbCA9IGRvbUxvYWRGbkFyci5sZW5ndGg7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkbDsgaSsrKSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbaV0oKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWRkRG9tTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7XG5cdFx0XHRmbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvbUxvYWRGbkFycltkb21Mb2FkRm5BcnIubGVuZ3RoXSA9IGZuOyAvLyBBcnJheS5wdXNoKCkgaXMgb25seSBhdmFpbGFibGUgaW4gSUU1LjUrXG5cdFx0fVxuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgb25sb2FkXG5cdFx0LSBCYXNlZCBvbiBKYW1lcyBFZHdhcmRzJyBzb2x1dGlvbjogaHR0cDovL2Jyb3RoZXJjYWtlLmNvbS9zaXRlL3Jlc291cmNlcy9zY3JpcHRzL29ubG9hZC9cblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIGEgd2ViIHBhZ2UgaW5jbHVkaW5nIGFsbCBvZiBpdHMgYXNzZXRzIGFyZSBsb2FkZWRcblx0ICovXG5cdGZ1bmN0aW9uIGFkZExvYWRFdmVudChmbikge1xuXHRcdGlmICh0eXBlb2Ygd2luLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdHdpbi5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLmF0dGFjaEV2ZW50ICE9IFVOREVGKSB7XG5cdFx0XHRhZGRMaXN0ZW5lcih3aW4sIFwib25sb2FkXCIsIGZuKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5vbmxvYWQgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2YXIgZm5PbGQgPSB3aW4ub25sb2FkO1xuXHRcdFx0d2luLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmbk9sZCgpO1xuXHRcdFx0XHRmbigpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR3aW4ub25sb2FkID0gZm47XG5cdFx0fVxuXHR9XG5cdC8qIE1haW4gZnVuY3Rpb25cblx0XHQtIFdpbGwgcHJlZmVyYWJseSBleGVjdXRlIG9uRG9tTG9hZCwgb3RoZXJ3aXNlIG9ubG9hZCAoYXMgYSBmYWxsYmFjaylcblx0Ki9cblx0ZnVuY3Rpb24gbWFpbigpIHtcblx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHR0ZXN0UGxheWVyVmVyc2lvbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogRGV0ZWN0IHRoZSBGbGFzaCBQbGF5ZXIgdmVyc2lvbiBmb3Igbm9uLUludGVybmV0IEV4cGxvcmVyIGJyb3dzZXJzXG5cdFx0LSBEZXRlY3RpbmcgdGhlIHBsdWctaW4gdmVyc2lvbiB2aWEgdGhlIG9iamVjdCBlbGVtZW50IGlzIG1vcmUgcHJlY2lzZSB0aGFuIHVzaW5nIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXRlbSdzIGRlc2NyaXB0aW9uOlxuXHRcdCAgYS4gQm90aCByZWxlYXNlIGFuZCBidWlsZCBudW1iZXJzIGNhbiBiZSBkZXRlY3RlZFxuXHRcdCAgYi4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IGNvcnJ1cHQgaW5zdGFsbGVycyBwcm92aWRlZCBieSBBZG9iZVxuXHRcdCAgYy4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IG11bHRpcGxlIEZsYXNoIFBsYXllciBlbnRyaWVzIGluIHRoZSBwbHVnaW4gQXJyYXksIGNhdXNlZCBieSBpbmNvcnJlY3QgYnJvd3NlciBpbXBvcnRzXG5cdFx0LSBEaXNhZHZhbnRhZ2Ugb2YgdGhpcyBtZXRob2QgaXMgdGhhdCBpdCBkZXBlbmRzIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIERPTSwgd2hpbGUgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpcyBpbW1lZGlhdGVseSBhdmFpbGFibGVcblx0Ki9cblx0ZnVuY3Rpb24gdGVzdFBsYXllclZlcnNpb24oKSB7XG5cdFx0dmFyIGIgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO1xuXHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdHZhciB0ID0gYi5hcHBlbmRDaGlsZChvKTtcblx0XHRpZiAodCkge1xuXHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmICh0eXBlb2YgdC5HZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdHZhciBkID0gdC5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0dWEucHYgPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGNvdW50ZXIgPCAxMCkge1xuXHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yi5yZW1vdmVDaGlsZChvKTtcblx0XHRcdFx0dCA9IG51bGw7XG5cdFx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBQZXJmb3JtIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWF0Y2hpbmc7IHN0YXRpYyBwdWJsaXNoaW5nIG9ubHlcblx0Ki9cblx0ZnVuY3Rpb24gbWF0Y2hWZXJzaW9ucygpIHtcblx0XHR2YXIgcmwgPSByZWdPYmpBcnIubGVuZ3RoO1xuXHRcdGlmIChybCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmw7IGkrKykgeyAvLyBmb3IgZWFjaCByZWdpc3RlcmVkIG9iamVjdCBlbGVtZW50XG5cdFx0XHRcdHZhciBpZCA9IHJlZ09iakFycltpXS5pZDtcblx0XHRcdFx0dmFyIGNiID0gcmVnT2JqQXJyW2ldLmNhbGxiYWNrRm47XG5cdFx0XHRcdHZhciBjYk9iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDppZH07XG5cdFx0XHRcdGlmICh1YS5wdlswXSA+IDApIHtcblx0XHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdFx0XHRcdGlmIChvYmopIHtcblx0XHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHJlZ09iakFycltpXS5zd2ZWZXJzaW9uKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSkgeyAvLyBGbGFzaCBQbGF5ZXIgdmVyc2lvbiA+PSBwdWJsaXNoZWQgU1dGIHZlcnNpb246IEhvdXN0b24sIHdlIGhhdmUgYSBtYXRjaCFcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IGdldE9iamVjdEJ5SWQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZyBpZiBzZXQgYnkgdGhlIHdlYiBwYWdlIGF1dGhvciBhbmQgaWYgc3VwcG9ydGVkXG5cdFx0XHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRcdFx0YXR0LmRhdGEgPSByZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGw7XG5cdFx0XHRcdFx0XHRcdGF0dC53aWR0aCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0YXR0LmhlaWdodCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIHsgYXR0LnN0eWxlY2xhc3MgPSBvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7IH1cblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKSkgeyBhdHQuYWxpZ24gPSBvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIik7IH1cblx0XHRcdFx0XHRcdFx0Ly8gcGFyc2UgSFRNTCBvYmplY3QgcGFyYW0gZWxlbWVudCdzIG5hbWUtdmFsdWUgcGFpcnNcblx0XHRcdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgcCA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcmFtXCIpO1xuXHRcdFx0XHRcdFx0XHR2YXIgcGwgPSBwLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwbDsgaisrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKS50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cGFyW3Bbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKV0gPSBwW2pdLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIGlkLCBjYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHsgLy8gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtaXNtYXRjaCBvciBhbiBvbGRlciBXZWJraXQgZW5naW5lIHRoYXQgaWdub3JlcyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCdzIG5lc3RlZCBwYXJhbSBlbGVtZW50czogZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50IGluc3RlYWQgb2YgU1dGXG5cdFx0XHRcdFx0XHRcdGRpc3BsYXlBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikgeyBjYihjYk9iaik7IH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XHQvLyBpZiBubyBGbGFzaCBQbGF5ZXIgaXMgaW5zdGFsbGVkIG9yIHRoZSBmcCB2ZXJzaW9uIGNhbm5vdCBiZSBkZXRlY3RlZCB3ZSBsZXQgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgZG8gaXRzIGpvYiAoZWl0aGVyIHNob3cgYSBTV0Ygb3IgYWx0ZXJuYXRpdmUgY29udGVudClcblx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdHZhciBvID0gZ2V0T2JqZWN0QnlJZChpZCk7IC8vIHRlc3Qgd2hldGhlciB0aGVyZSBpcyBhbiBIVE1MIG9iamVjdCBlbGVtZW50IG9yIG5vdFxuXHRcdFx0XHRcdFx0aWYgKG8gJiYgdHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IG87XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpIHtcblx0XHR2YXIgciA9IG51bGw7XG5cdFx0dmFyIG8gPSBnZXRFbGVtZW50QnlJZChvYmplY3RJZFN0cik7XG5cdFx0aWYgKG8gJiYgby5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIG4gPSBvLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRcdGlmIChuKSB7XG5cdFx0XHRcdFx0ciA9IG47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0LyogUmVxdWlyZW1lbnRzIGZvciBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHQtIG9ubHkgb25lIGluc3RhbmNlIGNhbiBiZSBhY3RpdmUgYXQgYSB0aW1lXG5cdFx0LSBmcCA2LjAuNjUgb3IgaGlnaGVyXG5cdFx0LSBXaW4vTWFjIE9TIG9ubHlcblx0XHQtIG5vIFdlYmtpdCBlbmdpbmVzIG9sZGVyIHRoYW4gdmVyc2lvbiAzMTJcblx0Ki9cblx0ZnVuY3Rpb24gY2FuRXhwcmVzc0luc3RhbGwoKSB7XG5cdFx0cmV0dXJuICFpc0V4cHJlc3NJbnN0YWxsQWN0aXZlICYmIGhhc1BsYXllclZlcnNpb24oXCI2LjAuNjVcIikgJiYgKHVhLndpbiB8fCB1YS5tYWMpICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpO1xuXHR9XG5cdC8qIFNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2dcblx0XHQtIFJlZmVyZW5jZTogaHR0cDovL3d3dy5hZG9iZS5jb20vY2Z1c2lvbi9rbm93bGVkZ2ViYXNlL2luZGV4LmNmbT9pZD02YTI1M2I3NVxuXHQqL1xuXHRmdW5jdGlvbiBzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gdHJ1ZTtcblx0XHRzdG9yZWRDYWxsYmFja0ZuID0gY2FsbGJhY2tGbiB8fCBudWxsO1xuXHRcdHN0b3JlZENhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRpZiAob2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHsgLy8gc3RhdGljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IGFic3RyYWN0QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIGR5bmFtaWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gb2JqO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSByZXBsYWNlRWxlbUlkU3RyO1xuXHRcdFx0fVxuXHRcdFx0YXR0LmlkID0gRVhQUkVTU19JTlNUQUxMX0lEO1xuXHRcdFx0aWYgKHR5cGVvZiBhdHQud2lkdGggPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LndpZHRoKSAmJiBwYXJzZUludChhdHQud2lkdGgsIDEwKSA8IDMxMCkpIHsgYXR0LndpZHRoID0gXCIzMTBcIjsgfVxuXHRcdFx0aWYgKHR5cGVvZiBhdHQuaGVpZ2h0ID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC5oZWlnaHQpICYmIHBhcnNlSW50KGF0dC5oZWlnaHQsIDEwKSA8IDEzNykpIHsgYXR0LmhlaWdodCA9IFwiMTM3XCI7IH1cblx0XHRcdGRvYy50aXRsZSA9IGRvYy50aXRsZS5zbGljZSgwLCA0NykgKyBcIiAtIEZsYXNoIFBsYXllciBJbnN0YWxsYXRpb25cIjtcblx0XHRcdHZhciBwdCA9IHVhLmllICYmIHVhLndpbiA/IFwiQWN0aXZlWFwiIDogXCJQbHVnSW5cIixcblx0XHRcdFx0ZnYgPSBcIk1NcmVkaXJlY3RVUkw9XCIgKyB3aW4ubG9jYXRpb24udG9TdHJpbmcoKS5yZXBsYWNlKC8mL2csXCIlMjZcIikgKyBcIiZNTXBsYXllclR5cGU9XCIgKyBwdCArIFwiJk1NZG9jdGl0bGU9XCIgKyBkb2MudGl0bGU7XG5cdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGZ2O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBmdjtcblx0XHRcdH1cblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHRcdHZhciBuZXdPYmogPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0XHRyZXBsYWNlRWxlbUlkU3RyICs9IFwiU1dGT2JqZWN0TmV3XCI7XG5cdFx0XHRcdG5ld09iai5zZXRBdHRyaWJ1dGUoXCJpZFwiLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld09iaiwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG9iamVjdCBlbGVtZW50IHRoYXQgbG9hZHMgZXhwcmVzc2luc3RhbGwuc3dmXG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBhYnN0cmFjdCBhbmQgZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGRpc3BsYXlBbHRDb250ZW50KG9iaikge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIGVsKTtcblx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgb2JqKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWJzdHJhY3RBbHRDb250ZW50KG9iaikge1xuXHRcdHZhciBhYyA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0aWYgKHVhLndpbiAmJiB1YS5pZSkge1xuXHRcdFx0YWMuaW5uZXJIVE1MID0gb2JqLmlubmVySFRNTDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgbmVzdGVkT2JqID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRpZiAobmVzdGVkT2JqKSB7XG5cdFx0XHRcdHZhciBjID0gbmVzdGVkT2JqLmNoaWxkTm9kZXM7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0dmFyIGNsID0gYy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjbDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShjW2ldLm5vZGVUeXBlID09IDEgJiYgY1tpXS5ub2RlTmFtZSA9PSBcIlBBUkFNXCIpICYmICEoY1tpXS5ub2RlVHlwZSA9PSA4KSkge1xuXHRcdFx0XHRcdFx0XHRhYy5hcHBlbmRDaGlsZChjW2ldLmNsb25lTm9kZSh0cnVlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBhYztcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgU1dGIGNyZWF0aW9uXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgaWQpIHtcblx0XHR2YXIgciwgZWwgPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKHVhLndrICYmIHVhLndrIDwgMzEyKSB7IHJldHVybiByOyB9XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRpZiAodHlwZW9mIGF0dE9iai5pZCA9PSBVTkRFRikgeyAvLyBpZiBubyAnaWQnIGlzIGRlZmluZWQgZm9yIHRoZSBvYmplY3QgZWxlbWVudCwgaXQgd2lsbCBpbmhlcml0IHRoZSAnaWQnIGZyb20gdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0YXR0T2JqLmlkID0gaWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IC8vIEludGVybmV0IEV4cGxvcmVyICsgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgKyBXM0MgRE9NIG1ldGhvZHMgZG8gbm90IGNvbWJpbmU6IGZhbGwgYmFjayB0byBvdXRlckhUTUxcblx0XHRcdFx0dmFyIGF0dCA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialtpXSAhPSBPYmplY3QucHJvdG90eXBlW2ldKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJkYXRhXCIpIHtcblx0XHRcdFx0XHRcdFx0cGFyT2JqLm1vdmllID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyBjbGFzcz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7XG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnICcgKyBpICsgJz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFyID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW2pdICE9IE9iamVjdC5wcm90b3R5cGVbal0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0cGFyICs9ICc8cGFyYW0gbmFtZT1cIicgKyBqICsgJ1wiIHZhbHVlPVwiJyArIHBhck9ialtqXSArICdcIiAvPic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIicgKyBhdHQgKyAnPicgKyBwYXIgKyAnPC9vYmplY3Q+Jztcblx0XHRcdFx0b2JqSWRBcnJbb2JqSWRBcnIubGVuZ3RoXSA9IGF0dE9iai5pZDsgLy8gc3RvcmVkIHRvIGZpeCBvYmplY3QgJ2xlYWtzJyBvbiB1bmxvYWQgKGR5bmFtaWMgcHVibGlzaGluZyBvbmx5KVxuXHRcdFx0XHRyID0gZ2V0RWxlbWVudEJ5SWQoYXR0T2JqLmlkKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyB3ZWxsLWJlaGF2aW5nIGJyb3dzZXJzXG5cdFx0XHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHRcdFx0Zm9yICh2YXIgbSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW21dICE9IE9iamVjdC5wcm90b3R5cGVbbV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKG0udG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAobS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7IC8vIGZpbHRlciBvdXQgSUUgc3BlY2lmaWMgYXR0cmlidXRlXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKG0sIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAodmFyIG4gaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtuXSAhPSBPYmplY3QucHJvdG90eXBlW25dICYmIG4udG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllcyBhbmQgSUUgc3BlY2lmaWMgcGFyYW0gZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3JlYXRlT2JqUGFyYW0obywgbiwgcGFyT2JqW25dKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobywgZWwpO1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlT2JqUGFyYW0oZWwsIHBOYW1lLCBwVmFsdWUpIHtcblx0XHR2YXIgcCA9IGNyZWF0ZUVsZW1lbnQoXCJwYXJhbVwiKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgcE5hbWUpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcFZhbHVlKTtcblx0XHRlbC5hcHBlbmRDaGlsZChwKTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIFNXRiByZW1vdmFsXG5cdFx0LSBFc3BlY2lhbGx5IG5lZWRlZCB0byBzYWZlbHkgYW5kIGNvbXBsZXRlbHkgcmVtb3ZlIGEgU1dGIGluIEludGVybmV0IEV4cGxvcmVyXG5cdCovXG5cdGZ1bmN0aW9uIHJlbW92ZVNXRihpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaiAmJiBvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0cmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZU9iamVjdEluSUUoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb2JqW2ldID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdG9ialtpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBvcHRpbWl6ZSBKYXZhU2NyaXB0IGNvbXByZXNzaW9uXG5cdCovXG5cdGZ1bmN0aW9uIGdldEVsZW1lbnRCeUlkKGlkKSB7XG5cdFx0dmFyIGVsID0gbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0ZWwgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge31cblx0XHRyZXR1cm4gZWw7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRWxlbWVudChlbCkge1xuXHRcdHJldHVybiBkb2MuY3JlYXRlRWxlbWVudChlbCk7XG5cdH1cblx0LyogVXBkYXRlZCBhdHRhY2hFdmVudCBmdW5jdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHQtIFN0b3JlcyBhdHRhY2hFdmVudCBpbmZvcm1hdGlvbiBpbiBhbiBBcnJheSwgc28gb24gdW5sb2FkIHRoZSBkZXRhY2hFdmVudCBmdW5jdGlvbnMgY2FuIGJlIGNhbGxlZCB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0Ki9cblx0ZnVuY3Rpb24gYWRkTGlzdGVuZXIodGFyZ2V0LCBldmVudFR5cGUsIGZuKSB7XG5cdFx0dGFyZ2V0LmF0dGFjaEV2ZW50KGV2ZW50VHlwZSwgZm4pO1xuXHRcdGxpc3RlbmVyc0FycltsaXN0ZW5lcnNBcnIubGVuZ3RoXSA9IFt0YXJnZXQsIGV2ZW50VHlwZSwgZm5dO1xuXHR9XG5cdC8qIEZsYXNoIFBsYXllciBhbmQgU1dGIGNvbnRlbnQgdmVyc2lvbiBtYXRjaGluZ1xuXHQqL1xuXHRmdW5jdGlvbiBoYXNQbGF5ZXJWZXJzaW9uKHJ2KSB7XG5cdFx0dmFyIHB2ID0gdWEucHYsIHYgPSBydi5zcGxpdChcIi5cIik7XG5cdFx0dlswXSA9IHBhcnNlSW50KHZbMF0sIDEwKTtcblx0XHR2WzFdID0gcGFyc2VJbnQodlsxXSwgMTApIHx8IDA7IC8vIHN1cHBvcnRzIHNob3J0IG5vdGF0aW9uLCBlLmcuIFwiOVwiIGluc3RlYWQgb2YgXCI5LjAuMFwiXG5cdFx0dlsyXSA9IHBhcnNlSW50KHZbMl0sIDEwKSB8fCAwO1xuXHRcdHJldHVybiAocHZbMF0gPiB2WzBdIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID4gdlsxXSkgfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPT0gdlsxXSAmJiBwdlsyXSA+PSB2WzJdKSkgPyB0cnVlIDogZmFsc2U7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIENTUyBjcmVhdGlvblxuXHRcdC0gQmFzZWQgb24gQm9iYnkgdmFuIGRlciBTbHVpcycgc29sdXRpb246IGh0dHA6Ly93d3cuYm9iYnl2YW5kZXJzbHVpcy5jb20vYXJ0aWNsZXMvZHluYW1pY0NTUy5waHBcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlQ1NTKHNlbCwgZGVjbCwgbWVkaWEsIG5ld1N0eWxlKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLm1hYykgeyByZXR1cm47IH1cblx0XHR2YXIgaCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XG5cdFx0aWYgKCFoKSB7IHJldHVybjsgfSAvLyB0byBhbHNvIHN1cHBvcnQgYmFkbHkgYXV0aG9yZWQgSFRNTCBwYWdlcyB0aGF0IGxhY2sgYSBoZWFkIGVsZW1lbnRcblx0XHR2YXIgbSA9IChtZWRpYSAmJiB0eXBlb2YgbWVkaWEgPT0gXCJzdHJpbmdcIikgPyBtZWRpYSA6IFwic2NyZWVuXCI7XG5cdFx0aWYgKG5ld1N0eWxlKSB7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IG51bGw7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFkeW5hbWljU3R5bGVzaGVldCB8fCBkeW5hbWljU3R5bGVzaGVldE1lZGlhICE9IG0pIHtcblx0XHRcdC8vIGNyZWF0ZSBkeW5hbWljIHN0eWxlc2hlZXQgKyBnZXQgYSBnbG9iYWwgcmVmZXJlbmNlIHRvIGl0XG5cdFx0XHR2YXIgcyA9IGNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvY3NzXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJtZWRpYVwiLCBtKTtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gaC5hcHBlbmRDaGlsZChzKTtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgdHlwZW9mIGRvYy5zdHlsZVNoZWV0cyAhPSBVTkRFRiAmJiBkb2Muc3R5bGVTaGVldHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGRvYy5zdHlsZVNoZWV0c1tkb2Muc3R5bGVTaGVldHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbTtcblx0XHR9XG5cdFx0Ly8gYWRkIHN0eWxlIHJ1bGVcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUgPT0gT0JKRUNUKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUoc2VsLCBkZWNsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGRvYy5jcmVhdGVUZXh0Tm9kZSAhPSBVTkRFRikge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlVGV4dE5vZGUoc2VsICsgXCIge1wiICsgZGVjbCArIFwifVwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldFZpc2liaWxpdHkoaWQsIGlzVmlzaWJsZSkge1xuXHRcdGlmICghYXV0b0hpZGVTaG93KSB7IHJldHVybjsgfVxuXHRcdHZhciB2ID0gaXNWaXNpYmxlID8gXCJ2aXNpYmxlXCIgOiBcImhpZGRlblwiO1xuXHRcdGlmIChpc0RvbUxvYWRlZCAmJiBnZXRFbGVtZW50QnlJZChpZCkpIHtcblx0XHRcdGdldEVsZW1lbnRCeUlkKGlkKS5zdHlsZS52aXNpYmlsaXR5ID0gdjtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVDU1MoXCIjXCIgKyBpZCwgXCJ2aXNpYmlsaXR5OlwiICsgdik7XG5cdFx0fVxuXHR9XG5cdC8qIEZpbHRlciB0byBhdm9pZCBYU1MgYXR0YWNrc1xuXHQqL1xuXHRmdW5jdGlvbiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShzKSB7XG5cdFx0dmFyIHJlZ2V4ID0gL1tcXFxcXFxcIjw+XFwuO10vO1xuXHRcdHZhciBoYXNCYWRDaGFycyA9IHJlZ2V4LmV4ZWMocykgIT0gbnVsbDtcblx0XHRyZXR1cm4gaGFzQmFkQ2hhcnMgJiYgdHlwZW9mIGVuY29kZVVSSUNvbXBvbmVudCAhPSBVTkRFRiA/IGVuY29kZVVSSUNvbXBvbmVudChzKSA6IHM7XG5cdH1cblx0LyogUmVsZWFzZSBtZW1vcnkgdG8gYXZvaWQgbWVtb3J5IGxlYWtzIGNhdXNlZCBieSBjbG9zdXJlcywgZml4IGhhbmdpbmcgYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzL05ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3QgKEludGVybmV0IEV4cGxvcmVyIG9ubHkpXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0dmFyIGxsID0gbGlzdGVuZXJzQXJyLmxlbmd0aDtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsbDsgaSsrKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzQXJyW2ldWzBdLmRldGFjaEV2ZW50KGxpc3RlbmVyc0FycltpXVsxXSwgbGlzdGVuZXJzQXJyW2ldWzJdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjbGVhbnVwIGR5bmFtaWNhbGx5IGVtYmVkZGVkIG9iamVjdHMgdG8gZml4IGF1ZGlvL3ZpZGVvIHRocmVhZHMgYW5kIGZvcmNlIG9wZW4gc29ja2V0cyBhbmQgTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdFxuXHRcdFx0XHR2YXIgaWwgPSBvYmpJZEFyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgaWw7IGorKykge1xuXHRcdFx0XHRcdHJlbW92ZVNXRihvYmpJZEFycltqXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBsaWJyYXJ5J3MgbWFpbiBjbG9zdXJlcyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0Zm9yICh2YXIgayBpbiB1YSkge1xuXHRcdFx0XHRcdHVhW2tdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR1YSA9IG51bGw7XG5cdFx0XHRcdGZvciAodmFyIGwgaW4gc3dmb2JqZWN0KSB7XG5cdFx0XHRcdFx0c3dmb2JqZWN0W2xdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2ZvYmplY3QgPSBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KSgpO1xuXHRyZXR1cm4ge1xuXHRcdC8qIFB1YmxpYyBBUElcblx0XHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvZG9jdW1lbnRhdGlvblxuXHRcdCovXG5cdFx0cmVnaXN0ZXJPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdElkU3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIG9iamVjdElkU3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0dmFyIHJlZ09iaiA9IHt9O1xuXHRcdFx0XHRyZWdPYmouaWQgPSBvYmplY3RJZFN0cjtcblx0XHRcdFx0cmVnT2JqLnN3ZlZlcnNpb24gPSBzd2ZWZXJzaW9uU3RyO1xuXHRcdFx0XHRyZWdPYmouZXhwcmVzc0luc3RhbGwgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0cmVnT2JqLmNhbGxiYWNrRm4gPSBjYWxsYmFja0ZuO1xuXHRcdFx0XHRyZWdPYmpBcnJbcmVnT2JqQXJyLmxlbmd0aF0gPSByZWdPYmo7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkob2JqZWN0SWRTdHIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHtcblx0XHRcdFx0Y2FsbGJhY2tGbih7c3VjY2VzczpmYWxzZSwgaWQ6b2JqZWN0SWRTdHJ9KTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGdldE9iamVjdEJ5SWQ6IGZ1bmN0aW9uKG9iamVjdElkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcblx0XHRcdHZhciBjYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHRcdGlmICh1YS53MyAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSAmJiBzd2ZVcmxTdHIgJiYgcmVwbGFjZUVsZW1JZFN0ciAmJiB3aWR0aFN0ciAmJiBoZWlnaHRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIGZhbHNlKTtcblx0XHRcdFx0YWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdpZHRoU3RyICs9IFwiXCI7IC8vIGF1dG8tY29udmVydCB0byBzdHJpbmdcblx0XHRcdFx0XHRoZWlnaHRTdHIgKz0gXCJcIjtcblx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0aWYgKGF0dE9iaiAmJiB0eXBlb2YgYXR0T2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBhdHRPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0YXR0W2ldID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHQuZGF0YSA9IHN3ZlVybFN0cjtcblx0XHRcdFx0XHRhdHQud2lkdGggPSB3aWR0aFN0cjtcblx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gaGVpZ2h0U3RyO1xuXHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRpZiAocGFyT2JqICYmIHR5cGVvZiBwYXJPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIHBhck9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRwYXJbal0gPSBwYXJPYmpbal07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmbGFzaHZhcnNPYmogJiYgdHlwZW9mIGZsYXNodmFyc09iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrIGluIGZsYXNodmFyc09iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgZmxhc2h2YXJzT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihzd2ZWZXJzaW9uU3RyKSkgeyAvLyBjcmVhdGUgU1dGXG5cdFx0XHRcdFx0XHR2YXIgb2JqID0gY3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0XHRcdGlmIChhdHQuaWQgPT0gcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5yZWYgPSBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhpU3dmVXJsU3RyICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHRcdFx0XHRcdGF0dC5kYXRhID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHsgLy8gc2hvdyBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7XHR9XG5cdFx0fSxcblx0XHRzd2l0Y2hPZmZBdXRvSGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuXHRcdFx0YXV0b0hpZGVTaG93ID0gZmFsc2U7XG5cdFx0fSxcblx0XHR1YTogdWEsXG5cdFx0Z2V0Rmxhc2hQbGF5ZXJWZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7IG1ham9yOnVhLnB2WzBdLCBtaW5vcjp1YS5wdlsxXSwgcmVsZWFzZTp1YS5wdlsyXSB9O1xuXHRcdH0sXG5cdFx0aGFzRmxhc2hQbGF5ZXJWZXJzaW9uOiBoYXNQbGF5ZXJWZXJzaW9uLFxuXHRcdGNyZWF0ZVNXRjogZnVuY3Rpb24oYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2hvd0V4cHJlc3NJbnN0YWxsOiBmdW5jdGlvbihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHtcblx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlbW92ZVNXRjogZnVuY3Rpb24ob2JqRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmVtb3ZlU1dGKG9iakVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjcmVhdGVDU1M6IGZ1bmN0aW9uKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdGNyZWF0ZUNTUyhzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWRkRG9tTG9hZEV2ZW50OiBhZGREb21Mb2FkRXZlbnQsXG5cdFx0YWRkTG9hZEV2ZW50OiBhZGRMb2FkRXZlbnQsXG5cdFx0Z2V0UXVlcnlQYXJhbVZhbHVlOiBmdW5jdGlvbihwYXJhbSkge1xuXHRcdFx0dmFyIHEgPSBkb2MubG9jYXRpb24uc2VhcmNoIHx8IGRvYy5sb2NhdGlvbi5oYXNoO1xuXHRcdFx0aWYgKHEpIHtcblx0XHRcdFx0aWYgKC9cXD8vLnRlc3QocSkpIHsgcSA9IHEuc3BsaXQoXCI/XCIpWzFdOyB9IC8vIHN0cmlwIHF1ZXN0aW9uIG1hcmtcblx0XHRcdFx0aWYgKHBhcmFtID09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhaXJzID0gcS5zcGxpdChcIiZcIik7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocGFpcnNbaV0uc3Vic3RyaW5nKDAsIHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpKSA9PSBwYXJhbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHBhaXJzW2ldLnN1YnN0cmluZygocGFpcnNbaV0uaW5kZXhPZihcIj1cIikgKyAxKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fSxcblx0XHQvLyBGb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRcdGV4cHJlc3NJbnN0YWxsQ2FsbGJhY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGlzRXhwcmVzc0luc3RhbGxBY3RpdmUpIHtcblx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKEVYUFJFU1NfSU5TVEFMTF9JRCk7XG5cdFx0XHRcdGlmIChvYmogJiYgc3RvcmVkQWx0Q29udGVudCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdG9yZWRBbHRDb250ZW50LCBvYmopO1xuXHRcdFx0XHRcdGlmIChzdG9yZWRBbHRDb250ZW50SWQpIHtcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoc3RvcmVkQWx0Q29udGVudElkLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgc3RvcmVkQWx0Q29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiOyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9yZWRDYWxsYmFja0ZuKSB7IHN0b3JlZENhbGxiYWNrRm4oc3RvcmVkQ2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0oKTtcbm1vZHVsZS5leHBvcnRzID0gc3dmb2JqZWN0O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQHJldHVybnMge09yaWdpbmFsQ2xhc3N9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY2xlYXJJbnN0YW5jZSA9IGZ1bmN0aW9uKE9yaWdpbmFsQ2xhc3MpIHtcbiAgICB2YXIgQ2xlYXJDbGFzcyA9IGZ1bmN0aW9uKCkge307XG4gICAgQ2xlYXJDbGFzcy5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcbiAgICByZXR1cm4gbmV3IENsZWFyQ2xhc3MoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY2xlYXJJbnN0YW5jZTtcbiIsInZhciBjbGVhckluc3RhbmNlID0gcmVxdWlyZSgnLi9jbGVhci1pbnN0YW5jZScpO1xuXG4vKipcbiAqIENsYXNzaWMgRXJyb3IgYWN0cyBsaWtlIGEgZmFicmljOiBFcnJvci5jYWxsKHRoaXMsIG1lc3NhZ2UpIGp1c3QgY3JlYXRlIG5ldyBvYmplY3QuXG4gKiBFcnJvckNsYXNzIGFjdHMgbW9yZSBsaWtlIGEgY2xhc3M6IEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKSBtb2RpZnkgJ3RoaXMnIG9iamVjdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gLSBlcnJvciBtZXNzYWdlXG4gKiBAcGFyYW0ge051bWJlcn0gW2lkXSAtIGVycm9yIGlkXG4gKiBAZXh0ZW5kcyBFcnJvclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRXJyb3JDbGFzcyA9IGZ1bmN0aW9uKG1lc3NhZ2UsIGlkKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlLCBpZCk7XG4gICAgZXJyLm5hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICB0aGlzLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB0aGlzLnN0YWNrID0gZXJyLnN0YWNrO1xufTtcblxuLyoqXG4gKiBTdWdhci4gSnVzdCBjcmVhdGUgaW5oZXJpdGFuY2UgZnJvbSBFcnJvckNsYXNzIGFuZCBkZWZpbmUgbmFtZSBwcm9wZXJ0eVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBuYW1lIG9mIGVycm9yIHR5cGVcbiAqIEByZXR1cm5zIHtFcnJvckNsYXNzfVxuICovXG5FcnJvckNsYXNzLmNyZWF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZXJyQ2xhc3MgPSBjbGVhckluc3RhbmNlKEVycm9yQ2xhc3MpO1xuICAgIGVyckNsYXNzLm5hbWUgPSBuYW1lO1xuICAgIHJldHVybiBlcnJDbGFzcztcbn07XG5cbkVycm9yQ2xhc3MucHJvdG90eXBlID0gY2xlYXJJbnN0YW5jZShFcnJvcik7XG5FcnJvckNsYXNzLnByb3RvdHlwZS5uYW1lID0gXCJFcnJvckNsYXNzXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXJyb3JDbGFzcztcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9hc3luYy9ldmVudHMnKTtcblxuLy9USElOSzog0LjQt9GD0YfQuNGC0Ywg0LrQsNC6INGA0LDQsdC+0YLQsNC10YIgRVMgMjAxNSBQcm94eSDQuCDQv9C+0L/RgNC+0LHQvtCy0LDRgtGMINC40YHQv9C+0LvRjNC30L7QstCw0YLRjFxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J/RgNC+0LrRgdC4LdC60LvQsNGB0YEuINCS0YvQtNCw0ZHRgiDQvdCw0YDRg9C20YMg0LvQuNGI0Ywg0L/Rg9Cx0LvQuNGH0L3Ri9C1INC80LXRgtC+0LTRiyDQvtCx0YrQtdC60YLQsCDQuCDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAuXG4gKiDQndC1INC60L7Qv9C40YDRg9C10YIg0LzQtdGC0L7QtNGLINC40LcgT2JqZWN0LnByb3RvdHlwZS4g0JLRgdC1INC80LXRgtC+0LTRiyDQuNC80LXRjtGCINC/0YDQuNCy0Y/Qt9C60YMg0LrQvtC90YLQtdC60YHRgtCwINC6INC/0YDQvtC60YHQuNGA0YPQtdC80L7QvNGDINC+0LHRitC10LrRgtGDLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0XSAtINC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YLRgNC10LHRg9C10YLRgdGPINC/0YDQvtC60YHQuNGA0L7QstCw0YLRjFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgUHJveHkgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChrZXlbMF0gPT09IFwiX1wiXG4gICAgICAgICAgICAgICAgfHwgdHlwZW9mIG9iamVjdFtrZXldICE9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAgICAgICB8fCBvYmplY3Rba2V5XSA9PT0gT2JqZWN0LnByb3RvdHlwZVtrZXldXG4gICAgICAgICAgICAgICAgfHwgb2JqZWN0Lmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgICAgICB8fCBFdmVudHMucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpc1trZXldID0gb2JqZWN0W2tleV0uYmluZChvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9iamVjdC5waXBlRXZlbnRzKSB7XG4gICAgICAgICAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5vbiA9IEV2ZW50cy5wcm90b3R5cGUub247XG4gICAgICAgICAgICB0aGlzLm9uY2UgPSBFdmVudHMucHJvdG90eXBlLm9uY2U7XG4gICAgICAgICAgICB0aGlzLm9mZiA9IEV2ZW50cy5wcm90b3R5cGUub2ZmO1xuICAgICAgICAgICAgdGhpcy5jbGVhckxpc3RlbmVycyA9IEV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIG9iamVjdC5waXBlRXZlbnRzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiDQrdC60YHQv9C+0YDRgtC40YDRg9C10YIg0YHRgtCw0YLQuNGH0LXRgdC60LjQtSDRgdCy0L7QudGB0YLQstCwINC40Lcg0L7QtNC90L7Qs9C+INC+0LHRitC10LrRgtCwINCyINC00YDRg9Cz0L7QuSwg0LjRgdC60LvRjtGH0LDRjyDRg9C60LDQt9Cw0L3QvdGL0LUsINC/0YDQuNCy0LDRgtC90YvQtSDQuCDQv9GA0L7RgtC+0YLQuNC/XG4gKiBAcGFyYW0ge09iamVjdH0gZnJvbSAtINC+0YLQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtPYmplY3R9IHRvIC0g0LrRg9C00LAg0LrQvtC/0LjRgNC+0LLQsNGC0YxcbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IFtleGNsdWRlXSAtINGB0LLQvtC50YHRgtCy0LAg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC40YHQutC70Y7Rh9C40YLRjFxuICovXG5Qcm94eS5leHBvcnRTdGF0aWMgPSBmdW5jdGlvbihmcm9tLCB0bywgZXhjbHVkZSkge1xuICAgIGV4Y2x1ZGUgPSBleGNsdWRlIHx8IFtdO1xuXG4gICAgT2JqZWN0LmtleXMoZnJvbSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgaWYgKCFmcm9tLmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgIHx8IGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgIHx8IGtleSA9PT0gXCJwcm90b3R5cGVcIlxuICAgICAgICAgICAgfHwgZXhjbHVkZS5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0b1trZXldID0gZnJvbVtrZXldO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC/0YDQvtC60YHQuC3Qv9C70LDRgdGB0LAg0L/RgNC40LLRj9C30LDQvdC90L7Qs9C+INC6INGD0LrQsNC30LDQvdC90L7QvNGDINC60LvQsNGB0YHRgy4g0JzQvtC20L3QviDQvdCw0LfQvdCw0YfQuNGC0Ywg0YDQvtC00LjRgtC10LvRjNGB0LrQuNC5INC60LvQsNGB0YEuXG4gKiDQoyDRgNC+0LTQuNGC0LXQu9GM0YHQutC+0LPQviDQutC70LDRgdGB0LAg0L/QvtGP0LLQu9GP0LXRgtGB0Y8g0L/RgNC40LLQsNGC0L3Ri9C5INC80LXRgtC+0LQgX3Byb3h5LCDQutC+0YLQvtGA0YvQuSDQstGL0LTQsNGR0YIg0L/RgNC+0LrRgdC4LdC+0LHRitC10LrRgiDQtNC70Y9cbiAqINC00LDQvdC90L7Qs9C+INGN0LrQt9C10LzQu9GP0YDQsC4g0KLQsNC60LbQtSDQv9C+0Y/QstC70Y/QtdGC0YHRjyDRgdCy0L7QudGB0YLQstC+IF9fcHJveHksINGB0L7QtNC10YDQttCw0YnQtdC1INGB0YHRi9C70LrRgyDQvdCwINGB0L7Qt9C00LDQvdC90YvQuSDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gT3JpZ2luYWxDbGFzcyAtINC+0YDQuNCz0LjQvdCw0LvRjNC90YvQuSDQutC70LDRgdGBXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBbUGFyZW50UHJveHlDbGFzcz1Qcm94eV0gLSDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgVxuICogQHJldHVybnMge2Z1bmN0aW9ufSAtLSDQutC+0L3RgdGC0YDRg9GC0L7RgCDQv9GA0L7QutGB0LjRgNC+0LLQsNC90L3QvtCz0L4g0LrQu9Cw0YHRgdCwXG4gKi9cblByb3h5LmNyZWF0ZUNsYXNzID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcywgUGFyZW50UHJveHlDbGFzcywgZXhjbHVkZVN0YXRpYykge1xuXG4gICAgdmFyIFByb3h5Q2xhc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcblxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBuZXcgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yKCk7XG4gICAgICAgIE9yaWdpbmFsQ2xhc3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLl9wcm94eSgpO1xuICAgIH07XG5cbiAgICB2YXIgUGFyZW50UHJveHlDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlID0gKFBhcmVudFByb3h5Q2xhc3MgfHwgUHJveHkpLnByb3RvdHlwZTtcbiAgICBQcm94eUNsYXNzLnByb3RvdHlwZSA9IG5ldyBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IoKTtcblxuICAgIHZhciB2YWw7XG4gICAgZm9yICh2YXIgayBpbiBPcmlnaW5hbENsYXNzLnByb3RvdHlwZSkge1xuICAgICAgICB2YWwgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZVtrXTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGVba10gPT0gdmFsIHx8IHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiB8fCBrWzBdID09PSBcIl9cIikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVba10gPSB2YWw7XG4gICAgfVxuXG4gICAgdmFyIGNyZWF0ZVByb3h5ID0gZnVuY3Rpb24ob3JpZ2luYWwpIHtcbiAgICAgICAgdmFyIHByb3RvID0gUHJveHkucHJvdG90eXBlO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBQcm94eUNsYXNzLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KG9yaWdpbmFsKTtcbiAgICAgICAgUHJveHkucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9O1xuXG4gICAgT3JpZ2luYWxDbGFzcy5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fX3Byb3h5KSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJveHkgPSBjcmVhdGVQcm94eSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fcHJveHk7XG4gICAgfTtcblxuICAgIGlmICghZXhjbHVkZVN0YXRpYykge1xuICAgICAgICBQcm94eS5leHBvcnRTdGF0aWMoT3JpZ2luYWxDbGFzcywgUHJveHlDbGFzcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb3h5Q2xhc3M7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5O1xuIiwiLyoqXG4gKiDQodC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAg0LLRgdC10YUg0L/QtdGA0LXRh9C40YHQu9C10L3QvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQsiDQvtC00LjQvS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIC0g0LXRgdC70Lgg0L/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIgdHJ1ZSwg0YLQviDQvdC+0LLRi9C5INC+0LHRitC10LrRgiDQvdC1INGB0L7Qt9C00LDRkdGC0YHRjywg0LAg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC00LDQvdC90YvQuVxuICogQHBhcmFtIHsuLi5PYmplY3R8Qm9vbGVhbn0gYXJncyAtINGB0L/QuNGB0L7QuiDQvtCx0YrQtdC60YLQvtCyINC40Lcg0LrQvtGC0L7RgNGL0YUg0LrQvtC/0LjRgNC+0LLQsNGC0Ywg0YHQstC+0LnRgdGC0LLQsC4g0J/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIg0LzQvtC20LXRgiDQsdGL0YLRjCDQu9C40LHQvlxuICog0L7QsdGK0LXQutGC0L7QvCwg0LvQuNCx0L4gdHJ1ZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbWVyZ2UgPSBmdW5jdGlvbihpbml0aWFsKSB7XG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIga2V5O1xuXG4gICAgaWYgKGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gdHJ1ZSkge1xuICAgICAgICBvYmplY3QgPSBpbml0aWFsO1xuICAgICAgICBhcmdzLnBvcCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdCA9IHt9O1xuICAgICAgICBmb3IgKGtleSBpbiBpbml0aWFsKSB7XG4gICAgICAgICAgICBpZiAoaW5pdGlhbC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBpbml0aWFsW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGFyZ3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGZvciAoa2V5IGluIGFyZ3Nba10pIHtcbiAgICAgICAgICAgIGlmIChhcmdzW2tdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IGFyZ3Nba11ba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwicmVxdWlyZSgnLi4vLi4vLi4vZXhwb3J0Jyk7XG5cbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4vbG9hZGVyLWVycm9yJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkxvYWRlckVycm9yID0gTG9hZGVyRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uLy4uL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICogQG5hbWUgQXVkaW8uTG9hZGVyRXJyb3JcbiAqIEBjbGFzcyDQmtC70LDRgdGBINC+0YjQuNCx0L7QuiDQt9Cw0LPRgNGD0LfRh9C40LrQsC5cbiAqIDxwPtCg0LDRgdGI0LjRgNGP0LXRgiA8eHJlZiBzY29wZT1cImV4dGVybmFsXCIgaHJlZj1cImh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL3J1L2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yXCI+RXJyb3I8L3hyZWY+LjwvcD5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlINCi0LXQutGB0YIg0L7RiNC40LHQutC4LlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9hZGVyRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkxvYWRlckVycm9yLnByb3RvdHlwZSA9IEVycm9yQ2xhc3MuY3JlYXRlKFwiTG9hZGVyRXJyb3JcIik7XG5cbi8qKlxuICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuC5cbiAqIEB0eXBlIFN0cmluZ1xuICogQGNvbnN0XG4gKiBAbmFtZSBBdWRpby5Mb2FkZXJFcnJvci5USU1FT1VUXG4gKi9cbkxvYWRlckVycm9yLlRJTUVPVVQgPSBcInJlcXVlc3QgdGltZW91dFwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LfQsNC/0YDQvtGB0LAg0L3QsCDQt9Cw0LPRgNGD0LfQutGDLlxuICogQHR5cGUgU3RyaW5nXG4gKiBAY29uc3RcbiAqIEBuYW1lIEF1ZGlvLkxvYWRlckVycm9yLkZBSUxFRFxuICovXG5Mb2FkZXJFcnJvci5GQUlMRUQgPSBcInJlcXVlc3QgZmFpbGVkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gTG9hZGVyRXJyb3I7XG4iLCIvKipcbiAqINCX0LDQs9C70YPRiNC60LAg0LIg0LLQuNC00LUg0L/Rg9GB0YLQvtC5INGE0YPQvdC60YbQuNC4INC90LAg0LLRgdC1INGB0LvRg9GH0LDQuCDQttC40LfQvdC4XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbm9vcDtcbiIsInJlcXVpcmUoXCIuLi9leHBvcnRcIik7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG55YS5tdXNpYy5BdWRpby5Mb2dnZXIgPSBMb2dnZXI7XG4iLCJ2YXIgTEVWRUxTID0gW1wiZGVidWdcIiwgXCJsb2dcIiwgXCJpbmZvXCIsIFwid2FyblwiLCBcImVycm9yXCIsIFwidHJhY2VcIl07XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL2xpYi9ub29wJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQG5hbWUgQXVkaW8uTG9nZ2VyXG4gKiBAY2xhc3Mg0J3QsNGB0YLRgNCw0LjQstCw0LXQvNGL0Lkg0LvQvtCz0LPQtdGAINC00LvRjyDQsNGD0LTQuNC+0L/Qu9C10LXRgNCwLlxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwg0JjQvNGPINC60LDQvdCw0LvQsCwg0LfQsCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0YLQstC10YfQsNGC0Ywg0Y3QutC30LXQvNC70Y/RgCDQu9C+0LPQs9C10YDQsC5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC40LPQvdC+0YDQuNGA0YPQtdC80YvRhSDQutCw0L3QsNC70L7Qsi5cbiAqIEBmaWVsZFxuICogQHR5cGUgU3RyaW5nW11cbiAqIEBuYW1lIEF1ZGlvLkxvZ2dlci5pZ25vcmVzXG4gKi9cbkxvZ2dlci5pZ25vcmVzID0gW107XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC+0YLQvtCx0YDQsNC20LDQtdC80YvRhSDQsiDQutC+0L3RgdC+0LvQuCDRg9GA0L7QstC90LXQuSDQu9C+0LPQsC5cbiAqIEBuYW1lIEF1ZGlvLkxvZ2dlci5sb2dMZXZlbHNcbiAqIEBmaWVsZFxuICogQHR5cGUgU3RyaW5nW11cbiAqL1xuTG9nZ2VyLmxvZ0xldmVscyA9IFtdO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KHQuNC90YLQsNC60YHQuNGH0LXRgdC60LjQuSDRgdCw0YXQsNGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmRlYnVnKiouXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLkxvZ2dlciNkZWJ1Z1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5kZWJ1ZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmxvZyoqLlxuICogQG5hbWUgQXVkaW8uTG9nZ2VyI2xvZ1xuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCDQmtC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsC5cbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdINCU0L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLLlxuICovXG5Mb2dnZXIucHJvdG90eXBlLmxvZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmluZm8qKi5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uTG9nZ2VyI2luZm9cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuaW5mbyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKndhcm4qKi5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uTG9nZ2VyI3dhcm5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUud2FybiA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmVycm9yKiouXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLkxvZ2dlciNlcnJvclxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5lcnJvciA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKnRyYWNlKiouXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lIEF1ZGlvLkxvZ2dlciN0cmFjZVxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS50cmFjZSA9IG5vb3A7XG5cbi8qKlxuICog0JzQtdGC0L7QtCDQtNC70Y8g0L7QsdGA0LDQsdC+0YLQutC4INGB0YHRi9C70L7QuiDQv9C10YDQtdC00LDQstCw0LXQvNGL0YUg0LIg0LvQvtCzLlxuICogQHBhcmFtIHVybFxuICogQHByaXZhdGVcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5fc2hvd1VybCA9IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiBMb2dnZXIuc2hvd1VybCh1cmwpO1xufTtcblxuLyoqXG4gKiDQnNC10YLQvtC0INC00LvRjyDQvtCx0YDQsNCx0L7RgtC60Lgg0YHRgdGL0LvQvtC6INC/0LXRgNC10LTQsNCy0LDQtdC80YvRhSDQsiDQu9C+0LMuINCc0L7QttC90L4g0L/QtdGA0LXQvtC/0YDQtdC00LXQu9GP0YLRjC4g0J/QviDRg9C80L7Qu9GH0LDQvdC40Y4g0L3QtSDQtNC10LvQsNC10YIg0L3QuNGH0LXQs9C+LlxuICogQG5hbWUgQXVkaW8uTG9nZ2VyI3Nob3dVcmxcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwg0KHRgdGL0LvQutCwLlxuICogQHJldHVybnMge1N0cmluZ30g0YHRgdGL0LvQutGDLlxuICovXG5Mb2dnZXIuc2hvd1VybCA9IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiB1cmw7XG59O1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCX0LDQv9C40YHRjCDQtNCw0L3QvdGL0YUg0LIg0LvQvtCzXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQtNC10LvQsNGC0Ywg0LfQsNC/0LjRgdGMINCyINC70L7Qsy5cbiAqIEBmdW5jdGlvblxuICogQG5hbWUgQXVkaW8uTG9nZ2VyI2xvZ1xuICogQHBhcmFtIHtTdHJpbmd9IGxldmVsINCj0YDQvtCy0LXQvdGMINC70L7Qs9CwLlxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwg0JrQsNC90LDQuy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5sb2cgPSBmdW5jdGlvbihsZXZlbCwgY2hhbm5lbCwgY29udGV4dCkge1xuICAgIHZhciBkYXRhID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpLm1hcChmdW5jdGlvbihkdW1wSXRlbSkge1xuICAgICAgICByZXR1cm4gZHVtcEl0ZW0gJiYgZHVtcEl0ZW0uX2xvZ2dlciAmJiBkdW1wSXRlbS5fbG9nZ2VyKCkgfHwgZHVtcEl0ZW07XG4gICAgfSk7XG5cbiAgICB2YXIgbG9nRW50cnkgPSB7XG4gICAgICAgIHRpbWVzdGFtcDogK25ldyBEYXRlKCksXG4gICAgICAgIGxldmVsOiBsZXZlbCxcbiAgICAgICAgY2hhbm5lbDogY2hhbm5lbCxcbiAgICAgICAgY29udGV4dDogY29udGV4dCxcbiAgICAgICAgbWVzc2FnZTogZGF0YVxuICAgIH07XG5cbiAgICBpZiAoTG9nZ2VyLmlnbm9yZXNbY2hhbm5lbF0gfHwgTG9nZ2VyLmxvZ0xldmVscy5pbmRleE9mKGxldmVsKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIExvZ2dlci5fZHVtcEVudHJ5KGxvZ0VudHJ5KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7Qs9C1LlxuICogQHR5cGVkZWYge09iamVjdH0gQXVkaW8uTG9nZ2VyLkxvZ0VudHJ5XG4gKiBAcHJvcGVydHkge051bWJlcn0gdGltZXN0YW1wINCS0YDQtdC80Y8g0LIgdGltZXN0YW1wINGE0L7RgNC80LDRgtC1LlxuICogQHByb3BlcnR5IHtTdHJpbmd9IGxldmVsINCj0YDQvtCy0LXQvdGMINC70L7Qs9CwLlxuICogQHByb3BlcnR5IHtTdHJpbmd9IGNoYW5uZWwg0JrQsNC90LDQuy5cbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHByb3BlcnR5IHtBcnJheX0gbWVzc2FnZSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5cbi8qKlxuICog0JfQsNC/0LjRgdCw0YLRjCDRgdC+0L7QsdGJ0LXQvdC40LUg0LvQvtCz0LAg0LIg0LrQvtC90YHQvtC70YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW8uTG9nZ2VyfkxvZ0VudHJ5fSBsb2dFbnRyeSAtINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsFxuICogQHByaXZhdGVcbiAqL1xuTG9nZ2VyLl9kdW1wRW50cnkgPSBmdW5jdGlvbihsb2dFbnRyeSkge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBsZXZlbCA9IGxvZ0VudHJ5LmxldmVsO1xuXG4gICAgICAgIHZhciBuYW1lID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC50YXNrTmFtZSB8fCBsb2dFbnRyeS5jb250ZXh0Lm5hbWUpO1xuICAgICAgICB2YXIgY29udGV4dCA9IGxvZ0VudHJ5LmNvbnRleHQgJiYgKGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlciA/IGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlcigpIDogXCJcIik7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlW2xldmVsXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgbGV2ZWwudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlW2xldmVsXS5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAobG9nRW50cnkudGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgICBcIltcIiArIGxvZ0VudHJ5LmNoYW5uZWwgKyAobmFtZSA/IFwiOlwiICsgbmFtZSA6IFwiXCIpICsgXCJdXCIsXG4gICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgXS5jb25jYXQobG9nRW50cnkubWVzc2FnZSkpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0YTQvtGA0LzQsNGC0LjRgNC+0LLQsNC90LjRjyDQtNCw0YLRiyDQtNC70Y8g0LLRi9Cy0L7QtNCwINCyINC60L7QvdC+0YHQvtC70YxcbiAqIEBwYXJhbSB0aW1lc3RhbXBcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIHZhciBkYXRlID0gbmV3IERhdGUodGltZXN0YW1wKTtcbiAgICB2YXIgbXMgPSBkYXRlLmdldE1pbGxpc2Vjb25kcygpO1xuICAgIG1zID0gbXMgPiAxMDAgPyBtcyA6IG1zID4gMTAgPyBcIjBcIiArIG1zIDogXCIwMFwiICsgbXM7XG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKCkgKyBcIi5cIiArIG1zO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iXX0=
