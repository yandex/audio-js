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

/** Событие начала воспроизведения
 * @event ya.music.Audio#EVENT_PLAY
 */
/** Событие завершения воспроизведения
 * @event ya.music.Audio#EVENT_ENDED
 */
/** Событие изменения громкости
 * @event ya.music.Audio#EVENT_VOLUME
 * @param {Number} volume - громкость
 */
/** Событие краха плеера
 * @event ya.music.Audio#EVENT_CRASHED
 */
/** Событие смены статуса плеера
 * @event ya.music.Audio#EVENT_STATE
 * @param {String} state - новый статус плеера
 */
/** Событие переключения активного плеера и прелоадера
 * @event ya.music.Audio#EVENT_SWAP
 */

// =================================================================

//  JSDOC: события активного плеера

// =================================================================

/** Событие остановки воспроизведения
 * @event ya.music.Audio#EVENT_STOP
 */
/** Событие паузы воспроизведения
 * @event ya.music.Audio#EVENT_PAUSE
 */
/** Событие обновления позиции воспроизведения/загруженной части
 * @event ya.music.Audio#EVENT_PROGRESS
 * @param {ya.music.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека
 * @event ya.music.Audio#EVENT_LOADING
 */
/** Событие завершения загрузки трека
 * @event ya.music.Audio#EVENT_LOADED
 */
/** Событие ошибки воспроизведения
 * @event ya.music.Audio#EVENT_ERROR
 */

// =================================================================

//  JSDOC: события предзагрузчика

// =================================================================

/** Событие остановки воспроизведения
 * @event ya.music.Audio#PRELOADER_EVENT+EVENT_STOP
 */
/** Событие обновления позиции загруженной части
 * @event ya.music.Audio#PRELOADER_EVENT+EVENT_PROGRESS
 * @param {ya.music.Audio~AudioPlayerTimes} times - информация о временных данных трека
 */
/** Событие начала загрузки трека
 * @event ya.music.Audio#PRELOADER_EVENT+EVENT_LOADING
 */
/** Событие завершения загрузки трека
 * @event ya.music.Audio#PRELOADER_EVENT+EVENT_LOADED
 */
/** Событие ошибки воспроизведения
 * @event ya.music.Audio#PRELOADER_EVENT+EVENT_ERROR
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
    this._played = 0;
    this._lastSkip = 0;
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
    logger.debug(this, "setVolume", volume);

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

},{"./audio-static":4,"./config":5,"./error/audio-error":6,"./flash/audio-flash":10,"./html5/audio-html5":26,"./lib/async/deferred":28,"./lib/async/events":29,"./lib/async/promise":30,"./lib/async/reject":31,"./lib/browser/detect":32,"./lib/data/merge":37,"./logger/logger":42}],4:[function(require,module,exports){
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
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"]
    }
};

module.exports = config;

},{}],6:[function(require,module,exports){
var ErrorClass = require('../lib/class/error-class');

/**
 * @classdesc Класс ошибки аудио-пллеера
 * @alias ya.music.Audio.AudioError
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
    //logger.debug(this, fn, arguments);

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
    if (this.state === "failed") {
        logger.warn(this, "onEventFailed", event, id, offset, data);
        return;
    }

    if (event === FlashManager.EVENT_DEBUG) {
        logger.info(this, "flashDEBUG", id, offset, data);
    } else if (event === FlashManager.EVENT_ERROR) {
        logger.warn(this, "flashError", id, offset, data);
    } else {
        logger.debug(this, "onEvent", event, id, offset);
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
 * Ограничение в 0.01 подобрано эмпирически.
 * @type {number}
 */
volumeLib.EPSILON = 0.01;

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

    if (this.audio.error.code == 2) {
        logger.warn(this, "Network error. Restarting...", this.src);
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
    logger.debug(this, "play", src);

    var loader = this._getLoader();

    loader.load(src);
    loader.play(0);
};

/** Поставить трек на паузу */
AudioHTML5.prototype.pause = function() {
    logger.debug(this, "pause");
    var loader = this._getLoader();
    loader.pause();
};

/** Снять трек с паузы */
AudioHTML5.prototype.resume = function() {
    logger.debug(this, "resume");
    var loader = this._getLoader();
    loader.play();
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
AudioHTML5.prototype.stop = function(offset) {
    logger.debug(this, "stop", offset);
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
    logger.debug(this, "setPosition", position);
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
    logger.debug(this, "setVolume", volume);
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
    logger.debug(this, "preload", src, offset);

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
    logger.debug(this, "playPreloaded", offset);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LmJhbmRzLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci1iYW5kLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXItc3RhdGljLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2V4cG9ydC5qcyIsInNyYy9meC9leHBvcnQuanMiLCJzcmMvZngvdm9sdW1lL2V4cG9ydC5qcyIsInNyYy9meC92b2x1bWUvdm9sdW1lLWxpYi5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9jbGVhci1pbnN0YW5jZS5qcyIsInNyYy9saWIvY2xhc3MvZXJyb3ItY2xhc3MuanMiLCJzcmMvbGliL2NsYXNzL3Byb3h5LmpzIiwic3JjL2xpYi9kYXRhL21lcmdlLmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yLmpzIiwic3JjL2xpYi9ub29wLmpzIiwic3JjL2xvZ2dlci9leHBvcnQuanMiLCJzcmMvbG9nZ2VyL2xvZ2dlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzErQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyS0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyoqXG4gKiBAbW9kdWxlIHZvd1xuICogQGF1dGhvciBGaWxhdG92IERtaXRyeSA8ZGZpbGF0b3ZAeWFuZGV4LXRlYW0ucnU+XG4gKiBAdmVyc2lvbiAwLjQuMTBcbiAqIEBsaWNlbnNlXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTCBsaWNlbnNlczpcbiAqICAgKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogICAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcblxudmFyIHVuZGVmLFxuICAgIG5leHRUaWNrID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZm5zID0gW10sXG4gICAgICAgICAgICBlbnF1ZXVlRm4gPSBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbnMucHVzaChmbikgPT09IDE7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2FsbEZucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBmbnNUb0NhbGwgPSBmbnMsIGkgPSAwLCBsZW4gPSBmbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZucyA9IFtdO1xuICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm5zVG9DYWxsW2krK10oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGlmKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicpIHsgLy8gaWUxMCwgbm9kZWpzID49IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0SW1tZWRpYXRlKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzLm5leHRUaWNrKSB7IC8vIG5vZGVqcyA8IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgcHJvY2Vzcy5uZXh0VGljayhjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgTXV0YXRpb25PYnNlcnZlciA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyOyAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgaWYoTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgICAgICAgdmFyIG51bSA9IDEsXG4gICAgICAgICAgICAgICAgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcblxuICAgICAgICAgICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2FsbEZucykub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGEgOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIChub2RlLmRhdGEgPSAobnVtICo9IC0xKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZ2xvYmFsLnBvc3RNZXNzYWdlKSB7XG4gICAgICAgICAgICB2YXIgaXNQb3N0TWVzc2FnZUFzeW5jID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBjaGVja0FzeW5jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1Bvc3RNZXNzYWdlQXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5wb3N0TWVzc2FnZSgnX19jaGVja0FzeW5jJywgJyonKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuZGV0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc1Bvc3RNZXNzYWdlQXN5bmMpIHtcbiAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ19fcHJvbWlzZScgKyArbmV3IERhdGUsXG4gICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGUuZGF0YSA9PT0gbXNnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24gJiYgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcj9cbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgZ2xvYmFsLnBvc3RNZXNzYWdlKG1zZywgJyonKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbiAgICAgICAgaWYoJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpKSB7IC8vIGllNi1pZThcbiAgICAgICAgICAgIHZhciBjcmVhdGVTY3JpcHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdCA9IHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgKGRvYy5kb2N1bWVudEVsZW1lbnQgfHwgZG9jLmJvZHkpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGNyZWF0ZVNjcmlwdCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbihmbikgeyAvLyBvbGQgYnJvd3NlcnNcbiAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0VGltZW91dChjYWxsRm5zLCAwKTtcbiAgICAgICAgfTtcbiAgICB9KSgpLFxuICAgIHRocm93RXhjZXB0aW9uID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9LFxuICAgIGlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogIT09IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCc7XG4gICAgfSxcbiAgICB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsXG4gICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiB0b1N0ci5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfSxcbiAgICBnZXRBcnJheUtleXMgPSBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdLFxuICAgICAgICAgICAgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7XG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGkrKyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGdldE9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICBmb3IodmFyIGkgaW4gb2JqKSB7XG4gICAgICAgICAgICBvYmouaGFzT3duUHJvcGVydHkoaSkgJiYgcmVzLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGRlZmluZUN1c3RvbUVycm9yVHlwZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdmFyIHJlcyA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlcy5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgd3JhcE9uRnVsZmlsbGVkID0gZnVuY3Rpb24ob25GdWxmaWxsZWQsIGlkeCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICBvbkZ1bGZpbGxlZC5jYWxsKHRoaXMsIHZhbCwgaWR4KTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4vKipcbiAqIEBjbGFzcyBEZWZlcnJlZFxuICogQGV4cG9ydHMgdm93OkRlZmVycmVkXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgRGVmZXJyZWRgIGNsYXNzIGlzIHVzZWQgdG8gZW5jYXBzdWxhdGUgbmV3bHktY3JlYXRlZCBwcm9taXNlIG9iamVjdCBhbG9uZyB3aXRoIGZ1bmN0aW9ucyB0aGF0IHJlc29sdmUsIHJlamVjdCBvciBub3RpZnkgaXQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBkZXNjcmlwdGlvblxuICogWW91IGNhbiB1c2UgYHZvdy5kZWZlcigpYCBpbnN0ZWFkIG9mIHVzaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gKlxuICogYG5ldyB2b3cuRGVmZXJyZWQoKWAgZ2l2ZXMgdGhlIHNhbWUgcmVzdWx0IGFzIGB2b3cuZGVmZXIoKWAuXG4gKi9cbnZhciBEZWZlcnJlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgUHJvbWlzZSgpO1xufTtcblxuRGVmZXJyZWQucHJvdG90eXBlID0gLyoqIEBsZW5kcyBEZWZlcnJlZC5wcm90b3R5cGUgKi97XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb21pc2UgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc29sdmVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIidzdWNjZXNzJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlc29sdmUoJ3N1Y2Nlc3MnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlamVjdHMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLmZhaWwoZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICogICAgIC8vIHJlYXNvbiBpcyBcIidzb21ldGhpbmcgaXMgd3JvbmcnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIucmVqZWN0KCdzb21ldGhpbmcgaXMgd3JvbmcnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZvdy5pc1Byb21pc2UocmVhc29uKSkge1xuICAgICAgICAgICAgcmVhc29uID0gcmVhc29uLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHZhbCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZShyZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTm90aWZpZXMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5wcm9ncmVzcyhmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIicyMCUnXCIsIFwiJzQwJSdcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5ub3RpZnkoJzIwJScpO1xuICAgICAqIGRlZmVyLm5vdGlmeSgnNDAlJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgbm90aWZ5IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fbm90aWZ5KHZhbHVlKTtcbiAgICB9XG59O1xuXG52YXIgUFJPTUlTRV9TVEFUVVMgPSB7XG4gICAgUEVORElORyAgIDogMCxcbiAgICBSRVNPTFZFRCAgOiAxLFxuICAgIEZVTEZJTExFRCA6IDIsXG4gICAgUkVKRUNURUQgIDogM1xufTtcblxuLyoqXG4gKiBAY2xhc3MgUHJvbWlzZVxuICogQGV4cG9ydHMgdm93OlByb21pc2VcbiAqIEBkZXNjcmlwdGlvblxuICogVGhlIGBQcm9taXNlYCBjbGFzcyBpcyB1c2VkIHdoZW4geW91IHdhbnQgdG8gZ2l2ZSB0byB0aGUgY2FsbGVyIHNvbWV0aGluZyB0byBzdWJzY3JpYmUgdG8sXG4gKiBidXQgbm90IHRoZSBhYmlsaXR5IHRvIHJlc29sdmUgb3IgcmVqZWN0IHRoZSBkZWZlcnJlZC5cbiAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZXIgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kI3RoZS1wcm9taXNlLWNvbnN0cnVjdG9yIGZvciBkZXRhaWxzLlxuICogQGRlc2NyaXB0aW9uXG4gKiBZb3Ugc2hvdWxkIHVzZSB0aGlzIGNvbnN0cnVjdG9yIGRpcmVjdGx5IG9ubHkgaWYgeW91IGFyZSBnb2luZyB0byB1c2UgYHZvd2AgYXMgRE9NIFByb21pc2VzIGltcGxlbWVudGF0aW9uLlxuICogSW4gb3RoZXIgY2FzZSB5b3Ugc2hvdWxkIHVzZSBgdm93LmRlZmVyKClgIGFuZCBgZGVmZXIucHJvbWlzZSgpYCBtZXRob2RzLlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiBmdW5jdGlvbiBmZXRjaEpTT04odXJsKSB7XG4gKiAgICAgcmV0dXJuIG5ldyB2b3cuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QsIG5vdGlmeSkge1xuICogICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gKiAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICogICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICogICAgICAgICB4aHIuc2VuZCgpO1xuICogICAgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgICBpZih4aHIucmVzcG9uc2UpIHtcbiAqICAgICAgICAgICAgICAgICByZXNvbHZlKHhoci5yZXNwb25zZSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgICAgICBlbHNlIHtcbiAqICAgICAgICAgICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcigpKTtcbiAqICAgICAgICAgICAgIH1cbiAqICAgICAgICAgfTtcbiAqICAgICB9KTtcbiAqIH1cbiAqIGBgYFxuICovXG52YXIgUHJvbWlzZSA9IGZ1bmN0aW9uKHJlc29sdmVyKSB7XG4gICAgdGhpcy5fdmFsdWUgPSB1bmRlZjtcbiAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5QRU5ESU5HO1xuXG4gICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IFtdO1xuXG4gICAgaWYocmVzb2x2ZXIpIHsgLy8gTk9URTogc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID0gcmVzb2x2ZXIubGVuZ3RoO1xuXG4gICAgICAgIHJlc29sdmVyKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDE/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID4gMj9cbiAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICB9IDpcbiAgICAgICAgICAgICAgICB1bmRlZik7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUgPSAvKiogQGxlbmRzIFByb21pc2UucHJvdG90eXBlICovIHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZnVsZmlsbGVkIHByb21pc2Ugb3IgdGhlIHJlYXNvbiBpbiBjYXNlIG9mIHJlamVjdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyAhPT0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuRlVMRklMTEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVqZWN0ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgcmVhY3Rpb25zIHRvIHRoZSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9IEEgbmV3IHByb21pc2UsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vcHJvbWlzZXMtYXBsdXMvcHJvbWlzZXMtc3BlYyBmb3IgZGV0YWlsc1xuICAgICAqL1xuICAgIHRoZW4gOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLl9hZGRDYWxsYmFja3MoZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKHVuZGVmaW5lZCwgb25SZWplY3RlZClgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCAncmVhc29uJyBhcyBhcmd1bWVudCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgJ2NhdGNoJyA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKG51bGwsIG9uUmVqZWN0ZWQpYC4gSXQncyBhbHNvIGFuIGFsaWFzIGZvciBgY2F0Y2hgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0byBiZSBjYWxsZWQgd2l0aCB0aGUgdmFsdWUgYWZ0ZXIgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZmFpbCA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcmVzb2x2aW5nIHJlYWN0aW9uIChmb3IgYm90aCBmdWxmaWxsbWVudCBhbmQgcmVqZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbihvblJlc29sdmVkLCBjdHgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgIGNiID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uUmVzb2x2ZWQuY2FsbCh0aGlzLCBfdGhpcyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oY2IsIGNiLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcHJvZ3Jlc3MgcmVhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblByb2dyZXNzIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIHdoZW4gdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24ob25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIHVuZGVmLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMaWtlIGBwcm9taXNlLnRoZW5gLCBidXQgXCJzcHJlYWRzXCIgdGhlIGFycmF5IGludG8gYSB2YXJpYWRpYyB2YWx1ZSBoYW5kbGVyLlxuICAgICAqIEl0IGlzIHVzZWZ1bCB3aXRoIHRoZSBgdm93LmFsbGAgYW5kIHRoZSBgdm93LmFsbFJlc29sdmVkYCBtZXRob2RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gICAgICogICAgIC8vIGFyZzEgaXMgXCIxXCIsIGFyZzIgaXMgXCIndHdvJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCd0d28nKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBzcHJlYWQgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25GdWxmaWxsZWQuYXBwbHkodGhpcywgdmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgdGhlbmAsIGJ1dCB0ZXJtaW5hdGVzIGEgY2hhaW4gb2YgcHJvbWlzZXMuXG4gICAgICogSWYgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWQsIHRoaXMgbWV0aG9kIHRocm93cyBpdCdzIFwicmVhc29uXCIgYXMgYW4gZXhjZXB0aW9uIGluIGEgZnV0dXJlIHR1cm4gb2YgdGhlIGV2ZW50IGxvb3AuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAqIGRlZmVyLnJlamVjdChFcnJvcignSW50ZXJuYWwgZXJyb3InKSk7XG4gICAgICogZGVmZXIucHJvbWlzZSgpLmRvbmUoKTsgLy8gZXhjZXB0aW9uIHRvIGJlIHRocm93blxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHRoaXNcbiAgICAgICAgICAgIC50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpXG4gICAgICAgICAgICAuZmFpbCh0aHJvd0V4Y2VwdGlvbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIGluIGBkZWxheWAgbWlsbGlzZWNvbmRzIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZCxcbiAgICAgKiBvciBpbW1lZGlhdGVseSByZWplY3RlZCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkZWxheSA6IGZ1bmN0aW9uKGRlbGF5KSB7XG4gICAgICAgIHZhciB0aW1lcixcbiAgICAgICAgICAgIHByb21pc2UgPSB0aGlzLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZGVsYXkpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHByb21pc2UuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVqZWN0ZWQgaW4gYHRpbWVvdXRgIG1pbGxpc2Vjb25kc1xuICAgICAqIGlmIHRoZSBwcm9taXNlIGlzIG5vdCByZXNvbHZlZCBiZWZvcmVoYW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDEgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCg1MCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDIgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCgyMDApO1xuICAgICAqXG4gICAgICogc2V0VGltZW91dChcbiAgICAgKiAgICAgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICBkZWZlci5yZXNvbHZlKCdvaycpO1xuICAgICAqICAgICB9LFxuICAgICAqICAgICAxMDApO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0MS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgcmVqZWN0ZWQgaW4gNTBtc1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0Mi50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHByb21pc2VXaXRoVGltZW91dCB0byBiZSBmdWxmaWxsZWQgd2l0aCBcIidvaydcIiB2YWx1ZVxuICAgICAqIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHRpbWVvdXQgOiBmdW5jdGlvbih0aW1lb3V0KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QobmV3IHZvdy5UaW1lZE91dEVycm9yKCd0aW1lZCBvdXQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB0aW1lb3V0KTtcblxuICAgICAgICB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBkZWZlci5wcm9taXNlKCkuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgX3ZvdyA6IHRydWUsXG5cbiAgICBfcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodmFsID09PSB0aGlzKSB7XG4gICAgICAgICAgICB0aGlzLl9yZWplY3QoVHlwZUVycm9yKCdDYW5cXCd0IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEO1xuXG4gICAgICAgIGlmKHZhbCAmJiAhIXZhbC5fdm93KSB7IC8vIHNob3J0cGF0aCBmb3Igdm93LlByb21pc2VcbiAgICAgICAgICAgIHZhbC5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgIHZhbC5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCh2YWwudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgICAgIHZhbC50aGVuKFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoaXNPYmplY3QodmFsKSB8fCBpc0Z1bmN0aW9uKHZhbCkpIHtcbiAgICAgICAgICAgIHZhciB0aGVuO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGVuID0gdmFsLnRoZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoZW4uY2FsbChcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3JlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgfHwgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsKTtcbiAgICB9LFxuXG4gICAgX2Z1bGZpbGwgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWw7XG5cbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MsIHZhbCk7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX3JlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gcmVhc29uO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MsIHJlYXNvbik7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX25vdGlmeSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzLCB2YWwpO1xuICAgIH0sXG5cbiAgICBfYWRkQ2FsbGJhY2tzIDogZnVuY3Rpb24oZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgaWYob25SZWplY3RlZCAmJiAhaXNGdW5jdGlvbihvblJlamVjdGVkKSkge1xuICAgICAgICAgICAgY3R4ID0gb25SZWplY3RlZDtcbiAgICAgICAgICAgIG9uUmVqZWN0ZWQgPSB1bmRlZjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9uUHJvZ3Jlc3MgJiYgIWlzRnVuY3Rpb24ob25Qcm9ncmVzcykpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUHJvZ3Jlc3M7XG4gICAgICAgICAgICBvblByb2dyZXNzID0gdW5kZWY7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2I7XG5cbiAgICAgICAgaWYoIXRoaXMuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBpc0Z1bmN0aW9uKG9uRnVsZmlsbGVkKT8gb25GdWxmaWxsZWQgOiB1bmRlZiwgY3R4IDogY3R4IH07XG4gICAgICAgICAgICB0aGlzLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0aGlzLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgIGNiID0geyBkZWZlciA6IGRlZmVyLCBmbiA6IG9uUmVqZWN0ZWQsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5fc3RhdHVzIDw9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcy5wdXNoKHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblByb2dyZXNzLCBjdHggOiBjdHggfSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2NhbGxDYWxsYmFja3MgOiBmdW5jdGlvbihjYWxsYmFja3MsIGFyZykge1xuICAgICAgICB2YXIgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDtcbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlzUmVzb2x2ZWQgPSB0aGlzLmlzUmVzb2x2ZWQoKSxcbiAgICAgICAgICAgIGlzRnVsZmlsbGVkID0gdGhpcy5pc0Z1bGZpbGxlZCgpO1xuXG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGkgPSAwLCBjYiwgZGVmZXIsIGZuO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNiID0gY2FsbGJhY2tzW2krK107XG4gICAgICAgICAgICAgICAgZGVmZXIgPSBjYi5kZWZlcjtcbiAgICAgICAgICAgICAgICBmbiA9IGNiLmZuO1xuXG4gICAgICAgICAgICAgICAgaWYoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN0eCA9IGNiLmN0eCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGN0eD8gZm4uY2FsbChjdHgsIGFyZykgOiBmbihhcmcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0Z1bGZpbGxlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKGFyZykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLm5vdGlmeShhcmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuLyoqIEBsZW5kcyBQcm9taXNlICovXG52YXIgc3RhdGljTWV0aG9kcyA9IHtcbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsbCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYWxsKGl0ZXJhYmxlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGVuIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByYWNlIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbnlSZXNvbHZlZChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXNvbHZlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGhhdmUgYHZhbHVlYCdzIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuZm9yKHZhciBwcm9wIGluIHN0YXRpY01ldGhvZHMpIHtcbiAgICBzdGF0aWNNZXRob2RzLmhhc093blByb3BlcnR5KHByb3ApICYmXG4gICAgICAgIChQcm9taXNlW3Byb3BdID0gc3RhdGljTWV0aG9kc1twcm9wXSk7XG59XG5cbnZhciB2b3cgPSAvKiogQGV4cG9ydHMgdm93ICovIHtcbiAgICBEZWZlcnJlZCA6IERlZmVycmVkLFxuXG4gICAgUHJvbWlzZSA6IFByb21pc2UsXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IGRlZmVycmVkLiBUaGlzIG1ldGhvZCBpcyBhIGZhY3RvcnkgbWV0aG9kIGZvciBgdm93OkRlZmVycmVkYCBjbGFzcy5cbiAgICAgKiBJdCdzIGVxdWl2YWxlbnQgdG8gYG5ldyB2b3cuRGVmZXJyZWQoKWAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm93OkRlZmVycmVkfVxuICAgICAqL1xuICAgIGRlZmVyIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVmZXJyZWQoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudGhlbmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHdoZW4gOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LmNhc3QodmFsdWUpLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmZhaWxgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbih2YWx1ZSwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSwgdW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmFsd2F5c2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbih2YWx1ZSwgb25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuYWx3YXlzKG9uUmVzb2x2ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnByb2dyZXNzYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24odmFsdWUsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLnByb2dyZXNzKG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnNwcmVhZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5zcHJlYWQob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRvbmVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2b3cud2hlbih2YWx1ZSkuZG9uZShvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGB2YWx1ZWAgaXMgYSBwcm9taXNlLWxpa2Ugb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdm93LmlzUHJvbWlzZSgnc29tZXRoaW5nJyk7IC8vIHJldHVybnMgZmFsc2VcbiAgICAgKiB2b3cuaXNQcm9taXNlKHZvdy5kZWZlcigpLnByb21pc2UoKSk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIHZvdy5pc1Byb21pc2UoeyB0aGVuIDogZnVuY3Rpb24oKSB7IH0pOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpc1Byb21pc2UgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIGlzRnVuY3Rpb24odmFsdWUudGhlbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvZXJjZXMgdGhlIGdpdmVuIGB2YWx1ZWAgdG8gYSBwcm9taXNlLCBvciByZXR1cm5zIHRoZSBgdmFsdWVgIGlmIGl0J3MgYWxyZWFkeSBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGNhc3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgISF2YWx1ZS5fdm93P1xuICAgICAgICAgICAgdmFsdWUgOlxuICAgICAgICAgICAgdm93LnJlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS52YWx1ZU9mYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgdmFsdWVPZiA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNGdWxmaWxsZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc0Z1bGZpbGxlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzRnVsZmlsbGVkKT8gdmFsdWUuaXNGdWxmaWxsZWQoKSA6IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzUmVqZWN0ZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNSZWplY3RlZCk/IHZhbHVlLmlzUmVqZWN0ZWQoKSA6IGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1Jlc29sdmVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZXNvbHZlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVzb2x2ZWQpPyB2YWx1ZS5pc1Jlc29sdmVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciByZXMgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgcmVzLnJlc29sdmUodmFsdWUpO1xuICAgICAgICByZXR1cm4gcmVzLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIGZ1bGZpbGxlZCB3aXRoIHRoZSBmdWxmaWxsL3JlamVjdGlvbiB2YWx1ZSBvZiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmdWxmaWxsIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICAgICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuXG4gICAgICAgIGRlZmVyLnJlc29sdmUodmFsdWUpO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICBwcm9taXNlIDpcbiAgICAgICAgICAgIHByb21pc2UudGhlbihudWxsLCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVhc29uO1xuICAgICAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKiBJZiBgcmVhc29uYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VzIHRoZSBnaXZlbiBmdW5jdGlvbiBgZm5gIHdpdGggYXJndW1lbnRzIGBhcmdzYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICAgKiBAcGFyYW0gey4uLip9IFthcmdzXVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgcHJvbWlzZTEgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICogICAgIH0sICdvaycpLFxuICAgICAqICAgICBwcm9taXNlMiA9IHZvdy5pbnZva2UoZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICB0aHJvdyBFcnJvcigpO1xuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2UxLmlzRnVsZmlsbGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMS52YWx1ZU9mKCk7IC8vICdvaydcbiAgICAgKiBwcm9taXNlMi5pc1JlamVjdGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIGluc3RhbmNlIG9mIEVycm9yXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaW52b2tlIDogZnVuY3Rpb24oZm4sIGFyZ3MpIHtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWF4KGFyZ3VtZW50cy5sZW5ndGggLSAxLCAwKSxcbiAgICAgICAgICAgIGNhbGxBcmdzO1xuICAgICAgICBpZihsZW4pIHsgLy8gb3B0aW1pemF0aW9uIGZvciBWOFxuICAgICAgICAgICAgY2FsbEFyZ3MgPSBBcnJheShsZW4pO1xuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNhbGxBcmdzW2krK10gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKGNhbGxBcmdzP1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KGdsb2JhbCwgY2FsbEFyZ3MpIDpcbiAgICAgICAgICAgICAgICBmbi5jYWxsKGdsb2JhbCkpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggYXJyYXk6XG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKSwgM10pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJbMSwgMiwgM11cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggb2JqZWN0OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoeyBwMSA6IGRlZmVyMS5wcm9taXNlKCksIHAyIDogZGVmZXIyLnByb21pc2UoKSwgcDMgOiAzIH0pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJ7IHAxIDogMSwgcDIgOiAyLCBwMyA6IDMgfVwiIGhlcmVcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgyKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGxlbiA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSA9IGxlbjtcbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgICAgICAgICAgcmVzW2tleXNbaWR4XV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBpZighLS1pKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGxSZXNvbHZlZChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihwcm9taXNlMSwgcHJvbWlzZTIpIHtcbiAgICAgKiAgICAgcHJvbWlzZTEuaXNSZWplY3RlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTEudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ2Vycm9yJ1wiXG4gICAgICogICAgIHByb21pc2UyLmlzRnVsZmlsbGVkKCk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqICAgICBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIHJldHVybnMgXCInb2snXCJcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZWplY3QoJ2Vycm9yJyk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoJ29rJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsUmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGkgPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighaSkge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvblJlc29sdmVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLS1pIHx8IGRlZmVyLnJlc29sdmUoaXRlcmFibGUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIG9uUmVzb2x2ZWQsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICBhbGxQYXRpZW50bHkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbFJlc29sdmVkKGl0ZXJhYmxlKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLCBmdWxmaWxsZWRQcm9taXNlcyxcbiAgICAgICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCwgaSA9IDAsIGtleSwgcHJvbWlzZTtcblxuICAgICAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XG4gICAgICAgICAgICAgICAgcHJvbWlzZSA9IGl0ZXJhYmxlW2tleV07XG4gICAgICAgICAgICAgICAgaWYodm93LmlzUmVqZWN0ZWQocHJvbWlzZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcyB8fCAocmVqZWN0ZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSk7XG4gICAgICAgICAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMucHVzaChwcm9taXNlLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlc1trZXldID0gcHJvbWlzZS52YWx1ZU9mKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYoIXJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgKGZ1bGZpbGxlZFByb21pc2VzIHx8IChmdWxmaWxsZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSkpW2tleV0gPSB2b3cudmFsdWVPZihwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyByZWplY3RlZFByb21pc2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVsZmlsbGVkUHJvbWlzZXM7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpZiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFsbCBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXQgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgKHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcmVqZWN0ZWQgaXRlbSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSAwLCByZWFzb247XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpIHx8IChyZWFzb24gPSBlKTtcbiAgICAgICAgICAgICAgICArK2kgPT09IGxlbiAmJiBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBpcyBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnlSZXNvbHZlZCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChFcnJvcigpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBkZWZlci5yZWplY3QsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZGVsYXlgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbih2YWx1ZSwgZGVsYXkpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS5kZWxheShkZWxheSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRpbWVvdXRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odmFsdWUsIHRpbWVvdXQpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS50aW1lb3V0KHRpbWVvdXQpO1xuICAgIH0sXG5cbiAgICBfZm9yRWFjaCA6IGZ1bmN0aW9uKHByb21pc2VzLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4LCBrZXlzKSB7XG4gICAgICAgIHZhciBsZW4gPSBrZXlzPyBrZXlzLmxlbmd0aCA6IHByb21pc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIGkgPSAwO1xuXG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHZvdy53aGVuKFxuICAgICAgICAgICAgICAgIHByb21pc2VzW2tleXM/IGtleXNbaV0gOiBpXSxcbiAgICAgICAgICAgICAgICB3cmFwT25GdWxmaWxsZWQob25GdWxmaWxsZWQsIGkpLFxuICAgICAgICAgICAgICAgIG9uUmVqZWN0ZWQsXG4gICAgICAgICAgICAgICAgb25Qcm9ncmVzcyxcbiAgICAgICAgICAgICAgICBjdHgpO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIFRpbWVkT3V0RXJyb3IgOiBkZWZpbmVDdXN0b21FcnJvclR5cGUoJ1RpbWVkT3V0Jylcbn07XG5cbnZhciBkZWZpbmVBc0dsb2JhbCA9IHRydWU7XG5pZih0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB2b3c7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuaWYodHlwZW9mIG1vZHVsZXMgPT09ICdvYmplY3QnICYmIGlzRnVuY3Rpb24obW9kdWxlcy5kZWZpbmUpKSB7XG4gICAgbW9kdWxlcy5kZWZpbmUoJ3ZvdycsIGZ1bmN0aW9uKHByb3ZpZGUpIHtcbiAgICAgICAgcHJvdmlkZSh2b3cpO1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24ocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmRlZmluZUFzR2xvYmFsICYmIChnbG9iYWwudm93ID0gdm93KTtcblxufSkodGhpcyk7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9QbGF5ZXInKTtcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9wcm9taXNlJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbGliL2RhdGEvbWVyZ2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9yZWplY3QnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL2F1ZGlvLWVycm9yJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuL2F1ZGlvLXN0YXRpYycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutCwINC00L7RgdGC0YPQv9C90YvRhSDRgtC40L/QvtCyINGA0LXQsNC70LjQt9Cw0YbQuNC5INC4INC40YUg0L/RgNC40L7RgNC40YLQtdGC0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy9UT0RPOiDRgdC00LXQu9Cw0YLRjCDQuNC90YLQtdGA0YTQtdC50YEg0LTQu9GPINCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyDQvdC+0LLRi9GFINGC0LjQv9C+0LJcbnZhciBhdWRpb1R5cGVzID0ge1xuICAgIGh0bWw1OiByZXF1aXJlKCcuL2h0bWw1L2F1ZGlvLWh0bWw1JyksXG4gICAgZmxhc2g6IHJlcXVpcmUoJy4vZmxhc2gvYXVkaW8tZmxhc2gnKVxufTtcblxudmFyIGRldGVjdFN0cmluZyA9IFwiQFwiICsgZGV0ZWN0LnBsYXRmb3JtLnZlcnNpb24gK1xuICAgIFwiIFwiICsgZGV0ZWN0LnBsYXRmb3JtLm9zICtcbiAgICBcIjpcIiArIGRldGVjdC5icm93c2VyLm5hbWUgK1xuICAgIFwiL1wiICsgZGV0ZWN0LmJyb3dzZXIudmVyc2lvbjtcblxuYXVkaW9UeXBlcy5mbGFzaC5wcmlvcml0eSA9IDA7XG5hdWRpb1R5cGVzLmh0bWw1LnByaW9yaXR5ID0gY29uZmlnLmh0bWw1LmJsYWNrbGlzdC5zb21lKGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIGRldGVjdFN0cmluZy5tYXRjaChpdGVtKTsgfSkgPyAtMSA6IDE7XG5cbi8vSU5GTzog0L/RgNGP0Lwg0LIg0LzQvtC80LXQvdGCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INCy0YHQtdCz0L4g0LzQvtC00YPQu9GPINC90LXQu9GM0LfRjyDQv9C40YHQsNGC0Ywg0LIg0LvQvtCzIC0g0L7QvSDQv9GA0L7Qs9C70LDRgtGL0LLQsNC10YIg0YHQvtC+0LHRidC10L3QuNGPLCDRgi7Qui4g0LXRidGRINC90LXRgiDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC90LDRgdGC0YDQvtC40YLRjCDQu9C+0LPQs9C10YAuXG5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHtcbiAgICAgICAgZmxhc2g6IHtcbiAgICAgICAgICAgIGF2YWlsYWJsZTogYXVkaW9UeXBlcy5mbGFzaC5hdmFpbGFibGUsXG4gICAgICAgICAgICBwcmlvcml0eTogYXVkaW9UeXBlcy5mbGFzaC5wcmlvcml0eVxuICAgICAgICB9LFxuICAgICAgICBodG1sNToge1xuICAgICAgICAgICAgYXZhaWxhYmxlOiBhdWRpb1R5cGVzLmh0bWw1LmF2YWlsYWJsZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiBhdWRpb1R5cGVzLmh0bWw1LnByaW9yaXR5LFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0OiAhIWF1ZGlvVHlwZXMuaHRtbDUuYXVkaW9Db250ZXh0XG4gICAgICAgIH1cbiAgICB9LCBcImF1ZGlvVHlwZXNcIik7XG59LCAwKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDQstGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdGL0LUg0LrQu9Cw0YHRgdGLXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQntC/0LjRgdCw0L3QuNC1INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0L/Qu9C10LXRgNCwXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5tdXNpYy5BdWRpb35BdWRpb1BsYXllclRpbWVzXG4gKlxuICogQHByb3BlcnR5IHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBsb2FkZWQgLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAcHJvcGVydHkge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwbGF5ZWQgLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDQntCx0YnQuNC1INGB0L7QsdGL0YLQuNGPINC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX1BMQVlcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX0VOREVEXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfVk9MVU1FXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LPRgNC+0LzQutC+0YHRgtGMXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQutGA0LDRhdCwINC/0LvQtdC10YDQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX0NSQVNIRURcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INGB0LzQtdC90Ysg0YHRgtCw0YLRg9GB0LAg0L/Qu9C10LXRgNCwXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1RBVEVcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtINC90L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L/QtdGA0LXQutC70Y7Rh9C10L3QuNGPINCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0Lgg0L/RgNC10LvQvtCw0LTQtdGA0LBcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9TV0FQXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1RPUFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L/QsNGD0LfRiyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QQVVTRVxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPL9C30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX1BST0dSRVNTXG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfTE9BRElOR1xuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfTE9BREVEXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfRVJST1JcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgSlNET0M6INGB0L7QsdGL0YLQuNGPINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfU1RPUFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX1BST0dSRVNTXG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURJTkdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9MT0FERURcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfRVJST1JcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0JDRg9C00LjQvi3Qv9C70LXQtdGAINC00LvRjyDQsdGA0LDRg9C30LXRgNCwLlxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ByZWZlcnJlZFR5cGVdIC0gcHJlZmVycmVkIHBsYXllciB0eXBlIChodG1sNS9mbGFzaClcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFtvdmVybGF5XSAtIGRvbSBlbGVtZW50IHRvIHNob3cgZmxhc2hcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqIEBtaXhlcyBBdWRpb1N0YXRpY1xuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1RBVEVcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9TV0FQXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QQVVTRVxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0VSUk9SXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9TVE9QXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfTE9BREVEXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBBdWRpb1BsYXllciA9IGZ1bmN0aW9uKHByZWZlcnJlZFR5cGUsIG92ZXJsYXkpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnByZWZlcnJlZFR5cGUgPSBwcmVmZXJyZWRUeXBlO1xuICAgIHRoaXMub3ZlcmxheSA9IG92ZXJsYXk7XG4gICAgdGhpcy5zdGF0ZSA9IEF1ZGlvUGxheWVyLlNUQVRFX0lOSVQ7XG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fcGxheUlkID0gbnVsbDtcblxuICAgIHRoaXMuX3doZW5SZWFkeSA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5fd2hlblJlYWR5LnByb21pc2UoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImltcGxlbWVudGF0aW9uIGZvdW5kXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG5cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fcG9wdWxhdGVFdmVudHMoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG5cbiAgICAgICAgICAgIGlmICghb2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVk6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRU5ERUQ6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfU1dBUDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TVE9QOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJvbkVuZGVkXCIsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0lETEUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9QQVVTRTpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9DUkFTSEVEKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9JRExFKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04sIGUpO1xuXG4gICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0NSQVNIRUQpO1xuICAgICAgICB0aHJvdyBlO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLl9pbml0KDApO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb1BsYXllcik7XG5tZXJnZShBdWRpb1BsYXllciwgQXVkaW9TdGF0aWMsIHRydWUpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KHRgtCw0YLQuNC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0LTQvtGB0YLRg9C/0L3Ri9GFINC/0LvQtdC10YDQvtCyXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQHN0YXRpY1xuICovXG5BdWRpb1BsYXllci5pbmZvID0ge1xuICAgIGh0bWw1OiBhdWRpb1R5cGVzLmh0bWw1LmF2YWlsYWJsZSxcbiAgICBmbGFzaDogYXVkaW9UeXBlcy5mbGFzaC5hdmFpbGFibGVcbn07XG5cbi8qKlxuICog0JrQvtC90YLQtdC60YHRgiDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuICogQHR5cGUge0F1ZGlvQ29udGV4dH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuYXVkaW9Db250ZXh0ID0gYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHQ7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRj1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtINC90L7QstGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3NldFN0YXRlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0U3RhdGVcIiwgc3RhdGUpO1xuXG4gICAgaWYgKHN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QQVVTRUQgJiYgdGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGNoYW5nZWQgPSB0aGlzLnN0YXRlICE9PSBzdGF0ZTtcbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG5cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIm5ld1N0YXRlXCIsIHN0YXRlKTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvUGxheWVyLkVWRU5UX1NUQVRFLCBzdGF0ZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbcmV0cnk9MF0gLSDQutC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QulxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24ocmV0cnkpIHtcbiAgICByZXRyeSA9IHJldHJ5IHx8IDA7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfaW5pdFwiLCByZXRyeSk7XG5cbiAgICBpZiAoIXRoaXMuX3doZW5SZWFkeS5wZW5kaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocmV0cnkgPiBjb25maWcuYXVkaW8ucmV0cnkpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pO1xuICAgICAgICB0aGlzLl93aGVuUmVhZHkucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pKTtcbiAgICB9XG5cbiAgICB2YXIgaW5pdFNlcSA9IFtcbiAgICAgICAgYXVkaW9UeXBlcy5odG1sNSxcbiAgICAgICAgYXVkaW9UeXBlcy5mbGFzaFxuICAgIF0uc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIGlmIChhLmF2YWlsYWJsZSAhPT0gYi5hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmF2YWlsYWJsZSA/IC0xIDogMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYi5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgICAgIHZhciB0eXBlID0gaW5pdFNlcS5zaGlmdCgpO1xuXG4gICAgICAgIGlmICghdHlwZSkge1xuICAgICAgICAgICAgc2VsZi5faW5pdChyZXRyeSArIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5faW5pdFR5cGUodHlwZSkudGhlbihzZWxmLl93aGVuUmVhZHkucmVzb2x2ZSwgaW5pdCk7XG4gICAgfVxuXG4gICAgaW5pdCgpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwINGBINGD0LrQsNC30LDQvdC90YvQvCDRgtC40L/QvtC8XG4gKiBAcGFyYW0ge3t0eXBlOiBzdHJpbmcsIEF1ZGlvSW1wbGVtZW50YXRpb246IGZ1bmN0aW9ufX0gdHlwZSAtINC+0LHRitC10LrRgiDQvtC/0LjRgdCw0L3QuNGPINGC0LjQv9CwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXRUeXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX2luaXRUeXBlXCIsIHR5cGUpO1xuXG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdHJ5IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LXQutGD0YnQsNGPINGA0LXQsNC70LjQt9Cw0YbQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtJQXVkaW9JbXBsZW1lbnRhdGlvbnxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbiA9IG5ldyB0eXBlLkF1ZGlvSW1wbGVtZW50YXRpb24odGhpcy5vdmVybGF5KTtcbiAgICAgICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24ud2hlblJlYWR5KSB7XG4gICAgICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeS50aGVuKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGUpO1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIl9pbml0VHlwZUVycm9yXCIsIHR5cGUsIGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQvtC00L3QvtC8INC40Lcg0YHQv9C40YHQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uIC0g0L3QsNC30LLQsNC90LjQtSDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZXNvbHZlIC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0YDQsNC30YDQtdGI0LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gcmVqZWN0IC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvQuSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9IC0tINGC0LDQutC20LUg0YHQvtC30LTQsNGR0YIgRGVmZXJyZWQg0YHQstC+0LnRgdGC0LLQviDRgSDQvdCw0LfQstCw0L3QuNC10LwgX3doZW48QWN0aW9uPiwg0LrQvtGC0L7RgNC+0LUg0LbQuNCy0ZHRgiDQtNC+INC80L7QvNC10L3RgtCwINGA0LDQt9GA0LXRiNC10L3QuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3dhaXRFdmVudHMgPSBmdW5jdGlvbihhY3Rpb24sIHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXNbYWN0aW9uXSA9IGRlZmVycmVkO1xuXG4gICAgdmFyIGNsZWFudXBFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgc2VsZlthY3Rpb25dO1xuICAgIH07XG5cbiAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi5vbihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgfSk7XG5cbiAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBkYXRhIGluc3RhbmNlb2YgRXJyb3IgPyBkYXRhIDogbmV3IEF1ZGlvRXJyb3IoZGF0YSB8fCBldmVudCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFudXBFdmVudHMsIGNsZWFudXBFdmVudHMpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0KDQsNGB0YjQuNGA0LXQvdC40LUg0YHQvtCx0YvRgtC40Lkg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LAg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQvNC4INGB0LLQvtC50YHRgtCy0LDQvNC4LiDQn9C+0LTQv9C40YHRi9Cy0LDQtdGC0YHRjyDQvdCwINCy0YHQtSDRgdC+0LHRi9GC0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCxcbiAqINGC0YDQuNCz0LPQtdGA0LjRgiDQuNGC0L7Qs9C+0LLRi9C1INGB0L7QsdGL0YLQuNGPLCDRgNCw0LfQtNC10LvRj9GPINC40YUg0L/QviDRgtC40L/RgyDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgCwg0LTQvtC/0L7Qu9C90Y/QtdGCINGB0L7QsdGL0YLQuNGPINC00LDQvdC90YvQvNC4LlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSDQuNGB0YLQvtGH0L3QuNC6INGB0L7QsdGL0YLQuNGPLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y8uXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3BvcHVsYXRlRXZlbnRzID0gZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmIChldmVudCAhPT0gQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BvcHVsYXRlRXZlbnRzXCIsIGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH1cblxuICAgIHZhciBvdXRlckV2ZW50ID0gKG9mZnNldCA/IEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCA6IFwiXCIpICsgZXZlbnQ7XG5cbiAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZXJyb3JcIiwgb3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9WT0xVTUU6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIHRoaXMuZ2V0Vm9sdW1lKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1M6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aGlzLmdldER1cmF0aW9uKG9mZnNldCksXG4gICAgICAgICAgICAgICAgbG9hZGVkOiB0aGlzLmdldExvYWRlZChvZmZzZXQpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvZmZzZXQgPyAwIDogdGhpcy5nZXRQb3NpdGlvbigpLFxuICAgICAgICAgICAgICAgIHBsYXllZDogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UGxheWVkKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGJ0LjQtSDRhNGD0L3QutGG0LjQuCDRg9C/0YDQsNCy0LvQtdC90LjRjyDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKlxuIElORk86INC00LDQvdC90YvQuSDQvNC10YLQvtC0INCx0YvQu9C+INGA0LXRiNC10L3QviDQvtGB0YLQsNCy0LjRgtGMLCDRgi7Qui4g0Y3RgtC+INGD0LTQvtCx0L3QtdC1INGH0LXQvCDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSAtINC10YHRgtGMINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LIg0L3QsNGH0LDQu9C1XG4g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/QvtC70YPRh9C40YLRjCDRgdGA0LDQt9GDINGB0YHRi9C70LrRgyDQvdCwINGN0LrQt9C10LzQv9C70Y/RgCDQv9C70LXQtdGA0LAg0Lgg0L7QsdCy0LXRiNCw0YLRjCDQtdCz0L4g0L7QsdGA0LDQsdC+0YLRh9C40LrQsNC80Lgg0YHQvtCx0YvRgtC40LkuINCf0LvRjtGBINC6INGC0L7QvNGDINC/0YDQuFxuINGC0LDQutC+0Lwg0L/QvtC00YXQvtC00LUg0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGOINC00LXQu9Cw0YLRjCDQv9GA0L7RidC1IC0g0L/RgNC4INC90LXQuSDQvdC1INC/0YDQuNC00ZHRgtGB0Y8g0L/QtdGA0LXQvdCw0LfQvdCw0YfQsNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDQuCDQvtCx0L3QvtCy0LvRj9GC0Ywg0LLQtdC30LTQtSDRgdGB0YvQu9C60YNcbiDQvdCwINGC0LXQutGD0YnQuNC5INGN0LrQt9C10LzQv9C70Y/RgCDQv9C70LXQtdGA0LAuXG4gKi9cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0L7QsdC10YnQsNC90LjQtSwg0YDQsNC30YDQtdGI0LDRjtGJ0LXQtdGB0Y8g0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaW5pdFByb21pc2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVhZHk7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlO1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgtC40L8g0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRUeXBlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24gJiYgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlO1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDRgtC10LrRg9GJ0LjQuSDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSDQsdGA0LDRgtGMINGC0YDQtdC6INC40Lcg0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuNC70Lgg0LjQtyDQv9GA0LXQu9C+0LDQtNC10YDQsC4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC70L7QsNC00LXRgC5cbiAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0U3JjKG9mZnNldCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC10LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5XCIsIHNyYywgZHVyYXRpb24pO1xuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGxheShzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC30LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5nZXREdXJhdGlvbigpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuICAgIHRoaXMuc2V0UG9zaXRpb24oMCk7XG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgcmV0dXJuIHRoaXMucmVzdW1lKCk7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LrQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQu9C+0LDQtNC10YAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0b3BcIiwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcChvZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuU3RvcC5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblN0b3BcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1NUT1BdLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcCgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC90LAg0L/QsNGD0LfRg1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGF1c2VcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblBhdXNlLnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGF1c2VcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BBVVNFXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVksXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wYXVzZSgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0LjQtSDQv9C70LXQtdGA0LAg0YEg0L/QsNGD0LfRi1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlc3VtZVwiKTtcblxuICAgIGlmICh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HICYmICF0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIGlmICghKHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX0lETEUgfHwgdGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEXG4gICAgICAgIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZTtcblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInJlc3VtZVwiKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QbGF5LnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG5cbiAgICAgICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5yZXN1bWUoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPINC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3JjXSAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6LCDQtNC70Y8g0L/RgNC+0LLQtdGA0LrQuCwg0YfRgtC+INCyINC/0YDQtdC70L7QsNC00LXRgNC1INC90YPQttC90YvQuSDRgtGA0LXQulxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5UHJlbG9hZGVkXCIsIHNyYyk7XG5cbiAgICBpZiAoIXNyYykge1xuICAgICAgICBzcmMgPSB0aGlzLmdldFNyYygxKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNQcmVsb2FkZWQoc3JjKSkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInBsYXlQcmVsb2FkZWRCYWRUcmFja1wiLCBBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX2dlbmVyYXRlUGxheUlkKCk7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICB0aGlzLl93aGVuUGF1c2UucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHRoaXMuX3doZW5TdG9wLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QbGF5XCIsIFtBdWRpb1BsYXllci5FVkVOVF9QTEFZXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgIF0pO1xuICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QuYXBwbHkodGhpcy5fd2hlblBsYXksIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCk7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMuaW1wbGVtZW50YXRpb24ucGxheVByZWxvYWRlZCgpO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkRXJyb3JcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAuINCQ0LrRgtGD0LDQu9GM0L3QviDQtNC70Y8g0YTQu9C10Ygt0YDQtdCw0LvQuNC30LDRhtC40LgsINCyINC90LXQuSDQv9C+0LrQsCDRgtGA0LXQuiDQs9GA0YPQt9C40YLRgdGPXG4gKiDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0L7Qv9GA0LXQtNC10LvRj9C10YLRgdGPINGBINC/0L7Qs9GA0LXRiNC90L7RgdGC0YzRji5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBpZiAoZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gXCJtc2llXCIgJiYgZGV0ZWN0LmJyb3dzZXIudmVyc2lvblswXSA9PSBcIjlcIikge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCkpO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIGR1cmF0aW9uKTtcblxuICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QoXCJwcmVsb2FkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUHJlbG9hZFwiLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0xPQURJTkcsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVBcbiAgICBdLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQsXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9TVE9QXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QcmVsb2FkLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKDEpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wcmVsb2FkKHNyYywgZHVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttC10L1cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGVkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRpbmcoc3JjLCAxKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQotCw0LnQvNC40L3Qs9C4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0UG9zaXRpb24oKSB8fCAwO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQvdC+0LLQsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn0gLS0g0LrQvtC90LXRh9C90LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgPT0gXCJmbGFzaFwiKSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXRMb2FkZWQoKSAtIDEsIHBvc2l0aW9uKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmdldER1cmF0aW9uKCkgLSAxLCBwb3NpdGlvbikpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCArPSB0aGlzLmdldFBvc2l0aW9uKCkgLSB0aGlzLl9sYXN0U2tpcDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IHBvc2l0aW9uO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cbiAgICByZXR1cm4gcG9zaXRpb247XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtCb29sZWFufGludH0gcHJlbG9hZGVyIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbihwcmVsb2FkZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXREdXJhdGlvbihwcmVsb2FkZXIgPyAxIDogMCkgfHwgMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldExvYWRlZChwcmVsb2FkZXIgPyAxIDogMCkgfHwgMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5fcGxheWVkICs9IHBvc2l0aW9uIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHJldHVybiB0aGlzLl9wbGF5ZWQ7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0Vm9sdW1lKCk7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LrQsCDQs9GA0L7QvNC60L7RgdGC0Lgg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0L3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge051bWJlcn0gLS0g0LjRgtC+0LPQvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG5cbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0Vm9sdW1lKHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDQs9GA0L7QvNC60L7RgdGC0Ywg0YPQv9GA0LDQstC70Y/QtdGC0YHRjyDRg9GB0YLRgNC+0LnRgdGC0LLQvtC8LCDQsCDQvdC1INC/0YDQvtCz0YDQsNC80L3QvlxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc0RldmljZVZvbHVtZSgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS50b2dnbGVDcm9zc0RvbWFpbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSAhPT0gXCJodG1sNVwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlQ3Jvc3NEb21haW5GYWlsZWRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24udG9nZ2xlQ3Jvc3NEb21haW4oc3RhdGUpO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKlxuICogKirQktC90LjQvNCw0L3QuNC1ISoqIC0g0L/QvtGB0LvQtSDQstC60LvRjtGH0LXQvdC40Y8g0YDQtdC20LjQvNCwIFdlYiBBdWRpbyBBUEkg0L7QvSDQvdC1INC+0YLQutC70Y7Rh9Cw0LXRgtGB0Y8g0L/QvtC70L3QvtGB0YLRjNGOLCDRgi7Qui4g0LTQu9GPINGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPXG4gKiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLCDQutC+0YLQvtGA0L7QuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LrQu9C40Log0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GPLiDQn9GA0Lgg0L7RgtC60LvRjtGH0LXQvdC40Lgg0LjQtyDQs9GA0LDRhNCwINC+0LHRgNCw0LHQvtGC0LrQuCDQuNGB0LrQu9GO0YfQsNGO0YLRgdGPXG4gKiDQstGB0LUg0L3QvtC00Ysg0LrRgNC+0LzQtSDQvdC+0LQt0LjRgdGC0L7Rh9C90LjQutC+0LIg0Lgg0L3QvtC00Ysg0LLRi9Cy0L7QtNCwLCDRg9C/0YDQsNCy0LvQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0YzRjiDQv9C10YDQtdC60LvRjtGH0LDQtdGC0YHRjyDQvdCwINGN0LvQtdC80LXQvdGC0YsgYXVkaW8sINCx0LXQt1xuICog0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gR2Fpbk5vZGVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YFcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQuNGC0L7Qs9C+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSUZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24udG9nZ2xlV2ViQXVkaW9BUEkoc3RhdGUpO1xufTtcblxuLyoqXG4gKiDQkNGD0LTQuNC+LdC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHR5cGVkZWYge09iamVjdH0geWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3JcbiAqXG4gKiBAcHJvcGVydHkge0F1ZGlvTm9kZX0gaW5wdXQgLSDQvdC+0LTQsCwg0LIg0LrQvtGC0L7RgNGD0Y4g0L/QtdGA0LXQvdCw0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0LLRi9Cy0L7QtCDQsNGD0LTQuNC+XG4gKiBAcHJvcGVydHkge0F1ZGlvTm9kZX0gb3V0cHV0IC0g0L3QvtC00LAg0LjQtyDQutC+0YLQvtGA0L7QuSDQstGL0LLQvtC0INC/0L7QtNCw0ZHRgtGB0Y8g0L3QsCDRg9GB0LjQu9C40YLQtdC70YxcbiAqL1xuXG4vKipcbiAqINCf0L7QtNC60LvRjtGH0LXQvdC40LUg0LDRg9C00LjQviDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsC4g0JLRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6INCw0YPQtNC40L4t0Y3Qu9C10LzQtdC90YLRgyDRgyDQutC+0YLQvtGA0L7Qs9C+INCy0YvRgdGC0LDQstC70LXQvdCwXG4gKiAxMDAlINCz0YDQvtC80LrQvtGB0YLRjC4g0JLRi9GF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0LogR2Fpbk5vZGUsINC60L7RgtC+0YDQsNGPINGA0LXQs9GD0LvQuNGA0YPQtdGCINC40YLQvtCz0L7QstGD0Y4g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yfSBwcmVwcm9jZXNzb3IgLSDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YBcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDRgdGC0LDRgtGD0YEg0YPRgdC/0LXRhdCwXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRBdWRpb1ByZXByb2Nlc3NvciA9IGZ1bmN0aW9uKHByZXByb2Nlc3Nvcikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JcIik7XG4gICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSAhPT0gXCJodG1sNVwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JGYWlsZWRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnNldEF1ZGlvUHJlcHJvY2Vzc29yKHByZXByb2Nlc3Nvcik7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JvQvtCz0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JPQtdC90LXRgNCw0YbQuNGPIHBsYXlJZFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9nZW5lcmF0ZVBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BsYXlJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoKS5zbGljZSgyKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1IHBsYXlJZFxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wbGF5SWQ7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBpbmRleDogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLm5hbWUsXG4gICAgICAgIHNyYzogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLl9sb2dnZXIoKSxcbiAgICAgICAgdHlwZTogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGVcbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1BsYXllcjtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBBdWRpb1N0YXRpY1xuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvU3RhdGljID0ge307XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0Ki9cbkF1ZGlvU3RhdGljLkVWRU5UX1BMQVkgPSBcInBsYXlcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9TVE9QID0gXCJzdG9wXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSA9IFwicGF1c2VcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyA9IFwicHJvZ3Jlc3NcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURJTkcgPSBcImxvYWRpbmdcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQgPSBcImxvYWRlZFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FID0gXCJ2b2x1bWVjaGFuZ2VcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VOREVEID0gXCJlbmRlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUQVRFID0gXCJzdGF0ZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NXQVAgPSBcInN3YXBcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlBSRUxPQURFUl9FVkVOVCA9IFwicHJlbG9hZGVyOlwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfSU5JVCA9IFwiaW5pdFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JRExFID0gXCJpZGxlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUExBWUlORyA9IFwicGxheWluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX1BBVVNFRCA9IFwicGF1c2VkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9TdGF0aWM7XG4iLCIvKipcbiAqINCd0LDRgdGC0L7QudC60Lgg0LHQuNCx0LvQuNC+0YLQtdC60LhcbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpby5jb25maWdcbiAqIEBuYW1lc3BhY2VcbiAqL1xudmFyIGNvbmZpZyA9IHtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAg0J7QsdGJ0LjQtSDQvdCw0YHRgtGA0L7QudC60LhcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBhdWRpbzoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0JrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0Log0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICByZXRyeTogM1xuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gIEZsYXNoLdC/0LvQtdC10YBcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICovXG4gICAgZmxhc2g6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCf0YPRgtGMINC6IC5zd2Yg0YTQsNC50LvRgyDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHBhdGg6IFwiZGlzdFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPIC5zd2Yg0YTQsNC50LvQsCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIG5hbWU6IFwicGxheWVyLTJfMS5zd2ZcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCc0LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdmVyc2lvbjogXCI5LjAuMjhcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqIElELCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINCy0YvRgdGC0LDQstC70LXQvSDQtNC70Y8g0Y3Qu9C10LzQtdC90YLQsCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGxheWVySUQ6IFwiWWFuZGV4QXVkaW9GbGFzaFBsYXllclwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPINGE0YPQvdC60YbQuNC4LdC+0LHRgNCw0LHQvtGC0YfQuNC60LAg0YHQvtCx0YvRgtC40LkgZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgY2FsbGJhY2s6IFwieWEubXVzaWMuQXVkaW8uX2ZsYXNoQ2FsbGJhY2tcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBpbml0VGltZW91dDogMzAwMCwgLy8gMyBzZWNcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC30LDQs9GA0YPQt9C60LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGxvYWRUaW1lb3V0OiA1MDAwLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/QvtGB0LvQtSDQutC70LjQutCwXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBjbGlja1RpbWVvdXQ6IDEwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC90YLQtdGA0LLQsNC7INC/0YDQvtCy0LXRgNC60Lgg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGhlYXJ0QmVhdEludGVydmFsOiAxMDAwXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAgSFRNTDUt0L/Qu9C10LXRgFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCe0L/QuNGB0LDQvdC40LUg0L3QsNGB0YLRgNC+0LXQuiBodG1sNSDQv9C70LXQtdGA0LBcbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICovXG4gICAgaHRtbDU6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCh0L/QuNGB0L7QuiDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNC+0LIg0LTQu9GPINC60L7RgtC+0YDRi9GFINC70YPRh9GI0LUg0L3QtSDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgaHRtbDUg0L/Qu9C10LXRgC4g0JjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC/0YDQuFxuICAgICAgICAgKiDQsNCy0YLQvi3QvtC/0YDQtdC00LXQu9C10L3QuNC4INGC0LjQv9CwINC/0LvQtdC10YDQsC4g0JjQtNC10L3RgtC40YTQuNC60LDRgtC+0YDRiyDRgdGA0LDQstC90LjQstCw0Y7RgtGB0Y8g0YHQviDRgdGC0YDQvtC60L7QuSDQv9C+0YHRgtGA0L7QtdC90L3QvtC5INC/0L4g0YjQsNCx0LvQvtC90YNcbiAgICAgICAgICogYEA8cGxhdGZvcm0udmVyc2lvbj4gPHBsYXRmb3JtLm9zPjo8YnJvd3Nlci5uYW1lPi88YnJvd3Nlci52ZXJzaW9uPmBcbiAgICAgICAgICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICAgICAgICAgKi9cbiAgICAgICAgYmxhY2tsaXN0OiBbXCJsaW51eDptb3ppbGxhXCIsIFwidW5peDptb3ppbGxhXCIsIFwibWFjb3M6bW96aWxsYVwiLCBcIjpvcGVyYVwiLCBcIkBOVCA1XCIsIFwiQE5UIDRcIiwgXCI6bXNpZS85XCJdXG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjb25maWc7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LDRg9C00LjQvi3Qv9C70LvQtdC10YDQsFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLkF1ZGlvRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkF1ZGlvRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJBdWRpb0Vycm9yXCIpO1xuXG4vKipcbiAqINCd0LUg0L3QsNC50LTQtdC90LAg0YDQtdCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwINC40LvQuCDQstGB0LUg0LTQvtGB0YLRg9C/0L3Ri9C1INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0L7RgtC10YDQv9C10LvQuCDQutGA0LDRhSDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04gPSBcImNhbm5vdCBmaW5kIHN1aXRhYmxlIGltcGxlbWVudGF0aW9uXCI7XG4vKipcbiAqINCi0YDQtdC6INC90LUg0LHRi9C7INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvSDQuNC70Lgg0LLQviDQstGA0LXQvNGPINC30LDQs9GA0YPQt9C60Lgg0L/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEID0gXCJ0cmFjayBpcyBub3QgcHJlbG9hZGVkXCI7XG4vKipcbiAqINCU0LXQudGB0YLQstC40LUg0L3QtSDQtNC+0YHRgtGD0L/QvdC+INC40Lcg0YLQtdC60YPRidC10LPQviDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5CQURfU1RBVEUgPSBcImFjdGlvbiBpcyBub3QgcGVybWl0ZWQgZnJvbSBjdXJyZW50IHN0YXRlXCI7XG5cbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQsdGL0Lsg0LfQsNCx0LvQvtC60LjRgNC+0LLQsNC9XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfQkxPQ0tFUiA9IFwiZmxhc2ggaXMgcmVqZWN0ZWQgYnkgZmxhc2ggYmxvY2tlciBwbHVnaW5cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+INC90LXQuNC30LLQtdGB0YLQvdGL0Lwg0L/RgNC40YfQuNC90LDQvFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCA9IFwiZmxhc2ggaW5pdCB0aW1lZCBvdXRcIjtcbi8qKlxuICog0JLQvdGD0YLRgNC10L3QvdGP0Y8g0L7RiNC40LHQutCwIEZsYXNoLdC/0LvQtdC10YDQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SID0gXCJmbGFzaCBpbnRlcm5hbCBlcnJvclwiO1xuLyoqXG4gKiDQn9C+0L/Ri9GC0LrQsCDQstGL0LfQstCw0YLRjCDQvdC10LTQvtGB0YLRg9C/0L3Ri9C5INGN0LrQt9C10LzQu9GP0YAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElORyA9IFwiZmxhc2ggcGxheWVyIGRvZXNuJ3QgcmVzcG9uc2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0Vycm9yO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9hdWRpby1lcnJvcicpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuL3BsYXliYWNrLWVycm9yJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkF1ZGlvRXJyb3IgPSBBdWRpb0Vycm9yO1xueWEubXVzaWMuQXVkaW8uUGxheWJhY2tFcnJvciA9IFBsYXliYWNrRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLlBsYXliYWNrRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUGxheWJhY2tFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHNyYykge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xufTtcblxuUGxheWJhY2tFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIlBsYXliYWNrRXJyb3JcIik7XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINGB0L7QtdC00LjQvdC10L3QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURUQgPSBcIkNvbm5lY3Rpb24gYWJvcnRlZFwiO1xuLyoqXG4gKiDQodC10YLQtdCy0LDRjyDQvtGI0LjQsdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5ORVRXT1JLX0VSUk9SID0gXCJOZXR3b3JrIGVycm9yXCI7XG4vKipcbiAqINCe0YjQuNCx0LrQsCDQtNC10LrQvtC00LjRgNC+0LLQsNC90LjRjyDQsNGD0LTQuNC+XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuREVDT0RFX0VSUk9SID0gXCJEZWNvZGUgZXJyb3JcIjtcbi8qKlxuICog0J3QtSDQtNC+0YHRgtGD0L/QvdGL0Lkg0LjRgdGC0L7Rh9C90LjQulxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkJBRF9EQVRBID0gXCJCYWQgZGF0YVwiO1xuXG4vKipcbiAqINCi0LDQsdC70LjRhtCwINGB0L7QvtGC0LLQtdGC0YHRgtCy0LjRjyDQutC+0LTQvtCyINC+0YjQuNCx0L7QuiBodG1sNSDQv9C70LXQtdGA0LBcbiAqIEBlbnVtIHtTdHJpbmd9XG4gKi9cblBsYXliYWNrRXJyb3IuaHRtbDUgPSB7XG4gICAgMTogUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURUQsXG4gICAgMjogUGxheWJhY2tFcnJvci5ORVRXT1JLX0VSUk9SLFxuICAgIDM6IFBsYXliYWNrRXJyb3IuREVDT0RFX0VSUk9SLFxuICAgIDQ6IFBsYXliYWNrRXJyb3IuQkFEX0RBVEFcbn07XG5cbi8vVE9ETzog0YHQtNC10LvQsNGC0Ywg0LrQu9Cw0YHRgdC40YTQuNC60LDRgtC+0YAg0L7RiNC40LHQvtC6IGZsYXNoLdC/0LvQtdC10YDQsFxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXliYWNrRXJyb3I7XG4iLCJpZiAodHlwZW9mIHdpbmRvdy55YSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbmRvdy55YSA9IHt9O1xufVxuXG52YXIgeWEgPSB3aW5kb3cueWE7XG5cbmlmICh0eXBlb2YgeWEubXVzaWMgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB5YS5tdXNpYyA9IHt9O1xufVxuXG5pZiAodHlwZW9mIHlhLm11c2ljLkF1ZGlvID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEubXVzaWMuQXVkaW8gPSB7fTtcbn1cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgQXVkaW9QbGF5ZXIgPSByZXF1aXJlKCcuL2F1ZGlvLXBsYXllcicpO1xudmFyIFByb3h5ID0gcmVxdWlyZSgnLi9saWIvY2xhc3MvcHJveHknKTtcblxueWEubXVzaWMuQXVkaW8gPSBQcm94eS5jcmVhdGVDbGFzcyhBdWRpb1BsYXllcik7XG55YS5tdXNpYy5BdWRpby5jb25maWcgPSBjb25maWc7XG5cbm1vZHVsZS5leHBvcnRzID0geWEubXVzaWMuQXVkaW87XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvRmxhc2gnKTtcbnZhciBGbGFzaE1hbmFnZXIgPSByZXF1aXJlKCcuL2ZsYXNoLW1hbmFnZXInKTtcbnZhciBGbGFzaEludGVyZmFjZSA9IHJlcXVpcmUoJy4vZmxhc2gtaW50ZXJmYWNlJyk7XG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG52YXIgZmxhc2hNYW5hZ2VyO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQsCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG52YXIgZmxhc2hWZXJzaW9uID0gc3dmb2JqZWN0LmdldEZsYXNoUGxheWVyVmVyc2lvbigpO1xuZGV0ZWN0LmZsYXNoVmVyc2lvbiA9IGZsYXNoVmVyc2lvbi5tYWpvciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLm1pbm9yICsgXCIuXCIgKyBmbGFzaFZlcnNpb24ucmVsZWFzZTtcblxuZXhwb3J0cy5hdmFpbGFibGUgPSBzd2ZvYmplY3QuaGFzRmxhc2hQbGF5ZXJWZXJzaW9uKGNvbmZpZy5mbGFzaC52ZXJzaW9uKTtcbmxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGV4cG9ydHMuYXZhaWxhYmxlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCa0LvQsNGB0YEgZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBleHRlbmRzIElBdWRpb0ltcGxlbWVudGF0aW9uXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BsYXlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlbmRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3ZvbHVtZWNoYW5nZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2NyYXNoZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzd2FwXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N0b3BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwYXVzZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3Byb2dyZXNzXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGluZ1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2Vycm9yXG4gKlxuICogQHBhcmFtIHtITVRMRWxlbWVudH0gW292ZXJsYXldIC0g0LzQtdGB0YLQviDQtNC70Y8g0LLRgdGC0YDQsNC40LLQsNC90LjRjyDQv9C70LXQtdGA0LAgKNCw0LrRgtGD0LDQu9GM0L3QviDRgtC+0LvRjNC60L4g0LTQu9GPIGZsYXNoLdC/0LvQtdC10YDQsClcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2ZvcmNlPWZhbHNlXSAtINGB0L7Qt9C00LDRgtGMINC90L7QstGL0Lkg0Y3QutC30LXQv9C70Y/RgCBGbGFzaE1hbmFnZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvRmxhc2ggPSBmdW5jdGlvbihvdmVybGF5LCBmb3JjZSkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBpZiAoIWZsYXNoTWFuYWdlciB8fCBmb3JjZSkge1xuICAgICAgICBmbGFzaE1hbmFnZXIgPSBuZXcgRmxhc2hNYW5hZ2VyKG92ZXJsYXkpO1xuICAgIH1cblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy53aGVuUmVhZHkgPSBmbGFzaE1hbmFnZXIuY3JlYXRlUGxheWVyKHRoaXMpO1xuICAgIHRoaXMud2hlblJlYWR5LnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlYWR5XCIsIGRhdGEpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJmYWlsZWRcIiwgZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9GbGFzaCk7XG5cbkF1ZGlvRmxhc2gudHlwZSA9IEF1ZGlvRmxhc2gucHJvdG90eXBlLnR5cGUgPSBcImZsYXNoXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQodC+0LfQtNCw0L3QuNC1INC80LXRgtC+0LTQvtCyINGA0LDQsdC+0YLRiyDRgSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5PYmplY3Qua2V5cyhGbGFzaEludGVyZmFjZS5wcm90b3R5cGUpLmZpbHRlcihmdW5jdGlvbihrZXkpIHtcbiAgICByZXR1cm4gRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkgJiYga2V5WzBdICE9PSBcIl9cIjtcbn0pLm1hcChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBBdWRpb0ZsYXNoLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghL15nZXQvLnRlc3QobWV0aG9kKSkge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIG1ldGhvZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5ZXIgaXMgbm90IHJlYWR5XCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMuaWQpO1xuICAgICAgICByZXR1cm4gZmxhc2hNYW5hZ2VyLmZsYXNoW21ldGhvZF0uYXBwbHkoZmxhc2hNYW5hZ2VyLmZsYXNoLCBhcmdzKTtcbiAgICB9XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwYXVzZVxuICovXG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcmVzdW1lXG4gKi9cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc3RvcFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3ByZWxvYWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRlZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlQcmVsb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFBvc2l0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0UG9zaXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldER1cmF0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0TG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRWb2x1bWVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFZvbHVtZVxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFNyY1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0ZsYXNoLnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYWluOiBcIm5vdCByZWFkeVwiLFxuICAgICAgICAgICAgICAgIHByZWxvYWRlcjogXCJub3QgcmVhZHlcIlxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogdGhpcy5nZXRTcmMoMCksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IHRoaXMuZ2V0U3JjKDEpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvRmxhc2g7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoSW50ZXJmYWNlJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQntC/0LjRgdCw0L3QuNC1INCy0L3QtdGI0L3QtdCz0L4g0LjQvdGC0LXRgNGE0LXQudGB0LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge09iamVjdH0gZmxhc2ggLSBzd2Yt0L7QsdGK0LXQutGCXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEludGVyZmFjZSA9IGZ1bmN0aW9uKGZsYXNoKSB7XG4gICAgLy9GSVhNRTog0L3Rg9C20L3QviDQv9GA0LjQtNGD0LzQsNGC0Ywg0L3QvtGA0LzQsNC70YzQvdGL0Lkg0LzQtdGC0L7QtCDRjdC60YHQv9C+0YDRgtCwXG4gICAgdGhpcy5mbGFzaCA9IHlhLm11c2ljLkF1ZGlvLl9mbGFzaCA9IGZsYXNoO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRidC10L3QuNC1INGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRi9C30LLQsNGC0Ywg0LzQtdGC0L7QtCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBmbiAtINC90LDQt9Cy0LDQvdC40LUg0LzQtdGC0L7QtNCwXG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fY2FsbEZsYXNoID0gZnVuY3Rpb24oZm4pIHtcbiAgICAvL2xvZ2dlci5kZWJ1Zyh0aGlzLCBmbiwgYXJndW1lbnRzKTtcblxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZsYXNoLmNhbGwuYXBwbHkodGhpcy5mbGFzaCwgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiX2NhbGxGbGFzaEVycm9yXCIsIGUsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0L7QsdGA0LDRgtC90L7QuSDRgdCy0Y/Qt9C4INGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gKiBAdGhyb3dzINCe0YjQuNCx0LrQsCDQtNC+0YHRgtGD0L/QsCDQuiBmbGFzaC3Qv9C70LXQtdGA0YNcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5faGVhcnRCZWF0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwiaGVhcnRCZWF0XCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JTQvtCx0LDQstC40YLRjCDQvdC+0LLRi9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtpbnR9IC0tIGlkINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fYWRkUGxheWVyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImFkZFBsYXllclwiLCAtMSk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQtdGC0L7QtNGLINGD0L/RgNCw0LLQu9C10L3QuNGPINC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQttC10LvQsNC10LzQsNGPINCz0YDQvtC80LrQvtGB0YLRjFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24oaWQsIHZvbHVtZSkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInNldFZvbHVtZVwiLCAtMSwgdm9sdW1lKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRWb2x1bWVcIiwgLTEpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKGlkLCBzcmMsIGR1cmF0aW9uKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwicGxheVwiLCBpZCwgc3JjLCBkdXJhdGlvbik7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQuCDQt9Cw0LPRgNGD0LfQutGDINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInN0b3BcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8qKlxuICog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRg1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwicGF1c2VcIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQodC90Y/RgtGMINGC0YDQtdC6INGBINC/0LDRg9C30YtcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJyZXN1bWVcIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihpZCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRQb3NpdGlvblwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGC0LXQutGD0YnRg9GOINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQsIHBvc2l0aW9uKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic2V0UG9zaXRpb25cIiwgaWQsIHBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXREdXJhdGlvblwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0TG9hZGVkXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC10LTQt9Cw0LPRgNGD0LfQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQuNGC0Ywg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LLQvtC30LzQvtC20L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oaWQsIHNyYywgZHVyYXRpb24sIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJwcmVsb2FkXCIsIGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRlZFwiLCBpZCwgc3JjLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRpbmdcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJwbGF5UHJlbG9hZGVkXCIsIGlkLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0L/Qu9C10LXRgNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0U3JjXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsYXNoSW50ZXJmYWNlO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdGbGFzaE1hbmFnZXInKTtcblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBmbGFzaExvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9wcm9taXNlJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi4vbGliL25ldC9lcnJvci9sb2FkZXItZXJyb3InKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCX0LDQs9GA0YPQt9C60LAgZmxhc2gt0L/Qu9C10LXRgNCwINC4INC+0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3ZlcmxheSAtINC+0LHRitC10LrRgiDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDQuCDQv9C+0LrQsNC30LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaE1hbmFnZXIgPSBmdW5jdGlvbihvdmVybGF5KSB7IC8vIHNpbmdsZXRvbiFcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiLCBvdmVybGF5KTtcblxuICAgIHRoaXMuc3RhdGUgPSBcImluaXRcIjtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuZW1taXRlcnMgPSBbXTtcblxuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAvKipcbiAgICAgKiDQntCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQt9Cw0LLQtdGA0YjQtdC90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAqIEB0eXBlIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlKCk7XG5cbiAgICB2YXIgY2FsbGJhY2tQYXRoID0gY29uZmlnLmZsYXNoLmNhbGxiYWNrLnNwbGl0KFwiLlwiKTtcbiAgICB2YXIgY2FsbGJhY2tOYW1lID0gY2FsbGJhY2tQYXRoLnBvcCgpO1xuICAgIHZhciBjYWxsYmFja0NvbnQgPSB3aW5kb3c7XG4gICAgY2FsbGJhY2tQYXRoLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrQ29udFtwYXJ0XSkge1xuICAgICAgICAgICAgY2FsbGJhY2tDb250W3BhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2tDb250ID0gY2FsbGJhY2tDb250W3BhcnRdO1xuICAgIH0pO1xuICAgIGNhbGxiYWNrQ29udFtjYWxsYmFja05hbWVdID0gdGhpcy5fb25FdmVudC5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX2xvYWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkxvYWRUaW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mbGFzaC5sb2FkVGltZW91dCk7XG4gICAgZmxhc2hMb2FkZXIoY29uZmlnLmZsYXNoLnBhdGggKyBcIi9cIlxuICAgICAgICArIGNvbmZpZy5mbGFzaC5uYW1lLCBjb25maWcuZmxhc2gudmVyc2lvbiwgY29uZmlnLmZsYXNoLnBsYXllcklELCB0aGlzLl9vbkxvYWQuYmluZCh0aGlzKSwge30sIG92ZXJsYXkpO1xuXG4gICAgaWYgKG92ZXJsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQ7XG4gICAgICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbigpIHsgLy9LTk9XTEVER0U6IG9ubHkgbW91c2Vkb3duIGV2ZW50IGFuZCBvbmx5IHdtb2RlOiB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgfHwgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfTk9UX1JFU1BPTkRJTkcpKTtcbiAgICAgICAgICAgICAgICB9LCBjb25maWcuZmxhc2guY2xpY2tUaW1lb3V0KTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgJiYgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlYWR5XCIsIHJlc3VsdCk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQgPSBcImluaXRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9GQUlMID0gXCJmYWlsZWRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9ERUJVRyA9IFwiZGVidWdcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40Lkg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LggZmxhc2hcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIGRhdGFcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Mb2FkXCIsIGRhdGEpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkVGltZW91dCk7XG4gICAgZGVsZXRlIHRoaXMuX19sb2FkVGltZW91dDtcblxuICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFzaCA9IG5ldyBGbGFzaEludGVyZmFjZShkYXRhLnJlZik7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFwicmVhZHlcIikge1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKGRhdGEucmVmKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vdmVybGF5KSB7XG4gICAgICAgICAgICB0aGlzLl9faW5pdFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uSW5pdFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmluaXRUaW1lb3V0KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihkYXRhLl9fZmJuID8gQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSIDogQXVkaW9FcnJvci5GTEFTSF9VTktOT1dOX0NSQVNIKSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC30LDQs9GA0YPQt9C60LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgTG9hZGVyRXJyb3IoTG9hZGVyRXJyb3IuVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRiNC90L7RgdGC0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkluaXRcIik7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJyZWFkeVwiO1xuXG4gICAgaWYgKHRoaXMuX19pbml0VGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fX2luaXRUaW1lb3V0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0VGltZW91dDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mbGFzaCkge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUodGhpcy5mbGFzaCk7XG4gICAgICAgIHRoaXMuX19oZWFydGJlYXQgPSBzZXRJbnRlcnZhbCh0aGlzLl9vbkhlYXJ0QmVhdC5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSwg0YHQvtC30LTQsNCy0LDQtdC80YvRhSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0LLQvNC10YHRgtC1INGBINGB0L7QsdGL0YLQuNC10LxcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uRXZlbnQgPSBmdW5jdGlvbihldmVudCwgaWQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBcImZhaWxlZFwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwib25FdmVudEZhaWxlZFwiLCBldmVudCwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9ERUJVRykge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImZsYXNoREVCVUdcIiwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSBlbHNlIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0VSUk9SKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZmxhc2hFcnJvclwiLCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50LCBpZCwgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9JTklUKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vbkluaXQoKTtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9GQUlMKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9JTkZPOiDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INGB0L7QsdGL0YLQuNGPINC/0LXRgNC10LTQsNC90L3QvtCz0L4g0LjQtyDRhNC70LXRiNCwINC90LXQu9GM0LfRjyDQvtCx0YDQsNGJ0LDRgtGM0YHRjyDQuiDRhNC70LXRiC3QvtCx0YrQtdC60YLRgywg0L/QvtGN0YLQvtC80YMg0LTQtdC70LDQtdC8INGA0LDRgdGB0LjQvdGF0YDQvtC90LjQt9Cw0YbQuNGOXG4gICAgaWYgKGlkID09IC0xKSB7XG4gICAgICAgIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmVtbWl0ZXJzLmZvckVhY2goZnVuY3Rpb24oZW1taXRlcikge1xuICAgICAgICAgICAgICAgIGVtbWl0ZXIudHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5lbW1pdGVyc1tpZF0pIHtcbiAgICAgICAgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuZW1taXRlcnNbaWRdLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQsIGlkKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSGVhcnRCZWF0ID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdGhpcy5mbGFzaC5faGVhcnRCZWF0KCk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyYXNoZWRcIiwgZSk7XG4gICAgICAgIHRoaXMuX29uRXZlbnQoQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCwgLTEsIGUpO1xuICAgIH1cbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtBdWRpb0ZsYXNofSBhdWRpb0ZsYXNoIC0gZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGALCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0LHRgdC70YPQttC40LLQsNGC0Ywg0YHQvtC30LTQsNC90L3Ri9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YHQvtC30LTQsNC90LjRjyDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5jcmVhdGVQbGF5ZXIgPSBmdW5jdGlvbihhdWRpb0ZsYXNoKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlUGxheWVyXCIpO1xuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBhdWRpb0ZsYXNoLmlkID0gdGhpcy5mbGFzaC5fYWRkUGxheWVyKCk7XG4gICAgICAgIHRoaXMuZW1taXRlcnNbYXVkaW9GbGFzaC5pZF0gPSBhdWRpb0ZsYXNoO1xuICAgICAgICByZXR1cm4gYXVkaW9GbGFzaC5pZDtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHBsYXllcklkKSB7XG4gICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclN1Y2Nlc3NcIiwgcGxheWVySWQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyZWF0ZVBsYXllckVycm9yXCIsIGVycik7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaE1hbmFnZXI7XG4iLCIvKipcbiAqIEBpZ25vcmVcbiAqIEBmaWxlXG4gKiBUaGlzIGlzIGEgd3JhcHBlciBmb3Igc3dmb2JqZWN0IHRoYXQgZGV0ZWN0cyBGbGFzaEJsb2NrIGluIGJyb3dzZXIuXG4gKlxuICogV3JhcHBlciBkZXRlY3RzOlxuICogICAtIENocm9tZVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gKiAgICAgLSBGbGFzaEJsb2NrIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAqICAgICAtIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gKiAgIC0gRmlyZWZveCBGbGFzaGJsb2NrIChodHRwczovL2FkZG9ucy5tb3ppbGxhLm9yZy9ydS9maXJlZm94L2FkZG9uL2ZsYXNoYmxvY2svKVxuICogICAtIE9wZXJhID49IDExLjUgXCJFbmFibGUgcGx1Z2lucyBvbiBkZW1hbmRcIiBzZXR0aW5nXG4gKiAgIC0gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggUGx1Z2luIChmb3IgU2FmYXJpIDwgNS4wLjYpIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICpcbiAqIFRlc3RlZCBvbjpcbiAqICAgLSBDaHJvbWUgMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgTGV4MSAxLjIuMTEuMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgam9zb3JlayAwLjkuMzFcbiAqICAgICAtIEZsYXNoRnJlZSAxLjEuM1xuICogICAtIEZpcmVmb3ggNS4wLjEgKyBGbGFzaGJsb2NrIDEuNS4xNS4xXG4gKiAgIC0gT3BlcmEgMTEuNVxuICogICAtIFNhZmFyaSA1LjEgKyBDbGlja1RvRmxhc2ggKDIuMy4yKVxuICpcbiAqIEFsc28gdGhpcyB3cmFwcGVyIGNhbiByZW1vdmUgYmxvY2tlZCBzd2YgYW5kIGxldCB5b3UgZG93bmdyYWRlIHRvIG90aGVyIG9wdGlvbnMuXG4gKlxuICogRmVlbCBmcmVlIHRvIGNvbnRhY3QgbWUgdmlhIGVtYWlsLlxuICpcbiAqIENvcHlyaWdodCAyMDExLCBBbGV4ZXkgQW5kcm9zb3ZcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCAoaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHApIG9yIEdQTCBWZXJzaW9uIDMgKGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbCkgbGljZW5zZXMuXG4gKlxuICogVGhhbmtzIHRvIGZsYXNoYmxvY2tkZXRlY3RvciBwcm9qZWN0IChodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZmxhc2hibG9ja2RldGVjdG9yKVxuICpcbiAqIEByZXF1aXJlcyBzd2ZvYmplY3RcbiAqIEBhdXRob3IgQWxleGV5IEFuZHJvc292IDxkb29jaGlrQHlhLnJ1PlxuICogQHZlcnNpb24gMS4wXG4gKi9cblxudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG5mdW5jdGlvbiByZW1vdmUobm9kZSkge1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbn1cblxuLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LfQsNCz0YDRg9C30LrQuCDRhNC70LXRiC3Qv9C70LXQtdGA0LAg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLRgdC70LXQttC40LLQsNC90LjRjyDQsdC70L7QutC40YDQvtCy0YnQuNC60L7QslxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZibi1zd2Ytd3JhcHBlclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIF9fU1dGX1dSQVBQRVJfQ0xBU1M6ICdmYm4tc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgX19URVNUUzogW1xuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gICAgICAgIC8vIENob21lIEZsYXNoQmxvY2sgZXh0ZW5zaW9uIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSwgd3JhcHBlck5vZGUpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cGVjdCB0aGF0IHN3ZiBpcyB0aGUgb25seSBjaGlsZCBvZiB3cmFwcGVyXG4gICAgICAgICAgICByZXR1cm4gd3JhcHBlck5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPiAxXG4gICAgICAgIH0sIC8vIG9sZGVyIFNhZmFyaSBDbGlja1RvRmxhc2ggKGh0dHA6Ly9yZW50enNjaC5naXRodWIuY29tL2NsaWNrdG9mbGFzaC8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIElFIGhhcyBubyBzd2ZOb2RlLnR5cGVcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnR5cGUgJiYgc3dmTm9kZS50eXBlICE9ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCdcbiAgICAgICAgfSwgLy8gRmxhc2hCbG9jayBmb3IgRmlyZWZveCAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAgICAgICAgLy8gQ2hyb21lIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIHN3ZiBoYXZlIGJlZW4gZGV0YWNoZWQgZnJvbSBET01cbiAgICAgICAgICAgIHJldHVybiAhc3dmTm9kZS5wYXJlbnROb2RlO1xuICAgICAgICB9LCAvLyBTYWZhcmkgQ2xpY2tUb0ZsYXNoIEV4dGVuc2lvbiAoaHR0cDovL2hveW9pcy5naXRodWIuY29tL3NhZmFyaWV4dGVuc2lvbnMvY2xpY2t0b3BsdWdpbi8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnBhcmVudE5vZGUuY2xhc3NOYW1lLmluZGV4T2YoJ0NURm5vZGlzcGxheScpID4gLTE7XG4gICAgICAgIH1cbiAgICBdLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRiBleGNlcHQgbGFzdCBwYXJhbSByZW1vdmVCbG9ja2VkU1dGLlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbcmVtb3ZlQmxvY2tlZFNXRj10cnVlXSBSZW1vdmUgc3dmIGlmIGJsb2NrZWRcbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbiwgcmVtb3ZlQmxvY2tlZFNXRikge1xuICAgICAgICAvLyB2YXIgc3dmb2JqZWN0ID0gd2luZG93Wydzd2ZvYmplY3QnXTtcblxuICAgICAgICBpZiAoIXN3Zm9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3dmRWxlbWVudCA9IGVbJ3JlZiddO1xuICAgICAgICAgICAgICAgICAgICAvLyBPcGVyYSAxMS41IGFuZCBhYm92ZSByZXBsYWNlcyBmbGFzaCB3aXRoIFNWRyBidXR0b25cbiAgICAgICAgICAgICAgICAgICAgLy8gbXNpZSAoYW5kIGNhbmFyeSBjaHJvbWUgMzIuMCkgY3Jhc2hlcyBvbiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKClcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGxhY2VkQnlTVkcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkQnlTVkcgPSBzd2ZFbGVtZW50ICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10gJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlZEJ5U1ZHKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vc2V0IHRpbWVvdXQgdG8gbGV0IEZsYXNoQmxvY2sgcGx1Z2luIGRldGVjdCBzd2YgYW5kIHJlcGxhY2UgaXQgc29tZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFRFU1RTID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fVEVTVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSBURVNUUy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFRFU1RTW2ldKHN3ZkVsZW1lbnQsIHdyYXBwZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZsYXNoQmxvY2tOb3RpZmllci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZUJsb2NrZWRTV0YgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBzd2ZcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3Zm9iamVjdC5yZW1vdmVTV0YocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSB3cmFwcGVyXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUod3JhcHBlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIGV4dGVuc2lvbiBhcnRlZmFjdHNcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9DbGlja1RvRmxhc2ggYXJ0ZWZhY3RzXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3RmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0NURnN0YWNrJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3RmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGN0Zik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2hyb21lIEZsYXNoQmxvY2sgYXJ0ZWZhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsYXN0Qm9keUNoaWxkID0gZG9jdW1lbnQuYm9keS5sYXN0Q2hpbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdEJvZHlDaGlsZCAmJiBsYXN0Qm9keUNoaWxkLmNsYXNzTmFtZSA9PSAndWpzX2ZsYXNoYmxvY2tfcGxhY2Vob2xkZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGxhc3RCb2R5Q2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGUuc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBlLl9fZmJuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4iLCJ2YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hFbWJlZGRlciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZlbWItc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmVtYi1zd2Ytd3JhcHBlcicsXG5cbiAgICAvKipcbiAgICAgKiBUaW1lb3V0IGZvciBmbGFzaCBibG9jayBkZXRlY3RcbiAgICAgKiBAZGVmYXVsdCA1MDBcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgX19USU1FT1VUOiA1MDAsXG5cbiAgICAvKipcbiAgICAgKiBFbWJlZCBTV0YgaW5mbyBwYWdlLiBUaGlzIGZ1bmN0aW9uIGhhcyBzYW1lIG9wdGlvbnMgYXMgc3dmb2JqZWN0LmVtYmVkU1dGXG4gICAgICogQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICogQHBhcmFtIHN3ZlVybFN0clxuICAgICAqIEBwYXJhbSByZXBsYWNlRWxlbUlkU3RyXG4gICAgICogQHBhcmFtIHdpZHRoU3RyXG4gICAgICogQHBhcmFtIGhlaWdodFN0clxuICAgICAqIEBwYXJhbSBzd2ZWZXJzaW9uU3RyXG4gICAgICogQHBhcmFtIHhpU3dmVXJsU3RyXG4gICAgICogQHBhcmFtIGZsYXNodmFyc09ialxuICAgICAqIEBwYXJhbSBwYXJPYmpcbiAgICAgKiBAcGFyYW0gYXR0T2JqXG4gICAgICogQHBhcmFtIGNhbGxiYWNrRm5cbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbikge1xuICAgICAgICBzd2ZvYmplY3QuYWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHJlcGxhY2VFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICBpZiAoIXJlcGxhY2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSBuZWVkIHRvIGNyZWF0ZSBkaXYtd3JhcHBlciBiZWNhdXNlIHNvbWUgZmxhc2ggYmxvY2sgcGx1Z2lucyByZXBsYWNlIHN3ZiB3aXRoIGFub3RoZXIgY29udGVudC5cbiAgICAgICAgICAgIC8vIEFsc28gc29tZSBmbGFzaCByZXF1aXJlcyB3cmFwcGVyIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSBGbGFzaEVtYmVkZGVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEVtYmVkZGVyLl9fVElNRU9VVCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBvbkZhaWx1cmUoZSkge1xuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEVtYmVkZGVyO1xuIiwidmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHJlcXVpcmUoJy4vZmxhc2hibG9ja25vdGlmaWVyJyk7XG52YXIgRmxhc2hFbWJlZGRlciA9IHJlcXVpcmUoJy4vZmxhc2hlbWJlZGRlcicpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xuXG52YXIgd2luU2FmYXJpID0gZGV0ZWN0LnBsYXRmb3JtLm9zID09PSAnd2luZG93cycgJiYgZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gJ3NhZmFyaSc7XG5cbnZhciBDT05UQUlORVJfQ0xBU1MgPSBcInlhLWZsYXNoLXBsYXllci13cmFwcGVyXCI7XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30YfQuNC6INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICpcbiAqIEBhbGlhcyBGbGFzaE1hbmFnZXJ+Zmxhc2hMb2FkZXJcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0g0KHRgdGL0LvQutCwINC90LAg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ30gbWluVmVyc2lvbiAtINC80LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBpZCAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGxvYWRDYWxsYmFjayAtINC60L7Qu9Cx0LXQuiDQtNC70Y8g0YHQvtCx0YvRgtC40Y8g0LfQsNCz0YDRg9C30LrQuFxuICogQHBhcmFtIHtvYmplY3R9IGZsYXNoVmFycyAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQstCw0LXQvNGL0LUg0LLQviDRhNC70LXRiFxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyIC0g0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQstC40LTQuNC80L7Qs9C+INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVYIC0g0YDQsNC30LzQtdGAINC/0L4g0LPQvtGA0LjQt9C+0L3RgtCw0LvQuFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVZIC0g0YDQsNC30LzQtdGAINC/0L4g0LLQtdGA0YLQuNC60LDQu9C4XG4gKlxuICogQHJldHVybnMge0hUTUxFbGVtZW50fSAtLSDQmtC+0L3RgtC10LnQvdC10YAg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsLCBtaW5WZXJzaW9uLCBpZCwgbG9hZENhbGxiYWNrLCBmbGFzaFZhcnMsIGNvbnRhaW5lciwgc2l6ZVgsIHNpemVZKSB7XG4gICAgdmFyICRmbGFzaFBsYXllciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgJGZsYXNoUGxheWVyLmlkID0gXCJ3cmFwcGVyX1wiICsgaWQ7XG4gICAgJGZsYXNoUGxheWVyLmlubmVySFRNTCA9ICc8ZGl2IGlkPVwiJyArIGlkICsgJ1wiPjwvZGl2Pic7XG5cbiAgICBzaXplWCA9IHNpemVYIHx8IFwiMTAwMFwiO1xuICAgIHNpemVZID0gc2l6ZVkgfHwgXCIxMDAwXCI7XG5cbiAgICB2YXIgZW1iZWRkZXIsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG9wdGlvbnM7XG5cbiAgICBpZiAoY29udGFpbmVyICYmICF3aW5TYWZhcmkpIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEVtYmVkZGVyO1xuICAgICAgICBmbGFzaFNpemVYID0gc2l6ZVg7IGZsYXNoU2l6ZVkgPSBzaXplWTtcbiAgICAgICAgb3B0aW9ucyA9IHsgYWxsb3dzY3JpcHRhY2Nlc3M6IFwiYWx3YXlzXCIsIHdtb2RlOiBcInRyYW5zcGFyZW50XCIgfTtcblxuICAgICAgICAkZmxhc2hQbGF5ZXIuY2xhc3NOYW1lID0gQ09OVEFJTkVSX0NMQVNTO1xuICAgICAgICAkZmxhc2hQbGF5ZXIuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBmbGFzaFNpemVZID0gXCIxXCI7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiAtMXB4OyB0b3A6IC0xcHg7IHdpZHRoOiAwcHg7IGhlaWdodDogMHB4OyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoJGZsYXNoUGxheWVyKTtcbiAgICB9XG5cbiAgICBlbWJlZGRlci5lbWJlZFNXRihcbiAgICAgICAgdXJsLFxuICAgICAgICBpZCxcbiAgICAgICAgZmxhc2hTaXplWCxcbiAgICAgICAgZmxhc2hTaXplWSxcbiAgICAgICAgbWluVmVyc2lvbixcbiAgICAgICAgXCJcIixcbiAgICAgICAgZmxhc2hWYXJzLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB7fSxcbiAgICAgICAgbG9hZENhbGxiYWNrXG4gICAgKTtcblxuICAgIHJldHVybiAkZmxhc2hQbGF5ZXI7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbNjAsIDE3MCwgMzEwLCA2MDAsIDEwMDAsIDMwMDAsIDYwMDAsIDEyMDAwLCAxNDAwMCwgMTYwMDBdO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZGVmYXVsdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2xhc3NpY2FsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0wLjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0zLjUsIC0zLjUsIC0zLjUsIC00LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJDbHViXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjM1OTk5OTg5NTA5NTgyNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgNCwgMi41LCAyLjUsIDIuNSwgMS41LCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRGFuY2VcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuMTU5OTk5ODQ3NDEyMTA5NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNC41LCAzLjUsIDEsIC0wLjUsIC0wLjUsIC0yLjUsIC0zLjUsIC0zLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIEJhc3NcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgNC41LCA0LjUsIDIuNSwgMC41LCAtMiwgLTQsIC01LCAtNS41LCAtNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzICYgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAyLjUsIC0wLjUsIC0zLjUsIC0yLCAwLjUsIDQsIDUuNSwgNiwgNl1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC02LFxuICAgICAgICBcImJhbmRzXCI6IFstNC41LCAtNC41LCAtNC41LCAtMiwgMSwgNS41LCA4LCA4LCA4LCA4XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGFwdG9wIFNwZWFrZXJzIC8gSGVhZHBob25lXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00LjA3OTk5OTkyMzcwNjA1NSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgNS41LCAyLjUsIC0xLjUsIC0xLCAwLjUsIDIsIDQuNSwgNiwgN11cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcmdlIEhhbGxcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNSwgNSwgMi41LCAyLjUsIC0wLjUsIC0yLCAtMiwgLTIsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMaXZlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWy0yLCAtMC41LCAyLCAyLjUsIDIuNSwgMi41LCAyLCAxLCAxLCAxXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUGFydHlcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAzLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIDMuNSwgMy41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUG9wXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjExOTk5OTg4NTU1OTA4MixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgMiwgMy41LCA0LCAyLjUsIC0wLjUsIC0xLCAtMSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlJlZ2dhZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0yLjUsIC0wLjUsIDMsIDMsIC0wLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMiwgLTIuNSwgLTQsIC0xLjUsIDIsIDQsIDUuNSwgNS41LCA1LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTa2FcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuNTE5OTk5OTgwOTI2NTE0LFxuICAgICAgICBcImJhbmRzXCI6IFstMSwgLTIsIC0yLCAtMC41LCAyLCAyLjUsIDQsIDQuNSwgNS41LCA0LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00Ljc5OTk5OTcxMzg5NzcwNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMC41LCAtMC41LCAtMSwgLTAuNSwgMiwgNCwgNC41LCA1LjUsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0IFJvY2tcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMiwgMSwgLTAuNSwgLTIsIC0yLjUsIC0xLjUsIC0wLjUsIDEsIDRdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJUZWNobm9cIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuODM5OTk5OTE0MTY5MzExNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMi41LCAtMC41LCAtMi41LCAtMiwgLTAuNSwgNCwgNC41LCA0LjUsIDRdXG4gICAgfVxuXTtcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi8uLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRXF1YWxpemVyU3RhdGljID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXItc3RhdGljJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC30L3QsNGH0LXQvdC40Y8g0YPRgdC40LvQtdC90LjRjyAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kI2NoYW5nZVxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0g0L3QvtCy0L7QtSDQt9C90LDRh9C10L3QuNC1XG4gKi9cblxuLyoqXG4gKiDQn9C+0LvQvtGB0LAg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmRcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqXG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiBXZWIgQXVkaW8gQVBJXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtINGC0LjQvyDRhNC40LvRjNGC0YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXF1ZW5jeSAtINGH0LDRgdGC0L7RgtCwINGE0LjQu9GM0YLRgNCwXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kI2NoYW5nZVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyQmFuZCA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgdHlwZSwgZnJlcXVlbmN5KSB7XG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgdGhpcy5maWx0ZXIgPSBhdWRpb0NvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgdGhpcy5maWx0ZXIudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5maWx0ZXIuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5O1xuICAgIHRoaXMuZmlsdGVyLlEudmFsdWUgPSAxO1xuICAgIHRoaXMuZmlsdGVyLmdhaW4udmFsdWUgPSAwO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXJCYW5kKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INC90LDRgdGC0YDQvtC50LrQsNC80LhcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGH0LDRgdGC0L7RgtGDINC/0L7Qu9C+0YHRiyDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5nZXRGcmVxID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyLmZyZXF1ZW5jeS52YWx1ZTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9C90LDRh9C10L3QuNC1INGD0YHQuNC70LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyLmdhaW4udmFsdWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICogQHBhcmFtIHZhbHVlXG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKEVxdWFsaXplclN0YXRpYy5FVkVOVF9DSEFOR0UsIHZhbHVlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyQmFuZDtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBFcXVhbGl6ZXJTdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSB7fTtcblxuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCovXG5FcXVhbGl6ZXJTdGF0aWMuRVZFTlRfQ0hBTkdFID0gXCJjaGFuZ2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhbGl6ZXJTdGF0aWM7XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vLi4vbGliL2RhdGEvbWVyZ2UnKTtcblxudmFyIEVxdWFsaXplclN0YXRpYyA9IHJlcXVpcmUoJy4vZXF1YWxpemVyLXN0YXRpYycpO1xudmFyIEVxdWFsaXplckJhbmQgPSByZXF1aXJlKCcuL2VxdWFsaXplci1iYW5kJyk7XG5cbi8qKlxuICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6INGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXRcbiAqXG4gKiBAcHJvcGVydHkge1N0cmluZ30gW2lkXSAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90LDRgdGC0YDQvtC10LpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAgLSDQv9GA0LXQtNGD0YHQuNC70LjRgtC10LvRjFxuICogQHByb3BlcnR5IHtBcnJheS48TnVtYmVyPn0gYmFuZHMgLSDQt9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyAoe0BsaW5rIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxIC0g0YfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0K3QutCy0LDQu9Cw0LnQt9C10YBcbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IGJhbmRzIC0g0YHQv9C40YHQvtC6INGH0LDRgdGC0L7RgiDQtNC70Y8g0L/QvtC70L7RgSDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKiBAbWl4ZXMgRXF1YWxpemVyU3RhdGljXG4gKlxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplciA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgYmFuZHMpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlYW1wID0gbmV3IEVxdWFsaXplckJhbmQoYXVkaW9Db250ZXh0LCBcImhpZ2hzaGVsZlwiLCAwKTtcbiAgICB0aGlzLnByZWFtcC5vbihcIipcIiwgdGhpcy5fb25CYW5kRXZlbnQuYmluZCh0aGlzLCB0aGlzLnByZWFtcCkpO1xuXG4gICAgYmFuZHMgPSBiYW5kcyB8fCBFcXVhbGl6ZXIuREVGQVVMVF9CQU5EUztcblxuICAgIHZhciBwcmV2O1xuICAgIHRoaXMuYmFuZHMgPSBiYW5kcy5tYXAoZnVuY3Rpb24oZnJlcXVlbmN5LCBpZHgpIHtcbiAgICAgICAgdmFyIGJhbmQgPSBuZXcgRXF1YWxpemVyQmFuZChcbiAgICAgICAgICAgIGF1ZGlvQ29udGV4dCxcblxuICAgICAgICAgICAgaWR4ID09IDAgPyAnbG93c2hlbGYnXG4gICAgICAgICAgICAgICAgOiBpZHggKyAxIDwgYmFuZHMubGVuZ3RoID8gXCJwZWFraW5nXCJcbiAgICAgICAgICAgICAgICA6IFwiaGlnaHNoZWxmXCIsXG5cbiAgICAgICAgICAgIGZyZXF1ZW5jeVxuICAgICAgICApO1xuICAgICAgICBiYW5kLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIGJhbmQpKTtcblxuICAgICAgICBpZiAoIXByZXYpIHtcbiAgICAgICAgICAgIHRoaXMucHJlYW1wLmZpbHRlci5jb25uZWN0KGJhbmQuZmlsdGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByZXYuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJldiA9IGJhbmQ7XG4gICAgICAgIHJldHVybiBiYW5kO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLmlucHV0ID0gdGhpcy5wcmVhbXAuZmlsdGVyO1xuICAgIHRoaXMub3V0cHV0ID0gdGhpcy5iYW5kc1t0aGlzLmJhbmRzLmxlbmd0aCAtIDFdLmZpbHRlcjtcbn07XG5FdmVudHMubWl4aW4oRXF1YWxpemVyKTtcbm1lcmdlKEVxdWFsaXplciwgRXF1YWxpemVyU3RhdGljLCB0cnVlKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgdGC0YDQvtC50LrQuCDQv9C+LdGD0LzQvtC70YfQsNC90LjRjlxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCd0LDQsdC+0YAg0YfQsNGB0YLQvtGCINGN0LrQstCw0LvQsNC50LfQtdGA0LAg0L/RgNC40LzQtdC90Y/RjtGJ0LjQudGB0Y8g0L/Qvi3Rg9C80L7Qu9GH0LDQvdC40Y5cbiAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAqIEBjb25zdFxuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9CQU5EUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5iYW5kcy5qcycpO1xuXG4vKipcbiAqINCd0LDQsdC+0YAg0YDQsNGB0L/RgNC+0YHRgtGA0LDQvdGR0L3QvdGL0YUg0L/RgNC10YHQtdGC0L7QsiDRjdC60LLQsNC70LDQudC30LXRgNCwINC00LvRjyDQvdCw0LHQvtGA0LAg0YfQsNGB0YLQvtGCINC/0L4t0YPQvNC+0LvRh9Cw0L3QuNGOLlxuICogQHR5cGUge09iamVjdC48U3RyaW5nLCB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyUHJlc2V0Pn1cbiAqIEBjb25zdFxuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9QUkVTRVRTID0gcmVxdWlyZSgnLi9kZWZhdWx0LnByZXNldHMuanMnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvQvtGB0Ysg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHBhcmFtIHtFcXVhbGl6ZXJCYW5kfSBiYW5kIC0g0L/QvtC70L7RgdCwINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuX29uQmFuZEV2ZW50ID0gZnVuY3Rpb24oYmFuZCwgZXZlbnQsIGRhdGEpIHtcbiAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGJhbmQuZ2V0RnJlcSgpLCBkYXRhKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQl9Cw0LPRgNGD0LfQutCwINC4INGB0L7RhdGA0LDQvdC10L3QuNC1INC90LDRgdGC0YDQvtC10LpcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQl9Cw0LPRgNGD0LfQuNGC0Ywg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9IHByZXNldCAtINC90LDRgdGC0YDQvtC50LrQuFxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmxvYWRQcmVzZXQgPSBmdW5jdGlvbihwcmVzZXQpIHtcbiAgICBwcmVzZXQuYmFuZHMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgIHRoaXMuYmFuZHNbaWR4XS5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnByZWFtcC5zZXRWYWx1ZShwcmVzZXQucHJlYW1wKTtcbn07XG5cbi8qKlxuICog0KHQvtGF0YDQsNC90LjRgtGMINGC0LXQutGD0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICogQHJldHVybnMge3lhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuc2F2ZVByZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByZWFtcDogdGhpcy5wcmVhbXAuZ2V0VmFsdWUoKSxcbiAgICAgICAgYmFuZHM6IHRoaXMuYmFuZHMubWFwKGZ1bmN0aW9uKGJhbmQpIHsgcmV0dXJuIGJhbmQuZ2V0VmFsdWUoKTsgfSlcbiAgICB9O1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LDRgtC10LzQsNGC0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vVE9ETzog0L/RgNC+0LLQtdGA0LjRgtGMINC/0YDQtdC00L/QvtC70L7QttC10L3QuNC1ICjRgdC60L7RgNC10LUg0LLRgdC10LPQviDQvdGD0LbQvdCwINC60LDRgNGC0LAg0LLQtdGB0L7QsiDQtNC70Y8g0YDQsNC30LvQuNGH0L3Ri9GFINGH0LDRgdGC0L7RgiDQuNC70Lgg0LTQsNC20LUg0L3QtdC60LDRjyDRhNGD0L3QutGG0LjRjylcbi8qKlxuICogKirQrdC60YHQv9C10YDQuNC80LXQvdGC0LDQu9GM0L3QvioqIC0g0LLRi9GH0LjQu9GP0LXRgiDQvtC/0YLQuNC80LDQu9GM0L3QvtC1INC30L3QsNGH0L3QuNC1INC/0YDQtdC00YPRgdC40LvQtdC90LjRj1xuICogQGV4cGVyaW1lbnRhbFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5ndWVzc1ByZWFtcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2ID0gMDtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IHRoaXMuYmFuZHMubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIHYgKz0gdGhpcy5iYW5kc1trXS5nZXRWYWx1ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiAtdiAvIDI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVxdWFsaXplcjtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXIgPSByZXF1aXJlKCcuL2VxdWFsaXplcicpO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLm11c2ljLkF1ZGlvLmZ4ID0ge307XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEubXVzaWMuQXVkaW8uZngudm9sdW1lTGliID0gcmVxdWlyZSgnLi92b2x1bWUtbGliJyk7XG4iLCIvKipcbiAqINCc0LXRgtC+0LTRiyDQutC+0L3QstC10YDRgtCw0YbQuNC4INC30L3QsNGH0LXQvdC40Lkg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAbmFtZXNwYWNlXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uZngudm9sdW1lTGliXG4gKi9cbnZhciB2b2x1bWVMaWIgPSB7fTtcblxuLyoqXG4gKiDQnNC40L3QuNC80LDQu9GM0L3QvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0YDQuCDQutC+0YLQvtGA0L7QvCDQv9GA0L7QuNGB0YXQvtC00LjRgiDQvtGC0LrQu9GO0YfQtdC90LjQtSDQt9Cy0YPQutCwLlxuICog0J7Qs9GA0LDQvdC40YfQtdC90LjQtSDQsiAwLjAxINC/0L7QtNC+0LHRgNCw0L3QviDRjdC80L/QuNGA0LjRh9C10YHQutC4LlxuICogQHR5cGUge251bWJlcn1cbiAqL1xudm9sdW1lTGliLkVQU0lMT04gPSAwLjAxO1xuXG4vKipcbiAqINCa0L7RjdGE0LjRhtC40LXQvdGCINC00LvRjyDQv9GA0LXQvtCx0YDQsNC30L7QstCw0L3QuNC5INCz0YDQvtC80LrQvtGB0YLQuCDQuNC3INC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtC5INGI0LrQsNC70Ysg0LIg0LTQtdGG0LjQsdC10LvRi1xuICogQHR5cGUge251bWJlcn1cbiAqIEBwcml2YXRlXG4gKi9cbnZvbHVtZUxpYi5fREJGU19DT0VGID0gMjAgLyBNYXRoLmxvZygxMCk7XG5cbi8qKlxuICog0JLRi9GH0LjRgdC70LXQvdC40LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0Lgg0L/QviDQt9C90LDRh9C10L3QuNGOINC90LAg0LvQvtCz0LDRgNC40YTQvNC40YfQtdGB0LrQvtC5INGI0LrQsNC70LVcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC30L3QsNGH0LXQvdC40LUg0L3QsCDRiNC60LDQu9C1XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIudG9FeHBvbmVudCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHZvbHVtZSA9IE1hdGgucG93KHZvbHVtZUxpYi5FUFNJTE9OLCAxIC0gdmFsdWUpO1xuICAgIHJldHVybiB2b2x1bWUgPiB2b2x1bWVMaWIuRVBTSUxPTiA/IHZvbHVtZSA6IDA7XG59O1xuXG4vKipcbiAqINCS0YvRh9C40YHQu9C10L3QuNC1INC30L3QsNGH0LXQvdC40Y8g0L/QvtC70L7QttC10L3QuNGPINC90LAg0LvQvtCz0LDRgNC40YTQvNC40YfQtdGB0LrQvtC5INGI0LrQsNC70LUg0L/QviDQt9C90LDRh9C10L3QuNGOINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xudm9sdW1lTGliLmZyb21FeHBvbmVudCA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIHJldHVybiAxIC0gTWF0aC5sb2coTWF0aC5tYXgodm9sdW1lLCB2b2x1bWVMaWIuRVBTSUxPTikpIC8gTWF0aC5sb2codm9sdW1lTGliLkVQU0lMT04pO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LfQvdCw0YfQtdC90LjRjyBkQkZTINC40Lcg0L7RgtC90L7RgdC40YLQtdC70YzQvdC+0LPQviDQt9C90LDRh9C10L3QuNGPINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QsNGPINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xudm9sdW1lTGliLnRvREJGUyA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIHJldHVybiBNYXRoLmxvZyh2b2x1bWUpICogdm9sdW1lTGliLl9EQkZTX0NPRUY7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQt9C90LDRh9C10L3QuNGPINC+0YLQvdC+0YHQuNGC0LXQu9GM0L3QvtC5INCz0YDQvtC80LrQvtGB0YLQuCDQuNC3INC30L3QsNGH0LXQvdC40Y8gZEJGU1xuICogQHBhcmFtIHtOdW1iZXJ9IGRiZnMgLSDQs9GA0L7QvNC60L7RgdGC0Ywg0LIgZEJGU1xuICogQHJldHVybnMge251bWJlcn1cbiAqL1xudm9sdW1lTGliLmZyb21EQkZTID0gZnVuY3Rpb24oZGJmcykge1xuICAgIHJldHVybiBNYXRoLmV4cChkYmZzIC8gdm9sdW1lTGliLl9EQkZTX0NPRUYpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB2b2x1bWVMaWI7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvSFRNTDVMb2FkZXInKTtcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi4vYXVkaW8tc3RhdGljJyk7XG52YXIgUGxheWJhY2tFcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yL3BsYXliYWNrLWVycm9yJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL2xpYi9ub29wJyk7XG5cbnZhciBsb2FkZXJJZCA9IDE7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQntCx0ZHRgNGC0LrQsCDQtNC70Y8g0L3QsNGC0LjQstC90L7Qs9C+INC60LvQsNGB0YHQsCBBdWRpb1xuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BsYXlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlbmRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N0b3BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwYXVzZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3Byb2dyZXNzXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGluZ1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2Vycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNUxvYWRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IGxvYWRlcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcbiAgICB0aGlzLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQgIT09IEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKSB7XG4gICAgICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAvKipcbiAgICAgKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGA0LDQt9C70LjRh9C90YvRhSDQvtC20LjQtNCw0L3QuNC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBEZWZlcnJlZD59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnByb21pc2VzID0ge307XG5cbiAgICAvKipcbiAgICAgKiDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnNyYyA9IFwiXCI7XG4gICAgLyoqXG4gICAgICog0J3QsNC30L3QsNGH0LXQvdC90LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5wb3NpdGlvbiA9IDA7XG5cbiAgICAvKipcbiAgICAgKiDQktGA0LXQvNGPINC/0L7RgdC70LXQtNC90LXQs9C+INC+0LHQvdC+0LLQu9C10L3QuNGPINC00LDQvdC90YvRhVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmxhc3RVcGRhdGUgPSAwO1xuXG4gICAgLyoqXG4gICAgICog0KTQu9Cw0LMg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60LhcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMubm90TG9hZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQktGL0YXQvtC0INC00LvRjyBXZWIgQXVkaW8gQVBJXG4gICAgICogQHR5cGUge0F1ZGlvTm9kZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMub3V0cHV0ID0gbnVsbDtcblxuICAgIC8vLS0tINCh0LDRhdCw0YAg0LTQu9GPINC30LDRidC40YLRiyDQvtGCINGD0YLQtdGH0LXQuiDQv9Cw0LzRj9GC0LhcbiAgICB0aGlzLl9fc3RhcnRQbGF5ID0gdGhpcy5fc3RhcnRQbGF5LmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX3Jlc3RhcnQgPSB0aGlzLl9yZXN0YXJ0LmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX3N0YXJ0dXBBdWRpbyA9IHRoaXMuX3N0YXJ0dXBBdWRpby5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX3VwZGF0ZVByb2dyZXNzID0gdGhpcy5fdXBkYXRlUHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVMb2FkaW5nID0gdGhpcy5fb25OYXRpdmVMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlRW5kZWQgPSB0aGlzLl9vbk5hdGl2ZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlRXJyb3IgPSB0aGlzLl9vbk5hdGl2ZUVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX29uTmF0aXZlUGF1c2UgPSB0aGlzLl9vbk5hdGl2ZVBhdXNlLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fb25OYXRpdmVQbGF5ID0gdGhpcy50cmlnZ2VyLmJpbmQodGhpcywgQXVkaW9TdGF0aWMuRVZFTlRfUExBWSk7XG5cbiAgICB0aGlzLl9pbml0QXVkaW8oKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9IVE1MNUxvYWRlcik7XG5cbi8qKlxuICog0JjQvdGC0LXRgNCy0LDQuyDQvtCx0L3QvtCy0LvQtdC90LjRjyDRgtCw0LnQvNC40L3Qs9C+0LIg0YLRgNC10LrQsFxuICogQHR5cGUge251bWJlcn1cbiAqIEBwcml2YXRlXG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwgPSAzMDtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgtC40LLQvdGL0LUg0YHQvtCx0YvRgtC40Y8gQXVkaW9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSA9IFwicGxheVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L/QsNGD0LfRi1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSA9IFwicGF1c2VcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFID0gXCJ0aW1ldXBkYXRlXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VOREVEID0gXCJlbmRlZFwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9EVVJBVElPTiA9IFwiZHVyYXRpb25jaGFuZ2VcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcgPSBcInByb2dyZXNzXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4INC80LXRgtCwLdC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEgPSBcImxvYWRlZG1ldGFkYXRhXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC90LDRh9Cw0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LVcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSA9IFwiY2FucGxheVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKipcbiAqINCX0LDQs9C70YPRiNC60LAg0LTQu9GPIF9faW5pdExpc3RlbmVyJ9CwINC90LAg0LLRgNC10LzRjyDQvtC20LjQtNCw0L3QuNGPINC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fZGVmYXVsdEluaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKCkge307XG5BdWRpb0hUTUw1TG9hZGVyLl9kZWZhdWx0SW5pdExpc3RlbmVyLnN0ZXAgPSBcInVzZXJcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40LlcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtCx0L3QvtCy0LvQtdC90LjRjyDRgtCw0LnQvNC40L3Qs9C+0LIg0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3VwZGF0ZVByb2dyZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGN1cnJlbnRUaW1lID0gK25ldyBEYXRlKCk7XG4gICAgaWYgKGN1cnJlbnRUaW1lIC0gdGhpcy5sYXN0VXBkYXRlIDwgQXVkaW9IVE1MNUxvYWRlci5fdXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFVwZGF0ZSA9IGN1cnJlbnRUaW1lO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5INC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlTG9hZGluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3VwZGF0ZVByb2dyZXNzKCk7XG5cbiAgICBpZiAodGhpcy5hdWRpby5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGxvYWRlZCA9IHRoaXMuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gdGhpcy5hdWRpby5idWZmZXJlZC5zdGFydCgwKTtcblxuICAgICAgICBpZiAodGhpcy5ub3RMb2FkaW5nICYmIGxvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5ub3RMb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9hZGVkID49IHRoaXMuYXVkaW8uZHVyYXRpb24gLSAwLjEpIHtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQvtC60L7QvdGH0LDQvdC40Y8g0YLRgNC10LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlRW5kZWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9FTkRFRCk7XG4gICAgdGhpcy5lbmRlZCA9IHRydWU7XG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgdGhpcy5hdWRpby5wYXVzZSgpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC+0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge0V2ZW50fSBlIC0g0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICBpZiAoIXRoaXMuc3JjKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hdWRpby5lcnJvci5jb2RlID09IDIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJOZXR3b3JrIGVycm9yLiBSZXN0YXJ0aW5nLi4uXCIsIHRoaXMuc3JjKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiA9IHRoaXMuYXVkaW8uY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX3Jlc3RhcnQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBlcnJvciA9IG5ldyBQbGF5YmFja0Vycm9yKHRoaXMuYXVkaW8uZXJyb3JcbiAgICAgICAgICAgID8gUGxheWJhY2tFcnJvci5odG1sNVt0aGlzLmF1ZGlvLmVycm9yLmNvZGVdXG4gICAgICAgICAgICA6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IGUsXG4gICAgICAgIHRoaXMuc3JjKTtcblxuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SLCBlcnJvcik7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC/0LDRg9C30YtcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZVBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmVuZGVkKSB7XG4gICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSk7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC4INC00LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQuNGFINGB0L7QsdGL0YLQuNC5INC00LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9pbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCU0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRgdC70YPRiNCw0YLQtdC70LXQuSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60LjRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0VXNlckV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXROYXRpdmVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19vbk5hdGl2ZVBhdXNlKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX29uTmF0aXZlUGxheSk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VOREVELCB0aGlzLl9fb25OYXRpdmVFbmRlZCk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUsIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0RVUkFUSU9OLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HLCB0aGlzLl9fb25OYXRpdmVMb2FkaW5nKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19vbk5hdGl2ZUVycm9yKTtcbn07XG5cbi8qKlxuICog0JTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC90LDRgtC40LLQvdGL0YUg0YHQvtCx0YvRgtC40LkgYXVkaW8t0Y3Qu9C10LzQtdC90YLQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2RlaW5pdE5hdGl2ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvINC4INC90LDQt9C90LDRh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXRBdWRpbyA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9pbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XG4gICAgdGhpcy5hdWRpby5sb29wID0gZmFsc2U7IC8vIGZvciBJRVxuICAgIHRoaXMuYXVkaW8ucHJlbG9hZCA9IHRoaXMuYXVkaW8uYXV0b2J1ZmZlciA9IFwiYXV0b1wiOyAvLyAxMDAlXG4gICAgdGhpcy5hdWRpby5hdXRvcGxheSA9IGZhbHNlO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gXCJcIjtcblxuICAgIHRoaXMuX2luaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IEF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXI7XG5cbiAgICB0aGlzLl9pbml0TmF0aXZlRXZlbnRzKCk7XG59O1xuXG4vKipcbiAqINCe0YLQutC70Y7Rh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuSDQuCDRg9C00LDQu9C10L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0QXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfZGVpbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcbiAgICB0aGlzLl9kZWluaXROYXRpdmVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBudWxsO1xufTtcblxuLyoqXG4gKiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQvtCx0YrQtdC60YLQsCBBdWRpby4g0JTQu9GPINC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LHRg9C10YLRgdGPINC70Y7QsdC+0LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LUg0LTQtdC50YHRgtCy0LjQtS5cbiAqXG4gKiDQodC+0LLQtdGA0YjQtdC90L3QviDRjdC30L7RgtC10YDQuNGH0L3Ri9C5INC4INC80LDQs9C40YfQtdGB0LrQuNC5INC80LXRgtC+0LQuINCU0LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAg0YLRgNC10LHRg9C10YLRgdGPINCy0YvQt9GL0LLQsNGC0Ywg0LzQtdGC0L7QtCBwbGF5INCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LVcbiAqINC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8uINCf0L7RgdC70LUg0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/QvtGB0YLQsNCy0LjRgtGMINC/0LvQtdC10YAg0L7QsdGA0LDRgtC90L4g0L3QsCDQv9Cw0YPQt9GDLCDRgi7Qui4g0L3QtdC60L7RgtC+0YDRi9C1INCx0YDQsNGD0LfQtdGA0YtcbiAqINCyINC/0YDQvtGC0LjQstC90L7QvCDRgdC70YPRh9Cw0LUg0L3QsNGH0LjQvdCw0Y7RgiDQv9GA0L7QuNCz0YDRi9Cy0LDRgtGMINGC0YDQtdC6INCw0LLRgtC+0LzQsNGC0LjRh9C10YHQutC4INC60LDQuiDRgtC+0LvRjNC60L4g0L7QvSDQt9Cw0LPRgNGD0LbQsNC10YLRgdGPLiDQn9GA0Lgg0Y3RgtC+0Lwg0LIg0L3QtdC60L7RgtC+0YDRi9GFINCx0YDQsNGD0LfQtdGA0LDRhVxuICog0L/QvtGB0LvQtSDQstGL0LfQvtCy0LAg0LzQtdGC0L7QtNCwIGxvYWQg0YHQvtCx0YvRgtC40LUgcGxheSDQvdC40LrQvtCz0LTQsCDQvdC1INC90LDRgdGC0YPQv9Cw0LXRgiwg0YLQsNC6INGH0YLQviDQv9GA0LjRhdC+0LTQuNGC0YHRjyDRgdC70YPRiNCw0YLRjCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqINC40LvQuCDQvtGI0LjQsdC60Lgg0LfQsNCz0YDRg9C30LrQuCAo0LXRgdC70Lggc3JjINC90LUg0YPQutCw0LfQsNC9KS4g0JIg0L3QtdC60L7RgtC+0YDRi9GFINCx0YDQsNGD0LfQtdGA0LDRhSDRgtCw0LrQttC1INC80L7QttC10YIg0L3QtSDQvdCw0YHRgtGD0L/QuNGC0Ywg0YHQvtCx0YvRgtC40LUgcGF1c2UuINCf0YDQuCDRjdGC0L7QvFxuICog0YHRgtC+0LjRgiDQtdGJ0ZEg0YPRh9C40YLRi9Cy0LDRgtGMLCDRh9GC0L4g0YLRgNC10Log0LzQvtC20LXRgiDQs9GA0YPQt9C40YLRjNGB0Y8g0LjQtyDQutC10YjQsCwg0YLQvtCz0LTQsCDRgdC+0LHRi9GC0LjRjyDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LAt0LTQsNC90L3Ri9GFINC4INCy0L7Qt9C80L7QttC90L7RgdGC0LhcbiAqINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQvNC+0LPRg9GCINCy0L7Qt9C90LjQutC90YPRgtGMINCx0YvRgdGC0YDQtdC1INGB0L7QsdGL0YLQuNGPIHBsYXkg0LjQu9C4IHBhdXNlLCDRgtCw0Log0YfRgtC+INC90YPQttC90L4g0L/RgNC10LTRg9GB0LzQsNGC0YDQuNCy0LDRgtGMINC/0YDQtdGA0YvQstCw0L3QuNC1INC/0YDQvtGG0LXRgdGB0LBcbiAqINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3N0YXJ0dXBBdWRpbyA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX3N0YXJ0dXBBdWRpb1wiKTtcblxuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcblxuICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQvtC90L3QvtCz0L4g0LLRi9C30L7QstCwIHBsYXkg0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8g0Lgg0LLRi9C30LLQsNGC0YwgcGF1c2UuXG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDQstGL0LfQvtCy0LAgcGF1c2Ug0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0YHQvtCx0YvRgtC40Y8sINC30LDQstC10YDRiNC40YLRjCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjiDQuCDRgNCw0LfRgNC10YjQuNGC0Ywg0L/QtdGA0LXQtNCw0YfRgyDRgdC+0LHRi9GC0LjQuVxuICAgICAgICB0aGlzLl9faW5pdExpc3RlbmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX19pbml0TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fX2luaXRMaXN0ZW5lcjtcbiAgICAgICAgICAgIHRoaXMudW5tdXRlRXZlbnRzKCk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW86cmVhZHlcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwID0gXCJwYXVzZVwiO1xuXG4gICAgICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcblxuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW86cGxheVwiLCBlLnR5cGUpO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgICB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAgPSBcInBsYXlcIjtcblxuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX01FVEEsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG5cbiAgICAvL0lORk86INC/0LXRgNC10LQg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40LXQvCDQvtCx0YrQtdC60YIgQXVkaW8g0YLRgNC10LHRg9C10YLRgdGPINC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMLCDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y9cbiAgICB0aGlzLmF1ZGlvLmxvYWQoKTtcbiAgICB0aGlzLmF1ZGlvLnBsYXkoKTtcbn07XG5cbi8qKlxuICog0JXRgdC70Lgg0LzQtdGC0L7QtCBfc3RhcnRQbGF5INCy0YvQt9Cy0LDQvSDRgNCw0L3RjNGI0LUsINGH0LXQvCDQt9Cw0LrQvtC90YfQuNC70LDRgdGMINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPLCDQvdGD0LbQvdC+INC+0YLQvNC10L3QuNGC0Ywg0YLQtdC60YPRidC40Lkg0YjQsNCzINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2JyZWFrU3RhcnR1cCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIHRoaXMuX2RlaW5pdFVzZXJFdmVudHMoKTtcbiAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuXG4gICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiX3N0YXJ0dXBBdWRpbzppbnRlcnJ1cHRlZFwiLCB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsIHJlYXNvbik7XG4gICAgZGVsZXRlIHRoaXMuX19pbml0TGlzdGVuZXI7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQtdGC0L7QtNGLINC+0LbQuNC00LDQvdC40Y8g0YDQsNC30LvQuNGH0L3Ri9GFINGB0L7QsdGL0YLQuNC5INC4INCz0LXQvdC10YDQsNGG0LjQuCDQvtCx0LXRidCw0L3QuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQvtC20LTQsNGC0YzRgdGPINC+0L/RgNC10LTQtdC70ZHQvdC90L7Qs9C+INGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0g0LjQvNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hlY2sgLSDQvNC10YLQvtC0INC/0YDQvtCy0LXRgNC60LgsINGH0YLQviDQvNGLINC90LDRhdC+0LTQuNC80YHRjyDQsiDQvdGD0LbQvdC+0Lwg0YHQvtGB0YLQvtGP0L3QuNC4XG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBsaXN0ZW4gLSDRgdC/0LjRgdC+0Log0YHQvtCx0YvRgtC40LksINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQtdGCINGB0LzQtdC90LjRgtGM0YHRjyDRgdC+0YHRgtC+0Y/QvdC40LVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3dhaXRGb3IgPSBmdW5jdGlvbihuYW1lLCBjaGVjaywgbGlzdGVuKSB7XG4gICAgaWYgKCF0aGlzLnByb21pc2VzW25hbWVdKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLnByb21pc2VzW25hbWVdID0gZGVmZXJyZWQ7XG5cbiAgICAgICAgaWYgKGNoZWNrLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChjaGVjay5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBjbGVhckxpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3Rlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIobGlzdGVuW2ldLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFyTGlzdGVuZXJzLCBjbGVhckxpc3RlbmVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tuYW1lXS5wcm9taXNlKCk7XG59O1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQvtC20LjQtNCw0L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSDQuNC80Y8g0YHQvtGB0YLQvtGP0L3QuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC+0LbQuNC00LDQvdC40Y9cbiAqIEB0b2RvIHJlYXNvbiDRgdC00LXQu9Cw0YLRjCDQvdCw0YHQu9C10LTQvdC40LrQvtC8INC60LvQsNGB0YHQsCBFcnJvclxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2NhbmNlbFdhaXQgPSBmdW5jdGlvbihuYW1lLCByZWFzb24pIHtcbiAgICB2YXIgcHJvbWlzZTtcbiAgICBpZiAocHJvbWlzZSA9IHRoaXMucHJvbWlzZXNbbmFtZV0pIHtcbiAgICAgICAgZGVsZXRlIHRoaXMucHJvbWlzZXNbbmFtZV07XG4gICAgICAgIHByb21pc2UucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LLRgdC10YUg0L7QttC40LTQsNC90LjQuVxuICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvbiAtINC/0YDQuNGH0LjQvdCwINC+0YLQvNC10L3RiyDQvtC20LjQtNCw0L3QuNGPXG4gKiBAdG9kbyByZWFzb24g0YHQtNC10LvQsNGC0Ywg0L3QsNGB0LvQtdC00L3QuNC60L7QvCDQutC70LDRgdGB0LAgRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9hYm9ydFByb21pc2VzID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMucHJvbWlzZXMpIHtcbiAgICAgICAgaWYgKHRoaXMucHJvbWlzZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChrZXksIHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LPQvtGC0L7QstC90L7RgdGC0Lgg0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VNZXRhZGF0YUV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCBBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5yZWFkeVN0YXRlID4gdGhpcy5hdWRpby5IQVZFX01FVEFEQVRBO1xufTtcblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC/0L7Qu9GD0YfQtdC90LjRjyDQvNC10YLQsNC00LDQvdC90YvRhVxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZU1ldGFkYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dhaXRGb3IoXCJtZXRhZGF0YVwiLCB0aGlzLl9wcm9taXNlTWV0YWRhdGFDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZU1ldGFkYXRhRXZlbnRzKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC30LDQs9GA0YPQt9C60Lgg0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZUxvYWRlZEV2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9MT0FESU5HXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0LfQsNCz0YDRg9C20LXQvdCwINC90YPQttC90LDRjyDRh9Cw0YHRgtGMINGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWRDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX19sb2FkZXJUaW1lciA9IHRoaXMuX19sb2FkZXJUaW1lciAmJiBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRlclRpbWVyKSB8fCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsV2FpdChcImxvYWRlZFwiLCBcInRpbWVvdXRcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgNTAwMCk7XG5cbiAgICAvL0lORk86INC/0L7Qt9C40YbQuNGOINC90YPQttC90L4g0LHRgNCw0YLRjCDRgSDQsdC+0LvRjNGI0LjQvCDQt9Cw0L/QsNGB0L7QvCwg0YIu0LouINC00LDQvdC90YvQtSDQt9Cw0L/QuNGB0LDQvdGLINCx0LvQvtC60LDQvNC4INC4INC90LDQvCDQvdGD0LbQvdC+INC00L7QttC00LDRgtGM0YHRjyDQt9Cw0LPRgNGD0LfQutC4INCx0LvQvtC60LBcbiAgICB2YXIgbG9hZGVkID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDQ1LCB0aGlzLmF1ZGlvLmR1cmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5hdWRpby5idWZmZXJlZC5sZW5ndGhcbiAgICAgICAgJiYgdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApID49IGxvYWRlZDtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VMb2FkZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRGb3IoXCJsb2FkZWRcIiwgdGhpcy5fcHJvbWlzZUxvYWRlZENoZWNrLCBBdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTG9hZGVkRXZlbnRzKTtcblxuICAgIGlmICghcHJvbWlzZS5jbGVhblRpbWVyKSB7XG4gICAgICAgIHByb21pc2UuY2xlYW5UaW1lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fX2xvYWRlclRpbWVyID0gY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkZXJUaW1lcik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgcHJvbWlzZS50aGVuKHByb21pc2UuY2xlYW5UaW1lciwgcHJvbWlzZS5jbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC/0YDQvtC40LPRgNGL0LLQsNC90LjRjyDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5INC/0LvQtdC10YDQsCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20L3QviDQvtC20LjQtNCw0YLRjCDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QviDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlUGxheWluZ0V2ZW50cyA9IFtBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFXTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0L/RgNC+0LjQs9GA0YvQstCw0LXRgtGB0Y8g0L3Rg9C20L3QsNGPINGH0LDRgdGC0Ywg0YLRgNC10LrQsFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmdDaGVjayA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aW1lID0gTWF0aC5taW4odGhpcy5wb3NpdGlvbiArIDAuMiwgdGhpcy5hdWRpby5kdXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPj0gdGltZTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcHJvbWlzZVBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdEZvcihcInBsYXlpbmdcIiwgdGhpcy5fcHJvbWlzZVBsYXlpbmdDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZVBsYXlpbmdFdmVudHMpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LLQtdC00LXQvdC40Y8sINC/0LXRgNC10LfQsNC/0YPRgdC6INGC0YDQtdC60LAsINC10YHQu9C4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQvdC1INC90LDRh9Cw0LvQvtGB0YxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VTdGFydFBsYXlpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgIHRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0gPSBkZWZlcnJlZDtcblxuICAgICAgICAvL0lORk86INC10YHQu9C4INC+0YLQvNC10L3QtdC90L4g0L7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC40LvQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8sINGC0L4g0L3Rg9C20L3QviDQvtGC0LzQtdC90LjRgtGMINC4INGN0YLQviDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgcmVhc29uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHZhciB0aW1lcjtcbiAgICAgICAgdmFyIHJlYWR5ID0gZmFsc2U7XG4gICAgICAgIHZhciBjbGVhblRpbWVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3Byb21pc2VQbGF5aW5nKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RhcnRQbGF5aW5nOnN1Y2Nlc3NcIik7XG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVqZWN0KTtcblxuICAgICAgICB0aGlzLl9wcm9taXNlTG9hZGVkKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChyZWFkeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJwbGF5aW5nXCIsIFwidGltZW91dFwiKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInN0YXJ0UGxheWluZzpmYWlsZWRcIik7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIDUwMDApO1xuICAgICAgICB9LmJpbmQodGhpcyksIHJlamVjdCk7XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZVBsYXlpbmcoKS50aGVuKGNsZWFuVGltZXIsIGNsZWFuVGltZXIpO1xuICAgICAgICBkZWZlcnJlZC5wcm9taXNlKCkudGhlbihjbGVhblRpbWVyLCBjbGVhblRpbWVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9taXNlc1tcInN0YXJ0UGxheWluZ1wiXS5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0Y3Qu9C10LzQtdC90YLQvtC8IEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGH0LDRgtGMINC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyY1xuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwibG9hZFwiLCBzcmMpO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImxvYWRcIik7XG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwibG9hZFwiKTtcblxuICAgIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICB0aGlzLm5vdExvYWRpbmcgPSB0cnVlO1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuXG4gICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5zcmMgPSBzcmM7XG4gICAgdGhpcy5hdWRpby5sb2FkKCk7XG59O1xuXG4vKiog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0b3BcIik7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwic3RvcFwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJzdG9wXCIpO1xuXG4gICAgdGhpcy5sb2FkKFwiXCIpO1xufTtcblxuLyoqXG4gKiDQndCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydFBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc3RhcnRQbGF5XCIpO1xuXG4gICAgdGhpcy5hdWRpby5jdXJyZW50VGltZSA9IHRoaXMucG9zaXRpb247XG5cbiAgICBpZiAoIXRoaXMucGxheWluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYnJlYWtTdGFydHVwKFwic3RhcnRQbGF5XCIpO1xuICAgIHRoaXMuYXVkaW8ucGxheSgpO1xuXG4gICAgLy9USElOSzog0L3Rg9C20L3QviDQu9C4INGC0YDQuNCz0LPQtdGA0LjRgtGMINGB0L7QsdGL0YLQuNC1INCyINGB0LvRg9GH0LDQtSDRg9GB0L/QtdGF0LBcbiAgICB0aGlzLl9wcm9taXNlU3RhcnRQbGF5aW5nKCkudGhlbihub29wLCB0aGlzLl9fcmVzdGFydCk7XG59O1xuXG4vKipcbiAqINCf0LXRgNC10LfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gW3JlYXNvbl0gLSDQtdGB0LvQuCDQv9GA0LjRh9C40L3QsCDQstGL0LfQvtCy0LAg0YPQutCw0LfQsNC90LAg0Lgg0L3QtSDRgNCw0LLQvdCwIFwidGltZW91dFwiINC90LjRh9C10LPQviDQvdC1INC/0YDQvtC40YHRhdC+0LTQuNGCXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fcmVzdGFydCA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vVEhJTks6INC90YPQttC10L0g0LvQuCDRgtGD0YIg0LrQsNC60L7QuS3RgtC+INGB0YfRkdGC0LjQuiDQutC+0LvQuNGH0LXRgdGC0LLQsCDQv9C+0L/Ri9GC0L7QulxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX3Jlc3RhcnRcIiwgcmVhc29uLCB0aGlzLnBvc2l0aW9uLCB0aGlzLnBsYXlpbmcpO1xuXG4gICAgaWYgKHJlYXNvbiAmJiByZWFzb24gIT09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL0lORk86INCX0LDQv9C+0LzQuNC90LDQtdC8INGC0LXQutGD0YnQtdC1INGB0L7RgdGC0L7Rj9C90LjQtSwg0YIu0LouINC+0L3QviDRgdCx0YDQvtGB0LjRgtGB0Y8g0L/QvtGB0LvQtSDQv9C10YDQtdC30LDQs9GA0YPQt9C60LhcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgIHZhciBwbGF5aW5nID0gdGhpcy5wbGF5aW5nO1xuXG4gICAgdGhpcy5sb2FkKHRoaXMuc3JjKTtcblxuICAgIGlmIChwbGF5aW5nKSB7XG4gICAgICAgIHRoaXMucGxheShwb3NpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQktC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsC/QvtGC0LzQtdC90LAg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGxheVwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5wbGF5aW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwbGF5XCIpO1xuXG4gICAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAgIHRoaXMucGxheWluZyA9IHRydWU7XG4gICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uID09IG51bGwgPyB0aGlzLnBvc2l0aW9uIHx8IDAgOiBwb3NpdGlvbjtcbiAgICB0aGlzLl9wcm9taXNlTWV0YWRhdGEoKS50aGVuKHRoaXMuX19zdGFydFBsYXksIG5vb3ApO1xufTtcblxuLyoqINCf0LDRg9C30LAgKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgXCJwYXVzZVwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwYXVzZVwiKTtcblxuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICghaXNGaW5pdGUocG9zaXRpb24pKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0UG9zaXRpb25GYWlsZWRcIiwgcG9zaXRpb24pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXG4gICAgdGhpcy5fcHJvbWlzZU1ldGFkYXRhKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5hdWRpby5jdXJyZW50VGltZSA9IHRoaXMucG9zaXRpb247XG4gICAgfS5iaW5kKHRoaXMpLCBub29wKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LTQutC70Y7Rh9C10L3QuNC1L9C+0YLQutC70Y7Rh9C10L3QuNC1INC40YHRgtC+0YfQvdC40LrQsCDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LjRgtGMINGA0LXQttC40LwgY3Jvc3NEb21haW4g0LTQu9GPIEhUTUw1INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINCy0LrQu9GO0YfQuNGC0Ywv0LLRi9C60LvRjtGH0LjRgtGMXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpby5jcm9zc09yaWdpbiA9IFwiYW5vbnltb3VzXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVBdHRyaWJ1dGUoXCJjcm9zc09yaWdpblwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXN0YXJ0KCk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC40YHRgtC+0YfQvdC40Log0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAqICEhIdCS0L3QuNC80LDQvdC40LUhISEgLSDQv9GA0Lgg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40LggV2ViIEF1ZGlvIEFQSSDQsiDQsdGA0LDRg9C30LXRgNC1INGB0YLQvtC40YIg0YPRh9C40YLRi9Cy0LDRgtGMLCDRh9GC0L4g0LLRgdC1INGC0YDQtdC60Lgg0LTQvtC70LbQvdGLINC70LjQsdC+INC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqINGBINGC0L7Qs9C+INC20LUg0LTQvtC80LXQvdCwLCDQu9C40LHQviDQtNC70Y8g0L3QuNGFINC00L7Qu9C20L3RiyDQsdGL0YLRjCDQv9GA0LDQstC40LvRjNC90L4g0LLRi9GB0YLQsNCy0LvQtdC90Ysg0LfQsNCz0L7Qu9C+0LLQutC4IENPUlMuXG4gKiDQn9GA0Lgg0LLRi9C30L7QstC1INC00LDQvdC90L7Qs9C+INC80LXRgtC+0LTQsCDRgtGA0LXQuiDQsdGD0LTQtdGCINC/0LXRgNC10LfQsNC/0YPRidC10L1cbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuY3JlYXRlU291cmNlID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0KSB7XG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVTb3VyY2VcIik7XG5cbiAgICB2YXIgbmVlZFJlc3RhcnQgPSAhdGhpcy5hdWRpby5jcm9zc09yaWdpbjtcblxuICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgIHRoaXMub3V0cHV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZSh0aGlzLmF1ZGlvKTtcbiAgICB0aGlzLm91dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICBpZiAobmVlZFJlc3RhcnQpIHtcbiAgICAgICAgdGhpcy5fcmVzdGFydCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPQtNCw0LvQuNGC0Ywg0LjRgdGC0L7Rh9C90LjQuiDQtNC70Y8gV2ViIEF1ZGlvIEFQSS4g0KPQtNCw0LvRj9C10YIg0LjRgdGC0L7Rh9C90LjQuiwg0L/QtdGA0LXRgdC+0LfQtNCw0ZHRgiDQvtCx0YrQtdC60YIgQXVkaW8uXG4gKiAhISHQktC90LjQvNCw0L3QuNC1ISEhIC0g0JTQsNC90L3Ri9C5INC80LXRgtC+0LQg0LzQvtC20L3QviDQstGL0LfRi9Cy0LDRgtGMINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8sINGCLtC6LiDRgdCy0LXQttC10YHQvtC30LTQsNC90L3Ri9C5XG4gKiDRjdC70LXQvNC10L3RgiBBdWRpbyDQvdGD0LbQvdC+INC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDRgtGMIC0g0LjQvdCw0YfQtSDQsdGD0LTQtdGCINC90LXQtNC+0YHRgtGD0L/QvdC+INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtS4g0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0Y3Qu9C10LzQtdC90YLQsFxuICogQXVkaW8g0LLQvtC30LzQvtC20L3QsCDRgtC+0LvRjNC60L4g0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPICjQutC70LjQuiwg0YLQsNGHLdGB0L7QsdGL0YLQuNC1INC40LvQuCDQutC70LDQstC40LDRgtGD0YDQvdC+0LUg0YHQvtCx0YvRgtC40LUpXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3lTb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgICAvL0lORk86INC10LTQuNC90YHRgtCy0LXQvdC90YvQuSDRgdC/0L7RgdC+0LEg0L7RgtC+0YDQstCw0YLRjCBNZWRpYUVsZW1lbnRTb3VyY2Ug0L7RgiBBdWRpbyAtINGB0L7Qt9C00LDRgtGMINC90L7QstGL0Lkg0L7QsdGK0LXQutGCIEF1ZGlvXG5cbiAgICBpZiAoIXRoaXMub3V0cHV0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIud2Fybih0aGlzLCBcImRlc3Ryb3lTb3VyY2VcIik7XG5cbiAgICB0aGlzLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuXG4gICAgdGhpcy5fYWJvcnRQcm9taXNlcyhcImRlc3Ryb3lcIik7XG5cbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuICAgIHRoaXMuX2luaXRBdWRpbygpO1xuICAgIHRoaXMuX3N0YXJ0dXBBdWRpbygpO1xuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0LTQsNC70LXQvdC40LUg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINC4INC+0LHRitC10LrRgtCwIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQo9C00LDQu9C10L3QuNC1INCy0YHQtdGFINC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDQuCDQvtCx0YrQtdC60YLQsCBBdWRpby4g0J/QvtGB0LvQtSDQstGL0LfQvtCy0LAg0LTQsNC90L3QvtCz0L4g0LzQtdGC0L7QtNCwINGN0YLQvtGCINC+0LHRitC10LrRgiDQsdGD0LTQtdGCINC90LXQu9GM0LfRjyDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJkZXN0cm95XCIpO1xuXG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoKTtcbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fX3Jlc3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX19zdGFydFBsYXkgPSBudWxsO1xuICAgIHRoaXMucHJvbWlzZXMgPSBudWxsO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluaXQ6ICEhdGhpcy5fX2luaXRMaXN0ZW5lciAmJiB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsXG4gICAgICAgIHNyYzogdGhpcy5zcmMsXG4gICAgICAgIHBsYXlpbmc6IHRoaXMucGxheWluZyxcbiAgICAgICAgZW5kZWQ6IHRoaXMuZW5kZWQsXG4gICAgICAgIG5vdExvYWRpbmc6IHRoaXMubm90TG9hZGluZyxcbiAgICAgICAgcG9zaXRpb246IHRoaXMucG9zaXRpb25cbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0hUTUw1TG9hZGVyO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSByZXF1aXJlKCcuL2F1ZGlvLWh0bWw1LWxvYWRlcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IEhUTUw1IEF1ZGlvINC4IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0cy5hdmFpbGFibGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCR0LDQt9C+0LLQsNGPINC/0YDQvtCy0LXRgNC60LAg0L/QvtC00LTQtdGA0LbQutC4INCx0YDQsNGD0LfQtdGA0L7QvFxuICAgIHZhciBodG1sNV9hdmFpbGFibGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIC8vc29tZSBicm93c2VycyBkb2Vzbid0IHVuZGVyc3RhbmQgbmV3IEF1ZGlvKClcbiAgICAgICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICAgICAgdmFyIGNhblBsYXkgPSBhdWRpby5jYW5QbGF5VHlwZShcImF1ZGlvL21wZWdcIik7XG4gICAgICAgIGlmICghY2FuUGxheSB8fCBjYW5QbGF5ID09PSAnbm8nKSB7XG5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIHJlYXNvblwiLCBjYW5QbGF5KTtcbiAgICAgICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIGVycm9yXCIsIGUpO1xuICAgICAgICBodG1sNV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBodG1sNV9hdmFpbGFibGUpO1xuICAgIHJldHVybiBodG1sNV9hdmFpbGFibGU7XG59KSgpO1xuXG5pZiAoZGV0ZWN0LnBsYXRmb3JtLm1vYmlsZSB8fCBkZXRlY3QucGxhdGZvcm0udGFibGV0KSB7XG4gICAgYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBhbGxvd2VkIGZvciBtb2JpbGVcIik7XG59IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgY29udGV4dCBjcmVhdGVkXCIpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBkZXRlY3RlZFwiKTtcbiAgICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGh0bWw1INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNjcmFzaGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3dhcFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy53ZWJBdWRpb0FwaSA9IGZhbHNlO1xuICAgIHRoaXMuYWN0aXZlTG9hZGVyID0gMDtcbiAgICB0aGlzLnZvbHVtZSA9IDE7XG4gICAgdGhpcy5sb2FkZXJzID0gW107XG5cbiAgICB0aGlzLl9hZGRMb2FkZXIoKTtcbiAgICB0aGlzLl9hZGRMb2FkZXIoKTtcblxuICAgIHRoaXMuX3NldEFjdGl2ZSgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9IVE1MNSk7XG5BdWRpb0hUTUw1LnR5cGUgPSBBdWRpb0hUTUw1LnByb3RvdHlwZS50eXBlID0gXCJodG1sNVwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KDQsNCx0L7RgtCwINGBINC30LDQs9GA0YPQt9GH0LjQutCw0LzQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INCw0YPQtNC40L4t0YTQsNC50LvQvtCyXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fYWRkTG9hZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZExvYWRlclwiKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbG9hZGVyID0gbmV3IEF1ZGlvSFRNTDVMb2FkZXIoKTtcbiAgICBsb2FkZXIuaW5kZXggPSB0aGlzLmxvYWRlcnMucHVzaChsb2FkZXIpIC0gMTtcblxuICAgIGxvYWRlci5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IChzZWxmLmxvYWRlcnMubGVuZ3RoICsgbG9hZGVyLmluZGV4IC0gc2VsZi5hY3RpdmVMb2FkZXIpICUgc2VsZi5sb2FkZXJzLmxlbmd0aDtcbiAgICAgICAgc2VsZi50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9hZGVyLmNyZWF0ZVNvdXJjZShhdWRpb0NvbnRleHQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LDQutGC0LjQstC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9zZXRBY3RpdmUgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0QWN0aXZlXCIsIG9mZnNldCk7XG5cbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9ICh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TV0FQLCBvZmZzZXQpO1xuXG4gICAgaWYgKG9mZnNldCAhPT0gMCkge1xuICAgICAgICAvL0lORk86INC10YHQu9C4INGA0LXQu9C40LfQvtCy0YvQstCw0YLRjCDQutC+0L3RhtC10L/RhtC40Y4g0LzQvdC+0LbQtdGB0YLQstCwINC30LDQs9GA0YPQt9GH0LjQutC+0LIsINGC0L4g0Y3RgtC+INC90YPQttC90L4g0LTQvtGA0LDQsdC+0YLQsNGC0YwuXG4gICAgICAgIHRoaXMuc3RvcChvZmZzZXQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0Lgg0L7RgtC/0LjRgdCw0YLRjCDQtdCz0L4g0L7RgiDRgdC+0LHRi9GC0LjQuSDRgdGC0LDRgNGC0LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge0F1ZGlvfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2dldExvYWRlciA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuICAgIHJldHVybiB0aGlzLmxvYWRlcnNbKHRoaXMuYWN0aXZlTG9hZGVyICsgb2Zmc2V0KSAlIHRoaXMubG9hZGVycy5sZW5ndGhdO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC60LvRjtGH0LXQvdC40LUgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQktC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwIENPUlMuICoqKtCS0JDQltCd0J4hKioqIC0g0LXRgdC70Lgg0LLQutC70Y7Rh9C40YLRjCDRgNC10LbQuNC8IENPUlMsINCw0YPQtNC40L4g0Y3Qu9C10LzQtdC90YIg0L3QtSDRgdC80L7QttC10YIg0LfQsNCz0YDRg9C20LDRgtGMINC00LDQvdC90YvQtSDRgdC+XG4gKiDRgdGC0L7RgNC+0L3QvdC40YUg0LTQvtC80LXQvdC+0LIsINC10YHQu9C4INCyINC+0YLQstC10YLQtSDQvdC1INCx0YPQtNC10YIg0L/RgNCw0LLQuNC70YzQvdC+0LPQviDQt9Cw0LPQvtC70L7QstC60LAgQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luLiDQldGB0LvQuCDQvdC1INC/0LvQsNC90LjRgNGD0LXRgtGB0Y9cbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC1IFdlYiBBdWRpbyBBUEksINC90LUg0YHRgtC+0LjRgiDQstC60LvRjtGH0LDRgtGMINGN0YLQvtGCINGA0LXQttC40LwuXG4gKiBAcGFyYW0gc3RhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlQ3Jvc3NEb21haW4gPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIudG9nZ2xlQ3Jvc3NEb21haW4oc3RhdGUpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKlxuICogKirQktC90LjQvNCw0L3QuNC1ISoqIC0g0L/QvtGB0LvQtSDQstC60LvRjtGH0LXQvdC40Y8g0YDQtdC20LjQvNCwIFdlYiBBdWRpbyBBUEkg0L7QvSDQvdC1INC+0YLQutC70Y7Rh9Cw0LXRgtGB0Y8g0L/QvtC70L3QvtGB0YLRjNGOLCDRgi7Qui4g0LTQu9GPINGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPXG4gKiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLCDQutC+0YLQvtGA0L7QuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LrQu9C40Log0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GPLiDQn9GA0Lgg0L7RgtC60LvRjtGH0LXQvdC40Lgg0LjQtyDQs9GA0LDRhNCwINC+0LHRgNCw0LHQvtGC0LrQuCDQuNGB0LrQu9GO0YfQsNGO0YLRgdGPXG4gKiDQstGB0LUg0L3QvtC00Ysg0LrRgNC+0LzQtSDQvdC+0LQt0LjRgdGC0L7Rh9C90LjQutC+0LIg0Lgg0L3QvtC00Ysg0LLRi9Cy0L7QtNCwLCDRg9C/0YDQsNCy0LvQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0YzRjiDQv9C10YDQtdC60LvRjtGH0LDQtdGC0YHRjyDQvdCwINGN0LvQtdC80LXQvdGC0YsgYXVkaW8sINCx0LXQt1xuICog0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gR2Fpbk5vZGVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YFcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQuNGC0L7Qs9C+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICghYXVkaW9Db250ZXh0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElFcnJvclwiLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpID09IHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHRoaXMudm9sdW1lO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gMTtcbiAgICAgICAgICAgIGxvYWRlci5jcmVhdGVTb3VyY2UoYXVkaW9Db250ZXh0KTtcblxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QodGhpcy5wcmVwcm9jZXNzb3IgPyB0aGlzLnByZXByb2Nlc3Nvci5pbnB1dCA6IHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmF1ZGlvT3V0cHV0KSB7XG4gICAgICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICAgICAgdGhpcy5wcmVwcm9jZXNzb3Iub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICBkZWxldGUgdGhpcy5hdWRpb091dHB1dDtcblxuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICAgICAgLy9JTkZPOiDQv9C+0YHQu9C1INGC0L7Qs9C+INC60LDQuiDQvNGLINCy0LrQu9GO0YfQuNC70Lggd2ViQXVkaW9BUEkg0LXQs9C+INGD0LbQtSDQvdC10LvRjNC30Y8g0L/RgNC+0YHRgtC+INGC0LDQuiDQstGL0LrQu9GO0YfQuNGC0YwuXG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIHRoaXMud2ViQXVkaW9BcGkgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbn07XG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBpZiAoIXRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckVycm9yXCIsIHByZXByb2Nlc3Nvcik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yID09PSBwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wcmVwcm9jZXNzb3IgPSBwcmVwcm9jZXNzb3I7XG5cbiAgICBpZiAoIXByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHByZXByb2Nlc3Nvci5pbnB1dCk7XG4gICAgfSk7XG5cbiAgICBwcmVwcm9jZXNzb3Iub3V0cHV0LmNvbm5lY3QodGhpcy5hdWRpb091dHB1dCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJwbGF5XCIsIHNyYyk7XG5cbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKCk7XG5cbiAgICBsb2FkZXIubG9hZChzcmMpO1xuICAgIGxvYWRlci5wbGF5KDApO1xufTtcblxuLyoqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YMgKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuICAgIGxvYWRlci5wYXVzZSgpO1xufTtcblxuLyoqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRiyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicmVzdW1lXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcbiAgICBsb2FkZXIucGxheSgpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0b3BcIiwgb2Zmc2V0KTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCB8fCAwKTtcbiAgICBsb2FkZXIuc3RvcCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1NUT1AsIG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoKS5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcbiAgICB0aGlzLl9nZXRMb2FkZXIoKS5zZXRQb3NpdGlvbihwb3NpdGlvbiAtIDAuMDAxKTsgLy9USElOSzogbGVnYWN5LdC60L7QtC4g0J/QvtC90Y/RgtGMINC90LDRhNC40LMg0YLRg9GCINC90YPQttC10L0gMC4wMDFcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcihvZmZzZXQpLmF1ZGlvLmR1cmF0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcblxuICAgIGlmIChsb2FkZXIuYXVkaW8uYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBsb2FkZXIuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gbG9hZGVyLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcbiAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2Fpbi52YWx1ZSA9IHZvbHVtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgICAgIGxvYWRlci5hdWRpby52b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24sIG9mZnNldCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInByZWxvYWRcIiwgc3JjLCBvZmZzZXQpO1xuXG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcbiAgICBsb2FkZXIubG9hZChzcmMpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuc3JjID09PSBzcmMgJiYgIWxvYWRlci5ub3RMb2FkaW5nO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oc3JjLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuc3JjID09PSBzcmM7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKCFsb2FkZXIuc3JjKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUob2Zmc2V0KTtcbiAgICBsb2FkZXIucGxheSgpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuc3JjO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBkZXRlY3Qub25seURldmljZVZvbHVtZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IHRoaXMuZ2V0U3JjKDApLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiB0aGlzLmdldFNyYygxKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvSFRNTDU7XG4iLCJ2YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKCcuL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbGliL25ldC9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbG9nZ2VyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC9lcXVhbGl6ZXIvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2Z4L3ZvbHVtZS9leHBvcnQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBZYW5kZXhBdWRpbztcbiIsInZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0YLQu9C+0LbQtdC90L3QvtC1INC00LXQudGB0YLQstC40LVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIF9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQoNCw0LfRgNC10YjQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Jlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHsqfSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSDQv9C10YDQtdC00LDRgtGMINC+0YjQuNCx0LrRg1xuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG5cbiAgICB2YXIgcHJvbWlzZSA9IF9wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBzZWxmLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBzZWxmLnJlamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7IC8vIERvbid0IHRocm93IGVycm9ycyB0byBjb25zb2xlXG5cbiAgICAvKipcbiAgICAgKiDQktGL0L/QvtC70L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQntGC0LrQu9C+0L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucmVqZWN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcHJvbWlzZVxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcHJvbWlzZTsgfTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQstGL0L/QvtC70L3QtdC90LjRjyDRgdC/0LjRgdC60LAg0L7QsdC10YnQsNC90LjQuVxuICogQHBhcmFtIHsuLi4qfSBhcmdzIC0g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC+0LbQuNC00LDRgtGMXG4gKiBAcmV0dXJucyBBYm9ydGFibGVQcm9taXNlXG4gKi9cbkRlZmVycmVkLndoZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcblxuICAgIHZhciBsaXN0ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHZhciBwZW5kaW5nID0gbGlzdC5sZW5ndGg7XG5cbiAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwZW5kaW5nLS07XG5cbiAgICAgICAgaWYgKHBlbmRpbmcgPD0gMCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgIH0pO1xuICAgIGxpc3QgPSBudWxsO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZS5hYm9ydCA9IGRlZmVycmVkLnJlamVjdDtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmVycmVkO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vZGF0YS9tZXJnZScpO1xuXG52YXIgTElTVEVORVJTX05BTUUgPSBcIl9saXN0ZW5lcnNcIjtcbnZhciBNVVRFX09QVElPTiA9IFwiX211dGVkXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGB0L/QuNGB0LrQvtCyINGB0LvRg9GI0LDRgtC10LvQtdC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbGlzdGVuZXJzXG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBBcnJheS48RnVuY3Rpb24+Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTElTVEVORVJTX05BTUVdID0ge307XG5cbiAgICAvKiog0KTQu9Cw0LMg0LLQutC70Y7Rh9C10L3QuNGPL9Cy0YvQutC70Y7Rh9C10L3QuNGPINGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbXV0ZXNcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gZmFsc2U7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JLRgdGP0YfQtdGB0LrQuNC5INGB0LDRhdCw0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC60LvQsNGB0YEg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNsYXNzQ29uc3RydWN0b3IgLSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsFxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtLSDRgtC+0YIg0LbQtSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsCwg0YDQsNGB0YjQuNGA0LXQvdC90YvQuSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICovXG5FdmVudHMubWl4aW4gPSBmdW5jdGlvbihjbGFzc0NvbnN0cnVjdG9yKSB7XG4gICAgbWVyZ2UoY2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIEV2ZW50cy5wcm90b3R5cGUsIHRydWUpO1xuICAgIHJldHVybiBjbGFzc0NvbnN0cnVjdG9yO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC+0LHRitC10LrRgiDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtINC+0LHRitC10LrRglxuICogQHJldHVybnMge09iamVjdH0gLS0g0YLQvtGCINC20LUg0L7QsdGK0LXQutGCLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5ldmVudGl6ZSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIG1lcmdlKG9iamVjdCwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgRXZlbnRzLmNhbGwob2JqZWN0KTtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC/0LjRgdC60LAg0Lgg0L7RgtC/0LjRgdC60LAg0L7RgiDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSA9IFtdO1xuICAgIH1cblxuICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3Nba10gPT09IGNhbGxiYWNrIHx8IGNhbGxiYWNrc1trXS5jYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1LCDQvtGC0L/QuNGB0LDRgtGM0YHRjyDRgdGA0LDQt9GDINC/0L7RgdC70LUg0L/QtdGA0LLQvtCz0L4g0LLQvtC30L3QuNC60L3QvtCy0LXQvdC40Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCB3cmFwcGVyKTtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgd3JhcHBlci5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHNlbGYub24oZXZlbnQsIHdyYXBwZXIpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCe0YLQv9C40YHQsNGC0YzRgdGPINC+0YIg0LLRgdC10YUg0YHQu9GD0YjQsNGC0LXQu9C10Lkg0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLmNsZWFyTGlzdGVuZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXNbTElTVEVORVJTX05BTUVdKSB7XG4gICAgICAgIGlmICh0aGlzW0xJU1RFTkVSU19OQU1FXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1ba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCi0YDQuNCz0LPQtdGAINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDQuNC80Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7Li4uYXJnc30gYXJncyAtINC/0LDRgNCw0LzQtdGC0YDRiyDQtNC70Y8g0L/QtdGA0LXQtNCw0YfQuCDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvFxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50LCBhcmdzKSB7XG4gICAgaWYgKHRoaXNbTVVURV9PUFRJT05dKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZiAoZXZlbnQgIT09IFwiKlwiKSB7XG4gICAgICAgIEV2ZW50cy5wcm90b3R5cGUudHJpZ2dlci5hcHBseSh0aGlzLCBbXCIqXCIsIGV2ZW50XS5jb25jYXQoYXJncykpO1xuICAgIH1cblxuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSBbXS5jb25jYXQodGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKTtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGNhbGxiYWNrcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgY2FsbGJhY2tzW2tdLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQlNC10LvQtdCz0LjRgNC+0LLQsNGC0Ywg0LLRgdC1INGB0L7QsdGL0YLQuNGPINC00YDRg9Cz0L7QvNGDINC00LjRgdC/0LXRgtGH0LXRgNGDINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge0V2ZW50c30gYWNjZXB0b3IgLSDQv9C+0LvRg9GH0LDRgtC10LvRjCDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUucGlwZUV2ZW50cyA9IGZ1bmN0aW9uKGFjY2VwdG9yKSB7XG4gICAgdGhpcy5vbihcIipcIiwgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmJpbmQoYWNjZXB0b3IpKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQktC60LvRjtGH0LXQvdC40LUv0LLRi9C60LvRjtGH0LXQvdC40LUg0YLRgNC40LPQs9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINC30LDQv9GD0YHQuiDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0JLQvtC30L7QsdC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLnVubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRlbGV0ZSB0aGlzW01VVEVfT1BUSU9OXTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuIiwidmFyIHZvdyA9IHJlcXVpcmUoJ3ZvdycpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2Jyb3dzZXIvZGV0ZWN0Jyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIFByb21pc2VcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZXxFUyAyMDE1IFByb21pc2V9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFByb21pc2U7XG5pZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlICE9PSBcImZ1bmN0aW9uXCJcbiAgICB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcImVkZ2VcIiAvLyDQvNC10LvQutC40LUg0LzRj9Cz0LrQuNC1INC60LDQuiDQstGB0LXQs9C00LAg0L3QuNGH0LXQs9C+INC90LUg0YPQvNC10Y7RgiDQtNC10LvQsNGC0Ywg0L/RgNCw0LLQuNC70YzQvdC+XG4pIHtcbiAgICBQcm9taXNlID0gdm93LlByb21pc2U7XG59IGVsc2Uge1xuICAgIFByb21pc2UgPSB3aW5kb3cuUHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0YDQsNC30YDQtdGI0ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVzb2x2ZVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1LCDQutC+0YLQvtGA0YvQvNC4INGA0LDQt9GA0LXRiNC40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0L7RgtC60LvQvtC90ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVqZWN0XG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0L7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTRg9GCINCy0YvQv9C+0LvQvdC10L3RiyDQstGB0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0L7QsdC10YnQsNC90LjRjy5cbiAqIEBtZXRob2QgUHJvbWlzZS5hbGxcbiAqIEBwYXJhbSB7QXJyYXkuPFByb21pc2U+fSBwcm9taXNlcyAtINGB0L/QuNGB0L7QuiDQvtCx0LXRidCw0L3QuNC5XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INCy0YvQv9C+0LvQvdC40YLRgdGPINGC0L7Qs9C00LAsINC60L7Qs9C00LAg0LHRg9C00LXRgiDQstGL0L/QvtC70L3QtdC90L4g0YXQvtGC0Y8g0LHRiyDQvtC00L3QviDQuNC3INC/0LXRgNC10LTQsNC90L3Ri9GFINC+0LHQtdGJ0LDQvdC40LkuXG4gKiBAbWV0aG9kIFByb21pc2UucmFjZVxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YDQsNC30YDQtdGI0LXQvdC40Y8g0Lgg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI3RoZW5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRhdCwXG4gKiBAcGFyYW0ge251bGx8ZnVuY3Rpb259IFtlcnJiYWNrXSAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEBtZXRob2QgUHJvbWlzZSNjYXRjaFxuICogQHBhcmFtIHtmdW5jdGlvbn0gZXJyYmFjayAtICDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LhcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvdC+0LLQvtC1INC+0LHQtdGJ0LDQvdC40LUg0LjQtyDRgNC10LfRg9C70YzRgtCw0YLQvtCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LBcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBBYm9ydGFibGVQcm9taXNlXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdC10YnQsNC90LjQtSDRgSDQstC+0LfQvNC+0LbQvdC+0YHRgtGM0Y4g0L7RgtC80LXQvdGLINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC90LjQvCDQtNC10LnRgdGC0LLQuNGPLlxuICogQGNsYXNzZGVzYyBBYm9ydGFibGVQcm9taXNlXG4gKiBAZXh0ZW5kcyBQcm9taXNlXG4gKi9cblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LTQtdC50YHRgtCy0LjRjyDRgdCy0Y/Qt9Cw0L3QvdC+0LPQviDRgSDQvtCx0LXRidCw0L3QuNC10LxcbiAqIEBhYnN0cmFjdFxuICogQG1ldGhvZCBBYm9ydGFibGVQcm9taXNlI2Fib3J0XG4gKiBAcGFyYW0ge1N0cmluZ3xFcnJvcn0gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC00LXQudGB0YLQstC40Y9cbiAqL1xuIiwidmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xuXG4vKipcbiAqINCh0L7QtNCw0L3QuNC1INC+0YLQutC70L7QvdGR0L3QvdC+0LPQviDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDQvdC1INC/0LvRjtGR0YLRgdGPINCyINC60L7QvdGB0L7Qu9GMINC+0YjQuNCx0LrQvtC5XG4gKiBAcGFyYW0ge0Vycm9yfSBkYXRhIC0g0L/RgNC40YfQuNC90LAg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgcmVqZWN0ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QoZGF0YSk7XG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApO1xuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG4iLCJ2YXIgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INCx0YDQsNGD0LfQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gVXNlcmFnZW50IFJlZ0V4cFxudmFyIHJ3ZWJraXQgPSAvKHdlYmtpdClbIFxcL10oW1xcdy5dKykvO1xudmFyIHJ5YWJybyA9IC8oeWFicm93c2VyKVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcm9wZXJhID0gLyhvcHJ8b3BlcmEpKD86Lip2ZXJzaW9uKT9bIFxcL10oW1xcdy5dKykvO1xudmFyIHJtc2llID0gLyhtc2llKSAoW1xcdy5dKykvO1xudmFyIHJlZGdlID0gLyhlZGdlKVxcLyhbXFx3Ll0rKS87XG52YXIgcm1vemlsbGEgPSAvKG1vemlsbGEpKD86Lio/IHJ2OihbXFx3Ll0rKSk/LztcbnZhciByc2FmYXJpID0gL14oKD8hY2hyb21lKS4pKnZlcnNpb25cXC8oW1xcZFxcd1xcLl0rKS4qKHNhZmFyaSkvO1xuXG52YXIgbWF0Y2ggPSByc2FmYXJpLmV4ZWModWEpXG4gICAgfHwgcnlhYnJvLmV4ZWModWEpXG4gICAgfHwgcmVkZ2UuZXhlYyh1YSlcbiAgICB8fCByb3BlcmEuZXhlYyh1YSlcbiAgICB8fCByd2Via2l0LmV4ZWModWEpXG4gICAgfHwgcm1zaWUuZXhlYyh1YSlcbiAgICB8fCB1YS5pbmRleE9mKFwiY29tcGF0aWJsZVwiKSA8IDAgJiYgcm1vemlsbGEuZXhlYyh1YSlcbiAgICB8fCBbXTtcblxudmFyIGJyb3dzZXIgPSB7bmFtZTogbWF0Y2hbMV0gfHwgXCJcIiwgdmVyc2lvbjogbWF0Y2hbMl0gfHwgXCIwXCJ9O1xuXG5pZiAobWF0Y2hbM10gPT09IFwic2FmYXJpXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBtYXRjaFszXTtcbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gJ21zaWUnKSB7XG4gICAgaWYgKGRvY3VtZW50LmRvY3VtZW50TW9kZSkgeyAvLyBJRTggb3IgbGF0ZXJcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgfSBlbHNlIHsgLy8gSUUgNS03XG4gICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNTsgLy8gQXNzdW1lIHF1aXJrcyBtb2RlIHVubGVzcyBwcm92ZW4gb3RoZXJ3aXNlXG4gICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuY29tcGF0TW9kZSA9PT0gXCJDU1MxQ29tcGF0XCIpIHtcbiAgICAgICAgICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IDc7IC8vIHN0YW5kYXJkcyBtb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmIChicm93c2VyLm5hbWUgPT09IFwib3ByXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBcIm9wZXJhXCI7XG59XG5cbi8vSU5GTzogSUUgKNC60LDQuiDQstGB0LXQs9C00LApINC90LUg0LrQvtGA0YDQtdC60YLQvdC+INCy0YvRgdGC0LDQstC70Y/QtdGCIHVzZXItYWdlbnRcbmlmIChicm93c2VyLm5hbWUgPT09IFwibW96aWxsYVwiICYmIGJyb3dzZXIudmVyc2lvbi5zcGxpdChcIi5cIilbMF0gPT09IFwiMTFcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwibXNpZVwiO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LDRgtGE0L7RgNC80LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gVXNlcmFnZW50IFJlZ0V4cFxudmFyIHJwbGF0Zm9ybSA9IC8oaXBhZHxpcGhvbmV8aXBvZHxhbmRyb2lkfGJsYWNrYmVycnl8cGxheWJvb2t8d2luZG93cyBjZXx3ZWJvcykvO1xudmFyIHJ0YWJsZXQgPSAvKGlwYWR8cGxheWJvb2spLztcbnZhciByYW5kcm9pZCA9IC8oYW5kcm9pZCkvO1xudmFyIHJtb2JpbGUgPSAvKG1vYmlsZSkvO1xuXG5wbGF0Zm9ybSA9IHJwbGF0Zm9ybS5leGVjKHVhKSB8fCBbXTtcbnZhciB0YWJsZXQgPSBydGFibGV0LmV4ZWModWEpIHx8ICFybW9iaWxlLmV4ZWModWEpICYmIHJhbmRyb2lkLmV4ZWModWEpIHx8IFtdO1xuXG5pZiAocGxhdGZvcm1bMV0pIHtcbiAgICBwbGF0Zm9ybVsxXSA9IHBsYXRmb3JtWzFdLnJlcGxhY2UoL1xccy9nLCBcIl9cIik7IC8vIENoYW5nZSB3aGl0ZXNwYWNlIHRvIHVuZGVyc2NvcmUuIEVuYWJsZXMgZG90IG5vdGF0aW9uLlxufVxuXG52YXIgcGxhdGZvcm0gPSB7XG4gICAgdHlwZTogcGxhdGZvcm1bMV0gfHwgXCJcIixcbiAgICB0YWJsZXQ6ICEhdGFibGV0WzFdLFxuICAgIG1vYmlsZTogcGxhdGZvcm1bMV0gJiYgIXRhYmxldFsxXSB8fCBmYWxzZVxufTtcbmlmICghcGxhdGZvcm0udHlwZSkge1xuICAgIHBsYXRmb3JtLnR5cGUgPSAncGMnO1xufVxuXG5wbGF0Zm9ybS5vcyA9IHBsYXRmb3JtLnR5cGU7XG5pZiAocGxhdGZvcm0udHlwZSA9PT0gJ2lwYWQnIHx8IHBsYXRmb3JtLnR5cGUgPT09ICdpcGhvbmUnIHx8IHBsYXRmb3JtLnR5cGUgPT09ICdpcG9kJykge1xuICAgIHBsYXRmb3JtLm9zID0gJ2lvcyc7XG59IGVsc2UgaWYgKHBsYXRmb3JtLnR5cGUgPT09ICdhbmRyb2lkJykge1xuICAgIHBsYXRmb3JtLm9zID0gJ2FuZHJvaWQnO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiV2luXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ3aW5kb3dzXCI7XG4gICAgcGxhdGZvcm0udmVyc2lvbiA9IG5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goL3dpblteIF0qIChbXjtdKikvaSk7XG4gICAgcGxhdGZvcm0udmVyc2lvbiA9IHBsYXRmb3JtLnZlcnNpb24gJiYgcGxhdGZvcm0udmVyc2lvblsxXTtcbn0gZWxzZSBpZiAobmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibWFjb3NcIjtcbn0gZWxzZSBpZiAobmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIlgxMVwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwidW5peFwiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTGludXhcIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcImxpbnV4XCI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0LzQtdC90Y/RgtGMINCz0YDQvtC80LrQvtGB0YLRjFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxudmFyIG5vVm9sdW1lID0gdHJ1ZTtcbnRyeSB7XG4gICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICBhdWRpby52b2x1bWUgPSAwLjYzO1xuICAgIG5vVm9sdW1lID0gTWF0aC5hYnMoYXVkaW8udm9sdW1lIC0gMC42MykgPiAwLjAxO1xufSBjYXRjaChlKSB7XG4gICAgbm9Wb2x1bWUgPSB0cnVlO1xufVxuXG4vKipcbiAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+0LEg0L7QutGA0YPQttC10L3QuNC4XG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgZGV0ZWN0ID0ge1xuICAgIC8qKlxuICAgICAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+INCx0YDQsNGD0LfQtdGA0LVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBuYW1lIC0g0L3QsNC30LLQsNC90LjQtSDQsdGA0LDRg9C30LXRgNCwXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHZlcnNpb24gLSDQstC10YDRgdC40Y9cbiAgICAgKiBAcHJvcGVydHkge251bWJlcn0gW2RvY3VtZW50TW9kZV0gLSDQstC10YDRgdC40Y8g0LTQvtC60YPQvNC10L3RgtCwXG4gICAgICovXG4gICAgYnJvd3NlcjogYnJvd3NlcixcblxuICAgIC8qKlxuICAgICAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+INC/0LvQsNGC0YTQvtGA0LzQtVxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG9zIC0g0YLQuNC/INC+0L/QtdGA0LDRhtC40L7QvdC90L7QuSDRgdC40YHRgtC10LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0eXBlIC0g0YLQuNC/INC/0LvQsNGC0YTQvtGA0LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGFibGV0IC0g0L/Qu9Cw0L3RiNC10YJcbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IG1vYmlsZSAtINC80L7QsdC40LvRjNC90YvQuVxuICAgICAqL1xuICAgIHBsYXRmb3JtOiBwbGF0Zm9ybSxcblxuICAgIC8qKlxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQsCDQs9GA0L7QvNC60L7RgdGC0LhcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvbmx5RGV2aWNlVm9sdW1lOiBub1ZvbHVtZVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBkZXRlY3Q7XG4iLCIvKipcbiAqIEBsaWNlbnNlIFNXRk9iamVjdCB2Mi4yIDxodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0Lz5cbiAqIGlzIHJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZSA8aHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHA+XG4gKiBAcHJpdmF0ZVxuKi9cbnZhciBzd2ZvYmplY3QgPSBmdW5jdGlvbigpIHtcblx0dmFyIFVOREVGID0gXCJ1bmRlZmluZWRcIixcblx0XHRPQkpFQ1QgPSBcIm9iamVjdFwiLFxuXHRcdFNIT0NLV0FWRV9GTEFTSCA9IFwiU2hvY2t3YXZlIEZsYXNoXCIsXG5cdFx0U0hPQ0tXQVZFX0ZMQVNIX0FYID0gXCJTaG9ja3dhdmVGbGFzaC5TaG9ja3dhdmVGbGFzaFwiLFxuXHRcdEZMQVNIX01JTUVfVFlQRSA9IFwiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIixcblx0XHRFWFBSRVNTX0lOU1RBTExfSUQgPSBcIlNXRk9iamVjdEV4cHJJbnN0XCIsXG5cdFx0T05fUkVBRFlfU1RBVEVfQ0hBTkdFID0gXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIixcblx0XHR3aW4gPSB3aW5kb3csXG5cdFx0ZG9jID0gZG9jdW1lbnQsXG5cdFx0bmF2ID0gbmF2aWdhdG9yLFxuXHRcdHBsdWdpbiA9IGZhbHNlLFxuXHRcdGRvbUxvYWRGbkFyciA9IFttYWluXSxcblx0XHRyZWdPYmpBcnIgPSBbXSxcblx0XHRvYmpJZEFyciA9IFtdLFxuXHRcdGxpc3RlbmVyc0FyciA9IFtdLFxuXHRcdHN0b3JlZEFsdENvbnRlbnQsXG5cdFx0c3RvcmVkQWx0Q29udGVudElkLFxuXHRcdHN0b3JlZENhbGxiYWNrRm4sXG5cdFx0c3RvcmVkQ2FsbGJhY2tPYmosXG5cdFx0aXNEb21Mb2FkZWQgPSBmYWxzZSxcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gZmFsc2UsXG5cdFx0ZHluYW1pY1N0eWxlc2hlZXQsXG5cdFx0ZHluYW1pY1N0eWxlc2hlZXRNZWRpYSxcblx0XHRhdXRvSGlkZVNob3cgPSB0cnVlLFxuXHQvKiBDZW50cmFsaXplZCBmdW5jdGlvbiBmb3IgYnJvd3NlciBmZWF0dXJlIGRldGVjdGlvblxuXHRcdC0gVXNlciBhZ2VudCBzdHJpbmcgZGV0ZWN0aW9uIGlzIG9ubHkgdXNlZCB3aGVuIG5vIGdvb2QgYWx0ZXJuYXRpdmUgaXMgcG9zc2libGVcblx0XHQtIElzIGV4ZWN1dGVkIGRpcmVjdGx5IGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlXG5cdCovXG5cdHVhID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHczY2RvbSA9IHR5cGVvZiBkb2MuZ2V0RWxlbWVudEJ5SWQgIT0gVU5ERUYgJiYgdHlwZW9mIGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSAhPSBVTkRFRiAmJiB0eXBlb2YgZG9jLmNyZWF0ZUVsZW1lbnQgIT0gVU5ERUYsXG5cdFx0XHR1ID0gbmF2LnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0cCA9IG5hdi5wbGF0Zm9ybS50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0d2luZG93cyA9IHAgPyAvd2luLy50ZXN0KHApIDogL3dpbi8udGVzdCh1KSxcblx0XHRcdG1hYyA9IHAgPyAvbWFjLy50ZXN0KHApIDogL21hYy8udGVzdCh1KSxcblx0XHRcdHdlYmtpdCA9IC93ZWJraXQvLnRlc3QodSkgPyBwYXJzZUZsb2F0KHUucmVwbGFjZSgvXi4qd2Via2l0XFwvKFxcZCsoXFwuXFxkKyk/KS4qJC8sIFwiJDFcIikpIDogZmFsc2UsIC8vIHJldHVybnMgZWl0aGVyIHRoZSB3ZWJraXQgdmVyc2lvbiBvciBmYWxzZSBpZiBub3Qgd2Via2l0XG5cdFx0XHRpZSA9ICErXCJcXHYxXCIsIC8vIGZlYXR1cmUgZGV0ZWN0aW9uIGJhc2VkIG9uIEFuZHJlYSBHaWFtbWFyY2hpJ3Mgc29sdXRpb246IGh0dHA6Ly93ZWJyZWZsZWN0aW9uLmJsb2dzcG90LmNvbS8yMDA5LzAxLzMyLWJ5dGVzLXRvLWtub3ctaWYteW91ci1icm93c2VyLWlzLWllLmh0bWxcblx0XHRcdHBsYXllclZlcnNpb24gPSBbMCwwLDBdLFxuXHRcdFx0ZCA9IG51bGw7XG5cdFx0aWYgKHR5cGVvZiBuYXYucGx1Z2lucyAhPSBVTkRFRiAmJiB0eXBlb2YgbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXSA9PSBPQkpFQ1QpIHtcblx0XHRcdGQgPSBuYXYucGx1Z2luc1tTSE9DS1dBVkVfRkxBU0hdLmRlc2NyaXB0aW9uO1xuXHRcdFx0aWYgKGQgJiYgISh0eXBlb2YgbmF2Lm1pbWVUeXBlcyAhPSBVTkRFRiAmJiBuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0gJiYgIW5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXS5lbmFibGVkUGx1Z2luKSkgeyAvLyBuYXZpZ2F0b3IubWltZVR5cGVzW1wiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIl0uZW5hYmxlZFBsdWdpbiBpbmRpY2F0ZXMgd2hldGhlciBwbHVnLWlucyBhcmUgZW5hYmxlZCBvciBkaXNhYmxlZCBpbiBTYWZhcmkgMytcblx0XHRcdFx0cGx1Z2luID0gdHJ1ZTtcblx0XHRcdFx0aWUgPSBmYWxzZTsgLy8gY2FzY2FkZWQgZmVhdHVyZSBkZXRlY3Rpb24gZm9yIEludGVybmV0IEV4cGxvcmVyXG5cdFx0XHRcdGQgPSBkLnJlcGxhY2UoL14uKlxccysoXFxTK1xccytcXFMrJCkvLCBcIiQxXCIpO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzBdID0gcGFyc2VJbnQoZC5yZXBsYWNlKC9eKC4qKVxcLi4qJC8sIFwiJDFcIiksIDEwKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblsxXSA9IHBhcnNlSW50KGQucmVwbGFjZSgvXi4qXFwuKC4qKVxccy4qJC8sIFwiJDFcIiksIDEwKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblsyXSA9IC9bYS16QS1aXS8udGVzdChkKSA/IHBhcnNlSW50KGQucmVwbGFjZSgvXi4qW2EtekEtWl0rKC4qKSQvLCBcIiQxXCIpLCAxMCkgOiAwO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLkFjdGl2ZVhPYmplY3QgIT0gVU5ERUYpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBhID0gbmV3IEFjdGl2ZVhPYmplY3QoU0hPQ0tXQVZFX0ZMQVNIX0FYKTtcblx0XHRcdFx0aWYgKGEpIHsgLy8gYSB3aWxsIHJldHVybiBudWxsIHdoZW4gQWN0aXZlWCBpcyBkaXNhYmxlZFxuXHRcdFx0XHRcdGQgPSBhLkdldFZhcmlhYmxlKFwiJHZlcnNpb25cIik7XG5cdFx0XHRcdFx0aWYgKGQpIHtcblx0XHRcdFx0XHRcdGllID0gdHJ1ZTsgLy8gY2FzY2FkZWQgZmVhdHVyZSBkZXRlY3Rpb24gZm9yIEludGVybmV0IEV4cGxvcmVyXG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0cGxheWVyVmVyc2lvbiA9IFtwYXJzZUludChkWzBdLCAxMCksIHBhcnNlSW50KGRbMV0sIDEwKSwgcGFyc2VJbnQoZFsyXSwgMTApXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhdGNoKGUpIHt9XG5cdFx0fVxuXHRcdHJldHVybiB7IHczOnczY2RvbSwgcHY6cGxheWVyVmVyc2lvbiwgd2s6d2Via2l0LCBpZTppZSwgd2luOndpbmRvd3MsIG1hYzptYWMgfTtcblx0fSgpO1xuXHQvKiBDcm9zcy1icm93c2VyIG9uRG9tTG9hZFxuXHRcdC0gV2lsbCBmaXJlIGFuIGV2ZW50IGFzIHNvb24gYXMgdGhlIERPTSBvZiBhIHdlYiBwYWdlIGlzIGxvYWRlZFxuXHRcdC0gSW50ZXJuZXQgRXhwbG9yZXIgd29ya2Fyb3VuZCBiYXNlZCBvbiBEaWVnbyBQZXJpbmkncyBzb2x1dGlvbjogaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL0lFQ29udGVudExvYWRlZC9cblx0XHQtIFJlZ3VsYXIgb25sb2FkIHNlcnZlcyBhcyBmYWxsYmFja1xuXHQqL1xuXHQoZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF1YS53MykgeyByZXR1cm47IH1cblx0XHRpZiAoKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSAhPSBVTkRFRiAmJiBkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHx8ICh0eXBlb2YgZG9jLnJlYWR5U3RhdGUgPT0gVU5ERUYgJiYgKGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF0gfHwgZG9jLmJvZHkpKSkgeyAvLyBmdW5jdGlvbiBpcyBmaXJlZCBhZnRlciBvbmxvYWQsIGUuZy4gd2hlbiBzY3JpcHQgaXMgaW5zZXJ0ZWQgZHluYW1pY2FsbHlcblx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0fVxuXHRcdGlmICghaXNEb21Mb2FkZWQpIHtcblx0XHRcdGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdFx0ZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGNhbGxEb21Mb2FkRnVuY3Rpb25zLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRcdGRvYy5hdHRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmIChkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHtcblx0XHRcdFx0XHRcdGRvYy5kZXRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGFyZ3VtZW50cy5jYWxsZWUpO1xuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAod2luID09IHRvcCkgeyAvLyBpZiBub3QgaW5zaWRlIGFuIGlmcmFtZVxuXHRcdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZG9jLmRvY3VtZW50RWxlbWVudC5kb1Njcm9sbChcImxlZnRcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXRjaChlKSB7XG5cdFx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdFx0fSkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHVhLndrKSB7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChpc0RvbUxvYWRlZCkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAoIS9sb2FkZWR8Y29tcGxldGUvLnRlc3QoZG9jLnJlYWR5U3RhdGUpKSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0YWRkTG9hZEV2ZW50KGNhbGxEb21Mb2FkRnVuY3Rpb25zKTtcblx0XHR9XG5cdH0pKCk7XG5cdGZ1bmN0aW9uIGNhbGxEb21Mb2FkRnVuY3Rpb25zKCkge1xuXHRcdGlmIChpc0RvbUxvYWRlZCkgeyByZXR1cm47IH1cblx0XHR0cnkgeyAvLyB0ZXN0IGlmIHdlIGNhbiByZWFsbHkgYWRkL3JlbW92ZSBlbGVtZW50cyB0by9mcm9tIHRoZSBET007IHdlIGRvbid0IHdhbnQgdG8gZmlyZSBpdCB0b28gZWFybHlcblx0XHRcdHZhciB0ID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXS5hcHBlbmRDaGlsZChjcmVhdGVFbGVtZW50KFwic3BhblwiKSk7XG5cdFx0XHR0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodCk7XG5cdFx0fVxuXHRcdGNhdGNoIChlKSB7IHJldHVybjsgfVxuXHRcdGlzRG9tTG9hZGVkID0gdHJ1ZTtcblx0XHR2YXIgZGwgPSBkb21Mb2FkRm5BcnIubGVuZ3RoO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGw7IGkrKykge1xuXHRcdFx0ZG9tTG9hZEZuQXJyW2ldKCk7XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGFkZERvbUxvYWRFdmVudChmbikge1xuXHRcdGlmIChpc0RvbUxvYWRlZCkge1xuXHRcdFx0Zm4oKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbZG9tTG9hZEZuQXJyLmxlbmd0aF0gPSBmbjsgLy8gQXJyYXkucHVzaCgpIGlzIG9ubHkgYXZhaWxhYmxlIGluIElFNS41K1xuXHRcdH1cblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIG9ubG9hZFxuXHRcdC0gQmFzZWQgb24gSmFtZXMgRWR3YXJkcycgc29sdXRpb246IGh0dHA6Ly9icm90aGVyY2FrZS5jb20vc2l0ZS9yZXNvdXJjZXMvc2NyaXB0cy9vbmxvYWQvXG5cdFx0LSBXaWxsIGZpcmUgYW4gZXZlbnQgYXMgc29vbiBhcyBhIHdlYiBwYWdlIGluY2x1ZGluZyBhbGwgb2YgaXRzIGFzc2V0cyBhcmUgbG9hZGVkXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGRMb2FkRXZlbnQoZm4pIHtcblx0XHRpZiAodHlwZW9mIHdpbi5hZGRFdmVudExpc3RlbmVyICE9IFVOREVGKSB7XG5cdFx0XHR3aW4uYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZm4sIGZhbHNlKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIGRvYy5hZGRFdmVudExpc3RlbmVyICE9IFVOREVGKSB7XG5cdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZm4sIGZhbHNlKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5hdHRhY2hFdmVudCAhPSBVTkRFRikge1xuXHRcdFx0YWRkTGlzdGVuZXIod2luLCBcIm9ubG9hZFwiLCBmbik7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4ub25sb2FkID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dmFyIGZuT2xkID0gd2luLm9ubG9hZDtcblx0XHRcdHdpbi5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm5PbGQoKTtcblx0XHRcdFx0Zm4oKTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0d2luLm9ubG9hZCA9IGZuO1xuXHRcdH1cblx0fVxuXHQvKiBNYWluIGZ1bmN0aW9uXG5cdFx0LSBXaWxsIHByZWZlcmFibHkgZXhlY3V0ZSBvbkRvbUxvYWQsIG90aGVyd2lzZSBvbmxvYWQgKGFzIGEgZmFsbGJhY2spXG5cdCovXG5cdGZ1bmN0aW9uIG1haW4oKSB7XG5cdFx0aWYgKHBsdWdpbikge1xuXHRcdFx0dGVzdFBsYXllclZlcnNpb24oKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRtYXRjaFZlcnNpb25zKCk7XG5cdFx0fVxuXHR9XG5cdC8qIERldGVjdCB0aGUgRmxhc2ggUGxheWVyIHZlcnNpb24gZm9yIG5vbi1JbnRlcm5ldCBFeHBsb3JlciBicm93c2Vyc1xuXHRcdC0gRGV0ZWN0aW5nIHRoZSBwbHVnLWluIHZlcnNpb24gdmlhIHRoZSBvYmplY3QgZWxlbWVudCBpcyBtb3JlIHByZWNpc2UgdGhhbiB1c2luZyB0aGUgcGx1Z2lucyBjb2xsZWN0aW9uIGl0ZW0ncyBkZXNjcmlwdGlvbjpcblx0XHQgIGEuIEJvdGggcmVsZWFzZSBhbmQgYnVpbGQgbnVtYmVycyBjYW4gYmUgZGV0ZWN0ZWRcblx0XHQgIGIuIEF2b2lkIHdyb25nIGRlc2NyaXB0aW9ucyBieSBjb3JydXB0IGluc3RhbGxlcnMgcHJvdmlkZWQgYnkgQWRvYmVcblx0XHQgIGMuIEF2b2lkIHdyb25nIGRlc2NyaXB0aW9ucyBieSBtdWx0aXBsZSBGbGFzaCBQbGF5ZXIgZW50cmllcyBpbiB0aGUgcGx1Z2luIEFycmF5LCBjYXVzZWQgYnkgaW5jb3JyZWN0IGJyb3dzZXIgaW1wb3J0c1xuXHRcdC0gRGlzYWR2YW50YWdlIG9mIHRoaXMgbWV0aG9kIGlzIHRoYXQgaXQgZGVwZW5kcyBvbiB0aGUgYXZhaWxhYmlsaXR5IG9mIHRoZSBET00sIHdoaWxlIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXMgaW1tZWRpYXRlbHkgYXZhaWxhYmxlXG5cdCovXG5cdGZ1bmN0aW9uIHRlc3RQbGF5ZXJWZXJzaW9uKCkge1xuXHRcdHZhciBiID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXTtcblx0XHR2YXIgbyA9IGNyZWF0ZUVsZW1lbnQoT0JKRUNUKTtcblx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHR2YXIgdCA9IGIuYXBwZW5kQ2hpbGQobyk7XG5cdFx0aWYgKHQpIHtcblx0XHRcdHZhciBjb3VudGVyID0gMDtcblx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRpZiAodHlwZW9mIHQuR2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHR2YXIgZCA9IHQuR2V0VmFyaWFibGUoXCIkdmVyc2lvblwiKTtcblx0XHRcdFx0XHRpZiAoZCkge1xuXHRcdFx0XHRcdFx0ZCA9IGQuc3BsaXQoXCIgXCIpWzFdLnNwbGl0KFwiLFwiKTtcblx0XHRcdFx0XHRcdHVhLnB2ID0gW3BhcnNlSW50KGRbMF0sIDEwKSwgcGFyc2VJbnQoZFsxXSwgMTApLCBwYXJzZUludChkWzJdLCAxMCldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChjb3VudGVyIDwgMTApIHtcblx0XHRcdFx0XHRjb3VudGVyKys7XG5cdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGIucmVtb3ZlQ2hpbGQobyk7XG5cdFx0XHRcdHQgPSBudWxsO1xuXHRcdFx0XHRtYXRjaFZlcnNpb25zKCk7XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogUGVyZm9ybSBGbGFzaCBQbGF5ZXIgYW5kIFNXRiB2ZXJzaW9uIG1hdGNoaW5nOyBzdGF0aWMgcHVibGlzaGluZyBvbmx5XG5cdCovXG5cdGZ1bmN0aW9uIG1hdGNoVmVyc2lvbnMoKSB7XG5cdFx0dmFyIHJsID0gcmVnT2JqQXJyLmxlbmd0aDtcblx0XHRpZiAocmwgPiAwKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHJsOyBpKyspIHsgLy8gZm9yIGVhY2ggcmVnaXN0ZXJlZCBvYmplY3QgZWxlbWVudFxuXHRcdFx0XHR2YXIgaWQgPSByZWdPYmpBcnJbaV0uaWQ7XG5cdFx0XHRcdHZhciBjYiA9IHJlZ09iakFycltpXS5jYWxsYmFja0ZuO1xuXHRcdFx0XHR2YXIgY2JPYmogPSB7c3VjY2VzczpmYWxzZSwgaWQ6aWR9O1xuXHRcdFx0XHRpZiAodWEucHZbMF0gPiAwKSB7XG5cdFx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRcdFx0XHRpZiAob2JqKSB7XG5cdFx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihyZWdPYmpBcnJbaV0uc3dmVmVyc2lvbikgJiYgISh1YS53ayAmJiB1YS53ayA8IDMxMikpIHsgLy8gRmxhc2ggUGxheWVyIHZlcnNpb24gPj0gcHVibGlzaGVkIFNXRiB2ZXJzaW9uOiBIb3VzdG9uLCB3ZSBoYXZlIGEgbWF0Y2ghXG5cdFx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoaWQsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdFx0XHRjYk9iai5zdWNjZXNzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRjYk9iai5yZWYgPSBnZXRPYmplY3RCeUlkKGlkKTtcblx0XHRcdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgaWYgKHJlZ09iakFycltpXS5leHByZXNzSW5zdGFsbCAmJiBjYW5FeHByZXNzSW5zdGFsbCgpKSB7IC8vIHNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2cgaWYgc2V0IGJ5IHRoZSB3ZWIgcGFnZSBhdXRob3IgYW5kIGlmIHN1cHBvcnRlZFxuXHRcdFx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0XHRcdGF0dC5kYXRhID0gcmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsO1xuXHRcdFx0XHRcdFx0XHRhdHQud2lkdGggPSBvYmouZ2V0QXR0cmlidXRlKFwid2lkdGhcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGF0dC5oZWlnaHQgPSBvYmouZ2V0QXR0cmlidXRlKFwiaGVpZ2h0XCIpIHx8IFwiMFwiO1xuXHRcdFx0XHRcdFx0XHRpZiAob2JqLmdldEF0dHJpYnV0ZShcImNsYXNzXCIpKSB7IGF0dC5zdHlsZWNsYXNzID0gb2JqLmdldEF0dHJpYnV0ZShcImNsYXNzXCIpOyB9XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIikpIHsgYXR0LmFsaWduID0gb2JqLmdldEF0dHJpYnV0ZShcImFsaWduXCIpOyB9XG5cdFx0XHRcdFx0XHRcdC8vIHBhcnNlIEhUTUwgb2JqZWN0IHBhcmFtIGVsZW1lbnQncyBuYW1lLXZhbHVlIHBhaXJzXG5cdFx0XHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRcdFx0dmFyIHAgPSBvYmouZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJwYXJhbVwiKTtcblx0XHRcdFx0XHRcdFx0dmFyIHBsID0gcC5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgcGw7IGorKykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChwW2pdLmdldEF0dHJpYnV0ZShcIm5hbWVcIikudG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHBhcltwW2pdLmdldEF0dHJpYnV0ZShcIm5hbWVcIildID0gcFtqXS5nZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCBpZCwgY2IpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7IC8vIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWlzbWF0Y2ggb3IgYW4gb2xkZXIgV2Via2l0IGVuZ2luZSB0aGF0IGlnbm9yZXMgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQncyBuZXN0ZWQgcGFyYW0gZWxlbWVudHM6IGRpc3BsYXkgYWx0ZXJuYXRpdmUgY29udGVudCBpbnN0ZWFkIG9mIFNXRlxuXHRcdFx0XHRcdFx0XHRkaXNwbGF5QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRcdFx0XHRpZiAoY2IpIHsgY2IoY2JPYmopOyB9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1x0Ly8gaWYgbm8gRmxhc2ggUGxheWVyIGlzIGluc3RhbGxlZCBvciB0aGUgZnAgdmVyc2lvbiBjYW5ub3QgYmUgZGV0ZWN0ZWQgd2UgbGV0IHRoZSBIVE1MIG9iamVjdCBlbGVtZW50IGRvIGl0cyBqb2IgKGVpdGhlciBzaG93IGEgU1dGIG9yIGFsdGVybmF0aXZlIGNvbnRlbnQpXG5cdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0aWYgKGNiKSB7XG5cdFx0XHRcdFx0XHR2YXIgbyA9IGdldE9iamVjdEJ5SWQoaWQpOyAvLyB0ZXN0IHdoZXRoZXIgdGhlcmUgaXMgYW4gSFRNTCBvYmplY3QgZWxlbWVudCBvciBub3Rcblx0XHRcdFx0XHRcdGlmIChvICYmIHR5cGVvZiBvLlNldFZhcmlhYmxlICE9IFVOREVGKSB7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRjYk9iai5yZWYgPSBvO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2IoY2JPYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBnZXRPYmplY3RCeUlkKG9iamVjdElkU3RyKSB7XG5cdFx0dmFyIHIgPSBudWxsO1xuXHRcdHZhciBvID0gZ2V0RWxlbWVudEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdGlmIChvICYmIG8ubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHR5cGVvZiBvLlNldFZhcmlhYmxlICE9IFVOREVGKSB7XG5cdFx0XHRcdHIgPSBvO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHZhciBuID0gby5nZXRFbGVtZW50c0J5VGFnTmFtZShPQkpFQ1QpWzBdO1xuXHRcdFx0XHRpZiAobikge1xuXHRcdFx0XHRcdHIgPSBuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByO1xuXHR9XG5cdC8qIFJlcXVpcmVtZW50cyBmb3IgQWRvYmUgRXhwcmVzcyBJbnN0YWxsXG5cdFx0LSBvbmx5IG9uZSBpbnN0YW5jZSBjYW4gYmUgYWN0aXZlIGF0IGEgdGltZVxuXHRcdC0gZnAgNi4wLjY1IG9yIGhpZ2hlclxuXHRcdC0gV2luL01hYyBPUyBvbmx5XG5cdFx0LSBubyBXZWJraXQgZW5naW5lcyBvbGRlciB0aGFuIHZlcnNpb24gMzEyXG5cdCovXG5cdGZ1bmN0aW9uIGNhbkV4cHJlc3NJbnN0YWxsKCkge1xuXHRcdHJldHVybiAhaXNFeHByZXNzSW5zdGFsbEFjdGl2ZSAmJiBoYXNQbGF5ZXJWZXJzaW9uKFwiNi4wLjY1XCIpICYmICh1YS53aW4gfHwgdWEubWFjKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKTtcblx0fVxuXHQvKiBTaG93IHRoZSBBZG9iZSBFeHByZXNzIEluc3RhbGwgZGlhbG9nXG5cdFx0LSBSZWZlcmVuY2U6IGh0dHA6Ly93d3cuYWRvYmUuY29tL2NmdXNpb24va25vd2xlZGdlYmFzZS9pbmRleC5jZm0/aWQ9NmEyNTNiNzVcblx0Ki9cblx0ZnVuY3Rpb24gc2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKSB7XG5cdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IHRydWU7XG5cdFx0c3RvcmVkQ2FsbGJhY2tGbiA9IGNhbGxiYWNrRm4gfHwgbnVsbDtcblx0XHRzdG9yZWRDYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQocmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0aWYgKG9iai5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7IC8vIHN0YXRpYyBwdWJsaXNoaW5nXG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnQgPSBhYnN0cmFjdEFsdENvbnRlbnQob2JqKTtcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudElkID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyBkeW5hbWljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IG9iajtcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudElkID0gcmVwbGFjZUVsZW1JZFN0cjtcblx0XHRcdH1cblx0XHRcdGF0dC5pZCA9IEVYUFJFU1NfSU5TVEFMTF9JRDtcblx0XHRcdGlmICh0eXBlb2YgYXR0LndpZHRoID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC53aWR0aCkgJiYgcGFyc2VJbnQoYXR0LndpZHRoLCAxMCkgPCAzMTApKSB7IGF0dC53aWR0aCA9IFwiMzEwXCI7IH1cblx0XHRcdGlmICh0eXBlb2YgYXR0LmhlaWdodCA9PSBVTkRFRiB8fCAoIS8lJC8udGVzdChhdHQuaGVpZ2h0KSAmJiBwYXJzZUludChhdHQuaGVpZ2h0LCAxMCkgPCAxMzcpKSB7IGF0dC5oZWlnaHQgPSBcIjEzN1wiOyB9XG5cdFx0XHRkb2MudGl0bGUgPSBkb2MudGl0bGUuc2xpY2UoMCwgNDcpICsgXCIgLSBGbGFzaCBQbGF5ZXIgSW5zdGFsbGF0aW9uXCI7XG5cdFx0XHR2YXIgcHQgPSB1YS5pZSAmJiB1YS53aW4gPyBcIkFjdGl2ZVhcIiA6IFwiUGx1Z0luXCIsXG5cdFx0XHRcdGZ2ID0gXCJNTXJlZGlyZWN0VVJMPVwiICsgd2luLmxvY2F0aW9uLnRvU3RyaW5nKCkucmVwbGFjZSgvJi9nLFwiJTI2XCIpICsgXCImTU1wbGF5ZXJUeXBlPVwiICsgcHQgKyBcIiZNTWRvY3RpdGxlPVwiICsgZG9jLnRpdGxlO1xuXHRcdFx0aWYgKHR5cGVvZiBwYXIuZmxhc2h2YXJzICE9IFVOREVGKSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBmdjtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRwYXIuZmxhc2h2YXJzID0gZnY7XG5cdFx0XHR9XG5cdFx0XHQvLyBJRSBvbmx5OiB3aGVuIGEgU1dGIGlzIGxvYWRpbmcgKEFORDogbm90IGF2YWlsYWJsZSBpbiBjYWNoZSkgd2FpdCBmb3IgdGhlIHJlYWR5U3RhdGUgb2YgdGhlIG9iamVjdCBlbGVtZW50IHRvIGJlY29tZSA0IGJlZm9yZSByZW1vdmluZyBpdCxcblx0XHRcdC8vIGJlY2F1c2UgeW91IGNhbm5vdCBwcm9wZXJseSBjYW5jZWwgYSBsb2FkaW5nIFNXRiBmaWxlIHdpdGhvdXQgYnJlYWtpbmcgYnJvd3NlciBsb2FkIHJlZmVyZW5jZXMsIGFsc28gb2JqLm9ucmVhZHlzdGF0ZWNoYW5nZSBkb2Vzbid0IHdvcmtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0XHR2YXIgbmV3T2JqID0gY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRcdFx0cmVwbGFjZUVsZW1JZFN0ciArPSBcIlNXRk9iamVjdE5ld1wiO1xuXHRcdFx0XHRuZXdPYmouc2V0QXR0cmlidXRlKFwiaWRcIiwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdPYmosIG9iaik7IC8vIGluc2VydCBwbGFjZWhvbGRlciBkaXYgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBvYmplY3QgZWxlbWVudCB0aGF0IGxvYWRzIGV4cHJlc3NpbnN0YWxsLnN3ZlxuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRjcmVhdGVTV0YoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdH1cblx0fVxuXHQvKiBGdW5jdGlvbnMgdG8gYWJzdHJhY3QgYW5kIGRpc3BsYXkgYWx0ZXJuYXRpdmUgY29udGVudFxuXHQqL1xuXHRmdW5jdGlvbiBkaXNwbGF5QWx0Q29udGVudChvYmopIHtcblx0XHRpZiAodWEuaWUgJiYgdWEud2luICYmIG9iai5yZWFkeVN0YXRlICE9IDQpIHtcblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0dmFyIGVsID0gY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRcdG9iai5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlbCwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGFic3RyYWN0QWx0Q29udGVudChvYmopLCBlbCk7XG5cdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRvYmoucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIG9iaik7XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGFic3RyYWN0QWx0Q29udGVudChvYmopIHtcblx0XHR2YXIgYWMgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdGlmICh1YS53aW4gJiYgdWEuaWUpIHtcblx0XHRcdGFjLmlubmVySFRNTCA9IG9iai5pbm5lckhUTUw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dmFyIG5lc3RlZE9iaiA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShPQkpFQ1QpWzBdO1xuXHRcdFx0aWYgKG5lc3RlZE9iaikge1xuXHRcdFx0XHR2YXIgYyA9IG5lc3RlZE9iai5jaGlsZE5vZGVzO1xuXHRcdFx0XHRpZiAoYykge1xuXHRcdFx0XHRcdHZhciBjbCA9IGMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY2w7IGkrKykge1xuXHRcdFx0XHRcdFx0aWYgKCEoY1tpXS5ub2RlVHlwZSA9PSAxICYmIGNbaV0ubm9kZU5hbWUgPT0gXCJQQVJBTVwiKSAmJiAhKGNbaV0ubm9kZVR5cGUgPT0gOCkpIHtcblx0XHRcdFx0XHRcdFx0YWMuYXBwZW5kQ2hpbGQoY1tpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gYWM7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIFNXRiBjcmVhdGlvblxuXHQqL1xuXHRmdW5jdGlvbiBjcmVhdGVTV0YoYXR0T2JqLCBwYXJPYmosIGlkKSB7XG5cdFx0dmFyIHIsIGVsID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmICh1YS53ayAmJiB1YS53ayA8IDMxMikgeyByZXR1cm4gcjsgfVxuXHRcdGlmIChlbCkge1xuXHRcdFx0aWYgKHR5cGVvZiBhdHRPYmouaWQgPT0gVU5ERUYpIHsgLy8gaWYgbm8gJ2lkJyBpcyBkZWZpbmVkIGZvciB0aGUgb2JqZWN0IGVsZW1lbnQsIGl0IHdpbGwgaW5oZXJpdCB0aGUgJ2lkJyBmcm9tIHRoZSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdGF0dE9iai5pZCA9IGlkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikgeyAvLyBJbnRlcm5ldCBFeHBsb3JlciArIHRoZSBIVE1MIG9iamVjdCBlbGVtZW50ICsgVzNDIERPTSBtZXRob2RzIGRvIG5vdCBjb21iaW5lOiBmYWxsIGJhY2sgdG8gb3V0ZXJIVE1MXG5cdFx0XHRcdHZhciBhdHQgPSBcIlwiO1xuXHRcdFx0XHRmb3IgKHZhciBpIGluIGF0dE9iaikge1xuXHRcdFx0XHRcdGlmIChhdHRPYmpbaV0gIT0gT2JqZWN0LnByb3RvdHlwZVtpXSkgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzXG5cdFx0XHRcdFx0XHRpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwiZGF0YVwiKSB7XG5cdFx0XHRcdFx0XHRcdHBhck9iai5tb3ZpZSA9IGF0dE9ialtpXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgaWYgKGkudG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0YXR0ICs9ICcgY2xhc3M9XCInICsgYXR0T2JqW2ldICsgJ1wiJztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgaWYgKGkudG9Mb3dlckNhc2UoKSAhPSBcImNsYXNzaWRcIikge1xuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyAnICsgaSArICc9XCInICsgYXR0T2JqW2ldICsgJ1wiJztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhciA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGogaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtqXSAhPSBPYmplY3QucHJvdG90eXBlW2pdKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdHBhciArPSAnPHBhcmFtIG5hbWU9XCInICsgaiArICdcIiB2YWx1ZT1cIicgKyBwYXJPYmpbal0gKyAnXCIgLz4nO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbC5vdXRlckhUTUwgPSAnPG9iamVjdCBjbGFzc2lkPVwiY2xzaWQ6RDI3Q0RCNkUtQUU2RC0xMWNmLTk2QjgtNDQ0NTUzNTQwMDAwXCInICsgYXR0ICsgJz4nICsgcGFyICsgJzwvb2JqZWN0Pic7XG5cdFx0XHRcdG9iaklkQXJyW29iaklkQXJyLmxlbmd0aF0gPSBhdHRPYmouaWQ7IC8vIHN0b3JlZCB0byBmaXggb2JqZWN0ICdsZWFrcycgb24gdW5sb2FkIChkeW5hbWljIHB1Ymxpc2hpbmcgb25seSlcblx0XHRcdFx0ciA9IGdldEVsZW1lbnRCeUlkKGF0dE9iai5pZCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHsgLy8gd2VsbC1iZWhhdmluZyBicm93c2Vyc1xuXHRcdFx0XHR2YXIgbyA9IGNyZWF0ZUVsZW1lbnQoT0JKRUNUKTtcblx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIEZMQVNIX01JTUVfVFlQRSk7XG5cdFx0XHRcdGZvciAodmFyIG0gaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialttXSAhPSBPYmplY3QucHJvdG90eXBlW21dKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChtLnRvTG93ZXJDYXNlKCkgPT0gXCJzdHlsZWNsYXNzXCIpIHsgLy8gJ2NsYXNzJyBpcyBhbiBFQ01BNCByZXNlcnZlZCBrZXl3b3JkXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgYXR0T2JqW21dKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgaWYgKG0udG9Mb3dlckNhc2UoKSAhPSBcImNsYXNzaWRcIikgeyAvLyBmaWx0ZXIgb3V0IElFIHNwZWNpZmljIGF0dHJpYnV0ZVxuXHRcdFx0XHRcdFx0XHRvLnNldEF0dHJpYnV0ZShtLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKHZhciBuIGluIHBhck9iaikge1xuXHRcdFx0XHRcdGlmIChwYXJPYmpbbl0gIT0gT2JqZWN0LnByb3RvdHlwZVtuXSAmJiBuLnRvTG93ZXJDYXNlKCkgIT0gXCJtb3ZpZVwiKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXMgYW5kIElFIHNwZWNpZmljIHBhcmFtIGVsZW1lbnRcblx0XHRcdFx0XHRcdGNyZWF0ZU9ialBhcmFtKG8sIG4sIHBhck9ialtuXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG8sIGVsKTtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByO1xuXHR9XG5cdGZ1bmN0aW9uIGNyZWF0ZU9ialBhcmFtKGVsLCBwTmFtZSwgcFZhbHVlKSB7XG5cdFx0dmFyIHAgPSBjcmVhdGVFbGVtZW50KFwicGFyYW1cIik7XG5cdFx0cC5zZXRBdHRyaWJ1dGUoXCJuYW1lXCIsIHBOYW1lKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcInZhbHVlXCIsIHBWYWx1ZSk7XG5cdFx0ZWwuYXBwZW5kQ2hpbGQocCk7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBTV0YgcmVtb3ZhbFxuXHRcdC0gRXNwZWNpYWxseSBuZWVkZWQgdG8gc2FmZWx5IGFuZCBjb21wbGV0ZWx5IHJlbW92ZSBhIFNXRiBpbiBJbnRlcm5ldCBFeHBsb3JlclxuXHQqL1xuXHRmdW5jdGlvbiByZW1vdmVTV0YoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmogJiYgb2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdFx0b2JqLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRcdHJlbW92ZU9iamVjdEluSUUoaWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiByZW1vdmVPYmplY3RJbklFKGlkKSB7XG5cdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRmb3IgKHZhciBpIGluIG9iaikge1xuXHRcdFx0XHRpZiAodHlwZW9mIG9ialtpXSA9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHRvYmpbaV0gPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdH1cblx0fVxuXHQvKiBGdW5jdGlvbnMgdG8gb3B0aW1pemUgSmF2YVNjcmlwdCBjb21wcmVzc2lvblxuXHQqL1xuXHRmdW5jdGlvbiBnZXRFbGVtZW50QnlJZChpZCkge1xuXHRcdHZhciBlbCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdGVsID0gZG9jLmdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHt9XG5cdFx0cmV0dXJuIGVsO1xuXHR9XG5cdGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQoZWwpIHtcblx0XHRyZXR1cm4gZG9jLmNyZWF0ZUVsZW1lbnQoZWwpO1xuXHR9XG5cdC8qIFVwZGF0ZWQgYXR0YWNoRXZlbnQgZnVuY3Rpb24gZm9yIEludGVybmV0IEV4cGxvcmVyXG5cdFx0LSBTdG9yZXMgYXR0YWNoRXZlbnQgaW5mb3JtYXRpb24gaW4gYW4gQXJyYXksIHNvIG9uIHVubG9hZCB0aGUgZGV0YWNoRXZlbnQgZnVuY3Rpb25zIGNhbiBiZSBjYWxsZWQgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdCovXG5cdGZ1bmN0aW9uIGFkZExpc3RlbmVyKHRhcmdldCwgZXZlbnRUeXBlLCBmbikge1xuXHRcdHRhcmdldC5hdHRhY2hFdmVudChldmVudFR5cGUsIGZuKTtcblx0XHRsaXN0ZW5lcnNBcnJbbGlzdGVuZXJzQXJyLmxlbmd0aF0gPSBbdGFyZ2V0LCBldmVudFR5cGUsIGZuXTtcblx0fVxuXHQvKiBGbGFzaCBQbGF5ZXIgYW5kIFNXRiBjb250ZW50IHZlcnNpb24gbWF0Y2hpbmdcblx0Ki9cblx0ZnVuY3Rpb24gaGFzUGxheWVyVmVyc2lvbihydikge1xuXHRcdHZhciBwdiA9IHVhLnB2LCB2ID0gcnYuc3BsaXQoXCIuXCIpO1xuXHRcdHZbMF0gPSBwYXJzZUludCh2WzBdLCAxMCk7XG5cdFx0dlsxXSA9IHBhcnNlSW50KHZbMV0sIDEwKSB8fCAwOyAvLyBzdXBwb3J0cyBzaG9ydCBub3RhdGlvbiwgZS5nLiBcIjlcIiBpbnN0ZWFkIG9mIFwiOS4wLjBcIlxuXHRcdHZbMl0gPSBwYXJzZUludCh2WzJdLCAxMCkgfHwgMDtcblx0XHRyZXR1cm4gKHB2WzBdID4gdlswXSB8fCAocHZbMF0gPT0gdlswXSAmJiBwdlsxXSA+IHZbMV0pIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID09IHZbMV0gJiYgcHZbMl0gPj0gdlsyXSkpID8gdHJ1ZSA6IGZhbHNlO1xuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgZHluYW1pYyBDU1MgY3JlYXRpb25cblx0XHQtIEJhc2VkIG9uIEJvYmJ5IHZhbiBkZXIgU2x1aXMnIHNvbHV0aW9uOiBodHRwOi8vd3d3LmJvYmJ5dmFuZGVyc2x1aXMuY29tL2FydGljbGVzL2R5bmFtaWNDU1MucGhwXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZUNTUyhzZWwsIGRlY2wsIG1lZGlhLCBuZXdTdHlsZSkge1xuXHRcdGlmICh1YS5pZSAmJiB1YS5tYWMpIHsgcmV0dXJuOyB9XG5cdFx0dmFyIGggPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdO1xuXHRcdGlmICghaCkgeyByZXR1cm47IH0gLy8gdG8gYWxzbyBzdXBwb3J0IGJhZGx5IGF1dGhvcmVkIEhUTUwgcGFnZXMgdGhhdCBsYWNrIGEgaGVhZCBlbGVtZW50XG5cdFx0dmFyIG0gPSAobWVkaWEgJiYgdHlwZW9mIG1lZGlhID09IFwic3RyaW5nXCIpID8gbWVkaWEgOiBcInNjcmVlblwiO1xuXHRcdGlmIChuZXdTdHlsZSkge1xuXHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQgPSBudWxsO1xuXHRcdFx0ZHluYW1pY1N0eWxlc2hlZXRNZWRpYSA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICghZHluYW1pY1N0eWxlc2hlZXQgfHwgZHluYW1pY1N0eWxlc2hlZXRNZWRpYSAhPSBtKSB7XG5cdFx0XHQvLyBjcmVhdGUgZHluYW1pYyBzdHlsZXNoZWV0ICsgZ2V0IGEgZ2xvYmFsIHJlZmVyZW5jZSB0byBpdFxuXHRcdFx0dmFyIHMgPSBjcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG5cdFx0XHRzLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJ0ZXh0L2Nzc1wiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwibWVkaWFcIiwgbSk7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGguYXBwZW5kQ2hpbGQocyk7XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luICYmIHR5cGVvZiBkb2Muc3R5bGVTaGVldHMgIT0gVU5ERUYgJiYgZG9jLnN0eWxlU2hlZXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQgPSBkb2Muc3R5bGVTaGVldHNbZG9jLnN0eWxlU2hlZXRzLmxlbmd0aCAtIDFdO1xuXHRcdFx0fVxuXHRcdFx0ZHluYW1pY1N0eWxlc2hlZXRNZWRpYSA9IG07XG5cdFx0fVxuXHRcdC8vIGFkZCBzdHlsZSBydWxlXG5cdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0aWYgKGR5bmFtaWNTdHlsZXNoZWV0ICYmIHR5cGVvZiBkeW5hbWljU3R5bGVzaGVldC5hZGRSdWxlID09IE9CSkVDVCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hZGRSdWxlKHNlbCwgZGVjbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0aWYgKGR5bmFtaWNTdHlsZXNoZWV0ICYmIHR5cGVvZiBkb2MuY3JlYXRlVGV4dE5vZGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZVRleHROb2RlKHNlbCArIFwiIHtcIiArIGRlY2wgKyBcIn1cIikpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBzZXRWaXNpYmlsaXR5KGlkLCBpc1Zpc2libGUpIHtcblx0XHRpZiAoIWF1dG9IaWRlU2hvdykgeyByZXR1cm47IH1cblx0XHR2YXIgdiA9IGlzVmlzaWJsZSA/IFwidmlzaWJsZVwiIDogXCJoaWRkZW5cIjtcblx0XHRpZiAoaXNEb21Mb2FkZWQgJiYgZ2V0RWxlbWVudEJ5SWQoaWQpKSB7XG5cdFx0XHRnZXRFbGVtZW50QnlJZChpZCkuc3R5bGUudmlzaWJpbGl0eSA9IHY7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y3JlYXRlQ1NTKFwiI1wiICsgaWQsIFwidmlzaWJpbGl0eTpcIiArIHYpO1xuXHRcdH1cblx0fVxuXHQvKiBGaWx0ZXIgdG8gYXZvaWQgWFNTIGF0dGFja3Ncblx0Ki9cblx0ZnVuY3Rpb24gdXJsRW5jb2RlSWZOZWNlc3Nhcnkocykge1xuXHRcdHZhciByZWdleCA9IC9bXFxcXFxcXCI8PlxcLjtdLztcblx0XHR2YXIgaGFzQmFkQ2hhcnMgPSByZWdleC5leGVjKHMpICE9IG51bGw7XG5cdFx0cmV0dXJuIGhhc0JhZENoYXJzICYmIHR5cGVvZiBlbmNvZGVVUklDb21wb25lbnQgIT0gVU5ERUYgPyBlbmNvZGVVUklDb21wb25lbnQocykgOiBzO1xuXHR9XG5cdC8qIFJlbGVhc2UgbWVtb3J5IHRvIGF2b2lkIG1lbW9yeSBsZWFrcyBjYXVzZWQgYnkgY2xvc3VyZXMsIGZpeCBoYW5naW5nIGF1ZGlvL3ZpZGVvIHRocmVhZHMgYW5kIGZvcmNlIG9wZW4gc29ja2V0cy9OZXRDb25uZWN0aW9ucyB0byBkaXNjb25uZWN0IChJbnRlcm5ldCBFeHBsb3JlciBvbmx5KVxuXHQqL1xuXHQoZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0d2luZG93LmF0dGFjaEV2ZW50KFwib251bmxvYWRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBsaXN0ZW5lcnMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdHZhciBsbCA9IGxpc3RlbmVyc0Fyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGw7IGkrKykge1xuXHRcdFx0XHRcdGxpc3RlbmVyc0FycltpXVswXS5kZXRhY2hFdmVudChsaXN0ZW5lcnNBcnJbaV1bMV0sIGxpc3RlbmVyc0FycltpXVsyXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBkeW5hbWljYWxseSBlbWJlZGRlZCBvYmplY3RzIHRvIGZpeCBhdWRpby92aWRlbyB0aHJlYWRzIGFuZCBmb3JjZSBvcGVuIHNvY2tldHMgYW5kIE5ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3Rcblx0XHRcdFx0dmFyIGlsID0gb2JqSWRBcnIubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGlsOyBqKyspIHtcblx0XHRcdFx0XHRyZW1vdmVTV0Yob2JqSWRBcnJbal0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGNsZWFudXAgbGlicmFyeSdzIG1haW4gY2xvc3VyZXMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdGZvciAodmFyIGsgaW4gdWEpIHtcblx0XHRcdFx0XHR1YVtrXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dWEgPSBudWxsO1xuXHRcdFx0XHRmb3IgKHZhciBsIGluIHN3Zm9iamVjdCkge1xuXHRcdFx0XHRcdHN3Zm9iamVjdFtsXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3dmb2JqZWN0ID0gbnVsbDtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSkoKTtcblx0cmV0dXJuIHtcblx0XHQvKiBQdWJsaWMgQVBJXG5cdFx0XHQtIFJlZmVyZW5jZTogaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2RvY3VtZW50YXRpb25cblx0XHQqL1xuXHRcdHJlZ2lzdGVyT2JqZWN0OiBmdW5jdGlvbihvYmplY3RJZFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRcdGlmICh1YS53MyAmJiBvYmplY3RJZFN0ciAmJiBzd2ZWZXJzaW9uU3RyKSB7XG5cdFx0XHRcdHZhciByZWdPYmogPSB7fTtcblx0XHRcdFx0cmVnT2JqLmlkID0gb2JqZWN0SWRTdHI7XG5cdFx0XHRcdHJlZ09iai5zd2ZWZXJzaW9uID0gc3dmVmVyc2lvblN0cjtcblx0XHRcdFx0cmVnT2JqLmV4cHJlc3NJbnN0YWxsID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdHJlZ09iai5jYWxsYmFja0ZuID0gY2FsbGJhY2tGbjtcblx0XHRcdFx0cmVnT2JqQXJyW3JlZ09iakFyci5sZW5ndGhdID0gcmVnT2JqO1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KG9iamVjdElkU3RyLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjYWxsYmFja0ZuKSB7XG5cdFx0XHRcdGNhbGxiYWNrRm4oe3N1Y2Nlc3M6ZmFsc2UsIGlkOm9iamVjdElkU3RyfSk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRnZXRPYmplY3RCeUlkOiBmdW5jdGlvbihvYmplY3RJZFN0cikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdHJldHVybiBnZXRPYmplY3RCeUlkKG9iamVjdElkU3RyKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGVtYmVkU1dGOiBmdW5jdGlvbihzd2ZVcmxTdHIsIHJlcGxhY2VFbGVtSWRTdHIsIHdpZHRoU3RyLCBoZWlnaHRTdHIsIHN3ZlZlcnNpb25TdHIsIHhpU3dmVXJsU3RyLCBmbGFzaHZhcnNPYmosIHBhck9iaiwgYXR0T2JqLCBjYWxsYmFja0ZuKSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tPYmogPSB7c3VjY2VzczpmYWxzZSwgaWQ6cmVwbGFjZUVsZW1JZFN0cn07XG5cdFx0XHRpZiAodWEudzMgJiYgISh1YS53ayAmJiB1YS53ayA8IDMxMikgJiYgc3dmVXJsU3RyICYmIHJlcGxhY2VFbGVtSWRTdHIgJiYgd2lkdGhTdHIgJiYgaGVpZ2h0U3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0c2V0VmlzaWJpbGl0eShyZXBsYWNlRWxlbUlkU3RyLCBmYWxzZSk7XG5cdFx0XHRcdGFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR3aWR0aFN0ciArPSBcIlwiOyAvLyBhdXRvLWNvbnZlcnQgdG8gc3RyaW5nXG5cdFx0XHRcdFx0aGVpZ2h0U3RyICs9IFwiXCI7XG5cdFx0XHRcdFx0dmFyIGF0dCA9IHt9O1xuXHRcdFx0XHRcdGlmIChhdHRPYmogJiYgdHlwZW9mIGF0dE9iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBpIGluIGF0dE9iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgYXR0T2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGF0dFtpXSA9IGF0dE9ialtpXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXR0LmRhdGEgPSBzd2ZVcmxTdHI7XG5cdFx0XHRcdFx0YXR0LndpZHRoID0gd2lkdGhTdHI7XG5cdFx0XHRcdFx0YXR0LmhlaWdodCA9IGhlaWdodFN0cjtcblx0XHRcdFx0XHR2YXIgcGFyID0ge307XG5cdFx0XHRcdFx0aWYgKHBhck9iaiAmJiB0eXBlb2YgcGFyT2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGogaW4gcGFyT2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBwYXJPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0cGFyW2pdID0gcGFyT2JqW2pdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZmxhc2h2YXJzT2JqICYmIHR5cGVvZiBmbGFzaHZhcnNPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgayBpbiBmbGFzaHZhcnNPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIGZsYXNodmFyc09iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0XHRwYXIuZmxhc2h2YXJzICs9IFwiJlwiICsgayArIFwiPVwiICsgZmxhc2h2YXJzT2JqW2tdO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGhhc1BsYXllclZlcnNpb24oc3dmVmVyc2lvblN0cikpIHsgLy8gY3JlYXRlIFNXRlxuXHRcdFx0XHRcdFx0dmFyIG9iaiA9IGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0XHRcdFx0XHRpZiAoYXR0LmlkID09IHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShyZXBsYWNlRWxlbUlkU3RyLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxiYWNrT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmoucmVmID0gb2JqO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmICh4aVN3ZlVybFN0ciAmJiBjYW5FeHByZXNzSW5zdGFsbCgpKSB7IC8vIHNob3cgQWRvYmUgRXhwcmVzcyBJbnN0YWxsXG5cdFx0XHRcdFx0XHRhdHQuZGF0YSA9IHhpU3dmVXJsU3RyO1xuXHRcdFx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7IC8vIHNob3cgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShyZXBsYWNlRWxlbUlkU3RyLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7IH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjYWxsYmFja0ZuKSB7IGNhbGxiYWNrRm4oY2FsbGJhY2tPYmopO1x0fVxuXHRcdH0sXG5cdFx0c3dpdGNoT2ZmQXV0b0hpZGVTaG93OiBmdW5jdGlvbigpIHtcblx0XHRcdGF1dG9IaWRlU2hvdyA9IGZhbHNlO1xuXHRcdH0sXG5cdFx0dWE6IHVhLFxuXHRcdGdldEZsYXNoUGxheWVyVmVyc2lvbjogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4geyBtYWpvcjp1YS5wdlswXSwgbWlub3I6dWEucHZbMV0sIHJlbGVhc2U6dWEucHZbMl0gfTtcblx0XHR9LFxuXHRcdGhhc0ZsYXNoUGxheWVyVmVyc2lvbjogaGFzUGxheWVyVmVyc2lvbixcblx0XHRjcmVhdGVTV0Y6IGZ1bmN0aW9uKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHNob3dFeHByZXNzSW5zdGFsbDogZnVuY3Rpb24oYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRcdGlmICh1YS53MyAmJiBjYW5FeHByZXNzSW5zdGFsbCgpKSB7XG5cdFx0XHRcdHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRyZW1vdmVTV0Y6IGZ1bmN0aW9uKG9iakVsZW1JZFN0cikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdHJlbW92ZVNXRihvYmpFbGVtSWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0Y3JlYXRlQ1NTOiBmdW5jdGlvbihzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRjcmVhdGVDU1Moc2VsU3RyLCBkZWNsU3RyLCBtZWRpYVN0ciwgbmV3U3R5bGVCb29sZWFuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGFkZERvbUxvYWRFdmVudDogYWRkRG9tTG9hZEV2ZW50LFxuXHRcdGFkZExvYWRFdmVudDogYWRkTG9hZEV2ZW50LFxuXHRcdGdldFF1ZXJ5UGFyYW1WYWx1ZTogZnVuY3Rpb24ocGFyYW0pIHtcblx0XHRcdHZhciBxID0gZG9jLmxvY2F0aW9uLnNlYXJjaCB8fCBkb2MubG9jYXRpb24uaGFzaDtcblx0XHRcdGlmIChxKSB7XG5cdFx0XHRcdGlmICgvXFw/Ly50ZXN0KHEpKSB7IHEgPSBxLnNwbGl0KFwiP1wiKVsxXTsgfSAvLyBzdHJpcCBxdWVzdGlvbiBtYXJrXG5cdFx0XHRcdGlmIChwYXJhbSA9PSBudWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBwYWlycyA9IHEuc3BsaXQoXCImXCIpO1xuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHBhaXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKHBhaXJzW2ldLnN1YnN0cmluZygwLCBwYWlyc1tpXS5pbmRleE9mKFwiPVwiKSkgPT0gcGFyYW0pIHtcblx0XHRcdFx0XHRcdHJldHVybiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShwYWlyc1tpXS5zdWJzdHJpbmcoKHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpICsgMSkpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH0sXG5cdFx0Ly8gRm9yIGludGVybmFsIHVzYWdlIG9ubHlcblx0XHRleHByZXNzSW5zdGFsbENhbGxiYWNrOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmIChpc0V4cHJlc3NJbnN0YWxsQWN0aXZlKSB7XG5cdFx0XHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChFWFBSRVNTX0lOU1RBTExfSUQpO1xuXHRcdFx0XHRpZiAob2JqICYmIHN0b3JlZEFsdENvbnRlbnQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoc3RvcmVkQWx0Q29udGVudCwgb2JqKTtcblx0XHRcdFx0XHRpZiAoc3RvcmVkQWx0Q29udGVudElkKSB7XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHN0b3JlZEFsdENvbnRlbnRJZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IHN0b3JlZEFsdENvbnRlbnQuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjsgfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RvcmVkQ2FsbGJhY2tGbikgeyBzdG9yZWRDYWxsYmFja0ZuKHN0b3JlZENhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59KCk7XG5tb2R1bGUuZXhwb3J0cyA9IHN3Zm9iamVjdDtcbiIsIi8qKlxuICog0KHQvtC30LTQsNGR0YIg0Y3QutC30LXQvNC/0LvRj9GAINC60LvQsNGB0YHQsCwg0L3QviDQvdC1INC30LDQv9GD0YHQutCw0LXRgiDQtdCz0L4g0LrQvtC90YHRgtGA0YPQutGC0L7RgFxuICogQHBhcmFtIHtmdW5jdGlvbn0gT3JpZ2luYWxDbGFzcyAtINC60LvQsNGB0YFcbiAqIEByZXR1cm5zIHtPcmlnaW5hbENsYXNzfVxuICogQHByaXZhdGVcbiAqL1xudmFyIGNsZWFySW5zdGFuY2UgPSBmdW5jdGlvbihPcmlnaW5hbENsYXNzKSB7XG4gICAgdmFyIENsZWFyQ2xhc3MgPSBmdW5jdGlvbigpe307XG4gICAgQ2xlYXJDbGFzcy5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcbiAgICByZXR1cm4gbmV3IENsZWFyQ2xhc3MoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY2xlYXJJbnN0YW5jZTtcbiIsInZhciBjbGVhckluc3RhbmNlID0gcmVxdWlyZSgnLi9jbGVhci1pbnN0YW5jZScpO1xuXG4vKipcbiAqIENsYXNzaWMgRXJyb3IgYWN0cyBsaWtlIGEgZmFicmljOiBFcnJvci5jYWxsKHRoaXMsIG1lc3NhZ2UpIGp1c3QgY3JlYXRlIG5ldyBvYmplY3QuXG4gKiBFcnJvckNsYXNzIGFjdHMgbW9yZSBsaWtlIGEgY2xhc3M6IEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKSBtb2RpZnkgJ3RoaXMnIG9iamVjdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gLSBlcnJvciBtZXNzYWdlXG4gKiBAcGFyYW0ge051bWJlcn0gW2lkXSAtIGVycm9yIGlkXG4gKiBAZXh0ZW5kcyBFcnJvclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRXJyb3JDbGFzcyA9IGZ1bmN0aW9uKG1lc3NhZ2UsIGlkKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlLCBpZCk7XG4gICAgZXJyLm5hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICB0aGlzLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB0aGlzLnN0YWNrID0gZXJyLnN0YWNrO1xufTtcblxuLyoqXG4gKiBTdWdhci4gSnVzdCBjcmVhdGUgaW5oZXJpdGFuY2UgZnJvbSBFcnJvckNsYXNzIGFuZCBkZWZpbmUgbmFtZSBwcm9wZXJ0eVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBuYW1lIG9mIGVycm9yIHR5cGVcbiAqIEByZXR1cm5zIHtFcnJvckNsYXNzfVxuICovXG5FcnJvckNsYXNzLmNyZWF0ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZXJyQ2xhc3MgPSBjbGVhckluc3RhbmNlKEVycm9yQ2xhc3MpO1xuICAgIGVyckNsYXNzLm5hbWUgPSBuYW1lO1xuICAgIHJldHVybiBlcnJDbGFzcztcbn07XG5cbkVycm9yQ2xhc3MucHJvdG90eXBlID0gY2xlYXJJbnN0YW5jZShFcnJvcik7XG5FcnJvckNsYXNzLnByb3RvdHlwZS5uYW1lID0gXCJFcnJvckNsYXNzXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXJyb3JDbGFzcztcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9hc3luYy9ldmVudHMnKTtcblxuLy9USElOSzog0LjQt9GD0YfQuNGC0Ywg0LrQsNC6INGA0LDQsdC+0YLQsNC10YIgRVMgMjAxNSBQcm94eSDQuCDQv9C+0L/RgNC+0LHQvtCy0LDRgtGMINC40YHQv9C+0LvRjNC30L7QstCw0YLRjFxuXG4vKipcbiAqIEBjbGFzc2Rlc2Mg0J/RgNC+0LrRgdC4LdC60LvQsNGB0YEuINCS0YvQtNCw0ZHRgiDQvdCw0YDRg9C20YMg0LvQuNGI0Ywg0L/Rg9Cx0LvQuNGH0L3Ri9C1INC80LXRgtC+0LTRiyDQvtCx0YrQtdC60YLQsCDQuCDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAuXG4gKiDQndC1INC60L7Qv9C40YDRg9C10YIg0LzQtdGC0L7QtNGLINC40LcgT2JqZWN0LnByb3RvdHlwZS4g0JLRgdC1INC80LXRgtC+0LTRiyDQuNC80LXRjtGCINC/0YDQuNCy0Y/Qt9C60YMg0LrQvtC90YLQtdC60YHRgtCwINC6INC/0YDQvtC60YHQuNGA0YPQtdC80L7QvNGDINC+0LHRitC10LrRgtGDLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0XSAtINC+0LHRitC10LrRgiwg0LrQvtGC0L7RgNGL0Lkg0YLRgNC10LHRg9C10YLRgdGPINC/0YDQvtC60YHQuNGA0L7QstCw0YLRjFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgUHJveHkgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChrZXlbMF0gPT09IFwiX1wiXG4gICAgICAgICAgICAgICAgfHwgdHlwZW9mIG9iamVjdFtrZXldICE9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAgICAgICB8fCBvYmplY3Rba2V5XSA9PT0gT2JqZWN0LnByb3RvdHlwZVtrZXldXG4gICAgICAgICAgICAgICAgfHwgb2JqZWN0Lmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgICAgICB8fCBFdmVudHMucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpc1trZXldID0gb2JqZWN0W2tleV0uYmluZChvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9iamVjdC5waXBlRXZlbnRzKSB7XG4gICAgICAgICAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5vbiA9IEV2ZW50cy5wcm90b3R5cGUub247XG4gICAgICAgICAgICB0aGlzLm9uY2UgPSBFdmVudHMucHJvdG90eXBlLm9uY2U7XG4gICAgICAgICAgICB0aGlzLm9mZiA9IEV2ZW50cy5wcm90b3R5cGUub2ZmO1xuICAgICAgICAgICAgdGhpcy5jbGVhckxpc3RlbmVycyA9IEV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIG9iamVjdC5waXBlRXZlbnRzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiDQrdC60YHQv9C+0YDRgtC40YDRg9C10YIg0YHRgtCw0YLQuNGH0LXRgdC60LjQtSDRgdCy0L7QudGB0YLQstCwINC40Lcg0L7QtNC90L7Qs9C+INC+0LHRitC10LrRgtCwINCyINC00YDRg9Cz0L7QuSwg0LjRgdC60LvRjtGH0LDRjyDRg9C60LDQt9Cw0L3QvdGL0LUsINC/0YDQuNCy0LDRgtC90YvQtSDQuCDQv9GA0L7RgtC+0YLQuNC/XG4gKiBAcGFyYW0ge09iamVjdH0gZnJvbSAtINC+0YLQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtPYmplY3R9IHRvIC0g0LrRg9C00LAg0LrQvtC/0LjRgNC+0LLQsNGC0YxcbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IFtleGNsdWRlXSAtINGB0LLQvtC50YHRgtCy0LAg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC40YHQutC70Y7Rh9C40YLRjFxuICovXG5Qcm94eS5leHBvcnRTdGF0aWMgPSBmdW5jdGlvbihmcm9tLCB0bywgZXhjbHVkZSkge1xuICAgIGV4Y2x1ZGUgPSBleGNsdWRlIHx8IFtdO1xuXG4gICAgT2JqZWN0LmtleXMoZnJvbSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgaWYgKCFmcm9tLmhhc093blByb3BlcnR5KGtleSlcbiAgICAgICAgICAgIHx8IGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgIHx8IGtleSA9PT0gXCJwcm90b3R5cGVcIlxuICAgICAgICAgICAgfHwgZXhjbHVkZS5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0b1trZXldID0gZnJvbVtrZXldO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC/0YDQvtC60YHQuC3Qv9C70LDRgdGB0LAg0L/RgNC40LLRj9C30LDQvdC90L7Qs9C+INC6INGD0LrQsNC30LDQvdC90L7QvNGDINC60LvQsNGB0YHRgy4g0JzQvtC20L3QviDQvdCw0LfQvdCw0YfQuNGC0Ywg0YDQvtC00LjRgtC10LvRjNGB0LrQuNC5INC60LvQsNGB0YEuXG4gKiDQoyDRgNC+0LTQuNGC0LXQu9GM0YHQutC+0LPQviDQutC70LDRgdGB0LAg0L/QvtGP0LLQu9GP0LXRgtGB0Y8g0L/RgNC40LLQsNGC0L3Ri9C5INC80LXRgtC+0LQgX3Byb3h5LCDQutC+0YLQvtGA0YvQuSDQstGL0LTQsNGR0YIg0L/RgNC+0LrRgdC4LdC+0LHRitC10LrRgiDQtNC70Y9cbiAqINC00LDQvdC90L7Qs9C+INGN0LrQt9C10LzQu9GP0YDQsC4g0KLQsNC60LbQtSDQv9C+0Y/QstC70Y/QtdGC0YHRjyDRgdCy0L7QudGB0YLQstC+IF9fcHJveHksINGB0L7QtNC10YDQttCw0YnQtdC1INGB0YHRi9C70LrRgyDQvdCwINGB0L7Qt9C00LDQvdC90YvQuSDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gT3JpZ2luYWxDbGFzcyAtINC+0YDQuNCz0LjQvdCw0LvRjNC90YvQuSDQutC70LDRgdGBXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBbUGFyZW50UHJveHlDbGFzcz1Qcm94eV0gLSDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgVxuICogQHJldHVybnMge2Z1bmN0aW9ufSAtLSDQutC+0L3RgdGC0YDRg9GC0L7RgCDQv9GA0L7QutGB0LjRgNC+0LLQsNC90L3QvtCz0L4g0LrQu9Cw0YHRgdCwXG4gKi9cblByb3h5LmNyZWF0ZUNsYXNzID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcywgUGFyZW50UHJveHlDbGFzcywgZXhjbHVkZVN0YXRpYykge1xuXG4gICAgdmFyIFByb3h5Q2xhc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcblxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBuZXcgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yKCk7XG4gICAgICAgIE9yaWdpbmFsQ2xhc3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLl9wcm94eSgpO1xuICAgIH07XG5cbiAgICB2YXIgUGFyZW50UHJveHlDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlID0gKFBhcmVudFByb3h5Q2xhc3MgfHwgUHJveHkpLnByb3RvdHlwZTtcbiAgICBQcm94eUNsYXNzLnByb3RvdHlwZSA9IG5ldyBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IoKTtcblxuICAgIHZhciB2YWw7XG4gICAgZm9yICh2YXIgayBpbiBPcmlnaW5hbENsYXNzLnByb3RvdHlwZSkge1xuICAgICAgICB2YWwgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZVtrXTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGVba10gPT0gdmFsIHx8IHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiB8fCBrWzBdID09PSBcIl9cIikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVba10gPSB2YWw7XG4gICAgfVxuXG4gICAgdmFyIGNyZWF0ZVByb3h5ID0gZnVuY3Rpb24ob3JpZ2luYWwpIHtcbiAgICAgICAgdmFyIHByb3RvID0gUHJveHkucHJvdG90eXBlO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBQcm94eUNsYXNzLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KG9yaWdpbmFsKTtcbiAgICAgICAgUHJveHkucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9O1xuXG4gICAgT3JpZ2luYWxDbGFzcy5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fX3Byb3h5KSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJveHkgPSBjcmVhdGVQcm94eSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fcHJveHk7XG4gICAgfTtcblxuICAgIGlmICghZXhjbHVkZVN0YXRpYykge1xuICAgICAgICBQcm94eS5leHBvcnRTdGF0aWMoT3JpZ2luYWxDbGFzcywgUHJveHlDbGFzcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb3h5Q2xhc3M7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5O1xuIiwiLyoqXG4gKiDQodC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAg0LLRgdC10YUg0L/QtdGA0LXRh9C40YHQu9C10L3QvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQsiDQvtC00LjQvS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIC0g0LXRgdC70Lgg0L/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIgdHJ1ZSwg0YLQviDQvdC+0LLRi9C5INC+0LHRitC10LrRgiDQvdC1INGB0L7Qt9C00LDRkdGC0YHRjywg0LAg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC00LDQvdC90YvQuVxuICogQHBhcmFtIHsuLi5PYmplY3R8Qm9vbGVhbn0gYXJncyAtINGB0L/QuNGB0L7QuiDQvtCx0YrQtdC60YLQvtCyINC40Lcg0LrQvtGC0L7RgNGL0YUg0LrQvtC/0LjRgNC+0LLQsNGC0Ywg0YHQstC+0LnRgdGC0LLQsC4g0J/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIg0LzQvtC20LXRgiDQsdGL0YLRjCDQu9C40LHQvlxuICog0L7QsdGK0LXQutGC0L7QvCwg0LvQuNCx0L4gdHJ1ZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbWVyZ2UgPSBmdW5jdGlvbiAoaW5pdGlhbCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGtleTtcblxuICAgIGlmIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IHRydWUpIHtcbiAgICAgICAgb2JqZWN0ID0gaW5pdGlhbDtcbiAgICAgICAgYXJncy5wb3AoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICAgICAgZm9yIChrZXkgaW4gaW5pdGlhbCkge1xuICAgICAgICAgICAgaWYgKGluaXRpYWwuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gaW5pdGlhbFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBhcmdzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBmb3IgKGtleSBpbiBhcmdzW2tdKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1trXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBhcmdzW2tdW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInJlcXVpcmUoJy4uLy4uLy4uL2V4cG9ydCcpO1xuXG52YXIgTG9hZGVyRXJyb3IgPSByZXF1aXJlKCcuL2xvYWRlci1lcnJvcicpO1xuXG55YS5tdXNpYy5BdWRpby5Mb2FkZXJFcnJvciA9IExvYWRlckVycm9yO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi8uLi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQvtC6INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uTG9hZGVyRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC60LhcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9hZGVyRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkxvYWRlckVycm9yLnByb3RvdHlwZSA9IEVycm9yQ2xhc3MuY3JlYXRlKFwiTG9hZGVyRXJyb3JcIik7XG5cbi8qKlxuICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5USU1FT1VUID0gXCJyZXF1ZXN0IHRpbWVvdXRcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC30LDQv9GA0L7RgdCwINC90LAg0LfQsNCz0YDRg9C30LrRg1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5GQUlMRUQgPSBcInJlcXVlc3QgZmFpbGVkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gTG9hZGVyRXJyb3I7XG4iLCIvKipcbiAqINCX0LDQs9C70YPRiNC60LAg0LIg0LLQuNC00LUg0L/Rg9GB0YLQvtC5INGE0YPQvdC60YbQuNC4INC90LAg0LLRgdC1INGB0LvRg9GH0LDQuCDQttC40LfQvdC4XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbm9vcDtcbiIsInJlcXVpcmUoXCIuLi9leHBvcnRcIik7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG55YS5tdXNpYy5BdWRpby5Mb2dnZXIgPSBMb2dnZXI7XG4iLCJ2YXIgTEVWRUxTID0gW1wiZGVidWdcIiwgXCJsb2dcIiwgXCJpbmZvXCIsIFwid2FyblwiLCBcImVycm9yXCIsIFwidHJhY2VcIl07XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL2xpYi9ub29wJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNGB0YLRgNCw0LjQstCw0LXQvNGL0LUg0LvQvtCz0LPQtdGAINC00LvRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLkxvZ2dlclxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwgLSDQuNC80Y8g0LrQsNC90LDQu9CwLCDQt9CwINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0L7RgtCy0LXRh9Cw0YLRjCDRjdC60LfQtdC80LvRj9GAINC70L7Qs9Cz0LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIExvZ2dlciA9IGZ1bmN0aW9uKGNoYW5uZWwpIHtcbiAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgdGC0YDQvtC50LrQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQuNCz0L3QvtGA0LjRgNGD0LXQvNGL0YUg0LrQsNC90LDQu9C+0LJcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmlnbm9yZXMgPSBbXTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINCyINC60L7QvdGB0L7Qu9C4INGD0YDQvtCy0L3QtdC5INC70L7Qs9CwXG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKi9cbkxvZ2dlci5sb2dMZXZlbHMgPSBbXTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0LjQvdGC0LDQutGB0LjRh9C10YHQutC40Lkg0YHQsNGF0LDRgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKipkZWJ1ZyoqXG4gKiBAbWV0aG9kIHlhLm11c2ljLkF1ZGlvLkxvZ2dlciNkZWJ1Z1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmRlYnVnID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqbG9nKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI2xvZ1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmxvZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmluZm8qKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjaW5mb1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmluZm8gPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip3YXJuKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI3dhcm5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS53YXJuID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZXJyb3IqKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjZXJyb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5lcnJvciA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKnRyYWNlKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI3RyYWNlXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUudHJhY2UgPSBub29wO1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCX0LDQv9C40YHRjCDQtNCw0L3QvdGL0YUg0LIg0LvQvtCzXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQtNC10LvQsNGC0Ywg0LfQsNC/0LjRgdGMINCyINC70L7Qs1xuICogQHBhcmFtIHtTdHJpbmd9IGxldmVsIC0g0YPRgNC+0LLQtdC90Ywg0LvQvtCz0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBjaGFubmVsIC0g0LrQsNC90LDQu1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIubG9nID0gZnVuY3Rpb24obGV2ZWwsIGNoYW5uZWwsIGNvbnRleHQpIHtcbiAgICB2YXIgZGF0YSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKS5tYXAoZnVuY3Rpb24oZHVtcEl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGR1bXBJdGVtICYmIGR1bXBJdGVtLl9sb2dnZXIgJiYgZHVtcEl0ZW0uX2xvZ2dlcigpIHx8IGR1bXBJdGVtO1xuICAgIH0pO1xuXG4gICAgdmFyIGxvZ0VudHJ5ID0ge1xuICAgICAgICB0aW1lc3RhbXA6ICtuZXcgRGF0ZSgpLFxuICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgIGNoYW5uZWw6IGNoYW5uZWwsXG4gICAgICAgIGNvbnRleHQ6IGNvbnRleHQsXG4gICAgICAgIG1lc3NhZ2U6IGRhdGFcbiAgICB9O1xuXG4gICAgaWYgKExvZ2dlci5pZ25vcmVzW2NoYW5uZWxdIHx8IExvZ2dlci5sb2dMZXZlbHMuaW5kZXhPZihsZXZlbCkgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBMb2dnZXIuX2R1bXBFbnRyeShsb2dFbnRyeSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LPQtVxuICogQHR5cGVkZWYge09iamVjdH0geWEubXVzaWMuQXVkaW8uTG9nZ2VyfkxvZ0VudHJ5XG4gKlxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHRpbWVzdGFtcCAtINCy0YDQtdC80Y8g0LIgdGltZXN0YW1wINGE0L7RgNC80LDRgtC1XG4gKiBAcHJvcGVydHkge1N0cmluZ30gbGV2ZWwgLSDRg9GA0L7QstC10L3RjCDQu9C+0LPQsFxuICogQHByb3BlcnR5IHtTdHJpbmd9IGNoYW5uZWwgLSDQutCw0L3QsNC7XG4gKiBAcHJvcGVydHkge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcHJvcGVydHkge0FycmF5fSBtZXNzYWdlIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5cbi8qKlxuICog0JfQsNC/0LjRgdCw0YLRjCDRgdC+0L7QsdGJ0LXQvdC40LUg0LvQvtCz0LAg0LIg0LrQvtC90YHQvtC70YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW8uTG9nZ2VyfkxvZ0VudHJ5fSBsb2dFbnRyeSAtINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsFxuICogQHByaXZhdGVcbiAqL1xuTG9nZ2VyLl9kdW1wRW50cnkgPSBmdW5jdGlvbihsb2dFbnRyeSkge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBsZXZlbCA9IGxvZ0VudHJ5LmxldmVsO1xuXG4gICAgICAgIHZhciBuYW1lID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC50YXNrTmFtZSB8fCBsb2dFbnRyeS5jb250ZXh0Lm5hbWUpO1xuICAgICAgICB2YXIgY29udGV4dCA9IGxvZ0VudHJ5LmNvbnRleHQgJiYgKGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlciA/IGxvZ0VudHJ5LmNvbnRleHQuX2xvZ2dlcigpIDogXCJcIik7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlW2xldmVsXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgbGV2ZWwudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlW2xldmVsXS5hcHBseShjb25zb2xlLCBbXG4gICAgICAgICAgICAgICAgTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAobG9nRW50cnkudGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgICBcIltcIiArIGxvZ0VudHJ5LmNoYW5uZWwgKyAobmFtZSA/IFwiOlwiICsgbmFtZSA6IFwiXCIpICsgXCJdXCIsXG4gICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgXS5jb25jYXQobG9nRW50cnkubWVzc2FnZSkpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0YTQvtGA0LzQsNGC0LjRgNC+0LLQsNC90LjRjyDQtNCw0YLRiyDQtNC70Y8g0LLRi9Cy0L7QtNCwINCyINC60L7QvdC+0YHQvtC70YxcbiAqIEBwYXJhbSB0aW1lc3RhbXBcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIHZhciBkYXRlID0gbmV3IERhdGUodGltZXN0YW1wKTtcbiAgICB2YXIgbXMgPSBkYXRlLmdldE1pbGxpc2Vjb25kcygpO1xuICAgIG1zID0gbXMgPiAxMDAgPyBtcyA6IG1zID4gMTAgPyBcIjBcIiArIG1zIDogXCIwMFwiICsgbXM7XG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKCkgKyBcIi5cIiArIG1zO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iXX0=
