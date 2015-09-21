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
(function (process,global){
/**
 * Modules
 *
 * Copyright (c) 2013 Filatov Dmitry (dfilatov@yandex-team.ru)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * @version 0.1.2
 */

(function(global) {

var undef,

    DECL_STATES = {
        NOT_RESOLVED : 'NOT_RESOLVED',
        IN_RESOLVING : 'IN_RESOLVING',
        RESOLVED     : 'RESOLVED'
    },

    /**
     * Creates a new instance of modular system
     * @returns {Object}
     */
    create = function() {
        var curOptions = {
                trackCircularDependencies : true,
                allowMultipleDeclarations : true
            },

            modulesStorage = {},
            waitForNextTick = false,
            pendingRequires = [],

            /**
             * Defines module
             * @param {String} name
             * @param {String[]} [deps]
             * @param {Function} declFn
             */
            define = function(name, deps, declFn) {
                if(!declFn) {
                    declFn = deps;
                    deps = [];
                }

                var module = modulesStorage[name];
                if(!module) {
                    module = modulesStorage[name] = {
                        name : name,
                        decl : undef
                    };
                }

                module.decl = {
                    name       : name,
                    prev       : module.decl,
                    fn         : declFn,
                    state      : DECL_STATES.NOT_RESOLVED,
                    deps       : deps,
                    dependents : [],
                    exports    : undef
                };
            },

            /**
             * Requires modules
             * @param {String|String[]} modules
             * @param {Function} cb
             * @param {Function} [errorCb]
             */
            require = function(modules, cb, errorCb) {
                if(typeof modules === 'string') {
                    modules = [modules];
                }

                if(!waitForNextTick) {
                    waitForNextTick = true;
                    nextTick(onNextTick);
                }

                pendingRequires.push({
                    deps : modules,
                    cb   : function(exports, error) {
                        error?
                            (errorCb || onError)(error) :
                            cb.apply(global, exports);
                    }
                });
            },

            /**
             * Returns state of module
             * @param {String} name
             * @returns {String} state, possible values are NOT_DEFINED, NOT_RESOLVED, IN_RESOLVING, RESOLVED
             */
            getState = function(name) {
                var module = modulesStorage[name];
                return module?
                    DECL_STATES[module.decl.state] :
                    'NOT_DEFINED';
            },

            /**
             * Returns whether the module is defined
             * @param {String} name
             * @returns {Boolean}
             */
            isDefined = function(name) {
                return !!modulesStorage[name];
            },

            /**
             * Sets options
             * @param {Object} options
             */
            setOptions = function(options) {
                for(var name in options) {
                    if(options.hasOwnProperty(name)) {
                        curOptions[name] = options[name];
                    }
                }
            },

            getStat = function() {
                var res = {},
                    module;

                for(var name in modulesStorage) {
                    if(modulesStorage.hasOwnProperty(name)) {
                        module = modulesStorage[name];
                        (res[module.decl.state] || (res[module.decl.state] = [])).push(name);
                    }
                }

                return res;
            },

            onNextTick = function() {
                waitForNextTick = false;
                applyRequires();
            },

            applyRequires = function() {
                var requiresToProcess = pendingRequires,
                    i = 0, require;

                pendingRequires = [];

                while(require = requiresToProcess[i++]) {
                    requireDeps(null, require.deps, [], require.cb);
                }
            },

            requireDeps = function(fromDecl, deps, path, cb) {
                var unresolvedDepsCnt = deps.length;
                if(!unresolvedDepsCnt) {
                    cb([]);
                }

                var decls = [],
                    onDeclResolved = function(_, error) {
                        if(error) {
                            cb(null, error);
                            return;
                        }

                        if(!--unresolvedDepsCnt) {
                            var exports = [],
                                i = 0, decl;
                            while(decl = decls[i++]) {
                                exports.push(decl.exports);
                            }
                            cb(exports);
                        }
                    },
                    i = 0, len = unresolvedDepsCnt,
                    dep, decl;

                while(i < len) {
                    dep = deps[i++];
                    if(typeof dep === 'string') {
                        if(!modulesStorage[dep]) {
                            cb(null, buildModuleNotFoundError(dep, fromDecl));
                            return;
                        }

                        decl = modulesStorage[dep].decl;
                    }
                    else {
                        decl = dep;
                    }

                    decls.push(decl);

                    startDeclResolving(decl, path, onDeclResolved);
                }
            },

            startDeclResolving = function(decl, path, cb) {
                if(decl.state === DECL_STATES.RESOLVED) {
                    cb(decl.exports);
                    return;
                }
                else if(decl.state === DECL_STATES.IN_RESOLVING) {
                    curOptions.trackCircularDependencies && isDependenceCircular(decl, path)?
                        cb(null, buildCircularDependenceError(decl, path)) :
                        decl.dependents.push(cb);
                    return;
                }

                decl.dependents.push(cb);

                if(decl.prev && !curOptions.allowMultipleDeclarations) {
                    provideError(decl, buildMultipleDeclarationError(decl));
                    return;
                }

                curOptions.trackCircularDependencies && (path = path.slice()).push(decl);

                var isProvided = false,
                    deps = decl.prev? decl.deps.concat([decl.prev]) : decl.deps;

                decl.state = DECL_STATES.IN_RESOLVING;
                requireDeps(
                    decl,
                    deps,
                    path,
                    function(depDeclsExports, error) {
                        if(error) {
                            provideError(decl, error);
                            return;
                        }

                        depDeclsExports.unshift(function(exports, error) {
                            if(isProvided) {
                                cb(null, buildDeclAreadyProvidedError(decl));
                                return;
                            }

                            isProvided = true;
                            error?
                                provideError(decl, error) :
                                provideDecl(decl, exports);
                        });

                        decl.fn.apply(
                            {
                                name   : decl.name,
                                deps   : decl.deps,
                                global : global
                            },
                            depDeclsExports);
                    });
            },

            provideDecl = function(decl, exports) {
                decl.exports = exports;
                decl.state = DECL_STATES.RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(exports);
                }

                decl.dependents = undef;
            },

            provideError = function(decl, error) {
                decl.state = DECL_STATES.NOT_RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(null, error);
                }

                decl.dependents = [];
            };

        return {
            create     : create,
            define     : define,
            require    : require,
            getState   : getState,
            isDefined  : isDefined,
            setOptions : setOptions,
            getStat    : getStat
        };
    },

    onError = function(e) {
        nextTick(function() {
            throw e;
        });
    },

    buildModuleNotFoundError = function(name, decl) {
        return Error(decl?
            'Module "' + decl.name + '": can\'t resolve dependence "' + name + '"' :
            'Required module "' + name + '" can\'t be resolved');
    },

    buildCircularDependenceError = function(decl, path) {
        var strPath = [],
            i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            strPath.push(pathDecl.name);
        }
        strPath.push(decl.name);

        return Error('Circular dependence has been detected: "' + strPath.join(' -> ') + '"');
    },

    buildDeclAreadyProvidedError = function(decl) {
        return Error('Declaration of module "' + decl.name + '" has already been provided');
    },

    buildMultipleDeclarationError = function(decl) {
        return Error('Multiple declarations of module "' + decl.name + '" have been detected');
    },

    isDependenceCircular = function(decl, path) {
        var i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            if(decl === pathDecl) {
                return true;
            }
        }
        return false;
    },

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

        if(typeof process === 'object' && process.nextTick) { // nodejs
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.setImmediate) { // ie10
            return function(fn) {
                enqueueFn(fn) && global.setImmediate(callFns);
            };
        }

        if(global.postMessage && !global.opera) { // modern browsers
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
                var msg = '__modules' + (+new Date()),
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
            var head = doc.getElementsByTagName('head')[0],
                createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                    };
                    head.appendChild(script);
                };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })();

if(typeof exports === 'object') {
    module.exports = create();
}
else {
    global.modules = create();
}

})(typeof window !== 'undefined' ? window : global);

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":1}],4:[function(require,module,exports){
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

},{"./audio-static":5,"./config":6,"./error/audio-error":7,"./flash/audio-flash":11,"./html5/audio-html5":21,"./lib/async/deferred":23,"./lib/async/events":24,"./lib/async/reject":26,"./lib/browser/detect":27,"./lib/data/merge":32,"./logger/logger":37}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{"../lib/class/error-class":30}],8:[function(require,module,exports){
require('../export');

var AudioError = require('./audio-error');
var PlaybackError = require('./playback-error');

ya.Audio.AudioError = AudioError;
ya.Audio.PlaybackError = PlaybackError;

},{"../export":10,"./audio-error":7,"./playback-error":9}],9:[function(require,module,exports){
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

},{"../lib/class/error-class":30}],10:[function(require,module,exports){
if (typeof window.ya === "undefined") {
    window.ya = {};
}
var ya = window.ya;

if (typeof ya.Audio === "undefined") {
    ya.Audio = {};
}

var config = require('./config');
var AudioPlayer = require('./audio-player');
var Proxy = require('./lib/class/proxy');

ya.Audio = Proxy.createClass(AudioPlayer);
ya.Audio.config = config;

module.exports = ya.Audio;

},{"./audio-player":4,"./config":6,"./lib/class/proxy":31}],11:[function(require,module,exports){
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

},{"../config":6,"../lib/async/events":24,"../lib/browser/detect":27,"../lib/browser/swfobject":28,"../logger/logger":37,"./flash-interface":12,"./flash-manager":13}],12:[function(require,module,exports){
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

},{"../config":6,"../logger/logger":37}],13:[function(require,module,exports){
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

},{"../audio-static":5,"../config":6,"../error/audio-error":7,"../lib/async/deferred":23,"../lib/net/error/loader-error":34,"../logger/logger":37,"./flash-interface":12,"./loader":16}],14:[function(require,module,exports){
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

},{"../lib/browser/swfobject":28}],15:[function(require,module,exports){
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

},{"../lib/browser/swfobject":28}],16:[function(require,module,exports){
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

},{"../lib/browser/detect":27,"../lib/browser/swfobject":28,"./flashblocknotifier":14,"./flashembedder":15}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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

},{"../../lib/async/events":24,"./default.presets.js":17}],19:[function(require,module,exports){
require('../export');

ya.Audio.fx.Equalizer = require('./equalizer');

},{"../export":20,"./equalizer":18}],20:[function(require,module,exports){
require('../export');

ya.Audio.fx = {};

},{"../export":10}],21:[function(require,module,exports){
var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5');

var detect = require('../lib/browser/detect');
var Events = require('../lib/async/events');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');

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
    this.listeners = [];

    this._addLoader();
    this._addLoader();

    this._setActive(0);
};
Events.mixin(AudioHTML5);
AudioHTML5.type = AudioHTML5.prototype.type = "html5";

/**
 * Нативное событие начала воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_PLAY = "play";
/**
 * Нативное событие паузы
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_PAUSE = "pause";
/**
 * Нативное событие обновление позиции воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_TIMEUPDATE = "timeupdate";
/**
 * Нативное событие завершения трека
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_ENDED = "ended";
/**
 * Нативное событие изменения длительности
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_DURATION = "durationchange";
/**
 * Нативное событие изменения длительности загруженной части
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_LOADING = "progress";
/**
 * Нативное событие доступности мета-данных трека
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_META = "loadedmetadata";
/**
 * Нативное событие возможности начать воспроизведение
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_CANPLAY = "canplay";
/**
 * Нативное событие ошибки
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_ERROR = "error";

/**
 * Добавить загрузчик аудио-файлов
 * @private
 */
AudioHTML5.prototype._addLoader = function() {
    logger.debug(this, "_addLoader");

    var self = this;

    var loader = document.createElement('audio');
    var listener = new Events();

    loader.loop = false; // for IE
    loader.preload = loader.autobuffer = "auto"; // 100%

    loader.startPlay = function() { //INFO: эта конструкция нужна, чтобы не менять логику при resume
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);

        try {
            loader.play();
            logger.debug(self, "startPlay");
        } catch(e) {
            logger.error(self, "crashed", e);
            listener.trigger(AudioStatic.EVENT_CRASHED, e);
        }
    };

    var lastUpdate = 0;
    var updateProgress = function() {
        var currentTime = +new Date();
        if (currentTime - lastUpdate < 30) {
            return;
        }

        lastUpdate = currentTime;
        listener.trigger(AudioStatic.EVENT_PROGRESS);
    };

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_PAUSE, listener.trigger.bind(listener, AudioStatic.EVENT_PAUSE));
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_PLAY, listener.trigger.bind(listener, AudioStatic.EVENT_PLAY));

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_ENDED, function() {
        listener.trigger(AudioStatic.EVENT_PROGRESS);
        listener.trigger(AudioStatic.EVENT_ENDED);
    });

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_TIMEUPDATE, updateProgress);
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_DURATION, updateProgress);
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_LOADING, function() {
        updateProgress();

        if (loader.buffered.length) {
            var loaded = loader.buffered.end(0) - loader.buffered.start(0);

            if (loader.notLoading && loaded) {
                loader.notLoading = false;
                listener.trigger(AudioStatic.EVENT_LOADING);
            }

            if (loaded >= loaded.duration - 0.1) {
                listener.trigger(AudioStatic.EVENT_LOADED);
            }
        }
    });

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_ERROR, function(e) {
        if (!loader.fake) {
            var error = new PlaybackError(loader.error
                    ? PlaybackError.html5[loader.error.code]
                    : e instanceof Error ? e.message : e,
                loader.src);

            listener.trigger(AudioStatic.EVENT_ERROR, error);
        }
    });

    listener.on("*", function(event, data) {
        var offset = (self.loaders.length + loader.index - self.activeLoader) % self.loaders.length;
        self.trigger(event, offset, data);
    });

    loader.index = this.loaders.push(loader) - 1;
    this.listeners.push(listener);

    var initLoader = this._initLoader.bind(this, loader);
    loader.__initLoader = initLoader;
    document.body.addEventListener("mousedown", initLoader);
    document.body.addEventListener("keydown", initLoader);
    document.body.addEventListener("touchstart", initLoader);

    if (this.webAudioApi) {
        this._addSource(loader);
    }
};

AudioHTML5.prototype._initLoader = function(loader) {
    loader.play();
    loader.pause();
    // INFO: дублирование нужно для тупых мобил, которые не понимают с первого раза типа IE
    setTimeout(function(){ loader.pause(); }, 0);
    document.body.removeEventListener("mousedown", loader.__initLoader);
    document.body.removeEventListener("keydown", loader.__initLoader);
    document.body.removeEventListener("touchstart", loader.__initLoader);
    delete loader.__initLoader;
};

/**
 * Создать (если необходимо) и подключить источник звука для Web Audio API
 * @param {Audio} loader - загрузчик аудио
 * @param {AudioNode} source - экземпляр источника звука
 * @private
 */
AudioHTML5.prototype._addSource = function(loader, source) {
    logger.debug(this, "_addSource", loader);

    if (!source) {
        source = audioContext.createMediaElementSource(loader);
        this.sources.push(source);
    } else {
        source.disconnect();
    }

    if (this.preprocessor) {
        source.connect(this.preprocessor);
    } else {
        source.connect(this.audioOutput);
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
 * @param {Boolean} unsubscribe - отписаться от событий
 * @param {int} offset - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {Audio}
 * @private
 */
AudioHTML5.prototype._getLoader = function(unsubscribe, offset) {
    offset = offset || 0;
    var loader = this.loaders[(this.activeLoader + offset) % this.loaders.length];
    if (unsubscribe) {
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);
    }

    return loader;
};

//INFO: эта конструкция нужна, чтобы не менять логику при resume
/**
 * Запуск воспроизведения
 * @param {Audio} loader - загрузчик аудио
 * @private
 */
AudioHTML5.prototype._play = function(loader) {
    logger.debug(this, "_play");

    if (loader.readyState > loader.HAVE_METADATA) {
        loader.startPlay();
    } else {
        // firefox waits too long till 'canplay' or 'canplaythrough'
        // but it can play right after 'loadedmetadata'
        // so we use both events
        loader.addEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.addEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);
    }
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
        this.audioOutput.gain = this.volume;
        this.audioOutput.connect(audioContext.destination);

        if (this.preprocessor) {
            this.preprocessor.output.connect(this.audioOutput);
        }

        this.sources = this.sources || [];
        this.loaders.forEach(function(loader, idx) {
            loader.volume = 1;
            var prepared = loader.crossOrigin;
            loader.crossOrigin = "anonymous";
            this._addSource(loader, this.sources[idx]);

            if (!prepared) { // INFO: после того как мы включили webAudioAPI его уже нельзя полностью выключить.
                var pos = loader.currentTime;
                var paused = loader.paused;
                loader.load();
                loader.currentTime = pos;
                if (!paused) {
                    loader.play();
                }
            }
        }.bind(this));

    } else if (this.audioOutput) {
        if (this.preprocessor) {
            this.preprocessor.output.disconnect();
        }

        this.audioOutput.disconnect();
        delete this.audioOutput;

        this.sources.forEach(function(source) {
            source.disconnect();
        });
        //delete this.sources;

        this.loaders.forEach(function(loader, idx) {
            loader.volume = this.volume;

            var source = this.sources[idx];
            if (source) { // INFO: после того как мы включили webAudioAPI его уже нельзя полностью выключить.
                source.connect(audioContext.destination);
            }
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
        return;
    }

    logger.info(this, "setAudioPreprocessor");

    if (this.preprocessor === preprocessor) {
        return;
    }

    if (this.preprocessor) {
        this.preprocessor.output.disconnect();
    }

    this.preprocessor = preprocessor;

    if (!preprocessor) {
        this.sources.forEach(function(source) {
            source.disconnect();
            source.connect(this.audioOutput);
        }.bind(this));
        return;
    }

    this.sources.forEach(function(source) {
        source.disconnect();
        source.connect(preprocessor.input);
    });
    preprocessor.output.connect(this.audioOutput);
};

/**
 * Проиграть трек
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 */
AudioHTML5.prototype.play = function(src, duration) {
    logger.info(this, "play", src);

    var loader = this._getLoader(true);

    loader.fake = false;
    loader.src = src;
    loader._src = src;
    loader.notLoading = true;
    loader.load();

    this._play(loader);
};

/** Поставить трек на паузу */
AudioHTML5.prototype.pause = function() {
    logger.info(this, "pause");
    var loader = this._getLoader(true);
    loader.pause();
};

/** Снять трек с паузы */
AudioHTML5.prototype.resume = function() {
    logger.info(this, "resume");
    var loader = this._getLoader(true);
    this._play(loader);
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
AudioHTML5.prototype.stop = function(offset) {
    logger.info(this, "stop");
    var loader = this._getLoader(true, offset || 0);

    loader.fake = true;
    loader.src = "";
    loader._src = false;
    loader.notLoading = true;
    loader.load();

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
    var loader = this._getLoader(true, offset);

    loader.src = src;
    loader._src = src;
    loader.notLoading = true;
    loader.load();
};

/**
 * Проверить что трек предзагружается
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloaded = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);
    return loader._src === src && !loader.notLoading;
};

/**
 * Проверить что трек начал предзагружаться
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloading = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);
    return loader._src === src;
};

/**
 * Запустить воспроизведение предзагруженного трека
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean} -- доступность данного действия
 */
AudioHTML5.prototype.playPreloaded = function(offset) {
    logger.info(this, "playPreloaded", offset);
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);

    if (!loader._src) {
        return false;
    }

    this._setActive(offset);
    this._play(this._getLoader(true, 0));

    return true;
};

/**
 * Получить позицию воспроизведения
 * @returns {number}
 */
AudioHTML5.prototype.getPosition = function() {
    return this._getLoader().currentTime;
};

/**
 * Установить текущую позицию воспроизведения
 * @param {number} position
 */
AudioHTML5.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);
    this._getLoader().currentTime = position - 0.001;
};

/**
 * Получить длительность трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getDuration = function(offset) {
    return this._getLoader(false, offset).duration;
};

/**
 * Получить длительность загруженной части трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getLoaded = function(offset) {
    var loader = this._getLoader(false, offset);

    if (loader.buffered.length) {
        return loader.buffered.end(0) - loader.buffered.start(0);
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
            loader.volume = volume;
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
    return this._getLoader(false, offset)._src;
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

},{"../audio-static":5,"../error/playback-error":9,"../lib/async/events":24,"../lib/browser/detect":27,"../logger/logger":37}],22:[function(require,module,exports){
var YandexAudio = require('./export');
require('./error/export');
require('./lib/net/error/export');
require('./logger/export');
require('./fx/equalizer/export');

module.exports = YandexAudio;

},{"./error/export":8,"./export":10,"./fx/equalizer/export":19,"./lib/net/error/export":33,"./logger/export":36}],23:[function(require,module,exports){
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

},{"../../../export":10,"./loader-error":34}],34:[function(require,module,exports){
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

},{"../export":10,"./logger":37}],37:[function(require,module,exports){
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

},{"../lib/noop":35}],38:[function(require,module,exports){
var Modules = require('ym');
var YandexAudio = require("./index.js");

if (!window.ya) {
    window.ya = {};
}

var modules;
if (window.ya.modules) {
    modules = window.ya.modules;
} else {
    modules = window.ya.modules = Modules.create();
}

modules.define('YandexAudio', function(provide) {
    provide(YandexAudio);
});

},{"./index.js":22,"ym":3}]},{},[38])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwibm9kZV9tb2R1bGVzL3ltL21vZHVsZXMuanMiLCJzcmMvYXVkaW8tcGxheWVyLmpzIiwic3JjL2F1ZGlvLXN0YXRpYy5qcyIsInNyYy9jb25maWcuanMiLCJzcmMvZXJyb3IvYXVkaW8tZXJyb3IuanMiLCJzcmMvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2Vycm9yL3BsYXliYWNrLWVycm9yLmpzIiwic3JjL2V4cG9ydC5qcyIsInNyYy9mbGFzaC9hdWRpby1mbGFzaC5qcyIsInNyYy9mbGFzaC9mbGFzaC1pbnRlcmZhY2UuanMiLCJzcmMvZmxhc2gvZmxhc2gtbWFuYWdlci5qcyIsInNyYy9mbGFzaC9mbGFzaGJsb2Nrbm90aWZpZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hlbWJlZGRlci5qcyIsInNyYy9mbGFzaC9sb2FkZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2RlZmF1bHQucHJlc2V0cy5qcyIsInNyYy9meC9lcXVhbGl6ZXIvZXF1YWxpemVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9leHBvcnQuanMiLCJzcmMvZngvZXhwb3J0LmpzIiwic3JjL2h0bWw1L2F1ZGlvLWh0bWw1LmpzIiwic3JjL2luZGV4LmpzIiwic3JjL2xpYi9hc3luYy9kZWZlcnJlZC5qcyIsInNyYy9saWIvYXN5bmMvZXZlbnRzLmpzIiwic3JjL2xpYi9hc3luYy9wcm9taXNlLmpzIiwic3JjL2xpYi9hc3luYy9yZWplY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvZGV0ZWN0LmpzIiwic3JjL2xpYi9icm93c2VyL3N3Zm9iamVjdC5qcyIsInNyYy9saWIvY2xhc3MvY2xlYXItaW5zdGFuY2UuanMiLCJzcmMvbGliL2NsYXNzL2Vycm9yLWNsYXNzLmpzIiwic3JjL2xpYi9jbGFzcy9wcm94eS5qcyIsInNyYy9saWIvZGF0YS9tZXJnZS5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2V4cG9ydC5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2xvYWRlci1lcnJvci5qcyIsInNyYy9saWIvbm9vcC5qcyIsInNyYy9sb2dnZXIvZXhwb3J0LmpzIiwic3JjL2xvZ2dlci9sb2dnZXIuanMiLCJzcmMvbW9kdWxlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaHpDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbGFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1MUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyoqXG4gKiBAbW9kdWxlIHZvd1xuICogQGF1dGhvciBGaWxhdG92IERtaXRyeSA8ZGZpbGF0b3ZAeWFuZGV4LXRlYW0ucnU+XG4gKiBAdmVyc2lvbiAwLjQuMTBcbiAqIEBsaWNlbnNlXG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgYW5kIEdQTCBsaWNlbnNlczpcbiAqICAgKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogICAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcblxudmFyIHVuZGVmLFxuICAgIG5leHRUaWNrID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZm5zID0gW10sXG4gICAgICAgICAgICBlbnF1ZXVlRm4gPSBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbnMucHVzaChmbikgPT09IDE7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2FsbEZucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBmbnNUb0NhbGwgPSBmbnMsIGkgPSAwLCBsZW4gPSBmbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZucyA9IFtdO1xuICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm5zVG9DYWxsW2krK10oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGlmKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicpIHsgLy8gaWUxMCwgbm9kZWpzID49IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0SW1tZWRpYXRlKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzLm5leHRUaWNrKSB7IC8vIG5vZGVqcyA8IDAuMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgcHJvY2Vzcy5uZXh0VGljayhjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgTXV0YXRpb25PYnNlcnZlciA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyOyAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgaWYoTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgICAgICAgdmFyIG51bSA9IDEsXG4gICAgICAgICAgICAgICAgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcblxuICAgICAgICAgICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2FsbEZucykub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGEgOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIChub2RlLmRhdGEgPSAobnVtICo9IC0xKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZ2xvYmFsLnBvc3RNZXNzYWdlKSB7XG4gICAgICAgICAgICB2YXIgaXNQb3N0TWVzc2FnZUFzeW5jID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBjaGVja0FzeW5jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1Bvc3RNZXNzYWdlQXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5wb3N0TWVzc2FnZSgnX19jaGVja0FzeW5jJywgJyonKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwuZGV0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGNoZWNrQXN5bmMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc1Bvc3RNZXNzYWdlQXN5bmMpIHtcbiAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ19fcHJvbWlzZScgKyArbmV3IERhdGUsXG4gICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGUuZGF0YSA9PT0gbXNnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24gJiYgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcj9cbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgZ2xvYmFsLnBvc3RNZXNzYWdlKG1zZywgJyonKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbiAgICAgICAgaWYoJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpKSB7IC8vIGllNi1pZThcbiAgICAgICAgICAgIHZhciBjcmVhdGVTY3JpcHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdCA9IHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgKGRvYy5kb2N1bWVudEVsZW1lbnQgfHwgZG9jLmJvZHkpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGNyZWF0ZVNjcmlwdCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbihmbikgeyAvLyBvbGQgYnJvd3NlcnNcbiAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgc2V0VGltZW91dChjYWxsRm5zLCAwKTtcbiAgICAgICAgfTtcbiAgICB9KSgpLFxuICAgIHRocm93RXhjZXB0aW9uID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9LFxuICAgIGlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogIT09IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCc7XG4gICAgfSxcbiAgICB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsXG4gICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiB0b1N0ci5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfSxcbiAgICBnZXRBcnJheUtleXMgPSBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdLFxuICAgICAgICAgICAgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7XG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGkrKyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGdldE9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICBmb3IodmFyIGkgaW4gb2JqKSB7XG4gICAgICAgICAgICBvYmouaGFzT3duUHJvcGVydHkoaSkgJiYgcmVzLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIGRlZmluZUN1c3RvbUVycm9yVHlwZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdmFyIHJlcyA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlcy5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgd3JhcE9uRnVsZmlsbGVkID0gZnVuY3Rpb24ob25GdWxmaWxsZWQsIGlkeCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICBvbkZ1bGZpbGxlZC5jYWxsKHRoaXMsIHZhbCwgaWR4KTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4vKipcbiAqIEBjbGFzcyBEZWZlcnJlZFxuICogQGV4cG9ydHMgdm93OkRlZmVycmVkXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgRGVmZXJyZWRgIGNsYXNzIGlzIHVzZWQgdG8gZW5jYXBzdWxhdGUgbmV3bHktY3JlYXRlZCBwcm9taXNlIG9iamVjdCBhbG9uZyB3aXRoIGZ1bmN0aW9ucyB0aGF0IHJlc29sdmUsIHJlamVjdCBvciBub3RpZnkgaXQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBkZXNjcmlwdGlvblxuICogWW91IGNhbiB1c2UgYHZvdy5kZWZlcigpYCBpbnN0ZWFkIG9mIHVzaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gKlxuICogYG5ldyB2b3cuRGVmZXJyZWQoKWAgZ2l2ZXMgdGhlIHNhbWUgcmVzdWx0IGFzIGB2b3cuZGVmZXIoKWAuXG4gKi9cbnZhciBEZWZlcnJlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgUHJvbWlzZSgpO1xufTtcblxuRGVmZXJyZWQucHJvdG90eXBlID0gLyoqIEBsZW5kcyBEZWZlcnJlZC5wcm90b3R5cGUgKi97XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb21pc2UgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc29sdmVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIidzdWNjZXNzJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlc29sdmUoJ3N1Y2Nlc3MnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlamVjdHMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLmZhaWwoZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICogICAgIC8vIHJlYXNvbiBpcyBcIidzb21ldGhpbmcgaXMgd3JvbmcnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIucmVqZWN0KCdzb21ldGhpbmcgaXMgd3JvbmcnKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZvdy5pc1Byb21pc2UocmVhc29uKSkge1xuICAgICAgICAgICAgcmVhc29uID0gcmVhc29uLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHZhbCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVzb2x2ZShyZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTm90aWZpZXMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZSB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5wcm9ncmVzcyhmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyB2YWx1ZSBpcyBcIicyMCUnXCIsIFwiJzQwJSdcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5ub3RpZnkoJzIwJScpO1xuICAgICAqIGRlZmVyLm5vdGlmeSgnNDAlJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgbm90aWZ5IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5pc1Jlc29sdmVkKCkgfHwgdGhpcy5fcHJvbWlzZS5fbm90aWZ5KHZhbHVlKTtcbiAgICB9XG59O1xuXG52YXIgUFJPTUlTRV9TVEFUVVMgPSB7XG4gICAgUEVORElORyAgIDogMCxcbiAgICBSRVNPTFZFRCAgOiAxLFxuICAgIEZVTEZJTExFRCA6IDIsXG4gICAgUkVKRUNURUQgIDogM1xufTtcblxuLyoqXG4gKiBAY2xhc3MgUHJvbWlzZVxuICogQGV4cG9ydHMgdm93OlByb21pc2VcbiAqIEBkZXNjcmlwdGlvblxuICogVGhlIGBQcm9taXNlYCBjbGFzcyBpcyB1c2VkIHdoZW4geW91IHdhbnQgdG8gZ2l2ZSB0byB0aGUgY2FsbGVyIHNvbWV0aGluZyB0byBzdWJzY3JpYmUgdG8sXG4gKiBidXQgbm90IHRoZSBhYmlsaXR5IHRvIHJlc29sdmUgb3IgcmVqZWN0IHRoZSBkZWZlcnJlZC5cbiAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZXIgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kI3RoZS1wcm9taXNlLWNvbnN0cnVjdG9yIGZvciBkZXRhaWxzLlxuICogQGRlc2NyaXB0aW9uXG4gKiBZb3Ugc2hvdWxkIHVzZSB0aGlzIGNvbnN0cnVjdG9yIGRpcmVjdGx5IG9ubHkgaWYgeW91IGFyZSBnb2luZyB0byB1c2UgYHZvd2AgYXMgRE9NIFByb21pc2VzIGltcGxlbWVudGF0aW9uLlxuICogSW4gb3RoZXIgY2FzZSB5b3Ugc2hvdWxkIHVzZSBgdm93LmRlZmVyKClgIGFuZCBgZGVmZXIucHJvbWlzZSgpYCBtZXRob2RzLlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiBmdW5jdGlvbiBmZXRjaEpTT04odXJsKSB7XG4gKiAgICAgcmV0dXJuIG5ldyB2b3cuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QsIG5vdGlmeSkge1xuICogICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gKiAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICogICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICogICAgICAgICB4aHIuc2VuZCgpO1xuICogICAgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgICBpZih4aHIucmVzcG9uc2UpIHtcbiAqICAgICAgICAgICAgICAgICByZXNvbHZlKHhoci5yZXNwb25zZSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgICAgICBlbHNlIHtcbiAqICAgICAgICAgICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcigpKTtcbiAqICAgICAgICAgICAgIH1cbiAqICAgICAgICAgfTtcbiAqICAgICB9KTtcbiAqIH1cbiAqIGBgYFxuICovXG52YXIgUHJvbWlzZSA9IGZ1bmN0aW9uKHJlc29sdmVyKSB7XG4gICAgdGhpcy5fdmFsdWUgPSB1bmRlZjtcbiAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5QRU5ESU5HO1xuXG4gICAgdGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcyA9IFtdO1xuXG4gICAgaWYocmVzb2x2ZXIpIHsgLy8gTk9URTogc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb21lbmljL3Byb21pc2VzLXVud3JhcHBpbmcvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID0gcmVzb2x2ZXIubGVuZ3RoO1xuXG4gICAgICAgIHJlc29sdmVyKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDE/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYsXG4gICAgICAgICAgICByZXNvbHZlckZuTGVuID4gMj9cbiAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXNSZXNvbHZlZCgpIHx8IF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICB9IDpcbiAgICAgICAgICAgICAgICB1bmRlZik7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUgPSAvKiogQGxlbmRzIFByb21pc2UucHJvdG90eXBlICovIHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZnVsZmlsbGVkIHByb21pc2Ugb3IgdGhlIHJlYXNvbiBpbiBjYXNlIG9mIHJlamVjdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyAhPT0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuRlVMRklMTEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVqZWN0ZWQgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXR1cyA9PT0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgcmVhY3Rpb25zIHRvIHRoZSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9IEEgbmV3IHByb21pc2UsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vcHJvbWlzZXMtYXBsdXMvcHJvbWlzZXMtc3BlYyBmb3IgZGV0YWlsc1xuICAgICAqL1xuICAgIHRoZW4gOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICB0aGlzLl9hZGRDYWxsYmFja3MoZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKHVuZGVmaW5lZCwgb25SZWplY3RlZClgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCAncmVhc29uJyBhcyBhcmd1bWVudCBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgJ2NhdGNoJyA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG9ubHkgYSByZWplY3Rpb24gcmVhY3Rpb24uIFRoaXMgbWV0aG9kIGlzIGEgc2hvcnRoYW5kIGZvciBgcHJvbWlzZS50aGVuKG51bGwsIG9uUmVqZWN0ZWQpYC4gSXQncyBhbHNvIGFuIGFsaWFzIGZvciBgY2F0Y2hgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0byBiZSBjYWxsZWQgd2l0aCB0aGUgdmFsdWUgYWZ0ZXIgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZmFpbCA6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcmVzb2x2aW5nIHJlYWN0aW9uIChmb3IgYm90aCBmdWxmaWxsbWVudCBhbmQgcmVqZWN0aW9uKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbihvblJlc29sdmVkLCBjdHgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICAgICAgIGNiID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uUmVzb2x2ZWQuY2FsbCh0aGlzLCBfdGhpcyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oY2IsIGNiLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgcHJvZ3Jlc3MgcmVhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblByb2dyZXNzIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIHdoZW4gdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24ob25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWYsIHVuZGVmLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMaWtlIGBwcm9taXNlLnRoZW5gLCBidXQgXCJzcHJlYWRzXCIgdGhlIGFycmF5IGludG8gYSB2YXJpYWRpYyB2YWx1ZSBoYW5kbGVyLlxuICAgICAqIEl0IGlzIHVzZWZ1bCB3aXRoIHRoZSBgdm93LmFsbGAgYW5kIHRoZSBgdm93LmFsbFJlc29sdmVkYCBtZXRob2RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gICAgICogICAgIC8vIGFyZzEgaXMgXCIxXCIsIGFyZzIgaXMgXCIndHdvJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCd0d28nKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBzcHJlYWQgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25GdWxmaWxsZWQuYXBwbHkodGhpcywgdmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgdGhlbmAsIGJ1dCB0ZXJtaW5hdGVzIGEgY2hhaW4gb2YgcHJvbWlzZXMuXG4gICAgICogSWYgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWQsIHRoaXMgbWV0aG9kIHRocm93cyBpdCdzIFwicmVhc29uXCIgYXMgYW4gZXhjZXB0aW9uIGluIGEgZnV0dXJlIHR1cm4gb2YgdGhlIGV2ZW50IGxvb3AuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAqIGRlZmVyLnJlamVjdChFcnJvcignSW50ZXJuYWwgZXJyb3InKSk7XG4gICAgICogZGVmZXIucHJvbWlzZSgpLmRvbmUoKTsgLy8gZXhjZXB0aW9uIHRvIGJlIHRocm93blxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIHRoaXNcbiAgICAgICAgICAgIC50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpXG4gICAgICAgICAgICAuZmFpbCh0aHJvd0V4Y2VwdGlvbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIGluIGBkZWxheWAgbWlsbGlzZWNvbmRzIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZCxcbiAgICAgKiBvciBpbW1lZGlhdGVseSByZWplY3RlZCBpZiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkZWxheSA6IGZ1bmN0aW9uKGRlbGF5KSB7XG4gICAgICAgIHZhciB0aW1lcixcbiAgICAgICAgICAgIHByb21pc2UgPSB0aGlzLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZGVsYXkpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHByb21pc2UuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBuZXcgcHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVqZWN0ZWQgaW4gYHRpbWVvdXRgIG1pbGxpc2Vjb25kc1xuICAgICAqIGlmIHRoZSBwcm9taXNlIGlzIG5vdCByZXNvbHZlZCBiZWZvcmVoYW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDEgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCg1MCksXG4gICAgICogICAgIHByb21pc2VXaXRoVGltZW91dDIgPSBkZWZlci5wcm9taXNlKCkudGltZW91dCgyMDApO1xuICAgICAqXG4gICAgICogc2V0VGltZW91dChcbiAgICAgKiAgICAgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICBkZWZlci5yZXNvbHZlKCdvaycpO1xuICAgICAqICAgICB9LFxuICAgICAqICAgICAxMDApO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0MS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgcmVqZWN0ZWQgaW4gNTBtc1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogcHJvbWlzZVdpdGhUaW1lb3V0Mi50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgIC8vIHByb21pc2VXaXRoVGltZW91dCB0byBiZSBmdWxmaWxsZWQgd2l0aCBcIidvaydcIiB2YWx1ZVxuICAgICAqIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHRpbWVvdXQgOiBmdW5jdGlvbih0aW1lb3V0KSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QobmV3IHZvdy5UaW1lZE91dEVycm9yKCd0aW1lZCBvdXQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB0aW1lb3V0KTtcblxuICAgICAgICB0aGlzLnRoZW4oXG4gICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBkZWZlci5wcm9taXNlKCkuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgX3ZvdyA6IHRydWUsXG5cbiAgICBfcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodmFsID09PSB0aGlzKSB7XG4gICAgICAgICAgICB0aGlzLl9yZWplY3QoVHlwZUVycm9yKCdDYW5cXCd0IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEO1xuXG4gICAgICAgIGlmKHZhbCAmJiAhIXZhbC5fdm93KSB7IC8vIHNob3J0cGF0aCBmb3Igdm93LlByb21pc2VcbiAgICAgICAgICAgIHZhbC5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgIHZhbC5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCh2YWwudmFsdWVPZigpKSA6XG4gICAgICAgICAgICAgICAgICAgIHZhbC50aGVuKFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZnVsZmlsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoaXNPYmplY3QodmFsKSB8fCBpc0Z1bmN0aW9uKHZhbCkpIHtcbiAgICAgICAgICAgIHZhciB0aGVuO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGVuID0gdmFsLnRoZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoZW4uY2FsbChcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3JlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9ub3RpZnkodmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgfHwgdGhpcy5fcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Z1bGZpbGwodmFsKTtcbiAgICB9LFxuXG4gICAgX2Z1bGZpbGwgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWw7XG5cbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MsIHZhbCk7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX3JlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBpZih0aGlzLl9zdGF0dXMgPiBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUkVKRUNURUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gcmVhc29uO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fcmVqZWN0ZWRDYWxsYmFja3MsIHJlYXNvbik7XG4gICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSB1bmRlZjtcbiAgICB9LFxuXG4gICAgX25vdGlmeSA6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzLCB2YWwpO1xuICAgIH0sXG5cbiAgICBfYWRkQ2FsbGJhY2tzIDogZnVuY3Rpb24oZGVmZXIsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgaWYob25SZWplY3RlZCAmJiAhaXNGdW5jdGlvbihvblJlamVjdGVkKSkge1xuICAgICAgICAgICAgY3R4ID0gb25SZWplY3RlZDtcbiAgICAgICAgICAgIG9uUmVqZWN0ZWQgPSB1bmRlZjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9uUHJvZ3Jlc3MgJiYgIWlzRnVuY3Rpb24ob25Qcm9ncmVzcykpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUHJvZ3Jlc3M7XG4gICAgICAgICAgICBvblByb2dyZXNzID0gdW5kZWY7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2I7XG5cbiAgICAgICAgaWYoIXRoaXMuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBpc0Z1bmN0aW9uKG9uRnVsZmlsbGVkKT8gb25GdWxmaWxsZWQgOiB1bmRlZiwgY3R4IDogY3R4IH07XG4gICAgICAgICAgICB0aGlzLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0aGlzLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgIGNiID0geyBkZWZlciA6IGRlZmVyLCBmbiA6IG9uUmVqZWN0ZWQsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc1JlamVjdGVkKCk/XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyhbY2JdLCB0aGlzLl92YWx1ZSkgOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5fc3RhdHVzIDw9IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcy5wdXNoKHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblByb2dyZXNzLCBjdHggOiBjdHggfSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2NhbGxDYWxsYmFja3MgOiBmdW5jdGlvbihjYWxsYmFja3MsIGFyZykge1xuICAgICAgICB2YXIgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDtcbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlzUmVzb2x2ZWQgPSB0aGlzLmlzUmVzb2x2ZWQoKSxcbiAgICAgICAgICAgIGlzRnVsZmlsbGVkID0gdGhpcy5pc0Z1bGZpbGxlZCgpO1xuXG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGkgPSAwLCBjYiwgZGVmZXIsIGZuO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNiID0gY2FsbGJhY2tzW2krK107XG4gICAgICAgICAgICAgICAgZGVmZXIgPSBjYi5kZWZlcjtcbiAgICAgICAgICAgICAgICBmbiA9IGNiLmZuO1xuXG4gICAgICAgICAgICAgICAgaWYoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN0eCA9IGNiLmN0eCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGN0eD8gZm4uY2FsbChjdHgsIGFyZykgOiBmbihhcmcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaXNSZXNvbHZlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0Z1bGZpbGxlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKGFyZykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVyLm5vdGlmeShhcmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuLyoqIEBsZW5kcyBQcm9taXNlICovXG52YXIgc3RhdGljTWV0aG9kcyA9IHtcbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGFsbCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYWxsKGl0ZXJhYmxlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGVuIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByYWNlIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbnlSZXNvbHZlZChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZXNvbHZlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGhhdmUgYHZhbHVlYCdzIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZXNvbHZlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVqZWN0KHJlYXNvbik7XG4gICAgfVxufTtcblxuZm9yKHZhciBwcm9wIGluIHN0YXRpY01ldGhvZHMpIHtcbiAgICBzdGF0aWNNZXRob2RzLmhhc093blByb3BlcnR5KHByb3ApICYmXG4gICAgICAgIChQcm9taXNlW3Byb3BdID0gc3RhdGljTWV0aG9kc1twcm9wXSk7XG59XG5cbnZhciB2b3cgPSAvKiogQGV4cG9ydHMgdm93ICovIHtcbiAgICBEZWZlcnJlZCA6IERlZmVycmVkLFxuXG4gICAgUHJvbWlzZSA6IFByb21pc2UsXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IGRlZmVycmVkLiBUaGlzIG1ldGhvZCBpcyBhIGZhY3RvcnkgbWV0aG9kIGZvciBgdm93OkRlZmVycmVkYCBjbGFzcy5cbiAgICAgKiBJdCdzIGVxdWl2YWxlbnQgdG8gYG5ldyB2b3cuRGVmZXJyZWQoKWAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm93OkRlZmVycmVkfVxuICAgICAqL1xuICAgIGRlZmVyIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVmZXJyZWQoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudGhlbmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHdoZW4gOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LmNhc3QodmFsdWUpLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmZhaWxgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbih2YWx1ZSwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSwgdW5kZWYsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmFsd2F5c2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVzb2x2ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgcHJvbWlzZSBhcyBhbiBhcmd1bWVudCwgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbHdheXMgOiBmdW5jdGlvbih2YWx1ZSwgb25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuYWx3YXlzKG9uUmVzb2x2ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnByb2dyZXNzYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHByb2dyZXNzIDogZnVuY3Rpb24odmFsdWUsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLnByb2dyZXNzKG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnNwcmVhZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5zcHJlYWQob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRvbmVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqL1xuICAgIGRvbmUgOiBmdW5jdGlvbih2YWx1ZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2b3cud2hlbih2YWx1ZSkuZG9uZShvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGB2YWx1ZWAgaXMgYSBwcm9taXNlLWxpa2Ugb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdm93LmlzUHJvbWlzZSgnc29tZXRoaW5nJyk7IC8vIHJldHVybnMgZmFsc2VcbiAgICAgKiB2b3cuaXNQcm9taXNlKHZvdy5kZWZlcigpLnByb21pc2UoKSk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIHZvdy5pc1Byb21pc2UoeyB0aGVuIDogZnVuY3Rpb24oKSB7IH0pOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpc1Byb21pc2UgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIGlzRnVuY3Rpb24odmFsdWUudGhlbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvZXJjZXMgdGhlIGdpdmVuIGB2YWx1ZWAgdG8gYSBwcm9taXNlLCBvciByZXR1cm5zIHRoZSBgdmFsdWVgIGlmIGl0J3MgYWxyZWFkeSBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGNhc3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgISF2YWx1ZS5fdm93P1xuICAgICAgICAgICAgdmFsdWUgOlxuICAgICAgICAgICAgdm93LnJlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS52YWx1ZU9mYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgdmFsdWVPZiA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNGdWxmaWxsZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc0Z1bGZpbGxlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzRnVsZmlsbGVkKT8gdmFsdWUuaXNGdWxmaWxsZWQoKSA6IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzUmVqZWN0ZWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIGlzRnVuY3Rpb24odmFsdWUuaXNSZWplY3RlZCk/IHZhbHVlLmlzUmVqZWN0ZWQoKSA6IGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1Jlc29sdmVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZXNvbHZlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVzb2x2ZWQpPyB2YWx1ZS5pc1Jlc29sdmVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciByZXMgPSB2b3cuZGVmZXIoKTtcbiAgICAgICAgcmVzLnJlc29sdmUodmFsdWUpO1xuICAgICAgICByZXR1cm4gcmVzLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlbiBgdmFsdWVgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIGZ1bGZpbGxlZCB3aXRoIHRoZSBmdWxmaWxsL3JlamVjdGlvbiB2YWx1ZSBvZiBgdmFsdWVgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmdWxmaWxsIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICAgICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuXG4gICAgICAgIGRlZmVyLnJlc29sdmUodmFsdWUpO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlLmlzRnVsZmlsbGVkKCk/XG4gICAgICAgICAgICBwcm9taXNlIDpcbiAgICAgICAgICAgIHByb21pc2UudGhlbihudWxsLCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVhc29uO1xuICAgICAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKiBJZiBgcmVhc29uYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICByZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgdmFyIGRlZmVyID0gdm93LmRlZmVyKCk7XG4gICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VzIHRoZSBnaXZlbiBmdW5jdGlvbiBgZm5gIHdpdGggYXJndW1lbnRzIGBhcmdzYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICAgKiBAcGFyYW0gey4uLip9IFthcmdzXVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgcHJvbWlzZTEgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICogICAgIH0sICdvaycpLFxuICAgICAqICAgICBwcm9taXNlMiA9IHZvdy5pbnZva2UoZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICB0aHJvdyBFcnJvcigpO1xuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2UxLmlzRnVsZmlsbGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMS52YWx1ZU9mKCk7IC8vICdvaydcbiAgICAgKiBwcm9taXNlMi5pc1JlamVjdGVkKCk7IC8vIHRydWVcbiAgICAgKiBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIGluc3RhbmNlIG9mIEVycm9yXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaW52b2tlIDogZnVuY3Rpb24oZm4sIGFyZ3MpIHtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWF4KGFyZ3VtZW50cy5sZW5ndGggLSAxLCAwKSxcbiAgICAgICAgICAgIGNhbGxBcmdzO1xuICAgICAgICBpZihsZW4pIHsgLy8gb3B0aW1pemF0aW9uIGZvciBWOFxuICAgICAgICAgICAgY2FsbEFyZ3MgPSBBcnJheShsZW4pO1xuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNhbGxBcmdzW2krK10gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKGNhbGxBcmdzP1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KGdsb2JhbCwgY2FsbEFyZ3MpIDpcbiAgICAgICAgICAgICAgICBmbi5jYWxsKGdsb2JhbCkpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggYXJyYXk6XG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIxID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIGRlZmVyMiA9IHZvdy5kZWZlcigpO1xuICAgICAqXG4gICAgICogdm93LmFsbChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKSwgM10pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJbMSwgMiwgM11cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHdpdGggb2JqZWN0OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoeyBwMSA6IGRlZmVyMS5wcm9taXNlKCksIHAyIDogZGVmZXIyLnByb21pc2UoKSwgcDMgOiAzIH0pXG4gICAgICogICAgIC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICogICAgICAgICAgLy8gdmFsdWUgaXMgXCJ7IHAxIDogMSwgcDIgOiAyLCBwMyA6IDMgfVwiIGhlcmVcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgyKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGxlbiA9IGtleXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzID0gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSA9IGxlbjtcbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgICAgICAgICAgcmVzW2tleXNbaWR4XV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBpZighLS1pKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGxSZXNvbHZlZChbZGVmZXIxLnByb21pc2UoKSwgZGVmZXIyLnByb21pc2UoKV0pLnNwcmVhZChmdW5jdGlvbihwcm9taXNlMSwgcHJvbWlzZTIpIHtcbiAgICAgKiAgICAgcHJvbWlzZTEuaXNSZWplY3RlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTEudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ2Vycm9yJ1wiXG4gICAgICogICAgIHByb21pc2UyLmlzRnVsZmlsbGVkKCk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqICAgICBwcm9taXNlMi52YWx1ZU9mKCk7IC8vIHJldHVybnMgXCInb2snXCJcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZWplY3QoJ2Vycm9yJyk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoJ29rJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsUmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAga2V5cyA9IGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGkgPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighaSkge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvblJlc29sdmVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLS1pIHx8IGRlZmVyLnJlc29sdmUoaXRlcmFibGUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIG9uUmVzb2x2ZWQsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIsXG4gICAgICAgICAgICBrZXlzKTtcblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgIH0sXG5cbiAgICBhbGxQYXRpZW50bHkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbFJlc29sdmVkKGl0ZXJhYmxlKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGlzUHJvbWlzZXNBcnJheSA9IGlzQXJyYXkoaXRlcmFibGUpLFxuICAgICAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgIGdldEFycmF5S2V5cyhpdGVyYWJsZSkgOlxuICAgICAgICAgICAgICAgICAgICBnZXRPYmplY3RLZXlzKGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLCBmdWxmaWxsZWRQcm9taXNlcyxcbiAgICAgICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCwgaSA9IDAsIGtleSwgcHJvbWlzZTtcblxuICAgICAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XG4gICAgICAgICAgICAgICAgcHJvbWlzZSA9IGl0ZXJhYmxlW2tleV07XG4gICAgICAgICAgICAgICAgaWYodm93LmlzUmVqZWN0ZWQocHJvbWlzZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcyB8fCAocmVqZWN0ZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSk7XG4gICAgICAgICAgICAgICAgICAgIGlzUHJvbWlzZXNBcnJheT9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMucHVzaChwcm9taXNlLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlc1trZXldID0gcHJvbWlzZS52YWx1ZU9mKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYoIXJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgKGZ1bGZpbGxlZFByb21pc2VzIHx8IChmdWxmaWxsZWRQcm9taXNlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fSkpW2tleV0gPSB2b3cudmFsdWVPZihwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHJlamVjdGVkUHJvbWlzZXMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyByZWplY3RlZFByb21pc2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVsZmlsbGVkUHJvbWlzZXM7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpZiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFsbCBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXQgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgKHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcmVqZWN0ZWQgaXRlbSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnkgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSAwLCByZWFzb247XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpIHx8IChyZWFzb24gPSBlKTtcbiAgICAgICAgICAgICAgICArK2kgPT09IGxlbiAmJiBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSB3aGVuIGFueSBvZiB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBpcyBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZSBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbnlSZXNvbHZlZCA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpLFxuICAgICAgICAgICAgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuXG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChFcnJvcigpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBkZWZlci5yZWplY3QsXG4gICAgICAgICAgICBkZWZlci5ub3RpZnksXG4gICAgICAgICAgICBkZWZlcik7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuZGVsYXlgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbih2YWx1ZSwgZGVsYXkpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS5kZWxheShkZWxheSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRpbWVvdXRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdGltZW91dFxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odmFsdWUsIHRpbWVvdXQpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5yZXNvbHZlKHZhbHVlKS50aW1lb3V0KHRpbWVvdXQpO1xuICAgIH0sXG5cbiAgICBfZm9yRWFjaCA6IGZ1bmN0aW9uKHByb21pc2VzLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4LCBrZXlzKSB7XG4gICAgICAgIHZhciBsZW4gPSBrZXlzPyBrZXlzLmxlbmd0aCA6IHByb21pc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIGkgPSAwO1xuXG4gICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHZvdy53aGVuKFxuICAgICAgICAgICAgICAgIHByb21pc2VzW2tleXM/IGtleXNbaV0gOiBpXSxcbiAgICAgICAgICAgICAgICB3cmFwT25GdWxmaWxsZWQob25GdWxmaWxsZWQsIGkpLFxuICAgICAgICAgICAgICAgIG9uUmVqZWN0ZWQsXG4gICAgICAgICAgICAgICAgb25Qcm9ncmVzcyxcbiAgICAgICAgICAgICAgICBjdHgpO1xuICAgICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIFRpbWVkT3V0RXJyb3IgOiBkZWZpbmVDdXN0b21FcnJvclR5cGUoJ1RpbWVkT3V0Jylcbn07XG5cbnZhciBkZWZpbmVBc0dsb2JhbCA9IHRydWU7XG5pZih0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB2b3c7XG4gICAgZGVmaW5lQXNHbG9iYWwgPSBmYWxzZTtcbn1cblxuaWYodHlwZW9mIG1vZHVsZXMgPT09ICdvYmplY3QnICYmIGlzRnVuY3Rpb24obW9kdWxlcy5kZWZpbmUpKSB7XG4gICAgbW9kdWxlcy5kZWZpbmUoJ3ZvdycsIGZ1bmN0aW9uKHByb3ZpZGUpIHtcbiAgICAgICAgcHJvdmlkZSh2b3cpO1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24ocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIH0pO1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmRlZmluZUFzR2xvYmFsICYmIChnbG9iYWwudm93ID0gdm93KTtcblxufSkodGhpcyk7XG4iLCIvKipcbiAqIE1vZHVsZXNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgRmlsYXRvdiBEbWl0cnkgKGRmaWxhdG92QHlhbmRleC10ZWFtLnJ1KVxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwgbGljZW5zZXM6XG4gKiBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocFxuICogaHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzL2dwbC5odG1sXG4gKlxuICogQHZlcnNpb24gMC4xLjJcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG5cbnZhciB1bmRlZixcblxuICAgIERFQ0xfU1RBVEVTID0ge1xuICAgICAgICBOT1RfUkVTT0xWRUQgOiAnTk9UX1JFU09MVkVEJyxcbiAgICAgICAgSU5fUkVTT0xWSU5HIDogJ0lOX1JFU09MVklORycsXG4gICAgICAgIFJFU09MVkVEICAgICA6ICdSRVNPTFZFRCdcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBtb2R1bGFyIHN5c3RlbVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjdXJPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHRyYWNrQ2lyY3VsYXJEZXBlbmRlbmNpZXMgOiB0cnVlLFxuICAgICAgICAgICAgICAgIGFsbG93TXVsdGlwbGVEZWNsYXJhdGlvbnMgOiB0cnVlXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtb2R1bGVzU3RvcmFnZSA9IHt9LFxuICAgICAgICAgICAgd2FpdEZvck5leHRUaWNrID0gZmFsc2UsXG4gICAgICAgICAgICBwZW5kaW5nUmVxdWlyZXMgPSBbXSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBEZWZpbmVzIG1vZHVsZVxuICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nW119IFtkZXBzXVxuICAgICAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZGVjbEZuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGRlZmluZSA9IGZ1bmN0aW9uKG5hbWUsIGRlcHMsIGRlY2xGbikge1xuICAgICAgICAgICAgICAgIGlmKCFkZWNsRm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbEZuID0gZGVwcztcbiAgICAgICAgICAgICAgICAgICAgZGVwcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBtb2R1bGUgPSBtb2R1bGVzU3RvcmFnZVtuYW1lXTtcbiAgICAgICAgICAgICAgICBpZighbW9kdWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZHVsZSA9IG1vZHVsZXNTdG9yYWdlW25hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNsIDogdW5kZWZcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2R1bGUuZGVjbCA9IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZSAgICAgICA6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHByZXYgICAgICAgOiBtb2R1bGUuZGVjbCxcbiAgICAgICAgICAgICAgICAgICAgZm4gICAgICAgICA6IGRlY2xGbixcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgICAgICA6IERFQ0xfU1RBVEVTLk5PVF9SRVNPTFZFRCxcbiAgICAgICAgICAgICAgICAgICAgZGVwcyAgICAgICA6IGRlcHMsXG4gICAgICAgICAgICAgICAgICAgIGRlcGVuZGVudHMgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0cyAgICA6IHVuZGVmXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUmVxdWlyZXMgbW9kdWxlc1xuICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd8U3RyaW5nW119IG1vZHVsZXNcbiAgICAgICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gICAgICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZXJyb3JDYl1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgcmVxdWlyZSA9IGZ1bmN0aW9uKG1vZHVsZXMsIGNiLCBlcnJvckNiKSB7XG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIG1vZHVsZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZHVsZXMgPSBbbW9kdWxlc107XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYoIXdhaXRGb3JOZXh0VGljaykge1xuICAgICAgICAgICAgICAgICAgICB3YWl0Rm9yTmV4dFRpY2sgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBuZXh0VGljayhvbk5leHRUaWNrKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwZW5kaW5nUmVxdWlyZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGRlcHMgOiBtb2R1bGVzLFxuICAgICAgICAgICAgICAgICAgICBjYiAgIDogZnVuY3Rpb24oZXhwb3J0cywgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChlcnJvckNiIHx8IG9uRXJyb3IpKGVycm9yKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IuYXBwbHkoZ2xvYmFsLCBleHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBSZXR1cm5zIHN0YXRlIG9mIG1vZHVsZVxuICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IHN0YXRlLCBwb3NzaWJsZSB2YWx1ZXMgYXJlIE5PVF9ERUZJTkVELCBOT1RfUkVTT0xWRUQsIElOX1JFU09MVklORywgUkVTT0xWRURcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZ2V0U3RhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZHVsZSA9IG1vZHVsZXNTdG9yYWdlW25hbWVdO1xuICAgICAgICAgICAgICAgIHJldHVybiBtb2R1bGU/XG4gICAgICAgICAgICAgICAgICAgIERFQ0xfU1RBVEVTW21vZHVsZS5kZWNsLnN0YXRlXSA6XG4gICAgICAgICAgICAgICAgICAgICdOT1RfREVGSU5FRCc7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFJldHVybnMgd2hldGhlciB0aGUgbW9kdWxlIGlzIGRlZmluZWRcbiAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaXNEZWZpbmVkID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhIW1vZHVsZXNTdG9yYWdlW25hbWVdO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBTZXRzIG9wdGlvbnNcbiAgICAgICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgZm9yKHZhciBuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyT3B0aW9uc1tuYW1lXSA9IG9wdGlvbnNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXRTdGF0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlcyA9IHt9LFxuICAgICAgICAgICAgICAgICAgICBtb2R1bGU7XG5cbiAgICAgICAgICAgICAgICBmb3IodmFyIG5hbWUgaW4gbW9kdWxlc1N0b3JhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYobW9kdWxlc1N0b3JhZ2UuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZSA9IG1vZHVsZXNTdG9yYWdlW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgKHJlc1ttb2R1bGUuZGVjbC5zdGF0ZV0gfHwgKHJlc1ttb2R1bGUuZGVjbC5zdGF0ZV0gPSBbXSkpLnB1c2gobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25OZXh0VGljayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHdhaXRGb3JOZXh0VGljayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGFwcGx5UmVxdWlyZXMoKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGFwcGx5UmVxdWlyZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZXNUb1Byb2Nlc3MgPSBwZW5kaW5nUmVxdWlyZXMsXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwLCByZXF1aXJlO1xuXG4gICAgICAgICAgICAgICAgcGVuZGluZ1JlcXVpcmVzID0gW107XG5cbiAgICAgICAgICAgICAgICB3aGlsZShyZXF1aXJlID0gcmVxdWlyZXNUb1Byb2Nlc3NbaSsrXSkge1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlRGVwcyhudWxsLCByZXF1aXJlLmRlcHMsIFtdLCByZXF1aXJlLmNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXF1aXJlRGVwcyA9IGZ1bmN0aW9uKGZyb21EZWNsLCBkZXBzLCBwYXRoLCBjYikge1xuICAgICAgICAgICAgICAgIHZhciB1bnJlc29sdmVkRGVwc0NudCA9IGRlcHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmKCF1bnJlc29sdmVkRGVwc0NudCkge1xuICAgICAgICAgICAgICAgICAgICBjYihbXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGRlY2xzID0gW10sXG4gICAgICAgICAgICAgICAgICAgIG9uRGVjbFJlc29sdmVkID0gZnVuY3Rpb24oXywgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIS0tdW5yZXNvbHZlZERlcHNDbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXhwb3J0cyA9IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpID0gMCwgZGVjbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGlsZShkZWNsID0gZGVjbHNbaSsrXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBvcnRzLnB1c2goZGVjbC5leHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwLCBsZW4gPSB1bnJlc29sdmVkRGVwc0NudCxcbiAgICAgICAgICAgICAgICAgICAgZGVwLCBkZWNsO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICBkZXAgPSBkZXBzW2krK107XG4gICAgICAgICAgICAgICAgICAgIGlmKHR5cGVvZiBkZXAgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZighbW9kdWxlc1N0b3JhZ2VbZGVwXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGJ1aWxkTW9kdWxlTm90Rm91bmRFcnJvcihkZXAsIGZyb21EZWNsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNsID0gbW9kdWxlc1N0b3JhZ2VbZGVwXS5kZWNsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbCA9IGRlcDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGRlY2xzLnB1c2goZGVjbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnREZWNsUmVzb2x2aW5nKGRlY2wsIHBhdGgsIG9uRGVjbFJlc29sdmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzdGFydERlY2xSZXNvbHZpbmcgPSBmdW5jdGlvbihkZWNsLCBwYXRoLCBjYikge1xuICAgICAgICAgICAgICAgIGlmKGRlY2wuc3RhdGUgPT09IERFQ0xfU1RBVEVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGRlY2wuZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZihkZWNsLnN0YXRlID09PSBERUNMX1NUQVRFUy5JTl9SRVNPTFZJTkcpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VyT3B0aW9ucy50cmFja0NpcmN1bGFyRGVwZW5kZW5jaWVzICYmIGlzRGVwZW5kZW5jZUNpcmN1bGFyKGRlY2wsIHBhdGgpP1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgYnVpbGRDaXJjdWxhckRlcGVuZGVuY2VFcnJvcihkZWNsLCBwYXRoKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbC5kZXBlbmRlbnRzLnB1c2goY2IpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVjbC5kZXBlbmRlbnRzLnB1c2goY2IpO1xuXG4gICAgICAgICAgICAgICAgaWYoZGVjbC5wcmV2ICYmICFjdXJPcHRpb25zLmFsbG93TXVsdGlwbGVEZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvdmlkZUVycm9yKGRlY2wsIGJ1aWxkTXVsdGlwbGVEZWNsYXJhdGlvbkVycm9yKGRlY2wpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGN1ck9wdGlvbnMudHJhY2tDaXJjdWxhckRlcGVuZGVuY2llcyAmJiAocGF0aCA9IHBhdGguc2xpY2UoKSkucHVzaChkZWNsKTtcblxuICAgICAgICAgICAgICAgIHZhciBpc1Byb3ZpZGVkID0gZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGRlcHMgPSBkZWNsLnByZXY/IGRlY2wuZGVwcy5jb25jYXQoW2RlY2wucHJldl0pIDogZGVjbC5kZXBzO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5zdGF0ZSA9IERFQ0xfU1RBVEVTLklOX1JFU09MVklORztcbiAgICAgICAgICAgICAgICByZXF1aXJlRGVwcyhcbiAgICAgICAgICAgICAgICAgICAgZGVjbCxcbiAgICAgICAgICAgICAgICAgICAgZGVwcyxcbiAgICAgICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oZGVwRGVjbHNFeHBvcnRzLCBlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm92aWRlRXJyb3IoZGVjbCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVwRGVjbHNFeHBvcnRzLnVuc2hpZnQoZnVuY3Rpb24oZXhwb3J0cywgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Byb3ZpZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGJ1aWxkRGVjbEFyZWFkeVByb3ZpZGVkRXJyb3IoZGVjbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNQcm92aWRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3ZpZGVFcnJvcihkZWNsLCBlcnJvcikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm92aWRlRGVjbChkZWNsLCBleHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNsLmZuLmFwcGx5KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSAgIDogZGVjbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXBzICAgOiBkZWNsLmRlcHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsb2JhbCA6IGdsb2JhbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVwRGVjbHNFeHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBwcm92aWRlRGVjbCA9IGZ1bmN0aW9uKGRlY2wsIGV4cG9ydHMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmV4cG9ydHMgPSBleHBvcnRzO1xuICAgICAgICAgICAgICAgIGRlY2wuc3RhdGUgPSBERUNMX1NUQVRFUy5SRVNPTFZFRDtcblxuICAgICAgICAgICAgICAgIHZhciBpID0gMCwgZGVwZW5kZW50O1xuICAgICAgICAgICAgICAgIHdoaWxlKGRlcGVuZGVudCA9IGRlY2wuZGVwZW5kZW50c1tpKytdKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlcGVuZGVudChleHBvcnRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkZWNsLmRlcGVuZGVudHMgPSB1bmRlZjtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHByb3ZpZGVFcnJvciA9IGZ1bmN0aW9uKGRlY2wsIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5zdGF0ZSA9IERFQ0xfU1RBVEVTLk5PVF9SRVNPTFZFRDtcblxuICAgICAgICAgICAgICAgIHZhciBpID0gMCwgZGVwZW5kZW50O1xuICAgICAgICAgICAgICAgIHdoaWxlKGRlcGVuZGVudCA9IGRlY2wuZGVwZW5kZW50c1tpKytdKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlcGVuZGVudChudWxsLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVjbC5kZXBlbmRlbnRzID0gW107XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjcmVhdGUgICAgIDogY3JlYXRlLFxuICAgICAgICAgICAgZGVmaW5lICAgICA6IGRlZmluZSxcbiAgICAgICAgICAgIHJlcXVpcmUgICAgOiByZXF1aXJlLFxuICAgICAgICAgICAgZ2V0U3RhdGUgICA6IGdldFN0YXRlLFxuICAgICAgICAgICAgaXNEZWZpbmVkICA6IGlzRGVmaW5lZCxcbiAgICAgICAgICAgIHNldE9wdGlvbnMgOiBzZXRPcHRpb25zLFxuICAgICAgICAgICAgZ2V0U3RhdCAgICA6IGdldFN0YXRcbiAgICAgICAgfTtcbiAgICB9LFxuXG4gICAgb25FcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgYnVpbGRNb2R1bGVOb3RGb3VuZEVycm9yID0gZnVuY3Rpb24obmFtZSwgZGVjbCkge1xuICAgICAgICByZXR1cm4gRXJyb3IoZGVjbD9cbiAgICAgICAgICAgICdNb2R1bGUgXCInICsgZGVjbC5uYW1lICsgJ1wiOiBjYW5cXCd0IHJlc29sdmUgZGVwZW5kZW5jZSBcIicgKyBuYW1lICsgJ1wiJyA6XG4gICAgICAgICAgICAnUmVxdWlyZWQgbW9kdWxlIFwiJyArIG5hbWUgKyAnXCIgY2FuXFwndCBiZSByZXNvbHZlZCcpO1xuICAgIH0sXG5cbiAgICBidWlsZENpcmN1bGFyRGVwZW5kZW5jZUVycm9yID0gZnVuY3Rpb24oZGVjbCwgcGF0aCkge1xuICAgICAgICB2YXIgc3RyUGF0aCA9IFtdLFxuICAgICAgICAgICAgaSA9IDAsIHBhdGhEZWNsO1xuICAgICAgICB3aGlsZShwYXRoRGVjbCA9IHBhdGhbaSsrXSkge1xuICAgICAgICAgICAgc3RyUGF0aC5wdXNoKHBhdGhEZWNsLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHN0clBhdGgucHVzaChkZWNsLm5hbWUpO1xuXG4gICAgICAgIHJldHVybiBFcnJvcignQ2lyY3VsYXIgZGVwZW5kZW5jZSBoYXMgYmVlbiBkZXRlY3RlZDogXCInICsgc3RyUGF0aC5qb2luKCcgLT4gJykgKyAnXCInKTtcbiAgICB9LFxuXG4gICAgYnVpbGREZWNsQXJlYWR5UHJvdmlkZWRFcnJvciA9IGZ1bmN0aW9uKGRlY2wpIHtcbiAgICAgICAgcmV0dXJuIEVycm9yKCdEZWNsYXJhdGlvbiBvZiBtb2R1bGUgXCInICsgZGVjbC5uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gcHJvdmlkZWQnKTtcbiAgICB9LFxuXG4gICAgYnVpbGRNdWx0aXBsZURlY2xhcmF0aW9uRXJyb3IgPSBmdW5jdGlvbihkZWNsKSB7XG4gICAgICAgIHJldHVybiBFcnJvcignTXVsdGlwbGUgZGVjbGFyYXRpb25zIG9mIG1vZHVsZSBcIicgKyBkZWNsLm5hbWUgKyAnXCIgaGF2ZSBiZWVuIGRldGVjdGVkJyk7XG4gICAgfSxcblxuICAgIGlzRGVwZW5kZW5jZUNpcmN1bGFyID0gZnVuY3Rpb24oZGVjbCwgcGF0aCkge1xuICAgICAgICB2YXIgaSA9IDAsIHBhdGhEZWNsO1xuICAgICAgICB3aGlsZShwYXRoRGVjbCA9IHBhdGhbaSsrXSkge1xuICAgICAgICAgICAgaWYoZGVjbCA9PT0gcGF0aERlY2wpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIG5leHRUaWNrID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZm5zID0gW10sXG4gICAgICAgICAgICBlbnF1ZXVlRm4gPSBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbnMucHVzaChmbikgPT09IDE7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2FsbEZucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBmbnNUb0NhbGwgPSBmbnMsIGkgPSAwLCBsZW4gPSBmbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZucyA9IFtdO1xuICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm5zVG9DYWxsW2krK10oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGlmKHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzLm5leHRUaWNrKSB7IC8vIG5vZGVqc1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBwcm9jZXNzLm5leHRUaWNrKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGdsb2JhbC5zZXRJbW1lZGlhdGUpIHsgLy8gaWUxMFxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBnbG9iYWwuc2V0SW1tZWRpYXRlKGNhbGxGbnMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGdsb2JhbC5wb3N0TWVzc2FnZSAmJiAhZ2xvYmFsLm9wZXJhKSB7IC8vIG1vZGVybiBicm93c2Vyc1xuICAgICAgICAgICAgdmFyIGlzUG9zdE1lc3NhZ2VBc3luYyA9IHRydWU7XG4gICAgICAgICAgICBpZihnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hlY2tBc3luYyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNQb3N0TWVzc2FnZUFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwucG9zdE1lc3NhZ2UoJ19fY2hlY2tBc3luYycsICcqJyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmRldGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNQb3N0TWVzc2FnZUFzeW5jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1zZyA9ICdfX21vZHVsZXMnICsgKCtuZXcgRGF0ZSgpKSxcbiAgICAgICAgICAgICAgICAgICAgb25NZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZS5kYXRhID09PSBtc2cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbiAmJiBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyP1xuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIG9uTWVzc2FnZSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBnbG9iYWwucG9zdE1lc3NhZ2UobXNnLCAnKicpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuICAgICAgICBpZignb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0JykpIHsgLy8gaWU2LWllOFxuICAgICAgICAgICAgdmFyIGhlYWQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgICAgICAgICBjcmVhdGVTY3JpcHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdCA9IHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBjcmVhdGVTY3JpcHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHsgLy8gb2xkIGJyb3dzZXJzXG4gICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldFRpbWVvdXQoY2FsbEZucywgMCk7XG4gICAgICAgIH07XG4gICAgfSkoKTtcblxuaWYodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGUoKTtcbn1cbmVsc2Uge1xuICAgIGdsb2JhbC5tb2R1bGVzID0gY3JlYXRlKCk7XG59XG5cbn0pKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogZ2xvYmFsKTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb1BsYXllcicpO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9kZWZlcnJlZCcpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbGliL2RhdGEvbWVyZ2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL2xpYi9hc3luYy9yZWplY3QnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL2F1ZGlvLWVycm9yJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuL2F1ZGlvLXN0YXRpYycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG4vL1RPRE86INGB0LTQtdC70LDRgtGMINC40L3RgtC10YDRhNC10LnRgSDQtNC70Y8g0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQv9C+0LTQutC70Y7Rh9C10L3QuNGPINC90L7QstGL0YUg0YLQuNC/0L7QslxudmFyIGF1ZGlvVHlwZXMgPSB7XG4gICAgaHRtbDU6IHJlcXVpcmUoJy4vaHRtbDUvYXVkaW8taHRtbDUnKSxcbiAgICBmbGFzaDogcmVxdWlyZSgnLi9mbGFzaC9hdWRpby1mbGFzaCcpXG59O1xuXG52YXIgZGV0ZWN0U3RyaW5nID0gXCJAXCIgKyBkZXRlY3QucGxhdGZvcm0udmVyc2lvbiArXG4gICAgXCIgXCIgKyBkZXRlY3QucGxhdGZvcm0ub3MgK1xuICAgIFwiOlwiICsgZGV0ZWN0LmJyb3dzZXIubmFtZSArXG4gICAgXCIvXCIgKyBkZXRlY3QuYnJvd3Nlci52ZXJzaW9uO1xuXG5hdWRpb1R5cGVzLmZsYXNoLnByaW9yaXR5ID0gMDtcbmF1ZGlvVHlwZXMuaHRtbDUucHJpb3JpdHkgPSBjb25maWcuaHRtbDUuYmxhY2tsaXN0LnNvbWUoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gZGV0ZWN0U3RyaW5nLm1hdGNoKGl0ZW0pOyB9KSA/IC0xIDogMTtcblxubG9nZ2VyLmRlYnVnKG51bGwsIFwiYXVkaW9UeXBlc1wiLCBhdWRpb1R5cGVzKTtcblxuLyoqINCe0L/QuNGB0LDQvdC40LUg0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQv9C70LXQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXNcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHByb3BlcnR5IHtOdW1iZXJ9IGxvYWRlZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwb3NpdGlvbiAtINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHByb3BlcnR5IHtOdW1iZXJ9IHBsYXllZCAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ29tbW9uIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9QTEFZfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwbGF5XG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9FTkRFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jZW5kZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQs9GA0L7QvNC60L7RgdGC0LggKHtAbGluayB5YS5BdWRpby5FVkVOVF9WT0xVTUV9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3ZvbHVtZWNoYW5nZVxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINCz0YDQvtC80LrQvtGB0YLRjFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LrRgNCw0YXQsCDQv9C70LXQtdGA0LAgKHtAbGluayB5YS5BdWRpby5FVkVOVF9DUkFTSEVEfSlcbiAqIEBldmVudCB5YS5BdWRpbyNjcmFzaGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDRgdC80LXQvdGLINGB0YLQsNGC0YPRgdCwINC/0LvQtdC10YDQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1NUQVRFfSlcbiAqIEBldmVudCB5YS5BdWRpbyNzdGF0ZVxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0g0L3QvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQv9C10YDQtdC60LvRjtGH0LXQvdC40Y8g0LDQutGC0LjQstC90L7Qs9C+INC/0LvQtdC10YDQsCDQuCDQv9GA0LXQu9C+0LDQtNC10YDQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1NXQVB9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3N3YXBcbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQWN0aXZlIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9TVE9QfSlcbiAqIEBldmVudCB5YS5BdWRpbyNzdG9wXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUEFVU0V9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3BhdXNlXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjRjyDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8v0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4ICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUFJPR1JFU1N9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3Byb2dyZXNzXG4gKiBAcGFyYW0ge3lhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BRElOR30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jbG9hZGluZ1xuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BREVEfSlcbiAqIEBldmVudCB5YS5BdWRpbyNsb2FkZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9FUlJPUn0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jZXJyb3JcbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUHJlbG9hZGVyIEV2ZW50c1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YHRgtCw0L3QvtCy0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9TVE9QfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6c3RvcFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1BBVVNFfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6cGF1c2VcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjy/Qt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LggKHtAbGluayB5YS5BdWRpby5FVkVOVF9QUk9HUkVTU30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOnByb2dyZXNzXG4gKiBAcGFyYW0ge3lhLkF1ZGlvfkF1ZGlvUGxheWVyVGltZXN9IHRpbWVzIC0g0LjQvdGE0L7RgNC80LDRhtC40Y8g0L4g0LLRgNC10LzQtdC90L3Ri9GFINC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LfQsNCz0YDRg9C30LrQuCDRgtGA0LXQutCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfTE9BRElOR30pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOmxvYWRpbmdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0xPQURFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOmxvYWRlZFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0VSUk9SfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcmVsb2FkZXI6ZXJyb3JcbiAqL1xuXG4vKipcbiAqIEBjbGFzcyDQkNGD0LTQuNC+LdC/0LvQtdC10YAg0LTQu9GPINCx0YDQsNGD0LfQtdGA0LAuXG4gKiBAYWxpYXMgeWEuQXVkaW9cbiAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZmVycmVkVHlwZV0gLSBwcmVmZXJyZWQgcGxheWVyIHR5cGUgKGh0bWw1L2ZsYXNoKVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW292ZXJsYXldIC0gZG9tIGVsZW1lbnQgdG8gc2hvdyBmbGFzaFxuICpcbiAqIEBleHRlbmRzIEV2ZW50c1xuICogQG1peGVzIEF1ZGlvU3RhdGljXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvI3BsYXlcbiAqIEBmaXJlcyB5YS5BdWRpbyNlbmRlZFxuICogQGZpcmVzIHlhLkF1ZGlvI3ZvbHVtZWNoYW5nZVxuICogQGZpcmVzIHlhLkF1ZGlvI2NyYXNoZWRcbiAqIEBmaXJlcyB5YS5BdWRpbyNzdGF0ZVxuICogQGZpcmVzIHlhLkF1ZGlvI3N3YXBcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8jc3RvcFxuICogQGZpcmVzIHlhLkF1ZGlvI3BhdXNlXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJvZ3Jlc3NcbiAqIEBmaXJlcyB5YS5BdWRpbyNsb2FkaW5nXG4gKiBAZmlyZXMgeWEuQXVkaW8jbG9hZGVkXG4gKiBAZmlyZXMgeWEuQXVkaW8jZXJyb3JcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOnN0b3BcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6cGF1c2VcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6cHJvZ3Jlc3NcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6bG9hZGluZ1xuICogQGZpcmVzIHlhLkF1ZGlvI3ByZWxvYWRlcjpsb2FkZWRcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6ZXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvUGxheWVyID0gZnVuY3Rpb24ocHJlZmVycmVkVHlwZSwgb3ZlcmxheSkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlZmVycmVkVHlwZSA9IHByZWZlcnJlZFR5cGU7XG4gICAgdGhpcy5vdmVybGF5ID0gb3ZlcmxheTtcbiAgICB0aGlzLnN0YXRlID0gQXVkaW9QbGF5ZXIuU1RBVEVfSU5JVDtcbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9wbGF5SWQgPSBudWxsO1xuXG4gICAgdGhpcy5fd2hlblJlYWR5ID0gbmV3IERlZmVycmVkKCk7XG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLl93aGVuUmVhZHkucHJvbWlzZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiaW1wbGVtZW50YXRpb24gZm91bmRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3B1bGF0ZUV2ZW50cyhldmVudCwgb2Zmc2V0LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKCFvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWTpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1A6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRU5ERUQ6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1I6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9JRExFKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUEFVU0U6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLk5PX0lNUExFTUVOVEFUSU9OLCBlKTtcblxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9DUkFTSEVEKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5faW5pdCgwKTtcbn07XG5FdmVudHMubWl4aW4oQXVkaW9QbGF5ZXIpO1xubWVyZ2UoQXVkaW9QbGF5ZXIsIEF1ZGlvU3RhdGljLCB0cnVlKTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0LTQvtGB0YLRg9C/0L3Ri9GFINC/0LvQtdC10YDQvtCyXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQHN0YXRpY1xuICovXG5BdWRpb1BsYXllci5pbmZvID0ge1xuICAgIGh0bWw1OiBhdWRpb1R5cGVzLmh0bWw1LmF2YWlsYWJsZSxcbiAgICBmbGFzaDogYXVkaW9UeXBlcy5mbGFzaC5hdmFpbGFibGVcbn07XG5cbi8qKlxuICog0JrQvtC90YLQtdC60YHRgiDQtNC70Y8gV2ViIEF1ZGlvIEFQSVxuICogQHR5cGUge0F1ZGlvQ29udGV4dH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuYXVkaW9Db250ZXh0ID0gYXVkaW9UeXBlcy5odG1sNS5hdWRpb0NvbnRleHQ7XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0g0L3QvtCy0YvQuSDRgdGC0LDRgtGD0YFcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fc2V0U3RhdGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9zZXRTdGF0ZVwiLCBzdGF0ZSk7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHRoaXMuc3RhdGUgIT09IHN0YXRlO1xuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcblxuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwibmV3U3RhdGVcIiwgc3RhdGUpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoQXVkaW9QbGF5ZXIuRVZFTlRfU1RBVEUsIHN0YXRlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtyZXRyeT0wXSAtINC60L7Qu9C40YfQtdGB0YLQstC+INC/0L7Qv9GL0YLQvtC6XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbihyZXRyeSkge1xuICAgIHJldHJ5ID0gcmV0cnkgfHwgMDtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0XCIsIHJldHJ5KTtcblxuICAgIGlmICghdGhpcy5fd2hlblJlYWR5LnBlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChyZXRyeSA+IGNvbmZpZy5hdWRpby5yZXRyeSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTik7XG4gICAgICAgIHRoaXMuX3doZW5SZWFkeS5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTikpO1xuICAgIH1cblxuICAgIHZhciBpbml0U2VxID0gW1xuICAgICAgICBhdWRpb1R5cGVzLmh0bWw1LFxuICAgICAgICBhdWRpb1R5cGVzLmZsYXNoXG4gICAgXS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhLmF2YWlsYWJsZSAhPT0gYi5hdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS5hdmFpbGFibGUgPyAtMSA6IDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhLkF1ZGlvSW1wbGVtZW50YXRpb24udHlwZSA9PT0gdGhpcy5wcmVmZXJyZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYi5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBpbml0KCkge1xuICAgICAgICB2YXIgdHlwZSA9IGluaXRTZXEuc2hpZnQoKTtcblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICAgIHNlbGYuX2luaXQocmV0cnkgKyAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuX2luaXRUeXBlKHR5cGUpLnRoZW4oc2VsZi5fd2hlblJlYWR5LnJlc29sdmUsIGluaXQpO1xuICAgIH1cblxuICAgIGluaXQoKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsCDRgSDRg9C60LDQt9Cw0L3QvdGL0Lwg0YLQuNC/0L7QvFxuICogQHBhcmFtIHt7dHlwZTogc3RyaW5nLCBBdWRpb0ltcGxlbWVudGF0aW9uOiBmdW5jdGlvbn19IHR5cGUgLSDQvtCx0YrQtdC60YIg0L7Qv9C40YHQsNC90LjRjyDRgtC40L/QsCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9pbml0VHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIl9pbml0VHlwZVwiLCB0eXBlKTtcblxuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHRyeSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotC10LrRg9GJ0LDRjyDRgNC10LDQu9C40LfQsNGG0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7SUF1ZGlvSW1wbGVtZW50YXRpb258bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24gPSBuZXcgdHlwZS5BdWRpb0ltcGxlbWVudGF0aW9uKHRoaXMub3ZlcmxheSk7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLndoZW5SZWFkeSkge1xuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbi53aGVuUmVhZHkudGhlbihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdChlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/RgNC4INC+0LTQvdC+0Lwg0LjQtyDRgdC/0LjRgdC60LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb24gLSDQvdCw0LfQstCw0L3QuNC1INC00LXQudGB0YLQstC40Y9cbiAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IHJlc29sdmUgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9GFINGB0L7QsdGL0YLQuNC5INC00LvRjyDRgNCw0LfRgNC10YjQtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZWplY3QgLSDRgdC/0LjRgdC+0Log0L7QttC40LTQsNC10LzRi9C5INGB0L7QsdGL0YLQuNC5INC00LvRjyDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0YLQsNC60LbQtSDRgdC+0LfQtNCw0ZHRgiBEZWZlcnJlZCDRgdCy0L7QudGB0YLQstC+INGBINC90LDQt9Cy0LDQvdC40LXQvCBfd2hlbjxBY3Rpb24+LCDQutC+0YLQvtGA0L7QtSDQttC40LLRkdGCINC00L4g0LzQvtC80LXQvdGC0LAg0YDQsNC30YDQtdGI0LXQvdC40Y9cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fd2FpdEV2ZW50cyA9IGZ1bmN0aW9uKGFjdGlvbiwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpc1thY3Rpb25dID0gZGVmZXJyZWQ7XG5cbiAgICB2YXIgY2xlYW51cEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHNlbGYub2ZmKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGV0ZSBzZWxmW2FjdGlvbl07XG4gICAgfTtcblxuICAgIHJlc29sdmUuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBkZWZlcnJlZC5yZXNvbHZlKTtcbiAgICB9KTtcblxuICAgIHJlamVjdC5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHNlbGYub24oZXZlbnQsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IGRhdGEgaW5zdGFuY2VvZiBFcnJvciA/IGRhdGEgOiBuZXcgQXVkaW9FcnJvcihkYXRhIHx8IGV2ZW50KTtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZSgpLnRoZW4oY2xlYW51cEV2ZW50cywgY2xlYW51cEV2ZW50cyk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQtdC90LjQtSDRgdC+0LHRi9GC0LjQuSDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C80Lgg0YHQstC+0LnRgdGC0LLQsNC80LguINCf0L7QtNC/0LjRgdGL0LLQsNC10YLRgdGPINC90LAg0LLRgdC1INGB0L7QsdGL0YLQuNGPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwLFxuICog0YLRgNC40LPQs9C10YDQuNGCINC40YLQvtCz0L7QstGL0LUg0YHQvtCx0YvRgtC40Y8sINGA0LDQt9C00LXQu9GP0Y8g0LjRhSDQv9C+INGC0LjQv9GDINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALCDQtNC+0L/QvtC70L3Rj9C10YIg0YHQvtCx0YvRgtC40Y8g0LTQsNC90L3Ri9C80LguXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtINC40YHRgtC+0YfQvdC40Log0YHQvtCx0YvRgtC40Y8uIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRjy5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fcG9wdWxhdGVFdmVudHMgPSBmdW5jdGlvbihldmVudCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKGV2ZW50ICE9PSBBdWRpb1BsYXllci5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfcG9wdWxhdGVFdmVudHNcIiwgZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfVxuXG4gICAgdmFyIG91dGVyRXZlbnQgPSAob2Zmc2V0ID8gQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UIDogXCJcIikgKyBldmVudDtcblxuICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEOlxuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVA6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1I6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwgZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9WT0xVTUU6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIHRoaXMuZ2V0Vm9sdW1lKCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1M6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCwge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aGlzLmdldER1cmF0aW9uKG9mZnNldCksXG4gICAgICAgICAgICAgICAgbG9hZGVkOiB0aGlzLmdldExvYWRlZChvZmZzZXQpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvZmZzZXQgPyAwIDogdGhpcy5nZXRQb3NpdGlvbigpLFxuICAgICAgICAgICAgICAgIHBsYXllZDogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UGxheWVkKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIob3V0ZXJFdmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqINCT0LXQvdC10YDQsNGG0LjRjyBwbGF5SWRcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5fZ2VuZXJhdGVQbGF5SWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wbGF5SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc2xpY2UoMik7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ29tbW9uXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINC+0LHQtdGJ0LDQvdC40LUsINGA0LDQt9GA0LXRiNCw0Y7RidC10LXRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmluaXRQcm9taXNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlYWR5O1xufTtcblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YLQuNC/INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsFxuICogQHJldHVybnMge1N0cmluZ3xudWxsfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0VHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0YLQtdC60YPRidC40Lkg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0g0LHRgNCw0YLRjCDRgtGA0LXQuiDQuNC3INCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0LjQu9C4INC40Lcg0L/RgNC10LvQvtCw0LTQtdGA0LAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7SUF1ZGlvSW1wbGVtZW50YXRpb258bnVsbH1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0U3JjKG9mZnNldCk7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUGxheWJhY2tcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0Log0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAuINCQ0LrRgtGD0LDQu9GM0L3QviDQtNC70Y8g0YTQu9C10Ygt0YDQtdCw0LvQuNC30LDRhtC40LgsINCyINC90LXQuSDQv9C+0LrQsCDRgtGA0LXQuiDQs9GA0YPQt9C40YLRgdGPXG4gKiDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0L7Qv9GA0LXQtNC10LvRj9C10YLRgdGPINGBINC/0L7Qs9GA0LXRiNC90L7RgdGC0YzRji5cbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlcIiwgc3JjLCBkdXJhdGlvbik7XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBsYXlcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInBsYXlcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICB0aGlzLl93aGVuU3RvcC5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICBdKTtcblxuICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QuYXBwbHkodGhpcy5fd2hlblBsYXksIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCk7XG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wbGF5KHNyYywgZHVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LrQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQu9C+0LDQtNC10YAuIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAuIDEgLSDQv9GA0LXQu9C+0LDQtNC10YAuXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0b3BcIiwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcChvZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMuX3BsYXllZCA9IDA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInN0b3BcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG4gICAgaWYgKHRoaXMuX3doZW5TdG9wKSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuU3RvcC5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblN0b3BcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1NUT1BdLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc3RvcCgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDQv9C70LXQtdGAINC90LAg0L/QsNGD0LfRg1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSAhPT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORykge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0KFwicGF1c2VcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QYXVzZSkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblBhdXNlLnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGF1c2VcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BBVVNFXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVksXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wYXVzZSgpO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0LjQtSDQv9C70LXQtdGA0LAg0YEg0L/QsNGD0LfRi1xuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlc3VtZVwiKTtcblxuICAgIGlmICh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HICYmICF0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIGlmICghKHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX0lETEUgfHwgdGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEIHx8IHRoaXMuc3RhdGVcbiAgICAgICAgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5CQURfU1RBVEUpKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZTtcblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInJlc3VtZVwiKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QbGF5LnByb21pc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9FUlJPUixcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICAgICAgXSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5yZXN1bWUoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLy9hYm9ydGFibGVcbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NyY10gLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiwg0LTQu9GPINC/0YDQvtCy0LXRgNC60LgsINGH0YLQviDQsiDQv9GA0LXQu9C+0LDQtNC10YDQtSDQvdGD0LbQvdGL0Lkg0YLRgNC10LpcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVByZWxvYWRlZFwiLCBzcmMpO1xuXG4gICAgaWYgKCFzcmMpIHtcbiAgICAgICAgc3JjID0gdGhpcy5nZXRTcmMoMSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzUHJlbG9hZGVkKHNyYykpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5UHJlbG9hZGVkQmFkVHJhY2tcIiwgQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcbiAgICB0aGlzLl9nZW5lcmF0ZVBsYXlJZCgpO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgdGhpcy5fd2hlblBhdXNlLnJlamVjdChcInBsYXlQcmVsb2FkZWRcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICB0aGlzLl93aGVuU3RvcC5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUGxheVwiLCBbQXVkaW9QbGF5ZXIuRVZFTlRfUExBWV0sIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1RPUCxcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRURcbiAgICBdKTtcbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLmltcGxlbWVudGF0aW9uLnBsYXlQcmVsb2FkZWQoKTtcblxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEVycm9yXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBQcmVsb2FkXG4vL2Fib3J0YWJsZVxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C60LAg0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwcmVsb2FkXCIsIHNyYywgZHVyYXRpb24pO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QcmVsb2FkKSB7XG4gICAgICAgIHRoaXMuX3doZW5QcmVsb2FkLnJlamVjdChcInByZWxvYWRcIik7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5QcmVsb2FkXCIsIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UICsgQXVkaW9QbGF5ZXIuRVZFTlRfTE9BRElORyxcbiAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfU1dBUFxuICAgIF0sIFtcbiAgICAgICAgQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UICsgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRCxcbiAgICAgICAgQXVkaW9QbGF5ZXIuUFJFTE9BREVSX0VWRU5UICsgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1BcbiAgICBdKTtcblxuICAgIHByb21pc2UuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3doZW5QcmVsb2FkKSB7XG4gICAgICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QuYXBwbHkodGhpcy5fd2hlblByZWxvYWQsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLnN0b3AoMSk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnByZWxvYWQoc3JjLCBkdXJhdGlvbik7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCwg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGVkKHNyYyk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNQcmVsb2FkaW5nID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNQcmVsb2FkaW5nKHNyYywgMSk7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gVGltaW5nc1xuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRQb3NpdGlvbigpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSDQvdC+0LLQsNGPINC/0L7Qt9C40YbQuNGPINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn0gLS0g0LrQvtC90LXRh9C90LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgPT0gXCJmbGFzaFwiKSB7XG4gICAgICAgIHBvc2l0aW9uID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5nZXRMb2FkZWQoKSwgcG9zaXRpb24pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb3NpdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKHRoaXMuZ2V0RHVyYXRpb24oKSwgcG9zaXRpb24pKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgKz0gdGhpcy5nZXRQb3NpdGlvbigpIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuXG4gICAgcmV0dXJuIHBvc2l0aW9uO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ocHJlbG9hZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0RHVyYXRpb24ocHJlbG9hZGVyID8gMSA6IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4INC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuFxuICogQHBhcmFtIHtCb29sZWFufGludH0gcHJlbG9hZGVyIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGAINC40LvQuCDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQui4gMCAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCwgMSAtINC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24ocHJlbG9hZGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0TG9hZGVkKHByZWxvYWRlciA/IDEgOiAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRQbGF5ZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5fcGxheWVkICs9IHBvc2l0aW9uIC0gdGhpcy5fbGFzdFNraXA7XG4gICAgdGhpcy5fbGFzdFNraXAgPSBwb3NpdGlvbjtcblxuICAgIHJldHVybiB0aGlzLl9wbGF5ZWQ7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gVm9sdW1lXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0Lgg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFZvbHVtZSgpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC60LAg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC90L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IC0tINC40YLQvtCz0L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG5cbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0Vm9sdW1lKHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDQs9GA0L7QvNC60L7RgdGC0Ywg0YPQv9GA0LDQstC70Y/QtdGC0YHRjyDRg9GB0YLRgNC+0LnRgdGC0LLQvtC8LCDQsCDQvdC1INC/0YDQvtCz0YDQsNC80L3QvlxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc0RldmljZVZvbHVtZSgpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFdlYiBBdWRpbyBBUElcbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICpcbiAqICoq0JLQvdC40LzQsNC90LjQtSEqKiAtINC/0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS50b2dnbGVXZWJBdWRpb0FQSSA9IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSVwiLCBzdGF0ZSk7XG4gICAgaWYgKHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSAhPT0gXCJodG1sNVwiKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElGYWlsZWRcIiwgdGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnRvZ2dsZVdlYkF1ZGlvQVBJKHN0YXRlKTtcbn07XG5cbi8qKlxuICog0JDRg9C00LjQvi3Qv9GA0LXQv9GA0L7RhtC10YHRgdC+0YBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvfkF1ZGlvUHJlcHJvY2Vzc29yXG4gKlxuICogQHByb3BlcnR5IHtBdWRpb05vZGV9IGlucHV0IC0g0L3QvtC00LAsINCyINC60L7RgtC+0YDRg9GOINC/0LXRgNC10L3QsNC/0YDQsNCy0LvRj9C10YLRgdGPINCy0YvQstC+0LQg0LDRg9C00LjQvlxuICogQHByb3BlcnR5IHtBdWRpb05vZGV9IG91dHB1dCAtINC90L7QtNCwINC40Lcg0LrQvtGC0L7RgNC+0Lkg0LLRi9Cy0L7QtCDQv9C+0LTQsNGR0YLRgdGPINC90LAg0YPRgdC40LvQuNGC0LXQu9GMXG4gKi9cblxuLyoqXG4gKiDQn9C+0LTQutC70Y7Rh9C10L3QuNC1INCw0YPQtNC40L4g0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAuINCS0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiDQsNGD0LTQuNC+LdGN0LvQtdC80LXQvdGC0YMg0YMg0LrQvtGC0L7RgNC+0LPQviDQstGL0YHRgtCw0LLQu9C10L3QsFxuICogMTAwJSDQs9GA0L7QvNC60L7RgdGC0YwuINCS0YvRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6IEdhaW5Ob2RlLCDQutC+0YLQvtGA0LDRjyDRgNC10LPRg9C70LjRgNGD0LXRgiDQuNGC0L7Qs9C+0LLRg9GOINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHt5YS5BdWRpb35BdWRpb1ByZXByb2Nlc3Nvcn0gcHJlcHJvY2Vzc29yIC0g0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0YHRgtCw0YLRg9GBINGD0YHQv9C10YXQsFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5zZXRBdWRpb1ByZXByb2Nlc3NvcihwcmVwcm9jZXNzb3IpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFBsYXlJZFxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUgcGxheUlkXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BsYXlJZDtcbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGluZGV4OiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24ubmFtZSxcbiAgICAgICAgc3JjOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24uX2xvZ2dlcigpLFxuICAgICAgICB0eXBlOiB0aGlzLmltcGxlbWVudGF0aW9uICYmIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZVxuICAgIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvUGxheWVyO1xuIiwiLyoqXG4gKiBAbmFtZXNwYWNlIEF1ZGlvU3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9TdGF0aWMgPSB7fTtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QqL1xuQXVkaW9TdGF0aWMuRVZFTlRfUExBWSA9IFwicGxheVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUT1AgPSBcInN0b3BcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BBVVNFID0gXCJwYXVzZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTID0gXCJwcm9ncmVzc1wiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyA9IFwibG9hZGluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURFRCA9IFwibG9hZGVkXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9WT0xVTUUgPSBcInZvbHVtZWNoYW5nZVwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfRU5ERUQgPSBcImVuZGVkXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1RBVEUgPSBcInN0YXRlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCA9IFwic3dhcFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuUFJFTE9BREVSX0VWRU5UID0gXCJwcmVsb2FkZXI6XCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JTklUID0gXCJpbml0XCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfQ1JBU0hFRCA9IFwiY3Jhc2hlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0lETEUgPSBcImlkbGVcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9QTEFZSU5HID0gXCJwbGF5aW5nXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUEFVU0VEID0gXCJwYXVzZWRcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1N0YXRpYztcbiIsIi8qKlxuICog0J3QsNGB0YLQvtC50LrQuCDQsdC40LHQu9C40L7RgtC10LrQuFxuICogQGFsaWFzIHlhLkF1ZGlvLmNvbmZpZ1xuICogQG5hbWVzcGFjZVxuICovXG52YXIgY29uZmlnID0ge1xuICAgIC8qKlxuICAgICAqINCe0LHRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4XG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGF1ZGlvOiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmtC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QuiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHJ5OiAzXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICovXG4gICAgZmxhc2g6IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCf0YPRgtGMINC6IC5zd2Yg0YTQsNC50LvRgyDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHBhdGg6IFwiZGlzdFwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPIC5zd2Yg0YTQsNC50LvQsCDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIG5hbWU6IFwicGxheWVyLTJfMC5zd2ZcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCc0LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdmVyc2lvbjogXCI5LjAuMjhcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqIElELCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINCy0YvRgdGC0LDQstC70LXQvSDQtNC70Y8g0Y3Qu9C10LzQtdC90YLQsCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgcGxheWVySUQ6IFwiWWFuZGV4QXVkaW9GbGFzaFBsYXllclwiLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvNGPINGE0YPQvdC60YbQuNC4LdC+0LHRgNCw0LHQvtGC0YfQuNC60LAg0YHQvtCx0YvRgtC40LkgZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgY2FsbGJhY2s6IFwieWEuQXVkaW8uX2ZsYXNoQ2FsbGJhY2tcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBpbml0VGltZW91dDogMzAwMCwgLy8gMyBzZWNcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC30LDQs9GA0YPQt9C60LhcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGxvYWRUaW1lb3V0OiA1MDAwLFxuICAgICAgICAvKipcbiAgICAgICAgICog0KLQsNC50LzQsNGD0YIg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Lgg0L/QvtGB0LvQtSDQutC70LjQutCwXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBjbGlja1RpbWVvdXQ6IDEwMDAsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQmNC90YLQtdGA0LLQsNC7INC/0YDQvtCy0LXRgNC60Lgg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGhlYXJ0QmVhdEludGVydmFsOiAxMDAwXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiDQntC/0LjRgdCw0L3QuNC1INC90LDRgdGC0YDQvtC10LogaHRtbDUg0L/Qu9C10LXRgNCwXG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGh0bWw1OiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQodC/0LjRgdC+0Log0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YDQvtCyINC00LvRjyDQutC+0YLQvtGA0YvRhSDQu9GD0YfRiNC1INC90LUg0LjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMIGh0bWw1INC/0LvQtdC10YAuINCY0YHQv9C+0LvRjNC30YPQtdGC0YHRjyDQv9GA0LhcbiAgICAgICAgICog0LDQstGC0L4t0L7Qv9GA0LXQtNC10LvQtdC90LjQuCDRgtC40L/QsCDQv9C70LXQtdGA0LAuINCY0LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0Ysg0YHRgNCw0LLQvdC40LLQsNGO0YLRgdGPINGB0L4g0YHRgtGA0L7QutC+0Lkg0L/QvtGB0YLRgNC+0LXQvdC90L7QuSDQv9C+INGI0LDQsdC70L7QvdGDXG4gICAgICAgICAqIGBAPHBsYXRmb3JtLnZlcnNpb24+IDxwbGF0Zm9ybS5vcz46PGJyb3dzZXIubmFtZT4vPGJyb3dzZXIudmVyc2lvbj5gXG4gICAgICAgICAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAgICAgICAgICovXG4gICAgICAgIGJsYWNrbGlzdDogW1wibGludXg6bW96aWxsYVwiLCBcInVuaXg6bW96aWxsYVwiLCBcIm1hY29zOm1vemlsbGFcIiwgXCI6b3BlcmFcIiwgXCJATlQgNVwiLCBcIkBOVCA0XCJdXG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjb25maWc7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqIEBjbGFzcyDQmtC70LDRgdGBINC+0YjQuNCx0LrQuCDQsNGD0LTQuNC+LdC/0LvQu9C10LXRgNCwXG4gKiBAYWxpYXMgeWEuQXVkaW8uQXVkaW9FcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIC0g0YLQtdC60YHRgiDQvtGI0LjQsdC60LhcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQXVkaW9FcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG59O1xuQXVkaW9FcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIkF1ZGlvRXJyb3JcIik7XG5cbi8qKlxuICog0J3QtSDQvdCw0LnQtNC10L3QsCDRgNC10LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAg0LjQu9C4INCy0YHQtSDQtNC+0YHRgtGD0L/QvdGL0LUg0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/QvtGC0LXRgNC/0LXQu9C4INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTiA9IFwiY2Fubm90IGZpbmQgc3VpdGFibGUgaW1wbGVtZW50YXRpb25cIjtcbi8qKlxuICog0KLRgNC10Log0L3QtSDQsdGL0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC9INC40LvQuCDQstC+INCy0YDQtdC80Y8g0LfQsNCz0YDRg9C30LrQuCDQv9GA0L7QuNC30L7RiNC70LAg0L7RiNC40LHQutCwLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQgPSBcInRyYWNrIGlzIG5vdCBwcmVsb2FkZWRcIjtcbi8qKlxuICog0JTQtdC50YHRgtCy0LjQtSDQvdC1INC00L7RgdGC0YPQv9C90L4g0LjQtyDRgtC10LrRg9GJ0LXQs9C+INGB0L7RgdGC0L7Rj9C90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkJBRF9TVEFURSA9IFwiYWN0aW9uIGlzIG5vdCBwZXJtaXRlZCBmcm9tIGN1cnJlbnQgc3RhdGVcIjtcblxuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINCx0YvQuyDQt9Cw0LHQu9C+0LrQuNGA0L7QstCw0L1cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSID0gXCJmbGFzaCBpcyByZWplY3RlZCBieSBmbGFzaCBibG9ja2VyIHBsdWdpblwiO1xuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINC/0L7RgtC10YDQv9C10Lsg0LrRgNCw0YUg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L4g0L3QtdC40LfQstC10YHRgtC90YvQvCDQv9GA0LjRh9C40L3QsNC8XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfVU5LTk9XTl9DUkFTSCA9IFwiZmxhc2ggaXMgY3Jhc2hlZCB3aXRob3V0IHJlYXNvblwiO1xuLyoqXG4gKiBGbGFzaC3Qv9C70LXQtdGAINC/0L7RgtC10YDQv9C10Lsg0LrRgNCw0YUg0L/RgNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC40Lct0LfQsCDRgtCw0LnQvNCw0YPRgtCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5JVF9USU1FT1VUID0gXCJmbGFzaCBpbml0IHRpbWVkIG91dFwiO1xuLyoqXG4gKiDQktC90YPRgtGA0LXQvdC90Y/RjyDQvtGI0LjQsdC60LAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IgPSBcImZsYXNoIGludGVybmFsIGVycm9yXCI7XG4vKipcbiAqINCf0L7Qv9GL0YLQutCwINCy0YvQt9Cy0LDRgtGMINC90LXQtNC+0YHRgtGD0L/QvdGL0Lkg0Y3QutC30LXQvNC70Y/RgCBGbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9FTU1JVEVSX05PVF9GT1VORCA9IFwiZmxhc2ggZXZlbnQgZW1taXRlciBub3QgZm91bmRcIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C10YDQtdGB0YLQsNC7INC+0YLQstC10YfQsNGC0Ywg0L3QsCDQt9Cw0L/RgNC+0YHRi1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HID0gXCJmbGFzaCBwbGF5ZXIgZG9lc24ndCByZXNwb25zZVwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvRXJyb3I7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuL2F1ZGlvLWVycm9yJyk7XG52YXIgUGxheWJhY2tFcnJvciA9IHJlcXVpcmUoJy4vcGxheWJhY2stZXJyb3InKTtcblxueWEuQXVkaW8uQXVkaW9FcnJvciA9IEF1ZGlvRXJyb3I7XG55YS5BdWRpby5QbGF5YmFja0Vycm9yID0gUGxheWJhY2tFcnJvcjtcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vbGliL2NsYXNzL2Vycm9yLWNsYXNzJyk7XG5cbi8qKlxuICog0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAYWxpYXMgeWEuQXVkaW8uUGxheWJhY2tFcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIC0g0YLQtdC60YHRgiDQvtGI0LjQsdC60LhcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICpcbiAqIEBleHRlbmRzIEVycm9yXG4gKlxuICogQGVudW0ge1N0cmluZ31cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUGxheWJhY2tFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHNyYykge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xufTtcblxuUGxheWJhY2tFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIlBsYXliYWNrRXJyb3JcIik7XG5cbi8qKlxuICog0J7RgtC80LXQvdCwINGB0L7QtdC00LjQvdC10L3QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURUQgPSBcIkNvbm5lY3Rpb24gYWJvcnRlZFwiO1xuLyoqXG4gKiDQodC10YLQtdCy0LDRjyDQvtGI0LjQsdC60LBcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5ORVRXT1JLX0VSUk9SID0gXCJOZXR3b3JrIGVycm9yXCI7XG4vKipcbiAqINCe0YjQuNCx0LrQsCDQtNC10LrQvtC00LjRgNC+0LLQsNC90LjRjyDQsNGD0LTQuNC+XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuREVDT0RFX0VSUk9SID0gXCJEZWNvZGUgZXJyb3JcIjtcbi8qKlxuICog0J3QtSDQtNC+0YHRgtGD0L/QvdGL0Lkg0LjRgdGC0L7Rh9C90LjQulxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkJBRF9EQVRBID0gXCJCYWQgZGF0YVwiO1xuXG4vKipcbiAqINCi0LDQsdC70LjRhtCwINGB0L7QvtGC0LLQtdGC0YHRgtCy0LjRjyDQutC+0LTQvtCyINC+0YjQuNCx0L7QuiBodG1sNSDQv9C70LXQtdGA0LBcbiAqIEBlbnVtIHtTdHJpbmd9XG4gKi9cblBsYXliYWNrRXJyb3IuaHRtbDUgPSB7XG4gICAgMTogUGxheWJhY2tFcnJvci5DT05ORUNUSU9OX0FCT1JURUQsXG4gICAgMjogUGxheWJhY2tFcnJvci5ORVRXT1JLX0VSUk9SLFxuICAgIDM6IFBsYXliYWNrRXJyb3IuREVDT0RFX0VSUk9SLFxuICAgIDQ6IFBsYXliYWNrRXJyb3IuQkFEX0RBVEFcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWJhY2tFcnJvcjtcbiIsImlmICh0eXBlb2Ygd2luZG93LnlhID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgd2luZG93LnlhID0ge307XG59XG52YXIgeWEgPSB3aW5kb3cueWE7XG5cbmlmICh0eXBlb2YgeWEuQXVkaW8gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB5YS5BdWRpbyA9IHt9O1xufVxuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcbnZhciBBdWRpb1BsYXllciA9IHJlcXVpcmUoJy4vYXVkaW8tcGxheWVyJyk7XG52YXIgUHJveHkgPSByZXF1aXJlKCcuL2xpYi9jbGFzcy9wcm94eScpO1xuXG55YS5BdWRpbyA9IFByb3h5LmNyZWF0ZUNsYXNzKEF1ZGlvUGxheWVyKTtcbnlhLkF1ZGlvLmNvbmZpZyA9IGNvbmZpZztcblxubW9kdWxlLmV4cG9ydHMgPSB5YS5BdWRpbztcbiIsInZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcbnZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9GbGFzaCcpO1xudmFyIEZsYXNoTWFuYWdlciA9IHJlcXVpcmUoJy4vZmxhc2gtbWFuYWdlcicpO1xudmFyIEZsYXNoSW50ZXJmYWNlID0gcmVxdWlyZSgnLi9mbGFzaC1pbnRlcmZhY2UnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG5cbnZhciBwbGF5ZXJJZCA9IDE7XG5cbnZhciBmbGFzaE1hbmFnZXI7XG5cbnZhciBmbGFzaFZlcnNpb24gPSBzd2ZvYmplY3QuZ2V0Rmxhc2hQbGF5ZXJWZXJzaW9uKCk7XG5kZXRlY3QuZmxhc2hWZXJzaW9uID0gZmxhc2hWZXJzaW9uLm1ham9yICsgXCIuXCIgKyBmbGFzaFZlcnNpb24ubWlub3IgKyBcIi5cIiArIGZsYXNoVmVyc2lvbi5yZWxlYXNlO1xuXG5leHBvcnRzLmF2YWlsYWJsZSA9IHN3Zm9iamVjdC5oYXNGbGFzaFBsYXllclZlcnNpb24oY29uZmlnLmZsYXNoLnZlcnNpb24pO1xubG9nZ2VyLmluZm8odGhpcywgXCJkZXRlY3Rpb25cIiwgZXhwb3J0cy5hdmFpbGFibGUpO1xuXG4vKipcbiAqIEBjbGFzcyDQmtC70LDRgdGBIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNjcmFzaGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3dhcFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBwYXJhbSB7SE1UTEVsZW1lbnR9IFtvdmVybGF5XSAtINC80LXRgdGC0L4g0LTQu9GPINCy0YHRgtGA0LDQuNCy0LDQvdC40Y8g0L/Qu9C10LXRgNCwICjQsNC60YLRg9Cw0LvRjNC90L4g0YLQvtC70YzQutC+INC00LvRjyBmbGFzaC3Qv9C70LXQtdGA0LApXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZT1mYWxzZV0gLSDRgdC+0LfQtNCw0YLRjCDQvdC+0LLRi9C5INGN0LrQt9C10L/Qu9GP0YAgRmxhc2hNYW5hZ2VyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBBdWRpb0ZsYXNoID0gZnVuY3Rpb24ob3ZlcmxheSwgZm9yY2UpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgaWYgKCFmbGFzaE1hbmFnZXIgfHwgZm9yY2UpIHtcbiAgICAgICAgZmxhc2hNYW5hZ2VyID0gbmV3IEZsYXNoTWFuYWdlcihvdmVybGF5KTtcbiAgICB9XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMud2hlblJlYWR5ID0gZmxhc2hNYW5hZ2VyLmNyZWF0ZVBsYXllcih0aGlzKTtcbiAgICB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCBkYXRhKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvRmxhc2gpO1xuXG5BdWRpb0ZsYXNoLnR5cGUgPSBBdWRpb0ZsYXNoLnByb3RvdHlwZS50eXBlID0gXCJmbGFzaFwiO1xuXG5PYmplY3Qua2V5cyhGbGFzaEludGVyZmFjZS5wcm90b3R5cGUpLmZpbHRlcihmdW5jdGlvbihrZXkpIHtcbiAgICByZXR1cm4gRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkgJiYga2V5WzBdICE9PSBcIl9cIjtcbn0pLm1hcChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBBdWRpb0ZsYXNoLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghL15nZXQvLnRlc3QobWV0aG9kKSkge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIG1ldGhvZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJwbGF5ZXIgaXMgbm90IHJlYWR5XCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMuaWQpO1xuICAgICAgICByZXR1cm4gZmxhc2hNYW5hZ2VyLmZsYXNoW21ldGhvZF0uYXBwbHkoZmxhc2hNYW5hZ2VyLmZsYXNoLCBhcmdzKTtcbiAgICB9XG59KTtcblxuLyoqXG4gKiDQn9GA0L7QuNCz0YDQsNGC0Ywg0YLRgNC10LpcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwbGF5XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICovXG5cbi8qKlxuICog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRg1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BhdXNlXG4gKi9cblxuLyoqXG4gKiDQodC90Y/RgtGMINGC0YDQtdC6INGBINC/0LDRg9C30YtcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNyZXN1bWVcbiAqL1xuXG4vKipcbiAqINCe0YHRgtCw0L3QvtCy0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQuCDQt9Cw0LPRgNGD0LfQutGDINGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNzdG9wXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcHJlbG9hZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2lzUHJlbG9hZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVByZWxvYWRlZFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0UG9zaXRpb25cbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNzZXRQb3NpdGlvblxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0RHVyYXRpb25cbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRMb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFZvbHVtZVxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0Vm9sdW1lXG4gKiBAcGFyYW0ge251bWJlcn0gdm9sdW1lXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0U3JjXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge1N0cmluZ3xCb29sZWFufSAtLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQuiDQuNC70LggZmFsc2UsINC10YHQu9C4INC90LXRgiDQt9Cw0LPRgNGD0LbQsNC10LzQvtCz0L4g0YLRgNC10LrQsFxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINC00L7RgdGC0YPQv9C10L0g0LvQuCDQv9GA0L7Qs9GA0LDQvNC80L3Ri9C5INC60L7QvdGC0YDQvtC70Ywg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9GbGFzaC5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9GbGFzaC5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShcImlkXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG1haW46IFwibm90IHJlYWR5XCIsXG4gICAgICAgICAgICAgICAgcHJlbG9hZGVyOiBcIm5vdCByZWFkeVwiXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtYWluOiB0aGlzLmdldFNyYygwKSxcbiAgICAgICAgICAgIHByZWxvYWRlcjogdGhpcy5nZXRTcmMoMSlcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxufTtcblxuZXhwb3J0cy5BdWRpb0ltcGxlbWVudGF0aW9uID0gQXVkaW9GbGFzaDtcbiIsInZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignRmxhc2hJbnRlcmZhY2UnKTtcblxuLyoqXG4gKiBAY2xhc3Mg0J7Qv9C40YHQsNC90LjQtSDQstC90LXRiNC90LXQs9C+INC40L3RgtC10YDRhNC10LnRgdCwIGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtPYmplY3R9IGZsYXNoIC0gc3dmLdC+0LHRitC10LrRglxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hJbnRlcmZhY2UgPSBmdW5jdGlvbihmbGFzaCkge1xuICAgIHRoaXMuZmxhc2ggPSB5YS5BdWRpby5fZmxhc2ggPSBmbGFzaDtcbn07XG5cbi8qKlxuICog0JLRi9C30LLQsNGC0Ywg0LzQtdGC0L7QtCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBmbiAtINC90LDQt9Cy0LDQvdC40LUg0LzQtdGC0L7QtNCwXG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fY2FsbEZsYXNoID0gZnVuY3Rpb24oZm4pIHtcbiAgICAvL2xvZ2dlci5kZWJ1Zyh0aGlzLCBmbiwgYXJndW1lbnRzKTtcblxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZsYXNoLmNhbGwuYXBwbHkodGhpcy5mbGFzaCwgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiX2NhbGxGbGFzaEVycm9yXCIsIGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAg0L7QsdGA0LDRgtC90L7QuSDRgdCy0Y/Qt9C4INGBIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gKiBAdGhyb3dzINCe0YjQuNCx0LrQsCDQtNC+0YHRgtGD0L/QsCDQuiBmbGFzaC3Qv9C70LXQtdGA0YNcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5faGVhcnRCZWF0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwiaGVhcnRCZWF0XCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JTQvtCx0LDQstC40YLRjCDQvdC+0LLRi9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtpbnR9IC0tIGlkINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5fYWRkUGxheWVyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImFkZFBsYXllclwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gdm9sdW1lIC0g0LbQtdC70LDQtdC80LDRjyDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKGlkLCB2b2x1bWUpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzZXRWb2x1bWVcIiwgLTEsIHZvbHVtZSk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0Vm9sdW1lXCIsIC0xKTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihpZCwgc3JjLCBkdXJhdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBsYXlcIiwgaWQsIHNyYywgZHVyYXRpb24pO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJzdG9wXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInBhdXNlXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwicmVzdW1lXCIsIGlkKTtcbn07XG5cbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQuNGC0Ywg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gZHVyYXRpb24gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LLQvtC30LzQvtC20L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oaWQsIHNyYywgZHVyYXRpb24sIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJwcmVsb2FkXCIsIGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRlZFwiLCBpZCwgc3JjLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKGlkLCBzcmMsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJpc1ByZWxvYWRpbmdcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0YPRgdGC0LjRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtSDQv9GA0LXQtNC30LDQs9GA0YPQttC10L3QvdC+0LPQviDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5UHJlbG9hZGVkID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJwbGF5UHJlbG9hZGVkXCIsIGlkLCBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihpZCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRQb3NpdGlvblwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGC0LXQutGD0YnRg9GOINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQsIHBvc2l0aW9uKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic2V0UG9zaXRpb25cIiwgaWQsIHBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXREdXJhdGlvblwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0Lgg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0TG9hZGVkXCIsIGlkLCBvZmZzZXQgfHwgMCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFNyY1wiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEludGVyZmFjZTtcbiIsInZhciBMb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignRmxhc2hCcmlkZ2UnKTtcblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBmbGFzaExvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG52YXIgRmxhc2hJbnRlcmZhY2UgPSByZXF1aXJlKCcuL2ZsYXNoLWludGVyZmFjZScpO1xuXG52YXIgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcblxudmFyIEF1ZGlvRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi4vbGliL25ldC9lcnJvci9sb2FkZXItZXJyb3InKTtcblxuLyoqXG4gKiBAY2xhc3Mg0JfQsNCz0YDRg9C30LrQsCBmbGFzaC3Qv9C70LXQtdGA0LAg0Lgg0L7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBvdmVybGF5IC0g0L7QsdGK0LXQutGCINC00LvRjyDQt9Cw0LPRgNGD0LfQutC4INC4INC/0L7QutCw0LfQsCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoTWFuYWdlciA9IGZ1bmN0aW9uKG92ZXJsYXkpIHsgLy8gc2luZ2xldG9uIVxuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIsIG92ZXJsYXkpO1xuXG4gICAgdGhpcy5zdGF0ZSA9IFwiaW5pdFwiO1xuICAgIHRoaXMub3ZlcmxheSA9IG92ZXJsYXk7XG4gICAgdGhpcy5lbW1pdGVycyA9IFtdO1xuXG4gICAgdmFyIGRlZmVycmVkID0gdGhpcy5kZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIC8qKlxuICAgICAqINCe0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INGA0LDQt9GA0LXRiNCw0LXRgtGB0Y8g0L/RgNC4INC30LDQstC10YDRiNC10L3QuNC4INC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICogQHR5cGUge1Byb21pc2V9XG4gICAgICovXG4gICAgdGhpcy53aGVuUmVhZHkgPSB0aGlzLmRlZmVycmVkLnByb21pc2UoKTtcblxuICAgIHZhciBjYWxsYmFja1BhdGggPSBjb25maWcuZmxhc2guY2FsbGJhY2suc3BsaXQoXCIuXCIpO1xuICAgIHZhciBjYWxsYmFja05hbWUgPSBjYWxsYmFja1BhdGgucG9wKCk7XG4gICAgdmFyIGNhbGxiYWNrQ29udCA9IHdpbmRvdztcbiAgICBjYWxsYmFja1BhdGguZm9yRWFjaChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgIGlmICghY2FsbGJhY2tDb250W3BhcnRdKSB7XG4gICAgICAgICAgICBjYWxsYmFja0NvbnRbcGFydF0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFja0NvbnQgPSBjYWxsYmFja0NvbnRbcGFydF07XG4gICAgfSk7XG4gICAgY2FsbGJhY2tDb250W2NhbGxiYWNrTmFtZV0gPSB0aGlzLl9vbkV2ZW50LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9fbG9hZFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uTG9hZFRpbWVvdXQsIGNvbmZpZy5mbGFzaC5sb2FkVGltZW91dCk7XG4gICAgZmxhc2hMb2FkZXIoY29uZmlnLmZsYXNoLnBhdGggKyBcIi9cIlxuICAgICAgICArIGNvbmZpZy5mbGFzaC5uYW1lLCBjb25maWcuZmxhc2gudmVyc2lvbiwgY29uZmlnLmZsYXNoLnBsYXllcklELCB0aGlzLl9vbkxvYWQuYmluZCh0aGlzKSwge30sIG92ZXJsYXkpO1xuXG4gICAgaWYgKG92ZXJsYXkpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQ7XG4gICAgICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbigpIHsgLy9LTk9XTEVER0U6IG9ubHkgbW91c2Vkb3duIGV2ZW50IGFuZCBvbmx5IHdtb2RlOiB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgfHwgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuRkxBU0hfTk9UX1JFU1BPTkRJTkcpKTtcbiAgICAgICAgICAgICAgICB9LCBjb25maWcuZmxhc2guY2xpY2tUaW1lb3V0KTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdGltZW91dCA9IHRpbWVvdXQgJiYgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlYWR5XCIsIHJlc3VsdCk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGZsYXNoTWFuYWdlciA9IG51bGw7IC8vINC10YHQu9C4INC+0LHQu9C+0LzQsNC70LjRgdGMINGD0LTQsNC70Y/QtdC8INGN0LrQt9C10LzQv9C70Y/RgCDQvNC10L3QtdC00LbQtdGA0LAsINGH0YLQvtCx0Ysg0LzQvtC20L3QviDQsdGL0LvQviDQsdGL0LvQviDQv9GL0YLQsNGC0YzRgdGPINGB0L3QvtCy0LBcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiZmFpbGVkXCIsIGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuXG5GbGFzaE1hbmFnZXIuRVZFTlRfSU5JVCA9IFwiaW5pdFwiO1xuRmxhc2hNYW5hZ2VyLkVWRU5UX0ZBSUwgPSBcImZhaWxlZFwiO1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPINC30LDQs9GA0YPQt9C60Lgg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0gZGF0YVxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Mb2FkID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkxvYWRcIiwgZGF0YSk7XG5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5fX2xvYWRUaW1lb3V0KTtcbiAgICBkZWxldGUgdGhpcy5fX2xvYWRUaW1lb3V0O1xuXG4gICAgaWYgKGRhdGEuc3VjY2Vzcykge1xuICAgICAgICB0aGlzLmZsYXNoID0gbmV3IEZsYXNoSW50ZXJmYWNlKGRhdGEucmVmKTtcblxuICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gXCJyZWFkeVwiKSB7XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUoZGF0YS5yZWYpO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLm92ZXJsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX19pbml0VGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5fb25Jbml0VGltZW91dC5iaW5kKHRoaXMpLCBjb25maWcuZmxhc2guaW5pdFRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBBdWRpb0Vycm9yKGRhdGEuX19mYm4gPyBBdWRpb0Vycm9yLkZMQVNIX0JMT0NLRVIgOiBBdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0gpKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGC0LDQudC80LDRg9GC0LAg0LfQsNCz0YDRg9C30LrQuFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Mb2FkVGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KG5ldyBMb2FkZXJFcnJvcihMb2FkZXJFcnJvci5USU1FT1VUKSk7XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGC0LDQudC80LDRg9GC0LAg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGI0L3QvtGB0YLQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25Jbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX29uSW5pdFwiKTtcblxuICAgIHRoaXMuc3RhdGUgPSBcInJlYWR5XCI7XG5cbiAgICBpZiAodGhpcy5fX2luaXRUaW1lb3V0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9faW5pdFRpbWVvdXQpO1xuICAgICAgICBkZWxldGUgdGhpcy5fX2luaXRUaW1lb3V0O1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZsYXNoKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQucmVzb2x2ZSh0aGlzLmZsYXNoKTtcbiAgICAgICAgdGhpcy5fX2hlYXJ0YmVhdCA9IHNldEludGVydmFsKHRoaXMuX29uSGVhcnRCZWF0LmJpbmQodGhpcyksIDEwMDApO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40LksINGB0L7Qt9C00LDQstCw0LXQvNGL0YUgZmxhc2gt0L/Qu9C10LXRgNC+0LxcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gb2Zmc2V0IC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1INC/0LXRgNC10LTQsNC90L3Ri9C1INCy0LzQtdGB0YLQtSDRgSDRgdC+0LHRi9GC0LjQtdC8XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkV2ZW50ID0gZnVuY3Rpb24oZXZlbnQsIGlkLCBvZmZzZXQsIGRhdGEpIHtcbiAgICBpZiAoZXZlbnQgPT09IFwiZGVidWdcIikge1xuICAgICAgICBjb25zb2xlLmRlYnVnKFwiZmxhc2hERUJVR1wiLCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gXCJmYWlsZWRcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcIm9uRXZlbnRGYWlsZWRcIiwgZXZlbnQsIGlkLCBvZmZzZXQsIGRhdGEpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCwgaWQsIG9mZnNldCk7XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9JTklUKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vbkluaXQoKTtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQgPT09IEZsYXNoTWFuYWdlci5FVkVOVF9GQUlMKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiZmFpbGVkXCIsIEF1ZGlvRXJyb3IuRkxBU0hfSU5URVJOQUxfRVJST1IpO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaWQgPT0gLTEpIHtcbiAgICAgICAgdGhpcy5lbW1pdGVycy5mb3JFYWNoKGZ1bmN0aW9uKGVtbWl0ZXIpIHtcbiAgICAgICAgICAgIGVtbWl0ZXIudHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmVtbWl0ZXJzW2lkXSkge1xuICAgICAgICB0aGlzLmVtbWl0ZXJzW2lkXS50cmlnZ2VyKGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBBdWRpb0Vycm9yLkZMQVNIX0VNTUlURVJfTk9UX0ZPVU5ELCBpZCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC00L7RgdGC0YPQv9C90L7RgdGC0LggZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkhlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICAgIHRoaXMuZmxhc2guX2hlYXJ0QmVhdCgpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJjcmFzaGVkXCIsIGUpO1xuICAgICAgICB0aGlzLl9vbkV2ZW50KEF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQsIC0xLCBlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L3QvtCy0L7Qs9C+INC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtBdWRpb0ZsYXNofSBhdWRpb0ZsYXNoIC0gZmxhc2gg0LDRg9C00LjQvi3Qv9C70LXQtdGALCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0LHRgdC70YPQttC40LLQsNGC0Ywg0YHQvtC30LTQsNC90L3Ri9C5INC/0LvQtdC10YBcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0L7RgdC70LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YHQvtC30LTQsNC90LjRjyDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5jcmVhdGVQbGF5ZXIgPSBmdW5jdGlvbihhdWRpb0ZsYXNoKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY3JlYXRlUGxheWVyXCIpO1xuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzLndoZW5SZWFkeS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBhdWRpb0ZsYXNoLmlkID0gdGhpcy5mbGFzaC5fYWRkUGxheWVyKCk7XG4gICAgICAgIHRoaXMuZW1taXRlcnNbYXVkaW9GbGFzaC5pZF0gPSBhdWRpb0ZsYXNoO1xuICAgICAgICByZXR1cm4gYXVkaW9GbGFzaC5pZDtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHBsYXllcklkKSB7XG4gICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclN1Y2Nlc3NcIiwgcGxheWVySWQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImNyZWF0ZVBsYXllckVycm9yXCIsIGVycik7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaE1hbmFnZXI7XG4iLCIvKipcbiAqIEBpZ25vcmVcbiAqIEBmaWxlXG4gKiBUaGlzIGlzIGEgd3JhcHBlciBmb3Igc3dmb2JqZWN0IHRoYXQgZGV0ZWN0cyBGbGFzaEJsb2NrIGluIGJyb3dzZXIuXG4gKlxuICogV3JhcHBlciBkZXRlY3RzOlxuICogICAtIENocm9tZVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gKiAgICAgLSBGbGFzaEJsb2NrIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAqICAgICAtIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gKiAgIC0gRmlyZWZveCBGbGFzaGJsb2NrIChodHRwczovL2FkZG9ucy5tb3ppbGxhLm9yZy9ydS9maXJlZm94L2FkZG9uL2ZsYXNoYmxvY2svKVxuICogICAtIE9wZXJhID49IDExLjUgXCJFbmFibGUgcGx1Z2lucyBvbiBkZW1hbmRcIiBzZXR0aW5nXG4gKiAgIC0gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggUGx1Z2luIChmb3IgU2FmYXJpIDwgNS4wLjYpIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICpcbiAqIFRlc3RlZCBvbjpcbiAqICAgLSBDaHJvbWUgMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgTGV4MSAxLjIuMTEuMTJcbiAqICAgICAtIEZsYXNoQmxvY2sgYnkgam9zb3JlayAwLjkuMzFcbiAqICAgICAtIEZsYXNoRnJlZSAxLjEuM1xuICogICAtIEZpcmVmb3ggNS4wLjEgKyBGbGFzaGJsb2NrIDEuNS4xNS4xXG4gKiAgIC0gT3BlcmEgMTEuNVxuICogICAtIFNhZmFyaSA1LjEgKyBDbGlja1RvRmxhc2ggKDIuMy4yKVxuICpcbiAqIEFsc28gdGhpcyB3cmFwcGVyIGNhbiByZW1vdmUgYmxvY2tlZCBzd2YgYW5kIGxldCB5b3UgZG93bmdyYWRlIHRvIG90aGVyIG9wdGlvbnMuXG4gKlxuICogRmVlbCBmcmVlIHRvIGNvbnRhY3QgbWUgdmlhIGVtYWlsLlxuICpcbiAqIENvcHlyaWdodCAyMDExLCBBbGV4ZXkgQW5kcm9zb3ZcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCAoaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHApIG9yIEdQTCBWZXJzaW9uIDMgKGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbCkgbGljZW5zZXMuXG4gKlxuICogVGhhbmtzIHRvIGZsYXNoYmxvY2tkZXRlY3RvciBwcm9qZWN0IChodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZmxhc2hibG9ja2RldGVjdG9yKVxuICpcbiAqIEByZXF1aXJlcyBzd2ZvYmplY3RcbiAqIEBhdXRob3IgQWxleGV5IEFuZHJvc292IDxkb29jaGlrQHlhLnJ1PlxuICogQHZlcnNpb24gMS4wXG4gKi9cblxudmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG5mdW5jdGlvbiByZW1vdmUobm9kZSkge1xuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbn1cblxuLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LfQsNCz0YDRg9C30LrQuCDRhNC70LXRiC3Qv9C70LXQtdGA0LAg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLRgdC70LXQttC40LLQsNC90LjRjyDQsdC70L7QutC40YDQvtCy0YnQuNC60L7QslxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZibi1zd2Ytd3JhcHBlclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIF9fU1dGX1dSQVBQRVJfQ0xBU1M6ICdmYm4tc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgX19URVNUUzogW1xuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvY2RuZ2lhZG1ua2hnZW1raW1raGlpbGdmZmJqaWpjaWUpXG4gICAgICAgIC8vIENob21lIEZsYXNoQmxvY2sgZXh0ZW5zaW9uIChodHRwczovL2Nocm9tZS5nb29nbGUuY29tL3dlYnN0b3JlL2RldGFpbC9nb2ZoamtqbWtwaW5ocG9pYWJqcGxvYmNhaWduYWJubClcbiAgICAgICAgZnVuY3Rpb24oc3dmTm9kZSwgd3JhcHBlck5vZGUpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cGVjdCB0aGF0IHN3ZiBpcyB0aGUgb25seSBjaGlsZCBvZiB3cmFwcGVyXG4gICAgICAgICAgICByZXR1cm4gd3JhcHBlck5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPiAxXG4gICAgICAgIH0sIC8vIG9sZGVyIFNhZmFyaSBDbGlja1RvRmxhc2ggKGh0dHA6Ly9yZW50enNjaC5naXRodWIuY29tL2NsaWNrdG9mbGFzaC8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIElFIGhhcyBubyBzd2ZOb2RlLnR5cGVcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnR5cGUgJiYgc3dmTm9kZS50eXBlICE9ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCdcbiAgICAgICAgfSwgLy8gRmxhc2hCbG9jayBmb3IgRmlyZWZveCAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAgICAgICAgLy8gQ2hyb21lIEZsYXNoRnJlZSAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZWJtaWVja2xsbW1pZmpqYmlwbnBwaW5waW9ocGZhaG0pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIC8vIHN3ZiBoYXZlIGJlZW4gZGV0YWNoZWQgZnJvbSBET01cbiAgICAgICAgICAgIHJldHVybiAhc3dmTm9kZS5wYXJlbnROb2RlO1xuICAgICAgICB9LCAvLyBTYWZhcmkgQ2xpY2tUb0ZsYXNoIEV4dGVuc2lvbiAoaHR0cDovL2hveW9pcy5naXRodWIuY29tL3NhZmFyaWV4dGVuc2lvbnMvY2xpY2t0b3BsdWdpbi8pXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzd2ZOb2RlLnBhcmVudE5vZGUuY2xhc3NOYW1lLmluZGV4T2YoJ0NURm5vZGlzcGxheScpID4gLTE7XG4gICAgICAgIH1cbiAgICBdLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRiBleGNlcHQgbGFzdCBwYXJhbSByZW1vdmVCbG9ja2VkU1dGLlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbcmVtb3ZlQmxvY2tlZFNXRj10cnVlXSBSZW1vdmUgc3dmIGlmIGJsb2NrZWRcbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbiwgcmVtb3ZlQmxvY2tlZFNXRikge1xuICAgICAgICAvLyB2YXIgc3dmb2JqZWN0ID0gd2luZG93Wydzd2ZvYmplY3QnXTtcblxuICAgICAgICBpZiAoIXN3Zm9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3dmRWxlbWVudCA9IGVbJ3JlZiddO1xuICAgICAgICAgICAgICAgICAgICAvLyBPcGVyYSAxMS41IGFuZCBhYm92ZSByZXBsYWNlcyBmbGFzaCB3aXRoIFNWRyBidXR0b25cbiAgICAgICAgICAgICAgICAgICAgLy8gbXNpZSAoYW5kIGNhbmFyeSBjaHJvbWUgMzIuMCkgY3Jhc2hlcyBvbiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKClcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGxhY2VkQnlTVkcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VkQnlTVkcgPSBzd2ZFbGVtZW50ICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10gJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlZEJ5U1ZHKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vc2V0IHRpbWVvdXQgdG8gbGV0IEZsYXNoQmxvY2sgcGx1Z2luIGRldGVjdCBzd2YgYW5kIHJlcGxhY2UgaXQgc29tZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFRFU1RTID0gRmxhc2hCbG9ja05vdGlmaWVyLl9fVEVTVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSBURVNUUy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFRFU1RTW2ldKHN3ZkVsZW1lbnQsIHdyYXBwZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZhaWx1cmUoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZsYXNoQmxvY2tOb3RpZmllci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZUJsb2NrZWRTV0YgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBzd2ZcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3Zm9iamVjdC5yZW1vdmVTV0YocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSB3cmFwcGVyXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUod3JhcHBlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVtb3ZlIGV4dGVuc2lvbiBhcnRlZmFjdHNcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9DbGlja1RvRmxhc2ggYXJ0ZWZhY3RzXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3RmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0NURnN0YWNrJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3RmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGN0Zik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2hyb21lIEZsYXNoQmxvY2sgYXJ0ZWZhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsYXN0Qm9keUNoaWxkID0gZG9jdW1lbnQuYm9keS5sYXN0Q2hpbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdEJvZHlDaGlsZCAmJiBsYXN0Qm9keUNoaWxkLmNsYXNzTmFtZSA9PSAndWpzX2ZsYXNoYmxvY2tfcGxhY2Vob2xkZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGxhc3RCb2R5Q2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGUuc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBlLl9fZmJuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4iLCJ2YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgRmxhc2hFbWJlZGRlciA9IHtcblxuICAgIC8qKlxuICAgICAqIENTUy1jbGFzcyBmb3Igc3dmIHdyYXBwZXIuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBkZWZhdWx0IGZlbWItc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmVtYi1zd2Ytd3JhcHBlcicsXG5cbiAgICAvKipcbiAgICAgKiBUaW1lb3V0IGZvciBmbGFzaCBibG9jayBkZXRlY3RcbiAgICAgKiBAZGVmYXVsdCA1MDBcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgX19USU1FT1VUOiA1MDAsXG5cbiAgICAvKipcbiAgICAgKiBFbWJlZCBTV0YgaW5mbyBwYWdlLiBUaGlzIGZ1bmN0aW9uIGhhcyBzYW1lIG9wdGlvbnMgYXMgc3dmb2JqZWN0LmVtYmVkU1dGXG4gICAgICogQHNlZSBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvYXBpXG4gICAgICogQHBhcmFtIHN3ZlVybFN0clxuICAgICAqIEBwYXJhbSByZXBsYWNlRWxlbUlkU3RyXG4gICAgICogQHBhcmFtIHdpZHRoU3RyXG4gICAgICogQHBhcmFtIGhlaWdodFN0clxuICAgICAqIEBwYXJhbSBzd2ZWZXJzaW9uU3RyXG4gICAgICogQHBhcmFtIHhpU3dmVXJsU3RyXG4gICAgICogQHBhcmFtIGZsYXNodmFyc09ialxuICAgICAqIEBwYXJhbSBwYXJPYmpcbiAgICAgKiBAcGFyYW0gYXR0T2JqXG4gICAgICogQHBhcmFtIGNhbGxiYWNrRm5cbiAgICAgKi9cbiAgICBlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLFxuICAgICAgICAgICAgICAgICAgICAgICBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbikge1xuICAgICAgICBzd2ZvYmplY3QuYWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHJlcGxhY2VFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocmVwbGFjZUVsZW1JZFN0cik7XG4gICAgICAgICAgICBpZiAoIXJlcGxhY2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSBuZWVkIHRvIGNyZWF0ZSBkaXYtd3JhcHBlciBiZWNhdXNlIHNvbWUgZmxhc2ggYmxvY2sgcGx1Z2lucyByZXBsYWNlIHN3ZiB3aXRoIGFub3RoZXIgY29udGVudC5cbiAgICAgICAgICAgIC8vIEFsc28gc29tZSBmbGFzaCByZXF1aXJlcyB3cmFwcGVyIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSBGbGFzaEVtYmVkZGVyLl9fU1dGX1dSQVBQRVJfQ0xBU1M7XG5cbiAgICAgICAgICAgIHJlcGxhY2VFbGVtZW50LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHdyYXBwZXIsIHJlcGxhY2VFbGVtZW50KTtcbiAgICAgICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQocmVwbGFjZUVsZW1lbnQpO1xuXG4gICAgICAgICAgICBzd2ZvYmplY3QuZW1iZWRTV0Yoc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIC8vIGUuc3VjY2VzcyA9PT0gZmFsc2UgbWVhbnMgdGhhdCBicm93c2VyIGRvbid0IGhhdmUgZmxhc2ggb3IgZmxhc2ggaXMgdG9vIG9sZFxuICAgICAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAgICAgICAgICAgIGlmICghZSB8fCBlLnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEVtYmVkZGVyLl9fVElNRU9VVCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBvbkZhaWx1cmUoZSkge1xuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tGbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaEVtYmVkZGVyO1xuIiwidmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xudmFyIEZsYXNoQmxvY2tOb3RpZmllciA9IHJlcXVpcmUoJy4vZmxhc2hibG9ja25vdGlmaWVyJyk7XG52YXIgRmxhc2hFbWJlZGRlciA9IHJlcXVpcmUoJy4vZmxhc2hlbWJlZGRlcicpO1xudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xuXG52YXIgd2luU2FmYXJpID0gZGV0ZWN0LnBsYXRmb3JtLm9zID09PSAnd2luZG93cycgJiYgZGV0ZWN0LmJyb3dzZXIubmFtZSA9PT0gJ3NhZmFyaSc7XG5cbnZhciBDT05UQUlORVJfQ0xBU1MgPSBcInlhLWZsYXNoLXBsYXllci13cmFwcGVyXCI7XG5cbi8qKlxuICog0JfQsNCz0YDRg9C30YfQuNC6INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICpcbiAqIEBhbGlhcyBGbGFzaE1hbmFnZXJ+Zmxhc2hMb2FkZXJcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0g0KHRgdGL0LvQutCwINC90LAg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge3N0cmluZ30gbWluVmVyc2lvbiAtINC80LjQvdC40LzQsNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBpZCAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGxvYWRDYWxsYmFjayAtINC60L7Qu9Cx0LXQuiDQtNC70Y8g0YHQvtCx0YvRgtC40Y8g0LfQsNCz0YDRg9C30LrQuFxuICogQHBhcmFtIHtvYmplY3R9IGZsYXNoVmFycyAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQstCw0LXQvNGL0LUg0LLQviDRhNC70LXRiFxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyIC0g0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQstC40LTQuNC80L7Qs9C+INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVYIC0g0YDQsNC30LzQtdGAINC/0L4g0LPQvtGA0LjQt9C+0L3RgtCw0LvQuFxuICogQHBhcmFtIHtzdHJpbmd9IHNpemVZIC0g0YDQsNC30LzQtdGAINC/0L4g0LLQtdGA0YLQuNC60LDQu9C4XG4gKlxuICogQHJldHVybnMge0hUTUxFbGVtZW50fSAtLSDQmtC+0L3RgtC10LnQvdC10YAg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsLCBtaW5WZXJzaW9uLCBpZCwgbG9hZENhbGxiYWNrLCBmbGFzaFZhcnMsIGNvbnRhaW5lciwgc2l6ZVgsIHNpemVZKSB7XG4gICAgdmFyICRmbGFzaFBsYXllciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgJGZsYXNoUGxheWVyLmlkID0gXCJ3cmFwcGVyX1wiICsgaWQ7XG4gICAgJGZsYXNoUGxheWVyLmlubmVySFRNTCA9ICc8ZGl2IGlkPVwiJyArIGlkICsgJ1wiPjwvZGl2Pic7XG5cbiAgICBzaXplWCA9IHNpemVYIHx8IFwiMTAwMFwiO1xuICAgIHNpemVZID0gc2l6ZVkgfHwgXCIxMDAwXCI7XG5cbiAgICB2YXIgZW1iZWRkZXIsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG9wdGlvbnM7XG5cbiAgICBpZiAoY29udGFpbmVyICYmICF3aW5TYWZhcmkpIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEVtYmVkZGVyO1xuICAgICAgICBmbGFzaFNpemVYID0gc2l6ZVg7IGZsYXNoU2l6ZVkgPSBzaXplWTtcbiAgICAgICAgb3B0aW9ucyA9IHsgYWxsb3dzY3JpcHRhY2Nlc3M6IFwiYWx3YXlzXCIsIHdtb2RlOiBcInRyYW5zcGFyZW50XCIgfTtcblxuICAgICAgICAkZmxhc2hQbGF5ZXIuY2xhc3NOYW1lID0gQ09OVEFJTkVSX0NMQVNTO1xuICAgICAgICAkZmxhc2hQbGF5ZXIuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW1iZWRkZXIgPSBGbGFzaEJsb2NrTm90aWZpZXI7XG4gICAgICAgIGZsYXNoU2l6ZVggPSBmbGFzaFNpemVZID0gXCIxXCI7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiAtMXB4OyB0b3A6IC0xcHg7IHdpZHRoOiAwcHg7IGhlaWdodDogMHB4OyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoJGZsYXNoUGxheWVyKTtcbiAgICB9XG5cbiAgICBlbWJlZGRlci5lbWJlZFNXRihcbiAgICAgICAgdXJsLFxuICAgICAgICBpZCxcbiAgICAgICAgZmxhc2hTaXplWCxcbiAgICAgICAgZmxhc2hTaXplWSxcbiAgICAgICAgbWluVmVyc2lvbixcbiAgICAgICAgXCJcIixcbiAgICAgICAgZmxhc2hWYXJzLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB7fSxcbiAgICAgICAgbG9hZENhbGxiYWNrXG4gICAgKTtcblxuICAgIHJldHVybiAkZmxhc2hQbGF5ZXI7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgeyAvLyDRgdC+0YXRgNCw0L3Rj9C10YLRgdGPINCyIGxvY2Fsc3RvcmFnZVxuICAgICAgICBcImlkXCI6IFwiY3VzdG9tXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IDAsXG4gICAgICAgIFwiYmFuZHNcIjogWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJkZWZhdWx0XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IDAsXG4gICAgICAgIFwiYmFuZHNcIjogWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJDbGFzc2ljYWxcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTAuNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTMuNSwgLTMuNSwgLTMuNSwgLTQuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkNsdWJcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuMzU5OTk5ODk1MDk1ODI1LFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAtMC41LCA0LCAyLjUsIDIuNSwgMi41LCAxLjUsIC0wLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJEYW5jZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi4xNTk5OTk4NDc0MTIxMDk0LFxuICAgICAgICBcImJhbmRzXCI6IFs0LjUsIDMuNSwgMSwgLTAuNSwgLTAuNSwgLTIuNSwgLTMuNSwgLTMuNSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgQmFzc1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy41OTk5OTk5MDQ2MzI1Njg0LFxuICAgICAgICBcImJhbmRzXCI6IFs0LCA0LjUsIDQuNSwgMi41LCAwLjUsIC0yLCAtNCwgLTUsIC01LjUsIC01LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIEJhc3MgJiBUcmVibGVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuMDM5OTk5OTYxODUzMDI3LFxuICAgICAgICBcImJhbmRzXCI6IFszLjUsIDIuNSwgLTAuNSwgLTMuNSwgLTIsIDAuNSwgNCwgNS41LCA2LCA2XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBUcmVibGVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTYsXG4gICAgICAgIFwiYmFuZHNcIjogWy00LjUsIC00LjUsIC00LjUsIC0yLCAxLCA1LjUsIDgsIDgsIDgsIDhdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMYXB0b3AgU3BlYWtlcnMgLyBIZWFkcGhvbmVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTQuMDc5OTk5OTIzNzA2MDU1LFxuICAgICAgICBcImJhbmRzXCI6IFsyLCA1LjUsIDIuNSwgLTEuNSwgLTEsIDAuNSwgMiwgNC41LCA2LCA3XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGFyZ2UgSGFsbFwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy41OTk5OTk5MDQ2MzI1Njg0LFxuICAgICAgICBcImJhbmRzXCI6IFs1LCA1LCAyLjUsIDIuNSwgLTAuNSwgLTIsIC0yLCAtMiwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxpdmVcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTIsIC0wLjUsIDIsIDIuNSwgMi41LCAyLjUsIDIsIDEsIDEsIDFdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJQYXJ0eVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi42Mzk5OTk4NjY0ODU1OTU3LFxuICAgICAgICBcImJhbmRzXCI6IFszLjUsIDMuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgLTAuNSwgMy41LCAzLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJQb3BcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuMTE5OTk5ODg1NTU5MDgyLFxuICAgICAgICBcImJhbmRzXCI6IFstMC41LCAyLCAzLjUsIDQsIDIuNSwgLTAuNSwgLTEsIC0xLCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUmVnZ2FlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00LjA3OTk5OTkyMzcwNjA1NSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgLTAuNSwgLTIuNSwgLTAuNSwgMywgMywgLTAuNSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlJvY2tcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuMDM5OTk5OTYxODUzMDI3LFxuICAgICAgICBcImJhbmRzXCI6IFs0LCAyLCAtMi41LCAtNCwgLTEuNSwgMiwgNCwgNS41LCA1LjUsIDUuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlNrYVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNS41MTk5OTk5ODA5MjY1MTQsXG4gICAgICAgIFwiYmFuZHNcIjogWy0xLCAtMiwgLTIsIC0wLjUsIDIsIDIuNSwgNCwgNC41LCA1LjUsIDQuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlNvZnRcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTQuNzk5OTk5NzEzODk3NzA1LFxuICAgICAgICBcImJhbmRzXCI6IFsyLCAwLjUsIC0wLjUsIC0xLCAtMC41LCAyLCA0LCA0LjUsIDUuNSwgNl1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlNvZnQgUm9ja1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtMi42Mzk5OTk4NjY0ODU1OTU3LFxuICAgICAgICBcImJhbmRzXCI6IFsyLCAyLCAxLCAtMC41LCAtMiwgLTIuNSwgLTEuNSwgLTAuNSwgMSwgNF1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlRlY2hub1wiLFxuICAgICAgICBcInByZWFtcFwiOiAtMy44Mzk5OTk5MTQxNjkzMTE1LFxuICAgICAgICBcImJhbmRzXCI6IFs0LCAyLjUsIC0wLjUsIC0yLjUsIC0yLCAtMC41LCA0LCA0LjUsIDQuNSwgNF1cbiAgICB9XG5dO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2xpYi9hc3luYy9ldmVudHMnKTtcblxuLyoqXG4gKiDQntC/0LjRgdCw0L3QuNC1INC90LDRgdGC0YDQvtC10Log0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHR5cGVkZWYge09iamVjdH0geWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldFxuICpcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBbaWRdIC0g0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YAg0L3QsNGB0YLRgNC+0LXQulxuICogQHByb3BlcnR5IHtOdW1iZXJ9IHByZWFtcCAtINC/0YDQtdC00YPRgdC40LvQuNGC0LXQu9GMXG4gKiBAcHJvcGVydHkge0FycmF5LjxOdW1iZXI+fSAtINC30L3QsNGH0LXQvdC40Y8g0LTQu9GPINC/0L7Qu9C+0YEg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICovXG5cbi8qKlxuICog0KHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC/0L7Qu9C+0YHRiyDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uZnguRXF1YWxpemVyLkVWRU5UX0NIQU5HRX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8uZnguRXF1YWxpemVyI2NoYW5nZVxuICogQHBhcmFtIHtOdW1iZXJ9IGZyZXEgLSDRh9Cw0YHRgtC+0YLQsCDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0g0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKi9cblxuLyoqXG4gKiDQrdC60LLQsNC70LDQudC30LXRgFxuICogQGFsaWFzIHlhLkF1ZGlvLmZ4LkVxdWFsaXplclxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtINC60L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSVxuICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gYmFuZHMgLSDRgdC/0LjRgdC+0Log0YfQsNGB0YLQvtGCINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8uZnguRXF1YWxpemVyI2NoYW5nZVxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRXF1YWxpemVyID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCBiYW5kcykge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5wcmVhbXAgPSBuZXcgRXF1YWxpemVyQmFuZChhdWRpb0NvbnRleHQsIFwiaGlnaHNoZWxmXCIsIDApO1xuICAgIHRoaXMucHJlYW1wLm9uKFwiKlwiLCB0aGlzLl9vbkJhbmRFdmVudC5iaW5kKHRoaXMsIHRoaXMucHJlYW1wKSk7XG5cbiAgICB2YXIgcHJldjtcbiAgICB0aGlzLmJhbmRzID0gYmFuZHMubWFwKGZ1bmN0aW9uKGZyZXF1ZW5jeSwgaWR4KSB7XG4gICAgICAgIHZhciBiYW5kID0gbmV3IEVxdWFsaXplckJhbmQoXG4gICAgICAgICAgICBhdWRpb0NvbnRleHQsXG5cbiAgICAgICAgICAgIGlkeCA9PSAwID8gJ2xvd3NoZWxmJ1xuICAgICAgICAgICAgICAgIDogaWR4ICsgMSA8IGJhbmRzLmxlbmd0aCA/IFwicGVha2luZ1wiXG4gICAgICAgICAgICAgICAgOiBcImhpZ2hzaGVsZlwiLFxuXG4gICAgICAgICAgICBmcmVxdWVuY3lcbiAgICAgICAgKTtcbiAgICAgICAgYmFuZC5vbihcIipcIiwgdGhpcy5fb25CYW5kRXZlbnQuYmluZCh0aGlzLCBiYW5kKSk7XG5cbiAgICAgICAgaWYgKCFwcmV2KSB7XG4gICAgICAgICAgICB0aGlzLnByZWFtcC5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcmV2LmZpbHRlci5jb25uZWN0KGJhbmQuZmlsdGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByZXYgPSBiYW5kO1xuICAgICAgICByZXR1cm4gYmFuZDtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5pbnB1dCA9IHRoaXMucHJlYW1wLmZpbHRlcjtcbiAgICB0aGlzLm91dHB1dCA9IHRoaXMuYmFuZHNbdGhpcy5iYW5kcy5sZW5ndGggLSAxXS5maWx0ZXI7XG59O1xuXG5FdmVudHMubWl4aW4oRXF1YWxpemVyKTtcblxuLyoqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkVWRU5UX0NIQU5HRSA9IFwiY2hhbmdlXCI7XG5cbi8qKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfQkFORFMgPSBbNjAsIDE3MCwgMzEwLCA2MDAsIDEwMDAsIDMwMDAsIDYwMDAsIDEyMDAwLCAxNDAwMCwgMTYwMDBdO1xuXG4vKiogQHR5cGUge09iamVjdC48U3RyaW5nLCB5YS5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyUHJlc2V0Pn1cbiAqIEBjb25zdFxuICovXG5FcXVhbGl6ZXIuREVGQVVMVF9QUkVTRVRTID0gcmVxdWlyZSgnLi9kZWZhdWx0LnByZXNldHMuanMnKTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtC60LAg0YHQvtCx0YvRgtC40Y8g0L/QvtC70L7RgdGLINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBwYXJhbSB7RXF1YWxpemVyQmFuZH0gYmFuZCAtINC/0L7Qu9C+0YHQsCDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1INGB0L7QsdGL0YLQuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLl9vbkJhbmRFdmVudCA9IGZ1bmN0aW9uKGJhbmQsIGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBiYW5kLmdldEZyZXEoKSwgZGF0YSk7XG59O1xuXG4vKipcbiAqINCX0LDQs9GA0YPQt9C40YLRjCDQvdCw0YHRgtGA0L7QudC60LhcbiAqIEBwYXJhbSB7eWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldH0gcHJlc2V0IC0g0L3QsNGB0YLRgNC+0LnQutC4XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUubG9hZFByZXNldCA9IGZ1bmN0aW9uKHByZXNldCkge1xuICAgIHByZXNldC5iYW5kcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBpZHgpIHtcbiAgICAgICAgdGhpcy5iYW5kc1tpZHhdLnNldFZhbHVlKHZhbHVlKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMucHJlYW1wLnNldFZhbHVlKHByZXNldC5wcmVhbXApO1xufTtcblxuLyoqXG4gKiDQodC+0YXRgNCw0L3QuNGC0Ywg0YLQtdC60YPRidC40LUg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcmV0dXJucyB7eWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldH1cbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5zYXZlUHJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJlYW1wOiB0aGlzLnByZWFtcC5nZXRWYWx1ZSgpLFxuICAgICAgICBiYW5kczogdGhpcy5iYW5kcy5tYXAoZnVuY3Rpb24oYmFuZCkgeyByZXR1cm4gYmFuZC5nZXRWYWx1ZSgpOyB9KVxuICAgIH07XG59O1xuXG4vL1RPRE86INC/0YDQvtCy0LXRgNC40YLRjCDQv9GA0LXQtNC/0L7Qu9C+0LbQtdC90LjQtSAo0YHQutC+0YDQtdC1INCy0YHQtdCz0L4g0L3Rg9C20L3QsCDQutCw0YDRgtCwINCy0LXRgdC+0LIg0LTQu9GPINGA0LDQt9C70LjRh9C90YvRhSDRh9Cw0YHRgtC+0YIg0LjQu9C4INC00LDQttC1INC90LXQutCw0Y8g0YTRg9C90LrRhtC40Y8pXG4vKipcbiAqICoq0K3QutGB0L/QtdGA0LjQvNC10L3RgtCw0LvRjNC90L4qKiAtINCy0YvRh9C40LvRj9C10YIg0L7Qv9GC0LjQvNCw0LvRjNC90L7QtSDQt9C90LDRh9C90LjQtSDQv9GA0LXQtNGD0YHQuNC70LXQvdC40Y9cbiAqIEBleHBlcmltZW50YWxcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuZ3Vlc3NQcmVhbXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdiA9IDA7XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSB0aGlzLmJhbmRzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICB2ICs9IHRoaXMuYmFuZHNba10uZ2V0VmFsdWUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gLXYgLyAyO1xufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gINCk0LjQu9GM0YLRgCDRjdC60LLQsNC70LDQudC30LXRgNCwXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQt9C90LDRh9C10L3QuNGPINGD0YHQuNC70LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5meC5FcXVhbGl6ZXIuRVZFTlRfQ0hBTkdFfSlcbiAqIEBldmVudCB5YS5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZCNjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC90L7QstC+0LUg0LfQvdCw0YfQtdC90LjQtVxuICovXG5cbi8qKlxuICog0J/QvtC70L7RgdCwINC/0YDQvtC/0YPRgdC60LDQvdC40Y8g0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQGFsaWFzIHlhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJCYW5kXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQHBhcmFtIHtBdWRpb0NvbnRleHR9IGF1ZGlvQ29udGV4dCAtINC60L7QvdGC0LXQutGB0YIgV2ViIEF1ZGlvIEFQSVxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgLSDRgtC40L8g0YTQuNC70YzRgtGA0LBcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxdWVuY3kgLSDRh9Cw0YHRgtC+0YLQsCDRhNC40LvRjNGC0YDQsFxuICpcbiAqIEBmaXJlcyB5YS5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZCNjaGFuZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplckJhbmQgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQsIHR5cGUsIGZyZXF1ZW5jeSkge1xuICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy50eXBlID0gdHlwZTtcblxuICAgIHRoaXMuZmlsdGVyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgIHRoaXMuZmlsdGVyLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuZmlsdGVyLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICB0aGlzLmZpbHRlci5RLnZhbHVlID0gMTtcbiAgICB0aGlzLmZpbHRlci5nYWluLnZhbHVlID0gMDtcbn07XG5FdmVudHMubWl4aW4oRXF1YWxpemVyQmFuZCk7XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRh9Cw0YHRgtC+0YLRgyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0RnJlcSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWU7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmZpbHRlci5nYWluLnZhbHVlO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INGD0YHQuNC70LXQvdC40Y9cbiAqIEBwYXJhbSB2YWx1ZVxuICovXG5FcXVhbGl6ZXJCYW5kLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcihFcXVhbGl6ZXIuRVZFTlRfQ0hBTkdFLCB2YWx1ZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVxdWFsaXplcjtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5BdWRpby5meC5FcXVhbGl6ZXIgPSByZXF1aXJlKCcuL2VxdWFsaXplcicpO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnlhLkF1ZGlvLmZ4ID0ge307XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvSFRNTDUnKTtcblxudmFyIGRldGVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9hc3luYy9ldmVudHMnKTtcbnZhciBBdWRpb1N0YXRpYyA9IHJlcXVpcmUoJy4uL2F1ZGlvLXN0YXRpYycpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci9wbGF5YmFjay1lcnJvcicpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG5leHBvcnRzLmF2YWlsYWJsZSA9IChmdW5jdGlvbigpIHtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0g0JHQsNC30L7QstCw0Y8g0L/RgNC+0LLQtdGA0LrQsCDQv9C+0LTQtNC10YDQttC60Lgg0LHRgNCw0YPQt9C10YDQvtC8XG4gICAgdmFyIGh0bWw1X2F2YWlsYWJsZSA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgICAgLy9zb21lIGJyb3dzZXJzIGRvZXNuJ3QgdW5kZXJzdGFuZCBuZXcgQXVkaW8oKVxuICAgICAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgICAgICB2YXIgY2FuUGxheSA9IGF1ZGlvLmNhblBsYXlUeXBlKFwiYXVkaW8vbXBlZ1wiKTtcbiAgICAgICAgaWYgKCFjYW5QbGF5IHx8IGNhblBsYXkgPT09ICdubycpIHtcblxuICAgICAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggcmVhc29uXCIsIGNhblBsYXkpO1xuICAgICAgICAgICAgaHRtbDVfYXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJIVE1MNSBkZXRlY3Rpb24gZmFpbGVkIHdpdGggZXJyb3JcIiwgZSk7XG4gICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGh0bWw1X2F2YWlsYWJsZSk7XG4gICAgcmV0dXJuIGh0bWw1X2F2YWlsYWJsZTtcbn0pKCk7XG5cbnRyeSB7XG4gICAgdmFyIGF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIldlbkF1ZGlvQVBJIGNvbnRleHQgY3JlYXRlZFwiKTtcbn0gY2F0Y2goZSkge1xuICAgIGF1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJXZW5BdWRpb0FQSSBub3QgZGV0ZWN0ZWRcIik7XG59XG5cbi8qKlxuICogQGNsYXNzINCa0LvQsNGB0YEgaHRtbDUg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBleHRlbmRzIElBdWRpb0ltcGxlbWVudGF0aW9uXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BsYXlcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlbmRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3ZvbHVtZWNoYW5nZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2NyYXNoZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzd2FwXG4gKlxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N0b3BcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwYXVzZVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3Byb2dyZXNzXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGluZ1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2Vycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9IVE1MNSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmFtZSA9IHBsYXllcklkKys7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiY29uc3RydWN0b3JcIik7XG5cbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcbiAgICB0aGlzLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQgIT09IEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKSB7XG4gICAgICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJvbkV2ZW50XCIsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLndlYkF1ZGlvQXBpID0gZmFsc2U7XG5cbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9IDA7XG5cbiAgICB0aGlzLmxvYWRlcnMgPSBbXTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuXG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG4gICAgdGhpcy5fYWRkTG9hZGVyKCk7XG5cbiAgICB0aGlzLl9zZXRBY3RpdmUoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvSFRNTDUpO1xuQXVkaW9IVE1MNS50eXBlID0gQXVkaW9IVE1MNS5wcm90b3R5cGUudHlwZSA9IFwiaHRtbDVcIjtcblxuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfUExBWSA9IFwicGxheVwiO1xuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC/0LDRg9C30YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfUEFVU0UgPSBcInBhdXNlXCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40LUg0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX1RJTUVVUERBVEUgPSBcInRpbWV1cGRhdGVcIjtcbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0VOREVEID0gXCJlbmRlZFwiO1xuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfRFVSQVRJT04gPSBcImR1cmF0aW9uY2hhbmdlXCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LjQt9C80LXQvdC10L3QuNGPINC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfTE9BRElORyA9IFwicHJvZ3Jlc3NcIjtcbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4INC80LXRgtCwLdC00LDQvdC90YvRhSDRgtGA0LXQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX01FVEEgPSBcImxvYWRlZG1ldGFkYXRhXCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LLQvtC30LzQvtC20L3QvtGB0YLQuCDQvdCw0YfQsNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0NBTlBMQVkgPSBcImNhbnBsYXlcIjtcbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfRVJST1IgPSBcImVycm9yXCI7XG5cbi8qKlxuICog0JTQvtCx0LDQstC40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0LDRg9C00LjQvi3RhNCw0LnQu9C+0LJcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9hZGRMb2FkZXIgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfYWRkTG9hZGVyXCIpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGxvYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2F1ZGlvJyk7XG4gICAgdmFyIGxpc3RlbmVyID0gbmV3IEV2ZW50cygpO1xuXG4gICAgbG9hZGVyLmxvb3AgPSBmYWxzZTsgLy8gZm9yIElFXG4gICAgbG9hZGVyLnByZWxvYWQgPSBsb2FkZXIuYXV0b2J1ZmZlciA9IFwiYXV0b1wiOyAvLyAxMDAlXG5cbiAgICBsb2FkZXIuc3RhcnRQbGF5ID0gZnVuY3Rpb24oKSB7IC8vSU5GTzog0Y3RgtCwINC60L7QvdGB0YLRgNGD0LrRhtC40Y8g0L3Rg9C20L3QsCwg0YfRgtC+0LHRiyDQvdC1INC80LXQvdGP0YLRjCDQu9C+0LPQuNC60YMg0L/RgNC4IHJlc3VtZVxuICAgICAgICBsb2FkZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9NRVRBLCBsb2FkZXIuc3RhcnRQbGF5KTtcbiAgICAgICAgbG9hZGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgbG9hZGVyLnN0YXJ0UGxheSk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvYWRlci5wbGF5KCk7XG4gICAgICAgICAgICBsb2dnZXIuZGVidWcoc2VsZiwgXCJzdGFydFBsYXlcIik7XG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKHNlbGYsIFwiY3Jhc2hlZFwiLCBlKTtcbiAgICAgICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfQ1JBU0hFRCwgZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIGxhc3RVcGRhdGUgPSAwO1xuICAgIHZhciB1cGRhdGVQcm9ncmVzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3VycmVudFRpbWUgPSArbmV3IERhdGUoKTtcbiAgICAgICAgaWYgKGN1cnJlbnRUaW1lIC0gbGFzdFVwZGF0ZSA8IDMwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0VXBkYXRlID0gY3VycmVudFRpbWU7XG4gICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfUFJPR1JFU1MpO1xuICAgIH07XG5cbiAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9QQVVTRSwgbGlzdGVuZXIudHJpZ2dlci5iaW5kKGxpc3RlbmVyLCBBdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSkpO1xuICAgIGxvYWRlci5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX1BMQVksIGxpc3RlbmVyLnRyaWdnZXIuYmluZChsaXN0ZW5lciwgQXVkaW9TdGF0aWMuRVZFTlRfUExBWSkpO1xuXG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfRU5ERUQsIGZ1bmN0aW9uKCkge1xuICAgICAgICBsaXN0ZW5lci50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKTtcbiAgICAgICAgbGlzdGVuZXIudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9FTkRFRCk7XG4gICAgfSk7XG5cbiAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9USU1FVVBEQVRFLCB1cGRhdGVQcm9ncmVzcyk7XG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfRFVSQVRJT04sIHVwZGF0ZVByb2dyZXNzKTtcbiAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9MT0FESU5HLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdXBkYXRlUHJvZ3Jlc3MoKTtcblxuICAgICAgICBpZiAobG9hZGVyLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGxvYWRlZCA9IGxvYWRlci5idWZmZXJlZC5lbmQoMCkgLSBsb2FkZXIuYnVmZmVyZWQuc3RhcnQoMCk7XG5cbiAgICAgICAgICAgIGlmIChsb2FkZXIubm90TG9hZGluZyAmJiBsb2FkZWQpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXIubm90TG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfTE9BRElORyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsb2FkZWQgPj0gbG9hZGVkLmR1cmF0aW9uIC0gMC4xKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9FUlJPUiwgZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoIWxvYWRlci5mYWtlKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgUGxheWJhY2tFcnJvcihsb2FkZXIuZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgPyBQbGF5YmFja0Vycm9yLmh0bWw1W2xvYWRlci5lcnJvci5jb2RlXVxuICAgICAgICAgICAgICAgICAgICA6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IGUsXG4gICAgICAgICAgICAgICAgbG9hZGVyLnNyYyk7XG5cbiAgICAgICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfRVJST1IsIGVycm9yKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGlzdGVuZXIub24oXCIqXCIsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHZhciBvZmZzZXQgPSAoc2VsZi5sb2FkZXJzLmxlbmd0aCArIGxvYWRlci5pbmRleCAtIHNlbGYuYWN0aXZlTG9hZGVyKSAlIHNlbGYubG9hZGVycy5sZW5ndGg7XG4gICAgICAgIHNlbGYudHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9KTtcblxuICAgIGxvYWRlci5pbmRleCA9IHRoaXMubG9hZGVycy5wdXNoKGxvYWRlcikgLSAxO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgdmFyIGluaXRMb2FkZXIgPSB0aGlzLl9pbml0TG9hZGVyLmJpbmQodGhpcywgbG9hZGVyKTtcbiAgICBsb2FkZXIuX19pbml0TG9hZGVyID0gaW5pdExvYWRlcjtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgaW5pdExvYWRlcik7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBpbml0TG9hZGVyKTtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaHN0YXJ0XCIsIGluaXRMb2FkZXIpO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgdGhpcy5fYWRkU291cmNlKGxvYWRlcik7XG4gICAgfVxufTtcblxuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2luaXRMb2FkZXIgPSBmdW5jdGlvbihsb2FkZXIpIHtcbiAgICBsb2FkZXIucGxheSgpO1xuICAgIGxvYWRlci5wYXVzZSgpO1xuICAgIC8vIElORk86INC00YPQsdC70LjRgNC+0LLQsNC90LjQtSDQvdGD0LbQvdC+INC00LvRjyDRgtGD0L/Ri9GFINC80L7QsdC40LssINC60L7RgtC+0YDRi9C1INC90LUg0L/QvtC90LjQvNCw0Y7RgiDRgSDQv9C10YDQstC+0LPQviDRgNCw0LfQsCDRgtC40L/QsCBJRVxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgbG9hZGVyLnBhdXNlKCk7IH0sIDApO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBsb2FkZXIuX19pbml0TG9hZGVyKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGxvYWRlci5fX2luaXRMb2FkZXIpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgbG9hZGVyLl9faW5pdExvYWRlcik7XG4gICAgZGVsZXRlIGxvYWRlci5fX2luaXRMb2FkZXI7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMICjQtdGB0LvQuCDQvdC10L7QsdGF0L7QtNC40LzQvikg0Lgg0L/QvtC00LrQu9GO0YfQuNGC0Ywg0LjRgdGC0L7Rh9C90LjQuiDQt9Cy0YPQutCwINC00LvRjyBXZWIgQXVkaW8gQVBJXG4gKiBAcGFyYW0ge0F1ZGlvfSBsb2FkZXIgLSDQt9Cw0LPRgNGD0LfRh9C40Log0LDRg9C00LjQvlxuICogQHBhcmFtIHtBdWRpb05vZGV9IHNvdXJjZSAtINGN0LrQt9C10LzQv9C70Y/RgCDQuNGB0YLQvtGH0L3QuNC60LAg0LfQstGD0LrQsFxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2FkZFNvdXJjZSA9IGZ1bmN0aW9uKGxvYWRlciwgc291cmNlKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZFNvdXJjZVwiLCBsb2FkZXIpO1xuXG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZShsb2FkZXIpO1xuICAgICAgICB0aGlzLnNvdXJjZXMucHVzaChzb3VyY2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHNvdXJjZS5jb25uZWN0KHRoaXMucHJlcHJvY2Vzc29yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzb3VyY2UuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINCw0LrRgtC40LLQvdGL0Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcGFyYW0ge2ludH0gb2Zmc2V0IC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fc2V0QWN0aXZlID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3NldEFjdGl2ZVwiLCBvZmZzZXQpO1xuXG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAodGhpcy5hY3RpdmVMb2FkZXIgKyBvZmZzZXQpICUgdGhpcy5sb2FkZXJzLmxlbmd0aDtcbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfU1dBUCwgb2Zmc2V0KTtcblxuICAgIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgLy9JTkZPOiDQtdGB0LvQuCDRgNC10LvQuNC30L7QstGL0LLQsNGC0Ywg0LrQvtC90YbQtdC/0YbQuNGOINC80L3QvtC20LXRgdGC0LLQsCDQt9Cw0LPRgNGD0LfRh9C40LrQvtCyLCDRgtC+INGN0YLQviDQvdGD0LbQvdC+INC00L7RgNCw0LHQvtGC0LDRgtGMLlxuICAgICAgICB0aGlzLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INC4INC+0YLQv9C40YHQsNGC0Ywg0LXQs9C+INC+0YIg0YHQvtCx0YvRgtC40Lkg0YHRgtCw0YDRgtCwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtCb29sZWFufSB1bnN1YnNjcmliZSAtINC+0YLQv9C40YHQsNGC0YzRgdGPINC+0YIg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtBdWRpb31cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9nZXRMb2FkZXIgPSBmdW5jdGlvbih1bnN1YnNjcmliZSwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMubG9hZGVyc1sodGhpcy5hY3RpdmVMb2FkZXIgKyBvZmZzZXQpICUgdGhpcy5sb2FkZXJzLmxlbmd0aF07XG4gICAgaWYgKHVuc3Vic2NyaWJlKSB7XG4gICAgICAgIGxvYWRlci5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX01FVEEsIGxvYWRlci5zdGFydFBsYXkpO1xuICAgICAgICBsb2FkZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9DQU5QTEFZLCBsb2FkZXIuc3RhcnRQbGF5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbG9hZGVyO1xufTtcblxuLy9JTkZPOiDRjdGC0LAg0LrQvtC90YHRgtGA0YPQutGG0LjRjyDQvdGD0LbQvdCwLCDRh9GC0L7QsdGLINC90LUg0LzQtdC90Y/RgtGMINC70L7Qs9C40LrRgyDQv9GA0LggcmVzdW1lXG4vKipcbiAqINCX0LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7QXVkaW99IGxvYWRlciAtINC30LDQs9GA0YPQt9GH0LjQuiDQsNGD0LTQuNC+XG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fcGxheSA9IGZ1bmN0aW9uKGxvYWRlcikge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9wbGF5XCIpO1xuXG4gICAgaWYgKGxvYWRlci5yZWFkeVN0YXRlID4gbG9hZGVyLkhBVkVfTUVUQURBVEEpIHtcbiAgICAgICAgbG9hZGVyLnN0YXJ0UGxheSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGZpcmVmb3ggd2FpdHMgdG9vIGxvbmcgdGlsbCAnY2FucGxheScgb3IgJ2NhbnBsYXl0aHJvdWdoJ1xuICAgICAgICAvLyBidXQgaXQgY2FuIHBsYXkgcmlnaHQgYWZ0ZXIgJ2xvYWRlZG1ldGFkYXRhJ1xuICAgICAgICAvLyBzbyB3ZSB1c2UgYm90aCBldmVudHNcbiAgICAgICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfTUVUQSwgbG9hZGVyLnN0YXJ0UGxheSk7XG4gICAgICAgIGxvYWRlci5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0NBTlBMQVksIGxvYWRlci5zdGFydFBsYXkpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/QtdGA0LXQutC70Y7Rh9C10L3QuNC1INGA0LXQttC40LzQsCDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBXZWIgQXVkaW8gQVBJLiDQlNC+0YHRgtGD0L/QtdC9INGC0L7Qu9GM0LrQviDQv9GA0LggaHRtbDUt0YDQtdCw0LvQuNC30LDRhtC40Lgg0L/Qu9C10LXRgNCwLlxuICpcbiAqICoq0JLQvdC40LzQsNC90LjQtSEqKiAtINC/0L7RgdC70LUg0LLQutC70Y7Rh9C10L3QuNGPINGA0LXQttC40LzQsCBXZWIgQXVkaW8gQVBJINC+0L0g0L3QtSDQvtGC0LrQu9GO0YfQsNC10YLRgdGPINC/0L7Qu9C90L7RgdGC0YzRjiwg0YIu0LouINC00LvRjyDRjdGC0L7Qs9C+INGC0YDQtdCx0YPQtdGC0YHRj1xuICog0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC/0LvQtdC10YDQsCwg0LrQvtGC0L7RgNC+0Lkg0YLRgNC10LHRg9C10YLRgdGPINC60LvQuNC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjy4g0J/RgNC4INC+0YLQutC70Y7Rh9C10L3QuNC4INC40Lcg0LPRgNCw0YTQsCDQvtCx0YDQsNCx0L7RgtC60Lgg0LjRgdC60LvRjtGH0LDRjtGC0YHRj1xuICog0LLRgdC1INC90L7QtNGLINC60YDQvtC80LUg0L3QvtC0LdC40YHRgtC+0YfQvdC40LrQvtCyINC4INC90L7QtNGLINCy0YvQstC+0LTQsCwg0YPQv9GA0LDQstC70LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtGM0Y4g0L/QtdGA0LXQutC70Y7Rh9Cw0LXRgtGB0Y8g0L3QsCDRjdC70LXQvNC10L3RgtGLIGF1ZGlvLCDQsdC10LdcbiAqINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIEdhaW5Ob2RlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHN0YXRlIC0g0LfQsNC/0YDQsNGI0LjQstCw0LXQvNGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLS0g0LjRgtC+0LPQvtCy0YvQuSDRgdGC0LDRgtGD0YEg0L/Qu9C10LXRgNCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnRvZ2dsZVdlYkF1ZGlvQVBJID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBpZiAoIWF1ZGlvQ29udGV4dCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRXJyb3JcIiwgc3RhdGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJ0b2dnbGVXZWJBdWRpb0FQSVwiLCBzdGF0ZSk7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSA9PSBzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4gPSB0aGlzLnZvbHVtZTtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc291cmNlcyA9IHRoaXMuc291cmNlcyB8fCBbXTtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyLCBpZHgpIHtcbiAgICAgICAgICAgIGxvYWRlci52b2x1bWUgPSAxO1xuICAgICAgICAgICAgdmFyIHByZXBhcmVkID0gbG9hZGVyLmNyb3NzT3JpZ2luO1xuICAgICAgICAgICAgbG9hZGVyLmNyb3NzT3JpZ2luID0gXCJhbm9ueW1vdXNcIjtcbiAgICAgICAgICAgIHRoaXMuX2FkZFNvdXJjZShsb2FkZXIsIHRoaXMuc291cmNlc1tpZHhdKTtcblxuICAgICAgICAgICAgaWYgKCFwcmVwYXJlZCkgeyAvLyBJTkZPOiDQv9C+0YHQu9C1INGC0L7Qs9C+INC60LDQuiDQvNGLINCy0LrQu9GO0YfQuNC70Lggd2ViQXVkaW9BUEkg0LXQs9C+INGD0LbQtSDQvdC10LvRjNC30Y8g0L/QvtC70L3QvtGB0YLRjNGOINCy0YvQutC70Y7Rh9C40YLRjC5cbiAgICAgICAgICAgICAgICB2YXIgcG9zID0gbG9hZGVyLmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICAgIHZhciBwYXVzZWQgPSBsb2FkZXIucGF1c2VkO1xuICAgICAgICAgICAgICAgIGxvYWRlci5sb2FkKCk7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmN1cnJlbnRUaW1lID0gcG9zO1xuICAgICAgICAgICAgICAgIGlmICghcGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlci5wbGF5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmF1ZGlvT3V0cHV0KSB7XG4gICAgICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICAgICAgdGhpcy5wcmVwcm9jZXNzb3Iub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICBkZWxldGUgdGhpcy5hdWRpb091dHB1dDtcblxuICAgICAgICB0aGlzLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgICAgICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICAvL2RlbGV0ZSB0aGlzLnNvdXJjZXM7XG5cbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyLCBpZHgpIHtcbiAgICAgICAgICAgIGxvYWRlci52b2x1bWUgPSB0aGlzLnZvbHVtZTtcblxuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IHRoaXMuc291cmNlc1tpZHhdO1xuICAgICAgICAgICAgaWYgKHNvdXJjZSkgeyAvLyBJTkZPOiDQv9C+0YHQu9C1INGC0L7Qs9C+INC60LDQuiDQvNGLINCy0LrQu9GO0YfQuNC70Lggd2ViQXVkaW9BUEkg0LXQs9C+INGD0LbQtSDQvdC10LvRjNC30Y8g0L/QvtC70L3QvtGB0YLRjNGOINCy0YvQutC70Y7Rh9C40YLRjC5cbiAgICAgICAgICAgICAgICBzb3VyY2UuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIHRoaXMud2ViQXVkaW9BcGkgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzdGF0ZTtcbn07XG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0QXVkaW9QcmVwcm9jZXNzb3IgPSBmdW5jdGlvbihwcmVwcm9jZXNzb3IpIHtcbiAgICBpZiAoIXRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckVycm9yXCIsIHByZXByb2Nlc3Nvcik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yXCIpO1xuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yID09PSBwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHRoaXMucHJlcHJvY2Vzc29yID0gcHJlcHJvY2Vzc29yO1xuXG4gICAgaWYgKCFwcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5hdWRpb091dHB1dCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgICAgc291cmNlLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgc291cmNlLmNvbm5lY3QocHJlcHJvY2Vzc29yLmlucHV0KTtcbiAgICB9KTtcbiAgICBwcmVwcm9jZXNzb3Iub3V0cHV0LmNvbm5lY3QodGhpcy5hdWRpb091dHB1dCk7XG59O1xuXG4vKipcbiAqINCf0YDQvtC40LPRgNCw0YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlcIiwgc3JjKTtcblxuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIodHJ1ZSk7XG5cbiAgICBsb2FkZXIuZmFrZSA9IGZhbHNlO1xuICAgIGxvYWRlci5zcmMgPSBzcmM7XG4gICAgbG9hZGVyLl9zcmMgPSBzcmM7XG4gICAgbG9hZGVyLm5vdExvYWRpbmcgPSB0cnVlO1xuICAgIGxvYWRlci5sb2FkKCk7XG5cbiAgICB0aGlzLl9wbGF5KGxvYWRlcik7XG59O1xuXG4vKiog0J/QvtGB0YLQsNCy0LjRgtGMINGC0YDQtdC6INC90LAg0L/QsNGD0LfRgyAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBhdXNlXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIodHJ1ZSk7XG4gICAgbG9hZGVyLnBhdXNlKCk7XG59O1xuXG4vKiog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInJlc3VtZVwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKHRydWUpO1xuICAgIHRoaXMuX3BsYXkobG9hZGVyKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInN0b3BcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcih0cnVlLCBvZmZzZXQgfHwgMCk7XG5cbiAgICBsb2FkZXIuZmFrZSA9IHRydWU7XG4gICAgbG9hZGVyLnNyYyA9IFwiXCI7XG4gICAgbG9hZGVyLl9zcmMgPSBmYWxzZTtcbiAgICBsb2FkZXIubm90TG9hZGluZyA9IHRydWU7XG4gICAgbG9hZGVyLmxvYWQoKTtcblxuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TVE9QLCBvZmZzZXQpO1xufTtcblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnByZWxvYWQgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInByZWxvYWRcIiwgc3JjLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKHRydWUsIG9mZnNldCk7XG5cbiAgICBsb2FkZXIuc3JjID0gc3JjO1xuICAgIGxvYWRlci5fc3JjID0gc3JjO1xuICAgIGxvYWRlci5ub3RMb2FkaW5nID0gdHJ1ZTtcbiAgICBsb2FkZXIubG9hZCgpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGVkID0gZnVuY3Rpb24oc3JjLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihmYWxzZSwgb2Zmc2V0KTtcbiAgICByZXR1cm4gbG9hZGVyLl9zcmMgPT09IHNyYyAmJiAhbG9hZGVyLm5vdExvYWRpbmc7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L3QsNGH0LDQuyDQv9GA0LXQtNC30LDQs9GA0YPQttCw0YLRjNGB0Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKGZhbHNlLCBvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuX3NyYyA9PT0gc3JjO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvdC90L7Qs9C+INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPT0gbnVsbCA/IDEgOiBvZmZzZXQ7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihmYWxzZSwgb2Zmc2V0KTtcblxuICAgIGlmICghbG9hZGVyLl9zcmMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMuX3NldEFjdGl2ZShvZmZzZXQpO1xuICAgIHRoaXMuX3BsYXkodGhpcy5fZ2V0TG9hZGVyKHRydWUsIDApKTtcblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TG9hZGVyKCkuY3VycmVudFRpbWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGC0LXQutGD0YnRg9GOINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFBvc2l0aW9uXCIsIHBvc2l0aW9uKTtcbiAgICB0aGlzLl9nZXRMb2FkZXIoKS5jdXJyZW50VGltZSA9IHBvc2l0aW9uIC0gMC4wMDE7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoZmFsc2UsIG9mZnNldCkuZHVyYXRpb247XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0TG9hZGVkID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcihmYWxzZSwgb2Zmc2V0KTtcblxuICAgIGlmIChsb2FkZXIuYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBsb2FkZXIuYnVmZmVyZWQuZW5kKDApIC0gbG9hZGVyLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgtC10LrRg9GJ0LXQtSDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFZvbHVtZVwiLCB2b2x1bWUpO1xuICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xuXG4gICAgaWYgKHRoaXMud2ViQXVkaW9BcGkpIHtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5nYWluLnZhbHVlID0gdm9sdW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubG9hZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRlcikge1xuICAgICAgICAgICAgbG9hZGVyLnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1ZPTFVNRSk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YHRgdGL0LvQutGDINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfEJvb2xlYW59IC0tINCh0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6INC40LvQuCBmYWxzZSwg0LXRgdC70Lgg0L3QtdGCINC30LDQs9GA0YPQttCw0LXQvNC+0LPQviDRgtGA0LXQutCwXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldFNyYyA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoZmFsc2UsIG9mZnNldCkuX3NyYztcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINC00L7RgdGC0YPQv9C10L0g0LvQuCDQv9GA0L7Qs9GA0LDQvNC80L3Ri9C5INC60L7QvdGC0YDQvtC70Ywg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZGV0ZWN0Lm9ubHlEZXZpY2VWb2x1bWU7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2xvZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtYWluOiB0aGlzLmdldFNyYygwKSxcbiAgICAgICAgICAgIHByZWxvYWRlcjogdGhpcy5nZXRTcmMoMSlcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxufTtcblxuZXhwb3J0cy5hdWRpb0NvbnRleHQgPSBhdWRpb0NvbnRleHQ7XG5leHBvcnRzLkF1ZGlvSW1wbGVtZW50YXRpb24gPSBBdWRpb0hUTUw1O1xuIiwidmFyIFlhbmRleEF1ZGlvID0gcmVxdWlyZSgnLi9leHBvcnQnKTtcbnJlcXVpcmUoJy4vZXJyb3IvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2xpYi9uZXQvZXJyb3IvZXhwb3J0Jyk7XG5yZXF1aXJlKCcuL2xvZ2dlci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vZngvZXF1YWxpemVyL2V4cG9ydCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFlhbmRleEF1ZGlvO1xuIiwidmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbm9vcCcpO1xuXG4vKipcbiAqIEBjbGFzcyDQntGC0LvQvtC20LXQvdC90L7QtSDQtNC10LnRgdGC0LLQuNC1XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBEZWZlcnJlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBfcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KDQsNC30YDQtdGI0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZXNvbHZlXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gZGF0YSAtINC/0LXRgNC10LTQsNGC0Ywg0LTQsNC90L3Ri9C1INCyINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICovXG4gICAgICAgIHNlbGYucmVzb2x2ZSA9IHJlc29sdmU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqINCe0YLQutC70L7QvdC40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gICAgICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcmVqZWN0XG4gICAgICAgICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIC0g0L/QtdGA0LXQtNCw0YLRjCDQvtGI0LjQsdC60YNcbiAgICAgICAgICovXG4gICAgICAgIHNlbGYucmVqZWN0ID0gcmVqZWN0O1xuICAgIH0pO1xuXG4gICAgdmFyIHByb21pc2UgPSBfcHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgc2VsZi5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgIHNlbGYucGVuZGluZyA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgc2VsZi5yZWplY3RlZCA9IHRydWU7XG4gICAgICAgIHNlbGYucGVuZGluZyA9IGZhbHNlO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgfSk7XG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApOyAvLyBEb24ndCB0aHJvdyBlcnJvcnMgdG8gY29uc29sZVxuXG4gICAgLyoqXG4gICAgICog0JLRi9C/0L7Qu9C90LjQu9C+0YHRjCDQu9C4INC+0LHQtdGJ0LDQvdC40LVcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLnBlbmRpbmcgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICog0J7RgtC60LvQvtC90LjQu9C+0YHRjCDQu9C4INC+0LHQtdGJ0LDQvdC40LVcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLnJlamVjdGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiDQn9C+0LvRg9GH0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Byb21pc2VcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB0aGlzLnByb21pc2UgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHByb21pc2U7IH07XG59O1xuXG4vKipcbiAqINCe0LbQuNC00LDQvdC40LUg0LLRi9C/0L7Qu9C90LXQvdC40Y8g0YHQv9C40YHQutCwINC+0LHQtdGJ0LDQvdC40LlcbiAqIEBwYXJhbSB7Li4uKn0gYXJncyAtINC+0LHQtdGJ0LDQvdC40Y8sINC60L7RgtC+0YDRi9C1INGC0YDQtdCx0YPQtdGC0YHRjyDQvtC20LjQtNCw0YLRjFxuICogQHJldHVybnMgQWJvcnRhYmxlUHJvbWlzZVxuICovXG5EZWZlcnJlZC53aGVuID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRlZmVycmVkID0gbmV3IERlZmVycmVkKCk7XG5cbiAgICB2YXIgbGlzdCA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICB2YXIgcGVuZGluZyA9IGxpc3QubGVuZ3RoO1xuXG4gICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcGVuZGluZy0tO1xuXG4gICAgICAgIGlmIChwZW5kaW5nIDw9IDApIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICB9KTtcbiAgICBsaXN0ID0gbnVsbDtcblxuICAgIGRlZmVycmVkLnByb21pc2UuYWJvcnQgPSBkZWZlcnJlZC5yZWplY3Q7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEZWZlcnJlZDtcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoJy4uL2RhdGEvbWVyZ2UnKTtcblxudmFyIExJU1RFTkVSU19OQU1FID0gXCJfbGlzdGVuZXJzXCI7XG52YXIgTVVURV9PUFRJT04gPSBcIl9tdXRlZFwiO1xuXG4vKipcbiAqINCU0LjRgdC/0LXRgtGH0LXRgCDRgdC+0LHRi9GC0LjQuVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAvKiog0JrQvtC90YLQtdC50L3QtdGAINC00LvRjyDRgdC/0LjRgdC60L7QsiDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuVxuICAgICAqIEBhbGlhcyBFdmVudHMjX2xpc3RlbmVyc1xuICAgICAqIEB0eXBlIHtPYmplY3QuPFN0cmluZywgQXJyYXkuPEZ1bmN0aW9uPj59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzW0xJU1RFTkVSU19OQU1FXSA9IHt9O1xuXG4gICAgLyoqINCk0LvQsNCzINCy0LrQu9GO0YfQtdC90LjRjy/QstGL0LrQu9GO0YfQtdC90LjRjyDRgdC+0LHRi9GC0LjQuVxuICAgICAqIEBhbGlhcyBFdmVudHMjX211dGVzXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzW01VVEVfT1BUSU9OXSA9IGZhbHNlO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC60LvQsNGB0YEg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNsYXNzQ29uc3RydWN0b3IgLSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsFxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtLSDRgtC+0YIg0LbQtSDQutC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsCwg0YDQsNGB0YjQuNGA0LXQvdC90YvQuSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICovXG5FdmVudHMubWl4aW4gPSBmdW5jdGlvbihjbGFzc0NvbnN0cnVjdG9yKSB7XG4gICAgbWVyZ2UoY2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIEV2ZW50cy5wcm90b3R5cGUsIHRydWUpO1xuICAgIHJldHVybiBjbGFzc0NvbnN0cnVjdG9yO1xufTtcblxuLyoqXG4gKiDQoNCw0YHRiNC40YDQuNGC0Ywg0L/RgNC+0LjQt9Cy0L7Qu9GM0L3Ri9C5INC+0LHRitC10LrRgiDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtINC+0LHRitC10LrRglxuICogQHJldHVybnMge09iamVjdH0gLS0g0YLQvtGCINC20LUg0L7QsdGK0LXQutGCLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5ldmVudGl6ZSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIG1lcmdlKG9iamVjdCwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgRXZlbnRzLmNhbGwob2JqZWN0KTtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLyoqXG4gKiDQn9C+0LTQv9C40YHQsNGC0YzRgdGPINC90LAg0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0gPSBbXTtcbiAgICB9XG5cbiAgICB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0ucHVzaChjYWxsYmFjayk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCe0YLQv9C40YHQsNGC0YzRgdGPINC+0YIg0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tzID0gdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gY2FsbGJhY2tzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBpZiAoY2FsbGJhY2tzW2tdID09PSBjYWxsYmFjayB8fCBjYWxsYmFja3Nba10uY2FsbGJhY2sgPT09IGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFja3Muc3BsaWNlKGssIDEpO1xuICAgICAgICAgICAgaWYgKCFjYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtSwg0L7RgtC/0LjRgdCw0YLRjNGB0Y8g0YHRgNCw0LfRgyDQv9C+0YHQu9C1INC/0LXRgNCy0L7Qs9C+INCy0L7Qt9C90LjQutC90L7QstC10L3QuNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSDQuNC80Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YHQvtCx0YvRgtC40Y9cbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgd3JhcHBlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLm9mZihldmVudCwgd3JhcHBlcik7XG4gICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHdyYXBwZXIuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBzZWxmLm9uKGV2ZW50LCB3cmFwcGVyKTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/Rg9GB0YLQuNGC0Ywg0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHsuLi5hcmdzfSBhcmdzIC0g0L/QsNGA0LDQvNC10YLRgNGLINC00LvRjyDQv9C10YDQtdC00LDRh9C4INCy0LzQtdGB0YLQtSDRgSDRgdC+0LHRi9GC0LjQtdC8XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oZXZlbnQsIGFyZ3MpIHtcbiAgICBpZiAodGhpc1tNVVRFX09QVElPTl0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGlmIChldmVudCAhPT0gXCIqXCIpIHtcbiAgICAgICAgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmFwcGx5KHRoaXMsIFtcIipcIiwgZXZlbnRdLmNvbmNhdChhcmdzKSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdmFyIGNhbGxiYWNrcyA9IFtdLmNvbmNhdCh0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF0pO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gY2FsbGJhY2tzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBjYWxsYmFja3Nba10uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCe0YLQv9C40YHQsNGC0YzRgdGPINC+0YIg0LLRgdC10YUg0YHQu9GD0YjQsNGC0LXQu9C10Lkg0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLmNsZWFyTGlzdGVuZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXNbTElTVEVORVJTX05BTUVdKSB7XG4gICAgICAgIGlmICh0aGlzW0xJU1RFTkVSU19OQU1FXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1ba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQlNC10LvQtdCz0LjRgNC+0LLQsNGC0Ywg0LLRgdC1INGB0L7QsdGL0YLQuNGPINC00YDRg9Cz0L7QvNGDINC00LjRgdC/0LXRgtGH0LXRgNGDINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge0V2ZW50c30gYWNjZXB0b3IgLSDQv9C+0LvRg9GH0LDRgtC10LvRjCDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUucGlwZUV2ZW50cyA9IGZ1bmN0aW9uKGFjY2VwdG9yKSB7XG4gICAgdGhpcy5vbihcIipcIiwgRXZlbnRzLnByb3RvdHlwZS50cmlnZ2VyLmJpbmQoYWNjZXB0b3IpKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LfQsNC/0YPRgdC6INGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5tdXRlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpc1tNVVRFX09QVElPTl0gPSB0cnVlO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQktC+0LfQvtCx0L3QvtCy0LjRgtGMINC30LDQv9GD0YHQuiDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUudW5tdXRlRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgZGVsZXRlIHRoaXNbTVVURV9PUFRJT05dO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudHM7XG4iLCJ2YXIgdm93ID0gcmVxdWlyZSgndm93Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vYnJvd3Nlci9kZXRlY3QnKTtcblxuLyoqXG4gKiB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvcnUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZXxFUy02IFByb21pc2V9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFByb21pc2U7XG5pZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlICE9PSBcImZ1bmN0aW9uXCJcbiAgICB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcIm1zaWVcIiB8fCBkZXRlY3QuYnJvd3Nlci5uYW1lID09PSBcImVkZ2VcIiAvLyDQvNC10LvQutC40LUg0LzRj9Cz0LrQuNC1INC60LDQuiDQstGB0LXQs9C00LAg0L3QuNGH0LXQs9C+INC90LUg0YPQvNC10Y7RgiDQtNC10LvQsNGC0Ywg0L/RgNCw0LLQuNC70YzQvdC+XG4pIHtcbiAgICBQcm9taXNlID0gdm93LlByb21pc2U7XG59IGVsc2Uge1xuICAgIFByb21pc2UgPSB3aW5kb3cuUHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0YDQsNC30YDQtdGI0ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVzb2x2ZVxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQsNC90L3Ri9C1LCDQutC+0YLQvtGA0YvQvNC4INGA0LDQt9GA0LXRiNC40YLRjCDQvtCx0LXRidCw0L3QuNC1XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUg0L7RgtC60LvQvtC90ZHQvdC90L7QtSDQv9C10YDQtdC00LDQvdC90YvQvNC4INC00LDQvdC90YvQvNC4XG4gKiBAbWV0aG9kIFByb21pc2UucmVqZWN0XG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0L7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTRg9GCINCy0YvQv9C+0LvQvdC10L3RiyDQstGB0LUg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0L7QsdC10YnQsNC90LjRjy5cbiAqIEBtZXRob2QgUHJvbWlzZS5hbGxcbiAqIEBwYXJhbSB7QXJyYXkuPFByb21pc2U+fSBwcm9taXNlcyAtINGB0L/QuNGB0L7QuiDQvtCx0LXRidCw0L3QuNC5XG4gKiBAc3RhdGljXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuXG4vKipcbiAqINCh0L7Qt9C00LDRgtGMINC+0LHQtdGJ0LDQvdC40LUsINC60L7RgtC+0YDQvtC1INCy0YvQv9C+0LvQvdC40YLRgdGPINGC0L7Qs9C00LAsINC60L7Qs9C00LAg0LHRg9C00LXRgiDQstGL0L/QvtC70L3QtdC90L4g0YXQvtGC0Y8g0LHRiyDQvtC00L3QviDQuNC3INC/0LXRgNC10LTQsNC90L3Ri9GFINC+0LHQtdGJ0LDQvdC40LkuXG4gKiBAbWV0aG9kIFByb21pc2UucmFjZVxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC60Lgg0YDQsNC30YDQtdGI0LXQvdC40Y8g0Lgg0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI3RoZW5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRhdCwXG4gKiBAcGFyYW0ge251bGx8ZnVuY3Rpb259IFtlcnJiYWNrXSAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8qKlxuICog0J3QsNC30L3QsNGH0LjRgtGMINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YLQutC70L7QvdC10L3QuNGPINC+0LHQtdGJ0LDQvdC40Y9cbiAqIEBtZXRob2QgUHJvbWlzZSNjYXRjaFxuICogQHBhcmFtIHtmdW5jdGlvbn0gZXJyYmFjayAtICDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQvtGI0LjQsdC60LhcbiAqIEByZXR1cm5zIHtQcm9taXNlfSAtLSDQvdC+0LLQvtC1INC+0LHQtdGJ0LDQvdC40LUg0LjQtyDRgNC10LfRg9C70YzRgtCw0YLQvtCyINC+0LHRgNCw0LHQvtGC0YfQuNC60LBcbiAqL1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQWJvcnRhYmxlUHJvbWlzZVxuLyoqXG4gKiDQntCx0LXRidCw0L3QuNC1INGBINCy0L7Qt9C80L7QttC90L7RgdGC0YzRjiDQvtGC0LzQtdC90Ysg0YHQstGP0LfQsNC90L3QvtCz0L4g0YEg0L3QuNC8INC00LXQudGB0YLQstC40Y8uXG4gKiBAY2xhc3MgQWJvcnRhYmxlUHJvbWlzZVxuICogQGV4dGVuZHMgUHJvbWlzZVxuICovXG5cbi8qKlxuICog0J7RgtC80LXQvdCwINC00LXQudGB0YLQstC40Y8g0YHQstGP0LfQsNC90L3QvtCz0L4g0YEg0L7QsdC10YnQsNC10L3QuNC10LxcbiAqIEBhYnN0cmFjdFxuICogQG1ldGhvZCBBYm9ydGFibGVQcm9taXNlI2Fib3J0XG4gKiBAcGFyYW0ge1N0cmluZ3xFcnJvcn0gcmVhc29uIC0g0L/RgNC40YfQuNC90LAg0L7RgtC80LXQvdGLINC00LXQudGB0YLQstC40Y9cbiAqL1xuIiwidmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgcHJvbWlzZSA9IFByb21pc2UucmVqZWN0KGRhdGEpO1xuICAgIHByb21pc2VbXCJjYXRjaFwiXShub29wKTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG4iLCJ2YXIgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBCcm93c2VyIGRldGVjdGlvblxuLy8gVXNlcmFnZW50IFJlZ0V4cFxudmFyIHJ3ZWJraXQgPSAvKHdlYmtpdClbIFxcL10oW1xcdy5dKykvO1xudmFyIHJ5YWJybyA9IC8oeWFicm93c2VyKVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcm9wZXJhID0gLyhvcGVyYSkoPzouKnZlcnNpb24pP1sgXFwvXShbXFx3Ll0rKS87XG52YXIgcm1zaWUgPSAvKG1zaWUpIChbXFx3Ll0rKS87XG52YXIgcmVkZ2UgPSAvKGVkZ2UpXFwvKFtcXHcuXSspLztcbnZhciBybW96aWxsYSA9IC8obW96aWxsYSkoPzouKj8gcnY6KFtcXHcuXSspKT8vO1xudmFyIHJzYWZhcmkgPSAvXigoPyFjaHJvbWUpLikqdmVyc2lvblxcLyhbXFxkXFx3XFwuXSspLiooc2FmYXJpKS87XG5cbnZhciBtYXRjaCA9IHJzYWZhcmkuZXhlYyh1YSkgfHwgcnlhYnJvLmV4ZWModWEpIHx8IHJlZGdlLmV4ZWModWEpIHx8IHJ3ZWJraXQuZXhlYyh1YSkgfHwgcm9wZXJhLmV4ZWModWEpIHx8IHJtc2llLmV4ZWModWEpIHx8IHVhLmluZGV4T2YoXCJjb21wYXRpYmxlXCIpIDwgMFxuICAgICYmIHJtb3ppbGxhLmV4ZWModWEpXG4gICAgfHwgW107XG5cbnZhciBicm93c2VyID0ge25hbWU6IG1hdGNoWzFdIHx8IFwiXCIsIHZlcnNpb246IG1hdGNoWzJdIHx8IFwiMFwifTtcblxuaWYgKG1hdGNoWzNdID09PSBcInNhZmFyaVwiKSB7XG4gICAgYnJvd3Nlci5uYW1lID0gbWF0Y2hbM107XG59XG5cbmlmIChicm93c2VyLm5hbWUgPT09ICdtc2llJykge1xuICAgIGlmIChkb2N1bWVudC5kb2N1bWVudE1vZGUpIHsgLy8gSUU4IG9yIGxhdGVyXG4gICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gZG9jdW1lbnQuZG9jdW1lbnRNb2RlO1xuICAgIH0gZWxzZSB7IC8vIElFIDUtN1xuICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IDU7IC8vIEFzc3VtZSBxdWlya3MgbW9kZSB1bmxlc3MgcHJvdmVuIG90aGVyd2lzZVxuICAgICAgICBpZiAoZG9jdW1lbnQuY29tcGF0TW9kZSkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmNvbXBhdE1vZGUgPT09IFwiQ1NTMUNvbXBhdFwiKSB7XG4gICAgICAgICAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSA3OyAvLyBzdGFuZGFyZHMgbW9kZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUGxhdGZvcm0gZGV0ZWN0aW9uXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcnBsYXRmb3JtID0gLyhpcGFkfGlwaG9uZXxpcG9kfGFuZHJvaWR8YmxhY2tiZXJyeXxwbGF5Ym9va3x3aW5kb3dzIGNlfHdlYm9zKS87XG52YXIgcnRhYmxldCA9IC8oaXBhZHxwbGF5Ym9vaykvO1xudmFyIHJhbmRyb2lkID0gLyhhbmRyb2lkKS87XG52YXIgcm1vYmlsZSA9IC8obW9iaWxlKS87XG5cbnBsYXRmb3JtID0gcnBsYXRmb3JtLmV4ZWModWEpIHx8IFtdO1xudmFyIHRhYmxldCA9IHJ0YWJsZXQuZXhlYyh1YSkgfHwgIXJtb2JpbGUuZXhlYyh1YSkgJiYgcmFuZHJvaWQuZXhlYyh1YSkgfHwgW107XG5cbmlmIChwbGF0Zm9ybVsxXSkge1xuICAgIHBsYXRmb3JtWzFdID0gcGxhdGZvcm1bMV0ucmVwbGFjZSgvXFxzL2csIFwiX1wiKTsgLy8gQ2hhbmdlIHdoaXRlc3BhY2UgdG8gdW5kZXJzY29yZS4gRW5hYmxlcyBkb3Qgbm90YXRpb24uXG59XG5cbnZhciBwbGF0Zm9ybSA9IHtcbiAgICB0eXBlOiBwbGF0Zm9ybVsxXSB8fCBcIlwiLFxuICAgIHRhYmxldDogISF0YWJsZXRbMV0sXG4gICAgbW9iaWxlOiBwbGF0Zm9ybVsxXSAmJiAhdGFibGV0WzFdIHx8IGZhbHNlXG59O1xuaWYgKCFwbGF0Zm9ybS50eXBlKSB7XG4gICAgcGxhdGZvcm0udHlwZSA9ICdwYyc7XG59XG5cbnBsYXRmb3JtLm9zID0gcGxhdGZvcm0udHlwZTtcbmlmIChwbGF0Zm9ybS50eXBlID09PSAnaXBhZCcgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwaG9uZScgfHwgcGxhdGZvcm0udHlwZSA9PT0gJ2lwb2QnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnaW9zJztcbn0gZWxzZSBpZiAocGxhdGZvcm0udHlwZSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgcGxhdGZvcm0ub3MgPSAnYW5kcm9pZCc7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJXaW5cIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIndpbmRvd3NcIjtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvd2luW14gXSogKFteO10qKS9pKTtcbiAgICBwbGF0Zm9ybS52ZXJzaW9uID0gcGxhdGZvcm0udmVyc2lvbiAmJiBwbGF0Zm9ybS52ZXJzaW9uWzFdO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJtYWNvc1wiO1xufSBlbHNlIGlmIChuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJ1bml4XCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJMaW51eFwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwibGludXhcIjtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCU0LXRgtC10LrRgtC40YDQvtCy0LDQvdC40LUg0LHQu9C+0LrQuNGA0L7QstC60Lgg0LPRgNC+0LzQutC+0YHRgtC4XG52YXIgbm9Wb2x1bWUgPSB0cnVlO1xudHJ5IHtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIGF1ZGlvLnZvbHVtZSA9IDAuNjM7XG4gICAgbm9Wb2x1bWUgPSBNYXRoLmFicyhhdWRpby52b2x1bWUgLSAwLjYzKSA+IDAuMDE7XG59IGNhdGNoKGUpIHtcbiAgICBub1ZvbHVtZSA9IHRydWU7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSDQrdC60YHQv9C+0YDRglxuLyoqXG4gKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQvtCxINC+0LrRgNGD0LbQtdC90LjQuFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIGRldGVjdCA9IHtcbiAgICAvKipcbiAgICAgKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQsdGA0LDRg9C30LXRgNC1XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtINC90LDQt9Cy0LDQvdC40LUg0LHRgNCw0YPQt9C10YDQsFxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB2ZXJzaW9uIC0g0LLQtdGA0YHQuNGPXG4gICAgICogQHByb3BlcnR5IHtudW1iZXJ9IFtkb2N1bWVudE1vZGVdIC0g0LLQtdGA0YHQuNGPINC00L7QutGD0LzQtdC90YLQsFxuICAgICAqL1xuICAgIGJyb3dzZXI6IGJyb3dzZXIsXG5cbiAgICAvKipcbiAgICAgKiDQmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQv9C70LDRgtGE0L7RgNC80LVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBvcyAtINGC0LjQvyDQvtC/0LXRgNCw0YbQuNC+0L3QvdC+0Lkg0YHQuNGB0YLQtdC80YtcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdHlwZSAtINGC0LjQvyDQv9C70LDRgtGE0L7RgNC80YtcbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IHRhYmxldCAtINC/0LvQsNC90YjQtdGCXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSBtb2JpbGUgLSDQvNC+0LHQuNC70YzQvdGL0LlcbiAgICAgKi9cbiAgICBwbGF0Zm9ybTogcGxhdGZvcm0sXG5cbiAgICAvKipcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60LAg0LPRgNC+0LzQutC+0YHRgtC4XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgb25seURldmljZVZvbHVtZTogbm9Wb2x1bWVcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZGV0ZWN0O1xuIiwiLyoqXG4gKiBAbGljZW5zZSBTV0ZPYmplY3QgdjIuMiA8aHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC8+XG4gKiBpcyByZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgPGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwPlxuICogQHByaXZhdGVcbiovXG52YXIgc3dmb2JqZWN0ID0gZnVuY3Rpb24oKSB7XG5cdHZhciBVTkRFRiA9IFwidW5kZWZpbmVkXCIsXG5cdFx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0XHRTSE9DS1dBVkVfRkxBU0ggPSBcIlNob2Nrd2F2ZSBGbGFzaFwiLFxuXHRcdFNIT0NLV0FWRV9GTEFTSF9BWCA9IFwiU2hvY2t3YXZlRmxhc2guU2hvY2t3YXZlRmxhc2hcIixcblx0XHRGTEFTSF9NSU1FX1RZUEUgPSBcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIsXG5cdFx0RVhQUkVTU19JTlNUQUxMX0lEID0gXCJTV0ZPYmplY3RFeHBySW5zdFwiLFxuXHRcdE9OX1JFQURZX1NUQVRFX0NIQU5HRSA9IFwib25yZWFkeXN0YXRlY2hhbmdlXCIsXG5cdFx0d2luID0gd2luZG93LFxuXHRcdGRvYyA9IGRvY3VtZW50LFxuXHRcdG5hdiA9IG5hdmlnYXRvcixcblx0XHRwbHVnaW4gPSBmYWxzZSxcblx0XHRkb21Mb2FkRm5BcnIgPSBbbWFpbl0sXG5cdFx0cmVnT2JqQXJyID0gW10sXG5cdFx0b2JqSWRBcnIgPSBbXSxcblx0XHRsaXN0ZW5lcnNBcnIgPSBbXSxcblx0XHRzdG9yZWRBbHRDb250ZW50LFxuXHRcdHN0b3JlZEFsdENvbnRlbnRJZCxcblx0XHRzdG9yZWRDYWxsYmFja0ZuLFxuXHRcdHN0b3JlZENhbGxiYWNrT2JqLFxuXHRcdGlzRG9tTG9hZGVkID0gZmFsc2UsXG5cdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlLFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0LFxuXHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEsXG5cdFx0YXV0b0hpZGVTaG93ID0gdHJ1ZSxcblx0LyogQ2VudHJhbGl6ZWQgZnVuY3Rpb24gZm9yIGJyb3dzZXIgZmVhdHVyZSBkZXRlY3Rpb25cblx0XHQtIFVzZXIgYWdlbnQgc3RyaW5nIGRldGVjdGlvbiBpcyBvbmx5IHVzZWQgd2hlbiBubyBnb29kIGFsdGVybmF0aXZlIGlzIHBvc3NpYmxlXG5cdFx0LSBJcyBleGVjdXRlZCBkaXJlY3RseSBmb3Igb3B0aW1hbCBwZXJmb3JtYW5jZVxuXHQqL1xuXHR1YSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB3M2Nkb20gPSB0eXBlb2YgZG9jLmdldEVsZW1lbnRCeUlkICE9IFVOREVGICYmIHR5cGVvZiBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUgIT0gVU5ERUYgJiYgdHlwZW9mIGRvYy5jcmVhdGVFbGVtZW50ICE9IFVOREVGLFxuXHRcdFx0dSA9IG5hdi51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcblx0XHRcdHAgPSBuYXYucGxhdGZvcm0udG9Mb3dlckNhc2UoKSxcblx0XHRcdHdpbmRvd3MgPSBwID8gL3dpbi8udGVzdChwKSA6IC93aW4vLnRlc3QodSksXG5cdFx0XHRtYWMgPSBwID8gL21hYy8udGVzdChwKSA6IC9tYWMvLnRlc3QodSksXG5cdFx0XHR3ZWJraXQgPSAvd2Via2l0Ly50ZXN0KHUpID8gcGFyc2VGbG9hdCh1LnJlcGxhY2UoL14uKndlYmtpdFxcLyhcXGQrKFxcLlxcZCspPykuKiQvLCBcIiQxXCIpKSA6IGZhbHNlLCAvLyByZXR1cm5zIGVpdGhlciB0aGUgd2Via2l0IHZlcnNpb24gb3IgZmFsc2UgaWYgbm90IHdlYmtpdFxuXHRcdFx0aWUgPSAhK1wiXFx2MVwiLCAvLyBmZWF0dXJlIGRldGVjdGlvbiBiYXNlZCBvbiBBbmRyZWEgR2lhbW1hcmNoaSdzIHNvbHV0aW9uOiBodHRwOi8vd2VicmVmbGVjdGlvbi5ibG9nc3BvdC5jb20vMjAwOS8wMS8zMi1ieXRlcy10by1rbm93LWlmLXlvdXItYnJvd3Nlci1pcy1pZS5odG1sXG5cdFx0XHRwbGF5ZXJWZXJzaW9uID0gWzAsMCwwXSxcblx0XHRcdGQgPSBudWxsO1xuXHRcdGlmICh0eXBlb2YgbmF2LnBsdWdpbnMgIT0gVU5ERUYgJiYgdHlwZW9mIG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0gPT0gT0JKRUNUKSB7XG5cdFx0XHRkID0gbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXS5kZXNjcmlwdGlvbjtcblx0XHRcdGlmIChkICYmICEodHlwZW9mIG5hdi5taW1lVHlwZXMgIT0gVU5ERUYgJiYgbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdICYmICFuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0uZW5hYmxlZFBsdWdpbikpIHsgLy8gbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCJdLmVuYWJsZWRQbHVnaW4gaW5kaWNhdGVzIHdoZXRoZXIgcGx1Zy1pbnMgYXJlIGVuYWJsZWQgb3IgZGlzYWJsZWQgaW4gU2FmYXJpIDMrXG5cdFx0XHRcdHBsdWdpbiA9IHRydWU7XG5cdFx0XHRcdGllID0gZmFsc2U7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRkID0gZC5yZXBsYWNlKC9eLipcXHMrKFxcUytcXHMrXFxTKyQpLywgXCIkMVwiKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblswXSA9IHBhcnNlSW50KGQucmVwbGFjZSgvXiguKilcXC4uKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMV0gPSBwYXJzZUludChkLnJlcGxhY2UoL14uKlxcLiguKilcXHMuKiQvLCBcIiQxXCIpLCAxMCk7XG5cdFx0XHRcdHBsYXllclZlcnNpb25bMl0gPSAvW2EtekEtWl0vLnRlc3QoZCkgPyBwYXJzZUludChkLnJlcGxhY2UoL14uKlthLXpBLVpdKyguKikkLywgXCIkMVwiKSwgMTApIDogMDtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5BY3RpdmVYT2JqZWN0ICE9IFVOREVGKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgYSA9IG5ldyBBY3RpdmVYT2JqZWN0KFNIT0NLV0FWRV9GTEFTSF9BWCk7XG5cdFx0XHRcdGlmIChhKSB7IC8vIGEgd2lsbCByZXR1cm4gbnVsbCB3aGVuIEFjdGl2ZVggaXMgZGlzYWJsZWRcblx0XHRcdFx0XHRkID0gYS5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRpZSA9IHRydWU7IC8vIGNhc2NhZGVkIGZlYXR1cmUgZGV0ZWN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdFx0XHRcdFx0ZCA9IGQuc3BsaXQoXCIgXCIpWzFdLnNwbGl0KFwiLFwiKTtcblx0XHRcdFx0XHRcdHBsYXllclZlcnNpb24gPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaChlKSB7fVxuXHRcdH1cblx0XHRyZXR1cm4geyB3Mzp3M2Nkb20sIHB2OnBsYXllclZlcnNpb24sIHdrOndlYmtpdCwgaWU6aWUsIHdpbjp3aW5kb3dzLCBtYWM6bWFjIH07XG5cdH0oKSxcblx0LyogQ3Jvc3MtYnJvd3NlciBvbkRvbUxvYWRcblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIHRoZSBET00gb2YgYSB3ZWIgcGFnZSBpcyBsb2FkZWRcblx0XHQtIEludGVybmV0IEV4cGxvcmVyIHdvcmthcm91bmQgYmFzZWQgb24gRGllZ28gUGVyaW5pJ3Mgc29sdXRpb246IGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9JRUNvbnRlbnRMb2FkZWQvXG5cdFx0LSBSZWd1bGFyIG9ubG9hZCBzZXJ2ZXMgYXMgZmFsbGJhY2tcblx0Ki9cblx0b25Eb21Mb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF1YS53MykgeyByZXR1cm47IH1cblx0XHRpZiAoKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSAhPSBVTkRFRiAmJiBkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHx8ICh0eXBlb2YgZG9jLnJlYWR5U3RhdGUgPT0gVU5ERUYgJiYgKGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF0gfHwgZG9jLmJvZHkpKSkgeyAvLyBmdW5jdGlvbiBpcyBmaXJlZCBhZnRlciBvbmxvYWQsIGUuZy4gd2hlbiBzY3JpcHQgaXMgaW5zZXJ0ZWQgZHluYW1pY2FsbHlcblx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0fVxuXHRcdGlmICghaXNEb21Mb2FkZWQpIHtcblx0XHRcdGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdFx0ZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGNhbGxEb21Mb2FkRnVuY3Rpb25zLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRcdGRvYy5hdHRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmIChkb2MucmVhZHlTdGF0ZSA9PSBcImNvbXBsZXRlXCIpIHtcblx0XHRcdFx0XHRcdGRvYy5kZXRhY2hFdmVudChPTl9SRUFEWV9TVEFURV9DSEFOR0UsIGFyZ3VtZW50cy5jYWxsZWUpO1xuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAod2luID09IHRvcCkgeyAvLyBpZiBub3QgaW5zaWRlIGFuIGlmcmFtZVxuXHRcdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZG9jLmRvY3VtZW50RWxlbWVudC5kb1Njcm9sbChcImxlZnRcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXRjaChlKSB7XG5cdFx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdFx0fSkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHVhLndrKSB7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChpc0RvbUxvYWRlZCkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAoIS9sb2FkZWR8Y29tcGxldGUvLnRlc3QoZG9jLnJlYWR5U3RhdGUpKSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0YWRkTG9hZEV2ZW50KGNhbGxEb21Mb2FkRnVuY3Rpb25zKTtcblx0XHR9XG5cdH0oKTtcblx0ZnVuY3Rpb24gY2FsbERvbUxvYWRGdW5jdGlvbnMoKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdHRyeSB7IC8vIHRlc3QgaWYgd2UgY2FuIHJlYWxseSBhZGQvcmVtb3ZlIGVsZW1lbnRzIHRvL2Zyb20gdGhlIERPTTsgd2UgZG9uJ3Qgd2FudCB0byBmaXJlIGl0IHRvbyBlYXJseVxuXHRcdFx0dmFyIHQgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLmFwcGVuZENoaWxkKGNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTtcblx0XHRcdHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHsgcmV0dXJuOyB9XG5cdFx0aXNEb21Mb2FkZWQgPSB0cnVlO1xuXHRcdHZhciBkbCA9IGRvbUxvYWRGbkFyci5sZW5ndGg7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkbDsgaSsrKSB7XG5cdFx0XHRkb21Mb2FkRm5BcnJbaV0oKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWRkRG9tTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKGlzRG9tTG9hZGVkKSB7XG5cdFx0XHRmbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvbUxvYWRGbkFycltkb21Mb2FkRm5BcnIubGVuZ3RoXSA9IGZuOyAvLyBBcnJheS5wdXNoKCkgaXMgb25seSBhdmFpbGFibGUgaW4gSUU1LjUrXG5cdFx0fVxuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgb25sb2FkXG5cdFx0LSBCYXNlZCBvbiBKYW1lcyBFZHdhcmRzJyBzb2x1dGlvbjogaHR0cDovL2Jyb3RoZXJjYWtlLmNvbS9zaXRlL3Jlc291cmNlcy9zY3JpcHRzL29ubG9hZC9cblx0XHQtIFdpbGwgZmlyZSBhbiBldmVudCBhcyBzb29uIGFzIGEgd2ViIHBhZ2UgaW5jbHVkaW5nIGFsbCBvZiBpdHMgYXNzZXRzIGFyZSBsb2FkZWRcblx0ICovXG5cdGZ1bmN0aW9uIGFkZExvYWRFdmVudChmbikge1xuXHRcdGlmICh0eXBlb2Ygd2luLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdHdpbi5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgZG9jLmFkZEV2ZW50TGlzdGVuZXIgIT0gVU5ERUYpIHtcblx0XHRcdGRvYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmbiwgZmFsc2UpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLmF0dGFjaEV2ZW50ICE9IFVOREVGKSB7XG5cdFx0XHRhZGRMaXN0ZW5lcih3aW4sIFwib25sb2FkXCIsIGZuKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIHdpbi5vbmxvYWQgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2YXIgZm5PbGQgPSB3aW4ub25sb2FkO1xuXHRcdFx0d2luLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmbk9sZCgpO1xuXHRcdFx0XHRmbigpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR3aW4ub25sb2FkID0gZm47XG5cdFx0fVxuXHR9XG5cdC8qIE1haW4gZnVuY3Rpb25cblx0XHQtIFdpbGwgcHJlZmVyYWJseSBleGVjdXRlIG9uRG9tTG9hZCwgb3RoZXJ3aXNlIG9ubG9hZCAoYXMgYSBmYWxsYmFjaylcblx0Ki9cblx0ZnVuY3Rpb24gbWFpbigpIHtcblx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHR0ZXN0UGxheWVyVmVyc2lvbigpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHR9XG5cdH1cblx0LyogRGV0ZWN0IHRoZSBGbGFzaCBQbGF5ZXIgdmVyc2lvbiBmb3Igbm9uLUludGVybmV0IEV4cGxvcmVyIGJyb3dzZXJzXG5cdFx0LSBEZXRlY3RpbmcgdGhlIHBsdWctaW4gdmVyc2lvbiB2aWEgdGhlIG9iamVjdCBlbGVtZW50IGlzIG1vcmUgcHJlY2lzZSB0aGFuIHVzaW5nIHRoZSBwbHVnaW5zIGNvbGxlY3Rpb24gaXRlbSdzIGRlc2NyaXB0aW9uOlxuXHRcdCAgYS4gQm90aCByZWxlYXNlIGFuZCBidWlsZCBudW1iZXJzIGNhbiBiZSBkZXRlY3RlZFxuXHRcdCAgYi4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IGNvcnJ1cHQgaW5zdGFsbGVycyBwcm92aWRlZCBieSBBZG9iZVxuXHRcdCAgYy4gQXZvaWQgd3JvbmcgZGVzY3JpcHRpb25zIGJ5IG11bHRpcGxlIEZsYXNoIFBsYXllciBlbnRyaWVzIGluIHRoZSBwbHVnaW4gQXJyYXksIGNhdXNlZCBieSBpbmNvcnJlY3QgYnJvd3NlciBpbXBvcnRzXG5cdFx0LSBEaXNhZHZhbnRhZ2Ugb2YgdGhpcyBtZXRob2QgaXMgdGhhdCBpdCBkZXBlbmRzIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIERPTSwgd2hpbGUgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpcyBpbW1lZGlhdGVseSBhdmFpbGFibGVcblx0Ki9cblx0ZnVuY3Rpb24gdGVzdFBsYXllclZlcnNpb24oKSB7XG5cdFx0dmFyIGIgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO1xuXHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdHZhciB0ID0gYi5hcHBlbmRDaGlsZChvKTtcblx0XHRpZiAodCkge1xuXHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGlmICh0eXBlb2YgdC5HZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdHZhciBkID0gdC5HZXRWYXJpYWJsZShcIiR2ZXJzaW9uXCIpO1xuXHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0dWEucHYgPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGNvdW50ZXIgPCAxMCkge1xuXHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yi5yZW1vdmVDaGlsZChvKTtcblx0XHRcdFx0dCA9IG51bGw7XG5cdFx0XHRcdG1hdGNoVmVyc2lvbnMoKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBQZXJmb3JtIEZsYXNoIFBsYXllciBhbmQgU1dGIHZlcnNpb24gbWF0Y2hpbmc7IHN0YXRpYyBwdWJsaXNoaW5nIG9ubHlcblx0Ki9cblx0ZnVuY3Rpb24gbWF0Y2hWZXJzaW9ucygpIHtcblx0XHR2YXIgcmwgPSByZWdPYmpBcnIubGVuZ3RoO1xuXHRcdGlmIChybCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmw7IGkrKykgeyAvLyBmb3IgZWFjaCByZWdpc3RlcmVkIG9iamVjdCBlbGVtZW50XG5cdFx0XHRcdHZhciBpZCA9IHJlZ09iakFycltpXS5pZDtcblx0XHRcdFx0dmFyIGNiID0gcmVnT2JqQXJyW2ldLmNhbGxiYWNrRm47XG5cdFx0XHRcdHZhciBjYk9iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDppZH07XG5cdFx0XHRcdGlmICh1YS5wdlswXSA+IDApIHtcblx0XHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdFx0XHRcdGlmIChvYmopIHtcblx0XHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHJlZ09iakFycltpXS5zd2ZWZXJzaW9uKSAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSkgeyAvLyBGbGFzaCBQbGF5ZXIgdmVyc2lvbiA+PSBwdWJsaXNoZWQgU1dGIHZlcnNpb246IEhvdXN0b24sIHdlIGhhdmUgYSBtYXRjaCFcblx0XHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShpZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnN1Y2Nlc3MgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IGdldE9iamVjdEJ5SWQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocmVnT2JqQXJyW2ldLmV4cHJlc3NJbnN0YWxsICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZyBpZiBzZXQgYnkgdGhlIHdlYiBwYWdlIGF1dGhvciBhbmQgaWYgc3VwcG9ydGVkXG5cdFx0XHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRcdFx0YXR0LmRhdGEgPSByZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGw7XG5cdFx0XHRcdFx0XHRcdGF0dC53aWR0aCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0YXR0LmhlaWdodCA9IG9iai5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIikgfHwgXCIwXCI7XG5cdFx0XHRcdFx0XHRcdGlmIChvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIikpIHsgYXR0LnN0eWxlY2xhc3MgPSBvYmouZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7IH1cblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKSkgeyBhdHQuYWxpZ24gPSBvYmouZ2V0QXR0cmlidXRlKFwiYWxpZ25cIik7IH1cblx0XHRcdFx0XHRcdFx0Ly8gcGFyc2UgSFRNTCBvYmplY3QgcGFyYW0gZWxlbWVudCdzIG5hbWUtdmFsdWUgcGFpcnNcblx0XHRcdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgcCA9IG9iai5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcmFtXCIpO1xuXHRcdFx0XHRcdFx0XHR2YXIgcGwgPSBwLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwbDsgaisrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKS50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cGFyW3Bbal0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKV0gPSBwW2pdLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIGlkLCBjYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIHsgLy8gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtaXNtYXRjaCBvciBhbiBvbGRlciBXZWJraXQgZW5naW5lIHRoYXQgaWdub3JlcyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCdzIG5lc3RlZCBwYXJhbSBlbGVtZW50czogZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50IGluc3RlYWQgb2YgU1dGXG5cdFx0XHRcdFx0XHRcdGRpc3BsYXlBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdFx0XHRcdGlmIChjYikgeyBjYihjYk9iaik7IH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XHQvLyBpZiBubyBGbGFzaCBQbGF5ZXIgaXMgaW5zdGFsbGVkIG9yIHRoZSBmcCB2ZXJzaW9uIGNhbm5vdCBiZSBkZXRlY3RlZCB3ZSBsZXQgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgZG8gaXRzIGpvYiAoZWl0aGVyIHNob3cgYSBTV0Ygb3IgYWx0ZXJuYXRpdmUgY29udGVudClcblx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0XHRcdHZhciBvID0gZ2V0T2JqZWN0QnlJZChpZCk7IC8vIHRlc3Qgd2hldGhlciB0aGVyZSBpcyBhbiBIVE1MIG9iamVjdCBlbGVtZW50IG9yIG5vdFxuXHRcdFx0XHRcdFx0aWYgKG8gJiYgdHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNiT2JqLnJlZiA9IG87XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYihjYk9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpIHtcblx0XHR2YXIgciA9IG51bGw7XG5cdFx0dmFyIG8gPSBnZXRFbGVtZW50QnlJZChvYmplY3RJZFN0cik7XG5cdFx0aWYgKG8gJiYgby5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodHlwZW9mIG8uU2V0VmFyaWFibGUgIT0gVU5ERUYpIHtcblx0XHRcdFx0ciA9IG87XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIG4gPSBvLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRcdGlmIChuKSB7XG5cdFx0XHRcdFx0ciA9IG47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0LyogUmVxdWlyZW1lbnRzIGZvciBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHQtIG9ubHkgb25lIGluc3RhbmNlIGNhbiBiZSBhY3RpdmUgYXQgYSB0aW1lXG5cdFx0LSBmcCA2LjAuNjUgb3IgaGlnaGVyXG5cdFx0LSBXaW4vTWFjIE9TIG9ubHlcblx0XHQtIG5vIFdlYmtpdCBlbmdpbmVzIG9sZGVyIHRoYW4gdmVyc2lvbiAzMTJcblx0Ki9cblx0ZnVuY3Rpb24gY2FuRXhwcmVzc0luc3RhbGwoKSB7XG5cdFx0cmV0dXJuICFpc0V4cHJlc3NJbnN0YWxsQWN0aXZlICYmIGhhc1BsYXllclZlcnNpb24oXCI2LjAuNjVcIikgJiYgKHVhLndpbiB8fCB1YS5tYWMpICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpO1xuXHR9XG5cdC8qIFNob3cgdGhlIEFkb2JlIEV4cHJlc3MgSW5zdGFsbCBkaWFsb2dcblx0XHQtIFJlZmVyZW5jZTogaHR0cDovL3d3dy5hZG9iZS5jb20vY2Z1c2lvbi9rbm93bGVkZ2ViYXNlL2luZGV4LmNmbT9pZD02YTI1M2I3NVxuXHQqL1xuXHRmdW5jdGlvbiBzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pIHtcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gdHJ1ZTtcblx0XHRzdG9yZWRDYWxsYmFja0ZuID0gY2FsbGJhY2tGbiB8fCBudWxsO1xuXHRcdHN0b3JlZENhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRpZiAob2JqLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHsgLy8gc3RhdGljIHB1Ymxpc2hpbmdcblx0XHRcdFx0c3RvcmVkQWx0Q29udGVudCA9IGFic3RyYWN0QWx0Q29udGVudChvYmopO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIGR5bmFtaWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gb2JqO1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50SWQgPSByZXBsYWNlRWxlbUlkU3RyO1xuXHRcdFx0fVxuXHRcdFx0YXR0LmlkID0gRVhQUkVTU19JTlNUQUxMX0lEO1xuXHRcdFx0aWYgKHR5cGVvZiBhdHQud2lkdGggPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LndpZHRoKSAmJiBwYXJzZUludChhdHQud2lkdGgsIDEwKSA8IDMxMCkpIHsgYXR0LndpZHRoID0gXCIzMTBcIjsgfVxuXHRcdFx0aWYgKHR5cGVvZiBhdHQuaGVpZ2h0ID09IFVOREVGIHx8ICghLyUkLy50ZXN0KGF0dC5oZWlnaHQpICYmIHBhcnNlSW50KGF0dC5oZWlnaHQsIDEwKSA8IDEzNykpIHsgYXR0LmhlaWdodCA9IFwiMTM3XCI7IH1cblx0XHRcdGRvYy50aXRsZSA9IGRvYy50aXRsZS5zbGljZSgwLCA0NykgKyBcIiAtIEZsYXNoIFBsYXllciBJbnN0YWxsYXRpb25cIjtcblx0XHRcdHZhciBwdCA9IHVhLmllICYmIHVhLndpbiA/IFwiQWN0aXZlWFwiIDogXCJQbHVnSW5cIixcblx0XHRcdFx0ZnYgPSBcIk1NcmVkaXJlY3RVUkw9XCIgKyB3aW4ubG9jYXRpb24udG9TdHJpbmcoKS5yZXBsYWNlKC8mL2csXCIlMjZcIikgKyBcIiZNTXBsYXllclR5cGU9XCIgKyBwdCArIFwiJk1NZG9jdGl0bGU9XCIgKyBkb2MudGl0bGU7XG5cdFx0XHRpZiAodHlwZW9mIHBhci5mbGFzaHZhcnMgIT0gVU5ERUYpIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGZ2O1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHBhci5mbGFzaHZhcnMgPSBmdjtcblx0XHRcdH1cblx0XHRcdC8vIElFIG9ubHk6IHdoZW4gYSBTV0YgaXMgbG9hZGluZyAoQU5EOiBub3QgYXZhaWxhYmxlIGluIGNhY2hlKSB3YWl0IGZvciB0aGUgcmVhZHlTdGF0ZSBvZiB0aGUgb2JqZWN0IGVsZW1lbnQgdG8gYmVjb21lIDQgYmVmb3JlIHJlbW92aW5nIGl0LFxuXHRcdFx0Ly8gYmVjYXVzZSB5b3UgY2Fubm90IHByb3Blcmx5IGNhbmNlbCBhIGxvYWRpbmcgU1dGIGZpbGUgd2l0aG91dCBicmVha2luZyBicm93c2VyIGxvYWQgcmVmZXJlbmNlcywgYWxzbyBvYmoub25yZWFkeXN0YXRlY2hhbmdlIGRvZXNuJ3Qgd29ya1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHRcdHZhciBuZXdPYmogPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0XHRyZXBsYWNlRWxlbUlkU3RyICs9IFwiU1dGT2JqZWN0TmV3XCI7XG5cdFx0XHRcdG5ld09iai5zZXRBdHRyaWJ1dGUoXCJpZFwiLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld09iaiwgb2JqKTsgLy8gaW5zZXJ0IHBsYWNlaG9sZGVyIGRpdiB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG9iamVjdCBlbGVtZW50IHRoYXQgbG9hZHMgZXhwcmVzc2luc3RhbGwuc3dmXG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZVNXRihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0cik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBhYnN0cmFjdCBhbmQgZGlzcGxheSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGRpc3BsYXlBbHRDb250ZW50KG9iaikge1xuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgb2JqLnJlYWR5U3RhdGUgIT0gNCkge1xuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdFx0b2JqLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYWJzdHJhY3RBbHRDb250ZW50KG9iaiksIGVsKTtcblx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRvYmoucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgb2JqKTtcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gYWJzdHJhY3RBbHRDb250ZW50KG9iaikge1xuXHRcdHZhciBhYyA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0aWYgKHVhLndpbiAmJiB1YS5pZSkge1xuXHRcdFx0YWMuaW5uZXJIVE1MID0gb2JqLmlubmVySFRNTDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgbmVzdGVkT2JqID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKE9CSkVDVClbMF07XG5cdFx0XHRpZiAobmVzdGVkT2JqKSB7XG5cdFx0XHRcdHZhciBjID0gbmVzdGVkT2JqLmNoaWxkTm9kZXM7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0dmFyIGNsID0gYy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjbDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShjW2ldLm5vZGVUeXBlID09IDEgJiYgY1tpXS5ub2RlTmFtZSA9PSBcIlBBUkFNXCIpICYmICEoY1tpXS5ub2RlVHlwZSA9PSA4KSkge1xuXHRcdFx0XHRcdFx0XHRhYy5hcHBlbmRDaGlsZChjW2ldLmNsb25lTm9kZSh0cnVlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBhYztcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgU1dGIGNyZWF0aW9uXG5cdCovXG5cdGZ1bmN0aW9uIGNyZWF0ZVNXRihhdHRPYmosIHBhck9iaiwgaWQpIHtcblx0XHR2YXIgciwgZWwgPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKHVhLndrICYmIHVhLndrIDwgMzEyKSB7IHJldHVybiByOyB9XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRpZiAodHlwZW9mIGF0dE9iai5pZCA9PSBVTkRFRikgeyAvLyBpZiBubyAnaWQnIGlzIGRlZmluZWQgZm9yIHRoZSBvYmplY3QgZWxlbWVudCwgaXQgd2lsbCBpbmhlcml0IHRoZSAnaWQnIGZyb20gdGhlIGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0YXR0T2JqLmlkID0gaWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7IC8vIEludGVybmV0IEV4cGxvcmVyICsgdGhlIEhUTUwgb2JqZWN0IGVsZW1lbnQgKyBXM0MgRE9NIG1ldGhvZHMgZG8gbm90IGNvbWJpbmU6IGZhbGwgYmFjayB0byBvdXRlckhUTUxcblx0XHRcdFx0dmFyIGF0dCA9IFwiXCI7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7XG5cdFx0XHRcdFx0aWYgKGF0dE9ialtpXSAhPSBPYmplY3QucHJvdG90eXBlW2ldKSB7IC8vIGZpbHRlciBvdXQgcHJvdG90eXBlIGFkZGl0aW9ucyBmcm9tIG90aGVyIHBvdGVudGlhbCBsaWJyYXJpZXNcblx0XHRcdFx0XHRcdGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJkYXRhXCIpIHtcblx0XHRcdFx0XHRcdFx0cGFyT2JqLm1vdmllID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRhdHQgKz0gJyBjbGFzcz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoaS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7XG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnICcgKyBpICsgJz1cIicgKyBhdHRPYmpbaV0gKyAnXCInO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFyID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW2pdICE9IE9iamVjdC5wcm90b3R5cGVbal0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0cGFyICs9ICc8cGFyYW0gbmFtZT1cIicgKyBqICsgJ1wiIHZhbHVlPVwiJyArIHBhck9ialtqXSArICdcIiAvPic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIicgKyBhdHQgKyAnPicgKyBwYXIgKyAnPC9vYmplY3Q+Jztcblx0XHRcdFx0b2JqSWRBcnJbb2JqSWRBcnIubGVuZ3RoXSA9IGF0dE9iai5pZDsgLy8gc3RvcmVkIHRvIGZpeCBvYmplY3QgJ2xlYWtzJyBvbiB1bmxvYWQgKGR5bmFtaWMgcHVibGlzaGluZyBvbmx5KVxuXHRcdFx0XHRyID0gZ2V0RWxlbWVudEJ5SWQoYXR0T2JqLmlkKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgeyAvLyB3ZWxsLWJlaGF2aW5nIGJyb3dzZXJzXG5cdFx0XHRcdHZhciBvID0gY3JlYXRlRWxlbWVudChPQkpFQ1QpO1xuXHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgRkxBU0hfTUlNRV9UWVBFKTtcblx0XHRcdFx0Zm9yICh2YXIgbSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW21dICE9IE9iamVjdC5wcm90b3R5cGVbbV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKG0udG9Mb3dlckNhc2UoKSA9PSBcInN0eWxlY2xhc3NcIikgeyAvLyAnY2xhc3MnIGlzIGFuIEVDTUE0IHJlc2VydmVkIGtleXdvcmRcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhdHRPYmpbbV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAobS50b0xvd2VyQ2FzZSgpICE9IFwiY2xhc3NpZFwiKSB7IC8vIGZpbHRlciBvdXQgSUUgc3BlY2lmaWMgYXR0cmlidXRlXG5cdFx0XHRcdFx0XHRcdG8uc2V0QXR0cmlidXRlKG0sIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAodmFyIG4gaW4gcGFyT2JqKSB7XG5cdFx0XHRcdFx0aWYgKHBhck9ialtuXSAhPSBPYmplY3QucHJvdG90eXBlW25dICYmIG4udG9Mb3dlckNhc2UoKSAhPSBcIm1vdmllXCIpIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllcyBhbmQgSUUgc3BlY2lmaWMgcGFyYW0gZWxlbWVudFxuXHRcdFx0XHRcdFx0Y3JlYXRlT2JqUGFyYW0obywgbiwgcGFyT2JqW25dKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobywgZWwpO1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlT2JqUGFyYW0oZWwsIHBOYW1lLCBwVmFsdWUpIHtcblx0XHR2YXIgcCA9IGNyZWF0ZUVsZW1lbnQoXCJwYXJhbVwiKTtcblx0XHRwLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgcE5hbWUpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcFZhbHVlKTtcblx0XHRlbC5hcHBlbmRDaGlsZChwKTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIFNXRiByZW1vdmFsXG5cdFx0LSBFc3BlY2lhbGx5IG5lZWRlZCB0byBzYWZlbHkgYW5kIGNvbXBsZXRlbHkgcmVtb3ZlIGEgU1dGIGluIEludGVybmV0IEV4cGxvcmVyXG5cdCovXG5cdGZ1bmN0aW9uIHJlbW92ZVNXRihpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaiAmJiBvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikge1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0XHRvYmouc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdFx0cmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZU9iamVjdEluSUUoaWQpIHtcblx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb2JqW2ldID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdG9ialtpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0fVxuXHR9XG5cdC8qIEZ1bmN0aW9ucyB0byBvcHRpbWl6ZSBKYXZhU2NyaXB0IGNvbXByZXNzaW9uXG5cdCovXG5cdGZ1bmN0aW9uIGdldEVsZW1lbnRCeUlkKGlkKSB7XG5cdFx0dmFyIGVsID0gbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0ZWwgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge31cblx0XHRyZXR1cm4gZWw7XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRWxlbWVudChlbCkge1xuXHRcdHJldHVybiBkb2MuY3JlYXRlRWxlbWVudChlbCk7XG5cdH1cblx0LyogVXBkYXRlZCBhdHRhY2hFdmVudCBmdW5jdGlvbiBmb3IgSW50ZXJuZXQgRXhwbG9yZXJcblx0XHQtIFN0b3JlcyBhdHRhY2hFdmVudCBpbmZvcm1hdGlvbiBpbiBhbiBBcnJheSwgc28gb24gdW5sb2FkIHRoZSBkZXRhY2hFdmVudCBmdW5jdGlvbnMgY2FuIGJlIGNhbGxlZCB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0Ki9cblx0ZnVuY3Rpb24gYWRkTGlzdGVuZXIodGFyZ2V0LCBldmVudFR5cGUsIGZuKSB7XG5cdFx0dGFyZ2V0LmF0dGFjaEV2ZW50KGV2ZW50VHlwZSwgZm4pO1xuXHRcdGxpc3RlbmVyc0FycltsaXN0ZW5lcnNBcnIubGVuZ3RoXSA9IFt0YXJnZXQsIGV2ZW50VHlwZSwgZm5dO1xuXHR9XG5cdC8qIEZsYXNoIFBsYXllciBhbmQgU1dGIGNvbnRlbnQgdmVyc2lvbiBtYXRjaGluZ1xuXHQqL1xuXHRmdW5jdGlvbiBoYXNQbGF5ZXJWZXJzaW9uKHJ2KSB7XG5cdFx0dmFyIHB2ID0gdWEucHYsIHYgPSBydi5zcGxpdChcIi5cIik7XG5cdFx0dlswXSA9IHBhcnNlSW50KHZbMF0sIDEwKTtcblx0XHR2WzFdID0gcGFyc2VJbnQodlsxXSwgMTApIHx8IDA7IC8vIHN1cHBvcnRzIHNob3J0IG5vdGF0aW9uLCBlLmcuIFwiOVwiIGluc3RlYWQgb2YgXCI5LjAuMFwiXG5cdFx0dlsyXSA9IHBhcnNlSW50KHZbMl0sIDEwKSB8fCAwO1xuXHRcdHJldHVybiAocHZbMF0gPiB2WzBdIHx8IChwdlswXSA9PSB2WzBdICYmIHB2WzFdID4gdlsxXSkgfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPT0gdlsxXSAmJiBwdlsyXSA+PSB2WzJdKSkgPyB0cnVlIDogZmFsc2U7XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBkeW5hbWljIENTUyBjcmVhdGlvblxuXHRcdC0gQmFzZWQgb24gQm9iYnkgdmFuIGRlciBTbHVpcycgc29sdXRpb246IGh0dHA6Ly93d3cuYm9iYnl2YW5kZXJzbHVpcy5jb20vYXJ0aWNsZXMvZHluYW1pY0NTUy5waHBcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlQ1NTKHNlbCwgZGVjbCwgbWVkaWEsIG5ld1N0eWxlKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLm1hYykgeyByZXR1cm47IH1cblx0XHR2YXIgaCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07XG5cdFx0aWYgKCFoKSB7IHJldHVybjsgfSAvLyB0byBhbHNvIHN1cHBvcnQgYmFkbHkgYXV0aG9yZWQgSFRNTCBwYWdlcyB0aGF0IGxhY2sgYSBoZWFkIGVsZW1lbnRcblx0XHR2YXIgbSA9IChtZWRpYSAmJiB0eXBlb2YgbWVkaWEgPT0gXCJzdHJpbmdcIikgPyBtZWRpYSA6IFwic2NyZWVuXCI7XG5cdFx0aWYgKG5ld1N0eWxlKSB7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IG51bGw7XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFkeW5hbWljU3R5bGVzaGVldCB8fCBkeW5hbWljU3R5bGVzaGVldE1lZGlhICE9IG0pIHtcblx0XHRcdC8vIGNyZWF0ZSBkeW5hbWljIHN0eWxlc2hlZXQgKyBnZXQgYSBnbG9iYWwgcmVmZXJlbmNlIHRvIGl0XG5cdFx0XHR2YXIgcyA9IGNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcblx0XHRcdHMuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvY3NzXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJtZWRpYVwiLCBtKTtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gaC5hcHBlbmRDaGlsZChzKTtcblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4gJiYgdHlwZW9mIGRvYy5zdHlsZVNoZWV0cyAhPSBVTkRFRiAmJiBkb2Muc3R5bGVTaGVldHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldCA9IGRvYy5zdHlsZVNoZWV0c1tkb2Muc3R5bGVTaGVldHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cdFx0XHRkeW5hbWljU3R5bGVzaGVldE1lZGlhID0gbTtcblx0XHR9XG5cdFx0Ly8gYWRkIHN0eWxlIHJ1bGVcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUgPT0gT0JKRUNUKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFkZFJ1bGUoc2VsLCBkZWNsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoZHluYW1pY1N0eWxlc2hlZXQgJiYgdHlwZW9mIGRvYy5jcmVhdGVUZXh0Tm9kZSAhPSBVTkRFRikge1xuXHRcdFx0XHRkeW5hbWljU3R5bGVzaGVldC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlVGV4dE5vZGUoc2VsICsgXCIge1wiICsgZGVjbCArIFwifVwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldFZpc2liaWxpdHkoaWQsIGlzVmlzaWJsZSkge1xuXHRcdGlmICghYXV0b0hpZGVTaG93KSB7IHJldHVybjsgfVxuXHRcdHZhciB2ID0gaXNWaXNpYmxlID8gXCJ2aXNpYmxlXCIgOiBcImhpZGRlblwiO1xuXHRcdGlmIChpc0RvbUxvYWRlZCAmJiBnZXRFbGVtZW50QnlJZChpZCkpIHtcblx0XHRcdGdldEVsZW1lbnRCeUlkKGlkKS5zdHlsZS52aXNpYmlsaXR5ID0gdjtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVDU1MoXCIjXCIgKyBpZCwgXCJ2aXNpYmlsaXR5OlwiICsgdik7XG5cdFx0fVxuXHR9XG5cdC8qIEZpbHRlciB0byBhdm9pZCBYU1MgYXR0YWNrc1xuXHQqL1xuXHRmdW5jdGlvbiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShzKSB7XG5cdFx0dmFyIHJlZ2V4ID0gL1tcXFxcXFxcIjw+XFwuO10vO1xuXHRcdHZhciBoYXNCYWRDaGFycyA9IHJlZ2V4LmV4ZWMocykgIT0gbnVsbDtcblx0XHRyZXR1cm4gaGFzQmFkQ2hhcnMgJiYgdHlwZW9mIGVuY29kZVVSSUNvbXBvbmVudCAhPSBVTkRFRiA/IGVuY29kZVVSSUNvbXBvbmVudChzKSA6IHM7XG5cdH1cblx0LyogUmVsZWFzZSBtZW1vcnkgdG8gYXZvaWQgbWVtb3J5IGxlYWtzIGNhdXNlZCBieSBjbG9zdXJlcywgZml4IGhhbmdpbmcgYXVkaW8vdmlkZW8gdGhyZWFkcyBhbmQgZm9yY2Ugb3BlbiBzb2NrZXRzL05ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3QgKEludGVybmV0IEV4cGxvcmVyIG9ubHkpXG5cdCovXG5cdHZhciBjbGVhbnVwID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLndpbikge1xuXHRcdFx0d2luZG93LmF0dGFjaEV2ZW50KFwib251bmxvYWRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBsaXN0ZW5lcnMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdHZhciBsbCA9IGxpc3RlbmVyc0Fyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGw7IGkrKykge1xuXHRcdFx0XHRcdGxpc3RlbmVyc0FycltpXVswXS5kZXRhY2hFdmVudChsaXN0ZW5lcnNBcnJbaV1bMV0sIGxpc3RlbmVyc0FycltpXVsyXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBkeW5hbWljYWxseSBlbWJlZGRlZCBvYmplY3RzIHRvIGZpeCBhdWRpby92aWRlbyB0aHJlYWRzIGFuZCBmb3JjZSBvcGVuIHNvY2tldHMgYW5kIE5ldENvbm5lY3Rpb25zIHRvIGRpc2Nvbm5lY3Rcblx0XHRcdFx0dmFyIGlsID0gb2JqSWRBcnIubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGlsOyBqKyspIHtcblx0XHRcdFx0XHRyZW1vdmVTV0Yob2JqSWRBcnJbal0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGNsZWFudXAgbGlicmFyeSdzIG1haW4gY2xvc3VyZXMgdG8gYXZvaWQgbWVtb3J5IGxlYWtzXG5cdFx0XHRcdGZvciAodmFyIGsgaW4gdWEpIHtcblx0XHRcdFx0XHR1YVtrXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dWEgPSBudWxsO1xuXHRcdFx0XHRmb3IgKHZhciBsIGluIHN3Zm9iamVjdCkge1xuXHRcdFx0XHRcdHN3Zm9iamVjdFtsXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3dmb2JqZWN0ID0gbnVsbDtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSgpO1xuXHRyZXR1cm4ge1xuXHRcdC8qIFB1YmxpYyBBUElcblx0XHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3dpa2kvZG9jdW1lbnRhdGlvblxuXHRcdCovXG5cdFx0cmVnaXN0ZXJPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdElkU3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIG9iamVjdElkU3RyICYmIHN3ZlZlcnNpb25TdHIpIHtcblx0XHRcdFx0dmFyIHJlZ09iaiA9IHt9O1xuXHRcdFx0XHRyZWdPYmouaWQgPSBvYmplY3RJZFN0cjtcblx0XHRcdFx0cmVnT2JqLnN3ZlZlcnNpb24gPSBzd2ZWZXJzaW9uU3RyO1xuXHRcdFx0XHRyZWdPYmouZXhwcmVzc0luc3RhbGwgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0cmVnT2JqLmNhbGxiYWNrRm4gPSBjYWxsYmFja0ZuO1xuXHRcdFx0XHRyZWdPYmpBcnJbcmVnT2JqQXJyLmxlbmd0aF0gPSByZWdPYmo7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkob2JqZWN0SWRTdHIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHtcblx0XHRcdFx0Y2FsbGJhY2tGbih7c3VjY2VzczpmYWxzZSwgaWQ6b2JqZWN0SWRTdHJ9KTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGdldE9iamVjdEJ5SWQ6IGZ1bmN0aW9uKG9iamVjdElkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmV0dXJuIGdldE9iamVjdEJ5SWQob2JqZWN0SWRTdHIpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcblx0XHRcdHZhciBjYWxsYmFja09iaiA9IHtzdWNjZXNzOmZhbHNlLCBpZDpyZXBsYWNlRWxlbUlkU3RyfTtcblx0XHRcdGlmICh1YS53MyAmJiAhKHVhLndrICYmIHVhLndrIDwgMzEyKSAmJiBzd2ZVcmxTdHIgJiYgcmVwbGFjZUVsZW1JZFN0ciAmJiB3aWR0aFN0ciAmJiBoZWlnaHRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIGZhbHNlKTtcblx0XHRcdFx0YWRkRG9tTG9hZEV2ZW50KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdpZHRoU3RyICs9IFwiXCI7IC8vIGF1dG8tY29udmVydCB0byBzdHJpbmdcblx0XHRcdFx0XHRoZWlnaHRTdHIgKz0gXCJcIjtcblx0XHRcdFx0XHR2YXIgYXR0ID0ge307XG5cdFx0XHRcdFx0aWYgKGF0dE9iaiAmJiB0eXBlb2YgYXR0T2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYXR0T2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBhdHRPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0YXR0W2ldID0gYXR0T2JqW2ldO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHQuZGF0YSA9IHN3ZlVybFN0cjtcblx0XHRcdFx0XHRhdHQud2lkdGggPSB3aWR0aFN0cjtcblx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gaGVpZ2h0U3RyO1xuXHRcdFx0XHRcdHZhciBwYXIgPSB7fTtcblx0XHRcdFx0XHRpZiAocGFyT2JqICYmIHR5cGVvZiBwYXJPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaiBpbiBwYXJPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIHBhck9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRwYXJbal0gPSBwYXJPYmpbal07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmbGFzaHZhcnNPYmogJiYgdHlwZW9mIGZsYXNodmFyc09iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrIGluIGZsYXNodmFyc09iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgZmxhc2h2YXJzT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRcdHBhci5mbGFzaHZhcnMgKz0gXCImXCIgKyBrICsgXCI9XCIgKyBmbGFzaHZhcnNPYmpba107XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaGFzUGxheWVyVmVyc2lvbihzd2ZWZXJzaW9uU3RyKSkgeyAvLyBjcmVhdGUgU1dGXG5cdFx0XHRcdFx0XHR2YXIgb2JqID0gY3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdFx0XHRcdGlmIChhdHQuaWQgPT0gcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGJhY2tPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5yZWYgPSBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKHhpU3dmVXJsU3RyICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHsgLy8gc2hvdyBBZG9iZSBFeHByZXNzIEluc3RhbGxcblx0XHRcdFx0XHRcdGF0dC5kYXRhID0geGlTd2ZVcmxTdHI7XG5cdFx0XHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHsgLy8gc2hvdyBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KHJlcGxhY2VFbGVtSWRTdHIsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTsgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhbGxiYWNrRm4pIHsgY2FsbGJhY2tGbihjYWxsYmFja09iaik7XHR9XG5cdFx0fSxcblx0XHRzd2l0Y2hPZmZBdXRvSGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuXHRcdFx0YXV0b0hpZGVTaG93ID0gZmFsc2U7XG5cdFx0fSxcblx0XHR1YTogdWEsXG5cdFx0Z2V0Rmxhc2hQbGF5ZXJWZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7IG1ham9yOnVhLnB2WzBdLCBtaW5vcjp1YS5wdlsxXSwgcmVsZWFzZTp1YS5wdlsyXSB9O1xuXHRcdH0sXG5cdFx0aGFzRmxhc2hQbGF5ZXJWZXJzaW9uOiBoYXNQbGF5ZXJWZXJzaW9uLFxuXHRcdGNyZWF0ZVNXRjogZnVuY3Rpb24oYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2hvd0V4cHJlc3NJbnN0YWxsOiBmdW5jdGlvbihhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdFx0aWYgKHVhLnczICYmIGNhbkV4cHJlc3NJbnN0YWxsKCkpIHtcblx0XHRcdFx0c2hvd0V4cHJlc3NJbnN0YWxsKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlbW92ZVNXRjogZnVuY3Rpb24ob2JqRWxlbUlkU3RyKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0cmVtb3ZlU1dGKG9iakVsZW1JZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjcmVhdGVDU1M6IGZ1bmN0aW9uKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdGNyZWF0ZUNTUyhzZWxTdHIsIGRlY2xTdHIsIG1lZGlhU3RyLCBuZXdTdHlsZUJvb2xlYW4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWRkRG9tTG9hZEV2ZW50OiBhZGREb21Mb2FkRXZlbnQsXG5cdFx0YWRkTG9hZEV2ZW50OiBhZGRMb2FkRXZlbnQsXG5cdFx0Z2V0UXVlcnlQYXJhbVZhbHVlOiBmdW5jdGlvbihwYXJhbSkge1xuXHRcdFx0dmFyIHEgPSBkb2MubG9jYXRpb24uc2VhcmNoIHx8IGRvYy5sb2NhdGlvbi5oYXNoO1xuXHRcdFx0aWYgKHEpIHtcblx0XHRcdFx0aWYgKC9cXD8vLnRlc3QocSkpIHsgcSA9IHEuc3BsaXQoXCI/XCIpWzFdOyB9IC8vIHN0cmlwIHF1ZXN0aW9uIG1hcmtcblx0XHRcdFx0aWYgKHBhcmFtID09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHBhaXJzID0gcS5zcGxpdChcIiZcIik7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAocGFpcnNbaV0uc3Vic3RyaW5nKDAsIHBhaXJzW2ldLmluZGV4T2YoXCI9XCIpKSA9PSBwYXJhbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVybEVuY29kZUlmTmVjZXNzYXJ5KHBhaXJzW2ldLnN1YnN0cmluZygocGFpcnNbaV0uaW5kZXhPZihcIj1cIikgKyAxKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fSxcblx0XHQvLyBGb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRcdGV4cHJlc3NJbnN0YWxsQ2FsbGJhY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGlzRXhwcmVzc0luc3RhbGxBY3RpdmUpIHtcblx0XHRcdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKEVYUFJFU1NfSU5TVEFMTF9JRCk7XG5cdFx0XHRcdGlmIChvYmogJiYgc3RvcmVkQWx0Q29udGVudCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzdG9yZWRBbHRDb250ZW50LCBvYmopO1xuXHRcdFx0XHRcdGlmIChzdG9yZWRBbHRDb250ZW50SWQpIHtcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkoc3RvcmVkQWx0Q29udGVudElkLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgc3RvcmVkQWx0Q29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiOyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9yZWRDYWxsYmFja0ZuKSB7IHN0b3JlZENhbGxiYWNrRm4oc3RvcmVkQ2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNFeHByZXNzSW5zdGFsbEFjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0oKTtcbm1vZHVsZS5leHBvcnRzID0gc3dmb2JqZWN0O1xuIiwiLyoqXG4gKiDQodC+0LfQtNCw0ZHRgiDRjdC60LfQtdC80L/Qu9GP0YAg0LrQu9Cw0YHRgdCwLCDQvdC+INC90LUg0LfQsNC/0YPRgdC60LDQtdGCINC10LPQviDQutC+0L3RgdGC0YDRg9C60YLQvtGAXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0LrQu9Cw0YHRgVxuICogQHJldHVybnMge09yaWdpbmFsQ2xhc3N9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY2xlYXJJbnN0YW5jZSA9IGZ1bmN0aW9uKE9yaWdpbmFsQ2xhc3MpIHtcbiAgICB2YXIgQ2xlYXJDbGFzcyA9IGZ1bmN0aW9uKCl7fTtcbiAgICBDbGVhckNsYXNzLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuICAgIHJldHVybiBuZXcgQ2xlYXJDbGFzcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGVhckluc3RhbmNlO1xuIiwidmFyIGNsZWFySW5zdGFuY2UgPSByZXF1aXJlKCcuL2NsZWFyLWluc3RhbmNlJyk7XG5cbi8qKlxuICogQ2xhc3NpYyBFcnJvciBhY3RzIGxpa2UgYSBmYWJyaWM6IEVycm9yLmNhbGwodGhpcywgbWVzc2FnZSkganVzdCBjcmVhdGUgbmV3IG9iamVjdC5cbiAqIEVycm9yQ2xhc3MgYWN0cyBtb3JlIGxpa2UgYSBjbGFzczogRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpIG1vZGlmeSAndGhpcycgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIGVycm9yIG1lc3NhZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBbaWRdIC0gZXJyb3IgaWRcbiAqIEBleHRlbmRzIEVycm9yXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBFcnJvckNsYXNzID0gZnVuY3Rpb24obWVzc2FnZSwgaWQpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UsIGlkKTtcbiAgICBlcnIubmFtZSA9IHRoaXMubmFtZTtcblxuICAgIHRoaXMubWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIHRoaXMuc3RhY2sgPSBlcnIuc3RhY2s7XG59O1xuXG4vKipcbiAqIFN1Z2FyLiBKdXN0IGNyZWF0ZSBpbmhlcml0YW5jZSBmcm9tIEVycm9yQ2xhc3MgYW5kIGRlZmluZSBuYW1lIHByb3BlcnR5XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIG5hbWUgb2YgZXJyb3IgdHlwZVxuICogQHJldHVybnMge0Vycm9yQ2xhc3N9XG4gKi9cbkVycm9yQ2xhc3MuY3JlYXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBlcnJDbGFzcyA9IGNsZWFySW5zdGFuY2UoRXJyb3JDbGFzcyk7XG4gICAgZXJyQ2xhc3MubmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIGVyckNsYXNzO1xufTtcblxuRXJyb3JDbGFzcy5wcm90b3R5cGUgPSBjbGVhckluc3RhbmNlKEVycm9yKTtcbkVycm9yQ2xhc3MucHJvdG90eXBlLm5hbWUgPSBcIkVycm9yQ2xhc3NcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBFcnJvckNsYXNzO1xuIiwidmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uL2FzeW5jL2V2ZW50cycpO1xuXG4vKipcbiAqIEBjbGFzcyDQn9GA0L7QutGB0Lgt0LrQu9Cw0YHRgS4g0JLRi9C00LDRkdGCINC90LDRgNGD0LbRgyDQu9C40YjRjCDQv9GD0LHQu9C40YfQvdGL0LUg0LzQtdGC0L7QtNGLINC+0LHRitC10LrRgtCwINC4INGB0YLQsNGC0LjRh9C10YHQutC40LUg0YHQstC+0LnRgdGC0LLQsC5cbiAqINCd0LUg0LrQvtC/0LjRgNGD0LXRgiDQvNC10YLQvtC00Ysg0LjQtyBPYmplY3QucHJvdG90eXBlLiDQktGB0LUg0LzQtdGC0L7QtNGLINC40LzQtdGO0YIg0L/RgNC40LLRj9C30LrRgyDQutC+0L3RgtC10LrRgdGC0LAg0Log0L/RgNC+0LrRgdC40YDRg9C10LzQvtC80YMg0L7QsdGK0LXQutGC0YMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIC0g0L7QsdGK0LXQutGCLCDQutC+0YLQvtGA0YvQuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0L/RgNC+0LrRgdC40YDQvtCy0LDRgtGMXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBQcm94eSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKGtleVswXSA9PT0gXCJfXCJcbiAgICAgICAgICAgICAgICB8fCB0eXBlb2Ygb2JqZWN0W2tleV0gIT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgIHx8IG9iamVjdFtrZXldID09PSBPYmplY3QucHJvdG90eXBlW2tleV1cbiAgICAgICAgICAgICAgICB8fCBvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgICAgIHx8IEV2ZW50cy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzW2tleV0gPSBvYmplY3Rba2V5XS5iaW5kKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2JqZWN0LnBpcGVFdmVudHMpIHtcbiAgICAgICAgICAgIEV2ZW50cy5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLm9uID0gRXZlbnRzLnByb3RvdHlwZS5vbjtcbiAgICAgICAgICAgIHRoaXMub25jZSA9IEV2ZW50cy5wcm90b3R5cGUub25jZTtcbiAgICAgICAgICAgIHRoaXMub2ZmID0gRXZlbnRzLnByb3RvdHlwZS5vZmY7XG4gICAgICAgICAgICB0aGlzLmNsZWFyTGlzdGVuZXJzID0gRXZlbnRzLnByb3RvdHlwZS5jbGVhckxpc3RlbmVycztcblxuICAgICAgICAgICAgb2JqZWN0LnBpcGVFdmVudHModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqINCt0LrRgdC/0L7RgNGC0LjRgNGD0LXRgiDRgdGC0LDRgtC40YfQtdGB0LrQuNC1INGB0LLQvtC50YHRgtCy0LAg0LjQtyDQvtC00L3QvtCz0L4g0L7QsdGK0LXQutGC0LAg0LIg0LTRgNGD0LPQvtC5LCDQuNGB0LrQu9GO0YfQsNGPINGD0LrQsNC30LDQvdC90YvQtSwg0L/RgNC40LLQsNGC0L3Ri9C1INC4INC/0YDQvtGC0L7RgtC40L9cbiAqIEBwYXJhbSB7T2JqZWN0fSBmcm9tIC0g0L7RgtC60YPQtNCwINC60L7Qv9C40YDQvtCy0LDRgtGMXG4gKiBAcGFyYW0ge09iamVjdH0gdG8gLSDQutGD0LTQsCDQutC+0L/QuNGA0L7QstCw0YLRjFxuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gW2V4Y2x1ZGVdIC0g0YHQstC+0LnRgdGC0LLQsCDQutC+0YLQvtGA0YvQtSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LjRgdC60LvRjtGH0LjRgtGMXG4gKi9cblByb3h5LmV4cG9ydFN0YXRpYyA9IGZ1bmN0aW9uKGZyb20sIHRvLCBleGNsdWRlKSB7XG4gICAgZXhjbHVkZSA9IGV4Y2x1ZGUgfHwgW107XG5cbiAgICBPYmplY3Qua2V5cyhmcm9tKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBpZiAoIWZyb20uaGFzT3duUHJvcGVydHkoa2V5KVxuICAgICAgICAgICAgfHwga2V5WzBdID09PSBcIl9cIlxuICAgICAgICAgICAgfHwga2V5ID09PSBcInByb3RvdHlwZVwiXG4gICAgICAgICAgICB8fCBleGNsdWRlLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSk7XG59O1xuXG4vKipcbiAqINCh0L7Qt9C00LDQvdC40LUg0L/RgNC+0LrRgdC4LdC/0LvQsNGB0YHQsCDQv9GA0LjQstGP0LfQsNC90L3QvtCz0L4g0Log0YPQutCw0LfQsNC90L3QvtC80YMg0LrQu9Cw0YHRgdGDLiDQnNC+0LbQvdC+INC90LDQt9C90LDRh9C40YLRjCDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgS5cbiAqINCjINGA0L7QtNC40YLQtdC70YzRgdC60L7Qs9C+INC60LvQsNGB0YHQsCDQv9C+0Y/QstC70Y/QtdGC0YHRjyDQv9GA0LjQstCw0YLQvdGL0Lkg0LzQtdGC0L7QtCBfcHJveHksINC60L7RgtC+0YDRi9C5INCy0YvQtNCw0ZHRgiDQv9GA0L7QutGB0Lgt0L7QsdGK0LXQutGCINC00LvRj1xuICog0LTQsNC90L3QvtCz0L4g0Y3QutC30LXQvNC70Y/RgNCwLiDQotCw0LrQttC1INC/0L7Rj9Cy0LvRj9C10YLRgdGPINGB0LLQvtC50YHRgtCy0L4gX19wcm94eSwg0YHQvtC00LXRgNC20LDRidC10LUg0YHRgdGL0LvQutGDINC90LAg0YHQvtC30LTQsNC90L3Ri9C5INC/0YDQvtC60YHQuC3QvtCx0YrQtdC60YJcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBPcmlnaW5hbENsYXNzIC0g0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C5INC60LvQsNGB0YFcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFBhcmVudFByb3h5Q2xhc3MgLSDRgNC+0LTQuNGC0LXQu9GM0YHQutC40Lkg0LrQu9Cw0YHRgVxuICogQHJldHVybnMge2Z1bmN0aW9ufSAtLSDQutC+0L3RgdGC0YDRg9GC0L7RgCDQv9GA0L7QutGB0LjRgNC+0LLQsNC90L3QvtCz0L4g0LrQu9Cw0YHRgdCwXG4gKi9cblByb3h5LmNyZWF0ZUNsYXNzID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcywgUGFyZW50UHJveHlDbGFzcykge1xuXG4gICAgdmFyIFByb3h5Q2xhc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgIE9yaWdpbmFsQ2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZTtcblxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBuZXcgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yKCk7XG4gICAgICAgIE9yaWdpbmFsQ2xhc3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLl9wcm94eSgpO1xuICAgIH07XG5cbiAgICB2YXIgUGFyZW50UHJveHlDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IucHJvdG90eXBlID0gKFBhcmVudFByb3h5Q2xhc3MgfHwgUHJveHkpLnByb3RvdHlwZTtcbiAgICBQcm94eUNsYXNzLnByb3RvdHlwZSA9IG5ldyBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IoKTtcblxuICAgIHZhciB2YWw7XG4gICAgZm9yICh2YXIgayBpbiBPcmlnaW5hbENsYXNzLnByb3RvdHlwZSkge1xuICAgICAgICB2YWwgPSBPcmlnaW5hbENsYXNzLnByb3RvdHlwZVtrXTtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGVba10gPT0gdmFsIHx8IHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiB8fCBrWzBdID09PSBcIl9cIikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVba10gPSB2YWw7XG4gICAgfVxuXG4gICAgdmFyIGNyZWF0ZVByb3h5ID0gZnVuY3Rpb24ob3JpZ2luYWwpIHtcbiAgICAgICAgdmFyIHByb3RvID0gUHJveHkucHJvdG90eXBlO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBQcm94eUNsYXNzLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KG9yaWdpbmFsKTtcbiAgICAgICAgUHJveHkucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9O1xuXG4gICAgT3JpZ2luYWxDbGFzcy5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fX3Byb3h5KSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJveHkgPSBjcmVhdGVQcm94eSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fcHJveHk7XG4gICAgfTtcblxuICAgIFByb3h5LmV4cG9ydFN0YXRpYyhPcmlnaW5hbENsYXNzLCBQcm94eUNsYXNzKTtcblxuICAgIHJldHVybiBQcm94eUNsYXNzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm94eTtcbiIsIi8qKlxuICog0KHQutC+0L/QuNGA0L7QstCw0YLRjCDRgdCy0L7QudGB0YLQstCwINCy0YHQtdGFINC/0LXRgNC10YfQuNGB0LvQtdC90L3Ri9GFINC+0LHRitC10LrRgtC+0LIg0LIg0L7QtNC40L0uXG4gKiBAcGFyYW0ge09iamVjdH0gaW5pdGlhbCAtINC10YHQu9C4INC/0L7RgdC70LXQtNC90LjQuSDQsNGA0LPRg9C80LXQvdGCIHRydWUsINGC0L4g0L3QvtCy0YvQuSDQvtCx0YrQtdC60YIg0L3QtSDRgdC+0LfQtNCw0ZHRgtGB0Y8sINCwINC40YHQv9C+0LvRjNC30YPQtdGC0YHRjyDQtNCw0L3QvdGL0LlcbiAqIEBwYXJhbSB7Li4uT2JqZWN0fEJvb2xlYW59IGFyZ3MgLSDRgdC/0LjRgdC+0Log0L7QsdGK0LXQutGC0L7QsiDQuNC3INC60L7RgtC+0YDRi9GFINC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAuINCf0L7RgdC70LXQtNC90LjQuSDQsNGA0LPRg9C80LXQvdGCINC80L7QttC10YIg0LHRi9GC0Ywg0LvQuNCx0L5cbiAqINC+0LHRitC10LrRgtC+0LwsINC70LjQsdC+IHRydWUuXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xudmFyIG1lcmdlID0gZnVuY3Rpb24gKGluaXRpYWwpIHtcbiAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBrZXk7XG5cbiAgICBpZiAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB0cnVlKSB7XG4gICAgICAgIG9iamVjdCA9IGluaXRpYWw7XG4gICAgICAgIGFyZ3MucG9wKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0ID0ge307XG4gICAgICAgIGZvciAoa2V5IGluIGluaXRpYWwpIHtcbiAgICAgICAgICAgIGlmIChpbml0aWFsLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IGluaXRpYWxba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGsgPSAwLCBsID0gYXJncy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgZm9yIChrZXkgaW4gYXJnc1trXSkge1xuICAgICAgICAgICAgaWYgKGFyZ3Nba10uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gYXJnc1trXVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJyZXF1aXJlKCcuLi8uLi8uLi9leHBvcnQnKTtcblxudmFyIExvYWRlckVycm9yID0gcmVxdWlyZSgnLi9sb2FkZXItZXJyb3InKTtcblxueWEuQXVkaW8uTG9hZGVyRXJyb3IgPSBMb2FkZXJFcnJvcjtcbiIsInZhciBFcnJvckNsYXNzID0gcmVxdWlyZSgnLi4vLi4vY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiDQmtC70LDRgdGBINC+0YjQuNCx0L7QuiDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQGFsaWFzIHlhLkF1ZGlvLkxvYWRlckVycm9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgLSDRgtC10LrRgdGCINC+0YjQuNCx0LrQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIExvYWRlckVycm9yID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgIEVycm9yQ2xhc3MuY2FsbCh0aGlzLCBtZXNzYWdlKTtcbn07XG5Mb2FkZXJFcnJvci5wcm90b3R5cGUgPSBFcnJvckNsYXNzLmNyZWF0ZShcIkxvYWRlckVycm9yXCIpO1xuXG4vKipcbiAqINCi0LDQudC80LDRg9GCINC30LDQs9GA0YPQt9C60LhcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuTG9hZGVyRXJyb3IuVElNRU9VVCA9IFwicmVxdWVzdCB0aW1lb3V0XCI7XG4vKipcbiAqINCe0YjQuNCx0LrQsCDQt9Cw0L/RgNC+0YHQsCDQvdCwINC30LDQs9GA0YPQt9C60YNcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuTG9hZGVyRXJyb3IuRkFJTEVEID0gXCJyZXF1ZXN0IGZhaWxlZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvYWRlckVycm9yO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHt9O1xuIiwicmVxdWlyZShcIi4uL2V4cG9ydFwiKTtcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5cbnlhLkF1ZGlvLkxvZ2dlciA9IExvZ2dlcjtcbiIsInZhciBMRVZFTFMgPSBbXCJkZWJ1Z1wiLCBcImxvZ1wiLCBcImluZm9cIiwgXCJ3YXJuXCIsIFwiZXJyb3JcIiwgXCJ0cmFjZVwiXTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vbGliL25vb3AnKTtcblxuLyoqXG4gKiDQndCw0YHRgtGA0LDQuNCy0LDQtdC80YvQtSDQu9C+0LPQs9C10YAg0LTQu9GPINCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAYWxpYXMgeWEuQXVkaW8uTG9nZ2VyXG4gKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbCAtINC40LzRjyDQutCw0L3QsNC70LAsINC30LAg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtGC0LLQtdGH0LDRgtGMINGN0LrQt9C10LzQu9GP0YAg0LvQvtCz0LPQtdGA0LBcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG59O1xuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQuNCz0L3QvtGA0LjRgNGD0LXQvNGL0YUg0LrQsNC90LDQu9C+0LJcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmlnbm9yZXMgPSBbXTtcblxuLyoqXG4gKiDQodC/0LjRgdC+0Log0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINCyINC60L7QvdGB0L7Qu9C4INGD0YDQvtCy0L3QtdC5INC70L7Qs9CwXG4gKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG4gKi9cbkxvZ2dlci5sb2dMZXZlbHMgPSBbXTtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZGVidWcqKlxuICogQG1ldGhvZCB5YS5BdWRpby5Mb2dnZXIjZGVidWdcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5kZWJ1ZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmxvZyoqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciNsb2dcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5sb2cgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKippbmZvKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI2luZm9cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5pbmZvID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqd2FybioqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciN3YXJuXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUud2FybiA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmVycm9yKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI2Vycm9yXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUuZXJyb3IgPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip0cmFjZSoqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciN0cmFjZVxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLnRyYWNlID0gbm9vcDtcblxuLyoqXG4gKiDQodC00LXQu9Cw0YLRjCDQt9Cw0L/QuNGB0Ywg0LIg0LvQvtCzXG4gKiBAcGFyYW0ge1N0cmluZ30gbGV2ZWwgLSDRg9GA0L7QstC10L3RjCDQu9C+0LPQsFxuICogQHBhcmFtIHtTdHJpbmd9IGNoYW5uZWwgLSDQutCw0L3QsNC7XG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5sb2cgPSBmdW5jdGlvbihsZXZlbCwgY2hhbm5lbCwgY29udGV4dCkge1xuICAgIHZhciBkYXRhID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpLm1hcChmdW5jdGlvbihkdW1wSXRlbSkge1xuICAgICAgICByZXR1cm4gZHVtcEl0ZW0gJiYgZHVtcEl0ZW0uX2xvZ2dlciAmJiBkdW1wSXRlbS5fbG9nZ2VyKCkgfHwgZHVtcEl0ZW07XG4gICAgfSk7XG5cbiAgICB2YXIgbG9nRW50cnkgPSB7XG4gICAgICAgIHRpbWVzdGFtcDogK25ldyBEYXRlKCksXG4gICAgICAgIGxldmVsOiBsZXZlbCxcbiAgICAgICAgY2hhbm5lbDogY2hhbm5lbCxcbiAgICAgICAgY29udGV4dDogY29udGV4dCxcbiAgICAgICAgbWVzc2FnZTogZGF0YVxuICAgIH07XG5cbiAgICBpZiAoTG9nZ2VyLmlnbm9yZXNbY2hhbm5lbF0gfHwgTG9nZ2VyLmxvZ0xldmVscy5pbmRleE9mKGxldmVsKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIExvZ2dlci5fZHVtcEVudHJ5KGxvZ0VudHJ5KTtcbn07XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7Qs9C1XG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5BdWRpby5Mb2dnZXJ+TG9nRW50cnlcbiAqXG4gKiBAcHJvcGVydHkge051bWJlcn0gdGltZXN0YW1wIC0g0LLRgNC10LzRjyDQsiB0aW1lc3RhbXAg0YTQvtGA0LzQsNGC0LVcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBsZXZlbCAtINGD0YDQvtCy0LXQvdGMINC70L7Qs9CwXG4gKiBAcHJvcGVydHkge1N0cmluZ30gY2hhbm5lbCAtINC60LDQvdCw0LtcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IG1lc3NhZ2UgLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICpcbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiDQl9Cw0L/QuNGB0LDRgtGMINGB0L7QvtCx0YnQtdC90LjQtSDQu9C+0LPQsCDQsiDQutC+0L3RgdC+0LvRjFxuICogQHBhcmFtIHt5YS5BdWRpby5Mb2dnZXJ+TG9nRW50cnl9IGxvZ0VudHJ5IC0g0YHQvtC+0LHRidC10L3QuNC1INC70L7Qs9CwXG4gKiBAcHJpdmF0ZVxuICovXG5Mb2dnZXIuX2R1bXBFbnRyeSA9IGZ1bmN0aW9uKGxvZ0VudHJ5KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIGxldmVsID0gbG9nRW50cnkubGV2ZWw7XG5cbiAgICAgICAgdmFyIG5hbWUgPSBsb2dFbnRyeS5jb250ZXh0ICYmIChsb2dFbnRyeS5jb250ZXh0LnRhc2tOYW1lIHx8IGxvZ0VudHJ5LmNvbnRleHQubmFtZSk7XG4gICAgICAgIHZhciBjb250ZXh0ID0gbG9nRW50cnkuY29udGV4dCAmJiAobG9nRW50cnkuY29udGV4dC5fbG9nZ2VyID8gbG9nRW50cnkuY29udGV4dC5fbG9nZ2VyKCkgOiBcIlwiKTtcblxuICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGVbbGV2ZWxdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBsZXZlbC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIExvZ2dlci5fZm9ybWF0VGltZXN0YW1wKGxvZ0VudHJ5LnRpbWVzdGFtcCksXG4gICAgICAgICAgICAgICAgXCJbXCIgKyBsb2dFbnRyeS5jaGFubmVsICsgKG5hbWUgPyBcIjpcIiArIG5hbWUgOiBcIlwiKSArIFwiXVwiLFxuICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgIF0uY29uY2F0KGxvZ0VudHJ5Lm1lc3NhZ2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGVbbGV2ZWxdLmFwcGx5KGNvbnNvbGUsIFtcbiAgICAgICAgICAgICAgICBMb2dnZXIuX2Zvcm1hdFRpbWVzdGFtcChsb2dFbnRyeS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgIFwiW1wiICsgbG9nRW50cnkuY2hhbm5lbCArIChuYW1lID8gXCI6XCIgKyBuYW1lIDogXCJcIikgKyBcIl1cIixcbiAgICAgICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgICBdLmNvbmNhdChsb2dFbnRyeS5tZXNzYWdlKSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoKGUpIHtcbiAgICB9XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDRhNC+0YDQvNCw0YLQuNGA0L7QstCw0L3QuNGPINC00LDRgtGLINC00LvRjyDQstGL0LLQvtC00LAg0LIg0LrQvtC90L7RgdC+0LvRjFxuICogQHBhcmFtIHRpbWVzdGFtcFxuICogQHJldHVybnMge3N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZm9ybWF0VGltZXN0YW1wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgIHZhciBtcyA9IGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCk7XG4gICAgbXMgPSBtcyA+IDEwMCA/IG1zIDogbXMgPiAxMCA/IFwiMFwiICsgbXMgOiBcIjAwXCIgKyBtcztcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoKSArIFwiLlwiICsgbXM7XG59O1xuXG5MRVZFTFMuZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuICAgIExvZ2dlci5wcm90b3R5cGVbbGV2ZWxdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5jaGFubmVsKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGxldmVsKTtcbiAgICAgICAgTG9nZ2VyLmxvZy5hcHBseShMb2dnZXIsIGFyZ3MpO1xuICAgIH07XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iLCJ2YXIgTW9kdWxlcyA9IHJlcXVpcmUoJ3ltJyk7XG52YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKFwiLi9pbmRleC5qc1wiKTtcblxuaWYgKCF3aW5kb3cueWEpIHtcbiAgICB3aW5kb3cueWEgPSB7fTtcbn1cblxudmFyIG1vZHVsZXM7XG5pZiAod2luZG93LnlhLm1vZHVsZXMpIHtcbiAgICBtb2R1bGVzID0gd2luZG93LnlhLm1vZHVsZXM7XG59IGVsc2Uge1xuICAgIG1vZHVsZXMgPSB3aW5kb3cueWEubW9kdWxlcyA9IE1vZHVsZXMuY3JlYXRlKCk7XG59XG5cbm1vZHVsZXMuZGVmaW5lKCdZYW5kZXhBdWRpbycsIGZ1bmN0aW9uKHByb3ZpZGUpIHtcbiAgICBwcm92aWRlKFlhbmRleEF1ZGlvKTtcbn0pO1xuIl19
