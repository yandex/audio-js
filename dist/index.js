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

//INFO: прям в момент инициализации всего модуля нельзя писать в лог - он проглатывает сообщения, т.к. ещё нет возможности настроить логгер.
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

/** Описание временных данных плеера
 * @typedef {Object} ya.music.Audio~AudioPlayerTimes
 *
 * @property {Number} duration - длительность трека
 * @property {Number} loaded - длительность загруженной части
 * @property {Number} position - позиция воспроизведения
 * @property {Number} played - длительность воспроизведения
 */

// =================================================================

//  JSDOC: Общие события плеера

// =================================================================

/** Событие начала воспроизведения ({@link ya.music.Audio.EVENT_PLAY})
 * @event ya.music.Audio#play
 */
/** Событие завершения воспроизведения ({@link ya.music.Audio.EVENT_ENDED})
 * @event ya.music.Audio#ended
 */
/** Событие изменения громкости ({@link ya.music.Audio.EVENT_VOLUME})
 * @event ya.music.Audio#volumechange
 * @param {Number} volume - громкость
 */
/** Событие краха плеера ({@link ya.music.Audio.EVENT_CRASHED})
 * @event ya.music.Audio#crashed
 */
/** Событие смены статуса плеера ({@link ya.music.Audio.EVENT_STATE})
 * @event ya.music.Audio#state
 * @param {String} state - новый статус плеера
 */
/** Событие переключения активного плеера и прелоадера ({@link ya.music.Audio.EVENT_SWAP})
 * @event ya.music.Audio#swap
 */

// =================================================================

//  JSDOC: события активного плеера

// =================================================================

/** Событие остановки воспроизведения ({@link ya.music.Audio.EVENT_STOP})
 * @event ya.music.Audio#stop
 */
/** Событие начала воспроизведения ({@link ya.music.Audio.EVENT_PAUSE})
 * @event ya.music.Audio#pause
 */
/** Событие обновления позиции воспроизведения/загруженной части ({@link ya.music.Audio.EVENT_PROGRESS})
 * @event ya.music.Audio#progress
 * @param {ya.music.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека ({@link ya.music.Audio.EVENT_LOADING})
 * @event ya.music.Audio#loading
 */
/** Событие завершения загрузки трека ({@link ya.music.Audio.EVENT_LOADED})
 * @event ya.music.Audio#loaded
 */
/** Событие ошибки воспроизведения ({@link ya.music.Audio.EVENT_ERROR})
 * @event ya.music.Audio#error
 */

// =================================================================

//  JSDOC: события предзагрузчика

// =================================================================

/** Событие остановки воспроизведения ({@link ya.music.Audio.EVENT_STOP})
 * @event ya.music.Audio#preloader:stop
 */
/** Событие начала воспроизведения ({@link ya.music.Audio.EVENT_PAUSE})
 * @event ya.music.Audio#preloader:pause
 */
/** Событие обновления позиции воспроизведения/загруженной части ({@link ya.music.Audio.EVENT_PROGRESS})
 * @event ya.music.Audio#preloader:progress
 * @param {ya.music.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека ({@link ya.music.Audio.EVENT_LOADING})
 * @event ya.music.Audio#preloader:loading
 */
/** Событие завершения загрузки трека ({@link ya.music.Audio.EVENT_LOADED})
 * @event ya.music.Audio#preloader:loaded
 */
/** Событие ошибки воспроизведения ({@link ya.music.Audio.EVENT_ERROR})
 * @event ya.music.Audio#preloader:error
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Аудио-плеер для браузера.
 * @alias ya.music.Audio
 * @param {String} [preferredType] - preferred player type (html5/flash)
 * @param {HTMLElement} [overlay] - dom element to show flash
 *
 * @extends Events
 * @mixes AudioStatic
 *
 * @fires ya.music.Audio#play
 * @fires ya.music.Audio#ended
 * @fires ya.music.Audio#volumechange
 * @fires ya.music.Audio#crashed
 * @fires ya.music.Audio#state
 * @fires ya.music.Audio#swap
 *
 * @fires ya.music.Audio#stop
 * @fires ya.music.Audio#pause
 * @fires ya.music.Audio#progress
 * @fires ya.music.Audio#loading
 * @fires ya.music.Audio#loaded
 * @fires ya.music.Audio#error
 *
 * @fires ya.music.Audio#preloader:stop
 * @fires ya.music.Audio#preloader:pause
 * @fires ya.music.Audio#preloader:progress
 * @fires ya.music.Audio#preloader:loading
 * @fires ya.music.Audio#preloader:loaded
 * @fires ya.music.Audio#preloader:error
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
 * Контекст для Web Audio API
 * @type {AudioContext}
 * @static
 */
AudioPlayer.audioContext = audioTypes.html5.audioContext;

// =================================================================

//  Инициализация

// =================================================================

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

// =================================================================

//  Обработка событий

// =================================================================

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

// =================================================================

//  Общие функции управления плеером

// =================================================================

/*
INFO: данный метод было решено оставить, т.к. это удобнее чем использовать обещание - есть возможность в начале
инициализации получить сразу ссылку на экземпляр плеера и обвешать его обработчиками событий. Плюс к тому при
таком подходе реинициализацию делать проще - при ней не придётся переназначать обработчики и обновлять везде ссылку
на текущий экземпляр плеера.
 */
/**
 * Возвращает обещание, разрешающееся после завершения инициализации.
 * @returns {Promise}
 */
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
 * @returns {String|null}
 */
AudioPlayer.prototype.getSrc = function(offset) {
    return this.implementation && this.implementation.getSrc(offset);
};

// =================================================================

//  Управление воспроизведением

// =================================================================
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
 * Перезапуск воспроизведения
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.restart = function() {
    if (!this.getDuration()) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    this._generatePlayId();
    this.setPosition(0);
    return this.resume();
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

// =================================================================

//  Предзагрузка

// =================================================================

/**
 * Предзагрузка трека
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - длительность трека. Актуально для флеш-реализации, в ней пока трек грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.preload = function(src, duration) {
    if (detect.browser.name === "msie" && detect.browser.version[0] == "9") {
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

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
 * @returns {Boolean}
 */
AudioPlayer.prototype.isPreloaded = function(src) {
    return this.implementation.isPreloaded(src);
};

/**
 * Проверка, что трек предзагружается
 * @param {String} src - ссылка на трек
 * @returns {Boolean}
 */
AudioPlayer.prototype.isPreloading = function(src) {
    return this.implementation.isPreloading(src, 1);
};

// =================================================================

//  Тайминги

// =================================================================

/**
 * Получение позиции воспроизведения
 * @returns {Number}
 */
AudioPlayer.prototype.getPosition = function() {
    return this.implementation.getPosition() || 0;
};

/**
 * Установка позиции воспроизведения
 * @param {Number} position - новая позиция воспроизведения
 * @returns {Number} -- конечная позиция воспроизведения
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
 * Получение длительности трека
 * @param {Boolean|int} preloader - активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик
 * @returns {Number}
 */
AudioPlayer.prototype.getDuration = function(preloader) {
    return this.implementation.getDuration(preloader ? 1 : 0) || 0;
};

/**
 * Получение длительности загруженной части
 * @param {Boolean|int} preloader - активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик
 * @returns {Number}
 */
AudioPlayer.prototype.getLoaded = function(preloader) {
    return this.implementation.getLoaded(preloader ? 1 : 0) || 0;
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

// =================================================================

//  Громкость

// =================================================================

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
 * @typedef {Object} ya.music.Audio~AudioPreprocessor
 *
 * @property {AudioNode} input - нода, в которую перенаправляется вывод аудио
 * @property {AudioNode} output - нода из которой вывод подаётся на усилитель
 */

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудио-элементу у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость
 * @param {ya.music.Audio~AudioPreprocessor} preprocessor - препроцессор
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

},{"./audio-static":4,"./config":5,"./error/audio-error":6,"./flash/audio-flash":10,"./html5/audio-html5":26,"./lib/async/deferred":28,"./lib/async/events":29,"./lib/async/reject":31,"./lib/browser/detect":32,"./lib/data/merge":37,"./logger/logger":42}],4:[function(require,module,exports){
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
 * @alias ya.music.Audio.config
 * @namespace
 */
var config = {

    // =================================================================

    //  Общие настройки

    // =================================================================

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

    // =================================================================

    //  Flash-плеер

    // =================================================================

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
     * Описание настроек html5 плеера
     * @namespace
     */
    html5: {
        /**
         * Список идентификаторов для которых лучше не использовать html5 плеер. Используется при
         * авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону
         * `@<platform.version> <platform.os>:<browser.name>/<browser.version>`
         * @type {Array.<String>}
         */
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", "msie/9"]
    }
};

module.exports = config;

},{}],6:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @classdesc Класс ошибки аудио-пллеера
 * @name ya.music.Audio.AudioError
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

},{"../lib/class/error-class":35}],7:[function(require,module,exports){
require('../export');

var AudioError = require('./audio-error');
var PlaybackError = require('./playback-error');

ya.music.Audio.AudioError = AudioError;
ya.music.Audio.PlaybackError = PlaybackError;

},{"../export":9,"./audio-error":6,"./playback-error":8}],8:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * Класс ошибки воспроизведения
 * @alias ya.music.Audio.PlaybackError
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

//TODO: сделать классификатор ошибок flash-плеера

module.exports = PlaybackError;

},{"../lib/class/error-class":35}],9:[function(require,module,exports){
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

// =================================================================

//  Создание методов работы с плеером

// =================================================================

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
            main: this.getSrc(0),
            preloader: this.getSrc(1)
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
var logger = new Logger('FlashBridge');

var config = require('../config');

var AudioStatic = require('../audio-static');
var flashLoader = require('./loader');
var FlashInterface = require('./flash-interface');

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

// =================================================================

//  Обработчики событий инициализации flash

// =================================================================

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

// =================================================================

//  Управление плеером

// =================================================================

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

},{"../audio-static":4,"../config":5,"../error/audio-error":6,"../lib/async/deferred":28,"../lib/net/error/loader-error":39,"../logger/logger":42,"./flash-interface":11,"./loader":15}],13:[function(require,module,exports){
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
 * Событие изменения значения усиления ({@link ya.music.Audio.fx.Equalizer.EVENT_CHANGE})
 * @event ya.music.Audio.fx.Equalizer~EqualizerBand#change
 * @param {Number} value - новое значение
 */

/**
 * Полоса пропускания эквалайзера
 * @alias ya.music.Audio.fx.Equalizer~EqualizerBand
 *
 * @extends Events
 *
 * @param {AudioContext} audioContext - контекст Web Audio API
 * @param {String} type - тип фильтра
 * @param {Number} frequency - частота фильтра
 *
 * @fires ya.music.Audio.fx.Equalizer~EqualizerBand#change
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
 * Описание настроек эквалайзера
 * @typedef {Object} ya.music.Audio.fx.Equalizer~EqualizerPreset
 *
 * @property {String} [id] - идентификатор настроек
 * @property {Number} preamp - предусилитель
 * @property {Array.<Number>} bands - значения для полос эквалайзера
 */

/**
 * Событие изменения полосы пропускания ({@link ya.music.Audio.fx.Equalizer.EVENT_CHANGE})
 * @event ya.music.Audio.fx.Equalizer#change
 * @param {Number} freq - частота полосы пропускания
 * @param {Number} value - значение усиления
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * Эквалайзер
 * @alias ya.music.Audio.fx.Equalizer
 * @param {AudioContext} audioContext - контекст Web Audio API
 * @param {Array.<Number>} bands - список частот для полос эквалайзера
 *
 * @extends Events
 * @mixes EqualizerStatic
 *
 * @fires ya.music.Audio.fx.Equalizer#change
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
 * Набор частот эквалайзера применяющийся по-умолчанию
 * @type {Array.<Number>}
 * @const
 */
Equalizer.DEFAULT_BANDS = require('./default.bands.js');

/**
 * Набор распространённых пресетов эквалайзера для набора частот по-умолчанию.
 * @type {Object.<String, ya.music.Audio.fx.Equalizer~EqualizerPreset>}
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
 * Загрузить настройки
 * @param {ya.music.Audio.fx.Equalizer~EqualizerPreset} preset - настройки
 */
Equalizer.prototype.loadPreset = function(preset) {
    preset.bands.forEach(function(value, idx) {
        this.bands[idx].setValue(value);
    }.bind(this));
    this.preamp.setValue(preset.preamp);
};

/**
 * Сохранить текущие настройки
 * @returns {ya.music.Audio.fx.Equalizer~EqualizerPreset}
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
 * Методы конвертации значений громкости
 * @namespace
 * @alias ya.music.Audio.fx.volumeLib
 */
var volumeLib = {};

/**
 * Минимальное значение громкости при котором происходит отключение звука.
 * Ограничение в 0.001 подобрано эмпирически и не годится для шкалы у которой разрешены значения больше 1.
 * @type {number}
 */
volumeLib.EPSILON = 0.001;

/**
 * Коэфициент для преобразований громкости из относительной шкалы в децибелы
 * @type {number}
 * @private
 */
volumeLib._DBFS_COEF = 20 / Math.log(10);

/**
 * Вычисление значение громкости по значению на логарифмической шкале
 * @param {Number} value - значение на шкале
 * @returns {number}
 */
volumeLib.toExponent = function(value) {
    var volume = Math.pow(volumeLib.EPSILON, 1 - value);
    return volume > volumeLib.EPSILON ? volume : 0;
};

/**
 * Вычисление значения положения на логарифмической шкале по значению громкости
 * @param {Number} volume - громкость
 * @returns {number}
 */
volumeLib.fromExponent = function(volume) {
    return 1 - Math.log(Math.max(volume, volumeLib.EPSILON)) / Math.log(volumeLib.EPSILON);
};

/**
 * Получение значения dBFS из относительного значения громкости
 * @param {Number} volume - относительная громкость
 * @returns {number}
 */
volumeLib.toDBFS = function(volume) {
    return Math.log(volume) * volumeLib._DBFS_COEF;
};

/**
 * Получение значения относительной громкости из значения dBFS
 * @param {Number} dbfs - громкость в dBFS
 * @returns {number}
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
 *
 * @fires IAudioImplementation#play
 * @fires IAudioImplementation#ended
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
var AudioHTML5Loader = function() {
    this.name = loaderId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            logger.debug(this, "onEvent", event);
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

    var error = new PlaybackError(this.audio.error
            ? PlaybackError.html5[this.audio.error.code]
            : e instanceof Error ? e.message : e,
        this.src);

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
    logger.debug(this, "_initAudio");

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
    logger.debug(this, "_deinitAudio");

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
    logger.info(this, "_startupAudio");

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

        logger.info(this, "_startupAudio:play", e.type);
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
    logger.debug(this, "load", src);

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
    logger.debug(this, "stop");

    this._abortPromises("stop");
    this._breakStartup("stop");

    this.load("");
};

/**
 * Начать воспроизведение трека
 * @private
 */
AudioHTML5Loader.prototype._startPlay = function() {
    logger.debug(this, "_startPlay");

    this.audio.currentTime = this.position;

    if (!this.playing) {
        return;
    }

    this._breakStartup("startPlay");
    this.audio.play();

    //THINK: нужно ли триггерить событие в случае успеха
    this._promiseStartPlaying().then(noop, this.__restart);
};

/**
 * Перезапустить воспроизведение трека
 * @param {String} [reason] - если причина вызова указана и не равна "timeout" ничего не происходит
 * @private
 */
AudioHTML5Loader.prototype._restart = function(reason) {
    //THINK: нужен ли тут какой-то счётик количества попыток
    logger.info(this, "_restart", reason, this.position, this.playing);

    if (reason && reason !== "timeout") {
        return;
    }

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

/**
 * Воспроизведение трека/отмена паузы
 * @param {Number} [position] - позиция воспроизведения
 */
AudioHTML5Loader.prototype.play = function(position) {
    logger.debug(this, "play", position);

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
    logger.debug(this, "pause");

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
    logger.debug(this, "setPosition", position);

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

    logger.debug(this, "createSource");

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

AudioHTML5Loader.prototype._logger = function() {
    return {
        init: !!this.__initListener && this.__initListener.step,
        src: this.src,
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
    this.volume = 1;
    this.loaders = [];

    this._addLoader();
    this._addLoader();

    this._setActive(0);
};
Events.mixin(AudioHTML5);
AudioHTML5.type = AudioHTML5.prototype.type = "html5";

// =================================================================

//  Работа с загрузчиками

// =================================================================

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
    logger.info(this, "play", src);

    var loader = this._getLoader();

    loader.load(src);
    loader.play(0);
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
            main: this.getSrc(0),
            preloader: this.getSrc(1)
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

// =================================================================

//  Всяческий сахар

// =================================================================

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

// =================================================================

//  Подписка и отписка от событий

// =================================================================

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

// =================================================================

//  Триггер событий

// =================================================================

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
 * Делегировать все события другому диспетчеру событий
 * @param {Events} acceptor - получатель событий
 * @returns {Events} -- цепочный метод, возвращает ссылку на контекст
 */
Events.prototype.pipeEvents = function(acceptor) {
    this.on("*", Events.prototype.trigger.bind(acceptor));
    return this;
};

// =================================================================

//  Включение/выключение триггера событий

// =================================================================

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

},{"../data/merge":37}],30:[function(require,module,exports){
var vow = require('vow');
var detect = require('../browser/detect');

// =================================================================

// Promise

// =================================================================

/**
 * {@link https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise|ES 2015 Promise}
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

// =================================================================

// AbortablePromise

// =================================================================

/**
 * Обещание с возможностью отмены связанного с ним действия.
 * @classdesc AbortablePromise
 * @extends Promise
 */

/**
 * Отмена действия связанного с обещанием
 * @abstract
 * @method AbortablePromise#abort
 * @param {String|Error} reason - причина отмены действия
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
var rwebkit = /(webkit)[ \/]([\w.]+)/;
var ryabro = /(yabrowser)[ \/]([\w.]+)/;
var ropera = /(opr|opera)(?:.*version)?[ \/]([\w.]+)/;
var rmsie = /(msie) ([\w.]+)/;
var redge = /(edge)\/([\w.]+)/;
var rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
var rsafari = /^((?!chrome).)*version\/([\d\w\.]+).*(safari)/;

var match = rsafari.exec(ua)
    || ryabro.exec(ua)
    || redge.exec(ua)
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
    var ClearClass = function(){};
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

},{"../async/events":29}],37:[function(require,module,exports){
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

},{}],38:[function(require,module,exports){
require('../../../export');

var LoaderError = require('./loader-error');

ya.music.Audio.LoaderError = LoaderError;

},{"../../../export":9,"./loader-error":39}],39:[function(require,module,exports){
var ErrorClass = require('../../class/error-class');

/**
 * Класс ошибок загрузчика
 * @alias ya.music.Audio.LoaderError
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
 * Настраиваемые логгер для аудио-плеера
 * @alias ya.music.Audio.Logger
 * @param {String} channel - имя канала, за который будет отвечать экземляр логгера
 * @constructor
 */
var Logger = function(channel) {
    this.channel = channel;
};

// =================================================================

//  Настройки

// =================================================================

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

// =================================================================

//  Синтаксический сахар

// =================================================================

/**
 * Запись в лог с уровнем **debug**
 * @method ya.music.Audio.Logger#debug
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.debug = noop;

/**
 * Запись в лог с уровнем **log**
 * @method ya.music.Audio.Logger#log
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.log = noop;

/**
 * Запись в лог с уровнем **info**
 * @method ya.music.Audio.Logger#info
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.info = noop;

/**
 * Запись в лог с уровнем **warn**
 * @method ya.music.Audio.Logger#warn
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.warn = noop;

/**
 * Запись в лог с уровнем **error**
 * @method ya.music.Audio.Logger#error
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.error = noop;

/**
 * Запись в лог с уровнем **trace**
 * @method ya.music.Audio.Logger#trace
 * @param {Object} context - контекст вызова
 * @param {...*} [args] - дополнительные аргументы
 */
Logger.prototype.trace = noop;

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
 * @typedef {Object} ya.music.Audio.Logger~LogEntry
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LmJhbmRzLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci1iYW5kLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXItc3RhdGljLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2V4cG9ydC5qcyIsInNyYy9meC9leHBvcnQuanMiLCJzcmMvZngvdm9sdW1lL2V4cG9ydC5qcyIsInNyYy9meC92b2x1bWUvdm9sdW1lLWxpYi5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9jbGVhci1pbnN0YW5jZS5qcyIsInNyYy9saWIvY2xhc3MvZXJyb3ItY2xhc3MuanMiLCJzcmMvbGliL2NsYXNzL3Byb3h5LmpzIiwic3JjL2xpYi9kYXRhL21lcmdlLmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yLmpzIiwic3JjL2xpYi9ub29wLmpzIiwic3JjL2xvZ2dlci9leHBvcnQuanMiLCJzcmMvbG9nZ2VyL2xvZ2dlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0K0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JLQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNodUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQG1vZHVsZSB2b3dcbiAqIEBhdXRob3IgRmlsYXRvdiBEbWl0cnkgPGRmaWxhdG92QHlhbmRleC10ZWFtLnJ1PlxuICogQHZlcnNpb24gMC40LjEwXG4gKiBAbGljZW5zZVxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwgbGljZW5zZXM6XG4gKiAgICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqICAgKiBodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWxcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG5cbnZhciB1bmRlZixcbiAgICBuZXh0VGljayA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZucyA9IFtdLFxuICAgICAgICAgICAgZW5xdWV1ZUZuID0gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm5zLnB1c2goZm4pID09PSAxO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhbGxGbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm5zVG9DYWxsID0gZm5zLCBpID0gMCwgbGVuID0gZm5zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuc1RvQ2FsbFtpKytdKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICBpZih0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7IC8vIGllMTAsIG5vZGVqcyA+PSAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldEltbWVkaWF0ZShjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5uZXh0VGljaykgeyAvLyBub2RlanMgPCAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHByb2Nlc3MubmV4dFRpY2soY2FsbEZucyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIE11dGF0aW9uT2JzZXJ2ZXIgPSBnbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBnbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjsgLy8gbW9kZXJuIGJyb3dzZXJzXG4gICAgICAgIGlmKE11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIHZhciBudW0gPSAxLFxuICAgICAgICAgICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cbiAgICAgICAgICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKGNhbGxGbnMpLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhIDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiAobm9kZS5kYXRhID0gKG51bSAqPSAtMSkpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGdsb2JhbC5wb3N0TWVzc2FnZSkge1xuICAgICAgICAgICAgdmFyIGlzUG9zdE1lc3NhZ2VBc3luYyA9IHRydWU7XG4gICAgICAgICAgICBpZihnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hlY2tBc3luYyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNQb3N0TWVzc2FnZUFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwucG9zdE1lc3NhZ2UoJ19fY2hlY2tBc3luYycsICcqJyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmRldGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNQb3N0TWVzc2FnZUFzeW5jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1zZyA9ICdfX3Byb21pc2UnICsgK25ldyBEYXRlLFxuICAgICAgICAgICAgICAgICAgICBvbk1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlLmRhdGEgPT09IG1zZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uICYmIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXI/XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlLCB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgb25NZXNzYWdlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGdsb2JhbC5wb3N0TWVzc2FnZShtc2csICcqJyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG4gICAgICAgIGlmKCdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKSkgeyAvLyBpZTYtaWU4XG4gICAgICAgICAgICB2YXIgY3JlYXRlU2NyaXB0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQgPSBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIChkb2MuZG9jdW1lbnRFbGVtZW50IHx8IGRvYy5ib2R5KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBjcmVhdGVTY3JpcHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHsgLy8gb2xkIGJyb3dzZXJzXG4gICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldFRpbWVvdXQoY2FsbEZucywgMCk7XG4gICAgICAgIH07XG4gICAgfSkoKSxcbiAgICB0aHJvd0V4Y2VwdGlvbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfSxcbiAgICBpc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICE9PSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnO1xuICAgIH0sXG4gICAgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdG9TdHIuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH0sXG4gICAgZ2V0QXJyYXlLZXlzID0gZnVuY3Rpb24oYXJyKSB7XG4gICAgICAgIHZhciByZXMgPSBbXSxcbiAgICAgICAgICAgIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoO1xuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICByZXMucHVzaChpKyspO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBnZXRPYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpIGluIG9iaikge1xuICAgICAgICAgICAgb2JqLmhhc093blByb3BlcnR5KGkpICYmIHJlcy5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBkZWZpbmVDdXN0b21FcnJvclR5cGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHZhciByZXMgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXMucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIHdyYXBPbkZ1bGZpbGxlZCA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBpZHgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgb25GdWxmaWxsZWQuY2FsbCh0aGlzLCB2YWwsIGlkeCk7XG4gICAgICAgIH07XG4gICAgfTtcblxuLyoqXG4gKiBAY2xhc3MgRGVmZXJyZWRcbiAqIEBleHBvcnRzIHZvdzpEZWZlcnJlZFxuICogQGRlc2NyaXB0aW9uXG4gKiBUaGUgYERlZmVycmVkYCBjbGFzcyBpcyB1c2VkIHRvIGVuY2Fwc3VsYXRlIG5ld2x5LWNyZWF0ZWQgcHJvbWlzZSBvYmplY3QgYWxvbmcgd2l0aCBmdW5jdGlvbnMgdGhhdCByZXNvbHZlLCByZWplY3Qgb3Igbm90aWZ5IGl0LlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZGVzY3JpcHRpb25cbiAqIFlvdSBjYW4gdXNlIGB2b3cuZGVmZXIoKWAgaW5zdGVhZCBvZiB1c2luZyB0aGlzIGNvbnN0cnVjdG9yLlxuICpcbiAqIGBuZXcgdm93LkRlZmVycmVkKClgIGdpdmVzIHRoZSBzYW1lIHJlc3VsdCBhcyBgdm93LmRlZmVyKClgLlxuICovXG52YXIgRGVmZXJyZWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoKTtcbn07XG5cbkRlZmVycmVkLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgRGVmZXJyZWQucHJvdG90eXBlICove1xuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9taXNlIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInc3VjY2VzcydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5yZXNvbHZlKCdzdWNjZXNzJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX3Jlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWplY3RzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyByZWFzb24gaXMgXCInc29tZXRoaW5nIGlzIHdyb25nJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlamVjdCgnc29tZXRoaW5nIGlzIHdyb25nJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGlmKHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih2b3cuaXNQcm9taXNlKHJlYXNvbikpIHtcbiAgICAgICAgICAgIHJlYXNvbiA9IHJlYXNvbi50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdCh2YWwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3Jlc29sdmUocmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3JlamVjdChyZWFzb24pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vdGlmaWVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UucHJvZ3Jlc3MoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInMjAlJ1wiLCBcIic0MCUnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIubm90aWZ5KCcyMCUnKTtcbiAgICAgKiBkZWZlci5ub3RpZnkoJzQwJScpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIG5vdGlmeSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX25vdGlmeSh2YWx1ZSk7XG4gICAgfVxufTtcblxudmFyIFBST01JU0VfU1RBVFVTID0ge1xuICAgIFBFTkRJTkcgICA6IDAsXG4gICAgUkVTT0xWRUQgIDogMSxcbiAgICBGVUxGSUxMRUQgOiAyLFxuICAgIFJFSkVDVEVEICA6IDNcbn07XG5cbi8qKlxuICogQGNsYXNzIFByb21pc2VcbiAqIEBleHBvcnRzIHZvdzpQcm9taXNlXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgUHJvbWlzZWAgY2xhc3MgaXMgdXNlZCB3aGVuIHlvdSB3YW50IHRvIGdpdmUgdG8gdGhlIGNhbGxlciBzb21ldGhpbmcgdG8gc3Vic2NyaWJlIHRvLFxuICogYnV0IG5vdCB0aGUgYWJpbGl0eSB0byByZXNvbHZlIG9yIHJlamVjdCB0aGUgZGVmZXJyZWQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmVyIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZCN0aGUtcHJvbWlzZS1jb25zdHJ1Y3RvciBmb3IgZGV0YWlscy5cbiAqIEBkZXNjcmlwdGlvblxuICogWW91IHNob3VsZCB1c2UgdGhpcyBjb25zdHJ1Y3RvciBkaXJlY3RseSBvbmx5IGlmIHlvdSBhcmUgZ29pbmcgdG8gdXNlIGB2b3dgIGFzIERPTSBQcm9taXNlcyBpbXBsZW1lbnRhdGlvbi5cbiAqIEluIG90aGVyIGNhc2UgeW91IHNob3VsZCB1c2UgYHZvdy5kZWZlcigpYCBhbmQgYGRlZmVyLnByb21pc2UoKWAgbWV0aG9kcy5cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogZnVuY3Rpb24gZmV0Y2hKU09OKHVybCkge1xuICogICAgIHJldHVybiBuZXcgdm93LlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0LCBub3RpZnkpIHtcbiAqICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICogICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAqICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAqICAgICAgICAgeGhyLnNlbmQoKTtcbiAqICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICAgaWYoeGhyLnJlc3BvbnNlKSB7XG4gKiAgICAgICAgICAgICAgICAgcmVzb2x2ZSh4aHIucmVzcG9uc2UpO1xuICogICAgICAgICAgICAgfVxuICogICAgICAgICAgICAgZWxzZSB7XG4gKiAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoKSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgIH07XG4gKiAgICAgfSk7XG4gKiB9XG4gKiBgYGBcbiAqL1xudmFyIFByb21pc2UgPSBmdW5jdGlvbihyZXNvbHZlcikge1xuICAgIHRoaXMuX3ZhbHVlID0gdW5kZWY7XG4gICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcblxuICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSBbXTtcblxuICAgIGlmKHJlc29sdmVyKSB7IC8vIE5PVEU6IHNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZFxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA9IHJlc29sdmVyLmxlbmd0aDtcblxuICAgICAgICByZXNvbHZlcihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPiAxP1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX3JlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgICAgIH0gOlxuICAgICAgICAgICAgICAgIHVuZGVmLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDI/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlID0gLyoqIEBsZW5kcyBQcm9taXNlLnByb3RvdHlwZSAqLyB7XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIGZ1bGZpbGxlZCBwcm9taXNlIG9yIHRoZSByZWFzb24gaW4gY2FzZSBvZiByZWplY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICB2YWx1ZU9mIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1Jlc29sdmVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgIT09IFBST01JU0VfU1RBVFVTLlBFTkRJTkc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzRnVsZmlsbGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHJlYWN0aW9ucyB0byB0aGUgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfSBBIG5ldyBwcm9taXNlLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3Byb21pc2VzLWFwbHVzL3Byb21pc2VzLXNwZWMgZm9yIGRldGFpbHNcbiAgICAgKi9cbiAgICB0aGVuIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5fYWRkQ2FsbGJhY2tzKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbih1bmRlZmluZWQsIG9uUmVqZWN0ZWQpYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGEgcHJvdmlkZWQgJ3JlYXNvbicgYXMgYXJndW1lbnQgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgICdjYXRjaCcgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbihudWxsLCBvblJlamVjdGVkKWAuIEl0J3MgYWxzbyBhbiBhbGlhcyBmb3IgYGNhdGNoYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdpdGggdGhlIHZhbHVlIGFmdGVyIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlc29sdmluZyByZWFjdGlvbiAoZm9yIGJvdGggZnVsZmlsbG1lbnQgYW5kIHJlamVjdGlvbikuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24ob25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICBjYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvblJlc29sdmVkLmNhbGwodGhpcywgX3RoaXMpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcy50aGVuKGNiLCBjYiwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHByb2dyZXNzIHJlYWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSB3aGVuIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCB1bmRlZiwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgcHJvbWlzZS50aGVuYCwgYnV0IFwic3ByZWFkc1wiIHRoZSBhcnJheSBpbnRvIGEgdmFyaWFkaWMgdmFsdWUgaGFuZGxlci5cbiAgICAgKiBJdCBpcyB1c2VmdWwgd2l0aCB0aGUgYHZvdy5hbGxgIGFuZCB0aGUgYHZvdy5hbGxSZXNvbHZlZGAgbWV0aG9kcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24oYXJnMSwgYXJnMikge1xuICAgICAqICAgICAvLyBhcmcxIGlzIFwiMVwiLCBhcmcyIGlzIFwiJ3R3bydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgndHdvJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uRnVsZmlsbGVkLmFwcGx5KHRoaXMsIHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25SZWplY3RlZCxcbiAgICAgICAgICAgIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExpa2UgYHRoZW5gLCBidXQgdGVybWluYXRlcyBhIGNoYWluIG9mIHByb21pc2VzLlxuICAgICAqIElmIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkLCB0aGlzIG1ldGhvZCB0aHJvd3MgaXQncyBcInJlYXNvblwiIGFzIGFuIGV4Y2VwdGlvbiBpbiBhIGZ1dHVyZSB0dXJuIG9mIHRoZSBldmVudCBsb29wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKiBkZWZlci5yZWplY3QoRXJyb3IoJ0ludGVybmFsIGVycm9yJykpO1xuICAgICAqIGRlZmVyLnByb21pc2UoKS5kb25lKCk7IC8vIGV4Y2VwdGlvbiB0byBiZSB0aHJvd25cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB0aGlzXG4gICAgICAgICAgICAudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KVxuICAgICAgICAgICAgLmZhaWwodGhyb3dFeGNlcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpbiBgZGVsYXlgIG1pbGxpc2Vjb25kcyBpZiB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQsXG4gICAgICogb3IgaW1tZWRpYXRlbHkgcmVqZWN0ZWQgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB2YXIgdGltZXIsXG4gICAgICAgICAgICBwcm9taXNlID0gdGhpcy50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlbGF5KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIHJlamVjdGVkIGluIGB0aW1lb3V0YCBtaWxsaXNlY29uZHNcbiAgICAgKiBpZiB0aGUgcHJvbWlzZSBpcyBub3QgcmVzb2x2ZWQgYmVmb3JlaGFuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQxID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoNTApLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQyID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoMjAwKTtcbiAgICAgKlxuICAgICAqIHNldFRpbWVvdXQoXG4gICAgICogICAgIGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgZGVmZXIucmVzb2x2ZSgnb2snKTtcbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgMTAwKTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDEuZmFpbChmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgKiAgICAgLy8gcHJvbWlzZVdpdGhUaW1lb3V0IHRvIGJlIHJlamVjdGVkIGluIDUwbXNcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDIudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgZnVsZmlsbGVkIHdpdGggXCInb2snXCIgdmFsdWVcbiAgICAgKiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odGltZW91dCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KG5ldyB2b3cuVGltZWRPdXRFcnJvcigndGltZWQgb3V0JykpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGltZW91dCk7XG5cbiAgICAgICAgdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmZXIucHJvbWlzZSgpLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIF92b3cgOiB0cnVlLFxuXG4gICAgX3Jlc29sdmUgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZhbCA9PT0gdGhpcykge1xuICAgICAgICAgICAgdGhpcy5fcmVqZWN0KFR5cGVFcnJvcignQ2FuXFwndCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRDtcblxuICAgICAgICBpZih2YWwgJiYgISF2YWwuX3ZvdykgeyAvLyBzaG9ydHBhdGggZm9yIHZvdy5Qcm9taXNlXG4gICAgICAgICAgICB2YWwuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbC52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICB2YWwuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICB2YWwudGhlbihcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzT2JqZWN0KHZhbCkgfHwgaXNGdW5jdGlvbih2YWwpKSB7XG4gICAgICAgICAgICB2YXIgdGhlbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGhlbiA9IHZhbC50aGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGVuLmNhbGwoXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Jlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkIHx8IHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbCk7XG4gICAgfSxcblxuICAgIF9mdWxmaWxsIDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5GVUxGSUxMRUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gdmFsO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzLCB2YWwpO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9yZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHJlYXNvbjtcblxuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLCByZWFzb24pO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9ub3RpZnkgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcywgdmFsKTtcbiAgICB9LFxuXG4gICAgX2FkZENhbGxiYWNrcyA6IGZ1bmN0aW9uKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIGlmKG9uUmVqZWN0ZWQgJiYgIWlzRnVuY3Rpb24ob25SZWplY3RlZCkpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUmVqZWN0ZWQ7XG4gICAgICAgICAgICBvblJlamVjdGVkID0gdW5kZWY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvblByb2dyZXNzICYmICFpc0Z1bmN0aW9uKG9uUHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICBjdHggPSBvblByb2dyZXNzO1xuICAgICAgICAgICAgb25Qcm9ncmVzcyA9IHVuZGVmO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNiO1xuXG4gICAgICAgIGlmKCF0aGlzLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgY2IgPSB7IGRlZmVyIDogZGVmZXIsIGZuIDogaXNGdW5jdGlvbihvbkZ1bGZpbGxlZCk/IG9uRnVsZmlsbGVkIDogdW5kZWYsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdGhpcy5pc0Z1bGZpbGxlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblJlamVjdGVkLCBjdHggOiBjdHggfTtcbiAgICAgICAgICAgIHRoaXMuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3RlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA8PSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MucHVzaCh7IGRlZmVyIDogZGVmZXIsIGZuIDogb25Qcm9ncmVzcywgY3R4IDogY3R4IH0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9jYWxsQ2FsbGJhY2tzIDogZnVuY3Rpb24oY2FsbGJhY2tzLCBhcmcpIHtcbiAgICAgICAgdmFyIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc1Jlc29sdmVkID0gdGhpcy5pc1Jlc29sdmVkKCksXG4gICAgICAgICAgICBpc0Z1bGZpbGxlZCA9IHRoaXMuaXNGdWxmaWxsZWQoKTtcblxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpID0gMCwgY2IsIGRlZmVyLCBmbjtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYiA9IGNhbGxiYWNrc1tpKytdO1xuICAgICAgICAgICAgICAgIGRlZmVyID0gY2IuZGVmZXI7XG4gICAgICAgICAgICAgICAgZm4gPSBjYi5mbjtcblxuICAgICAgICAgICAgICAgIGlmKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjdHggPSBjYi5jdHgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXM7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgPSBjdHg/IGZuLmNhbGwoY3R4LCBhcmcpIDogZm4oYXJnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIubm90aWZ5KHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNGdWxmaWxsZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoYXJnKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkoYXJnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8qKiBAbGVuZHMgUHJvbWlzZSAqL1xudmFyIHN0YXRpY01ldGhvZHMgPSB7XG4gICAgLyoqXG4gICAgICogQ29lcmNlcyB0aGUgZ2l2ZW4gYHZhbHVlYCB0byBhIHByb21pc2UsIG9yIHJldHVybnMgdGhlIGB2YWx1ZWAgaWYgaXQncyBhbHJlYWR5IGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgY2FzdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cuY2FzdCh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZW4gdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmFjZSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYW55UmVzb2x2ZWQoaXRlcmFibGUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gdm93LnJlamVjdChyZWFzb24pO1xuICAgIH1cbn07XG5cbmZvcih2YXIgcHJvcCBpbiBzdGF0aWNNZXRob2RzKSB7XG4gICAgc3RhdGljTWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSAmJlxuICAgICAgICAoUHJvbWlzZVtwcm9wXSA9IHN0YXRpY01ldGhvZHNbcHJvcF0pO1xufVxuXG52YXIgdm93ID0gLyoqIEBleHBvcnRzIHZvdyAqLyB7XG4gICAgRGVmZXJyZWQgOiBEZWZlcnJlZCxcblxuICAgIFByb21pc2UgOiBQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBkZWZlcnJlZC4gVGhpcyBtZXRob2QgaXMgYSBmYWN0b3J5IG1ldGhvZCBmb3IgYHZvdzpEZWZlcnJlZGAgY2xhc3MuXG4gICAgICogSXQncyBlcXVpdmFsZW50IHRvIGBuZXcgdm93LkRlZmVycmVkKClgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpEZWZlcnJlZH1cbiAgICAgKi9cbiAgICBkZWZlciA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IERlZmVycmVkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRoZW5gLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB3aGVuIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5mYWlsYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmYWlsIDogZnVuY3Rpb24odmFsdWUsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUsIHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5hbHdheXNgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24odmFsdWUsIG9uUmVzb2x2ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLmFsd2F5cyhvblJlc29sdmVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5wcm9ncmVzc2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUHJvZ3Jlc3MgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKHZhbHVlLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5wcm9ncmVzcyhvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5zcHJlYWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHNwcmVhZCA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuc3ByZWFkKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5kb25lYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdm93LndoZW4odmFsdWUpLmRvbmUob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBgdmFsdWVgIGlzIGEgcHJvbWlzZS1saWtlIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZvdy5pc1Byb21pc2UoJ3NvbWV0aGluZycpOyAvLyByZXR1cm5zIGZhbHNlXG4gICAgICogdm93LmlzUHJvbWlzZSh2b3cuZGVmZXIoKS5wcm9taXNlKCkpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiB2b3cuaXNQcm9taXNlKHsgdGhlbiA6IGZ1bmN0aW9uKCkgeyB9KTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaXNQcm9taXNlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnRoZW4pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmICEhdmFsdWUuX3Zvdz9cbiAgICAgICAgICAgIHZhbHVlIDpcbiAgICAgICAgICAgIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudmFsdWVPZmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS52YWx1ZU9mKT8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzRnVsZmlsbGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc0Z1bGZpbGxlZCk/IHZhbHVlLmlzRnVsZmlsbGVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1JlamVjdGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZWplY3RlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVqZWN0ZWQpPyB2YWx1ZS5pc1JlamVjdGVkKCkgOiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNSZXNvbHZlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc1Jlc29sdmVkKT8gdmFsdWUuaXNSZXNvbHZlZCgpIDogdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgaGF2ZSBgdmFsdWVgJ3Mgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgcmVzID0gdm93LmRlZmVyKCk7XG4gICAgICAgIHJlcy5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHJlcy5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSBmdWxmaWxsZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZnVsZmlsbCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAgICAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcblxuICAgICAgICBkZWZlci5yZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZS5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgcHJvbWlzZSA6XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4obnVsbCwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYXNvbjtcbiAgICAgICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICogSWYgYHJlYXNvbmAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGggdGhlIGZ1bGZpbGwvcmVqZWN0aW9uIHZhbHVlIG9mIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyB0aGUgZ2l2ZW4gZnVuY3Rpb24gYGZuYCB3aXRoIGFyZ3VtZW50cyBgYXJnc2BcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnc11cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIHByb21pc2UxID0gdm93Lmludm9rZShmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAqICAgICB9LCAnb2snKSxcbiAgICAgKiAgICAgcHJvbWlzZTIgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgdGhyb3cgRXJyb3IoKTtcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlMS5pc0Z1bGZpbGxlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTEudmFsdWVPZigpOyAvLyAnb2snXG4gICAgICogcHJvbWlzZTIuaXNSZWplY3RlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTIudmFsdWVPZigpOyAvLyBpbnN0YW5jZSBvZiBFcnJvclxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGludm9rZSA6IGZ1bmN0aW9uKGZuLCBhcmdzKSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1heChhcmd1bWVudHMubGVuZ3RoIC0gMSwgMCksXG4gICAgICAgICAgICBjYWxsQXJncztcbiAgICAgICAgaWYobGVuKSB7IC8vIG9wdGltaXphdGlvbiBmb3IgVjhcbiAgICAgICAgICAgIGNhbGxBcmdzID0gQXJyYXkobGVuKTtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYWxsQXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVzb2x2ZShjYWxsQXJncz9cbiAgICAgICAgICAgICAgICBmbi5hcHBseShnbG9iYWwsIGNhbGxBcmdzKSA6XG4gICAgICAgICAgICAgICAgZm4uY2FsbChnbG9iYWwpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICByZXR1cm4gdm93LnJlamVjdChlKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIGFycmF5OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCksIDNdKVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwiWzEsIDIsIDNdXCIgaGVyZVxuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKDIpO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIG9iamVjdDpcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKHsgcDEgOiBkZWZlcjEucHJvbWlzZSgpLCBwMiA6IGRlZmVyMi5wcm9taXNlKCksIHAzIDogMyB9KVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwieyBwMSA6IDEsIHAyIDogMiwgcDMgOiAzIH1cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSBsZW47XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsdWUsIGlkeCkge1xuICAgICAgICAgICAgICAgIHJlc1trZXlzW2lkeF1dID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgaWYoIS0taSkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsUmVzb2x2ZWQoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24ocHJvbWlzZTEsIHByb21pc2UyKSB7XG4gICAgICogICAgIHByb21pc2UxLmlzUmVqZWN0ZWQoKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogICAgIHByb21pc2UxLnZhbHVlT2YoKTsgLy8gcmV0dXJucyBcIidlcnJvcidcIlxuICAgICAqICAgICBwcm9taXNlMi5pc0Z1bGZpbGxlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTIudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ29rJ1wiXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVqZWN0KCdlcnJvcicpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCdvaycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbFJlc29sdmVkIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBpID0ga2V5cy5sZW5ndGgsXG4gICAgICAgICAgICByZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG5cbiAgICAgICAgaWYoIWkpIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb25SZXNvbHZlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC0taSB8fCBkZWZlci5yZXNvbHZlKGl0ZXJhYmxlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgb25SZXNvbHZlZCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgYWxsUGF0aWVudGx5IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbGxSZXNvbHZlZChpdGVyYWJsZSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcywgZnVsZmlsbGVkUHJvbWlzZXMsXG4gICAgICAgICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGgsIGkgPSAwLCBrZXksIHByb21pc2U7XG5cbiAgICAgICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xuICAgICAgICAgICAgICAgIHByb21pc2UgPSBpdGVyYWJsZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmKHZvdy5pc1JlamVjdGVkKHByb21pc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMgfHwgKHJlamVjdGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pO1xuICAgICAgICAgICAgICAgICAgICBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLnB1c2gocHJvbWlzZS52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXNba2V5XSA9IHByb21pc2UudmFsdWVPZigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKCFyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIChmdWxmaWxsZWRQcm9taXNlcyB8fCAoZnVsZmlsbGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pKVtrZXldID0gdm93LnZhbHVlT2YocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgcmVqZWN0ZWRQcm9taXNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZ1bGZpbGxlZFByb21pc2VzO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgaWYgYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGlzIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbGwgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0IHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkICh3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHJlamVjdGVkIGl0ZW0pLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KEVycm9yKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gMCwgcmVhc29uO1xuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaSB8fCAocmVhc29uID0gZSk7XG4gICAgICAgICAgICAgICAgKytpID09PSBsZW4gJiYgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55UmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlLFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRlbGF5YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGRlbGF5IDogZnVuY3Rpb24odmFsdWUsIGRlbGF5KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkuZGVsYXkoZGVsYXkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS50aW1lb3V0YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgdGltZW91dCA6IGZ1bmN0aW9uKHZhbHVlLCB0aW1lb3V0KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkudGltZW91dCh0aW1lb3V0KTtcbiAgICB9LFxuXG4gICAgX2ZvckVhY2ggOiBmdW5jdGlvbihwcm9taXNlcywgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCwga2V5cykge1xuICAgICAgICB2YXIgbGVuID0ga2V5cz8ga2V5cy5sZW5ndGggOiBwcm9taXNlcy5sZW5ndGgsXG4gICAgICAgICAgICBpID0gMDtcblxuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICB2b3cud2hlbihcbiAgICAgICAgICAgICAgICBwcm9taXNlc1trZXlzPyBrZXlzW2ldIDogaV0sXG4gICAgICAgICAgICAgICAgd3JhcE9uRnVsZmlsbGVkKG9uRnVsZmlsbGVkLCBpKSxcbiAgICAgICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgICAgIG9uUHJvZ3Jlc3MsXG4gICAgICAgICAgICAgICAgY3R4KTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBUaW1lZE91dEVycm9yIDogZGVmaW5lQ3VzdG9tRXJyb3JUeXBlKCdUaW1lZE91dCcpXG59O1xuXG52YXIgZGVmaW5lQXNHbG9iYWwgPSB0cnVlO1xuaWYodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBtb2R1bGVzID09PSAnb2JqZWN0JyAmJiBpc0Z1bmN0aW9uKG1vZHVsZXMuZGVmaW5lKSkge1xuICAgIG1vZHVsZXMuZGVmaW5lKCd2b3cnLCBmdW5jdGlvbihwcm92aWRlKSB7XG4gICAgICAgIHByb3ZpZGUodm93KTtcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5pZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHZvdztcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5kZWZpbmVBc0dsb2JhbCAmJiAoZ2xvYmFsLnZvdyA9IHZvdyk7XG5cbn0pKHRoaXMpO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvUGxheWVyJyk7XG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBEZWZlcnJlZCA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi9saWIvZGF0YS9tZXJnZScpO1xudmFyIHJlamVjdCA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL3JlamVjdCcpO1xuXG52YXIgQXVkaW9FcnJvciA9IHJlcXVpcmUoJy4vZXJyb3IvYXVkaW8tZXJyb3InKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4vYXVkaW8tc3RhdGljJyk7XG5cbnZhciBwbGF5ZXJJZCA9IDE7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQndCw0YHRgtGA0L7QudC60LAg0LTQvtGB0YLRg9C/0L3Ri9GFINGC0LjQv9C+0LIg0YDQtdCw0LvQuNC30LDRhtC40Lkg0Lgg0LjRhSDQv9GA0LjQvtGA0LjRgtC10YLQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC40L3RgtC10YDRhNC10LnRgSDQtNC70Y8g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPINC90L7QstGL0YUg0YLQuNC/0L7QslxudmFyIGF1ZGlvVHlwZXMgPSB7XG4gICAgaHRtbDU6IHJlcXVpcmUoJy4vaHRtbDUvYXVkaW8taHRtbDUnKSxcbiAgICBmbGFzaDogcmVxdWlyZSgnLi9mbGFzaC9hdWRpby1mbGFzaCcpXG59O1xuXG52YXIgZGV0ZWN0U3RyaW5nID0gXCJAXCIgKyBkZXRlY3QucGxhdGZvcm0udmVyc2lvbiArXG4gICAgXCIgXCIgKyBkZXRlY3QucGxhdGZvcm0ub3MgK1xuICAgIFwiOlwiICsgZGV0ZWN0LmJyb3dzZXIubmFtZSArXG4gICAgXCIvXCIgKyBkZXRlY3QuYnJvd3Nlci52ZXJzaW9uO1xuXG5hdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5ID0gMDtcbmF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHkgPSBjb25maWcuaHRtbDUuYmxhY2tsaXN0LnNvbWUoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gZGV0ZWN0U3RyaW5nLm1hdGNoKGl0ZW0pOyB9KSA/IC0xIDogMTtcblxuLy9JTkZPOiDQv9GA0Y/QvCDQsiDQvNC+0LzQtdC90YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0LLRgdC10LPQviDQvNC+0LTRg9C70Y8g0L3QtdC70YzQt9GPINC/0LjRgdCw0YLRjCDQsiDQu9C+0LMgLSDQvtC9INC/0YDQvtCz0LvQsNGC0YvQstCw0LXRgiDRgdC+0L7QsdGJ0LXQvdC40Y8sINGCLtC6LiDQtdGJ0ZEg0L3QtdGCINCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L3QsNGB0YLRgNC+0LjRgtGMINC70L7Qs9Cz0LXRgC5cbnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8oe1xuICAgICAgICBmbGFzaDoge1xuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdWRpb1R5cGVzLmZsYXNoLmF2YWlsYWJsZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiBhdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5XG4gICAgICAgIH0sXG4gICAgICAgIGh0bWw1OiB7XG4gICAgICAgICAgICBhdmFpbGFibGU6IGF1ZGlvVHlwZXMuaHRtbDUuYXZhaWxhYmxlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IGF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHksXG4gICAgICAgICAgICBhdWRpb0NvbnRleHQ6ICEhYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHRcbiAgICAgICAgfVxuICAgIH0sIFwiYXVkaW9UeXBlc1wiKTtcbn0sIDApO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgSlNET0M6INCy0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90YvQtSDQutC70LDRgdGB0YtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqINCe0L/QuNGB0LDQvdC40LUg0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQv9C70LXQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLm11c2ljLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXNcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHByb3BlcnR5IHtOdW1iZXJ9IGxvYWRlZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwb3NpdGlvbiAtINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHByb3BlcnR5IHtOdW1iZXJ9IHBsYXllZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgSlNET0M6INCe0LHRidC40LUg0YHQvtCx0YvRgtC40Y8g0L/Qu9C10LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfUExBWX0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jcGxheVxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfRU5ERUR9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI2VuZGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LPRgNC+0LzQutC+0YHRgtC4ICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfVk9MVU1FfSlcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyN2b2x1bWVjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC60YDQsNGF0LAg0L/Qu9C10LXRgNCwICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfQ1JBU0hFRH0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jY3Jhc2hlZFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0YHQvNC10L3RiyDRgdGC0LDRgtGD0YHQsCDQv9C70LXQtdGA0LAgKHtAbGluayB5YS5tdXNpYy5BdWRpby5FVkVOVF9TVEFURX0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jc3RhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtINC90L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L/QtdGA0LXQutC70Y7Rh9C10L3QuNGPINCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0Lgg0L/RgNC10LvQvtCw0LTQtdGA0LAgKHtAbGluayB5YS5tdXNpYy5BdWRpby5FVkVOVF9TV0FQfSlcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNzd2FwXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfU1RPUH0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jc3RvcFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLkVWRU5UX1BBVVNFfSlcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNwYXVzZVxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPL9C30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLkVWRU5UX1BST0dSRVNTfSlcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNwcm9ncmVzc1xuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLkVWRU5UX0xPQURJTkd9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI2xvYWRpbmdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLkVWRU5UX0xPQURFRH0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jbG9hZGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfRVJST1J9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI2Vycm9yXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfU1RPUH0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jcHJlbG9hZGVyOnN0b3BcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5tdXNpYy5BdWRpby5FVkVOVF9QQVVTRX0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jcHJlbG9hZGVyOnBhdXNlXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjRjyDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8v0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4ICh7QGxpbmsgeWEubXVzaWMuQXVkaW8uRVZFTlRfUFJPR1JFU1N9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpwcm9ncmVzc1xuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLkVWRU5UX0xPQURJTkd9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpsb2FkaW5nXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LAgKHtAbGluayB5YS5tdXNpYy5BdWRpby5FVkVOVF9MT0FERUR9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpsb2FkZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5tdXNpYy5BdWRpby5FVkVOVF9FUlJPUn0pXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jcHJlbG9hZGVyOmVycm9yXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCQ0YPQtNC40L4t0L/Qu9C10LXRgCDQtNC70Y8g0LHRgNCw0YPQt9C10YDQsC5cbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpb1xuICogQHBhcmFtIHtTdHJpbmd9IFtwcmVmZXJyZWRUeXBlXSAtIHByZWZlcnJlZCBwbGF5ZXIgdHlwZSAoaHRtbDUvZmxhc2gpXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBbb3ZlcmxheV0gLSBkb20gZWxlbWVudCB0byBzaG93IGZsYXNoXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKiBAbWl4ZXMgQXVkaW9TdGF0aWNcbiAqXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jcGxheVxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI2VuZGVkXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jdm9sdW1lY2hhbmdlXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jY3Jhc2hlZFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI3N0YXRlXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jc3dhcFxuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNzdG9wXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jcGF1c2VcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNwcm9ncmVzc1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI2xvYWRpbmdcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNsb2FkZWRcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNlcnJvclxuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNwcmVsb2FkZXI6c3RvcFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpwYXVzZVxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpwcm9ncmVzc1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjpsb2FkaW5nXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jcHJlbG9hZGVyOmxvYWRlZFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI3ByZWxvYWRlcjplcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQXVkaW9QbGF5ZXIgPSBmdW5jdGlvbihwcmVmZXJyZWRUeXBlLCBvdmVybGF5KSB7XG4gICAgdGhpcy5uYW1lID0gcGxheWVySWQrKztcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVmZXJyZWRUeXBlID0gcHJlZmVycmVkVHlwZTtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuc3RhdGUgPSBBdWRpb1BsYXllci5TVEFURV9JTklUO1xuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX3BsYXlJZCA9IG51bGw7XG5cbiAgICB0aGlzLl93aGVuUmVhZHkgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICB0aGlzLndoZW5SZWFkeSA9IHRoaXMuX3doZW5SZWFkeS5wcm9taXNlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJpbXBsZW1lbnRhdGlvbiBmb3VuZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24ub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50LCBvZmZzZXQsIGRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3BvcHVsYXRlRXZlbnRzKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuXG4gICAgICAgICAgICBpZiAoIW9mZnNldCkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9QTEFZOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VOREVEOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVA6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9FUlJPUjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwib25FbmRlZFwiLCBldmVudCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9JRExFKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUEFVU0U6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OLCBlKTtcblxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9DUkFTSEVEKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5faW5pdCgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9QbGF5ZXIpO1xubWVyZ2UoQXVkaW9QbGF5ZXIsIEF1ZGlvU3RhdGljLCB0cnVlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0YLQsNGC0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC00L7RgdGC0YPQv9C90YvRhSDQv9C70LXQtdGA0L7QslxuICogQHR5cGUge09iamVjdH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuaW5mbyA9IHtcbiAgICBodG1sNTogYXVkaW9UeXBlcy5odG1sNS5hdmFpbGFibGUsXG4gICAgZmxhc2g6IGF1ZGlvVHlwZXMuZmxhc2guYXZhaWxhYmxlXG59O1xuXG4vKipcbiAqINCa0L7QvdGC0LXQutGB0YIg0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAqIEB0eXBlIHtBdWRpb0NvbnRleHR9XG4gKiBAc3RhdGljXG4gKi9cbkF1ZGlvUGxheWVyLmF1ZGlvQ29udGV4dCA9IGF1ZGlvVHlwZXMuaHRtbDUuYXVkaW9Db250ZXh0O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RhdGUgLSDQvdC+0LLRi9C5INGB0YLQsNGC0YPRgVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9zZXRTdGF0ZSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldFN0YXRlXCIsIHN0YXRlKTtcblxuICAgIHZhciBjaGFuZ2VkID0gdGhpcy5zdGF0ZSAhPT0gc3RhdGU7XG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJuZXdTdGF0ZVwiLCBzdGF0ZSk7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1BsYXllci5FVkVOVF9TVEFURSwgc3RhdGUpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW3JldHJ5PTBdIC0g0LrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uKHJldHJ5KSB7XG4gICAgcmV0cnkgPSByZXRyeSB8fCAwO1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX2luaXRcIiwgcmV0cnkpO1xuXG4gICAgaWYgKCF0aGlzLl93aGVuUmVhZHkucGVuZGluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHJldHJ5ID4gY29uZmlnLmF1ZGlvLnJldHJ5KSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OKTtcbiAgICAgICAgdGhpcy5fd2hlblJlYWR5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OKSk7XG4gICAgfVxuXG4gICAgdmFyIGluaXRTZXEgPSBbXG4gICAgICAgIGF1ZGlvVHlwZXMuaHRtbDUsXG4gICAgICAgIGF1ZGlvVHlwZXMuZmxhc2hcbiAgICBdLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgaWYgKGEuYXZhaWxhYmxlICE9PSBiLmF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmF2YWlsYWJsZSA/IC0xIDogMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGEuQXVkaW9JbXBsZW1lbnRhdGlvbi50eXBlID09PSB0aGlzLnByZWZlcnJlZFR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChiLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgICAgIHZhciB0eXBlID0gaW5pdFNlcS5zaGlmdCgpO1xuXG4gICAgICAgIGlmICghdHlwZSkge1xuICAgICAgICAgICAgc2VsZi5faW5pdChyZXRyeSArIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5faW5pdFR5cGUodHlwZSkudGhlbihzZWxmLl93aGVuUmVhZHkucmVzb2x2ZSwgaW5pdCk7XG4gICAgfVxuXG4gICAgaW5pdCgpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwINGBINGD0LrQsNC30LDQvdC90YvQvCDRgtC40L/QvtC8XG4gKiBAcGFyYW0ge3t0eXBlOiBzdHJpbmcsIEF1ZGlvSW1wbGVtZW50YXRpb246IGZ1bmN0aW9ufX0gdHlwZSAtINC+0LHRitC10LrRgiDQvtC/0LjRgdCw0L3QuNGPINGC0LjQv9CwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXRUeXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX2luaXRUeXBlXCIsIHR5cGUpO1xuXG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdHJ5IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LXQutGD0YnQsNGPINGA0LXQsNC70LjQt9Cw0YbQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtJQXVkaW9JbXBsZW1lbnRhdGlvbnxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbiA9IG5ldyB0eXBlLkF1ZGlvSW1wbGVtZW50YXRpb24odGhpcy5vdmVybGF5KTtcbiAgICAgICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24ud2hlblJlYWR5KSB7XG4gICAgICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeS50aGVuKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGUpO1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIl9pbml0VHlwZUVycm9yXCIsIHR5cGUsIGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQvtC00L3QvtC8INC40Lcg0YHQv9C40YHQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uIC0g0L3QsNC30LLQsNC90LjQtSDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZXNvbHZlIC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0YDQsNC30YDQtdGI0LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gcmVqZWN0IC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvQuSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9IC0tINGC0LDQutC20LUg0YHQvtC30LTQsNGR0YIgRGVmZXJyZWQg0YHQstC+0LnRgdGC0LLQviDRgSDQvdCw0LfQstCw0L3QuNC10LwgX3doZW48QWN0aW9uPiwg0LrQvtGC0L7RgNC+0LUg0LbQuNCy0ZHRgiDQtNC+INC80L7QvNC10L3RgtCwINGA0LDQt9GA0LXRiNC10L3QuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3dhaXRFdmVudHMgPSBmdW5jdGlvbihhY3Rpb24sIHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXNbYWN0aW9uXSA9IGRlZmVycmVkO1xuXG4gICAgdmFyIGNsZWFudXBFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgc2VsZlthY3Rpb25dO1xuICAgIH07XG5cbiAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi5vbihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgfSk7XG5cbiAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBkYXRhIGluc3RhbmNlb2YgRXJyb3IgPyBkYXRhIDogbmV3IEF1ZGlvRXJyb3IoZGF0YSB8fCBldmVudCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFudXBFdmVudHMsIGNsZWFudXBFdmVudHMpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0KDQsNGB0YjQuNGA0LXQvdC40LUg0YHQvtCx0YvRgtC40Lkg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LAg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQvNC4INGB0LLQvtC50YHRgtCy0LDQvNC4LiDQn9C+0LTQv9C40YHRi9Cy0LDQtdGC0YHRjyDQvdCwINCy0YHQtSDRgdC+0LHRi9GC0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCxcbiAqINGC0YDQuNCz0LPQtdGA0LjRgiDQuNGC0L7Qs9C+0LLRi9C1INGB0L7QsdGL0YLQuNGPLCDRgNCw0LfQtNC10LvRj9GPINC40YUg0L/QviDRgtC40L/RgyDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgCwg0LTQvtC/0L7Qu9C90Y/QtdGCINGB0L7QsdGL0YLQuNGPINC00LDQvdC90YvQvNC4LlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSDQuNGB0YLQvtGH0L3QuNC6INGB0L7QsdGL0YLQuNGPLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y8uXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3BvcHVsYXRlRXZlbnRzID0gZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmIChldmVudCAhPT0gQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BvcHVsYXRlRXZlbnRzXCIsIGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH1cblxuICAgIHZhciBvdXRlckV2ZW50ID0gKG9mZnNldCA/IEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCA6IFwiXCIpICsgZXZlbnQ7XG5cbiAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfVk9MVU1FOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCB0aGlzLmdldFZvbHVtZSgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BST0dSRVNTOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbjogdGhpcy5nZXREdXJhdGlvbihvZmZzZXQpLFxuICAgICAgICAgICAgICAgIGxvYWRlZDogdGhpcy5nZXRMb2FkZWQob2Zmc2V0KSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICBwbGF5ZWQ6IG9mZnNldCA/IDAgOiB0aGlzLmdldFBsYXllZCgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRidC40LUg0YTRg9C90LrRhtC40Lgg0YPQv9GA0LDQstC70LXQvdC40Y8g0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLypcbklORk86INC00LDQvdC90YvQuSDQvNC10YLQvtC0INCx0YvQu9C+INGA0LXRiNC10L3QviDQvtGB0YLQsNCy0LjRgtGMLCDRgi7Qui4g0Y3RgtC+INGD0LTQvtCx0L3QtdC1INGH0LXQvCDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSAtINC10YHRgtGMINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LIg0L3QsNGH0LDQu9C1XG7QuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0LvRg9GH0LjRgtGMINGB0YDQsNC30YMg0YHRgdGL0LvQutGDINC90LAg0Y3QutC30LXQvNC/0LvRj9GAINC/0LvQtdC10YDQsCDQuCDQvtCx0LLQtdGI0LDRgtGMINC10LPQviDQvtCx0YDQsNCx0L7RgtGH0LjQutCw0LzQuCDRgdC+0LHRi9GC0LjQuS4g0J/Qu9GO0YEg0Log0YLQvtC80YMg0L/RgNC4XG7RgtCw0LrQvtC8INC/0L7QtNGF0L7QtNC1INGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjiDQtNC10LvQsNGC0Ywg0L/RgNC+0YnQtSAtINC/0YDQuCDQvdC10Lkg0L3QtSDQv9GA0LjQtNGR0YLRgdGPINC/0LXRgNC10L3QsNC30L3QsNGH0LDRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0Lgg0L7QsdC90L7QstC70Y/RgtGMINCy0LXQt9C00LUg0YHRgdGL0LvQutGDXG7QvdCwINGC0LXQutGD0YnQuNC5INGN0LrQt9C10LzQv9C70Y/RgCDQv9C70LXQtdGA0LAuXG4gKi9cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0L7QsdC10YnQsNC90LjQtSwg0YDQsNC30YDQtdGI0LDRjtGJ0LXQtdGB0Y8g0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaW5pdFByb21pc2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVhZHk7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlO1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgtC40L8g0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRUeXBlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlO1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDRgtC10LrRg9GJ0LjQuSDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSDQsdGA0LDRgtGMINGC0YDQtdC6INC40Lcg0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuNC70Lgg0LjQtyDQv9GA0LXQu9C+0LDQtNC10YDQsC4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0U3JjKG9mZnNldCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC10LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5XCIsIHNyYywgZHVyYXRpb24pO1xuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGxheShzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC30LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5nZXREdXJhdGlvbigpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuICAgIHRoaXMuc2V0UG9zaXRpb24oMCk7XG4gICAgcmV0dXJuIHRoaXMucmVzdW1lKCk7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LrQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQu9C+0LDQtNC10YAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0b3BcIiwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcChvZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuU3RvcC5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblN0b3BcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1NUT1BdLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcCgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC90LAg0L/QsNGD0LfRg1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGF1c2VcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblBhdXNlLnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGF1c2VcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BBVVNFXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVksXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wYXVzZSgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0LjQtSDQv9C70LXQtdGA0LAg0YEg0L/QsNGD0LfRi1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlc3VtZVwiKTtcblxuICAgIGlmICh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HICYmICF0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIGlmICghKHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX0lETEUgfHwgdGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEXG4gICAgICAgIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZTtcblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInJlc3VtZVwiKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QbGF5LnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG5cbiAgICAgICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5yZXN1bWUoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPINC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3JjXSAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LCDQtNC70Y8g0L/RgNC+0LLQtdGA0LrQuCwg0YfRgtC+INCyINC/0YDQtdC70L7QsNC00LXRgNC1INC90YPQttC90YvQuSDRgtGA0LXQulxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5UHJlbG9hZGVkXCIsIHNyYyk7XG5cbiAgICBpZiAoIXNyYykge1xuICAgICAgICBzcmMgPSB0aGlzLmdldFNyYygxKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNQcmVsb2FkZWQoc3JjKSkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInBsYXlQcmVsb2FkZWRCYWRUcmFja1wiLCBBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX2dlbmVyYXRlUGxheUlkKCk7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICB0aGlzLl93aGVuUGF1c2UucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHRoaXMuX3doZW5TdG9wLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QbGF5XCIsIFtBdWRpb1BsYXllci5FVkVOVF9QTEFZXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgIF0pO1xuICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QuYXBwbHkodGhpcy5fd2hlblBsYXksIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCk7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMuaW1wbGVtZW50YXRpb24ucGxheVByZWxvYWRlZCgpO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkRXJyb3JcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAuINCQ0LrRgtGD0LDQu9GM0L3QviDQtNC70Y8g0YTQu9C10Ygt0YDQtdCw0LvQuNC30LDRhtC40LgsINCyINC90LXQuSDQv9C+0LrQsCDRgtGA0LXQuiDQs9GA0YPQt9C40YLRgdGPXG4gKiDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0L7Qv9GA0LXQtNC10LvRj9C10YLRgdGPINGBINC/0L7Qs9GA0LXRiNC90L7RgdGC0YzRji5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBpZiAoZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gXCJtc2llXCIgJiYgZGV0ZWN0LmJyb3dzZXIudmVyc2lvblswXSA9PSBcIjlcIikge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIGR1cmF0aW9uKTtcblxuICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QoXCJwcmVsb2FkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUHJlbG9hZFwiLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0xPQURJTkcsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVBcbiAgICBdLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQsXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9TVE9QXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QcmVsb2FkLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKDEpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wcmVsb2FkKHNyYywgZHVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttC10L1cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGVkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRpbmcoc3JjLCAxKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQotCw0LnQvNC40L3Qs9C4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0UG9zaXRpb24oKSB8fCAwO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQvdC+0LLQsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn0gLS0g0LrQvtC90LXRh9C90LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgPT0gXCJmbGFzaFwiKSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXRMb2FkZWQoKSAtIDEsIHBvc2l0aW9uKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmdldER1cmF0aW9uKCkgLSAxLCBwb3NpdGlvbikpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCArPSB0aGlzLmdldFBvc2l0aW9uKCkgLSB0aGlzLl9sYXN0U2tpcDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IHBvc2l0aW9uO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cbiAgICByZXR1cm4gcG9zaXRpb247XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtCb29sZWFufGludH0gcHJlbG9hZGVyIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihwcmVsb2FkZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXREdXJhdGlvbihwcmVsb2FkZXIgPyAxIDogMCkgfHwgMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldExvYWRlZChwcmVsb2FkZXIgPyAxIDogMCkgfHwgMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5fcGxheWVkICs9IHBvc2l0aW9uIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHJldHVybiB0aGlzLl9wbGF5ZWQ7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0Vm9sdW1lKCk7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LrQsCDQs9GA0L7QvNC60L7RgdGC0Lgg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0L3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge051bWJlcn0gLS0g0LjRgtC+0LPQvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcblxuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRWb2x1bWUodm9sdW1lKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INCz0YDQvtC80LrQvtGB0YLRjCDRg9C/0YDQsNCy0LvRj9C10YLRgdGPINGD0YHRgtGA0L7QudGB0YLQstC+0LwsINCwINC90LUg0L/RgNC+0LPRgNCw0LzQvdC+XG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzRGV2aWNlVm9sdW1lKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJ0b2dnbGVDcm9zc0RvbWFpbkZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVDcm9zc0RvbWFpbihzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCf0LXRgNC10LrQu9GO0YfQtdC90LjQtSDRgNC10LbQuNC80LAg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gV2ViIEF1ZGlvIEFQSS4g0JTQvtGB0YLRg9C/0LXQvSDRgtC+0LvRjNC60L4g0L/RgNC4IGh0bWw1LdGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqXG4gKiAqKtCS0L3QuNC80LDQvdC40LUhKiogLSDQv9C+0YHQu9C1INCy0LrQu9GO0YfQtdC90LjRjyDRgNC10LbQuNC80LAgV2ViIEF1ZGlvIEFQSSDQvtC9INC90LUg0L7RgtC60LvRjtGH0LDQtdGC0YHRjyDQv9C+0LvQvdC+0YHRgtGM0Y4sINGCLtC6LiDQtNC70Y8g0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y9cbiAqINGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAsINC60L7RgtC+0YDQvtC5INGC0YDQtdCx0YPQtdGC0YHRjyDQutC70LjQuiDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8uINCf0YDQuCDQvtGC0LrQu9GO0YfQtdC90LjQuCDQuNC3INCz0YDQsNGE0LAg0L7QsdGA0LDQsdC+0YLQutC4INC40YHQutC70Y7Rh9Cw0Y7RgtGB0Y9cbiAqINCy0YHQtSDQvdC+0LTRiyDQutGA0L7QvNC1INC90L7QtC3QuNGB0YLQvtGH0L3QuNC60L7QsiDQuCDQvdC+0LTRiyDQstGL0LLQvtC00LAsINGD0L/RgNCw0LLQu9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLRjNGOINC/0LXRgNC10LrQu9GO0YfQsNC10YLRgdGPINC90LAg0Y3Qu9C10LzQtdC90YLRiyBhdWRpbywg0LHQtdC3XG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBHYWluTm9kZVxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINC30LDQv9GA0LDRiNC40LLQsNC10LzRi9C5INGB0YLQsNGC0YPRgVxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINC40YLQvtCz0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElcIiwgc3RhdGUpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVXZWJBdWRpb0FQSShzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCQ0YPQtNC40L4t0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5tdXNpYy5BdWRpb35BdWRpb1ByZXByb2Nlc3NvclxuICpcbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBpbnB1dCAtINC90L7QtNCwLCDQsiDQutC+0YLQvtGA0YPRjiDQv9C10YDQtdC90LDQv9GA0LDQstC70Y/QtdGC0YHRjyDQstGL0LLQvtC0INCw0YPQtNC40L5cbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBvdXRwdXQgLSDQvdC+0LTQsCDQuNC3INC60L7RgtC+0YDQvtC5INCy0YvQstC+0LQg0L/QvtC00LDRkdGC0YHRjyDQvdCwINGD0YHQuNC70LjRgtC10LvRjFxuICovXG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0QXVkaW9QcmVwcm9jZXNzb3IocHJlcHJvY2Vzc29yKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQk9C10L3QtdGA0LDRhtC40Y8gcGxheUlkXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2dlbmVyYXRlUGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGxheUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygpLnNsaWNlKDIpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUgcGxheUlkXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BsYXlJZDtcbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluZGV4OiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24ubmFtZSxcbiAgICAgICAgc3JjOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uX2xvZ2dlcigpLFxuICAgICAgICB0eXBlOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZVxuICAgIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvUGxheWVyO1xuIiwiLyoqXG4gKiBAbmFtZXNwYWNlIEF1ZGlvU3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9TdGF0aWMgPSB7fTtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUExBWSA9IFwicGxheVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUT1AgPSBcInN0b3BcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BBVVNFID0gXCJwYXVzZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTID0gXCJwcm9ncmVzc1wiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyA9IFwibG9hZGluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCA9IFwibG9hZGVkXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUgPSBcInZvbHVtZWNoYW5nZVwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfRU5ERUQgPSBcImVuZGVkXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RBVEUgPSBcInN0YXRlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCA9IFwic3dhcFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuUFJFTE9BREVSX0VWRU5UID0gXCJwcmVsb2FkZXI6XCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JTklUID0gXCJpbml0XCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0lETEUgPSBcImlkbGVcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9QTEFZSU5HID0gXCJwbGF5aW5nXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUEFVU0VEID0gXCJwYXVzZWRcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1N0YXRpYztcbiIsIi8qKlxuICog0J3QsNGB0YLQvtC50LrQuCDQsdC40LHQu9C40L7RgtC10LrQuFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLmNvbmZpZ1xuICogQG5hbWVzcGFjZVxuICovXG52YXIgY29uZmlnID0ge1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCe0LHRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4XG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGF1ZGlvOiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmtC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QuiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHJ5OiAzXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAgRmxhc2gt0L/Qu9C10LXRgFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPIGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBmbGFzaDoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0J/Rg9GC0Ywg0LogLnN3ZiDRhNCw0LnQu9GDINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGF0aDogXCJkaXN0XCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8gLnN3ZiDRhNCw0LnQu9CwINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgbmFtZTogXCJwbGF5ZXItMl8wLnN3ZlwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JzQuNC90LjQvNCw0LvRjNC90LDRjyDQstC10YDRgdC40Y8g0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB2ZXJzaW9uOiBcIjkuMC4yOFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICogSUQsINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0LLRi9GB0YLQsNCy0LvQtdC9INC00LvRjyDRjdC70LXQvNC10L3RgtCwINGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBwbGF5ZXJJRDogXCJZYW5kZXhBdWRpb0ZsYXNoUGxheWVyXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8g0YTRg9C90LrRhtC40Lgt0L7QsdGA0LDQsdC+0YLRh9C40LrQsCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICogQGNvbnN0XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsYmFjazogXCJ5YS5tdXNpYy5BdWRpby5fZmxhc2hDYWxsYmFja1wiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGluaXRUaW1lb3V0OiAzMDAwLCAvLyAzIHNlY1xuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgbG9hZFRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0YHQu9C1INC60LvQuNC60LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGNsaWNrVGltZW91dDogMTAwMCxcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0L3RgtC10YDQstCw0Lsg0L/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgaGVhcnRCZWF0SW50ZXJ2YWw6IDEwMDBcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICBIVE1MNS3Qv9C70LXQtdGAXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6IGh0bWw1INC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBodG1sNToge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KHQv9C40YHQvtC6INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0L7QsiDQtNC70Y8g0LrQvtGC0L7RgNGL0YUg0LvRg9GH0YjQtSDQvdC1INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCBodG1sNSDQv9C70LXQtdGALiDQmNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0L/RgNC4XG4gICAgICAgICAqINCw0LLRgtC+LdC+0L/RgNC10LTQtdC70LXQvdC40Lgg0YLQuNC/0LAg0L/Qu9C10LXRgNCwLiDQmNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNGLINGB0YDQsNCy0L3QuNCy0LDRjtGC0YHRjyDRgdC+INGB0YLRgNC+0LrQvtC5INC/0L7RgdGC0YDQvtC10L3QvdC+0Lkg0L/QviDRiNCw0LHQu9C+0L3Rg1xuICAgICAgICAgKiBgQDxwbGF0Zm9ybS52ZXJzaW9uPiA8cGxhdGZvcm0ub3M+Ojxicm93c2VyLm5hbWU+Lzxicm93c2VyLnZlcnNpb24+YFxuICAgICAgICAgKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gICAgICAgICAqL1xuICAgICAgICBibGFja2xpc3Q6IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiLCBcIm1zaWUvOVwiXVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY29uZmlnO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi9saWIvY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiBAY2xhc3NkZXNjINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCw0YPQtNC40L4t0L/Qu9C70LXQtdGA0LBcbiAqIEBuYW1lIHlhLm11c2ljLkF1ZGlvLkF1ZGlvRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkF1ZGlvRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJBdWRpb0Vycm9yXCIpO1xuXG4vKipcbiAqINCd0LUg0L3QsNC50LTQtdC90LAg0YDQtdCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwINC40LvQuCDQstGB0LUg0LTQvtGB0YLRg9C/0L3Ri9C1INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0L7RgtC10YDQv9C10LvQuCDQutGA0LDRhSDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04gPSBcImNhbm5vdCBmaW5kIHN1aXRhYmxlIGltcGxlbWVudGF0aW9uXCI7XG4vKipcbiAqINCi0YDQtdC6INC90LUg0LHRi9C7INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvSDQuNC70Lgg0LLQviDQstGA0LXQvNGPINC30LDQs9GA0YPQt9C60Lgg0L/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEID0gXCJ0cmFjayBpcyBub3QgcHJlbG9hZGVkXCI7XG4vKipcbiAqINCU0LXQudGB0YLQstC40LUg0L3QtSDQtNC+0YHRgtGD0L/QvdC+INC40Lcg0YLQtdC60YPRidC10LPQviDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5CQURfU1RBVEUgPSBcImFjdGlvbiBpcyBub3QgcGVybWl0ZWQgZnJvbSBjdXJyZW50IHN0YXRlXCI7XG5cbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQsdGL0Lsg0LfQsNCx0LvQvtC60LjRgNC+0LLQsNC9XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfQkxPQ0tFUiA9IFwiZmxhc2ggaXMgcmVqZWN0ZWQgYnkgZmxhc2ggYmxvY2tlciBwbHVnaW5cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+INC90LXQuNC30LLQtdGB0YLQvdGL0Lwg0L/RgNC40YfQuNC90LDQvFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCA9IFwiZmxhc2ggaW5pdCB0aW1lZCBvdXRcIjtcbi8qKlxuICog0JLQvdGD0YLRgNC10L3QvdGP0Y8g0L7RiNC40LHQutCwIEZsYXNoLdC/0LvQtdC10YDQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SID0gXCJmbGFzaCBpbnRlcm5hbCBlcnJvclwiO1xuLyoqXG4gKiDQn9C+0L/Ri9GC0LrQsCDQstGL0LfQstCw0YLRjCDQvdC10LTQvtGB0YLRg9C/0L3Ri9C5INGN0LrQt9C10LzQu9GP0YAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElORyA9IFwiZmxhc2ggcGxheWVyIGRvZXNuJ3QgcmVzcG9uc2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0Vycm9yO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9hdWRpby1lcnJvcicpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuL3BsYXliYWNrLWVycm9yJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkF1ZGlvRXJyb3IgPSBBdWRpb0Vycm9yO1xueWEubXVzaWMuQXVkaW8uUGxheWJhY2tFcnJvciA9IFBsYXliYWNrRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLlBsYXliYWNrRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBlbnVtIHtTdHJpbmd9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFBsYXliYWNrRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlLCBzcmMpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgICB0aGlzLnNyYyA9IHNyYztcbn07XG5cblBsYXliYWNrRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJQbGF5YmFja0Vycm9yXCIpO1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDRgdC+0LXQtNC40L3QtdC90L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVEID0gXCJDb25uZWN0aW9uIGFib3J0ZWRcIjtcbi8qKlxuICog0KHQtdGC0LXQstCw0Y8g0L7RiNC40LHQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUiA9IFwiTmV0d29yayBlcnJvclwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LTQtdC60L7QtNC40YDQvtCy0LDQvdC40Y8g0LDRg9C00LjQvlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUiA9IFwiRGVjb2RlIGVycm9yXCI7XG4vKipcbiAqINCd0LUg0LTQvtGB0YLRg9C/0L3Ri9C5INC40YHRgtC+0YfQvdC40LpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5CQURfREFUQSA9IFwiQmFkIGRhdGFcIjtcblxuLyoqXG4gKiDQotCw0LHQu9C40YbQsCDRgdC+0L7RgtCy0LXRgtGB0YLQstC40Y8g0LrQvtC00L7QsiDQvtGI0LjQsdC+0LogaHRtbDUg0L/Qu9C10LXRgNCwXG4gKiBAZW51bSB7U3RyaW5nfVxuICovXG5QbGF5YmFja0Vycm9yLmh0bWw1ID0ge1xuICAgIDE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELFxuICAgIDI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUixcbiAgICAzOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUixcbiAgICA0OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBXG59O1xuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC60LvQsNGB0YHQuNGE0LjQutCw0YLQvtGAINC+0YjQuNCx0L7QuiBmbGFzaC3Qv9C70LXQtdGA0LBcblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5YmFja0Vycm9yO1xuIiwiaWYgKHR5cGVvZiB3aW5kb3cueWEgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cueWEgPSB7fTtcbn1cblxudmFyIHlhID0gd2luZG93LnlhO1xuXG5pZiAodHlwZW9mIHlhLm11c2ljID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEubXVzaWMgPSB7fTtcbn1cblxuaWYgKHR5cGVvZiB5YS5tdXNpYy5BdWRpbyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHlhLm11c2ljLkF1ZGlvID0ge307XG59XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xudmFyIEF1ZGlvUGxheWVyID0gcmVxdWlyZSgnLi9hdWRpby1wbGF5ZXInKTtcbnZhciBQcm94eSA9IHJlcXVpcmUoJy4vbGliL2NsYXNzL3Byb3h5Jyk7XG5cbnlhLm11c2ljLkF1ZGlvID0gUHJveHkuY3JlYXRlQ2xhc3MoQXVkaW9QbGF5ZXIpO1xueWEubXVzaWMuQXVkaW8uY29uZmlnID0gY29uZmlnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHlhLm11c2ljLkF1ZGlvO1xuIiwidmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0ZsYXNoJyk7XG52YXIgRmxhc2hNYW5hZ2VyID0gcmVxdWlyZSgnLi9mbGFzaC1tYW5hZ2VyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcblxudmFyIHBsYXllcklkID0gMTtcblxudmFyIGZsYXNoTWFuYWdlcjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxudmFyIGZsYXNoVmVyc2lvbiA9IHN3Zm9iamVjdC5nZXRGbGFzaFBsYXllclZlcnNpb24oKTtcbmRldGVjdC5mbGFzaFZlcnNpb24gPSBmbGFzaFZlcnNpb24ubWFqb3IgKyBcIi5cIiArIGZsYXNoVmVyc2lvbi5taW5vciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLnJlbGVhc2U7XG5cbmV4cG9ydHMuYXZhaWxhYmxlID0gc3dmb2JqZWN0Lmhhc0ZsYXNoUGxheWVyVmVyc2lvbihjb25maWcuZmxhc2gudmVyc2lvbik7XG5sb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBleHBvcnRzLmF2YWlsYWJsZSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNjcmFzaGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3dhcFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBwYXJhbSB7SE1UTEVsZW1lbnR9IFtvdmVybGF5XSAtINC80LXRgdGC0L4g0LTQu9GPINCy0YHRgtGA0LDQuNCy0LDQvdC40Y8g0L/Qu9C10LXRgNCwICjQsNC60YLRg9Cw0LvRjNC90L4g0YLQvtC70YzQutC+INC00LvRjyBmbGFzaC3Qv9C70LXQtdGA0LApXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZT1mYWxzZV0gLSDRgdC+0LfQtNCw0YLRjCDQvdC+0LLRi9C5INGN0LrQt9C10L/Qu9GP0YAgRmxhc2hNYW5hZ2VyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBBdWRpb0ZsYXNoID0gZnVuY3Rpb24ob3ZlcmxheSwgZm9yY2UpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgaWYgKCFmbGFzaE1hbmFnZXIgfHwgZm9yY2UpIHtcbiAgICAgICAgZmxhc2hNYW5hZ2VyID0gbmV3IEZsYXNoTWFuYWdlcihvdmVybGF5KTtcbiAgICB9XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMud2hlblJlYWR5ID0gZmxhc2hNYW5hZ2VyLmNyZWF0ZVBsYXllcih0aGlzKTtcbiAgICB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCBkYXRhKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvRmxhc2gpO1xuXG5BdWRpb0ZsYXNoLnR5cGUgPSBBdWRpb0ZsYXNoLnByb3RvdHlwZS50eXBlID0gXCJmbGFzaFwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KHQvtC30LTQsNC90LjQtSDQvNC10YLQvtC00L7QsiDRgNCw0LHQvtGC0Ysg0YEg0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuT2JqZWN0LmtleXMoRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleVswXSAhPT0gXCJfXCI7XG59KS5tYXAoZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQXVkaW9GbGFzaC5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIS9eZ2V0Ly50ZXN0KG1ldGhvZCkpIHtcbiAgICAgICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBtZXRob2QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KFwiaWRcIikpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheWVyIGlzIG5vdCByZWFkeVwiKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmlkKTtcbiAgICAgICAgcmV0dXJuIGZsYXNoTWFuYWdlci5mbGFzaFttZXRob2RdLmFwcGx5KGZsYXNoTWFuYWdlci5mbGFzaCwgYXJncyk7XG4gICAgfVxufSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQ1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKi9cblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGF1c2VcbiAqL1xuXG4vKipcbiAqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRi1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3Jlc3VtZVxuICovXG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3N0b3BcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICovXG5cbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQuNGC0Ywg0YLRgNC10LpcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwcmVsb2FkXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2lzUHJlbG9hZGluZ1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwbGF5UHJlbG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRQb3NpdGlvblxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGC0LXQutGD0YnRg9GOINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFBvc2l0aW9uXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXREdXJhdGlvblxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldExvYWRlZFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0Vm9sdW1lXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNzZXRWb2x1bWVcbiAqIEBwYXJhbSB7bnVtYmVyfSB2b2x1bWVcbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRTcmNcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfEJvb2xlYW59IC0tINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6INC40LvQuCBmYWxzZSwg0LXRgdC70Lgg0L3QtdGCINC30LDQs9GA0YPQttCw0LXQvNC+0LPQviDRgtGA0LXQutCwXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0L/Qu9C10LXRgNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINC00L7RgdGC0YPQv9C10L0g0LvQuCDQv9GA0L7Qs9GA0LDQvNC80L3Ri9C5INC60L7QvdGC0YDQvtC70Ywg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9GbGFzaC5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JvQvtCz0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0ZsYXNoLnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KFwiaWRcIikpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbWFpbjogXCJub3QgcmVhZHlcIixcbiAgICAgICAgICAgICAgICBwcmVsb2FkZXI6IFwibm90IHJlYWR5XCJcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IHRoaXMuZ2V0U3JjKDApLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiB0aGlzLmdldFNyYygxKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLkF1ZGlvSW1wbGVtZW50YXRpb24gPSBBdWRpb0ZsYXNoO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdGbGFzaEludGVyZmFjZScpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J7Qv9C40YHQsNC90LjQtSDQstC90LXRiNC90LXQs9C+INC40L3RgtC10YDRhNC10LnRgdCwIGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtPYmplY3R9IGZsYXNoIC0gc3dmLdC+0LHRitC10LrRglxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hJbnRlcmZhY2UgPSBmdW5jdGlvbihmbGFzaCkge1xuICAgIHRoaXMuZmxhc2ggPSB5YS5tdXNpYy5BdWRpby5fZmxhc2ggPSBmbGFzaDtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YnQtdC90LjQtSDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCS0YvQt9Cy0LDRgtGMINC80LXRgtC+0LQgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZm4gLSDQvdCw0LfQstCw0L3QuNC1INC80LXRgtC+0LTQsFxuICogQHJldHVybnMgeyp9XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2NhbGxGbGFzaCA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy9sb2dnZXIuZGVidWcodGhpcywgZm4sIGFyZ3VtZW50cyk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5mbGFzaC5jYWxsLmFwcGx5KHRoaXMuZmxhc2gsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcIl9jYWxsRmxhc2hFcnJvclwiLCBlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC+0LHRgNCw0YLQvdC+0Lkg0YHQstGP0LfQuCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHRocm93cyDQntGI0LjQsdC60LAg0LTQvtGB0YLRg9C/0LAg0LogZmxhc2gt0L/Qu9C10LXRgNGDXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2hlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcImhlYXJ0QmVhdFwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7aW50fSAtLSBpZCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2FkZFBsYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJhZGRQbGF5ZXJcIiwgLTEpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LXRgtC+0LTRiyDRg9C/0YDQsNCy0LvQtdC90LjRjyDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LbQtdC70LDQtdC80LDRjyDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKGlkLCB2b2x1bWUpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRWb2x1bWVcIiwgLTEsIHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0Vm9sdW1lXCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBsYXlcIiwgaWQsIHNyYywgZHVyYXRpb24pO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzdG9wXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBhdXNlXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwicmVzdW1lXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0UG9zaXRpb25cIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkLCBwb3NpdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInNldFBvc2l0aW9uXCIsIGlkLCBwb3NpdGlvbik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0RHVyYXRpb25cIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldExvYWRlZFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicHJlbG9hZFwiLCBpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkZWRcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkaW5nXCIsIGlkLCBzcmMsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicGxheVByZWxvYWRlZFwiLCBpZCwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQtdC10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFNyY1wiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEludGVyZmFjZTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignRmxhc2hCcmlkZ2UnKTtcblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBmbGFzaExvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xuXG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi4vbGliL25ldC9lcnJvci9sb2FkZXItZXJyb3InKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCX0LDQs9GA0YPQt9C60LAgZmxhc2gt0L/Qu9C10LXRgNCwINC4INC+0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3ZlcmxheSAtINC+0LHRitC10LrRgiDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDQuCDQv9C+0LrQsNC30LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaE1hbmFnZXIgPSBmdW5jdGlvbihvdmVybGF5KSB7IC8vIHNpbmdsZXRvbiFcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiLCBvdmVybGF5KTtcblxuICAgIHRoaXMuc3RhdGUgPSBcImluaXRcIjtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuZW1taXRlcnMgPSBbXTtcblxuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAvKipcbiAgICAgKiDQntCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQt9Cw0LLQtdGA0YjQtdC90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAqIEB0eXBlIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlKCk7XG5cbiAgICB2YXIgY2FsbGJhY2tQYXRoID0gY29uZmlnLmZsYXNoLmNhbGxiYWNrLnNwbGl0KFwiLlwiKTtcbiAgICB2YXIgY2FsbGJhY2tOYW1lID0gY2FsbGJhY2tQYXRoLnBvcCgpO1xuICAgIHZhciBjYWxsYmFja0NvbnQgPSB3aW5kb3c7XG4gICAgY2FsbGJhY2tQYXRoLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrQ29udFtwYXJ0XSkge1xuICAgICAgICAgICAgY2FsbGJhY2tDb250W3BhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2tDb250ID0gY2FsbGJhY2tDb250W3BhcnRdO1xuICAgIH0pO1xuICAgIGNhbGxiYWNrQ29udFtjYWxsYmFja05hbWVdID0gdGhpcy5fb25FdmVudC5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX2xvYWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkxvYWRUaW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mbGFzaC5sb2FkVGltZW91dCk7XG4gICAgZmxhc2hMb2FkZXIoY29uZmlnLmZsYXNoLnBhdGggKyBcIi9cIlxuICAgICAgICArIGNvbmZpZy5mbGFzaC5uYW1lLCBjb25maWcuZmxhc2gudmVyc2lvbiwgY29uZmlnLmZsYXNoLnBsYXllcklELCB0aGlzLl9vbkxvYWQuYmluZCh0aGlzKSwge30sIG92ZXJsYXkpO1xuXG4gICAgaWYgKG92ZXJsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQ7XG4gICAgICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbigpIHsgLy9LTk9XTEVER0U6IG9ubHkgbW91c2Vkb3duIGV2ZW50IGFuZCBvbmx5IHdtb2RlOiB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgfHwgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfTk9UX1JFU1BPTkRJTkcpKTtcbiAgICAgICAgICAgICAgICB9LCBjb25maWcuZmxhc2guY2xpY2tUaW1lb3V0KTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgJiYgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlYWR5XCIsIHJlc3VsdCk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQgPSBcImluaXRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9GQUlMID0gXCJmYWlsZWRcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40Lkg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LggZmxhc2hcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIGRhdGFcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Mb2FkXCIsIGRhdGEpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkVGltZW91dCk7XG4gICAgZGVsZXRlIHRoaXMuX19sb2FkVGltZW91dDtcblxuICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFzaCA9IG5ldyBGbGFzaEludGVyZmFjZShkYXRhLnJlZik7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFwicmVhZHlcIikge1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKGRhdGEucmVmKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vdmVybGF5KSB7XG4gICAgICAgICAgICB0aGlzLl9faW5pdFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uSW5pdFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmluaXRUaW1lb3V0KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihkYXRhLl9fZmJuID8gQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSIDogQXVkaW9FcnJvci5GTEFTSF9VTktOT1dOX0NSQVNIKSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC30LDQs9GA0YPQt9C60LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgTG9hZGVyRXJyb3IoTG9hZGVyRXJyb3IuVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRiNC90L7RgdGC0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkluaXRcIik7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJyZWFkeVwiO1xuXG4gICAgaWYgKHRoaXMuX19pbml0VGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fX2luaXRUaW1lb3V0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0VGltZW91dDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mbGFzaCkge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUodGhpcy5mbGFzaCk7XG4gICAgICAgIHRoaXMuX19oZWFydGJlYXQgPSBzZXRJbnRlcnZhbCh0aGlzLl9vbkhlYXJ0QmVhdC5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSwg0YHQvtC30LTQsNCy0LDQtdC80YvRhSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0LLQvNC10YHRgtC1INGBINGB0L7QsdGL0YLQuNC10LxcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uRXZlbnQgPSBmdW5jdGlvbihldmVudCwgaWQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmIChldmVudCA9PT0gXCJkZWJ1Z1wiKSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoXCJmbGFzaERFQlVHXCIsIGlkLCBvZmZzZXQsIGRhdGEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnN0YXRlID09PSBcImZhaWxlZFwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwib25FdmVudEZhaWxlZFwiLCBldmVudCwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50LCBpZCwgb2Zmc2V0KTtcblxuICAgIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29uSW5pdCgpO1xuICAgIH1cblxuICAgIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0ZBSUwpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJmYWlsZWRcIiwgQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUik7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpZCA9PSAtMSkge1xuICAgICAgICB0aGlzLmVtbWl0ZXJzLmZvckVhY2goZnVuY3Rpb24oZW1taXRlcikge1xuICAgICAgICAgICAgZW1taXRlci50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZW1taXRlcnNbaWRdKSB7XG4gICAgICAgIHRoaXMuZW1taXRlcnNbaWRdLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQsIGlkKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSGVhcnRCZWF0ID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdGhpcy5mbGFzaC5faGVhcnRCZWF0KCk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyYXNoZWRcIiwgZSk7XG4gICAgICAgIHRoaXMuX29uRXZlbnQoQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCwgLTEsIGUpO1xuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtBdWRpb0ZsYXNofSBhdWRpb0ZsYXNoIC0gZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGALCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0LHRgdC70YPQttC40LLQsNGC0Ywg0YHQvtC30LTQsNC90L3Ri9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YHQvtC30LTQsNC90LjRjyDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5jcmVhdGVQbGF5ZXIgPSBmdW5jdGlvbihhdWRpb0ZsYXNoKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlUGxheWVyXCIpO1xuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBhdWRpb0ZsYXNoLmlkID0gdGhpcy5mbGFzaC5fYWRkUGxheWVyKCk7XG4gICAgICAgIHRoaXMuZW1taXRlcnNbYXVkaW9GbGFzaC5pZF0gPSBhdWRpb0ZsYXNoO1xuICAgICAgICByZXR1cm4gYXVkaW9GbGFzaC5pZDtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHBsYXllcklkKSB7XG4gICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclN1Y2Nlc3NcIiwgcGxheWVySWQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyZWF0ZVBsYXllckVycm9yXCIsIGVycik7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaE1hbmFnZXI7XG4iLCIvKipcbiAqIEBpZ25vcmVcbiAqIEBmaWxlXG4gKiBUaGlzIGlzIGEgd3JhcHBlciBmb3Igc3dmb2JqZWN0IHRoYXQgZGV0ZWN0cyBGbGFzaEJsb2NrIGluIGJyb3dzZXIuXG4gKlxuICogV3JhcHBlciBkZXRlY3RzOlxuICogICAtIENocm9tZVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gKiAgICAgLSBGbGFzaEJsb2NrIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAqICAgICAtIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gKiAgIC0gRmlyZWZveCBGbGFzaGJsb2NrIChodHRwczovL2FkZG9ucy5tb3ppbGxhLm9yZy9ydS9maXJlZm94L2FkZG9uL2ZsYXNoYmxvY2svKVxuICogICAtIE9wZXJhID49IDExLjUgXCJFbmFibGUgcGx1Z2lucyBvbiBkZW1hbmRcIiBzZXR0aW5nXG4gKiAgIC0gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggUGx1Z2luIChmb3IgU2FmYXJpIDwgNS4wLjYpIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICpcbiAqIFRlc3RlZCBvbjpcbiAqICAgLSBDaHJvbWUgMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgTGV4MSAxLjIuMTEuMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgam9zb3JlayAwLjkuMzFcbiAqICAgICAtIEZsYXNoRnJlZSAxLjEuM1xuICogICAtIEZpcmVmb3ggNS4wLjEgKyBGbGFzaGJsb2NrIDEuNS4xNS4xXG4gKiAgIC0gT3BlcmEgMTEuNVxuICogICAtIFNhZmFyaSA1LjEgKyBDbGlja1RvRmxhc2ggKDIuMy4yKVxuICpcbiAqIEFsc28gdGhpcyB3cmFwcGVyIGNhbiByZW1vdmUgYmxvY2tlZCBzd2YgYW5kIGxldCB5b3UgZG93bmdyYWRlIHRvIG90aGVyIG9wdGlvbnMuXG4gKlxuICogRmVlbCBmcmVlIHRvIGNvbnRhY3QgbWUgdmlhIGVtYWlsLlxuICpcbiAqIENvcHlyaWdodCAyMDExLCBBbGV4ZXkgQW5kcm9zb3ZcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCAoaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHApIG9yIEdQTCBWZXJzaW9uIDMgKGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbCkgbGljZW5zZXMuXG4gKlxuICogVGhhbmtzIHRvIGZsYXNoYmxvY2tkZXRlY3RvciBwcm9qZWN0IChodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZmxhc2hibG9ja2RldGVjdG9yKVxuICpcbiAqIEByZXF1aXJlcyBzd2ZvYmplY3RcbiAqIEBhdXRob3IgQWxleGV5IEFuZHJvc292IDxkb29jaGlrQHlhLnJ1PlxuICogQHZlcnNpb24gMS4wXG4gKi9cblxudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG5mdW5jdGlvbiByZW1vdmUobm9kZSkge1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbn1cblxuLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LfQsNCz0YDRg9C30LrQuCDRhNC70LXRiC3Qv9C70LXQtdGA0LAg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLRgdC70LXQttC40LLQsNC90LjRjyDQsdC70L7QutC40YDQvtCy0YnQuNC60L7QslxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZibi1zd2Ytd3JhcHBlclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIF9fU1dGX1dSQVBQRVJfQ0xBU1M6ICdmYm4tc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgX19URVNUUzogW1xuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gICAgICAgIC8vIENob21lIEZsYXNoQmxvY2sgZXh0ZW5zaW9uIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSwgd3JhcHBlck5vZGUpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cGVjdCB0aGF0IHN3ZiBpcyB0aGUgb25seSBjaGlsZCBvZiB3cmFwcGVyXG4gICAgICAgICAgICByZXR1cm4gd3JhcHBlck5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPiAxXG4gICAgICAgIH0sIC8vIG9sZGVyIFNhZmFyaSBDbGlja1RvRmxhc2ggKGh0dHA6Ly9yZW50enNjaC5naXRodWIuY29tL2NsaWNrdG9mbGFzaC8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIElFIGhhcyBubyBzd2ZOb2RlLnR5cGVcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnR5cGUgJiYgc3dmTm9kZS50eXBlICE9ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCdcbiAgICAgICAgfSwgLy8gRmxhc2hCbG9jayBmb3IgRmlyZWZveCAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAgICAgICAgLy8gQ2hyb21lIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIHN3ZiBoYXZlIGJlZW4gZGV0YWNoZWQgZnJvbSBET01cbiAgICAgICAgICAgIHJldHVybiAhc3dmTm9kZS5wYXJlbnROb2RlO1xuICAgICAgICB9LCAvLyBTYWZhcmkgQ2xpY2tUb0ZsYXNoIEV4dGVuc2lvbiAoaHR0cDovL2hveW9pcy5naXRodWIuY29tL3NhZmFyaWV4dGVuc2lvbnMvY2xpY2t0b3BsdWdpbi8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnBhcmVudE5vZGUuY2xhc3NOYW1lLmluZGV4T2YoJ0NURm5vZGlzcGxheScpID4gLTE7XG4gICAgICAgIH1cbiAgICBdLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRiBleGNlcHQgbGFzdCBwYXJhbSByZW1vdmVCbG9ja2VkU1dGLlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbcmVtb3ZlQmxvY2tlZFNXRj10cnVlXSBSZW1vdmUgc3dmIGlmIGJsb2NrZWRcbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbiwgcmVtb3ZlQmxvY2tlZFNXRikge1xuICAgICAgICAvLyB2YXIgc3dmb2JqZWN0ID0gd2luZG93Wydzd2ZvYmplY3QnXTtcblxuICAgICAgICBpZiAoIXN3Zm9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3dmRWxlbWVudCA9IGVbJ3JlZiddO1xuICAgICAgICAgICAgICAgICAgICAvLyBPcGVyYSAxMS41IGFuZCBhYm92ZSByZXBsYWNlcyBmbGFzaCB3aXRoIFNWRyBidXR0b25cbiAgICAgICAgICAgICAgICAgICAgLy8gbXNpZSAoYW5kIGNhbmFyeSBjaHJvbWUgMzIuMCkgY3Jhc2hlcyBvbiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKClcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGxhY2VkQnlTVkcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkQnlTVkcgPSBzd2ZFbGVtZW50ICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10gJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlZEJ5U1ZHKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vc2V0IHRpbWVvdXQgdG8gbGV0IEZsYXNoQmxvY2sgcGx1Z2luIGRldGVjdCBzd2YgYW5kIHJlcGxhY2UgaXQgc29tZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFRFU1RTID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fVEVTVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSBURVNUUy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFRFU1RTW2ldKHN3ZkVsZW1lbnQsIHdyYXBwZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZsYXNoQmxvY2tOb3RpZmllci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZUJsb2NrZWRTV0YgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBzd2ZcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3Zm9iamVjdC5yZW1vdmVTV0YocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSB3cmFwcGVyXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUod3JhcHBlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIGV4dGVuc2lvbiBhcnRlZmFjdHNcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9DbGlja1RvRmxhc2ggYXJ0ZWZhY3RzXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3RmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0NURnN0YWNrJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3RmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGN0Zik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2hyb21lIEZsYXNoQmxvY2sgYXJ0ZWZhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsYXN0Qm9keUNoaWxkID0gZG9jdW1lbnQuYm9keS5sYXN0Q2hpbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdEJvZHlDaGlsZCAmJiBsYXN0Qm9keUNoaWxkLmNsYXNzTmFtZSA9PSAndWpzX2ZsYXNoYmxvY2tfcGxhY2Vob2xkZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGxhc3RCb2R5Q2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGUuc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBlLl9fZmJuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4iLCJ2YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hFbWJlZGRlciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZlbWItc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmVtYi1zd2Ytd3JhcHBlcicsXG5cbiAgICAvKipcbiAgICAgKiBUaW1lb3V0IGZvciBmbGFzaCBibG9jayBkZXRlY3RcbiAgICAgKiBAZGVmYXVsdCA1MDBcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgX19USU1FT1VUOiA1MDAsXG5cbiAgICAvKipcbiAgICAgKiBFbWJlZCBTV0YgaW5mbyBwYWdlLiBUaGlzIGZ1bmN0aW9uIGhhcyBzYW1lIG9wdGlvbnMgYXMgc3dmb2JqZWN0LmVtYmVkU1dGXG4gICAgICogQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICogQHBhcmFtIHN3ZlVybFN0clxuICAgICAqIEBwYXJhbSByZXBsYWNlRWxlbUlkU3RyXG4gICAgICogQHBhcmFtIHdpZHRoU3RyXG4gICAgICogQHBhcmFtIGhlaWdodFN0clxuICAgICAqIEBwYXJhbSBzd2ZWZXJzaW9uU3RyXG4gICAgICogQHBhcmFtIHhpU3dmVXJsU3RyXG4gICAgICogQHBhcmFtIGZsYXNodmFyc09ialxuICAgICAqIEBwYXJhbSBwYXJPYmpcbiAgICAgKiBAcGFyYW0gYXR0T2JqXG4gICAgICogQHBhcmFtIGNhbGxiYWNrRm5cbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbikge1xuICAgICAgICBzd2ZvYmplY3QuYWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHJlcGxhY2VFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICBpZiAoIXJlcGxhY2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSBuZWVkIHRvIGNyZWF0ZSBkaXYtd3JhcHBlciBiZWNhdXNlIHNvbWUgZmxhc2ggYmxvY2sgcGx1Z2lucyByZXBsYWNlIHN3ZiB3aXRoIGFub3RoZXIgY29udGVudC5cbiAgICAgICAgICAgIC8vIEFsc28gc29tZSBmbGFzaCByZXF1aXJlcyB3cmFwcGVyIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSBGbGFzaEVtYmVkZGVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEVtYmVkZGVyLl9fVElNRU9VVCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBvbkZhaWx1cmUoZSkge1xuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEVtYmVkZGVyO1xuIiwidmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHJlcXVpcmUoJy4vZmxhc2hibG9ja25vdGlmaWVyJyk7XG52YXIgRmxhc2hFbWJlZGRlciA9IHJlcXVpcmUoJy4vZmxhc2hlbWJlZGRlcicpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xuXG52YXIgd2luU2FmYXJpID0gZGV0ZWN0LnBsYXRmb3JtLm9zID09PSAnd2luZG93cycgJiYgZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gJ3NhZmFyaSc7XG5cbnZhciBDT05UQUlORVJfQ0xBU1MgPSBcInlhLWZsYXNoLXBsYXllci13cmFwcGVyXCI7XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30YfQuNC6INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICpcbiAqIEBhbGlhcyBGbGFzaE1hbmFnZXJ+Zmxhc2hMb2FkZXJcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0g0KHRgdGL0LvQutCwINC90LAg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ30gbWluVmVyc2lvbiAtINC80LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBpZCAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGxvYWRDYWxsYmFjayAtINC60L7Qu9Cx0LXQuiDQtNC70Y8g0YHQvtCx0YvRgtC40Y8g0LfQsNCz0YDRg9C30LrQuFxuICogQHBhcmFtIHtvYmplY3R9IGZsYXNoVmFycyAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQstCw0LXQvNGL0LUg0LLQviDRhNC70LXRiFxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyIC0g0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQstC40LTQuNC80L7Qs9C+INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVYIC0g0YDQsNC30LzQtdGAINC/0L4g0LPQvtGA0LjQt9C+0L3RgtCw0LvQuFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVZIC0g0YDQsNC30LzQtdGAINC/0L4g0LLQtdGA0YLQuNC60LDQu9C4XG4gKlxuICogQHJldHVybnMge0hUTUxFbGVtZW50fSAtLSDQmtC+0L3RgtC10LnQvdC10YAg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsLCBtaW5WZXJzaW9uLCBpZCwgbG9hZENhbGxiYWNrLCBmbGFzaFZhcnMsIGNvbnRhaW5lciwgc2l6ZVgsIHNpemVZKSB7XG4gICAgdmFyICRmbGFzaFBsYXllciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgJGZsYXNoUGxheWVyLmlkID0gXCJ3cmFwcGVyX1wiICsgaWQ7XG4gICAgJGZsYXNoUGxheWVyLmlubmVySFRNTCA9ICc8ZGl2IGlkPVwiJyArIGlkICsgJ1wiPjwvZGl2Pic7XG5cbiAgICBzaXplWCA9IHNpemVYIHx8IFwiMTAwMFwiO1xuICAgIHNpemVZID0gc2l6ZVkgfHwgXCIxMDAwXCI7XG5cbiAgICB2YXIgZW1iZWRkZXIsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG9wdGlvbnM7XG5cbiAgICBpZiAoY29udGFpbmVyICYmICF3aW5TYWZhcmkpIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEVtYmVkZGVyO1xuICAgICAgICBmbGFzaFNpemVYID0gc2l6ZVg7IGZsYXNoU2l6ZVkgPSBzaXplWTtcbiAgICAgICAgb3B0aW9ucyA9IHsgYWxsb3dzY3JpcHRhY2Nlc3M6IFwiYWx3YXlzXCIsIHdtb2RlOiBcInRyYW5zcGFyZW50XCIgfTtcblxuICAgICAgICAkZmxhc2hQbGF5ZXIuY2xhc3NOYW1lID0gQ09OVEFJTkVSX0NMQVNTO1xuICAgICAgICAkZmxhc2hQbGF5ZXIuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBmbGFzaFNpemVZID0gXCIxXCI7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiAtMXB4OyB0b3A6IC0xcHg7IHdpZHRoOiAwcHg7IGhlaWdodDogMHB4OyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoJGZsYXNoUGxheWVyKTtcbiAgICB9XG5cbiAgICBlbWJlZGRlci5lbWJlZFNXRihcbiAgICAgICAgdXJsLFxuICAgICAgICBpZCxcbiAgICAgICAgZmxhc2hTaXplWCxcbiAgICAgICAgZmxhc2hTaXplWSxcbiAgICAgICAgbWluVmVyc2lvbixcbiAgICAgICAgXCJcIixcbiAgICAgICAgZmxhc2hWYXJzLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB7fSxcbiAgICAgICAgbG9hZENhbGxiYWNrXG4gICAgKTtcblxuICAgIHJldHVybiAkZmxhc2hQbGF5ZXI7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbNjAsIDE3MCwgMzEwLCA2MDAsIDEwMDAsIDMwMDAsIDYwMDAsIDEyMDAwLCAxNDAwMCwgMTYwMDBdO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZGVmYXVsdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2xhc3NpY2FsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0wLjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0zLjUsIC0zLjUsIC0zLjUsIC00LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJDbHViXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjM1OTk5OTg5NTA5NTgyNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgNCwgMi41LCAyLjUsIDIuNSwgMS41LCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRGFuY2VcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuMTU5OTk5ODQ3NDEyMTA5NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNC41LCAzLjUsIDEsIC0wLjUsIC0wLjUsIC0yLjUsIC0zLjUsIC0zLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIEJhc3NcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgNC41LCA0LjUsIDIuNSwgMC41LCAtMiwgLTQsIC01LCAtNS41LCAtNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzICYgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAyLjUsIC0wLjUsIC0zLjUsIC0yLCAwLjUsIDQsIDUuNSwgNiwgNl1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC02LFxuICAgICAgICBcImJhbmRzXCI6IFstNC41LCAtNC41LCAtNC41LCAtMiwgMSwgNS41LCA4LCA4LCA4LCA4XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGFwdG9wIFNwZWFrZXJzIC8gSGVhZHBob25lXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00LjA3OTk5OTkyMzcwNjA1NSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgNS41LCAyLjUsIC0xLjUsIC0xLCAwLjUsIDIsIDQuNSwgNiwgN11cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcmdlIEhhbGxcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNSwgNSwgMi41LCAyLjUsIC0wLjUsIC0yLCAtMiwgLTIsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMaXZlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWy0yLCAtMC41LCAyLCAyLjUsIDIuNSwgMi41LCAyLCAxLCAxLCAxXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUGFydHlcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAzLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIDMuNSwgMy41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUG9wXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjExOTk5OTg4NTU1OTA4MixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgMiwgMy41LCA0LCAyLjUsIC0wLjUsIC0xLCAtMSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlJlZ2dhZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0yLjUsIC0wLjUsIDMsIDMsIC0wLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMiwgLTIuNSwgLTQsIC0xLjUsIDIsIDQsIDUuNSwgNS41LCA1LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTa2FcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuNTE5OTk5OTgwOTI2NTE0LFxuICAgICAgICBcImJhbmRzXCI6IFstMSwgLTIsIC0yLCAtMC41LCAyLCAyLjUsIDQsIDQuNSwgNS41LCA0LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00Ljc5OTk5OTcxMzg5NzcwNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMC41LCAtMC41LCAtMSwgLTAuNSwgMiwgNCwgNC41LCA1LjUsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0IFJvY2tcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMiwgMSwgLTAuNSwgLTIsIC0yLjUsIC0xLjUsIC0wLjUsIDEsIDRdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJUZWNobm9cIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuODM5OTk5OTE0MTY5MzExNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMi41LCAtMC41LCAtMi41LCAtMiwgLTAuNSwgNCwgNC41LCA0LjUsIDRdXG4gICAgfVxuXTtcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi8uLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRXF1YWxpemVyU3RhdGljID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXItc3RhdGljJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC30L3QsNGH0LXQvdC40Y8g0YPRgdC40LvQtdC90LjRjyAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kI2NoYW5nZVxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0g0L3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1XG4gKi9cblxuLyoqXG4gKiDQn9C+0LvQvtGB0LAg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmRcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqXG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiBXZWIgQXVkaW8gQVBJXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtINGC0LjQvyDRhNC40LvRjNGC0YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXF1ZW5jeSAtINGH0LDRgdGC0L7RgtCwINGE0LjQu9GM0YLRgNCwXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kI2NoYW5nZVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyQmFuZCA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgdHlwZSwgZnJlcXVlbmN5KSB7XG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgdGhpcy5maWx0ZXIgPSBhdWRpb0NvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgdGhpcy5maWx0ZXIudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5maWx0ZXIuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5O1xuICAgIHRoaXMuZmlsdGVyLlEudmFsdWUgPSAxO1xuICAgIHRoaXMuZmlsdGVyLmdhaW4udmFsdWUgPSAwO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXJCYW5kKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INC90LDRgdGC0YDQvtC50LrQsNC80LhcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGH0LDRgdGC0L7RgtGDINC/0L7Qu9C+0YHRiyDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5nZXRGcmVxID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyLmZyZXF1ZW5jeS52YWx1ZTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9C90LDRh9C10L3QuNC1INGD0YHQuNC70LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyLmdhaW4udmFsdWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICogQHBhcmFtIHZhbHVlXG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKEVxdWFsaXplclN0YXRpYy5FVkVOVF9DSEFOR0UsIHZhbHVlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyQmFuZDtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBFcXVhbGl6ZXJTdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSB7fTtcblxuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCovXG5FcXVhbGl6ZXJTdGF0aWMuRVZFTlRfQ0hBTkdFID0gXCJjaGFuZ2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhbGl6ZXJTdGF0aWM7XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vLi4vbGliL2RhdGEvbWVyZ2UnKTtcblxudmFyIEVxdWFsaXplclN0YXRpYyA9IHJlcXVpcmUoJy4vZXF1YWxpemVyLXN0YXRpYycpO1xudmFyIEVxdWFsaXplckJhbmQgPSByZXF1aXJlKCcuL2VxdWFsaXplci1iYW5kJyk7XG5cbi8qKlxuICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6INGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXRcbiAqXG4gKiBAcHJvcGVydHkge1N0cmluZ30gW2lkXSAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90LDRgdGC0YDQvtC10LpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAgLSDQv9GA0LXQtNGD0YHQuNC70LjRgtC10LvRjFxuICogQHByb3BlcnR5IHtBcnJheS48TnVtYmVyPn0gYmFuZHMgLSDQt9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxIC0g0YfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0K3QutCy0LDQu9Cw0LnQt9C10YBcbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IGJhbmRzIC0g0YHQv9C40YHQvtC6INGH0LDRgdGC0L7RgiDQtNC70Y8g0L/QvtC70L7RgSDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKiBAbWl4ZXMgRXF1YWxpemVyU3RhdGljXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplciA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgYmFuZHMpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlYW1wID0gbmV3IEVxdWFsaXplckJhbmQoYXVkaW9Db250ZXh0LCBcImhpZ2hzaGVsZlwiLCAwKTtcbiAgICB0aGlzLnByZWFtcC5vbihcIipcIiwgdGhpcy5fb25CYW5kRXZlbnQuYmluZCh0aGlzLCB0aGlzLnByZWFtcCkpO1xuXG4gICAgYmFuZHMgPSBiYW5kcyB8fCBFcXVhbGl6ZXIuREVGQVVMVF9CQU5EUztcblxuICAgIHZhciBwcmV2O1xuICAgIHRoaXMuYmFuZHMgPSBiYW5kcy5tYXAoZnVuY3Rpb24oZnJlcXVlbmN5LCBpZHgpIHtcbiAgICAgICAgdmFyIGJhbmQgPSBuZXcgRXF1YWxpemVyQmFuZChcbiAgICAgICAgICAgIGF1ZGlvQ29udGV4dCxcblxuICAgICAgICAgICAgaWR4ID09IDAgPyAnbG93c2hlbGYnXG4gICAgICAgICAgICAgICAgOiBpZHggKyAxIDwgYmFuZHMubGVuZ3RoID8gXCJwZWFraW5nXCJcbiAgICAgICAgICAgICAgICA6IFwiaGlnaHNoZWxmXCIsXG5cbiAgICAgICAgICAgIGZyZXF1ZW5jeVxuICAgICAgICApO1xuICAgICAgICBiYW5kLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIGJhbmQpKTtcblxuICAgICAgICBpZiAoIXByZXYpIHtcbiAgICAgICAgICAgIHRoaXMucHJlYW1wLmZpbHRlci5jb25uZWN0KGJhbmQuZmlsdGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByZXYuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJldiA9IGJhbmQ7XG4gICAgICAgIHJldHVybiBiYW5kO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLmlucHV0ID0gdGhpcy5wcmVhbXAuZmlsdGVyO1xuICAgIHRoaXMub3V0cHV0ID0gdGhpcy5iYW5kc1t0aGlzLmJhbmRzLmxlbmd0aCAtIDFdLmZpbHRlcjtcbn07XG5FdmVudHMubWl4aW4oRXF1YWxpemVyKTtcbm1lcmdlKEVxdWFsaXplciwgRXF1YWxpemVyU3RhdGljLCB0cnVlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgdGC0YDQvtC50LrQuCDQv9C+LdGD0LzQvtC70YfQsNC90LjRjlxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCd0LDQsdC+0YAg0YfQsNGB0YLQvtGCINGN0LrQstCw0LvQsNC50LfQtdGA0LAg0L/RgNC40LzQtdC90Y/RjtGJ0LjQudGB0Y8g0L/Qvi3Rg9C80L7Qu9GH0LDQvdC40Y5cbiAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAqIEBjb25zdFxuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9CQU5EUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5iYW5kcy5qcycpO1xuXG4vKipcbiAqINCd0LDQsdC+0YAg0YDQsNGB0L/RgNC+0YHRgtGA0LDQvdGR0L3QvdGL0YUg0L/RgNC10YHQtdGC0L7QsiDRjdC60LLQsNC70LDQudC30LXRgNCwINC00LvRjyDQvdCw0LHQvtGA0LAg0YfQsNGB0YLQvtGCINC/0L4t0YPQvNC+0LvRh9Cw0L3QuNGOLlxuICogQHR5cGUge09iamVjdC48U3RyaW5nLCB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyUHJlc2V0Pn1cbiAqIEBjb25zdFxuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9QUkVTRVRTID0gcmVxdWlyZSgnLi9kZWZhdWx0LnByZXNldHMuanMnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvQvtGB0Ysg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHBhcmFtIHtFcXVhbGl6ZXJCYW5kfSBiYW5kIC0g0L/QvtC70L7RgdCwINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuX29uQmFuZEV2ZW50ID0gZnVuY3Rpb24oYmFuZCwgZXZlbnQsIGRhdGEpIHtcbiAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGJhbmQuZ2V0RnJlcSgpLCBkYXRhKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQl9Cw0LPRgNGD0LfQutCwINC4INGB0L7RhdGA0LDQvdC10L3QuNC1INC90LDRgdGC0YDQvtC10LpcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQl9Cw0LPRgNGD0LfQuNGC0Ywg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9IHByZXNldCAtINC90LDRgdGC0YDQvtC50LrQuFxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmxvYWRQcmVzZXQgPSBmdW5jdGlvbihwcmVzZXQpIHtcbiAgICBwcmVzZXQuYmFuZHMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgIHRoaXMuYmFuZHNbaWR4XS5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnByZWFtcC5zZXRWYWx1ZShwcmVzZXQucHJlYW1wKTtcbn07XG5cbi8qKlxuICog0KHQvtGF0YDQsNC90LjRgtGMINGC0LXQutGD0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICogQHJldHVybnMge3lhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuc2F2ZVByZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByZWFtcDogdGhpcy5wcmVhbXAuZ2V0VmFsdWUoKSxcbiAgICAgICAgYmFuZHM6IHRoaXMuYmFuZHMubWFwKGZ1bmN0aW9uKGJhbmQpIHsgcmV0dXJuIGJhbmQuZ2V0VmFsdWUoKTsgfSlcbiAgICB9O1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LDRgtC10LzQsNGC0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vVE9ETzog0L/RgNC+0LLQtdGA0LjRgtGMINC/0YDQtdC00L/QvtC70L7QttC10L3QuNC1ICjRgdC60L7RgNC10LUg0LLRgdC10LPQviDQvdGD0LbQvdCwINC60LDRgNGC0LAg0LLQtdGB0L7QsiDQtNC70Y8g0YDQsNC30LvQuNGH0L3Ri9GFINGH0LDRgdGC0L7RgiDQuNC70Lgg0LTQsNC20LUg0L3QtdC60LDRjyDRhNGD0L3QutGG0LjRjylcbi8qKlxuICogKirQrdC60YHQv9C10YDQuNC80LXQvdGC0LDQu9GM0L3QvioqIC0g0LLRi9GH0LjQu9GP0LXRgiDQvtC/0YLQuNC80LDQu9GM0L3QvtC1INC30L3QsNGH0L3QuNC1INC/0YDQtdC00YPRgdC40LvQtdC90LjRj1xuICogQGV4cGVyaW1lbnRhbFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5ndWVzc1ByZWFtcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2ID0gMDtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IHRoaXMuYmFuZHMubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIHYgKz0gdGhpcy5iYW5kc1trXS5nZXRWYWx1ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiAtdiAvIDI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVxdWFsaXplcjtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXIgPSByZXF1aXJlKCcuL2VxdWFsaXplcicpO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLm11c2ljLkF1ZGlvLmZ4ID0ge307XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEubXVzaWMuQXVkaW8uZngudm9sdW1lTGliID0gcmVxdWlyZSgnLi92b2x1bWUtbGliJyk7XG4iLCIvKipcbiAqINCc0LXRgtC+0LTRiyDQutC+0L3QstC10YDRgtCw0YbQuNC4INC30L3QsNGH0LXQvdC40Lkg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAbmFtZXNwYWNlXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uZngudm9sdW1lTGliXG4gKi9cbnZhciB2b2x1bWVMaWIgPSB7fTtcblxuLyoqXG4gKiDQnNC40L3QuNC80LDQu9GM0L3QvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0YDQuCDQutC+0YLQvtGA0L7QvCDQv9GA0L7QuNGB0YXQvtC00LjRgiDQvtGC0LrQu9GO0YfQtdC90LjQtSDQt9Cy0YPQutCwLlxuICog0J7Qs9GA0LDQvdC40YfQtdC90LjQtSDQsiAwLjAwMSDQv9C+0LTQvtCx0YDQsNC90L4g0Y3QvNC/0LjRgNC40YfQtdGB0LrQuCDQuCDQvdC1INCz0L7QtNC40YLRgdGPINC00LvRjyDRiNC60LDQu9GLINGDINC60L7RgtC+0YDQvtC5INGA0LDQt9GA0LXRiNC10L3RiyDQt9C90LDRh9C10L3QuNGPINCx0L7Qu9GM0YjQtSAxLlxuICogQHR5cGUge251bWJlcn1cbiAqL1xudm9sdW1lTGliLkVQU0lMT04gPSAwLjAwMTtcblxuLyoqXG4gKiDQmtC+0Y3RhNC40YbQuNC10L3RgiDQtNC70Y8g0L/RgNC10L7QsdGA0LDQt9C+0LLQsNC90LjQuSDQs9GA0L7QvNC60L7RgdGC0Lgg0LjQtyDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7QuSDRiNC60LDQu9GLINCyINC00LXRhtC40LHQtdC70YtcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG52b2x1bWVMaWIuX0RCRlNfQ09FRiA9IDIwIC8gTWF0aC5sb2coMTApO1xuXG4vKipcbiAqINCS0YvRh9C40YHQu9C10L3QuNC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0L4g0LfQvdCw0YfQtdC90LjRjiDQvdCwINC70L7Qs9Cw0YDQuNGE0LzQuNGH0LXRgdC60L7QuSDRiNC60LDQu9C1XG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSDQt9C90LDRh9C10L3QuNC1INC90LAg0YjQutCw0LvQtVxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xudm9sdW1lTGliLnRvRXhwb25lbnQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciB2b2x1bWUgPSBNYXRoLnBvdyh2b2x1bWVMaWIuRVBTSUxPTiwgMSAtIHZhbHVlKTtcbiAgICByZXR1cm4gdm9sdW1lID4gdm9sdW1lTGliLkVQU0lMT04gPyB2b2x1bWUgOiAwO1xufTtcblxuLyoqXG4gKiDQktGL0YfQuNGB0LvQtdC90LjQtSDQt9C90LDRh9C10L3QuNGPINC/0L7Qu9C+0LbQtdC90LjRjyDQvdCwINC70L7Qs9Cw0YDQuNGE0LzQuNGH0LXRgdC60L7QuSDRiNC60LDQu9C1INC/0L4g0LfQvdCw0YfQtdC90LjRjiDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbnZvbHVtZUxpYi5mcm9tRXhwb25lbnQgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICByZXR1cm4gMSAtIE1hdGgubG9nKE1hdGgubWF4KHZvbHVtZSwgdm9sdW1lTGliLkVQU0lMT04pKSAvIE1hdGgubG9nKHZvbHVtZUxpYi5FUFNJTE9OKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC30L3QsNGH0LXQvdC40Y8gZEJGUyDQuNC3INC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtCz0L4g0LfQvdCw0YfQtdC90LjRjyDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQvtGC0L3QvtGB0LjRgtC10LvRjNC90LDRjyDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbnZvbHVtZUxpYi50b0RCRlMgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICByZXR1cm4gTWF0aC5sb2codm9sdW1lKSAqIHZvbHVtZUxpYi5fREJGU19DT0VGO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LfQvdCw0YfQtdC90LjRjyDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7QuSDQs9GA0L7QvNC60L7RgdGC0Lgg0LjQtyDQt9C90LDRh9C10L3QuNGPIGRCRlNcbiAqIEBwYXJhbSB7TnVtYmVyfSBkYmZzIC0g0LPRgNC+0LzQutC+0YHRgtGMINCyIGRCRlNcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbnZvbHVtZUxpYi5mcm9tREJGUyA9IGZ1bmN0aW9uKGRiZnMpIHtcbiAgICByZXR1cm4gTWF0aC5leHAoZGJmcyAvIHZvbHVtZUxpYi5fREJGU19DT0VGKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdm9sdW1lTGliO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1TG9hZGVyJyk7XG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4uL2F1ZGlvLXN0YXRpYycpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9wbGF5YmFjay1lcnJvcicpO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9saWIvbm9vcCcpO1xuXG52YXIgbG9hZGVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J7QsdGR0YDRgtC60LAg0LTQu9GPINC90LDRgtC40LLQvdC+0LPQviDQutC70LDRgdGB0LAgQXVkaW9cbiAqIEBleHRlbmRzIEV2ZW50c1xuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBsb2FkZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgLyoqXG4gICAgICog0JrQvtC90YLQtdC50L3QtdGAINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0L7QttC40LTQsNC90LjQuSDRgdC+0LHRi9GC0LjQuVxuICAgICAqIEB0eXBlIHtPYmplY3QuPFN0cmluZywgRGVmZXJyZWQ+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5wcm9taXNlcyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICog0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5zcmMgPSBcIlwiO1xuICAgIC8qKlxuICAgICAqINCd0LDQt9C90LDRh9C10L3QvdCw0Y8g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuXG4gICAgLyoqXG4gICAgICog0JLRgNC10LzRjyDQv9C+0YHQu9C10LTQvdC10LPQviDQvtCx0L3QvtCy0LvQtdC90LjRjyDQtNCw0L3QvdGL0YVcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5sYXN0VXBkYXRlID0gMDtcblxuICAgIC8qKlxuICAgICAqINCk0LvQsNCzINC90LDRh9Cw0LvQsCDQt9Cw0LPRgNGD0LfQutC4XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLm5vdExvYWRpbmcgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICog0JLRi9GF0L7QtCDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuICAgICAqIEB0eXBlIHtBdWRpb05vZGV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLm91dHB1dCA9IG51bGw7XG5cbiAgICAvLy0tLSDQodCw0YXQsNGAINC00LvRjyDQt9Cw0YnQuNGC0Ysg0L7RgiDRg9GC0LXRh9C10Log0L/QsNC80Y/RgtC4XG4gICAgdGhpcy5fX3N0YXJ0UGxheSA9IHRoaXMuX3N0YXJ0UGxheS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19yZXN0YXJ0ID0gdGhpcy5fcmVzdGFydC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19zdGFydHVwQXVkaW8gPSB0aGlzLl9zdGFydHVwQXVkaW8uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX191cGRhdGVQcm9ncmVzcyA9IHRoaXMuX3VwZGF0ZVByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlTG9hZGluZyA9IHRoaXMuX29uTmF0aXZlTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZUVuZGVkID0gdGhpcy5fb25OYXRpdmVFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZUVycm9yID0gdGhpcy5fb25OYXRpdmVFcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZVBhdXNlID0gdGhpcy5fb25OYXRpdmVQYXVzZS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX29uTmF0aXZlUGxheSA9IHRoaXMudHJpZ2dlci5iaW5kKHRoaXMsIEF1ZGlvU3RhdGljLkVWRU5UX1BMQVkpO1xuXG4gICAgdGhpcy5faW5pdEF1ZGlvKCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvSFRNTDVMb2FkZXIpO1xuXG4vKipcbiAqINCY0L3RgtC10YDQstCw0Lsg0L7QsdC90L7QstC70LXQvdC40Y8g0YLQsNC50LzQuNC90LPQvtCyINGC0YDQtdC60LBcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3VwZGF0ZUludGVydmFsID0gMzA7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQndCw0YLQuNCy0L3Ri9C1INGB0L7QsdGL0YLQuNGPIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVkgPSBcInBsYXlcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC/0LDRg9C30YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UgPSBcInBhdXNlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjQtSDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSA9IFwidGltZXVwZGF0ZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FTkRFRCA9IFwiZW5kZWRcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04gPSBcImR1cmF0aW9uY2hhbmdlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4INC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HID0gXCJwcm9ncmVzc1wiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCDQvNC10YLQsC3QtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBID0gXCJsb2FkZWRtZXRhZGF0YVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvdCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVkgPSBcImNhbnBsYXlcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiA9IFwiZXJyb3JcIjtcblxuLyoqXG4gKiDQl9Cw0LPQu9GD0YjQutCwINC00LvRjyBfX2luaXRMaXN0ZW5lcifQsCDQvdCwINCy0YDQtdC80Y8g0L7QttC40LTQsNC90LjRjyDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXIgPSBmdW5jdGlvbigpIHt9O1xuQXVkaW9IVE1MNUxvYWRlci5fZGVmYXVsdEluaXRMaXN0ZW5lci5zdGVwID0gXCJ1c2VyXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntCx0YDQsNCx0L7RgtGH0LjQutC4INGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0L7QsdC90L7QstC70LXQvdC40Y8g0YLQsNC50LzQuNC90LPQvtCyINGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl91cGRhdGVQcm9ncmVzcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJyZW50VGltZSA9ICtuZXcgRGF0ZSgpO1xuICAgIGlmIChjdXJyZW50VGltZSAtIHRoaXMubGFzdFVwZGF0ZSA8IEF1ZGlvSFRNTDVMb2FkZXIuX3VwZGF0ZUludGVydmFsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxhc3RVcGRhdGUgPSBjdXJyZW50VGltZTtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZUxvYWRpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl91cGRhdGVQcm9ncmVzcygpO1xuXG4gICAgaWYgKHRoaXMuYXVkaW8uYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgIHZhciBsb2FkZWQgPSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmVuZCgwKSAtIHRoaXMuYXVkaW8uYnVmZmVyZWQuc3RhcnQoMCk7XG5cbiAgICAgICAgaWYgKHRoaXMubm90TG9hZGluZyAmJiBsb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMubm90TG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0xPQURJTkcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvYWRlZCA+PSB0aGlzLmF1ZGlvLmR1cmF0aW9uIC0gMC4xKSB7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfTE9BREVEKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8g0L7QutC+0L3Rh9Cw0L3QuNGPINGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZUVuZGVkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKTtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfRU5ERUQpO1xuICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQvtC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtFdmVudH0gZSAtINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlRXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgaWYgKCF0aGlzLnNyYykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGVycm9yID0gbmV3IFBsYXliYWNrRXJyb3IodGhpcy5hdWRpby5lcnJvclxuICAgICAgICAgICAgPyBQbGF5YmFja0Vycm9yLmh0bWw1W3RoaXMuYXVkaW8uZXJyb3IuY29kZV1cbiAgICAgICAgICAgIDogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogZSxcbiAgICAgICAgdGhpcy5zcmMpO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SLCBlcnJvcik7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC/0LDRg9C30YtcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZVBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmVuZGVkKSB7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSk7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC4INC00LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQuNGFINGB0L7QsdGL0YLQuNC5INC00LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9pbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCU0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRgdC70YPRiNCw0YLQtdC70LXQuSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60LjRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXROYXRpdmVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19vbk5hdGl2ZVBhdXNlKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX29uTmF0aXZlUGxheSk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VOREVELCB0aGlzLl9fb25OYXRpdmVFbmRlZCk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUsIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0RVUkFUSU9OLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HLCB0aGlzLl9fb25OYXRpdmVMb2FkaW5nKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19vbk5hdGl2ZUVycm9yKTtcbn07XG5cbi8qKlxuICog0JTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2RlaW5pdE5hdGl2ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvINC4INC90LDQt9C90LDRh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXRBdWRpbyA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9pbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XG4gICAgdGhpcy5hdWRpby5sb29wID0gZmFsc2U7IC8vIGZvciBJRVxuICAgIHRoaXMuYXVkaW8ucHJlbG9hZCA9IHRoaXMuYXVkaW8uYXV0b2J1ZmZlciA9IFwiYXV0b1wiOyAvLyAxMDAlXG4gICAgdGhpcy5hdWRpby5hdXRvcGxheSA9IGZhbHNlO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gXCJcIjtcblxuICAgIHRoaXMuX2luaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IEF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXI7XG5cbiAgICB0aGlzLl9pbml0TmF0aXZlRXZlbnRzKCk7XG59O1xuXG4vKipcbiAqINCe0YLQutC70Y7Rh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuSDQuCDRg9C00LDQu9C10L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0QXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfZGVpbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcbiAgICB0aGlzLl9kZWluaXROYXRpdmVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBudWxsO1xufTtcblxuLyoqXG4gKiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQvtCx0YrQtdC60YLQsCBBdWRpby4g0JTQu9GPINC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LHRg9C10YLRgdGPINC70Y7QsdC+0LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LUg0LTQtdC50YHRgtCy0LjQtS5cbiAqXG4gKiDQodC+0LLQtdGA0YjQtdC90L3QviDRjdC30L7RgtC10YDQuNGH0L3Ri9C5INC4INC80LDQs9C40YfQtdGB0LrQuNC5INC80LXRgtC+0LQuINCU0LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAg0YLRgNC10LHRg9C10YLRgdGPINCy0YvQt9GL0LLQsNGC0Ywg0LzQtdGC0L7QtCBwbGF5INCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LVcbiAqINC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8uINCf0L7RgdC70LUg0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/QvtGB0YLQsNCy0LjRgtGMINC/0LvQtdC10YAg0L7QsdGA0LDRgtC90L4g0L3QsCDQv9Cw0YPQt9GDLCDRgi7Qui4g0L3QtdC60L7RgtC+0YDRi9C1INCx0YDQsNGD0LfQtdGA0YtcbiAqINCyINC/0YDQvtGC0LjQstC90L7QvCDRgdC70YPRh9Cw0LUg0L3QsNGH0LjQvdCw0Y7RgiDQv9GA0L7QuNCz0YDRi9Cy0LDRgtGMINGC0YDQtdC6INCw0LLRgtC+0LzQsNGC0LjRh9C10YHQutC4INC60LDQuiDRgtC+0LvRjNC60L4g0L7QvSDQt9Cw0LPRgNGD0LbQsNC10YLRgdGPLiDQn9GA0Lgg0Y3RgtC+0Lwg0LIg0L3QtdC60L7RgtC+0YDRi9GFINCx0YDQsNGD0LfQtdGA0LDRhVxuICog0L/QvtGB0LvQtSDQstGL0LfQvtCy0LAg0LzQtdGC0L7QtNCwIGxvYWQg0YHQvtCx0YvRgtC40LUgcGxheSDQvdC40LrQvtCz0LTQsCDQvdC1INC90LDRgdGC0YPQv9Cw0LXRgiwg0YLQsNC6INGH0YLQviDQv9GA0LjRhdC+0LTQuNGC0YHRjyDRgdC70YPRiNCw0YLRjCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqINC40LvQuCDQvtGI0LjQsdC60Lgg0LfQsNCz0YDRg9C30LrQuCAo0LXRgdC70Lggc3JjINC90LUg0YPQutCw0LfQsNC9KS4g0JIg0L3QtdC60L7RgtC+0YDRi9GFINCx0YDQsNGD0LfQtdGA0LDRhSDRgtCw0LrQttC1INC80L7QttC10YIg0L3QtSDQvdCw0YHRgtGD0L/QuNGC0Ywg0YHQvtCx0YvRgtC40LUgcGF1c2UuINCf0YDQuCDRjdGC0L7QvFxuICog0YHRgtC+0LjRgiDQtdGJ0ZEg0YPRh9C40YLRi9Cy0LDRgtGMLCDRh9GC0L4g0YLRgNC10Log0LzQvtC20LXRgiDQs9GA0YPQt9C40YLRjNGB0Y8g0LjQtyDQutC10YjQsCwg0YLQvtCz0LTQsCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LAt0LTQsNC90L3Ri9GFINC4INCy0L7Qt9C80L7QttC90L7RgdGC0LhcbiAqINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQvNC+0LPRg9GCINCy0L7Qt9C90LjQutC90YPRgtGMINCx0YvRgdGC0YDQtdC1INGB0L7QsdGL0YLQuNGPIHBsYXkg0LjQu9C4IHBhdXNlLCDRgtCw0Log0YfRgtC+INC90YPQttC90L4g0L/RgNC10LTRg9GB0LzQsNGC0YDQuNCy0LDRgtGMINC/0YDQtdGA0YvQstCw0L3QuNC1INC/0YDQvtGG0LXRgdGB0LBcbiAqINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3N0YXJ0dXBBdWRpbyA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX3N0YXJ0dXBBdWRpb1wiKTtcblxuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcblxuICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQvtC90L3QvtCz0L4g0LLRi9C30L7QstCwIHBsYXkg0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8g0Lgg0LLRi9C30LLQsNGC0YwgcGF1c2UuXG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQstGL0LfQvtCy0LAgcGF1c2Ug0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8sINC30LDQstC10YDRiNC40YLRjCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjiDQuCDRgNCw0LfRgNC10YjQuNGC0Ywg0L/QtdGA0LXQtNCw0YfRgyDRgdC+0LHRi9GC0LjQuVxuICAgICAgICB0aGlzLl9faW5pdExpc3RlbmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX19pbml0TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fX2luaXRMaXN0ZW5lcjtcbiAgICAgICAgICAgIHRoaXMudW5tdXRlRXZlbnRzKCk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW86cmVhZHlcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwID0gXCJwYXVzZVwiO1xuXG4gICAgICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcblxuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW86cGxheVwiLCBlLnR5cGUpO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgICB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAgPSBcInBsYXlcIjtcblxuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG5cbiAgICAvL0lORk86INC/0LXRgNC10LQg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40LXQvCDQvtCx0YrQtdC60YIgQXVkaW8g0YLRgNC10LHRg9C10YLRgdGPINC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMLCDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y9cbiAgICB0aGlzLmF1ZGlvLmxvYWQoKTtcbiAgICB0aGlzLmF1ZGlvLnBsYXkoKTtcbn07XG5cbi8qKlxuICog0JXRgdC70Lgg0LzQtdGC0L7QtCBfc3RhcnRQbGF5INCy0YvQt9Cy0LDQvSDRgNCw0L3RjNGI0LUsINGH0LXQvCDQt9Cw0LrQvtC90YfQuNC70LDRgdGMINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPLCDQvdGD0LbQvdC+INC+0YLQvNC10L3QuNGC0Ywg0YLQtdC60YPRidC40Lkg0YjQsNCzINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2JyZWFrU3RhcnR1cCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcbiAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuXG4gICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiX3N0YXJ0dXBBdWRpbzppbnRlcnJ1cHRlZFwiLCB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsIHJlYXNvbik7XG4gICAgZGVsZXRlIHRoaXMuX19pbml0TGlzdGVuZXI7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQtdGC0L7QtNGLINC+0LbQuNC00LDQvdC40Y8g0YDQsNC30LvQuNGH0L3Ri9GFINGB0L7QsdGL0YLQuNC5INC4INCz0LXQvdC10YDQsNGG0LjQuCDQvtCx0LXRidCw0L3QuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQvtC20LTQsNGC0YzRgdGPINC+0L/RgNC10LTQtdC70ZHQvdC90L7Qs9C+INGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0g0LjQvNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hlY2sgLSDQvNC10YLQvtC0INC/0YDQvtCy0LXRgNC60LgsINGH0YLQviDQvNGLINC90LDRhdC+0LTQuNC80YHRjyDQsiDQvdGD0LbQvdC+0Lwg0YHQvtGB0YLQvtGP0L3QuNC4XG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBsaXN0ZW4gLSDRgdC/0LjRgdC+0Log0YHQvtCx0YvRgtC40LksINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQtdGCINGB0LzQtdC90LjRgtGM0YHRjyDRgdC+0YHRgtC+0Y/QvdC40LVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3dhaXRGb3IgPSBmdW5jdGlvbihuYW1lLCBjaGVjaywgbGlzdGVuKSB7XG4gICAgaWYgKCF0aGlzLnByb21pc2VzW25hbWVdKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLnByb21pc2VzW25hbWVdID0gZGVmZXJyZWQ7XG5cbiAgICAgICAgaWYgKGNoZWNrLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChjaGVjay5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBjbGVhckxpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3Rlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFyTGlzdGVuZXJzLCBjbGVhckxpc3RlbmVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tuYW1lXS5wcm9taXNlKCk7XG59O1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQvtC20LjQtNCw0L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSDQuNC80Y8g0YHQvtGB0YLQvtGP0L3QuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC+0LbQuNC00LDQvdC40Y9cbiAqIEB0b2RvIHJlYXNvbiDRgdC00LXQu9Cw0YLRjCDQvdCw0YHQu9C10LTQvdC40LrQvtC8INC60LvQsNGB0YHQsCBFcnJvclxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2NhbmNlbFdhaXQgPSBmdW5jdGlvbihuYW1lLCByZWFzb24pIHtcbiAgICB2YXIgcHJvbWlzZTtcbiAgICBpZiAocHJvbWlzZSA9IHRoaXMucHJvbWlzZXNbbmFtZV0pIHtcbiAgICAgICAgZGVsZXRlIHRoaXMucHJvbWlzZXNbbmFtZV07XG4gICAgICAgIHByb21pc2UucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LLRgdC10YUg0L7QttC40LTQsNC90LjQuVxuICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvbiAtINC/0YDQuNGH0LjQvdCwINC+0YLQvNC10L3RiyDQvtC20LjQtNCw0L3QuNGPXG4gKiBAdG9kbyByZWFzb24g0YHQtNC10LvQsNGC0Ywg0L3QsNGB0LvQtdC00L3QuNC60L7QvCDQutC70LDRgdGB0LAgRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9hYm9ydFByb21pc2VzID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMucHJvbWlzZXMpIHtcbiAgICAgICAgaWYgKHRoaXMucHJvbWlzZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChrZXksIHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LPQvtGC0L7QstC90L7RgdGC0Lgg0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VNZXRhZGF0YUV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCBBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5yZWFkeVN0YXRlID4gdGhpcy5hdWRpby5IQVZFX01FVEFEQVRBO1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dhaXRGb3IoXCJtZXRhZGF0YVwiLCB0aGlzLl9wcm9taXNlTWV0YWRhdGFDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZU1ldGFkYXRhRXZlbnRzKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC30LDQs9GA0YPQt9C60Lgg0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZUxvYWRlZEV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0LfQsNCz0YDRg9C20LXQvdCwINC90YPQttC90LDRjyDRh9Cw0YHRgtGMINGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWRDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX19sb2FkZXJUaW1lciA9IHRoaXMuX19sb2FkZXJUaW1lciAmJiBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRlclRpbWVyKSB8fCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcImxvYWRlZFwiLCBcInRpbWVvdXRcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgNTAwMCk7XG5cbiAgICAvL0lORk86INC/0L7Qt9C40YbQuNGOINC90YPQttC90L4g0LHRgNCw0YLRjCDRgSDQsdC+0LvRjNGI0LjQvCDQt9Cw0L/QsNGB0L7QvCwg0YIu0LouINC00LDQvdC90YvQtSDQt9Cw0L/QuNGB0LDQvdGLINCx0LvQvtC60LDQvNC4INC4INC90LDQvCDQvdGD0LbQvdC+INC00L7QttC00LDRgtGM0YHRjyDQt9Cw0LPRgNGD0LfQutC4INCx0LvQvtC60LBcbiAgICB2YXIgbG9hZGVkID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDQ1LCB0aGlzLmF1ZGlvLmR1cmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5idWZmZXJlZC5sZW5ndGhcbiAgICAgICAgJiYgdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApID49IGxvYWRlZDtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRGb3IoXCJsb2FkZWRcIiwgdGhpcy5fcHJvbWlzZUxvYWRlZENoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTG9hZGVkRXZlbnRzKTtcblxuICAgIGlmICghcHJvbWlzZS5jbGVhblRpbWVyKSB7XG4gICAgICAgIHByb21pc2UuY2xlYW5UaW1lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fX2xvYWRlclRpbWVyID0gY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkZXJUaW1lcik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgcHJvbWlzZS50aGVuKHByb21pc2UuY2xlYW5UaW1lciwgcHJvbWlzZS5jbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC/0YDQvtC40LPRgNGL0LLQsNC90LjRjyDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5INC/0LvQtdC10YDQsCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20L3QviDQvtC20LjQtNCw0YLRjCDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QviDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlUGxheWluZ0V2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0L/RgNC+0LjQs9GA0YvQstCw0LXRgtGB0Y8g0L3Rg9C20L3QsNGPINGH0LDRgdGC0Ywg0YLRgNC10LrQsFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmdDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aW1lID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDAuMiwgdGhpcy5hdWRpby5kdXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPj0gdGltZTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcInBsYXlpbmdcIiwgdGhpcy5fcHJvbWlzZVBsYXlpbmdDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZVBsYXlpbmdFdmVudHMpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LLQtdC00LXQvdC40Y8sINC/0LXRgNC10LfQsNC/0YPRgdC6INGC0YDQtdC60LAsINC10YHQu9C4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQvdC1INC90LDRh9Cw0LvQvtGB0YxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VTdGFydFBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0gPSBkZWZlcnJlZDtcblxuICAgICAgICAvL0lORk86INC10YHQu9C4INC+0YLQvNC10L3QtdC90L4g0L7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC40LvQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8sINGC0L4g0L3Rg9C20L3QviDQvtGC0LzQtdC90LjRgtGMINC4INGN0YLQviDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgcmVhc29uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHZhciB0aW1lcjtcbiAgICAgICAgdmFyIHJlYWR5ID0gZmFsc2U7XG4gICAgICAgIHZhciBjbGVhblRpbWVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3Byb21pc2VQbGF5aW5nKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RhcnRQbGF5aW5nOnN1Y2Nlc3NcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVqZWN0KTtcblxuICAgICAgICB0aGlzLl9wcm9taXNlTG9hZGVkKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChyZWFkeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJwbGF5aW5nXCIsIFwidGltZW91dFwiKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInN0YXJ0UGxheWluZzpmYWlsZWRcIik7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIDUwMDApO1xuICAgICAgICB9LmJpbmQodGhpcyksIHJlamVjdCk7XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZVBsYXlpbmcoKS50aGVuKGNsZWFuVGltZXIsIGNsZWFuVGltZXIpO1xuICAgICAgICBkZWZlcnJlZC5wcm9taXNlKCkudGhlbihjbGVhblRpbWVyLCBjbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXS5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0Y3Qu9C10LzQtdC90YLQvtC8IEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGH0LDRgtGMINC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyY1xuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwibG9hZFwiLCBzcmMpO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImxvYWRcIik7XG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwibG9hZFwiKTtcblxuICAgIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICB0aGlzLm5vdExvYWRpbmcgPSB0cnVlO1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuXG4gICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5sb2FkKCk7XG59O1xuXG4vKiog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0b3BcIik7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwic3RvcFwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJzdG9wXCIpO1xuXG4gICAgdGhpcy5sb2FkKFwiXCIpO1xufTtcblxuLyoqXG4gKiDQndCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydFBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc3RhcnRQbGF5XCIpO1xuXG4gICAgdGhpcy5hdWRpby5jdXJyZW50VGltZSA9IHRoaXMucG9zaXRpb247XG5cbiAgICBpZiAoIXRoaXMucGxheWluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwic3RhcnRQbGF5XCIpO1xuICAgIHRoaXMuYXVkaW8ucGxheSgpO1xuXG4gICAgLy9USElOSzog0L3Rg9C20L3QviDQu9C4INGC0YDQuNCz0LPQtdGA0LjRgtGMINGB0L7QsdGL0YLQuNC1INCyINGB0LvRg9GH0LDQtSDRg9GB0L/QtdGF0LBcbiAgICB0aGlzLl9wcm9taXNlU3RhcnRQbGF5aW5nKCkudGhlbihub29wLCB0aGlzLl9fcmVzdGFydCk7XG59O1xuXG4vKipcbiAqINCf0LXRgNC10LfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gW3JlYXNvbl0gLSDQtdGB0LvQuCDQv9GA0LjRh9C40L3QsCDQstGL0LfQvtCy0LAg0YPQutCw0LfQsNC90LAg0Lgg0L3QtSDRgNCw0LLQvdCwIFwidGltZW91dFwiINC90LjRh9C10LPQviDQvdC1INC/0YDQvtC40YHRhdC+0LTQuNGCXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcmVzdGFydCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vVEhJTks6INC90YPQttC10L0g0LvQuCDRgtGD0YIg0LrQsNC60L7QuS3RgtC+INGB0YfRkdGC0LjQuiDQutC+0LvQuNGH0LXRgdGC0LLQsCDQv9C+0L/Ri9GC0L7QulxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX3Jlc3RhcnRcIiwgcmVhc29uLCB0aGlzLnBvc2l0aW9uLCB0aGlzLnBsYXlpbmcpO1xuXG4gICAgaWYgKHJlYXNvbiAmJiByZWFzb24gIT09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL0lORk86INCX0LDQv9C+0LzQuNC90LDQtdC8INGC0LXQutGD0YnQtdC1INGB0L7RgdGC0L7Rj9C90LjQtSwg0YIu0LouINC+0L3QviDRgdCx0YDQvtGB0LjRgtGB0Y8g0L/QvtGB0LvQtSDQv9C10YDQtdC30LDQs9GA0YPQt9C60LhcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgIHZhciBwbGF5aW5nID0gdGhpcy5wbGF5aW5nO1xuXG4gICAgdGhpcy5sb2FkKHRoaXMuc3JjKTtcblxuICAgIGlmIChwbGF5aW5nKSB7XG4gICAgICAgIHRoaXMucGxheShwb3NpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQktC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsC/QvtGC0LzQtdC90LAg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGxheVwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5wbGF5aW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwbGF5XCIpO1xuXG4gICAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAgIHRoaXMucGxheWluZyA9IHRydWU7XG4gICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uID09IG51bGwgPyB0aGlzLnBvc2l0aW9uIHx8IDAgOiBwb3NpdGlvbjtcbiAgICB0aGlzLl9wcm9taXNlTWV0YWRhdGEoKS50aGVuKHRoaXMuX19zdGFydFBsYXksIG5vb3ApO1xufTtcblxuLyoqINCf0LDRg9C30LAgKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgXCJwYXVzZVwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwYXVzZVwiKTtcblxuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICghaXNGaW5pdGUocG9zaXRpb24pKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0UG9zaXRpb25GYWlsZWRcIiwgcG9zaXRpb24pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXG4gICAgdGhpcy5fcHJvbWlzZU1ldGFkYXRhKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5hdWRpby5jdXJyZW50VGltZSA9IHRoaXMucG9zaXRpb247XG4gICAgfS5iaW5kKHRoaXMpLCBub29wKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LTQutC70Y7Rh9C10L3QuNC1L9C+0YLQutC70Y7Rh9C10L3QuNC1INC40YHRgtC+0YfQvdC40LrQsCDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LjRgtGMINGA0LXQttC40LwgY3Jvc3NEb21haW4g0LTQu9GPIEhUTUw1INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINCy0LrQu9GO0YfQuNGC0Ywv0LLRi9C60LvRjtGH0LjRgtGMXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpby5jcm9zc09yaWdpbiA9IFwiYW5vbnltb3VzXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVBdHRyaWJ1dGUoXCJjcm9zc09yaWdpblwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXN0YXJ0KCk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC40YHRgtC+0YfQvdC40Log0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAqICEhIdCS0L3QuNC80LDQvdC40LUhISEgLSDQv9GA0Lgg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40LggV2ViIEF1ZGlvIEFQSSDQsiDQsdGA0LDRg9C30LXRgNC1INGB0YLQvtC40YIg0YPRh9C40YLRi9Cy0LDRgtGMLCDRh9GC0L4g0LLRgdC1INGC0YDQtdC60Lgg0LTQvtC70LbQvdGLINC70LjQsdC+INC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqINGBINGC0L7Qs9C+INC20LUg0LTQvtC80LXQvdCwLCDQu9C40LHQviDQtNC70Y8g0L3QuNGFINC00L7Qu9C20L3RiyDQsdGL0YLRjCDQv9GA0LDQstC40LvRjNC90L4g0LLRi9GB0YLQsNCy0LvQtdC90Ysg0LfQsNCz0L7Qu9C+0LLQutC4IENPUlMuXG4gKiDQn9GA0Lgg0LLRi9C30L7QstC1INC00LDQvdC90L7Qs9C+INC80LXRgtC+0LTQsCDRgtGA0LXQuiDQsdGD0LTQtdGCINC/0LXRgNC10LfQsNC/0YPRidC10L1cbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuY3JlYXRlU291cmNlID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0KSB7XG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVTb3VyY2VcIik7XG5cbiAgICB2YXIgbmVlZFJlc3RhcnQgPSAhdGhpcy5hdWRpby5jcm9zc09yaWdpbjtcblxuICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgIHRoaXMub3V0cHV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZSh0aGlzLmF1ZGlvKTtcbiAgICB0aGlzLm91dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICBpZiAobmVlZFJlc3RhcnQpIHtcbiAgICAgICAgdGhpcy5fcmVzdGFydCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPQtNCw0LvQuNGC0Ywg0LjRgdGC0L7Rh9C90LjQuiDQtNC70Y8gV2ViIEF1ZGlvIEFQSS4g0KPQtNCw0LvRj9C10YIg0LjRgdGC0L7Rh9C90LjQuiwg0L/QtdGA0LXRgdC+0LfQtNCw0ZHRgiDQvtCx0YrQtdC60YIgQXVkaW8uXG4gKiAhISHQktC90LjQvNCw0L3QuNC1ISEhIC0g0JTQsNC90L3Ri9C5INC80LXRgtC+0LQg0LzQvtC20L3QviDQstGL0LfRi9Cy0LDRgtGMINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8sINGCLtC6LiDRgdCy0LXQttC10YHQvtC30LTQsNC90L3Ri9C5XG4gKiDRjdC70LXQvNC10L3RgiBBdWRpbyDQvdGD0LbQvdC+INC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMIC0g0LjQvdCw0YfQtSDQsdGD0LTQtdGCINC90LXQtNC+0YHRgtGD0L/QvdC+INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtS4g0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0Y3Qu9C10LzQtdC90YLQsFxuICogQXVkaW8g0LLQvtC30LzQvtC20L3QsCDRgtC+0LvRjNC60L4g0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPICjQutC70LjQuiwg0YLQsNGHLdGB0L7QsdGL0YLQuNC1INC40LvQuCDQutC70LDQstC40LDRgtGD0YDQvdC+0LUg0YHQvtCx0YvRgtC40LUpXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3lTb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgICAvL0lORk86INC10LTQuNC90YHRgtCy0LXQvdC90YvQuSDRgdC/0L7RgdC+0LEg0L7RgtC+0YDQstCw0YLRjCBNZWRpYUVsZW1lbnRTb3VyY2Ug0L7RgiBBdWRpbyAtINGB0L7Qt9C00LDRgtGMINC90L7QstGL0Lkg0L7QsdGK0LXQutGCIEF1ZGlvXG5cbiAgICBpZiAoIXRoaXMub3V0cHV0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIud2Fybih0aGlzLCBcImRlc3Ryb3lTb3VyY2VcIik7XG5cbiAgICB0aGlzLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImRlc3Ryb3lcIik7XG5cbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuICAgIHRoaXMuX2luaXRBdWRpbygpO1xuICAgIHRoaXMuX3N0YXJ0dXBBdWRpbygpO1xuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0LTQsNC70LXQvdC40LUg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINC4INC+0LHRitC10LrRgtCwIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQo9C00LDQu9C10L3QuNC1INCy0YHQtdGFINC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDQuCDQvtCx0YrQtdC60YLQsCBBdWRpby4g0J/QvtGB0LvQtSDQstGL0LfQvtCy0LAg0LTQsNC90L3QvtCz0L4g0LzQtdGC0L7QtNCwINGN0YLQvtGCINC+0LHRitC10LrRgiDQsdGD0LTQtdGCINC90LXQu9GM0LfRjyDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJkZXN0cm95XCIpO1xuXG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoKTtcbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fX3Jlc3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX19zdGFydFBsYXkgPSBudWxsO1xuICAgIHRoaXMucHJvbWlzZXMgPSBudWxsO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluaXQ6ICEhdGhpcy5fX2luaXRMaXN0ZW5lciAmJiB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsXG4gICAgICAgIHNyYzogdGhpcy5zcmMsXG4gICAgICAgIHBsYXlpbmc6IHRoaXMucGxheWluZyxcbiAgICAgICAgZW5kZWQ6IHRoaXMuZW5kZWQsXG4gICAgICAgIG5vdExvYWRpbmc6IHRoaXMubm90TG9hZGluZyxcbiAgICAgICAgcG9zaXRpb246IHRoaXMucG9zaXRpb25cbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0hUTUw1TG9hZGVyO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSByZXF1aXJlKCcuL2F1ZGlvLWh0bWw1LWxvYWRlcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IEhUTUw1IEF1ZGlvINC4IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0cy5hdmFpbGFibGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCR0LDQt9C+0LLQsNGPINC/0YDQvtCy0LXRgNC60LAg0L/QvtC00LTQtdGA0LbQutC4INCx0YDQsNGD0LfQtdGA0L7QvFxuICAgIHZhciBodG1sNV9hdmFpbGFibGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIC8vc29tZSBicm93c2VycyBkb2Vzbid0IHVuZGVyc3RhbmQgbmV3IEF1ZGlvKClcbiAgICAgICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICAgICAgdmFyIGNhblBsYXkgPSBhdWRpby5jYW5QbGF5VHlwZShcImF1ZGlvL21wZWdcIik7XG4gICAgICAgIGlmICghY2FuUGxheSB8fCBjYW5QbGF5ID09PSAnbm8nKSB7XG5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIHJlYXNvblwiLCBjYW5QbGF5KTtcbiAgICAgICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIGVycm9yXCIsIGUpO1xuICAgICAgICBodG1sNV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBodG1sNV9hdmFpbGFibGUpO1xuICAgIHJldHVybiBodG1sNV9hdmFpbGFibGU7XG59KSgpO1xuXG5pZiAoZGV0ZWN0LnBsYXRmb3JtLm1vYmlsZSB8fCBkZXRlY3QucGxhdGZvcm0udGFibGV0KSB7XG4gICAgYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBhbGxvd2VkIGZvciBtb2JpbGVcIik7XG59IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgY29udGV4dCBjcmVhdGVkXCIpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBkZXRlY3RlZFwiKTtcbiAgICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGh0bWw1INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNjcmFzaGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3dhcFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy53ZWJBdWRpb0FwaSA9IGZhbHNlO1xuICAgIHRoaXMuYWN0aXZlTG9hZGVyID0gMDtcbiAgICB0aGlzLnZvbHVtZSA9IDE7XG4gICAgdGhpcy5sb2FkZXJzID0gW107XG5cbiAgICB0aGlzLl9hZGRMb2FkZXIoKTtcbiAgICB0aGlzLl9hZGRMb2FkZXIoKTtcblxuICAgIHRoaXMuX3NldEFjdGl2ZSgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9IVE1MNSk7XG5BdWRpb0hUTUw1LnR5cGUgPSBBdWRpb0hUTUw1LnByb3RvdHlwZS50eXBlID0gXCJodG1sNVwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KDQsNCx0L7RgtCwINGBINC30LDQs9GA0YPQt9GH0LjQutCw0LzQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INCw0YPQtNC40L4t0YTQsNC50LvQvtCyXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fYWRkTG9hZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZExvYWRlclwiKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbG9hZGVyID0gbmV3IEF1ZGlvSFRNTDVMb2FkZXIoKTtcbiAgICBsb2FkZXIuaW5kZXggPSB0aGlzLmxvYWRlcnMucHVzaChsb2FkZXIpIC0gMTtcblxuICAgIGxvYWRlci5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IChzZWxmLmxvYWRlcnMubGVuZ3RoICsgbG9hZGVyLmluZGV4IC0gc2VsZi5hY3RpdmVMb2FkZXIpICUgc2VsZi5sb2FkZXJzLmxlbmd0aDtcbiAgICAgICAgc2VsZi50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9hZGVyLmNyZWF0ZVNvdXJjZShhdWRpb0NvbnRleHQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LDQutGC0LjQstC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9zZXRBY3RpdmUgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0QWN0aXZlXCIsIG9mZnNldCk7XG5cbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9ICh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TV0FQLCBvZmZzZXQpO1xuXG4gICAgaWYgKG9mZnNldCAhPT0gMCkge1xuICAgICAgICAvL0lORk86INC10YHQu9C4INGA0LXQu9C40LfQvtCy0YvQstCw0YLRjCDQutC+0L3RhtC10L/RhtC40Y4g0LzQvdC+0LbQtdGB0YLQstCwINC30LDQs9GA0YPQt9GH0LjQutC+0LIsINGC0L4g0Y3RgtC+INC90YPQttC90L4g0LTQvtGA0LDQsdC+0YLQsNGC0YwuXG4gICAgICAgIHRoaXMuc3RvcChvZmZzZXQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0Lgg0L7RgtC/0LjRgdCw0YLRjCDQtdCz0L4g0L7RgiDRgdC+0LHRi9GC0LjQuSDRgdGC0LDRgNGC0LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge0F1ZGlvfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2dldExvYWRlciA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuICAgIHJldHVybiB0aGlzLmxvYWRlcnNbKHRoaXMuYWN0aXZlTG9hZGVyICsgb2Zmc2V0KSAlIHRoaXMubG9hZGVycy5sZW5ndGhdO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC60LvRjtGH0LXQvdC40LUgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwIENPUlMuICoqKtCS0JDQltCd0J4hKioqIC0g0LXRgdC70Lgg0LLQutC70Y7Rh9C40YLRjCDRgNC10LbQuNC8IENPUlMsINCw0YPQtNC40L4g0Y3Qu9C10LzQtdC90YIg0L3QtSDRgdC80L7QttC10YIg0LfQsNCz0YDRg9C20LDRgtGMINC00LDQvdC90YvQtSDRgdC+XG4gKiDRgdGC0L7RgNC+0L3QvdC40YUg0LTQvtC80LXQvdC+0LIsINC10YHQu9C4INCyINC+0YLQstC10YLQtSDQvdC1INCx0YPQtNC10YIg0L/RgNCw0LLQuNC70YzQvdC+0LPQviDQt9Cw0LPQvtC70L7QstC60LAgQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luLiDQldGB0LvQuCDQvdC1INC/0LvQsNC90LjRgNGD0LXRgtGB0Y9cbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC1IFdlYiBBdWRpbyBBUEksINC90LUg0YHRgtC+0LjRgiDQstC60LvRjtGH0LDRgtGMINGN0YLQvtGCINGA0LXQttC40LwuXG4gKiBAcGFyYW0gc3RhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlQ3Jvc3NEb21haW4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIudG9nZ2xlQ3Jvc3NEb21haW4oc3RhdGUpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKlxuICogKirQktC90LjQvNCw0L3QuNC1ISoqIC0g0L/QvtGB0LvQtSDQstC60LvRjtGH0LXQvdC40Y8g0YDQtdC20LjQvNCwIFdlYiBBdWRpbyBBUEkg0L7QvSDQvdC1INC+0YLQutC70Y7Rh9Cw0LXRgtGB0Y8g0L/QvtC70L3QvtGB0YLRjNGOLCDRgi7Qui4g0LTQu9GPINGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPXG4gKiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLCDQutC+0YLQvtGA0L7QuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LrQu9C40Log0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GPLiDQn9GA0Lgg0L7RgtC60LvRjtGH0LXQvdC40Lgg0LjQtyDQs9GA0LDRhNCwINC+0LHRgNCw0LHQvtGC0LrQuCDQuNGB0LrQu9GO0YfQsNGO0YLRgdGPXG4gKiDQstGB0LUg0L3QvtC00Ysg0LrRgNC+0LzQtSDQvdC+0LQt0LjRgdGC0L7Rh9C90LjQutC+0LIg0Lgg0L3QvtC00Ysg0LLRi9Cy0L7QtNCwLCDRg9C/0YDQsNCy0LvQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0YzRjiDQv9C10YDQtdC60LvRjtGH0LDQtdGC0YHRjyDQvdCwINGN0LvQtdC80LXQvdGC0YsgYXVkaW8sINCx0LXQt1xuICog0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gR2Fpbk5vZGVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YFcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQuNGC0L7Qs9C+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICghYXVkaW9Db250ZXh0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElFcnJvclwiLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpID09IHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gMTtcbiAgICAgICAgICAgIGxvYWRlci5jcmVhdGVTb3VyY2UoYXVkaW9Db250ZXh0KTtcblxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QodGhpcy5wcmVwcm9jZXNzb3IgPyB0aGlzLnByZXByb2Nlc3Nvci5pbnB1dCA6IHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmF1ZGlvT3V0cHV0KSB7XG4gICAgICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICAgICAgdGhpcy5wcmVwcm9jZXNzb3Iub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICBkZWxldGUgdGhpcy5hdWRpb091dHB1dDtcblxuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICAgICAgLy9JTkZPOiDQv9C+0YHQu9C1INGC0L7Qs9C+INC60LDQuiDQvNGLINCy0LrQu9GO0YfQuNC70Lggd2ViQXVkaW9BUEkg0LXQs9C+INGD0LbQtSDQvdC10LvRjNC30Y8g0L/RgNC+0YHRgtC+INGC0LDQuiDQstGL0LrQu9GO0YfQuNGC0YwuXG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIHRoaXMud2ViQXVkaW9BcGkgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbn07XG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBpZiAoIXRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckVycm9yXCIsIHByZXByb2Nlc3Nvcik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yID09PSBwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wcmVwcm9jZXNzb3IgPSBwcmVwcm9jZXNzb3I7XG5cbiAgICBpZiAoIXByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHByZXByb2Nlc3Nvci5pbnB1dCk7XG4gICAgfSk7XG5cbiAgICBwcmVwcm9jZXNzb3Iub3V0cHV0LmNvbm5lY3QodGhpcy5hdWRpb091dHB1dCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlcIiwgc3JjKTtcblxuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcblxuICAgIGxvYWRlci5sb2FkKHNyYyk7XG4gICAgbG9hZGVyLnBsYXkoMCk7XG59O1xuXG4vKiog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRgyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBhdXNlXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcbiAgICBsb2FkZXIucGF1c2UoKTtcbn07XG5cbi8qKiDQodC90Y/RgtGMINGC0YDQtdC6INGBINC/0LDRg9C30YsgKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVzdW1lXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcbiAgICBsb2FkZXIucGxheSgpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RvcFwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCB8fCAwKTtcbiAgICBsb2FkZXIuc3RvcCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1NUT1AsIG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoKS5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0UG9zaXRpb25cIiwgcG9zaXRpb24pO1xuICAgIHRoaXMuX2dldExvYWRlcigpLnNldFBvc2l0aW9uKHBvc2l0aW9uIC0gMC4wMDEpOyAvL1RISU5LOiBsZWdhY3kt0LrQvtC0LiDQn9C+0L3Rj9GC0Ywg0L3QsNGE0LjQsyDRgtGD0YIg0L3Rg9C20LXQvSAwLjAwMVxufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuYXVkaW8uZHVyYXRpb247XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKGxvYWRlci5hdWRpby5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGxvYWRlci5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSBsb2FkZXIuYXVkaW8uYnVmZmVyZWQuc3RhcnQoMCk7XG4gICAgfVxuICAgIHJldHVybiAwO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52b2x1bWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge251bWJlcn0gdm9sdW1lXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG4gICAgdGhpcy52b2x1bWUgPSB2b2x1bWU7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB2b2x1bWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInByZWxvYWRcIiwgc3JjLCBvZmZzZXQpO1xuXG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICBsb2FkZXIubG9hZChzcmMpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuc3JjID09PSBzcmMgJiYgIWxvYWRlci5ub3RMb2FkaW5nO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oc3JjLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuc3JjID09PSBzcmM7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVByZWxvYWRlZFwiLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG5cbiAgICBpZiAoIWxvYWRlci5zcmMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuX3NldEFjdGl2ZShvZmZzZXQpO1xuICAgIGxvYWRlci5wbGF5KCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQtdC10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfEJvb2xlYW59IC0tINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6INC40LvQuCBmYWxzZSwg0LXRgdC70Lgg0L3QtdGCINC30LDQs9GA0YPQttCw0LXQvNC+0LPQviDRgtGA0LXQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KS5zcmM7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDQtNC+0YHRgtGD0L/QtdC9INC70Lgg0L/RgNC+0LPRgNCw0LzQvNC90YvQuSDQutC+0L3RgtGA0L7Qu9GMINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGRldGVjdC5vbmx5RGV2aWNlVm9sdW1lO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCb0L7Qs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogdGhpcy5nZXRTcmMoMCksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IHRoaXMuZ2V0U3JjKDEpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuYXVkaW9Db250ZXh0ID0gYXVkaW9Db250ZXh0O1xuZXhwb3J0cy5BdWRpb0ltcGxlbWVudGF0aW9uID0gQXVkaW9IVE1MNTtcbiIsInZhciBZYW5kZXhBdWRpbyA9IHJlcXVpcmUoJy4vZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2Vycm9yL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9saWIvbmV0L2Vycm9yL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9sb2dnZXIvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2Z4L2VxdWFsaXplci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vZngvdm9sdW1lL2V4cG9ydCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFlhbmRleEF1ZGlvO1xuIiwidmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbm9vcCcpO1xuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J7RgtC70L7QttC10L3QvdC+0LUg0LTQtdC50YHRgtCy0LjQtVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRGVmZXJyZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgX3Byb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCg0LDQt9GA0LXRiNC40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcmVzb2x2ZVxuICAgICAgICAgKiBAcGFyYW0geyp9IGRhdGEgLSDQv9C10YDQtdC00LDRgtGMINC00LDQvdC90YvQtSDQsiDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgICAqL1xuICAgICAgICBzZWxmLnJlc29sdmUgPSByZXNvbHZlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQntGC0LrQu9C+0L3QuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3JlamVjdFxuICAgICAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJvciAtINC/0LXRgNC10LTQsNGC0Ywg0L7RiNC40LHQutGDXG4gICAgICAgICAqL1xuICAgICAgICBzZWxmLnJlamVjdCA9IHJlamVjdDtcbiAgICB9KTtcblxuICAgIHZhciBwcm9taXNlID0gX3Byb21pc2UudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHNlbGYucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICBzZWxmLnBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIHNlbGYucmVqZWN0ZWQgPSB0cnVlO1xuICAgICAgICBzZWxmLnBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xuICAgIHByb21pc2VbXCJjYXRjaFwiXShub29wKTsgLy8gRG9uJ3QgdGhyb3cgZXJyb3JzIHRvIGNvbnNvbGVcblxuICAgIC8qKlxuICAgICAqINCS0YvQv9C+0LvQvdC40LvQvtGB0Ywg0LvQuCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5wZW5kaW5nID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqINCe0YLQutC70L7QvdC40LvQvtGB0Ywg0LvQuCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5yZWplY3RlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICog0J/QvtC70YPRh9C40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICogQG1ldGhvZCBEZWZlcnJlZCNwcm9taXNlXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgdGhpcy5wcm9taXNlID0gZnVuY3Rpb24oKSB7IHJldHVybiBwcm9taXNlOyB9O1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INCy0YvQv9C+0LvQvdC10L3QuNGPINGB0L/QuNGB0LrQsCDQvtCx0LXRidCw0L3QuNC5XG4gKiBAcGFyYW0gey4uLip9IGFyZ3MgLSDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0YvQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0L7QttC40LTQsNGC0YxcbiAqIEByZXR1cm5zIEFib3J0YWJsZVByb21pc2VcbiAqL1xuRGVmZXJyZWQud2hlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuXG4gICAgdmFyIGxpc3QgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgdmFyIHBlbmRpbmcgPSBsaXN0Lmxlbmd0aDtcblxuICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHBlbmRpbmctLTtcblxuICAgICAgICBpZiAocGVuZGluZyA8PSAwKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHByb21pc2UpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgfSk7XG4gICAgbGlzdCA9IG51bGw7XG5cbiAgICBkZWZlcnJlZC5wcm9taXNlLmFib3J0ID0gZGVmZXJyZWQucmVqZWN0O1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGVmZXJyZWQ7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKCcuLi9kYXRhL21lcmdlJyk7XG5cbnZhciBMSVNURU5FUlNfTkFNRSA9IFwiX2xpc3RlbmVyc1wiO1xudmFyIE1VVEVfT1BUSU9OID0gXCJfbXV0ZWRcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQlNC40YHQv9C10YLRh9C10YAg0YHQvtCx0YvRgtC40LlcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgLyoqINCa0L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0YHQv9C40YHQutC+0LIg0YHQu9GD0YjQsNGC0LXQu9C10Lkg0YHQvtCx0YvRgtC40LlcbiAgICAgKiBAYWxpYXMgRXZlbnRzI19saXN0ZW5lcnNcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxTdHJpbmcsIEFycmF5LjxGdW5jdGlvbj4+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpc1tMSVNURU5FUlNfTkFNRV0gPSB7fTtcblxuICAgIC8qKiDQpNC70LDQsyDQstC60LvRjtGH0LXQvdC40Y8v0LLRi9C60LvRjtGH0LXQvdC40Y8g0YHQvtCx0YvRgtC40LlcbiAgICAgKiBAYWxpYXMgRXZlbnRzI19tdXRlc1xuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpc1tNVVRFX09QVElPTl0gPSBmYWxzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQktGB0Y/Rh9C10YHQutC40Lkg0YHQsNGF0LDRgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0LrQu9Cw0YHRgSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2xhc3NDb25zdHJ1Y3RvciAtINC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0tINGC0L7RgiDQttC1INC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKGNsYXNzQ29uc3RydWN0b3IpIHtcbiAgICBtZXJnZShjbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgcmV0dXJuIGNsYXNzQ29uc3RydWN0b3I7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0L7QsdGK0LXQutGCINGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IC0g0L7QsdGK0LXQutGCXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtLSDRgtC+0YIg0LbQtSDQvtCx0YrQtdC60YIsINGA0LDRgdGI0LjRgNC10L3QvdGL0Lkg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqL1xuRXZlbnRzLmV2ZW50aXplID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgbWVyZ2Uob2JqZWN0LCBFdmVudHMucHJvdG90eXBlLCB0cnVlKTtcbiAgICBFdmVudHMuY2FsbChvYmplY3QpO1xuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC00L/QuNGB0LrQsCDQuCDQvtGC0L/QuNGB0LrQsCDQvtGCINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDQuNC80Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y9cbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdID0gW107XG4gICAgfVxuXG4gICAgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQntGC0L/QuNGB0LDRgtGM0YHRjyDQvtGCINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDQuNC80Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y9cbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZGVsZXRlIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdmFyIGNhbGxiYWNrcyA9IHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XTtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGNhbGxiYWNrcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrc1trXSA9PT0gY2FsbGJhY2sgfHwgY2FsbGJhY2tzW2tdLmNhbGxiYWNrID09PSBjYWxsYmFjaykge1xuICAgICAgICAgICAgY2FsbGJhY2tzLnNwbGljZShrLCAxKTtcbiAgICAgICAgICAgIGlmICghY2FsbGJhY2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQn9C+0LTQv9C40YHQsNGC0YzRgdGPINC90LAg0YHQvtCx0YvRgtC40LUsINC+0YLQv9C40YHQsNGC0YzRgdGPINGB0YDQsNC30YMg0L/QvtGB0LvQtSDQv9C10YDQstC+0LPQviDQstC+0LfQvdC40LrQvdC+0LLQtdC90LjRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHdyYXBwZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIHdyYXBwZXIpO1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICB3cmFwcGVyLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgc2VsZi5vbihldmVudCwgd3JhcHBlcik7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDQstGB0LXRhSDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpc1tMSVNURU5FUlNfTkFNRV0pIHtcbiAgICAgICAgaWYgKHRoaXNbTElTVEVORVJTX05BTUVdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KLRgNC40LPQs9C10YAg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHsuLi5hcmdzfSBhcmdzIC0g0L/QsNGA0LDQvNC10YLRgNGLINC00LvRjyDQv9C10YDQtdC00LDRh9C4INCy0LzQtdGB0YLQtSDRgSDRgdC+0LHRi9GC0LjQtdC8XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oZXZlbnQsIGFyZ3MpIHtcbiAgICBpZiAodGhpc1tNVVRFX09QVElPTl0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGlmIChldmVudCAhPT0gXCIqXCIpIHtcbiAgICAgICAgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmFwcGx5KHRoaXMsIFtcIipcIiwgZXZlbnRdLmNvbmNhdChhcmdzKSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdmFyIGNhbGxiYWNrcyA9IFtdLmNvbmNhdCh0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gY2FsbGJhY2tzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBjYWxsYmFja3Nba10uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCU0LXQu9C10LPQuNGA0L7QstCw0YLRjCDQstGB0LUg0YHQvtCx0YvRgtC40Y8g0LTRgNGD0LPQvtC80YMg0LTQuNGB0L/QtdGC0YfQtdGA0YMg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RXZlbnRzfSBhY2NlcHRvciAtINC/0L7Qu9GD0YfQsNGC0LXQu9GMINGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5waXBlRXZlbnRzID0gZnVuY3Rpb24oYWNjZXB0b3IpIHtcbiAgICB0aGlzLm9uKFwiKlwiLCBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYmluZChhY2NlcHRvcikpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCS0LrQu9GO0YfQtdC90LjQtS/QstGL0LrQu9GO0YfQtdC90LjQtSDRgtGA0LjQs9Cz0LXRgNCwINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LfQsNC/0YPRgdC6INGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5tdXRlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpc1tNVVRFX09QVElPTl0gPSB0cnVlO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQktC+0LfQvtCx0L3QvtCy0LjRgtGMINC30LDQv9GD0YHQuiDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUudW5tdXRlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZGVsZXRlIHRoaXNbTVVURV9PUFRJT05dO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudHM7XG4iLCJ2YXIgdm93ID0gcmVxdWlyZSgndm93Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vYnJvd3Nlci9kZXRlY3QnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gUHJvbWlzZVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9ydS9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9Qcm9taXNlfEVTIDIwMTUgUHJvbWlzZX1cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUHJvbWlzZTtcbmlmICh0eXBlb2Ygd2luZG93LlByb21pc2UgIT09IFwiZnVuY3Rpb25cIlxuICAgIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwibXNpZVwiIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwiZWRnZVwiIC8vINC80LXQu9C60LjQtSDQvNGP0LPQutC40LUg0LrQsNC6INCy0YHQtdCz0LTQsCDQvdC40YfQtdCz0L4g0L3QtSDRg9C80LXRjtGCINC00LXQu9Cw0YLRjCDQv9GA0LDQstC40LvRjNC90L5cbikge1xuICAgIFByb21pc2UgPSB2b3cuUHJvbWlzZTtcbn0gZWxzZSB7XG4gICAgUHJvbWlzZSA9IHdpbmRvdy5Qcm9taXNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDRgNCw0LfRgNC10YjRkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZXNvbHZlXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0YDQsNC30YDQtdGI0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDQvtGC0LrQu9C+0L3RkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZWplY3RcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSwg0LrQvtGC0L7RgNGL0LzQuCDQvtGC0LrQu9C+0L3QuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDQstGL0L/QvtC70L3QuNGC0YHRjyDRgtC+0LPQtNCwLCDQutC+0LPQtNCwINCx0YPQtNGD0YIg0LLRi9C/0L7Qu9C90LXQvdGLINCy0YHQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQvtCx0LXRidCw0L3QuNGPLlxuICogQG1ldGhvZCBQcm9taXNlLmFsbFxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTQtdGCINCy0YvQv9C+0LvQvdC10L3QviDRhdC+0YLRjyDQsdGLINC+0LTQvdC+INC40Lcg0L/QtdGA0LXQtNCw0L3QvdGL0YUg0L7QsdC10YnQsNC90LjQuS5cbiAqIEBtZXRob2QgUHJvbWlzZS5yYWNlXG4gKiBAcGFyYW0ge0FycmF5LjxQcm9taXNlPn0gcHJvbWlzZXMgLSDRgdC/0LjRgdC+0Log0L7QsdC10YnQsNC90LjQuVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgNCw0LfRgNC10YjQtdC90LjRjyDQuCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAbWV0aG9kIFByb21pc2UjdGhlblxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGF0LBcbiAqIEBwYXJhbSB7bnVsbHxmdW5jdGlvbn0gW2VycmJhY2tdIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQutC4XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI2NhdGNoXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBlcnJiYWNrIC0gINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIEFib3J0YWJsZVByb21pc2VcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0LXRidCw0L3QuNC1INGBINCy0L7Qt9C80L7QttC90L7RgdGC0YzRjiDQvtGC0LzQtdC90Ysg0YHQstGP0LfQsNC90L3QvtCz0L4g0YEg0L3QuNC8INC00LXQudGB0YLQstC40Y8uXG4gKiBAY2xhc3NkZXNjIEFib3J0YWJsZVByb21pc2VcbiAqIEBleHRlbmRzIFByb21pc2VcbiAqL1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQtNC10LnRgdGC0LLQuNGPINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC+0LHQtdGJ0LDQvdC40LXQvFxuICogQGFic3RyYWN0XG4gKiBAbWV0aG9kIEFib3J0YWJsZVByb21pc2UjYWJvcnRcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0LTQtdC50YHRgtCy0LjRj1xuICovXG4iLCJ2YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbi8qKlxuICog0KHQvtC00LDQvdC40LUg0L7RgtC60LvQvtC90ZHQvdC90L7Qs9C+INC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDQvtC1INC90LUg0L/Qu9GO0ZHRgtGB0Y8g0LIg0LrQvtC90YHQvtC70Ywg0L7RiNC40LHQutC+0LlcbiAqIEBwYXJhbSB7RXJyb3J9IGRhdGEgLSDQv9GA0LjRh9C40L3QsCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbnZhciByZWplY3QgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlamVjdChkYXRhKTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7XG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcbiIsInZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LHRgNCw0YPQt9C10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcndlYmtpdCA9IC8od2Via2l0KVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcnlhYnJvID0gLyh5YWJyb3dzZXIpWyBcXC9dKFtcXHcuXSspLztcbnZhciByb3BlcmEgPSAvKG9wcnxvcGVyYSkoPzouKnZlcnNpb24pP1sgXFwvXShbXFx3Ll0rKS87XG52YXIgcm1zaWUgPSAvKG1zaWUpIChbXFx3Ll0rKS87XG52YXIgcmVkZ2UgPSAvKGVkZ2UpXFwvKFtcXHcuXSspLztcbnZhciBybW96aWxsYSA9IC8obW96aWxsYSkoPzouKj8gcnY6KFtcXHcuXSspKT8vO1xudmFyIHJzYWZhcmkgPSAvXigoPyFjaHJvbWUpLikqdmVyc2lvblxcLyhbXFxkXFx3XFwuXSspLiooc2FmYXJpKS87XG5cbnZhciBtYXRjaCA9IHJzYWZhcmkuZXhlYyh1YSlcbiAgICB8fCByeWFicm8uZXhlYyh1YSlcbiAgICB8fCByZWRnZS5leGVjKHVhKVxuICAgIHx8IHJvcGVyYS5leGVjKHVhKVxuICAgIHx8IHJ3ZWJraXQuZXhlYyh1YSlcbiAgICB8fCBybXNpZS5leGVjKHVhKVxuICAgIHx8IHVhLmluZGV4T2YoXCJjb21wYXRpYmxlXCIpIDwgMCAmJiBybW96aWxsYS5leGVjKHVhKVxuICAgIHx8IFtdO1xuXG52YXIgYnJvd3NlciA9IHtuYW1lOiBtYXRjaFsxXSB8fCBcIlwiLCB2ZXJzaW9uOiBtYXRjaFsyXSB8fCBcIjBcIn07XG5cbmlmIChtYXRjaFszXSA9PT0gXCJzYWZhcmlcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IG1hdGNoWzNdO1xufVxuXG5pZiAoYnJvd3Nlci5uYW1lID09PSAnbXNpZScpIHtcbiAgICBpZiAoZG9jdW1lbnQuZG9jdW1lbnRNb2RlKSB7IC8vIElFOCBvciBsYXRlclxuICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IGRvY3VtZW50LmRvY3VtZW50TW9kZTtcbiAgICB9IGVsc2UgeyAvLyBJRSA1LTdcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSA1OyAvLyBBc3N1bWUgcXVpcmtzIG1vZGUgdW5sZXNzIHByb3ZlbiBvdGhlcndpc2VcbiAgICAgICAgaWYgKGRvY3VtZW50LmNvbXBhdE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlID09PSBcIkNTUzFDb21wYXRcIikge1xuICAgICAgICAgICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNzsgLy8gc3RhbmRhcmRzIG1vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJvcHJcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwib3BlcmFcIjtcbn1cblxuLy9JTkZPOiBJRSAo0LrQsNC6INCy0YHQtdCz0LTQsCkg0L3QtSDQutC+0YDRgNC10LrRgtC90L4g0LLRi9GB0YLQsNCy0LvRj9C10YIgdXNlci1hZ2VudFxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJtb3ppbGxhXCIgJiYgYnJvd3Nlci52ZXJzaW9uLnNwbGl0KFwiLlwiKVswXSA9PT0gXCIxMVwiKSB7XG4gICAgYnJvd3Nlci5uYW1lID0gXCJtc2llXCI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQsNGC0YTQvtGA0LzQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcnBsYXRmb3JtID0gLyhpcGFkfGlwaG9uZXxpcG9kfGFuZHJvaWR8YmxhY2tiZXJyeXxwbGF5Ym9va3x3aW5kb3dzIGNlfHdlYm9zKS87XG52YXIgcnRhYmxldCA9IC8oaXBhZHxwbGF5Ym9vaykvO1xudmFyIHJhbmRyb2lkID0gLyhhbmRyb2lkKS87XG52YXIgcm1vYmlsZSA9IC8obW9iaWxlKS87XG5cbnBsYXRmb3JtID0gcnBsYXRmb3JtLmV4ZWModWEpIHx8IFtdO1xudmFyIHRhYmxldCA9IHJ0YWJsZXQuZXhlYyh1YSkgfHwgIXJtb2JpbGUuZXhlYyh1YSkgJiYgcmFuZHJvaWQuZXhlYyh1YSkgfHwgW107XG5cbmlmIChwbGF0Zm9ybVsxXSkge1xuICAgIHBsYXRmb3JtWzFdID0gcGxhdGZvcm1bMV0ucmVwbGFjZSgvXFxzL2csIFwiX1wiKTsgLy8gQ2hhbmdlIHdoaXRlc3BhY2UgdG8gdW5kZXJzY29yZS4gRW5hYmxlcyBkb3Qgbm90YXRpb24uXG59XG5cbnZhciBwbGF0Zm9ybSA9IHtcbiAgICB0eXBlOiBwbGF0Zm9ybVsxXSB8fCBcIlwiLFxuICAgIHRhYmxldDogISF0YWJsZXRbMV0sXG4gICAgbW9iaWxlOiBwbGF0Zm9ybVsxXSAmJiAhdGFibGV0WzFdIHx8IGZhbHNlXG59O1xuaWYgKCFwbGF0Zm9ybS50eXBlKSB7XG4gICAgcGxhdGZvcm0udHlwZSA9ICdwYyc7XG59XG5cbnBsYXRmb3JtLm9zID0gcGxhdGZvcm0udHlwZTtcbmlmIChwbGF0Zm9ybS50eXBlID09PSAnaXBhZCcgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwaG9uZScgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwb2QnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnaW9zJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnYW5kcm9pZCc7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJXaW5cIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIndpbmRvd3NcIjtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvd2luW14gXSogKFteO10qKS9pKTtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gcGxhdGZvcm0udmVyc2lvbiAmJiBwbGF0Zm9ybS52ZXJzaW9uWzFdO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJtYWNvc1wiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ1bml4XCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJMaW51eFwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibGludXhcIjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvNC10L3Rj9GC0Ywg0LPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG52YXIgbm9Wb2x1bWUgPSB0cnVlO1xudHJ5IHtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIGF1ZGlvLnZvbHVtZSA9IDAuNjM7XG4gICAgbm9Wb2x1bWUgPSBNYXRoLmFicyhhdWRpby52b2x1bWUgLSAwLjYzKSA+IDAuMDE7XG59IGNhdGNoKGUpIHtcbiAgICBub1ZvbHVtZSA9IHRydWU7XG59XG5cbi8qKlxuICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L7QsSDQvtC60YDRg9C20LXQvdC40LhcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBkZXRlY3QgPSB7XG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LHRgNCw0YPQt9C10YDQtVxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG5hbWUgLSDQvdCw0LfQstCw0L3QuNC1INCx0YDQsNGD0LfQtdGA0LBcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdmVyc2lvbiAtINCy0LXRgNGB0LjRj1xuICAgICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbZG9jdW1lbnRNb2RlXSAtINCy0LXRgNGB0LjRjyDQtNC+0LrRg9C80LXQvdGC0LBcbiAgICAgKi9cbiAgICBicm93c2VyOiBicm93c2VyLFxuXG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0L/Qu9Cw0YLRhNC+0YDQvNC1XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gb3MgLSDRgtC40L8g0L7Qv9C10YDQsNGG0LjQvtC90L3QvtC5INGB0LjRgdGC0LXQvNGLXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHR5cGUgLSDRgtC40L8g0L/Qu9Cw0YLRhNC+0YDQvNGLXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSB0YWJsZXQgLSDQv9C70LDQvdGI0LXRglxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbW9iaWxlIC0g0LzQvtCx0LjQu9GM0L3Ri9C5XG4gICAgICovXG4gICAgcGxhdGZvcm06IHBsYXRmb3JtLFxuXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINCz0YDQvtC80LrQvtGB0YLQuFxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG9ubHlEZXZpY2VWb2x1bWU6IG5vVm9sdW1lXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRldGVjdDtcbiIsIi8qKlxuICogQGxpY2Vuc2UgU1dGT2JqZWN0IHYyLjIgPGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3QvPlxuICogaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlIDxodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocD5cbiAqIEBwcml2YXRlXG4qL1xudmFyIHN3Zm9iamVjdCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgVU5ERUYgPSBcInVuZGVmaW5lZFwiLFxuXHRcdE9CSkVDVCA9IFwib2JqZWN0XCIsXG5cdFx0U0hPQ0tXQVZFX0ZMQVNIID0gXCJTaG9ja3dhdmUgRmxhc2hcIixcblx0XHRTSE9DS1dBVkVfRkxBU0hfQVggPSBcIlNob2Nrd2F2ZUZsYXNoLlNob2Nrd2F2ZUZsYXNoXCIsXG5cdFx0RkxBU0hfTUlNRV9UWVBFID0gXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiLFxuXHRcdEVYUFJFU1NfSU5TVEFMTF9JRCA9IFwiU1dGT2JqZWN0RXhwckluc3RcIixcblx0XHRPTl9SRUFEWV9TVEFURV9DSEFOR0UgPSBcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLFxuXHRcdHdpbiA9IHdpbmRvdyxcblx0XHRkb2MgPSBkb2N1bWVudCxcblx0XHRuYXYgPSBuYXZpZ2F0b3IsXG5cdFx0cGx1Z2luID0gZmFsc2UsXG5cdFx0ZG9tTG9hZEZuQXJyID0gW21haW5dLFxuXHRcdHJlZ09iakFyciA9IFtdLFxuXHRcdG9iaklkQXJyID0gW10sXG5cdFx0bGlzdGVuZXJzQXJyID0gW10sXG5cdFx0c3RvcmVkQWx0Q29udGVudCxcblx0XHRzdG9yZWRBbHRDb250ZW50SWQsXG5cdFx0c3RvcmVkQ2FsbGJhY2tGbixcblx0XHRzdG9yZWRDYWxsYmFja09iaixcblx0XHRpc0RvbUxvYWRlZCA9IGZhbHNlLFxuXHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSBmYWxzZSxcblx0XHRkeW5hbWljU3R5bGVzaGVldCxcblx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhLFxuXHRcdGF1dG9IaWRlU2hvdyA9IHRydWUsXG5cdC8qIENlbnRyYWxpemVkIGZ1bmN0aW9uIGZvciBicm93c2VyIGZlYXR1cmUgZGV0ZWN0aW9uXG5cdFx0LSBVc2VyIGFnZW50IHN0cmluZyBkZXRlY3Rpb24gaXMgb25seSB1c2VkIHdoZW4gbm8gZ29vZCBhbHRlcm5hdGl2ZSBpcyBwb3NzaWJsZVxuXHRcdC0gSXMgZXhlY3V0ZWQgZGlyZWN0bHkgZm9yIG9wdGltYWwgcGVyZm9ybWFuY2Vcblx0Ki9cblx0dWEgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdzNjZG9tID0gdHlwZW9mIGRvYy5nZXRFbGVtZW50QnlJZCAhPSBVTkRFRiAmJiB0eXBlb2YgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lICE9IFVOREVGICYmIHR5cGVvZiBkb2MuY3JlYXRlRWxlbWVudCAhPSBVTkRFRixcblx0XHRcdHUgPSBuYXYudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG5cdFx0XHRwID0gbmF2LnBsYXRmb3JtLnRvTG93ZXJDYXNlKCksXG5cdFx0XHR3aW5kb3dzID0gcCA/IC93aW4vLnRlc3QocCkgOiAvd2luLy50ZXN0KHUpLFxuXHRcdFx0bWFjID0gcCA/IC9tYWMvLnRlc3QocCkgOiAvbWFjLy50ZXN0KHUpLFxuXHRcdFx0d2Via2l0ID0gL3dlYmtpdC8udGVzdCh1KSA/IHBhcnNlRmxvYXQodS5yZXBsYWNlKC9eLip3ZWJraXRcXC8oXFxkKyhcXC5cXGQrKT8pLiokLywgXCIkMVwiKSkgOiBmYWxzZSwgLy8gcmV0dXJucyBlaXRoZXIgdGhlIHdlYmtpdCB2ZXJzaW9uIG9yIGZhbHNlIGlmIG5vdCB3ZWJraXRcblx0XHRcdGllID0gIStcIlxcdjFcIiwgLy8gZmVhdHVyZSBkZXRlY3Rpb24gYmFzZWQgb24gQW5kcmVhIEdpYW1tYXJjaGkncyBzb2x1dGlvbjogaHR0cDovL3dlYnJlZmxlY3Rpb24uYmxvZ3Nwb3QuY29tLzIwMDkvMDEvMzItYnl0ZXMtdG8ta25vdy1pZi15b3VyLWJyb3dzZXItaXMtaWUuaHRtbFxuXHRcdFx0cGxheWVyVmVyc2lvbiA9IFswLDAsMF0sXG5cdFx0XHRkID0gbnVsbDtcblx0XHRpZiAodHlwZW9mIG5hdi5wbHVnaW5zICE9IFVOREVGICYmIHR5cGVvZiBuYXYucGx1Z2luc1tTSE9DS1dBVkVfRkxBU0hdID09IE9CSkVDVCkge1xuXHRcdFx0ZCA9IG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0uZGVzY3JpcHRpb247XG5cdFx0XHRpZiAoZCAmJiAhKHR5cGVvZiBuYXYubWltZVR5cGVzICE9IFVOREVGICYmIG5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXSAmJiAhbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdLmVuYWJsZWRQbHVnaW4pKSB7IC8vIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiXS5lbmFibGVkUGx1Z2luIGluZGljYXRlcyB3aGV0aGVyIHBsdWctaW5zIGFyZSBlbmFibGVkIG9yIGRpc2FibGVkIGluIFNhZmFyaSAzK1xuXHRcdFx0XHRwbHVnaW4gPSB0cnVlO1xuXHRcdFx0XHRpZSA9IGZhbHNlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0ZCA9IGQucmVwbGFjZSgvXi4qXFxzKyhcXFMrXFxzK1xcUyskKS8sIFwiJDFcIik7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMF0gPSBwYXJzZUludChkLnJlcGxhY2UoL14oLiopXFwuLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzFdID0gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipcXC4oLiopXFxzLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzJdID0gL1thLXpBLVpdLy50ZXN0KGQpID8gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipbYS16QS1aXSsoLiopJC8sIFwiJDFcIiksIDEwKSA6IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4uQWN0aXZlWE9iamVjdCAhPSBVTkRFRikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGEgPSBuZXcgQWN0aXZlWE9iamVjdChTSE9DS1dBVkVfRkxBU0hfQVgpO1xuXHRcdFx0XHRpZiAoYSkgeyAvLyBhIHdpbGwgcmV0dXJuIG51bGwgd2hlbiBBY3RpdmVYIGlzIGRpc2FibGVkXG5cdFx0XHRcdFx0ZCA9IGEuR2V0VmFyaWFibGUoXCIkdmVyc2lvblwiKTtcblx0XHRcdFx0XHRpZiAoZCkge1xuXHRcdFx0XHRcdFx0aWUgPSB0cnVlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0XHRcdGQgPSBkLnNwbGl0KFwiIFwiKVsxXS5zcGxpdChcIixcIik7XG5cdFx0XHRcdFx0XHRwbGF5ZXJWZXJzaW9uID0gW3BhcnNlSW50KGRbMF0sIDEwKSwgcGFyc2VJbnQoZFsxXSwgMTApLCBwYXJzZUludChkWzJdLCAxMCldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2F0Y2goZSkge31cblx0XHR9XG5cdFx0cmV0dXJuIHsgdzM6dzNjZG9tLCBwdjpwbGF5ZXJWZXJzaW9uLCB3azp3ZWJraXQsIGllOmllLCB3aW46d2luZG93cywgbWFjOm1hYyB9O1xuXHR9KCk7XG5cdC8qIENyb3NzLWJyb3dzZXIgb25Eb21Mb2FkXG5cdFx0LSBXaWxsIGZpcmUgYW4gZXZlbnQgYXMgc29vbiBhcyB0aGUgRE9NIG9mIGEgd2ViIHBhZ2UgaXMgbG9hZGVkXG5cdFx0LSBJbnRlcm5ldCBFeHBsb3JlciB3b3JrYXJvdW5kIGJhc2VkIG9uIERpZWdvIFBlcmluaSdzIHNvbHV0aW9uOiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vSUVDb250ZW50TG9hZGVkL1xuXHRcdC0gUmVndWxhciBvbmxvYWQgc2VydmVzIGFzIGZhbGxiYWNrXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAoIXVhLnczKSB7IHJldHVybjsgfVxuXHRcdGlmICgodHlwZW9mIGRvYy5yZWFkeVN0YXRlICE9IFVOREVGICYmIGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikgfHwgKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSA9PSBVTkRFRiAmJiAoZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXSB8fCBkb2MuYm9keSkpKSB7IC8vIGZ1bmN0aW9uIGlzIGZpcmVkIGFmdGVyIG9ubG9hZCwgZS5nLiB3aGVuIHNjcmlwdCBpcyBpbnNlcnRlZCBkeW5hbWljYWxseVxuXHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHR9XG5cdFx0aWYgKCFpc0RvbUxvYWRlZCkge1xuXHRcdFx0aWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgY2FsbERvbUxvYWRGdW5jdGlvbnMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdFx0ZG9jLmF0dGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikge1xuXHRcdFx0XHRcdFx0ZG9jLmRldGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgYXJndW1lbnRzLmNhbGxlZSk7XG5cdFx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICh3aW4gPT0gdG9wKSB7IC8vIGlmIG5vdCBpbnNpZGUgYW4gaWZyYW1lXG5cdFx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRkb2MuZG9jdW1lbnRFbGVtZW50LmRvU2Nyb2xsKFwibGVmdFwiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoKGUpIHtcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAwKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9KSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEud2spIHtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICghL2xvYWRlZHxjb21wbGV0ZS8udGVzdChkb2MucmVhZHlTdGF0ZSkpIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRhZGRMb2FkRXZlbnQoY2FsbERvbUxvYWRGdW5jdGlvbnMpO1xuXHRcdH1cblx0fSkoKTtcblx0ZnVuY3Rpb24gY2FsbERvbUxvYWRGdW5jdGlvbnMoKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdHRyeSB7IC8vIHRlc3QgaWYgd2UgY2FuIHJlYWxseSBhZGQvcmVtb3ZlIGVsZW1lbnRzIHRvL2Zyb20gdGhlIERPTTsgd2UgZG9uJ3Qgd2FudCB0byBmaXJlIGl0IHRvbyBlYXJseVxuXHRcdFx0dmFyIHQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLmFwcGVuZENoaWxkKGNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTtcblx0XHRcdHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHsgcmV0dXJuOyB9XG5cdFx0aXNEb21Mb2FkZWQgPSB0cnVlO1xuXHRcdHZhciBkbCA9IGRvbUxvYWRGbkFyci5sZW5ndGg7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkbDsgaSsrKSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbaV0oKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWRkRG9tTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7XG5cdFx0XHRmbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvbUxvYWRGbkFycltkb21Mb2FkRm5BcnIubGVuZ3RoXSA9IGZuOyAvLyBBcnJheS5wdXNoKCkgaXMgb25seSBhdmFpbGFibGUgaW4gSUU1LjUrXG5cdFx0fVxuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgb25sb2FkXG5cdFx0LSBCYXNlZCBvbiBKYW1lcyBFZHdhcmRzJyBzb2x1dGlvbjogaHR0cDovL2Jyb3RoZXJjYWtlLmNvbS9zaXRlL3Jlc291cmNlcy9zY3JpcHRzL29ubG9hZC9cblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIGEgd2ViIHBhZ2UgaW5jbHVkaW5nIGFsbCBvZiBpdHMgYXNzZXRzIGFyZSBsb2FkZWRcblx0ICovXG5cdGZ1bmN0aW9uIGFkZExvYWRFdmVudChmbikge1xuXHRcdGlmICh0eXBlb2Ygd2luLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdHdpbi5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLmF0dGFjaEV2ZW50ICE9IFVOREVGKSB7XG5cdFx0XHRhZGRMaXN0ZW5lcih3aW4sIFwib25sb2FkXCIsIGZuKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5vbmxvYWQgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2YXIgZm5PbGQgPSB3aW4ub25sb2FkO1xuXHRcdFx0d2luLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmbk9sZCgpO1xuXHRcdFx0XHRmbigpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR3aW4ub25sb2FkID0gZm47XG5cdFx0fVxuXHR9XG5cdC8qIE1haW4gZnVuY3Rpb25cblx0XHQtIFdpbGwgcHJlZmVyYWJseSBleGVjdXRlIG9uRG9tTG9hZCwgb3RoZXJ3aXNlIG9ubG9hZCAoYXMgYSBmYWxsYmFjaylcblx0Ki9cblx0ZnVuY3Rpb24gbWFpbigpIHtcblx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHR0ZXN0UGxheWVyVmVyc2lvbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogRGV0ZWN0IHRoZSBGbGFzaCBQbGF5ZXIgdmVyc2lvbiBmb3Igbm9uLUludGVybmV0IEV4cGxvcmVyIGJyb3dzZXJzXG5cdFx0LSBEZXRlY3RpbmcgdGhlIHBsdWctaW4gdmVyc2lvbiB2aWEgdGhlIG9iamVjdCBlbGVtZW50IGlzIG1vcmUgcHJlY2lzZSB0aGFuIHVzaW5nIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXRlbSdzIGRlc2NyaXB0aW9uOlxuXHRcdCAgYS4gQm90aCByZWxlYXNlIGFuZCBidWlsZCBudW1iZXJzIGNhbiBiZSBkZXRlY3RlZFxuXHRcdCAgYi4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IGNvcnJ1cHQgaW5zdGFsbGVycyBwcm92aWRlZCBieSBBZG9iZVxuXHRcdCAgYy4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IG11bHRpcGxlIEZsYXNoIFBsYXllciBlbnRyaWVzIGluIHRoZSBwbHVnaW4gQXJyYXksIGNhdXNlZCBieSBpbmNvcnJlY3QgYnJvd3NlciBpbXBvcnRzXG5cdFx0LSBEaXNhZHZhbnRhZ2Ugb2YgdGhpcyBtZXRob2QgaXMgdGhhdCBpdCBkZXBlbmRzIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIERPTSwgd2hpbGUgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpcyBpbW1lZGlhdGVseSBhdmFpbGFibGVcblx0Ki9cblx0ZnVuY3Rpb24gdGVzdFBsYXllclZlcnNpb24oKSB7XG5cdFx0dmFyIGIgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO1xuXHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdHZhciB0ID0gYi5hcHBlbmRDaGlsZChvKTtcblx0XHRpZiAodCkge1xuXHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmICh0eXBlb2YgdC5HZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdHZhciBkID0gdC5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0dWEucHYgPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGNvdW50ZXIgPCAxMCkge1xuXHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yi5yZW1vdmVDaGlsZChvKTtcblx0XHRcdFx0dCA9IG51bGw7XG5cdFx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBQZXJmb3JtIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWF0Y2hpbmc7IHN0YXRpYyBwdWJsaXNoaW5nIG9ubHlcblx0Ki9cblx0ZnVuY3Rpb24gbWF0Y2hWZXJzaW9ucygpIHtcblx0XHR2YXIgcmwgPSByZWdPYmpBcnIubGVuZ3RoO1xuXHRcdGlmIChybCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmw7IGkrKykgeyAvLyBmb3IgZWFjaCByZWdpc3RlcmVkIG9iamVjdCBlbGVtZW50XG5cdFx0XHRcdHZhciBpZCA9IHJlZ09iakFycltpXS5pZDtcblx0XHRcdFx0dmFyIGNiID0gcmVnT2JqQXJyW2ldLmNhbGxiYWNrRm47XG5cdFx0XHRcdHZhciBjYk9iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDppZH07XG5cdFx0XHRcdGlmICh1YS5wdlswXSA+IDApIHtcblx0XHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdFx0XHRcdGlmIChvYmopIHtcblx0XHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHJlZ09iakFycltpXS5zd2ZWZXJzaW9uKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSkgeyAvLyBGbGFzaCBQbGF5ZXIgdmVyc2lvbiA+PSBwdWJsaXNoZWQgU1dGIHZlcnNpb246IEhvdXN0b24sIHdlIGhhdmUgYSBtYXRjaCFcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IGdldE9iamVjdEJ5SWQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZyBpZiBzZXQgYnkgdGhlIHdlYiBwYWdlIGF1dGhvciBhbmQgaWYgc3VwcG9ydGVkXG5cdFx0XHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRcdFx0YXR0LmRhdGEgPSByZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGw7XG5cdFx0XHRcdFx0XHRcdGF0dC53aWR0aCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0YXR0LmhlaWdodCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIHsgYXR0LnN0eWxlY2xhc3MgPSBvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7IH1cblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKSkgeyBhdHQuYWxpZ24gPSBvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIik7IH1cblx0XHRcdFx0XHRcdFx0Ly8gcGFyc2UgSFRNTCBvYmplY3QgcGFyYW0gZWxlbWVudCdzIG5hbWUtdmFsdWUgcGFpcnNcblx0XHRcdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgcCA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcmFtXCIpO1xuXHRcdFx0XHRcdFx0XHR2YXIgcGwgPSBwLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwbDsgaisrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKS50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cGFyW3Bbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKV0gPSBwW2pdLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIGlkLCBjYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHsgLy8gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtaXNtYXRjaCBvciBhbiBvbGRlciBXZWJraXQgZW5naW5lIHRoYXQgaWdub3JlcyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCdzIG5lc3RlZCBwYXJhbSBlbGVtZW50czogZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50IGluc3RlYWQgb2YgU1dGXG5cdFx0XHRcdFx0XHRcdGRpc3BsYXlBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikgeyBjYihjYk9iaik7IH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XHQvLyBpZiBubyBGbGFzaCBQbGF5ZXIgaXMgaW5zdGFsbGVkIG9yIHRoZSBmcCB2ZXJzaW9uIGNhbm5vdCBiZSBkZXRlY3RlZCB3ZSBsZXQgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgZG8gaXRzIGpvYiAoZWl0aGVyIHNob3cgYSBTV0Ygb3IgYWx0ZXJuYXRpdmUgY29udGVudClcblx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdHZhciBvID0gZ2V0T2JqZWN0QnlJZChpZCk7IC8vIHRlc3Qgd2hldGhlciB0aGVyZSBpcyBhbiBIVE1MIG9iamVjdCBlbGVtZW50IG9yIG5vdFxuXHRcdFx0XHRcdFx0aWYgKG8gJiYgdHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IG87XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpIHtcblx0XHR2YXIgciA9IG51bGw7XG5cdFx0dmFyIG8gPSBnZXRFbGVtZW50QnlJZChvYmplY3RJZFN0cik7XG5cdFx0aWYgKG8gJiYgby5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIG4gPSBvLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRcdGlmIChuKSB7XG5cdFx0XHRcdFx0ciA9IG47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0LyogUmVxdWlyZW1lbnRzIGZvciBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHQtIG9ubHkgb25lIGluc3RhbmNlIGNhbiBiZSBhY3RpdmUgYXQgYSB0aW1lXG5cdFx0LSBmcCA2LjAuNjUgb3IgaGlnaGVyXG5cdFx0LSBXaW4vTWFjIE9TIG9ubHlcblx0XHQtIG5vIFdlYmtpdCBlbmdpbmVzIG9sZGVyIHRoYW4gdmVyc2lvbiAzMTJcblx0Ki9cblx0ZnVuY3Rpb24gY2FuRXhwcmVzc0luc3RhbGwoKSB7XG5cdFx0cmV0dXJuICFpc0V4cHJlc3NJbnN0YWxsQWN0aXZlICYmIGhhc1BsYXllclZlcnNpb24oXCI2LjAuNjVcIikgJiYgKHVhLndpbiB8fCB1YS5tYWMpICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpO1xuXHR9XG5cdC8qIFNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2dcblx0XHQtIFJlZmVyZW5jZTogaHR0cDovL3d3dy5hZG9iZS5jb20vY2Z1c2lvbi9rbm93bGVkZ2ViYXNlL2luZGV4LmNmbT9pZD02YTI1M2I3NVxuXHQqL1xuXHRmdW5jdGlvbiBzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gdHJ1ZTtcblx0XHRzdG9yZWRDYWxsYmFja0ZuID0gY2FsbGJhY2tGbiB8fCBudWxsO1xuXHRcdHN0b3JlZENhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRpZiAob2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHsgLy8gc3RhdGljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IGFic3RyYWN0QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIGR5bmFtaWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gb2JqO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSByZXBsYWNlRWxlbUlkU3RyO1xuXHRcdFx0fVxuXHRcdFx0YXR0LmlkID0gRVhQUkVTU19JTlNUQUxMX0lEO1xuXHRcdFx0aWYgKHR5cGVvZiBhdHQud2lkdGggPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LndpZHRoKSAmJiBwYXJzZUludChhdHQud2lkdGgsIDEwKSA8IDMxMCkpIHsgYXR0LndpZHRoID0gXCIzMTBcIjsgfVxuXHRcdFx0aWYgKHR5cGVvZiBhdHQuaGVpZ2h0ID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC5oZWlnaHQpICYmIHBhcnNlSW50KGF0dC5oZWlnaHQsIDEwKSA8IDEzNykpIHsgYXR0LmhlaWdodCA9IFwiMTM3XCI7IH1cblx0XHRcdGRvYy50aXRsZSA9IGRvYy50aXRsZS5zbGljZSgwLCA0NykgKyBcIiAtIEZsYXNoIFBsYXllciBJbnN0YWxsYXRpb25cIjtcblx0XHRcdHZhciBwdCA9IHVhLmllICYmIHVhLndpbiA/IFwiQWN0aXZlWFwiIDogXCJQbHVnSW5cIixcblx0XHRcdFx0ZnYgPSBcIk1NcmVkaXJlY3RVUkw9XCIgKyB3aW4ubG9jYXRpb24udG9TdHJpbmcoKS5yZXBsYWNlKC8mL2csXCIlMjZcIikgKyBcIiZNTXBsYXllclR5cGU9XCIgKyBwdCArIFwiJk1NZG9jdGl0bGU9XCIgKyBkb2MudGl0bGU7XG5cdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGZ2O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBmdjtcblx0XHRcdH1cblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHRcdHZhciBuZXdPYmogPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0XHRyZXBsYWNlRWxlbUlkU3RyICs9IFwiU1dGT2JqZWN0TmV3XCI7XG5cdFx0XHRcdG5ld09iai5zZXRBdHRyaWJ1dGUoXCJpZFwiLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld09iaiwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG9iamVjdCBlbGVtZW50IHRoYXQgbG9hZHMgZXhwcmVzc2luc3RhbGwuc3dmXG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBhYnN0cmFjdCBhbmQgZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGRpc3BsYXlBbHRDb250ZW50KG9iaikge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIGVsKTtcblx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgb2JqKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWJzdHJhY3RBbHRDb250ZW50KG9iaikge1xuXHRcdHZhciBhYyA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0aWYgKHVhLndpbiAmJiB1YS5pZSkge1xuXHRcdFx0YWMuaW5uZXJIVE1MID0gb2JqLmlubmVySFRNTDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgbmVzdGVkT2JqID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRpZiAobmVzdGVkT2JqKSB7XG5cdFx0XHRcdHZhciBjID0gbmVzdGVkT2JqLmNoaWxkTm9kZXM7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0dmFyIGNsID0gYy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjbDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShjW2ldLm5vZGVUeXBlID09IDEgJiYgY1tpXS5ub2RlTmFtZSA9PSBcIlBBUkFNXCIpICYmICEoY1tpXS5ub2RlVHlwZSA9PSA4KSkge1xuXHRcdFx0XHRcdFx0XHRhYy5hcHBlbmRDaGlsZChjW2ldLmNsb25lTm9kZSh0cnVlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBhYztcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgU1dGIGNyZWF0aW9uXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgaWQpIHtcblx0XHR2YXIgciwgZWwgPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKHVhLndrICYmIHVhLndrIDwgMzEyKSB7IHJldHVybiByOyB9XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRpZiAodHlwZW9mIGF0dE9iai5pZCA9PSBVTkRFRikgeyAvLyBpZiBubyAnaWQnIGlzIGRlZmluZWQgZm9yIHRoZSBvYmplY3QgZWxlbWVudCwgaXQgd2lsbCBpbmhlcml0IHRoZSAnaWQnIGZyb20gdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0YXR0T2JqLmlkID0gaWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IC8vIEludGVybmV0IEV4cGxvcmVyICsgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgKyBXM0MgRE9NIG1ldGhvZHMgZG8gbm90IGNvbWJpbmU6IGZhbGwgYmFjayB0byBvdXRlckhUTUxcblx0XHRcdFx0dmFyIGF0dCA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialtpXSAhPSBPYmplY3QucHJvdG90eXBlW2ldKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJkYXRhXCIpIHtcblx0XHRcdFx0XHRcdFx0cGFyT2JqLm1vdmllID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyBjbGFzcz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7XG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnICcgKyBpICsgJz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFyID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW2pdICE9IE9iamVjdC5wcm90b3R5cGVbal0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0cGFyICs9ICc8cGFyYW0gbmFtZT1cIicgKyBqICsgJ1wiIHZhbHVlPVwiJyArIHBhck9ialtqXSArICdcIiAvPic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIicgKyBhdHQgKyAnPicgKyBwYXIgKyAnPC9vYmplY3Q+Jztcblx0XHRcdFx0b2JqSWRBcnJbb2JqSWRBcnIubGVuZ3RoXSA9IGF0dE9iai5pZDsgLy8gc3RvcmVkIHRvIGZpeCBvYmplY3QgJ2xlYWtzJyBvbiB1bmxvYWQgKGR5bmFtaWMgcHVibGlzaGluZyBvbmx5KVxuXHRcdFx0XHRyID0gZ2V0RWxlbWVudEJ5SWQoYXR0T2JqLmlkKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyB3ZWxsLWJlaGF2aW5nIGJyb3dzZXJzXG5cdFx0XHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHRcdFx0Zm9yICh2YXIgbSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW21dICE9IE9iamVjdC5wcm90b3R5cGVbbV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKG0udG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAobS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7IC8vIGZpbHRlciBvdXQgSUUgc3BlY2lmaWMgYXR0cmlidXRlXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKG0sIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAodmFyIG4gaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtuXSAhPSBPYmplY3QucHJvdG90eXBlW25dICYmIG4udG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllcyBhbmQgSUUgc3BlY2lmaWMgcGFyYW0gZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3JlYXRlT2JqUGFyYW0obywgbiwgcGFyT2JqW25dKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobywgZWwpO1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlT2JqUGFyYW0oZWwsIHBOYW1lLCBwVmFsdWUpIHtcblx0XHR2YXIgcCA9IGNyZWF0ZUVsZW1lbnQoXCJwYXJhbVwiKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgcE5hbWUpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcFZhbHVlKTtcblx0XHRlbC5hcHBlbmRDaGlsZChwKTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIFNXRiByZW1vdmFsXG5cdFx0LSBFc3BlY2lhbGx5IG5lZWRlZCB0byBzYWZlbHkgYW5kIGNvbXBsZXRlbHkgcmVtb3ZlIGEgU1dGIGluIEludGVybmV0IEV4cGxvcmVyXG5cdCovXG5cdGZ1bmN0aW9uIHJlbW92ZVNXRihpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaiAmJiBvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0cmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZU9iamVjdEluSUUoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb2JqW2ldID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdG9ialtpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBvcHRpbWl6ZSBKYXZhU2NyaXB0IGNvbXByZXNzaW9uXG5cdCovXG5cdGZ1bmN0aW9uIGdldEVsZW1lbnRCeUlkKGlkKSB7XG5cdFx0dmFyIGVsID0gbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0ZWwgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge31cblx0XHRyZXR1cm4gZWw7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRWxlbWVudChlbCkge1xuXHRcdHJldHVybiBkb2MuY3JlYXRlRWxlbWVudChlbCk7XG5cdH1cblx0LyogVXBkYXRlZCBhdHRhY2hFdmVudCBmdW5jdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHQtIFN0b3JlcyBhdHRhY2hFdmVudCBpbmZvcm1hdGlvbiBpbiBhbiBBcnJheSwgc28gb24gdW5sb2FkIHRoZSBkZXRhY2hFdmVudCBmdW5jdGlvbnMgY2FuIGJlIGNhbGxlZCB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0Ki9cblx0ZnVuY3Rpb24gYWRkTGlzdGVuZXIodGFyZ2V0LCBldmVudFR5cGUsIGZuKSB7XG5cdFx0dGFyZ2V0LmF0dGFjaEV2ZW50KGV2ZW50VHlwZSwgZm4pO1xuXHRcdGxpc3RlbmVyc0FycltsaXN0ZW5lcnNBcnIubGVuZ3RoXSA9IFt0YXJnZXQsIGV2ZW50VHlwZSwgZm5dO1xuXHR9XG5cdC8qIEZsYXNoIFBsYXllciBhbmQgU1dGIGNvbnRlbnQgdmVyc2lvbiBtYXRjaGluZ1xuXHQqL1xuXHRmdW5jdGlvbiBoYXNQbGF5ZXJWZXJzaW9uKHJ2KSB7XG5cdFx0dmFyIHB2ID0gdWEucHYsIHYgPSBydi5zcGxpdChcIi5cIik7XG5cdFx0dlswXSA9IHBhcnNlSW50KHZbMF0sIDEwKTtcblx0XHR2WzFdID0gcGFyc2VJbnQodlsxXSwgMTApIHx8IDA7IC8vIHN1cHBvcnRzIHNob3J0IG5vdGF0aW9uLCBlLmcuIFwiOVwiIGluc3RlYWQgb2YgXCI5LjAuMFwiXG5cdFx0dlsyXSA9IHBhcnNlSW50KHZbMl0sIDEwKSB8fCAwO1xuXHRcdHJldHVybiAocHZbMF0gPiB2WzBdIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID4gdlsxXSkgfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPT0gdlsxXSAmJiBwdlsyXSA+PSB2WzJdKSkgPyB0cnVlIDogZmFsc2U7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIENTUyBjcmVhdGlvblxuXHRcdC0gQmFzZWQgb24gQm9iYnkgdmFuIGRlciBTbHVpcycgc29sdXRpb246IGh0dHA6Ly93d3cuYm9iYnl2YW5kZXJzbHVpcy5jb20vYXJ0aWNsZXMvZHluYW1pY0NTUy5waHBcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlQ1NTKHNlbCwgZGVjbCwgbWVkaWEsIG5ld1N0eWxlKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLm1hYykgeyByZXR1cm47IH1cblx0XHR2YXIgaCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XG5cdFx0aWYgKCFoKSB7IHJldHVybjsgfSAvLyB0byBhbHNvIHN1cHBvcnQgYmFkbHkgYXV0aG9yZWQgSFRNTCBwYWdlcyB0aGF0IGxhY2sgYSBoZWFkIGVsZW1lbnRcblx0XHR2YXIgbSA9IChtZWRpYSAmJiB0eXBlb2YgbWVkaWEgPT0gXCJzdHJpbmdcIikgPyBtZWRpYSA6IFwic2NyZWVuXCI7XG5cdFx0aWYgKG5ld1N0eWxlKSB7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IG51bGw7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFkeW5hbWljU3R5bGVzaGVldCB8fCBkeW5hbWljU3R5bGVzaGVldE1lZGlhICE9IG0pIHtcblx0XHRcdC8vIGNyZWF0ZSBkeW5hbWljIHN0eWxlc2hlZXQgKyBnZXQgYSBnbG9iYWwgcmVmZXJlbmNlIHRvIGl0XG5cdFx0XHR2YXIgcyA9IGNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvY3NzXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJtZWRpYVwiLCBtKTtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gaC5hcHBlbmRDaGlsZChzKTtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgdHlwZW9mIGRvYy5zdHlsZVNoZWV0cyAhPSBVTkRFRiAmJiBkb2Muc3R5bGVTaGVldHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGRvYy5zdHlsZVNoZWV0c1tkb2Muc3R5bGVTaGVldHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbTtcblx0XHR9XG5cdFx0Ly8gYWRkIHN0eWxlIHJ1bGVcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUgPT0gT0JKRUNUKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUoc2VsLCBkZWNsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGRvYy5jcmVhdGVUZXh0Tm9kZSAhPSBVTkRFRikge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlVGV4dE5vZGUoc2VsICsgXCIge1wiICsgZGVjbCArIFwifVwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldFZpc2liaWxpdHkoaWQsIGlzVmlzaWJsZSkge1xuXHRcdGlmICghYXV0b0hpZGVTaG93KSB7IHJldHVybjsgfVxuXHRcdHZhciB2ID0gaXNWaXNpYmxlID8gXCJ2aXNpYmxlXCIgOiBcImhpZGRlblwiO1xuXHRcdGlmIChpc0RvbUxvYWRlZCAmJiBnZXRFbGVtZW50QnlJZChpZCkpIHtcblx0XHRcdGdldEVsZW1lbnRCeUlkKGlkKS5zdHlsZS52aXNpYmlsaXR5ID0gdjtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVDU1MoXCIjXCIgKyBpZCwgXCJ2aXNpYmlsaXR5OlwiICsgdik7XG5cdFx0fVxuXHR9XG5cdC8qIEZpbHRlciB0byBhdm9pZCBYU1MgYXR0YWNrc1xuXHQqL1xuXHRmdW5jdGlvbiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShzKSB7XG5cdFx0dmFyIHJlZ2V4ID0gL1tcXFxcXFxcIjw+XFwuO10vO1xuXHRcdHZhciBoYXNCYWRDaGFycyA9IHJlZ2V4LmV4ZWMocykgIT0gbnVsbDtcblx0XHRyZXR1cm4gaGFzQmFkQ2hhcnMgJiYgdHlwZW9mIGVuY29kZVVSSUNvbXBvbmVudCAhPSBVTkRFRiA/IGVuY29kZVVSSUNvbXBvbmVudChzKSA6IHM7XG5cdH1cblx0LyogUmVsZWFzZSBtZW1vcnkgdG8gYXZvaWQgbWVtb3J5IGxlYWtzIGNhdXNlZCBieSBjbG9zdXJlcywgZml4IGhhbmdpbmcgYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzL05ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3QgKEludGVybmV0IEV4cGxvcmVyIG9ubHkpXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0dmFyIGxsID0gbGlzdGVuZXJzQXJyLmxlbmd0aDtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsbDsgaSsrKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzQXJyW2ldWzBdLmRldGFjaEV2ZW50KGxpc3RlbmVyc0FycltpXVsxXSwgbGlzdGVuZXJzQXJyW2ldWzJdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjbGVhbnVwIGR5bmFtaWNhbGx5IGVtYmVkZGVkIG9iamVjdHMgdG8gZml4IGF1ZGlvL3ZpZGVvIHRocmVhZHMgYW5kIGZvcmNlIG9wZW4gc29ja2V0cyBhbmQgTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdFxuXHRcdFx0XHR2YXIgaWwgPSBvYmpJZEFyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgaWw7IGorKykge1xuXHRcdFx0XHRcdHJlbW92ZVNXRihvYmpJZEFycltqXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBsaWJyYXJ5J3MgbWFpbiBjbG9zdXJlcyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0Zm9yICh2YXIgayBpbiB1YSkge1xuXHRcdFx0XHRcdHVhW2tdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR1YSA9IG51bGw7XG5cdFx0XHRcdGZvciAodmFyIGwgaW4gc3dmb2JqZWN0KSB7XG5cdFx0XHRcdFx0c3dmb2JqZWN0W2xdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2ZvYmplY3QgPSBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KSgpO1xuXHRyZXR1cm4ge1xuXHRcdC8qIFB1YmxpYyBBUElcblx0XHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvZG9jdW1lbnRhdGlvblxuXHRcdCovXG5cdFx0cmVnaXN0ZXJPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdElkU3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIG9iamVjdElkU3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0dmFyIHJlZ09iaiA9IHt9O1xuXHRcdFx0XHRyZWdPYmouaWQgPSBvYmplY3RJZFN0cjtcblx0XHRcdFx0cmVnT2JqLnN3ZlZlcnNpb24gPSBzd2ZWZXJzaW9uU3RyO1xuXHRcdFx0XHRyZWdPYmouZXhwcmVzc0luc3RhbGwgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0cmVnT2JqLmNhbGxiYWNrRm4gPSBjYWxsYmFja0ZuO1xuXHRcdFx0XHRyZWdPYmpBcnJbcmVnT2JqQXJyLmxlbmd0aF0gPSByZWdPYmo7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkob2JqZWN0SWRTdHIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHtcblx0XHRcdFx0Y2FsbGJhY2tGbih7c3VjY2VzczpmYWxzZSwgaWQ6b2JqZWN0SWRTdHJ9KTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGdldE9iamVjdEJ5SWQ6IGZ1bmN0aW9uKG9iamVjdElkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcblx0XHRcdHZhciBjYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHRcdGlmICh1YS53MyAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSAmJiBzd2ZVcmxTdHIgJiYgcmVwbGFjZUVsZW1JZFN0ciAmJiB3aWR0aFN0ciAmJiBoZWlnaHRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIGZhbHNlKTtcblx0XHRcdFx0YWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdpZHRoU3RyICs9IFwiXCI7IC8vIGF1dG8tY29udmVydCB0byBzdHJpbmdcblx0XHRcdFx0XHRoZWlnaHRTdHIgKz0gXCJcIjtcblx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0aWYgKGF0dE9iaiAmJiB0eXBlb2YgYXR0T2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBhdHRPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0YXR0W2ldID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHQuZGF0YSA9IHN3ZlVybFN0cjtcblx0XHRcdFx0XHRhdHQud2lkdGggPSB3aWR0aFN0cjtcblx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gaGVpZ2h0U3RyO1xuXHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRpZiAocGFyT2JqICYmIHR5cGVvZiBwYXJPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIHBhck9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRwYXJbal0gPSBwYXJPYmpbal07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmbGFzaHZhcnNPYmogJiYgdHlwZW9mIGZsYXNodmFyc09iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrIGluIGZsYXNodmFyc09iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgZmxhc2h2YXJzT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihzd2ZWZXJzaW9uU3RyKSkgeyAvLyBjcmVhdGUgU1dGXG5cdFx0XHRcdFx0XHR2YXIgb2JqID0gY3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0XHRcdGlmIChhdHQuaWQgPT0gcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5yZWYgPSBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhpU3dmVXJsU3RyICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHRcdFx0XHRcdGF0dC5kYXRhID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHsgLy8gc2hvdyBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7XHR9XG5cdFx0fSxcblx0XHRzd2l0Y2hPZmZBdXRvSGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuXHRcdFx0YXV0b0hpZGVTaG93ID0gZmFsc2U7XG5cdFx0fSxcblx0XHR1YTogdWEsXG5cdFx0Z2V0Rmxhc2hQbGF5ZXJWZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7IG1ham9yOnVhLnB2WzBdLCBtaW5vcjp1YS5wdlsxXSwgcmVsZWFzZTp1YS5wdlsyXSB9O1xuXHRcdH0sXG5cdFx0aGFzRmxhc2hQbGF5ZXJWZXJzaW9uOiBoYXNQbGF5ZXJWZXJzaW9uLFxuXHRcdGNyZWF0ZVNXRjogZnVuY3Rpb24oYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2hvd0V4cHJlc3NJbnN0YWxsOiBmdW5jdGlvbihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHtcblx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlbW92ZVNXRjogZnVuY3Rpb24ob2JqRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmVtb3ZlU1dGKG9iakVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjcmVhdGVDU1M6IGZ1bmN0aW9uKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdGNyZWF0ZUNTUyhzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWRkRG9tTG9hZEV2ZW50OiBhZGREb21Mb2FkRXZlbnQsXG5cdFx0YWRkTG9hZEV2ZW50OiBhZGRMb2FkRXZlbnQsXG5cdFx0Z2V0UXVlcnlQYXJhbVZhbHVlOiBmdW5jdGlvbihwYXJhbSkge1xuXHRcdFx0dmFyIHEgPSBkb2MubG9jYXRpb24uc2VhcmNoIHx8IGRvYy5sb2NhdGlvbi5oYXNoO1xuXHRcdFx0aWYgKHEpIHtcblx0XHRcdFx0aWYgKC9cXD8vLnRlc3QocSkpIHsgcSA9IHEuc3BsaXQoXCI/XCIpWzFdOyB9IC8vIHN0cmlwIHF1ZXN0aW9uIG1hcmtcblx0XHRcdFx0aWYgKHBhcmFtID09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhaXJzID0gcS5zcGxpdChcIiZcIik7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocGFpcnNbaV0uc3Vic3RyaW5nKDAsIHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpKSA9PSBwYXJhbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHBhaXJzW2ldLnN1YnN0cmluZygocGFpcnNbaV0uaW5kZXhPZihcIj1cIikgKyAxKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fSxcblx0XHQvLyBGb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRcdGV4cHJlc3NJbnN0YWxsQ2FsbGJhY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGlzRXhwcmVzc0luc3RhbGxBY3RpdmUpIHtcblx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKEVYUFJFU1NfSU5TVEFMTF9JRCk7XG5cdFx0XHRcdGlmIChvYmogJiYgc3RvcmVkQWx0Q29udGVudCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdG9yZWRBbHRDb250ZW50LCBvYmopO1xuXHRcdFx0XHRcdGlmIChzdG9yZWRBbHRDb250ZW50SWQpIHtcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoc3RvcmVkQWx0Q29udGVudElkLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgc3RvcmVkQWx0Q29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiOyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9yZWRDYWxsYmFja0ZuKSB7IHN0b3JlZENhbGxiYWNrRm4oc3RvcmVkQ2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0oKTtcbm1vZHVsZS5leHBvcnRzID0gc3dmb2JqZWN0O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQHJldHVybnMge09yaWdpbmFsQ2xhc3N9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY2xlYXJJbnN0YW5jZSA9IGZ1bmN0aW9uKE9yaWdpbmFsQ2xhc3MpIHtcbiAgICB2YXIgQ2xlYXJDbGFzcyA9IGZ1bmN0aW9uKCl7fTtcbiAgICBDbGVhckNsYXNzLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuICAgIHJldHVybiBuZXcgQ2xlYXJDbGFzcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGVhckluc3RhbmNlO1xuIiwidmFyIGNsZWFySW5zdGFuY2UgPSByZXF1aXJlKCcuL2NsZWFyLWluc3RhbmNlJyk7XG5cbi8qKlxuICogQ2xhc3NpYyBFcnJvciBhY3RzIGxpa2UgYSBmYWJyaWM6IEVycm9yLmNhbGwodGhpcywgbWVzc2FnZSkganVzdCBjcmVhdGUgbmV3IG9iamVjdC5cbiAqIEVycm9yQ2xhc3MgYWN0cyBtb3JlIGxpa2UgYSBjbGFzczogRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpIG1vZGlmeSAndGhpcycgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIGVycm9yIG1lc3NhZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBbaWRdIC0gZXJyb3IgaWRcbiAqIEBleHRlbmRzIEVycm9yXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcnJvckNsYXNzID0gZnVuY3Rpb24obWVzc2FnZSwgaWQpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UsIGlkKTtcbiAgICBlcnIubmFtZSA9IHRoaXMubmFtZTtcblxuICAgIHRoaXMubWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIHRoaXMuc3RhY2sgPSBlcnIuc3RhY2s7XG59O1xuXG4vKipcbiAqIFN1Z2FyLiBKdXN0IGNyZWF0ZSBpbmhlcml0YW5jZSBmcm9tIEVycm9yQ2xhc3MgYW5kIGRlZmluZSBuYW1lIHByb3BlcnR5XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIG5hbWUgb2YgZXJyb3IgdHlwZVxuICogQHJldHVybnMge0Vycm9yQ2xhc3N9XG4gKi9cbkVycm9yQ2xhc3MuY3JlYXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBlcnJDbGFzcyA9IGNsZWFySW5zdGFuY2UoRXJyb3JDbGFzcyk7XG4gICAgZXJyQ2xhc3MubmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIGVyckNsYXNzO1xufTtcblxuRXJyb3JDbGFzcy5wcm90b3R5cGUgPSBjbGVhckluc3RhbmNlKEVycm9yKTtcbkVycm9yQ2xhc3MucHJvdG90eXBlLm5hbWUgPSBcIkVycm9yQ2xhc3NcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcnJvckNsYXNzO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2FzeW5jL2V2ZW50cycpO1xuXG4vL1RISU5LOiDQuNC30YPRh9C40YLRjCDQutCw0Log0YDQsNCx0L7RgtCw0LXRgiBFUyAyMDE1IFByb3h5INC4INC/0L7Qv9GA0L7QsdC+0LLQsNGC0Ywg0LjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMXG5cbi8qKlxuICogQGNsYXNzZGVzYyDQn9GA0L7QutGB0Lgt0LrQu9Cw0YHRgS4g0JLRi9C00LDRkdGCINC90LDRgNGD0LbRgyDQu9C40YjRjCDQv9GD0LHQu9C40YfQvdGL0LUg0LzQtdGC0L7QtNGLINC+0LHRitC10LrRgtCwINC4INGB0YLQsNGC0LjRh9C10YHQutC40LUg0YHQstC+0LnRgdGC0LLQsC5cbiAqINCd0LUg0LrQvtC/0LjRgNGD0LXRgiDQvNC10YLQvtC00Ysg0LjQtyBPYmplY3QucHJvdG90eXBlLiDQktGB0LUg0LzQtdGC0L7QtNGLINC40LzQtdGO0YIg0L/RgNC40LLRj9C30LrRgyDQutC+0L3RgtC10LrRgdGC0LAg0Log0L/RgNC+0LrRgdC40YDRg9C10LzQvtC80YMg0L7QsdGK0LXQutGC0YMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIC0g0L7QsdGK0LXQutGCLCDQutC+0YLQvtGA0YvQuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/RgNC+0LrRgdC40YDQvtCy0LDRgtGMXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBQcm94eSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgICAgICB8fCB0eXBlb2Ygb2JqZWN0W2tleV0gIT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgIHx8IG9iamVjdFtrZXldID09PSBPYmplY3QucHJvdG90eXBlW2tleV1cbiAgICAgICAgICAgICAgICB8fCBvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgICAgIHx8IEV2ZW50cy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzW2tleV0gPSBvYmplY3Rba2V5XS5iaW5kKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2JqZWN0LnBpcGVFdmVudHMpIHtcbiAgICAgICAgICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLm9uID0gRXZlbnRzLnByb3RvdHlwZS5vbjtcbiAgICAgICAgICAgIHRoaXMub25jZSA9IEV2ZW50cy5wcm90b3R5cGUub25jZTtcbiAgICAgICAgICAgIHRoaXMub2ZmID0gRXZlbnRzLnByb3RvdHlwZS5vZmY7XG4gICAgICAgICAgICB0aGlzLmNsZWFyTGlzdGVuZXJzID0gRXZlbnRzLnByb3RvdHlwZS5jbGVhckxpc3RlbmVycztcblxuICAgICAgICAgICAgb2JqZWN0LnBpcGVFdmVudHModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCt0LrRgdC/0L7RgNGC0LjRgNGD0LXRgiDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAg0LjQtyDQvtC00L3QvtCz0L4g0L7QsdGK0LXQutGC0LAg0LIg0LTRgNGD0LPQvtC5LCDQuNGB0LrQu9GO0YfQsNGPINGD0LrQsNC30LDQvdC90YvQtSwg0L/RgNC40LLQsNGC0L3Ri9C1INC4INC/0YDQvtGC0L7RgtC40L9cbiAqIEBwYXJhbSB7T2JqZWN0fSBmcm9tIC0g0L7RgtC60YPQtNCwINC60L7Qv9C40YDQvtCy0LDRgtGMXG4gKiBAcGFyYW0ge09iamVjdH0gdG8gLSDQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gW2V4Y2x1ZGVdIC0g0YHQstC+0LnRgdGC0LLQsCDQutC+0YLQvtGA0YvQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjRgdC60LvRjtGH0LjRgtGMXG4gKi9cblByb3h5LmV4cG9ydFN0YXRpYyA9IGZ1bmN0aW9uKGZyb20sIHRvLCBleGNsdWRlKSB7XG4gICAgZXhjbHVkZSA9IGV4Y2x1ZGUgfHwgW107XG5cbiAgICBPYmplY3Qua2V5cyhmcm9tKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBpZiAoIWZyb20uaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgfHwga2V5WzBdID09PSBcIl9cIlxuICAgICAgICAgICAgfHwga2V5ID09PSBcInByb3RvdHlwZVwiXG4gICAgICAgICAgICB8fCBleGNsdWRlLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L/RgNC+0LrRgdC4LdC/0LvQsNGB0YHQsCDQv9GA0LjQstGP0LfQsNC90L3QvtCz0L4g0Log0YPQutCw0LfQsNC90L3QvtC80YMg0LrQu9Cw0YHRgdGDLiDQnNC+0LbQvdC+INC90LDQt9C90LDRh9C40YLRjCDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgS5cbiAqINCjINGA0L7QtNC40YLQtdC70YzRgdC60L7Qs9C+INC60LvQsNGB0YHQsCDQv9C+0Y/QstC70Y/QtdGC0YHRjyDQv9GA0LjQstCw0YLQvdGL0Lkg0LzQtdGC0L7QtCBfcHJveHksINC60L7RgtC+0YDRi9C5INCy0YvQtNCw0ZHRgiDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCINC00LvRj1xuICog0LTQsNC90L3QvtCz0L4g0Y3QutC30LXQvNC70Y/RgNCwLiDQotCw0LrQttC1INC/0L7Rj9Cy0LvRj9C10YLRgdGPINGB0LLQvtC50YHRgtCy0L4gX19wcm94eSwg0YHQvtC00LXRgNC20LDRidC10LUg0YHRgdGL0LvQutGDINC90LAg0YHQvtC30LTQsNC90L3Ri9C5INC/0YDQvtC60YHQuC3QvtCx0YrQtdC60YJcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C5INC60LvQsNGB0YFcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFtQYXJlbnRQcm94eUNsYXNzPVByb3h5XSAtINGA0L7QtNC40YLQtdC70YzRgdC60LjQuSDQutC70LDRgdGBXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IC0tINC60L7QvdGB0YLRgNGD0YLQvtGAINC/0YDQvtC60YHQuNGA0L7QstCw0L3QvdC+0LPQviDQutC70LDRgdGB0LBcbiAqL1xuUHJveHkuY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbihPcmlnaW5hbENsYXNzLCBQYXJlbnRQcm94eUNsYXNzKSB7XG5cbiAgICB2YXIgUHJveHlDbGFzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuXG4gICAgICAgIHZhciBvcmlnaW5hbCA9IG5ldyBPcmlnaW5hbENsYXNzQ29uc3RydWN0b3IoKTtcbiAgICAgICAgT3JpZ2luYWxDbGFzcy5hcHBseShvcmlnaW5hbCwgYXJndW1lbnRzKTtcblxuICAgICAgICByZXR1cm4gb3JpZ2luYWwuX3Byb3h5KCk7XG4gICAgfTtcblxuICAgIHZhciBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IgPSBmdW5jdGlvbigpIHt9O1xuICAgIFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSAoUGFyZW50UHJveHlDbGFzcyB8fCBQcm94eSkucHJvdG90eXBlO1xuICAgIFByb3h5Q2xhc3MucHJvdG90eXBlID0gbmV3IFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3RvcigpO1xuXG4gICAgdmFyIHZhbDtcbiAgICBmb3IgKHZhciBrIGluIE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlKSB7XG4gICAgICAgIHZhbCA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlW2tdO1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZVtrXSA9PSB2YWwgfHwgdHlwZW9mIHZhbCA9PT0gXCJmdW5jdGlvblwiIHx8IGtbMF0gPT09IFwiX1wiKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtrXSA9IHZhbDtcbiAgICB9XG5cbiAgICB2YXIgY3JlYXRlUHJveHkgPSBmdW5jdGlvbihvcmlnaW5hbCkge1xuICAgICAgICB2YXIgcHJvdG8gPSBQcm94eS5wcm90b3R5cGU7XG4gICAgICAgIFByb3h5LnByb3RvdHlwZSA9IFByb3h5Q2xhc3MucHJvdG90eXBlO1xuICAgICAgICB2YXIgcHJveHkgPSBuZXcgUHJveHkob3JpZ2luYWwpO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBwcm90bztcbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgIH07XG5cbiAgICBPcmlnaW5hbENsYXNzLnByb3RvdHlwZS5fcHJveHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9fcHJveHkpIHtcbiAgICAgICAgICAgIHRoaXMuX19wcm94eSA9IGNyZWF0ZVByb3h5KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX19wcm94eTtcbiAgICB9O1xuXG4gICAgUHJveHkuZXhwb3J0U3RhdGljKE9yaWdpbmFsQ2xhc3MsIFByb3h5Q2xhc3MpO1xuXG4gICAgcmV0dXJuIFByb3h5Q2xhc3M7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5O1xuIiwiLyoqXG4gKiDQodC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAg0LLRgdC10YUg0L/QtdGA0LXRh9C40YHQu9C10L3QvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQsiDQvtC00LjQvS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIC0g0LXRgdC70Lgg0L/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIgdHJ1ZSwg0YLQviDQvdC+0LLRi9C5INC+0LHRitC10LrRgiDQvdC1INGB0L7Qt9C00LDRkdGC0YHRjywg0LAg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC00LDQvdC90YvQuVxuICogQHBhcmFtIHsuLi5PYmplY3R8Qm9vbGVhbn0gYXJncyAtINGB0L/QuNGB0L7QuiDQvtCx0YrQtdC60YLQvtCyINC40Lcg0LrQvtGC0L7RgNGL0YUg0LrQvtC/0LjRgNC+0LLQsNGC0Ywg0YHQstC+0LnRgdGC0LLQsC4g0J/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIg0LzQvtC20LXRgiDQsdGL0YLRjCDQu9C40LHQvlxuICog0L7QsdGK0LXQutGC0L7QvCwg0LvQuNCx0L4gdHJ1ZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbWVyZ2UgPSBmdW5jdGlvbiAoaW5pdGlhbCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGtleTtcblxuICAgIGlmIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IHRydWUpIHtcbiAgICAgICAgb2JqZWN0ID0gaW5pdGlhbDtcbiAgICAgICAgYXJncy5wb3AoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICAgICAgZm9yIChrZXkgaW4gaW5pdGlhbCkge1xuICAgICAgICAgICAgaWYgKGluaXRpYWwuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gaW5pdGlhbFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBhcmdzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBmb3IgKGtleSBpbiBhcmdzW2tdKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1trXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBhcmdzW2tdW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInJlcXVpcmUoJy4uLy4uLy4uL2V4cG9ydCcpO1xuXG52YXIgTG9hZGVyRXJyb3IgPSByZXF1aXJlKCcuL2xvYWRlci1lcnJvcicpO1xuXG55YS5tdXNpYy5BdWRpby5Mb2FkZXJFcnJvciA9IExvYWRlckVycm9yO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi8uLi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQvtC6INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uTG9hZGVyRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC60LhcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9hZGVyRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkxvYWRlckVycm9yLnByb3RvdHlwZSA9IEVycm9yQ2xhc3MuY3JlYXRlKFwiTG9hZGVyRXJyb3JcIik7XG5cbi8qKlxuICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5USU1FT1VUID0gXCJyZXF1ZXN0IHRpbWVvdXRcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC30LDQv9GA0L7RgdCwINC90LAg0LfQsNCz0YDRg9C30LrRg1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5GQUlMRUQgPSBcInJlcXVlc3QgZmFpbGVkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gTG9hZGVyRXJyb3I7XG4iLCIvKipcbiAqINCX0LDQs9C70YPRiNC60LAg0LIg0LLQuNC00LUg0L/Rg9GB0YLQvtC5INGE0YPQvdC60YbQuNC4INC90LAg0LLRgdC1INGB0LvRg9GH0LDQuCDQttC40LfQvdC4XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbm9vcDtcbiIsInJlcXVpcmUoXCIuLi9leHBvcnRcIik7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG55YS5tdXNpYy5BdWRpby5Mb2dnZXIgPSBMb2dnZXI7XG4iLCJ2YXIgTEVWRUxTID0gW1wiZGVidWdcIiwgXCJsb2dcIiwgXCJpbmZvXCIsIFwid2FyblwiLCBcImVycm9yXCIsIFwidHJhY2VcIl07XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL2xpYi9ub29wJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGB0YLRgNCw0LjQstCw0LXQvNGL0LUg0LvQvtCz0LPQtdGAINC00LvRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLkxvZ2dlclxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwgLSDQuNC80Y8g0LrQsNC90LDQu9CwLCDQt9CwINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0L7RgtCy0LXRh9Cw0YLRjCDRjdC60LfQtdC80LvRj9GAINC70L7Qs9Cz0LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIExvZ2dlciA9IGZ1bmN0aW9uKGNoYW5uZWwpIHtcbiAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgdGC0YDQvtC50LrQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQuNCz0L3QvtGA0LjRgNGD0LXQvNGL0YUg0LrQsNC90LDQu9C+0LJcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmlnbm9yZXMgPSBbXTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINCyINC60L7QvdGB0L7Qu9C4INGD0YDQvtCy0L3QtdC5INC70L7Qs9CwXG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKi9cbkxvZ2dlci5sb2dMZXZlbHMgPSBbXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0LjQvdGC0LDQutGB0LjRh9C10YHQutC40Lkg0YHQsNGF0LDRgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKipkZWJ1ZyoqXG4gKiBAbWV0aG9kIHlhLm11c2ljLkF1ZGlvLkxvZ2dlciNkZWJ1Z1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmRlYnVnID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqbG9nKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI2xvZ1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmxvZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmluZm8qKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjaW5mb1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmluZm8gPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip3YXJuKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI3dhcm5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS53YXJuID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZXJyb3IqKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjZXJyb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5lcnJvciA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKnRyYWNlKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI3RyYWNlXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUudHJhY2UgPSBub29wO1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCX0LDQv9C40YHRjCDQtNCw0L3QvdGL0YUg0LIg0LvQvtCzXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQtNC10LvQsNGC0Ywg0LfQsNC/0LjRgdGMINCyINC70L7Qs1xuICogQHBhcmFtIHtTdHJpbmd9IGxldmVsIC0g0YPRgNC+0LLQtdC90Ywg0LvQvtCz0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBjaGFubmVsIC0g0LrQsNC90LDQu1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIubG9nID0gZnVuY3Rpb24obGV2ZWwsIGNoYW5uZWwsIGNvbnRleHQpIHtcbiAgICB2YXIgZGF0YSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKS5tYXAoZnVuY3Rpb24oZHVtcEl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGR1bXBJdGVtICYmIGR1bXBJdGVtLl9sb2dnZXIgJiYgZHVtcEl0ZW0uX2xvZ2dlcigpIHx8IGR1bXBJdGVtO1xuICAgIH0pO1xuXG4gICAgdmFyIGxvZ0VudHJ5ID0ge1xuICAgICAgICB0aW1lc3RhbXA6ICtuZXcgRGF0ZSgpLFxuICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgIGNoYW5uZWw6IGNoYW5uZWwsXG4gICAgICAgIGNvbnRleHQ6IGNvbnRleHQsXG4gICAgICAgIG1lc3NhZ2U6IGRhdGFcbiAgICB9O1xuXG4gICAgaWYgKExvZ2dlci5pZ25vcmVzW2NoYW5uZWxdIHx8IExvZ2dlci5sb2dMZXZlbHMuaW5kZXhPZihsZXZlbCkgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBMb2dnZXIuX2R1bXBFbnRyeShsb2dFbnRyeSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LPQtVxuICogQHR5cGVkZWYge09iamVjdH0geWEubXVzaWMuQXVkaW8uTG9nZ2VyfkxvZ0VudHJ5XG4gKlxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHRpbWVzdGFtcCAtINCy0YDQtdC80Y8g0LIgdGltZXN0YW1wINGE0L7RgNC80LDRgtC1XG4gKiBAcHJvcGVydHkge1N0cmluZ30gbGV2ZWwgLSDRg9GA0L7QstC10L3RjCDQu9C+0LPQsFxuICogQHByb3BlcnR5IHtTdHJpbmd9IGNoYW5uZWwgLSDQutCw0L3QsNC7XG4gKiBAcHJvcGVydHkge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcHJvcGVydHkge0FycmF5fSBtZXNzYWdlIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5cbi8qKlxuICog0JfQsNC/0LjRgdCw0YLRjCDRgdC+0L7QsdGJ0LXQvdC40LUg0LvQvtCz0LAg0LIg0LrQvtC90YHQvtC70YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW8uTG9nZ2VyfkxvZ0VudHJ5fSBsb2dFbnRyeSAtINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsFxuICogQHByaXZhdGVcbiAqL1xuTG9nZ2VyLl9kdW1wRW50cnkgPSBmdW5jdGlvbihsb2dFbnRyeSkge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBsZXZlbCA9IGxvZ0VudHJ5LmxldmVsO1xuXG4gICAgICAgIHZhciBuYW1lID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC50YXNrTmFtZSB8fCBsb2dFbnRyeS5jb250ZXh0Lm5hbWUpO1xuICAgICAgICB2YXIgY29udGV4dCA9IGxvZ0VudHJ5LmNvbnRleHQgJiYgKGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlciA/IGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlcigpIDogXCJcIik7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlW2xldmVsXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgbGV2ZWwudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlW2xldmVsXS5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAobG9nRW50cnkudGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgICBcIltcIiArIGxvZ0VudHJ5LmNoYW5uZWwgKyAobmFtZSA/IFwiOlwiICsgbmFtZSA6IFwiXCIpICsgXCJdXCIsXG4gICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgXS5jb25jYXQobG9nRW50cnkubWVzc2FnZSkpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0YTQvtGA0LzQsNGC0LjRgNC+0LLQsNC90LjRjyDQtNCw0YLRiyDQtNC70Y8g0LLRi9Cy0L7QtNCwINCyINC60L7QvdC+0YHQvtC70YxcbiAqIEBwYXJhbSB0aW1lc3RhbXBcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIHZhciBkYXRlID0gbmV3IERhdGUodGltZXN0YW1wKTtcbiAgICB2YXIgbXMgPSBkYXRlLmdldE1pbGxpc2Vjb25kcygpO1xuICAgIG1zID0gbXMgPiAxMDAgPyBtcyA6IG1zID4gMTAgPyBcIjBcIiArIG1zIDogXCIwMFwiICsgbXM7XG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKCkgKyBcIi5cIiArIG1zO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iXX0=
