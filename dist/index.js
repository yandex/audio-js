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
    DEV && logger.debug(this, "setVolume", volume);

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
 * Недоступный источник
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

AudioFlash.type = AudioFlash.prototype.type = "flash";

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
 * Событие изменения значения усиления
 * @event ya.music.Audio.fx.Equalizer~EqualizerBand#EVENT_CHANGE
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
 * @fires ya.music.Audio.fx.Equalizer~EqualizerBand#EVENT_CHANGE
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
 * Событие изменения полосы пропускания
 * @event ya.music.Audio.fx.Equalizer#EVENT_CHANGE
 *
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
    DEV && logger.debug(this, "play", position);

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
AudioHTML5.type = AudioHTML5.prototype.type = "html5";

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
 * @class AbortablePromise
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwic3JjL2F1ZGlvLXBsYXllci5qcyIsInNyYy9hdWRpby1zdGF0aWMuanMiLCJzcmMvY29uZmlnLmpzIiwic3JjL2Vycm9yL2F1ZGlvLWVycm9yLmpzIiwic3JjL2Vycm9yL2V4cG9ydC5qcyIsInNyYy9lcnJvci9wbGF5YmFjay1lcnJvci5qcyIsInNyYy9leHBvcnQuanMiLCJzcmMvZmxhc2gvYXVkaW8tZmxhc2guanMiLCJzcmMvZmxhc2gvZmxhc2gtaW50ZXJmYWNlLmpzIiwic3JjL2ZsYXNoL2ZsYXNoLW1hbmFnZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hibG9ja25vdGlmaWVyLmpzIiwic3JjL2ZsYXNoL2ZsYXNoZW1iZWRkZXIuanMiLCJzcmMvZmxhc2gvbG9hZGVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LmJhbmRzLmpzIiwic3JjL2Z4L2VxdWFsaXplci9kZWZhdWx0LnByZXNldHMuanMiLCJzcmMvZngvZXF1YWxpemVyL2VxdWFsaXplci1iYW5kLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXItc3RhdGljLmpzIiwic3JjL2Z4L2VxdWFsaXplci9lcXVhbGl6ZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2V4cG9ydC5qcyIsInNyYy9meC9leHBvcnQuanMiLCJzcmMvZngvdm9sdW1lL2V4cG9ydC5qcyIsInNyYy9meC92b2x1bWUvdm9sdW1lLWxpYi5qcyIsInNyYy9odG1sNS9hdWRpby1odG1sNS1sb2FkZXIuanMiLCJzcmMvaHRtbDUvYXVkaW8taHRtbDUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvbGliL2FzeW5jL2RlZmVycmVkLmpzIiwic3JjL2xpYi9hc3luYy9ldmVudHMuanMiLCJzcmMvbGliL2FzeW5jL3Byb21pc2UuanMiLCJzcmMvbGliL2FzeW5jL3JlamVjdC5qcyIsInNyYy9saWIvYnJvd3Nlci9kZXRlY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvc3dmb2JqZWN0LmpzIiwic3JjL2xpYi9jbGFzcy9jbGVhci1pbnN0YW5jZS5qcyIsInNyYy9saWIvY2xhc3MvZXJyb3ItY2xhc3MuanMiLCJzcmMvbGliL2NsYXNzL3Byb3h5LmpzIiwic3JjL2xpYi9kYXRhL21lcmdlLmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yLmpzIiwic3JjL2xpYi9ub29wLmpzIiwic3JjL2xvZ2dlci9leHBvcnQuanMiLCJzcmMvbG9nZ2VyL2xvZ2dlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzErQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2h1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQG1vZHVsZSB2b3dcbiAqIEBhdXRob3IgRmlsYXRvdiBEbWl0cnkgPGRmaWxhdG92QHlhbmRleC10ZWFtLnJ1PlxuICogQHZlcnNpb24gMC40LjEwXG4gKiBAbGljZW5zZVxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwgbGljZW5zZXM6XG4gKiAgICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqICAgKiBodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWxcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG5cbnZhciB1bmRlZixcbiAgICBuZXh0VGljayA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZucyA9IFtdLFxuICAgICAgICAgICAgZW5xdWV1ZUZuID0gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm5zLnB1c2goZm4pID09PSAxO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhbGxGbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm5zVG9DYWxsID0gZm5zLCBpID0gMCwgbGVuID0gZm5zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuc1RvQ2FsbFtpKytdKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICBpZih0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7IC8vIGllMTAsIG5vZGVqcyA+PSAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldEltbWVkaWF0ZShjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5uZXh0VGljaykgeyAvLyBub2RlanMgPCAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHByb2Nlc3MubmV4dFRpY2soY2FsbEZucyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIE11dGF0aW9uT2JzZXJ2ZXIgPSBnbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBnbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjsgLy8gbW9kZXJuIGJyb3dzZXJzXG4gICAgICAgIGlmKE11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIHZhciBudW0gPSAxLFxuICAgICAgICAgICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cbiAgICAgICAgICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKGNhbGxGbnMpLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhIDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiAobm9kZS5kYXRhID0gKG51bSAqPSAtMSkpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGdsb2JhbC5wb3N0TWVzc2FnZSkge1xuICAgICAgICAgICAgdmFyIGlzUG9zdE1lc3NhZ2VBc3luYyA9IHRydWU7XG4gICAgICAgICAgICBpZihnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hlY2tBc3luYyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNQb3N0TWVzc2FnZUFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwucG9zdE1lc3NhZ2UoJ19fY2hlY2tBc3luYycsICcqJyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmRldGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNQb3N0TWVzc2FnZUFzeW5jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1zZyA9ICdfX3Byb21pc2UnICsgK25ldyBEYXRlLFxuICAgICAgICAgICAgICAgICAgICBvbk1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlLmRhdGEgPT09IG1zZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uICYmIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXI/XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlLCB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgb25NZXNzYWdlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGdsb2JhbC5wb3N0TWVzc2FnZShtc2csICcqJyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG4gICAgICAgIGlmKCdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKSkgeyAvLyBpZTYtaWU4XG4gICAgICAgICAgICB2YXIgY3JlYXRlU2NyaXB0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQgPSBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIChkb2MuZG9jdW1lbnRFbGVtZW50IHx8IGRvYy5ib2R5KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBjcmVhdGVTY3JpcHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHsgLy8gb2xkIGJyb3dzZXJzXG4gICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldFRpbWVvdXQoY2FsbEZucywgMCk7XG4gICAgICAgIH07XG4gICAgfSkoKSxcbiAgICB0aHJvd0V4Y2VwdGlvbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfSxcbiAgICBpc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICE9PSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnO1xuICAgIH0sXG4gICAgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdG9TdHIuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH0sXG4gICAgZ2V0QXJyYXlLZXlzID0gZnVuY3Rpb24oYXJyKSB7XG4gICAgICAgIHZhciByZXMgPSBbXSxcbiAgICAgICAgICAgIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoO1xuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICByZXMucHVzaChpKyspO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBnZXRPYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpIGluIG9iaikge1xuICAgICAgICAgICAgb2JqLmhhc093blByb3BlcnR5KGkpICYmIHJlcy5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBkZWZpbmVDdXN0b21FcnJvclR5cGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHZhciByZXMgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXMucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIHdyYXBPbkZ1bGZpbGxlZCA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBpZHgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgb25GdWxmaWxsZWQuY2FsbCh0aGlzLCB2YWwsIGlkeCk7XG4gICAgICAgIH07XG4gICAgfTtcblxuLyoqXG4gKiBAY2xhc3MgRGVmZXJyZWRcbiAqIEBleHBvcnRzIHZvdzpEZWZlcnJlZFxuICogQGRlc2NyaXB0aW9uXG4gKiBUaGUgYERlZmVycmVkYCBjbGFzcyBpcyB1c2VkIHRvIGVuY2Fwc3VsYXRlIG5ld2x5LWNyZWF0ZWQgcHJvbWlzZSBvYmplY3QgYWxvbmcgd2l0aCBmdW5jdGlvbnMgdGhhdCByZXNvbHZlLCByZWplY3Qgb3Igbm90aWZ5IGl0LlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZGVzY3JpcHRpb25cbiAqIFlvdSBjYW4gdXNlIGB2b3cuZGVmZXIoKWAgaW5zdGVhZCBvZiB1c2luZyB0aGlzIGNvbnN0cnVjdG9yLlxuICpcbiAqIGBuZXcgdm93LkRlZmVycmVkKClgIGdpdmVzIHRoZSBzYW1lIHJlc3VsdCBhcyBgdm93LmRlZmVyKClgLlxuICovXG52YXIgRGVmZXJyZWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoKTtcbn07XG5cbkRlZmVycmVkLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgRGVmZXJyZWQucHJvdG90eXBlICove1xuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9taXNlIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInc3VjY2VzcydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5yZXNvbHZlKCdzdWNjZXNzJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX3Jlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWplY3RzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyByZWFzb24gaXMgXCInc29tZXRoaW5nIGlzIHdyb25nJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlamVjdCgnc29tZXRoaW5nIGlzIHdyb25nJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGlmKHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih2b3cuaXNQcm9taXNlKHJlYXNvbikpIHtcbiAgICAgICAgICAgIHJlYXNvbiA9IHJlYXNvbi50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdCh2YWwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3Jlc29sdmUocmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3JlamVjdChyZWFzb24pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vdGlmaWVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UucHJvZ3Jlc3MoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInMjAlJ1wiLCBcIic0MCUnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIubm90aWZ5KCcyMCUnKTtcbiAgICAgKiBkZWZlci5ub3RpZnkoJzQwJScpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIG5vdGlmeSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX25vdGlmeSh2YWx1ZSk7XG4gICAgfVxufTtcblxudmFyIFBST01JU0VfU1RBVFVTID0ge1xuICAgIFBFTkRJTkcgICA6IDAsXG4gICAgUkVTT0xWRUQgIDogMSxcbiAgICBGVUxGSUxMRUQgOiAyLFxuICAgIFJFSkVDVEVEICA6IDNcbn07XG5cbi8qKlxuICogQGNsYXNzIFByb21pc2VcbiAqIEBleHBvcnRzIHZvdzpQcm9taXNlXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgUHJvbWlzZWAgY2xhc3MgaXMgdXNlZCB3aGVuIHlvdSB3YW50IHRvIGdpdmUgdG8gdGhlIGNhbGxlciBzb21ldGhpbmcgdG8gc3Vic2NyaWJlIHRvLFxuICogYnV0IG5vdCB0aGUgYWJpbGl0eSB0byByZXNvbHZlIG9yIHJlamVjdCB0aGUgZGVmZXJyZWQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmVyIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZCN0aGUtcHJvbWlzZS1jb25zdHJ1Y3RvciBmb3IgZGV0YWlscy5cbiAqIEBkZXNjcmlwdGlvblxuICogWW91IHNob3VsZCB1c2UgdGhpcyBjb25zdHJ1Y3RvciBkaXJlY3RseSBvbmx5IGlmIHlvdSBhcmUgZ29pbmcgdG8gdXNlIGB2b3dgIGFzIERPTSBQcm9taXNlcyBpbXBsZW1lbnRhdGlvbi5cbiAqIEluIG90aGVyIGNhc2UgeW91IHNob3VsZCB1c2UgYHZvdy5kZWZlcigpYCBhbmQgYGRlZmVyLnByb21pc2UoKWAgbWV0aG9kcy5cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogZnVuY3Rpb24gZmV0Y2hKU09OKHVybCkge1xuICogICAgIHJldHVybiBuZXcgdm93LlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0LCBub3RpZnkpIHtcbiAqICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICogICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAqICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAqICAgICAgICAgeGhyLnNlbmQoKTtcbiAqICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICAgaWYoeGhyLnJlc3BvbnNlKSB7XG4gKiAgICAgICAgICAgICAgICAgcmVzb2x2ZSh4aHIucmVzcG9uc2UpO1xuICogICAgICAgICAgICAgfVxuICogICAgICAgICAgICAgZWxzZSB7XG4gKiAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoKSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgIH07XG4gKiAgICAgfSk7XG4gKiB9XG4gKiBgYGBcbiAqL1xudmFyIFByb21pc2UgPSBmdW5jdGlvbihyZXNvbHZlcikge1xuICAgIHRoaXMuX3ZhbHVlID0gdW5kZWY7XG4gICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcblxuICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSBbXTtcblxuICAgIGlmKHJlc29sdmVyKSB7IC8vIE5PVEU6IHNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZFxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA9IHJlc29sdmVyLmxlbmd0aDtcblxuICAgICAgICByZXNvbHZlcihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPiAxP1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX3JlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgICAgIH0gOlxuICAgICAgICAgICAgICAgIHVuZGVmLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDI/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlID0gLyoqIEBsZW5kcyBQcm9taXNlLnByb3RvdHlwZSAqLyB7XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIGZ1bGZpbGxlZCBwcm9taXNlIG9yIHRoZSByZWFzb24gaW4gY2FzZSBvZiByZWplY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICB2YWx1ZU9mIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1Jlc29sdmVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgIT09IFBST01JU0VfU1RBVFVTLlBFTkRJTkc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzRnVsZmlsbGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHJlYWN0aW9ucyB0byB0aGUgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfSBBIG5ldyBwcm9taXNlLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3Byb21pc2VzLWFwbHVzL3Byb21pc2VzLXNwZWMgZm9yIGRldGFpbHNcbiAgICAgKi9cbiAgICB0aGVuIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5fYWRkQ2FsbGJhY2tzKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbih1bmRlZmluZWQsIG9uUmVqZWN0ZWQpYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGEgcHJvdmlkZWQgJ3JlYXNvbicgYXMgYXJndW1lbnQgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgICdjYXRjaCcgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbihudWxsLCBvblJlamVjdGVkKWAuIEl0J3MgYWxzbyBhbiBhbGlhcyBmb3IgYGNhdGNoYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdpdGggdGhlIHZhbHVlIGFmdGVyIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlc29sdmluZyByZWFjdGlvbiAoZm9yIGJvdGggZnVsZmlsbG1lbnQgYW5kIHJlamVjdGlvbikuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24ob25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICBjYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvblJlc29sdmVkLmNhbGwodGhpcywgX3RoaXMpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcy50aGVuKGNiLCBjYiwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHByb2dyZXNzIHJlYWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSB3aGVuIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCB1bmRlZiwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgcHJvbWlzZS50aGVuYCwgYnV0IFwic3ByZWFkc1wiIHRoZSBhcnJheSBpbnRvIGEgdmFyaWFkaWMgdmFsdWUgaGFuZGxlci5cbiAgICAgKiBJdCBpcyB1c2VmdWwgd2l0aCB0aGUgYHZvdy5hbGxgIGFuZCB0aGUgYHZvdy5hbGxSZXNvbHZlZGAgbWV0aG9kcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24oYXJnMSwgYXJnMikge1xuICAgICAqICAgICAvLyBhcmcxIGlzIFwiMVwiLCBhcmcyIGlzIFwiJ3R3bydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgndHdvJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uRnVsZmlsbGVkLmFwcGx5KHRoaXMsIHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25SZWplY3RlZCxcbiAgICAgICAgICAgIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExpa2UgYHRoZW5gLCBidXQgdGVybWluYXRlcyBhIGNoYWluIG9mIHByb21pc2VzLlxuICAgICAqIElmIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkLCB0aGlzIG1ldGhvZCB0aHJvd3MgaXQncyBcInJlYXNvblwiIGFzIGFuIGV4Y2VwdGlvbiBpbiBhIGZ1dHVyZSB0dXJuIG9mIHRoZSBldmVudCBsb29wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKiBkZWZlci5yZWplY3QoRXJyb3IoJ0ludGVybmFsIGVycm9yJykpO1xuICAgICAqIGRlZmVyLnByb21pc2UoKS5kb25lKCk7IC8vIGV4Y2VwdGlvbiB0byBiZSB0aHJvd25cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB0aGlzXG4gICAgICAgICAgICAudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KVxuICAgICAgICAgICAgLmZhaWwodGhyb3dFeGNlcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpbiBgZGVsYXlgIG1pbGxpc2Vjb25kcyBpZiB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQsXG4gICAgICogb3IgaW1tZWRpYXRlbHkgcmVqZWN0ZWQgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB2YXIgdGltZXIsXG4gICAgICAgICAgICBwcm9taXNlID0gdGhpcy50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlbGF5KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIHJlamVjdGVkIGluIGB0aW1lb3V0YCBtaWxsaXNlY29uZHNcbiAgICAgKiBpZiB0aGUgcHJvbWlzZSBpcyBub3QgcmVzb2x2ZWQgYmVmb3JlaGFuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQxID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoNTApLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQyID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoMjAwKTtcbiAgICAgKlxuICAgICAqIHNldFRpbWVvdXQoXG4gICAgICogICAgIGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgZGVmZXIucmVzb2x2ZSgnb2snKTtcbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgMTAwKTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDEuZmFpbChmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgKiAgICAgLy8gcHJvbWlzZVdpdGhUaW1lb3V0IHRvIGJlIHJlamVjdGVkIGluIDUwbXNcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDIudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgZnVsZmlsbGVkIHdpdGggXCInb2snXCIgdmFsdWVcbiAgICAgKiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odGltZW91dCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KG5ldyB2b3cuVGltZWRPdXRFcnJvcigndGltZWQgb3V0JykpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGltZW91dCk7XG5cbiAgICAgICAgdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmZXIucHJvbWlzZSgpLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIF92b3cgOiB0cnVlLFxuXG4gICAgX3Jlc29sdmUgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZhbCA9PT0gdGhpcykge1xuICAgICAgICAgICAgdGhpcy5fcmVqZWN0KFR5cGVFcnJvcignQ2FuXFwndCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRDtcblxuICAgICAgICBpZih2YWwgJiYgISF2YWwuX3ZvdykgeyAvLyBzaG9ydHBhdGggZm9yIHZvdy5Qcm9taXNlXG4gICAgICAgICAgICB2YWwuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbC52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICB2YWwuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICB2YWwudGhlbihcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzT2JqZWN0KHZhbCkgfHwgaXNGdW5jdGlvbih2YWwpKSB7XG4gICAgICAgICAgICB2YXIgdGhlbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGhlbiA9IHZhbC50aGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGVuLmNhbGwoXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Jlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkIHx8IHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbCk7XG4gICAgfSxcblxuICAgIF9mdWxmaWxsIDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5GVUxGSUxMRUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gdmFsO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzLCB2YWwpO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9yZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHJlYXNvbjtcblxuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLCByZWFzb24pO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9ub3RpZnkgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcywgdmFsKTtcbiAgICB9LFxuXG4gICAgX2FkZENhbGxiYWNrcyA6IGZ1bmN0aW9uKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIGlmKG9uUmVqZWN0ZWQgJiYgIWlzRnVuY3Rpb24ob25SZWplY3RlZCkpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUmVqZWN0ZWQ7XG4gICAgICAgICAgICBvblJlamVjdGVkID0gdW5kZWY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvblByb2dyZXNzICYmICFpc0Z1bmN0aW9uKG9uUHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICBjdHggPSBvblByb2dyZXNzO1xuICAgICAgICAgICAgb25Qcm9ncmVzcyA9IHVuZGVmO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNiO1xuXG4gICAgICAgIGlmKCF0aGlzLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgY2IgPSB7IGRlZmVyIDogZGVmZXIsIGZuIDogaXNGdW5jdGlvbihvbkZ1bGZpbGxlZCk/IG9uRnVsZmlsbGVkIDogdW5kZWYsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdGhpcy5pc0Z1bGZpbGxlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblJlamVjdGVkLCBjdHggOiBjdHggfTtcbiAgICAgICAgICAgIHRoaXMuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3RlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA8PSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MucHVzaCh7IGRlZmVyIDogZGVmZXIsIGZuIDogb25Qcm9ncmVzcywgY3R4IDogY3R4IH0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9jYWxsQ2FsbGJhY2tzIDogZnVuY3Rpb24oY2FsbGJhY2tzLCBhcmcpIHtcbiAgICAgICAgdmFyIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc1Jlc29sdmVkID0gdGhpcy5pc1Jlc29sdmVkKCksXG4gICAgICAgICAgICBpc0Z1bGZpbGxlZCA9IHRoaXMuaXNGdWxmaWxsZWQoKTtcblxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpID0gMCwgY2IsIGRlZmVyLCBmbjtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYiA9IGNhbGxiYWNrc1tpKytdO1xuICAgICAgICAgICAgICAgIGRlZmVyID0gY2IuZGVmZXI7XG4gICAgICAgICAgICAgICAgZm4gPSBjYi5mbjtcblxuICAgICAgICAgICAgICAgIGlmKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjdHggPSBjYi5jdHgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXM7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgPSBjdHg/IGZuLmNhbGwoY3R4LCBhcmcpIDogZm4oYXJnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIubm90aWZ5KHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNGdWxmaWxsZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoYXJnKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkoYXJnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8qKiBAbGVuZHMgUHJvbWlzZSAqL1xudmFyIHN0YXRpY01ldGhvZHMgPSB7XG4gICAgLyoqXG4gICAgICogQ29lcmNlcyB0aGUgZ2l2ZW4gYHZhbHVlYCB0byBhIHByb21pc2UsIG9yIHJldHVybnMgdGhlIGB2YWx1ZWAgaWYgaXQncyBhbHJlYWR5IGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgY2FzdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cuY2FzdCh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZW4gdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmFjZSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYW55UmVzb2x2ZWQoaXRlcmFibGUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gdm93LnJlamVjdChyZWFzb24pO1xuICAgIH1cbn07XG5cbmZvcih2YXIgcHJvcCBpbiBzdGF0aWNNZXRob2RzKSB7XG4gICAgc3RhdGljTWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSAmJlxuICAgICAgICAoUHJvbWlzZVtwcm9wXSA9IHN0YXRpY01ldGhvZHNbcHJvcF0pO1xufVxuXG52YXIgdm93ID0gLyoqIEBleHBvcnRzIHZvdyAqLyB7XG4gICAgRGVmZXJyZWQgOiBEZWZlcnJlZCxcblxuICAgIFByb21pc2UgOiBQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBkZWZlcnJlZC4gVGhpcyBtZXRob2QgaXMgYSBmYWN0b3J5IG1ldGhvZCBmb3IgYHZvdzpEZWZlcnJlZGAgY2xhc3MuXG4gICAgICogSXQncyBlcXVpdmFsZW50IHRvIGBuZXcgdm93LkRlZmVycmVkKClgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpEZWZlcnJlZH1cbiAgICAgKi9cbiAgICBkZWZlciA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IERlZmVycmVkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRoZW5gLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB3aGVuIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5mYWlsYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmYWlsIDogZnVuY3Rpb24odmFsdWUsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUsIHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5hbHdheXNgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24odmFsdWUsIG9uUmVzb2x2ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLmFsd2F5cyhvblJlc29sdmVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5wcm9ncmVzc2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUHJvZ3Jlc3MgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKHZhbHVlLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5wcm9ncmVzcyhvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5zcHJlYWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHNwcmVhZCA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuc3ByZWFkKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5kb25lYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdm93LndoZW4odmFsdWUpLmRvbmUob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBgdmFsdWVgIGlzIGEgcHJvbWlzZS1saWtlIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZvdy5pc1Byb21pc2UoJ3NvbWV0aGluZycpOyAvLyByZXR1cm5zIGZhbHNlXG4gICAgICogdm93LmlzUHJvbWlzZSh2b3cuZGVmZXIoKS5wcm9taXNlKCkpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiB2b3cuaXNQcm9taXNlKHsgdGhlbiA6IGZ1bmN0aW9uKCkgeyB9KTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaXNQcm9taXNlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnRoZW4pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmICEhdmFsdWUuX3Zvdz9cbiAgICAgICAgICAgIHZhbHVlIDpcbiAgICAgICAgICAgIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudmFsdWVPZmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS52YWx1ZU9mKT8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzRnVsZmlsbGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc0Z1bGZpbGxlZCk/IHZhbHVlLmlzRnVsZmlsbGVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1JlamVjdGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZWplY3RlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVqZWN0ZWQpPyB2YWx1ZS5pc1JlamVjdGVkKCkgOiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNSZXNvbHZlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc1Jlc29sdmVkKT8gdmFsdWUuaXNSZXNvbHZlZCgpIDogdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgaGF2ZSBgdmFsdWVgJ3Mgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgcmVzID0gdm93LmRlZmVyKCk7XG4gICAgICAgIHJlcy5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHJlcy5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSBmdWxmaWxsZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZnVsZmlsbCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAgICAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcblxuICAgICAgICBkZWZlci5yZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZS5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgcHJvbWlzZSA6XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4obnVsbCwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYXNvbjtcbiAgICAgICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICogSWYgYHJlYXNvbmAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGggdGhlIGZ1bGZpbGwvcmVqZWN0aW9uIHZhbHVlIG9mIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyB0aGUgZ2l2ZW4gZnVuY3Rpb24gYGZuYCB3aXRoIGFyZ3VtZW50cyBgYXJnc2BcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnc11cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIHByb21pc2UxID0gdm93Lmludm9rZShmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAqICAgICB9LCAnb2snKSxcbiAgICAgKiAgICAgcHJvbWlzZTIgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgdGhyb3cgRXJyb3IoKTtcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlMS5pc0Z1bGZpbGxlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTEudmFsdWVPZigpOyAvLyAnb2snXG4gICAgICogcHJvbWlzZTIuaXNSZWplY3RlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTIudmFsdWVPZigpOyAvLyBpbnN0YW5jZSBvZiBFcnJvclxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGludm9rZSA6IGZ1bmN0aW9uKGZuLCBhcmdzKSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1heChhcmd1bWVudHMubGVuZ3RoIC0gMSwgMCksXG4gICAgICAgICAgICBjYWxsQXJncztcbiAgICAgICAgaWYobGVuKSB7IC8vIG9wdGltaXphdGlvbiBmb3IgVjhcbiAgICAgICAgICAgIGNhbGxBcmdzID0gQXJyYXkobGVuKTtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYWxsQXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVzb2x2ZShjYWxsQXJncz9cbiAgICAgICAgICAgICAgICBmbi5hcHBseShnbG9iYWwsIGNhbGxBcmdzKSA6XG4gICAgICAgICAgICAgICAgZm4uY2FsbChnbG9iYWwpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICByZXR1cm4gdm93LnJlamVjdChlKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIGFycmF5OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCksIDNdKVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwiWzEsIDIsIDNdXCIgaGVyZVxuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKDIpO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIG9iamVjdDpcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKHsgcDEgOiBkZWZlcjEucHJvbWlzZSgpLCBwMiA6IGRlZmVyMi5wcm9taXNlKCksIHAzIDogMyB9KVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwieyBwMSA6IDEsIHAyIDogMiwgcDMgOiAzIH1cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSBsZW47XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsdWUsIGlkeCkge1xuICAgICAgICAgICAgICAgIHJlc1trZXlzW2lkeF1dID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgaWYoIS0taSkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsUmVzb2x2ZWQoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24ocHJvbWlzZTEsIHByb21pc2UyKSB7XG4gICAgICogICAgIHByb21pc2UxLmlzUmVqZWN0ZWQoKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogICAgIHByb21pc2UxLnZhbHVlT2YoKTsgLy8gcmV0dXJucyBcIidlcnJvcidcIlxuICAgICAqICAgICBwcm9taXNlMi5pc0Z1bGZpbGxlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTIudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ29rJ1wiXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVqZWN0KCdlcnJvcicpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCdvaycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbFJlc29sdmVkIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBpID0ga2V5cy5sZW5ndGgsXG4gICAgICAgICAgICByZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG5cbiAgICAgICAgaWYoIWkpIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb25SZXNvbHZlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC0taSB8fCBkZWZlci5yZXNvbHZlKGl0ZXJhYmxlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgb25SZXNvbHZlZCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgYWxsUGF0aWVudGx5IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbGxSZXNvbHZlZChpdGVyYWJsZSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcywgZnVsZmlsbGVkUHJvbWlzZXMsXG4gICAgICAgICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGgsIGkgPSAwLCBrZXksIHByb21pc2U7XG5cbiAgICAgICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xuICAgICAgICAgICAgICAgIHByb21pc2UgPSBpdGVyYWJsZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmKHZvdy5pc1JlamVjdGVkKHByb21pc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMgfHwgKHJlamVjdGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pO1xuICAgICAgICAgICAgICAgICAgICBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLnB1c2gocHJvbWlzZS52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXNba2V5XSA9IHByb21pc2UudmFsdWVPZigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKCFyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIChmdWxmaWxsZWRQcm9taXNlcyB8fCAoZnVsZmlsbGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pKVtrZXldID0gdm93LnZhbHVlT2YocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgcmVqZWN0ZWRQcm9taXNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZ1bGZpbGxlZFByb21pc2VzO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgaWYgYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGlzIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbGwgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0IHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkICh3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHJlamVjdGVkIGl0ZW0pLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KEVycm9yKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gMCwgcmVhc29uO1xuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaSB8fCAocmVhc29uID0gZSk7XG4gICAgICAgICAgICAgICAgKytpID09PSBsZW4gJiYgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55UmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlLFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRlbGF5YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGRlbGF5IDogZnVuY3Rpb24odmFsdWUsIGRlbGF5KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkuZGVsYXkoZGVsYXkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS50aW1lb3V0YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgdGltZW91dCA6IGZ1bmN0aW9uKHZhbHVlLCB0aW1lb3V0KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkudGltZW91dCh0aW1lb3V0KTtcbiAgICB9LFxuXG4gICAgX2ZvckVhY2ggOiBmdW5jdGlvbihwcm9taXNlcywgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCwga2V5cykge1xuICAgICAgICB2YXIgbGVuID0ga2V5cz8ga2V5cy5sZW5ndGggOiBwcm9taXNlcy5sZW5ndGgsXG4gICAgICAgICAgICBpID0gMDtcblxuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICB2b3cud2hlbihcbiAgICAgICAgICAgICAgICBwcm9taXNlc1trZXlzPyBrZXlzW2ldIDogaV0sXG4gICAgICAgICAgICAgICAgd3JhcE9uRnVsZmlsbGVkKG9uRnVsZmlsbGVkLCBpKSxcbiAgICAgICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgICAgIG9uUHJvZ3Jlc3MsXG4gICAgICAgICAgICAgICAgY3R4KTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBUaW1lZE91dEVycm9yIDogZGVmaW5lQ3VzdG9tRXJyb3JUeXBlKCdUaW1lZE91dCcpXG59O1xuXG52YXIgZGVmaW5lQXNHbG9iYWwgPSB0cnVlO1xuaWYodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBtb2R1bGVzID09PSAnb2JqZWN0JyAmJiBpc0Z1bmN0aW9uKG1vZHVsZXMuZGVmaW5lKSkge1xuICAgIG1vZHVsZXMuZGVmaW5lKCd2b3cnLCBmdW5jdGlvbihwcm92aWRlKSB7XG4gICAgICAgIHByb3ZpZGUodm93KTtcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5pZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHZvdztcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5kZWZpbmVBc0dsb2JhbCAmJiAoZ2xvYmFsLnZvdyA9IHZvdyk7XG5cbn0pKHRoaXMpO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvUGxheWVyJyk7XG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvcHJvbWlzZScpO1xudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgbWVyZ2UgPSByZXF1aXJlKCcuL2xpYi9kYXRhL21lcmdlJyk7XG52YXIgcmVqZWN0ID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvcmVqZWN0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIHBsYXllcklkID0gMTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCd0LDRgdGC0YDQvtC50LrQsCDQtNC+0YHRgtGD0L/QvdGL0YUg0YLQuNC/0L7QsiDRgNC10LDQu9C40LfQsNGG0LjQuSDQuCDQuNGFINC/0YDQuNC+0YDQuNGC0LXRgtCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vVE9ETzog0YHQtNC10LvQsNGC0Ywg0LjQvdGC0LXRgNGE0LXQudGBINC00LvRjyDQstC+0LfQvNC+0LbQvdC+0YHRgtC4INC/0L7QtNC60LvRjtGH0LXQvdC40Y8g0L3QvtCy0YvRhSDRgtC40L/QvtCyXG52YXIgYXVkaW9UeXBlcyA9IHtcbiAgICBodG1sNTogcmVxdWlyZSgnLi9odG1sNS9hdWRpby1odG1sNScpLFxuICAgIGZsYXNoOiByZXF1aXJlKCcuL2ZsYXNoL2F1ZGlvLWZsYXNoJylcbn07XG5cbnZhciBkZXRlY3RTdHJpbmcgPSBcIkBcIiArIGRldGVjdC5wbGF0Zm9ybS52ZXJzaW9uICtcbiAgICBcIiBcIiArIGRldGVjdC5wbGF0Zm9ybS5vcyArXG4gICAgXCI6XCIgKyBkZXRlY3QuYnJvd3Nlci5uYW1lICtcbiAgICBcIi9cIiArIGRldGVjdC5icm93c2VyLnZlcnNpb247XG5cbmF1ZGlvVHlwZXMuZmxhc2gucHJpb3JpdHkgPSAwO1xuYXVkaW9UeXBlcy5odG1sNS5wcmlvcml0eSA9IGNvbmZpZy5odG1sNS5ibGFja2xpc3Quc29tZShmdW5jdGlvbihpdGVtKSB7IHJldHVybiBkZXRlY3RTdHJpbmcubWF0Y2goaXRlbSk7IH0pID8gLTEgOiAxO1xuXG4vL0lORk86INC/0YDRj9C8INCyINC80L7QvNC10L3RgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQstGB0LXQs9C+INC80L7QtNGD0LvRjyDQvdC10LvRjNC30Y8g0L/QuNGB0LDRgtGMINCyINC70L7QsyAtINC+0L0g0L/RgNC+0LPQu9Cw0YLRi9Cy0LDQtdGCINGB0L7QvtCx0YnQtdC90LjRjywg0YIu0LouINC10YnRkSDQvdC10YIg0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvdCw0YHRgtGA0L7QuNGC0Ywg0LvQvtCz0LPQtdGALlxuc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh7XG4gICAgICAgIGZsYXNoOiB7XG4gICAgICAgICAgICBhdmFpbGFibGU6IGF1ZGlvVHlwZXMuZmxhc2guYXZhaWxhYmxlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IGF1ZGlvVHlwZXMuZmxhc2gucHJpb3JpdHlcbiAgICAgICAgfSxcbiAgICAgICAgaHRtbDU6IHtcbiAgICAgICAgICAgIGF2YWlsYWJsZTogYXVkaW9UeXBlcy5odG1sNS5hdmFpbGFibGUsXG4gICAgICAgICAgICBwcmlvcml0eTogYXVkaW9UeXBlcy5odG1sNS5wcmlvcml0eSxcbiAgICAgICAgICAgIGF1ZGlvQ29udGV4dDogISFhdWRpb1R5cGVzLmh0bWw1LmF1ZGlvQ29udGV4dFxuICAgICAgICB9XG4gICAgfSwgXCJhdWRpb1R5cGVzXCIpO1xufSwgMCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQzog0LLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3Ri9C1INC60LvQsNGB0YHRi1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKiog0J7Qv9C40YHQsNC90LjQtSDQstGA0LXQvNC10L3QvdGL0YUg0LTQsNC90L3Ri9GFINC/0LvQtdC10YDQsFxuICogQHR5cGVkZWYge09iamVjdH0geWEubXVzaWMuQXVkaW9+QXVkaW9QbGF5ZXJUaW1lc1xuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcHJvcGVydHkge051bWJlcn0gbG9hZGVkIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHBvc2l0aW9uIC0g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcHJvcGVydHkge051bWJlcn0gcGxheWVkIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQzog0J7QsdGJ0LjQtSDRgdC+0LHRi9GC0LjRjyDQv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QTEFZXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9FTkRFRFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINCz0YDQvtC80LrQvtGB0YLQuFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX1ZPTFVNRVxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINCz0YDQvtC80LrQvtGB0YLRjFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LrRgNCw0YXQsCDQv9C70LXQtdGA0LBcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9DUkFTSEVEXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDRgdC80LXQvdGLINGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX1NUQVRFXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RhdGUgLSDQvdC+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC/0LXRgNC10LrQu9GO0YfQtdC90LjRjyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwINC4INC/0YDQtdC70L7QsNC00LXRgNCwXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1dBUFxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICBKU0RPQzog0YHQvtCx0YvRgtC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKiog0KHQvtCx0YvRgtC40LUg0L7RgdGC0LDQvdC+0LLQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX1NUT1BcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC/0LDRg9C30Ysg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jRVZFTlRfUEFVU0VcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy/Qt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QUk9HUkVTU1xuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX0xPQURJTkdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX0xPQURFRFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI0VWRU5UX0VSUk9SXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DOiDRgdC+0LHRi9GC0LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQutCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX1NUT1BcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7Qt9C40YbQuNC4INC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9QUk9HUkVTU1xuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsFxuICogQGV2ZW50IHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9MT0FESU5HXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LBcbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfTE9BREVEXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAZXZlbnQgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0VSUk9SXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCQ0YPQtNC40L4t0L/Qu9C10LXRgCDQtNC70Y8g0LHRgNCw0YPQt9C10YDQsC5cbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpb1xuICogQHBhcmFtIHtTdHJpbmd9IFtwcmVmZXJyZWRUeXBlXSAtIHByZWZlcnJlZCBwbGF5ZXIgdHlwZSAoaHRtbDUvZmxhc2gpXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBbb3ZlcmxheV0gLSBkb20gZWxlbWVudCB0byBzaG93IGZsYXNoXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKiBAbWl4ZXMgQXVkaW9TdGF0aWNcbiAqXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfUExBWVxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0VOREVEXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfVk9MVU1FXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfQ1JBU0hFRFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX1NUQVRFXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfU1dBUFxuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNFVkVOVF9FUlJPUlxuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpbyNQUkVMT0FERVJfRVZFTlQrRVZFTlRfU1RPUFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9MT0FESU5HXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8jUFJFTE9BREVSX0VWRU5UK0VWRU5UX0xPQURFRFxuICogQGZpcmVzIHlhLm11c2ljLkF1ZGlvI1BSRUxPQURFUl9FVkVOVCtFVkVOVF9FUlJPUlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQXVkaW9QbGF5ZXIgPSBmdW5jdGlvbihwcmVmZXJyZWRUeXBlLCBvdmVybGF5KSB7XG4gICAgdGhpcy5uYW1lID0gcGxheWVySWQrKztcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlZmVycmVkVHlwZSA9IHByZWZlcnJlZFR5cGU7XG4gICAgdGhpcy5vdmVybGF5ID0gb3ZlcmxheTtcbiAgICB0aGlzLnN0YXRlID0gQXVkaW9QbGF5ZXIuU1RBVEVfSU5JVDtcbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9wbGF5SWQgPSBudWxsO1xuXG4gICAgdGhpcy5fd2hlblJlYWR5ID0gbmV3IERlZmVycmVkKCk7XG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLl93aGVuUmVhZHkucHJvbWlzZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiaW1wbGVtZW50YXRpb24gZm91bmRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3B1bGF0ZUV2ZW50cyhldmVudCwgb2Zmc2V0LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKCFvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWTpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9FTkRFRDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1A6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1I6XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIm9uRW5kZWRcIiwgZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BBVVNFOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0NSQVNIRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0lETEUpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTiwgZSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgIHRocm93IGU7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuX2luaXQoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvUGxheWVyKTtcbm1lcmdlKEF1ZGlvUGxheWVyLCBBdWRpb1N0YXRpYywgdHJ1ZSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQodGC0LDRgtC40LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQtNC+0YHRgtGD0L/QvdGL0YUg0L/Qu9C10LXRgNC+0LJcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAc3RhdGljXG4gKi9cbkF1ZGlvUGxheWVyLmluZm8gPSB7XG4gICAgaHRtbDU6IGF1ZGlvVHlwZXMuaHRtbDUuYXZhaWxhYmxlLFxuICAgIGZsYXNoOiBhdWRpb1R5cGVzLmZsYXNoLmF2YWlsYWJsZVxufTtcblxuLyoqXG4gKiDQmtC+0L3RgtC10LrRgdGCINC00LvRjyBXZWIgQXVkaW8gQVBJXG4gKiBAdHlwZSB7QXVkaW9Db250ZXh0fVxuICogQHN0YXRpY1xuICovXG5BdWRpb1BsYXllci5hdWRpb0NvbnRleHQgPSBhdWRpb1R5cGVzLmh0bWw1LmF1ZGlvQ29udGV4dDtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0g0L3QvtCy0YvQuSDRgdGC0LDRgtGD0YFcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fc2V0U3RhdGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0U3RhdGVcIiwgc3RhdGUpO1xuXG4gICAgaWYgKHN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QQVVTRUQgJiYgdGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGNoYW5nZWQgPSB0aGlzLnN0YXRlICE9PSBzdGF0ZTtcbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG5cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIm5ld1N0YXRlXCIsIHN0YXRlKTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvUGxheWVyLkVWRU5UX1NUQVRFLCBzdGF0ZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbcmV0cnk9MF0gLSDQutC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QulxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24ocmV0cnkpIHtcbiAgICByZXRyeSA9IHJldHJ5IHx8IDA7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfaW5pdFwiLCByZXRyeSk7XG5cbiAgICBpZiAoIXRoaXMuX3doZW5SZWFkeS5wZW5kaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocmV0cnkgPiBjb25maWcuYXVkaW8ucmV0cnkpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pO1xuICAgICAgICB0aGlzLl93aGVuUmVhZHkucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pKTtcbiAgICB9XG5cbiAgICB2YXIgaW5pdFNlcSA9IFtcbiAgICAgICAgYXVkaW9UeXBlcy5odG1sNSxcbiAgICAgICAgYXVkaW9UeXBlcy5mbGFzaFxuICAgIF0uc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIGlmIChhLmF2YWlsYWJsZSAhPT0gYi5hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmF2YWlsYWJsZSA/IC0xIDogMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYi5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgICAgIHZhciB0eXBlID0gaW5pdFNlcS5zaGlmdCgpO1xuXG4gICAgICAgIGlmICghdHlwZSkge1xuICAgICAgICAgICAgc2VsZi5faW5pdChyZXRyeSArIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5faW5pdFR5cGUodHlwZSkudGhlbihzZWxmLl93aGVuUmVhZHkucmVzb2x2ZSwgaW5pdCk7XG4gICAgfVxuXG4gICAgaW5pdCgpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwINGBINGD0LrQsNC30LDQvdC90YvQvCDRgtC40L/QvtC8XG4gKiBAcGFyYW0ge3t0eXBlOiBzdHJpbmcsIEF1ZGlvSW1wbGVtZW50YXRpb246IGZ1bmN0aW9ufX0gdHlwZSAtINC+0LHRitC10LrRgiDQvtC/0LjRgdCw0L3QuNGPINGC0LjQv9CwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXRUeXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiX2luaXRUeXBlXCIsIHR5cGUpO1xuXG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdHJ5IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LXQutGD0YnQsNGPINGA0LXQsNC70LjQt9Cw0YbQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtJQXVkaW9JbXBsZW1lbnRhdGlvbnxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbiA9IG5ldyB0eXBlLkF1ZGlvSW1wbGVtZW50YXRpb24odGhpcy5vdmVybGF5KTtcbiAgICAgICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24ud2hlblJlYWR5KSB7XG4gICAgICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeS50aGVuKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGUpO1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIl9pbml0VHlwZUVycm9yXCIsIHR5cGUsIGUpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQvtC00L3QvtC8INC40Lcg0YHQv9C40YHQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uIC0g0L3QsNC30LLQsNC90LjQtSDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZXNvbHZlIC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0YDQsNC30YDQtdGI0LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gcmVqZWN0IC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvQuSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9IC0tINGC0LDQutC20LUg0YHQvtC30LTQsNGR0YIgRGVmZXJyZWQg0YHQstC+0LnRgdGC0LLQviDRgSDQvdCw0LfQstCw0L3QuNC10LwgX3doZW48QWN0aW9uPiwg0LrQvtGC0L7RgNC+0LUg0LbQuNCy0ZHRgiDQtNC+INC80L7QvNC10L3RgtCwINGA0LDQt9GA0LXRiNC10L3QuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3dhaXRFdmVudHMgPSBmdW5jdGlvbihhY3Rpb24sIHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXNbYWN0aW9uXSA9IGRlZmVycmVkO1xuXG4gICAgdmFyIGNsZWFudXBFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgc2VsZlthY3Rpb25dO1xuICAgIH07XG5cbiAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi5vbihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgfSk7XG5cbiAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBkYXRhIGluc3RhbmNlb2YgRXJyb3IgPyBkYXRhIDogbmV3IEF1ZGlvRXJyb3IoZGF0YSB8fCBldmVudCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFudXBFdmVudHMsIGNsZWFudXBFdmVudHMpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0KDQsNGB0YjQuNGA0LXQvdC40LUg0YHQvtCx0YvRgtC40Lkg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LAg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQvNC4INGB0LLQvtC50YHRgtCy0LDQvNC4LiDQn9C+0LTQv9C40YHRi9Cy0LDQtdGC0YHRjyDQvdCwINCy0YHQtSDRgdC+0LHRi9GC0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCxcbiAqINGC0YDQuNCz0LPQtdGA0LjRgiDQuNGC0L7Qs9C+0LLRi9C1INGB0L7QsdGL0YLQuNGPLCDRgNCw0LfQtNC10LvRj9GPINC40YUg0L/QviDRgtC40L/RgyDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgCwg0LTQvtC/0L7Qu9C90Y/QtdGCINGB0L7QsdGL0YLQuNGPINC00LDQvdC90YvQvNC4LlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSDQuNGB0YLQvtGH0L3QuNC6INGB0L7QsdGL0YLQuNGPLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y8uXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3BvcHVsYXRlRXZlbnRzID0gZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmIChldmVudCAhPT0gQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9wb3B1bGF0ZUV2ZW50c1wiLCBldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9XG5cbiAgICB2YXIgb3V0ZXJFdmVudCA9IChvZmZzZXQgPyBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgOiBcIlwiKSArIGV2ZW50O1xuXG4gICAgc3dpdGNoIChldmVudCkge1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQ6XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfU1dBUDpcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihldmVudCwgZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9FUlJPUjpcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImVycm9yXCIsIG91dGVyRXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfVk9MVU1FOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCB0aGlzLmdldFZvbHVtZSgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BST0dSRVNTOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbjogdGhpcy5nZXREdXJhdGlvbihvZmZzZXQpLFxuICAgICAgICAgICAgICAgIGxvYWRlZDogdGhpcy5nZXRMb2FkZWQob2Zmc2V0KSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICBwbGF5ZWQ6IG9mZnNldCA/IDAgOiB0aGlzLmdldFBsYXllZCgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRidC40LUg0YTRg9C90LrRhtC40Lgg0YPQv9GA0LDQstC70LXQvdC40Y8g0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLypcbiBJTkZPOiDQtNCw0L3QvdGL0Lkg0LzQtdGC0L7QtCDQsdGL0LvQviDRgNC10YjQtdC90L4g0L7RgdGC0LDQstC40YLRjCwg0YIu0LouINGN0YLQviDRg9C00L7QsdC90LXQtSDRh9C10Lwg0LjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMINC+0LHQtdGJ0LDQvdC40LUgLSDQtdGB0YLRjCDQstC+0LfQvNC+0LbQvdC+0YHRgtGMINCyINC90LDRh9Cw0LvQtVxuINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L7Qu9GD0YfQuNGC0Ywg0YHRgNCw0LfRgyDRgdGB0YvQu9C60YMg0L3QsCDRjdC60LfQtdC80L/Qu9GP0YAg0L/Qu9C10LXRgNCwINC4INC+0LHQstC10YjQsNGC0Ywg0LXQs9C+INC+0LHRgNCw0LHQvtGC0YfQuNC60LDQvNC4INGB0L7QsdGL0YLQuNC5LiDQn9C70Y7RgSDQuiDRgtC+0LzRgyDQv9GA0LhcbiDRgtCw0LrQvtC8INC/0L7QtNGF0L7QtNC1INGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjiDQtNC10LvQsNGC0Ywg0L/RgNC+0YnQtSAtINC/0YDQuCDQvdC10Lkg0L3QtSDQv9GA0LjQtNGR0YLRgdGPINC/0LXRgNC10L3QsNC30L3QsNGH0LDRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0Lgg0L7QsdC90L7QstC70Y/RgtGMINCy0LXQt9C00LUg0YHRgdGL0LvQutGDXG4g0L3QsCDRgtC10LrRg9GJ0LjQuSDRjdC60LfQtdC80L/Qu9GP0YAg0L/Qu9C10LXRgNCwLlxuICovXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINC+0LHQtdGJ0LDQvdC40LUsINGA0LDQt9GA0LXRiNCw0Y7RidC10LXRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmluaXRQcm9taXNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlYWR5O1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YLQuNC/INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsFxuICogQHJldHVybnMge1N0cmluZ3xudWxsfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0VHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0YLQtdC60YPRidC40Lkg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0g0LHRgNCw0YLRjCDRgtGA0LXQuiDQuNC3INCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0LjQu9C4INC40Lcg0L/RgNC10LvQvtCw0LTQtdGA0LAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFNyYyhvZmZzZXQpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtdC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqINCX0LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsC4g0JDQutGC0YPQsNC70YzQvdC+INC00LvRjyDRhNC70LXRiC3RgNC10LDQu9C40LfQsNGG0LjQuCwg0LIg0L3QtdC5INC/0L7QutCwINGC0YDQtdC6INCz0YDRg9C30LjRgtGB0Y9cbiAqINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQvtC/0YDQtdC00LXQu9GP0LXRgtGB0Y8g0YEg0L/QvtCz0YDQtdGI0L3QvtGB0YLRjNGOLlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVwiLCBzcmMsIGR1cmF0aW9uKTtcblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHRoaXMuX2dlbmVyYXRlUGxheUlkKCk7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICB0aGlzLl93aGVuUGF1c2UucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHRoaXMuX3doZW5TdG9wLnJlamVjdChcInBsYXlcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QbGF5XCIsIFtBdWRpb1BsYXllci5FVkVOVF9QTEFZXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgIF0pO1xuXG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXkoc3JjLCBkdXJhdGlvbik7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQt9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnJlc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZ2V0RHVyYXRpb24oKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcbiAgICB0aGlzLnNldFBvc2l0aW9uKDApO1xuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuICAgIHJldHVybiB0aGlzLnJlc3VtZSgpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC60LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzdG9wXCIsIG9mZnNldCk7XG5cbiAgICBpZiAob2Zmc2V0ICE9PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblN0b3AucHJvbWlzZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5TdG9wXCIsIFtBdWRpb1BsYXllci5FVkVOVF9TVE9QXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWSxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3AoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0L/Qu9C10LXRgCDQvdCwINC/0LDRg9C30YNcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBhdXNlXCIpO1xuXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkJBRF9TVEFURSkpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBhdXNlXCIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QYXVzZS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBhdXNlXCIsIFtBdWRpb1BsYXllci5FVkVOVF9QQVVTRV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGF1c2UoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQodC90Y/RgtC40LUg0L/Qu9C10LXRgNCwINGBINC/0LDRg9C30YtcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9JRExFIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRFxuICAgICAgICB8fCB0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJyZXN1bWVcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGxheS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuXG4gICAgICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucmVzdW1lKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NyY10gLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiwg0LTQu9GPINC/0YDQvtCy0LXRgNC60LgsINGH0YLQviDQsiDQv9GA0LXQu9C+0LDQtNC10YDQtSDQvdGD0LbQvdGL0Lkg0YLRgNC10LpcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVByZWxvYWRlZFwiLCBzcmMpO1xuXG4gICAgaWYgKCFzcmMpIHtcbiAgICAgICAgc3JjID0gdGhpcy5nZXRTcmMoMSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzUHJlbG9hZGVkKHNyYykpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkQmFkVHJhY2tcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICB0aGlzLl93aGVuU3RvcC5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICBdKTtcbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXlQcmVsb2FkZWQoKTtcblxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEVycm9yXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LAg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgaWYgKGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwibXNpZVwiICYmIGRldGVjdC5icm93c2VyLnZlcnNpb25bMF0gPT0gXCI5XCIpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInByZWxvYWRcIiwgc3JjLCBkdXJhdGlvbik7XG5cbiAgICBpZiAodGhpcy5fd2hlblByZWxvYWQpIHtcbiAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0KFwicHJlbG9hZFwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblByZWxvYWRcIiwgW1xuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9MT0FESU5HLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TV0FQXG4gICAgXSwgW1xuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVELFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UICsgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUFxuICAgIF0pO1xuXG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblByZWxvYWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QcmVsb2FkLnJlamVjdC5hcHBseSh0aGlzLl93aGVuUHJlbG9hZCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgxKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucHJlbG9hZChzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC9XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRlZChzcmMpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNQcmVsb2FkaW5nKHNyYywgMSk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KLQsNC50LzQuNC90LPQuFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFBvc2l0aW9uKCkgfHwgMDtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0g0L3QvtCy0LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9IC0tINC60L7QvdC10YfQvdCw0Y8g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlID09IFwiZmxhc2hcIikge1xuICAgICAgICBwb3NpdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKHRoaXMuZ2V0TG9hZGVkKCkgLSAxLCBwb3NpdGlvbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXREdXJhdGlvbigpIC0gMSwgcG9zaXRpb24pKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgKz0gdGhpcy5nZXRQb3NpdGlvbigpIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuXG4gICAgcmV0dXJuIHBvc2l0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ocHJlbG9hZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0RHVyYXRpb24ocHJlbG9hZGVyID8gMSA6IDApIHx8IDA7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAcGFyYW0ge0Jvb2xlYW58aW50fSBwcmVsb2FkZXIgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihwcmVsb2FkZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRMb2FkZWQocHJlbG9hZGVyID8gMSA6IDApIHx8IDA7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheWVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRQb3NpdGlvbigpO1xuICAgIHRoaXMuX3BsYXllZCArPSBwb3NpdGlvbiAtIHRoaXMuX2xhc3RTa2lwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gcG9zaXRpb247XG5cbiAgICByZXR1cm4gdGhpcy5fcGxheWVkO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCT0YDQvtC80LrQvtGB0YLRjFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0Lgg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFZvbHVtZSgpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC90L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IC0tINC40YLQvtCz0L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRWb2x1bWVcIiwgdm9sdW1lKTtcblxuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRWb2x1bWUodm9sdW1lKTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INCz0YDQvtC80LrQvtGB0YLRjCDRg9C/0YDQsNCy0LvRj9C10YLRgdGPINGD0YHRgtGA0L7QudGB0YLQstC+0LwsINCwINC90LUg0L/RgNC+0LPRgNCw0LzQvdC+XG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzRGV2aWNlVm9sdW1lKCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAgV2ViIEF1ZGlvIEFQSVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJ0b2dnbGVDcm9zc0RvbWFpbkZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVDcm9zc0RvbWFpbihzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCf0LXRgNC10LrQu9GO0YfQtdC90LjQtSDRgNC10LbQuNC80LAg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gV2ViIEF1ZGlvIEFQSS4g0JTQvtGB0YLRg9C/0LXQvSDRgtC+0LvRjNC60L4g0L/RgNC4IGh0bWw1LdGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqXG4gKiAqKtCS0L3QuNC80LDQvdC40LUhKiogLSDQv9C+0YHQu9C1INCy0LrQu9GO0YfQtdC90LjRjyDRgNC10LbQuNC80LAgV2ViIEF1ZGlvIEFQSSDQvtC9INC90LUg0L7RgtC60LvRjtGH0LDQtdGC0YHRjyDQv9C+0LvQvdC+0YHRgtGM0Y4sINGCLtC6LiDQtNC70Y8g0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y9cbiAqINGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAsINC60L7RgtC+0YDQvtC5INGC0YDQtdCx0YPQtdGC0YHRjyDQutC70LjQuiDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8uINCf0YDQuCDQvtGC0LrQu9GO0YfQtdC90LjQuCDQuNC3INCz0YDQsNGE0LAg0L7QsdGA0LDQsdC+0YLQutC4INC40YHQutC70Y7Rh9Cw0Y7RgtGB0Y9cbiAqINCy0YHQtSDQvdC+0LTRiyDQutGA0L7QvNC1INC90L7QtC3QuNGB0YLQvtGH0L3QuNC60L7QsiDQuCDQvdC+0LTRiyDQstGL0LLQvtC00LAsINGD0L/RgNCw0LLQu9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLRjNGOINC/0LXRgNC10LrQu9GO0YfQsNC10YLRgdGPINC90LAg0Y3Qu9C10LzQtdC90YLRiyBhdWRpbywg0LHQtdC3XG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBHYWluTm9kZVxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINC30LDQv9GA0LDRiNC40LLQsNC10LzRi9C5INGB0YLQsNGC0YPRgVxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINC40YLQvtCz0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElcIiwgc3RhdGUpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVXZWJBdWRpb0FQSShzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCQ0YPQtNC40L4t0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5tdXNpYy5BdWRpb35BdWRpb1ByZXByb2Nlc3NvclxuICpcbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBpbnB1dCAtINC90L7QtNCwLCDQsiDQutC+0YLQvtGA0YPRjiDQv9C10YDQtdC90LDQv9GA0LDQstC70Y/QtdGC0YHRjyDQstGL0LLQvtC0INCw0YPQtNC40L5cbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBvdXRwdXQgLSDQvdC+0LTQsCDQuNC3INC60L7RgtC+0YDQvtC5INCy0YvQstC+0LQg0L/QvtC00LDRkdGC0YHRjyDQvdCwINGD0YHQuNC70LjRgtC10LvRjFxuICovXG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0QXVkaW9QcmVwcm9jZXNzb3IocHJlcHJvY2Vzc29yKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQk9C10L3QtdGA0LDRhtC40Y8gcGxheUlkXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2dlbmVyYXRlUGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGxheUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygpLnNsaWNlKDIpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUgcGxheUlkXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BsYXlJZDtcbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluZGV4OiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24ubmFtZSxcbiAgICAgICAgc3JjOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uX2xvZ2dlcigpLFxuICAgICAgICB0eXBlOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZVxuICAgIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvUGxheWVyO1xuIiwiLyoqXG4gKiBAbmFtZXNwYWNlIEF1ZGlvU3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9TdGF0aWMgPSB7fTtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUExBWSA9IFwicGxheVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUT1AgPSBcInN0b3BcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BBVVNFID0gXCJwYXVzZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTID0gXCJwcm9ncmVzc1wiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyA9IFwibG9hZGluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCA9IFwibG9hZGVkXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUgPSBcInZvbHVtZWNoYW5nZVwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfRU5ERUQgPSBcImVuZGVkXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RBVEUgPSBcInN0YXRlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCA9IFwic3dhcFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuUFJFTE9BREVSX0VWRU5UID0gXCJwcmVsb2FkZXI6XCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JTklUID0gXCJpbml0XCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0lETEUgPSBcImlkbGVcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9QTEFZSU5HID0gXCJwbGF5aW5nXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUEFVU0VEID0gXCJwYXVzZWRcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1N0YXRpYztcbiIsIi8qKlxuICog0J3QsNGB0YLQvtC50LrQuCDQsdC40LHQu9C40L7RgtC10LrQuFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLmNvbmZpZ1xuICogQG5hbWVzcGFjZVxuICovXG52YXIgY29uZmlnID0ge1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCe0LHRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4XG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGF1ZGlvOiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmtC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QuiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHJ5OiAzXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyAgRmxhc2gt0L/Qu9C10LXRgFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPIGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBmbGFzaDoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0J/Rg9GC0Ywg0LogLnN3ZiDRhNCw0LnQu9GDINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGF0aDogXCJkaXN0XCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8gLnN3ZiDRhNCw0LnQu9CwINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgbmFtZTogXCJwbGF5ZXItMl8xLnN3ZlwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JzQuNC90LjQvNCw0LvRjNC90LDRjyDQstC10YDRgdC40Y8g0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB2ZXJzaW9uOiBcIjkuMC4yOFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICogSUQsINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0LLRi9GB0YLQsNCy0LvQtdC9INC00LvRjyDRjdC70LXQvNC10L3RgtCwINGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBwbGF5ZXJJRDogXCJZYW5kZXhBdWRpb0ZsYXNoUGxheWVyXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC80Y8g0YTRg9C90LrRhtC40Lgt0L7QsdGA0LDQsdC+0YLRh9C40LrQsCDRgdC+0LHRi9GC0LjQuSBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICogQGNvbnN0XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsYmFjazogXCJ5YS5tdXNpYy5BdWRpby5fZmxhc2hDYWxsYmFja1wiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGluaXRUaW1lb3V0OiAzMDAwLCAvLyAzIHNlY1xuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgbG9hZFRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+0YHQu9C1INC60LvQuNC60LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGNsaWNrVGltZW91dDogMTAwMCxcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0L3RgtC10YDQstCw0Lsg0L/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgaGVhcnRCZWF0SW50ZXJ2YWw6IDEwMDBcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICBIVE1MNS3Qv9C70LXQtdGAXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6IGh0bWw1INC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBodG1sNToge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KHQv9C40YHQvtC6INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0L7QsiDQtNC70Y8g0LrQvtGC0L7RgNGL0YUg0LvRg9GH0YjQtSDQvdC1INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCBodG1sNSDQv9C70LXQtdGALiDQmNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0L/RgNC4XG4gICAgICAgICAqINCw0LLRgtC+LdC+0L/RgNC10LTQtdC70LXQvdC40Lgg0YLQuNC/0LAg0L/Qu9C10LXRgNCwLiDQmNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNGLINGB0YDQsNCy0L3QuNCy0LDRjtGC0YHRjyDRgdC+INGB0YLRgNC+0LrQvtC5INC/0L7RgdGC0YDQvtC10L3QvdC+0Lkg0L/QviDRiNCw0LHQu9C+0L3Rg1xuICAgICAgICAgKiBgQDxwbGF0Zm9ybS52ZXJzaW9uPiA8cGxhdGZvcm0ub3M+Ojxicm93c2VyLm5hbWU+Lzxicm93c2VyLnZlcnNpb24+YFxuICAgICAgICAgKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gICAgICAgICAqL1xuICAgICAgICBibGFja2xpc3Q6IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiLCBcIjptc2llLzlcIl1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbmZpZztcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vbGliL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBINC+0YjQuNCx0LrQuCDQsNGD0LTQuNC+LdC/0LvQu9C10LXRgNCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uQXVkaW9FcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIC0g0YLQtdC60YHRgiDQvtGI0LjQsdC60LhcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQXVkaW9FcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG59O1xuQXVkaW9FcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIkF1ZGlvRXJyb3JcIik7XG5cbi8qKlxuICog0J3QtSDQvdCw0LnQtNC10L3QsCDRgNC10LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAg0LjQu9C4INCy0YHQtSDQtNC+0YHRgtGD0L/QvdGL0LUg0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/QvtGC0LXRgNC/0LXQu9C4INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTiA9IFwiY2Fubm90IGZpbmQgc3VpdGFibGUgaW1wbGVtZW50YXRpb25cIjtcbi8qKlxuICog0KLRgNC10Log0L3QtSDQsdGL0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC9INC40LvQuCDQstC+INCy0YDQtdC80Y8g0LfQsNCz0YDRg9C30LrQuCDQv9GA0L7QuNC30L7RiNC70LAg0L7RiNC40LHQutCwLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQgPSBcInRyYWNrIGlzIG5vdCBwcmVsb2FkZWRcIjtcbi8qKlxuICog0JTQtdC50YHRgtCy0LjQtSDQvdC1INC00L7RgdGC0YPQv9C90L4g0LjQtyDRgtC10LrRg9GJ0LXQs9C+INGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkJBRF9TVEFURSA9IFwiYWN0aW9uIGlzIG5vdCBwZXJtaXRlZCBmcm9tIGN1cnJlbnQgc3RhdGVcIjtcblxuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINCx0YvQuyDQt9Cw0LHQu9C+0LrQuNGA0L7QstCw0L1cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSID0gXCJmbGFzaCBpcyByZWplY3RlZCBieSBmbGFzaCBibG9ja2VyIHBsdWdpblwiO1xuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINC/0L7RgtC10YDQv9C10Lsg0LrRgNCw0YUg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L4g0L3QtdC40LfQstC10YHRgtC90YvQvCDQv9GA0LjRh9C40L3QsNC8XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfVU5LTk9XTl9DUkFTSCA9IFwiZmxhc2ggaXMgY3Jhc2hlZCB3aXRob3V0IHJlYXNvblwiO1xuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINC/0L7RgtC10YDQv9C10Lsg0LrRgNCw0YUg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC40Lct0LfQsCDRgtCw0LnQvNCw0YPRgtCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5JVF9USU1FT1VUID0gXCJmbGFzaCBpbml0IHRpbWVkIG91dFwiO1xuLyoqXG4gKiDQktC90YPRgtGA0LXQvdC90Y/RjyDQvtGI0LjQsdC60LAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IgPSBcImZsYXNoIGludGVybmFsIGVycm9yXCI7XG4vKipcbiAqINCf0L7Qv9GL0YLQutCwINCy0YvQt9Cy0LDRgtGMINC90LXQtNC+0YHRgtGD0L/QvdGL0Lkg0Y3QutC30LXQvNC70Y/RgCBGbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9FTU1JVEVSX05PVF9GT1VORCA9IFwiZmxhc2ggZXZlbnQgZW1taXRlciBub3QgZm91bmRcIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C10YDQtdGB0YLQsNC7INC+0YLQstC10YfQsNGC0Ywg0L3QsCDQt9Cw0L/RgNC+0YHRi1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HID0gXCJmbGFzaCBwbGF5ZXIgZG9lc24ndCByZXNwb25zZVwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvRXJyb3I7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2F1ZGlvLWVycm9yJyk7XG52YXIgUGxheWJhY2tFcnJvciA9IHJlcXVpcmUoJy4vcGxheWJhY2stZXJyb3InKTtcblxueWEubXVzaWMuQXVkaW8uQXVkaW9FcnJvciA9IEF1ZGlvRXJyb3I7XG55YS5tdXNpYy5BdWRpby5QbGF5YmFja0Vycm9yID0gUGxheWJhY2tFcnJvcjtcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vbGliL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICog0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uUGxheWJhY2tFcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIC0g0YLQtdC60YHRgiDQvtGI0LjQsdC60LhcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICpcbiAqIEBleHRlbmRzIEVycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBQbGF5YmFja0Vycm9yID0gZnVuY3Rpb24obWVzc2FnZSwgc3JjKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuXG4gICAgdGhpcy5zcmMgPSBzcmM7XG59O1xuXG5QbGF5YmFja0Vycm9yLnByb3RvdHlwZSA9IEVycm9yQ2xhc3MuY3JlYXRlKFwiUGxheWJhY2tFcnJvclwiKTtcblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0YHQvtC10LTQuNC90LXQvdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkNPTk5FQ1RJT05fQUJPUlRFRCA9IFwiQ29ubmVjdGlvbiBhYm9ydGVkXCI7XG4vKipcbiAqINCh0LXRgtC10LLQsNGPINC+0YjQuNCx0LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLk5FVFdPUktfRVJST1IgPSBcIk5ldHdvcmsgZXJyb3JcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC00LXQutC+0LTQuNGA0L7QstCw0L3QuNGPINCw0YPQtNC40L5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5ERUNPREVfRVJST1IgPSBcIkRlY29kZSBlcnJvclwiO1xuLyoqXG4gKiDQndC10LTQvtGB0YLRg9C/0L3Ri9C5INC40YHRgtC+0YfQvdC40LpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5CQURfREFUQSA9IFwiQmFkIGRhdGFcIjtcblxuLyoqXG4gKiDQotCw0LHQu9C40YbQsCDRgdC+0L7RgtCy0LXRgtGB0YLQstC40Y8g0LrQvtC00L7QsiDQvtGI0LjQsdC+0LogaHRtbDUg0L/Qu9C10LXRgNCwXG4gKiBAZW51bSB7U3RyaW5nfVxuICovXG5QbGF5YmFja0Vycm9yLmh0bWw1ID0ge1xuICAgIDE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELFxuICAgIDI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUixcbiAgICAzOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUixcbiAgICA0OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBXG59O1xuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC60LvQsNGB0YHQuNGE0LjQutCw0YLQvtGAINC+0YjQuNCx0L7QuiBmbGFzaC3Qv9C70LXQtdGA0LBcblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5YmFja0Vycm9yO1xuIiwiaWYgKHR5cGVvZiBERVYgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cuREVWID0gdHJ1ZTtcbn1cblxuaWYgKHR5cGVvZiB3aW5kb3cueWEgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cueWEgPSB7fTtcbn1cblxudmFyIHlhID0gd2luZG93LnlhO1xuXG5pZiAodHlwZW9mIHlhLm11c2ljID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEubXVzaWMgPSB7fTtcbn1cblxuaWYgKHR5cGVvZiB5YS5tdXNpYy5BdWRpbyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHlhLm11c2ljLkF1ZGlvID0ge307XG59XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xudmFyIEF1ZGlvUGxheWVyID0gcmVxdWlyZSgnLi9hdWRpby1wbGF5ZXInKTtcbnZhciBQcm94eSA9IHJlcXVpcmUoJy4vbGliL2NsYXNzL3Byb3h5Jyk7XG5cbnlhLm11c2ljLkF1ZGlvID0gUHJveHkuY3JlYXRlQ2xhc3MoQXVkaW9QbGF5ZXIpO1xueWEubXVzaWMuQXVkaW8uY29uZmlnID0gY29uZmlnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHlhLm11c2ljLkF1ZGlvO1xuIiwidmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0ZsYXNoJyk7XG52YXIgRmxhc2hNYW5hZ2VyID0gcmVxdWlyZSgnLi9mbGFzaC1tYW5hZ2VyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcblxudmFyIHBsYXllcklkID0gMTtcblxudmFyIGZsYXNoTWFuYWdlcjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQvtCy0LXRgNC60LAg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxudmFyIGZsYXNoVmVyc2lvbiA9IHN3Zm9iamVjdC5nZXRGbGFzaFBsYXllclZlcnNpb24oKTtcbmRldGVjdC5mbGFzaFZlcnNpb24gPSBmbGFzaFZlcnNpb24ubWFqb3IgKyBcIi5cIiArIGZsYXNoVmVyc2lvbi5taW5vciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLnJlbGVhc2U7XG5cbmV4cG9ydHMuYXZhaWxhYmxlID0gc3dmb2JqZWN0Lmhhc0ZsYXNoUGxheWVyVmVyc2lvbihjb25maWcuZmxhc2gudmVyc2lvbik7XG5sb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBleHBvcnRzLmF2YWlsYWJsZSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfU1dBUFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FUlJPUlxuICpcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFtvdmVybGF5XSAtINC80LXRgdGC0L4g0LTQu9GPINCy0YHRgtGA0LDQuNCy0LDQvdC40Y8g0L/Qu9C10LXRgNCwICjQsNC60YLRg9Cw0LvRjNC90L4g0YLQvtC70YzQutC+INC00LvRjyBmbGFzaC3Qv9C70LXQtdGA0LApXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZT1mYWxzZV0gLSDRgdC+0LfQtNCw0YLRjCDQvdC+0LLRi9C5INGN0LrQt9C10L/Qu9GP0YAgRmxhc2hNYW5hZ2VyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBBdWRpb0ZsYXNoID0gZnVuY3Rpb24ob3ZlcmxheSwgZm9yY2UpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIGlmICghZmxhc2hNYW5hZ2VyIHx8IGZvcmNlKSB7XG4gICAgICAgIGZsYXNoTWFuYWdlciA9IG5ldyBGbGFzaE1hbmFnZXIob3ZlcmxheSk7XG4gICAgfVxuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLndoZW5SZWFkeSA9IGZsYXNoTWFuYWdlci5jcmVhdGVQbGF5ZXIodGhpcyk7XG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVhZHlcIiwgZGF0YSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0ZsYXNoKTtcblxuQXVkaW9GbGFzaC50eXBlID0gQXVkaW9GbGFzaC5wcm90b3R5cGUudHlwZSA9IFwiZmxhc2hcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCh0L7Qt9C00LDQvdC40LUg0LzQtdGC0L7QtNC+0LIg0YDQsNCx0L7RgtGLINGBINC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbk9iamVjdC5rZXlzKEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZSkuZmlsdGVyKGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBGbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXlbMF0gIT09IFwiX1wiO1xufSkubWFwKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIEF1ZGlvRmxhc2gucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCEvXmdldC8udGVzdChtZXRob2QpKSB7XG4gICAgICAgICAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIG1ldGhvZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5ZXIgaXMgbm90IHJlYWR5XCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMuaWQpO1xuICAgICAgICByZXR1cm4gZmxhc2hNYW5hZ2VyLmZsYXNoW21ldGhvZF0uYXBwbHkoZmxhc2hNYW5hZ2VyLmZsYXNoLCBhcmdzKTtcbiAgICB9XG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gIEpTRE9DXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwYXVzZVxuICovXG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcmVzdW1lXG4gKi9cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc3RvcFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3ByZWxvYWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRlZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlQcmVsb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFBvc2l0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0UG9zaXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldER1cmF0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0TG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRWb2x1bWVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFZvbHVtZVxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFNyY1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0ZsYXNoLnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQs9C40YDQvtCy0LDQvdC40LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYWluOiBcIm5vdCByZWFkeVwiLFxuICAgICAgICAgICAgICAgIHByZWxvYWRlcjogXCJub3QgcmVhZHlcIlxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogdGhpcy5nZXRTcmMoMCksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IHRoaXMuZ2V0U3JjKDEpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvRmxhc2g7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoSW50ZXJmYWNlJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQntC/0LjRgdCw0L3QuNC1INCy0L3QtdGI0L3QtdCz0L4g0LjQvdGC0LXRgNGE0LXQudGB0LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge09iamVjdH0gZmxhc2ggLSBzd2Yt0L7QsdGK0LXQutGCXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEludGVyZmFjZSA9IGZ1bmN0aW9uKGZsYXNoKSB7XG4gICAgLy9GSVhNRTog0L3Rg9C20L3QviDQv9GA0LjQtNGD0LzQsNGC0Ywg0L3QvtGA0LzQsNC70YzQvdGL0Lkg0LzQtdGC0L7QtCDRjdC60YHQv9C+0YDRgtCwXG4gICAgdGhpcy5mbGFzaCA9IHlhLm11c2ljLkF1ZGlvLl9mbGFzaCA9IGZsYXNoO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRidC10L3QuNC1INGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRi9C30LLQsNGC0Ywg0LzQtdGC0L7QtCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBmbiAtINC90LDQt9Cy0LDQvdC40LUg0LzQtdGC0L7QtNCwXG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fY2FsbEZsYXNoID0gZnVuY3Rpb24oZm4pIHtcbiAgICAvL0RFViAmJiBsb2dnZXIuZGVidWcodGhpcywgZm4sIGFyZ3VtZW50cyk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5mbGFzaC5jYWxsLmFwcGx5KHRoaXMuZmxhc2gsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcIl9jYWxsRmxhc2hFcnJvclwiLCBlLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC+0LHRgNCw0YLQvdC+0Lkg0YHQstGP0LfQuCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHRocm93cyDQntGI0LjQsdC60LAg0LTQvtGB0YLRg9C/0LAg0LogZmxhc2gt0L/Qu9C10LXRgNGDXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2hlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcImhlYXJ0QmVhdFwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7aW50fSAtLSBpZCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2FkZFBsYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJhZGRQbGF5ZXJcIiwgLTEpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LXRgtC+0LTRiyDRg9C/0YDQsNCy0LvQtdC90LjRjyDQv9C70LXQtdGA0L7QvFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LbQtdC70LDQtdC80LDRjyDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKGlkLCB2b2x1bWUpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRWb2x1bWVcIiwgLTEsIHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0Vm9sdW1lXCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBsYXlcIiwgaWQsIHNyYywgZHVyYXRpb24pO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzdG9wXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBhdXNlXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwicmVzdW1lXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0UG9zaXRpb25cIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkLCBwb3NpdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInNldFBvc2l0aW9uXCIsIGlkLCBwb3NpdGlvbik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0RHVyYXRpb25cIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldExvYWRlZFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0YDQtdC00LfQsNCz0YDRg9C30LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicHJlbG9hZFwiLCBpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkZWRcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkaW5nXCIsIGlkLCBzcmMsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicGxheVByZWxvYWRlZFwiLCBpZCwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQtdC10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFNyY1wiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEludGVyZmFjZTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignRmxhc2hNYW5hZ2VyJyk7XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi4vYXVkaW8tc3RhdGljJyk7XG52YXIgZmxhc2hMb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xudmFyIEZsYXNoSW50ZXJmYWNlID0gcmVxdWlyZSgnLi9mbGFzaC1pbnRlcmZhY2UnKTtcblxudmFyIFByb21pc2UgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvcHJvbWlzZScpO1xudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvYXVkaW8tZXJyb3InKTtcbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQl9Cw0LPRgNGD0LfQutCwIGZsYXNoLdC/0LvQtdC10YDQsCDQuCDQvtCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG92ZXJsYXkgLSDQvtCx0YrQtdC60YIg0LTQu9GPINC30LDQs9GA0YPQt9C60Lgg0Lgg0L/QvtC60LDQt9CwIGZsYXNoLdC/0LvQtdC10YDQsFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hNYW5hZ2VyID0gZnVuY3Rpb24ob3ZlcmxheSkgeyAvLyBzaW5nbGV0b24hXG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIsIG92ZXJsYXkpO1xuXG4gICAgdGhpcy5zdGF0ZSA9IFwiaW5pdFwiO1xuICAgIHRoaXMub3ZlcmxheSA9IG92ZXJsYXk7XG4gICAgdGhpcy5lbW1pdGVycyA9IFtdO1xuXG4gICAgdmFyIGRlZmVycmVkID0gdGhpcy5kZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIC8qKlxuICAgICAqINCe0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/RgNC4INC30LDQstC10YDRiNC10L3QuNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICogQHR5cGUge1Byb21pc2V9XG4gICAgICovXG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLmRlZmVycmVkLnByb21pc2UoKTtcblxuICAgIHZhciBjYWxsYmFja1BhdGggPSBjb25maWcuZmxhc2guY2FsbGJhY2suc3BsaXQoXCIuXCIpO1xuICAgIHZhciBjYWxsYmFja05hbWUgPSBjYWxsYmFja1BhdGgucG9wKCk7XG4gICAgdmFyIGNhbGxiYWNrQ29udCA9IHdpbmRvdztcbiAgICBjYWxsYmFja1BhdGguZm9yRWFjaChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgIGlmICghY2FsbGJhY2tDb250W3BhcnRdKSB7XG4gICAgICAgICAgICBjYWxsYmFja0NvbnRbcGFydF0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFja0NvbnQgPSBjYWxsYmFja0NvbnRbcGFydF07XG4gICAgfSk7XG4gICAgY2FsbGJhY2tDb250W2NhbGxiYWNrTmFtZV0gPSB0aGlzLl9vbkV2ZW50LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fbG9hZFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uTG9hZFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmxvYWRUaW1lb3V0KTtcbiAgICBmbGFzaExvYWRlcihjb25maWcuZmxhc2gucGF0aCArIFwiL1wiXG4gICAgICAgICsgY29uZmlnLmZsYXNoLm5hbWUsIGNvbmZpZy5mbGFzaC52ZXJzaW9uLCBjb25maWcuZmxhc2gucGxheWVySUQsIHRoaXMuX29uTG9hZC5iaW5kKHRoaXMpLCB7fSwgb3ZlcmxheSk7XG5cbiAgICBpZiAob3ZlcmxheSkge1xuICAgICAgICB2YXIgdGltZW91dDtcbiAgICAgICAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uKCkgeyAvL0tOT1dMRURHRTogb25seSBtb3VzZWRvd24gZXZlbnQgYW5kIG9ubHkgd21vZGU6IHRyYW5zcGFyZW50XG4gICAgICAgICAgICB0aW1lb3V0ID0gdGltZW91dCB8fCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElORykpO1xuICAgICAgICAgICAgICAgIH0sIGNvbmZpZy5mbGFzaC5jbGlja1RpbWVvdXQpO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICB9XG5cbiAgICB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICB0aW1lb3V0ID0gdGltZW91dCAmJiBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVhZHlcIiwgcmVzdWx0KTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuXG5GbGFzaE1hbmFnZXIuRVZFTlRfSU5JVCA9IFwiaW5pdFwiO1xuRmxhc2hNYW5hZ2VyLkVWRU5UX0ZBSUwgPSBcImZhaWxlZFwiO1xuRmxhc2hNYW5hZ2VyLkVWRU5UX0VSUk9SID0gXCJlcnJvclwiO1xuRmxhc2hNYW5hZ2VyLkVWRU5UX0RFQlVHID0gXCJkZWJ1Z1wiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuSDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCBmbGFzaFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC30LDQs9GA0YPQt9C60Lgg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0gZGF0YVxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Mb2FkID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Mb2FkXCIsIGRhdGEpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkVGltZW91dCk7XG4gICAgZGVsZXRlIHRoaXMuX19sb2FkVGltZW91dDtcblxuICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFzaCA9IG5ldyBGbGFzaEludGVyZmFjZShkYXRhLnJlZik7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFwicmVhZHlcIikge1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKGRhdGEucmVmKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vdmVybGF5KSB7XG4gICAgICAgICAgICB0aGlzLl9faW5pdFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uSW5pdFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmluaXRUaW1lb3V0KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihkYXRhLl9fZmJuID8gQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSIDogQXVkaW9FcnJvci5GTEFTSF9VTktOT1dOX0NSQVNIKSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC30LDQs9GA0YPQt9C60LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgTG9hZGVyRXJyb3IoTG9hZGVyRXJyb3IuVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRiNC90L7RgdGC0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Jbml0XCIpO1xuXG4gICAgdGhpcy5zdGF0ZSA9IFwicmVhZHlcIjtcblxuICAgIGlmICh0aGlzLl9faW5pdFRpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX19pbml0VGltZW91dCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9faW5pdFRpbWVvdXQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmxhc2gpIHtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKHRoaXMuZmxhc2gpO1xuICAgICAgICB0aGlzLl9faGVhcnRiZWF0ID0gc2V0SW50ZXJ2YWwodGhpcy5fb25IZWFydEJlYXQuYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YHQvtCx0YvRgtC40LkgZmxhc2gt0L/Qu9C10LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40LksINGB0L7Qt9C00LDQstCw0LXQvNGL0YUgZmxhc2gt0L/Qu9C10LXRgNC+0LxcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gb2Zmc2V0IC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1INC/0LXRgNC10LTQsNC90L3Ri9C1INCy0LzQtdGB0YLQtSDRgSDRgdC+0LHRi9GC0LjQtdC8XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkV2ZW50ID0gZnVuY3Rpb24oZXZlbnQsIGlkLCBvZmZzZXQsIGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gXCJmYWlsZWRcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIm9uRXZlbnRGYWlsZWRcIiwgZXZlbnQsIGlkLCBvZmZzZXQsIGRhdGEpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfREVCVUcpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJmbGFzaERFQlVHXCIsIGlkLCBvZmZzZXQsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9FUlJPUikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcImZsYXNoRXJyb3JcIiwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQsIGlkLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29uSW5pdCgpO1xuICAgIH1cblxuICAgIGlmIChldmVudCA9PT0gRmxhc2hNYW5hZ2VyLkVWRU5UX0ZBSUwpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIEF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IpO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL0lORk86INCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0YHQvtCx0YvRgtC40Y8g0L/QtdGA0LXQtNCw0L3QvdC+0LPQviDQuNC3INGE0LvQtdGI0LAg0L3QtdC70YzQt9GPINC+0LHRgNCw0YnQsNGC0YzRgdGPINC6INGE0LvQtdGILdC+0LHRitC10LrRgtGDLCDQv9C+0Y3RgtC+0LzRgyDQtNC10LvQsNC10Lwg0YDQsNGB0YHQuNC90YXRgNC+0L3QuNC30LDRhtC40Y5cbiAgICBpZiAoaWQgPT0gLTEpIHtcbiAgICAgICAgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuZW1taXRlcnMuZm9yRWFjaChmdW5jdGlvbihlbW1pdGVyKSB7XG4gICAgICAgICAgICAgICAgZW1taXRlci50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmVtbWl0ZXJzW2lkXSkge1xuICAgICAgICBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5lbW1pdGVyc1tpZF0udHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5GTEFTSF9FTU1JVEVSX05PVF9GT1VORCwgaWQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25IZWFydEJlYXQgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICB0aGlzLmZsYXNoLl9oZWFydEJlYXQoKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiY3Jhc2hlZFwiLCBlKTtcbiAgICAgICAgdGhpcy5fb25FdmVudChBdWRpb1N0YXRpYy5FVkVOVF9DUkFTSEVELCAtMSwgZSk7XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INC/0LvQtdC10YDQvtC8XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge0F1ZGlvRmxhc2h9IGF1ZGlvRmxhc2ggLSBmbGFzaCDQsNGD0LTQuNC+LdC/0LvQtdC10YAsINC60L7RgtC+0YDRi9C5INCx0YPQtNC10YIg0L7QsdGB0LvRg9C20LjQstCw0YLRjCDRgdC+0LfQtNCw0L3QvdGL0Lkg0L/Qu9C10LXRgFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDRgdC+0LfQtNCw0L3QuNGPINC/0LvQtdC10YDQsFxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLmNyZWF0ZVBsYXllciA9IGZ1bmN0aW9uKGF1ZGlvRmxhc2gpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlUGxheWVyXCIpO1xuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBhdWRpb0ZsYXNoLmlkID0gdGhpcy5mbGFzaC5fYWRkUGxheWVyKCk7XG4gICAgICAgIHRoaXMuZW1taXRlcnNbYXVkaW9GbGFzaC5pZF0gPSBhdWRpb0ZsYXNoO1xuICAgICAgICByZXR1cm4gYXVkaW9GbGFzaC5pZDtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHBsYXllcklkKSB7XG4gICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVQbGF5ZXJTdWNjZXNzXCIsIHBsYXllcklkKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJjcmVhdGVQbGF5ZXJFcnJvclwiLCBlcnIpO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hNYW5hZ2VyO1xuIiwiLyoqXG4gKiBAaWdub3JlXG4gKiBAZmlsZVxuICogVGhpcyBpcyBhIHdyYXBwZXIgZm9yIHN3Zm9iamVjdCB0aGF0IGRldGVjdHMgRmxhc2hCbG9jayBpbiBicm93c2VyLlxuICpcbiAqIFdyYXBwZXIgZGV0ZWN0czpcbiAqICAgLSBDaHJvbWVcbiAqICAgICAtIEZsYXNoQmxvY2sgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gKiAgICAgLSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICogICAtIEZpcmVmb3ggRmxhc2hibG9jayAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAqICAgLSBPcGVyYSA+PSAxMS41IFwiRW5hYmxlIHBsdWdpbnMgb24gZGVtYW5kXCIgc2V0dGluZ1xuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggRXh0ZW5zaW9uIChodHRwOi8vaG95b2lzLmdpdGh1Yi5jb20vc2FmYXJpZXh0ZW5zaW9ucy9jbGlja3RvcGx1Z2luLylcbiAqICAgLSBTYWZhcmkgQ2xpY2tUb0ZsYXNoIFBsdWdpbiAoZm9yIFNhZmFyaSA8IDUuMC42KSAoaHR0cDovL3JlbnR6c2NoLmdpdGh1Yi5jb20vY2xpY2t0b2ZsYXNoLylcbiAqXG4gKiBUZXN0ZWQgb246XG4gKiAgIC0gQ2hyb21lIDEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IExleDEgMS4yLjExLjEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IGpvc29yZWsgMC45LjMxXG4gKiAgICAgLSBGbGFzaEZyZWUgMS4xLjNcbiAqICAgLSBGaXJlZm94IDUuMC4xICsgRmxhc2hibG9jayAxLjUuMTUuMVxuICogICAtIE9wZXJhIDExLjVcbiAqICAgLSBTYWZhcmkgNS4xICsgQ2xpY2tUb0ZsYXNoICgyLjMuMilcbiAqXG4gKiBBbHNvIHRoaXMgd3JhcHBlciBjYW4gcmVtb3ZlIGJsb2NrZWQgc3dmIGFuZCBsZXQgeW91IGRvd25ncmFkZSB0byBvdGhlciBvcHRpb25zLlxuICpcbiAqIEZlZWwgZnJlZSB0byBjb250YWN0IG1lIHZpYSBlbWFpbC5cbiAqXG4gKiBDb3B5cmlnaHQgMjAxMSwgQWxleGV5IEFuZHJvc292XG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgKGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwKSBvciBHUEwgVmVyc2lvbiAzIChodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWwpIGxpY2Vuc2VzLlxuICpcbiAqIFRoYW5rcyB0byBmbGFzaGJsb2NrZGV0ZWN0b3IgcHJvamVjdCAoaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2ZsYXNoYmxvY2tkZXRlY3RvcilcbiAqXG4gKiBAcmVxdWlyZXMgc3dmb2JqZWN0XG4gKiBAYXV0aG9yIEFsZXhleSBBbmRyb3NvdiA8ZG9vY2hpa0B5YS5ydT5cbiAqIEB2ZXJzaW9uIDEuMFxuICovXG5cbnZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcblxuZnVuY3Rpb24gcmVtb3ZlKG5vZGUpIHtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG59XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwINGBINCy0L7Qt9C80L7QttC90L7RgdGC0YzRjiDQvtGC0YHQu9C10LbQuNCy0LDQvdC40Y8g0LHQu9C+0LrQuNGA0L7QstGJ0LjQutC+0LJcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmYm4tc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmJuLXN3Zi13cmFwcGVyJyxcblxuICAgIC8qKlxuICAgICAqIFRpbWVvdXQgZm9yIGZsYXNoIGJsb2NrIGRldGVjdFxuICAgICAqIEBkZWZhdWx0IDUwMFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICBfX1RJTUVPVVQ6IDUwMCxcblxuICAgIF9fVEVTVFM6IFtcbiAgICAgICAgLy8gQ2hvbWUgRmxhc2hCbG9jayBleHRlbnNpb24gKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUsIHdyYXBwZXJOb2RlKSB7XG4gICAgICAgICAgICAvLyB3ZSBleHBlY3QgdGhhdCBzd2YgaXMgdGhlIG9ubHkgY2hpbGQgb2Ygd3JhcHBlclxuICAgICAgICAgICAgcmV0dXJuIHdyYXBwZXJOb2RlLmNoaWxkTm9kZXMubGVuZ3RoID4gMVxuICAgICAgICB9LCAvLyBvbGRlciBTYWZhcmkgQ2xpY2tUb0ZsYXNoIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBJRSBoYXMgbm8gc3dmTm9kZS50eXBlXG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS50eXBlICYmIHN3Zk5vZGUudHlwZSAhPSAnYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2gnXG4gICAgICAgIH0sIC8vIEZsYXNoQmxvY2sgZm9yIEZpcmVmb3ggKGh0dHBzOi8vYWRkb25zLm1vemlsbGEub3JnL3J1L2ZpcmVmb3gvYWRkb24vZmxhc2hibG9jay8pXG4gICAgICAgIC8vIENocm9tZSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBzd2YgaGF2ZSBiZWVuIGRldGFjaGVkIGZyb20gRE9NXG4gICAgICAgICAgICByZXR1cm4gIXN3Zk5vZGUucGFyZW50Tm9kZTtcbiAgICAgICAgfSwgLy8gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS5wYXJlbnROb2RlLmNsYXNzTmFtZS5pbmRleE9mKCdDVEZub2Rpc3BsYXknKSA+IC0xO1xuICAgICAgICB9XG4gICAgXSxcblxuICAgIC8qKlxuICAgICAqIEVtYmVkIFNXRiBpbmZvIHBhZ2UuIFRoaXMgZnVuY3Rpb24gaGFzIHNhbWUgb3B0aW9ucyBhcyBzd2ZvYmplY3QuZW1iZWRTV0YgZXhjZXB0IGxhc3QgcGFyYW0gcmVtb3ZlQmxvY2tlZFNXRi5cbiAgICAgKiBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgKiBAcGFyYW0gc3dmVXJsU3RyXG4gICAgICogQHBhcmFtIHJlcGxhY2VFbGVtSWRTdHJcbiAgICAgKiBAcGFyYW0gd2lkdGhTdHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0U3RyXG4gICAgICogQHBhcmFtIHN3ZlZlcnNpb25TdHJcbiAgICAgKiBAcGFyYW0geGlTd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gZmxhc2h2YXJzT2JqXG4gICAgICogQHBhcmFtIHBhck9ialxuICAgICAqIEBwYXJhbSBhdHRPYmpcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tGblxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbW92ZUJsb2NrZWRTV0Y9dHJ1ZV0gUmVtb3ZlIHN3ZiBpZiBibG9ja2VkXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4sIHJlbW92ZUJsb2NrZWRTV0YpIHtcbiAgICAgICAgLy8gdmFyIHN3Zm9iamVjdCA9IHdpbmRvd1snc3dmb2JqZWN0J107XG5cbiAgICAgICAgaWYgKCFzd2ZvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3Zm9iamVjdC5hZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcbiAgICAgICAgICAgIGlmICghcmVwbGFjZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gY3JlYXRlIGRpdi13cmFwcGVyIGJlY2F1c2Ugc29tZSBmbGFzaCBibG9jayBwbHVnaW5zIHJlcGxhY2Ugc3dmIHdpdGggYW5vdGhlciBjb250ZW50LlxuICAgICAgICAgICAgLy8gQWxzbyBzb21lIGZsYXNoIHJlcXVpcmVzIHdyYXBwZXIgdG8gd29yayBwcm9wZXJseS5cbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBURVNUUyA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1RFU1RTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqID0gVEVTVFMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChURVNUU1tpXShzd2ZFbGVtZW50LCB3cmFwcGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEJsb2NrTm90aWZpZXIuX19USU1FT1VUKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG9uRmFpbHVyZShlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdmVCbG9ja2VkU1dGICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgc3dmXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2ZvYmplY3QucmVtb3ZlU1dGKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgd3JhcHBlclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHdyYXBwZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBleHRlbnNpb24gYXJ0ZWZhY3RzXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2xpY2tUb0ZsYXNoIGFydGVmYWN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN0ZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdDVEZzdGFjaycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0Zikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0Nocm9tZSBGbGFzaEJsb2NrIGFydGVmYWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdEJvZHlDaGlsZCA9IGRvY3VtZW50LmJvZHkubGFzdENoaWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RCb2R5Q2hpbGQgJiYgbGFzdEJvZHlDaGlsZC5jbGFzc05hbWUgPT0gJ3Vqc19mbGFzaGJsb2NrX3BsYWNlaG9sZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShsYXN0Qm9keUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZS5fX2ZibiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuIiwidmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG4vKipcbiAqINCc0L7QtNGD0LvRjCDQt9Cw0LPRgNGD0LfQutC4INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoRW1iZWRkZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmZW1iLXN3Zi13cmFwcGVyXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgX19TV0ZfV1JBUFBFUl9DTEFTUzogJ2ZlbWItc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hFbWJlZGRlci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzd2ZFbGVtZW50ID0gZVsncmVmJ107XG4gICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIDExLjUgYW5kIGFib3ZlIHJlcGxhY2VzIGZsYXNoIHdpdGggU1ZHIGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAvLyBtc2llIChhbmQgY2FuYXJ5IGNocm9tZSAzMi4wKSBjcmFzaGVzIG9uIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVwbGFjZWRCeVNWRyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZWRCeVNWRyA9IHN3ZkVsZW1lbnQgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VkQnlTVkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRmFpbHVyZShlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9zZXQgdGltZW91dCB0byBsZXQgRmxhc2hCbG9jayBwbHVnaW4gZGV0ZWN0IHN3ZiBhbmQgcmVwbGFjZSBpdCBzb21lIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgRmxhc2hFbWJlZGRlci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5zdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hFbWJlZGRlcjtcbiIsInZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSByZXF1aXJlKCcuL2ZsYXNoYmxvY2tub3RpZmllcicpO1xudmFyIEZsYXNoRW1iZWRkZXIgPSByZXF1aXJlKCcuL2ZsYXNoZW1iZWRkZXInKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcblxudmFyIHdpblNhZmFyaSA9IGRldGVjdC5wbGF0Zm9ybS5vcyA9PT0gJ3dpbmRvd3MnICYmIGRldGVjdC5icm93c2VyLm5hbWUgPT09ICdzYWZhcmknO1xuXG52YXIgQ09OVEFJTkVSX0NMQVNTID0gXCJ5YS1mbGFzaC1wbGF5ZXItd3JhcHBlclwiO1xuXG4vKipcbiAqINCX0LDQs9GA0YPQt9GH0LjQuiDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqXG4gKiBAYWxpYXMgRmxhc2hNYW5hZ2VyfmZsYXNoTG9hZGVyXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCAtINCh0YHRi9C70LrQsCDQvdCwINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IG1pblZlcnNpb24gLSDQvNC40L3QuNC80LDQu9GM0L3QsNGPINCy0LXRgNGB0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gaWQgLSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBsb2FkQ2FsbGJhY2sgLSDQutC+0LvQsdC10Log0LTQu9GPINGB0L7QsdGL0YLQuNGPINC30LDQs9GA0YPQt9C60LhcbiAqIEBwYXJhbSB7b2JqZWN0fSBmbGFzaFZhcnMgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9C1INCy0L4g0YTQu9C10YhcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lciAtINC60L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0LLQuNC00LjQvNC+0LPQviDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWCAtINGA0LDQt9C80LXRgCDQv9C+INCz0L7RgNC40LfQvtC90YLQsNC70LhcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWSAtINGA0LDQt9C80LXRgCDQv9C+INCy0LXRgNGC0LjQutCw0LvQuFxuICpcbiAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gLS0g0JrQvtC90YLQtdC50L3QtdGAINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHVybCwgbWluVmVyc2lvbiwgaWQsIGxvYWRDYWxsYmFjaywgZmxhc2hWYXJzLCBjb250YWluZXIsIHNpemVYLCBzaXplWSkge1xuICAgIHZhciAkZmxhc2hQbGF5ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICRmbGFzaFBsYXllci5pZCA9IFwid3JhcHBlcl9cIiArIGlkO1xuICAgICRmbGFzaFBsYXllci5pbm5lckhUTUwgPSAnPGRpdiBpZD1cIicgKyBpZCArICdcIj48L2Rpdj4nO1xuXG4gICAgc2l6ZVggPSBzaXplWCB8fCBcIjEwMDBcIjtcbiAgICBzaXplWSA9IHNpemVZIHx8IFwiMTAwMFwiO1xuXG4gICAgdmFyIGVtYmVkZGVyLFxuICAgICAgICBmbGFzaFNpemVYLFxuICAgICAgICBmbGFzaFNpemVZLFxuICAgICAgICBvcHRpb25zO1xuXG4gICAgaWYgKGNvbnRhaW5lciAmJiAhd2luU2FmYXJpKSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hFbWJlZGRlcjtcbiAgICAgICAgZmxhc2hTaXplWCA9IHNpemVYOyBmbGFzaFNpemVZID0gc2l6ZVk7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiLCB3bW9kZTogXCJ0cmFuc3BhcmVudFwiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLmNsYXNzTmFtZSA9IENPTlRBSU5FUl9DTEFTUztcbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IHJlbGF0aXZlOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCgkZmxhc2hQbGF5ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuICAgICAgICBmbGFzaFNpemVYID0gZmxhc2hTaXplWSA9IFwiMVwiO1xuICAgICAgICBvcHRpb25zID0geyBhbGxvd3NjcmlwdGFjY2VzczogXCJhbHdheXNcIiB9O1xuXG4gICAgICAgICRmbGFzaFBsYXllci5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogLTFweDsgdG9wOiAtMXB4OyB3aWR0aDogMHB4OyBoZWlnaHQ6IDBweDsgb3ZlcmZsb3c6IGhpZGRlbjsnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfVxuXG4gICAgZW1iZWRkZXIuZW1iZWRTV0YoXG4gICAgICAgIHVybCxcbiAgICAgICAgaWQsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG1pblZlcnNpb24sXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGZsYXNoVmFycyxcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAge30sXG4gICAgICAgIGxvYWRDYWxsYmFja1xuICAgICk7XG5cbiAgICByZXR1cm4gJGZsYXNoUGxheWVyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gWzYwLCAxNzAsIDMxMCwgNjAwLCAxMDAwLCAzMDAwLCA2MDAwLCAxMjAwMCwgMTQwMDAsIDE2MDAwXTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImRlZmF1bHRcIixcbiAgICAgICAgXCJwcmVhbXBcIjogMCxcbiAgICAgICAgXCJiYW5kc1wiOiBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkNsYXNzaWNhbFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMC41LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMy41LCAtMy41LCAtMy41LCAtNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2x1YlwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4zNTk5OTk4OTUwOTU4MjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIDQsIDIuNSwgMi41LCAyLjUsIDEuNSwgLTAuNSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkRhbmNlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjE1OTk5OTg0NzQxMjEwOTQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQuNSwgMy41LCAxLCAtMC41LCAtMC41LCAtMi41LCAtMy41LCAtMy41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDQuNSwgNC41LCAyLjUsIDAuNSwgLTIsIC00LCAtNSwgLTUuNSwgLTUuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgQmFzcyAmIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMi41LCAtMC41LCAtMy41LCAtMiwgMC41LCA0LCA1LjUsIDYsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIFRyZWJsZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTQuNSwgLTQuNSwgLTQuNSwgLTIsIDEsIDUuNSwgOCwgOCwgOCwgOF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcHRvcCBTcGVha2VycyAvIEhlYWRwaG9uZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDUuNSwgMi41LCAtMS41LCAtMSwgMC41LCAyLCA0LjUsIDYsIDddXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMYXJnZSBIYWxsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjU5OTk5OTkwNDYzMjU2ODQsXG4gICAgICAgIFwiYmFuZHNcIjogWzUsIDUsIDIuNSwgMi41LCAtMC41LCAtMiwgLTIsIC0yLCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGl2ZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi42Mzk5OTk4NjY0ODU1OTU3LFxuICAgICAgICBcImJhbmRzXCI6IFstMiwgLTAuNSwgMiwgMi41LCAyLjUsIDIuNSwgMiwgMSwgMSwgMV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBhcnR5XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzMuNSwgMy41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAtMC41LCAzLjUsIDMuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlBvcFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy4xMTk5OTk4ODU1NTkwODIsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIDIsIDMuNSwgNCwgMi41LCAtMC41LCAtMSwgLTEsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSZWdnYWVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTQuMDc5OTk5OTIzNzA2MDU1LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCAtMC41LCAtMi41LCAtMC41LCAzLCAzLCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUm9ja1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS4wMzk5OTk5NjE4NTMwMjcsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIsIC0yLjUsIC00LCAtMS41LCAyLCA0LCA1LjUsIDUuNSwgNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU2thXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjUxOTk5OTk4MDkyNjUxNCxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTEsIC0yLCAtMiwgLTAuNSwgMiwgMi41LCA0LCA0LjUsIDUuNSwgNC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC43OTk5OTk3MTM4OTc3MDUsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDAuNSwgLTAuNSwgLTEsIC0wLjUsIDIsIDQsIDQuNSwgNS41LCA2XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiU29mdCBSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWzIsIDIsIDEsIC0wLjUsIC0yLCAtMi41LCAtMS41LCAtMC41LCAxLCA0XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiVGVjaG5vXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjgzOTk5OTkxNDE2OTMxMTUsXG4gICAgICAgIFwiYmFuZHNcIjogWzQsIDIuNSwgLTAuNSwgLTIuNSwgLTIsIC0wLjUsIDQsIDQuNSwgNC41LCA0XVxuICAgIH1cbl07XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIEVxdWFsaXplclN0YXRpYyA9IHJlcXVpcmUoJy4vZXF1YWxpemVyLXN0YXRpYycpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JrQvtC90YHRgtGA0YPQutGC0L7RgFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQt9C90LDRh9C10L3QuNGPINGD0YHQuNC70LXQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZCNFVkVOVF9DSEFOR0VcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC90L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtVxuICovXG5cbi8qKlxuICog0J/QvtC70L7RgdCwINC/0YDQvtC/0YPRgdC60LDQvdC40Y8g0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtINC60L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSVxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgLSDRgtC40L8g0YTQuNC70YzRgtGA0LBcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxdWVuY3kgLSDRh9Cw0YHRgtC+0YLQsCDRhNC40LvRjNGC0YDQsFxuICpcbiAqIEBmaXJlcyB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZCNFVkVOVF9DSEFOR0VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplckJhbmQgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQsIHR5cGUsIGZyZXF1ZW5jeSkge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy50eXBlID0gdHlwZTtcblxuICAgIHRoaXMuZmlsdGVyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgIHRoaXMuZmlsdGVyLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuZmlsdGVyLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICB0aGlzLmZpbHRlci5RLnZhbHVlID0gMTtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gMDtcbn07XG5FdmVudHMubWl4aW4oRXF1YWxpemVyQmFuZCk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQo9C/0YDQsNCy0LvQtdC90LjQtSDQvdCw0YHRgtGA0L7QudC60LDQvNC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRh9Cw0YHRgtC+0YLRgyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0RnJlcSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWU7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5nYWluLnZhbHVlO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INGD0YHQuNC70LXQvdC40Y9cbiAqIEBwYXJhbSB2YWx1ZVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcihFcXVhbGl6ZXJTdGF0aWMuRVZFTlRfQ0hBTkdFLCB2YWx1ZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVxdWFsaXplckJhbmQ7XG4iLCIvKipcbiAqIEBuYW1lc3BhY2UgRXF1YWxpemVyU3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRXF1YWxpemVyU3RhdGljID0ge307XG5cblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuRXF1YWxpemVyU3RhdGljLkVWRU5UX0NIQU5HRSA9IFwiY2hhbmdlXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyU3RhdGljO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4uLy4uL2xpYi9kYXRhL21lcmdlJyk7XG5cbnZhciBFcXVhbGl6ZXJTdGF0aWMgPSByZXF1aXJlKCcuL2VxdWFsaXplci1zdGF0aWMnKTtcbnZhciBFcXVhbGl6ZXJCYW5kID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXItYmFuZCcpO1xuXG4vKipcbiAqINCe0L/QuNGB0LDQvdC40LUg0L3QsNGB0YLRgNC+0LXQuiDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyUHJlc2V0XG4gKlxuICogQHByb3BlcnR5IHtTdHJpbmd9IFtpZF0gLSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgCDQvdCw0YHRgtGA0L7QtdC6XG4gKiBAcHJvcGVydHkge051bWJlcn0gcHJlYW1wIC0g0L/RgNC10LTRg9GB0LjQu9C40YLQtdC70YxcbiAqIEBwcm9wZXJ0eSB7QXJyYXkuPE51bWJlcj59IGJhbmRzIC0g0LfQvdCw0YfQtdC90LjRjyDQtNC70Y8g0L/QvtC70L7RgSDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKi9cblxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBldmVudCB5YS5tdXNpYy5BdWRpby5meC5FcXVhbGl6ZXIjRVZFTlRfQ0hBTkdFXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXEgLSDRh9Cw0YHRgtC+0YLQsCDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0g0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKi9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQrdC60LLQsNC70LDQudC30LXRgFxuICogQGFsaWFzIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplclxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtINC60L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSVxuICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gYmFuZHMgLSDRgdC/0LjRgdC+0Log0YfQsNGB0YLQvtGCINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqIEBtaXhlcyBFcXVhbGl6ZXJTdGF0aWNcbiAqXG4gKiBAZmlyZXMgeWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyI0VWRU5UX0NIQU5HRVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCBiYW5kcykge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVhbXAgPSBuZXcgRXF1YWxpemVyQmFuZChhdWRpb0NvbnRleHQsIFwiaGlnaHNoZWxmXCIsIDApO1xuICAgIHRoaXMucHJlYW1wLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIHRoaXMucHJlYW1wKSk7XG5cbiAgICBiYW5kcyA9IGJhbmRzIHx8IEVxdWFsaXplci5ERUZBVUxUX0JBTkRTO1xuXG4gICAgdmFyIHByZXY7XG4gICAgdGhpcy5iYW5kcyA9IGJhbmRzLm1hcChmdW5jdGlvbihmcmVxdWVuY3ksIGlkeCkge1xuICAgICAgICB2YXIgYmFuZCA9IG5ldyBFcXVhbGl6ZXJCYW5kKFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0LFxuXG4gICAgICAgICAgICBpZHggPT0gMCA/ICdsb3dzaGVsZidcbiAgICAgICAgICAgICAgICA6IGlkeCArIDEgPCBiYW5kcy5sZW5ndGggPyBcInBlYWtpbmdcIlxuICAgICAgICAgICAgICAgIDogXCJoaWdoc2hlbGZcIixcblxuICAgICAgICAgICAgZnJlcXVlbmN5XG4gICAgICAgICk7XG4gICAgICAgIGJhbmQub24oXCIqXCIsIHRoaXMuX29uQmFuZEV2ZW50LmJpbmQodGhpcywgYmFuZCkpO1xuXG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgICAgdGhpcy5wcmVhbXAuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJldi5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2ID0gYmFuZDtcbiAgICAgICAgcmV0dXJuIGJhbmQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnByZWFtcC5maWx0ZXI7XG4gICAgdGhpcy5vdXRwdXQgPSB0aGlzLmJhbmRzW3RoaXMuYmFuZHMubGVuZ3RoIC0gMV0uZmlsdGVyO1xufTtcbkV2ZW50cy5taXhpbihFcXVhbGl6ZXIpO1xubWVyZ2UoRXF1YWxpemVyLCBFcXVhbGl6ZXJTdGF0aWMsIHRydWUpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4INC/0L4t0YPQvNC+0LvRh9Cw0L3QuNGOXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J3QsNCx0L7RgCDRh9Cw0YHRgtC+0YIg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsCDQv9GA0LjQvNC10L3Rj9GO0YnQuNC50YHRjyDQv9C+LdGD0LzQvtC70YfQsNC90LjRjlxuICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5ERUZBVUxUX0JBTkRTID0gcmVxdWlyZSgnLi9kZWZhdWx0LmJhbmRzLmpzJyk7XG5cbi8qKlxuICog0J3QsNCx0L7RgCDRgNCw0YHQv9GA0L7RgdGC0YDQsNC90ZHQvdC90YvRhSDQv9GA0LXRgdC10YLQvtCyINGN0LrQstCw0LvQsNC50LfQtdGA0LAg0LTQu9GPINC90LDQsdC+0YDQsCDRh9Cw0YHRgtC+0YIg0L/Qvi3Rg9C80L7Qu9GH0LDQvdC40Y4uXG4gKiBAdHlwZSB7T2JqZWN0LjxTdHJpbmcsIHlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXQ+fVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5ERUZBVUxUX1BSRVNFVFMgPSByZXF1aXJlKCcuL2RlZmF1bHQucHJlc2V0cy5qcycpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNGPINC/0L7Qu9C+0YHRiyDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge0VxdWFsaXplckJhbmR9IGJhbmQgLSDQv9C+0LvQvtGB0LAg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRj1xuICogQHByaXZhdGVcbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5fb25CYW5kRXZlbnQgPSBmdW5jdGlvbihiYW5kLCBldmVudCwgZGF0YSkge1xuICAgIHRoaXMudHJpZ2dlcihldmVudCwgYmFuZC5nZXRGcmVxKCksIGRhdGEpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCX0LDQs9GA0YPQt9C60LAg0Lgg0YHQvtGF0YDQsNC90LXQvdC40LUg0L3QsNGB0YLRgNC+0LXQulxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCX0LDQs9GA0YPQt9C40YLRjCDQvdCw0YHRgtGA0L7QudC60LhcbiAqIEBwYXJhbSB7eWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldH0gcHJlc2V0IC0g0L3QsNGB0YLRgNC+0LnQutC4XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUubG9hZFByZXNldCA9IGZ1bmN0aW9uKHByZXNldCkge1xuICAgIHByZXNldC5iYW5kcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBpZHgpIHtcbiAgICAgICAgdGhpcy5iYW5kc1tpZHhdLnNldFZhbHVlKHZhbHVlKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMucHJlYW1wLnNldFZhbHVlKHByZXNldC5wcmVhbXApO1xufTtcblxuLyoqXG4gKiDQodC+0YXRgNCw0L3QuNGC0Ywg0YLQtdC60YPRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcmV0dXJucyB7eWEubXVzaWMuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldH1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5zYXZlUHJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJlYW1wOiB0aGlzLnByZWFtcC5nZXRWYWx1ZSgpLFxuICAgICAgICBiYW5kczogdGhpcy5iYW5kcy5tYXAoZnVuY3Rpb24oYmFuZCkgeyByZXR1cm4gYmFuZC5nZXRWYWx1ZSgpOyB9KVxuICAgIH07XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JzQsNGC0LXQvNCw0YLQuNC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0Ywg0L/RgNC10LTQv9C+0LvQvtC20LXQvdC40LUgKNGB0LrQvtGA0LXQtSDQstGB0LXQs9C+INC90YPQttC90LAg0LrQsNGA0YLQsCDQstC10YHQvtCyINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YfQsNGB0YLQvtGCINC40LvQuCDQtNCw0LbQtSDQvdC10LrQsNGPINGE0YPQvdC60YbQuNGPKVxuLyoqXG4gKiAqKtCt0LrRgdC/0LXRgNC40LzQtdC90YLQsNC70YzQvdC+KiogLSDQstGL0YfQuNC70Y/QtdGCINC+0L/RgtC40LzQsNC70YzQvdC+0LUg0LfQvdCw0YfQvdC40LUg0L/RgNC10LTRg9GB0LjQu9C10L3QuNGPXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmd1ZXNzUHJlYW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHYgPSAwO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gdGhpcy5iYW5kcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgdiArPSB0aGlzLmJhbmRzW2tdLmdldFZhbHVlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIC12IC8gMjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXF1YWxpemVyO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLm11c2ljLkF1ZGlvLmZ4LkVxdWFsaXplciA9IHJlcXVpcmUoJy4vZXF1YWxpemVyJyk7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEubXVzaWMuQXVkaW8uZnggPSB7fTtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5tdXNpYy5BdWRpby5meC52b2x1bWVMaWIgPSByZXF1aXJlKCcuL3ZvbHVtZS1saWInKTtcbiIsIi8qKlxuICog0JzQtdGC0L7QtNGLINC60L7QvdCy0LXRgNGC0LDRhtC40Lgg0LfQvdCw0YfQtdC90LjQuSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBuYW1lc3BhY2VcbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpby5meC52b2x1bWVMaWJcbiAqL1xudmFyIHZvbHVtZUxpYiA9IHt9O1xuXG4vKipcbiAqINCc0LjQvdC40LzQsNC70YzQvdC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0Lgg0L/RgNC4INC60L7RgtC+0YDQvtC8INC/0YDQvtC40YHRhdC+0LTQuNGCINC+0YLQutC70Y7Rh9C10L3QuNC1INC30LLRg9C60LAuXG4gKiDQntCz0YDQsNC90LjRh9C10L3QuNC1INCyIDAuMDEg0L/QvtC00L7QsdGA0LDQvdC+INGN0LzQv9C40YDQuNGH0LXRgdC60LguXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIuRVBTSUxPTiA9IDAuMDE7XG5cbi8qKlxuICog0JrQvtGN0YTQuNGG0LjQtdC90YIg0LTQu9GPINC/0YDQtdC+0LHRgNCw0LfQvtCy0LDQvdC40Lkg0LPRgNC+0LzQutC+0YHRgtC4INC40Lcg0L7RgtC90L7RgdC40YLQtdC70YzQvdC+0Lkg0YjQutCw0LvRiyDQsiDQtNC10YbQuNCx0LXQu9GLXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHByaXZhdGVcbiAqL1xudm9sdW1lTGliLl9EQkZTX0NPRUYgPSAyMCAvIE1hdGgubG9nKDEwKTtcblxuLyoqXG4gKiDQktGL0YfQuNGB0LvQtdC90LjQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuCDQv9C+INC30L3QsNGH0LXQvdC40Y4g0L3QsCDQu9C+0LPQsNGA0LjRhNC80LjRh9C10YHQutC+0Lkg0YjQutCw0LvQtVxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0g0LfQvdCw0YfQtdC90LjQtSDQvdCwINGI0LrQsNC70LVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbnZvbHVtZUxpYi50b0V4cG9uZW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgdm9sdW1lID0gTWF0aC5wb3codm9sdW1lTGliLkVQU0lMT04sIDEgLSB2YWx1ZSk7XG4gICAgcmV0dXJuIHZvbHVtZSA+IHZvbHVtZUxpYi5FUFNJTE9OID8gdm9sdW1lIDogMDtcbn07XG5cbi8qKlxuICog0JLRi9GH0LjRgdC70LXQvdC40LUg0LfQvdCw0YfQtdC90LjRjyDQv9C+0LvQvtC20LXQvdC40Y8g0L3QsCDQu9C+0LPQsNGA0LjRhNC80LjRh9C10YHQutC+0Lkg0YjQutCw0LvQtSDQv9C+INC30L3QsNGH0LXQvdC40Y4g0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIuZnJvbUV4cG9uZW50ID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgcmV0dXJuIDEgLSBNYXRoLmxvZyhNYXRoLm1heCh2b2x1bWUsIHZvbHVtZUxpYi5FUFNJTE9OKSkgLyBNYXRoLmxvZyh2b2x1bWVMaWIuRVBTSUxPTik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQt9C90LDRh9C10L3QuNGPIGRCRlMg0LjQtyDQvtGC0L3QvtGB0LjRgtC10LvRjNC90L7Qs9C+INC30L3QsNGH0LXQvdC40Y8g0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0L7RgtC90L7RgdC40YLQtdC70YzQvdCw0Y8g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIudG9EQkZTID0gZnVuY3Rpb24odm9sdW1lKSB7XG4gICAgcmV0dXJuIE1hdGgubG9nKHZvbHVtZSkgKiB2b2x1bWVMaWIuX0RCRlNfQ09FRjtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC30L3QsNGH0LXQvdC40Y8g0L7RgtC90L7RgdC40YLQtdC70YzQvdC+0Lkg0LPRgNC+0LzQutC+0YHRgtC4INC40Lcg0LfQvdCw0YfQtdC90LjRjyBkQkZTXG4gKiBAcGFyYW0ge051bWJlcn0gZGJmcyAtINCz0YDQvtC80LrQvtGB0YLRjCDQsiBkQkZTXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG52b2x1bWVMaWIuZnJvbURCRlMgPSBmdW5jdGlvbihkYmZzKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKGRiZnMgLyB2b2x1bWVMaWIuX0RCRlNfQ09FRik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHZvbHVtZUxpYjtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9IVE1MNUxvYWRlcicpO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBQbGF5YmFja0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvcGxheWJhY2stZXJyb3InKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbGliL25vb3AnKTtcblxudmFyIGxvYWRlcklkID0gMTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0LHRkdGA0YLQutCwINC00LvRjyDQvdCw0YLQuNCy0L3QvtCz0L4g0LrQu9Cw0YHRgdCwIEF1ZGlvXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BMQVlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FTkRFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1NUT1BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QQVVTRVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX1BST0dSRVNTXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfTE9BRElOR1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURFRFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0VSUk9SXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNUxvYWRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IGxvYWRlcklkKys7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8qKlxuICAgICAqINCa0L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0YDQsNC30LvQuNGH0L3Ri9GFINC+0LbQuNC00LDQvdC40Lkg0YHQvtCx0YvRgtC40LlcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxTdHJpbmcsIERlZmVycmVkPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZXMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuc3JjID0gXCJcIjtcbiAgICAvKipcbiAgICAgKiDQndCw0LfQvdCw0YfQtdC90L3QsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcblxuICAgIC8qKlxuICAgICAqINCS0YDQtdC80Y8g0L/QvtGB0LvQtdC00L3QtdCz0L4g0L7QsdC90L7QstC70LXQvdC40Y8g0LTQsNC90L3Ri9GFXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMubGFzdFVwZGF0ZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiDQpNC70LDQsyDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuFxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5ub3RMb2FkaW5nID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqINCS0YvRhdC+0LQg0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuXG4gICAgLy8tLS0g0KHQsNGF0LDRgCDQtNC70Y8g0LfQsNGJ0LjRgtGLINC+0YIg0YPRgtC10YfQtdC6INC/0LDQvNGP0YLQuFxuICAgIHRoaXMuX19zdGFydFBsYXkgPSB0aGlzLl9zdGFydFBsYXkuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fcmVzdGFydCA9IHRoaXMuX3Jlc3RhcnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fc3RhcnR1cEF1ZGlvID0gdGhpcy5fc3RhcnR1cEF1ZGlvLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MgPSB0aGlzLl91cGRhdGVQcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcgPSB0aGlzLl9vbk5hdGl2ZUxvYWRpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFbmRlZCA9IHRoaXMuX29uTmF0aXZlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVFcnJvciA9IHRoaXMuX29uTmF0aXZlRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9fb25OYXRpdmVQYXVzZSA9IHRoaXMuX29uTmF0aXZlUGF1c2UuYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX19vbk5hdGl2ZVBsYXkgPSB0aGlzLnRyaWdnZXIuYmluZCh0aGlzLCBBdWRpb1N0YXRpYy5FVkVOVF9QTEFZKTtcblxuICAgIHRoaXMuX2luaXRBdWRpbygpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1TG9hZGVyKTtcblxuLyoqXG4gKiDQmNC90YLQtdGA0LLQsNC7INC+0LHQvdC+0LLQu9C10L3QuNGPINGC0LDQudC80LjQvdCz0L7QsiDRgtGA0LXQutCwXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHByaXZhdGVcbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl91cGRhdGVJbnRlcnZhbCA9IDMwO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGC0LjQstC90YvQtSDRgdC+0LHRi9GC0LjRjyBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZID0gXCJwbGF5XCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQv9Cw0YPQt9GLXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFID0gXCJwYXVzZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40LUg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUgPSBcInRpbWV1cGRhdGVcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINGC0YDQtdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQgPSBcImVuZGVkXCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0RVUkFUSU9OID0gXCJkdXJhdGlvbmNoYW5nZVwiO1xuXG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElORyA9IFwicHJvZ3Jlc3NcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC00L7RgdGC0YPQv9C90L7RgdGC0Lgg0LzQtdGC0LAt0LTQsNC90L3Ri9GFINGC0YDQtdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSA9IFwibG9hZGVkbWV0YWRhdGFcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L3QsNGH0LDRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtVxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZID0gXCJjYW5wbGF5XCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IgPSBcImVycm9yXCI7XG5cbi8qKlxuICog0JfQsNCz0LvRg9GI0LrQsCDQtNC70Y8gX19pbml0TGlzdGVuZXIn0LAg0L3QsCDQstGA0LXQvNGPINC+0LbQuNC00LDQvdC40Y8g0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9kZWZhdWx0SW5pdExpc3RlbmVyID0gZnVuY3Rpb24oKSB7fTtcbkF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXIuc3RlcCA9IFwidXNlclwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INC+0LHQvdC+0LLQu9C10L3QuNGPINGC0LDQudC80LjQvdCz0L7QsiDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fdXBkYXRlUHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudFRpbWUgPSArbmV3IERhdGUoKTtcbiAgICBpZiAoY3VycmVudFRpbWUgLSB0aGlzLmxhc3RVcGRhdGUgPCBBdWRpb0hUTUw1TG9hZGVyLl91cGRhdGVJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0VXBkYXRlID0gY3VycmVudFRpbWU7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Lkg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVMb2FkaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fdXBkYXRlUHJvZ3Jlc3MoKTtcblxuICAgIGlmICh0aGlzLmF1ZGlvLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICB2YXIgbG9hZGVkID0gdGhpcy5hdWRpby5idWZmZXJlZC5lbmQoMCkgLSB0aGlzLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuXG4gICAgICAgIGlmICh0aGlzLm5vdExvYWRpbmcgJiYgbG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLm5vdExvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FESU5HKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsb2FkZWQgPj0gdGhpcy5hdWRpby5kdXJhdGlvbiAtIDAuMSkge1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC+0LrQvtC90YfQsNC90LjRjyDRgtGA0LXQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fb25OYXRpdmVFbmRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VOREVEKTtcbiAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmF1ZGlvLnBhdXNlKCk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0L7QuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7RXZlbnR9IGUgLSDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60LhcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9vbk5hdGl2ZUVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgIGlmICghdGhpcy5zcmMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmF1ZGlvLmVycm9yLmNvZGUgPT0gMikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIk5ldHdvcmsgZXJyb3IuIFJlc3RhcnRpbmcuLi5cIiwgdGhpcy5zcmMpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fcmVzdGFydCgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGVycm9yID0gbmV3IFBsYXliYWNrRXJyb3IodGhpcy5hdWRpby5lcnJvclxuICAgICAgICAgICAgPyBQbGF5YmFja0Vycm9yLmh0bWw1W3RoaXMuYXVkaW8uZXJyb3IuY29kZV1cbiAgICAgICAgICAgIDogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogZSxcbiAgICAgICAgdGhpcy5zcmMpO1xuXG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfRVJST1IsIGVycm9yKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y8g0L/QsNGD0LfRi1xuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX29uTmF0aXZlUGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZW5kZWQpIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BBVVNFKTtcbiAgICB9XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0Lgg0LTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPIEF1ZGlvXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC40YUg0YHQvtCx0YvRgtC40Lkg0LTQu9GPINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2luaXRVc2VyRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbn07XG5cbi8qKlxuICog0JTQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LvRg9GI0LDRgtC10LvQtdC5INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQuNGFINGB0L7QsdGL0YLQuNC5INC00LvRjyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9kZWluaXRVc2VyRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuX19zdGFydHVwQXVkaW8sIHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5fX3N0YXJ0dXBBdWRpbywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0aGlzLl9fc3RhcnR1cEF1ZGlvLCB0cnVlKTtcbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L3QsNGC0LjQstC90YvRhSDRgdC+0LHRi9GC0LjQuSBhdWRpby3RjdC70LXQvNC10L3RgtCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5faW5pdE5hdGl2ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX29uTmF0aXZlUGF1c2UpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QTEFZLCB0aGlzLl9fb25OYXRpdmVQbGF5KTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRU5ERUQsIHRoaXMuX19vbk5hdGl2ZUVuZGVkKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHRoaXMuX191cGRhdGVQcm9ncmVzcyk7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0xPQURJTkcsIHRoaXMuX19vbk5hdGl2ZUxvYWRpbmcpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FUlJPUiwgdGhpcy5fX29uTmF0aXZlRXJyb3IpO1xufTtcblxuLyoqXG4gKiDQlNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0YHQu9GD0YjQsNGC0LXQu9C10Lkg0L3QsNGC0LjQstC90YvRhSDRgdC+0LHRi9GC0LjQuSBhdWRpby3RjdC70LXQvNC10L3RgtCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0TmF0aXZlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BBVVNFLCB0aGlzLl9fb25OYXRpdmVQYXVzZSk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19vbk5hdGl2ZVBsYXkpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9FTkRFRCwgdGhpcy5fX29uTmF0aXZlRW5kZWQpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9USU1FVVBEQVRFLCB0aGlzLl9fdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9EVVJBVElPTiwgdGhpcy5fX3VwZGF0ZVByb2dyZXNzKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElORywgdGhpcy5fX29uTmF0aXZlTG9hZGluZyk7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9fb25OYXRpdmVFcnJvcik7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L7QsdGK0LXQutGC0LAgQXVkaW8g0Lgg0L3QsNC30L3QsNGH0LXQvdC40LUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINGB0L7QsdGL0YLQuNC5XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5faW5pdEF1ZGlvID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9pbml0QXVkaW9cIik7XG5cbiAgICB0aGlzLm11dGVFdmVudHMoKTtcblxuICAgIHRoaXMuYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XG4gICAgdGhpcy5hdWRpby5sb29wID0gZmFsc2U7IC8vIGZvciBJRVxuICAgIHRoaXMuYXVkaW8ucHJlbG9hZCA9IHRoaXMuYXVkaW8uYXV0b2J1ZmZlciA9IFwiYXV0b1wiOyAvLyAxMDAlXG4gICAgdGhpcy5hdWRpby5hdXRvcGxheSA9IGZhbHNlO1xuICAgIHRoaXMuYXVkaW8uc3JjID0gXCJcIjtcblxuICAgIHRoaXMuX2luaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IEF1ZGlvSFRNTDVMb2FkZXIuX2RlZmF1bHRJbml0TGlzdGVuZXI7XG5cbiAgICB0aGlzLl9pbml0TmF0aXZlRXZlbnRzKCk7XG59O1xuXG4vKipcbiAqINCe0YLQutC70Y7Rh9C10L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDRgdC+0LHRi9GC0LjQuSDQuCDRg9C00LDQu9C10L3QuNC1INC+0LHRitC10LrRgtCwIEF1ZGlvXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fZGVpbml0QXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2RlaW5pdEF1ZGlvXCIpO1xuXG4gICAgdGhpcy5tdXRlRXZlbnRzKCk7XG5cbiAgICB0aGlzLl9kZWluaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy5fZGVpbml0TmF0aXZlRXZlbnRzKCk7XG5cbiAgICB0aGlzLmF1ZGlvID0gbnVsbDtcbn07XG5cbi8qKlxuICog0JjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L7QsdGK0LXQutGC0LAgQXVkaW8uINCU0LvRjyDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdCx0YPQtdGC0YHRjyDQu9GO0LHQvtC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtC1INC00LXQudGB0YLQstC40LUuXG4gKlxuICog0KHQvtCy0LXRgNGI0LXQvdC90L4g0Y3Qt9C+0YLQtdGA0LjRh9C90YvQuSDQuCDQvNCw0LPQuNGH0LXRgdC60LjQuSDQvNC10YLQvtC0LiDQlNC70Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwINGC0YDQtdCx0YPQtdGC0YHRjyDQstGL0LfRi9Cy0LDRgtGMINC80LXRgtC+0LQgcGxheSDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1XG4gKiDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPLiDQn9C+0YHQu9C1INGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPINC/0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC+0LHRgNCw0YLQvdC+INC90LAg0L/QsNGD0LfRgywg0YIu0LouINC90LXQutC+0YLQvtGA0YvQtSDQsdGA0LDRg9C30LXRgNGLXG4gKiDQsiDQv9GA0L7RgtC40LLQvdC+0Lwg0YHQu9GD0YfQsNC1INC90LDRh9C40L3QsNGO0YIg0L/RgNC+0LjQs9GA0YvQstCw0YLRjCDRgtGA0LXQuiDQsNCy0YLQvtC80LDRgtC40YfQtdGB0LrQuCDQutCw0Log0YLQvtC70YzQutC+INC+0L0g0LfQsNCz0YDRg9C20LDQtdGC0YHRjy4g0J/RgNC4INGN0YLQvtC8INCyINC90LXQutC+0YLQvtGA0YvRhSDQsdGA0LDRg9C30LXRgNCw0YVcbiAqINC/0L7RgdC70LUg0LLRi9C30L7QstCwINC80LXRgtC+0LTQsCBsb2FkINGB0L7QsdGL0YLQuNC1IHBsYXkg0L3QuNC60L7Qs9C00LAg0L3QtSDQvdCw0YHRgtGD0L/QsNC10YIsINGC0LDQuiDRh9GC0L4g0L/RgNC40YXQvtC00LjRgtGB0Y8g0YHQu9GD0YjQsNGC0Ywg0YHQvtCx0YvRgtC40Y8g0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCw0LTQsNC90L3Ri9GFXG4gKiDQuNC70Lgg0L7RiNC40LHQutC4INC30LDQs9GA0YPQt9C60LggKNC10YHQu9C4IHNyYyDQvdC1INGD0LrQsNC30LDQvSkuINCSINC90LXQutC+0YLQvtGA0YvRhSDQsdGA0LDRg9C30LXRgNCw0YUg0YLQsNC60LbQtSDQvNC+0LbQtdGCINC90LUg0L3QsNGB0YLRg9C/0LjRgtGMINGB0L7QsdGL0YLQuNC1IHBhdXNlLiDQn9GA0Lgg0Y3RgtC+0LxcbiAqINGB0YLQvtC40YIg0LXRidGRINGD0YfQuNGC0YvQstCw0YLRjCwg0YfRgtC+INGC0YDQtdC6INC80L7QttC10YIg0LPRgNGD0LfQuNGC0YzRgdGPINC40Lcg0LrQtdGI0LAsINGC0L7Qs9C00LAg0YHQvtCx0YvRgtC40Y8g0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCwLdC00LDQvdC90YvRhSDQuCDQstC+0LfQvNC+0LbQvdC+0YHRgtC4XG4gKiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8g0LzQvtCz0YPRgiDQstC+0LfQvdC40LrQvdGD0YLRjCDQsdGL0YHRgtGA0LXQtSDRgdC+0LHRi9GC0LjRjyBwbGF5INC40LvQuCBwYXVzZSwg0YLQsNC6INGH0YLQviDQvdGD0LbQvdC+INC/0YDQtdC00YPRgdC80LDRgtGA0LjQstCw0YLRjCDQv9GA0LXRgNGL0LLQsNC90LjQtSDQv9GA0L7RhtC10YHRgdCwXG4gKiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydHVwQXVkaW8gPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9zdGFydHVwQXVkaW9cIik7XG5cbiAgICB0aGlzLl9kZWluaXRVc2VyRXZlbnRzKCk7XG5cbiAgICAvL0lORk86INC/0L7RgdC70LUg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40L7QvdC90L7Qs9C+INCy0YvQt9C+0LLQsCBwbGF5INC90YPQttC90L4g0LTQvtC20LTQsNGC0YzRgdGPINGB0L7QsdGL0YLQuNGPINC4INCy0YvQt9Cy0LDRgtGMIHBhdXNlLlxuICAgIHRoaXMuX19pbml0TGlzdGVuZXIgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmICghdGhpcy5fX2luaXRMaXN0ZW5lcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgICAgICAvL0lORk86INC/0L7RgdC70LUg0LLRi9C30L7QstCwIHBhdXNlINC90YPQttC90L4g0LTQvtC20LTQsNGC0YzRgdGPINGB0L7QsdGL0YLQuNGPLCDQt9Cw0LLQtdGA0YjQuNGC0Ywg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y4g0Lgg0YDQsNC30YDQtdGI0LjRgtGMINC/0LXRgNC10LTQsNGH0YMg0YHQvtCx0YvRgtC40LlcbiAgICAgICAgdGhpcy5fX2luaXRMaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9faW5pdExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0TGlzdGVuZXI7XG4gICAgICAgICAgICB0aGlzLnVubXV0ZUV2ZW50cygpO1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJfc3RhcnR1cEF1ZGlvOnJlYWR5XCIpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX19pbml0TGlzdGVuZXIuc3RlcCA9IFwicGF1c2VcIjtcblxuICAgICAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUEFVU0UsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgICAgICB0aGlzLmF1ZGlvLnBhdXNlKCk7XG5cbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJfc3RhcnR1cEF1ZGlvOnBsYXlcIiwgZS50eXBlKTtcbiAgICB9LmJpbmQodGhpcyk7XG4gICAgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwID0gXCJwbGF5XCI7XG5cbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfUExBWSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0NBTlBMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9NRVRBLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfRVJST1IsIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuXG4gICAgLy9JTkZPOiDQv9C10YDQtdC0INC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC10Lwg0L7QsdGK0LXQutGCIEF1ZGlvINGC0YDQtdCx0YPQtdGC0YHRjyDQuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0YLRjCwg0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQtSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YzRgdC60L7Qs9C+INGB0L7QsdGL0YLQuNGPXG4gICAgdGhpcy5hdWRpby5sb2FkKCk7XG4gICAgdGhpcy5hdWRpby5wbGF5KCk7XG59O1xuXG4vKipcbiAqINCV0YHQu9C4INC80LXRgtC+0LQgX3N0YXJ0UGxheSDQstGL0LfQstCw0L0g0YDQsNC90YzRiNC1LCDRh9C10Lwg0LfQsNC60L7QvdGH0LjQu9Cw0YHRjCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjywg0L3Rg9C20L3QviDQvtGC0LzQtdC90LjRgtGMINGC0LXQutGD0YnQuNC5INGI0LDQsyDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9icmVha1N0YXJ0dXAgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICB0aGlzLl9kZWluaXRVc2VyRXZlbnRzKCk7XG4gICAgdGhpcy51bm11dGVFdmVudHMoKTtcblxuICAgIGlmICghdGhpcy5fX2luaXRMaXN0ZW5lcikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX1BMQVksIHRoaXMuX19pbml0TGlzdGVuZXIpO1xuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9DQU5QTEFZLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcbiAgICB0aGlzLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG4gICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDVMb2FkZXIuRVZFTlRfTkFUSVZFX0VSUk9SLCB0aGlzLl9faW5pdExpc3RlbmVyKTtcblxuICAgIHRoaXMuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1TG9hZGVyLkVWRU5UX05BVElWRV9QQVVTRSwgdGhpcy5fX2luaXRMaXN0ZW5lcik7XG5cbiAgICBsb2dnZXIud2Fybih0aGlzLCBcIl9zdGFydHVwQXVkaW86aW50ZXJydXB0ZWRcIiwgdGhpcy5fX2luaXRMaXN0ZW5lci5zdGVwLCByZWFzb24pO1xuICAgIGRlbGV0ZSB0aGlzLl9faW5pdExpc3RlbmVyO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCc0LXRgtC+0LTRiyDQvtC20LjQtNCw0L3QuNGPINGA0LDQt9C70LjRh9C90YvRhSDRgdC+0LHRi9GC0LjQuSDQuCDQs9C10L3QtdGA0LDRhtC40Lgg0L7QsdC10YnQsNC90LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCU0L7QttC00LDRgtGM0YHRjyDQvtC/0YDQtdC00LXQu9GR0L3QvdC+0LPQviDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtINC40LzRjyDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNoZWNrIC0g0LzQtdGC0L7QtCDQv9GA0L7QstC10YDQutC4LCDRh9GC0L4g0LzRiyDQvdCw0YXQvtC00LjQvNGB0Y8g0LIg0L3Rg9C20L3QvtC8INGB0L7RgdGC0L7Rj9C90LjQuFxuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gbGlzdGVuIC0g0YHQv9C40YHQvtC6INGB0L7QsdGL0YLQuNC5LCDQv9GA0Lgg0LrQvtGC0L7RgNGL0YUg0LzQvtC20LXRgiDRgdC80LXQvdC40YLRjNGB0Y8g0YHQvtGB0YLQvtGP0L3QuNC1XG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl93YWl0Rm9yID0gZnVuY3Rpb24obmFtZSwgY2hlY2ssIGxpc3Rlbikge1xuICAgIGlmICghdGhpcy5wcm9taXNlc1tuYW1lXSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5wcm9taXNlc1tuYW1lXSA9IGRlZmVycmVkO1xuXG4gICAgICAgIGlmIChjaGVjay5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hlY2suY2FsbCh0aGlzKSkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICB2YXIgY2xlYXJMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3Rlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKGxpc3RlbltpXSwgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdWRpby5hZGRFdmVudExpc3RlbmVyKGxpc3RlbltpXSwgbGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWZlcnJlZC5wcm9taXNlKCkudGhlbihjbGVhckxpc3RlbmVycywgY2xlYXJMaXN0ZW5lcnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucHJvbWlzZXNbbmFtZV0ucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0L7QttC40LTQsNC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0g0LjQvNGPINGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvbiAtINC/0YDQuNGH0LjQvdCwINC+0YLQvNC10L3RiyDQvtC20LjQtNCw0L3QuNGPXG4gKiBAdG9kbyByZWFzb24g0YHQtNC10LvQsNGC0Ywg0L3QsNGB0LvQtdC00L3QuNC60L7QvCDQutC70LDRgdGB0LAgRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9jYW5jZWxXYWl0ID0gZnVuY3Rpb24obmFtZSwgcmVhc29uKSB7XG4gICAgdmFyIHByb21pc2U7XG4gICAgaWYgKHByb21pc2UgPSB0aGlzLnByb21pc2VzW25hbWVdKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnByb21pc2VzW25hbWVdO1xuICAgICAgICBwcm9taXNlLnJlamVjdChyZWFzb24pO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINCy0YHQtdGFINC+0LbQuNC00LDQvdC40LlcbiAqIEBwYXJhbSB7U3RyaW5nfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0L7QttC40LTQsNC90LjRj1xuICogQHRvZG8gcmVhc29uINGB0LTQtdC70LDRgtGMINC90LDRgdC70LXQtNC90LjQutC+0Lwg0LrQu9Cw0YHRgdCwIEVycm9yXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5fYWJvcnRQcm9taXNlcyA9IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnByb21pc2VzKSB7XG4gICAgICAgIGlmICh0aGlzLnByb21pc2VzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoa2V5LCByZWFzb24pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCe0LbQuNC00LDQvdC40LUg0L/QvtC70YPRh9C10L3QuNGPINC80LXRgtCw0LTQsNC90L3Ri9GFINGC0YDQtdC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0YHQvtCx0YvRgtC40Lkg0L/Qu9C10LXRgNCwINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQvdC+INC+0LbQuNC00LDRgtGMINCz0L7RgtC+0LLQvdC+0YHRgtC4INC80LXRgtCw0LTQsNC90L3Ri9GFXG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1TG9hZGVyLl9wcm9taXNlTWV0YWRhdGFFdmVudHMgPSBbQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTUVUQSwgQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfQ0FOUExBWV07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VNZXRhZGF0YUNoZWNrID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8ucmVhZHlTdGF0ZSA+IHRoaXMuYXVkaW8uSEFWRV9NRVRBREFUQTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQv9C+0LvRg9GH0LXQvdC40Y8g0LzQtdGC0LDQtNCw0L3QvdGL0YVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VNZXRhZGF0YSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl93YWl0Rm9yKFwibWV0YWRhdGFcIiwgdGhpcy5fcHJvbWlzZU1ldGFkYXRhQ2hlY2ssIEF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VNZXRhZGF0YUV2ZW50cyk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQt9Cw0LPRgNGD0LfQutC4INC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0YHQvtCx0YvRgtC40Lkg0L/Qu9C10LXRgNCwINC/0YDQuCDQutC+0YLQvtGA0YvRhSDQvNC+0LbQvdC+INC+0LbQuNC00LDRgtGMINC30LDQs9GA0YPQt9C60LhcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VMb2FkZWRFdmVudHMgPSBbQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfTE9BRElOR107XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INC30LDQs9GA0YPQttC10L3QsCDQvdGD0LbQvdCw0Y8g0YfQsNGB0YLRjCDRgtGA0LXQutCwXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTG9hZGVkQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9fbG9hZGVyVGltZXIgPSB0aGlzLl9fbG9hZGVyVGltZXIgJiYgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkZXJUaW1lcikgfHwgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJsb2FkZWRcIiwgXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9LmJpbmQodGhpcyksIDUwMDApO1xuXG4gICAgLy9JTkZPOiDQv9C+0LfQuNGG0LjRjiDQvdGD0LbQvdC+INCx0YDQsNGC0Ywg0YEg0LHQvtC70YzRiNC40Lwg0LfQsNC/0LDRgdC+0LwsINGCLtC6LiDQtNCw0L3QvdGL0LUg0LfQsNC/0LjRgdCw0L3RiyDQsdC70L7QutCw0LzQuCDQuCDQvdCw0Lwg0L3Rg9C20L3QviDQtNC+0LbQtNCw0YLRjNGB0Y8g0LfQsNCz0YDRg9C30LrQuCDQsdC70L7QutCwXG4gICAgdmFyIGxvYWRlZCA9IE1hdGgubWluKHRoaXMucG9zaXRpb24gKyA0NSwgdGhpcy5hdWRpby5kdXJhdGlvbik7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW8uYnVmZmVyZWQubGVuZ3RoXG4gICAgICAgICYmIHRoaXMuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gdGhpcy5hdWRpby5idWZmZXJlZC5zdGFydCgwKSA+PSBsb2FkZWQ7XG59O1xuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0LfQsNCz0YDRg9C30LrQuCDQvdGD0LbQvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlTG9hZGVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0Rm9yKFwibG9hZGVkXCIsIHRoaXMuX3Byb21pc2VMb2FkZWRDaGVjaywgQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZUxvYWRlZEV2ZW50cyk7XG5cbiAgICBpZiAoIXByb21pc2UuY2xlYW5UaW1lcikge1xuICAgICAgICBwcm9taXNlLmNsZWFuVGltZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuX19sb2FkZXJUaW1lciA9IGNsZWFyVGltZW91dCh0aGlzLl9fbG9hZGVyVGltZXIpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIHByb21pc2UudGhlbihwcm9taXNlLmNsZWFuVGltZXIsIHByb21pc2UuY2xlYW5UaW1lcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J7QttC40LTQsNC90LjQtSDQv9GA0L7QuNCz0YDRi9Cy0LDQvdC40Y8g0L3Rg9C20L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDRgdC+0LHRi9GC0LjQuSDQv9C70LXQtdGA0LAg0L/RgNC4INC60L7RgtC+0YDRi9GFINC80L7QttC90L4g0L7QttC40LTQsNGC0Ywg0L/RgNC+0LjQs9GA0YvQstCw0L3QuNGPINC90YPQttC90L4g0YfQsNGB0YLQuFxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5fcHJvbWlzZVBsYXlpbmdFdmVudHMgPSBbQXVkaW9IVE1MNUxvYWRlci5FVkVOVF9OQVRJVkVfVElNRVVQREFURV07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INC/0YDQvtC40LPRgNGL0LLQsNC10YLRgdGPINC90YPQttC90LDRjyDRh9Cw0YHRgtGMINGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VQbGF5aW5nQ2hlY2sgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGltZSA9IE1hdGgubWluKHRoaXMucG9zaXRpb24gKyAwLjIsIHRoaXMuYXVkaW8uZHVyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmF1ZGlvLmN1cnJlbnRUaW1lID49IHRpbWU7XG59O1xuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0L/RgNC+0LjQs9GA0YvQstCw0L3QuNGPINC90YPQttC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Byb21pc2VQbGF5aW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dhaXRGb3IoXCJwbGF5aW5nXCIsIHRoaXMuX3Byb21pc2VQbGF5aW5nQ2hlY2ssIEF1ZGlvSFRNTDVMb2FkZXIuX3Byb21pc2VQbGF5aW5nRXZlbnRzKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQntC20LjQtNCw0L3QuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQntC20LjQtNCw0L3QuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNCy0LXQtNC10L3QuNGPLCDQv9C10YDQtdC30LDQv9GD0YHQuiDRgtGA0LXQutCwLCDQtdGB0LvQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L3QtSDQvdCw0YfQsNC70L7RgdGMXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9wcm9taXNlU3RhcnRQbGF5aW5nID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLnByb21pc2VzW1wic3RhcnRQbGF5aW5nXCJdKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLnByb21pc2VzW1wic3RhcnRQbGF5aW5nXCJdID0gZGVmZXJyZWQ7XG5cbiAgICAgICAgLy9JTkZPOiDQtdGB0LvQuCDQvtGC0LzQtdC90LXQvdC+INC+0LbQuNC00LDQvdC40LUg0LfQsNCz0YDRg9C30LrQuCDQuNC70Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPLCDRgtC+INC90YPQttC90L4g0L7RgtC80LXQvdC40YLRjCDQuCDRjdGC0L4g0L7QsdC10YnQsNC90LjQtVxuICAgICAgICB2YXIgcmVqZWN0ID0gZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICByZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9jYW5jZWxXYWl0KFwic3RhcnRQbGF5aW5nXCIsIHJlYXNvbik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcblxuICAgICAgICB2YXIgdGltZXI7XG4gICAgICAgIHZhciByZWFkeSA9IGZhbHNlO1xuICAgICAgICB2YXIgY2xlYW5UaW1lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9wcm9taXNlUGxheWluZygpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0YXJ0UGxheWluZzpzdWNjZXNzXCIpO1xuICAgICAgICB9LmJpbmQodGhpcyksIHJlamVjdCk7XG5cbiAgICAgICAgdGhpcy5fcHJvbWlzZUxvYWRlZCgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAocmVhZHkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KFwidGltZW91dFwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW5jZWxXYWl0KFwicGxheWluZ1wiLCBcInRpbWVvdXRcIik7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzdGFydFBsYXlpbmc6ZmFpbGVkXCIpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpLCA1MDAwKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpLCByZWplY3QpO1xuXG4gICAgICAgIHRoaXMuX3Byb21pc2VQbGF5aW5nKCkudGhlbihjbGVhblRpbWVyLCBjbGVhblRpbWVyKTtcbiAgICAgICAgZGVmZXJyZWQucHJvbWlzZSgpLnRoZW4oY2xlYW5UaW1lciwgY2xlYW5UaW1lcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucHJvbWlzZXNbXCJzdGFydFBsYXlpbmdcIl0ucHJvbWlzZSgpO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCj0L/RgNCw0LLQu9C10L3QuNC1INGN0LvQtdC80LXQvdGC0L7QvCBBdWRpb1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCd0LDRh9Cw0YLRjCDQt9Cw0LPRgNGD0LfQutGDINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmNcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJsb2FkXCIsIHNyYyk7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwibG9hZFwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJsb2FkXCIpO1xuXG4gICAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgIHRoaXMubm90TG9hZGluZyA9IHRydWU7XG4gICAgdGhpcy5wb3NpdGlvbiA9IDA7XG5cbiAgICB0aGlzLnNyYyA9IHNyYztcbiAgICB0aGlzLmF1ZGlvLnNyYyA9IHNyYztcbiAgICB0aGlzLmF1ZGlvLmxvYWQoKTtcbn07XG5cbi8qKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInN0b3BcIik7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwic3RvcFwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJzdG9wXCIpO1xuXG4gICAgdGhpcy5sb2FkKFwiXCIpO1xufTtcblxuLyoqXG4gKiDQndCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LBcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLl9zdGFydFBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3N0YXJ0UGxheVwiKTtcblxuICAgIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPSB0aGlzLnBvc2l0aW9uO1xuXG4gICAgaWYgKCF0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2JyZWFrU3RhcnR1cChcInN0YXJ0UGxheVwiKTtcbiAgICB0aGlzLmF1ZGlvLnBsYXkoKTtcblxuICAgIC8vVEhJTks6INC90YPQttC90L4g0LvQuCDRgtGA0LjQs9Cz0LXRgNC40YLRjCDRgdC+0LHRi9GC0LjQtSDQsiDRgdC70YPRh9Cw0LUg0YPRgdC/0LXRhdCwXG4gICAgdGhpcy5fcHJvbWlzZVN0YXJ0UGxheWluZygpLnRoZW4obm9vcCwgdGhpcy5fX3Jlc3RhcnQpO1xufTtcblxuLyoqXG4gKiDQn9C10YDQtdC30LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IFtyZWFzb25dIC0g0LXRgdC70Lgg0L/RgNC40YfQuNC90LAg0LLRi9C30L7QstCwINGD0LrQsNC30LDQvdCwINC4INC90LUg0YDQsNCy0L3QsCBcInRpbWVvdXRcIiDQvdC40YfQtdCz0L4g0L3QtSDQv9GA0L7QuNGB0YXQvtC00LjRglxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX3Jlc3RhcnQgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvL1RISU5LOiDQvdGD0LbQtdC9INC70Lgg0YLRg9GCINC60LDQutC+0Lkt0YLQviDRgdGH0ZHRgtC40Log0LrQvtC70LjRh9C10YHRgtCy0LAg0L/QvtC/0YvRgtC+0LpcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9yZXN0YXJ0XCIsIHJlYXNvbiwgdGhpcy5wb3NpdGlvbiwgdGhpcy5wbGF5aW5nKTtcblxuICAgIGlmIChyZWFzb24gJiYgcmVhc29uICE9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9JTkZPOiDQl9Cw0L/QvtC80LjQvdCw0LXQvCDRgtC10LrRg9GJ0LXQtSDRgdC+0YHRgtC+0Y/QvdC40LUsINGCLtC6LiDQvtC90L4g0YHQsdGA0L7RgdC40YLRgdGPINC/0L7RgdC70LUg0L/QtdGA0LXQt9Cw0LPRgNGD0LfQutC4XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbjtcbiAgICB2YXIgcGxheWluZyA9IHRoaXMucGxheWluZztcblxuICAgIHRoaXMubG9hZCh0aGlzLnNyYyk7XG5cbiAgICBpZiAocGxheWluZykge1xuICAgICAgICB0aGlzLnBsYXkocG9zaXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgIH1cbn07XG5cbi8qKlxuICog0JLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INGC0YDQtdC60LAv0L7RgtC80LXQvdCwINC/0LDRg9C30YtcbiAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJwbGF5XCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2JyZWFrU3RhcnR1cChcInBsYXlcIik7XG5cbiAgICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb24gPT0gbnVsbCA/IHRoaXMucG9zaXRpb24gfHwgMCA6IHBvc2l0aW9uO1xuICAgIHRoaXMuX3Byb21pc2VNZXRhZGF0YSgpLnRoZW4odGhpcy5fX3N0YXJ0UGxheSwgbm9vcCk7XG59O1xuXG4vKiog0J/QsNGD0LfQsCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbmNlbFdhaXQoXCJzdGFydFBsYXlpbmdcIiwgXCJwYXVzZVwiKTtcbiAgICB0aGlzLl9icmVha1N0YXJ0dXAoXCJwYXVzZVwiKTtcblxuICAgIHRoaXMuYXVkaW8ucGF1c2UoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5hdWRpby5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAoIWlzRmluaXRlKHBvc2l0aW9uKSkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInNldFBvc2l0aW9uRmFpbGVkXCIsIHBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcblxuICAgIHRoaXMuX3Byb21pc2VNZXRhZGF0YSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYXVkaW8uY3VycmVudFRpbWUgPSB0aGlzLnBvc2l0aW9uO1xuICAgIH0uYmluZCh0aGlzKSwgbm9vcCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC00LrQu9GO0YfQtdC90LjQtS/QvtGC0LrQu9GO0YfQtdC90LjQtSDQuNGB0YLQvtGH0L3QuNC60LAg0LTQu9GPIFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JLQutC70Y7Rh9C40YLRjCDRgNC10LbQuNC8IGNyb3NzRG9tYWluINC00LvRjyBIVE1MNSDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQstC60LvRjtGH0LjRgtGML9Cy0YvQutC70Y7Rh9C40YLRjFxuICovXG5BdWRpb0hUTUw1TG9hZGVyLnByb3RvdHlwZS50b2dnbGVDcm9zc0RvbWFpbiA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYXVkaW8ucmVtb3ZlQXR0cmlidXRlKFwiY3Jvc3NPcmlnaW5cIik7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVzdGFydCgpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQuNGB0YLQvtGH0L3QuNC6INC00LvRjyBXZWIgQXVkaW8gQVBJXG4gKiAhISHQktC90LjQvNCw0L3QuNC1ISEhIC0g0L/RgNC4INC40YHQv9C+0LvRjNC30L7QstCw0L3QuNC4IFdlYiBBdWRpbyBBUEkg0LIg0LHRgNCw0YPQt9C10YDQtSDRgdGC0L7QuNGCINGD0YfQuNGC0YvQstCw0YLRjCwg0YfRgtC+INCy0YHQtSDRgtGA0LXQutC4INC00L7Qu9C20L3RiyDQu9C40LHQviDQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiDRgSDRgtC+0LPQviDQttC1INC00L7QvNC10L3QsCwg0LvQuNCx0L4g0LTQu9GPINC90LjRhSDQtNC+0LvQttC90Ysg0LHRi9GC0Ywg0L/RgNCw0LLQuNC70YzQvdC+INCy0YvRgdGC0LDQstC70LXQvdGLINC30LDQs9C+0LvQvtCy0LrQuCBDT1JTLlxuICog0J/RgNC4INCy0YvQt9C+0LLQtSDQtNCw0L3QvdC+0LPQviDQvNC10YLQvtC00LAg0YLRgNC10Log0LHRg9C00LXRgiDQv9C10YDQtdC30LDQv9GD0YnQtdC9XG4gKiBAcGFyYW0ge0F1ZGlvQ29udGV4dH0gYXVkaW9Db250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiBXZWIgQXVkaW8gQVBJXG4gKi9cbkF1ZGlvSFRNTDVMb2FkZXIucHJvdG90eXBlLmNyZWF0ZVNvdXJjZSA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCkge1xuICAgIGlmICh0aGlzLm91dHB1dCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVNvdXJjZVwiKTtcblxuICAgIHZhciBuZWVkUmVzdGFydCA9ICF0aGlzLmF1ZGlvLmNyb3NzT3JpZ2luO1xuXG4gICAgdGhpcy5hdWRpby5jcm9zc09yaWdpbiA9IFwiYW5vbnltb3VzXCI7XG4gICAgdGhpcy5vdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFFbGVtZW50U291cmNlKHRoaXMuYXVkaW8pO1xuICAgIHRoaXMub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgIGlmIChuZWVkUmVzdGFydCkge1xuICAgICAgICB0aGlzLl9yZXN0YXJ0KCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQo9C00LDQu9C40YLRjCDQuNGB0YLQvtGH0L3QuNC6INC00LvRjyBXZWIgQXVkaW8gQVBJLiDQo9C00LDQu9GP0LXRgiDQuNGB0YLQvtGH0L3QuNC6LCDQv9C10YDQtdGB0L7Qt9C00LDRkdGCINC+0LHRitC10LrRgiBBdWRpby5cbiAqICEhIdCS0L3QuNC80LDQvdC40LUhISEgLSDQlNCw0L3QvdGL0Lkg0LzQtdGC0L7QtCDQvNC+0LbQvdC+INCy0YvQt9GL0LLQsNGC0Ywg0YLQvtC70YzQutC+INCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LUg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GM0YHQutC+0LPQviDRgdC+0LHRi9GC0LjRjywg0YIu0LouINGB0LLQtdC20LXRgdC+0LfQtNCw0L3QvdGL0LlcbiAqINGN0LvQtdC80LXQvdGCIEF1ZGlvINC90YPQttC90L4g0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNGC0YwgLSDQuNC90LDRh9C1INCx0YPQtNC10YIg0L3QtdC00L7RgdGC0YPQv9C90L4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1LiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRjdC70LXQvNC10L3RgtCwXG4gKiBBdWRpbyDQstC+0LfQvNC+0LbQvdCwINGC0L7Qu9GM0LrQviDQsiDQvtCx0YDQsNCx0L7RgtGH0LjQutC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQvtCz0L4g0YHQvtCx0YvRgtC40Y8gKNC60LvQuNC6LCDRgtCw0Yct0YHQvtCx0YvRgtC40LUg0LjQu9C4INC60LvQsNCy0LjQsNGC0YPRgNC90L7QtSDRgdC+0LHRi9GC0LjQtSlcbiAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuZGVzdHJveVNvdXJjZSA9IGZ1bmN0aW9uKCkge1xuICAgIC8vSU5GTzog0LXQtNC40L3RgdGC0LLQtdC90L3Ri9C5INGB0L/QvtGB0L7QsSDQvtGC0L7RgNCy0LDRgtGMIE1lZGlhRWxlbWVudFNvdXJjZSDQvtGCIEF1ZGlvIC0g0YHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDQvtCx0YrQtdC60YIgQXVkaW9cblxuICAgIGlmICghdGhpcy5vdXRwdXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZGVzdHJveVNvdXJjZVwiKTtcblxuICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLm91dHB1dCA9IG51bGw7XG5cbiAgICB0aGlzLl9hYm9ydFByb21pc2VzKFwiZGVzdHJveVwiKTtcblxuICAgIHRoaXMuX2RlaW5pdEF1ZGlvKCk7XG4gICAgdGhpcy5faW5pdEF1ZGlvKCk7XG4gICAgdGhpcy5fc3RhcnR1cEF1ZGlvKCk7XG5cbiAgICB0aGlzLl9yZXN0YXJ0KCk7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQtNCw0LvQtdC90LjQtSDQstGB0LXRhSDQvtCx0YDQsNCx0L7RgtGH0LjQutC+0LIg0Lgg0L7QsdGK0LXQutGC0LAgQXVkaW9cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqINCj0LTQsNC70LXQvdC40LUg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINC4INC+0LHRitC10LrRgtCwIEF1ZGlvLiDQn9C+0YHQu9C1INCy0YvQt9C+0LLQsCDQtNCw0L3QvdC+0LPQviDQvNC10YLQvtC00LAg0Y3RgtC+0YIg0L7QsdGK0LXQutGCINCx0YPQtNC10YIg0L3QtdC70YzQt9GPINC40YHQv9C+0LvRjNC30L7QstCw0YLRjCAqL1xuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJkZXN0cm95XCIpO1xuXG4gICAgaWYgKHRoaXMub3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5vdXRwdXQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX2Fib3J0UHJvbWlzZXMoKTtcbiAgICB0aGlzLl9kZWluaXRBdWRpbygpO1xuXG4gICAgdGhpcy5fX3Jlc3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX19zdGFydFBsYXkgPSBudWxsO1xuICAgIHRoaXMucHJvbWlzZXMgPSBudWxsO1xufTtcblxuQXVkaW9IVE1MNUxvYWRlci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluaXQ6ICEhdGhpcy5fX2luaXRMaXN0ZW5lciAmJiB0aGlzLl9faW5pdExpc3RlbmVyLnN0ZXAsXG4gICAgICAgIHNyYzogdGhpcy5zcmMsXG4gICAgICAgIHBsYXlpbmc6IHRoaXMucGxheWluZyxcbiAgICAgICAgZW5kZWQ6IHRoaXMuZW5kZWQsXG4gICAgICAgIG5vdExvYWRpbmc6IHRoaXMubm90TG9hZGluZyxcbiAgICAgICAgcG9zaXRpb246IHRoaXMucG9zaXRpb25cbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0hUTUw1TG9hZGVyO1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIEF1ZGlvSFRNTDVMb2FkZXIgPSByZXF1aXJlKCcuL2F1ZGlvLWh0bWw1LWxvYWRlcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/RgNC+0LLQtdGA0LrQuCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IEhUTUw1IEF1ZGlvINC4IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0cy5hdmFpbGFibGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCR0LDQt9C+0LLQsNGPINC/0YDQvtCy0LXRgNC60LAg0L/QvtC00LTQtdGA0LbQutC4INCx0YDQsNGD0LfQtdGA0L7QvFxuICAgIHZhciBodG1sNV9hdmFpbGFibGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIC8vc29tZSBicm93c2VycyBkb2Vzbid0IHVuZGVyc3RhbmQgbmV3IEF1ZGlvKClcbiAgICAgICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICAgICAgdmFyIGNhblBsYXkgPSBhdWRpby5jYW5QbGF5VHlwZShcImF1ZGlvL21wZWdcIik7XG4gICAgICAgIGlmICghY2FuUGxheSB8fCBjYW5QbGF5ID09PSAnbm8nKSB7XG5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIHJlYXNvblwiLCBjYW5QbGF5KTtcbiAgICAgICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIGVycm9yXCIsIGUpO1xuICAgICAgICBodG1sNV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBodG1sNV9hdmFpbGFibGUpO1xuICAgIHJldHVybiBodG1sNV9hdmFpbGFibGU7XG59KSgpO1xuXG5pZiAoZGV0ZWN0LnBsYXRmb3JtLm1vYmlsZSB8fCBkZXRlY3QucGxhdGZvcm0udGFibGV0KSB7XG4gICAgYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBhbGxvd2VkIGZvciBtb2JpbGVcIik7XG59IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2ViQXVkaW9BUEkgY29udGV4dCBjcmVhdGVkXCIpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlYkF1ZGlvQVBJIG5vdCBkZXRlY3RlZFwiKTtcbiAgICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogQGNsYXNzZGVzYyDQmtC70LDRgdGBIGh0bWw1INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QTEFZXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfRU5ERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9WT0xVTUVcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9DUkFTSEVEXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfU1dBUFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9TVE9QXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jRVZFTlRfUEFVU0VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9QUk9HUkVTU1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI0VWRU5UX0xPQURJTkdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9MT0FERURcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNFVkVOVF9FUlJPUlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuICAgIHRoaXMub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCAhPT0gQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgICAgIERFViAmJiBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gZmFsc2U7XG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAwO1xuICAgIHRoaXMudm9sdW1lID0gMTtcbiAgICB0aGlzLmxvYWRlcnMgPSBbXTtcblxuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuXG4gICAgdGhpcy5fc2V0QWN0aXZlKDApO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1KTtcbkF1ZGlvSFRNTDUudHlwZSA9IEF1ZGlvSFRNTDUucHJvdG90eXBlLnR5cGUgPSBcImh0bWw1XCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQoNCw0LHQvtGC0LAg0YEg0LfQsNCz0YDRg9C30YfQuNC60LDQvNC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQvtCx0LDQstC40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0LDRg9C00LjQvi3RhNCw0LnQu9C+0LJcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9hZGRMb2FkZXIgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZExvYWRlclwiKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbG9hZGVyID0gbmV3IEF1ZGlvSFRNTDVMb2FkZXIoKTtcbiAgICBsb2FkZXIuaW5kZXggPSB0aGlzLmxvYWRlcnMucHVzaChsb2FkZXIpIC0gMTtcblxuICAgIGxvYWRlci5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IChzZWxmLmxvYWRlcnMubGVuZ3RoICsgbG9hZGVyLmluZGV4IC0gc2VsZi5hY3RpdmVMb2FkZXIpICUgc2VsZi5sb2FkZXJzLmxlbmd0aDtcbiAgICAgICAgc2VsZi50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9hZGVyLmNyZWF0ZVNvdXJjZShhdWRpb0NvbnRleHQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LDQutGC0LjQstC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9zZXRBY3RpdmUgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldEFjdGl2ZVwiLCBvZmZzZXQpO1xuXG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAodGhpcy5hY3RpdmVMb2FkZXIgKyBvZmZzZXQpICUgdGhpcy5sb2FkZXJzLmxlbmd0aDtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgLy9JTkZPOiDQtdGB0LvQuCDRgNC10LvQuNC30L7QstGL0LLQsNGC0Ywg0LrQvtC90YbQtdC/0YbQuNGOINC80L3QvtC20LXRgdGC0LLQsCDQt9Cw0LPRgNGD0LfRh9C40LrQvtCyLCDRgtC+INGN0YLQviDQvdGD0LbQvdC+INC00L7RgNCw0LHQvtGC0LDRgtGMLlxuICAgICAgICB0aGlzLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INC4INC+0YLQv9C40YHQsNGC0Ywg0LXQs9C+INC+0YIg0YHQvtCx0YvRgtC40Lkg0YHRgtCw0YDRgtCwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtBdWRpb31cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9nZXRMb2FkZXIgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcbiAgICByZXR1cm4gdGhpcy5sb2FkZXJzWyh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoXTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LTQutC70Y7Rh9C10L3QuNC1IFdlYiBBdWRpbyBBUElcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICog0JLQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCBDT1JTLiAqKirQktCQ0JbQndCeISoqKiAtINC10YHQu9C4INCy0LrQu9GO0YfQuNGC0Ywg0YDQtdC20LjQvCBDT1JTLCDQsNGD0LTQuNC+INGN0LvQtdC80LXQvdGCINC90LUg0YHQvNC+0LbQtdGCINC30LDQs9GA0YPQttCw0YLRjCDQtNCw0L3QvdGL0LUg0YHQvlxuICog0YHRgtC+0YDQvtC90L3QuNGFINC00L7QvNC10L3QvtCyLCDQtdGB0LvQuCDQsiDQvtGC0LLQtdGC0LUg0L3QtSDQsdGD0LTQtdGCINC/0YDQsNCy0LjQu9GM0L3QvtCz0L4g0LfQsNCz0L7Qu9C+0LLQutCwIEFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbi4g0JXRgdC70Lgg0L3QtSDQv9C70LDQvdC40YDRg9C10YLRgdGPXG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjQtSBXZWIgQXVkaW8gQVBJLCDQvdC1INGB0YLQvtC40YIg0LLQutC70Y7Rh9Cw0YLRjCDRjdGC0L7RgiDRgNC10LbQuNC8LlxuICogQHBhcmFtIHN0YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZUNyb3NzRG9tYWluID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgbG9hZGVyLnRvZ2dsZUNyb3NzRG9tYWluKHN0YXRlKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICpcbiAqICoq0JLQvdC40LzQsNC90LjQtSEqKiAtINC/0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoIWF1ZGlvQ29udGV4dCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRXJyb3JcIiwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSVwiLCBzdGF0ZSk7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSA9PSBzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB0aGlzLnZvbHVtZTtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICAgICAgbG9hZGVyLmF1ZGlvLnZvbHVtZSA9IDE7XG4gICAgICAgICAgICBsb2FkZXIuY3JlYXRlU291cmNlKGF1ZGlvQ29udGV4dCk7XG5cbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5jb25uZWN0KHRoaXMucHJlcHJvY2Vzc29yID8gdGhpcy5wcmVwcm9jZXNzb3IuaW5wdXQgOiB0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5hdWRpb091dHB1dCkge1xuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuYXVkaW9PdXRwdXQ7XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdGhpcy52b2x1bWU7XG5cbiAgICAgICAgICAgIC8vSU5GTzog0L/QvtGB0LvQtSDRgtC+0LPQviDQutCw0Log0LzRiyDQstC60LvRjtGH0LjQu9C4IHdlYkF1ZGlvQVBJINC10LPQviDRg9C20LUg0L3QtdC70YzQt9GPINC/0YDQvtGB0YLQviDRgtCw0Log0LLRi9C60LvRjtGH0LjRgtGMLlxuICAgICAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc3RhdGU7XG59O1xuXG4vKipcbiAqINCf0L7QtNC60LvRjtGH0LXQvdC40LUg0LDRg9C00LjQviDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsC4g0JLRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6INCw0YPQtNC40L4t0Y3Qu9C10LzQtdC90YLRgyDRgyDQutC+0YLQvtGA0L7Qs9C+INCy0YvRgdGC0LDQstC70LXQvdCwXG4gKiAxMDAlINCz0YDQvtC80LrQvtGB0YLRjC4g0JLRi9GF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0LogR2Fpbk5vZGUsINC60L7RgtC+0YDQsNGPINGA0LXQs9GD0LvQuNGA0YPQtdGCINC40YLQvtCz0L7QstGD0Y4g0LPRgNC+0LzQutC+0YHRgtGMXG4gKiBAcGFyYW0ge3lhLm11c2ljLkF1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yfSBwcmVwcm9jZXNzb3IgLSDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YBcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDRgdGC0LDRgtGD0YEg0YPRgdC/0LXRhdCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgaWYgKCF0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JFcnJvclwiLCBwcmVwcm9jZXNzb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3NvciA9PT0gcHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHRoaXMucHJlcHJvY2Vzc29yID0gcHJlcHJvY2Vzc29yO1xuXG4gICAgaWYgKCFwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgbG9hZGVyLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIGxvYWRlci5vdXRwdXQuY29ubmVjdChwcmVwcm9jZXNzb3IuaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgcHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KPQv9GA0LDQstC70LXQvdC40LUg0L/Qu9C10LXRgNC+0LxcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0L7QuNCz0YDQsNGC0Ywg0YLRgNC10LpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlcIiwgc3JjKTtcblxuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoKTtcblxuICAgIGxvYWRlci5sb2FkKHNyYyk7XG4gICAgbG9hZGVyLnBsYXkoMCk7XG59O1xuXG4vKiog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRgyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicGF1c2VcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcigpO1xuICAgIGxvYWRlci5wYXVzZSgpO1xufTtcblxuLyoqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRiyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInJlc3VtZVwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKCk7XG4gICAgbG9hZGVyLnBsYXkoKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic3RvcFwiLCBvZmZzZXQpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0IHx8IDApO1xuICAgIGxvYWRlci5zdG9wKCk7XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1RPUCwgb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcigpLmF1ZGlvLmN1cnJlbnRUaW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcbiAgICB0aGlzLl9nZXRMb2FkZXIoKS5zZXRQb3NpdGlvbihwb3NpdGlvbiAtIDAuMDAxKTsgLy9USElOSzogbGVnYWN5LdC60L7QtC4g0J/QvtC90Y/RgtGMINC90LDRhNC40LMg0YLRg9GCINC90YPQttC10L0gMC4wMDFcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcihvZmZzZXQpLmF1ZGlvLmR1cmF0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIob2Zmc2V0KTtcblxuICAgIGlmIChsb2FkZXIuYXVkaW8uYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBsb2FkZXIuYXVkaW8uYnVmZmVyZWQuZW5kKDApIC0gbG9hZGVyLmF1ZGlvLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG4gICAgdGhpcy52b2x1bWUgPSB2b2x1bWU7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB2b2x1bWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIuYXVkaW8udm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FKTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICBERVYgJiYgbG9nZ2VyLmRlYnVnKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIG9mZnNldCk7XG5cbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuICAgIGxvYWRlci5sb2FkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgcmV0dXJuIGxvYWRlci5zcmMgPT09IHNyYyAmJiAhbG9hZGVyLm5vdExvYWRpbmc7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCk7XG4gICAgcmV0dXJuIGxvYWRlci5zcmMgPT09IHNyYztcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgREVWICYmIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihvZmZzZXQpO1xuXG4gICAgaWYgKCFsb2FkZXIuc3JjKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUob2Zmc2V0KTtcbiAgICBsb2FkZXIucGxheSgpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9C70LXQtdGA0LVcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKG9mZnNldCkuc3JjO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBkZXRlY3Qub25seURldmljZVZvbHVtZTtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQm9C+0LPQuNGA0L7QstCw0L3QuNC1XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IHRoaXMuZ2V0U3JjKDApLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiB0aGlzLmdldFNyYygxKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvSFRNTDU7XG4iLCJ2YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKCcuL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbGliL25ldC9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbG9nZ2VyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC9lcXVhbGl6ZXIvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2Z4L3ZvbHVtZS9leHBvcnQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBZYW5kZXhBdWRpbztcbiIsInZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcblxuLyoqXG4gKiBAY2xhc3NkZXNjINCe0YLQu9C+0LbQtdC90L3QvtC1INC00LXQudGB0YLQstC40LVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIF9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQoNCw0LfRgNC10YjQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Jlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHsqfSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSDQv9C10YDQtdC00LDRgtGMINC+0YjQuNCx0LrRg1xuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG5cbiAgICB2YXIgcHJvbWlzZSA9IF9wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBzZWxmLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBzZWxmLnJlamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7IC8vIERvbid0IHRocm93IGVycm9ycyB0byBjb25zb2xlXG5cbiAgICAvKipcbiAgICAgKiDQktGL0L/QvtC70L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQntGC0LrQu9C+0L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucmVqZWN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcHJvbWlzZVxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcHJvbWlzZTsgfTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQstGL0L/QvtC70L3QtdC90LjRjyDRgdC/0LjRgdC60LAg0L7QsdC10YnQsNC90LjQuVxuICogQHBhcmFtIHsuLi4qfSBhcmdzIC0g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC+0LbQuNC00LDRgtGMXG4gKiBAcmV0dXJucyBBYm9ydGFibGVQcm9taXNlXG4gKi9cbkRlZmVycmVkLndoZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcblxuICAgIHZhciBsaXN0ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHZhciBwZW5kaW5nID0gbGlzdC5sZW5ndGg7XG5cbiAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwZW5kaW5nLS07XG5cbiAgICAgICAgaWYgKHBlbmRpbmcgPD0gMCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgIH0pO1xuICAgIGxpc3QgPSBudWxsO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZS5hYm9ydCA9IGRlZmVycmVkLnJlamVjdDtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmVycmVkO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vZGF0YS9tZXJnZScpO1xuXG52YXIgTElTVEVORVJTX05BTUUgPSBcIl9saXN0ZW5lcnNcIjtcbnZhciBNVVRFX09QVElPTiA9IFwiX211dGVkXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQmtC+0L3RgdGC0YDRg9C60YLQvtGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGB0L/QuNGB0LrQvtCyINGB0LvRg9GI0LDRgtC10LvQtdC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbGlzdGVuZXJzXG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBBcnJheS48RnVuY3Rpb24+Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTElTVEVORVJTX05BTUVdID0ge307XG5cbiAgICAvKiog0KTQu9Cw0LMg0LLQutC70Y7Rh9C10L3QuNGPL9Cy0YvQutC70Y7Rh9C10L3QuNGPINGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbXV0ZXNcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gZmFsc2U7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JLRgdGP0YfQtdGB0LrQuNC5INGB0LDRhdCw0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC60LvQsNGB0YEg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNsYXNzQ29uc3RydWN0b3IgLSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsFxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtLSDRgtC+0YIg0LbQtSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsCwg0YDQsNGB0YjQuNGA0LXQvdC90YvQuSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICovXG5FdmVudHMubWl4aW4gPSBmdW5jdGlvbihjbGFzc0NvbnN0cnVjdG9yKSB7XG4gICAgbWVyZ2UoY2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIEV2ZW50cy5wcm90b3R5cGUsIHRydWUpO1xuICAgIHJldHVybiBjbGFzc0NvbnN0cnVjdG9yO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC+0LHRitC10LrRgiDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtINC+0LHRitC10LrRglxuICogQHJldHVybnMge09iamVjdH0gLS0g0YLQvtGCINC20LUg0L7QsdGK0LXQutGCLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5ldmVudGl6ZSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIG1lcmdlKG9iamVjdCwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgRXZlbnRzLmNhbGwob2JqZWN0KTtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7QtNC/0LjRgdC60LAg0Lgg0L7RgtC/0LjRgdC60LAg0L7RgiDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSA9IFtdO1xuICAgIH1cblxuICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3Nba10gPT09IGNhbGxiYWNrIHx8IGNhbGxiYWNrc1trXS5jYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1LCDQvtGC0L/QuNGB0LDRgtGM0YHRjyDRgdGA0LDQt9GDINC/0L7RgdC70LUg0L/QtdGA0LLQvtCz0L4g0LLQvtC30L3QuNC60L3QvtCy0LXQvdC40Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCB3cmFwcGVyKTtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgd3JhcHBlci5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHNlbGYub24oZXZlbnQsIHdyYXBwZXIpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCe0YLQv9C40YHQsNGC0YzRgdGPINC+0YIg0LLRgdC10YUg0YHQu9GD0YjQsNGC0LXQu9C10Lkg0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLmNsZWFyTGlzdGVuZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXNbTElTVEVORVJTX05BTUVdKSB7XG4gICAgICAgIGlmICh0aGlzW0xJU1RFTkVSU19OQU1FXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1ba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCi0YDQuNCz0LPQtdGAINGB0L7QsdGL0YLQuNC5XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINGB0L7QsdGL0YLQuNC1XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDQuNC80Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7Li4uYXJnc30gYXJncyAtINC/0LDRgNCw0LzQtdGC0YDRiyDQtNC70Y8g0L/QtdGA0LXQtNCw0YfQuCDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvFxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50LCBhcmdzKSB7XG4gICAgaWYgKHRoaXNbTVVURV9PUFRJT05dKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZiAoZXZlbnQgIT09IFwiKlwiKSB7XG4gICAgICAgIEV2ZW50cy5wcm90b3R5cGUudHJpZ2dlci5hcHBseSh0aGlzLCBbXCIqXCIsIGV2ZW50XS5jb25jYXQoYXJncykpO1xuICAgIH1cblxuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSBbXS5jb25jYXQodGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKTtcbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGNhbGxiYWNrcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgY2FsbGJhY2tzW2tdLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQlNC10LvQtdCz0LjRgNC+0LLQsNGC0Ywg0LLRgdC1INGB0L7QsdGL0YLQuNGPINC00YDRg9Cz0L7QvNGDINC00LjRgdC/0LXRgtGH0LXRgNGDINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge0V2ZW50c30gYWNjZXB0b3IgLSDQv9C+0LvRg9GH0LDRgtC10LvRjCDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUucGlwZUV2ZW50cyA9IGZ1bmN0aW9uKGFjY2VwdG9yKSB7XG4gICAgdGhpcy5vbihcIipcIiwgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmJpbmQoYWNjZXB0b3IpKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQktC60LvRjtGH0LXQvdC40LUv0LLRi9C60LvRjtGH0LXQvdC40LUg0YLRgNC40LPQs9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINC30LDQv9GD0YHQuiDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0JLQvtC30L7QsdC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLnVubXV0ZUV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIGRlbGV0ZSB0aGlzW01VVEVfT1BUSU9OXTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuIiwidmFyIHZvdyA9IHJlcXVpcmUoJ3ZvdycpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2Jyb3dzZXIvZGV0ZWN0Jyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIFByb21pc2VcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZXxFUyAyMDE1IFByb21pc2V9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFByb21pc2U7XG5pZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlICE9PSBcImZ1bmN0aW9uXCJcbiAgICB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcImVkZ2VcIiAvLyDQvNC10LvQutC40LUg0LzRj9Cz0LrQuNC1INC60LDQuiDQstGB0LXQs9C00LAg0L3QuNGH0LXQs9C+INC90LUg0YPQvNC10Y7RgiDQtNC10LvQsNGC0Ywg0L/RgNCw0LLQuNC70YzQvdC+XG4pIHtcbiAgICBQcm9taXNlID0gdm93LlByb21pc2U7XG59IGVsc2Uge1xuICAgIFByb21pc2UgPSB3aW5kb3cuUHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0YDQsNC30YDQtdGI0ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVzb2x2ZVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1LCDQutC+0YLQvtGA0YvQvNC4INGA0LDQt9GA0LXRiNC40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0L7RgtC60LvQvtC90ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVqZWN0XG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0L7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTRg9GCINCy0YvQv9C+0LvQvdC10L3RiyDQstGB0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0L7QsdC10YnQsNC90LjRjy5cbiAqIEBtZXRob2QgUHJvbWlzZS5hbGxcbiAqIEBwYXJhbSB7QXJyYXkuPFByb21pc2U+fSBwcm9taXNlcyAtINGB0L/QuNGB0L7QuiDQvtCx0LXRidCw0L3QuNC5XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INCy0YvQv9C+0LvQvdC40YLRgdGPINGC0L7Qs9C00LAsINC60L7Qs9C00LAg0LHRg9C00LXRgiDQstGL0L/QvtC70L3QtdC90L4g0YXQvtGC0Y8g0LHRiyDQvtC00L3QviDQuNC3INC/0LXRgNC10LTQsNC90L3Ri9GFINC+0LHQtdGJ0LDQvdC40LkuXG4gKiBAbWV0aG9kIFByb21pc2UucmFjZVxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YDQsNC30YDQtdGI0LXQvdC40Y8g0Lgg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI3RoZW5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRhdCwXG4gKiBAcGFyYW0ge251bGx8ZnVuY3Rpb259IFtlcnJiYWNrXSAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEBtZXRob2QgUHJvbWlzZSNjYXRjaFxuICogQHBhcmFtIHtmdW5jdGlvbn0gZXJyYmFjayAtICDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LhcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvdC+0LLQvtC1INC+0LHQtdGJ0LDQvdC40LUg0LjQtyDRgNC10LfRg9C70YzRgtCw0YLQvtCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LBcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBBYm9ydGFibGVQcm9taXNlXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0J7QsdC10YnQsNC90LjQtSDRgSDQstC+0LfQvNC+0LbQvdC+0YHRgtGM0Y4g0L7RgtC80LXQvdGLINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC90LjQvCDQtNC10LnRgdGC0LLQuNGPLlxuICogQGNsYXNzIEFib3J0YWJsZVByb21pc2VcbiAqIEBleHRlbmRzIFByb21pc2VcbiAqL1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDQtNC10LnRgdGC0LLQuNGPINGB0LLRj9C30LDQvdC90L7Qs9C+INGBINC+0LHQtdGJ0LDQvdC40LXQvFxuICogQGFic3RyYWN0XG4gKiBAbWV0aG9kIEFib3J0YWJsZVByb21pc2UjYWJvcnRcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0LTQtdC50YHRgtCy0LjRj1xuICovXG4iLCJ2YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbi8qKlxuICog0KHQvtC00LDQvdC40LUg0L7RgtC60LvQvtC90ZHQvdC90L7Qs9C+INC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDQvtC1INC90LUg0L/Qu9GO0ZHRgtGB0Y8g0LIg0LrQvtC90YHQvtC70Ywg0L7RiNC40LHQutC+0LlcbiAqIEBwYXJhbSB7RXJyb3J9IGRhdGEgLSDQv9GA0LjRh9C40L3QsCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbnZhciByZWplY3QgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlamVjdChkYXRhKTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7XG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcbiIsInZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LHRgNCw0YPQt9C10YDQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcndlYmtpdCA9IC8od2Via2l0KVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcnlhYnJvID0gLyh5YWJyb3dzZXIpWyBcXC9dKFtcXHcuXSspLztcbnZhciByb3BlcmEgPSAvKG9wcnxvcGVyYSkoPzouKnZlcnNpb24pP1sgXFwvXShbXFx3Ll0rKS87XG52YXIgcm1zaWUgPSAvKG1zaWUpIChbXFx3Ll0rKS87XG52YXIgcmVkZ2UgPSAvKGVkZ2UpXFwvKFtcXHcuXSspLztcbnZhciBybW96aWxsYSA9IC8obW96aWxsYSkoPzouKj8gcnY6KFtcXHcuXSspKT8vO1xudmFyIHJzYWZhcmkgPSAvXigoPyFjaHJvbWUpLikqdmVyc2lvblxcLyhbXFxkXFx3XFwuXSspLiooc2FmYXJpKS87XG5cbnZhciBtYXRjaCA9IHJzYWZhcmkuZXhlYyh1YSlcbiAgICB8fCByeWFicm8uZXhlYyh1YSlcbiAgICB8fCByZWRnZS5leGVjKHVhKVxuICAgIHx8IHJvcGVyYS5leGVjKHVhKVxuICAgIHx8IHJ3ZWJraXQuZXhlYyh1YSlcbiAgICB8fCBybXNpZS5leGVjKHVhKVxuICAgIHx8IHVhLmluZGV4T2YoXCJjb21wYXRpYmxlXCIpIDwgMCAmJiBybW96aWxsYS5leGVjKHVhKVxuICAgIHx8IFtdO1xuXG52YXIgYnJvd3NlciA9IHtuYW1lOiBtYXRjaFsxXSB8fCBcIlwiLCB2ZXJzaW9uOiBtYXRjaFsyXSB8fCBcIjBcIn07XG5cbmlmIChtYXRjaFszXSA9PT0gXCJzYWZhcmlcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IG1hdGNoWzNdO1xufVxuXG5pZiAoYnJvd3Nlci5uYW1lID09PSAnbXNpZScpIHtcbiAgICBpZiAoZG9jdW1lbnQuZG9jdW1lbnRNb2RlKSB7IC8vIElFOCBvciBsYXRlclxuICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IGRvY3VtZW50LmRvY3VtZW50TW9kZTtcbiAgICB9IGVsc2UgeyAvLyBJRSA1LTdcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSA1OyAvLyBBc3N1bWUgcXVpcmtzIG1vZGUgdW5sZXNzIHByb3ZlbiBvdGhlcndpc2VcbiAgICAgICAgaWYgKGRvY3VtZW50LmNvbXBhdE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlID09PSBcIkNTUzFDb21wYXRcIikge1xuICAgICAgICAgICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNzsgLy8gc3RhbmRhcmRzIG1vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJvcHJcIikge1xuICAgIGJyb3dzZXIubmFtZSA9IFwib3BlcmFcIjtcbn1cblxuLy9JTkZPOiBJRSAo0LrQsNC6INCy0YHQtdCz0LTQsCkg0L3QtSDQutC+0YDRgNC10LrRgtC90L4g0LLRi9GB0YLQsNCy0LvRj9C10YIgdXNlci1hZ2VudFxuaWYgKGJyb3dzZXIubmFtZSA9PT0gXCJtb3ppbGxhXCIgJiYgYnJvd3Nlci52ZXJzaW9uLnNwbGl0KFwiLlwiKVswXSA9PT0gXCIxMVwiKSB7XG4gICAgYnJvd3Nlci5uYW1lID0gXCJtc2llXCI7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0LvQsNGC0YTQvtGA0LzQtVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcnBsYXRmb3JtID0gLyhpcGFkfGlwaG9uZXxpcG9kfGFuZHJvaWR8YmxhY2tiZXJyeXxwbGF5Ym9va3x3aW5kb3dzIGNlfHdlYm9zKS87XG52YXIgcnRhYmxldCA9IC8oaXBhZHxwbGF5Ym9vaykvO1xudmFyIHJhbmRyb2lkID0gLyhhbmRyb2lkKS87XG52YXIgcm1vYmlsZSA9IC8obW9iaWxlKS87XG5cbnBsYXRmb3JtID0gcnBsYXRmb3JtLmV4ZWModWEpIHx8IFtdO1xudmFyIHRhYmxldCA9IHJ0YWJsZXQuZXhlYyh1YSkgfHwgIXJtb2JpbGUuZXhlYyh1YSkgJiYgcmFuZHJvaWQuZXhlYyh1YSkgfHwgW107XG5cbmlmIChwbGF0Zm9ybVsxXSkge1xuICAgIHBsYXRmb3JtWzFdID0gcGxhdGZvcm1bMV0ucmVwbGFjZSgvXFxzL2csIFwiX1wiKTsgLy8gQ2hhbmdlIHdoaXRlc3BhY2UgdG8gdW5kZXJzY29yZS4gRW5hYmxlcyBkb3Qgbm90YXRpb24uXG59XG5cbnZhciBwbGF0Zm9ybSA9IHtcbiAgICB0eXBlOiBwbGF0Zm9ybVsxXSB8fCBcIlwiLFxuICAgIHRhYmxldDogISF0YWJsZXRbMV0sXG4gICAgbW9iaWxlOiBwbGF0Zm9ybVsxXSAmJiAhdGFibGV0WzFdIHx8IGZhbHNlXG59O1xuaWYgKCFwbGF0Zm9ybS50eXBlKSB7XG4gICAgcGxhdGZvcm0udHlwZSA9ICdwYyc7XG59XG5cbnBsYXRmb3JtLm9zID0gcGxhdGZvcm0udHlwZTtcbmlmIChwbGF0Zm9ybS50eXBlID09PSAnaXBhZCcgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwaG9uZScgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwb2QnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnaW9zJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnYW5kcm9pZCc7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJXaW5cIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIndpbmRvd3NcIjtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvd2luW14gXSogKFteO10qKS9pKTtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gcGxhdGZvcm0udmVyc2lvbiAmJiBwbGF0Zm9ybS52ZXJzaW9uWzFdO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJtYWNvc1wiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ1bml4XCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJMaW51eFwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibGludXhcIjtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvNC10L3Rj9GC0Ywg0LPRgNC+0LzQutC+0YHRgtGMXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG52YXIgbm9Wb2x1bWUgPSB0cnVlO1xudHJ5IHtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIGF1ZGlvLnZvbHVtZSA9IDAuNjM7XG4gICAgbm9Wb2x1bWUgPSBNYXRoLmFicyhhdWRpby52b2x1bWUgLSAwLjYzKSA+IDAuMDE7XG59IGNhdGNoKGUpIHtcbiAgICBub1ZvbHVtZSA9IHRydWU7XG59XG5cbi8qKlxuICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L7QsSDQvtC60YDRg9C20LXQvdC40LhcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBkZXRlY3QgPSB7XG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LHRgNCw0YPQt9C10YDQtVxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG5hbWUgLSDQvdCw0LfQstCw0L3QuNC1INCx0YDQsNGD0LfQtdGA0LBcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdmVyc2lvbiAtINCy0LXRgNGB0LjRj1xuICAgICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbZG9jdW1lbnRNb2RlXSAtINCy0LXRgNGB0LjRjyDQtNC+0LrRg9C80LXQvdGC0LBcbiAgICAgKi9cbiAgICBicm93c2VyOiBicm93c2VyLFxuXG4gICAgLyoqXG4gICAgICog0JjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0L/Qu9Cw0YLRhNC+0YDQvNC1XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gb3MgLSDRgtC40L8g0L7Qv9C10YDQsNGG0LjQvtC90L3QvtC5INGB0LjRgdGC0LXQvNGLXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHR5cGUgLSDRgtC40L8g0L/Qu9Cw0YLRhNC+0YDQvNGLXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSB0YWJsZXQgLSDQv9C70LDQvdGI0LXRglxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbW9iaWxlIC0g0LzQvtCx0LjQu9GM0L3Ri9C5XG4gICAgICovXG4gICAgcGxhdGZvcm06IHBsYXRmb3JtLFxuXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINCz0YDQvtC80LrQvtGB0YLQuFxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG9ubHlEZXZpY2VWb2x1bWU6IG5vVm9sdW1lXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRldGVjdDtcbiIsIi8qKlxuICogQGxpY2Vuc2UgU1dGT2JqZWN0IHYyLjIgPGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3QvPlxuICogaXMgcmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlIDxodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocD5cbiAqIEBwcml2YXRlXG4qL1xudmFyIHN3Zm9iamVjdCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgVU5ERUYgPSBcInVuZGVmaW5lZFwiLFxuXHRcdE9CSkVDVCA9IFwib2JqZWN0XCIsXG5cdFx0U0hPQ0tXQVZFX0ZMQVNIID0gXCJTaG9ja3dhdmUgRmxhc2hcIixcblx0XHRTSE9DS1dBVkVfRkxBU0hfQVggPSBcIlNob2Nrd2F2ZUZsYXNoLlNob2Nrd2F2ZUZsYXNoXCIsXG5cdFx0RkxBU0hfTUlNRV9UWVBFID0gXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiLFxuXHRcdEVYUFJFU1NfSU5TVEFMTF9JRCA9IFwiU1dGT2JqZWN0RXhwckluc3RcIixcblx0XHRPTl9SRUFEWV9TVEFURV9DSEFOR0UgPSBcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLFxuXHRcdHdpbiA9IHdpbmRvdyxcblx0XHRkb2MgPSBkb2N1bWVudCxcblx0XHRuYXYgPSBuYXZpZ2F0b3IsXG5cdFx0cGx1Z2luID0gZmFsc2UsXG5cdFx0ZG9tTG9hZEZuQXJyID0gW21haW5dLFxuXHRcdHJlZ09iakFyciA9IFtdLFxuXHRcdG9iaklkQXJyID0gW10sXG5cdFx0bGlzdGVuZXJzQXJyID0gW10sXG5cdFx0c3RvcmVkQWx0Q29udGVudCxcblx0XHRzdG9yZWRBbHRDb250ZW50SWQsXG5cdFx0c3RvcmVkQ2FsbGJhY2tGbixcblx0XHRzdG9yZWRDYWxsYmFja09iaixcblx0XHRpc0RvbUxvYWRlZCA9IGZhbHNlLFxuXHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSBmYWxzZSxcblx0XHRkeW5hbWljU3R5bGVzaGVldCxcblx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhLFxuXHRcdGF1dG9IaWRlU2hvdyA9IHRydWUsXG5cdC8qIENlbnRyYWxpemVkIGZ1bmN0aW9uIGZvciBicm93c2VyIGZlYXR1cmUgZGV0ZWN0aW9uXG5cdFx0LSBVc2VyIGFnZW50IHN0cmluZyBkZXRlY3Rpb24gaXMgb25seSB1c2VkIHdoZW4gbm8gZ29vZCBhbHRlcm5hdGl2ZSBpcyBwb3NzaWJsZVxuXHRcdC0gSXMgZXhlY3V0ZWQgZGlyZWN0bHkgZm9yIG9wdGltYWwgcGVyZm9ybWFuY2Vcblx0Ki9cblx0dWEgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdzNjZG9tID0gdHlwZW9mIGRvYy5nZXRFbGVtZW50QnlJZCAhPSBVTkRFRiAmJiB0eXBlb2YgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lICE9IFVOREVGICYmIHR5cGVvZiBkb2MuY3JlYXRlRWxlbWVudCAhPSBVTkRFRixcblx0XHRcdHUgPSBuYXYudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG5cdFx0XHRwID0gbmF2LnBsYXRmb3JtLnRvTG93ZXJDYXNlKCksXG5cdFx0XHR3aW5kb3dzID0gcCA/IC93aW4vLnRlc3QocCkgOiAvd2luLy50ZXN0KHUpLFxuXHRcdFx0bWFjID0gcCA/IC9tYWMvLnRlc3QocCkgOiAvbWFjLy50ZXN0KHUpLFxuXHRcdFx0d2Via2l0ID0gL3dlYmtpdC8udGVzdCh1KSA/IHBhcnNlRmxvYXQodS5yZXBsYWNlKC9eLip3ZWJraXRcXC8oXFxkKyhcXC5cXGQrKT8pLiokLywgXCIkMVwiKSkgOiBmYWxzZSwgLy8gcmV0dXJucyBlaXRoZXIgdGhlIHdlYmtpdCB2ZXJzaW9uIG9yIGZhbHNlIGlmIG5vdCB3ZWJraXRcblx0XHRcdGllID0gIStcIlxcdjFcIiwgLy8gZmVhdHVyZSBkZXRlY3Rpb24gYmFzZWQgb24gQW5kcmVhIEdpYW1tYXJjaGkncyBzb2x1dGlvbjogaHR0cDovL3dlYnJlZmxlY3Rpb24uYmxvZ3Nwb3QuY29tLzIwMDkvMDEvMzItYnl0ZXMtdG8ta25vdy1pZi15b3VyLWJyb3dzZXItaXMtaWUuaHRtbFxuXHRcdFx0cGxheWVyVmVyc2lvbiA9IFswLDAsMF0sXG5cdFx0XHRkID0gbnVsbDtcblx0XHRpZiAodHlwZW9mIG5hdi5wbHVnaW5zICE9IFVOREVGICYmIHR5cGVvZiBuYXYucGx1Z2luc1tTSE9DS1dBVkVfRkxBU0hdID09IE9CSkVDVCkge1xuXHRcdFx0ZCA9IG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0uZGVzY3JpcHRpb247XG5cdFx0XHRpZiAoZCAmJiAhKHR5cGVvZiBuYXYubWltZVR5cGVzICE9IFVOREVGICYmIG5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXSAmJiAhbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdLmVuYWJsZWRQbHVnaW4pKSB7IC8vIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiXS5lbmFibGVkUGx1Z2luIGluZGljYXRlcyB3aGV0aGVyIHBsdWctaW5zIGFyZSBlbmFibGVkIG9yIGRpc2FibGVkIGluIFNhZmFyaSAzK1xuXHRcdFx0XHRwbHVnaW4gPSB0cnVlO1xuXHRcdFx0XHRpZSA9IGZhbHNlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0ZCA9IGQucmVwbGFjZSgvXi4qXFxzKyhcXFMrXFxzK1xcUyskKS8sIFwiJDFcIik7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMF0gPSBwYXJzZUludChkLnJlcGxhY2UoL14oLiopXFwuLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzFdID0gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipcXC4oLiopXFxzLiokLywgXCIkMVwiKSwgMTApO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzJdID0gL1thLXpBLVpdLy50ZXN0KGQpID8gcGFyc2VJbnQoZC5yZXBsYWNlKC9eLipbYS16QS1aXSsoLiopJC8sIFwiJDFcIiksIDEwKSA6IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4uQWN0aXZlWE9iamVjdCAhPSBVTkRFRikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGEgPSBuZXcgQWN0aXZlWE9iamVjdChTSE9DS1dBVkVfRkxBU0hfQVgpO1xuXHRcdFx0XHRpZiAoYSkgeyAvLyBhIHdpbGwgcmV0dXJuIG51bGwgd2hlbiBBY3RpdmVYIGlzIGRpc2FibGVkXG5cdFx0XHRcdFx0ZCA9IGEuR2V0VmFyaWFibGUoXCIkdmVyc2lvblwiKTtcblx0XHRcdFx0XHRpZiAoZCkge1xuXHRcdFx0XHRcdFx0aWUgPSB0cnVlOyAvLyBjYXNjYWRlZCBmZWF0dXJlIGRldGVjdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHRcdFx0XHRcdGQgPSBkLnNwbGl0KFwiIFwiKVsxXS5zcGxpdChcIixcIik7XG5cdFx0XHRcdFx0XHRwbGF5ZXJWZXJzaW9uID0gW3BhcnNlSW50KGRbMF0sIDEwKSwgcGFyc2VJbnQoZFsxXSwgMTApLCBwYXJzZUludChkWzJdLCAxMCldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2F0Y2goZSkge31cblx0XHR9XG5cdFx0cmV0dXJuIHsgdzM6dzNjZG9tLCBwdjpwbGF5ZXJWZXJzaW9uLCB3azp3ZWJraXQsIGllOmllLCB3aW46d2luZG93cywgbWFjOm1hYyB9O1xuXHR9KCk7XG5cdC8qIENyb3NzLWJyb3dzZXIgb25Eb21Mb2FkXG5cdFx0LSBXaWxsIGZpcmUgYW4gZXZlbnQgYXMgc29vbiBhcyB0aGUgRE9NIG9mIGEgd2ViIHBhZ2UgaXMgbG9hZGVkXG5cdFx0LSBJbnRlcm5ldCBFeHBsb3JlciB3b3JrYXJvdW5kIGJhc2VkIG9uIERpZWdvIFBlcmluaSdzIHNvbHV0aW9uOiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vSUVDb250ZW50TG9hZGVkL1xuXHRcdC0gUmVndWxhciBvbmxvYWQgc2VydmVzIGFzIGZhbGxiYWNrXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAoIXVhLnczKSB7IHJldHVybjsgfVxuXHRcdGlmICgodHlwZW9mIGRvYy5yZWFkeVN0YXRlICE9IFVOREVGICYmIGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikgfHwgKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSA9PSBVTkRFRiAmJiAoZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXSB8fCBkb2MuYm9keSkpKSB7IC8vIGZ1bmN0aW9uIGlzIGZpcmVkIGFmdGVyIG9ubG9hZCwgZS5nLiB3aGVuIHNjcmlwdCBpcyBpbnNlcnRlZCBkeW5hbWljYWxseVxuXHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHR9XG5cdFx0aWYgKCFpc0RvbUxvYWRlZCkge1xuXHRcdFx0aWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgY2FsbERvbUxvYWRGdW5jdGlvbnMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdFx0ZG9jLmF0dGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikge1xuXHRcdFx0XHRcdFx0ZG9jLmRldGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgYXJndW1lbnRzLmNhbGxlZSk7XG5cdFx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICh3aW4gPT0gdG9wKSB7IC8vIGlmIG5vdCBpbnNpZGUgYW4gaWZyYW1lXG5cdFx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRkb2MuZG9jdW1lbnRFbGVtZW50LmRvU2Nyb2xsKFwibGVmdFwiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoKGUpIHtcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAwKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9KSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEud2spIHtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICghL2xvYWRlZHxjb21wbGV0ZS8udGVzdChkb2MucmVhZHlTdGF0ZSkpIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRhZGRMb2FkRXZlbnQoY2FsbERvbUxvYWRGdW5jdGlvbnMpO1xuXHRcdH1cblx0fSkoKTtcblx0ZnVuY3Rpb24gY2FsbERvbUxvYWRGdW5jdGlvbnMoKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdHRyeSB7IC8vIHRlc3QgaWYgd2UgY2FuIHJlYWxseSBhZGQvcmVtb3ZlIGVsZW1lbnRzIHRvL2Zyb20gdGhlIERPTTsgd2UgZG9uJ3Qgd2FudCB0byBmaXJlIGl0IHRvbyBlYXJseVxuXHRcdFx0dmFyIHQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLmFwcGVuZENoaWxkKGNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTtcblx0XHRcdHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHsgcmV0dXJuOyB9XG5cdFx0aXNEb21Mb2FkZWQgPSB0cnVlO1xuXHRcdHZhciBkbCA9IGRvbUxvYWRGbkFyci5sZW5ndGg7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkbDsgaSsrKSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbaV0oKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWRkRG9tTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7XG5cdFx0XHRmbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvbUxvYWRGbkFycltkb21Mb2FkRm5BcnIubGVuZ3RoXSA9IGZuOyAvLyBBcnJheS5wdXNoKCkgaXMgb25seSBhdmFpbGFibGUgaW4gSUU1LjUrXG5cdFx0fVxuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgb25sb2FkXG5cdFx0LSBCYXNlZCBvbiBKYW1lcyBFZHdhcmRzJyBzb2x1dGlvbjogaHR0cDovL2Jyb3RoZXJjYWtlLmNvbS9zaXRlL3Jlc291cmNlcy9zY3JpcHRzL29ubG9hZC9cblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIGEgd2ViIHBhZ2UgaW5jbHVkaW5nIGFsbCBvZiBpdHMgYXNzZXRzIGFyZSBsb2FkZWRcblx0ICovXG5cdGZ1bmN0aW9uIGFkZExvYWRFdmVudChmbikge1xuXHRcdGlmICh0eXBlb2Ygd2luLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdHdpbi5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLmF0dGFjaEV2ZW50ICE9IFVOREVGKSB7XG5cdFx0XHRhZGRMaXN0ZW5lcih3aW4sIFwib25sb2FkXCIsIGZuKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5vbmxvYWQgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2YXIgZm5PbGQgPSB3aW4ub25sb2FkO1xuXHRcdFx0d2luLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmbk9sZCgpO1xuXHRcdFx0XHRmbigpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR3aW4ub25sb2FkID0gZm47XG5cdFx0fVxuXHR9XG5cdC8qIE1haW4gZnVuY3Rpb25cblx0XHQtIFdpbGwgcHJlZmVyYWJseSBleGVjdXRlIG9uRG9tTG9hZCwgb3RoZXJ3aXNlIG9ubG9hZCAoYXMgYSBmYWxsYmFjaylcblx0Ki9cblx0ZnVuY3Rpb24gbWFpbigpIHtcblx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHR0ZXN0UGxheWVyVmVyc2lvbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogRGV0ZWN0IHRoZSBGbGFzaCBQbGF5ZXIgdmVyc2lvbiBmb3Igbm9uLUludGVybmV0IEV4cGxvcmVyIGJyb3dzZXJzXG5cdFx0LSBEZXRlY3RpbmcgdGhlIHBsdWctaW4gdmVyc2lvbiB2aWEgdGhlIG9iamVjdCBlbGVtZW50IGlzIG1vcmUgcHJlY2lzZSB0aGFuIHVzaW5nIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXRlbSdzIGRlc2NyaXB0aW9uOlxuXHRcdCAgYS4gQm90aCByZWxlYXNlIGFuZCBidWlsZCBudW1iZXJzIGNhbiBiZSBkZXRlY3RlZFxuXHRcdCAgYi4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IGNvcnJ1cHQgaW5zdGFsbGVycyBwcm92aWRlZCBieSBBZG9iZVxuXHRcdCAgYy4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IG11bHRpcGxlIEZsYXNoIFBsYXllciBlbnRyaWVzIGluIHRoZSBwbHVnaW4gQXJyYXksIGNhdXNlZCBieSBpbmNvcnJlY3QgYnJvd3NlciBpbXBvcnRzXG5cdFx0LSBEaXNhZHZhbnRhZ2Ugb2YgdGhpcyBtZXRob2QgaXMgdGhhdCBpdCBkZXBlbmRzIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIERPTSwgd2hpbGUgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpcyBpbW1lZGlhdGVseSBhdmFpbGFibGVcblx0Ki9cblx0ZnVuY3Rpb24gdGVzdFBsYXllclZlcnNpb24oKSB7XG5cdFx0dmFyIGIgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO1xuXHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdHZhciB0ID0gYi5hcHBlbmRDaGlsZChvKTtcblx0XHRpZiAodCkge1xuXHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmICh0eXBlb2YgdC5HZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdHZhciBkID0gdC5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0dWEucHYgPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGNvdW50ZXIgPCAxMCkge1xuXHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yi5yZW1vdmVDaGlsZChvKTtcblx0XHRcdFx0dCA9IG51bGw7XG5cdFx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBQZXJmb3JtIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWF0Y2hpbmc7IHN0YXRpYyBwdWJsaXNoaW5nIG9ubHlcblx0Ki9cblx0ZnVuY3Rpb24gbWF0Y2hWZXJzaW9ucygpIHtcblx0XHR2YXIgcmwgPSByZWdPYmpBcnIubGVuZ3RoO1xuXHRcdGlmIChybCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmw7IGkrKykgeyAvLyBmb3IgZWFjaCByZWdpc3RlcmVkIG9iamVjdCBlbGVtZW50XG5cdFx0XHRcdHZhciBpZCA9IHJlZ09iakFycltpXS5pZDtcblx0XHRcdFx0dmFyIGNiID0gcmVnT2JqQXJyW2ldLmNhbGxiYWNrRm47XG5cdFx0XHRcdHZhciBjYk9iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDppZH07XG5cdFx0XHRcdGlmICh1YS5wdlswXSA+IDApIHtcblx0XHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdFx0XHRcdGlmIChvYmopIHtcblx0XHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHJlZ09iakFycltpXS5zd2ZWZXJzaW9uKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSkgeyAvLyBGbGFzaCBQbGF5ZXIgdmVyc2lvbiA+PSBwdWJsaXNoZWQgU1dGIHZlcnNpb246IEhvdXN0b24sIHdlIGhhdmUgYSBtYXRjaCFcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IGdldE9iamVjdEJ5SWQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZyBpZiBzZXQgYnkgdGhlIHdlYiBwYWdlIGF1dGhvciBhbmQgaWYgc3VwcG9ydGVkXG5cdFx0XHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRcdFx0YXR0LmRhdGEgPSByZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGw7XG5cdFx0XHRcdFx0XHRcdGF0dC53aWR0aCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0YXR0LmhlaWdodCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIHsgYXR0LnN0eWxlY2xhc3MgPSBvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7IH1cblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKSkgeyBhdHQuYWxpZ24gPSBvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIik7IH1cblx0XHRcdFx0XHRcdFx0Ly8gcGFyc2UgSFRNTCBvYmplY3QgcGFyYW0gZWxlbWVudCdzIG5hbWUtdmFsdWUgcGFpcnNcblx0XHRcdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgcCA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcmFtXCIpO1xuXHRcdFx0XHRcdFx0XHR2YXIgcGwgPSBwLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwbDsgaisrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKS50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cGFyW3Bbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKV0gPSBwW2pdLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIGlkLCBjYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHsgLy8gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtaXNtYXRjaCBvciBhbiBvbGRlciBXZWJraXQgZW5naW5lIHRoYXQgaWdub3JlcyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCdzIG5lc3RlZCBwYXJhbSBlbGVtZW50czogZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50IGluc3RlYWQgb2YgU1dGXG5cdFx0XHRcdFx0XHRcdGRpc3BsYXlBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikgeyBjYihjYk9iaik7IH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XHQvLyBpZiBubyBGbGFzaCBQbGF5ZXIgaXMgaW5zdGFsbGVkIG9yIHRoZSBmcCB2ZXJzaW9uIGNhbm5vdCBiZSBkZXRlY3RlZCB3ZSBsZXQgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgZG8gaXRzIGpvYiAoZWl0aGVyIHNob3cgYSBTV0Ygb3IgYWx0ZXJuYXRpdmUgY29udGVudClcblx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdHZhciBvID0gZ2V0T2JqZWN0QnlJZChpZCk7IC8vIHRlc3Qgd2hldGhlciB0aGVyZSBpcyBhbiBIVE1MIG9iamVjdCBlbGVtZW50IG9yIG5vdFxuXHRcdFx0XHRcdFx0aWYgKG8gJiYgdHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IG87XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpIHtcblx0XHR2YXIgciA9IG51bGw7XG5cdFx0dmFyIG8gPSBnZXRFbGVtZW50QnlJZChvYmplY3RJZFN0cik7XG5cdFx0aWYgKG8gJiYgby5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIG4gPSBvLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRcdGlmIChuKSB7XG5cdFx0XHRcdFx0ciA9IG47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0LyogUmVxdWlyZW1lbnRzIGZvciBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHQtIG9ubHkgb25lIGluc3RhbmNlIGNhbiBiZSBhY3RpdmUgYXQgYSB0aW1lXG5cdFx0LSBmcCA2LjAuNjUgb3IgaGlnaGVyXG5cdFx0LSBXaW4vTWFjIE9TIG9ubHlcblx0XHQtIG5vIFdlYmtpdCBlbmdpbmVzIG9sZGVyIHRoYW4gdmVyc2lvbiAzMTJcblx0Ki9cblx0ZnVuY3Rpb24gY2FuRXhwcmVzc0luc3RhbGwoKSB7XG5cdFx0cmV0dXJuICFpc0V4cHJlc3NJbnN0YWxsQWN0aXZlICYmIGhhc1BsYXllclZlcnNpb24oXCI2LjAuNjVcIikgJiYgKHVhLndpbiB8fCB1YS5tYWMpICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpO1xuXHR9XG5cdC8qIFNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2dcblx0XHQtIFJlZmVyZW5jZTogaHR0cDovL3d3dy5hZG9iZS5jb20vY2Z1c2lvbi9rbm93bGVkZ2ViYXNlL2luZGV4LmNmbT9pZD02YTI1M2I3NVxuXHQqL1xuXHRmdW5jdGlvbiBzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gdHJ1ZTtcblx0XHRzdG9yZWRDYWxsYmFja0ZuID0gY2FsbGJhY2tGbiB8fCBudWxsO1xuXHRcdHN0b3JlZENhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRpZiAob2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHsgLy8gc3RhdGljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IGFic3RyYWN0QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIGR5bmFtaWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gb2JqO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSByZXBsYWNlRWxlbUlkU3RyO1xuXHRcdFx0fVxuXHRcdFx0YXR0LmlkID0gRVhQUkVTU19JTlNUQUxMX0lEO1xuXHRcdFx0aWYgKHR5cGVvZiBhdHQud2lkdGggPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LndpZHRoKSAmJiBwYXJzZUludChhdHQud2lkdGgsIDEwKSA8IDMxMCkpIHsgYXR0LndpZHRoID0gXCIzMTBcIjsgfVxuXHRcdFx0aWYgKHR5cGVvZiBhdHQuaGVpZ2h0ID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC5oZWlnaHQpICYmIHBhcnNlSW50KGF0dC5oZWlnaHQsIDEwKSA8IDEzNykpIHsgYXR0LmhlaWdodCA9IFwiMTM3XCI7IH1cblx0XHRcdGRvYy50aXRsZSA9IGRvYy50aXRsZS5zbGljZSgwLCA0NykgKyBcIiAtIEZsYXNoIFBsYXllciBJbnN0YWxsYXRpb25cIjtcblx0XHRcdHZhciBwdCA9IHVhLmllICYmIHVhLndpbiA/IFwiQWN0aXZlWFwiIDogXCJQbHVnSW5cIixcblx0XHRcdFx0ZnYgPSBcIk1NcmVkaXJlY3RVUkw9XCIgKyB3aW4ubG9jYXRpb24udG9TdHJpbmcoKS5yZXBsYWNlKC8mL2csXCIlMjZcIikgKyBcIiZNTXBsYXllclR5cGU9XCIgKyBwdCArIFwiJk1NZG9jdGl0bGU9XCIgKyBkb2MudGl0bGU7XG5cdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGZ2O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBmdjtcblx0XHRcdH1cblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHRcdHZhciBuZXdPYmogPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0XHRyZXBsYWNlRWxlbUlkU3RyICs9IFwiU1dGT2JqZWN0TmV3XCI7XG5cdFx0XHRcdG5ld09iai5zZXRBdHRyaWJ1dGUoXCJpZFwiLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld09iaiwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG9iamVjdCBlbGVtZW50IHRoYXQgbG9hZHMgZXhwcmVzc2luc3RhbGwuc3dmXG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBhYnN0cmFjdCBhbmQgZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGRpc3BsYXlBbHRDb250ZW50KG9iaikge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIGVsKTtcblx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgb2JqKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWJzdHJhY3RBbHRDb250ZW50KG9iaikge1xuXHRcdHZhciBhYyA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0aWYgKHVhLndpbiAmJiB1YS5pZSkge1xuXHRcdFx0YWMuaW5uZXJIVE1MID0gb2JqLmlubmVySFRNTDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgbmVzdGVkT2JqID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRpZiAobmVzdGVkT2JqKSB7XG5cdFx0XHRcdHZhciBjID0gbmVzdGVkT2JqLmNoaWxkTm9kZXM7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0dmFyIGNsID0gYy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjbDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShjW2ldLm5vZGVUeXBlID09IDEgJiYgY1tpXS5ub2RlTmFtZSA9PSBcIlBBUkFNXCIpICYmICEoY1tpXS5ub2RlVHlwZSA9PSA4KSkge1xuXHRcdFx0XHRcdFx0XHRhYy5hcHBlbmRDaGlsZChjW2ldLmNsb25lTm9kZSh0cnVlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBhYztcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgU1dGIGNyZWF0aW9uXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgaWQpIHtcblx0XHR2YXIgciwgZWwgPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKHVhLndrICYmIHVhLndrIDwgMzEyKSB7IHJldHVybiByOyB9XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRpZiAodHlwZW9mIGF0dE9iai5pZCA9PSBVTkRFRikgeyAvLyBpZiBubyAnaWQnIGlzIGRlZmluZWQgZm9yIHRoZSBvYmplY3QgZWxlbWVudCwgaXQgd2lsbCBpbmhlcml0IHRoZSAnaWQnIGZyb20gdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0YXR0T2JqLmlkID0gaWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IC8vIEludGVybmV0IEV4cGxvcmVyICsgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgKyBXM0MgRE9NIG1ldGhvZHMgZG8gbm90IGNvbWJpbmU6IGZhbGwgYmFjayB0byBvdXRlckhUTUxcblx0XHRcdFx0dmFyIGF0dCA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialtpXSAhPSBPYmplY3QucHJvdG90eXBlW2ldKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJkYXRhXCIpIHtcblx0XHRcdFx0XHRcdFx0cGFyT2JqLm1vdmllID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyBjbGFzcz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7XG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnICcgKyBpICsgJz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFyID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW2pdICE9IE9iamVjdC5wcm90b3R5cGVbal0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0cGFyICs9ICc8cGFyYW0gbmFtZT1cIicgKyBqICsgJ1wiIHZhbHVlPVwiJyArIHBhck9ialtqXSArICdcIiAvPic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIicgKyBhdHQgKyAnPicgKyBwYXIgKyAnPC9vYmplY3Q+Jztcblx0XHRcdFx0b2JqSWRBcnJbb2JqSWRBcnIubGVuZ3RoXSA9IGF0dE9iai5pZDsgLy8gc3RvcmVkIHRvIGZpeCBvYmplY3QgJ2xlYWtzJyBvbiB1bmxvYWQgKGR5bmFtaWMgcHVibGlzaGluZyBvbmx5KVxuXHRcdFx0XHRyID0gZ2V0RWxlbWVudEJ5SWQoYXR0T2JqLmlkKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyB3ZWxsLWJlaGF2aW5nIGJyb3dzZXJzXG5cdFx0XHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHRcdFx0Zm9yICh2YXIgbSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW21dICE9IE9iamVjdC5wcm90b3R5cGVbbV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKG0udG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAobS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7IC8vIGZpbHRlciBvdXQgSUUgc3BlY2lmaWMgYXR0cmlidXRlXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKG0sIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAodmFyIG4gaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtuXSAhPSBPYmplY3QucHJvdG90eXBlW25dICYmIG4udG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllcyBhbmQgSUUgc3BlY2lmaWMgcGFyYW0gZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3JlYXRlT2JqUGFyYW0obywgbiwgcGFyT2JqW25dKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobywgZWwpO1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlT2JqUGFyYW0oZWwsIHBOYW1lLCBwVmFsdWUpIHtcblx0XHR2YXIgcCA9IGNyZWF0ZUVsZW1lbnQoXCJwYXJhbVwiKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgcE5hbWUpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcFZhbHVlKTtcblx0XHRlbC5hcHBlbmRDaGlsZChwKTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIFNXRiByZW1vdmFsXG5cdFx0LSBFc3BlY2lhbGx5IG5lZWRlZCB0byBzYWZlbHkgYW5kIGNvbXBsZXRlbHkgcmVtb3ZlIGEgU1dGIGluIEludGVybmV0IEV4cGxvcmVyXG5cdCovXG5cdGZ1bmN0aW9uIHJlbW92ZVNXRihpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaiAmJiBvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0cmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZU9iamVjdEluSUUoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb2JqW2ldID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdG9ialtpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBvcHRpbWl6ZSBKYXZhU2NyaXB0IGNvbXByZXNzaW9uXG5cdCovXG5cdGZ1bmN0aW9uIGdldEVsZW1lbnRCeUlkKGlkKSB7XG5cdFx0dmFyIGVsID0gbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0ZWwgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge31cblx0XHRyZXR1cm4gZWw7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRWxlbWVudChlbCkge1xuXHRcdHJldHVybiBkb2MuY3JlYXRlRWxlbWVudChlbCk7XG5cdH1cblx0LyogVXBkYXRlZCBhdHRhY2hFdmVudCBmdW5jdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHQtIFN0b3JlcyBhdHRhY2hFdmVudCBpbmZvcm1hdGlvbiBpbiBhbiBBcnJheSwgc28gb24gdW5sb2FkIHRoZSBkZXRhY2hFdmVudCBmdW5jdGlvbnMgY2FuIGJlIGNhbGxlZCB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0Ki9cblx0ZnVuY3Rpb24gYWRkTGlzdGVuZXIodGFyZ2V0LCBldmVudFR5cGUsIGZuKSB7XG5cdFx0dGFyZ2V0LmF0dGFjaEV2ZW50KGV2ZW50VHlwZSwgZm4pO1xuXHRcdGxpc3RlbmVyc0FycltsaXN0ZW5lcnNBcnIubGVuZ3RoXSA9IFt0YXJnZXQsIGV2ZW50VHlwZSwgZm5dO1xuXHR9XG5cdC8qIEZsYXNoIFBsYXllciBhbmQgU1dGIGNvbnRlbnQgdmVyc2lvbiBtYXRjaGluZ1xuXHQqL1xuXHRmdW5jdGlvbiBoYXNQbGF5ZXJWZXJzaW9uKHJ2KSB7XG5cdFx0dmFyIHB2ID0gdWEucHYsIHYgPSBydi5zcGxpdChcIi5cIik7XG5cdFx0dlswXSA9IHBhcnNlSW50KHZbMF0sIDEwKTtcblx0XHR2WzFdID0gcGFyc2VJbnQodlsxXSwgMTApIHx8IDA7IC8vIHN1cHBvcnRzIHNob3J0IG5vdGF0aW9uLCBlLmcuIFwiOVwiIGluc3RlYWQgb2YgXCI5LjAuMFwiXG5cdFx0dlsyXSA9IHBhcnNlSW50KHZbMl0sIDEwKSB8fCAwO1xuXHRcdHJldHVybiAocHZbMF0gPiB2WzBdIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID4gdlsxXSkgfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPT0gdlsxXSAmJiBwdlsyXSA+PSB2WzJdKSkgPyB0cnVlIDogZmFsc2U7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIENTUyBjcmVhdGlvblxuXHRcdC0gQmFzZWQgb24gQm9iYnkgdmFuIGRlciBTbHVpcycgc29sdXRpb246IGh0dHA6Ly93d3cuYm9iYnl2YW5kZXJzbHVpcy5jb20vYXJ0aWNsZXMvZHluYW1pY0NTUy5waHBcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlQ1NTKHNlbCwgZGVjbCwgbWVkaWEsIG5ld1N0eWxlKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLm1hYykgeyByZXR1cm47IH1cblx0XHR2YXIgaCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XG5cdFx0aWYgKCFoKSB7IHJldHVybjsgfSAvLyB0byBhbHNvIHN1cHBvcnQgYmFkbHkgYXV0aG9yZWQgSFRNTCBwYWdlcyB0aGF0IGxhY2sgYSBoZWFkIGVsZW1lbnRcblx0XHR2YXIgbSA9IChtZWRpYSAmJiB0eXBlb2YgbWVkaWEgPT0gXCJzdHJpbmdcIikgPyBtZWRpYSA6IFwic2NyZWVuXCI7XG5cdFx0aWYgKG5ld1N0eWxlKSB7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IG51bGw7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFkeW5hbWljU3R5bGVzaGVldCB8fCBkeW5hbWljU3R5bGVzaGVldE1lZGlhICE9IG0pIHtcblx0XHRcdC8vIGNyZWF0ZSBkeW5hbWljIHN0eWxlc2hlZXQgKyBnZXQgYSBnbG9iYWwgcmVmZXJlbmNlIHRvIGl0XG5cdFx0XHR2YXIgcyA9IGNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvY3NzXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJtZWRpYVwiLCBtKTtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gaC5hcHBlbmRDaGlsZChzKTtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgdHlwZW9mIGRvYy5zdHlsZVNoZWV0cyAhPSBVTkRFRiAmJiBkb2Muc3R5bGVTaGVldHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGRvYy5zdHlsZVNoZWV0c1tkb2Muc3R5bGVTaGVldHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbTtcblx0XHR9XG5cdFx0Ly8gYWRkIHN0eWxlIHJ1bGVcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUgPT0gT0JKRUNUKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUoc2VsLCBkZWNsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGRvYy5jcmVhdGVUZXh0Tm9kZSAhPSBVTkRFRikge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlVGV4dE5vZGUoc2VsICsgXCIge1wiICsgZGVjbCArIFwifVwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldFZpc2liaWxpdHkoaWQsIGlzVmlzaWJsZSkge1xuXHRcdGlmICghYXV0b0hpZGVTaG93KSB7IHJldHVybjsgfVxuXHRcdHZhciB2ID0gaXNWaXNpYmxlID8gXCJ2aXNpYmxlXCIgOiBcImhpZGRlblwiO1xuXHRcdGlmIChpc0RvbUxvYWRlZCAmJiBnZXRFbGVtZW50QnlJZChpZCkpIHtcblx0XHRcdGdldEVsZW1lbnRCeUlkKGlkKS5zdHlsZS52aXNpYmlsaXR5ID0gdjtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVDU1MoXCIjXCIgKyBpZCwgXCJ2aXNpYmlsaXR5OlwiICsgdik7XG5cdFx0fVxuXHR9XG5cdC8qIEZpbHRlciB0byBhdm9pZCBYU1MgYXR0YWNrc1xuXHQqL1xuXHRmdW5jdGlvbiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShzKSB7XG5cdFx0dmFyIHJlZ2V4ID0gL1tcXFxcXFxcIjw+XFwuO10vO1xuXHRcdHZhciBoYXNCYWRDaGFycyA9IHJlZ2V4LmV4ZWMocykgIT0gbnVsbDtcblx0XHRyZXR1cm4gaGFzQmFkQ2hhcnMgJiYgdHlwZW9mIGVuY29kZVVSSUNvbXBvbmVudCAhPSBVTkRFRiA/IGVuY29kZVVSSUNvbXBvbmVudChzKSA6IHM7XG5cdH1cblx0LyogUmVsZWFzZSBtZW1vcnkgdG8gYXZvaWQgbWVtb3J5IGxlYWtzIGNhdXNlZCBieSBjbG9zdXJlcywgZml4IGhhbmdpbmcgYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzL05ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3QgKEludGVybmV0IEV4cGxvcmVyIG9ubHkpXG5cdCovXG5cdChmdW5jdGlvbigpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0dmFyIGxsID0gbGlzdGVuZXJzQXJyLmxlbmd0aDtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsbDsgaSsrKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzQXJyW2ldWzBdLmRldGFjaEV2ZW50KGxpc3RlbmVyc0FycltpXVsxXSwgbGlzdGVuZXJzQXJyW2ldWzJdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjbGVhbnVwIGR5bmFtaWNhbGx5IGVtYmVkZGVkIG9iamVjdHMgdG8gZml4IGF1ZGlvL3ZpZGVvIHRocmVhZHMgYW5kIGZvcmNlIG9wZW4gc29ja2V0cyBhbmQgTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdFxuXHRcdFx0XHR2YXIgaWwgPSBvYmpJZEFyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgaWw7IGorKykge1xuXHRcdFx0XHRcdHJlbW92ZVNXRihvYmpJZEFycltqXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBsaWJyYXJ5J3MgbWFpbiBjbG9zdXJlcyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0Zm9yICh2YXIgayBpbiB1YSkge1xuXHRcdFx0XHRcdHVhW2tdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR1YSA9IG51bGw7XG5cdFx0XHRcdGZvciAodmFyIGwgaW4gc3dmb2JqZWN0KSB7XG5cdFx0XHRcdFx0c3dmb2JqZWN0W2xdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2ZvYmplY3QgPSBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KSgpO1xuXHRyZXR1cm4ge1xuXHRcdC8qIFB1YmxpYyBBUElcblx0XHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvZG9jdW1lbnRhdGlvblxuXHRcdCovXG5cdFx0cmVnaXN0ZXJPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdElkU3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIG9iamVjdElkU3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0dmFyIHJlZ09iaiA9IHt9O1xuXHRcdFx0XHRyZWdPYmouaWQgPSBvYmplY3RJZFN0cjtcblx0XHRcdFx0cmVnT2JqLnN3ZlZlcnNpb24gPSBzd2ZWZXJzaW9uU3RyO1xuXHRcdFx0XHRyZWdPYmouZXhwcmVzc0luc3RhbGwgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0cmVnT2JqLmNhbGxiYWNrRm4gPSBjYWxsYmFja0ZuO1xuXHRcdFx0XHRyZWdPYmpBcnJbcmVnT2JqQXJyLmxlbmd0aF0gPSByZWdPYmo7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkob2JqZWN0SWRTdHIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHtcblx0XHRcdFx0Y2FsbGJhY2tGbih7c3VjY2VzczpmYWxzZSwgaWQ6b2JqZWN0SWRTdHJ9KTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGdldE9iamVjdEJ5SWQ6IGZ1bmN0aW9uKG9iamVjdElkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcblx0XHRcdHZhciBjYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHRcdGlmICh1YS53MyAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSAmJiBzd2ZVcmxTdHIgJiYgcmVwbGFjZUVsZW1JZFN0ciAmJiB3aWR0aFN0ciAmJiBoZWlnaHRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIGZhbHNlKTtcblx0XHRcdFx0YWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdpZHRoU3RyICs9IFwiXCI7IC8vIGF1dG8tY29udmVydCB0byBzdHJpbmdcblx0XHRcdFx0XHRoZWlnaHRTdHIgKz0gXCJcIjtcblx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0aWYgKGF0dE9iaiAmJiB0eXBlb2YgYXR0T2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBhdHRPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0YXR0W2ldID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHQuZGF0YSA9IHN3ZlVybFN0cjtcblx0XHRcdFx0XHRhdHQud2lkdGggPSB3aWR0aFN0cjtcblx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gaGVpZ2h0U3RyO1xuXHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRpZiAocGFyT2JqICYmIHR5cGVvZiBwYXJPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIHBhck9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRwYXJbal0gPSBwYXJPYmpbal07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmbGFzaHZhcnNPYmogJiYgdHlwZW9mIGZsYXNodmFyc09iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrIGluIGZsYXNodmFyc09iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgZmxhc2h2YXJzT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihzd2ZWZXJzaW9uU3RyKSkgeyAvLyBjcmVhdGUgU1dGXG5cdFx0XHRcdFx0XHR2YXIgb2JqID0gY3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0XHRcdGlmIChhdHQuaWQgPT0gcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5yZWYgPSBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhpU3dmVXJsU3RyICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHRcdFx0XHRcdGF0dC5kYXRhID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHsgLy8gc2hvdyBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7XHR9XG5cdFx0fSxcblx0XHRzd2l0Y2hPZmZBdXRvSGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuXHRcdFx0YXV0b0hpZGVTaG93ID0gZmFsc2U7XG5cdFx0fSxcblx0XHR1YTogdWEsXG5cdFx0Z2V0Rmxhc2hQbGF5ZXJWZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7IG1ham9yOnVhLnB2WzBdLCBtaW5vcjp1YS5wdlsxXSwgcmVsZWFzZTp1YS5wdlsyXSB9O1xuXHRcdH0sXG5cdFx0aGFzRmxhc2hQbGF5ZXJWZXJzaW9uOiBoYXNQbGF5ZXJWZXJzaW9uLFxuXHRcdGNyZWF0ZVNXRjogZnVuY3Rpb24oYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2hvd0V4cHJlc3NJbnN0YWxsOiBmdW5jdGlvbihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHtcblx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlbW92ZVNXRjogZnVuY3Rpb24ob2JqRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmVtb3ZlU1dGKG9iakVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjcmVhdGVDU1M6IGZ1bmN0aW9uKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdGNyZWF0ZUNTUyhzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWRkRG9tTG9hZEV2ZW50OiBhZGREb21Mb2FkRXZlbnQsXG5cdFx0YWRkTG9hZEV2ZW50OiBhZGRMb2FkRXZlbnQsXG5cdFx0Z2V0UXVlcnlQYXJhbVZhbHVlOiBmdW5jdGlvbihwYXJhbSkge1xuXHRcdFx0dmFyIHEgPSBkb2MubG9jYXRpb24uc2VhcmNoIHx8IGRvYy5sb2NhdGlvbi5oYXNoO1xuXHRcdFx0aWYgKHEpIHtcblx0XHRcdFx0aWYgKC9cXD8vLnRlc3QocSkpIHsgcSA9IHEuc3BsaXQoXCI/XCIpWzFdOyB9IC8vIHN0cmlwIHF1ZXN0aW9uIG1hcmtcblx0XHRcdFx0aWYgKHBhcmFtID09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhaXJzID0gcS5zcGxpdChcIiZcIik7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocGFpcnNbaV0uc3Vic3RyaW5nKDAsIHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpKSA9PSBwYXJhbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHBhaXJzW2ldLnN1YnN0cmluZygocGFpcnNbaV0uaW5kZXhPZihcIj1cIikgKyAxKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fSxcblx0XHQvLyBGb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRcdGV4cHJlc3NJbnN0YWxsQ2FsbGJhY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGlzRXhwcmVzc0luc3RhbGxBY3RpdmUpIHtcblx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKEVYUFJFU1NfSU5TVEFMTF9JRCk7XG5cdFx0XHRcdGlmIChvYmogJiYgc3RvcmVkQWx0Q29udGVudCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdG9yZWRBbHRDb250ZW50LCBvYmopO1xuXHRcdFx0XHRcdGlmIChzdG9yZWRBbHRDb250ZW50SWQpIHtcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoc3RvcmVkQWx0Q29udGVudElkLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgc3RvcmVkQWx0Q29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiOyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9yZWRDYWxsYmFja0ZuKSB7IHN0b3JlZENhbGxiYWNrRm4oc3RvcmVkQ2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0oKTtcbm1vZHVsZS5leHBvcnRzID0gc3dmb2JqZWN0O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQHJldHVybnMge09yaWdpbmFsQ2xhc3N9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY2xlYXJJbnN0YW5jZSA9IGZ1bmN0aW9uKE9yaWdpbmFsQ2xhc3MpIHtcbiAgICB2YXIgQ2xlYXJDbGFzcyA9IGZ1bmN0aW9uKCl7fTtcbiAgICBDbGVhckNsYXNzLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuICAgIHJldHVybiBuZXcgQ2xlYXJDbGFzcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGVhckluc3RhbmNlO1xuIiwidmFyIGNsZWFySW5zdGFuY2UgPSByZXF1aXJlKCcuL2NsZWFyLWluc3RhbmNlJyk7XG5cbi8qKlxuICogQ2xhc3NpYyBFcnJvciBhY3RzIGxpa2UgYSBmYWJyaWM6IEVycm9yLmNhbGwodGhpcywgbWVzc2FnZSkganVzdCBjcmVhdGUgbmV3IG9iamVjdC5cbiAqIEVycm9yQ2xhc3MgYWN0cyBtb3JlIGxpa2UgYSBjbGFzczogRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpIG1vZGlmeSAndGhpcycgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIGVycm9yIG1lc3NhZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBbaWRdIC0gZXJyb3IgaWRcbiAqIEBleHRlbmRzIEVycm9yXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcnJvckNsYXNzID0gZnVuY3Rpb24obWVzc2FnZSwgaWQpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UsIGlkKTtcbiAgICBlcnIubmFtZSA9IHRoaXMubmFtZTtcblxuICAgIHRoaXMubWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIHRoaXMuc3RhY2sgPSBlcnIuc3RhY2s7XG59O1xuXG4vKipcbiAqIFN1Z2FyLiBKdXN0IGNyZWF0ZSBpbmhlcml0YW5jZSBmcm9tIEVycm9yQ2xhc3MgYW5kIGRlZmluZSBuYW1lIHByb3BlcnR5XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIG5hbWUgb2YgZXJyb3IgdHlwZVxuICogQHJldHVybnMge0Vycm9yQ2xhc3N9XG4gKi9cbkVycm9yQ2xhc3MuY3JlYXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBlcnJDbGFzcyA9IGNsZWFySW5zdGFuY2UoRXJyb3JDbGFzcyk7XG4gICAgZXJyQ2xhc3MubmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIGVyckNsYXNzO1xufTtcblxuRXJyb3JDbGFzcy5wcm90b3R5cGUgPSBjbGVhckluc3RhbmNlKEVycm9yKTtcbkVycm9yQ2xhc3MucHJvdG90eXBlLm5hbWUgPSBcIkVycm9yQ2xhc3NcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcnJvckNsYXNzO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2FzeW5jL2V2ZW50cycpO1xuXG4vL1RISU5LOiDQuNC30YPRh9C40YLRjCDQutCw0Log0YDQsNCx0L7RgtCw0LXRgiBFUyAyMDE1IFByb3h5INC4INC/0L7Qv9GA0L7QsdC+0LLQsNGC0Ywg0LjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMXG5cbi8qKlxuICogQGNsYXNzZGVzYyDQn9GA0L7QutGB0Lgt0LrQu9Cw0YHRgS4g0JLRi9C00LDRkdGCINC90LDRgNGD0LbRgyDQu9C40YjRjCDQv9GD0LHQu9C40YfQvdGL0LUg0LzQtdGC0L7QtNGLINC+0LHRitC10LrRgtCwINC4INGB0YLQsNGC0LjRh9C10YHQutC40LUg0YHQstC+0LnRgdGC0LLQsC5cbiAqINCd0LUg0LrQvtC/0LjRgNGD0LXRgiDQvNC10YLQvtC00Ysg0LjQtyBPYmplY3QucHJvdG90eXBlLiDQktGB0LUg0LzQtdGC0L7QtNGLINC40LzQtdGO0YIg0L/RgNC40LLRj9C30LrRgyDQutC+0L3RgtC10LrRgdGC0LAg0Log0L/RgNC+0LrRgdC40YDRg9C10LzQvtC80YMg0L7QsdGK0LXQutGC0YMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIC0g0L7QsdGK0LXQutGCLCDQutC+0YLQvtGA0YvQuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/RgNC+0LrRgdC40YDQvtCy0LDRgtGMXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBQcm94eSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgICAgICB8fCB0eXBlb2Ygb2JqZWN0W2tleV0gIT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgIHx8IG9iamVjdFtrZXldID09PSBPYmplY3QucHJvdG90eXBlW2tleV1cbiAgICAgICAgICAgICAgICB8fCBvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgICAgIHx8IEV2ZW50cy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzW2tleV0gPSBvYmplY3Rba2V5XS5iaW5kKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2JqZWN0LnBpcGVFdmVudHMpIHtcbiAgICAgICAgICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLm9uID0gRXZlbnRzLnByb3RvdHlwZS5vbjtcbiAgICAgICAgICAgIHRoaXMub25jZSA9IEV2ZW50cy5wcm90b3R5cGUub25jZTtcbiAgICAgICAgICAgIHRoaXMub2ZmID0gRXZlbnRzLnByb3RvdHlwZS5vZmY7XG4gICAgICAgICAgICB0aGlzLmNsZWFyTGlzdGVuZXJzID0gRXZlbnRzLnByb3RvdHlwZS5jbGVhckxpc3RlbmVycztcblxuICAgICAgICAgICAgb2JqZWN0LnBpcGVFdmVudHModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCt0LrRgdC/0L7RgNGC0LjRgNGD0LXRgiDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAg0LjQtyDQvtC00L3QvtCz0L4g0L7QsdGK0LXQutGC0LAg0LIg0LTRgNGD0LPQvtC5LCDQuNGB0LrQu9GO0YfQsNGPINGD0LrQsNC30LDQvdC90YvQtSwg0L/RgNC40LLQsNGC0L3Ri9C1INC4INC/0YDQvtGC0L7RgtC40L9cbiAqIEBwYXJhbSB7T2JqZWN0fSBmcm9tIC0g0L7RgtC60YPQtNCwINC60L7Qv9C40YDQvtCy0LDRgtGMXG4gKiBAcGFyYW0ge09iamVjdH0gdG8gLSDQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gW2V4Y2x1ZGVdIC0g0YHQstC+0LnRgdGC0LLQsCDQutC+0YLQvtGA0YvQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjRgdC60LvRjtGH0LjRgtGMXG4gKi9cblByb3h5LmV4cG9ydFN0YXRpYyA9IGZ1bmN0aW9uKGZyb20sIHRvLCBleGNsdWRlKSB7XG4gICAgZXhjbHVkZSA9IGV4Y2x1ZGUgfHwgW107XG5cbiAgICBPYmplY3Qua2V5cyhmcm9tKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBpZiAoIWZyb20uaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgfHwga2V5WzBdID09PSBcIl9cIlxuICAgICAgICAgICAgfHwga2V5ID09PSBcInByb3RvdHlwZVwiXG4gICAgICAgICAgICB8fCBleGNsdWRlLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L/RgNC+0LrRgdC4LdC/0LvQsNGB0YHQsCDQv9GA0LjQstGP0LfQsNC90L3QvtCz0L4g0Log0YPQutCw0LfQsNC90L3QvtC80YMg0LrQu9Cw0YHRgdGDLiDQnNC+0LbQvdC+INC90LDQt9C90LDRh9C40YLRjCDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgS5cbiAqINCjINGA0L7QtNC40YLQtdC70YzRgdC60L7Qs9C+INC60LvQsNGB0YHQsCDQv9C+0Y/QstC70Y/QtdGC0YHRjyDQv9GA0LjQstCw0YLQvdGL0Lkg0LzQtdGC0L7QtCBfcHJveHksINC60L7RgtC+0YDRi9C5INCy0YvQtNCw0ZHRgiDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCINC00LvRj1xuICog0LTQsNC90L3QvtCz0L4g0Y3QutC30LXQvNC70Y/RgNCwLiDQotCw0LrQttC1INC/0L7Rj9Cy0LvRj9C10YLRgdGPINGB0LLQvtC50YHRgtCy0L4gX19wcm94eSwg0YHQvtC00LXRgNC20LDRidC10LUg0YHRgdGL0LvQutGDINC90LAg0YHQvtC30LTQsNC90L3Ri9C5INC/0YDQvtC60YHQuC3QvtCx0YrQtdC60YJcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C5INC60LvQsNGB0YFcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFtQYXJlbnRQcm94eUNsYXNzPVByb3h5XSAtINGA0L7QtNC40YLQtdC70YzRgdC60LjQuSDQutC70LDRgdGBXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IC0tINC60L7QvdGB0YLRgNGD0YLQvtGAINC/0YDQvtC60YHQuNGA0L7QstCw0L3QvdC+0LPQviDQutC70LDRgdGB0LBcbiAqL1xuUHJveHkuY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbihPcmlnaW5hbENsYXNzLCBQYXJlbnRQcm94eUNsYXNzLCBleGNsdWRlU3RhdGljKSB7XG5cbiAgICB2YXIgUHJveHlDbGFzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuXG4gICAgICAgIHZhciBvcmlnaW5hbCA9IG5ldyBPcmlnaW5hbENsYXNzQ29uc3RydWN0b3IoKTtcbiAgICAgICAgT3JpZ2luYWxDbGFzcy5hcHBseShvcmlnaW5hbCwgYXJndW1lbnRzKTtcblxuICAgICAgICByZXR1cm4gb3JpZ2luYWwuX3Byb3h5KCk7XG4gICAgfTtcblxuICAgIHZhciBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IgPSBmdW5jdGlvbigpIHt9O1xuICAgIFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSAoUGFyZW50UHJveHlDbGFzcyB8fCBQcm94eSkucHJvdG90eXBlO1xuICAgIFByb3h5Q2xhc3MucHJvdG90eXBlID0gbmV3IFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3RvcigpO1xuXG4gICAgdmFyIHZhbDtcbiAgICBmb3IgKHZhciBrIGluIE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlKSB7XG4gICAgICAgIHZhbCA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlW2tdO1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZVtrXSA9PSB2YWwgfHwgdHlwZW9mIHZhbCA9PT0gXCJmdW5jdGlvblwiIHx8IGtbMF0gPT09IFwiX1wiKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtrXSA9IHZhbDtcbiAgICB9XG5cbiAgICB2YXIgY3JlYXRlUHJveHkgPSBmdW5jdGlvbihvcmlnaW5hbCkge1xuICAgICAgICB2YXIgcHJvdG8gPSBQcm94eS5wcm90b3R5cGU7XG4gICAgICAgIFByb3h5LnByb3RvdHlwZSA9IFByb3h5Q2xhc3MucHJvdG90eXBlO1xuICAgICAgICB2YXIgcHJveHkgPSBuZXcgUHJveHkob3JpZ2luYWwpO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBwcm90bztcbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgIH07XG5cbiAgICBPcmlnaW5hbENsYXNzLnByb3RvdHlwZS5fcHJveHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9fcHJveHkpIHtcbiAgICAgICAgICAgIHRoaXMuX19wcm94eSA9IGNyZWF0ZVByb3h5KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX19wcm94eTtcbiAgICB9O1xuXG4gICAgaWYgKCFleGNsdWRlU3RhdGljKSB7XG4gICAgICAgIFByb3h5LmV4cG9ydFN0YXRpYyhPcmlnaW5hbENsYXNzLCBQcm94eUNsYXNzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUHJveHlDbGFzcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUHJveHk7XG4iLCIvKipcbiAqINCh0LrQvtC/0LjRgNC+0LLQsNGC0Ywg0YHQstC+0LnRgdGC0LLQsCDQstGB0LXRhSDQv9C10YDQtdGH0LjRgdC70LXQvdC90YvRhSDQvtCx0YrQtdC60YLQvtCyINCyINC+0LTQuNC9LlxuICogQHBhcmFtIHtPYmplY3R9IGluaXRpYWwgLSDQtdGB0LvQuCDQv9C+0YHQu9C10LTQvdC40Lkg0LDRgNCz0YPQvNC10L3RgiB0cnVlLCDRgtC+INC90L7QstGL0Lkg0L7QsdGK0LXQutGCINC90LUg0YHQvtC30LTQsNGR0YLRgdGPLCDQsCDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0LTQsNC90L3Ri9C5XG4gKiBAcGFyYW0gey4uLk9iamVjdHxCb29sZWFufSBhcmdzIC0g0YHQv9C40YHQvtC6INC+0LHRitC10LrRgtC+0LIg0LjQtyDQutC+0YLQvtGA0YvRhSDQutC+0L/QuNGA0L7QstCw0YLRjCDRgdCy0L7QudGB0YLQstCwLiDQn9C+0YHQu9C10LTQvdC40Lkg0LDRgNCz0YPQvNC10L3RgiDQvNC+0LbQtdGCINCx0YvRgtGMINC70LjQsdC+XG4gKiDQvtCx0YrQtdC60YLQvtC8LCDQu9C40LHQviB0cnVlLlxuICogQHJldHVybnMge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnZhciBtZXJnZSA9IGZ1bmN0aW9uIChpbml0aWFsKSB7XG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIga2V5O1xuXG4gICAgaWYgKGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gdHJ1ZSkge1xuICAgICAgICBvYmplY3QgPSBpbml0aWFsO1xuICAgICAgICBhcmdzLnBvcCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdCA9IHt9O1xuICAgICAgICBmb3IgKGtleSBpbiBpbml0aWFsKSB7XG4gICAgICAgICAgICBpZiAoaW5pdGlhbC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBpbml0aWFsW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBrID0gMCwgbCA9IGFyZ3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGZvciAoa2V5IGluIGFyZ3Nba10pIHtcbiAgICAgICAgICAgIGlmIChhcmdzW2tdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IGFyZ3Nba11ba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwicmVxdWlyZSgnLi4vLi4vLi4vZXhwb3J0Jyk7XG5cbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4vbG9hZGVyLWVycm9yJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkxvYWRlckVycm9yID0gTG9hZGVyRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uLy4uL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICog0JrQu9Cw0YHRgSDQvtGI0LjQsdC+0Log0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEBhbGlhcyB5YS5tdXNpYy5BdWRpby5Mb2FkZXJFcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIC0g0YLQtdC60YHRgiDQvtGI0LjQsdC60LrQuFxuICpcbiAqIEBleHRlbmRzIEVycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBMb2FkZXJFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG59O1xuTG9hZGVyRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJMb2FkZXJFcnJvclwiKTtcblxuLyoqXG4gKiDQotCw0LnQvNCw0YPRgiDQt9Cw0LPRgNGD0LfQutC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkxvYWRlckVycm9yLlRJTUVPVVQgPSBcInJlcXVlc3QgdGltZW91dFwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LfQsNC/0YDQvtGB0LAg0L3QsCDQt9Cw0LPRgNGD0LfQutGDXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkxvYWRlckVycm9yLkZBSUxFRCA9IFwicmVxdWVzdCBmYWlsZWRcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2FkZXJFcnJvcjtcbiIsIi8qKlxuICog0JfQsNCz0LvRg9GI0LrQsCDQsiDQstC40LTQtSDQv9GD0YHRgtC+0Lkg0YTRg9C90LrRhtC40Lgg0L3QsCDQstGB0LUg0YHQu9GD0YfQsNC4INC20LjQt9C90LhcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBub29wO1xuIiwicmVxdWlyZShcIi4uL2V4cG9ydFwiKTtcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5cbnlhLm11c2ljLkF1ZGlvLkxvZ2dlciA9IExvZ2dlcjtcbiIsInZhciBMRVZFTFMgPSBbXCJkZWJ1Z1wiLCBcImxvZ1wiLCBcImluZm9cIiwgXCJ3YXJuXCIsIFwiZXJyb3JcIiwgXCJ0cmFjZVwiXTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbGliL25vb3AnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCa0L7QvdGB0YLRgNGD0LrRgtC+0YBcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQndCw0YHRgtGA0LDQuNCy0LDQtdC80YvQtSDQu9C+0LPQs9C10YAg0LTQu9GPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAYWxpYXMgeWEubXVzaWMuQXVkaW8uTG9nZ2VyXG4gKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbCAtINC40LzRjyDQutCw0L3QsNC70LAsINC30LAg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtGC0LLQtdGH0LDRgtGMINGN0LrQt9C10LzQu9GP0YAg0LvQvtCz0LPQtdGA0LBcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0J3QsNGB0YLRgNC+0LnQutC4XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC40LPQvdC+0YDQuNGA0YPQtdC80YvRhSDQutCw0L3QsNC70L7QslxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICovXG5Mb2dnZXIuaWdub3JlcyA9IFtdO1xuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQvtGC0L7QsdGA0LDQttCw0LXQvNGL0YUg0LIg0LrQvtC90YHQvtC70Lgg0YPRgNC+0LLQvdC10Lkg0LvQvtCz0LBcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmxvZ0xldmVscyA9IFtdO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0KHQuNC90YLQsNC60YHQuNGH0LXRgdC60LjQuSDRgdCw0YXQsNGAXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmRlYnVnKipcbiAqIEBtZXRob2QgeWEubXVzaWMuQXVkaW8uTG9nZ2VyI2RlYnVnXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuZGVidWcgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKipsb2cqKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjbG9nXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUubG9nID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqaW5mbyoqXG4gKiBAbWV0aG9kIHlhLm11c2ljLkF1ZGlvLkxvZ2dlciNpbmZvXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuaW5mbyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKndhcm4qKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjd2FyblxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLndhcm4gPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKiplcnJvcioqXG4gKiBAbWV0aG9kIHlhLm11c2ljLkF1ZGlvLkxvZ2dlciNlcnJvclxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmVycm9yID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqdHJhY2UqKlxuICogQG1ldGhvZCB5YS5tdXNpYy5BdWRpby5Mb2dnZXIjdHJhY2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS50cmFjZSA9IG5vb3A7XG5cbkxFVkVMUy5mb3JFYWNoKGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgTG9nZ2VyLnByb3RvdHlwZVtsZXZlbF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmNoYW5uZWwpO1xuICAgICAgICBhcmdzLnVuc2hpZnQobGV2ZWwpO1xuICAgICAgICBMb2dnZXIubG9nLmFwcGx5KExvZ2dlciwgYXJncyk7XG4gICAgfTtcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyAg0JfQsNC/0LjRgdGMINC00LDQvdC90YvRhSDQsiDQu9C+0LNcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDQodC00LXQu9Cw0YLRjCDQt9Cw0L/QuNGB0Ywg0LIg0LvQvtCzXG4gKiBAcGFyYW0ge1N0cmluZ30gbGV2ZWwgLSDRg9GA0L7QstC10L3RjCDQu9C+0LPQsFxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwgLSDQutCw0L3QsNC7XG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5sb2cgPSBmdW5jdGlvbihsZXZlbCwgY2hhbm5lbCwgY29udGV4dCkge1xuICAgIHZhciBkYXRhID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpLm1hcChmdW5jdGlvbihkdW1wSXRlbSkge1xuICAgICAgICByZXR1cm4gZHVtcEl0ZW0gJiYgZHVtcEl0ZW0uX2xvZ2dlciAmJiBkdW1wSXRlbS5fbG9nZ2VyKCkgfHwgZHVtcEl0ZW07XG4gICAgfSk7XG5cbiAgICB2YXIgbG9nRW50cnkgPSB7XG4gICAgICAgIHRpbWVzdGFtcDogK25ldyBEYXRlKCksXG4gICAgICAgIGxldmVsOiBsZXZlbCxcbiAgICAgICAgY2hhbm5lbDogY2hhbm5lbCxcbiAgICAgICAgY29udGV4dDogY29udGV4dCxcbiAgICAgICAgbWVzc2FnZTogZGF0YVxuICAgIH07XG5cbiAgICBpZiAoTG9nZ2VyLmlnbm9yZXNbY2hhbm5lbF0gfHwgTG9nZ2VyLmxvZ0xldmVscy5pbmRleE9mKGxldmVsKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIExvZ2dlci5fZHVtcEVudHJ5KGxvZ0VudHJ5KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7Qs9C1XG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5tdXNpYy5BdWRpby5Mb2dnZXJ+TG9nRW50cnlcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gdGltZXN0YW1wIC0g0LLRgNC10LzRjyDQsiB0aW1lc3RhbXAg0YTQvtGA0LzQsNGC0LVcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBsZXZlbCAtINGD0YDQvtCy0LXQvdGMINC70L7Qs9CwXG4gKiBAcHJvcGVydHkge1N0cmluZ30gY2hhbm5lbCAtINC60LDQvdCw0LtcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IG1lc3NhZ2UgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICpcbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiDQl9Cw0L/QuNGB0LDRgtGMINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsCDQsiDQutC+0L3RgdC+0LvRjFxuICogQHBhcmFtIHt5YS5tdXNpYy5BdWRpby5Mb2dnZXJ+TG9nRW50cnl9IGxvZ0VudHJ5IC0g0YHQvtC+0LHRidC10L3QuNC1INC70L7Qs9CwXG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2R1bXBFbnRyeSA9IGZ1bmN0aW9uKGxvZ0VudHJ5KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIGxldmVsID0gbG9nRW50cnkubGV2ZWw7XG5cbiAgICAgICAgdmFyIG5hbWUgPSBsb2dFbnRyeS5jb250ZXh0ICYmIChsb2dFbnRyeS5jb250ZXh0LnRhc2tOYW1lIHx8IGxvZ0VudHJ5LmNvbnRleHQubmFtZSk7XG4gICAgICAgIHZhciBjb250ZXh0ID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC5fbG9nZ2VyID8gbG9nRW50cnkuY29udGV4dC5fbG9nZ2VyKCkgOiBcIlwiKTtcblxuICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGVbbGV2ZWxdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBsZXZlbC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIExvZ2dlci5fZm9ybWF0VGltZXN0YW1wKGxvZ0VudHJ5LnRpbWVzdGFtcCksXG4gICAgICAgICAgICAgICAgXCJbXCIgKyBsb2dFbnRyeS5jaGFubmVsICsgKG5hbWUgPyBcIjpcIiArIG5hbWUgOiBcIlwiKSArIFwiXVwiLFxuICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgIF0uY29uY2F0KGxvZ0VudHJ5Lm1lc3NhZ2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGVbbGV2ZWxdLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICB9XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDRhNC+0YDQvNCw0YLQuNGA0L7QstCw0L3QuNGPINC00LDRgtGLINC00LvRjyDQstGL0LLQvtC00LAg0LIg0LrQvtC90L7RgdC+0LvRjFxuICogQHBhcmFtIHRpbWVzdGFtcFxuICogQHJldHVybnMge3N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZm9ybWF0VGltZXN0YW1wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgIHZhciBtcyA9IGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCk7XG4gICAgbXMgPSBtcyA+IDEwMCA/IG1zIDogbXMgPiAxMCA/IFwiMFwiICsgbXMgOiBcIjAwXCIgKyBtcztcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoKSArIFwiLlwiICsgbXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiJdfQ==
