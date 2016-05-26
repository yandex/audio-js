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
var logger = new Logger('Audio');

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
 * @typedef {Object} Audio~AudioTimes
 *
 * @property {Number} duration Длительность аудиофайла.
 * @property {Number} loaded Длительность загруженной части.
 * @property {Number} position Позиция воспроизведения.
 * @property {Number} played Длительность воспроизведения.
 */

// =================================================================

//  JSDOC: Общие события плеера

// =================================================================

/**
 * Событие начала воспроизведения.
 * @event Audio.EVENT_PLAY
 */
/**
 * Событие завершения воспроизведения.
 * @event Audio.EVENT_ENDED
 */
/**
 * Событие изменения громкости.
 * @event Audio.EVENT_VOLUME
 * @param {Number} volume Новое значение громкости.
 */
/**
 * Событие возникновения ошибки при инициализации плеера.
 * @event Audio.EVENT_CRASHED
 */
/**
 * Событие смены статуса плеера.
 * @event Audio.EVENT_STATE
 * @param {String} state Новый статус плеера.
 */
/**
 * Событие переключения активного плеера и прелоадера.
 * @event Audio.EVENT_SWAP
 */

// =================================================================

//  JSDOC: события активного плеера

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @event Audio.EVENT_STOP
 */

/**
 * Событие паузы воспроизведения.
 * @event Audio.EVENT_PAUSE
 */

/**
 * Событие обновления позиции воспроизведения или загруженной части.
 * @event Audio.EVENT_PROGRESS
 * @param {Audio~AudioTimes} times Информация о временных данных аудиофайла.
 */

/**
 * Событие начала загрузки аудиофайла.
 * @event Audio.EVENT_LOADING
 */

/**
 * Событие завершения загрузки аудиофайла.
 * @event Audio.EVENT_LOADED
 */

/**
 * Событие ошибки воспроизведения.
 * @event Audio.EVENT_ERROR
 */

// =================================================================

//  JSDOC: события предзагрузчика

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @event Audio.PRELOADER_EVENT+EVENT_STOP
 */

/**
 * Событие обновления позиции загруженной части.
 * @event Audio.PRELOADER_EVENT+EVENT_PROGRESS
 * @param {Audio~AudioTimes} times Информация о временных данных аудиофайла.
 */

/**
 * Событие начала загрузки аудиофайла.
 * @event Audio.PRELOADER_EVENT+EVENT_LOADING
 */

/**
 * Событие завершения загрузки аудиофайла.
 * @event Audio.PRELOADER_EVENT+EVENT_LOADED
 */

/**
 * Событие ошибки воспроизведения.
 * @event Audio.PRELOADER_EVENT+EVENT_ERROR
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Аудиоплеер для браузера.
 * @exported ya.music.Audio
 *
 * @param {String} [preferredType="html5"] Предпочитаемый тип плеера. Может принимать значения: "html5", "flash" или
 * любое ложное значение (false, null, undefined, 0, ""). Если выбранный тип плеера окажется недоступен, будет запущен
 * оставшийся тип. Если указано ложное значение либо параметр не передан, то API автоматически выберет поддерживаемый тип плеера.
 * Если браузер поддерживает обе технологии, то по умолчанию YandexAudio создает аудиоплеер на основе HTML5.
 * @param {HTMLElement} [overlay] HTML-контейнер для отображения Flash-апплета.
 *
 * @extends Events
 *
 * @fires Audio.EVENT_PLAY
 * @fires Audio.EVENT_ENDED
 * @fires Audio.EVENT_VOLUME
 * @fires Audio.EVENT_CRASHED
 * @fires Audio.EVENT_STATE
 * @fires Audio.EVENT_SWAP
 *
 * @fires Audio.EVENT_STOP
 * @fires Audio.EVENT_PAUSE
 * @fires Audio.EVENT_PROGRESS
 * @fires Audio.EVENT_LOADING
 * @fires Audio.EVENT_LOADED
 * @fires Audio.EVENT_ERROR
 *
 * @fires Audio.PRELOADER_EVENT+EVENT_STOP
 * @fires Audio.PRELOADER_EVENT+EVENT_PROGRESS
 * @fires Audio.PRELOADER_EVENT+EVENT_LOADING
 * @fires Audio.PRELOADER_EVENT+EVENT_LOADED
 * @fires Audio.PRELOADER_EVENT+EVENT_ERROR
 *
 * @constructor
 */
var Audio = function(preferredType, overlay) {
    this.name = playerId++;
    DEV && logger.debug(this, "constructor");

    Events.call(this);

    this.preferredType = preferredType;
    this.overlay = overlay;
    this.state = Audio.STATE_INIT;
    this._played = 0;
    this._lastSkip = 0;
    this._playId = null;

    this._initInProgress = true;
    this._whenReady = new Deferred();
    this.whenReady = this._whenReady.promise().then(function() {
        this._initInProgress = false;
        logger.info(this, "implementation found", this.implementation.type);

        this.implementation.on("*", function(event, offset, data) {
            this._populateEvents(event, offset, data);

            if (!offset) {
                switch (event) {
                    case Audio.EVENT_PLAY:
                        this._setState(Audio.STATE_PLAYING);
                        break;

                    case Audio.EVENT_ENDED:
                    case Audio.EVENT_SWAP:
                    case Audio.EVENT_STOP:
                    case Audio.EVENT_ERROR:
                        logger.info(this, "onEnded", event, data);
                        this._setState(Audio.STATE_IDLE);
                        break;

                    case Audio.EVENT_PAUSE:
                        this._setState(Audio.STATE_PAUSED);
                        break;

                    case Audio.EVENT_CRASHED:
                        this._setState(Audio.STATE_CRASHED);
                        break;
                }
            }
        }.bind(this));

        this._setState(Audio.STATE_IDLE);
    }.bind(this), function(e) {
        this._initInProgress = false;
        logger.error(this, AudioError.NO_IMPLEMENTATION, e);

        this._setState(Audio.STATE_CRASHED);
        throw e;
    }.bind(this));

    this._init(0);
};
Events.mixin(Audio);
merge(Audio, AudioStatic, true);

// =================================================================

//  Статика

// =================================================================

/**
 * Список доступных плееров
 * @type {Object}
 * @static
 */
Audio.info = {
    html5: audioTypes.html5.available,
    flash: audioTypes.flash.available
};

/**
 * Контекст для Web Audio API.
 * @type {AudioContext}
 * @static
 */
Audio.audioContext = audioTypes.html5.audioContext;

// =================================================================

//  Инициализация

// =================================================================

/**
 * Установить статус плеера.
 * @param {String} state Новый статус.
 * @private
 */
Audio.prototype._setState = function(state) {
    DEV && logger.debug(this, "_setState", state);

    if (state === Audio.STATE_PAUSED && this.state !== Audio.STATE_PLAYING) {
        return;
    }

    var changed = this.state !== state;
    this.state = state;

    if (changed) {
        logger.info(this, "newState", state);
        this.trigger(Audio.EVENT_STATE, state);
    }
};

/**
 * Инициализация плеера.
 * @param {int} [retry=0] Количество попыток.
 * @private
 */
Audio.prototype._init = function(retry) {
    retry = retry || 0;
    logger.info(this, "_init", retry);

    if (!this._initInProgress) {
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
Audio.prototype._initType = function(type) {
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
Audio.prototype._waitEvents = function(action, resolve, reject) {
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
Audio.prototype._populateEvents = function(event, offset, data) {
    if (event !== Audio.EVENT_PROGRESS) {
        DEV && logger.debug(this, "_populateEvents", event, offset, data);
    }

    var outerEvent = (offset ? Audio.PRELOADER_EVENT : "") + event;

    switch (event) {
        case Audio.EVENT_CRASHED:
        case Audio.EVENT_SWAP:
            this.trigger(event, data);
            break;
        case Audio.EVENT_ERROR:
            logger.error(this, "error", outerEvent, data);
            this.trigger(outerEvent, data);
            break;
        case Audio.EVENT_VOLUME:
            this.trigger(event, this.getVolume());
            break;
        case Audio.EVENT_PROGRESS:
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
 * Получить обещание, разрешающееся после завершения инициализации.
 * @returns {Promise}
 */
Audio.prototype.initPromise = function() {
    return this.whenReady;
};

/**
 * Получить статус плеера.
 * @returns {String}
 */
Audio.prototype.getState = function() {
    return this.state;
};

/**
 * Получить текущий тип реализации плеера.
 * @returns {String|null}
 */
Audio.prototype.getType = function() {
    return this.implementation && this.implementation.type;
};

/**
 * Получить ссылку на текущий трек.
 * @param {int} [offset=0] Брать аудио-файл из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер.
 * @returns {String|null}
 */
Audio.prototype.getSrc = function(offset) {
    return this.implementation && this.implementation.getSrc(offset);
};

// =================================================================

//  Управление воспроизведением

// =================================================================
/**
 * Запуск воспроизведения.
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность аудио-файла. Актуально для Flash-реализации, в ней пока аудио-файл грузится длительность определяется с погрешностью.
 * @returns {AbortablePromise}
 */
Audio.prototype.play = function(src, duration) {
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

    var promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
        Audio.EVENT_STOP,
        Audio.EVENT_ERROR,
        Audio.EVENT_CRASHED
    ]);

    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(Audio.STATE_PAUSED);
    this.implementation.play(src, duration);

    return promise;
};

/**
 * Перезапуск воспроизведения.
 * @returns {AbortablePromise} обещание, которое разрешится, когда трек будет перезапущен.
 */
Audio.prototype.restart = function() {
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
 * @param {int} [offset=0] Активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер.
 * @returns {AbortablePromise} обещание, которое разрешится, когда воспроизведение будет остановлено.
 */
Audio.prototype.stop = function(offset) {
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
        promise = this._waitEvents("_whenStop", [Audio.EVENT_STOP], [
            Audio.EVENT_PLAY,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
        ]);
    }

    this.implementation.stop();

    return promise;
};

/**
 * Поставить плеер на паузу.
 * @returns {AbortablePromise} обещание, которое  разрешится, когда плеер будет поставлен на паузу.
 */
Audio.prototype.pause = function() {
    logger.info(this, "pause");

    if (this.state !== Audio.STATE_PLAYING) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPlay) {
        this._whenPlay.reject("pause");
    }

    if (this._whenPause) {
        promise = this._whenPause.promise();
    } else {
        promise = this._waitEvents("_whenPause", [Audio.EVENT_PAUSE], [
            Audio.EVENT_STOP,
            Audio.EVENT_PLAY,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
        ]);
    }

    this.implementation.pause();

    return promise;
};

/**
 * Снятие плеера с паузы.
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется воспроизведение.
 */
Audio.prototype.resume = function() {
    logger.info(this, "resume");

    if (this.state === Audio.STATE_PLAYING && !this._whenPause) {
        return Promise.resolve();
    }

    if (!(this.state === Audio.STATE_IDLE || this.state === Audio.STATE_PAUSED
        || this.state === Audio.STATE_PLAYING)) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPause) {
        this._whenPause.reject("resume");
    }

    if (this._whenPlay) {
        promise = this._whenPlay.promise();
    } else {
        promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
            Audio.EVENT_STOP,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
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
 * Запуск воспроизведения предзагруженного аудиофайла.
 * @param {String} [src] Ссылка на аудиофайл (для проверки, что в прелоадере нужный трек).
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется воспроизведение предзагруженного аудиофайла.
 */
Audio.prototype.playPreloaded = function(src) {
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

    var promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
        Audio.EVENT_STOP,
        Audio.EVENT_ERROR,
        Audio.EVENT_CRASHED
    ]);
    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(Audio.STATE_PAUSED);
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
 * Предзагрузка аудиофайла.
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность аудиофайла. Актуально для Flash-реализации, в ней пока аудиофайл грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется предзагрузка аудиофайла.
 */
Audio.prototype.preload = function(src, duration) {
    if (detect.browser.name === "msie" && detect.browser.version[0] == "9") {
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    logger.info(this, "preload", logger._showUrl(src), duration);

    if (this._whenPreload) {
        this._whenPreload.reject("preload");
    }

    var promise = this._waitEvents("_whenPreload", [
        Audio.PRELOADER_EVENT + Audio.EVENT_LOADING,
        Audio.EVENT_SWAP
    ], [
        Audio.PRELOADER_EVENT + Audio.EVENT_CRASHED,
        Audio.PRELOADER_EVENT + Audio.EVENT_ERROR,
        Audio.PRELOADER_EVENT + Audio.EVENT_STOP
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
 * Проверка, что аудиофайл предзагружен.
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если аудиофайл предзагружен, false - иначе.
 */
Audio.prototype.isPreloaded = function(src) {
    return this.implementation.isPreloaded(src);
};

/**
 * Проверка, что аудиофайл предзагружается.
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если аудиофайл начал предзагружаться, false - иначе.
 */
Audio.prototype.isPreloading = function(src) {
    return this.implementation.isPreloading(src, 1);
};

// =================================================================

//  Тайминги

// =================================================================

/**
 * Получение позиции воспроизведения (в секундах).
 * @returns {Number}
 */
Audio.prototype.getPosition = function() {
    return this.implementation.getPosition() || 0;
};

/**
 * Установка позиции воспроизведения (в секундах).
 * @param {Number} position Новая позиция воспроизведения
 * @returns {Number} итоговая позиция воспроизведения.
 */
Audio.prototype.setPosition = function(position) {
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
 * Получить длительность текущего аудио-файла (в секундах).
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number}
 */
Audio.prototype.getDuration = function(preloader) {
    return this.implementation.getDuration(preloader ? 1 : 0) || 0;
};

/**
 * Получить длительность загруженной части (в секундах).
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number}
 */
Audio.prototype.getLoaded = function(preloader) {
    return this.implementation.getLoaded(preloader ? 1 : 0) || 0;
};

/**
 * Получить длительность воспроизведения (в секундах).
 * @returns {Number}
 */
Audio.prototype.getPlayed = function() {
    var position = this.getPosition();
    this._played += position - this._lastSkip;
    this._lastSkip = position;

    return this._played;
};

// =================================================================

//  Громкость

// =================================================================

/**
 * Получить текущее значение громкости плеера.
 * @returns {Number}
 */
Audio.prototype.getVolume = function() {
    if (!this.implementation) {
        return 0;
    }

    return this.implementation.getVolume();
};

/**
 * Установка громкости плеера.
 * @param {Number} volume Новое значение громкости.
 * @returns {Number} итоговое значение громкости.
 */
Audio.prototype.setVolume = function(volume) {
    DEV && logger.debug(this, "setVolume", volume);

    if (!this.implementation) {
        return 0;
    }

    return this.implementation.setVolume(volume);
};

/**
 * Проверка, что громкость управляется устройством, а не программно.
 * @returns {Boolean} true, если громкость управляется устройством, false - иначе.
 */
Audio.prototype.isDeviceVolume = function() {
    if (!this.implementation) {
        return true;
    }

    return this.implementation.isDeviceVolume();
};

// =================================================================

//  Web Audio API

// =================================================================
/**
 * Включить режим CORS для получения аудио-треков
 * @param {Boolean} state - Запрашиваемый статус.
 * @returns {boolean} статус успеха.
 */
Audio.prototype.toggleCrossDomain = function(state) {
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleCrossDomainFailed", this.implementation.type);
        return false;
    }

    this.implementation.toggleCrossDomain(state);
    return true;
};

/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 * Внимание!!! После включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode.
 * @param {Boolean} state Запрашиваемый статус.
 * @returns {Boolean} итоговый статус
 */
Audio.prototype.toggleWebAudioAPI = function(state) {
    logger.info(this, "toggleWebAudioAPI", state);
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleWebAudioAPIFailed", this.implementation.type);
        return false;
    }

    return this.implementation.toggleWebAudioAPI(state);
};

/**
 * Аудио-препроцессор.
 * @typedef {Object} Audio~AudioPreprocessor
 *
 * @property {AudioNode} input Нода, в которую перенаправляется вывод аудио.
 * @property {AudioNode} output Нода, из которой вывод подается на усилитель.
 */

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудиоэлементу, у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость.
 * @param {Audio~AudioPreprocessor} preprocessor Препроцессор.
 * @returns {boolean} статус успеха.
 */
Audio.prototype.setAudioPreprocessor = function(preprocessor) {
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
Audio.prototype._generatePlayId = function() {
    this._playId = Math.random().toString().slice(2);
};

/**
 * Получить уникальный идентификатор воспроизведения. Создаётся каждый раз при запуске нового трека или перезапуске текущего.
 * @returns {String}
 */
Audio.prototype.getPlayId = function() {
    return this._playId;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
Audio.prototype._logger = function() {
    return {
        index: this.implementation && this.implementation.name,
        src: this.implementation && this.implementation._logger(),
        type: this.implementation && this.implementation.type
    };
};

module.exports = Audio;

},{"./audio-static":4,"./config":5,"./error/audio-error":6,"./flash/audio-flash":10,"./html5/audio-html5":26,"./lib/async/deferred":28,"./lib/async/events":29,"./lib/async/promise":30,"./lib/async/reject":31,"./lib/browser/detect":32,"./lib/data/merge":37,"./logger/logger":43}],4:[function(require,module,exports){
/**
 * @alias Audio
 * @ignore
 */
var AudioStatic = {};

/**
 * Начало воспроизведения трека.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_PLAY = "play";
/**
 * Остановка воспроизведения.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_STOP = "stop";
/**
 * Пауза воспроизведения.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_PAUSE = "pause";
/**
 * Обновление позиции воспроизведения.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_PROGRESS = "progress";
/**
 * Началась загрузка трека.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_LOADING = "loading";
/**
 * Загрузка трека завершена.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_LOADED = "loaded";
/**
 * Изменение громкости.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_VOLUME = "volumechange";

/**
 * Воспроизведение трека завершено.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_ENDED = "ended";
/**
 * Возникла ошибка при инициализации плеера.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_CRASHED = "crashed";
/**
 * Возникла ошибка при воспроизведении.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_ERROR = "error";
/**
 * Изменение статуса плеера.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_STATE = "state";
/**
 * Переключение между текущим и предзагруженным треком.
 * @type {String}
 * @const
 * @ignore
 */
AudioStatic.EVENT_SWAP = "swap";
/**
 * Событие предзагрузчика. Используется в качестве префикса.
 * @type {String}
 * @const
 */
AudioStatic.PRELOADER_EVENT = "preloader:";
/**
 * Плеер находится в состоянии инициализации.
 * @type {String}
 * @const
 */
AudioStatic.STATE_INIT = "init";
/**
 * Не удалось инициализировать плеер.
 * @type {String}
 * @const
 */
AudioStatic.STATE_CRASHED = "crashed";
/**
 * Плеер готов и ожидает.
 * @type {String}
 * @const
 */
AudioStatic.STATE_IDLE = "idle";
/**
 * Плеер проигрывает трек.
 * @type {String}
 * @const
 */
AudioStatic.STATE_PLAYING = "playing";
/**
 * Плеер поставлен на паузу.
 * @type {String}
 * @const
 */
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;

},{}],5:[function(require,module,exports){
/**
 * Настройки библиотеки.
 * @exported ya.music.Audio.config
 * @namespace
 */
var config = {

    // =================================================================

    //  Общие настройки

    // =================================================================

    /**
     * Общие настройки.
     * @namespace
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
     * Настройки подключения Flash-плеера.
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
        name: "player-2_1.swf",
        /**
         * Минимальная версия флеш-плеера
         * @type {String}
         */
        version: "9.0.28",
        /**
         * ID, который будет выставлен для элемента с Flash-плеером
         * @type {String}
         */
        playerID: "YandexAudioFlashPlayer",
        /**
         * Имя функции-обработчика событий Flash-плеера
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
         * Интервал проверки доступности Flash-плеера
         * @type {Number}
         */
        heartBeatInterval: 1000
    },

    // =================================================================

    //  HTML5-плеер

    // =================================================================

    /**
     * Описание настроек HTML5 плеера.
     * @namespace
     */
    html5: {
        /**
         * Список идентификаторов для которых лучше не использовать html5 плеер. Используется при
         * авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону
         * `@<platform.version> <platform.os>:<browser.name>/<browser.version>`
         *
         * @type { Array.<String> }
         */
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"]
    }
};

module.exports = config;

},{}],6:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @exported ya.music.Audio.AudioError
 * @classdesc Класс ошибки аудиопллеера.
 * @extends Error
 * @param {String} message Текст ошибки.
 *
 * @constructor
 */
var AudioError = function(message) {
    ErrorClass.call(this, message);
};
AudioError.prototype = ErrorClass.create("AudioError");

/**
 * Не найдена реализация плеера или возникла ошибка при инициализации всех доступных реализаций.
 * @type {String}
 * @const
 */
AudioError.NO_IMPLEMENTATION = "cannot find suitable implementation";
/**
 * Аудиофайл не был предзагружен или во время загрузки произошла ошибка.
 * @type {String}
 * @const
 */
AudioError.NOT_PRELOADED = "track is not preloaded";
/**
 * Действие недоступно из текущего состояния.
 * @type {String}
 * @const
 */
AudioError.BAD_STATE = "action is not permited from current state";

/**
 * Flash-плеер был заблокирован.
 * @type {String}
 * @const
 */
AudioError.FLASH_BLOCKER = "flash is rejected by flash blocker plugin";
/**
 * Возникла ошибка при инициализации Flash-плеера по неизвестным причинам.
 * @type {String}
 * @const
 */
AudioError.FLASH_UNKNOWN_CRASH = "flash is crashed without reason";
/**
 * Возникла ошибка при инициализации Flash-плеера из-за таймаута.
 * @type {String}
 * @const
 */
AudioError.FLASH_INIT_TIMEOUT = "flash init timed out";
/**
 * Внутренняя ошибка Flash-плеера.
 * @type {String}
 * @const
 */
AudioError.FLASH_INTERNAL_ERROR = "flash internal error";
/**
 * Попытка вызвать недоступный экземляр Flash-плеера.
 * @type {String}
 * @const
 */
AudioError.FLASH_EMMITER_NOT_FOUND = "flash event emmiter not found";
/**
 * Flash-плеер перестал отвечать на запросы.
 * @type {String}
 * @const
 */
AudioError.FLASH_NOT_RESPONDING = "flash player doesn't response";

module.exports = AudioError;

},{"../lib/class/error-class":34}],7:[function(require,module,exports){
require('../export');

var AudioError = require('./audio-error');
var PlaybackError = require('./playback-error');

ya.music.Audio.AudioError = AudioError;
ya.music.Audio.PlaybackError = PlaybackError;

},{"../export":9,"./audio-error":6,"./playback-error":8}],8:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @exported ya.music.Audio.PlaybackError
 * @classdesc Класс ошибки воспроизведения.
 * @extends Error
 * @param {String} message Текст ошибки.
 * @param {String} src Ссылка на трек.
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
 * @type {String}
 * @const
 */
PlaybackError.CONNECTION_ABORTED = "Connection aborted";
/**
 * Сетевая ошибка.
 * @type {String}
 * @const
 */
PlaybackError.NETWORK_ERROR = "Network error";
/**
 * Ошибка декодирования аудио.
 * @type {String}
 * @const
 */
PlaybackError.DECODE_ERROR = "Decode error";
/**
 * Недоступный источник.
 * @type {String}
 * @const
 */
PlaybackError.BAD_DATA = "Bad data";

/**
 * Не запускается воспроизведение.
 * @type {String}
 * @const
 */
PlaybackError.DONT_START = "Playback start error";

/**
 * Таблица соответствия кодов ошибок HTML5 плеера.
 *
 * @const
 * @type {Object}
 */
PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

//TODO: сделать классификатор ошибок flash-плеера

module.exports = PlaybackError;

},{"../lib/class/error-class":34}],9:[function(require,module,exports){
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

require('./lib/export');

module.exports = ya.music.Audio;

},{"./audio-player":3,"./config":5,"./lib/class/proxy":35,"./lib/export":38}],10:[function(require,module,exports){
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

},{"../config":5,"../lib/async/events":29,"../lib/browser/detect":32,"../lib/browser/swfobject":33,"../logger/logger":43,"./flash-interface":11,"./flash-manager":12}],11:[function(require,module,exports){
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
    this._callFlash("play", id, src, duration && duration * 1000);
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
    return this._callFlash("preload", id, src, duration && duration * 1000, offset == null ? 1 : offset);
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

},{"../logger/logger":43}],12:[function(require,module,exports){
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

},{"../audio-static":4,"../config":5,"../error/audio-error":6,"../lib/async/deferred":28,"../lib/async/promise":30,"../lib/net/error/loader-error":40,"../logger/logger":43,"./flash-interface":11,"./loader":15}],13:[function(require,module,exports){
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
 * @private
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
 * @event EqualizerBand.EVENT_CHANGE
 * @param {Number} value Новое значение.
 */

/**
 * @classdesc Полоса пропускания эквалайзера.
 * @extends Events
 *
 * @param {AudioContext} audioContext Контекст Web Audio API.
 * @param {String} type Тип фильтра.
 * @param {Number} frequency Частота фильтра.
 *
 * @fires EqualizerBand.EVENT_CHANGE
 *
 * @constructor
 * @private
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
 * Получить частоту полосы пропускания.
 * @returns {Number}
 */
EqualizerBand.prototype.getFreq = function() {
    return this.filter.frequency.value;
};

/**
 * Получить значение усиления.
 * @returns {Number}
 */
EqualizerBand.prototype.getValue = function() {
    return this.filter.gain.value;
};

/**
 * Установить значение усиления.
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
 * @typedef {Object} Equalizer~EqualizerPreset
 * @property {String} [id] Идентификатор настроек.
 * @property {Number} preamp Предусилитель.
 * @property {Array.<Number>} bands Значения для полос эквалайзера.
 */

/**
 * Событие изменения полосы пропускания
 * @event Equalizer.EVENT_CHANGE
 *
 * @param {Number} freq Частота полосы пропускания.
 * @param {Number} value Значение усиления.
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Эквалайзер.
 * @exported ya.music.Audio.fx.Equalizer
 *
 * @param {AudioContext} audioContext Контекст Web Audio API.
 * @param {Array.<Number>} bands Список частот для полос эквалайзера.
 *
 * @extends Events
 *
 * @fires Equalizer.EVENT_CHANGE
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
 * Набор частот эквалайзера, применяющийся по умолчанию.
 * @type {Array.<Number>}
 * @const
 */
Equalizer.DEFAULT_BANDS = require('./default.bands.js');

/**
 * Набор распространенных пресетов эквалайзера для набора частот по умолчанию.
 * @type {Object.<String, Equalizer~EqualizerPreset>}
 * @const
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
 * @param {Equalizer~EqualizerPreset} preset Настройки.
 */
Equalizer.prototype.loadPreset = function(preset) {
    preset.bands.forEach(function(value, idx) {
        this.bands[idx].setValue(value);
    }.bind(this));
    this.preamp.setValue(preset.preamp);
};

/**
 * Сохранить текущие настройки.
 * @returns {Equalizer~EqualizerPreset}
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
 * Вычисляет оптимальное значение предусиления. Функция является экспериментальной.
 * @experimental
 * @returns {number} значение предусиления.
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
 * Методы конвертации значений громкости.
 * @name volumeLib
 * @exported ya.music.Audio.fx.volumeLib
 * @namespace
 */
var volumeLib = {};

/**
 * Минимальное значение громкости, при котором происходит отключение звука.
 * Ограничение в 0.01 подобрано эмпирически.
 * @type {number}
 */
volumeLib.EPSILON = 0.01;

/**
 * Коэффициент для преобразований громкости из относительной шкалы в децибелы.
 * @type Number
 * @private
 */
volumeLib._DBFS_COEF = 20 / Math.log(10);

/**
 * Вычисление значение относительной громкости по значению на логарифмической шкале.
 * @param {Number} value Значение на шкале.
 * @returns {Number}
 */
volumeLib.toExponent = function(value) {
    var volume = Math.pow(volumeLib.EPSILON, 1 - value);
    return volume > volumeLib.EPSILON ? volume : 0;
};

/**
 * Вычисление положения на логарифмической шкале по значению относительной громкости громкости
 * @param {Number} volume Громкость.
 * @returns {Number}
 */
volumeLib.fromExponent = function(volume) {
    return 1 - Math.log(Math.max(volume, volumeLib.EPSILON)) / Math.log(volumeLib.EPSILON);
};

/**
 * Вычисление значения dBFS из относительного значения громкости.
 * @param {Number} volume Относительная громкость.
 * @returns {Number}
 */
volumeLib.toDBFS = function(volume) {
    return Math.log(volume) * volumeLib._DBFS_COEF;
};

/**
 * Вычисление значения относительной громкости из значения dBFS.
 * @param {Number} dbfs Громкость в dBFS.
 * @returns {Number}
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

AudioHTML5Loader._catchPromise = function(promise) {
    if (promise && promise["catch"]) {
        promise["catch"](function() {});
    }
};

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
    AudioHTML5Loader._catchPromise(this.audio.pause());
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
        AudioHTML5Loader._catchPromise(this.audio.pause());

        DEV && logger.debug(this, "_startupAudio:play", e.type);
    }.bind(this);
    this.__initListener.step = "play";

    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_CANPLAY, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_META, this.__initListener);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__initListener);

    //INFO: перед использованием объект Audio требуется инициализировать, в обработчике пользовательского события
    AudioHTML5Loader._catchPromise(this.audio.load());
    AudioHTML5Loader._catchPromise(this.audio.play());
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
    AudioHTML5Loader._catchPromise(this.audio.load());
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
    AudioHTML5Loader._catchPromise(this.audio.play());

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

    AudioHTML5Loader._catchPromise(this.audio.pause());
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

},{"../audio-static":4,"../error/playback-error":8,"../lib/async/deferred":28,"../lib/async/events":29,"../lib/noop":41,"../logger/logger":43}],26:[function(require,module,exports){
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
 * @param {Audio~AudioPreprocessor} preprocessor - препроцессор
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

},{"../audio-static":4,"../lib/async/events":29,"../lib/browser/detect":32,"../logger/logger":43,"./audio-html5-loader":25}],27:[function(require,module,exports){
var YandexAudio = require('./export');
require('./error/export');
require('./lib/net/error/export');
require('./logger/export');
require('./fx/equalizer/export');
require('./fx/volume/export');

module.exports = YandexAudio;

},{"./error/export":7,"./export":9,"./fx/equalizer/export":21,"./fx/volume/export":23,"./lib/net/error/export":39,"./logger/export":42}],28:[function(require,module,exports){
var Promise = require('./promise');
var noop = require('../noop');

/**
 * @classdesc Класс для управления обещанием
 * @exported ya.music.lib.Deferred
 * @constructor
 */
var Deferred = function() {
    var self = this;

    var promise = new Promise(function(resolve, reject) {
        /**
         * Разрешить обещание
         * @method Deferred#resolve
         * @param data - передать данные в обещание
         */
        self.resolve = resolve;

        /**
         * Отклонить обещание
         * @method Deferred#reject
         * @param error - передать ошибку
         */
        self.reject = reject;
    });

    promise["catch"](noop); // Don't throw errors to console

    /**
     * Получить обещание
     * @method Deferred#promise
     * @returns {Promise}
     */
    this.promise = function() { return promise; };
};

module.exports = Deferred;

},{"../noop":41,"./promise":30}],29:[function(require,module,exports){
var merge = require('../data/merge');

var LISTENERS_NAME = "_listeners";
var MUTE_OPTION = "_muted";

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Диспетчер событий.
 * @class
 * @exported ya.music.lib.Events
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
 * Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).
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
var merge = require('../data/merge');

// =================================================================

// Promise

// =================================================================

/**
 * @classdesc Обещание по спецификации {@linkhref https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise ES 2015 promises}. В устаревших браузерах и IE используется замена из библиотеки {@linkhref http://github.com/dfilatov/vow.git vow}
 *
 * @exported ya.music.lib.Promise
 * @constructor
 */
var Promise;
if (typeof window.Promise !== "function"
    || detect.browser.name === "msie" || detect.browser.name === "edge" // мелкие мягкие как всегда ничего не умеют делать правильно
) {
    Promise = function(resolver) {
        var promise;
        try {
            promise = new vow.Promise(resolver);
        } catch(e) {
            promise = vow.reject(e);
        }
        return promise;
    };
    merge(Promise, vow.Promise, true);
    Promise.prototype = vow.Promise.prototype;
} else {
    Promise = window.Promise;
}

module.exports = Promise;

/**
 * Назначить обработчики разрешения и отклонения обещания.
 * @method Promise#then
 * @param {function} callback Обработчик успеха.
 * @param {null|function} [errback] Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

/**
 * Назначить обработчик отклонения обещания.
 * @method Promise#catch
 * @param {function} errback Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

// =================================================================

// AbortablePromise

// =================================================================

/**
 * @class AbortablePromise
 * @classdesc Обещание с возможностью отмены связанного с ним действия.
 * @extends Promise
 */

/**
 * Отмена действия, связанного с обещанием. Абстрактный метод.
 * @method AbortablePromise#abort
 * @param {String|Error} reason Причина отмены действия.
 * @abstract
 */





},{"../browser/detect":32,"../data/merge":37,"vow":2}],31:[function(require,module,exports){
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

},{"../noop":41,"./promise":30}],32:[function(require,module,exports){
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
 * @exported ya.music.info
 */
var info = {
    /**
     * Информация о браузере
     * @namespace
     * @property {string} name - название браузера
     * @property {string} version - версия
     * @property {number} [documentMode] - версия документа (для IE)
     */
    browser: browser,

    /**
     * Информация о платформе
     * @namespace
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

module.exports = info;

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
var pureInstance = require('./pure-instance');

/**
 * @classdesc Класс ошибки. Оригинальный Error ведёт себя как фабрика, а не как класс. Этот объект ведёт себя как класс и его можно наследовать.
 * @param {String} [message] - сообщение
 * @param {Number} [id] - идентификатор ошибки
 * @extends Error
 * @exported ya.music.lib.Error
 * @constructor
 */
var ErrorClass = function(message, id) {
    var err = new Error(message, id);
    err.name = this.name;

    this.message = err.message;
    this.stack = err.stack;
};

/**
 * Сахар для быстрого создания нового класса ошибок.
 * @param {String} name - имя создаваемого класса
 * @returns {ErrorClass}
 */
ErrorClass.create = function(name) {
    var errClass = pureInstance(this);
    errClass.name = name;
    return errClass;
};

ErrorClass.prototype = pureInstance(Error);
ErrorClass.prototype.name = "ErrorClass";

module.exports = ErrorClass;

},{"./pure-instance":36}],35:[function(require,module,exports){
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

},{"../async/events":29}],36:[function(require,module,exports){
/**
 * Создаёт экземпляр класса, но не запускает его конструктор
 * @param {function} OriginalClass - класс
 * @exported ya.music.lib.pureInstance
 * @returns {OriginalClass}
 */
var pureInstance = function(OriginalClass) {
    var PureClass = function() {};
    PureClass.prototype = OriginalClass.prototype;
    return new PureClass();
};

module.exports = pureInstance;

},{}],37:[function(require,module,exports){
/**
 * Объединение объектов
 * @param {Object} initial - начальный объект
 * @param {Object} ...args - список объектов которые надо объединить с начальным
 * @param {Boolean} [extend] - если последний аргумент true, то будет модифицирован начальный объект, в противном случае будет создана неглубокая копия.
 * @exported ya.music.lib.merge
 * @returns {Object}
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
require('../export');

if (!ya.music.lib) {
    ya.music.lib = {};
}

var Events = require('./async/events');
var ErrorClass = require('./class/error-class');
var pureInstance = require('./class/pure-instance');

var EventsProxy = function() { Events.call(this); };
EventsProxy.prototype = pureInstance(Events);
EventsProxy.mixin = Events.mixin;
EventsProxy.eventize = Events.eventize;

var ErrorClassProxy = function() { ErrorClass.apply(this, arguments); };
ErrorClassProxy.prototype = pureInstance(ErrorClass);
ErrorClassProxy.create = ErrorClass.create;

ya.music.lib.Events = EventsProxy;
ya.music.lib.Error = ErrorClassProxy;

ya.music.lib.Promise = require('./async/promise');
ya.music.lib.Deferred = require('./async/deferred');

ya.music.lib.pureInstance = pureInstance;
ya.music.lib.merge = require('./data/merge');

ya.music.info = require('./browser/detect');

},{"../export":9,"./async/deferred":28,"./async/events":29,"./async/promise":30,"./browser/detect":32,"./class/error-class":34,"./class/pure-instance":36,"./data/merge":37}],39:[function(require,module,exports){
require('../../../export');

var LoaderError = require('./loader-error');

ya.music.Audio.LoaderError = LoaderError;

},{"../../../export":9,"./loader-error":40}],40:[function(require,module,exports){
var ErrorClass = require('../../class/error-class');

/**
 * @exported ya.music.Audio.LoaderError
 * @classdesc Класс ошибок загрузчика.
 * Расширяет Error.
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
 * @type {String}
 * @const
 */
LoaderError.TIMEOUT = "request timeout";
/**
 * Ошибка запроса на загрузку.
 * @type {String}
 * @const
 */
LoaderError.FAILED = "request failed";

module.exports = LoaderError;

},{"../../class/error-class":34}],41:[function(require,module,exports){
/**
 * Заглушка в виде пустой функции на все случаи жизни
 * @private
 */
var noop = function() {};

module.exports = noop;

},{}],42:[function(require,module,exports){
require("../export");

var Logger = require('./logger');

ya.music.Audio.Logger = Logger;

},{"../export":9,"./logger":43}],43:[function(require,module,exports){
var LEVELS = ["debug", "log", "info", "warn", "error", "trace"];
var noop = require('../lib/noop');

// =================================================================

//  Конструктор

// =================================================================

/**
 * @exported ya.music.Logger
 * @classdesc Настраиваемый логгер для аудиоплеера.
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
 * @type {Array.<String>}
 */
Logger.ignores = [];

/**
 * Список отображаемых в консоли уровней лога.
 * @type {Array.<String>}
 */
Logger.logLevels = [];

// =================================================================

//  Синтаксический сахар

// =================================================================

/**
 * Запись в лог с уровнем **debug**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.debug = noop;

/**
 * Запись в лог с уровнем **log**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.log = noop;

/**
 * Запись в лог с уровнем **info**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.info = noop;

/**
 * Запись в лог с уровнем **warn**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.warn = noop;

/**
 * Запись в лог с уровнем **error**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.error = noop;

/**
 * Запись в лог с уровнем **trace**.
 * @param {Object} context Контекст вызова.
 * @param {...*} [args] Дополнительные аргументы.
 */
Logger.prototype.trace = noop;

/**
 * Метод для обработки ссылок, передаваемых в лог.
 * @param url
 * @private
 */
Logger.prototype._showUrl = function(url) {
    return Logger.showUrl(url);
};

/**
 * Метод для обработки ссылок, передаваемых в лог. Можно переопределять. По умолчанию не выполняет никаких действий.
 * @name ya.music.Audio.Logger#showUrl
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
 * Записать сообщение лога в консоль.
 * @param {ya.music.Audio.Logger~LogEntry} logEntry Сообщение лога.
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
 * Вспомогательная функция форматирования даты для вывода в коносоль.
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

},{"../lib/noop":41}]},{},[27])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LmJhbmRzLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci1iYW5kLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXItc3RhdGljLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2V4cG9ydC5qcyIsInNyYy9meC9leHBvcnQuanMiLCJzcmMvZngvdm9sdW1lL2V4cG9ydC5qcyIsInNyYy9meC92b2x1bWUvdm9sdW1lLWxpYi5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9lcnJvci1jbGFzcy5qcyIsInNyYy9saWIvY2xhc3MvcHJveHkuanMiLCJzcmMvbGliL2NsYXNzL3B1cmUtaW5zdGFuY2UuanMiLCJzcmMvbGliL2RhdGEvbWVyZ2UuanMiLCJzcmMvbGliL2V4cG9ydC5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2V4cG9ydC5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2xvYWRlci1lcnJvci5qcyIsInNyYy9saWIvbm9vcC5qcyIsInNyYy9sb2dnZXIvZXhwb3J0LmpzIiwic3JjL2xvZ2dlci9sb2dnZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaHpDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGhDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3I3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKipcbiAqIEBtb2R1bGUgdm93XG4gKiBAYXV0aG9yIEZpbGF0b3YgRG1pdHJ5IDxkZmlsYXRvdkB5YW5kZXgtdGVhbS5ydT5cbiAqIEB2ZXJzaW9uIDAuNC4xMFxuICogQGxpY2Vuc2VcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBhbmQgR1BMIGxpY2Vuc2VzOlxuICogICAqIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwXG4gKiAgICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC5odG1sXG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuXG52YXIgdW5kZWYsXG4gICAgbmV4dFRpY2sgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBmbnMgPSBbXSxcbiAgICAgICAgICAgIGVucXVldWVGbiA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZucy5wdXNoKGZuKSA9PT0gMTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsRm5zID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZuc1RvQ2FsbCA9IGZucywgaSA9IDAsIGxlbiA9IGZucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm5zID0gW107XG4gICAgICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICBmbnNUb0NhbGxbaSsrXSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgaWYodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBpZTEwLCBub2RlanMgPj0gMC4xMFxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBzZXRJbW1lZGlhdGUoY2FsbEZucyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmIHByb2Nlc3MubmV4dFRpY2spIHsgLy8gbm9kZWpzIDwgMC4xMFxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBwcm9jZXNzLm5leHRUaWNrKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBNdXRhdGlvbk9ic2VydmVyID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7IC8vIG1vZGVybiBicm93c2Vyc1xuICAgICAgICBpZihNdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICAgICAgICB2YXIgbnVtID0gMSxcbiAgICAgICAgICAgICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuXG4gICAgICAgICAgICBuZXcgTXV0YXRpb25PYnNlcnZlcihjYWxsRm5zKS5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YSA6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgKG5vZGUuZGF0YSA9IChudW0gKj0gLTEpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZihnbG9iYWwucG9zdE1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHZhciBpc1Bvc3RNZXNzYWdlQXN5bmMgPSB0cnVlO1xuICAgICAgICAgICAgaWYoZ2xvYmFsLmF0dGFjaEV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGNoZWNrQXN5bmMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUG9zdE1lc3NhZ2VBc3luYyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKCdfX2NoZWNrQXN5bmMnLCAnKicpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5kZXRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzUG9zdE1lc3NhZ2VBc3luYykge1xuICAgICAgICAgICAgICAgIHZhciBtc2cgPSAnX19wcm9taXNlJyArICtuZXcgRGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgb25NZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZS5kYXRhID09PSBtc2cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbiAmJiBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyP1xuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIG9uTWVzc2FnZSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBnbG9iYWwucG9zdE1lc3NhZ2UobXNnLCAnKicpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuICAgICAgICBpZignb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0JykpIHsgLy8gaWU2LWllOFxuICAgICAgICAgICAgdmFyIGNyZWF0ZVNjcmlwdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0ID0gc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAoZG9jLmRvY3VtZW50RWxlbWVudCB8fCBkb2MuYm9keSkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgY3JlYXRlU2NyaXB0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7IC8vIG9sZCBicm93c2Vyc1xuICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBzZXRUaW1lb3V0KGNhbGxGbnMsIDApO1xuICAgICAgICB9O1xuICAgIH0pKCksXG4gICAgdGhyb3dFeGNlcHRpb24gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH0sXG4gICAgaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JztcbiAgICB9LFxuICAgIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyxcbiAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICB9LFxuICAgIGdldEFycmF5S2V5cyA9IGZ1bmN0aW9uKGFycikge1xuICAgICAgICB2YXIgcmVzID0gW10sXG4gICAgICAgICAgICBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgcmVzLnB1c2goaSsrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgZ2V0T2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgIGZvcih2YXIgaSBpbiBvYmopIHtcbiAgICAgICAgICAgIG9iai5oYXNPd25Qcm9wZXJ0eShpKSAmJiByZXMucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgZGVmaW5lQ3VzdG9tRXJyb3JUeXBlID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB2YXIgcmVzID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVzLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICB3cmFwT25GdWxmaWxsZWQgPSBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgaWR4KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgIG9uRnVsZmlsbGVkLmNhbGwodGhpcywgdmFsLCBpZHgpO1xuICAgICAgICB9O1xuICAgIH07XG5cbi8qKlxuICogQGNsYXNzIERlZmVycmVkXG4gKiBAZXhwb3J0cyB2b3c6RGVmZXJyZWRcbiAqIEBkZXNjcmlwdGlvblxuICogVGhlIGBEZWZlcnJlZGAgY2xhc3MgaXMgdXNlZCB0byBlbmNhcHN1bGF0ZSBuZXdseS1jcmVhdGVkIHByb21pc2Ugb2JqZWN0IGFsb25nIHdpdGggZnVuY3Rpb25zIHRoYXQgcmVzb2x2ZSwgcmVqZWN0IG9yIG5vdGlmeSBpdC5cbiAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICogQGRlc2NyaXB0aW9uXG4gKiBZb3UgY2FuIHVzZSBgdm93LmRlZmVyKClgIGluc3RlYWQgb2YgdXNpbmcgdGhpcyBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBgbmV3IHZvdy5EZWZlcnJlZCgpYCBnaXZlcyB0aGUgc2FtZSByZXN1bHQgYXMgYHZvdy5kZWZlcigpYC5cbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcHJvbWlzZSA9IG5ldyBQcm9taXNlKCk7XG59O1xuXG5EZWZlcnJlZC5wcm90b3R5cGUgPSAvKiogQGxlbmRzIERlZmVycmVkLnByb3RvdHlwZSAqL3tcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvbWlzZSA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHZhbHVlIGlzIFwiJ3N1Y2Nlc3MnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIucmVzb2x2ZSgnc3VjY2VzcycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSB8fCB0aGlzLl9wcm9taXNlLl9yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVqZWN0cyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UuZmFpbChmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgKiAgICAgLy8gcmVhc29uIGlzIFwiJ3NvbWV0aGluZyBpcyB3cm9uZydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5yZWplY3QoJ3NvbWV0aGluZyBpcyB3cm9uZycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBpZih0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodm93LmlzUHJvbWlzZShyZWFzb24pKSB7XG4gICAgICAgICAgICByZWFzb24gPSByZWFzb24udGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QodmFsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlLl9yZXNvbHZlKHJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlLl9yZWplY3QocmVhc29uKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBOb3RpZmllcyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLnByb2dyZXNzKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHZhbHVlIGlzIFwiJzIwJSdcIiwgXCInNDAlJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLm5vdGlmeSgnMjAlJyk7XG4gICAgICogZGVmZXIubm90aWZ5KCc0MCUnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBub3RpZnkgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlLmlzUmVzb2x2ZWQoKSB8fCB0aGlzLl9wcm9taXNlLl9ub3RpZnkodmFsdWUpO1xuICAgIH1cbn07XG5cbnZhciBQUk9NSVNFX1NUQVRVUyA9IHtcbiAgICBQRU5ESU5HICAgOiAwLFxuICAgIFJFU09MVkVEICA6IDEsXG4gICAgRlVMRklMTEVEIDogMixcbiAgICBSRUpFQ1RFRCAgOiAzXG59O1xuXG4vKipcbiAqIEBjbGFzcyBQcm9taXNlXG4gKiBAZXhwb3J0cyB2b3c6UHJvbWlzZVxuICogQGRlc2NyaXB0aW9uXG4gKiBUaGUgYFByb21pc2VgIGNsYXNzIGlzIHVzZWQgd2hlbiB5b3Ugd2FudCB0byBnaXZlIHRvIHRoZSBjYWxsZXIgc29tZXRoaW5nIHRvIHN1YnNjcmliZSB0byxcbiAqIGJ1dCBub3QgdGhlIGFiaWxpdHkgdG8gcmVzb2x2ZSBvciByZWplY3QgdGhlIGRlZmVycmVkLlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlciBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2RvbWVuaWMvcHJvbWlzZXMtdW53cmFwcGluZy9ibG9iL21hc3Rlci9SRUFETUUubWQjdGhlLXByb21pc2UtY29uc3RydWN0b3IgZm9yIGRldGFpbHMuXG4gKiBAZGVzY3JpcHRpb25cbiAqIFlvdSBzaG91bGQgdXNlIHRoaXMgY29uc3RydWN0b3IgZGlyZWN0bHkgb25seSBpZiB5b3UgYXJlIGdvaW5nIHRvIHVzZSBgdm93YCBhcyBET00gUHJvbWlzZXMgaW1wbGVtZW50YXRpb24uXG4gKiBJbiBvdGhlciBjYXNlIHlvdSBzaG91bGQgdXNlIGB2b3cuZGVmZXIoKWAgYW5kIGBkZWZlci5wcm9taXNlKClgIG1ldGhvZHMuXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIGZ1bmN0aW9uIGZldGNoSlNPTih1cmwpIHtcbiAqICAgICByZXR1cm4gbmV3IHZvdy5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCwgbm90aWZ5KSB7XG4gKiAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAqICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gKiAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gKiAgICAgICAgIHhoci5zZW5kKCk7XG4gKiAgICAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAqICAgICAgICAgICAgIGlmKHhoci5yZXNwb25zZSkge1xuICogICAgICAgICAgICAgICAgIHJlc29sdmUoeGhyLnJlc3BvbnNlKTtcbiAqICAgICAgICAgICAgIH1cbiAqICAgICAgICAgICAgIGVsc2Uge1xuICogICAgICAgICAgICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCkpO1xuICogICAgICAgICAgICAgfVxuICogICAgICAgICB9O1xuICogICAgIH0pO1xuICogfVxuICogYGBgXG4gKi9cbnZhciBQcm9taXNlID0gZnVuY3Rpb24ocmVzb2x2ZXIpIHtcbiAgICB0aGlzLl92YWx1ZSA9IHVuZGVmO1xuICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlBFTkRJTkc7XG5cbiAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gW107XG5cbiAgICBpZihyZXNvbHZlcikgeyAvLyBOT1RFOiBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2RvbWVuaWMvcHJvbWlzZXMtdW53cmFwcGluZy9ibG9iL21hc3Rlci9SRUFETUUubWRcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPSByZXNvbHZlci5sZW5ndGg7XG5cbiAgICAgICAgcmVzb2x2ZXIoXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX3Jlc29sdmUodmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID4gMT9cbiAgICAgICAgICAgICAgICBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9IDpcbiAgICAgICAgICAgICAgICB1bmRlZixcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPiAyP1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX25vdGlmeSh2YWwpO1xuICAgICAgICAgICAgICAgIH0gOlxuICAgICAgICAgICAgICAgIHVuZGVmKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgUHJvbWlzZS5wcm90b3R5cGUgKi8ge1xuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBmdWxmaWxsZWQgcHJvbWlzZSBvciB0aGUgcmVhc29uIGluIGNhc2Ugb2YgcmVqZWN0aW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgdmFsdWVPZiA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZXNvbHZlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzICE9PSBQUk9NSVNFX1NUQVRVUy5QRU5ESU5HO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc0Z1bGZpbGxlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzID09PSBQUk9NSVNFX1NUQVRVUy5GVUxGSUxMRUQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZWplY3RlZCA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzID09PSBQUk9NSVNFX1NUQVRVUy5SRUpFQ1RFRDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyByZWFjdGlvbnMgdG8gdGhlIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX0gQSBuZXcgcHJvbWlzZSwgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9wcm9taXNlcy1hcGx1cy9wcm9taXNlcy1zcGVjIGZvciBkZXRhaWxzXG4gICAgICovXG4gICAgdGhlbiA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrcyhkZWZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgb25seSBhIHJlamVjdGlvbiByZWFjdGlvbi4gVGhpcyBtZXRob2QgaXMgYSBzaG9ydGhhbmQgZm9yIGBwcm9taXNlLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhIHByb3ZpZGVkICdyZWFzb24nIGFzIGFyZ3VtZW50IGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICAnY2F0Y2gnIDogZnVuY3Rpb24ob25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgb25seSBhIHJlamVjdGlvbiByZWFjdGlvbi4gVGhpcyBtZXRob2QgaXMgYSBzaG9ydGhhbmQgZm9yIGBwcm9taXNlLnRoZW4obnVsbCwgb25SZWplY3RlZClgLiBJdCdzIGFsc28gYW4gYWxpYXMgZm9yIGBjYXRjaGAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aXRoIHRoZSB2YWx1ZSBhZnRlciBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmYWlsIDogZnVuY3Rpb24ob25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSByZXNvbHZpbmcgcmVhY3Rpb24gKGZvciBib3RoIGZ1bGZpbGxtZW50IGFuZCByZWplY3Rpb24pLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZXNvbHZlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIHRoZSBwcm9taXNlIGFzIGFuIGFyZ3VtZW50LCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsd2F5cyA6IGZ1bmN0aW9uKG9uUmVzb2x2ZWQsIGN0eCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgY2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25SZXNvbHZlZC5jYWxsKHRoaXMsIF90aGlzKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihjYiwgY2IsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBwcm9ncmVzcyByZWFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUHJvZ3Jlc3MgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgd2hlbiB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvZ3Jlc3MgOiBmdW5jdGlvbihvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgdW5kZWYsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExpa2UgYHByb21pc2UudGhlbmAsIGJ1dCBcInNwcmVhZHNcIiB0aGUgYXJyYXkgaW50byBhIHZhcmlhZGljIHZhbHVlIGhhbmRsZXIuXG4gICAgICogSXQgaXMgdXNlZnVsIHdpdGggdGhlIGB2b3cuYWxsYCBhbmQgdGhlIGB2b3cuYWxsUmVzb2x2ZWRgIG1ldGhvZHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpXSkuc3ByZWFkKGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgICAgKiAgICAgLy8gYXJnMSBpcyBcIjFcIiwgYXJnMiBpcyBcIid0d28nXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoJ3R3bycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHNwcmVhZCA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvbkZ1bGZpbGxlZC5hcHBseSh0aGlzLCB2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uUmVqZWN0ZWQsXG4gICAgICAgICAgICBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMaWtlIGB0aGVuYCwgYnV0IHRlcm1pbmF0ZXMgYSBjaGFpbiBvZiBwcm9taXNlcy5cbiAgICAgKiBJZiB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCwgdGhpcyBtZXRob2QgdGhyb3dzIGl0J3MgXCJyZWFzb25cIiBhcyBhbiBleGNlcHRpb24gaW4gYSBmdXR1cmUgdHVybiBvZiB0aGUgZXZlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICogZGVmZXIucmVqZWN0KEVycm9yKCdJbnRlcm5hbCBlcnJvcicpKTtcbiAgICAgKiBkZWZlci5wcm9taXNlKCkuZG9uZSgpOyAvLyBleGNlcHRpb24gdG8gYmUgdGhyb3duXG4gICAgICogYGBgXG4gICAgICovXG4gICAgZG9uZSA6IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdGhpc1xuICAgICAgICAgICAgLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eClcbiAgICAgICAgICAgIC5mYWlsKHRocm93RXhjZXB0aW9uKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBwcm9taXNlIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgaW4gYGRlbGF5YCBtaWxsaXNlY29uZHMgaWYgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkLFxuICAgICAqIG9yIGltbWVkaWF0ZWx5IHJlamVjdGVkIGlmIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGRlbGF5IDogZnVuY3Rpb24oZGVsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVyLFxuICAgICAgICAgICAgcHJvbWlzZSA9IHRoaXMudGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBkZWxheSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcHJvbWlzZS5hbHdheXMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBwcm9taXNlIHRoYXQgd2lsbCBiZSByZWplY3RlZCBpbiBgdGltZW91dGAgbWlsbGlzZWNvbmRzXG4gICAgICogaWYgdGhlIHByb21pc2UgaXMgbm90IHJlc29sdmVkIGJlZm9yZWhhbmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZVdpdGhUaW1lb3V0MSA9IGRlZmVyLnByb21pc2UoKS50aW1lb3V0KDUwKSxcbiAgICAgKiAgICAgcHJvbWlzZVdpdGhUaW1lb3V0MiA9IGRlZmVyLnByb21pc2UoKS50aW1lb3V0KDIwMCk7XG4gICAgICpcbiAgICAgKiBzZXRUaW1lb3V0KFxuICAgICAqICAgICBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgIGRlZmVyLnJlc29sdmUoJ29rJyk7XG4gICAgICogICAgIH0sXG4gICAgICogICAgIDEwMCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlV2l0aFRpbWVvdXQxLmZhaWwoZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICogICAgIC8vIHByb21pc2VXaXRoVGltZW91dCB0byBiZSByZWplY3RlZCBpbiA1MG1zXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlV2l0aFRpbWVvdXQyLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gcHJvbWlzZVdpdGhUaW1lb3V0IHRvIGJlIGZ1bGZpbGxlZCB3aXRoIFwiJ29rJ1wiIHZhbHVlXG4gICAgICogfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgdGltZW91dCA6IGZ1bmN0aW9uKHRpbWVvdXQpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChuZXcgdm93LlRpbWVkT3V0RXJyb3IoJ3RpbWVkIG91dCcpKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRpbWVvdXQpO1xuXG4gICAgICAgIHRoaXMudGhlbihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUodmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGRlZmVyLnByb21pc2UoKS5hbHdheXMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICBfdm93IDogdHJ1ZSxcblxuICAgIF9yZXNvbHZlIDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih2YWwgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlamVjdChUeXBlRXJyb3IoJ0NhblxcJ3QgcmVzb2x2ZSBwcm9taXNlIHdpdGggaXRzZWxmJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQ7XG5cbiAgICAgICAgaWYodmFsICYmICEhdmFsLl92b3cpIHsgLy8gc2hvcnRwYXRoIGZvciB2b3cuUHJvbWlzZVxuICAgICAgICAgICAgdmFsLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbCh2YWwudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgdmFsLmlzUmVqZWN0ZWQoKT9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0KHZhbC52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICAgICAgdmFsLnRoZW4oXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbm90aWZ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc09iamVjdCh2YWwpIHx8IGlzRnVuY3Rpb24odmFsKSkge1xuICAgICAgICAgICAgdmFyIHRoZW47XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoZW4gPSB2YWwudGhlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3Jlc29sdmUodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Jlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX25vdGlmeSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCB8fCB0aGlzLl9yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZnVsZmlsbCh2YWwpO1xuICAgIH0sXG5cbiAgICBfZnVsZmlsbCA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuRlVMRklMTEVEO1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHZhbDtcblxuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcywgdmFsKTtcbiAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IHVuZGVmO1xuICAgIH0sXG5cbiAgICBfcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5SRUpFQ1RFRDtcbiAgICAgICAgdGhpcy5fdmFsdWUgPSByZWFzb247XG5cbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9yZWplY3RlZENhbGxiYWNrcywgcmVhc29uKTtcbiAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IHVuZGVmO1xuICAgIH0sXG5cbiAgICBfbm90aWZ5IDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MsIHZhbCk7XG4gICAgfSxcblxuICAgIF9hZGRDYWxsYmFja3MgOiBmdW5jdGlvbihkZWZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICBpZihvblJlamVjdGVkICYmICFpc0Z1bmN0aW9uKG9uUmVqZWN0ZWQpKSB7XG4gICAgICAgICAgICBjdHggPSBvblJlamVjdGVkO1xuICAgICAgICAgICAgb25SZWplY3RlZCA9IHVuZGVmO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob25Qcm9ncmVzcyAmJiAhaXNGdW5jdGlvbihvblByb2dyZXNzKSkge1xuICAgICAgICAgICAgY3R4ID0gb25Qcm9ncmVzcztcbiAgICAgICAgICAgIG9uUHJvZ3Jlc3MgPSB1bmRlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYjtcblxuICAgICAgICBpZighdGhpcy5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgIGNiID0geyBkZWZlciA6IGRlZmVyLCBmbiA6IGlzRnVuY3Rpb24ob25GdWxmaWxsZWQpPyBvbkZ1bGZpbGxlZCA6IHVuZGVmLCBjdHggOiBjdHggfTtcbiAgICAgICAgICAgIHRoaXMuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKFtjYl0sIHRoaXMuX3ZhbHVlKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXRoaXMuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICAgICAgY2IgPSB7IGRlZmVyIDogZGVmZXIsIGZuIDogb25SZWplY3RlZCwgY3R4IDogY3R4IH07XG4gICAgICAgICAgICB0aGlzLmlzUmVqZWN0ZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKFtjYl0sIHRoaXMuX3ZhbHVlKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPD0gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzLnB1c2goeyBkZWZlciA6IGRlZmVyLCBmbiA6IG9uUHJvZ3Jlc3MsIGN0eCA6IGN0eCB9KTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfY2FsbENhbGxiYWNrcyA6IGZ1bmN0aW9uKGNhbGxiYWNrcywgYXJnKSB7XG4gICAgICAgIHZhciBsZW4gPSBjYWxsYmFja3MubGVuZ3RoO1xuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaXNSZXNvbHZlZCA9IHRoaXMuaXNSZXNvbHZlZCgpLFxuICAgICAgICAgICAgaXNGdWxmaWxsZWQgPSB0aGlzLmlzRnVsZmlsbGVkKCk7XG5cbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIGNiLCBkZWZlciwgZm47XG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2IgPSBjYWxsYmFja3NbaSsrXTtcbiAgICAgICAgICAgICAgICBkZWZlciA9IGNiLmRlZmVyO1xuICAgICAgICAgICAgICAgIGZuID0gY2IuZm47XG5cbiAgICAgICAgICAgICAgICBpZihmbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3R4ID0gY2IuY3R4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzID0gY3R4PyBmbi5jYWxsKGN0eCwgYXJnKSA6IGZuKGFyZyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLm5vdGlmeShyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRnVsZmlsbGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoYXJnKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KGFyZykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIubm90aWZ5KGFyZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG4vKiogQGxlbmRzIFByb21pc2UgKi9cbnZhciBzdGF0aWNNZXRob2RzID0ge1xuICAgIC8qKlxuICAgICAqIENvZXJjZXMgdGhlIGdpdmVuIGB2YWx1ZWAgdG8gYSBwcm9taXNlLCBvciByZXR1cm5zIHRoZSBgdmFsdWVgIGlmIGl0J3MgYWxyZWFkeSBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGNhc3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdm93LmNhc3QodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGVuIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWxsIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbGwoaXRlcmFibGUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IHdoZW4gYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZW4gdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJhY2UgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFueVJlc29sdmVkKGl0ZXJhYmxlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgaGF2ZSBgdmFsdWVgJ3Mgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZWplY3QocmVhc29uKTtcbiAgICB9XG59O1xuXG5mb3IodmFyIHByb3AgaW4gc3RhdGljTWV0aG9kcykge1xuICAgIHN0YXRpY01ldGhvZHMuaGFzT3duUHJvcGVydHkocHJvcCkgJiZcbiAgICAgICAgKFByb21pc2VbcHJvcF0gPSBzdGF0aWNNZXRob2RzW3Byb3BdKTtcbn1cblxudmFyIHZvdyA9IC8qKiBAZXhwb3J0cyB2b3cgKi8ge1xuICAgIERlZmVycmVkIDogRGVmZXJyZWQsXG5cbiAgICBQcm9taXNlIDogUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZGVmZXJyZWQuIFRoaXMgbWV0aG9kIGlzIGEgZmFjdG9yeSBtZXRob2QgZm9yIGB2b3c6RGVmZXJyZWRgIGNsYXNzLlxuICAgICAqIEl0J3MgZXF1aXZhbGVudCB0byBgbmV3IHZvdy5EZWZlcnJlZCgpYC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b3c6RGVmZXJyZWR9XG4gICAgICovXG4gICAgZGVmZXIgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZWZlcnJlZCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS50aGVuYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgd2hlbiA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cuY2FzdCh2YWx1ZSkudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZmFpbGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZmFpbCA6IGZ1bmN0aW9uKHZhbHVlLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlLCB1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuYWx3YXlzYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZXNvbHZlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIHRoZSBwcm9taXNlIGFzIGFuIGFyZ3VtZW50LCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsd2F5cyA6IGZ1bmN0aW9uKHZhbHVlLCBvblJlc29sdmVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5hbHdheXMob25SZXNvbHZlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UucHJvZ3Jlc3NgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblByb2dyZXNzIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcHJvZ3Jlc3MgOiBmdW5jdGlvbih2YWx1ZSwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkucHJvZ3Jlc3Mob25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2Uuc3ByZWFkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBzcHJlYWQgOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLnNwcmVhZChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZG9uZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICovXG4gICAgZG9uZSA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHZvdy53aGVuKHZhbHVlKS5kb25lKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gYHZhbHVlYCBpcyBhIHByb21pc2UtbGlrZSBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2b3cuaXNQcm9taXNlKCdzb21ldGhpbmcnKTsgLy8gcmV0dXJucyBmYWxzZVxuICAgICAqIHZvdy5pc1Byb21pc2Uodm93LmRlZmVyKCkucHJvbWlzZSgpKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogdm93LmlzUHJvbWlzZSh7IHRoZW4gOiBmdW5jdGlvbigpIHsgfSk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGlzUHJvbWlzZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgaXNGdW5jdGlvbih2YWx1ZS50aGVuKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29lcmNlcyB0aGUgZ2l2ZW4gYHZhbHVlYCB0byBhIHByb21pc2UsIG9yIHJldHVybnMgdGhlIGB2YWx1ZWAgaWYgaXQncyBhbHJlYWR5IGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgY2FzdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiAhIXZhbHVlLl92b3c/XG4gICAgICAgICAgICB2YWx1ZSA6XG4gICAgICAgICAgICB2b3cucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnZhbHVlT2ZgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICB2YWx1ZU9mIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUudmFsdWVPZik/IHZhbHVlLnZhbHVlT2YoKSA6IHZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc0Z1bGZpbGxlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzRnVsZmlsbGVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNGdWxmaWxsZWQpPyB2YWx1ZS5pc0Z1bGZpbGxlZCgpIDogdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNSZWplY3RlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVqZWN0ZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc1JlamVjdGVkKT8gdmFsdWUuaXNSZWplY3RlZCgpIDogZmFsc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzUmVzb2x2ZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1Jlc29sdmVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNSZXNvbHZlZCk/IHZhbHVlLmlzUmVzb2x2ZWQoKSA6IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXNvbHZlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGhhdmUgYHZhbHVlYCdzIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIHJlcyA9IHZvdy5kZWZlcigpO1xuICAgICAgICByZXMucmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgIHJldHVybiByZXMucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgZnVsZmlsbGVkIHdpdGggdGhlIGZ1bGZpbGwvcmVqZWN0aW9uIHZhbHVlIG9mIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZ1bGZpbGwgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgICAgICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG5cbiAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2UuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgIHByb21pc2UgOlxuICAgICAgICAgICAgcHJvbWlzZS50aGVuKG51bGwsIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWFzb247XG4gICAgICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqIElmIGByZWFzb25gIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoIHRoZSBmdWxmaWxsL3JlamVjdGlvbiB2YWx1ZSBvZiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEludm9rZXMgdGhlIGdpdmVuIGZ1bmN0aW9uIGBmbmAgd2l0aCBhcmd1bWVudHMgYGFyZ3NgXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBwcm9taXNlMSA9IHZvdy5pbnZva2UoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgKiAgICAgfSwgJ29rJyksXG4gICAgICogICAgIHByb21pc2UyID0gdm93Lmludm9rZShmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgIHRocm93IEVycm9yKCk7XG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogcHJvbWlzZTEuaXNGdWxmaWxsZWQoKTsgLy8gdHJ1ZVxuICAgICAqIHByb21pc2UxLnZhbHVlT2YoKTsgLy8gJ29rJ1xuICAgICAqIHByb21pc2UyLmlzUmVqZWN0ZWQoKTsgLy8gdHJ1ZVxuICAgICAqIHByb21pc2UyLnZhbHVlT2YoKTsgLy8gaW5zdGFuY2Ugb2YgRXJyb3JcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpbnZva2UgOiBmdW5jdGlvbihmbiwgYXJncykge1xuICAgICAgICB2YXIgbGVuID0gTWF0aC5tYXgoYXJndW1lbnRzLmxlbmd0aCAtIDEsIDApLFxuICAgICAgICAgICAgY2FsbEFyZ3M7XG4gICAgICAgIGlmKGxlbikgeyAvLyBvcHRpbWl6YXRpb24gZm9yIFY4XG4gICAgICAgICAgICBjYWxsQXJncyA9IEFycmF5KGxlbik7XG4gICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2FsbEFyZ3NbaSsrXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gdm93LnJlc29sdmUoY2FsbEFyZ3M/XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkoZ2xvYmFsLCBjYWxsQXJncykgOlxuICAgICAgICAgICAgICAgIGZuLmNhbGwoZ2xvYmFsKSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgcmV0dXJuIHZvdy5yZWplY3QoZSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogd2l0aCBhcnJheTpcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpLCAzXSlcbiAgICAgKiAgICAgLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgICAvLyB2YWx1ZSBpcyBcIlsxLCAyLCAzXVwiIGhlcmVcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgyKTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogd2l0aCBvYmplY3Q6XG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbCh7IHAxIDogZGVmZXIxLnByb21pc2UoKSwgcDIgOiBkZWZlcjIucHJvbWlzZSgpLCBwMyA6IDMgfSlcbiAgICAgKiAgICAgLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgICAgICAvLyB2YWx1ZSBpcyBcInsgcDEgOiAxLCBwMiA6IDIsIHAzIDogMyB9XCIgaGVyZVxuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKDIpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGgsXG4gICAgICAgICAgICByZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gbGVuO1xuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbHVlLCBpZHgpIHtcbiAgICAgICAgICAgICAgICByZXNba2V5c1tpZHhdXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGlmKCEtLWkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZlci5yZWplY3QsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcixcbiAgICAgICAgICAgIGtleXMpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbFJlc29sdmVkKFtkZWZlcjEucHJvbWlzZSgpLCBkZWZlcjIucHJvbWlzZSgpXSkuc3ByZWFkKGZ1bmN0aW9uKHByb21pc2UxLCBwcm9taXNlMikge1xuICAgICAqICAgICBwcm9taXNlMS5pc1JlamVjdGVkKCk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqICAgICBwcm9taXNlMS52YWx1ZU9mKCk7IC8vIHJldHVybnMgXCInZXJyb3InXCJcbiAgICAgKiAgICAgcHJvbWlzZTIuaXNGdWxmaWxsZWQoKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogICAgIHByb21pc2UyLnZhbHVlT2YoKTsgLy8gcmV0dXJucyBcIidvaydcIlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlamVjdCgnZXJyb3InKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgnb2snKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBhbGxSZXNvbHZlZCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgaSA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKCFpKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG9uUmVzb2x2ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAtLWkgfHwgZGVmZXIucmVzb2x2ZShpdGVyYWJsZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgb25SZXNvbHZlZCxcbiAgICAgICAgICAgIG9uUmVzb2x2ZWQsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcixcbiAgICAgICAgICAgIGtleXMpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIGFsbFBhdGllbnRseSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYWxsUmVzb2x2ZWQoaXRlcmFibGUpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgaXNQcm9taXNlc0FycmF5ID0gaXNBcnJheShpdGVyYWJsZSksXG4gICAgICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgICAgIGdldE9iamVjdEtleXMoaXRlcmFibGUpLFxuICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMsIGZ1bGZpbGxlZFByb21pc2VzLFxuICAgICAgICAgICAgICAgIGxlbiA9IGtleXMubGVuZ3RoLCBpID0gMCwga2V5LCBwcm9taXNlO1xuXG4gICAgICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGtleSA9IGtleXNbaSsrXTtcbiAgICAgICAgICAgICAgICBwcm9taXNlID0gaXRlcmFibGVba2V5XTtcbiAgICAgICAgICAgICAgICBpZih2b3cuaXNSZWplY3RlZChwcm9taXNlKSkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzIHx8IChyZWplY3RlZFByb21pc2VzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9KTtcbiAgICAgICAgICAgICAgICAgICAgaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcy5wdXNoKHByb21pc2UudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzW2tleV0gPSBwcm9taXNlLnZhbHVlT2YoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZighcmVqZWN0ZWRQcm9taXNlcykge1xuICAgICAgICAgICAgICAgICAgICAoZnVsZmlsbGVkUHJvbWlzZXMgfHwgKGZ1bGZpbGxlZFByb21pc2VzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9KSlba2V5XSA9IHZvdy52YWx1ZU9mKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYocmVqZWN0ZWRQcm9taXNlcykge1xuICAgICAgICAgICAgICAgIHRocm93IHJlamVjdGVkUHJvbWlzZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmdWxmaWxsZWRQcm9taXNlcztcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIGlmIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBpcyBmdWxmaWxsZWQuXG4gICAgICogSWYgYWxsIG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldCByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCAod2l0aCB0aGUgcmVhc29uIG9mIHRoZSBmaXJzdCByZWplY3RlZCBpdGVtKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFueSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChFcnJvcigpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSA9IDAsIHJlYXNvbjtcbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlLFxuICAgICAgICAgICAgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGkgfHwgKHJlYXNvbiA9IGUpO1xuICAgICAgICAgICAgICAgICsraSA9PT0gbGVuICYmIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IHdoZW4gYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGlzIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFueVJlc29sdmVkIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KEVycm9yKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSxcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5kZWxheWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkZWxheSA6IGZ1bmN0aW9uKHZhbHVlLCBkZWxheSkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpLmRlbGF5KGRlbGF5KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudGltZW91dGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHRpbWVvdXQgOiBmdW5jdGlvbih2YWx1ZSwgdGltZW91dCkge1xuICAgICAgICByZXR1cm4gdm93LnJlc29sdmUodmFsdWUpLnRpbWVvdXQodGltZW91dCk7XG4gICAgfSxcblxuICAgIF9mb3JFYWNoIDogZnVuY3Rpb24ocHJvbWlzZXMsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgsIGtleXMpIHtcbiAgICAgICAgdmFyIGxlbiA9IGtleXM/IGtleXMubGVuZ3RoIDogcHJvbWlzZXMubGVuZ3RoLFxuICAgICAgICAgICAgaSA9IDA7XG5cbiAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgdm93LndoZW4oXG4gICAgICAgICAgICAgICAgcHJvbWlzZXNba2V5cz8ga2V5c1tpXSA6IGldLFxuICAgICAgICAgICAgICAgIHdyYXBPbkZ1bGZpbGxlZChvbkZ1bGZpbGxlZCwgaSksXG4gICAgICAgICAgICAgICAgb25SZWplY3RlZCxcbiAgICAgICAgICAgICAgICBvblByb2dyZXNzLFxuICAgICAgICAgICAgICAgIGN0eCk7XG4gICAgICAgICAgICArK2k7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgVGltZWRPdXRFcnJvciA6IGRlZmluZUN1c3RvbUVycm9yVHlwZSgnVGltZWRPdXQnKVxufTtcblxudmFyIGRlZmluZUFzR2xvYmFsID0gdHJ1ZTtcbmlmKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHZvdztcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5pZih0eXBlb2YgbW9kdWxlcyA9PT0gJ29iamVjdCcgJiYgaXNGdW5jdGlvbihtb2R1bGVzLmRlZmluZSkpIHtcbiAgICBtb2R1bGVzLmRlZmluZSgndm93JywgZnVuY3Rpb24ocHJvdmlkZSkge1xuICAgICAgICBwcm92aWRlKHZvdyk7XG4gICAgfSk7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmluZShmdW5jdGlvbihyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSB2b3c7XG4gICAgfSk7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuZGVmaW5lQXNHbG9iYWwgJiYgKGdsb2JhbC52b3cgPSB2b3cpO1xuXG59KSh0aGlzKTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpbycpO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL3Byb21pc2UnKTtcbnZhciBEZWZlcnJlZCA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi9saWIvZGF0YS9tZXJnZScpO1xudmFyIHJlamVjdCA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL3JlamVjdCcpO1xuXG52YXIgQXVkaW9FcnJvciA9IHJlcXVpcmUoJy4vZXJyb3IvYXVkaW8tZXJyb3InKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4vYXVkaW8tc3RhdGljJyk7XG5cbnZhciBwbGF5ZXJJZCA9IDE7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQndCw0YHRgtGA0L7QudC60LAg0LTQvtGB0YLRg9C/0L3Ri9GFINGC0LjQv9C+0LIg0YDQtdCw0LvQuNC30LDRhtC40Lkg0Lgg0LjRhSDQv9GA0LjQvtGA0LjRgtC10YLQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC40L3RgtC10YDRhNC10LnRgSDQtNC70Y8g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPINC90L7QstGL0YUg0YLQuNC/0L7QslxudmFyIGF1ZGlvVHlwZXMgPSB7XG4gICAgaHRtbDU6IHJlcXVpcmUoJy4vaHRtbDUvYXVkaW8taHRtbDUnKSxcbiAgICBmbGFzaDogcmVxdWlyZSgnLi9mbGFzaC9hdWRpby1mbGFzaCcpXG59O1xuXG52YXIgZGV0ZWN0U3RyaW5nID0gXCJAXCIgKyBkZXRlY3QucGxhdGZvcm0udmVyc2lvbiArXG4gICAgXCIgXCIgKyBkZXRlY3QucGxhdGZvcm0ub3MgK1xuICAgIFwiOlwiICsgZGV0ZWN0LmJyb3dzZXIubmFtZSArXG4gICAgXCIvXCIgKyBkZXRlY3QuYnJvd3Nlci52ZXJzaW9uO1xuXG5hdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5ID0gMDtcbmF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHkgPSBjb25maWcuaHRtbDUuYmxhY2tsaXN0LnNvbWUoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gZGV0ZWN0U3RyaW5nLm1hdGNoKGl0ZW0pOyB9KSA/IC0xIDogMTtcblxuLy9JTkZPOiDQv9GA0Y/QvCDQsiDQvNC+0LzQtdC90YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0LLRgdC10LPQviDQvNC+0LTRg9C70Y8g0L3QtdC70YzQt9GPINC/0LjRgdCw0YLRjCDQsiDQu9C+0LMgLSDQvtC9INC/0YDQvtCz0LvQsNGC0YvQstCw0LXRgiDRgdC+0L7QsdGJ0LXQvdC40Y8sINGCLtC6LiDQtdGJ0LUg0L3QtdGCINCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L3QsNGB0YLRgNC+0LjRgtGMINC70L7Qs9Cz0LXRgC5cbnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8oe1xuICAgICAgICBmbGFzaDoge1xuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdWRpb1R5cGVzLmZsYXNoLmF2YWlsYWJsZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiBhdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5XG4gICAgICAgIH0sXG4gICAgICAgIGh0bWw1OiB7XG4gICAgICAgICAgICBhdmFpbGFibGU6IGF1ZGlvVHlwZXMuaHRtbDUuYXZhaWxhYmxlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IGF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHksXG4gICAgICAgICAgICBhdWRpb0NvbnRleHQ6ICEhYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHRcbiAgICAgICAgfVxuICAgIH0sIFwiYXVkaW9UeXBlc1wiKTtcbn0sIDApO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgSlNET0M6INCy0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90YvQtSDQutC70LDRgdGB0YtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntC/0LjRgdCw0L3QuNC1INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0L/Qu9C10LXRgNCwLlxuICogQHR5cGVkZWYge09iamVjdH0gQXVkaW9+QXVkaW9UaW1lc1xuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBkdXJhdGlvbiDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LDRg9C00LjQvtGE0LDQudC70LAuXG4gKiBAcHJvcGVydHkge051bWJlcn0gbG9hZGVkINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LguXG4gKiBAcHJvcGVydHkge051bWJlcn0gcG9zaXRpb24g0J/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHBsYXllZCDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQzog0J7QsdGJ0LjQtSDRgdC+0LHRi9GC0LjRjyDQv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQGV2ZW50IEF1ZGlvLkVWRU5UX1BMQVlcbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAZXZlbnQgQXVkaW8uRVZFTlRfRU5ERURcbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LPRgNC+0LzQutC+0YHRgtC4LlxuICogQGV2ZW50IEF1ZGlvLkVWRU5UX1ZPTFVNRVxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSDQndC+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4LlxuICovXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INCy0L7Qt9C90LjQutC90L7QstC10L3QuNGPINC+0YjQuNCx0LrQuCDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICogQGV2ZW50IEF1ZGlvLkVWRU5UX0NSQVNIRURcbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDRgdC80LXQvdGLINGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsC5cbiAqIEBldmVudCBBdWRpby5FVkVOVF9TVEFURVxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlINCd0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsC5cbiAqL1xuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQv9C10YDQtdC60LvRjtGH0LXQvdC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuCDQv9GA0LXQu9C+0LDQtNC10YDQsC5cbiAqIEBldmVudCBBdWRpby5FVkVOVF9TV0FQXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7RgdGC0LDQvdC+0LLQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBldmVudCBBdWRpby5FVkVOVF9TVE9QXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQv9Cw0YPQt9GLINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBldmVudCBBdWRpby5FVkVOVF9QQVVTRVxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPINC40LvQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LguXG4gKiBAZXZlbnQgQXVkaW8uRVZFTlRfUFJPR1JFU1NcbiAqIEBwYXJhbSB7QXVkaW9+QXVkaW9UaW1lc30gdGltZXMg0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQsNGD0LTQuNC+0YTQsNC50LvQsC5cbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQt9Cw0LPRgNGD0LfQutC4INCw0YPQtNC40L7RhNCw0LnQu9CwLlxuICogQGV2ZW50IEF1ZGlvLkVWRU5UX0xPQURJTkdcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0LDRg9C00LjQvtGE0LDQudC70LAuXG4gKiBAZXZlbnQgQXVkaW8uRVZFTlRfTE9BREVEXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLlxuICogQGV2ZW50IEF1ZGlvLkVWRU5UX0VSUk9SXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7RgdGC0LDQvdC+0LLQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBldmVudCBBdWRpby5QUkVMT0FERVJfRVZFTlQrRVZFTlRfU1RPUFxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4LlxuICogQGV2ZW50IEF1ZGlvLlBSRUxPQURFUl9FVkVOVCtFVkVOVF9QUk9HUkVTU1xuICogQHBhcmFtIHtBdWRpb35BdWRpb1RpbWVzfSB0aW1lcyDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQstGA0LXQvNC10L3QvdGL0YUg0LTQsNC90L3Ri9GFINCw0YPQtNC40L7RhNCw0LnQu9CwLlxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0LDRg9C00LjQvtGE0LDQudC70LAuXG4gKiBAZXZlbnQgQXVkaW8uUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURJTkdcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0LDRg9C00LjQvtGE0LDQudC70LAuXG4gKiBAZXZlbnQgQXVkaW8uUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURFRFxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBldmVudCBBdWRpby5QUkVMT0FERVJfRVZFTlQrRVZFTlRfRVJST1JcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0JDRg9C00LjQvtC/0LvQtdC10YAg0LTQu9GPINCx0YDQsNGD0LfQtdGA0LAuXG4gKiBAZXhwb3J0ZWQgeWEubXVzaWMuQXVkaW9cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ByZWZlcnJlZFR5cGU9XCJodG1sNVwiXSDQn9GA0LXQtNC/0L7Rh9C40YLQsNC10LzRi9C5INGC0LjQvyDQv9C70LXQtdGA0LAuINCc0L7QttC10YIg0L/RgNC40L3QuNC80LDRgtGMINC30L3QsNGH0LXQvdC40Y86IFwiaHRtbDVcIiwgXCJmbGFzaFwiINC40LvQuFxuICog0LvRjtCx0L7QtSDQu9C+0LbQvdC+0LUg0LfQvdCw0YfQtdC90LjQtSAoZmFsc2UsIG51bGwsIHVuZGVmaW5lZCwgMCwgXCJcIikuINCV0YHQu9C4INCy0YvQsdGA0LDQvdC90YvQuSDRgtC40L8g0L/Qu9C10LXRgNCwINC+0LrQsNC20LXRgtGB0Y8g0L3QtdC00L7RgdGC0YPQv9C10L0sINCx0YPQtNC10YIg0LfQsNC/0YPRidC10L1cbiAqINC+0YHRgtCw0LLRiNC40LnRgdGPINGC0LjQvy4g0JXRgdC70Lgg0YPQutCw0LfQsNC90L4g0LvQvtC20L3QvtC1INC30L3QsNGH0LXQvdC40LUg0LvQuNCx0L4g0L/QsNGA0LDQvNC10YLRgCDQvdC1INC/0LXRgNC10LTQsNC9LCDRgtC+IEFQSSDQsNCy0YLQvtC80LDRgtC40YfQtdGB0LrQuCDQstGL0LHQtdGA0LXRgiDQv9C+0LTQtNC10YDQttC40LLQsNC10LzRi9C5INGC0LjQvyDQv9C70LXQtdGA0LAuXG4gKiDQldGB0LvQuCDQsdGA0LDRg9C30LXRgCDQv9C+0LTQtNC10YDQttC40LLQsNC10YIg0L7QsdC1INGC0LXRhdC90L7Qu9C+0LPQuNC4LCDRgtC+INC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOIFlhbmRleEF1ZGlvINGB0L7Qt9C00LDQtdGCINCw0YPQtNC40L7Qv9C70LXQtdGAINC90LAg0L7RgdC90L7QstC1IEhUTUw1LlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW292ZXJsYXldIEhUTUwt0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPIEZsYXNoLdCw0L/Qv9C70LXRgtCwLlxuICpcbiAqIEBleHRlbmRzIEV2ZW50c1xuICpcbiAqIEBmaXJlcyBBdWRpby5FVkVOVF9QTEFZXG4gKiBAZmlyZXMgQXVkaW8uRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBBdWRpby5FVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyBBdWRpby5FVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgQXVkaW8uRVZFTlRfU1RBVEVcbiAqIEBmaXJlcyBBdWRpby5FVkVOVF9TV0FQXG4gKlxuICogQGZpcmVzIEF1ZGlvLkVWRU5UX1NUT1BcbiAqIEBmaXJlcyBBdWRpby5FVkVOVF9QQVVTRVxuICogQGZpcmVzIEF1ZGlvLkVWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgQXVkaW8uRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIEF1ZGlvLkVWRU5UX0xPQURFRFxuICogQGZpcmVzIEF1ZGlvLkVWRU5UX0VSUk9SXG4gKlxuICogQGZpcmVzIEF1ZGlvLlBSRUxPQURFUl9FVkVOVCtFVkVOVF9TVE9QXG4gKiBAZmlyZXMgQXVkaW8uUFJFTE9BREVSX0VWRU5UK0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgQXVkaW8uUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBBdWRpby5QUkVMT0FERVJfRVZFTlQrRVZFTlRfTE9BREVEXG4gKiBAZmlyZXMgQXVkaW8uUFJFTE9BREVSX0VWRU5UK0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBBdWRpbyA9IGZ1bmN0aW9uKHByZWZlcnJlZFR5cGUsIG92ZXJsYXkpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVmZXJyZWRUeXBlID0gcHJlZmVycmVkVHlwZTtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuc3RhdGUgPSBBdWRpby5TVEFURV9JTklUO1xuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX3BsYXlJZCA9IG51bGw7XG5cbiAgICB0aGlzLl9pbml0SW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgdGhpcy5fd2hlblJlYWR5ID0gbmV3IERlZmVycmVkKCk7XG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLl93aGVuUmVhZHkucHJvbWlzZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX2luaXRJblByb2dyZXNzID0gZmFsc2U7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiaW1wbGVtZW50YXRpb24gZm91bmRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3B1bGF0ZUV2ZW50cyhldmVudCwgb2Zmc2V0LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKCFvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW8uRVZFTlRfUExBWTpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvLlNUQVRFX1BMQVlJTkcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpby5FVkVOVF9FTkRFRDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpby5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvLkVWRU5UX1NUT1A6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW8uRVZFTlRfRVJST1I6XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIm9uRW5kZWRcIiwgZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW8uU1RBVEVfSURMRSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvLkVWRU5UX1BBVVNFOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW8uU1RBVEVfUEFVU0VEKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW8uRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvLlNUQVRFX0NSQVNIRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvLlNUQVRFX0lETEUpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICB0aGlzLl9pbml0SW5Qcm9ncmVzcyA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTiwgZSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW8uU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgIHRocm93IGU7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuX2luaXQoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvKTtcbm1lcmdlKEF1ZGlvLCBBdWRpb1N0YXRpYywgdHJ1ZSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQodGC0LDRgtC40LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQtNC+0YHRgtGD0L/QvdGL0YUg0L/Qu9C10LXRgNC+0LJcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAc3RhdGljXG4gKi9cbkF1ZGlvLmluZm8gPSB7XG4gICAgaHRtbDU6IGF1ZGlvVHlwZXMuaHRtbDUuYXZhaWxhYmxlLFxuICAgIGZsYXNoOiBhdWRpb1R5cGVzLmZsYXNoLmF2YWlsYWJsZVxufTtcblxuLyoqXG4gKiDQmtC+0L3RgtC10LrRgdGCINC00LvRjyBXZWIgQXVkaW8gQVBJLlxuICogQHR5cGUge0F1ZGlvQ29udGV4dH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW8uYXVkaW9Db250ZXh0ID0gYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHQ7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRj1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LAuXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RhdGUg0J3QvtCy0YvQuSDRgdGC0LDRgtGD0YEuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpby5wcm90b3R5cGUuX3NldFN0YXRlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldFN0YXRlXCIsIHN0YXRlKTtcblxuICAgIGlmIChzdGF0ZSA9PT0gQXVkaW8uU1RBVEVfUEFVU0VEICYmIHRoaXMuc3RhdGUgIT09IEF1ZGlvLlNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBjaGFuZ2VkID0gdGhpcy5zdGF0ZSAhPT0gc3RhdGU7XG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJuZXdTdGF0ZVwiLCBzdGF0ZSk7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpby5FVkVOVF9TVEFURSwgc3RhdGUpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLlxuICogQHBhcmFtIHtpbnR9IFtyZXRyeT0wXSDQmtC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7Qui5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uKHJldHJ5KSB7XG4gICAgcmV0cnkgPSByZXRyeSB8fCAwO1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX2luaXRcIiwgcmV0cnkpO1xuXG4gICAgaWYgKCF0aGlzLl9pbml0SW5Qcm9ncmVzcykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHJldHJ5ID4gY29uZmlnLmF1ZGlvLnJldHJ5KSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OKTtcbiAgICAgICAgdGhpcy5fd2hlblJlYWR5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OKSk7XG4gICAgfVxuXG4gICAgdmFyIGluaXRTZXEgPSBbXG4gICAgICAgIGF1ZGlvVHlwZXMuaHRtbDUsXG4gICAgICAgIGF1ZGlvVHlwZXMuZmxhc2hcbiAgICBdLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICBpZiAoYS5hdmFpbGFibGUgIT09IGIuYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICByZXR1cm4gYS5hdmFpbGFibGUgPyAtMSA6IDE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYS5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGIuQXVkaW9JbXBsZW1lbnRhdGlvbi50eXBlID09PSB0aGlzLnByZWZlcnJlZFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5O1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBpbml0KCkge1xuICAgICAgICB2YXIgdHlwZSA9IGluaXRTZXEuc2hpZnQoKTtcblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICAgIHNlbGYuX2luaXQocmV0cnkgKyAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuX2luaXRUeXBlKHR5cGUpLnRoZW4oc2VsZi5fd2hlblJlYWR5LnJlc29sdmUsIGluaXQpO1xuICAgIH1cblxuICAgIGluaXQoKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsCDRgSDRg9C60LDQt9Cw0L3QvdGL0Lwg0YLQuNC/0L7QvFxuICogQHBhcmFtIHt7dHlwZTogc3RyaW5nLCBBdWRpb0ltcGxlbWVudGF0aW9uOiBmdW5jdGlvbn19IHR5cGUgLSDQvtCx0YrQtdC60YIg0L7Qv9C40YHQsNC90LjRjyDRgtC40L/QsCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW8ucHJvdG90eXBlLl9pbml0VHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0VHlwZVwiLCB0eXBlKTtcblxuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHRyeSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotC10LrRg9GJ0LDRjyDRgNC10LDQu9C40LfQsNGG0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7SUF1ZGlvSW1wbGVtZW50YXRpb258bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24gPSBuZXcgdHlwZS5BdWRpb0ltcGxlbWVudGF0aW9uKHRoaXMub3ZlcmxheSk7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeSkge1xuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbi53aGVuUmVhZHkudGhlbihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdChlKTtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJfaW5pdFR5cGVFcnJvclwiLCB0eXBlLCBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LDQtdGC0YHRjyDQv9GA0Lgg0L7QtNC90L7QvCDQuNC3INGB0L/QuNGB0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtTdHJpbmd9IGFjdGlvbiAtINC90LDQt9Cy0LDQvdC40LUg0LTQtdC50YHRgtCy0LjRj1xuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gcmVzb2x2ZSAtINGB0L/QuNGB0L7QuiDQvtC20LjQtNCw0LXQvNGL0YUg0YHQvtCx0YvRgtC40Lkg0LTQu9GPINGA0LDQt9GA0LXRiNC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IHJlamVjdCAtINGB0L/QuNGB0L7QuiDQvtC20LjQtNCw0LXQvNGL0Lkg0YHQvtCx0YvRgtC40Lkg0LTQu9GPINC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDRgtCw0LrQttC1INGB0L7Qt9C00LDQtdGCIERlZmVycmVkINGB0LLQvtC50YHRgtCy0L4g0YEg0L3QsNC30LLQsNC90LjQtdC8IF93aGVuPEFjdGlvbj4sINC60L7RgtC+0YDQvtC1INC20LjQstC10YIg0LTQviDQvNC+0LzQtdC90YLQsCDRgNCw0LfRgNC10YjQtdC90LjRj1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW8ucHJvdG90eXBlLl93YWl0RXZlbnRzID0gZnVuY3Rpb24oYWN0aW9uLCByZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzW2FjdGlvbl0gPSBkZWZlcnJlZDtcblxuICAgIHZhciBjbGVhbnVwRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGRlZmVycmVkLnJlc29sdmUpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVqZWN0LmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHNlbGYub2ZmKGV2ZW50LCBkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICB9KTtcbiAgICAgICAgZGVsZXRlIHNlbGZbYWN0aW9uXTtcbiAgICB9O1xuXG4gICAgcmVzb2x2ZS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHNlbGYub24oZXZlbnQsIGRlZmVycmVkLnJlc29sdmUpO1xuICAgIH0pO1xuXG4gICAgcmVqZWN0LmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi5vbihldmVudCwgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gZGF0YSBpbnN0YW5jZW9mIEVycm9yID8gZGF0YSA6IG5ldyBBdWRpb0Vycm9yKGRhdGEgfHwgZXZlbnQpO1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZWZlcnJlZC5wcm9taXNlKCkudGhlbihjbGVhbnVwRXZlbnRzLCBjbGVhbnVwRXZlbnRzKTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC10L3QuNC1INGB0L7QsdGL0YLQuNC5INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LzQuCDRgdCy0L7QudGB0YLQstCw0LzQuC4g0J/QvtC00L/QuNGB0YvQstCw0LXRgtGB0Y8g0L3QsCDQstGB0LUg0YHQvtCx0YvRgtC40Y8g0LDRg9C00LjQvi3Qv9C70LXQtdGA0LAsXG4gKiDRgtGA0LjQs9Cz0LXRgNC40YIg0LjRgtC+0LPQvtCy0YvQtSDRgdC+0LHRi9GC0LjRjywg0YDQsNC30LTQtdC70Y/RjyDQuNGFINC/0L4g0YLQuNC/0YMg0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQu9C+0LDQtNC10YAsINC00L7Qv9C+0LvQvdGP0LXRgiDRgdC+0LHRi9GC0LjRjyDQtNCw0L3QvdGL0LzQuC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0ge2ludH0gb2Zmc2V0IC0g0LjRgdGC0L7Rh9C90LjQuiDRgdC+0LHRi9GC0LjRjy4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgC4gMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LTQsNC90L3Ri9C1INGB0L7QsdGL0YLQuNGPLlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW8ucHJvdG90eXBlLl9wb3B1bGF0ZUV2ZW50cyA9IGZ1bmN0aW9uKGV2ZW50LCBvZmZzZXQsIGRhdGEpIHtcbiAgICBpZiAoZXZlbnQgIT09IEF1ZGlvLkVWRU5UX1BST0dSRVNTKSB7XG4gICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfcG9wdWxhdGVFdmVudHNcIiwgZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfVxuXG4gICAgdmFyIG91dGVyRXZlbnQgPSAob2Zmc2V0ID8gQXVkaW8uUFJFTE9BREVSX0VWRU5UIDogXCJcIikgKyBldmVudDtcblxuICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgY2FzZSBBdWRpby5FVkVOVF9DUkFTSEVEOlxuICAgICAgICBjYXNlIEF1ZGlvLkVWRU5UX1NXQVA6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW8uRVZFTlRfRVJST1I6XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJlcnJvclwiLCBvdXRlckV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihvdXRlckV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvLkVWRU5UX1ZPTFVNRTpcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihldmVudCwgdGhpcy5nZXRWb2x1bWUoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpby5FVkVOVF9QUk9HUkVTUzpcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihvdXRlckV2ZW50LCB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb246IHRoaXMuZ2V0RHVyYXRpb24ob2Zmc2V0KSxcbiAgICAgICAgICAgICAgICBsb2FkZWQ6IHRoaXMuZ2V0TG9hZGVkKG9mZnNldCksXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG9mZnNldCA/IDAgOiB0aGlzLmdldFBvc2l0aW9uKCksXG4gICAgICAgICAgICAgICAgcGxheWVkOiBvZmZzZXQgPyAwIDogdGhpcy5nZXRQbGF5ZWQoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihvdXRlckV2ZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YnQuNC1INGE0YPQvdC60YbQuNC4INGD0L/RgNCw0LLQu9C10L3QuNGPINC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qXG4gSU5GTzog0LTQsNC90L3Ri9C5INC80LXRgtC+0LQg0LHRi9C70L4g0YDQtdGI0LXQvdC+INC+0YHRgtCw0LLQuNGC0YwsINGCLtC6LiDRjdGC0L4g0YPQtNC+0LHQvdC10LUg0YfQtdC8INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCDQvtCx0LXRidCw0L3QuNC1IC0g0LXRgdGC0Ywg0LLQvtC30LzQvtC20L3QvtGB0YLRjCDQsiDQvdCw0YfQsNC70LVcbiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0LvRg9GH0LjRgtGMINGB0YDQsNC30YMg0YHRgdGL0LvQutGDINC90LAg0Y3QutC30LXQvNC/0LvRj9GAINC/0LvQtdC10YDQsCDQuCDQvtCx0LLQtdGI0LDRgtGMINC10LPQviDQvtCx0YDQsNCx0L7RgtGH0LjQutCw0LzQuCDRgdC+0LHRi9GC0LjQuS4g0J/Qu9GO0YEg0Log0YLQvtC80YMg0L/RgNC4XG4g0YLQsNC60L7QvCDQv9C+0LTRhdC+0LTQtSDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y4g0LTQtdC70LDRgtGMINC/0YDQvtGJ0LUgLSDQv9GA0Lgg0L3QtdC5INC90LUg0L/RgNC40LTQtdGC0YHRjyDQv9C10YDQtdC90LDQt9C90LDRh9Cw0YLRjCDQvtCx0YDQsNCx0L7RgtGH0LjQutC4INC4INC+0LHQvdC+0LLQu9GP0YLRjCDQstC10LfQtNC1INGB0YHRi9C70LrRg1xuINC90LAg0YLQtdC60YPRidC40Lkg0Y3QutC30LXQvNC/0LvRj9GAINC/0LvQtdC10YDQsC5cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0YDQsNC30YDQtdGI0LDRjtGJ0LXQtdGB0Y8g0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5BdWRpby5wcm90b3R5cGUuaW5pdFByb21pc2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVhZHk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsC5cbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGC0LXQutGD0YnQuNC5INGC0LjQvyDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9XG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5nZXRUeXBlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0LXQutGD0YnQuNC5INGC0YDQtdC6LlxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0g0JHRgNCw0YLRjCDQsNGD0LTQuNC+LdGE0LDQudC7INC40Lcg0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuNC70Lgg0LjQtyDQv9GA0LXQu9C+0LDQtNC10YDQsC4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0U3JjKG9mZnNldCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC10LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMg0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LouXG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LDRg9C00LjQvi3RhNCw0LnQu9CwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPIEZsYXNoLdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0LDRg9C00LjQvi3RhNCw0LnQuyDQs9GA0YPQt9C40YLRgdGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQvtC/0YDQtdC00LXQu9GP0LXRgtGB0Y8g0YEg0L/QvtCz0YDQtdGI0L3QvtGB0YLRjNGOLlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVwiLCBsb2dnZXIuX3Nob3dVcmwoc3JjKSwgZHVyYXRpb24pO1xuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpby5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpby5TVEFURV9QQVVTRUQpO1xuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGxheShzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC30LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX0g0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LjRgtGB0Y8sINC60L7Qs9C00LAg0YLRgNC10Log0LHRg9C00LXRgiDQv9C10YDQtdC30LDQv9GD0YnQtdC9LlxuICovXG5BdWRpby5wcm90b3R5cGUucmVzdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5nZXREdXJhdGlvbigpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuICAgIHRoaXMuc2V0UG9zaXRpb24oMCk7XG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgcmV0dXJuIHRoaXMucmVzdW1lKCk7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LrQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSDQkNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgC4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgC4gMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQuNGC0YHRjywg0LrQvtCz0LTQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0LHRg9C00LXRgiDQvtGB0YLQsNC90L7QstC70LXQvdC+LlxuICovXG5BdWRpby5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RvcFwiLCBvZmZzZXQpO1xuXG4gICAgaWYgKG9mZnNldCAhPT0gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zdG9wKG9mZnNldCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwic3RvcFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICB0aGlzLl93aGVuUGF1c2UucmVqZWN0KFwic3RvcFwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZTtcbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5TdG9wLnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuU3RvcFwiLCBbQXVkaW8uRVZFTlRfU1RPUF0sIFtcbiAgICAgICAgICAgIEF1ZGlvLkVWRU5UX1BMQVksXG4gICAgICAgICAgICBBdWRpby5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5zdG9wKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0J/QvtGB0YLQsNCy0LjRgtGMINC/0LvQtdC10YAg0L3QsCDQv9Cw0YPQt9GDLlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9INC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1ICDRgNCw0LfRgNC10YjQuNGC0YHRjywg0LrQvtCz0LTQsCDQv9C70LXQtdGAINCx0YPQtNC10YIg0L/QvtGB0YLQsNCy0LvQtdC9INC90LAg0L/QsNGD0LfRgy5cbiAqL1xuQXVkaW8ucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwYXVzZVwiKTtcblxuICAgIGlmICh0aGlzLnN0YXRlICE9PSBBdWRpby5TVEFURV9QTEFZSU5HKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwYXVzZVwiKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGF1c2UucHJvbWlzZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QYXVzZVwiLCBbQXVkaW8uRVZFTlRfUEFVU0VdLCBbXG4gICAgICAgICAgICBBdWRpby5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW8uRVZFTlRfUExBWSxcbiAgICAgICAgICAgIEF1ZGlvLkVWRU5UX0VSUk9SLFxuICAgICAgICAgICAgQXVkaW8uRVZFTlRfQ1JBU0hFRFxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnBhdXNlKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0KHQvdGP0YLQuNC1INC/0LvQtdC10YDQsCDRgSDQv9Cw0YPQt9GLLlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9INC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNC40YLRgdGPLCDQutC+0LPQtNCwINC90LDRh9C90LXRgtGB0Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1LlxuICovXG5BdWRpby5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQXVkaW8uU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzLnN0YXRlID09PSBBdWRpby5TVEFURV9JRExFIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvLlNUQVRFX1BBVVNFRFxuICAgICAgICB8fCB0aGlzLnN0YXRlID09PSBBdWRpby5TVEFURV9QTEFZSU5HKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJyZXN1bWVcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGxheS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvLkVWRU5UX1BMQVldLCBbXG4gICAgICAgICAgICBBdWRpby5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW8uRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpby5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuXG4gICAgICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucmVzdW1lKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDQsNGD0LTQuNC+0YTQsNC50LvQsC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3JjXSDQodGB0YvQu9C60LAg0L3QsCDQsNGD0LTQuNC+0YTQsNC50LsgKNC00LvRjyDQv9GA0L7QstC10YDQutC4LCDRh9GC0L4g0LIg0L/RgNC10LvQvtCw0LTQtdGA0LUg0L3Rg9C20L3Ri9C5INGC0YDQtdC6KS5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQuNGC0YHRjywg0LrQvtCz0LTQsCDQvdCw0YfQvdC10YLRgdGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDQsNGD0LTQuNC+0YTQsNC50LvQsC5cbiAqL1xuQXVkaW8ucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgbG9nZ2VyLl9zaG93VXJsKHNyYykpO1xuXG4gICAgaWYgKCFzcmMpIHtcbiAgICAgICAgc3JjID0gdGhpcy5nZXRTcmMoMSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzUHJlbG9hZGVkKHNyYykpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkQmFkVHJhY2tcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICB0aGlzLl93aGVuU3RvcC5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW8uRVZFTlRfUExBWV0sIFtcbiAgICAgICAgQXVkaW8uRVZFTlRfU1RPUCxcbiAgICAgICAgQXVkaW8uRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvLkVWRU5UX0NSQVNIRURcbiAgICBdKTtcbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpby5TVEFURV9QQVVTRUQpO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXlQcmVsb2FkZWQoKTtcblxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEVycm9yXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LAg0LDRg9C00LjQvtGE0LDQudC70LAuXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINCw0YPQtNC40L7RhNCw0LnQu9CwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPIEZsYXNoLdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0LDRg9C00LjQvtGE0LDQudC7INCz0YDRg9C30LjRgtGB0Y9cbiAqINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQvtC/0YDQtdC00LXQu9GP0LXRgtGB0Y8g0YEg0L/QvtCz0YDQtdGI0L3QvtGB0YLRjNGOLlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9INC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNC40YLRgdGPLCDQutC+0LPQtNCwINC90LDRh9C90LXRgtGB0Y8g0L/RgNC10LTQt9Cw0LPRgNGD0LfQutCwINCw0YPQtNC40L7RhNCw0LnQu9CwLlxuICovXG5BdWRpby5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBpZiAoZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gXCJtc2llXCIgJiYgZGV0ZWN0LmJyb3dzZXIudmVyc2lvblswXSA9PSBcIjlcIikge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBsb2dnZXIuX3Nob3dVcmwoc3JjKSwgZHVyYXRpb24pO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QcmVsb2FkKSB7XG4gICAgICAgIHRoaXMuX3doZW5QcmVsb2FkLnJlamVjdChcInByZWxvYWRcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QcmVsb2FkXCIsIFtcbiAgICAgICAgQXVkaW8uUFJFTE9BREVSX0VWRU5UICsgQXVkaW8uRVZFTlRfTE9BRElORyxcbiAgICAgICAgQXVkaW8uRVZFTlRfU1dBUFxuICAgIF0sIFtcbiAgICAgICAgQXVkaW8uUFJFTE9BREVSX0VWRU5UICsgQXVkaW8uRVZFTlRfQ1JBU0hFRCxcbiAgICAgICAgQXVkaW8uUFJFTE9BREVSX0VWRU5UICsgQXVkaW8uRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvLkVWRU5UX1NUT1BcbiAgICBdKTtcblxuICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3doZW5QcmVsb2FkKSB7XG4gICAgICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QuYXBwbHkodGhpcy5fd2hlblByZWxvYWQsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLnN0b3AoMSk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnByZWxvYWQoc3JjLCBkdXJhdGlvbik7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INCw0YPQtNC40L7RhNCw0LnQuyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L0uXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUsINC10YHQu9C4INCw0YPQtNC40L7RhNCw0LnQuyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L0sIGZhbHNlIC0g0LjQvdCw0YfQtS5cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmlzUHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNQcmVsb2FkZWQoc3JjKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INCw0YPQtNC40L7RhNCw0LnQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y8uXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUsINC10YHQu9C4INCw0YPQtNC40L7RhNCw0LnQuyDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRjywgZmFsc2UgLSDQuNC90LDRh9C1LlxuICovXG5BdWRpby5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNQcmVsb2FkaW5nKHNyYywgMSk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KLQsNC50LzQuNC90LPQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKNCyINGB0LXQutGD0L3QtNCw0YUpLlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0UG9zaXRpb24oKSB8fCAwO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICjQsiDRgdC10LrRg9C90LTQsNGFKS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiDQndC+0LLQsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn0g0LjRgtC+0LPQvtCy0LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlID09IFwiZmxhc2hcIikge1xuICAgICAgICBwb3NpdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKHRoaXMuZ2V0TG9hZGVkKCkgLSAxLCBwb3NpdGlvbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXREdXJhdGlvbigpIC0gMSwgcG9zaXRpb24pKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgKz0gdGhpcy5nZXRQb3NpdGlvbigpIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuXG4gICAgcmV0dXJuIHBvc2l0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtC10LrRg9GJ0LXQs9C+INCw0YPQtNC40L4t0YTQsNC50LvQsCAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKiBAcGFyYW0ge0Jvb2xlYW58aW50fSBwcmVsb2FkZXIg0JDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ocHJlbG9hZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0RHVyYXRpb24ocHJlbG9hZGVyID8gMSA6IDApIHx8IDA7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCAo0LIg0YHQtdC60YPQvdC00LDRhSkuXG4gKiBAcGFyYW0ge0Jvb2xlYW58aW50fSBwcmVsb2FkZXIg0JDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldExvYWRlZChwcmVsb2FkZXIgPyAxIDogMCkgfHwgMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICjQsiDRgdC10LrRg9C90LTQsNGFKS5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5nZXRQbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5fcGxheWVkICs9IHBvc2l0aW9uIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHJldHVybiB0aGlzLl9wbGF5ZWQ7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LAuXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpby5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFZvbHVtZSgpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsC5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUg0J3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuC5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9INC40YLQvtCz0L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LguXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG5cbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0Vm9sdW1lKHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDQs9GA0L7QvNC60L7RgdGC0Ywg0YPQv9GA0LDQstC70Y/QtdGC0YHRjyDRg9GB0YLRgNC+0LnRgdGC0LLQvtC8LCDQsCDQvdC1INC/0YDQvtCz0YDQsNC80LzQvdC+LlxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUsINC10YHQu9C4INCz0YDQvtC80LrQvtGB0YLRjCDRg9C/0YDQsNCy0LvRj9C10YLRgdGPINGD0YHRgtGA0L7QudGB0YLQstC+0LwsIGZhbHNlIC0g0LjQvdCw0YfQtS5cbiAqL1xuQXVkaW8ucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzRGV2aWNlVm9sdW1lKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LjRgtGMINGA0LXQttC40LwgQ09SUyDQtNC70Y8g0L/QvtC70YPRh9C10L3QuNGPINCw0YPQtNC40L4t0YLRgNC10LrQvtCyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0JfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBLlxuICogQHJldHVybnMge2Jvb2xlYW59INGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LAuXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS50b2dnbGVDcm9zc0RvbWFpbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSAhPT0gXCJodG1sNVwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlQ3Jvc3NEb21haW5GYWlsZWRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24udG9nZ2xlQ3Jvc3NEb21haW4oc3RhdGUpO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKiDQktC90LjQvNCw0L3QuNC1ISEhINCf0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlLlxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSDQl9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YEuXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YFcbiAqL1xuQXVkaW8ucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSUZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24udG9nZ2xlV2ViQXVkaW9BUEkoc3RhdGUpO1xufTtcblxuLyoqXG4gKiDQkNGD0LTQuNC+LdC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgC5cbiAqIEB0eXBlZGVmIHtPYmplY3R9IEF1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yXG4gKlxuICogQHByb3BlcnR5IHtBdWRpb05vZGV9IGlucHV0INCd0L7QtNCwLCDQsiDQutC+0YLQvtGA0YPRjiDQv9C10YDQtdC90LDQv9GA0LDQstC70Y/QtdGC0YHRjyDQstGL0LLQvtC0INCw0YPQtNC40L4uXG4gKiBAcHJvcGVydHkge0F1ZGlvTm9kZX0gb3V0cHV0INCd0L7QtNCwLCDQuNC3INC60L7RgtC+0YDQvtC5INCy0YvQstC+0LQg0L/QvtC00LDQtdGC0YHRjyDQvdCwINGD0YHQuNC70LjRgtC10LvRjC5cbiAqL1xuXG4vKipcbiAqINCf0L7QtNC60LvRjtGH0LXQvdC40LUg0LDRg9C00LjQviDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsC4g0JLRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6INCw0YPQtNC40L7RjdC70LXQvNC10L3RgtGDLCDRgyDQutC+0YLQvtGA0L7Qs9C+INCy0YvRgdGC0LDQstC70LXQvdCwXG4gKiAxMDAlINCz0YDQvtC80LrQvtGB0YLRjC4g0JLRi9GF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0LogR2Fpbk5vZGUsINC60L7RgtC+0YDQsNGPINGA0LXQs9GD0LvQuNGA0YPQtdGCINC40YLQvtCz0L7QstGD0Y4g0LPRgNC+0LzQutC+0YHRgtGMLlxuICogQHBhcmFtIHtBdWRpb35BdWRpb1ByZXByb2Nlc3Nvcn0gcHJlcHJvY2Vzc29yINCf0YDQtdC/0YDQvtGG0LXRgdGB0L7RgC5cbiAqIEByZXR1cm5zIHtib29sZWFufSDRgdGC0LDRgtGD0YEg0YPRgdC/0LXRhdCwLlxuICovXG5BdWRpby5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRBdWRpb1ByZXByb2Nlc3NvcihwcmVwcm9jZXNzb3IpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCb0L7Qs9Cz0LjRgNC+0LLQsNC90LjQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCT0LXQvdC10YDQsNGG0LjRjyBwbGF5SWRcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5fZ2VuZXJhdGVQbGF5SWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wbGF5SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc2xpY2UoMik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YPQvdC40LrQsNC70YzQvdGL0Lkg0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLiDQodC+0LfQtNCw0ZHRgtGB0Y8g0LrQsNC20LTRi9C5INGA0LDQtyDQv9GA0Lgg0LfQsNC/0YPRgdC60LUg0L3QvtCy0L7Qs9C+INGC0YDQtdC60LAg0LjQu9C4INC/0LXRgNC10LfQsNC/0YPRgdC60LUg0YLQtdC60YPRidC10LPQvi5cbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5nZXRQbGF5SWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGxheUlkO1xufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvLnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgaW5kZXg6IHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi5uYW1lLFxuICAgICAgICBzcmM6IHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi5fbG9nZ2VyKCksXG4gICAgICAgIHR5cGU6IHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlXG4gICAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW87XG4iLCIvKipcbiAqIEBhbGlhcyBBdWRpb1xuICogQGlnbm9yZVxuICovXG52YXIgQXVkaW9TdGF0aWMgPSB7fTtcblxuLyoqXG4gKiDQndCw0YfQsNC70L4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPINGC0YDQtdC60LAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKiBAaWdub3JlXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BMQVkgPSBcInBsYXlcIjtcbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQutCwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqIEBpZ25vcmVcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RPUCA9IFwic3RvcFwiO1xuLyoqXG4gKiDQn9Cw0YPQt9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqIEBpZ25vcmVcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUEFVU0UgPSBcInBhdXNlXCI7XG4vKipcbiAqINCe0LHQvdC+0LLQu9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqIEBpZ25vcmVcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MgPSBcInByb2dyZXNzXCI7XG4vKipcbiAqINCd0LDRh9Cw0LvQsNGB0Ywg0LfQsNCz0YDRg9C30LrQsCDRgtGA0LXQutCwLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICogQGlnbm9yZVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9MT0FESU5HID0gXCJsb2FkaW5nXCI7XG4vKipcbiAqINCX0LDQs9GA0YPQt9C60LAg0YLRgNC10LrQsCDQt9Cw0LLQtdGA0YjQtdC90LAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKiBAaWdub3JlXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCA9IFwibG9hZGVkXCI7XG4vKipcbiAqINCY0LfQvNC10L3QtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LguXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKiBAaWdub3JlXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1ZPTFVNRSA9IFwidm9sdW1lY2hhbmdlXCI7XG5cbi8qKlxuICog0JLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LAg0LfQsNCy0LXRgNGI0LXQvdC+LlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICogQGlnbm9yZVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FTkRFRCA9IFwiZW5kZWRcIjtcbi8qKlxuICog0JLQvtC30L3QuNC60LvQsCDQvtGI0LjQsdC60LAg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqIEBpZ25vcmVcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqXG4gKiDQktC+0LfQvdC40LrQu9CwINC+0YjQuNCx0LrQsCDQv9GA0Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC4LlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICogQGlnbm9yZVxuICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcbi8qKlxuICog0JjQt9C80LXQvdC10L3QuNC1INGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsC5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqIEBpZ25vcmVcbiAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RBVEUgPSBcInN0YXRlXCI7XG4vKipcbiAqINCf0LXRgNC10LrQu9GO0YfQtdC90LjQtSDQvNC10LbQtNGDINGC0LXQutGD0YnQuNC8INC4INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90YvQvCDRgtGA0LXQutC+0LwuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKiBAaWdub3JlXG4gKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NXQVAgPSBcInN3YXBcIjtcbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LrQsC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINCyINC60LDRh9C10YHRgtCy0LUg0L/RgNC10YTQuNC60YHQsC5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9TdGF0aWMuUFJFTE9BREVSX0VWRU5UID0gXCJwcmVsb2FkZXI6XCI7XG4vKipcbiAqINCf0LvQtdC10YAg0L3QsNGF0L7QtNC40YLRgdGPINCyINGB0L7RgdGC0L7Rj9C90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfSU5JVCA9IFwiaW5pdFwiO1xuLyoqXG4gKiDQndC1INGD0LTQsNC70L7RgdGMINC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMINC/0LvQtdC10YAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKlxuICog0J/Qu9C10LXRgCDQs9C+0YLQvtCyINC4INC+0LbQuNC00LDQtdGCLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb1N0YXRpYy5TVEFURV9JRExFID0gXCJpZGxlXCI7XG4vKipcbiAqINCf0LvQtdC10YAg0L/RgNC+0LjQs9GA0YvQstCw0LXRgiDRgtGA0LXQui5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUExBWUlORyA9IFwicGxheWluZ1wiO1xuLyoqXG4gKiDQn9C70LXQtdGAINC/0L7RgdGC0LDQstC70LXQvSDQvdCwINC/0LDRg9C30YMuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvU3RhdGljLlNUQVRFX1BBVVNFRCA9IFwicGF1c2VkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9TdGF0aWM7XG4iLCIvKipcbiAqINCd0LDRgdGC0YDQvtC50LrQuCDQsdC40LHQu9C40L7RgtC10LrQuC5cbiAqIEBleHBvcnRlZCB5YS5tdXNpYy5BdWRpby5jb25maWdcbiAqIEBuYW1lc3BhY2VcbiAqL1xudmFyIGNvbmZpZyA9IHtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAg0J7QsdGJ0LjQtSDQvdCw0YHRgtGA0L7QudC60LhcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuC5cbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICovXG4gICAgYXVkaW86IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCa0L7Qu9C40YfQtdGB0YLQstC+INC/0L7Qv9GL0YLQvtC6INGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV0cnk6IDNcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICBGbGFzaC3Qv9C70LXQtdGAXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutC4INC/0L7QtNC60LvRjtGH0LXQvdC40Y8gRmxhc2gt0L/Qu9C10LXRgNCwLlxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBmbGFzaDoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0J/Rg9GC0Ywg0LogLnN3ZiDRhNCw0LnQu9GDINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGF0aDogXCJkaXN0XCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8gLnN3ZiDRhNCw0LnQu9CwINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgbmFtZTogXCJwbGF5ZXItMl8xLnN3ZlwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JzQuNC90LjQvNCw0LvRjNC90LDRjyDQstC10YDRgdC40Y8g0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB2ZXJzaW9uOiBcIjkuMC4yOFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICogSUQsINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0LLRi9GB0YLQsNCy0LvQtdC9INC00LvRjyDRjdC70LXQvNC10L3RgtCwINGBIEZsYXNoLdC/0LvQtdC10YDQvtC8XG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBwbGF5ZXJJRDogXCJZYW5kZXhBdWRpb0ZsYXNoUGxheWVyXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8g0YTRg9C90LrRhtC40Lgt0L7QsdGA0LDQsdC+0YLRh9C40LrQsCDRgdC+0LHRi9GC0LjQuSBGbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICogQGNvbnN0XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsYmFjazogXCJ5YS5tdXNpYy5BdWRpby5fZmxhc2hDYWxsYmFja1wiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGluaXRUaW1lb3V0OiAzMDAwLCAvLyAzIHNlY1xuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgbG9hZFRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0YHQu9C1INC60LvQuNC60LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGNsaWNrVGltZW91dDogMTAwMCxcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0L3RgtC10YDQstCw0Lsg0L/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IEZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgaGVhcnRCZWF0SW50ZXJ2YWw6IDEwMDBcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICBIVE1MNS3Qv9C70LXQtdGAXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6IEhUTUw1INC/0LvQtdC10YDQsC5cbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICovXG4gICAgaHRtbDU6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCh0L/QuNGB0L7QuiDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNC+0LIg0LTQu9GPINC60L7RgtC+0YDRi9GFINC70YPRh9GI0LUg0L3QtSDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgaHRtbDUg0L/Qu9C10LXRgC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC/0YDQuFxuICAgICAgICAgKiDQsNCy0YLQvi3QvtC/0YDQtdC00LXQu9C10L3QuNC4INGC0LjQv9CwINC/0LvQtdC10YDQsC4g0JjQtNC10L3RgtC40YTQuNC60LDRgtC+0YDRiyDRgdGA0LDQstC90LjQstCw0Y7RgtGB0Y8g0YHQviDRgdGC0YDQvtC60L7QuSDQv9C+0YHRgtGA0L7QtdC90L3QvtC5INC/0L4g0YjQsNCx0LvQvtC90YNcbiAgICAgICAgICogYEA8cGxhdGZvcm0udmVyc2lvbj4gPHBsYXRmb3JtLm9zPjo8YnJvd3Nlci5uYW1lPi88YnJvd3Nlci52ZXJzaW9uPmBcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgeyBBcnJheS48U3RyaW5nPiB9XG4gICAgICAgICAqL1xuICAgICAgICBibGFja2xpc3Q6IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiLCBcIjptc2llLzlcIl1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbmZpZztcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vbGliL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICogQGV4cG9ydGVkIHlhLm11c2ljLkF1ZGlvLkF1ZGlvRXJyb3JcbiAqIEBjbGFzc2Rlc2Mg0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LDRg9C00LjQvtC/0LvQu9C10LXRgNCwLlxuICogQGV4dGVuZHMgRXJyb3JcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlINCi0LXQutGB0YIg0L7RiNC40LHQutC4LlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQXVkaW9FcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG59O1xuQXVkaW9FcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIkF1ZGlvRXJyb3JcIik7XG5cbi8qKlxuICog0J3QtSDQvdCw0LnQtNC10L3QsCDRgNC10LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAg0LjQu9C4INCy0L7Qt9C90LjQutC70LAg0L7RiNC40LHQutCwINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQstGB0LXRhSDQtNC+0YHRgtGD0L/QvdGL0YUg0YDQtdCw0LvQuNC30LDRhtC40LkuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04gPSBcImNhbm5vdCBmaW5kIHN1aXRhYmxlIGltcGxlbWVudGF0aW9uXCI7XG4vKipcbiAqINCQ0YPQtNC40L7RhNCw0LnQuyDQvdC1INCx0YvQuyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L0g0LjQu9C4INCy0L4g0LLRgNC10LzRjyDQt9Cw0LPRgNGD0LfQutC4INC/0YDQvtC40LfQvtGI0LvQsCDQvtGI0LjQsdC60LAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCA9IFwidHJhY2sgaXMgbm90IHByZWxvYWRlZFwiO1xuLyoqXG4gKiDQlNC10LnRgdGC0LLQuNC1INC90LXQtNC+0YHRgtGD0L/QvdC+INC40Lcg0YLQtdC60YPRidC10LPQviDRgdC+0YHRgtC+0Y/QvdC40Y8uXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuQkFEX1NUQVRFID0gXCJhY3Rpb24gaXMgbm90IHBlcm1pdGVkIGZyb20gY3VycmVudCBzdGF0ZVwiO1xuXG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0LHRi9C7INC30LDQsdC70L7QutC40YDQvtCy0LDQvS5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSID0gXCJmbGFzaCBpcyByZWplY3RlZCBieSBmbGFzaCBibG9ja2VyIHBsdWdpblwiO1xuLyoqXG4gKiDQktC+0LfQvdC40LrQu9CwINC+0YjQuNCx0LrQsCDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LggRmxhc2gt0L/Qu9C10LXRgNCwINC/0L4g0L3QtdC40LfQstC10YHRgtC90YvQvCDQv9GA0LjRh9C40L3QsNC8LlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICog0JLQvtC30L3QuNC60LvQsCDQvtGI0LjQsdC60LAg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4IEZsYXNoLdC/0LvQtdC10YDQsCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsC5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQgPSBcImZsYXNoIGluaXQgdGltZWQgb3V0XCI7XG4vKipcbiAqINCS0L3Rg9GC0YDQtdC90L3Rj9GPINC+0YjQuNCx0LrQsCBGbGFzaC3Qv9C70LXQtdGA0LAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IgPSBcImZsYXNoIGludGVybmFsIGVycm9yXCI7XG4vKipcbiAqINCf0L7Qv9GL0YLQutCwINCy0YvQt9Cy0LDRgtGMINC90LXQtNC+0YHRgtGD0L/QvdGL0Lkg0Y3QutC30LXQvNC70Y/RgCBGbGFzaC3Qv9C70LXQtdGA0LAuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YsuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfTk9UX1JFU1BPTkRJTkcgPSBcImZsYXNoIHBsYXllciBkb2Vzbid0IHJlc3BvbnNlXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9FcnJvcjtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG52YXIgQXVkaW9FcnJvciA9IHJlcXVpcmUoJy4vYXVkaW8tZXJyb3InKTtcbnZhciBQbGF5YmFja0Vycm9yID0gcmVxdWlyZSgnLi9wbGF5YmFjay1lcnJvcicpO1xuXG55YS5tdXNpYy5BdWRpby5BdWRpb0Vycm9yID0gQXVkaW9FcnJvcjtcbnlhLm11c2ljLkF1ZGlvLlBsYXliYWNrRXJyb3IgPSBQbGF5YmFja0Vycm9yO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi9saWIvY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiBAZXhwb3J0ZWQgeWEubXVzaWMuQXVkaW8uUGxheWJhY2tFcnJvclxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBINC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8uXG4gKiBAZXh0ZW5kcyBFcnJvclxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2Ug0KLQtdC60YHRgiDQvtGI0LjQsdC60LguXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUGxheWJhY2tFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHNyYykge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xufTtcblxuUGxheWJhY2tFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIlBsYXliYWNrRXJyb3JcIik7XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINGB0L7QtdC00LjQvdC10L3QvdC40Y8uXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVEID0gXCJDb25uZWN0aW9uIGFib3J0ZWRcIjtcbi8qKlxuICog0KHQtdGC0LXQstCw0Y8g0L7RiNC40LHQutCwLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLk5FVFdPUktfRVJST1IgPSBcIk5ldHdvcmsgZXJyb3JcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC00LXQutC+0LTQuNGA0L7QstCw0L3QuNGPINCw0YPQtNC40L4uXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuREVDT0RFX0VSUk9SID0gXCJEZWNvZGUgZXJyb3JcIjtcbi8qKlxuICog0J3QtdC00L7RgdGC0YPQv9C90YvQuSDQuNGB0YLQvtGH0L3QuNC6LlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkJBRF9EQVRBID0gXCJCYWQgZGF0YVwiO1xuXG4vKipcbiAqINCd0LUg0LfQsNC/0YPRgdC60LDQtdGC0YHRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuRE9OVF9TVEFSVCA9IFwiUGxheWJhY2sgc3RhcnQgZXJyb3JcIjtcblxuLyoqXG4gKiDQotCw0LHQu9C40YbQsCDRgdC+0L7RgtCy0LXRgtGB0YLQstC40Y8g0LrQvtC00L7QsiDQvtGI0LjQsdC+0LogSFRNTDUg0L/Qu9C10LXRgNCwLlxuICpcbiAqIEBjb25zdFxuICogQHR5cGUge09iamVjdH1cbiAqL1xuUGxheWJhY2tFcnJvci5odG1sNSA9IHtcbiAgICAxOiBQbGF5YmFja0Vycm9yLkNPTk5FQ1RJT05fQUJPUlRFRCxcbiAgICAyOiBQbGF5YmFja0Vycm9yLk5FVFdPUktfRVJST1IsXG4gICAgMzogUGxheWJhY2tFcnJvci5ERUNPREVfRVJST1IsXG4gICAgNDogUGxheWJhY2tFcnJvci5CQURfREFUQVxufTtcblxuLy9UT0RPOiDRgdC00LXQu9Cw0YLRjCDQutC70LDRgdGB0LjRhNC40LrQsNGC0L7RgCDQvtGI0LjQsdC+0LogZmxhc2gt0L/Qu9C10LXRgNCwXG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWJhY2tFcnJvcjtcbiIsImlmICh0eXBlb2YgREVWID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgd2luZG93LkRFViA9IHRydWU7XG59XG5cbmlmICh0eXBlb2Ygd2luZG93LnlhID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgd2luZG93LnlhID0ge307XG59XG5cbnZhciB5YSA9IHdpbmRvdy55YTtcblxuaWYgKHR5cGVvZiB5YS5tdXNpYyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHlhLm11c2ljID0ge307XG59XG5cbmlmICh0eXBlb2YgeWEubXVzaWMuQXVkaW8gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB5YS5tdXNpYy5BdWRpbyA9IHt9O1xufVxuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBBdWRpb1BsYXllciA9IHJlcXVpcmUoJy4vYXVkaW8tcGxheWVyJyk7XG52YXIgUHJveHkgPSByZXF1aXJlKCcuL2xpYi9jbGFzcy9wcm94eScpO1xuXG55YS5tdXNpYy5BdWRpbyA9IFByb3h5LmNyZWF0ZUNsYXNzKEF1ZGlvUGxheWVyKTtcbnlhLm11c2ljLkF1ZGlvLmNvbmZpZyA9IGNvbmZpZztcblxucmVxdWlyZSgnLi9saWIvZXhwb3J0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0geWEubXVzaWMuQXVkaW87XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvRmxhc2gnKTtcbnZhciBGbGFzaE1hbmFnZXIgPSByZXF1aXJlKCcuL2ZsYXNoLW1hbmFnZXInKTtcbnZhciBGbGFzaEludGVyZmFjZSA9IHJlcXVpcmUoJy4vZmxhc2gtaW50ZXJmYWNlJyk7XG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG52YXIgZmxhc2hNYW5hZ2VyO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQsCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG52YXIgZmxhc2hWZXJzaW9uID0gc3dmb2JqZWN0LmdldEZsYXNoUGxheWVyVmVyc2lvbigpO1xuZGV0ZWN0LmZsYXNoVmVyc2lvbiA9IGZsYXNoVmVyc2lvbi5tYWpvciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLm1pbm9yICsgXCIuXCIgKyBmbGFzaFZlcnNpb24ucmVsZWFzZTtcblxuZXhwb3J0cy5hdmFpbGFibGUgPSBzd2ZvYmplY3QuaGFzRmxhc2hQbGF5ZXJWZXJzaW9uKGNvbmZpZy5mbGFzaC52ZXJzaW9uKTtcbmxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGV4cG9ydHMuYXZhaWxhYmxlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCa0LvQsNGB0YEgZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBleHRlbmRzIElBdWRpb0ltcGxlbWVudGF0aW9uXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BMQVlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FTkRFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1ZPTFVNRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0NSQVNIRURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TV0FQXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QQVVTRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0VSUk9SXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW292ZXJsYXldIC0g0LzQtdGB0YLQviDQtNC70Y8g0LLRgdGC0YDQsNC40LLQsNC90LjRjyDQv9C70LXQtdGA0LAgKNCw0LrRgtGD0LDQu9GM0L3QviDRgtC+0LvRjNC60L4g0LTQu9GPIGZsYXNoLdC/0LvQtdC10YDQsClcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2ZvcmNlPWZhbHNlXSAtINGB0L7Qt9C00LDRgtGMINC90L7QstGL0Lkg0Y3QutC30LXQv9C70Y/RgCBGbGFzaE1hbmFnZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvRmxhc2ggPSBmdW5jdGlvbihvdmVybGF5LCBmb3JjZSkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgaWYgKCFmbGFzaE1hbmFnZXIgfHwgZm9yY2UpIHtcbiAgICAgICAgZmxhc2hNYW5hZ2VyID0gbmV3IEZsYXNoTWFuYWdlcihvdmVybGF5KTtcbiAgICB9XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMud2hlblJlYWR5ID0gZmxhc2hNYW5hZ2VyLmNyZWF0ZVBsYXllcih0aGlzKTtcbiAgICB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCBkYXRhKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvRmxhc2gpO1xuXG5leHBvcnRzLnR5cGUgPSBBdWRpb0ZsYXNoLnR5cGUgPSBBdWRpb0ZsYXNoLnByb3RvdHlwZS50eXBlID0gXCJmbGFzaFwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KHQvtC30LTQsNC90LjQtSDQvNC10YLQvtC00L7QsiDRgNCw0LHQvtGC0Ysg0YEg0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuT2JqZWN0LmtleXMoRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleVswXSAhPT0gXCJfXCI7XG59KS5tYXAoZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQXVkaW9GbGFzaC5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIS9eZ2V0Ly50ZXN0KG1ldGhvZCkpIHtcbiAgICAgICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgbWV0aG9kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShcImlkXCIpKSB7XG4gICAgICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInBsYXllciBpcyBub3QgcmVhZHlcIik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5pZCk7XG4gICAgICAgIHJldHVybiBmbGFzaE1hbmFnZXIuZmxhc2hbbWV0aG9kXS5hcHBseShmbGFzaE1hbmFnZXIuZmxhc2gsIGFyZ3MpO1xuICAgIH1cbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgSlNET0NcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QuNCz0YDQsNGC0Ywg0YLRgNC10LpcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwbGF5XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICovXG5cbi8qKlxuICog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRg1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BhdXNlXG4gKi9cblxuLyoqXG4gKiDQodC90Y/RgtGMINGC0YDQtdC6INGBINC/0LDRg9C30YtcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNyZXN1bWVcbiAqL1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQuCDQt9Cw0LPRgNGD0LfQutGDINGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNzdG9wXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcHJlbG9hZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2lzUHJlbG9hZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVByZWxvYWRlZFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0UG9zaXRpb25cbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNzZXRQb3NpdGlvblxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0RHVyYXRpb25cbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRMb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFZvbHVtZVxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0Vm9sdW1lXG4gKiBAcGFyYW0ge251bWJlcn0gdm9sdW1lXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0U3JjXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQtdC10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDQtNC+0YHRgtGD0L/QtdC9INC70Lgg0L/RgNC+0LPRgNCw0LzQvNC90YvQuSDQutC+0L3RgtGA0L7Qu9GMINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCb0L7Qs9Cz0LjRgNC+0LLQsNC90LjQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9GbGFzaC5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShcImlkXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG1haW46IFwibm90IHJlYWR5XCIsXG4gICAgICAgICAgICAgICAgcHJlbG9hZGVyOiBcIm5vdCByZWFkeVwiXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtYWluOiBsb2dnZXIuX3Nob3dVcmwodGhpcy5nZXRTcmMoMCkpLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiBsb2dnZXIuX3Nob3dVcmwodGhpcy5nZXRTcmMoMSkpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvRmxhc2g7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoSW50ZXJmYWNlJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQntC/0LjRgdCw0L3QuNC1INCy0L3QtdGI0L3QtdCz0L4g0LjQvdGC0LXRgNGE0LXQudGB0LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge09iamVjdH0gZmxhc2ggLSBzd2Yt0L7QsdGK0LXQutGCXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEludGVyZmFjZSA9IGZ1bmN0aW9uKGZsYXNoKSB7XG4gICAgLy9GSVhNRTog0L3Rg9C20L3QviDQv9GA0LjQtNGD0LzQsNGC0Ywg0L3QvtGA0LzQsNC70YzQvdGL0Lkg0LzQtdGC0L7QtCDRjdC60YHQv9C+0YDRgtCwXG4gICAgdGhpcy5mbGFzaCA9IHlhLm11c2ljLkF1ZGlvLl9mbGFzaCA9IGZsYXNoO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRidC10L3QuNC1INGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRi9C30LLQsNGC0Ywg0LzQtdGC0L7QtCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBmbiAtINC90LDQt9Cy0LDQvdC40LUg0LzQtdGC0L7QtNCwXG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fY2FsbEZsYXNoID0gZnVuY3Rpb24oZm4pIHtcbiAgICAvL0RFViAmJiBsb2dnZXIuZGVidWcodGhpcywgZm4sIGFyZ3VtZW50cyk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5mbGFzaC5jYWxsLmFwcGx5KHRoaXMuZmxhc2gsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcIl9jYWxsRmxhc2hFcnJvclwiLCBlLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC+0LHRgNCw0YLQvdC+0Lkg0YHQstGP0LfQuCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHRocm93cyDQntGI0LjQsdC60LAg0LTQvtGB0YLRg9C/0LAg0LogZmxhc2gt0L/Qu9C10LXRgNGDXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2hlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcImhlYXJ0QmVhdFwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7aW50fSAtLSBpZCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2FkZFBsYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJhZGRQbGF5ZXJcIiwgLTEpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LXRgtC+0LTRiyDRg9C/0YDQsNCy0LvQtdC90LjRjyDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LbQtdC70LDQtdC80LDRjyDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKGlkLCB2b2x1bWUpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRWb2x1bWVcIiwgLTEsIHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0Vm9sdW1lXCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBsYXlcIiwgaWQsIHNyYywgZHVyYXRpb24gJiYgZHVyYXRpb24gKiAxMDAwKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic3RvcFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwYXVzZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInJlc3VtZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFBvc2l0aW9uXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihpZCwgcG9zaXRpb24pIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRQb3NpdGlvblwiLCBpZCwgcG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldER1cmF0aW9uXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRMb2FkZWRcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQstC+0LfQvNC+0LbQvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcInByZWxvYWRcIiwgaWQsIHNyYywgZHVyYXRpb24gJiYgZHVyYXRpb24gKiAxMDAwLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRlZFwiLCBpZCwgc3JjLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRpbmdcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJwbGF5UHJlbG9hZGVkXCIsIGlkLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0L/Qu9C10LXRgNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0U3JjXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsYXNoSW50ZXJmYWNlO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdGbGFzaE1hbmFnZXInKTtcblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBmbGFzaExvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9wcm9taXNlJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi4vbGliL25ldC9lcnJvci9sb2FkZXItZXJyb3InKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCX0LDQs9GA0YPQt9C60LAgZmxhc2gt0L/Qu9C10LXRgNCwINC4INC+0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3ZlcmxheSAtINC+0LHRitC10LrRgiDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDQuCDQv9C+0LrQsNC30LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaE1hbmFnZXIgPSBmdW5jdGlvbihvdmVybGF5KSB7IC8vIHNpbmdsZXRvbiFcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIiwgb3ZlcmxheSk7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJpbml0XCI7XG4gICAgdGhpcy5vdmVybGF5ID0gb3ZlcmxheTtcbiAgICB0aGlzLmVtbWl0ZXJzID0gW107XG5cbiAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLmRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgLyoqXG4gICAgICog0J7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LDQtdGC0YHRjyDQv9GA0Lgg0LfQsNCy0LXRgNGI0LXQvdC40Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgKiBAdHlwZSB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB0aGlzLndoZW5SZWFkeSA9IHRoaXMuZGVmZXJyZWQucHJvbWlzZSgpO1xuXG4gICAgdmFyIGNhbGxiYWNrUGF0aCA9IGNvbmZpZy5mbGFzaC5jYWxsYmFjay5zcGxpdChcIi5cIik7XG4gICAgdmFyIGNhbGxiYWNrTmFtZSA9IGNhbGxiYWNrUGF0aC5wb3AoKTtcbiAgICB2YXIgY2FsbGJhY2tDb250ID0gd2luZG93O1xuICAgIGNhbGxiYWNrUGF0aC5mb3JFYWNoKGZ1bmN0aW9uKHBhcnQpIHtcbiAgICAgICAgaWYgKCFjYWxsYmFja0NvbnRbcGFydF0pIHtcbiAgICAgICAgICAgIGNhbGxiYWNrQ29udFtwYXJ0XSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrQ29udCA9IGNhbGxiYWNrQ29udFtwYXJ0XTtcbiAgICB9KTtcbiAgICBjYWxsYmFja0NvbnRbY2FsbGJhY2tOYW1lXSA9IHRoaXMuX29uRXZlbnQuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX19sb2FkVGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5fb25Mb2FkVGltZW91dC5iaW5kKHRoaXMpLCBjb25maWcuZmxhc2gubG9hZFRpbWVvdXQpO1xuICAgIGZsYXNoTG9hZGVyKGNvbmZpZy5mbGFzaC5wYXRoICsgXCIvXCJcbiAgICAgICAgKyBjb25maWcuZmxhc2gubmFtZSwgY29uZmlnLmZsYXNoLnZlcnNpb24sIGNvbmZpZy5mbGFzaC5wbGF5ZXJJRCwgdGhpcy5fb25Mb2FkLmJpbmQodGhpcyksIHt9LCBvdmVybGF5KTtcblxuICAgIGlmIChvdmVybGF5KSB7XG4gICAgICAgIHZhciB0aW1lb3V0O1xuICAgICAgICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oKSB7IC8vS05PV0xFREdFOiBvbmx5IG1vdXNlZG93biBldmVudCBhbmQgb25seSB3bW9kZTogdHJhbnNwYXJlbnRcbiAgICAgICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0IHx8IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HKSk7XG4gICAgICAgICAgICAgICAgfSwgY29uZmlnLmZsYXNoLmNsaWNrVGltZW91dCk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMud2hlblJlYWR5LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0ICYmIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCByZXN1bHQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJmYWlsZWRcIiwgZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkZsYXNoTWFuYWdlci5FVkVOVF9JTklUID0gXCJpbml0XCI7XG5GbGFzaE1hbmFnZXIuRVZFTlRfRkFJTCA9IFwiZmFpbGVkXCI7XG5GbGFzaE1hbmFnZXIuRVZFTlRfRVJST1IgPSBcImVycm9yXCI7XG5GbGFzaE1hbmFnZXIuRVZFTlRfREVCVUcgPSBcImRlYnVnXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtGH0LjQutC4INGB0L7QsdGL0YLQuNC5INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4IGZsYXNoXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8g0LfQsNCz0YDRg9C30LrQuCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSBkYXRhXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkxvYWQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkxvYWRcIiwgZGF0YSk7XG5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRUaW1lb3V0KTtcbiAgICBkZWxldGUgdGhpcy5fX2xvYWRUaW1lb3V0O1xuXG4gICAgaWYgKGRhdGEuc3VjY2Vzcykge1xuICAgICAgICB0aGlzLmZsYXNoID0gbmV3IEZsYXNoSW50ZXJmYWNlKGRhdGEucmVmKTtcblxuICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gXCJyZWFkeVwiKSB7XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUoZGF0YS5yZWYpO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLm92ZXJsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX19pbml0VGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5fb25Jbml0VGltZW91dC5iaW5kKHRoaXMpLCBjb25maWcuZmxhc2guaW5pdFRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKGRhdGEuX19mYm4gPyBBdWRpb0Vycm9yLkZMQVNIX0JMT0NLRVIgOiBBdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0gpKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGC0LDQudC80LDRg9GC0LAg0LfQsNCz0YDRg9C30LrQuFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Mb2FkVGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBMb2FkZXJFcnJvcihMb2FkZXJFcnJvci5USU1FT1VUKSk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGC0LDQudC80LDRg9GC0LAg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGI0L3QvtGB0YLQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Jbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkluaXRcIik7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJyZWFkeVwiO1xuXG4gICAgaWYgKHRoaXMuX19pbml0VGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fX2luaXRUaW1lb3V0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0VGltZW91dDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mbGFzaCkge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUodGhpcy5mbGFzaCk7XG4gICAgICAgIHRoaXMuX19oZWFydGJlYXQgPSBzZXRJbnRlcnZhbCh0aGlzLl9vbkhlYXJ0QmVhdC5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSwg0YHQvtC30LTQsNCy0LDQtdC80YvRhSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0LLQvNC10YHRgtC1INGBINGB0L7QsdGL0YLQuNC10LxcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uRXZlbnQgPSBmdW5jdGlvbihldmVudCwgaWQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBcImZhaWxlZFwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwib25FdmVudEZhaWxlZFwiLCBldmVudCwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9ERUJVRykge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImZsYXNoREVCVUdcIiwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSBlbHNlIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0VSUk9SKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZmxhc2hFcnJvclwiLCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCwgaWQsIG9mZnNldCk7XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfSU5JVCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25Jbml0KCk7XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfRkFJTCkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJmYWlsZWRcIiwgQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUik7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vSU5GTzog0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtSDRgdC+0LHRi9GC0LjRjyDQv9C10YDQtdC00LDQvdC90L7Qs9C+INC40Lcg0YTQu9C10YjQsCDQvdC10LvRjNC30Y8g0L7QsdGA0LDRidCw0YLRjNGB0Y8g0Log0YTQu9C10Ygt0L7QsdGK0LXQutGC0YMsINC/0L7RjdGC0L7QvNGDINC00LXQu9Cw0LXQvCDRgNCw0YHRgdC40L3RhdGA0L7QvdC40LfQsNGG0LjRjlxuICAgIGlmIChpZCA9PSAtMSkge1xuICAgICAgICBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5lbW1pdGVycy5mb3JFYWNoKGZ1bmN0aW9uKGVtbWl0ZXIpIHtcbiAgICAgICAgICAgICAgICBlbW1pdGVyLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZW1taXRlcnNbaWRdKSB7XG4gICAgICAgIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmVtbWl0ZXJzW2lkXS50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLkZMQVNIX0VNTUlURVJfTk9UX0ZPVU5ELCBpZCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC00L7RgdGC0YPQv9C90L7RgdGC0LggZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkhlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICAgIHRoaXMuZmxhc2guX2hlYXJ0QmVhdCgpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJjcmFzaGVkXCIsIGUpO1xuICAgICAgICB0aGlzLl9vbkV2ZW50KEF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQsIC0xLCBlKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7QXVkaW9GbGFzaH0gYXVkaW9GbGFzaCAtIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgCwg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtCx0YHQu9GD0LbQuNCy0LDRgtGMINGB0L7Qt9C00LDQvdC90YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LDQtdGC0YHRjyDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPINGB0L7Qt9C00LDQvdC40Y8g0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuY3JlYXRlUGxheWVyID0gZnVuY3Rpb24oYXVkaW9GbGFzaCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVQbGF5ZXJcIik7XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMud2hlblJlYWR5LnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGF1ZGlvRmxhc2guaWQgPSB0aGlzLmZsYXNoLl9hZGRQbGF5ZXIoKTtcbiAgICAgICAgdGhpcy5lbW1pdGVyc1thdWRpb0ZsYXNoLmlkXSA9IGF1ZGlvRmxhc2g7XG4gICAgICAgIHJldHVybiBhdWRpb0ZsYXNoLmlkO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24ocGxheWVySWQpIHtcbiAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclN1Y2Nlc3NcIiwgcGxheWVySWQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyZWF0ZVBsYXllckVycm9yXCIsIGVycik7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaE1hbmFnZXI7XG4iLCIvKipcbiAqIEBpZ25vcmVcbiAqIEBmaWxlXG4gKiBUaGlzIGlzIGEgd3JhcHBlciBmb3Igc3dmb2JqZWN0IHRoYXQgZGV0ZWN0cyBGbGFzaEJsb2NrIGluIGJyb3dzZXIuXG4gKlxuICogV3JhcHBlciBkZXRlY3RzOlxuICogICAtIENocm9tZVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gKiAgICAgLSBGbGFzaEJsb2NrIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAqICAgICAtIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gKiAgIC0gRmlyZWZveCBGbGFzaGJsb2NrIChodHRwczovL2FkZG9ucy5tb3ppbGxhLm9yZy9ydS9maXJlZm94L2FkZG9uL2ZsYXNoYmxvY2svKVxuICogICAtIE9wZXJhID49IDExLjUgXCJFbmFibGUgcGx1Z2lucyBvbiBkZW1hbmRcIiBzZXR0aW5nXG4gKiAgIC0gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggUGx1Z2luIChmb3IgU2FmYXJpIDwgNS4wLjYpIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICpcbiAqIFRlc3RlZCBvbjpcbiAqICAgLSBDaHJvbWUgMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgTGV4MSAxLjIuMTEuMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgam9zb3JlayAwLjkuMzFcbiAqICAgICAtIEZsYXNoRnJlZSAxLjEuM1xuICogICAtIEZpcmVmb3ggNS4wLjEgKyBGbGFzaGJsb2NrIDEuNS4xNS4xXG4gKiAgIC0gT3BlcmEgMTEuNVxuICogICAtIFNhZmFyaSA1LjEgKyBDbGlja1RvRmxhc2ggKDIuMy4yKVxuICpcbiAqIEFsc28gdGhpcyB3cmFwcGVyIGNhbiByZW1vdmUgYmxvY2tlZCBzd2YgYW5kIGxldCB5b3UgZG93bmdyYWRlIHRvIG90aGVyIG9wdGlvbnMuXG4gKlxuICogRmVlbCBmcmVlIHRvIGNvbnRhY3QgbWUgdmlhIGVtYWlsLlxuICpcbiAqIENvcHlyaWdodCAyMDExLCBBbGV4ZXkgQW5kcm9zb3ZcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCAoaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHApIG9yIEdQTCBWZXJzaW9uIDMgKGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbCkgbGljZW5zZXMuXG4gKlxuICogVGhhbmtzIHRvIGZsYXNoYmxvY2tkZXRlY3RvciBwcm9qZWN0IChodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZmxhc2hibG9ja2RldGVjdG9yKVxuICpcbiAqIEByZXF1aXJlcyBzd2ZvYmplY3RcbiAqIEBhdXRob3IgQWxleGV5IEFuZHJvc292IDxkb29jaGlrQHlhLnJ1PlxuICogQHZlcnNpb24gMS4wXG4gKi9cblxudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG5mdW5jdGlvbiByZW1vdmUobm9kZSkge1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbn1cblxuLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LfQsNCz0YDRg9C30LrQuCDRhNC70LXRiC3Qv9C70LXQtdGA0LAg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLRgdC70LXQttC40LLQsNC90LjRjyDQsdC70L7QutC40YDQvtCy0YnQuNC60L7QslxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZibi1zd2Ytd3JhcHBlclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIF9fU1dGX1dSQVBQRVJfQ0xBU1M6ICdmYm4tc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgX19URVNUUzogW1xuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gICAgICAgIC8vIENob21lIEZsYXNoQmxvY2sgZXh0ZW5zaW9uIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSwgd3JhcHBlck5vZGUpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cGVjdCB0aGF0IHN3ZiBpcyB0aGUgb25seSBjaGlsZCBvZiB3cmFwcGVyXG4gICAgICAgICAgICByZXR1cm4gd3JhcHBlck5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPiAxXG4gICAgICAgIH0sIC8vIG9sZGVyIFNhZmFyaSBDbGlja1RvRmxhc2ggKGh0dHA6Ly9yZW50enNjaC5naXRodWIuY29tL2NsaWNrdG9mbGFzaC8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIElFIGhhcyBubyBzd2ZOb2RlLnR5cGVcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnR5cGUgJiYgc3dmTm9kZS50eXBlICE9ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCdcbiAgICAgICAgfSwgLy8gRmxhc2hCbG9jayBmb3IgRmlyZWZveCAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAgICAgICAgLy8gQ2hyb21lIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIHN3ZiBoYXZlIGJlZW4gZGV0YWNoZWQgZnJvbSBET01cbiAgICAgICAgICAgIHJldHVybiAhc3dmTm9kZS5wYXJlbnROb2RlO1xuICAgICAgICB9LCAvLyBTYWZhcmkgQ2xpY2tUb0ZsYXNoIEV4dGVuc2lvbiAoaHR0cDovL2hveW9pcy5naXRodWIuY29tL3NhZmFyaWV4dGVuc2lvbnMvY2xpY2t0b3BsdWdpbi8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnBhcmVudE5vZGUuY2xhc3NOYW1lLmluZGV4T2YoJ0NURm5vZGlzcGxheScpID4gLTE7XG4gICAgICAgIH1cbiAgICBdLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRiBleGNlcHQgbGFzdCBwYXJhbSByZW1vdmVCbG9ja2VkU1dGLlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbcmVtb3ZlQmxvY2tlZFNXRj10cnVlXSBSZW1vdmUgc3dmIGlmIGJsb2NrZWRcbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oXG4gICAgICAgIHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4sIHJlbW92ZUJsb2NrZWRTV0ZcbiAgICApIHtcbiAgICAgICAgLy8gdmFyIHN3Zm9iamVjdCA9IHdpbmRvd1snc3dmb2JqZWN0J107XG5cbiAgICAgICAgaWYgKCFzd2ZvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3Zm9iamVjdC5hZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcbiAgICAgICAgICAgIGlmICghcmVwbGFjZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gY3JlYXRlIGRpdi13cmFwcGVyIGJlY2F1c2Ugc29tZSBmbGFzaCBibG9jayBwbHVnaW5zIHJlcGxhY2Ugc3dmIHdpdGggYW5vdGhlciBjb250ZW50LlxuICAgICAgICAgICAgLy8gQWxzbyBzb21lIGZsYXNoIHJlcXVpcmVzIHdyYXBwZXIgdG8gd29yayBwcm9wZXJseS5cbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0cixcbiAgICAgICAgICAgICAgICByZXBsYWNlRWxlbUlkU3RyLFxuICAgICAgICAgICAgICAgIHdpZHRoU3RyLFxuICAgICAgICAgICAgICAgIGhlaWdodFN0cixcbiAgICAgICAgICAgICAgICBzd2ZWZXJzaW9uU3RyLFxuICAgICAgICAgICAgICAgIHhpU3dmVXJsU3RyLFxuICAgICAgICAgICAgICAgIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICBwYXJPYmosXG4gICAgICAgICAgICAgICAgYXR0T2JqLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZS5zdWNjZXNzID09PSBmYWxzZSBtZWFucyB0aGF0IGJyb3dzZXIgZG9uJ3QgaGF2ZSBmbGFzaCBvciBmbGFzaCBpcyB0b28gb2xkXG4gICAgICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIDExLjUgYW5kIGFib3ZlIHJlcGxhY2VzIGZsYXNoIHdpdGggU1ZHIGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbXNpZSAoYW5kIGNhbmFyeSBjaHJvbWUgMzIuMCkgY3Jhc2hlcyBvbiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKClcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkQnlTVkcgPSBzd2ZFbGVtZW50ICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlZEJ5U1ZHKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vc2V0IHRpbWVvdXQgdG8gbGV0IEZsYXNoQmxvY2sgcGx1Z2luIGRldGVjdCBzd2YgYW5kIHJlcGxhY2UgaXQgc29tZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgVEVTVFMgPSBGbGFzaEJsb2NrTm90aWZpZXIuX19URVNUUztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSBURVNUUy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChURVNUU1tpXShzd2ZFbGVtZW50LCB3cmFwcGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRmFpbHVyZShlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEJsb2NrTm90aWZpZXIuX19USU1FT1VUKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG9uRmFpbHVyZShlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3ZlQmxvY2tlZFNXRiAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBzd2ZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2ZvYmplY3QucmVtb3ZlU1dGKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIHdyYXBwZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUod3JhcHBlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBleHRlbnNpb24gYXJ0ZWZhY3RzXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL0NsaWNrVG9GbGFzaCBhcnRlZmFjdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3RmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0NURnN0YWNrJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0Zikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUoY3RmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL0Nocm9tZSBGbGFzaEJsb2NrIGFydGVmYWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RCb2R5Q2hpbGQgPSBkb2N1bWVudC5ib2R5Lmxhc3RDaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdEJvZHlDaGlsZCAmJiBsYXN0Qm9keUNoaWxkLmNsYXNzTmFtZSA9PSAndWpzX2ZsYXNoYmxvY2tfcGxhY2Vob2xkZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShsYXN0Qm9keUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuX19mYm4gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsYXNoQmxvY2tOb3RpZmllcjtcbiIsInZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcblxuLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LfQsNCz0YDRg9C30LrQuCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEVtYmVkZGVyID0ge1xuXG4gICAgLyoqXG4gICAgICogQ1NTLWNsYXNzIGZvciBzd2Ygd3JhcHBlci5cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQGRlZmF1bHQgZmVtYi1zd2Ytd3JhcHBlclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIF9fU1dGX1dSQVBQRVJfQ0xBU1M6ICdmZW1iLXN3Zi13cmFwcGVyJyxcblxuICAgIC8qKlxuICAgICAqIFRpbWVvdXQgZm9yIGZsYXNoIGJsb2NrIGRldGVjdFxuICAgICAqIEBkZWZhdWx0IDUwMFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICBfX1RJTUVPVVQ6IDUwMCxcblxuICAgIC8qKlxuICAgICAqIEVtYmVkIFNXRiBpbmZvIHBhZ2UuIFRoaXMgZnVuY3Rpb24gaGFzIHNhbWUgb3B0aW9ucyBhcyBzd2ZvYmplY3QuZW1iZWRTV0ZcbiAgICAgKiBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgKiBAcGFyYW0gc3dmVXJsU3RyXG4gICAgICogQHBhcmFtIHJlcGxhY2VFbGVtSWRTdHJcbiAgICAgKiBAcGFyYW0gd2lkdGhTdHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0U3RyXG4gICAgICogQHBhcmFtIHN3ZlZlcnNpb25TdHJcbiAgICAgKiBAcGFyYW0geGlTd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gZmxhc2h2YXJzT2JqXG4gICAgICogQHBhcmFtIHBhck9ialxuICAgICAqIEBwYXJhbSBhdHRPYmpcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tGblxuICAgICAqL1xuICAgIGVtYmVkU1dGOiBmdW5jdGlvbihcbiAgICAgICAgc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGblxuICAgICkge1xuICAgICAgICBzd2ZvYmplY3QuYWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHJlcGxhY2VFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICBpZiAoIXJlcGxhY2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSBuZWVkIHRvIGNyZWF0ZSBkaXYtd3JhcHBlciBiZWNhdXNlIHNvbWUgZmxhc2ggYmxvY2sgcGx1Z2lucyByZXBsYWNlIHN3ZiB3aXRoIGFub3RoZXIgY29udGVudC5cbiAgICAgICAgICAgIC8vIEFsc28gc29tZSBmbGFzaCByZXF1aXJlcyB3cmFwcGVyIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSBGbGFzaEVtYmVkZGVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLFxuICAgICAgICAgICAgICAgIHJlcGxhY2VFbGVtSWRTdHIsXG4gICAgICAgICAgICAgICAgd2lkdGhTdHIsXG4gICAgICAgICAgICAgICAgaGVpZ2h0U3RyLFxuICAgICAgICAgICAgICAgIHN3ZlZlcnNpb25TdHIsXG4gICAgICAgICAgICAgICAgeGlTd2ZVcmxTdHIsXG4gICAgICAgICAgICAgICAgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgIHBhck9iaixcbiAgICAgICAgICAgICAgICBhdHRPYmosXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAgICAgLy8gQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIDExLjUgYW5kIGFib3ZlIHJlcGxhY2VzIGZsYXNoIHdpdGggU1ZHIGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbXNpZSAoYW5kIGNhbmFyeSBjaHJvbWUgMzIuMCkgY3Jhc2hlcyBvbiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKClcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkQnlTVkcgPSBzd2ZFbGVtZW50ICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlZEJ5U1ZHKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vc2V0IHRpbWVvdXQgdG8gbGV0IEZsYXNoQmxvY2sgcGx1Z2luIGRldGVjdCBzd2YgYW5kIHJlcGxhY2UgaXQgc29tZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZsYXNoRW1iZWRkZXIuX19USU1FT1VUKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG9uRmFpbHVyZShlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEVtYmVkZGVyO1xuIiwidmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHJlcXVpcmUoJy4vZmxhc2hibG9ja25vdGlmaWVyJyk7XG52YXIgRmxhc2hFbWJlZGRlciA9IHJlcXVpcmUoJy4vZmxhc2hlbWJlZGRlcicpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xuXG52YXIgd2luU2FmYXJpID0gZGV0ZWN0LnBsYXRmb3JtLm9zID09PSAnd2luZG93cycgJiYgZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gJ3NhZmFyaSc7XG5cbnZhciBDT05UQUlORVJfQ0xBU1MgPSBcInlhLWZsYXNoLXBsYXllci13cmFwcGVyXCI7XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30YfQuNC6INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICpcbiAqIEBhbGlhcyBGbGFzaE1hbmFnZXJ+Zmxhc2hMb2FkZXJcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0g0KHRgdGL0LvQutCwINC90LAg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ30gbWluVmVyc2lvbiAtINC80LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBpZCAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGxvYWRDYWxsYmFjayAtINC60L7Qu9Cx0LXQuiDQtNC70Y8g0YHQvtCx0YvRgtC40Y8g0LfQsNCz0YDRg9C30LrQuFxuICogQHBhcmFtIHtvYmplY3R9IGZsYXNoVmFycyAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQstCw0LXQvNGL0LUg0LLQviDRhNC70LXRiFxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyIC0g0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQstC40LTQuNC80L7Qs9C+INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVYIC0g0YDQsNC30LzQtdGAINC/0L4g0LPQvtGA0LjQt9C+0L3RgtCw0LvQuFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVZIC0g0YDQsNC30LzQtdGAINC/0L4g0LLQtdGA0YLQuNC60LDQu9C4XG4gKlxuICogQHByaXZhdGVcbiAqXG4gKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9IC0tINCa0L7QvdGC0LXQudC90LXRgCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih1cmwsIG1pblZlcnNpb24sIGlkLCBsb2FkQ2FsbGJhY2ssIGZsYXNoVmFycywgY29udGFpbmVyLCBzaXplWCwgc2l6ZVkpIHtcbiAgICB2YXIgJGZsYXNoUGxheWVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAkZmxhc2hQbGF5ZXIuaWQgPSBcIndyYXBwZXJfXCIgKyBpZDtcbiAgICAkZmxhc2hQbGF5ZXIuaW5uZXJIVE1MID0gJzxkaXYgaWQ9XCInICsgaWQgKyAnXCI+PC9kaXY+JztcblxuICAgIHNpemVYID0gc2l6ZVggfHwgXCIxMDAwXCI7XG4gICAgc2l6ZVkgPSBzaXplWSB8fCBcIjEwMDBcIjtcblxuICAgIHZhciBlbWJlZGRlcixcbiAgICAgICAgZmxhc2hTaXplWCxcbiAgICAgICAgZmxhc2hTaXplWSxcbiAgICAgICAgb3B0aW9ucztcblxuICAgIGlmIChjb250YWluZXIgJiYgIXdpblNhZmFyaSkge1xuICAgICAgICBlbWJlZGRlciA9IEZsYXNoRW1iZWRkZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBzaXplWDtcbiAgICAgICAgZmxhc2hTaXplWSA9IHNpemVZO1xuICAgICAgICBvcHRpb25zID0ge2FsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiLCB3bW9kZTogXCJ0cmFuc3BhcmVudFwifTtcblxuICAgICAgICAkZmxhc2hQbGF5ZXIuY2xhc3NOYW1lID0gQ09OVEFJTkVSX0NMQVNTO1xuICAgICAgICAkZmxhc2hQbGF5ZXIuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBmbGFzaFNpemVZID0gXCIxXCI7XG4gICAgICAgIG9wdGlvbnMgPSB7YWxsb3dzY3JpcHRhY2Nlc3M6IFwiYWx3YXlzXCJ9O1xuXG4gICAgICAgICRmbGFzaFBsYXllci5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogLTFweDsgdG9wOiAtMXB4OyB3aWR0aDogMHB4OyBoZWlnaHQ6IDBweDsgb3ZlcmZsb3c6IGhpZGRlbjsnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfVxuXG4gICAgZW1iZWRkZXIuZW1iZWRTV0YoXG4gICAgICAgIHVybCxcbiAgICAgICAgaWQsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG1pblZlcnNpb24sXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGZsYXNoVmFycyxcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAge30sXG4gICAgICAgIGxvYWRDYWxsYmFja1xuICAgICk7XG5cbiAgICByZXR1cm4gJGZsYXNoUGxheWVyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gWzYwLCAxNzAsIDMxMCwgNjAwLCAxMDAwLCAzMDAwLCA2MDAwLCAxMjAwMCwgMTQwMDAsIDE2MDAwXTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImRlZmF1bHRcIixcbiAgICAgICAgXCJwcmVhbXBcIjogMCxcbiAgICAgICAgXCJiYW5kc1wiOiBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkNsYXNzaWNhbFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMC41LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMy41LCAtMy41LCAtMy41LCAtNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2x1YlwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4zNTk5OTk4OTUwOTU4MjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIDQsIDIuNSwgMi41LCAyLjUsIDEuNSwgLTAuNSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkRhbmNlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjE1OTk5OTg0NzQxMjEwOTQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQuNSwgMy41LCAxLCAtMC41LCAtMC41LCAtMi41LCAtMy41LCAtMy41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDQuNSwgNC41LCAyLjUsIDAuNSwgLTIsIC00LCAtNSwgLTUuNSwgLTUuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgQmFzcyAmIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMi41LCAtMC41LCAtMy41LCAtMiwgMC41LCA0LCA1LjUsIDYsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTQuNSwgLTQuNSwgLTQuNSwgLTIsIDEsIDUuNSwgOCwgOCwgOCwgOF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcHRvcCBTcGVha2VycyAvIEhlYWRwaG9uZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDUuNSwgMi41LCAtMS41LCAtMSwgMC41LCAyLCA0LjUsIDYsIDddXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMYXJnZSBIYWxsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzUsIDUsIDIuNSwgMi41LCAtMC41LCAtMiwgLTIsIC0yLCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGl2ZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi42Mzk5OTk4NjY0ODU1OTU3LFxuICAgICAgICBcImJhbmRzXCI6IFstMiwgLTAuNSwgMiwgMi41LCAyLjUsIDIuNSwgMiwgMSwgMSwgMV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBhcnR5XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMy41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAzLjUsIDMuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBvcFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4xMTk5OTk4ODU1NTkwODIsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIDIsIDMuNSwgNCwgMi41LCAtMC41LCAtMSwgLTEsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSZWdnYWVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTQuMDc5OTk5OTIzNzA2MDU1LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMi41LCAtMC41LCAzLCAzLCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUm9ja1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIsIC0yLjUsIC00LCAtMS41LCAyLCA0LCA1LjUsIDUuNSwgNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU2thXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjUxOTk5OTk4MDkyNjUxNCxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTEsIC0yLCAtMiwgLTAuNSwgMiwgMi41LCA0LCA0LjUsIDUuNSwgNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC43OTk5OTk3MTM4OTc3MDUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDAuNSwgLTAuNSwgLTEsIC0wLjUsIDIsIDQsIDQuNSwgNS41LCA2XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdCBSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDIsIDEsIC0wLjUsIC0yLCAtMi41LCAtMS41LCAtMC41LCAxLCA0XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiVGVjaG5vXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjgzOTk5OTkxNDE2OTMxMTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIuNSwgLTAuNSwgLTIuNSwgLTIsIC0wLjUsIDQsIDQuNSwgNC41LCA0XVxuICAgIH1cbl07XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIEVxdWFsaXplclN0YXRpYyA9IHJlcXVpcmUoJy4vZXF1YWxpemVyLXN0YXRpYycpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQt9C90LDRh9C10L3QuNGPINGD0YHQuNC70LXQvdC40Y8uXG4gKiBAZXZlbnQgRXF1YWxpemVyQmFuZC5FVkVOVF9DSEFOR0VcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSDQndC+0LLQvtC1INC30L3QsNGH0LXQvdC40LUuXG4gKi9cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCf0L7Qu9C+0YHQsCDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPINGN0LrQstCw0LvQsNC50LfQtdGA0LAuXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqXG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0INCa0L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSS5cbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlINCi0LjQvyDRhNC40LvRjNGC0YDQsC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxdWVuY3kg0KfQsNGB0YLQvtGC0LAg0YTQuNC70YzRgtGA0LAuXG4gKlxuICogQGZpcmVzIEVxdWFsaXplckJhbmQuRVZFTlRfQ0hBTkdFXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRXF1YWxpemVyQmFuZCA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgdHlwZSwgZnJlcXVlbmN5KSB7XG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgdGhpcy5maWx0ZXIgPSBhdWRpb0NvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgdGhpcy5maWx0ZXIudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5maWx0ZXIuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5O1xuICAgIHRoaXMuZmlsdGVyLlEudmFsdWUgPSAxO1xuICAgIHRoaXMuZmlsdGVyLmdhaW4udmFsdWUgPSAwO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXJCYW5kKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INC90LDRgdGC0YDQvtC50LrQsNC80LhcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGH0LDRgdGC0L7RgtGDINC/0L7Qu9C+0YHRiyDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPLlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0RnJlcSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWU7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPLlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPLlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlINCX0L3QsNGH0LXQvdC40LUuXG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKEVxdWFsaXplclN0YXRpYy5FVkVOVF9DSEFOR0UsIHZhbHVlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyQmFuZDtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBFcXVhbGl6ZXJTdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSB7fTtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuRXF1YWxpemVyU3RhdGljLkVWRU5UX0NIQU5HRSA9IFwiY2hhbmdlXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyU3RhdGljO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4uLy4uL2xpYi9kYXRhL21lcmdlJyk7XG5cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSByZXF1aXJlKCcuL2VxdWFsaXplci1zdGF0aWMnKTtcbnZhciBFcXVhbGl6ZXJCYW5kID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXItYmFuZCcpO1xuXG4vKipcbiAqINCe0L/QuNGB0LDQvdC40LUg0L3QsNGB0YLRgNC+0LXQuiDRjdC60LLQsNC70LDQudC30LXRgNCwLlxuICogQHR5cGVkZWYge09iamVjdH0gRXF1YWxpemVyfkVxdWFsaXplclByZXNldFxuICogQHByb3BlcnR5IHtTdHJpbmd9IFtpZF0g0JjQtNC10L3RgtC40YTQuNC60LDRgtC+0YAg0L3QsNGB0YLRgNC+0LXQui5cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAg0J/RgNC10LTRg9GB0LjQu9C40YLQtdC70YwuXG4gKiBAcHJvcGVydHkge0FycmF5LjxOdW1iZXI+fSBiYW5kcyDQl9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LAuXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBldmVudCBFcXVhbGl6ZXIuRVZFTlRfQ0hBTkdFXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXEg0KfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y8uXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUg0JfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPLlxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQrdC60LLQsNC70LDQudC30LXRgC5cbiAqIEBleHBvcnRlZCB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJcbiAqXG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0INCa0L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSS5cbiAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IGJhbmRzINCh0L/QuNGB0L7QuiDRh9Cw0YHRgtC+0YIg0LTQu9GPINC/0L7Qu9C+0YEg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsC5cbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqXG4gKiBAZmlyZXMgRXF1YWxpemVyLkVWRU5UX0NIQU5HRVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCBiYW5kcykge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVhbXAgPSBuZXcgRXF1YWxpemVyQmFuZChhdWRpb0NvbnRleHQsIFwiaGlnaHNoZWxmXCIsIDApO1xuICAgIHRoaXMucHJlYW1wLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIHRoaXMucHJlYW1wKSk7XG5cbiAgICBiYW5kcyA9IGJhbmRzIHx8IEVxdWFsaXplci5ERUZBVUxUX0JBTkRTO1xuXG4gICAgdmFyIHByZXY7XG4gICAgdGhpcy5iYW5kcyA9IGJhbmRzLm1hcChmdW5jdGlvbihmcmVxdWVuY3ksIGlkeCkge1xuICAgICAgICB2YXIgYmFuZCA9IG5ldyBFcXVhbGl6ZXJCYW5kKFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0LFxuXG4gICAgICAgICAgICBpZHggPT0gMCA/ICdsb3dzaGVsZidcbiAgICAgICAgICAgICAgICA6IGlkeCArIDEgPCBiYW5kcy5sZW5ndGggPyBcInBlYWtpbmdcIlxuICAgICAgICAgICAgICAgIDogXCJoaWdoc2hlbGZcIixcblxuICAgICAgICAgICAgZnJlcXVlbmN5XG4gICAgICAgICk7XG4gICAgICAgIGJhbmQub24oXCIqXCIsIHRoaXMuX29uQmFuZEV2ZW50LmJpbmQodGhpcywgYmFuZCkpO1xuXG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgICAgdGhpcy5wcmVhbXAuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJldi5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2ID0gYmFuZDtcbiAgICAgICAgcmV0dXJuIGJhbmQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnByZWFtcC5maWx0ZXI7XG4gICAgdGhpcy5vdXRwdXQgPSB0aGlzLmJhbmRzW3RoaXMuYmFuZHMubGVuZ3RoIC0gMV0uZmlsdGVyO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXIpO1xubWVyZ2UoRXF1YWxpemVyLCBFcXVhbGl6ZXJTdGF0aWMsIHRydWUpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4INC/0L4t0YPQvNC+0LvRh9Cw0L3QuNGOXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNCx0L7RgCDRh9Cw0YHRgtC+0YIg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsCwg0L/RgNC40LzQtdC90Y/RjtGJ0LjQudGB0Y8g0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4uXG4gKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfQkFORFMgPSByZXF1aXJlKCcuL2RlZmF1bHQuYmFuZHMuanMnKTtcblxuLyoqXG4gKiDQndCw0LHQvtGAINGA0LDRgdC/0YDQvtGB0YLRgNCw0L3QtdC90L3Ri9GFINC/0YDQtdGB0LXRgtC+0LIg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsCDQtNC70Y8g0L3QsNCx0L7RgNCwINGH0LDRgdGC0L7RgiDQv9C+INGD0LzQvtC70YfQsNC90LjRji5cbiAqIEB0eXBlIHtPYmplY3QuPFN0cmluZywgRXF1YWxpemVyfkVxdWFsaXplclByZXNldD59XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfUFJFU0VUUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5wcmVzZXRzLmpzJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40Y8g0L/QvtC70L7RgdGLINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBwYXJhbSB7RXF1YWxpemVyQmFuZH0gYmFuZCAtINC/0L7Qu9C+0YHQsCDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1INGB0L7QsdGL0YLQuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLl9vbkJhbmRFdmVudCA9IGZ1bmN0aW9uKGJhbmQsIGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBiYW5kLmdldEZyZXEoKSwgZGF0YSk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JfQsNCz0YDRg9C30LrQsCDQuCDRgdC+0YXRgNCw0L3QtdC90LjQtSDQvdCw0YHRgtGA0L7QtdC6XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30LjRgtGMINC90LDRgdGC0YDQvtC50LrQuC5cbiAqIEBwYXJhbSB7RXF1YWxpemVyfkVxdWFsaXplclByZXNldH0gcHJlc2V0INCd0LDRgdGC0YDQvtC50LrQuC5cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5sb2FkUHJlc2V0ID0gZnVuY3Rpb24ocHJlc2V0KSB7XG4gICAgcHJlc2V0LmJhbmRzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIGlkeCkge1xuICAgICAgICB0aGlzLmJhbmRzW2lkeF0uc2V0VmFsdWUodmFsdWUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5wcmVhbXAuc2V0VmFsdWUocHJlc2V0LnByZWFtcCk7XG59O1xuXG4vKipcbiAqINCh0L7RhdGA0LDQvdC40YLRjCDRgtC10LrRg9GJ0LjQtSDQvdCw0YHRgtGA0L7QudC60LguXG4gKiBAcmV0dXJucyB7RXF1YWxpemVyfkVxdWFsaXplclByZXNldH1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5zYXZlUHJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJlYW1wOiB0aGlzLnByZWFtcC5nZXRWYWx1ZSgpLFxuICAgICAgICBiYW5kczogdGhpcy5iYW5kcy5tYXAoZnVuY3Rpb24oYmFuZCkgeyByZXR1cm4gYmFuZC5nZXRWYWx1ZSgpOyB9KVxuICAgIH07XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQsNGC0LXQvNCw0YLQuNC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0Ywg0L/RgNC10LTQv9C+0LvQvtC20LXQvdC40LUgKNGB0LrQvtGA0LXQtSDQstGB0LXQs9C+INC90YPQttC90LAg0LrQsNGA0YLQsCDQstC10YHQvtCyINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YfQsNGB0YLQvtGCINC40LvQuCDQtNCw0LbQtSDQvdC10LrQsNGPINGE0YPQvdC60YbQuNGPKVxuLyoqXG4gKiDQktGL0YfQuNGB0LvRj9C10YIg0L7Qv9GC0LjQvNCw0LvRjNC90L7QtSDQt9C90LDRh9C10L3QuNC1INC/0YDQtdC00YPRgdC40LvQtdC90LjRjy4g0KTRg9C90LrRhtC40Y8g0Y/QstC70Y/QtdGC0YHRjyDRjdC60YHQv9C10YDQuNC80LXQvdGC0LDQu9GM0L3QvtC5LlxuICogQGV4cGVyaW1lbnRhbFxuICogQHJldHVybnMge251bWJlcn0g0LfQvdCw0YfQtdC90LjQtSDQv9GA0LXQtNGD0YHQuNC70LXQvdC40Y8uXG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuZ3Vlc3NQcmVhbXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdiA9IDA7XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSB0aGlzLmJhbmRzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICB2ICs9IHRoaXMuYmFuZHNba10uZ2V0VmFsdWUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gLXYgLyAyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhbGl6ZXI7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXInKTtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5tdXNpYy5BdWRpby5meCA9IHt9O1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLm11c2ljLkF1ZGlvLmZ4LnZvbHVtZUxpYiA9IHJlcXVpcmUoJy4vdm9sdW1lLWxpYicpO1xuIiwiLyoqXG4gKiDQnNC10YLQvtC00Ysg0LrQvtC90LLQtdGA0YLQsNGG0LjQuCDQt9C90LDRh9C10L3QuNC5INCz0YDQvtC80LrQvtGB0YLQuC5cbiAqIEBuYW1lIHZvbHVtZUxpYlxuICogQGV4cG9ydGVkIHlhLm11c2ljLkF1ZGlvLmZ4LnZvbHVtZUxpYlxuICogQG5hbWVzcGFjZVxuICovXG52YXIgdm9sdW1lTGliID0ge307XG5cbi8qKlxuICog0JzQuNC90LjQvNCw0LvRjNC90L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCwg0L/RgNC4INC60L7RgtC+0YDQvtC8INC/0YDQvtC40YHRhdC+0LTQuNGCINC+0YLQutC70Y7Rh9C10L3QuNC1INC30LLRg9C60LAuXG4gKiDQntCz0YDQsNC90LjRh9C10L3QuNC1INCyIDAuMDEg0L/QvtC00L7QsdGA0LDQvdC+INGN0LzQv9C40YDQuNGH0LXRgdC60LguXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIuRVBTSUxPTiA9IDAuMDE7XG5cbi8qKlxuICog0JrQvtGN0YTRhNC40YbQuNC10L3RgiDQtNC70Y8g0L/RgNC10L7QsdGA0LDQt9C+0LLQsNC90LjQuSDQs9GA0L7QvNC60L7RgdGC0Lgg0LjQtyDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7QuSDRiNC60LDQu9GLINCyINC00LXRhtC40LHQtdC70YsuXG4gKiBAdHlwZSBOdW1iZXJcbiAqIEBwcml2YXRlXG4gKi9cbnZvbHVtZUxpYi5fREJGU19DT0VGID0gMjAgLyBNYXRoLmxvZygxMCk7XG5cbi8qKlxuICog0JLRi9GH0LjRgdC70LXQvdC40LUg0LfQvdCw0YfQtdC90LjQtSDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7QuSDQs9GA0L7QvNC60L7RgdGC0Lgg0L/QviDQt9C90LDRh9C10L3QuNGOINC90LAg0LvQvtCz0LDRgNC40YTQvNC40YfQtdGB0LrQvtC5INGI0LrQsNC70LUuXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUg0JfQvdCw0YfQtdC90LjQtSDQvdCwINGI0LrQsNC70LUuXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG52b2x1bWVMaWIudG9FeHBvbmVudCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHZvbHVtZSA9IE1hdGgucG93KHZvbHVtZUxpYi5FUFNJTE9OLCAxIC0gdmFsdWUpO1xuICAgIHJldHVybiB2b2x1bWUgPiB2b2x1bWVMaWIuRVBTSUxPTiA/IHZvbHVtZSA6IDA7XG59O1xuXG4vKipcbiAqINCS0YvRh9C40YHQu9C10L3QuNC1INC/0L7Qu9C+0LbQtdC90LjRjyDQvdCwINC70L7Qs9Cw0YDQuNGE0LzQuNGH0LXRgdC60L7QuSDRiNC60LDQu9C1INC/0L4g0LfQvdCw0YfQtdC90LjRjiDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7QuSDQs9GA0L7QvNC60L7RgdGC0Lgg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lINCT0YDQvtC80LrQvtGB0YLRjC5cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbnZvbHVtZUxpYi5mcm9tRXhwb25lbnQgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICByZXR1cm4gMSAtIE1hdGgubG9nKE1hdGgubWF4KHZvbHVtZSwgdm9sdW1lTGliLkVQU0lMT04pKSAvIE1hdGgubG9nKHZvbHVtZUxpYi5FUFNJTE9OKTtcbn07XG5cbi8qKlxuICog0JLRi9GH0LjRgdC70LXQvdC40LUg0LfQvdCw0YfQtdC90LjRjyBkQkZTINC40Lcg0L7RgtC90L7RgdC40YLQtdC70YzQvdC+0LPQviDQt9C90LDRh9C10L3QuNGPINCz0YDQvtC80LrQvtGB0YLQuC5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUg0J7RgtC90L7RgdC40YLQtdC70YzQvdCw0Y8g0LPRgNC+0LzQutC+0YHRgtGMLlxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xudm9sdW1lTGliLnRvREJGUyA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIHJldHVybiBNYXRoLmxvZyh2b2x1bWUpICogdm9sdW1lTGliLl9EQkZTX0NPRUY7XG59O1xuXG4vKipcbiAqINCS0YvRh9C40YHQu9C10L3QuNC1INC30L3QsNGH0LXQvdC40Y8g0L7RgtC90L7RgdC40YLQtdC70YzQvdC+0Lkg0LPRgNC+0LzQutC+0YHRgtC4INC40Lcg0LfQvdCw0YfQtdC90LjRjyBkQkZTLlxuICogQHBhcmFtIHtOdW1iZXJ9IGRiZnMg0JPRgNC+0LzQutC+0YHRgtGMINCyIGRCRlMuXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG52b2x1bWVMaWIuZnJvbURCRlMgPSBmdW5jdGlvbihkYmZzKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKGRiZnMgLyB2b2x1bWVMaWIuX0RCRlNfQ09FRik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHZvbHVtZUxpYjtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9IVE1MNUxvYWRlcicpO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBQbGF5YmFja0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvcGxheWJhY2stZXJyb3InKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbGliL25vb3AnKTtcblxudmFyIGxvYWRlcklkID0gMTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0LHRkdGA0YLQutCwINC00LvRjyDQvdCw0YLQuNCy0L3QvtCz0L4g0LrQu9Cw0YHRgdCwIEF1ZGlvXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BMQVlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FTkRFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QQVVTRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNUxvYWRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IGxvYWRlcklkKys7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8qKlxuICAgICAqINCa0L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0YDQsNC30LvQuNGH0L3Ri9GFINC+0LbQuNC00LDQvdC40Lkg0YHQvtCx0YvRgtC40LlcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxTdHJpbmcsIERlZmVycmVkPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZXMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuc3JjID0gXCJcIjtcbiAgICAvKipcbiAgICAgKiDQndCw0LfQvdCw0YfQtdC90L3QsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcblxuICAgIC8qKlxuICAgICAqINCS0YDQtdC80Y8g0L/QvtGB0LvQtdC00L3QtdCz0L4g0L7QsdC90L7QstC70LXQvdC40Y8g0LTQsNC90L3Ri9GFXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMubGFzdFVwZGF0ZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiDQpNC70LDQsyDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuFxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5ub3RMb2FkaW5nID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqINCS0YvRhdC+0LQg0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuXG4gICAgLy8tLS0g0KHQsNGF0LDRgCDQtNC70Y8g0LfQsNGJ0LjRgtGLINC+0YIg0YPRgtC10YfQtdC6INC/0LDQvNGP0YLQuFxuICAgIHRoaXMuX19zdGFydFBsYXkgPSB0aGlzLl9zdGFydFBsYXkuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fcmVzdGFydCA9IHRoaXMuX3Jlc3RhcnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fc3RhcnR1cEF1ZGlvID0gdGhpcy5fc3RhcnR1cEF1ZGlvLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MgPSB0aGlzLl91cGRhdGVQcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcgPSB0aGlzLl9vbk5hdGl2ZUxvYWRpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFbmRlZCA9IHRoaXMuX29uTmF0aXZlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFcnJvciA9IHRoaXMuX29uTmF0aXZlRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVQYXVzZSA9IHRoaXMuX29uTmF0aXZlUGF1c2UuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX19vbk5hdGl2ZVBsYXkgPSB0aGlzLnRyaWdnZXIuYmluZCh0aGlzLCBBdWRpb1N0YXRpYy5FVkVOVF9QTEFZKTtcblxuICAgIHRoaXMuX2luaXRBdWRpbygpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1TG9hZGVyKTtcblxuQXVkaW9IVE1MNUxvYWRlci5fY2F0Y2hQcm9taXNlID0gZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgIGlmIChwcm9taXNlICYmIHByb21pc2VbXCJjYXRjaFwiXSkge1xuICAgICAgICBwcm9taXNlW1wiY2F0Y2hcIl0oZnVuY3Rpb24oKSB7fSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQmNC90YLQtdGA0LLQsNC7INC+0LHQvdC+0LLQu9C10L3QuNGPINGC0LDQudC80LjQvdCz0L7QsiDRgtGA0LXQutCwXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHByaXZhdGVcbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl91cGRhdGVJbnRlcnZhbCA9IDMwO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGC0LjQstC90YvQtSDRgdC+0LHRi9GC0LjRjyBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZID0gXCJwbGF5XCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQv9Cw0YPQt9GLXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFID0gXCJwYXVzZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40LUg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUgPSBcInRpbWV1cGRhdGVcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINGC0YDQtdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQgPSBcImVuZGVkXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0RVUkFUSU9OID0gXCJkdXJhdGlvbmNoYW5nZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElORyA9IFwicHJvZ3Jlc3NcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC00L7RgdGC0YPQv9C90L7RgdGC0Lgg0LzQtdGC0LAt0LTQsNC90L3Ri9GFINGC0YDQtdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSA9IFwibG9hZGVkbWV0YWRhdGFcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L3QsNGH0LDRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtVxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZID0gXCJjYW5wbGF5XCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IgPSBcImVycm9yXCI7XG5cbi8qKlxuICog0JfQsNCz0LvRg9GI0LrQsCDQtNC70Y8gX19pbml0TGlzdGVuZXIn0LAg0L3QsCDQstGA0LXQvNGPINC+0LbQuNC00LDQvdC40Y8g0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9kZWZhdWx0SW5pdExpc3RlbmVyID0gZnVuY3Rpb24oKSB7fTtcbkF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXIuc3RlcCA9IFwidXNlclwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INC+0LHQvdC+0LLQu9C10L3QuNGPINGC0LDQudC80LjQvdCz0L7QsiDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fdXBkYXRlUHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudFRpbWUgPSArbmV3IERhdGUoKTtcbiAgICBpZiAoY3VycmVudFRpbWUgLSB0aGlzLmxhc3RVcGRhdGUgPCBBdWRpb0hUTUw1TG9hZGVyLl91cGRhdGVJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0VXBkYXRlID0gY3VycmVudFRpbWU7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Lkg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVMb2FkaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fdXBkYXRlUHJvZ3Jlc3MoKTtcblxuICAgIGlmICh0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICB2YXIgbG9hZGVkID0gdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuXG4gICAgICAgIGlmICh0aGlzLm5vdExvYWRpbmcgJiYgbG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLm5vdExvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FESU5HKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsb2FkZWQgPj0gdGhpcy5hdWRpby5kdXJhdGlvbiAtIDAuMSkge1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC+0LrQvtC90YfQsNC90LjRjyDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVFbmRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VOREVEKTtcbiAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICBBdWRpb0hUTUw1TG9hZGVyLl9jYXRjaFByb21pc2UodGhpcy5hdWRpby5wYXVzZSgpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQvtC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtFdmVudH0gZSAtINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlRXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgaWYgKCF0aGlzLnNyYykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYXVkaW8uZXJyb3IuY29kZSA9PSAyKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiTmV0d29yayBlcnJvci4gUmVzdGFydGluZy4uLlwiLCBsb2dnZXIuX3Nob3dVcmwodGhpcy5zcmMpKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiA9IHRoaXMuYXVkaW8uY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX3Jlc3RhcnQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBlcnJvciA9IG5ldyBQbGF5YmFja0Vycm9yKHRoaXMuYXVkaW8uZXJyb3JcbiAgICAgICAgICAgID8gUGxheWJhY2tFcnJvci5odG1sNVt0aGlzLmF1ZGlvLmVycm9yLmNvZGVdXG4gICAgICAgICAgICA6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IGUsXG4gICAgICAgIHRoaXMuc3JjKTtcblxuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SLCBlcnJvcik7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC/0LDRg9C30YtcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZVBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmVuZGVkKSB7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSk7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC4INC00LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQuNGFINGB0L7QsdGL0YLQuNC5INC00LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9pbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCU0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRgdC70YPRiNCw0YLQtdC70LXQuSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60LjRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXROYXRpdmVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19vbk5hdGl2ZVBhdXNlKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX29uTmF0aXZlUGxheSk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VOREVELCB0aGlzLl9fb25OYXRpdmVFbmRlZCk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUsIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0RVUkFUSU9OLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HLCB0aGlzLl9fb25OYXRpdmVMb2FkaW5nKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19vbk5hdGl2ZUVycm9yKTtcbn07XG5cbi8qKlxuICog0JTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2RlaW5pdE5hdGl2ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvINC4INC90LDQt9C90LDRh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXRBdWRpbyA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfaW5pdEF1ZGlvXCIpO1xuXG4gICAgdGhpcy5tdXRlRXZlbnRzKCk7XG5cbiAgICB0aGlzLmF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImF1ZGlvXCIpO1xuICAgIHRoaXMuYXVkaW8ubG9vcCA9IGZhbHNlOyAvLyBmb3IgSUVcbiAgICB0aGlzLmF1ZGlvLnByZWxvYWQgPSB0aGlzLmF1ZGlvLmF1dG9idWZmZXIgPSBcImF1dG9cIjsgLy8gMTAwJVxuICAgIHRoaXMuYXVkaW8uYXV0b3BsYXkgPSBmYWxzZTtcbiAgICB0aGlzLmF1ZGlvLnNyYyA9IFwiXCI7XG5cbiAgICB0aGlzLl9pbml0VXNlckV2ZW50cygpO1xuICAgIHRoaXMuX19pbml0TGlzdGVuZXIgPSBBdWRpb0hUTUw1TG9hZGVyLl9kZWZhdWx0SW5pdExpc3RlbmVyO1xuXG4gICAgdGhpcy5faW5pdE5hdGl2ZUV2ZW50cygpO1xufTtcblxuLyoqXG4gKiDQntGC0LrQu9GO0YfQtdC90LjQtSDQvtCx0YDQsNCx0L7RgtGH0LjQutC+0LIg0YHQvtCx0YvRgtC40Lkg0Lgg0YPQtNCw0LvQtdC90LjQtSDQvtCx0YrQtdC60YLQsCBBdWRpb1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2RlaW5pdEF1ZGlvID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9kZWluaXRBdWRpb1wiKTtcblxuICAgIHRoaXMubXV0ZUV2ZW50cygpO1xuXG4gICAgdGhpcy5fZGVpbml0VXNlckV2ZW50cygpO1xuICAgIHRoaXMuX2RlaW5pdE5hdGl2ZUV2ZW50cygpO1xuXG4gICAgdGhpcy5hdWRpbyA9IG51bGw7XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC+0LHRitC10LrRgtCwIEF1ZGlvLiDQlNC70Y8g0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LvRjtCx0L7QtSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7QtSDQtNC10LnRgdGC0LLQuNC1LlxuICpcbiAqINCh0L7QstC10YDRiNC10L3QvdC+INGN0LfQvtGC0LXRgNC40YfQvdGL0Lkg0Lgg0LzQsNCz0LjRh9C10YHQutC40Lkg0LzQtdGC0L7QtC4g0JTQu9GPINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsCDRgtGA0LXQsdGD0LXRgtGB0Y8g0LLRi9C30YvQstCw0YLRjCDQvNC10YLQvtC0IHBsYXkg0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtVxuICog0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRjy4g0J/QvtGB0LvQtSDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRjyDQv9C+0YHRgtCw0LLQuNGC0Ywg0L/Qu9C10LXRgCDQvtCx0YDQsNGC0L3QviDQvdCwINC/0LDRg9C30YMsINGCLtC6LiDQvdC10LrQvtGC0L7RgNGL0LUg0LHRgNCw0YPQt9C10YDRi1xuICog0LIg0L/RgNC+0YLQuNCy0L3QvtC8INGB0LvRg9GH0LDQtSDQvdCw0YfQuNC90LDRjtGCINC/0YDQvtC40LPRgNGL0LLQsNGC0Ywg0YLRgNC10Log0LDQstGC0L7QvNCw0YLQuNGH0LXRgdC60Lgg0LrQsNC6INGC0L7Qu9GM0LrQviDQvtC9INC30LDQs9GA0YPQttCw0LXRgtGB0Y8uINCf0YDQuCDRjdGC0L7QvCDQsiDQvdC10LrQvtGC0L7RgNGL0YUg0LHRgNCw0YPQt9C10YDQsNGFXG4gKiDQv9C+0YHQu9C1INCy0YvQt9C+0LLQsCDQvNC10YLQvtC00LAgbG9hZCDRgdC+0LHRi9GC0LjQtSBwbGF5INC90LjQutC+0LPQtNCwINC90LUg0L3QsNGB0YLRg9C/0LDQtdGCLCDRgtCw0Log0YfRgtC+INC/0YDQuNGF0L7QtNC40YLRgdGPINGB0LvRg9GI0LDRgtGMINGB0L7QsdGL0YLQuNGPINC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICog0LjQu9C4INC+0YjQuNCx0LrQuCDQt9Cw0LPRgNGD0LfQutC4ICjQtdGB0LvQuCBzcmMg0L3QtSDRg9C60LDQt9Cw0L0pLiDQkiDQvdC10LrQvtGC0L7RgNGL0YUg0LHRgNCw0YPQt9C10YDQsNGFINGC0LDQutC20LUg0LzQvtC20LXRgiDQvdC1INC90LDRgdGC0YPQv9C40YLRjCDRgdC+0LHRi9GC0LjQtSBwYXVzZS4g0J/RgNC4INGN0YLQvtC8XG4gKiDRgdGC0L7QuNGCINC10YnRkSDRg9GH0LjRgtGL0LLQsNGC0YwsINGH0YLQviDRgtGA0LXQuiDQvNC+0LbQtdGCINCz0YDRg9C30LjRgtGM0YHRjyDQuNC3INC60LXRiNCwLCDRgtC+0LPQtNCwINGB0L7QsdGL0YLQuNGPINC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsC3QtNCw0L3QvdGL0YUg0Lgg0LLQvtC30LzQvtC20L3QvtGB0YLQuFxuICog0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPINC80L7Qs9GD0YIg0LLQvtC30L3QuNC60L3Rg9GC0Ywg0LHRi9GB0YLRgNC10LUg0YHQvtCx0YvRgtC40Y8gcGxheSDQuNC70LggcGF1c2UsINGC0LDQuiDRh9GC0L4g0L3Rg9C20L3QviDQv9GA0LXQtNGD0YHQvNCw0YLRgNC40LLQsNGC0Ywg0L/RgNC10YDRi9Cy0LDQvdC40LUg0L/RgNC+0YbQtdGB0YHQsFxuICog0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fc3RhcnR1cEF1ZGlvID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zdGFydHVwQXVkaW9cIik7XG5cbiAgICB0aGlzLl9kZWluaXRVc2VyRXZlbnRzKCk7XG5cbiAgICAvL0lORk86INC/0L7RgdC70LUg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40L7QvdC90L7Qs9C+INCy0YvQt9C+0LLQsCBwbGF5INC90YPQttC90L4g0LTQvtC20LTQsNGC0YzRgdGPINGB0L7QsdGL0YLQuNGPINC4INCy0YvQt9Cy0LDRgtGMIHBhdXNlLlxuICAgIHRoaXMuX19pbml0TGlzdGVuZXIgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmICghdGhpcy5fX2luaXRMaXN0ZW5lcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgICAgICAvL0lORk86INC/0L7RgdC70LUg0LLRi9C30L7QstCwIHBhdXNlINC90YPQttC90L4g0LTQvtC20LTQsNGC0YzRgdGPINGB0L7QsdGL0YLQuNGPLCDQt9Cw0LLQtdGA0YjQuNGC0Ywg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y4g0Lgg0YDQsNC30YDQtdGI0LjRgtGMINC/0LXRgNC10LTQsNGH0YMg0YHQvtCx0YvRgtC40LlcbiAgICAgICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0TGlzdGVuZXI7XG4gICAgICAgICAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJfc3RhcnR1cEF1ZGlvOnJlYWR5XCIpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX19pbml0TGlzdGVuZXIuc3RlcCA9IFwicGF1c2VcIjtcblxuICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICBBdWRpb0hUTUw1TG9hZGVyLl9jYXRjaFByb21pc2UodGhpcy5hdWRpby5wYXVzZSgpKTtcblxuICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3N0YXJ0dXBBdWRpbzpwbGF5XCIsIGUudHlwZSk7XG4gICAgfS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19pbml0TGlzdGVuZXIuc3RlcCA9IFwicGxheVwiO1xuXG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIC8vSU5GTzog0L/QtdGA0LXQtCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQtdC8INC+0LHRitC10LrRgiBBdWRpbyDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNGC0YwsINCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRj1xuICAgIEF1ZGlvSFRNTDVMb2FkZXIuX2NhdGNoUHJvbWlzZSh0aGlzLmF1ZGlvLmxvYWQoKSk7XG4gICAgQXVkaW9IVE1MNUxvYWRlci5fY2F0Y2hQcm9taXNlKHRoaXMuYXVkaW8ucGxheSgpKTtcbn07XG5cbi8qKlxuICog0JXRgdC70Lgg0LzQtdGC0L7QtCBfc3RhcnRQbGF5INCy0YvQt9Cy0LDQvSDRgNCw0L3RjNGI0LUsINGH0LXQvCDQt9Cw0LrQvtC90YfQuNC70LDRgdGMINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPLCDQvdGD0LbQvdC+INC+0YLQvNC10L3QuNGC0Ywg0YLQtdC60YPRidC40Lkg0YjQsNCzINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2JyZWFrU3RhcnR1cCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcbiAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuXG4gICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiX3N0YXJ0dXBBdWRpbzppbnRlcnJ1cHRlZFwiLCB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsIHJlYXNvbik7XG4gICAgZGVsZXRlIHRoaXMuX19pbml0TGlzdGVuZXI7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQtdGC0L7QtNGLINC+0LbQuNC00LDQvdC40Y8g0YDQsNC30LvQuNGH0L3Ri9GFINGB0L7QsdGL0YLQuNC5INC4INCz0LXQvdC10YDQsNGG0LjQuCDQvtCx0LXRidCw0L3QuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQvtC20LTQsNGC0YzRgdGPINC+0L/RgNC10LTQtdC70ZHQvdC90L7Qs9C+INGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0g0LjQvNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hlY2sgLSDQvNC10YLQvtC0INC/0YDQvtCy0LXRgNC60LgsINGH0YLQviDQvNGLINC90LDRhdC+0LTQuNC80YHRjyDQsiDQvdGD0LbQvdC+0Lwg0YHQvtGB0YLQvtGP0L3QuNC4XG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBsaXN0ZW4gLSDRgdC/0LjRgdC+0Log0YHQvtCx0YvRgtC40LksINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQtdGCINGB0LzQtdC90LjRgtGM0YHRjyDRgdC+0YHRgtC+0Y/QvdC40LVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3dhaXRGb3IgPSBmdW5jdGlvbihuYW1lLCBjaGVjaywgbGlzdGVuKSB7XG4gICAgaWYgKCF0aGlzLnByb21pc2VzW25hbWVdKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLnByb21pc2VzW25hbWVdID0gZGVmZXJyZWQ7XG5cbiAgICAgICAgaWYgKGNoZWNrLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChjaGVjay5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBjbGVhckxpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3Rlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFyTGlzdGVuZXJzLCBjbGVhckxpc3RlbmVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tuYW1lXS5wcm9taXNlKCk7XG59O1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQvtC20LjQtNCw0L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSDQuNC80Y8g0YHQvtGB0YLQvtGP0L3QuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC+0LbQuNC00LDQvdC40Y9cbiAqIEB0b2RvIHJlYXNvbiDRgdC00LXQu9Cw0YLRjCDQvdCw0YHQu9C10LTQvdC40LrQvtC8INC60LvQsNGB0YHQsCBFcnJvclxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2NhbmNlbFdhaXQgPSBmdW5jdGlvbihuYW1lLCByZWFzb24pIHtcbiAgICB2YXIgcHJvbWlzZTtcbiAgICBpZiAocHJvbWlzZSA9IHRoaXMucHJvbWlzZXNbbmFtZV0pIHtcbiAgICAgICAgZGVsZXRlIHRoaXMucHJvbWlzZXNbbmFtZV07XG4gICAgICAgIHByb21pc2UucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LLRgdC10YUg0L7QttC40LTQsNC90LjQuVxuICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvbiAtINC/0YDQuNGH0LjQvdCwINC+0YLQvNC10L3RiyDQvtC20LjQtNCw0L3QuNGPXG4gKiBAdG9kbyByZWFzb24g0YHQtNC10LvQsNGC0Ywg0L3QsNGB0LvQtdC00L3QuNC60L7QvCDQutC70LDRgdGB0LAgRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9hYm9ydFByb21pc2VzID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMucHJvbWlzZXMpIHtcbiAgICAgICAgaWYgKHRoaXMucHJvbWlzZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChrZXksIHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LPQvtGC0L7QstC90L7RgdGC0Lgg0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VNZXRhZGF0YUV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCBBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5yZWFkeVN0YXRlID4gdGhpcy5hdWRpby5IQVZFX01FVEFEQVRBO1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dhaXRGb3IoXCJtZXRhZGF0YVwiLCB0aGlzLl9wcm9taXNlTWV0YWRhdGFDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZU1ldGFkYXRhRXZlbnRzKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC30LDQs9GA0YPQt9C60Lgg0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZUxvYWRlZEV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0LfQsNCz0YDRg9C20LXQvdCwINC90YPQttC90LDRjyDRh9Cw0YHRgtGMINGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWRDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX19sb2FkZXJUaW1lciA9IHRoaXMuX19sb2FkZXJUaW1lciAmJiBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRlclRpbWVyKSB8fCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcImxvYWRlZFwiLCBcInRpbWVvdXRcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgNTAwMCk7XG5cbiAgICAvL0lORk86INC/0L7Qt9C40YbQuNGOINC90YPQttC90L4g0LHRgNCw0YLRjCDRgSDQsdC+0LvRjNGI0LjQvCDQt9Cw0L/QsNGB0L7QvCwg0YIu0LouINC00LDQvdC90YvQtSDQt9Cw0L/QuNGB0LDQvdGLINCx0LvQvtC60LDQvNC4INC4INC90LDQvCDQvdGD0LbQvdC+INC00L7QttC00LDRgtGM0YHRjyDQt9Cw0LPRgNGD0LfQutC4INCx0LvQvtC60LBcbiAgICB2YXIgbG9hZGVkID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDQ1LCB0aGlzLmF1ZGlvLmR1cmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5idWZmZXJlZC5sZW5ndGhcbiAgICAgICAgJiYgdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApID49IGxvYWRlZDtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRGb3IoXCJsb2FkZWRcIiwgdGhpcy5fcHJvbWlzZUxvYWRlZENoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTG9hZGVkRXZlbnRzKTtcblxuICAgIGlmICghcHJvbWlzZS5jbGVhblRpbWVyKSB7XG4gICAgICAgIHByb21pc2UuY2xlYW5UaW1lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fX2xvYWRlclRpbWVyID0gY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkZXJUaW1lcik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgcHJvbWlzZS50aGVuKHByb21pc2UuY2xlYW5UaW1lciwgcHJvbWlzZS5jbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC/0YDQvtC40LPRgNGL0LLQsNC90LjRjyDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5INC/0LvQtdC10YDQsCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20L3QviDQvtC20LjQtNCw0YLRjCDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QviDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlUGxheWluZ0V2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0L/RgNC+0LjQs9GA0YvQstCw0LXRgtGB0Y8g0L3Rg9C20L3QsNGPINGH0LDRgdGC0Ywg0YLRgNC10LrQsFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmdDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aW1lID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDAuMiwgdGhpcy5hdWRpby5kdXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPj0gdGltZTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcInBsYXlpbmdcIiwgdGhpcy5fcHJvbWlzZVBsYXlpbmdDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZVBsYXlpbmdFdmVudHMpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LLQtdC00LXQvdC40Y8sINC/0LXRgNC10LfQsNC/0YPRgdC6INGC0YDQtdC60LAsINC10YHQu9C4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQvdC1INC90LDRh9Cw0LvQvtGB0YxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VTdGFydFBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0gPSBkZWZlcnJlZDtcblxuICAgICAgICAvL0lORk86INC10YHQu9C4INC+0YLQvNC10L3QtdC90L4g0L7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC40LvQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8sINGC0L4g0L3Rg9C20L3QviDQvtGC0LzQtdC90LjRgtGMINC4INGN0YLQviDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgcmVhc29uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHZhciB0aW1lcjtcbiAgICAgICAgdmFyIHJlYWR5ID0gZmFsc2U7XG4gICAgICAgIHZhciBjbGVhblRpbWVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3Byb21pc2VQbGF5aW5nKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RhcnRQbGF5aW5nOnN1Y2Nlc3NcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVqZWN0KTtcblxuICAgICAgICB0aGlzLl9wcm9taXNlTG9hZGVkKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChyZWFkeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJwbGF5aW5nXCIsIFwidGltZW91dFwiKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInN0YXJ0UGxheWluZzpmYWlsZWRcIik7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIDUwMDApO1xuICAgICAgICB9LmJpbmQodGhpcyksIHJlamVjdCk7XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZVBsYXlpbmcoKS50aGVuKGNsZWFuVGltZXIsIGNsZWFuVGltZXIpO1xuICAgICAgICBkZWZlcnJlZC5wcm9taXNlKCkudGhlbihjbGVhblRpbWVyLCBjbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXS5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0Y3Qu9C10LzQtdC90YLQvtC8IEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGH0LDRgtGMINC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyY1xuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImxvYWRcIiwgc3JjKTtcblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoXCJsb2FkXCIpO1xuICAgIHRoaXMuX2JyZWFrU3RhcnR1cChcImxvYWRcIik7XG5cbiAgICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgdGhpcy5ub3RMb2FkaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gc3JjO1xuICAgIEF1ZGlvSFRNTDVMb2FkZXIuX2NhdGNoUHJvbWlzZSh0aGlzLmF1ZGlvLmxvYWQoKSk7XG59O1xuXG4vKiog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzdG9wXCIpO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcInN0b3BcIik7XG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwic3RvcFwiKTtcblxuICAgIHRoaXMubG9hZChcIlwiKTtcbn07XG5cbi8qKlxuICog0J3QsNGH0LDRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fc3RhcnRQbGF5ID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zdGFydFBsYXlcIik7XG5cbiAgICB0aGlzLmF1ZGlvLmN1cnJlbnRUaW1lID0gdGhpcy5wb3NpdGlvbjtcblxuICAgIGlmICghdGhpcy5wbGF5aW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJzdGFydFBsYXlcIik7XG4gICAgQXVkaW9IVE1MNUxvYWRlci5fY2F0Y2hQcm9taXNlKHRoaXMuYXVkaW8ucGxheSgpKTtcblxuICAgIC8vVEhJTks6INC90YPQttC90L4g0LvQuCDRgtGA0LjQs9Cz0LXRgNC40YLRjCDRgdC+0LHRi9GC0LjQtSDQsiDRgdC70YPRh9Cw0LUg0YPRgdC/0LXRhdCwXG4gICAgdGhpcy5fcHJvbWlzZVN0YXJ0UGxheWluZygpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucmV0cnkgPSAwO1xuICAgIH0uYmluZCh0aGlzKSwgdGhpcy5fX3Jlc3RhcnQpO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC30LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IFtyZWFzb25dIC0g0LXRgdC70Lgg0L/RgNC40YfQuNC90LAg0LLRi9C30L7QstCwINGD0LrQsNC30LDQvdCwINC4INC90LUg0YDQsNCy0L3QsCBcInRpbWVvdXRcIiDQvdC40YfQtdCz0L4g0L3QtSDQv9GA0L7QuNGB0YXQvtC00LjRglxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Jlc3RhcnQgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9yZXN0YXJ0XCIsIHJlYXNvbiwgdGhpcy5wb3NpdGlvbiwgdGhpcy5wbGF5aW5nKTtcblxuICAgIGlmICghdGhpcy5zcmMgfHwgcmVhc29uICYmIHJlYXNvbiAhPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucmV0cnkrKztcblxuICAgIGlmICh0aGlzLnJldHJ5ID4gNSkge1xuICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SLCBuZXcgUGxheWJhY2tFcnJvcihQbGF5YmFja0Vycm9yLkRPTlRfU1RBUlQsIHRoaXMuc3JjKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL0lORk86INCX0LDQv9C+0LzQuNC90LDQtdC8INGC0LXQutGD0YnQtdC1INGB0L7RgdGC0L7Rj9C90LjQtSwg0YIu0LouINC+0L3QviDRgdCx0YDQvtGB0LjRgtGB0Y8g0L/QvtGB0LvQtSDQv9C10YDQtdC30LDQs9GA0YPQt9C60LhcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgIHZhciBwbGF5aW5nID0gdGhpcy5wbGF5aW5nO1xuXG4gICAgdGhpcy5sb2FkKHRoaXMuc3JjKTtcblxuICAgIGlmIChwbGF5aW5nKSB7XG4gICAgICAgIHRoaXMuX3BsYXkocG9zaXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgIH1cbn07XG5cbi8qKlxuICog0JLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LAv0L7RgtC80LXQvdCwINC/0LDRg9C30YtcbiAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJwbGF5XCIsIHBvc2l0aW9uKTtcbiAgICB0aGlzLnJldHJ5ID0gMDtcbiAgICByZXR1cm4gdGhpcy5fcGxheShwb3NpdGlvbik7XG59O1xuXG4vKipcbiAqINCS0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwL9C+0YLQvNC10L3QsCDQv9Cw0YPQt9GLIC0g0LLQvdGD0YLRgNC10L3QvdC40Lkg0LzQtdGC0L7QtFxuICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wbGF5ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BsYXlcIiwgcG9zaXRpb24pO1xuXG4gICAgaWYgKHRoaXMucGxheWluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwicGxheVwiKTtcblxuICAgIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgICB0aGlzLnBsYXlpbmcgPSB0cnVlO1xuICAgIHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbiA9PSBudWxsID8gdGhpcy5wb3NpdGlvbiB8fCAwIDogcG9zaXRpb247XG4gICAgdGhpcy5fcHJvbWlzZU1ldGFkYXRhKCkudGhlbih0aGlzLl9fc3RhcnRQbGF5LCBub29wKTtcbn07XG5cbi8qKiDQn9Cw0YPQt9CwICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJwYXVzZVwiKTtcblxuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy5fY2FuY2VsV2FpdChcInN0YXJ0UGxheWluZ1wiLCBcInBhdXNlXCIpO1xuICAgIHRoaXMuX2JyZWFrU3RhcnR1cChcInBhdXNlXCIpO1xuXG4gICAgQXVkaW9IVE1MNUxvYWRlci5fY2F0Y2hQcm9taXNlKHRoaXMuYXVkaW8ucGF1c2UoKSk7XG4gICAgdGhpcy5wb3NpdGlvbiA9IHRoaXMuYXVkaW8uY3VycmVudFRpbWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0UG9zaXRpb25cIiwgcG9zaXRpb24pO1xuXG4gICAgaWYgKCFpc0Zpbml0ZShwb3NpdGlvbikpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRQb3NpdGlvbkZhaWxlZFwiLCBwb3NpdGlvbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XG5cbiAgICB0aGlzLl9wcm9taXNlTWV0YWRhdGEoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmF1ZGlvLmN1cnJlbnRUaW1lID0gdGhpcy5wb3NpdGlvbjtcbiAgICB9LmJpbmQodGhpcyksIG5vb3ApO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC60LvRjtGH0LXQvdC40LUv0L7RgtC60LvRjtGH0LXQvdC40LUg0LjRgdGC0L7Rh9C90LjQutCwINC00LvRjyBXZWIgQXVkaW8gQVBJXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqINCS0LrQu9GO0YfQuNGC0Ywg0YDQtdC20LjQvCBjcm9zc0RvbWFpbiDQtNC70Y8gSFRNTDUg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LLQutC70Y7Rh9C40YLRjC/QstGL0LrQu9GO0YfQuNGC0YxcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUudG9nZ2xlQ3Jvc3NEb21haW4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmIChzdGF0ZSkge1xuICAgICAgICB0aGlzLmF1ZGlvLmNyb3NzT3JpZ2luID0gXCJhbm9ueW1vdXNcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUF0dHJpYnV0ZShcImNyb3NzT3JpZ2luXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jlc3RhcnQoKTtcbn07XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0LjRgdGC0L7Rh9C90LjQuiDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuICogISEh0JLQvdC40LzQsNC90LjQtSEhISAtINC/0YDQuCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQuCBXZWIgQXVkaW8gQVBJINCyINCx0YDQsNGD0LfQtdGA0LUg0YHRgtC+0LjRgiDRg9GH0LjRgtGL0LLQsNGC0YwsINGH0YLQviDQstGB0LUg0YLRgNC10LrQuCDQtNC+0LvQttC90Ysg0LvQuNCx0L4g0LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICog0YEg0YLQvtCz0L4g0LbQtSDQtNC+0LzQtdC90LAsINC70LjQsdC+INC00LvRjyDQvdC40YUg0LTQvtC70LbQvdGLINCx0YvRgtGMINC/0YDQsNCy0LjQu9GM0L3QviDQstGL0YHRgtCw0LLQu9C10L3RiyDQt9Cw0LPQvtC70L7QstC60LggQ09SUy5cbiAqINCf0YDQuCDQstGL0LfQvtCy0LUg0LTQsNC90L3QvtCz0L4g0LzQtdGC0L7QtNCwINGC0YDQtdC6INCx0YPQtNC10YIg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvVxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtINC60L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5jcmVhdGVTb3VyY2UgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQpIHtcbiAgICBpZiAodGhpcy5vdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVTb3VyY2VcIik7XG5cbiAgICB2YXIgbmVlZFJlc3RhcnQgPSAhdGhpcy5hdWRpby5jcm9zc09yaWdpbjtcblxuICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgIHRoaXMub3V0cHV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZSh0aGlzLmF1ZGlvKTtcbiAgICB0aGlzLm91dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICBpZiAobmVlZFJlc3RhcnQpIHtcbiAgICAgICAgdGhpcy5fcmVzdGFydCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPQtNCw0LvQuNGC0Ywg0LjRgdGC0L7Rh9C90LjQuiDQtNC70Y8gV2ViIEF1ZGlvIEFQSS4g0KPQtNCw0LvRj9C10YIg0LjRgdGC0L7Rh9C90LjQuiwg0L/QtdGA0LXRgdC+0LfQtNCw0ZHRgiDQvtCx0YrQtdC60YIgQXVkaW8uXG4gKiAhISHQktC90LjQvNCw0L3QuNC1ISEhIC0g0JTQsNC90L3Ri9C5INC80LXRgtC+0LQg0LzQvtC20L3QviDQstGL0LfRi9Cy0LDRgtGMINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8sINGCLtC6LiDRgdCy0LXQttC10YHQvtC30LTQsNC90L3Ri9C5XG4gKiDRjdC70LXQvNC10L3RgiBBdWRpbyDQvdGD0LbQvdC+INC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMIC0g0LjQvdCw0YfQtSDQsdGD0LTQtdGCINC90LXQtNC+0YHRgtGD0L/QvdC+INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtS4g0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0Y3Qu9C10LzQtdC90YLQsFxuICogQXVkaW8g0LLQvtC30LzQvtC20L3QsCDRgtC+0LvRjNC60L4g0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPICjQutC70LjQuiwg0YLQsNGHLdGB0L7QsdGL0YLQuNC1INC40LvQuCDQutC70LDQstC40LDRgtGD0YDQvdC+0LUg0YHQvtCx0YvRgtC40LUpXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3lTb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgICAvL0lORk86INC10LTQuNC90YHRgtCy0LXQvdC90YvQuSDRgdC/0L7RgdC+0LEg0L7RgtC+0YDQstCw0YLRjCBNZWRpYUVsZW1lbnRTb3VyY2Ug0L7RgiBBdWRpbyAtINGB0L7Qt9C00LDRgtGMINC90L7QstGL0Lkg0L7QsdGK0LXQutGCIEF1ZGlvXG5cbiAgICBpZiAoIXRoaXMub3V0cHV0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIud2Fybih0aGlzLCBcImRlc3Ryb3lTb3VyY2VcIik7XG5cbiAgICB0aGlzLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImRlc3Ryb3lcIik7XG5cbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuICAgIHRoaXMuX2luaXRBdWRpbygpO1xuICAgIHRoaXMuX3N0YXJ0dXBBdWRpbygpO1xuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0LTQsNC70LXQvdC40LUg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINC4INC+0LHRitC10LrRgtCwIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQo9C00LDQu9C10L3QuNC1INCy0YHQtdGFINC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDQuCDQvtCx0YrQtdC60YLQsCBBdWRpby4g0J/QvtGB0LvQtSDQstGL0LfQvtCy0LAg0LTQsNC90L3QvtCz0L4g0LzQtdGC0L7QtNCwINGN0YLQvtGCINC+0LHRitC10LrRgiDQsdGD0LTQtdGCINC90LXQu9GM0LfRjyDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiZGVzdHJveVwiKTtcblxuICAgIGlmICh0aGlzLm91dHB1dCkge1xuICAgICAgICB0aGlzLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIHRoaXMub3V0cHV0ID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKCk7XG4gICAgdGhpcy5fZGVpbml0QXVkaW8oKTtcblxuICAgIHRoaXMuX19yZXN0YXJ0ID0gbnVsbDtcbiAgICB0aGlzLl9fc3RhcnRQbGF5ID0gbnVsbDtcbiAgICB0aGlzLnByb21pc2VzID0gbnVsbDtcbn07XG5cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBpbml0OiAhIXRoaXMuX19pbml0TGlzdGVuZXIgJiYgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwLFxuICAgICAgICBzcmM6IGxvZ2dlci5fc2hvd1VybCh0aGlzLnNyYyksXG4gICAgICAgIHBsYXlpbmc6IHRoaXMucGxheWluZyxcbiAgICAgICAgZW5kZWQ6IHRoaXMuZW5kZWQsXG4gICAgICAgIG5vdExvYWRpbmc6IHRoaXMubm90TG9hZGluZyxcbiAgICAgICAgcG9zaXRpb246IHRoaXMucG9zaXRpb25cbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0hUTUw1TG9hZGVyO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSByZXF1aXJlKCcuL2F1ZGlvLWh0bWw1LWxvYWRlcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IEhUTUw1IEF1ZGlvINC4IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0cy5hdmFpbGFibGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCR0LDQt9C+0LLQsNGPINC/0YDQvtCy0LXRgNC60LAg0L/QvtC00LTQtdGA0LbQutC4INCx0YDQsNGD0LfQtdGA0L7QvFxuICAgIHZhciBodG1sNV9hdmFpbGFibGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIC8vc29tZSBicm93c2VycyBkb2Vzbid0IHVuZGVyc3RhbmQgbmV3IEF1ZGlvKClcbiAgICAgICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICAgICAgdmFyIGNhblBsYXkgPSBhdWRpby5jYW5QbGF5VHlwZShcImF1ZGlvL21wZWdcIik7XG4gICAgICAgIGlmICghY2FuUGxheSB8fCBjYW5QbGF5ID09PSAnbm8nKSB7XG5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIHJlYXNvblwiLCBjYW5QbGF5KTtcbiAgICAgICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIGVycm9yXCIsIGUpO1xuICAgICAgICBodG1sNV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBodG1sNV9hdmFpbGFibGUpO1xuICAgIHJldHVybiBodG1sNV9hdmFpbGFibGU7XG59KSgpO1xuXG5pZiAoZGV0ZWN0LnBsYXRmb3JtLm1vYmlsZSB8fCBkZXRlY3QucGxhdGZvcm0udGFibGV0KSB7XG4gICAgYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBhbGxvd2VkIGZvciBtb2JpbGVcIik7XG59IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgY29udGV4dCBjcmVhdGVkXCIpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBkZXRlY3RlZFwiKTtcbiAgICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGh0bWw1INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfU1dBUFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FUlJPUlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuICAgIHRoaXMub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCAhPT0gQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gZmFsc2U7XG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAwO1xuICAgIHRoaXMudm9sdW1lID0gMTtcbiAgICB0aGlzLmxvYWRlcnMgPSBbXTtcblxuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuXG4gICAgdGhpcy5fc2V0QWN0aXZlKDApO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1KTtcbmV4cG9ydHMudHlwZSA9IEF1ZGlvSFRNTDUudHlwZSA9IEF1ZGlvSFRNTDUucHJvdG90eXBlLnR5cGUgPSBcImh0bWw1XCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQoNCw0LHQvtGC0LAg0YEg0LfQsNCz0YDRg9C30YfQuNC60LDQvNC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQvtCx0LDQstC40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0LDRg9C00LjQvi3RhNCw0LnQu9C+0LJcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9hZGRMb2FkZXIgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZExvYWRlclwiKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbG9hZGVyID0gbmV3IEF1ZGlvSFRNTDVMb2FkZXIoKTtcbiAgICBsb2FkZXIuaW5kZXggPSB0aGlzLmxvYWRlcnMucHVzaChsb2FkZXIpIC0gMTtcblxuICAgIGxvYWRlci5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IChzZWxmLmxvYWRlcnMubGVuZ3RoICsgbG9hZGVyLmluZGV4IC0gc2VsZi5hY3RpdmVMb2FkZXIpICUgc2VsZi5sb2FkZXJzLmxlbmd0aDtcbiAgICAgICAgc2VsZi50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9hZGVyLmNyZWF0ZVNvdXJjZShhdWRpb0NvbnRleHQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LDQutGC0LjQstC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9zZXRBY3RpdmUgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldEFjdGl2ZVwiLCBvZmZzZXQpO1xuXG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAodGhpcy5hY3RpdmVMb2FkZXIgKyBvZmZzZXQpICUgdGhpcy5sb2FkZXJzLmxlbmd0aDtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgLy9JTkZPOiDQtdGB0LvQuCDRgNC10LvQuNC30L7QstGL0LLQsNGC0Ywg0LrQvtC90YbQtdC/0YbQuNGOINC80L3QvtC20LXRgdGC0LLQsCDQt9Cw0LPRgNGD0LfRh9C40LrQvtCyLCDRgtC+INGN0YLQviDQvdGD0LbQvdC+INC00L7RgNCw0LHQvtGC0LDRgtGMLlxuICAgICAgICB0aGlzLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INC4INC+0YLQv9C40YHQsNGC0Ywg0LXQs9C+INC+0YIg0YHQvtCx0YvRgtC40Lkg0YHRgtCw0YDRgtCwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtBdWRpb31cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9nZXRMb2FkZXIgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcbiAgICByZXR1cm4gdGhpcy5sb2FkZXJzWyh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoXTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LTQutC70Y7Rh9C10L3QuNC1IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JLQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCBDT1JTLiAqKirQktCQ0JbQndCeISoqKiAtINC10YHQu9C4INCy0LrQu9GO0YfQuNGC0Ywg0YDQtdC20LjQvCBDT1JTLCDQsNGD0LTQuNC+INGN0LvQtdC80LXQvdGCINC90LUg0YHQvNC+0LbQtdGCINC30LDQs9GA0YPQttCw0YLRjCDQtNCw0L3QvdGL0LUg0YHQvlxuICog0YHRgtC+0YDQvtC90L3QuNGFINC00L7QvNC10L3QvtCyLCDQtdGB0LvQuCDQsiDQvtGC0LLQtdGC0LUg0L3QtSDQsdGD0LTQtdGCINC/0YDQsNCy0LjQu9GM0L3QvtCz0L4g0LfQsNCz0L7Qu9C+0LLQutCwIEFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbi4g0JXRgdC70Lgg0L3QtSDQv9C70LDQvdC40YDRg9C10YLRgdGPXG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQtSBXZWIgQXVkaW8gQVBJLCDQvdC1INGB0YLQvtC40YIg0LLQutC70Y7Rh9Cw0YLRjCDRjdGC0L7RgiDRgNC10LbQuNC8LlxuICogQHBhcmFtIHN0YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgbG9hZGVyLnRvZ2dsZUNyb3NzRG9tYWluKHN0YXRlKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICpcbiAqICoq0JLQvdC40LzQsNC90LjQtSEqKiAtINC/0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoIWF1ZGlvQ29udGV4dCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRXJyb3JcIiwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSVwiLCBzdGF0ZSk7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSA9PSBzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICAgICAgbG9hZGVyLmF1ZGlvLnZvbHVtZSA9IDE7XG4gICAgICAgICAgICBsb2FkZXIuY3JlYXRlU291cmNlKGF1ZGlvQ29udGV4dCk7XG5cbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMucHJlcHJvY2Vzc29yID8gdGhpcy5wcmVwcm9jZXNzb3IuaW5wdXQgOiB0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5hdWRpb091dHB1dCkge1xuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuYXVkaW9PdXRwdXQ7XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDRgtC+0LPQviDQutCw0Log0LzRiyDQstC60LvRjtGH0LjQu9C4IHdlYkF1ZGlvQVBJINC10LPQviDRg9C20LUg0L3QtdC70YzQt9GPINC/0YDQvtGB0YLQviDRgtCw0Log0LLRi9C60LvRjtGH0LjRgtGMLlxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG59O1xuXG4vKipcbiAqINCf0L7QtNC60LvRjtGH0LXQvdC40LUg0LDRg9C00LjQviDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsC4g0JLRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6INCw0YPQtNC40L4t0Y3Qu9C10LzQtdC90YLRgyDRgyDQutC+0YLQvtGA0L7Qs9C+INCy0YvRgdGC0LDQstC70LXQvdCwXG4gKiAxMDAlINCz0YDQvtC80LrQvtGB0YLRjC4g0JLRi9GF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0LogR2Fpbk5vZGUsINC60L7RgtC+0YDQsNGPINGA0LXQs9GD0LvQuNGA0YPQtdGCINC40YLQvtCz0L7QstGD0Y4g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcGFyYW0ge0F1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yfSBwcmVwcm9jZXNzb3IgLSDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YBcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDRgdGC0LDRgtGD0YEg0YPRgdC/0LXRhdCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgaWYgKCF0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JFcnJvclwiLCBwcmVwcm9jZXNzb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3NvciA9PT0gcHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHRoaXMucHJlcHJvY2Vzc29yID0gcHJlcHJvY2Vzc29yO1xuXG4gICAgaWYgKCFwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChwcmVwcm9jZXNzb3IuaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgcHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QuNCz0YDQsNGC0Ywg0YLRgNC10LpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlcIiwgc3JjKTtcblxuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcblxuICAgIGxvYWRlci5sb2FkKHNyYyk7XG4gICAgbG9hZGVyLnBsYXkoMCk7XG59O1xuXG4vKiog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRgyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuICAgIGxvYWRlci5wYXVzZSgpO1xufTtcblxuLyoqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRiyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInJlc3VtZVwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKCk7XG4gICAgbG9hZGVyLnBsYXkoKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic3RvcFwiLCBvZmZzZXQpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0IHx8IDApO1xuICAgIGxvYWRlci5zdG9wKCk7XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1RPUCwgb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcigpLmF1ZGlvLmN1cnJlbnRUaW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcbiAgICB0aGlzLl9nZXRMb2FkZXIoKS5zZXRQb3NpdGlvbihwb3NpdGlvbiAtIDAuMDAxKTsgLy9USElOSzogbGVnYWN5LdC60L7QtC4g0J/QvtC90Y/RgtGMINC90LDRhNC40LMg0YLRg9GCINC90YPQttC10L0gMC4wMDFcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcihvZmZzZXQpLmF1ZGlvLmR1cmF0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcblxuICAgIGlmIChsb2FkZXIuYXVkaW8uYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBsb2FkZXIuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gbG9hZGVyLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG4gICAgdGhpcy52b2x1bWUgPSB2b2x1bWU7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB2b2x1bWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIG9mZnNldCk7XG5cbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIGxvYWRlci5sb2FkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgcmV0dXJuIGxvYWRlci5zcmMgPT09IHNyYyAmJiAhbG9hZGVyLm5vdExvYWRpbmc7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgcmV0dXJuIGxvYWRlci5zcmMgPT09IHNyYztcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKCFsb2FkZXIuc3JjKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUob2Zmc2V0KTtcbiAgICBsb2FkZXIucGxheSgpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuc3JjO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBkZXRlY3Qub25seURldmljZVZvbHVtZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IGxvZ2dlci5fc2hvd1VybCh0aGlzLmdldFNyYygwKSksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IGxvZ2dlci5fc2hvd1VybCh0aGlzLmdldFNyYygxKSlcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxufTtcblxuZXhwb3J0cy5hdWRpb0NvbnRleHQgPSBhdWRpb0NvbnRleHQ7XG5leHBvcnRzLkF1ZGlvSW1wbGVtZW50YXRpb24gPSBBdWRpb0hUTUw1O1xuIiwidmFyIFlhbmRleEF1ZGlvID0gcmVxdWlyZSgnLi9leHBvcnQnKTtcbnJlcXVpcmUoJy4vZXJyb3IvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2xpYi9uZXQvZXJyb3IvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2xvZ2dlci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vZngvZXF1YWxpemVyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC92b2x1bWUvZXhwb3J0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWWFuZGV4QXVkaW87XG4iLCJ2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBINC00LvRjyDRg9C/0YDQsNCy0LvQtdC90LjRjyDQvtCx0LXRidCw0L3QuNC10LxcbiAqIEBleHBvcnRlZCB5YS5tdXNpYy5saWIuRGVmZXJyZWRcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRGVmZXJyZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KDQsNC30YDQtdGI0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZXNvbHZlXG4gICAgICAgICAqIEBwYXJhbSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIGVycm9yIC0g0L/QtdGA0LXQtNCw0YLRjCDQvtGI0LjQsdC60YNcbiAgICAgICAgICovXG4gICAgICAgIHNlbGYucmVqZWN0ID0gcmVqZWN0O1xuICAgIH0pO1xuXG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApOyAvLyBEb24ndCB0aHJvdyBlcnJvcnMgdG8gY29uc29sZVxuXG4gICAgLyoqXG4gICAgICog0J/QvtC70YPRh9C40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICogQG1ldGhvZCBEZWZlcnJlZCNwcm9taXNlXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgdGhpcy5wcm9taXNlID0gZnVuY3Rpb24oKSB7IHJldHVybiBwcm9taXNlOyB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEZWZlcnJlZDtcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoJy4uL2RhdGEvbWVyZ2UnKTtcblxudmFyIExJU1RFTkVSU19OQU1FID0gXCJfbGlzdGVuZXJzXCI7XG52YXIgTVVURV9PUFRJT04gPSBcIl9tdXRlZFwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5LlxuICogQGNsYXNzXG4gKiBAZXhwb3J0ZWQgeWEubXVzaWMubGliLkV2ZW50c1xuICovXG52YXIgRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgLyoqXG4gICAgICog0JrQvtC90YLQtdC50L3QtdGAINC00LvRjyDRgdC/0LjRgdC60L7QsiDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuS5cbiAgICAgKiBAYWxpYXMgQXVkaW8uRXZlbnRzI19saXN0ZW5lcnNcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxTdHJpbmcsIEFycmF5LjxGdW5jdGlvbj4+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpc1tMSVNURU5FUlNfTkFNRV0gPSB7fTtcblxuICAgIC8qKiDQpNC70LDQsyDQstC60LvRjtGH0LXQvdC40Y8v0LLRi9C60LvRjtGH0LXQvdC40Y8g0YHQvtCx0YvRgtC40LlcbiAgICAgKiBAYWxpYXMgRXZlbnRzI19tdXRlc1xuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpc1tNVVRFX09QVElPTl0gPSBmYWxzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQktGB0Y/Rh9C10YHQutC40Lkg0YHQsNGF0LDRgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0LrQu9Cw0YHRgSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNsYXNzQ29uc3RydWN0b3Ig0JrQvtC90YHRgtGA0YPQutGC0L7RgCDQutC70LDRgdGB0LAuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259INGC0L7RgiDQttC1INC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5LlxuICogQHN0YXRpY1xuICovXG5FdmVudHMubWl4aW4gPSBmdW5jdGlvbihjbGFzc0NvbnN0cnVjdG9yKSB7XG4gICAgbWVyZ2UoY2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIEV2ZW50cy5wcm90b3R5cGUsIHRydWUpO1xuICAgIHJldHVybiBjbGFzc0NvbnN0cnVjdG9yO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC+0LHRitC10LrRgiDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3Qg0J7QsdGK0LXQutGCLlxuICogQHJldHVybnMge09iamVjdH0g0YLQvtGCINC20LUg0L7QsdGK0LXQutGCLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5LlxuICovXG5FdmVudHMuZXZlbnRpemUgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICBtZXJnZShvYmplY3QsIEV2ZW50cy5wcm90b3R5cGUsIHRydWUpO1xuICAgIEV2ZW50cy5jYWxsKG9iamVjdCk7XG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LTQv9C40YHQutCwINC4INC+0YLQv9C40YHQutCwINC+0YIg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LTQv9C40YHQsNGC0YzRgdGPINC90LAg0YHQvtCx0YvRgtC40LUgKNGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCkuXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQg0JjQvNGPINGB0L7QsdGL0YLQuNGPLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sg0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8uXG4gKiBAcmV0dXJucyB7RXZlbnRzfSDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCLlxuICovXG5FdmVudHMucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdID0gW107XG4gICAgfVxuXG4gICAgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQntGC0L/QuNGB0LDRgtGM0YHRjyDQvtGCINGB0L7QsdGL0YLQuNGPICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50INCY0LzRjyDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPLlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3Nba10gPT09IGNhbGxiYWNrIHx8IGNhbGxiYWNrc1trXS5jYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1INC4INC+0YLQv9C40YHQsNGC0YzRgdGPINGB0YDQsNC30YMg0L/QvtGB0LvQtSDQtdCz0L4g0L/QtdGA0LLQvtCz0L4g0LLQvtC30L3QuNC60L3QvtCy0LXQvdC40Y8gKNGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCkuXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQg0JjQvNGPINGB0L7QsdGL0YLQuNGPLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sg0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8uXG4gKiBAcmV0dXJucyB7RXZlbnRzfSDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCLlxuICovXG5FdmVudHMucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgd3JhcHBlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLm9mZihldmVudCwgd3JhcHBlcik7XG4gICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHdyYXBwZXIuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBzZWxmLm9uKGV2ZW50LCB3cmFwcGVyKTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQntGC0L/QuNGB0LDRgtGM0YHRjyDQvtGCINCy0YHQtdGFINGB0LvRg9GI0LDRgtC10LvQtdC5INGB0L7QsdGL0YLQuNC5ICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5jbGVhckxpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzW0xJU1RFTkVSU19OQU1FXSkge1xuICAgICAgICBpZiAodGhpc1tMSVNURU5FUlNfTkFNRV0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXNbTElTVEVORVJTX05BTUVdW2tleV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQotGA0LjQs9Cz0LXRgCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDRgdC+0LHRi9GC0LjQtSAo0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0KS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCDQmNC80Y8g0YHQvtCx0YvRgtC40Y8uXG4gKiBAcGFyYW0gey4uLmFyZ3N9IGFyZ3Mg0J/QsNGA0LDQvNC10YLRgNGLINC00LvRjyDQv9C10YDQtdC00LDRh9C4INCy0LzQtdGB0YLQtSDRgSDRgdC+0LHRi9GC0LjQtdC8LlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqIEBwcml2YXRlXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50LCBhcmdzKSB7XG4gICAgaWYgKHRoaXNbTVVURV9PUFRJT05dKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZiAoZXZlbnQgIT09IFwiKlwiKSB7XG4gICAgICAgIEV2ZW50cy5wcm90b3R5cGUudHJpZ2dlci5hcHBseSh0aGlzLCBbXCIqXCIsIGV2ZW50XS5jb25jYXQoYXJncykpO1xuICAgIH1cblxuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSBbXS5jb25jYXQodGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKTtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGNhbGxiYWNrcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgY2FsbGJhY2tzW2tdLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQlNC10LvQtdCz0LjRgNC+0LLQsNGC0Ywg0LLRgdC1INGB0L7QsdGL0YLQuNGPINC00YDRg9Cz0L7QvNGDINC00LjRgdC/0LXRgtGH0LXRgNGDINGB0L7QsdGL0YLQuNC5ICjRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQpLlxuICogQHBhcmFtIHtFdmVudHN9IGFjY2VwdG9yINCf0L7Qu9GD0YfQsNGC0LXQu9GMINGB0L7QsdGL0YLQuNC5LlxuICogQHJldHVybnMge0V2ZW50c30g0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRgi5cbiAqIEBwcml2YXRlXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUucGlwZUV2ZW50cyA9IGZ1bmN0aW9uKGFjY2VwdG9yKSB7XG4gICAgdGhpcy5vbihcIipcIiwgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmJpbmQoYWNjZXB0b3IpKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQktC60LvRjtGH0LXQvdC40LUv0LLRi9C60LvRjtGH0LXQvdC40LUg0YLRgNC40LPQs9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINC30LDQv9GD0YHQuiDRgdC+0LHRi9GC0LjQuSAo0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0KS5cbiAqIEByZXR1cm5zIHtFdmVudHN9INGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YIuXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0JLQvtC30L7QsdC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LkgKNGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCkuXG4gKiBAcmV0dXJucyB7RXZlbnRzfSDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCLlxuICovXG5FdmVudHMucHJvdG90eXBlLnVubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRlbGV0ZSB0aGlzW01VVEVfT1BUSU9OXTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuIiwidmFyIHZvdyA9IHJlcXVpcmUoJ3ZvdycpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgbWVyZ2UgPSByZXF1aXJlKCcuLi9kYXRhL21lcmdlJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIFByb21pc2VcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0LHQtdGJ0LDQvdC40LUg0L/QviDRgdC/0LXRhtC40YTQuNC60LDRhtC40Lgge0BsaW5raHJlZiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9ydS9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9Qcm9taXNlIEVTIDIwMTUgcHJvbWlzZXN9LiDQkiDRg9GB0YLQsNGA0LXQstGI0LjRhSDQsdGA0LDRg9C30LXRgNCw0YUg0LggSUUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC30LDQvNC10L3QsCDQuNC3INCx0LjQsdC70LjQvtGC0LXQutC4IHtAbGlua2hyZWYgaHR0cDovL2dpdGh1Yi5jb20vZGZpbGF0b3Yvdm93LmdpdCB2b3d9XG4gKlxuICogQGV4cG9ydGVkIHlhLm11c2ljLmxpYi5Qcm9taXNlXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFByb21pc2U7XG5pZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlICE9PSBcImZ1bmN0aW9uXCJcbiAgICB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcImVkZ2VcIiAvLyDQvNC10LvQutC40LUg0LzRj9Cz0LrQuNC1INC60LDQuiDQstGB0LXQs9C00LAg0L3QuNGH0LXQs9C+INC90LUg0YPQvNC10Y7RgiDQtNC10LvQsNGC0Ywg0L/RgNCw0LLQuNC70YzQvdC+XG4pIHtcbiAgICBQcm9taXNlID0gZnVuY3Rpb24ocmVzb2x2ZXIpIHtcbiAgICAgICAgdmFyIHByb21pc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IHZvdy5Qcm9taXNlKHJlc29sdmVyKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gdm93LnJlamVjdChlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9O1xuICAgIG1lcmdlKFByb21pc2UsIHZvdy5Qcm9taXNlLCB0cnVlKTtcbiAgICBQcm9taXNlLnByb3RvdHlwZSA9IHZvdy5Qcm9taXNlLnByb3RvdHlwZTtcbn0gZWxzZSB7XG4gICAgUHJvbWlzZSA9IHdpbmRvdy5Qcm9taXNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YDQsNC30YDQtdGI0LXQvdC40Y8g0Lgg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRjy5cbiAqIEBtZXRob2QgUHJvbWlzZSN0aGVuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayDQntCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGF0LAuXG4gKiBAcGFyYW0ge251bGx8ZnVuY3Rpb259IFtlcnJiYWNrXSDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwLlxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y8uXG4gKiBAbWV0aG9kIFByb21pc2UjY2F0Y2hcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGVycmJhY2sg0J7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQutC4LlxuICogQHJldHVybnMge1Byb21pc2V9INC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsC5cbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBBYm9ydGFibGVQcm9taXNlXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzIEFib3J0YWJsZVByb21pc2VcbiAqIEBjbGFzc2Rlc2Mg0J7QsdC10YnQsNC90LjQtSDRgSDQstC+0LfQvNC+0LbQvdC+0YHRgtGM0Y4g0L7RgtC80LXQvdGLINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC90LjQvCDQtNC10LnRgdGC0LLQuNGPLlxuICogQGV4dGVuZHMgUHJvbWlzZVxuICovXG5cbi8qKlxuICog0J7RgtC80LXQvdCwINC00LXQudGB0YLQstC40Y8sINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC+0LHQtdGJ0LDQvdC40LXQvC4g0JDQsdGB0YLRgNCw0LrRgtC90YvQuSDQvNC10YLQvtC0LlxuICogQG1ldGhvZCBBYm9ydGFibGVQcm9taXNlI2Fib3J0XG4gKiBAcGFyYW0ge1N0cmluZ3xFcnJvcn0gcmVhc29uINCf0YDQuNGH0LjQvdCwINC+0YLQvNC10L3RiyDQtNC10LnRgdGC0LLQuNGPLlxuICogQGFic3RyYWN0XG4gKi9cblxuXG5cblxuIiwidmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xuXG4vKipcbiAqINCh0L7QtNCw0L3QuNC1INC+0YLQutC70L7QvdGR0L3QvdC+0LPQviDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDQvdC1INC/0LvRjtGR0YLRgdGPINCyINC60L7QvdGB0L7Qu9GMINC+0YjQuNCx0LrQvtC5XG4gKiBAcGFyYW0ge0Vycm9yfSBkYXRhIC0g0L/RgNC40YfQuNC90LAg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgcmVqZWN0ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QoZGF0YSk7XG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApO1xuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG4iLCJ2YXIgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INCx0YDQsNGD0LfQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gVXNlcmFnZW50IFJlZ0V4cFxudmFyIHJ1YyA9IC8odWNicm93c2VyKVxcLyhbXFx3Ll0rKS87XG52YXIgcndlYmtpdCA9IC8od2Via2l0KVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcnlhYnJvID0gLyh5YWJyb3dzZXIpWyBcXC9dKFtcXHcuXSspLztcbnZhciByb3BlcmEgPSAvKG9wcnxvcGVyYSkoPzouKnZlcnNpb24pP1sgXFwvXShbXFx3Ll0rKS87XG52YXIgcm1zaWUgPSAvKG1zaWUpIChbXFx3Ll0rKS87XG52YXIgcmVkZ2UgPSAvKGVkZ2UpXFwvKFtcXHcuXSspLztcbnZhciBybW1zaWUgPSAvKGllbW9iaWxlKVxcLyhbXFxkXFwuXSspLztcbnZhciBybW96aWxsYSA9IC8obW96aWxsYSkoPzouKj8gcnY6KFtcXHcuXSspKT8vO1xudmFyIHJzYWZhcmkgPSAvXigoPyFjaHJvbWUpLikqdmVyc2lvblxcLyhbXFxkXFx3XFwuXSspLiooc2FmYXJpKS87XG5cbnZhciBtYXRjaCA9IHJ1Yy5leGVjKHVhKVxuICAgIHx8IHJzYWZhcmkuZXhlYyh1YSlcbiAgICB8fCByeWFicm8uZXhlYyh1YSlcbiAgICB8fCByZWRnZS5leGVjKHVhKVxuICAgIHx8IHJtbXNpZS5leGVjKHVhKVxuICAgIHx8IHJvcGVyYS5leGVjKHVhKVxuICAgIHx8IHJ3ZWJraXQuZXhlYyh1YSlcbiAgICB8fCBybXNpZS5leGVjKHVhKVxuICAgIHx8IHVhLmluZGV4T2YoXCJjb21wYXRpYmxlXCIpIDwgMCAmJiBybW96aWxsYS5leGVjKHVhKVxuICAgIHx8IFtdO1xuXG52YXIgYnJvd3NlciA9IHtuYW1lOiBtYXRjaFsxXSB8fCBcIlwiLCB2ZXJzaW9uOiBtYXRjaFsyXSB8fCBcIjBcIn07XG5cbmlmIChtYXRjaFszXSA9PT0gXCJzYWZhcmlcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IG1hdGNoWzNdO1xufVxuXG5pZiAoYnJvd3Nlci5uYW1lID09PSAnbXNpZScpIHtcbiAgICBpZiAoZG9jdW1lbnQuZG9jdW1lbnRNb2RlKSB7IC8vIElFOCBvciBsYXRlclxuICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IGRvY3VtZW50LmRvY3VtZW50TW9kZTtcbiAgICB9IGVsc2UgeyAvLyBJRSA1LTdcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSA1OyAvLyBBc3N1bWUgcXVpcmtzIG1vZGUgdW5sZXNzIHByb3ZlbiBvdGhlcndpc2VcbiAgICAgICAgaWYgKGRvY3VtZW50LmNvbXBhdE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlID09PSBcIkNTUzFDb21wYXRcIikge1xuICAgICAgICAgICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNzsgLy8gc3RhbmRhcmRzIG1vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJvcHJcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwib3BlcmFcIjtcbn1cblxuLy9JTkZPOiBJRSAo0LrQsNC6INCy0YHQtdCz0LTQsCkg0L3QtSDQutC+0YDRgNC10LrRgtC90L4g0LLRi9GB0YLQsNCy0LvRj9C10YIgdXNlci1hZ2VudFxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJtb3ppbGxhXCIgJiYgYnJvd3Nlci52ZXJzaW9uLnNwbGl0KFwiLlwiKVswXSA9PT0gXCIxMVwiKSB7XG4gICAgYnJvd3Nlci5uYW1lID0gXCJtc2llXCI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQsNGC0YTQvtGA0LzQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcnBsYXRmb3JtID0gLyh3aW5kb3dzIHBob25lfGlwYWR8aXBob25lfGlwb2R8YW5kcm9pZHxibGFja2JlcnJ5fHBsYXlib29rfHdpbmRvd3MgY2V8d2Vib3MpLztcbnZhciBydGFibGV0ID0gLyhpcGFkfHBsYXlib29rKS87XG52YXIgcmFuZHJvaWQgPSAvKGFuZHJvaWQpLztcbnZhciBybW9iaWxlID0gLyhtb2JpbGUpLztcblxucGxhdGZvcm0gPSBycGxhdGZvcm0uZXhlYyh1YSkgfHwgW107XG52YXIgdGFibGV0ID0gcnRhYmxldC5leGVjKHVhKSB8fCAhcm1vYmlsZS5leGVjKHVhKSAmJiByYW5kcm9pZC5leGVjKHVhKSB8fCBbXTtcblxuaWYgKHBsYXRmb3JtWzFdKSB7XG4gICAgcGxhdGZvcm1bMV0gPSBwbGF0Zm9ybVsxXS5yZXBsYWNlKC9cXHMvZywgXCJfXCIpOyAvLyBDaGFuZ2Ugd2hpdGVzcGFjZSB0byB1bmRlcnNjb3JlLiBFbmFibGVzIGRvdCBub3RhdGlvbi5cbn1cblxudmFyIHBsYXRmb3JtID0ge1xuICAgIHR5cGU6IHBsYXRmb3JtWzFdIHx8IFwiXCIsXG4gICAgdGFibGV0OiAhIXRhYmxldFsxXSxcbiAgICBtb2JpbGU6IHBsYXRmb3JtWzFdICYmICF0YWJsZXRbMV0gfHwgZmFsc2Vcbn07XG5pZiAoIXBsYXRmb3JtLnR5cGUpIHtcbiAgICBwbGF0Zm9ybS50eXBlID0gJ3BjJztcbn1cblxucGxhdGZvcm0ub3MgPSBwbGF0Zm9ybS50eXBlO1xuaWYgKHBsYXRmb3JtLnR5cGUgPT09ICdpcGFkJyB8fCBwbGF0Zm9ybS50eXBlID09PSAnaXBob25lJyB8fCBwbGF0Zm9ybS50eXBlID09PSAnaXBvZCcpIHtcbiAgICBwbGF0Zm9ybS5vcyA9ICdpb3MnO1xufSBlbHNlIGlmIChwbGF0Zm9ybS50eXBlID09PSAnYW5kcm9pZCcpIHtcbiAgICBwbGF0Zm9ybS5vcyA9ICdhbmRyb2lkJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gXCJ3aW5kb3dzIHBob25lXCIgfHwgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIldpblwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwid2luZG93c1wiO1xuICAgIHBsYXRmb3JtLnZlcnNpb24gPSBuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC93aW5bXiBdKiAoW147XSopL2kpO1xuICAgIHBsYXRmb3JtLnZlcnNpb24gPSBwbGF0Zm9ybS52ZXJzaW9uICYmIHBsYXRmb3JtLnZlcnNpb25bMV07XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJNYWNcIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIm1hY29zXCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJYMTFcIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcInVuaXhcIjtcbn0gZWxzZSBpZiAobmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIkxpbnV4XCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJsaW51eFwiO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC80LXQvdGP0YLRjCDQs9GA0L7QvNC60L7RgdGC0YxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbnZhciBub1ZvbHVtZSA9IHRydWU7XG50cnkge1xuICAgIHZhciBhdWRpbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2F1ZGlvJyk7XG4gICAgYXVkaW8udm9sdW1lID0gMC42MztcbiAgICBub1ZvbHVtZSA9IE1hdGguYWJzKGF1ZGlvLnZvbHVtZSAtIDAuNjMpID4gMC4wMTtcbn0gY2F0Y2goZSkge1xuICAgIG5vVm9sdW1lID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQvtCxINC+0LrRgNGD0LbQtdC90LjQuFxuICogQG5hbWVzcGFjZVxuICogQGV4cG9ydGVkIHlhLm11c2ljLmluZm9cbiAqL1xudmFyIGluZm8gPSB7XG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LHRgNCw0YPQt9C10YDQtVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtINC90LDQt9Cy0LDQvdC40LUg0LHRgNCw0YPQt9C10YDQsFxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB2ZXJzaW9uIC0g0LLQtdGA0YHQuNGPXG4gICAgICogQHByb3BlcnR5IHtudW1iZXJ9IFtkb2N1bWVudE1vZGVdIC0g0LLQtdGA0YHQuNGPINC00L7QutGD0LzQtdC90YLQsCAo0LTQu9GPIElFKVxuICAgICAqL1xuICAgIGJyb3dzZXI6IGJyb3dzZXIsXG5cbiAgICAvKipcbiAgICAgKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQv9C70LDRgtGE0L7RgNC80LVcbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG9zIC0g0YLQuNC/INC+0L/QtdGA0LDRhtC40L7QvdC90L7QuSDRgdC40YHRgtC10LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0eXBlIC0g0YLQuNC/INC/0LvQsNGC0YTQvtGA0LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGFibGV0IC0g0L/Qu9Cw0L3RiNC10YJcbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IG1vYmlsZSAtINC80L7QsdC40LvRjNC90YvQuVxuICAgICAqL1xuICAgIHBsYXRmb3JtOiBwbGF0Zm9ybSxcblxuICAgIC8qKlxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQsCDQs9GA0L7QvNC60L7RgdGC0LhcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvbmx5RGV2aWNlVm9sdW1lOiBub1ZvbHVtZVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbmZvO1xuIiwiLyoqXG4gKiBAbGljZW5zZSBTV0ZPYmplY3QgdjIuMiA8aHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC8+XG4gKiBpcyByZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgPGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwPlxuICogQHByaXZhdGVcbiovXG52YXIgc3dmb2JqZWN0ID0gZnVuY3Rpb24oKSB7XG5cdHZhciBVTkRFRiA9IFwidW5kZWZpbmVkXCIsXG5cdFx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0XHRTSE9DS1dBVkVfRkxBU0ggPSBcIlNob2Nrd2F2ZSBGbGFzaFwiLFxuXHRcdFNIT0NLV0FWRV9GTEFTSF9BWCA9IFwiU2hvY2t3YXZlRmxhc2guU2hvY2t3YXZlRmxhc2hcIixcblx0XHRGTEFTSF9NSU1FX1RZUEUgPSBcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIsXG5cdFx0RVhQUkVTU19JTlNUQUxMX0lEID0gXCJTV0ZPYmplY3RFeHBySW5zdFwiLFxuXHRcdE9OX1JFQURZX1NUQVRFX0NIQU5HRSA9IFwib25yZWFkeXN0YXRlY2hhbmdlXCIsXG5cdFx0d2luID0gd2luZG93LFxuXHRcdGRvYyA9IGRvY3VtZW50LFxuXHRcdG5hdiA9IG5hdmlnYXRvcixcblx0XHRwbHVnaW4gPSBmYWxzZSxcblx0XHRkb21Mb2FkRm5BcnIgPSBbbWFpbl0sXG5cdFx0cmVnT2JqQXJyID0gW10sXG5cdFx0b2JqSWRBcnIgPSBbXSxcblx0XHRsaXN0ZW5lcnNBcnIgPSBbXSxcblx0XHRzdG9yZWRBbHRDb250ZW50LFxuXHRcdHN0b3JlZEFsdENvbnRlbnRJZCxcblx0XHRzdG9yZWRDYWxsYmFja0ZuLFxuXHRcdHN0b3JlZENhbGxiYWNrT2JqLFxuXHRcdGlzRG9tTG9hZGVkID0gZmFsc2UsXG5cdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlLFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0LFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEsXG5cdFx0YXV0b0hpZGVTaG93ID0gdHJ1ZSxcblx0LyogQ2VudHJhbGl6ZWQgZnVuY3Rpb24gZm9yIGJyb3dzZXIgZmVhdHVyZSBkZXRlY3Rpb25cblx0XHQtIFVzZXIgYWdlbnQgc3RyaW5nIGRldGVjdGlvbiBpcyBvbmx5IHVzZWQgd2hlbiBubyBnb29kIGFsdGVybmF0aXZlIGlzIHBvc3NpYmxlXG5cdFx0LSBJcyBleGVjdXRlZCBkaXJlY3RseSBmb3Igb3B0aW1hbCBwZXJmb3JtYW5jZVxuXHQqL1xuXHR1YSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB3M2Nkb20gPSB0eXBlb2YgZG9jLmdldEVsZW1lbnRCeUlkICE9IFVOREVGICYmIHR5cGVvZiBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUgIT0gVU5ERUYgJiYgdHlwZW9mIGRvYy5jcmVhdGVFbGVtZW50ICE9IFVOREVGLFxuXHRcdFx0dSA9IG5hdi51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcblx0XHRcdHAgPSBuYXYucGxhdGZvcm0udG9Mb3dlckNhc2UoKSxcblx0XHRcdHdpbmRvd3MgPSBwID8gL3dpbi8udGVzdChwKSA6IC93aW4vLnRlc3QodSksXG5cdFx0XHRtYWMgPSBwID8gL21hYy8udGVzdChwKSA6IC9tYWMvLnRlc3QodSksXG5cdFx0XHR3ZWJraXQgPSAvd2Via2l0Ly50ZXN0KHUpID8gcGFyc2VGbG9hdCh1LnJlcGxhY2UoL14uKndlYmtpdFxcLyhcXGQrKFxcLlxcZCspPykuKiQvLCBcIiQxXCIpKSA6IGZhbHNlLCAvLyByZXR1cm5zIGVpdGhlciB0aGUgd2Via2l0IHZlcnNpb24gb3IgZmFsc2UgaWYgbm90IHdlYmtpdFxuXHRcdFx0aWUgPSAhK1wiXFx2MVwiLCAvLyBmZWF0dXJlIGRldGVjdGlvbiBiYXNlZCBvbiBBbmRyZWEgR2lhbW1hcmNoaSdzIHNvbHV0aW9uOiBodHRwOi8vd2VicmVmbGVjdGlvbi5ibG9nc3BvdC5jb20vMjAwOS8wMS8zMi1ieXRlcy10by1rbm93LWlmLXlvdXItYnJvd3Nlci1pcy1pZS5odG1sXG5cdFx0XHRwbGF5ZXJWZXJzaW9uID0gWzAsMCwwXSxcblx0XHRcdGQgPSBudWxsO1xuXHRcdGlmICh0eXBlb2YgbmF2LnBsdWdpbnMgIT0gVU5ERUYgJiYgdHlwZW9mIG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0gPT0gT0JKRUNUKSB7XG5cdFx0XHRkID0gbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXS5kZXNjcmlwdGlvbjtcblx0XHRcdGlmIChkICYmICEodHlwZW9mIG5hdi5taW1lVHlwZXMgIT0gVU5ERUYgJiYgbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdICYmICFuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0uZW5hYmxlZFBsdWdpbikpIHsgLy8gbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCJdLmVuYWJsZWRQbHVnaW4gaW5kaWNhdGVzIHdoZXRoZXIgcGx1Zy1pbnMgYXJlIGVuYWJsZWQgb3IgZGlzYWJsZWQgaW4gU2FmYXJpIDMrXG5cdFx0XHRcdHBsdWdpbiA9IHRydWU7XG5cdFx0XHRcdGllID0gZmFsc2U7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRkID0gZC5yZXBsYWNlKC9eLipcXHMrKFxcUytcXHMrXFxTKyQpLywgXCIkMVwiKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblswXSA9IHBhcnNlSW50KGQucmVwbGFjZSgvXiguKilcXC4uKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMV0gPSBwYXJzZUludChkLnJlcGxhY2UoL14uKlxcLiguKilcXHMuKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMl0gPSAvW2EtekEtWl0vLnRlc3QoZCkgPyBwYXJzZUludChkLnJlcGxhY2UoL14uKlthLXpBLVpdKyguKikkLywgXCIkMVwiKSwgMTApIDogMDtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5BY3RpdmVYT2JqZWN0ICE9IFVOREVGKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgYSA9IG5ldyBBY3RpdmVYT2JqZWN0KFNIT0NLV0FWRV9GTEFTSF9BWCk7XG5cdFx0XHRcdGlmIChhKSB7IC8vIGEgd2lsbCByZXR1cm4gbnVsbCB3aGVuIEFjdGl2ZVggaXMgZGlzYWJsZWRcblx0XHRcdFx0XHRkID0gYS5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRpZSA9IHRydWU7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRcdFx0ZCA9IGQuc3BsaXQoXCIgXCIpWzFdLnNwbGl0KFwiLFwiKTtcblx0XHRcdFx0XHRcdHBsYXllclZlcnNpb24gPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaChlKSB7fVxuXHRcdH1cblx0XHRyZXR1cm4geyB3Mzp3M2Nkb20sIHB2OnBsYXllclZlcnNpb24sIHdrOndlYmtpdCwgaWU6aWUsIHdpbjp3aW5kb3dzLCBtYWM6bWFjIH07XG5cdH0oKTtcblx0LyogQ3Jvc3MtYnJvd3NlciBvbkRvbUxvYWRcblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIHRoZSBET00gb2YgYSB3ZWIgcGFnZSBpcyBsb2FkZWRcblx0XHQtIEludGVybmV0IEV4cGxvcmVyIHdvcmthcm91bmQgYmFzZWQgb24gRGllZ28gUGVyaW5pJ3Mgc29sdXRpb246IGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9JRUNvbnRlbnRMb2FkZWQvXG5cdFx0LSBSZWd1bGFyIG9ubG9hZCBzZXJ2ZXMgYXMgZmFsbGJhY2tcblx0Ki9cblx0KGZ1bmN0aW9uKCkge1xuXHRcdGlmICghdWEudzMpIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCh0eXBlb2YgZG9jLnJlYWR5U3RhdGUgIT0gVU5ERUYgJiYgZG9jLnJlYWR5U3RhdGUgPT0gXCJjb21wbGV0ZVwiKSB8fCAodHlwZW9mIGRvYy5yZWFkeVN0YXRlID09IFVOREVGICYmIChkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdIHx8IGRvYy5ib2R5KSkpIHsgLy8gZnVuY3Rpb24gaXMgZmlyZWQgYWZ0ZXIgb25sb2FkLCBlLmcuIHdoZW4gc2NyaXB0IGlzIGluc2VydGVkIGR5bmFtaWNhbGx5XG5cdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdH1cblx0XHRpZiAoIWlzRG9tTG9hZGVkKSB7XG5cdFx0XHRpZiAodHlwZW9mIGRvYy5hZGRFdmVudExpc3RlbmVyICE9IFVOREVGKSB7XG5cdFx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBjYWxsRG9tTG9hZEZ1bmN0aW9ucywgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRkb2MuYXR0YWNoRXZlbnQoT05fUkVBRFlfU1RBVEVfQ0hBTkdFLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAoZG9jLnJlYWR5U3RhdGUgPT0gXCJjb21wbGV0ZVwiKSB7XG5cdFx0XHRcdFx0XHRkb2MuZGV0YWNoRXZlbnQoT05fUkVBRFlfU1RBVEVfQ0hBTkdFLCBhcmd1bWVudHMuY2FsbGVlKTtcblx0XHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKHdpbiA9PSB0b3ApIHsgLy8gaWYgbm90IGluc2lkZSBhbiBpZnJhbWVcblx0XHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRcdGlmIChpc0RvbUxvYWRlZCkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGRvYy5kb2N1bWVudEVsZW1lbnQuZG9TY3JvbGwoXCJsZWZ0XCIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2F0Y2goZSkge1xuXHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHRcdH0pKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICh1YS53aykge1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0aWYgKCEvbG9hZGVkfGNvbXBsZXRlLy50ZXN0KGRvYy5yZWFkeVN0YXRlKSkge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAwKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGFkZExvYWRFdmVudChjYWxsRG9tTG9hZEZ1bmN0aW9ucyk7XG5cdFx0fVxuXHR9KSgpO1xuXHRmdW5jdGlvbiBjYWxsRG9tTG9hZEZ1bmN0aW9ucygpIHtcblx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0dHJ5IHsgLy8gdGVzdCBpZiB3ZSBjYW4gcmVhbGx5IGFkZC9yZW1vdmUgZWxlbWVudHMgdG8vZnJvbSB0aGUgRE9NOyB3ZSBkb24ndCB3YW50IHRvIGZpcmUgaXQgdG9vIGVhcmx5XG5cdFx0XHR2YXIgdCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF0uYXBwZW5kQ2hpbGQoY3JlYXRlRWxlbWVudChcInNwYW5cIikpO1xuXHRcdFx0dC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkgeyByZXR1cm47IH1cblx0XHRpc0RvbUxvYWRlZCA9IHRydWU7XG5cdFx0dmFyIGRsID0gZG9tTG9hZEZuQXJyLmxlbmd0aDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRsOyBpKyspIHtcblx0XHRcdGRvbUxvYWRGbkFycltpXSgpO1xuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBhZGREb21Mb2FkRXZlbnQoZm4pIHtcblx0XHRpZiAoaXNEb21Mb2FkZWQpIHtcblx0XHRcdGZuKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZG9tTG9hZEZuQXJyW2RvbUxvYWRGbkFyci5sZW5ndGhdID0gZm47IC8vIEFycmF5LnB1c2goKSBpcyBvbmx5IGF2YWlsYWJsZSBpbiBJRTUuNStcblx0XHR9XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBvbmxvYWRcblx0XHQtIEJhc2VkIG9uIEphbWVzIEVkd2FyZHMnIHNvbHV0aW9uOiBodHRwOi8vYnJvdGhlcmNha2UuY29tL3NpdGUvcmVzb3VyY2VzL3NjcmlwdHMvb25sb2FkL1xuXHRcdC0gV2lsbCBmaXJlIGFuIGV2ZW50IGFzIHNvb24gYXMgYSB3ZWIgcGFnZSBpbmNsdWRpbmcgYWxsIG9mIGl0cyBhc3NldHMgYXJlIGxvYWRlZFxuXHQgKi9cblx0ZnVuY3Rpb24gYWRkTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW4uYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0d2luLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZuLCBmYWxzZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0ZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZuLCBmYWxzZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4uYXR0YWNoRXZlbnQgIT0gVU5ERUYpIHtcblx0XHRcdGFkZExpc3RlbmVyKHdpbiwgXCJvbmxvYWRcIiwgZm4pO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLm9ubG9hZCA9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHZhciBmbk9sZCA9IHdpbi5vbmxvYWQ7XG5cdFx0XHR3aW4ub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZuT2xkKCk7XG5cdFx0XHRcdGZuKCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHdpbi5vbmxvYWQgPSBmbjtcblx0XHR9XG5cdH1cblx0LyogTWFpbiBmdW5jdGlvblxuXHRcdC0gV2lsbCBwcmVmZXJhYmx5IGV4ZWN1dGUgb25Eb21Mb2FkLCBvdGhlcndpc2Ugb25sb2FkIChhcyBhIGZhbGxiYWNrKVxuXHQqL1xuXHRmdW5jdGlvbiBtYWluKCkge1xuXHRcdGlmIChwbHVnaW4pIHtcblx0XHRcdHRlc3RQbGF5ZXJWZXJzaW9uKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBEZXRlY3QgdGhlIEZsYXNoIFBsYXllciB2ZXJzaW9uIGZvciBub24tSW50ZXJuZXQgRXhwbG9yZXIgYnJvd3NlcnNcblx0XHQtIERldGVjdGluZyB0aGUgcGx1Zy1pbiB2ZXJzaW9uIHZpYSB0aGUgb2JqZWN0IGVsZW1lbnQgaXMgbW9yZSBwcmVjaXNlIHRoYW4gdXNpbmcgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpdGVtJ3MgZGVzY3JpcHRpb246XG5cdFx0ICBhLiBCb3RoIHJlbGVhc2UgYW5kIGJ1aWxkIG51bWJlcnMgY2FuIGJlIGRldGVjdGVkXG5cdFx0ICBiLiBBdm9pZCB3cm9uZyBkZXNjcmlwdGlvbnMgYnkgY29ycnVwdCBpbnN0YWxsZXJzIHByb3ZpZGVkIGJ5IEFkb2JlXG5cdFx0ICBjLiBBdm9pZCB3cm9uZyBkZXNjcmlwdGlvbnMgYnkgbXVsdGlwbGUgRmxhc2ggUGxheWVyIGVudHJpZXMgaW4gdGhlIHBsdWdpbiBBcnJheSwgY2F1c2VkIGJ5IGluY29ycmVjdCBicm93c2VyIGltcG9ydHNcblx0XHQtIERpc2FkdmFudGFnZSBvZiB0aGlzIG1ldGhvZCBpcyB0aGF0IGl0IGRlcGVuZHMgb24gdGhlIGF2YWlsYWJpbGl0eSBvZiB0aGUgRE9NLCB3aGlsZSB0aGUgcGx1Z2lucyBjb2xsZWN0aW9uIGlzIGltbWVkaWF0ZWx5IGF2YWlsYWJsZVxuXHQqL1xuXHRmdW5jdGlvbiB0ZXN0UGxheWVyVmVyc2lvbigpIHtcblx0XHR2YXIgYiA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF07XG5cdFx0dmFyIG8gPSBjcmVhdGVFbGVtZW50KE9CSkVDVCk7XG5cdFx0by5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIEZMQVNIX01JTUVfVFlQRSk7XG5cdFx0dmFyIHQgPSBiLmFwcGVuZENoaWxkKG8pO1xuXHRcdGlmICh0KSB7XG5cdFx0XHR2YXIgY291bnRlciA9IDA7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKHR5cGVvZiB0LkdldFZhcmlhYmxlICE9IFVOREVGKSB7XG5cdFx0XHRcdFx0dmFyIGQgPSB0LkdldFZhcmlhYmxlKFwiJHZlcnNpb25cIik7XG5cdFx0XHRcdFx0aWYgKGQpIHtcblx0XHRcdFx0XHRcdGQgPSBkLnNwbGl0KFwiIFwiKVsxXS5zcGxpdChcIixcIik7XG5cdFx0XHRcdFx0XHR1YS5wdiA9IFtwYXJzZUludChkWzBdLCAxMCksIHBhcnNlSW50KGRbMV0sIDEwKSwgcGFyc2VJbnQoZFsyXSwgMTApXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoY291bnRlciA8IDEwKSB7XG5cdFx0XHRcdFx0Y291bnRlcisrO1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRiLnJlbW92ZUNoaWxkKG8pO1xuXHRcdFx0XHR0ID0gbnVsbDtcblx0XHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRtYXRjaFZlcnNpb25zKCk7XG5cdFx0fVxuXHR9XG5cdC8qIFBlcmZvcm0gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtYXRjaGluZzsgc3RhdGljIHB1Ymxpc2hpbmcgb25seVxuXHQqL1xuXHRmdW5jdGlvbiBtYXRjaFZlcnNpb25zKCkge1xuXHRcdHZhciBybCA9IHJlZ09iakFyci5sZW5ndGg7XG5cdFx0aWYgKHJsID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBybDsgaSsrKSB7IC8vIGZvciBlYWNoIHJlZ2lzdGVyZWQgb2JqZWN0IGVsZW1lbnRcblx0XHRcdFx0dmFyIGlkID0gcmVnT2JqQXJyW2ldLmlkO1xuXHRcdFx0XHR2YXIgY2IgPSByZWdPYmpBcnJbaV0uY2FsbGJhY2tGbjtcblx0XHRcdFx0dmFyIGNiT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOmlkfTtcblx0XHRcdFx0aWYgKHVhLnB2WzBdID4gMCkge1xuXHRcdFx0XHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0XHRcdFx0aWYgKG9iaikge1xuXHRcdFx0XHRcdFx0aWYgKGhhc1BsYXllclZlcnNpb24ocmVnT2JqQXJyW2ldLnN3ZlZlcnNpb24pICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpKSB7IC8vIEZsYXNoIFBsYXllciB2ZXJzaW9uID49IHB1Ymxpc2hlZCBTV0YgdmVyc2lvbjogSG91c3Rvbiwgd2UgaGF2ZSBhIG1hdGNoIVxuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNiKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0Y2JPYmoucmVmID0gZ2V0T2JqZWN0QnlJZChpZCk7XG5cdFx0XHRcdFx0XHRcdFx0Y2IoY2JPYmopO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChyZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGwgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkgeyAvLyBzaG93IHRoZSBBZG9iZSBFeHByZXNzIEluc3RhbGwgZGlhbG9nIGlmIHNldCBieSB0aGUgd2ViIHBhZ2UgYXV0aG9yIGFuZCBpZiBzdXBwb3J0ZWRcblx0XHRcdFx0XHRcdFx0dmFyIGF0dCA9IHt9O1xuXHRcdFx0XHRcdFx0XHRhdHQuZGF0YSA9IHJlZ09iakFycltpXS5leHByZXNzSW5zdGFsbDtcblx0XHRcdFx0XHRcdFx0YXR0LndpZHRoID0gb2JqLmdldEF0dHJpYnV0ZShcIndpZHRoXCIpIHx8IFwiMFwiO1xuXHRcdFx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gb2JqLmdldEF0dHJpYnV0ZShcImhlaWdodFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKSkgeyBhdHQuc3R5bGVjbGFzcyA9IG9iai5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTsgfVxuXHRcdFx0XHRcdFx0XHRpZiAob2JqLmdldEF0dHJpYnV0ZShcImFsaWduXCIpKSB7IGF0dC5hbGlnbiA9IG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKTsgfVxuXHRcdFx0XHRcdFx0XHQvLyBwYXJzZSBIVE1MIG9iamVjdCBwYXJhbSBlbGVtZW50J3MgbmFtZS12YWx1ZSBwYWlyc1xuXHRcdFx0XHRcdFx0XHR2YXIgcGFyID0ge307XG5cdFx0XHRcdFx0XHRcdHZhciBwID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwicGFyYW1cIik7XG5cdFx0XHRcdFx0XHRcdHZhciBwbCA9IHAubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHBsOyBqKyspIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocFtqXS5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpLnRvTG93ZXJDYXNlKCkgIT0gXCJtb3ZpZVwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRwYXJbcFtqXS5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpXSA9IHBbal0uZ2V0QXR0cmlidXRlKFwidmFsdWVcIik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgaWQsIGNiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgeyAvLyBGbGFzaCBQbGF5ZXIgYW5kIFNXRiB2ZXJzaW9uIG1pc21hdGNoIG9yIGFuIG9sZGVyIFdlYmtpdCBlbmdpbmUgdGhhdCBpZ25vcmVzIHRoZSBIVE1MIG9iamVjdCBlbGVtZW50J3MgbmVzdGVkIHBhcmFtIGVsZW1lbnRzOiBkaXNwbGF5IGFsdGVybmF0aXZlIGNvbnRlbnQgaW5zdGVhZCBvZiBTV0Zcblx0XHRcdFx0XHRcdFx0ZGlzcGxheUFsdENvbnRlbnQob2JqKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNiKSB7IGNiKGNiT2JqKTsgfVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcdC8vIGlmIG5vIEZsYXNoIFBsYXllciBpcyBpbnN0YWxsZWQgb3IgdGhlIGZwIHZlcnNpb24gY2Fubm90IGJlIGRldGVjdGVkIHdlIGxldCB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCBkbyBpdHMgam9iIChlaXRoZXIgc2hvdyBhIFNXRiBvciBhbHRlcm5hdGl2ZSBjb250ZW50KVxuXHRcdFx0XHRcdHNldFZpc2liaWxpdHkoaWQsIHRydWUpO1xuXHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0dmFyIG8gPSBnZXRPYmplY3RCeUlkKGlkKTsgLy8gdGVzdCB3aGV0aGVyIHRoZXJlIGlzIGFuIEhUTUwgb2JqZWN0IGVsZW1lbnQgb3Igbm90XG5cdFx0XHRcdFx0XHRpZiAobyAmJiB0eXBlb2Ygby5TZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRjYk9iai5zdWNjZXNzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0Y2JPYmoucmVmID0gbztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gZ2V0T2JqZWN0QnlJZChvYmplY3RJZFN0cikge1xuXHRcdHZhciByID0gbnVsbDtcblx0XHR2YXIgbyA9IGdldEVsZW1lbnRCeUlkKG9iamVjdElkU3RyKTtcblx0XHRpZiAobyAmJiBvLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHtcblx0XHRcdGlmICh0eXBlb2Ygby5TZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgbiA9IG8uZ2V0RWxlbWVudHNCeVRhZ05hbWUoT0JKRUNUKVswXTtcblx0XHRcdFx0aWYgKG4pIHtcblx0XHRcdFx0XHRyID0gbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXHQvKiBSZXF1aXJlbWVudHMgZm9yIEFkb2JlIEV4cHJlc3MgSW5zdGFsbFxuXHRcdC0gb25seSBvbmUgaW5zdGFuY2UgY2FuIGJlIGFjdGl2ZSBhdCBhIHRpbWVcblx0XHQtIGZwIDYuMC42NSBvciBoaWdoZXJcblx0XHQtIFdpbi9NYWMgT1Mgb25seVxuXHRcdC0gbm8gV2Via2l0IGVuZ2luZXMgb2xkZXIgdGhhbiB2ZXJzaW9uIDMxMlxuXHQqL1xuXHRmdW5jdGlvbiBjYW5FeHByZXNzSW5zdGFsbCgpIHtcblx0XHRyZXR1cm4gIWlzRXhwcmVzc0luc3RhbGxBY3RpdmUgJiYgaGFzUGxheWVyVmVyc2lvbihcIjYuMC42NVwiKSAmJiAodWEud2luIHx8IHVhLm1hYykgJiYgISh1YS53ayAmJiB1YS53ayA8IDMxMik7XG5cdH1cblx0LyogU2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZ1xuXHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vd3d3LmFkb2JlLmNvbS9jZnVzaW9uL2tub3dsZWRnZWJhc2UvaW5kZXguY2ZtP2lkPTZhMjUzYjc1XG5cdCovXG5cdGZ1bmN0aW9uIHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSB0cnVlO1xuXHRcdHN0b3JlZENhbGxiYWNrRm4gPSBjYWxsYmFja0ZuIHx8IG51bGw7XG5cdFx0c3RvcmVkQ2FsbGJhY2tPYmogPSB7c3VjY2VzczpmYWxzZSwgaWQ6cmVwbGFjZUVsZW1JZFN0cn07XG5cdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGlmIChvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikgeyAvLyBzdGF0aWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gYWJzdHJhY3RBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnRJZCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHsgLy8gZHluYW1pYyBwdWJsaXNoaW5nXG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnQgPSBvYmo7XG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnRJZCA9IHJlcGxhY2VFbGVtSWRTdHI7XG5cdFx0XHR9XG5cdFx0XHRhdHQuaWQgPSBFWFBSRVNTX0lOU1RBTExfSUQ7XG5cdFx0XHRpZiAodHlwZW9mIGF0dC53aWR0aCA9PSBVTkRFRiB8fCAoIS8lJC8udGVzdChhdHQud2lkdGgpICYmIHBhcnNlSW50KGF0dC53aWR0aCwgMTApIDwgMzEwKSkgeyBhdHQud2lkdGggPSBcIjMxMFwiOyB9XG5cdFx0XHRpZiAodHlwZW9mIGF0dC5oZWlnaHQgPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LmhlaWdodCkgJiYgcGFyc2VJbnQoYXR0LmhlaWdodCwgMTApIDwgMTM3KSkgeyBhdHQuaGVpZ2h0ID0gXCIxMzdcIjsgfVxuXHRcdFx0ZG9jLnRpdGxlID0gZG9jLnRpdGxlLnNsaWNlKDAsIDQ3KSArIFwiIC0gRmxhc2ggUGxheWVyIEluc3RhbGxhdGlvblwiO1xuXHRcdFx0dmFyIHB0ID0gdWEuaWUgJiYgdWEud2luID8gXCJBY3RpdmVYXCIgOiBcIlBsdWdJblwiLFxuXHRcdFx0XHRmdiA9IFwiTU1yZWRpcmVjdFVSTD1cIiArIHdpbi5sb2NhdGlvbi50b1N0cmluZygpLnJlcGxhY2UoLyYvZyxcIiUyNlwiKSArIFwiJk1NcGxheWVyVHlwZT1cIiArIHB0ICsgXCImTU1kb2N0aXRsZT1cIiArIGRvYy50aXRsZTtcblx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRwYXIuZmxhc2h2YXJzICs9IFwiJlwiICsgZnY7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGZ2O1xuXHRcdFx0fVxuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luICYmIG9iai5yZWFkeVN0YXRlICE9IDQpIHtcblx0XHRcdFx0dmFyIG5ld09iaiA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0XHRcdHJlcGxhY2VFbGVtSWRTdHIgKz0gXCJTV0ZPYmplY3ROZXdcIjtcblx0XHRcdFx0bmV3T2JqLnNldEF0dHJpYnV0ZShcImlkXCIsIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0XHRvYmoucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobmV3T2JqLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgb2JqZWN0IGVsZW1lbnQgdGhhdCBsb2FkcyBleHByZXNzaW5zdGFsbC5zd2Zcblx0XHRcdFx0b2JqLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0Y3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHR9XG5cdH1cblx0LyogRnVuY3Rpb25zIHRvIGFic3RyYWN0IGFuZCBkaXNwbGF5IGFsdGVybmF0aXZlIGNvbnRlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZGlzcGxheUFsdENvbnRlbnQob2JqKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHQvLyBJRSBvbmx5OiB3aGVuIGEgU1dGIGlzIGxvYWRpbmcgKEFORDogbm90IGF2YWlsYWJsZSBpbiBjYWNoZSkgd2FpdCBmb3IgdGhlIHJlYWR5U3RhdGUgb2YgdGhlIG9iamVjdCBlbGVtZW50IHRvIGJlY29tZSA0IGJlZm9yZSByZW1vdmluZyBpdCxcblx0XHRcdC8vIGJlY2F1c2UgeW91IGNhbm5vdCBwcm9wZXJseSBjYW5jZWwgYSBsb2FkaW5nIFNXRiBmaWxlIHdpdGhvdXQgYnJlYWtpbmcgYnJvd3NlciBsb2FkIHJlZmVyZW5jZXMsIGFsc28gb2JqLm9ucmVhZHlzdGF0ZWNoYW5nZSBkb2Vzbid0IHdvcmtcblx0XHRcdHZhciBlbCA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0XHRvYmoucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZWwsIG9iaik7IC8vIGluc2VydCBwbGFjZWhvbGRlciBkaXYgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgZWwpO1xuXHRcdFx0b2JqLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0b2JqLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGFic3RyYWN0QWx0Q29udGVudChvYmopLCBvYmopO1xuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBhYnN0cmFjdEFsdENvbnRlbnQob2JqKSB7XG5cdFx0dmFyIGFjID0gY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRpZiAodWEud2luICYmIHVhLmllKSB7XG5cdFx0XHRhYy5pbm5lckhUTUwgPSBvYmouaW5uZXJIVE1MO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHZhciBuZXN0ZWRPYmogPSBvYmouZ2V0RWxlbWVudHNCeVRhZ05hbWUoT0JKRUNUKVswXTtcblx0XHRcdGlmIChuZXN0ZWRPYmopIHtcblx0XHRcdFx0dmFyIGMgPSBuZXN0ZWRPYmouY2hpbGROb2Rlcztcblx0XHRcdFx0aWYgKGMpIHtcblx0XHRcdFx0XHR2YXIgY2wgPSBjLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNsOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmICghKGNbaV0ubm9kZVR5cGUgPT0gMSAmJiBjW2ldLm5vZGVOYW1lID09IFwiUEFSQU1cIikgJiYgIShjW2ldLm5vZGVUeXBlID09IDgpKSB7XG5cdFx0XHRcdFx0XHRcdGFjLmFwcGVuZENoaWxkKGNbaV0uY2xvbmVOb2RlKHRydWUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGFjO1xuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgZHluYW1pYyBTV0YgY3JlYXRpb25cblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCBpZCkge1xuXHRcdHZhciByLCBlbCA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRpZiAodWEud2sgJiYgdWEud2sgPCAzMTIpIHsgcmV0dXJuIHI7IH1cblx0XHRpZiAoZWwpIHtcblx0XHRcdGlmICh0eXBlb2YgYXR0T2JqLmlkID09IFVOREVGKSB7IC8vIGlmIG5vICdpZCcgaXMgZGVmaW5lZCBmb3IgdGhlIG9iamVjdCBlbGVtZW50LCBpdCB3aWxsIGluaGVyaXQgdGhlICdpZCcgZnJvbSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0XHRhdHRPYmouaWQgPSBpZDtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgLy8gSW50ZXJuZXQgRXhwbG9yZXIgKyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCArIFczQyBET00gbWV0aG9kcyBkbyBub3QgY29tYmluZTogZmFsbCBiYWNrIHRvIG91dGVySFRNTFxuXHRcdFx0XHR2YXIgYXR0ID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW2ldICE9IE9iamVjdC5wcm90b3R5cGVbaV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKGkudG9Mb3dlckNhc2UoKSA9PSBcImRhdGFcIikge1xuXHRcdFx0XHRcdFx0XHRwYXJPYmoubW92aWUgPSBhdHRPYmpbaV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJzdHlsZWNsYXNzXCIpIHsgLy8gJ2NsYXNzJyBpcyBhbiBFQ01BNCByZXNlcnZlZCBrZXl3b3JkXG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnIGNsYXNzPVwiJyArIGF0dE9ialtpXSArICdcIic7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChpLnRvTG93ZXJDYXNlKCkgIT0gXCJjbGFzc2lkXCIpIHtcblx0XHRcdFx0XHRcdFx0YXR0ICs9ICcgJyArIGkgKyAnPVwiJyArIGF0dE9ialtpXSArICdcIic7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBwYXIgPSBcIlwiO1xuXHRcdFx0XHRmb3IgKHZhciBqIGluIHBhck9iaikge1xuXHRcdFx0XHRcdGlmIChwYXJPYmpbal0gIT0gT2JqZWN0LnByb3RvdHlwZVtqXSkgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzXG5cdFx0XHRcdFx0XHRwYXIgKz0gJzxwYXJhbSBuYW1lPVwiJyArIGogKyAnXCIgdmFsdWU9XCInICsgcGFyT2JqW2pdICsgJ1wiIC8+Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwub3V0ZXJIVE1MID0gJzxvYmplY3QgY2xhc3NpZD1cImNsc2lkOkQyN0NEQjZFLUFFNkQtMTFjZi05NkI4LTQ0NDU1MzU0MDAwMFwiJyArIGF0dCArICc+JyArIHBhciArICc8L29iamVjdD4nO1xuXHRcdFx0XHRvYmpJZEFycltvYmpJZEFyci5sZW5ndGhdID0gYXR0T2JqLmlkOyAvLyBzdG9yZWQgdG8gZml4IG9iamVjdCAnbGVha3MnIG9uIHVubG9hZCAoZHluYW1pYyBwdWJsaXNoaW5nIG9ubHkpXG5cdFx0XHRcdHIgPSBnZXRFbGVtZW50QnlJZChhdHRPYmouaWQpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIHdlbGwtYmVoYXZpbmcgYnJvd3NlcnNcblx0XHRcdFx0dmFyIG8gPSBjcmVhdGVFbGVtZW50KE9CSkVDVCk7XG5cdFx0XHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdFx0XHRmb3IgKHZhciBtIGluIGF0dE9iaikge1xuXHRcdFx0XHRcdGlmIChhdHRPYmpbbV0gIT0gT2JqZWN0LnByb3RvdHlwZVttXSkgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzXG5cdFx0XHRcdFx0XHRpZiAobS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChtLnRvTG93ZXJDYXNlKCkgIT0gXCJjbGFzc2lkXCIpIHsgLy8gZmlsdGVyIG91dCBJRSBzcGVjaWZpYyBhdHRyaWJ1dGVcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUobSwgYXR0T2JqW21dKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICh2YXIgbiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW25dICE9IE9iamVjdC5wcm90b3R5cGVbbl0gJiYgbi50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzIGFuZCBJRSBzcGVjaWZpYyBwYXJhbSBlbGVtZW50XG5cdFx0XHRcdFx0XHRjcmVhdGVPYmpQYXJhbShvLCBuLCBwYXJPYmpbbl0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChvLCBlbCk7XG5cdFx0XHRcdHIgPSBvO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVPYmpQYXJhbShlbCwgcE5hbWUsIHBWYWx1ZSkge1xuXHRcdHZhciBwID0gY3JlYXRlRWxlbWVudChcInBhcmFtXCIpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwibmFtZVwiLCBwTmFtZSk7XG5cdFx0cC5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLCBwVmFsdWUpO1xuXHRcdGVsLmFwcGVuZENoaWxkKHApO1xuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgU1dGIHJlbW92YWxcblx0XHQtIEVzcGVjaWFsbHkgbmVlZGVkIHRvIHNhZmVseSBhbmQgY29tcGxldGVseSByZW1vdmUgYSBTV0YgaW4gSW50ZXJuZXQgRXhwbG9yZXJcblx0Ki9cblx0ZnVuY3Rpb24gcmVtb3ZlU1dGKGlkKSB7XG5cdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRpZiAob2JqICYmIG9iai5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRyZW1vdmVPYmplY3RJbklFKGlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gcmVtb3ZlT2JqZWN0SW5JRShpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0Zm9yICh2YXIgaSBpbiBvYmopIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBvYmpbaV0gPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0b2JqW2ldID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHR9XG5cdH1cblx0LyogRnVuY3Rpb25zIHRvIG9wdGltaXplIEphdmFTY3JpcHQgY29tcHJlc3Npb25cblx0Ki9cblx0ZnVuY3Rpb24gZ2V0RWxlbWVudEJ5SWQoaWQpIHtcblx0XHR2YXIgZWwgPSBudWxsO1xuXHRcdHRyeSB7XG5cdFx0XHRlbCA9IGRvYy5nZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0fVxuXHRcdGNhdGNoIChlKSB7fVxuXHRcdHJldHVybiBlbDtcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVFbGVtZW50KGVsKSB7XG5cdFx0cmV0dXJuIGRvYy5jcmVhdGVFbGVtZW50KGVsKTtcblx0fVxuXHQvKiBVcGRhdGVkIGF0dGFjaEV2ZW50IGZ1bmN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdC0gU3RvcmVzIGF0dGFjaEV2ZW50IGluZm9ybWF0aW9uIGluIGFuIEFycmF5LCBzbyBvbiB1bmxvYWQgdGhlIGRldGFjaEV2ZW50IGZ1bmN0aW9ucyBjYW4gYmUgY2FsbGVkIHRvIGF2b2lkIG1lbW9yeSBsZWFrc1xuXHQqL1xuXHRmdW5jdGlvbiBhZGRMaXN0ZW5lcih0YXJnZXQsIGV2ZW50VHlwZSwgZm4pIHtcblx0XHR0YXJnZXQuYXR0YWNoRXZlbnQoZXZlbnRUeXBlLCBmbik7XG5cdFx0bGlzdGVuZXJzQXJyW2xpc3RlbmVyc0Fyci5sZW5ndGhdID0gW3RhcmdldCwgZXZlbnRUeXBlLCBmbl07XG5cdH1cblx0LyogRmxhc2ggUGxheWVyIGFuZCBTV0YgY29udGVudCB2ZXJzaW9uIG1hdGNoaW5nXG5cdCovXG5cdGZ1bmN0aW9uIGhhc1BsYXllclZlcnNpb24ocnYpIHtcblx0XHR2YXIgcHYgPSB1YS5wdiwgdiA9IHJ2LnNwbGl0KFwiLlwiKTtcblx0XHR2WzBdID0gcGFyc2VJbnQodlswXSwgMTApO1xuXHRcdHZbMV0gPSBwYXJzZUludCh2WzFdLCAxMCkgfHwgMDsgLy8gc3VwcG9ydHMgc2hvcnQgbm90YXRpb24sIGUuZy4gXCI5XCIgaW5zdGVhZCBvZiBcIjkuMC4wXCJcblx0XHR2WzJdID0gcGFyc2VJbnQodlsyXSwgMTApIHx8IDA7XG5cdFx0cmV0dXJuIChwdlswXSA+IHZbMF0gfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPiB2WzFdKSB8fCAocHZbMF0gPT0gdlswXSAmJiBwdlsxXSA9PSB2WzFdICYmIHB2WzJdID49IHZbMl0pKSA/IHRydWUgOiBmYWxzZTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgQ1NTIGNyZWF0aW9uXG5cdFx0LSBCYXNlZCBvbiBCb2JieSB2YW4gZGVyIFNsdWlzJyBzb2x1dGlvbjogaHR0cDovL3d3dy5ib2JieXZhbmRlcnNsdWlzLmNvbS9hcnRpY2xlcy9keW5hbWljQ1NTLnBocFxuXHQqL1xuXHRmdW5jdGlvbiBjcmVhdGVDU1Moc2VsLCBkZWNsLCBtZWRpYSwgbmV3U3R5bGUpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEubWFjKSB7IHJldHVybjsgfVxuXHRcdHZhciBoID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaGVhZFwiKVswXTtcblx0XHRpZiAoIWgpIHsgcmV0dXJuOyB9IC8vIHRvIGFsc28gc3VwcG9ydCBiYWRseSBhdXRob3JlZCBIVE1MIHBhZ2VzIHRoYXQgbGFjayBhIGhlYWQgZWxlbWVudFxuXHRcdHZhciBtID0gKG1lZGlhICYmIHR5cGVvZiBtZWRpYSA9PSBcInN0cmluZ1wiKSA/IG1lZGlhIDogXCJzY3JlZW5cIjtcblx0XHRpZiAobmV3U3R5bGUpIHtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gbnVsbDtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoIWR5bmFtaWNTdHlsZXNoZWV0IHx8IGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgIT0gbSkge1xuXHRcdFx0Ly8gY3JlYXRlIGR5bmFtaWMgc3R5bGVzaGVldCArIGdldCBhIGdsb2JhbCByZWZlcmVuY2UgdG8gaXRcblx0XHRcdHZhciBzID0gY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dC9jc3NcIik7XG5cdFx0XHRzLnNldEF0dHJpYnV0ZShcIm1lZGlhXCIsIG0pO1xuXHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQgPSBoLmFwcGVuZENoaWxkKHMpO1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiB0eXBlb2YgZG9jLnN0eWxlU2hlZXRzICE9IFVOREVGICYmIGRvYy5zdHlsZVNoZWV0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gZG9jLnN0eWxlU2hlZXRzW2RvYy5zdHlsZVNoZWV0cy5sZW5ndGggLSAxXTtcblx0XHRcdH1cblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgPSBtO1xuXHRcdH1cblx0XHQvLyBhZGQgc3R5bGUgcnVsZVxuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdGlmIChkeW5hbWljU3R5bGVzaGVldCAmJiB0eXBlb2YgZHluYW1pY1N0eWxlc2hlZXQuYWRkUnVsZSA9PSBPQkpFQ1QpIHtcblx0XHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQuYWRkUnVsZShzZWwsIGRlY2wpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGlmIChkeW5hbWljU3R5bGVzaGVldCAmJiB0eXBlb2YgZG9jLmNyZWF0ZVRleHROb2RlICE9IFVOREVGKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFwcGVuZENoaWxkKGRvYy5jcmVhdGVUZXh0Tm9kZShzZWwgKyBcIiB7XCIgKyBkZWNsICsgXCJ9XCIpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gc2V0VmlzaWJpbGl0eShpZCwgaXNWaXNpYmxlKSB7XG5cdFx0aWYgKCFhdXRvSGlkZVNob3cpIHsgcmV0dXJuOyB9XG5cdFx0dmFyIHYgPSBpc1Zpc2libGUgPyBcInZpc2libGVcIiA6IFwiaGlkZGVuXCI7XG5cdFx0aWYgKGlzRG9tTG9hZGVkICYmIGdldEVsZW1lbnRCeUlkKGlkKSkge1xuXHRcdFx0Z2V0RWxlbWVudEJ5SWQoaWQpLnN0eWxlLnZpc2liaWxpdHkgPSB2O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNyZWF0ZUNTUyhcIiNcIiArIGlkLCBcInZpc2liaWxpdHk6XCIgKyB2KTtcblx0XHR9XG5cdH1cblx0LyogRmlsdGVyIHRvIGF2b2lkIFhTUyBhdHRhY2tzXG5cdCovXG5cdGZ1bmN0aW9uIHVybEVuY29kZUlmTmVjZXNzYXJ5KHMpIHtcblx0XHR2YXIgcmVnZXggPSAvW1xcXFxcXFwiPD5cXC47XS87XG5cdFx0dmFyIGhhc0JhZENoYXJzID0gcmVnZXguZXhlYyhzKSAhPSBudWxsO1xuXHRcdHJldHVybiBoYXNCYWRDaGFycyAmJiB0eXBlb2YgZW5jb2RlVVJJQ29tcG9uZW50ICE9IFVOREVGID8gZW5jb2RlVVJJQ29tcG9uZW50KHMpIDogcztcblx0fVxuXHQvKiBSZWxlYXNlIG1lbW9yeSB0byBhdm9pZCBtZW1vcnkgbGVha3MgY2F1c2VkIGJ5IGNsb3N1cmVzLCBmaXggaGFuZ2luZyBhdWRpby92aWRlbyB0aHJlYWRzIGFuZCBmb3JjZSBvcGVuIHNvY2tldHMvTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdCAoSW50ZXJuZXQgRXhwbG9yZXIgb25seSlcblx0Ki9cblx0KGZ1bmN0aW9uKCkge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdHdpbmRvdy5hdHRhY2hFdmVudChcIm9udW5sb2FkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyByZW1vdmUgbGlzdGVuZXJzIHRvIGF2b2lkIG1lbW9yeSBsZWFrc1xuXHRcdFx0XHR2YXIgbGwgPSBsaXN0ZW5lcnNBcnIubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxsOyBpKyspIHtcblx0XHRcdFx0XHRsaXN0ZW5lcnNBcnJbaV1bMF0uZGV0YWNoRXZlbnQobGlzdGVuZXJzQXJyW2ldWzFdLCBsaXN0ZW5lcnNBcnJbaV1bMl0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGNsZWFudXAgZHluYW1pY2FsbHkgZW1iZWRkZWQgb2JqZWN0cyB0byBmaXggYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzIGFuZCBOZXRDb25uZWN0aW9ucyB0byBkaXNjb25uZWN0XG5cdFx0XHRcdHZhciBpbCA9IG9iaklkQXJyLmxlbmd0aDtcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBpbDsgaisrKSB7XG5cdFx0XHRcdFx0cmVtb3ZlU1dGKG9iaklkQXJyW2pdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjbGVhbnVwIGxpYnJhcnkncyBtYWluIGNsb3N1cmVzIHRvIGF2b2lkIG1lbW9yeSBsZWFrc1xuXHRcdFx0XHRmb3IgKHZhciBrIGluIHVhKSB7XG5cdFx0XHRcdFx0dWFba10gPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVhID0gbnVsbDtcblx0XHRcdFx0Zm9yICh2YXIgbCBpbiBzd2ZvYmplY3QpIHtcblx0XHRcdFx0XHRzd2ZvYmplY3RbbF0gPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN3Zm9iamVjdCA9IG51bGw7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pKCk7XG5cdHJldHVybiB7XG5cdFx0LyogUHVibGljIEFQSVxuXHRcdFx0LSBSZWZlcmVuY2U6IGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9kb2N1bWVudGF0aW9uXG5cdFx0Ki9cblx0XHRyZWdpc3Rlck9iamVjdDogZnVuY3Rpb24ob2JqZWN0SWRTdHIsIHN3ZlZlcnNpb25TdHIsIHhpU3dmVXJsU3RyLCBjYWxsYmFja0ZuKSB7XG5cdFx0XHRpZiAodWEudzMgJiYgb2JqZWN0SWRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHR2YXIgcmVnT2JqID0ge307XG5cdFx0XHRcdHJlZ09iai5pZCA9IG9iamVjdElkU3RyO1xuXHRcdFx0XHRyZWdPYmouc3dmVmVyc2lvbiA9IHN3ZlZlcnNpb25TdHI7XG5cdFx0XHRcdHJlZ09iai5leHByZXNzSW5zdGFsbCA9IHhpU3dmVXJsU3RyO1xuXHRcdFx0XHRyZWdPYmouY2FsbGJhY2tGbiA9IGNhbGxiYWNrRm47XG5cdFx0XHRcdHJlZ09iakFycltyZWdPYmpBcnIubGVuZ3RoXSA9IHJlZ09iajtcblx0XHRcdFx0c2V0VmlzaWJpbGl0eShvYmplY3RJZFN0ciwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2FsbGJhY2tGbikge1xuXHRcdFx0XHRjYWxsYmFja0ZuKHtzdWNjZXNzOmZhbHNlLCBpZDpvYmplY3RJZFN0cn0pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0Z2V0T2JqZWN0QnlJZDogZnVuY3Rpb24ob2JqZWN0SWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gZ2V0T2JqZWN0QnlJZChvYmplY3RJZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbikge1xuXHRcdFx0dmFyIGNhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdFx0aWYgKHVhLnczICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpICYmIHN3ZlVybFN0ciAmJiByZXBsYWNlRWxlbUlkU3RyICYmIHdpZHRoU3RyICYmIGhlaWdodFN0ciAmJiBzd2ZWZXJzaW9uU3RyKSB7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgZmFsc2UpO1xuXHRcdFx0XHRhZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0d2lkdGhTdHIgKz0gXCJcIjsgLy8gYXV0by1jb252ZXJ0IHRvIHN0cmluZ1xuXHRcdFx0XHRcdGhlaWdodFN0ciArPSBcIlwiO1xuXHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRpZiAoYXR0T2JqICYmIHR5cGVvZiBhdHRPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhdHRPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIGF0dE9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRhdHRbaV0gPSBhdHRPYmpbaV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF0dC5kYXRhID0gc3dmVXJsU3RyO1xuXHRcdFx0XHRcdGF0dC53aWR0aCA9IHdpZHRoU3RyO1xuXHRcdFx0XHRcdGF0dC5oZWlnaHQgPSBoZWlnaHRTdHI7XG5cdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdGlmIChwYXJPYmogJiYgdHlwZW9mIHBhck9iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBqIGluIHBhck9iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgcGFyT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdHBhcltqXSA9IHBhck9ialtqXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGZsYXNodmFyc09iaiAmJiB0eXBlb2YgZmxhc2h2YXJzT2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGsgaW4gZmxhc2h2YXJzT2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBmbGFzaHZhcnNPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBwYXIuZmxhc2h2YXJzICE9IFVOREVGKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRwYXIuZmxhc2h2YXJzID0gayArIFwiPVwiICsgZmxhc2h2YXJzT2JqW2tdO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHN3ZlZlcnNpb25TdHIpKSB7IC8vIGNyZWF0ZSBTV0Zcblx0XHRcdFx0XHRcdHZhciBvYmogPSBjcmVhdGVTV0YoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0XHRcdFx0aWYgKGF0dC5pZCA9PSByZXBsYWNlRWxlbUlkU3RyKSB7XG5cdFx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5zdWNjZXNzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGNhbGxiYWNrT2JqLnJlZiA9IG9iajtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoeGlTd2ZVcmxTdHIgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkgeyAvLyBzaG93IEFkb2JlIEV4cHJlc3MgSW5zdGFsbFxuXHRcdFx0XHRcdFx0YXR0LmRhdGEgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0XHRcdHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbik7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgeyAvLyBzaG93IGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChjYWxsYmFja0ZuKSB7IGNhbGxiYWNrRm4oY2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTtcdH1cblx0XHR9LFxuXHRcdHN3aXRjaE9mZkF1dG9IaWRlU2hvdzogZnVuY3Rpb24oKSB7XG5cdFx0XHRhdXRvSGlkZVNob3cgPSBmYWxzZTtcblx0XHR9LFxuXHRcdHVhOiB1YSxcblx0XHRnZXRGbGFzaFBsYXllclZlcnNpb246IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHsgbWFqb3I6dWEucHZbMF0sIG1pbm9yOnVhLnB2WzFdLCByZWxlYXNlOnVhLnB2WzJdIH07XG5cdFx0fSxcblx0XHRoYXNGbGFzaFBsYXllclZlcnNpb246IGhhc1BsYXllclZlcnNpb24sXG5cdFx0Y3JlYXRlU1dGOiBmdW5jdGlvbihhdHRPYmosIHBhck9iaiwgcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdHJldHVybiBjcmVhdGVTV0YoYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRzaG93RXhwcmVzc0luc3RhbGw6IGZ1bmN0aW9uKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKSB7XG5cdFx0XHRpZiAodWEudzMgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkge1xuXHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cmVtb3ZlU1dGOiBmdW5jdGlvbihvYmpFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZW1vdmVTV0Yob2JqRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGNyZWF0ZUNTUzogZnVuY3Rpb24oc2VsU3RyLCBkZWNsU3RyLCBtZWRpYVN0ciwgbmV3U3R5bGVCb29sZWFuKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0Y3JlYXRlQ1NTKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhZGREb21Mb2FkRXZlbnQ6IGFkZERvbUxvYWRFdmVudCxcblx0XHRhZGRMb2FkRXZlbnQ6IGFkZExvYWRFdmVudCxcblx0XHRnZXRRdWVyeVBhcmFtVmFsdWU6IGZ1bmN0aW9uKHBhcmFtKSB7XG5cdFx0XHR2YXIgcSA9IGRvYy5sb2NhdGlvbi5zZWFyY2ggfHwgZG9jLmxvY2F0aW9uLmhhc2g7XG5cdFx0XHRpZiAocSkge1xuXHRcdFx0XHRpZiAoL1xcPy8udGVzdChxKSkgeyBxID0gcS5zcGxpdChcIj9cIilbMV07IH0gLy8gc3RyaXAgcXVlc3Rpb24gbWFya1xuXHRcdFx0XHRpZiAocGFyYW0gPT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFpcnMgPSBxLnNwbGl0KFwiJlwiKTtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChwYWlyc1tpXS5zdWJzdHJpbmcoMCwgcGFpcnNbaV0uaW5kZXhPZihcIj1cIikpID09IHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocGFpcnNbaV0uc3Vic3RyaW5nKChwYWlyc1tpXS5pbmRleE9mKFwiPVwiKSArIDEpKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9LFxuXHRcdC8vIEZvciBpbnRlcm5hbCB1c2FnZSBvbmx5XG5cdFx0ZXhwcmVzc0luc3RhbGxDYWxsYmFjazogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoaXNFeHByZXNzSW5zdGFsbEFjdGl2ZSkge1xuXHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoRVhQUkVTU19JTlNUQUxMX0lEKTtcblx0XHRcdFx0aWYgKG9iaiAmJiBzdG9yZWRBbHRDb250ZW50KSB7XG5cdFx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHN0b3JlZEFsdENvbnRlbnQsIG9iaik7XG5cdFx0XHRcdFx0aWYgKHN0b3JlZEFsdENvbnRlbnRJZCkge1xuXHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShzdG9yZWRBbHRDb250ZW50SWQsIHRydWUpO1xuXHRcdFx0XHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikgeyBzdG9yZWRBbHRDb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7IH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHN0b3JlZENhbGxiYWNrRm4pIHsgc3RvcmVkQ2FsbGJhY2tGbihzdG9yZWRDYWxsYmFja09iaik7IH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufSgpO1xubW9kdWxlLmV4cG9ydHMgPSBzd2ZvYmplY3Q7XG4iLCJ2YXIgcHVyZUluc3RhbmNlID0gcmVxdWlyZSgnLi9wdXJlLWluc3RhbmNlJyk7XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBINC+0YjQuNCx0LrQuC4g0J7RgNC40LPQuNC90LDQu9GM0L3Ri9C5IEVycm9yINCy0LXQtNGR0YIg0YHQtdCx0Y8g0LrQsNC6INGE0LDQsdGA0LjQutCwLCDQsCDQvdC1INC60LDQuiDQutC70LDRgdGBLiDQrdGC0L7RgiDQvtCx0YrQtdC60YIg0LLQtdC00ZHRgiDRgdC10LHRjyDQutCw0Log0LrQu9Cw0YHRgSDQuCDQtdCz0L4g0LzQvtC20L3QviDQvdCw0YHQu9C10LTQvtCy0LDRgtGMLlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtINGB0L7QvtCx0YnQtdC90LjQtVxuICogQHBhcmFtIHtOdW1iZXJ9IFtpZF0gLSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgCDQvtGI0LjQsdC60LhcbiAqIEBleHRlbmRzIEVycm9yXG4gKiBAZXhwb3J0ZWQgeWEubXVzaWMubGliLkVycm9yXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVycm9yQ2xhc3MgPSBmdW5jdGlvbihtZXNzYWdlLCBpZCkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSwgaWQpO1xuICAgIGVyci5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgdGhpcy5tZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgdGhpcy5zdGFjayA9IGVyci5zdGFjaztcbn07XG5cbi8qKlxuICog0KHQsNGF0LDRgCDQtNC70Y8g0LHRi9GB0YLRgNC+0LPQviDRgdC+0LfQtNCw0L3QuNGPINC90L7QstC+0LPQviDQutC70LDRgdGB0LAg0L7RiNC40LHQvtC6LlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSDQuNC80Y8g0YHQvtC30LTQsNCy0LDQtdC80L7Qs9C+INC60LvQsNGB0YHQsFxuICogQHJldHVybnMge0Vycm9yQ2xhc3N9XG4gKi9cbkVycm9yQ2xhc3MuY3JlYXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBlcnJDbGFzcyA9IHB1cmVJbnN0YW5jZSh0aGlzKTtcbiAgICBlcnJDbGFzcy5uYW1lID0gbmFtZTtcbiAgICByZXR1cm4gZXJyQ2xhc3M7XG59O1xuXG5FcnJvckNsYXNzLnByb3RvdHlwZSA9IHB1cmVJbnN0YW5jZShFcnJvcik7XG5FcnJvckNsYXNzLnByb3RvdHlwZS5uYW1lID0gXCJFcnJvckNsYXNzXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXJyb3JDbGFzcztcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9hc3luYy9ldmVudHMnKTtcblxuLy9USElOSzog0LjQt9GD0YfQuNGC0Ywg0LrQsNC6INGA0LDQsdC+0YLQsNC10YIgRVMgMjAxNSBQcm94eSDQuCDQv9C+0L/RgNC+0LHQvtCy0LDRgtGMINC40YHQv9C+0LvRjNC30L7QstCw0YLRjFxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J/RgNC+0LrRgdC4LdC60LvQsNGB0YEuINCS0YvQtNCw0ZHRgiDQvdCw0YDRg9C20YMg0LvQuNGI0Ywg0L/Rg9Cx0LvQuNGH0L3Ri9C1INC80LXRgtC+0LTRiyDQvtCx0YrQtdC60YLQsCDQuCDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAuXG4gKiDQndC1INC60L7Qv9C40YDRg9C10YIg0LzQtdGC0L7QtNGLINC40LcgT2JqZWN0LnByb3RvdHlwZS4g0JLRgdC1INC80LXRgtC+0LTRiyDQuNC80LXRjtGCINC/0YDQuNCy0Y/Qt9C60YMg0LrQvtC90YLQtdC60YHRgtCwINC6INC/0YDQvtC60YHQuNGA0YPQtdC80L7QvNGDINC+0LHRitC10LrRgtGDLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0XSAtINC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YLRgNC10LHRg9C10YLRgdGPINC/0YDQvtC60YHQuNGA0L7QstCw0YLRjFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgUHJveHkgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChrZXlbMF0gPT09IFwiX1wiXG4gICAgICAgICAgICAgICAgfHwgdHlwZW9mIG9iamVjdFtrZXldICE9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAgICAgICB8fCBvYmplY3Rba2V5XSA9PT0gT2JqZWN0LnByb3RvdHlwZVtrZXldXG4gICAgICAgICAgICAgICAgfHwgb2JqZWN0Lmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgICAgICB8fCBFdmVudHMucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpc1trZXldID0gb2JqZWN0W2tleV0uYmluZChvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9iamVjdC5waXBlRXZlbnRzKSB7XG4gICAgICAgICAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5vbiA9IEV2ZW50cy5wcm90b3R5cGUub247XG4gICAgICAgICAgICB0aGlzLm9uY2UgPSBFdmVudHMucHJvdG90eXBlLm9uY2U7XG4gICAgICAgICAgICB0aGlzLm9mZiA9IEV2ZW50cy5wcm90b3R5cGUub2ZmO1xuICAgICAgICAgICAgdGhpcy5jbGVhckxpc3RlbmVycyA9IEV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIG9iamVjdC5waXBlRXZlbnRzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiDQrdC60YHQv9C+0YDRgtC40YDRg9C10YIg0YHRgtCw0YLQuNGH0LXRgdC60LjQtSDRgdCy0L7QudGB0YLQstCwINC40Lcg0L7QtNC90L7Qs9C+INC+0LHRitC10LrRgtCwINCyINC00YDRg9Cz0L7QuSwg0LjRgdC60LvRjtGH0LDRjyDRg9C60LDQt9Cw0L3QvdGL0LUsINC/0YDQuNCy0LDRgtC90YvQtSDQuCDQv9GA0L7RgtC+0YLQuNC/XG4gKiBAcGFyYW0ge09iamVjdH0gZnJvbSAtINC+0YLQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtPYmplY3R9IHRvIC0g0LrRg9C00LAg0LrQvtC/0LjRgNC+0LLQsNGC0YxcbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IFtleGNsdWRlXSAtINGB0LLQvtC50YHRgtCy0LAg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC40YHQutC70Y7Rh9C40YLRjFxuICovXG5Qcm94eS5leHBvcnRTdGF0aWMgPSBmdW5jdGlvbihmcm9tLCB0bywgZXhjbHVkZSkge1xuICAgIGV4Y2x1ZGUgPSBleGNsdWRlIHx8IFtdO1xuXG4gICAgT2JqZWN0LmtleXMoZnJvbSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgaWYgKCFmcm9tLmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgIHx8IGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgIHx8IGtleSA9PT0gXCJwcm90b3R5cGVcIlxuICAgICAgICAgICAgfHwgZXhjbHVkZS5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0b1trZXldID0gZnJvbVtrZXldO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC/0YDQvtC60YHQuC3Qv9C70LDRgdGB0LAg0L/RgNC40LLRj9C30LDQvdC90L7Qs9C+INC6INGD0LrQsNC30LDQvdC90L7QvNGDINC60LvQsNGB0YHRgy4g0JzQvtC20L3QviDQvdCw0LfQvdCw0YfQuNGC0Ywg0YDQvtC00LjRgtC10LvRjNGB0LrQuNC5INC60LvQsNGB0YEuXG4gKiDQoyDRgNC+0LTQuNGC0LXQu9GM0YHQutC+0LPQviDQutC70LDRgdGB0LAg0L/QvtGP0LLQu9GP0LXRgtGB0Y8g0L/RgNC40LLQsNGC0L3Ri9C5INC80LXRgtC+0LQgX3Byb3h5LCDQutC+0YLQvtGA0YvQuSDQstGL0LTQsNGR0YIg0L/RgNC+0LrRgdC4LdC+0LHRitC10LrRgiDQtNC70Y9cbiAqINC00LDQvdC90L7Qs9C+INGN0LrQt9C10LzQu9GP0YDQsC4g0KLQsNC60LbQtSDQv9C+0Y/QstC70Y/QtdGC0YHRjyDRgdCy0L7QudGB0YLQstC+IF9fcHJveHksINGB0L7QtNC10YDQttCw0YnQtdC1INGB0YHRi9C70LrRgyDQvdCwINGB0L7Qt9C00LDQvdC90YvQuSDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gT3JpZ2luYWxDbGFzcyAtINC+0YDQuNCz0LjQvdCw0LvRjNC90YvQuSDQutC70LDRgdGBXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBbUGFyZW50UHJveHlDbGFzcz1Qcm94eV0gLSDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgVxuICogQHJldHVybnMge2Z1bmN0aW9ufSAtLSDQutC+0L3RgdGC0YDRg9GC0L7RgCDQv9GA0L7QutGB0LjRgNC+0LLQsNC90L3QvtCz0L4g0LrQu9Cw0YHRgdCwXG4gKi9cblByb3h5LmNyZWF0ZUNsYXNzID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcywgUGFyZW50UHJveHlDbGFzcywgZXhjbHVkZVN0YXRpYykge1xuXG4gICAgdmFyIFByb3h5Q2xhc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcblxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBuZXcgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yKCk7XG4gICAgICAgIE9yaWdpbmFsQ2xhc3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLl9wcm94eSgpO1xuICAgIH07XG5cbiAgICB2YXIgUGFyZW50UHJveHlDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlID0gKFBhcmVudFByb3h5Q2xhc3MgfHwgUHJveHkpLnByb3RvdHlwZTtcbiAgICBQcm94eUNsYXNzLnByb3RvdHlwZSA9IG5ldyBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IoKTtcblxuICAgIHZhciB2YWw7XG4gICAgZm9yICh2YXIgayBpbiBPcmlnaW5hbENsYXNzLnByb3RvdHlwZSkge1xuICAgICAgICB2YWwgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZVtrXTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGVba10gPT0gdmFsIHx8IHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiB8fCBrWzBdID09PSBcIl9cIikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVba10gPSB2YWw7XG4gICAgfVxuXG4gICAgdmFyIGNyZWF0ZVByb3h5ID0gZnVuY3Rpb24ob3JpZ2luYWwpIHtcbiAgICAgICAgdmFyIHByb3RvID0gUHJveHkucHJvdG90eXBlO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBQcm94eUNsYXNzLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KG9yaWdpbmFsKTtcbiAgICAgICAgUHJveHkucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9O1xuXG4gICAgT3JpZ2luYWxDbGFzcy5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fX3Byb3h5KSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJveHkgPSBjcmVhdGVQcm94eSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fcHJveHk7XG4gICAgfTtcblxuICAgIGlmICghZXhjbHVkZVN0YXRpYykge1xuICAgICAgICBQcm94eS5leHBvcnRTdGF0aWMoT3JpZ2luYWxDbGFzcywgUHJveHlDbGFzcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb3h5Q2xhc3M7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQGV4cG9ydGVkIHlhLm11c2ljLmxpYi5wdXJlSW5zdGFuY2VcbiAqIEByZXR1cm5zIHtPcmlnaW5hbENsYXNzfVxuICovXG52YXIgcHVyZUluc3RhbmNlID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcykge1xuICAgIHZhciBQdXJlQ2xhc3MgPSBmdW5jdGlvbigpIHt9O1xuICAgIFB1cmVDbGFzcy5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcbiAgICByZXR1cm4gbmV3IFB1cmVDbGFzcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBwdXJlSW5zdGFuY2U7XG4iLCIvKipcbiAqINCe0LHRitC10LTQuNC90LXQvdC40LUg0L7QsdGK0LXQutGC0L7QslxuICogQHBhcmFtIHtPYmplY3R9IGluaXRpYWwgLSDQvdCw0YfQsNC70YzQvdGL0Lkg0L7QsdGK0LXQutGCXG4gKiBAcGFyYW0ge09iamVjdH0gLi4uYXJncyAtINGB0L/QuNGB0L7QuiDQvtCx0YrQtdC60YLQvtCyINC60L7RgtC+0YDRi9C1INC90LDQtNC+INC+0LHRitC10LTQuNC90LjRgtGMINGBINC90LDRh9Cw0LvRjNC90YvQvFxuICogQHBhcmFtIHtCb29sZWFufSBbZXh0ZW5kXSAtINC10YHQu9C4INC/0L7RgdC70LXQtNC90LjQuSDQsNGA0LPRg9C80LXQvdGCIHRydWUsINGC0L4g0LHRg9C00LXRgiDQvNC+0LTQuNGE0LjRhtC40YDQvtCy0LDQvSDQvdCw0YfQsNC70YzQvdGL0Lkg0L7QsdGK0LXQutGCLCDQsiDQv9GA0L7RgtC40LLQvdC+0Lwg0YHQu9GD0YfQsNC1INCx0YPQtNC10YIg0YHQvtC30LTQsNC90LAg0L3QtdCz0LvRg9Cx0L7QutCw0Y8g0LrQvtC/0LjRjy5cbiAqIEBleHBvcnRlZCB5YS5tdXNpYy5saWIubWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKi9cbnZhciBtZXJnZSA9IGZ1bmN0aW9uKGluaXRpYWwpIHtcbiAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBrZXk7XG5cbiAgICBpZiAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB0cnVlKSB7XG4gICAgICAgIG9iamVjdCA9IGluaXRpYWw7XG4gICAgICAgIGFyZ3MucG9wKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0ID0ge307XG4gICAgICAgIGZvciAoa2V5IGluIGluaXRpYWwpIHtcbiAgICAgICAgICAgIGlmIChpbml0aWFsLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IGluaXRpYWxba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGsgPSAwLCBsID0gYXJncy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgZm9yIChrZXkgaW4gYXJnc1trXSkge1xuICAgICAgICAgICAgaWYgKGFyZ3Nba10uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gYXJnc1trXVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxuaWYgKCF5YS5tdXNpYy5saWIpIHtcbiAgICB5YS5tdXNpYy5saWIgPSB7fTtcbn1cblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4vYXN5bmMvZXZlbnRzJyk7XG52YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4vY2xhc3MvZXJyb3ItY2xhc3MnKTtcbnZhciBwdXJlSW5zdGFuY2UgPSByZXF1aXJlKCcuL2NsYXNzL3B1cmUtaW5zdGFuY2UnKTtcblxudmFyIEV2ZW50c1Byb3h5ID0gZnVuY3Rpb24oKSB7IEV2ZW50cy5jYWxsKHRoaXMpOyB9O1xuRXZlbnRzUHJveHkucHJvdG90eXBlID0gcHVyZUluc3RhbmNlKEV2ZW50cyk7XG5FdmVudHNQcm94eS5taXhpbiA9IEV2ZW50cy5taXhpbjtcbkV2ZW50c1Byb3h5LmV2ZW50aXplID0gRXZlbnRzLmV2ZW50aXplO1xuXG52YXIgRXJyb3JDbGFzc1Byb3h5ID0gZnVuY3Rpb24oKSB7IEVycm9yQ2xhc3MuYXBwbHkodGhpcywgYXJndW1lbnRzKTsgfTtcbkVycm9yQ2xhc3NQcm94eS5wcm90b3R5cGUgPSBwdXJlSW5zdGFuY2UoRXJyb3JDbGFzcyk7XG5FcnJvckNsYXNzUHJveHkuY3JlYXRlID0gRXJyb3JDbGFzcy5jcmVhdGU7XG5cbnlhLm11c2ljLmxpYi5FdmVudHMgPSBFdmVudHNQcm94eTtcbnlhLm11c2ljLmxpYi5FcnJvciA9IEVycm9yQ2xhc3NQcm94eTtcblxueWEubXVzaWMubGliLlByb21pc2UgPSByZXF1aXJlKCcuL2FzeW5jL3Byb21pc2UnKTtcbnlhLm11c2ljLmxpYi5EZWZlcnJlZCA9IHJlcXVpcmUoJy4vYXN5bmMvZGVmZXJyZWQnKTtcblxueWEubXVzaWMubGliLnB1cmVJbnN0YW5jZSA9IHB1cmVJbnN0YW5jZTtcbnlhLm11c2ljLmxpYi5tZXJnZSA9IHJlcXVpcmUoJy4vZGF0YS9tZXJnZScpO1xuXG55YS5tdXNpYy5pbmZvID0gcmVxdWlyZSgnLi9icm93c2VyL2RldGVjdCcpO1xuIiwicmVxdWlyZSgnLi4vLi4vLi4vZXhwb3J0Jyk7XG5cbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4vbG9hZGVyLWVycm9yJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkxvYWRlckVycm9yID0gTG9hZGVyRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uLy4uL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICogQGV4cG9ydGVkIHlhLm11c2ljLkF1ZGlvLkxvYWRlckVycm9yXG4gKiBAY2xhc3NkZXNjINCa0LvQsNGB0YEg0L7RiNC40LHQvtC6INC30LDQs9GA0YPQt9GH0LjQutCwLlxuICog0KDQsNGB0YjQuNGA0Y/QtdGCIEVycm9yLlxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2Ug0KLQtdC60YHRgiDQvtGI0LjQsdC60LguXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBMb2FkZXJFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG59O1xuTG9hZGVyRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJMb2FkZXJFcnJvclwiKTtcblxuLyoqXG4gKiDQotCw0LnQvNCw0YPRgiDQt9Cw0LPRgNGD0LfQutC4LlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5USU1FT1VUID0gXCJyZXF1ZXN0IHRpbWVvdXRcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC30LDQv9GA0L7RgdCwINC90LAg0LfQsNCz0YDRg9C30LrRgy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuTG9hZGVyRXJyb3IuRkFJTEVEID0gXCJyZXF1ZXN0IGZhaWxlZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvYWRlckVycm9yO1xuIiwiLyoqXG4gKiDQl9Cw0LPQu9GD0YjQutCwINCyINCy0LjQtNC1INC/0YPRgdGC0L7QuSDRhNGD0L3QutGG0LjQuCDQvdCwINCy0YHQtSDRgdC70YPRh9Cw0Lgg0LbQuNC30L3QuFxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vb3AgPSBmdW5jdGlvbigpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCJyZXF1aXJlKFwiLi4vZXhwb3J0XCIpO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcblxueWEubXVzaWMuQXVkaW8uTG9nZ2VyID0gTG9nZ2VyO1xuIiwidmFyIExFVkVMUyA9IFtcImRlYnVnXCIsIFwibG9nXCIsIFwiaW5mb1wiLCBcIndhcm5cIiwgXCJlcnJvclwiLCBcInRyYWNlXCJdO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9saWIvbm9vcCcpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBleHBvcnRlZCB5YS5tdXNpYy5Mb2dnZXJcbiAqIEBjbGFzc2Rlc2Mg0J3QsNGB0YLRgNCw0LjQstCw0LXQvNGL0Lkg0LvQvtCz0LPQtdGAINC00LvRjyDQsNGD0LTQuNC+0L/Qu9C10LXRgNCwLlxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwg0JjQvNGPINC60LDQvdCw0LvQsCwg0LfQsCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0YLQstC10YfQsNGC0Ywg0Y3QutC30LXQvNC70Y/RgCDQu9C+0LPQs9C10YDQsC5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC40LPQvdC+0YDQuNGA0YPQtdC80YvRhSDQutCw0L3QsNC70L7Qsi5cbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmlnbm9yZXMgPSBbXTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINCyINC60L7QvdGB0L7Qu9C4INGD0YDQvtCy0L3QtdC5INC70L7Qs9CwLlxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICovXG5Mb2dnZXIubG9nTGV2ZWxzID0gW107XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQodC40L3RgtCw0LrRgdC40YfQtdGB0LrQuNC5INGB0LDRhdCw0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZGVidWcqKi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuZGVidWcgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKipsb2cqKi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUubG9nID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqaW5mbyoqLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5pbmZvID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqd2FybioqLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS53YXJuID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZXJyb3IqKi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0INCa0L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwLlxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuZXJyb3IgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip0cmFjZSoqLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQg0JrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LAuXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS50cmFjZSA9IG5vb3A7XG5cbi8qKlxuICog0JzQtdGC0L7QtCDQtNC70Y8g0L7QsdGA0LDQsdC+0YLQutC4INGB0YHRi9C70L7Quiwg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9GFINCyINC70L7Qsy5cbiAqIEBwYXJhbSB1cmxcbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuX3Nob3dVcmwgPSBmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gTG9nZ2VyLnNob3dVcmwodXJsKTtcbn07XG5cbi8qKlxuICog0JzQtdGC0L7QtCDQtNC70Y8g0L7QsdGA0LDQsdC+0YLQutC4INGB0YHRi9C70L7Quiwg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9GFINCyINC70L7Qsy4g0JzQvtC20L3QviDQv9C10YDQtdC+0L/RgNC10LTQtdC70Y/RgtGMLiDQn9C+INGD0LzQvtC70YfQsNC90LjRjiDQvdC1INCy0YvQv9C+0LvQvdGP0LXRgiDQvdC40LrQsNC60LjRhSDQtNC10LnRgdGC0LLQuNC5LlxuICogQG5hbWUgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI3Nob3dVcmxcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwg0KHRgdGL0LvQutCwLlxuICogQHJldHVybnMge1N0cmluZ30g0YHRgdGL0LvQutGDLlxuICovXG5Mb2dnZXIuc2hvd1VybCA9IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiB1cmw7XG59O1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCX0LDQv9C40YHRjCDQtNCw0L3QvdGL0YUg0LIg0LvQvtCzXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQtNC10LvQsNGC0Ywg0LfQsNC/0LjRgdGMINCyINC70L7Qsy5cbiAqIEBwYXJhbSB7U3RyaW5nfSBsZXZlbCDQo9GA0L7QstC10L3RjCDQu9C+0LPQsC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBjaGFubmVsINCa0LDQvdCw0LsuXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCDQmtC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsC5cbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdINCU0L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLLlxuICovXG5Mb2dnZXIubG9nID0gZnVuY3Rpb24obGV2ZWwsIGNoYW5uZWwsIGNvbnRleHQpIHtcbiAgICB2YXIgZGF0YSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKS5tYXAoZnVuY3Rpb24oZHVtcEl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGR1bXBJdGVtICYmIGR1bXBJdGVtLl9sb2dnZXIgJiYgZHVtcEl0ZW0uX2xvZ2dlcigpIHx8IGR1bXBJdGVtO1xuICAgIH0pO1xuXG4gICAgdmFyIGxvZ0VudHJ5ID0ge1xuICAgICAgICB0aW1lc3RhbXA6ICtuZXcgRGF0ZSgpLFxuICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgIGNoYW5uZWw6IGNoYW5uZWwsXG4gICAgICAgIGNvbnRleHQ6IGNvbnRleHQsXG4gICAgICAgIG1lc3NhZ2U6IGRhdGFcbiAgICB9O1xuXG4gICAgaWYgKExvZ2dlci5pZ25vcmVzW2NoYW5uZWxdIHx8IExvZ2dlci5sb2dMZXZlbHMuaW5kZXhPZihsZXZlbCkgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBMb2dnZXIuX2R1bXBFbnRyeShsb2dFbnRyeSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LPQtS5cbiAqIEB0eXBlZGVmIHtPYmplY3R9IEF1ZGlvLkxvZ2dlci5Mb2dFbnRyeVxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHRpbWVzdGFtcCDQktGA0LXQvNGPINCyIHRpbWVzdGFtcCDRhNC+0YDQvNCw0YLQtS5cbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBsZXZlbCDQo9GA0L7QstC10L3RjCDQu9C+0LPQsC5cbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBjaGFubmVsINCa0LDQvdCw0LsuXG4gKiBAcHJvcGVydHkge09iamVjdH0gY29udGV4dCDQmtC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsC5cbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IG1lc3NhZ2Ug0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG4gKlxuICogQHByaXZhdGVcbiAqL1xuXG4vKipcbiAqINCX0LDQv9C40YHQsNGC0Ywg0YHQvtC+0LHRidC10L3QuNC1INC70L7Qs9CwINCyINC60L7QvdGB0L7Qu9GMLlxuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpby5Mb2dnZXJ+TG9nRW50cnl9IGxvZ0VudHJ5INCh0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsC5cbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZHVtcEVudHJ5ID0gZnVuY3Rpb24obG9nRW50cnkpIHtcbiAgICB0cnkge1xuICAgICAgICB2YXIgbGV2ZWwgPSBsb2dFbnRyeS5sZXZlbDtcblxuICAgICAgICB2YXIgbmFtZSA9IGxvZ0VudHJ5LmNvbnRleHQgJiYgKGxvZ0VudHJ5LmNvbnRleHQudGFza05hbWUgfHwgbG9nRW50cnkuY29udGV4dC5uYW1lKTtcbiAgICAgICAgdmFyIGNvbnRleHQgPSBsb2dFbnRyeS5jb250ZXh0ICYmIChsb2dFbnRyeS5jb250ZXh0Ll9sb2dnZXIgPyBsb2dFbnRyeS5jb250ZXh0Ll9sb2dnZXIoKSA6IFwiXCIpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZVtsZXZlbF0gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgW1xuICAgICAgICAgICAgICAgIGxldmVsLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAobG9nRW50cnkudGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgICBcIltcIiArIGxvZ0VudHJ5LmNoYW5uZWwgKyAobmFtZSA/IFwiOlwiICsgbmFtZSA6IFwiXCIpICsgXCJdXCIsXG4gICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgXS5jb25jYXQobG9nRW50cnkubWVzc2FnZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZVtsZXZlbF0uYXBwbHkoY29uc29sZSwgW1xuICAgICAgICAgICAgICAgIExvZ2dlci5fZm9ybWF0VGltZXN0YW1wKGxvZ0VudHJ5LnRpbWVzdGFtcCksXG4gICAgICAgICAgICAgICAgXCJbXCIgKyBsb2dFbnRyeS5jaGFubmVsICsgKG5hbWUgPyBcIjpcIiArIG5hbWUgOiBcIlwiKSArIFwiXVwiLFxuICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgIF0uY29uY2F0KGxvZ0VudHJ5Lm1lc3NhZ2UpKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2goZSkge1xuICAgIH1cbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINGE0L7RgNC80LDRgtC40YDQvtCy0LDQvdC40Y8g0LTQsNGC0Ysg0LTQu9GPINCy0YvQstC+0LTQsCDQsiDQutC+0L3QvtGB0L7Qu9GMLlxuICogQHBhcmFtIHRpbWVzdGFtcFxuICogQHJldHVybnMge3N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZm9ybWF0VGltZXN0YW1wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgIHZhciBtcyA9IGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCk7XG4gICAgbXMgPSBtcyA+IDEwMCA/IG1zIDogbXMgPiAxMCA/IFwiMFwiICsgbXMgOiBcIjAwXCIgKyBtcztcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoKSArIFwiLlwiICsgbXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiJdfQ==
