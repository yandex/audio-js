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
 * @param {String} src - ссылка на трек
 * @returns {AbortablePromise}
 */
AudioPlayer.prototype.playPreloaded = function(src) {
    logger.info(this, "playPreloaded", src);

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

    if (this.webAudioApi) {
        this._addSource(loader);
    }
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

var modules;
if (window.modules) {
    modules = window.modules;
} else {
    modules = window.modules = Modules.create();
}

modules.define('YandexAudio', function(provide) {
    provide(YandexAudio);
});

},{"./index.js":22,"ym":3}]},{},[38])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Zvdy9saWIvdm93LmpzIiwibm9kZV9tb2R1bGVzL3ltL21vZHVsZXMuanMiLCJzcmMvYXVkaW8tcGxheWVyLmpzIiwic3JjL2F1ZGlvLXN0YXRpYy5qcyIsInNyYy9jb25maWcuanMiLCJzcmMvZXJyb3IvYXVkaW8tZXJyb3IuanMiLCJzcmMvZXJyb3IvZXhwb3J0LmpzIiwic3JjL2Vycm9yL3BsYXliYWNrLWVycm9yLmpzIiwic3JjL2V4cG9ydC5qcyIsInNyYy9mbGFzaC9hdWRpby1mbGFzaC5qcyIsInNyYy9mbGFzaC9mbGFzaC1pbnRlcmZhY2UuanMiLCJzcmMvZmxhc2gvZmxhc2gtbWFuYWdlci5qcyIsInNyYy9mbGFzaC9mbGFzaGJsb2Nrbm90aWZpZXIuanMiLCJzcmMvZmxhc2gvZmxhc2hlbWJlZGRlci5qcyIsInNyYy9mbGFzaC9sb2FkZXIuanMiLCJzcmMvZngvZXF1YWxpemVyL2RlZmF1bHQucHJlc2V0cy5qcyIsInNyYy9meC9lcXVhbGl6ZXIvZXF1YWxpemVyLmpzIiwic3JjL2Z4L2VxdWFsaXplci9leHBvcnQuanMiLCJzcmMvZngvZXhwb3J0LmpzIiwic3JjL2h0bWw1L2F1ZGlvLWh0bWw1LmpzIiwic3JjL2luZGV4LmpzIiwic3JjL2xpYi9hc3luYy9kZWZlcnJlZC5qcyIsInNyYy9saWIvYXN5bmMvZXZlbnRzLmpzIiwic3JjL2xpYi9hc3luYy9wcm9taXNlLmpzIiwic3JjL2xpYi9hc3luYy9yZWplY3QuanMiLCJzcmMvbGliL2Jyb3dzZXIvZGV0ZWN0LmpzIiwic3JjL2xpYi9icm93c2VyL3N3Zm9iamVjdC5qcyIsInNyYy9saWIvY2xhc3MvY2xlYXItaW5zdGFuY2UuanMiLCJzcmMvbGliL2NsYXNzL2Vycm9yLWNsYXNzLmpzIiwic3JjL2xpYi9jbGFzcy9wcm94eS5qcyIsInNyYy9saWIvZGF0YS9tZXJnZS5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2V4cG9ydC5qcyIsInNyYy9saWIvbmV0L2Vycm9yL2xvYWRlci1lcnJvci5qcyIsInNyYy9saWIvbm9vcC5qcyIsInNyYy9sb2dnZXIvZXhwb3J0LmpzIiwic3JjL2xvZ2dlci9sb2dnZXIuanMiLCJzcmMvbW9kdWxlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaHpDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbGFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeDFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE1BO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQG1vZHVsZSB2b3dcbiAqIEBhdXRob3IgRmlsYXRvdiBEbWl0cnkgPGRmaWxhdG92QHlhbmRleC10ZWFtLnJ1PlxuICogQHZlcnNpb24gMC40LjEwXG4gKiBAbGljZW5zZVxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwgbGljZW5zZXM6XG4gKiAgICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqICAgKiBodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWxcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG5cbnZhciB1bmRlZixcbiAgICBuZXh0VGljayA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZucyA9IFtdLFxuICAgICAgICAgICAgZW5xdWV1ZUZuID0gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm5zLnB1c2goZm4pID09PSAxO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhbGxGbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm5zVG9DYWxsID0gZm5zLCBpID0gMCwgbGVuID0gZm5zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuc1RvQ2FsbFtpKytdKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICBpZih0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7IC8vIGllMTAsIG5vZGVqcyA+PSAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldEltbWVkaWF0ZShjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5uZXh0VGljaykgeyAvLyBub2RlanMgPCAwLjEwXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHByb2Nlc3MubmV4dFRpY2soY2FsbEZucyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIE11dGF0aW9uT2JzZXJ2ZXIgPSBnbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBnbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjsgLy8gbW9kZXJuIGJyb3dzZXJzXG4gICAgICAgIGlmKE11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIHZhciBudW0gPSAxLFxuICAgICAgICAgICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cbiAgICAgICAgICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKGNhbGxGbnMpLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhIDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiAobm9kZS5kYXRhID0gKG51bSAqPSAtMSkpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGdsb2JhbC5wb3N0TWVzc2FnZSkge1xuICAgICAgICAgICAgdmFyIGlzUG9zdE1lc3NhZ2VBc3luYyA9IHRydWU7XG4gICAgICAgICAgICBpZihnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hlY2tBc3luYyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNQb3N0TWVzc2FnZUFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgICAgICBnbG9iYWwucG9zdE1lc3NhZ2UoJ19fY2hlY2tBc3luYycsICcqJyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLmRldGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBjaGVja0FzeW5jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoaXNQb3N0TWVzc2FnZUFzeW5jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1zZyA9ICdfX3Byb21pc2UnICsgK25ldyBEYXRlLFxuICAgICAgICAgICAgICAgICAgICBvbk1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlLmRhdGEgPT09IG1zZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uICYmIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEZucygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXI/XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlLCB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgb25NZXNzYWdlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIGdsb2JhbC5wb3N0TWVzc2FnZShtc2csICcqJyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG4gICAgICAgIGlmKCdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGRvYy5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKSkgeyAvLyBpZTYtaWU4XG4gICAgICAgICAgICB2YXIgY3JlYXRlU2NyaXB0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQgPSBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIChkb2MuZG9jdW1lbnRFbGVtZW50IHx8IGRvYy5ib2R5KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBjcmVhdGVTY3JpcHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHsgLy8gb2xkIGJyb3dzZXJzXG4gICAgICAgICAgICBlbnF1ZXVlRm4oZm4pICYmIHNldFRpbWVvdXQoY2FsbEZucywgMCk7XG4gICAgICAgIH07XG4gICAgfSkoKSxcbiAgICB0aHJvd0V4Y2VwdGlvbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfSxcbiAgICBpc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICE9PSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnO1xuICAgIH0sXG4gICAgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdG9TdHIuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH0sXG4gICAgZ2V0QXJyYXlLZXlzID0gZnVuY3Rpb24oYXJyKSB7XG4gICAgICAgIHZhciByZXMgPSBbXSxcbiAgICAgICAgICAgIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoO1xuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICByZXMucHVzaChpKyspO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBnZXRPYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpIGluIG9iaikge1xuICAgICAgICAgICAgb2JqLmhhc093blByb3BlcnR5KGkpICYmIHJlcy5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBkZWZpbmVDdXN0b21FcnJvclR5cGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHZhciByZXMgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXMucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIHdyYXBPbkZ1bGZpbGxlZCA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBpZHgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgb25GdWxmaWxsZWQuY2FsbCh0aGlzLCB2YWwsIGlkeCk7XG4gICAgICAgIH07XG4gICAgfTtcblxuLyoqXG4gKiBAY2xhc3MgRGVmZXJyZWRcbiAqIEBleHBvcnRzIHZvdzpEZWZlcnJlZFxuICogQGRlc2NyaXB0aW9uXG4gKiBUaGUgYERlZmVycmVkYCBjbGFzcyBpcyB1c2VkIHRvIGVuY2Fwc3VsYXRlIG5ld2x5LWNyZWF0ZWQgcHJvbWlzZSBvYmplY3QgYWxvbmcgd2l0aCBmdW5jdGlvbnMgdGhhdCByZXNvbHZlLCByZWplY3Qgb3Igbm90aWZ5IGl0LlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZGVzY3JpcHRpb25cbiAqIFlvdSBjYW4gdXNlIGB2b3cuZGVmZXIoKWAgaW5zdGVhZCBvZiB1c2luZyB0aGlzIGNvbnN0cnVjdG9yLlxuICpcbiAqIGBuZXcgdm93LkRlZmVycmVkKClgIGdpdmVzIHRoZSBzYW1lIHJlc3VsdCBhcyBgdm93LmRlZmVyKClgLlxuICovXG52YXIgRGVmZXJyZWQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2UoKTtcbn07XG5cbkRlZmVycmVkLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgRGVmZXJyZWQucHJvdG90eXBlICove1xuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGNvcnJlc3BvbmRpbmcgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9taXNlIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyB0aGUgY29ycmVzcG9uZGluZyBwcm9taXNlIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyID0gdm93LmRlZmVyKCksXG4gICAgICogICAgIHByb21pc2UgPSBkZWZlci5wcm9taXNlKCk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInc3VjY2VzcydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlci5yZXNvbHZlKCdzdWNjZXNzJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX3Jlc29sdmUodmFsdWUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWplY3RzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHJlYXNvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlID0gZGVmZXIucHJvbWlzZSgpO1xuICAgICAqXG4gICAgICogcHJvbWlzZS5mYWlsKGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAqICAgICAvLyByZWFzb24gaXMgXCInc29tZXRoaW5nIGlzIHdyb25nJ1wiIGhlcmVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyLnJlamVjdCgnc29tZXRoaW5nIGlzIHdyb25nJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGlmKHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih2b3cuaXNQcm9taXNlKHJlYXNvbikpIHtcbiAgICAgICAgICAgIHJlYXNvbiA9IHJlYXNvbi50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdCh2YWwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3Jlc29sdmUocmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Byb21pc2UuX3JlamVjdChyZWFzb24pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vdGlmaWVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2Ugd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcbiAgICAgKlxuICAgICAqIHByb21pc2UucHJvZ3Jlc3MoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgKiAgICAgLy8gdmFsdWUgaXMgXCInMjAlJ1wiLCBcIic0MCUnXCIgaGVyZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIubm90aWZ5KCcyMCUnKTtcbiAgICAgKiBkZWZlci5ub3RpZnkoJzQwJScpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIG5vdGlmeSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UuaXNSZXNvbHZlZCgpIHx8IHRoaXMuX3Byb21pc2UuX25vdGlmeSh2YWx1ZSk7XG4gICAgfVxufTtcblxudmFyIFBST01JU0VfU1RBVFVTID0ge1xuICAgIFBFTkRJTkcgICA6IDAsXG4gICAgUkVTT0xWRUQgIDogMSxcbiAgICBGVUxGSUxMRUQgOiAyLFxuICAgIFJFSkVDVEVEICA6IDNcbn07XG5cbi8qKlxuICogQGNsYXNzIFByb21pc2VcbiAqIEBleHBvcnRzIHZvdzpQcm9taXNlXG4gKiBAZGVzY3JpcHRpb25cbiAqIFRoZSBgUHJvbWlzZWAgY2xhc3MgaXMgdXNlZCB3aGVuIHlvdSB3YW50IHRvIGdpdmUgdG8gdGhlIGNhbGxlciBzb21ldGhpbmcgdG8gc3Vic2NyaWJlIHRvLFxuICogYnV0IG5vdCB0aGUgYWJpbGl0eSB0byByZXNvbHZlIG9yIHJlamVjdCB0aGUgZGVmZXJyZWQuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmVyIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZCN0aGUtcHJvbWlzZS1jb25zdHJ1Y3RvciBmb3IgZGV0YWlscy5cbiAqIEBkZXNjcmlwdGlvblxuICogWW91IHNob3VsZCB1c2UgdGhpcyBjb25zdHJ1Y3RvciBkaXJlY3RseSBvbmx5IGlmIHlvdSBhcmUgZ29pbmcgdG8gdXNlIGB2b3dgIGFzIERPTSBQcm9taXNlcyBpbXBsZW1lbnRhdGlvbi5cbiAqIEluIG90aGVyIGNhc2UgeW91IHNob3VsZCB1c2UgYHZvdy5kZWZlcigpYCBhbmQgYGRlZmVyLnByb21pc2UoKWAgbWV0aG9kcy5cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogZnVuY3Rpb24gZmV0Y2hKU09OKHVybCkge1xuICogICAgIHJldHVybiBuZXcgdm93LlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0LCBub3RpZnkpIHtcbiAqICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICogICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAqICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAqICAgICAgICAgeGhyLnNlbmQoKTtcbiAqICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICAgaWYoeGhyLnJlc3BvbnNlKSB7XG4gKiAgICAgICAgICAgICAgICAgcmVzb2x2ZSh4aHIucmVzcG9uc2UpO1xuICogICAgICAgICAgICAgfVxuICogICAgICAgICAgICAgZWxzZSB7XG4gKiAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoKSk7XG4gKiAgICAgICAgICAgICB9XG4gKiAgICAgICAgIH07XG4gKiAgICAgfSk7XG4gKiB9XG4gKiBgYGBcbiAqL1xudmFyIFByb21pc2UgPSBmdW5jdGlvbihyZXNvbHZlcikge1xuICAgIHRoaXMuX3ZhbHVlID0gdW5kZWY7XG4gICAgdGhpcy5fc3RhdHVzID0gUFJPTUlTRV9TVEFUVVMuUEVORElORztcblxuICAgIHRoaXMuX2Z1bGZpbGxlZENhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MgPSBbXTtcblxuICAgIGlmKHJlc29sdmVyKSB7IC8vIE5PVEU6IHNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9wcm9taXNlcy11bndyYXBwaW5nL2Jsb2IvbWFzdGVyL1JFQURNRS5tZFxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA9IHJlc29sdmVyLmxlbmd0aDtcblxuICAgICAgICByZXNvbHZlcihcbiAgICAgICAgICAgIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc29sdmVyRm5MZW4gPiAxP1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pc1Jlc29sdmVkKCkgfHwgX3RoaXMuX3JlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgICAgIH0gOlxuICAgICAgICAgICAgICAgIHVuZGVmLFxuICAgICAgICAgICAgcmVzb2x2ZXJGbkxlbiA+IDI/XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmlzUmVzb2x2ZWQoKSB8fCBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgfSA6XG4gICAgICAgICAgICAgICAgdW5kZWYpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlID0gLyoqIEBsZW5kcyBQcm9taXNlLnByb3RvdHlwZSAqLyB7XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIGZ1bGZpbGxlZCBwcm9taXNlIG9yIHRoZSByZWFzb24gaW4gY2FzZSBvZiByZWplY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICB2YWx1ZU9mIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVzb2x2ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1Jlc29sdmVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgIT09IFBST01JU0VfU1RBVFVTLlBFTkRJTkc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzRnVsZmlsbGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLkZVTEZJTExFRDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICBpc1JlamVjdGVkIDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXMgPT09IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHJlYWN0aW9ucyB0byB0aGUgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUHJvZ3Jlc3NdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBub3RpZmllZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfSBBIG5ldyBwcm9taXNlLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3Byb21pc2VzLWFwbHVzL3Byb21pc2VzLXNwZWMgZm9yIGRldGFpbHNcbiAgICAgKi9cbiAgICB0aGVuIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5fYWRkQ2FsbGJhY2tzKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbih1bmRlZmluZWQsIG9uUmVqZWN0ZWQpYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGEgcHJvdmlkZWQgJ3JlYXNvbicgYXMgYXJndW1lbnQgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgICdjYXRjaCcgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmx5IGEgcmVqZWN0aW9uIHJlYWN0aW9uLiBUaGlzIG1ldGhvZCBpcyBhIHNob3J0aGFuZCBmb3IgYHByb21pc2UudGhlbihudWxsLCBvblJlamVjdGVkKWAuIEl0J3MgYWxzbyBhbiBhbGlhcyBmb3IgYGNhdGNoYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWQgQ2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdpdGggdGhlIHZhbHVlIGFmdGVyIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2sgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGZhaWwgOiBmdW5jdGlvbihvblJlamVjdGVkLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZiwgb25SZWplY3RlZCwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlc29sdmluZyByZWFjdGlvbiAoZm9yIGJvdGggZnVsZmlsbG1lbnQgYW5kIHJlamVjdGlvbikuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24ob25SZXNvbHZlZCwgY3R4KSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgICAgICBjYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvblJlc29sdmVkLmNhbGwodGhpcywgX3RoaXMpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcy50aGVuKGNiLCBjYiwgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHByb2dyZXNzIHJlYWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Qcm9ncmVzcyBDYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSB3aGVuIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmLCB1bmRlZiwgb25Qcm9ncmVzcywgY3R4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTGlrZSBgcHJvbWlzZS50aGVuYCwgYnV0IFwic3ByZWFkc1wiIHRoZSBhcnJheSBpbnRvIGEgdmFyaWFkaWMgdmFsdWUgaGFuZGxlci5cbiAgICAgKiBJdCBpcyB1c2VmdWwgd2l0aCB0aGUgYHZvdy5hbGxgIGFuZCB0aGUgYHZvdy5hbGxSZXNvbHZlZGAgbWV0aG9kcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbkZ1bGZpbGxlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIGZ1bGZpbGxlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblJlamVjdGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24oYXJnMSwgYXJnMikge1xuICAgICAqICAgICAvLyBhcmcxIGlzIFwiMVwiLCBhcmcyIGlzIFwiJ3R3bydcIiBoZXJlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVzb2x2ZSgxKTtcbiAgICAgKiBkZWZlcjIucmVzb2x2ZSgndHdvJyk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgc3ByZWFkIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9uRnVsZmlsbGVkLmFwcGx5KHRoaXMsIHZhbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25SZWplY3RlZCxcbiAgICAgICAgICAgIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExpa2UgYHRoZW5gLCBidXQgdGVybWluYXRlcyBhIGNoYWluIG9mIHByb21pc2VzLlxuICAgICAqIElmIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkLCB0aGlzIG1ldGhvZCB0aHJvd3MgaXQncyBcInJlYXNvblwiIGFzIGFuIGV4Y2VwdGlvbiBpbiBhIGZ1dHVyZSB0dXJuIG9mIHRoZSBldmVudCBsb29wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZGVmZXIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKiBkZWZlci5yZWplY3QoRXJyb3IoJ0ludGVybmFsIGVycm9yJykpO1xuICAgICAqIGRlZmVyLnByb21pc2UoKS5kb25lKCk7IC8vIGV4Y2VwdGlvbiB0byBiZSB0aHJvd25cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCkge1xuICAgICAgICB0aGlzXG4gICAgICAgICAgICAudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KVxuICAgICAgICAgICAgLmZhaWwodGhyb3dFeGNlcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBpbiBgZGVsYXlgIG1pbGxpc2Vjb25kcyBpZiB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQsXG4gICAgICogb3IgaW1tZWRpYXRlbHkgcmVqZWN0ZWQgaWYgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZGVsYXkgOiBmdW5jdGlvbihkZWxheSkge1xuICAgICAgICB2YXIgdGltZXIsXG4gICAgICAgICAgICBwcm9taXNlID0gdGhpcy50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlbGF5KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBwcm9taXNlLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IHByb21pc2UgdGhhdCB3aWxsIGJlIHJlamVjdGVkIGluIGB0aW1lb3V0YCBtaWxsaXNlY29uZHNcbiAgICAgKiBpZiB0aGUgcHJvbWlzZSBpcyBub3QgcmVzb2x2ZWQgYmVmb3JlaGFuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lb3V0XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQxID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoNTApLFxuICAgICAqICAgICBwcm9taXNlV2l0aFRpbWVvdXQyID0gZGVmZXIucHJvbWlzZSgpLnRpbWVvdXQoMjAwKTtcbiAgICAgKlxuICAgICAqIHNldFRpbWVvdXQoXG4gICAgICogICAgIGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgZGVmZXIucmVzb2x2ZSgnb2snKTtcbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgMTAwKTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDEuZmFpbChmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgKiAgICAgLy8gcHJvbWlzZVdpdGhUaW1lb3V0IHRvIGJlIHJlamVjdGVkIGluIDUwbXNcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHByb21pc2VXaXRoVGltZW91dDIudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAvLyBwcm9taXNlV2l0aFRpbWVvdXQgdG8gYmUgZnVsZmlsbGVkIHdpdGggXCInb2snXCIgdmFsdWVcbiAgICAgKiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICB0aW1lb3V0IDogZnVuY3Rpb24odGltZW91dCkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KG5ldyB2b3cuVGltZWRPdXRFcnJvcigndGltZWQgb3V0JykpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGltZW91dCk7XG5cbiAgICAgICAgdGhpcy50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChyZWFzb24pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmZXIucHJvbWlzZSgpLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIF92b3cgOiB0cnVlLFxuXG4gICAgX3Jlc29sdmUgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZhbCA9PT0gdGhpcykge1xuICAgICAgICAgICAgdGhpcy5fcmVqZWN0KFR5cGVFcnJvcignQ2FuXFwndCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRDtcblxuICAgICAgICBpZih2YWwgJiYgISF2YWwuX3ZvdykgeyAvLyBzaG9ydHBhdGggZm9yIHZvdy5Qcm9taXNlXG4gICAgICAgICAgICB2YWwuaXNGdWxmaWxsZWQoKT9cbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbC52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICB2YWwuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QodmFsLnZhbHVlT2YoKSkgOlxuICAgICAgICAgICAgICAgICAgICB2YWwudGhlbihcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGZpbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzT2JqZWN0KHZhbCkgfHwgaXNGdW5jdGlvbih2YWwpKSB7XG4gICAgICAgICAgICB2YXIgdGhlbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGhlbiA9IHZhbC50aGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGVuLmNhbGwoXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc1Jlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcmVzb2x2ZSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fbm90aWZ5KHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkIHx8IHRoaXMuX3JlamVjdChlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mdWxmaWxsKHZhbCk7XG4gICAgfSxcblxuICAgIF9mdWxmaWxsIDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA+IFBST01JU0VfU1RBVFVTLlJFU09MVkVEKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGF0dXMgPSBQUk9NSVNFX1NUQVRVUy5GVUxGSUxMRUQ7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gdmFsO1xuXG4gICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3ModGhpcy5fZnVsZmlsbGVkQ2FsbGJhY2tzLCB2YWwpO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9yZWplY3QgOiBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgaWYodGhpcy5fc3RhdHVzID4gUFJPTUlTRV9TVEFUVVMuUkVTT0xWRUQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXR1cyA9IFBST01JU0VfU1RBVFVTLlJFSkVDVEVEO1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHJlYXNvbjtcblxuICAgICAgICB0aGlzLl9jYWxsQ2FsbGJhY2tzKHRoaXMuX3JlamVjdGVkQ2FsbGJhY2tzLCByZWFzb24pO1xuICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MgPSB0aGlzLl9yZWplY3RlZENhbGxiYWNrcyA9IHRoaXMuX3Byb2dyZXNzQ2FsbGJhY2tzID0gdW5kZWY7XG4gICAgfSxcblxuICAgIF9ub3RpZnkgOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2FsbENhbGxiYWNrcyh0aGlzLl9wcm9ncmVzc0NhbGxiYWNrcywgdmFsKTtcbiAgICB9LFxuXG4gICAgX2FkZENhbGxiYWNrcyA6IGZ1bmN0aW9uKGRlZmVyLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgb25Qcm9ncmVzcywgY3R4KSB7XG4gICAgICAgIGlmKG9uUmVqZWN0ZWQgJiYgIWlzRnVuY3Rpb24ob25SZWplY3RlZCkpIHtcbiAgICAgICAgICAgIGN0eCA9IG9uUmVqZWN0ZWQ7XG4gICAgICAgICAgICBvblJlamVjdGVkID0gdW5kZWY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvblByb2dyZXNzICYmICFpc0Z1bmN0aW9uKG9uUHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICBjdHggPSBvblByb2dyZXNzO1xuICAgICAgICAgICAgb25Qcm9ncmVzcyA9IHVuZGVmO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNiO1xuXG4gICAgICAgIGlmKCF0aGlzLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgY2IgPSB7IGRlZmVyIDogZGVmZXIsIGZuIDogaXNGdW5jdGlvbihvbkZ1bGZpbGxlZCk/IG9uRnVsZmlsbGVkIDogdW5kZWYsIGN0eCA6IGN0eCB9O1xuICAgICAgICAgICAgdGhpcy5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9mdWxmaWxsZWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdGhpcy5pc0Z1bGZpbGxlZCgpKSB7XG4gICAgICAgICAgICBjYiA9IHsgZGVmZXIgOiBkZWZlciwgZm4gOiBvblJlamVjdGVkLCBjdHggOiBjdHggfTtcbiAgICAgICAgICAgIHRoaXMuaXNSZWplY3RlZCgpP1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxDYWxsYmFja3MoW2NiXSwgdGhpcy5fdmFsdWUpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWplY3RlZENhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuX3N0YXR1cyA8PSBQUk9NSVNFX1NUQVRVUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3NDYWxsYmFja3MucHVzaCh7IGRlZmVyIDogZGVmZXIsIGZuIDogb25Qcm9ncmVzcywgY3R4IDogY3R4IH0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9jYWxsQ2FsbGJhY2tzIDogZnVuY3Rpb24oY2FsbGJhY2tzLCBhcmcpIHtcbiAgICAgICAgdmFyIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc1Jlc29sdmVkID0gdGhpcy5pc1Jlc29sdmVkKCksXG4gICAgICAgICAgICBpc0Z1bGZpbGxlZCA9IHRoaXMuaXNGdWxmaWxsZWQoKTtcblxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpID0gMCwgY2IsIGRlZmVyLCBmbjtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYiA9IGNhbGxiYWNrc1tpKytdO1xuICAgICAgICAgICAgICAgIGRlZmVyID0gY2IuZGVmZXI7XG4gICAgICAgICAgICAgICAgZm4gPSBjYi5mbjtcblxuICAgICAgICAgICAgICAgIGlmKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjdHggPSBjYi5jdHgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXM7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgPSBjdHg/IGZuLmNhbGwoY3R4LCBhcmcpIDogZm4oYXJnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlzUmVzb2x2ZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIubm90aWZ5KHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpc1Jlc29sdmVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNGdWxmaWxsZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShhcmcpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoYXJnKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlci5ub3RpZnkoYXJnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8qKiBAbGVuZHMgUHJvbWlzZSAqL1xudmFyIHN0YXRpY01ldGhvZHMgPSB7XG4gICAgLyoqXG4gICAgICogQ29lcmNlcyB0aGUgZ2l2ZW4gYHZhbHVlYCB0byBhIHByb21pc2UsIG9yIHJldHVybnMgdGhlIGB2YWx1ZWAgaWYgaXQncyBhbHJlYWR5IGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgY2FzdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cuY2FzdCh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGFyZSBmdWxmaWxsZWQuXG4gICAgICogSWYgYW55IG9mIHRoZSBgaXRlcmFibGVgIGl0ZW1zIGdldHMgcmVqZWN0ZWQsIHRoZW4gdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBpdGVyYWJsZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBhbGwgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gdm93LmFsbChpdGVyYWJsZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbnkgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0cyByZWplY3RlZCwgdGhlbiB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmFjZSA6IGZ1bmN0aW9uKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiB2b3cuYW55UmVzb2x2ZWQoaXRlcmFibGUpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBoYXZlIGB2YWx1ZWAncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVzb2x2ZSA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gcmVhc29uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlamVjdCA6IGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gdm93LnJlamVjdChyZWFzb24pO1xuICAgIH1cbn07XG5cbmZvcih2YXIgcHJvcCBpbiBzdGF0aWNNZXRob2RzKSB7XG4gICAgc3RhdGljTWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSAmJlxuICAgICAgICAoUHJvbWlzZVtwcm9wXSA9IHN0YXRpY01ldGhvZHNbcHJvcF0pO1xufVxuXG52YXIgdm93ID0gLyoqIEBleHBvcnRzIHZvdyAqLyB7XG4gICAgRGVmZXJyZWQgOiBEZWZlcnJlZCxcblxuICAgIFByb21pc2UgOiBQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBkZWZlcnJlZC4gVGhpcyBtZXRob2QgaXMgYSBmYWN0b3J5IG1ldGhvZCBmb3IgYHZvdzpEZWZlcnJlZGAgY2xhc3MuXG4gICAgICogSXQncyBlcXVpdmFsZW50IHRvIGBuZXcgdm93LkRlZmVycmVkKClgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3ZvdzpEZWZlcnJlZH1cbiAgICAgKi9cbiAgICBkZWZlciA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IERlZmVycmVkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLnRoZW5gLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvblByb2dyZXNzXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gbm90aWZpZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2N0eF0gQ29udGV4dCBvZiB0aGUgY2FsbGJhY2tzIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICB3aGVuIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5jYXN0KHZhbHVlKS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5mYWlsYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZCBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgcmVhc29uIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBmYWlsIDogZnVuY3Rpb24odmFsdWUsIG9uUmVqZWN0ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUsIHVuZGVmLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5hbHdheXNgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlc29sdmVkIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggdGhlIHByb21pc2UgYXMgYW4gYXJndW1lbnQsIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFjayBleGVjdXRpb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYWx3YXlzIDogZnVuY3Rpb24odmFsdWUsIG9uUmVzb2x2ZWQsIGN0eCkge1xuICAgICAgICByZXR1cm4gdm93LndoZW4odmFsdWUpLmFsd2F5cyhvblJlc29sdmVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5wcm9ncmVzc2AuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUHJvZ3Jlc3MgQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrIGV4ZWN1dGlvblxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBwcm9ncmVzcyA6IGZ1bmN0aW9uKHZhbHVlLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgcmV0dXJuIHZvdy53aGVuKHZhbHVlKS5wcm9ncmVzcyhvblByb2dyZXNzLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5zcHJlYWRgLlxuICAgICAqIElmIGB2YWx1ZWAgaXMgbm90IGEgcHJvbWlzZSwgdGhlbiBgdmFsdWVgIGlzIHRyZWF0ZWQgYXMgYSBmdWxmaWxsZWQgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25GdWxmaWxsZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCB2YWx1ZSBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiBmdWxmaWxsZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25SZWplY3RlZF0gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHJlYXNvbiBhZnRlciB0aGUgcHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XSBDb250ZXh0IG9mIHRoZSBjYWxsYmFja3MgZXhlY3V0aW9uXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHNwcmVhZCA6IGZ1bmN0aW9uKHZhbHVlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgY3R4KSB7XG4gICAgICAgIHJldHVybiB2b3cud2hlbih2YWx1ZSkuc3ByZWFkKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBjdHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5kb25lYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uRnVsZmlsbGVkXSBDYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aXRoIGEgcHJvdmlkZWQgdmFsdWUgYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gZnVsZmlsbGVkXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29uUmVqZWN0ZWRdIENhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdpdGggYSBwcm92aWRlZCByZWFzb24gYWZ0ZXIgdGhlIHByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb25Qcm9ncmVzc10gQ2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgd2l0aCBhIHByb3ZpZGVkIHZhbHVlIGFmdGVyIHRoZSBwcm9taXNlIGhhcyBiZWVuIG5vdGlmaWVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjdHhdIENvbnRleHQgb2YgdGhlIGNhbGxiYWNrcyBleGVjdXRpb25cbiAgICAgKi9cbiAgICBkb25lIDogZnVuY3Rpb24odmFsdWUsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzLCBjdHgpIHtcbiAgICAgICAgdm93LndoZW4odmFsdWUpLmRvbmUob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBgdmFsdWVgIGlzIGEgcHJvbWlzZS1saWtlIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZvdy5pc1Byb21pc2UoJ3NvbWV0aGluZycpOyAvLyByZXR1cm5zIGZhbHNlXG4gICAgICogdm93LmlzUHJvbWlzZSh2b3cuZGVmZXIoKS5wcm9taXNlKCkpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiB2b3cuaXNQcm9taXNlKHsgdGhlbiA6IGZ1bmN0aW9uKCkgeyB9KTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgaXNQcm9taXNlIDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBpc0Z1bmN0aW9uKHZhbHVlLnRoZW4pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb2VyY2VzIHRoZSBnaXZlbiBgdmFsdWVgIHRvIGEgcHJvbWlzZSwgb3IgcmV0dXJucyB0aGUgYHZhbHVlYCBpZiBpdCdzIGFscmVhZHkgYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHt2b3c6UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjYXN0IDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmICEhdmFsdWUuX3Zvdz9cbiAgICAgICAgICAgIHZhbHVlIDpcbiAgICAgICAgICAgIHZvdy5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UudmFsdWVPZmAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIHZhbHVlT2YgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS52YWx1ZU9mKT8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmlzRnVsZmlsbGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNGdWxmaWxsZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc0Z1bGZpbGxlZCk/IHZhbHVlLmlzRnVsZmlsbGVkKCkgOiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS5pc1JlamVjdGVkYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICovXG4gICAgaXNSZWplY3RlZCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiBpc0Z1bmN0aW9uKHZhbHVlLmlzUmVqZWN0ZWQpPyB2YWx1ZS5pc1JlamVjdGVkKCkgOiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhdGljIGVxdWl2YWxlbnQgdG8gYHByb21pc2UuaXNSZXNvbHZlZGAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBub3QgYSBwcm9taXNlLCB0aGVuIGB2YWx1ZWAgaXMgdHJlYXRlZCBhcyBhIGZ1bGZpbGxlZCBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAqL1xuICAgIGlzUmVzb2x2ZWQgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgaXNGdW5jdGlvbih2YWx1ZS5pc1Jlc29sdmVkKT8gdmFsdWUuaXNSZXNvbHZlZCgpIDogdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIGB2YWx1ZWAuXG4gICAgICogSWYgYHZhbHVlYCBpcyBhIHByb21pc2UsIHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgaGF2ZSBgdmFsdWVgJ3Mgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIHJlc29sdmUgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgcmVzID0gdm93LmRlZmVyKCk7XG4gICAgICAgIHJlcy5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHJlcy5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW4gYHZhbHVlYC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIGEgcHJvbWlzZSwgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSBmdWxmaWxsZWQgd2l0aCB0aGUgZnVsZmlsbC9yZWplY3Rpb24gdmFsdWUgb2YgYHZhbHVlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgZnVsZmlsbCA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpLFxuICAgICAgICAgICAgcHJvbWlzZSA9IGRlZmVyLnByb21pc2UoKTtcblxuICAgICAgICBkZWZlci5yZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZS5pc0Z1bGZpbGxlZCgpP1xuICAgICAgICAgICAgcHJvbWlzZSA6XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4obnVsbCwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYXNvbjtcbiAgICAgICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4gICAgICogSWYgYHJlYXNvbmAgaXMgYSBwcm9taXNlLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGggdGhlIGZ1bGZpbGwvcmVqZWN0aW9uIHZhbHVlIG9mIGByZWFzb25gLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSByZWFzb25cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgcmVqZWN0IDogZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIHZhciBkZWZlciA9IHZvdy5kZWZlcigpO1xuICAgICAgICBkZWZlci5yZWplY3QocmVhc29uKTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyB0aGUgZ2l2ZW4gZnVuY3Rpb24gYGZuYCB3aXRoIGFyZ3VtZW50cyBgYXJnc2BcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnc11cbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIHByb21pc2UxID0gdm93Lmludm9rZShmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAqICAgICB9LCAnb2snKSxcbiAgICAgKiAgICAgcHJvbWlzZTIgPSB2b3cuaW52b2tlKGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgdGhyb3cgRXJyb3IoKTtcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBwcm9taXNlMS5pc0Z1bGZpbGxlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTEudmFsdWVPZigpOyAvLyAnb2snXG4gICAgICogcHJvbWlzZTIuaXNSZWplY3RlZCgpOyAvLyB0cnVlXG4gICAgICogcHJvbWlzZTIudmFsdWVPZigpOyAvLyBpbnN0YW5jZSBvZiBFcnJvclxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGludm9rZSA6IGZ1bmN0aW9uKGZuLCBhcmdzKSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1heChhcmd1bWVudHMubGVuZ3RoIC0gMSwgMCksXG4gICAgICAgICAgICBjYWxsQXJncztcbiAgICAgICAgaWYobGVuKSB7IC8vIG9wdGltaXphdGlvbiBmb3IgVjhcbiAgICAgICAgICAgIGNhbGxBcmdzID0gQXJyYXkobGVuKTtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjYWxsQXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiB2b3cucmVzb2x2ZShjYWxsQXJncz9cbiAgICAgICAgICAgICAgICBmbi5hcHBseShnbG9iYWwsIGNhbGxBcmdzKSA6XG4gICAgICAgICAgICAgICAgZm4uY2FsbChnbG9iYWwpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICByZXR1cm4gdm93LnJlamVjdChlKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSwgdGhhdCB3aWxsIGJlIGZ1bGZpbGxlZCBvbmx5IGFmdGVyIGFsbCB0aGUgaXRlbXMgaW4gYGl0ZXJhYmxlYCBhcmUgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIGFycmF5OlxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGRlZmVyMSA9IHZvdy5kZWZlcigpLFxuICAgICAqICAgICBkZWZlcjIgPSB2b3cuZGVmZXIoKTtcbiAgICAgKlxuICAgICAqIHZvdy5hbGwoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCksIDNdKVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwiWzEsIDIsIDNdXCIgaGVyZVxuICAgICAqICAgICB9KTtcbiAgICAgKlxuICAgICAqIGRlZmVyMS5yZXNvbHZlKDEpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKDIpO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB3aXRoIG9iamVjdDpcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsKHsgcDEgOiBkZWZlcjEucHJvbWlzZSgpLCBwMiA6IGRlZmVyMi5wcm9taXNlKCksIHAzIDogMyB9KVxuICAgICAqICAgICAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAqICAgICAgICAgIC8vIHZhbHVlIGlzIFwieyBwMSA6IDEsIHAyIDogMiwgcDMgOiAzIH1cIiBoZXJlXG4gICAgICogICAgIH0pO1xuICAgICAqXG4gICAgICogZGVmZXIxLnJlc29sdmUoMSk7XG4gICAgICogZGVmZXIyLnJlc29sdmUoMik7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgYWxsIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlcyA9IGlzUHJvbWlzZXNBcnJheT8gW10gOiB7fTtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSBsZW47XG4gICAgICAgIHZvdy5fZm9yRWFjaChcbiAgICAgICAgICAgIGl0ZXJhYmxlLFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsdWUsIGlkeCkge1xuICAgICAgICAgICAgICAgIHJlc1trZXlzW2lkeF1dID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgaWYoIS0taSkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgb25seSBhZnRlciBhbGwgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgYXJlIHJlc29sdmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGl0ZXJhYmxlXG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkZWZlcjEgPSB2b3cuZGVmZXIoKSxcbiAgICAgKiAgICAgZGVmZXIyID0gdm93LmRlZmVyKCk7XG4gICAgICpcbiAgICAgKiB2b3cuYWxsUmVzb2x2ZWQoW2RlZmVyMS5wcm9taXNlKCksIGRlZmVyMi5wcm9taXNlKCldKS5zcHJlYWQoZnVuY3Rpb24ocHJvbWlzZTEsIHByb21pc2UyKSB7XG4gICAgICogICAgIHByb21pc2UxLmlzUmVqZWN0ZWQoKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogICAgIHByb21pc2UxLnZhbHVlT2YoKTsgLy8gcmV0dXJucyBcIidlcnJvcidcIlxuICAgICAqICAgICBwcm9taXNlMi5pc0Z1bGZpbGxlZCgpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiAgICAgcHJvbWlzZTIudmFsdWVPZigpOyAvLyByZXR1cm5zIFwiJ29rJ1wiXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBkZWZlcjEucmVqZWN0KCdlcnJvcicpO1xuICAgICAqIGRlZmVyMi5yZXNvbHZlKCdvaycpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbFJlc29sdmVkIDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgIGtleXMgPSBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgZ2V0QXJyYXlLZXlzKGl0ZXJhYmxlKSA6XG4gICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICBpID0ga2V5cy5sZW5ndGgsXG4gICAgICAgICAgICByZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge307XG5cbiAgICAgICAgaWYoIWkpIHtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb25SZXNvbHZlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC0taSB8fCBkZWZlci5yZXNvbHZlKGl0ZXJhYmxlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBvblJlc29sdmVkLFxuICAgICAgICAgICAgb25SZXNvbHZlZCxcbiAgICAgICAgICAgIGRlZmVyLm5vdGlmeSxcbiAgICAgICAgICAgIGRlZmVyLFxuICAgICAgICAgICAga2V5cyk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICB9LFxuXG4gICAgYWxsUGF0aWVudGx5IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIHZvdy5hbGxSZXNvbHZlZChpdGVyYWJsZSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpc1Byb21pc2VzQXJyYXkgPSBpc0FycmF5KGl0ZXJhYmxlKSxcbiAgICAgICAgICAgICAgICBrZXlzID0gaXNQcm9taXNlc0FycmF5P1xuICAgICAgICAgICAgICAgICAgICBnZXRBcnJheUtleXMoaXRlcmFibGUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2V0T2JqZWN0S2V5cyhpdGVyYWJsZSksXG4gICAgICAgICAgICAgICAgcmVqZWN0ZWRQcm9taXNlcywgZnVsZmlsbGVkUHJvbWlzZXMsXG4gICAgICAgICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGgsIGkgPSAwLCBrZXksIHByb21pc2U7XG5cbiAgICAgICAgICAgIGlmKCFsZW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNQcm9taXNlc0FycmF5PyBbXSA6IHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xuICAgICAgICAgICAgICAgIHByb21pc2UgPSBpdGVyYWJsZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmKHZvdy5pc1JlamVjdGVkKHByb21pc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXMgfHwgKHJlamVjdGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pO1xuICAgICAgICAgICAgICAgICAgICBpc1Byb21pc2VzQXJyYXk/XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZFByb21pc2VzLnB1c2gocHJvbWlzZS52YWx1ZU9mKCkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdGVkUHJvbWlzZXNba2V5XSA9IHByb21pc2UudmFsdWVPZigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKCFyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIChmdWxmaWxsZWRQcm9taXNlcyB8fCAoZnVsZmlsbGVkUHJvbWlzZXMgPSBpc1Byb21pc2VzQXJyYXk/IFtdIDoge30pKVtrZXldID0gdm93LnZhbHVlT2YocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihyZWplY3RlZFByb21pc2VzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgcmVqZWN0ZWRQcm9taXNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZ1bGZpbGxlZFByb21pc2VzO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UsIHRoYXQgd2lsbCBiZSBmdWxmaWxsZWQgaWYgYW55IG9mIHRoZSBpdGVtcyBpbiBgaXRlcmFibGVgIGlzIGZ1bGZpbGxlZC5cbiAgICAgKiBJZiBhbGwgb2YgdGhlIGBpdGVyYWJsZWAgaXRlbXMgZ2V0IHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkICh3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHJlamVjdGVkIGl0ZW0pLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55IDogZnVuY3Rpb24oaXRlcmFibGUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKCksXG4gICAgICAgICAgICBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG5cbiAgICAgICAgaWYoIWxlbikge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KEVycm9yKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpID0gMCwgcmVhc29uO1xuICAgICAgICB2b3cuX2ZvckVhY2goXG4gICAgICAgICAgICBpdGVyYWJsZSxcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUsXG4gICAgICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaSB8fCAocmVhc29uID0gZSk7XG4gICAgICAgICAgICAgICAgKytpID09PSBsZW4gJiYgZGVmZXIucmVqZWN0KHJlYXNvbik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlLCB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIG9ubHkgd2hlbiBhbnkgb2YgdGhlIGl0ZW1zIGluIGBpdGVyYWJsZWAgaXMgZnVsZmlsbGVkLlxuICAgICAqIElmIGFueSBvZiB0aGUgYGl0ZXJhYmxlYCBpdGVtcyBnZXRzIHJlamVjdGVkLCB0aGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gaXRlcmFibGVcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgYW55UmVzb2x2ZWQgOiBmdW5jdGlvbihpdGVyYWJsZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKSxcbiAgICAgICAgICAgIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcblxuICAgICAgICBpZighbGVuKSB7XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoRXJyb3IoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdm93Ll9mb3JFYWNoKFxuICAgICAgICAgICAgaXRlcmFibGUsXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlLFxuICAgICAgICAgICAgZGVmZXIucmVqZWN0LFxuICAgICAgICAgICAgZGVmZXIubm90aWZ5LFxuICAgICAgICAgICAgZGVmZXIpO1xuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXRpYyBlcXVpdmFsZW50IHRvIGBwcm9taXNlLmRlbGF5YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG4gICAgICogQHJldHVybnMge3ZvdzpQcm9taXNlfVxuICAgICAqL1xuICAgIGRlbGF5IDogZnVuY3Rpb24odmFsdWUsIGRlbGF5KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkuZGVsYXkoZGVsYXkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGF0aWMgZXF1aXZhbGVudCB0byBgcHJvbWlzZS50aW1lb3V0YC5cbiAgICAgKiBJZiBgdmFsdWVgIGlzIG5vdCBhIHByb21pc2UsIHRoZW4gYHZhbHVlYCBpcyB0cmVhdGVkIGFzIGEgZnVsZmlsbGVkIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXRcbiAgICAgKiBAcmV0dXJucyB7dm93OlByb21pc2V9XG4gICAgICovXG4gICAgdGltZW91dCA6IGZ1bmN0aW9uKHZhbHVlLCB0aW1lb3V0KSB7XG4gICAgICAgIHJldHVybiB2b3cucmVzb2x2ZSh2YWx1ZSkudGltZW91dCh0aW1lb3V0KTtcbiAgICB9LFxuXG4gICAgX2ZvckVhY2ggOiBmdW5jdGlvbihwcm9taXNlcywgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MsIGN0eCwga2V5cykge1xuICAgICAgICB2YXIgbGVuID0ga2V5cz8ga2V5cy5sZW5ndGggOiBwcm9taXNlcy5sZW5ndGgsXG4gICAgICAgICAgICBpID0gMDtcblxuICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICB2b3cud2hlbihcbiAgICAgICAgICAgICAgICBwcm9taXNlc1trZXlzPyBrZXlzW2ldIDogaV0sXG4gICAgICAgICAgICAgICAgd3JhcE9uRnVsZmlsbGVkKG9uRnVsZmlsbGVkLCBpKSxcbiAgICAgICAgICAgICAgICBvblJlamVjdGVkLFxuICAgICAgICAgICAgICAgIG9uUHJvZ3Jlc3MsXG4gICAgICAgICAgICAgICAgY3R4KTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBUaW1lZE91dEVycm9yIDogZGVmaW5lQ3VzdG9tRXJyb3JUeXBlKCdUaW1lZE91dCcpXG59O1xuXG52YXIgZGVmaW5lQXNHbG9iYWwgPSB0cnVlO1xuaWYodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gdm93O1xuICAgIGRlZmluZUFzR2xvYmFsID0gZmFsc2U7XG59XG5cbmlmKHR5cGVvZiBtb2R1bGVzID09PSAnb2JqZWN0JyAmJiBpc0Z1bmN0aW9uKG1vZHVsZXMuZGVmaW5lKSkge1xuICAgIG1vZHVsZXMuZGVmaW5lKCd2b3cnLCBmdW5jdGlvbihwcm92aWRlKSB7XG4gICAgICAgIHByb3ZpZGUodm93KTtcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5pZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHZvdztcbiAgICB9KTtcbiAgICBkZWZpbmVBc0dsb2JhbCA9IGZhbHNlO1xufVxuXG5kZWZpbmVBc0dsb2JhbCAmJiAoZ2xvYmFsLnZvdyA9IHZvdyk7XG5cbn0pKHRoaXMpO1xuIiwiLyoqXG4gKiBNb2R1bGVzXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIEZpbGF0b3YgRG1pdHJ5IChkZmlsYXRvdkB5YW5kZXgtdGVhbS5ydSlcbiAqIER1YWwgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBhbmQgR1BMIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwuaHRtbFxuICpcbiAqIEB2ZXJzaW9uIDAuMS4yXG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuXG52YXIgdW5kZWYsXG5cbiAgICBERUNMX1NUQVRFUyA9IHtcbiAgICAgICAgTk9UX1JFU09MVkVEIDogJ05PVF9SRVNPTFZFRCcsXG4gICAgICAgIElOX1JFU09MVklORyA6ICdJTl9SRVNPTFZJTkcnLFxuICAgICAgICBSRVNPTFZFRCAgICAgOiAnUkVTT0xWRUQnXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgbW9kdWxhciBzeXN0ZW1cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3VyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICB0cmFja0NpcmN1bGFyRGVwZW5kZW5jaWVzIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhbGxvd011bHRpcGxlRGVjbGFyYXRpb25zIDogdHJ1ZVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbW9kdWxlc1N0b3JhZ2UgPSB7fSxcbiAgICAgICAgICAgIHdhaXRGb3JOZXh0VGljayA9IGZhbHNlLFxuICAgICAgICAgICAgcGVuZGluZ1JlcXVpcmVzID0gW10sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogRGVmaW5lcyBtb2R1bGVcbiAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBbZGVwc11cbiAgICAgICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGRlY2xGblxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBkZWZpbmUgPSBmdW5jdGlvbihuYW1lLCBkZXBzLCBkZWNsRm4pIHtcbiAgICAgICAgICAgICAgICBpZighZGVjbEZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2xGbiA9IGRlcHM7XG4gICAgICAgICAgICAgICAgICAgIGRlcHMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgbW9kdWxlID0gbW9kdWxlc1N0b3JhZ2VbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYoIW1vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICBtb2R1bGUgPSBtb2R1bGVzU3RvcmFnZVtuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbCA6IHVuZGVmXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kdWxlLmRlY2wgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWUgICAgICAgOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcmV2ICAgICAgIDogbW9kdWxlLmRlY2wsXG4gICAgICAgICAgICAgICAgICAgIGZuICAgICAgICAgOiBkZWNsRm4sXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlICAgICAgOiBERUNMX1NUQVRFUy5OT1RfUkVTT0xWRUQsXG4gICAgICAgICAgICAgICAgICAgIGRlcHMgICAgICAgOiBkZXBzLFxuICAgICAgICAgICAgICAgICAgICBkZXBlbmRlbnRzIDogW10sXG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydHMgICAgOiB1bmRlZlxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFJlcXVpcmVzIG1vZHVsZXNcbiAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfFN0cmluZ1tdfSBtb2R1bGVzXG4gICAgICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICAgICAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2Vycm9yQ2JdXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHJlcXVpcmUgPSBmdW5jdGlvbihtb2R1bGVzLCBjYiwgZXJyb3JDYikge1xuICAgICAgICAgICAgICAgIGlmKHR5cGVvZiBtb2R1bGVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBtb2R1bGVzID0gW21vZHVsZXNdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmKCF3YWl0Rm9yTmV4dFRpY2spIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdEZvck5leHRUaWNrID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dFRpY2sob25OZXh0VGljayk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcGVuZGluZ1JlcXVpcmVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBkZXBzIDogbW9kdWxlcyxcbiAgICAgICAgICAgICAgICAgICAgY2IgICA6IGZ1bmN0aW9uKGV4cG9ydHMsIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcj9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZXJyb3JDYiB8fCBvbkVycm9yKShlcnJvcikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiLmFwcGx5KGdsb2JhbCwgZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUmV0dXJucyBzdGF0ZSBvZiBtb2R1bGVcbiAgICAgICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBzdGF0ZSwgcG9zc2libGUgdmFsdWVzIGFyZSBOT1RfREVGSU5FRCwgTk9UX1JFU09MVkVELCBJTl9SRVNPTFZJTkcsIFJFU09MVkVEXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGdldFN0YXRlID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBtb2R1bGUgPSBtb2R1bGVzU3RvcmFnZVtuYW1lXTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kdWxlP1xuICAgICAgICAgICAgICAgICAgICBERUNMX1NUQVRFU1ttb2R1bGUuZGVjbC5zdGF0ZV0gOlxuICAgICAgICAgICAgICAgICAgICAnTk9UX0RFRklORUQnO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIG1vZHVsZSBpcyBkZWZpbmVkXG4gICAgICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlzRGVmaW5lZCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gISFtb2R1bGVzU3RvcmFnZVtuYW1lXTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogU2V0cyBvcHRpb25zXG4gICAgICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBzZXRPcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGZvcih2YXIgbmFtZSBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ck9wdGlvbnNbbmFtZV0gPSBvcHRpb25zW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZ2V0U3RhdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciByZXMgPSB7fSxcbiAgICAgICAgICAgICAgICAgICAgbW9kdWxlO1xuXG4gICAgICAgICAgICAgICAgZm9yKHZhciBuYW1lIGluIG1vZHVsZXNTdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKG1vZHVsZXNTdG9yYWdlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGUgPSBtb2R1bGVzU3RvcmFnZVtuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIChyZXNbbW9kdWxlLmRlY2wuc3RhdGVdIHx8IChyZXNbbW9kdWxlLmRlY2wuc3RhdGVdID0gW10pKS5wdXNoKG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uTmV4dFRpY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB3YWl0Rm9yTmV4dFRpY2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBhcHBseVJlcXVpcmVzKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBhcHBseVJlcXVpcmVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVzVG9Qcm9jZXNzID0gcGVuZGluZ1JlcXVpcmVzLFxuICAgICAgICAgICAgICAgICAgICBpID0gMCwgcmVxdWlyZTtcblxuICAgICAgICAgICAgICAgIHBlbmRpbmdSZXF1aXJlcyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUocmVxdWlyZSA9IHJlcXVpcmVzVG9Qcm9jZXNzW2krK10pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZURlcHMobnVsbCwgcmVxdWlyZS5kZXBzLCBbXSwgcmVxdWlyZS5jYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVxdWlyZURlcHMgPSBmdW5jdGlvbihmcm9tRGVjbCwgZGVwcywgcGF0aCwgY2IpIHtcbiAgICAgICAgICAgICAgICB2YXIgdW5yZXNvbHZlZERlcHNDbnQgPSBkZXBzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZighdW5yZXNvbHZlZERlcHNDbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoW10pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBkZWNscyA9IFtdLFxuICAgICAgICAgICAgICAgICAgICBvbkRlY2xSZXNvbHZlZCA9IGZ1bmN0aW9uKF8sIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCEtLXVucmVzb2x2ZWREZXBzQ250KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGV4cG9ydHMgPSBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaSA9IDAsIGRlY2w7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUoZGVjbCA9IGRlY2xzW2krK10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0cy5wdXNoKGRlY2wuZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGV4cG9ydHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBpID0gMCwgbGVuID0gdW5yZXNvbHZlZERlcHNDbnQsXG4gICAgICAgICAgICAgICAgICAgIGRlcCwgZGVjbDtcblxuICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZGVwID0gZGVwc1tpKytdO1xuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgZGVwID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIW1vZHVsZXNTdG9yYWdlW2RlcF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBidWlsZE1vZHVsZU5vdEZvdW5kRXJyb3IoZGVwLCBmcm9tRGVjbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbCA9IG1vZHVsZXNTdG9yYWdlW2RlcF0uZGVjbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY2wgPSBkZXA7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBkZWNscy5wdXNoKGRlY2wpO1xuXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0RGVjbFJlc29sdmluZyhkZWNsLCBwYXRoLCBvbkRlY2xSZXNvbHZlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc3RhcnREZWNsUmVzb2x2aW5nID0gZnVuY3Rpb24oZGVjbCwgcGF0aCwgY2IpIHtcbiAgICAgICAgICAgICAgICBpZihkZWNsLnN0YXRlID09PSBERUNMX1NUQVRFUy5SRVNPTFZFRCkge1xuICAgICAgICAgICAgICAgICAgICBjYihkZWNsLmV4cG9ydHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYoZGVjbC5zdGF0ZSA9PT0gREVDTF9TVEFURVMuSU5fUkVTT0xWSU5HKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ck9wdGlvbnMudHJhY2tDaXJjdWxhckRlcGVuZGVuY2llcyAmJiBpc0RlcGVuZGVuY2VDaXJjdWxhcihkZWNsLCBwYXRoKT9cbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGJ1aWxkQ2lyY3VsYXJEZXBlbmRlbmNlRXJyb3IoZGVjbCwgcGF0aCkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY2wuZGVwZW5kZW50cy5wdXNoKGNiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuZGVwZW5kZW50cy5wdXNoKGNiKTtcblxuICAgICAgICAgICAgICAgIGlmKGRlY2wucHJldiAmJiAhY3VyT3B0aW9ucy5hbGxvd011bHRpcGxlRGVjbGFyYXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3ZpZGVFcnJvcihkZWNsLCBidWlsZE11bHRpcGxlRGVjbGFyYXRpb25FcnJvcihkZWNsKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJPcHRpb25zLnRyYWNrQ2lyY3VsYXJEZXBlbmRlbmNpZXMgJiYgKHBhdGggPSBwYXRoLnNsaWNlKCkpLnB1c2goZGVjbCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgaXNQcm92aWRlZCA9IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBkZXBzID0gZGVjbC5wcmV2PyBkZWNsLmRlcHMuY29uY2F0KFtkZWNsLnByZXZdKSA6IGRlY2wuZGVwcztcblxuICAgICAgICAgICAgICAgIGRlY2wuc3RhdGUgPSBERUNMX1NUQVRFUy5JTl9SRVNPTFZJTkc7XG4gICAgICAgICAgICAgICAgcmVxdWlyZURlcHMoXG4gICAgICAgICAgICAgICAgICAgIGRlY2wsXG4gICAgICAgICAgICAgICAgICAgIGRlcHMsXG4gICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGRlcERlY2xzRXhwb3J0cywgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvdmlkZUVycm9yKGRlY2wsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlcERlY2xzRXhwb3J0cy51bnNoaWZ0KGZ1bmN0aW9uKGV4cG9ydHMsIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNQcm92aWRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBidWlsZERlY2xBcmVhZHlQcm92aWRlZEVycm9yKGRlY2wpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJvdmlkZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm92aWRlRXJyb3IoZGVjbCwgZXJyb3IpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvdmlkZURlY2woZGVjbCwgZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbC5mbi5hcHBseShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgICA6IGRlY2wubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVwcyAgIDogZGVjbC5kZXBzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWwgOiBnbG9iYWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlcERlY2xzRXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcHJvdmlkZURlY2wgPSBmdW5jdGlvbihkZWNsLCBleHBvcnRzKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5leHBvcnRzID0gZXhwb3J0cztcbiAgICAgICAgICAgICAgICBkZWNsLnN0YXRlID0gREVDTF9TVEFURVMuUkVTT0xWRUQ7XG5cbiAgICAgICAgICAgICAgICB2YXIgaSA9IDAsIGRlcGVuZGVudDtcbiAgICAgICAgICAgICAgICB3aGlsZShkZXBlbmRlbnQgPSBkZWNsLmRlcGVuZGVudHNbaSsrXSkge1xuICAgICAgICAgICAgICAgICAgICBkZXBlbmRlbnQoZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVjbC5kZXBlbmRlbnRzID0gdW5kZWY7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBwcm92aWRlRXJyb3IgPSBmdW5jdGlvbihkZWNsLCBlcnJvcikge1xuICAgICAgICAgICAgICAgIGRlY2wuc3RhdGUgPSBERUNMX1NUQVRFUy5OT1RfUkVTT0xWRUQ7XG5cbiAgICAgICAgICAgICAgICB2YXIgaSA9IDAsIGRlcGVuZGVudDtcbiAgICAgICAgICAgICAgICB3aGlsZShkZXBlbmRlbnQgPSBkZWNsLmRlcGVuZGVudHNbaSsrXSkge1xuICAgICAgICAgICAgICAgICAgICBkZXBlbmRlbnQobnVsbCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuZGVwZW5kZW50cyA9IFtdO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY3JlYXRlICAgICA6IGNyZWF0ZSxcbiAgICAgICAgICAgIGRlZmluZSAgICAgOiBkZWZpbmUsXG4gICAgICAgICAgICByZXF1aXJlICAgIDogcmVxdWlyZSxcbiAgICAgICAgICAgIGdldFN0YXRlICAgOiBnZXRTdGF0ZSxcbiAgICAgICAgICAgIGlzRGVmaW5lZCAgOiBpc0RlZmluZWQsXG4gICAgICAgICAgICBzZXRPcHRpb25zIDogc2V0T3B0aW9ucyxcbiAgICAgICAgICAgIGdldFN0YXQgICAgOiBnZXRTdGF0XG4gICAgICAgIH07XG4gICAgfSxcblxuICAgIG9uRXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIGJ1aWxkTW9kdWxlTm90Rm91bmRFcnJvciA9IGZ1bmN0aW9uKG5hbWUsIGRlY2wpIHtcbiAgICAgICAgcmV0dXJuIEVycm9yKGRlY2w/XG4gICAgICAgICAgICAnTW9kdWxlIFwiJyArIGRlY2wubmFtZSArICdcIjogY2FuXFwndCByZXNvbHZlIGRlcGVuZGVuY2UgXCInICsgbmFtZSArICdcIicgOlxuICAgICAgICAgICAgJ1JlcXVpcmVkIG1vZHVsZSBcIicgKyBuYW1lICsgJ1wiIGNhblxcJ3QgYmUgcmVzb2x2ZWQnKTtcbiAgICB9LFxuXG4gICAgYnVpbGRDaXJjdWxhckRlcGVuZGVuY2VFcnJvciA9IGZ1bmN0aW9uKGRlY2wsIHBhdGgpIHtcbiAgICAgICAgdmFyIHN0clBhdGggPSBbXSxcbiAgICAgICAgICAgIGkgPSAwLCBwYXRoRGVjbDtcbiAgICAgICAgd2hpbGUocGF0aERlY2wgPSBwYXRoW2krK10pIHtcbiAgICAgICAgICAgIHN0clBhdGgucHVzaChwYXRoRGVjbC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBzdHJQYXRoLnB1c2goZGVjbC5uYW1lKTtcblxuICAgICAgICByZXR1cm4gRXJyb3IoJ0NpcmN1bGFyIGRlcGVuZGVuY2UgaGFzIGJlZW4gZGV0ZWN0ZWQ6IFwiJyArIHN0clBhdGguam9pbignIC0+ICcpICsgJ1wiJyk7XG4gICAgfSxcblxuICAgIGJ1aWxkRGVjbEFyZWFkeVByb3ZpZGVkRXJyb3IgPSBmdW5jdGlvbihkZWNsKSB7XG4gICAgICAgIHJldHVybiBFcnJvcignRGVjbGFyYXRpb24gb2YgbW9kdWxlIFwiJyArIGRlY2wubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIHByb3ZpZGVkJyk7XG4gICAgfSxcblxuICAgIGJ1aWxkTXVsdGlwbGVEZWNsYXJhdGlvbkVycm9yID0gZnVuY3Rpb24oZGVjbCkge1xuICAgICAgICByZXR1cm4gRXJyb3IoJ011bHRpcGxlIGRlY2xhcmF0aW9ucyBvZiBtb2R1bGUgXCInICsgZGVjbC5uYW1lICsgJ1wiIGhhdmUgYmVlbiBkZXRlY3RlZCcpO1xuICAgIH0sXG5cbiAgICBpc0RlcGVuZGVuY2VDaXJjdWxhciA9IGZ1bmN0aW9uKGRlY2wsIHBhdGgpIHtcbiAgICAgICAgdmFyIGkgPSAwLCBwYXRoRGVjbDtcbiAgICAgICAgd2hpbGUocGF0aERlY2wgPSBwYXRoW2krK10pIHtcbiAgICAgICAgICAgIGlmKGRlY2wgPT09IHBhdGhEZWNsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICBuZXh0VGljayA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZucyA9IFtdLFxuICAgICAgICAgICAgZW5xdWV1ZUZuID0gZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm5zLnB1c2goZm4pID09PSAxO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhbGxGbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm5zVG9DYWxsID0gZm5zLCBpID0gMCwgbGVuID0gZm5zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB3aGlsZShpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuc1RvQ2FsbFtpKytdKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICBpZih0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5uZXh0VGljaykgeyAvLyBub2RlanNcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgcHJvY2Vzcy5uZXh0VGljayhjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZihnbG9iYWwuc2V0SW1tZWRpYXRlKSB7IC8vIGllMTBcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgZ2xvYmFsLnNldEltbWVkaWF0ZShjYWxsRm5zKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZihnbG9iYWwucG9zdE1lc3NhZ2UgJiYgIWdsb2JhbC5vcGVyYSkgeyAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgICAgIHZhciBpc1Bvc3RNZXNzYWdlQXN5bmMgPSB0cnVlO1xuICAgICAgICAgICAgaWYoZ2xvYmFsLmF0dGFjaEV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGNoZWNrQXN5bmMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUG9zdE1lc3NhZ2VBc3luYyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKCdfX2NoZWNrQXN5bmMnLCAnKicpO1xuICAgICAgICAgICAgICAgIGdsb2JhbC5kZXRhY2hFdmVudCgnb25tZXNzYWdlJywgY2hlY2tBc3luYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzUG9zdE1lc3NhZ2VBc3luYykge1xuICAgICAgICAgICAgICAgIHZhciBtc2cgPSAnX19tb2R1bGVzJyArICgrbmV3IERhdGUoKSksXG4gICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGUuZGF0YSA9PT0gbXNnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24gJiYgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsRm5zKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcj9cbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLmF0dGFjaEV2ZW50KCdvbm1lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgZ2xvYmFsLnBvc3RNZXNzYWdlKG1zZywgJyonKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbiAgICAgICAgaWYoJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpKSB7IC8vIGllNi1pZThcbiAgICAgICAgICAgIHZhciBoZWFkID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0sXG4gICAgICAgICAgICAgICAgY3JlYXRlU2NyaXB0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHQgPSBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxGbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgICAgIGVucXVldWVGbihmbikgJiYgY3JlYXRlU2NyaXB0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7IC8vIG9sZCBicm93c2Vyc1xuICAgICAgICAgICAgZW5xdWV1ZUZuKGZuKSAmJiBzZXRUaW1lb3V0KGNhbGxGbnMsIDApO1xuICAgICAgICB9O1xuICAgIH0pKCk7XG5cbmlmKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gY3JlYXRlKCk7XG59XG5lbHNlIHtcbiAgICBnbG9iYWwubW9kdWxlcyA9IGNyZWF0ZSgpO1xufVxuXG59KSh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IGdsb2JhbCk7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXIvbG9nZ2VyJyk7XG52YXIgbG9nZ2VyID0gbmV3IExvZ2dlcignQXVkaW9QbGF5ZXInKTtcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4vbGliL2FzeW5jL2V2ZW50cycpO1xudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvZGVmZXJyZWQnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuL2xpYi9icm93c2VyL2RldGVjdCcpO1xudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgbWVyZ2UgPSByZXF1aXJlKCcuL2xpYi9kYXRhL21lcmdlJyk7XG52YXIgcmVqZWN0ID0gcmVxdWlyZSgnLi9saWIvYXN5bmMvcmVqZWN0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9lcnJvci9hdWRpby1lcnJvcicpO1xudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi9hdWRpby1zdGF0aWMnKTtcblxudmFyIHBsYXllcklkID0gMTtcblxuLy9UT0RPOiDRgdC00LXQu9Cw0YLRjCDQuNC90YLQtdGA0YTQtdC50YEg0LTQu9GPINCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L/QvtC00LrQu9GO0YfQtdC90LjRjyDQvdC+0LLRi9GFINGC0LjQv9C+0LJcbnZhciBhdWRpb1R5cGVzID0ge1xuICAgIGh0bWw1OiByZXF1aXJlKCcuL2h0bWw1L2F1ZGlvLWh0bWw1JyksXG4gICAgZmxhc2g6IHJlcXVpcmUoJy4vZmxhc2gvYXVkaW8tZmxhc2gnKVxufTtcblxudmFyIGRldGVjdFN0cmluZyA9IFwiQFwiICsgZGV0ZWN0LnBsYXRmb3JtLnZlcnNpb24gK1xuICAgIFwiIFwiICsgZGV0ZWN0LnBsYXRmb3JtLm9zICtcbiAgICBcIjpcIiArIGRldGVjdC5icm93c2VyLm5hbWUgK1xuICAgIFwiL1wiICsgZGV0ZWN0LmJyb3dzZXIudmVyc2lvbjtcblxuYXVkaW9UeXBlcy5mbGFzaC5wcmlvcml0eSA9IDA7XG5hdWRpb1R5cGVzLmh0bWw1LnByaW9yaXR5ID0gY29uZmlnLmh0bWw1LmJsYWNrbGlzdC5zb21lKGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIGRldGVjdFN0cmluZy5tYXRjaChpdGVtKTsgfSkgPyAtMSA6IDE7XG5cbmxvZ2dlci5kZWJ1ZyhudWxsLCBcImF1ZGlvVHlwZXNcIiwgYXVkaW9UeXBlcyk7XG5cbi8qKiDQntC/0LjRgdCw0L3QuNC1INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0L/Qu9C10LXRgNCwXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5BdWRpb35BdWRpb1BsYXllclRpbWVzXG4gKlxuICogQHByb3BlcnR5IHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBsb2FkZWQgLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAcHJvcGVydHkge051bWJlcn0gcG9zaXRpb24gLSDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwbGF5ZWQgLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIENvbW1vbiBFdmVudHNcbi8qKiDQodC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUExBWX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcGxheVxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfRU5ERUR9KVxuICogQGV2ZW50IHlhLkF1ZGlvI2VuZGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LPRgNC+0LzQutC+0YHRgtC4ICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfVk9MVU1FfSlcbiAqIEBldmVudCB5YS5BdWRpbyN2b2x1bWVjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQs9GA0L7QvNC60L7RgdGC0YxcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC60YDQsNGF0LAg0L/Qu9C10LXRgNCwICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfQ1JBU0hFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jY3Jhc2hlZFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0YHQvNC10L3RiyDRgdGC0LDRgtGD0YHQsCDQv9C70LXQtdGA0LAgKHtAbGluayB5YS5BdWRpby5FVkVOVF9TVEFURX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jc3RhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtINC90L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L/QtdGA0LXQutC70Y7Rh9C10L3QuNGPINCw0LrRgtC40LLQvdC+0LPQviDQv9C70LXQtdGA0LAg0Lgg0L/RgNC10LvQvtCw0LTQtdGA0LAgKHtAbGluayB5YS5BdWRpby5FVkVOVF9TV0FQfSlcbiAqIEBldmVudCB5YS5BdWRpbyNzd2FwXG4gKi9cblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIEFjdGl2ZSBFdmVudHNcbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfU1RPUH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jc3RvcFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1BBVVNFfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwYXVzZVxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtC30LjRhtC40Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPL9C30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX1BST0dSRVNTfSlcbiAqIEBldmVudCB5YS5BdWRpbyNwcm9ncmVzc1xuICogQHBhcmFtIHt5YS5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0xPQURJTkd9KVxuICogQGV2ZW50IHlhLkF1ZGlvI2xvYWRpbmdcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC30LDQstC10YDRiNC10L3QuNGPINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0xPQURFRH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jbG9hZGVkXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGI0LjQsdC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfRVJST1J9KVxuICogQGV2ZW50IHlhLkF1ZGlvI2Vycm9yXG4gKi9cblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFByZWxvYWRlciBFdmVudHNcbi8qKiDQodC+0LHRi9GC0LjQtSDQvtGB0YLQsNC90L7QstC60Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfU1RPUH0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOnN0b3BcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC90LDRh9Cw0LvQsCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9QQVVTRX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOnBhdXNlXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQvtCx0L3QvtCy0LvQtdC90LjRjyDQv9C+0LfQuNGG0LjQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8v0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4ICh7QGxpbmsgeWEuQXVkaW8uRVZFTlRfUFJPR1JFU1N9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3ByZWxvYWRlcjpwcm9ncmVzc1xuICogQHBhcmFtIHt5YS5BdWRpb35BdWRpb1BsYXllclRpbWVzfSB0aW1lcyAtINC40L3RhNC+0YDQvNCw0YbQuNGPINC+INCy0YDQtdC80LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICovXG4vKiog0KHQvtCx0YvRgtC40LUg0L3QsNGH0LDQu9CwINC30LDQs9GA0YPQt9C60Lgg0YLRgNC10LrQsCAoe0BsaW5rIHlhLkF1ZGlvLkVWRU5UX0xPQURJTkd9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3ByZWxvYWRlcjpsb2FkaW5nXG4gKi9cbi8qKiDQodC+0LHRi9GC0LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQt9Cw0LPRgNGD0LfQutC4INGC0YDQtdC60LAgKHtAbGluayB5YS5BdWRpby5FVkVOVF9MT0FERUR9KVxuICogQGV2ZW50IHlhLkF1ZGlvI3ByZWxvYWRlcjpsb2FkZWRcbiAqL1xuLyoqINCh0L7QsdGL0YLQuNC1INC+0YjQuNCx0LrQuCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8gKHtAbGluayB5YS5BdWRpby5FVkVOVF9FUlJPUn0pXG4gKiBAZXZlbnQgeWEuQXVkaW8jcHJlbG9hZGVyOmVycm9yXG4gKi9cblxuLyoqXG4gKiBAY2xhc3Mg0JDRg9C00LjQvi3Qv9C70LXQtdGAINC00LvRjyDQsdGA0LDRg9C30LXRgNCwLlxuICogQGFsaWFzIHlhLkF1ZGlvXG4gKiBAcGFyYW0ge1N0cmluZ30gW3ByZWZlcnJlZFR5cGVdIC0gcHJlZmVycmVkIHBsYXllciB0eXBlIChodG1sNS9mbGFzaClcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFtvdmVybGF5XSAtIGRvbSBlbGVtZW50IHRvIHNob3cgZmxhc2hcbiAqXG4gKiBAZXh0ZW5kcyBFdmVudHNcbiAqIEBtaXhlcyBBdWRpb1N0YXRpY1xuICpcbiAqIEBmaXJlcyB5YS5BdWRpbyNwbGF5XG4gKiBAZmlyZXMgeWEuQXVkaW8jZW5kZWRcbiAqIEBmaXJlcyB5YS5BdWRpbyN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyB5YS5BdWRpbyNjcmFzaGVkXG4gKiBAZmlyZXMgeWEuQXVkaW8jc3RhdGVcbiAqIEBmaXJlcyB5YS5BdWRpbyNzd2FwXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvI3N0b3BcbiAqIEBmaXJlcyB5YS5BdWRpbyNwYXVzZVxuICogQGZpcmVzIHlhLkF1ZGlvI3Byb2dyZXNzXG4gKiBAZmlyZXMgeWEuQXVkaW8jbG9hZGluZ1xuICogQGZpcmVzIHlhLkF1ZGlvI2xvYWRlZFxuICogQGZpcmVzIHlhLkF1ZGlvI2Vycm9yXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvI3ByZWxvYWRlcjpzdG9wXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOnBhdXNlXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOnByb2dyZXNzXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOmxvYWRpbmdcbiAqIEBmaXJlcyB5YS5BdWRpbyNwcmVsb2FkZXI6bG9hZGVkXG4gKiBAZmlyZXMgeWEuQXVkaW8jcHJlbG9hZGVyOmVycm9yXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBBdWRpb1BsYXllciA9IGZ1bmN0aW9uKHByZWZlcnJlZFR5cGUsIG92ZXJsYXkpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnByZWZlcnJlZFR5cGUgPSBwcmVmZXJyZWRUeXBlO1xuICAgIHRoaXMub3ZlcmxheSA9IG92ZXJsYXk7XG4gICAgdGhpcy5zdGF0ZSA9IEF1ZGlvUGxheWVyLlNUQVRFX0lOSVQ7XG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fcGxheUlkID0gbnVsbDtcblxuICAgIHRoaXMuX3doZW5SZWFkeSA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5fd2hlblJlYWR5LnByb21pc2UoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImltcGxlbWVudGF0aW9uIGZvdW5kXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG5cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fcG9wdWxhdGVFdmVudHMoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG5cbiAgICAgICAgICAgIGlmICghb2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BMQVk6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfU1dBUDpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TVE9QOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VOREVEOlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfSURMRSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BBVVNFOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0NSQVNIRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHRoaXMuX3NldFN0YXRlKEF1ZGlvUGxheWVyLlNUQVRFX0lETEUpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5OT19JTVBMRU1FTlRBVElPTiwgZSk7XG5cbiAgICAgICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfQ1JBU0hFRCk7XG4gICAgICAgIHRocm93IGU7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuX2luaXQoMCk7XG59O1xuRXZlbnRzLm1peGluKEF1ZGlvUGxheWVyKTtcbm1lcmdlKEF1ZGlvUGxheWVyLCBBdWRpb1N0YXRpYywgdHJ1ZSk7XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC00L7RgdGC0YPQv9C90YvRhSDQv9C70LXQtdGA0L7QslxuICogQHR5cGUge09iamVjdH1cbiAqIEBzdGF0aWNcbiAqL1xuQXVkaW9QbGF5ZXIuaW5mbyA9IHtcbiAgICBodG1sNTogYXVkaW9UeXBlcy5odG1sNS5hdmFpbGFibGUsXG4gICAgZmxhc2g6IGF1ZGlvVHlwZXMuZmxhc2guYXZhaWxhYmxlXG59O1xuXG4vKipcbiAqINCa0L7QvdGC0LXQutGB0YIg0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAqIEB0eXBlIHtBdWRpb0NvbnRleHR9XG4gKiBAc3RhdGljXG4gKi9cbkF1ZGlvUGxheWVyLmF1ZGlvQ29udGV4dCA9IGF1ZGlvVHlwZXMuaHRtbDUuYXVkaW9Db250ZXh0O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtINC90L7QstGL0Lkg0YHRgtCw0YLRg9GBXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3NldFN0YXRlID0gZnVuY3Rpb24oc3RhdGUpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0U3RhdGVcIiwgc3RhdGUpO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB0aGlzLnN0YXRlICE9PSBzdGF0ZTtcbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG5cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICBsb2dnZXIuaW5mbyh0aGlzLCBcIm5ld1N0YXRlXCIsIHN0YXRlKTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKEF1ZGlvUGxheWVyLkVWRU5UX1NUQVRFLCBzdGF0ZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbcmV0cnk9MF0gLSDQutC+0LvQuNGH0LXRgdGC0LLQviDQv9C+0L/Ri9GC0L7QulxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24ocmV0cnkpIHtcbiAgICByZXRyeSA9IHJldHJ5IHx8IDA7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfaW5pdFwiLCByZXRyeSk7XG5cbiAgICBpZiAoIXRoaXMuX3doZW5SZWFkeS5wZW5kaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocmV0cnkgPiBjb25maWcuYXVkaW8ucmV0cnkpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pO1xuICAgICAgICB0aGlzLl93aGVuUmVhZHkucmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04pKTtcbiAgICB9XG5cbiAgICB2YXIgaW5pdFNlcSA9IFtcbiAgICAgICAgYXVkaW9UeXBlcy5odG1sNSxcbiAgICAgICAgYXVkaW9UeXBlcy5mbGFzaFxuICAgIF0uc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICBpZiAoYS5hdmFpbGFibGUgIT09IGIuYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEuYXZhaWxhYmxlID8gLTEgOiAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYS5BdWRpb0ltcGxlbWVudGF0aW9uLnR5cGUgPT09IHRoaXMucHJlZmVycmVkVHlwZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGIuQXVkaW9JbXBsZW1lbnRhdGlvbi50eXBlID09PSB0aGlzLnByZWZlcnJlZFR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5O1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICAgICAgdmFyIHR5cGUgPSBpbml0U2VxLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgICAgICBzZWxmLl9pbml0KHJldHJ5ICsgMSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLl9pbml0VHlwZSh0eXBlKS50aGVuKHNlbGYuX3doZW5SZWFkeS5yZXNvbHZlLCBpbml0KTtcbiAgICB9XG5cbiAgICBpbml0KCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHQuiDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAg0YEg0YPQutCw0LfQsNC90L3Ri9C8INGC0LjQv9C+0LxcbiAqIEBwYXJhbSB7e3R5cGU6IHN0cmluZywgQXVkaW9JbXBsZW1lbnRhdGlvbjogZnVuY3Rpb259fSB0eXBlIC0g0L7QsdGK0LXQutGCINC+0L/QuNGB0LDQvdC40Y8g0YLQuNC/0LAg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5faW5pdFR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJfaW5pdFR5cGVcIiwgdHlwZSk7XG5cbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICB0cnkge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KLQtdC60YPRidCw0Y8g0YDQtdCw0LvQuNC30LDRhtC40Y8g0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge0lBdWRpb0ltcGxlbWVudGF0aW9ufG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uID0gbmV3IHR5cGUuQXVkaW9JbXBsZW1lbnRhdGlvbih0aGlzLm92ZXJsYXkpO1xuICAgICAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi53aGVuUmVhZHkpIHtcbiAgICAgICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb24ud2hlblJlYWR5LnRoZW4oZGVmZXJyZWQucmVzb2x2ZSwgZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQvtCx0LXRidCw0L3QuNGPLCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQvtC00L3QvtC8INC40Lcg0YHQv9C40YHQutCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uIC0g0L3QsNC30LLQsNC90LjQtSDQtNC10LnRgdGC0LLQuNGPXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSByZXNvbHZlIC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvRhSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0YDQsNC30YDQtdGI0LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gcmVqZWN0IC0g0YHQv9C40YHQvtC6INC+0LbQuNC00LDQtdC80YvQuSDRgdC+0LHRi9GC0LjQuSDQtNC70Y8g0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQHJldHVybnMge1Byb21pc2V9IC0tINGC0LDQutC20LUg0YHQvtC30LTQsNGR0YIgRGVmZXJyZWQg0YHQstC+0LnRgdGC0LLQviDRgSDQvdCw0LfQstCw0L3QuNC10LwgX3doZW48QWN0aW9uPiwg0LrQvtGC0L7RgNC+0LUg0LbQuNCy0ZHRgiDQtNC+INC80L7QvNC10L3RgtCwINGA0LDQt9GA0LXRiNC10L3QuNGPXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3dhaXRFdmVudHMgPSBmdW5jdGlvbihhY3Rpb24sIHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXNbYWN0aW9uXSA9IGRlZmVycmVkO1xuXG4gICAgdmFyIGNsZWFudXBFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBzZWxmLm9mZihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGRlZmVycmVkLnJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgc2VsZlthY3Rpb25dO1xuICAgIH07XG5cbiAgICByZXNvbHZlLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi5vbihldmVudCwgZGVmZXJyZWQucmVzb2x2ZSk7XG4gICAgfSk7XG5cbiAgICByZWplY3QuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLm9uKGV2ZW50LCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBkYXRhIGluc3RhbmNlb2YgRXJyb3IgPyBkYXRhIDogbmV3IEF1ZGlvRXJyb3IoZGF0YSB8fCBldmVudCk7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGRlZmVycmVkLnByb21pc2UoKS50aGVuKGNsZWFudXBFdmVudHMsIGNsZWFudXBFdmVudHMpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbi8qKlxuICog0KDQsNGB0YjQuNGA0LXQvdC40LUg0YHQvtCx0YvRgtC40Lkg0LDRg9C00LjQvi3Qv9C70LXQtdGA0LAg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQvNC4INGB0LLQvtC50YHRgtCy0LDQvNC4LiDQn9C+0LTQv9C40YHRi9Cy0LDQtdGC0YHRjyDQvdCwINCy0YHQtSDRgdC+0LHRi9GC0LjRjyDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsCxcbiAqINGC0YDQuNCz0LPQtdGA0LjRgiDQuNGC0L7Qs9C+0LLRi9C1INGB0L7QsdGL0YLQuNGPLCDRgNCw0LfQtNC10LvRj9GPINC40YUg0L/QviDRgtC40L/RgyDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC70L7QsNC00LXRgCwg0LTQvtC/0L7Qu9C90Y/QtdGCINGB0L7QsdGL0YLQuNGPINC00LDQvdC90YvQvNC4LlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSDQuNGB0YLQvtGH0L3QuNC6INGB0L7QsdGL0YLQuNGPLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHBhcmFtIHsqfSBkYXRhIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQtNCw0L3QvdGL0LUg0YHQvtCx0YvRgtC40Y8uXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX3BvcHVsYXRlRXZlbnRzID0gZnVuY3Rpb24oZXZlbnQsIG9mZnNldCwgZGF0YSkge1xuICAgIGlmIChldmVudCAhPT0gQXVkaW9QbGF5ZXIuRVZFTlRfUFJPR1JFU1MpIHtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BvcHVsYXRlRXZlbnRzXCIsIGV2ZW50LCBvZmZzZXQsIGRhdGEpO1xuICAgIH1cblxuICAgIHZhciBvdXRlckV2ZW50ID0gKG9mZnNldCA/IEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCA6IFwiXCIpICsgZXZlbnQ7XG5cbiAgICBzd2l0Y2ggKGV2ZW50KSB7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRDpcbiAgICAgICAgY2FzZSBBdWRpb1BsYXllci5FVkVOVF9TV0FQOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQXVkaW9QbGF5ZXIuRVZFTlRfVk9MVU1FOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50LCB0aGlzLmdldFZvbHVtZSgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEF1ZGlvUGxheWVyLkVWRU5UX1BST0dSRVNTOlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQsIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbjogdGhpcy5nZXREdXJhdGlvbihvZmZzZXQpLFxuICAgICAgICAgICAgICAgIGxvYWRlZDogdGhpcy5nZXRMb2FkZWQob2Zmc2V0KSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogb2Zmc2V0ID8gMCA6IHRoaXMuZ2V0UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICBwbGF5ZWQ6IG9mZnNldCA/IDAgOiB0aGlzLmdldFBsYXllZCgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKG91dGVyRXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQk9C10L3QtdGA0LDRhtC40Y8gcGxheUlkXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuX2dlbmVyYXRlUGxheUlkID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGxheUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygpLnNsaWNlKDIpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIENvbW1vblxuLyoqXG4gKiDQktC+0LfQstGA0LDRidCw0LXRgiDQvtCx0LXRidCw0L3QuNC1LCDRgNCw0LfRgNC10YjQsNGO0YnQtdC10YHRjyDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4LlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5pbml0UHJvbWlzZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLndoZW5SZWFkeTtcbn07XG5cbi8qKlxuICog0JLQvtC30LLRgNCw0YnQsNC10YIg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGU7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGC0LjQvyDRgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LBcbiAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFR5cGUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGU7XG59O1xuXG4vKipcbiAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINGC0LXQutGD0YnQuNC5INGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtINCx0YDQsNGC0Ywg0YLRgNC10Log0LjQtyDQsNC60YLQuNCy0L3QvtCz0L4g0L/Qu9C10LXRgNCwINC40LvQuCDQuNC3INC/0YDQtdC70L7QsNC00LXRgNCwLiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHJldHVybnMge0lBdWRpb0ltcGxlbWVudGF0aW9ufG51bGx9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXRTcmMgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLmdldFNyYyhvZmZzZXQpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFBsYXliYWNrXG5cbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwLiDQkNC60YLRg9Cw0LvRjNC90L4g0LTQu9GPINGE0LvQtdGILdGA0LXQsNC70LjQt9Cw0YbQuNC4LCDQsiDQvdC10Lkg0L/QvtC60LAg0YLRgNC10Log0LPRgNGD0LfQuNGC0YHRj1xuICog0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC+0L/RgNC10LTQtdC70Y/QtdGC0YHRjyDRgSDQv9C+0LPRgNC10YjQvdC+0YHRgtGM0Y4uXG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihzcmMsIGR1cmF0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJwbGF5XCIsIHNyYywgZHVyYXRpb24pO1xuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblBsYXkucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QbGF5LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLl9zZXRTdGF0ZShBdWRpb1BsYXllci5TVEFURV9QQVVTRUQpO1xuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGxheShzcmMsIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC60LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LvQvtCw0LTQtdGALiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALiAxIC0g0L/RgNC10LvQvtCw0LTQtdGALlxuICogQHJldHVybnMge0Fib3J0YWJsZVByb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzdG9wXCIsIG9mZnNldCk7XG5cbiAgICBpZiAob2Zmc2V0ICE9PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3Aob2Zmc2V0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9wbGF5ZWQgPSAwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gMDtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJzdG9wXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuICAgIGlmICh0aGlzLl93aGVuU3RvcCkge1xuICAgICAgICBwcm9taXNlID0gdGhpcy5fd2hlblN0b3AucHJvbWlzZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93YWl0RXZlbnRzKFwiX3doZW5TdG9wXCIsIFtBdWRpb1BsYXllci5FVkVOVF9TVE9QXSwgW1xuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfUExBWSxcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfQ1JBU0hFRFxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnN0b3AoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0L/Qu9C10LXRgCDQvdCwINC/0LDRg9C30YNcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBhdXNlXCIpO1xuXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IEF1ZGlvUGxheWVyLlNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkJBRF9TVEFURSkpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlO1xuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdChcInBhdXNlXCIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl93aGVuUGF1c2UpIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3doZW5QYXVzZS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBhdXNlXCIsIFtBdWRpb1BsYXllci5FVkVOVF9QQVVTRV0sIFtcbiAgICAgICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9QTEFZLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucGF1c2UoKTtcblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiDQodC90Y/RgtC40LUg0L/Qu9C10LXRgNCwINGBINC/0LDRg9C30YtcbiAqIEByZXR1cm5zIHtBYm9ydGFibGVQcm9taXNlfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZXN1bWVcIik7XG5cbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQXVkaW9QbGF5ZXIuU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBpZiAoISh0aGlzLnN0YXRlID09PSBBdWRpb1BsYXllci5TVEFURV9JRExFIHx8IHRoaXMuc3RhdGUgPT09IEF1ZGlvUGxheWVyLlNUQVRFX1BBVVNFRCB8fCB0aGlzLnN0YXRlXG4gICAgICAgID09PSBBdWRpb1BsYXllci5TVEFURV9QTEFZSU5HKSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBBdWRpb0Vycm9yKEF1ZGlvRXJyb3IuQkFEX1NUQVRFKSk7XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2U7XG5cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJyZXN1bWVcIik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3doZW5QbGF5KSB7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLl93aGVuUGxheS5wcm9taXNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9TVE9QLFxuICAgICAgICAgICAgQXVkaW9QbGF5ZXIuRVZFTlRfRVJST1IsXG4gICAgICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgICAgIF0pO1xuICAgIH1cblxuICAgIHRoaXMuaW1wbGVtZW50YXRpb24ucmVzdW1lKCk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8vYWJvcnRhYmxlXG4vKipcbiAqINCX0LDQv9GD0YHQuiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y8g0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcmV0dXJucyB7QWJvcnRhYmxlUHJvbWlzZX1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnBsYXlQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInBsYXlQcmVsb2FkZWRcIiwgc3JjKTtcblxuICAgIGlmICghdGhpcy5pc1ByZWxvYWRlZChzcmMpKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheVByZWxvYWRlZEJhZFRyYWNrXCIsIEF1ZGlvRXJyb3IuTk9UX1BSRUxPQURFRCk7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fcGxheWVkID0gMDtcbiAgICB0aGlzLl9sYXN0U2tpcCA9IDA7XG4gICAgdGhpcy5fZ2VuZXJhdGVQbGF5SWQoKTtcblxuICAgIGlmICh0aGlzLl93aGVuUGxheSkge1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblBhdXNlKSB7XG4gICAgICAgIHRoaXMuX3doZW5QYXVzZS5yZWplY3QoXCJwbGF5UHJlbG9hZGVkXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2hlblN0b3ApIHtcbiAgICAgICAgdGhpcy5fd2hlblN0b3AucmVqZWN0KFwicGxheVByZWxvYWRlZFwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3dhaXRFdmVudHMoXCJfd2hlblBsYXlcIiwgW0F1ZGlvUGxheWVyLkVWRU5UX1BMQVldLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NUT1AsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5FVkVOVF9DUkFTSEVEXG4gICAgXSk7XG4gICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fd2hlblBsYXkpIHtcbiAgICAgICAgICAgIHRoaXMuX3doZW5QbGF5LnJlamVjdC5hcHBseSh0aGlzLl93aGVuUGxheSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fc2V0U3RhdGUoQXVkaW9QbGF5ZXIuU1RBVEVfUEFVU0VEKTtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5pbXBsZW1lbnRhdGlvbi5wbGF5UHJlbG9hZGVkKCk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInBsYXlQcmVsb2FkZWRFcnJvclwiLCBBdWRpb0Vycm9yLk5PVF9QUkVMT0FERUQpO1xuICAgICAgICB0aGlzLl93aGVuUGxheS5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUHJlbG9hZFxuLy9hYm9ydGFibGVcbi8qKlxuICog0J/RgNC10LTQt9Cw0LPRgNGD0LfQutCwINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsC4g0JDQutGC0YPQsNC70YzQvdC+INC00LvRjyDRhNC70LXRiC3RgNC10LDQu9C40LfQsNGG0LjQuCwg0LIg0L3QtdC5INC/0L7QutCwINGC0YDQtdC6INCz0YDRg9C30LjRgtGB0Y9cbiAqINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDQvtC/0YDQtdC00LXQu9GP0LXRgtGB0Y8g0YEg0L/QvtCz0YDQtdGI0L3QvtGB0YLRjNGOLlxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5wcmVsb2FkID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIGR1cmF0aW9uKTtcblxuICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICB0aGlzLl93aGVuUHJlbG9hZC5yZWplY3QoXCJwcmVsb2FkXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5fd2FpdEV2ZW50cyhcIl93aGVuUHJlbG9hZFwiLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0xPQURJTkcsXG4gICAgICAgIEF1ZGlvUGxheWVyLkVWRU5UX1NXQVBcbiAgICBdLCBbXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0NSQVNIRUQsXG4gICAgICAgIEF1ZGlvUGxheWVyLlBSRUxPQURFUl9FVkVOVCArIEF1ZGlvUGxheWVyLkVWRU5UX0VSUk9SLFxuICAgICAgICBBdWRpb1BsYXllci5QUkVMT0FERVJfRVZFTlQgKyBBdWRpb1BsYXllci5FVkVOVF9TVE9QXG4gICAgXSk7XG5cbiAgICBwcm9taXNlLmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl93aGVuUHJlbG9hZCkge1xuICAgICAgICAgICAgdGhpcy5fd2hlblByZWxvYWQucmVqZWN0LmFwcGx5KHRoaXMuX3doZW5QcmVsb2FkLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5zdG9wKDEpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5pbXBsZW1lbnRhdGlvbi5wcmVsb2FkKHNyYywgZHVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC60LAsINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttC10L1cbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMpIHtcbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5pc1ByZWxvYWRlZChzcmMpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKHNyYykge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmlzUHJlbG9hZGluZyhzcmMsIDEpO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFRpbWluZ3Ncbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uZ2V0UG9zaXRpb24oKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0g0L3QvtCy0LDRjyDQv9C+0LfQuNGG0LjRjyDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9IC0tINC60L7QvdC10YfQvdCw0Y8g0L/QvtC30LjRhtC40Y8g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRQb3NpdGlvblwiLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlID09IFwiZmxhc2hcIikge1xuICAgICAgICBwb3NpdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKHRoaXMuZ2V0TG9hZGVkKCksIHBvc2l0aW9uKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0aGlzLmdldER1cmF0aW9uKCksIHBvc2l0aW9uKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fcGxheWVkICs9IHRoaXMuZ2V0UG9zaXRpb24oKSAtIHRoaXMuX2xhc3RTa2lwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gcG9zaXRpb247XG5cbiAgICB0aGlzLmltcGxlbWVudGF0aW9uLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblxuICAgIHJldHVybiBwb3NpdGlvbjtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge0Jvb2xlYW58aW50fSBwcmVsb2FkZXIgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAg0LjQu9C4INC/0YDQtdC00LfQsNCz0YDRg9C30YfQuNC6LiAwIC0g0LDQutGC0LjQstC90YvQuSDQv9C70LXQtdGALCAxIC0g0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldER1cmF0aW9uKHByZWxvYWRlciA/IDEgOiAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1INC00LvQuNGC0LXQu9GM0L3QvtGB0YLQuCDQt9Cw0LPRgNGD0LbQtdC90L3QvtC5INGH0LDRgdGC0LhcbiAqIEBwYXJhbSB7Qm9vbGVhbnxpbnR9IHByZWxvYWRlciAtINCw0LrRgtC40LLQvdGL0Lkg0L/Qu9C10LXRgCDQuNC70Lgg0L/RgNC10LTQt9Cw0LPRgNGD0LfRh9C40LouIDAgLSDQsNC60YLQuNCy0L3Ri9C5INC/0LvQtdC10YAsIDEgLSDQv9GA0LXQtNC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldExvYWRlZCA9IGZ1bmN0aW9uKHByZWxvYWRlcikge1xuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLmdldExvYWRlZChwcmVsb2FkZXIgPyAxIDogMCk7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuZ2V0UGxheWVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRQb3NpdGlvbigpO1xuICAgIHRoaXMuX3BsYXllZCArPSBwb3NpdGlvbiAtIHRoaXMuX2xhc3RTa2lwO1xuICAgIHRoaXMuX2xhc3RTa2lwID0gcG9zaXRpb247XG5cbiAgICByZXR1cm4gdGhpcy5fcGxheWVkO1xufTtcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFZvbHVtZVxuLyoqXG4gKiDQn9C+0LvRg9GH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4INC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pbXBsZW1lbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi5nZXRWb2x1bWUoKTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQutCwINCz0YDQvtC80LrQvtGB0YLQuCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7TnVtYmVyfSB2b2x1bWUgLSDQvdC+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7TnVtYmVyfSAtLSDQuNGC0L7Qs9C+0LLQvtC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKi9cbkF1ZGlvUGxheWVyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbih2b2x1bWUpIHtcbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInNldFZvbHVtZVwiLCB2b2x1bWUpO1xuXG4gICAgaWYgKCF0aGlzLmltcGxlbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uLnNldFZvbHVtZSh2b2x1bWUpO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwLCDRh9GC0L4g0LPRgNC+0LzQutC+0YHRgtGMINGD0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0YPRgdGC0YDQvtC50YHRgtCy0L7QvCwg0LAg0L3QtSDQv9GA0L7Qs9GA0LDQvNC90L5cbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUuaXNEZXZpY2VWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuaW1wbGVtZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uaXNEZXZpY2VWb2x1bWUoKTtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBXZWIgQXVkaW8gQVBJXG4vKipcbiAqINCf0LXRgNC10LrQu9GO0YfQtdC90LjQtSDRgNC10LbQuNC80LAg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gV2ViIEF1ZGlvIEFQSS4g0JTQvtGB0YLRg9C/0LXQvSDRgtC+0LvRjNC60L4g0L/RgNC4IGh0bWw1LdGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0LvQtdC10YDQsC5cbiAqXG4gKiAqKtCS0L3QuNC80LDQvdC40LUhKiogLSDQv9C+0YHQu9C1INCy0LrQu9GO0YfQtdC90LjRjyDRgNC10LbQuNC80LAgV2ViIEF1ZGlvIEFQSSDQvtC9INC90LUg0L7RgtC60LvRjtGH0LDQtdGC0YHRjyDQv9C+0LvQvdC+0YHRgtGM0Y4sINGCLtC6LiDQtNC70Y8g0Y3RgtC+0LPQviDRgtGA0LXQsdGD0LXRgtGB0Y9cbiAqINGA0LXQuNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDQv9C70LXQtdGA0LAsINC60L7RgtC+0YDQvtC5INGC0YDQtdCx0YPQtdGC0YHRjyDQutC70LjQuiDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8uINCf0YDQuCDQvtGC0LrQu9GO0YfQtdC90LjQuCDQuNC3INCz0YDQsNGE0LAg0L7QsdGA0LDQsdC+0YLQutC4INC40YHQutC70Y7Rh9Cw0Y7RgtGB0Y9cbiAqINCy0YHQtSDQvdC+0LTRiyDQutGA0L7QvNC1INC90L7QtC3QuNGB0YLQvtGH0L3QuNC60L7QsiDQuCDQvdC+0LTRiyDQstGL0LLQvtC00LAsINGD0L/RgNCw0LLQu9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLRjNGOINC/0LXRgNC10LrQu9GO0YfQsNC10YLRgdGPINC90LAg0Y3Qu9C10LzQtdC90YLRiyBhdWRpbywg0LHQtdC3XG4gKiDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRjyBHYWluTm9kZVxuICogQHBhcmFtIHtCb29sZWFufSBzdGF0ZSAtINC30LDQv9GA0LDRiNC40LLQsNC10LzRi9C5INGB0YLQsNGC0YPRgVxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINC40YLQvtCz0L7QstGL0Lkg0YHRgtCw0YLRg9GBINC/0LvQtdC10YDQsFxuICovXG5BdWRpb1BsYXllci5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElcIiwgc3RhdGUpO1xuICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUgIT09IFwiaHRtbDVcIikge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJRmFpbGVkXCIsIHRoaXMuaW1wbGVtZW50YXRpb24udHlwZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbi50b2dnbGVXZWJBdWRpb0FQSShzdGF0ZSk7XG59O1xuXG4vKipcbiAqINCQ0YPQtNC40L4t0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSB5YS5BdWRpb35BdWRpb1ByZXByb2Nlc3NvclxuICpcbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBpbnB1dCAtINC90L7QtNCwLCDQsiDQutC+0YLQvtGA0YPRjiDQv9C10YDQtdC90LDQv9GA0LDQstC70Y/QtdGC0YHRjyDQstGL0LLQvtC0INCw0YPQtNC40L5cbiAqIEBwcm9wZXJ0eSB7QXVkaW9Ob2RlfSBvdXRwdXQgLSDQvdC+0LTQsCDQuNC3INC60L7RgtC+0YDQvtC5INCy0YvQstC+0LQg0L/QvtC00LDRkdGC0YHRjyDQvdCwINGD0YHQuNC70LjRgtC10LvRjFxuICovXG5cbi8qKlxuICog0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQsNGD0LTQuNC+INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwLiDQktGF0L7QtCDQv9GA0LXQv9GA0L7RhtC10YHRgdC+0YDQsCDQv9C+0LTQutC70Y7Rh9Cw0LXRgtGB0Y8g0Log0LDRg9C00LjQvi3RjdC70LXQvNC10L3RgtGDINGDINC60L7RgtC+0YDQvtCz0L4g0LLRi9GB0YLQsNCy0LvQtdC90LBcbiAqIDEwMCUg0LPRgNC+0LzQutC+0YHRgtGMLiDQktGL0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiBHYWluTm9kZSwg0LrQvtGC0L7RgNCw0Y8g0YDQtdCz0YPQu9C40YDRg9C10YIg0LjRgtC+0LPQvtCy0YPRjiDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7eWEuQXVkaW9+QXVkaW9QcmVwcm9jZXNzb3J9IHByZXByb2Nlc3NvciAtINC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgFxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINGB0YLQsNGC0YPRgSDRg9GB0L/QtdGF0LBcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLnNldEF1ZGlvUHJlcHJvY2Vzc29yID0gZnVuY3Rpb24ocHJlcHJvY2Vzc29yKSB7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvclwiKTtcbiAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbi50eXBlICE9PSBcImh0bWw1XCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJzZXRBdWRpb1ByZXByb2Nlc3NvckZhaWxlZFwiLCB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb24uc2V0QXVkaW9QcmVwcm9jZXNzb3IocHJlcHJvY2Vzc29yKTtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBQbGF5SWRcbi8qKlxuICog0J/QvtC70YPRh9C10L3QuNC1IHBsYXlJZFxuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLmdldFBsYXlJZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wbGF5SWQ7XG59O1xuXG4vKipcbiAqINCS0YHQv9C+0LzQvtCz0LDRgtC10LvRjNC90LDRjyDRhNGD0L3QutGG0LjRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/Qu9C10LXRgNCwINCyINC70L7Qs9C1LlxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9QbGF5ZXIucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBpbmRleDogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLm5hbWUsXG4gICAgICAgIHNyYzogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLl9sb2dnZXIoKSxcbiAgICAgICAgdHlwZTogdGhpcy5pbXBsZW1lbnRhdGlvbiAmJiB0aGlzLmltcGxlbWVudGF0aW9uLnR5cGVcbiAgICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1BsYXllcjtcbiIsIi8qKlxuICogQG5hbWVzcGFjZSBBdWRpb1N0YXRpY1xuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvU3RhdGljID0ge307XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0Ki9cbkF1ZGlvU3RhdGljLkVWRU5UX1BMQVkgPSBcInBsYXlcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9TVE9QID0gXCJzdG9wXCI7XG5cbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QQVVTRSA9IFwicGF1c2VcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyA9IFwicHJvZ3Jlc3NcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0xPQURJTkcgPSBcImxvYWRpbmdcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9MT0FERUQgPSBcImxvYWRlZFwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FID0gXCJ2b2x1bWVjaGFuZ2VcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0VOREVEID0gXCJlbmRlZFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5FVkVOVF9FUlJPUiA9IFwiZXJyb3JcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NUQVRFID0gXCJzdGF0ZVwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLkVWRU5UX1NXQVAgPSBcInN3YXBcIjtcblxuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlBSRUxPQURFUl9FVkVOVCA9IFwicHJlbG9hZGVyOlwiO1xuXG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfSU5JVCA9IFwiaW5pdFwiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX0NSQVNIRUQgPSBcImNyYXNoZWRcIjtcbi8qKiBAdHlwZSB7U3RyaW5nfVxuICogQGNvbnN0ICovXG5BdWRpb1N0YXRpYy5TVEFURV9JRExFID0gXCJpZGxlXCI7XG4vKiogQHR5cGUge1N0cmluZ31cbiAqIEBjb25zdCAqL1xuQXVkaW9TdGF0aWMuU1RBVEVfUExBWUlORyA9IFwicGxheWluZ1wiO1xuLyoqIEB0eXBlIHtTdHJpbmd9XG4gKiBAY29uc3QgKi9cbkF1ZGlvU3RhdGljLlNUQVRFX1BBVVNFRCA9IFwicGF1c2VkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9TdGF0aWM7XG4iLCIvKipcbiAqINCd0LDRgdGC0L7QudC60Lgg0LHQuNCx0LvQuNC+0YLQtdC60LhcbiAqIEBhbGlhcyB5YS5BdWRpby5jb25maWdcbiAqIEBuYW1lc3BhY2VcbiAqL1xudmFyIGNvbmZpZyA9IHtcbiAgICAvKipcbiAgICAgKiDQntCx0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBhdWRpbzoge1xuICAgICAgICAvKipcbiAgICAgICAgICog0JrQvtC70LjRh9C10YHRgtCy0L4g0L/QvtC/0YvRgtC+0Log0YDQtdC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICByZXRyeTogM1xuICAgIH0sXG4gICAgLyoqXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutC4INC/0L7QtNC60LvRjtGH0LXQvdC40Y8gZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqL1xuICAgIGZsYXNoOiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQn9GD0YLRjCDQuiAuc3dmINGE0LDQudC70YMg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBwYXRoOiBcImRpc3RcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0LzRjyAuc3dmINGE0LDQudC70LAg0YTQu9C10Ygt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBuYW1lOiBcInBsYXllci0yXzAuc3dmXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQnNC40L3QuNC80LDQu9GM0L3QsNGPINCy0LXRgNGB0LjRjyDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHZlcnNpb246IFwiOS4wLjI4XCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJRCwg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQstGL0YHRgtCw0LLQu9C10L0g0LTQu9GPINGN0LvQtdC80LXQvdGC0LAg0YEgZmxhc2gt0L/Qu9C10LXRgNC+0LxcbiAgICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHBsYXllcklEOiBcIllhbmRleEF1ZGlvRmxhc2hQbGF5ZXJcIixcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCY0LzRjyDRhNGD0L3QutGG0LjQuC3QvtCx0YDQsNCx0L7RgtGH0LjQutCwINGB0L7QsdGL0YLQuNC5IGZsYXNoLdC/0LvQtdC10YDQsFxuICAgICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICAgKiBAY29uc3RcbiAgICAgICAgICovXG4gICAgICAgIGNhbGxiYWNrOiBcInlhLkF1ZGlvLl9mbGFzaENhbGxiYWNrXCIsXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgaW5pdFRpbWVvdXQ6IDMwMDAsIC8vIDMgc2VjXG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQotCw0LnQvNCw0YPRgiDQt9Cw0LPRgNGD0LfQutC4XG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBsb2FkVGltZW91dDogNTAwMCxcbiAgICAgICAgLyoqXG4gICAgICAgICAqINCi0LDQudC80LDRg9GCINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4INC/0L7RgdC70LUg0LrQu9C40LrQsFxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgY2xpY2tUaW1lb3V0OiAxMDAwLFxuICAgICAgICAvKipcbiAgICAgICAgICog0JjQvdGC0LXRgNCy0LDQuyDQv9GA0L7QstC10YDQutC4INC00L7RgdGC0YPQv9C90L7RgdGC0LggZmxhc2gt0L/Qu9C10LXRgNCwXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBoZWFydEJlYXRJbnRlcnZhbDogMTAwMFxuICAgIH0sXG4gICAgLyoqXG4gICAgICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6IGh0bWw1INC/0LvQtdC10YDQsFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKi9cbiAgICBodG1sNToge1xuICAgICAgICAvKipcbiAgICAgICAgICog0KHQv9C40YHQvtC6INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0L7QsiDQtNC70Y8g0LrQvtGC0L7RgNGL0YUg0LvRg9GH0YjQtSDQvdC1INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCBodG1sNSDQv9C70LXQtdGALiDQmNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0L/RgNC4XG4gICAgICAgICAqINCw0LLRgtC+LdC+0L/RgNC10LTQtdC70LXQvdC40Lgg0YLQuNC/0LAg0L/Qu9C10LXRgNCwLiDQmNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNGLINGB0YDQsNCy0L3QuNCy0LDRjtGC0YHRjyDRgdC+INGB0YLRgNC+0LrQvtC5INC/0L7RgdGC0YDQvtC10L3QvdC+0Lkg0L/QviDRiNCw0LHQu9C+0L3Rg1xuICAgICAgICAgKiBgQDxwbGF0Zm9ybS52ZXJzaW9uPiA8cGxhdGZvcm0ub3M+Ojxicm93c2VyLm5hbWU+Lzxicm93c2VyLnZlcnNpb24+YFxuICAgICAgICAgKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gICAgICAgICAqL1xuICAgICAgICBibGFja2xpc3Q6IFtcImxpbnV4Om1vemlsbGFcIiwgXCJ1bml4Om1vemlsbGFcIiwgXCJtYWNvczptb3ppbGxhXCIsIFwiOm9wZXJhXCIsIFwiQE5UIDVcIiwgXCJATlQgNFwiXVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY29uZmlnO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi9saWIvY2xhc3MvZXJyb3ItY2xhc3MnKTtcblxuLyoqXG4gKiBAY2xhc3Mg0JrQu9Cw0YHRgSDQvtGI0LjQsdC60Lgg0LDRg9C00LjQvi3Qv9C70LvQtdC10YDQsFxuICogQGFsaWFzIHlhLkF1ZGlvLkF1ZGlvRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKlxuICogQGV4dGVuZHMgRXJyb3JcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEF1ZGlvRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkF1ZGlvRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJBdWRpb0Vycm9yXCIpO1xuXG4vKipcbiAqINCd0LUg0L3QsNC50LTQtdC90LAg0YDQtdCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwINC40LvQuCDQstGB0LUg0LTQvtGB0YLRg9C/0L3Ri9C1INGA0LXQsNC70LjQt9Cw0YbQuNC4INC/0L7RgtC10YDQv9C10LvQuCDQutGA0LDRhSDQv9GA0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LguXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuTk9fSU1QTEVNRU5UQVRJT04gPSBcImNhbm5vdCBmaW5kIHN1aXRhYmxlIGltcGxlbWVudGF0aW9uXCI7XG4vKipcbiAqINCi0YDQtdC6INC90LUg0LHRi9C7INC/0YDQtdC00LfQsNCz0YDRg9C20LXQvSDQuNC70Lgg0LLQviDQstGA0LXQvNGPINC30LDQs9GA0YPQt9C60Lgg0L/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5OT1RfUFJFTE9BREVEID0gXCJ0cmFjayBpcyBub3QgcHJlbG9hZGVkXCI7XG4vKipcbiAqINCU0LXQudGB0YLQstC40LUg0L3QtSDQtNC+0YHRgtGD0L/QvdC+INC40Lcg0YLQtdC60YPRidC10LPQviDRgdC+0YHRgtC+0Y/QvdC40Y9cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5CQURfU1RBVEUgPSBcImFjdGlvbiBpcyBub3QgcGVybWl0ZWQgZnJvbSBjdXJyZW50IHN0YXRlXCI7XG5cbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQsdGL0Lsg0LfQsNCx0LvQvtC60LjRgNC+0LLQsNC9XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfQkxPQ0tFUiA9IFwiZmxhc2ggaXMgcmVqZWN0ZWQgYnkgZmxhc2ggYmxvY2tlciBwbHVnaW5cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQv9C+INC90LXQuNC30LLQtdGB0YLQvdGL0Lwg0L/RgNC40YfQuNC90LDQvFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX1VOS05PV05fQ1JBU0ggPSBcImZsYXNoIGlzIGNyYXNoZWQgd2l0aG91dCByZWFzb25cIjtcbi8qKlxuICogRmxhc2gt0L/Qu9C10LXRgCDQv9C+0YLQtdGA0L/QtdC7INC60YDQsNGFINC/0YDQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuCDQuNC3LdC30LAg0YLQsNC50LzQsNGD0YLQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOSVRfVElNRU9VVCA9IFwiZmxhc2ggaW5pdCB0aW1lZCBvdXRcIjtcbi8qKlxuICog0JLQvdGD0YLRgNC10L3QvdGP0Y8g0L7RiNC40LHQutCwIEZsYXNoLdC/0LvQtdC10YDQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SID0gXCJmbGFzaCBpbnRlcm5hbCBlcnJvclwiO1xuLyoqXG4gKiDQn9C+0L/Ri9GC0LrQsCDQstGL0LfQstCw0YLRjCDQvdC10LTQvtGB0YLRg9C/0L3Ri9C5INGN0LrQt9C10LzQu9GP0YAgRmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvRXJyb3IuRkxBU0hfRU1NSVRFUl9OT1RfRk9VTkQgPSBcImZsYXNoIGV2ZW50IGVtbWl0ZXIgbm90IGZvdW5kXCI7XG4vKipcbiAqIEZsYXNoLdC/0LvQtdC10YAg0L/QtdGA0LXRgdGC0LDQuyDQvtGC0LLQtdGH0LDRgtGMINC90LAg0LfQsNC/0YDQvtGB0YtcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuQXVkaW9FcnJvci5GTEFTSF9OT1RfUkVTUE9ORElORyA9IFwiZmxhc2ggcGxheWVyIGRvZXNuJ3QgcmVzcG9uc2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb0Vycm9yO1xuIiwicmVxdWlyZSgnLi4vZXhwb3J0Jyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi9hdWRpby1lcnJvcicpO1xudmFyIFBsYXliYWNrRXJyb3IgPSByZXF1aXJlKCcuL3BsYXliYWNrLWVycm9yJyk7XG5cbnlhLkF1ZGlvLkF1ZGlvRXJyb3IgPSBBdWRpb0Vycm9yO1xueWEuQXVkaW8uUGxheWJhY2tFcnJvciA9IFBsYXliYWNrRXJyb3I7XG4iLCJ2YXIgRXJyb3JDbGFzcyA9IHJlcXVpcmUoJy4uL2xpYi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQutC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQGFsaWFzIHlhLkF1ZGlvLlBsYXliYWNrRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC4XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBlbnVtIHtTdHJpbmd9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFBsYXliYWNrRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlLCBzcmMpIHtcbiAgICBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgICB0aGlzLnNyYyA9IHNyYztcbn07XG5cblBsYXliYWNrRXJyb3IucHJvdG90eXBlID0gRXJyb3JDbGFzcy5jcmVhdGUoXCJQbGF5YmFja0Vycm9yXCIpO1xuXG4vKipcbiAqINCe0YLQvNC10L3QsCDRgdC+0LXQtNC40L3QtdC90L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVEID0gXCJDb25uZWN0aW9uIGFib3J0ZWRcIjtcbi8qKlxuICog0KHQtdGC0LXQstCw0Y8g0L7RiNC40LHQutCwXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cblBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUiA9IFwiTmV0d29yayBlcnJvclwiO1xuLyoqXG4gKiDQntGI0LjQsdC60LAg0LTQtdC60L7QtNC40YDQvtCy0LDQvdC40Y8g0LDRg9C00LjQvlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5QbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUiA9IFwiRGVjb2RlIGVycm9yXCI7XG4vKipcbiAqINCd0LUg0LTQvtGB0YLRg9C/0L3Ri9C5INC40YHRgtC+0YfQvdC40LpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY29uc3RcbiAqL1xuUGxheWJhY2tFcnJvci5CQURfREFUQSA9IFwiQmFkIGRhdGFcIjtcblxuLyoqXG4gKiDQotCw0LHQu9C40YbQsCDRgdC+0L7RgtCy0LXRgtGB0YLQstC40Y8g0LrQvtC00L7QsiDQvtGI0LjQsdC+0LogaHRtbDUg0L/Qu9C10LXRgNCwXG4gKiBAZW51bSB7U3RyaW5nfVxuICovXG5QbGF5YmFja0Vycm9yLmh0bWw1ID0ge1xuICAgIDE6IFBsYXliYWNrRXJyb3IuQ09OTkVDVElPTl9BQk9SVEVELFxuICAgIDI6IFBsYXliYWNrRXJyb3IuTkVUV09SS19FUlJPUixcbiAgICAzOiBQbGF5YmFja0Vycm9yLkRFQ09ERV9FUlJPUixcbiAgICA0OiBQbGF5YmFja0Vycm9yLkJBRF9EQVRBXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXliYWNrRXJyb3I7XG4iLCJpZiAodHlwZW9mIHdpbmRvdy55YSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbmRvdy55YSA9IHt9O1xufVxudmFyIHlhID0gd2luZG93LnlhO1xuXG5pZiAodHlwZW9mIHlhLkF1ZGlvID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgeWEuQXVkaW8gPSB7fTtcbn1cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgQXVkaW9QbGF5ZXIgPSByZXF1aXJlKCcuL2F1ZGlvLXBsYXllcicpO1xudmFyIFByb3h5ID0gcmVxdWlyZSgnLi9saWIvY2xhc3MvcHJveHknKTtcblxueWEuQXVkaW8gPSBQcm94eS5jcmVhdGVDbGFzcyhBdWRpb1BsYXllcik7XG55YS5BdWRpby5jb25maWcgPSBjb25maWc7XG5cbm1vZHVsZS5leHBvcnRzID0geWEuQXVkaW87XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgc3dmb2JqZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvc3dmb2JqZWN0Jyk7XG52YXIgZGV0ZWN0ID0gcmVxdWlyZSgnLi4vbGliL2Jyb3dzZXIvZGV0ZWN0Jyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1ZGlvRmxhc2gnKTtcbnZhciBGbGFzaE1hbmFnZXIgPSByZXF1aXJlKCcuL2ZsYXNoLW1hbmFnZXInKTtcbnZhciBGbGFzaEludGVyZmFjZSA9IHJlcXVpcmUoJy4vZmxhc2gtaW50ZXJmYWNlJyk7XG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2V2ZW50cycpO1xuXG52YXIgcGxheWVySWQgPSAxO1xuXG52YXIgZmxhc2hNYW5hZ2VyO1xuXG52YXIgZmxhc2hWZXJzaW9uID0gc3dmb2JqZWN0LmdldEZsYXNoUGxheWVyVmVyc2lvbigpO1xuZGV0ZWN0LmZsYXNoVmVyc2lvbiA9IGZsYXNoVmVyc2lvbi5tYWpvciArIFwiLlwiICsgZmxhc2hWZXJzaW9uLm1pbm9yICsgXCIuXCIgKyBmbGFzaFZlcnNpb24ucmVsZWFzZTtcblxuZXhwb3J0cy5hdmFpbGFibGUgPSBzd2ZvYmplY3QuaGFzRmxhc2hQbGF5ZXJWZXJzaW9uKGNvbmZpZy5mbGFzaC52ZXJzaW9uKTtcbmxvZ2dlci5pbmZvKHRoaXMsIFwiZGV0ZWN0aW9uXCIsIGV4cG9ydHMuYXZhaWxhYmxlKTtcblxuLyoqXG4gKiBAY2xhc3Mg0JrQu9Cw0YHRgSBmbGFzaCDQsNGD0LTQuNC+LdC/0LvQtdC10YDQsFxuICogQGV4dGVuZHMgSUF1ZGlvSW1wbGVtZW50YXRpb25cbiAqXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGxheVxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2VuZGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jdm9sdW1lY2hhbmdlXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jY3Jhc2hlZFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3N3YXBcbiAqXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3RvcFxuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI3BhdXNlXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcHJvZ3Jlc3NcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkaW5nXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jbG9hZGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZXJyb3JcbiAqXG4gKiBAcGFyYW0ge0hNVExFbGVtZW50fSBbb3ZlcmxheV0gLSDQvNC10YHRgtC+INC00LvRjyDQstGB0YLRgNCw0LjQstCw0L3QuNGPINC/0LvQtdC10YDQsCAo0LDQutGC0YPQsNC70YzQvdC+INGC0L7Qu9GM0LrQviDQtNC70Y8gZmxhc2gt0L/Qu9C10LXRgNCwKVxuICogQHBhcmFtIHtCb29sZWFufSBbZm9yY2U9ZmFsc2VdIC0g0YHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDRjdC60LfQtdC/0LvRj9GAIEZsYXNoTWFuYWdlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgQXVkaW9GbGFzaCA9IGZ1bmN0aW9uKG92ZXJsYXksIGZvcmNlKSB7XG4gICAgdGhpcy5uYW1lID0gcGxheWVySWQrKztcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiKTtcblxuICAgIGlmICghZmxhc2hNYW5hZ2VyIHx8IGZvcmNlKSB7XG4gICAgICAgIGZsYXNoTWFuYWdlciA9IG5ldyBGbGFzaE1hbmFnZXIob3ZlcmxheSk7XG4gICAgfVxuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLndoZW5SZWFkeSA9IGZsYXNoTWFuYWdlci5jcmVhdGVQbGF5ZXIodGhpcyk7XG4gICAgdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVhZHlcIiwgZGF0YSk7XG4gICAgfS5iaW5kKHRoaXMpLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0ZsYXNoKTtcblxuQXVkaW9GbGFzaC50eXBlID0gQXVkaW9GbGFzaC5wcm90b3R5cGUudHlwZSA9IFwiZmxhc2hcIjtcblxuT2JqZWN0LmtleXMoRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIEZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleVswXSAhPT0gXCJfXCI7XG59KS5tYXAoZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQXVkaW9GbGFzaC5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIS9eZ2V0Ly50ZXN0KG1ldGhvZCkpIHtcbiAgICAgICAgICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBtZXRob2QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KFwiaWRcIikpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwicGxheWVyIGlzIG5vdCByZWFkeVwiKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmlkKTtcbiAgICAgICAgcmV0dXJuIGZsYXNoTWFuYWdlci5mbGFzaFttZXRob2RdLmFwcGx5KGZsYXNoTWFuYWdlci5mbGFzaCwgYXJncyk7XG4gICAgfVxufSk7XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcGxheVxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge051bWJlcn0gW2R1cmF0aW9uXSAtINCU0LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwICjQvdC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjylcbiAqL1xuXG4vKipcbiAqINCf0L7RgdGC0LDQstC40YLRjCDRgtGA0LXQuiDQvdCwINC/0LDRg9C30YNcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNwYXVzZVxuICovXG5cbi8qKlxuICog0KHQvdGP0YLRjCDRgtGA0LXQuiDRgSDQv9Cw0YPQt9GLXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjcmVzdW1lXG4gKi9cblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc3RvcFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDQtNC70Y8g0YLQtdC60YPRidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsCwgMTog0LTQu9GPINGB0LvQtdC00YPRjtGJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQn9GA0LXQtNC30LDQs9GA0YPQt9C40YLRjCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3ByZWxvYWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDQodGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IFtkdXJhdGlvbl0gLSDQlNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsCAo0L3QtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8pXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICovXG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNpc1ByZWxvYWRlZFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC/0YDQtdC00LfQsNCz0YDRg9C20LDQtdGC0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0YfRgtC+INGC0YDQtdC6INC90LDRh9Cw0Lsg0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNGC0YzRgdGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjaXNQcmVsb2FkaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3BsYXlQcmVsb2FkZWRcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCDQtNCw0L3QvdC+0LPQviDQtNC10LnRgdGC0LLQuNGPXG4gKi9cblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC/0L7Qt9C40YbQuNGOINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFBvc2l0aW9uXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjc2V0UG9zaXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldER1cmF0aW9uXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINC30LDQs9GA0YPQttC10L3QvdC+0Lkg0YfQsNGB0YLQuCDRgtGA0LXQutCwXG4gKiBAbWV0aG9kIEF1ZGlvRmxhc2gjZ2V0TG9hZGVkXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEBtZXRob2QgQXVkaW9GbGFzaCNnZXRWb2x1bWVcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNC1INCz0YDQvtC80LrQvtGB0YLQuFxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI3NldFZvbHVtZVxuICogQHBhcmFtIHtudW1iZXJ9IHZvbHVtZVxuICovXG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQG1ldGhvZCBBdWRpb0ZsYXNoI2dldFNyY1xuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDQtNC+0YHRgtGD0L/QtdC9INC70Lgg0L/RgNC+0LPRgNCw0LzQvNC90YvQuSDQutC+0L3RgtGA0L7Qu9GMINCz0YDQvtC80LrQvtGB0YLQuFxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLmlzRGV2aWNlVm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiDQktGB0L/QvtC80L7Qs9Cw0YLQtdC70YzQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINC/0LvQtdC10YDQsCDQsiDQu9C+0LPQtS5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvRmxhc2gucHJvdG90eXBlLl9sb2dnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzT3duUHJvcGVydHkoXCJpZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYWluOiBcIm5vdCByZWFkeVwiLFxuICAgICAgICAgICAgICAgIHByZWxvYWRlcjogXCJub3QgcmVhZHlcIlxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWFpbjogdGhpcy5nZXRTcmMoMCksXG4gICAgICAgICAgICBwcmVsb2FkZXI6IHRoaXMuZ2V0U3JjKDEpXG4gICAgICAgIH07XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvRmxhc2g7XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoSW50ZXJmYWNlJyk7XG5cbi8qKlxuICogQGNsYXNzINCe0L/QuNGB0LDQvdC40LUg0LLQvdC10YjQvdC10LPQviDQuNC90YLQtdGA0YTQtdC50YHQsCBmbGFzaC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7T2JqZWN0fSBmbGFzaCAtIHN3Zi3QvtCx0YrQtdC60YJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoSW50ZXJmYWNlID0gZnVuY3Rpb24oZmxhc2gpIHtcbiAgICB0aGlzLmZsYXNoID0geWEuQXVkaW8uX2ZsYXNoID0gZmxhc2g7XG59O1xuXG4vKipcbiAqINCS0YvQt9Cy0LDRgtGMINC80LXRgtC+0LQgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gZm4gLSDQvdCw0LfQstCw0L3QuNC1INC80LXRgtC+0LTQsFxuICogQHJldHVybnMgeyp9XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2NhbGxGbGFzaCA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy9sb2dnZXIuZGVidWcodGhpcywgZm4sIGFyZ3VtZW50cyk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5mbGFzaC5jYWxsLmFwcGx5KHRoaXMuZmxhc2gsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcIl9jYWxsRmxhc2hFcnJvclwiLCBlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQutCwINC+0LHRgNCw0YLQvdC+0Lkg0YHQstGP0LfQuCDRgSBmbGFzaC3Qv9C70LXQtdGA0L7QvFxuICogQHRocm93cyDQntGI0LjQsdC60LAg0LTQvtGB0YLRg9C/0LAg0LogZmxhc2gt0L/Qu9C10LXRgNGDXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2hlYXJ0QmVhdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcImhlYXJ0QmVhdFwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7aW50fSAtLSBpZCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuX2FkZFBsYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJhZGRQbGF5ZXJcIiwgLTEpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDQs9GA0L7QvNC60L7RgdGC0YxcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtOdW1iZXJ9IHZvbHVtZSAtINC20LXQu9Cw0LXQvNCw0Y8g0LPRgNC+0LzQutC+0YHRgtGMXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbihpZCwgdm9sdW1lKSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic2V0Vm9sdW1lXCIsIC0xLCB2b2x1bWUpO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7TnVtYmVyfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldFZvbHVtZVwiLCAtMSk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbiAtINC00LvQuNGC0LXQu9GM0L3QvtGB0YLRjCDRgtGA0LXQutCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oaWQsIHNyYywgZHVyYXRpb24pIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwbGF5XCIsIGlkLCBzcmMsIGR1cmF0aW9uKTtcbn07XG5cbi8qKlxuICog0J7RgdGC0LDQvdC+0LLQuNGC0Ywg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNC1INC4INC30LDQs9GA0YPQt9C60YMg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgdGhpcy5fY2FsbEZsYXNoKFwic3RvcFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDXG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLl9jYWxsRmxhc2goXCJwYXVzZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCh0L3Rj9GC0Ywg0YLRgNC10Log0YEg0L/QsNGD0LfRi1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInJlc3VtZVwiLCBpZCk7XG59O1xuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7U3RyaW5nfSBzcmMgLSDRgdGB0YvQu9C60LAg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIC0g0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59IC0tINCy0L7Qt9C80L7QttC90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKGlkLCBzcmMsIGR1cmF0aW9uLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicHJlbG9hZFwiLCBpZCwgc3JjLCBkdXJhdGlvbiwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQv9GA0LXQtNC30LDQs9GA0YPQttCw0LXRgtGB0Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkZWRcIiwgaWQsIHNyYywgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0LTQu9GPINGC0LXQutGD0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LAsIDE6INC00LvRjyDRgdC70LXQtNGD0Y7RidC10LPQviDQt9Cw0LPRgNGD0LfRh9C40LrQsFxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5pc1ByZWxvYWRpbmcgPSBmdW5jdGlvbihpZCwgc3JjLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiaXNQcmVsb2FkaW5nXCIsIGlkLCBzcmMsIG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IGlkIC0gaWQg0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59IC0tINC00L7RgdGC0YPQv9C90L7RgdGC0Ywg0LTQsNC90L3QvtCz0L4g0LTQtdC50YHRgtCy0LjRj1xuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwicGxheVByZWxvYWRlZFwiLCBpZCwgb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0KTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRmxhc2hJbnRlcmZhY2UucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0UG9zaXRpb25cIiwgaWQpO1xufTtcblxuLyoqXG4gKiDQo9GB0YLQsNC90L7QstC40YLRjCDRgtC10LrRg9GJ0YPRjiDQv9C+0LfQuNGG0LjRjiDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40Y9cbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtudW1iZXJ9IHBvc2l0aW9uXG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkLCBwb3NpdGlvbikge1xuICAgIHRoaXMuX2NhbGxGbGFzaChcInNldFBvc2l0aW9uXCIsIGlkLCBwb3NpdGlvbik7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0LTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uKGlkLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gdGhpcy5fY2FsbEZsYXNoKFwiZ2V0RHVyYXRpb25cIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkZsYXNoSW50ZXJmYWNlLnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihpZCwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NhbGxGbGFzaChcImdldExvYWRlZFwiLCBpZCwgb2Zmc2V0IHx8IDApO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gaWQgLSBpZCDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5GbGFzaEludGVyZmFjZS5wcm90b3R5cGUuZ2V0U3JjID0gZnVuY3Rpb24oaWQsIG9mZnNldCkge1xuICAgIHJldHVybiB0aGlzLl9jYWxsRmxhc2goXCJnZXRTcmNcIiwgaWQsIG9mZnNldCB8fCAwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hJbnRlcmZhY2U7XG4iLCJ2YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyL2xvZ2dlcicpO1xudmFyIGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0ZsYXNoQnJpZGdlJyk7XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxudmFyIEF1ZGlvU3RhdGljID0gcmVxdWlyZSgnLi4vYXVkaW8tc3RhdGljJyk7XG52YXIgZmxhc2hMb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xudmFyIEZsYXNoSW50ZXJmYWNlID0gcmVxdWlyZSgnLi9mbGFzaC1pbnRlcmZhY2UnKTtcblxudmFyIERlZmVycmVkID0gcmVxdWlyZSgnLi4vbGliL2FzeW5jL2RlZmVycmVkJyk7XG5cbnZhciBBdWRpb0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvYXVkaW8tZXJyb3InKTtcbnZhciBMb2FkZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xpYi9uZXQvZXJyb3IvbG9hZGVyLWVycm9yJyk7XG5cbi8qKlxuICogQGNsYXNzINCX0LDQs9GA0YPQt9C60LAgZmxhc2gt0L/Qu9C10LXRgNCwINC4INC+0LHRgNCw0LHQvtGC0LrQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3ZlcmxheSAtINC+0LHRitC10LrRgiDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDQuCDQv9C+0LrQsNC30LAgZmxhc2gt0L/Qu9C10LXRgNCwXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaE1hbmFnZXIgPSBmdW5jdGlvbihvdmVybGF5KSB7IC8vIHNpbmdsZXRvbiFcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjb25zdHJ1Y3RvclwiLCBvdmVybGF5KTtcblxuICAgIHRoaXMuc3RhdGUgPSBcImluaXRcIjtcbiAgICB0aGlzLm92ZXJsYXkgPSBvdmVybGF5O1xuICAgIHRoaXMuZW1taXRlcnMgPSBbXTtcblxuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAvKipcbiAgICAgKiDQntCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDRgNCw0LfRgNC10YjQsNC10YLRgdGPINC/0YDQuCDQt9Cw0LLQtdGA0YjQtdC90LjQuCDQuNC90LjRhtC40LDQu9C40LfQsNGG0LjQuFxuICAgICAqIEB0eXBlIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMud2hlblJlYWR5ID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlKCk7XG5cbiAgICB2YXIgY2FsbGJhY2tQYXRoID0gY29uZmlnLmZsYXNoLmNhbGxiYWNrLnNwbGl0KFwiLlwiKTtcbiAgICB2YXIgY2FsbGJhY2tOYW1lID0gY2FsbGJhY2tQYXRoLnBvcCgpO1xuICAgIHZhciBjYWxsYmFja0NvbnQgPSB3aW5kb3c7XG4gICAgY2FsbGJhY2tQYXRoLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrQ29udFtwYXJ0XSkge1xuICAgICAgICAgICAgY2FsbGJhY2tDb250W3BhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2tDb250ID0gY2FsbGJhY2tDb250W3BhcnRdO1xuICAgIH0pO1xuICAgIGNhbGxiYWNrQ29udFtjYWxsYmFja05hbWVdID0gdGhpcy5fb25FdmVudC5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5fX2xvYWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aGlzLl9vbkxvYWRUaW1lb3V0LCBjb25maWcuZmxhc2gubG9hZFRpbWVvdXQpO1xuICAgIGZsYXNoTG9hZGVyKGNvbmZpZy5mbGFzaC5wYXRoICsgXCIvXCJcbiAgICAgICAgKyBjb25maWcuZmxhc2gubmFtZSwgY29uZmlnLmZsYXNoLnZlcnNpb24sIGNvbmZpZy5mbGFzaC5wbGF5ZXJJRCwgdGhpcy5fb25Mb2FkLmJpbmQodGhpcyksIHt9LCBvdmVybGF5KTtcblxuICAgIGlmIChvdmVybGF5KSB7XG4gICAgICAgIHZhciB0aW1lb3V0O1xuICAgICAgICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oKSB7IC8vS05PV0xFREdFOiBvbmx5IG1vdXNlZG93biBldmVudCBhbmQgb25seSB3bW9kZTogdHJhbnNwYXJlbnRcbiAgICAgICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0IHx8IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihBdWRpb0Vycm9yLkZMQVNIX05PVF9SRVNQT05ESU5HKSk7XG4gICAgICAgICAgICAgICAgfSwgY29uZmlnLmZsYXNoLmNsaWNrVGltZW91dCk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMud2hlblJlYWR5LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHRpbWVvdXQgPSB0aW1lb3V0ICYmIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgbG9nZ2VyLmluZm8odGhpcywgXCJyZWFkeVwiLCByZXN1bHQpO1xuICAgIH0uYmluZCh0aGlzKSwgZnVuY3Rpb24oZSkge1xuICAgICAgICBmbGFzaE1hbmFnZXIgPSBudWxsOyAvLyDQtdGB0LvQuCDQvtCx0LvQvtC80LDQu9C40YHRjCDRg9C00LDQu9GP0LXQvCDRjdC60LfQtdC80L/Qu9GP0YAg0LzQtdC90LXQtNC20LXRgNCwLCDRh9GC0L7QsdGLINC80L7QttC90L4g0LHRi9C70L4g0LHRi9C70L4g0L/Ri9GC0LDRgtGM0YHRjyDRgdC90L7QstCwXG4gICAgICAgIGxvZ2dlci5lcnJvcih0aGlzLCBcImZhaWxlZFwiLCBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuRmxhc2hNYW5hZ2VyLkVWRU5UX0lOSVQgPSBcImluaXRcIjtcbkZsYXNoTWFuYWdlci5FVkVOVF9GQUlMID0gXCJmYWlsZWRcIjtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRjyDQt9Cw0LPRgNGD0LfQutC4INC/0LvQtdC10YDQsFxuICogQHBhcmFtIGRhdGFcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfb25Mb2FkXCIsIGRhdGEpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX19sb2FkVGltZW91dCk7XG4gICAgZGVsZXRlIHRoaXMuX19sb2FkVGltZW91dDtcblxuICAgIGlmIChkYXRhLnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFzaCA9IG5ldyBGbGFzaEludGVyZmFjZShkYXRhLnJlZik7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFwicmVhZHlcIikge1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKGRhdGEucmVmKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vdmVybGF5KSB7XG4gICAgICAgICAgICB0aGlzLl9faW5pdFRpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuX29uSW5pdFRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZsYXNoLmluaXRUaW1lb3V0KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBcImZhaWxlZFwiO1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgQXVkaW9FcnJvcihkYXRhLl9fZmJuID8gQXVkaW9FcnJvci5GTEFTSF9CTE9DS0VSIDogQXVkaW9FcnJvci5GTEFTSF9VTktOT1dOX0NSQVNIKSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC30LDQs9GA0YPQt9C60LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uTG9hZFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXRlID0gXCJmYWlsZWRcIjtcbiAgICB0aGlzLmRlZmVycmVkLnJlamVjdChuZXcgTG9hZGVyRXJyb3IoTG9hZGVyRXJyb3IuVElNRU9VVCkpO1xufTtcblxuLyoqXG4gKiDQntCx0YDQsNCx0L7RgtGH0LjQuiDRgtCw0LnQvNCw0YPRgtCwINC40L3QuNGG0LjQsNC70LjQt9Cw0YbQuNC4XG4gKiBAcHJpdmF0ZVxuICovXG5GbGFzaE1hbmFnZXIucHJvdG90eXBlLl9vbkluaXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFwiZmFpbGVkXCI7XG4gICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTklUX1RJTUVPVVQpKTtcbn07XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLRh9C40Log0YPRgdC/0LXRiNC90L7RgdGC0Lgg0LjQvdC40YbQuNCw0LvQuNC30LDRhtC40LhcbiAqIEBwcml2YXRlXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuX29uSW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIl9vbkluaXRcIik7XG5cbiAgICB0aGlzLnN0YXRlID0gXCJyZWFkeVwiO1xuXG4gICAgaWYgKHRoaXMuX19pbml0VGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fX2luaXRUaW1lb3V0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19pbml0VGltZW91dDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mbGFzaCkge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnJlc29sdmUodGhpcy5mbGFzaCk7XG4gICAgICAgIHRoaXMuX19oZWFydGJlYXQgPSBzZXRJbnRlcnZhbCh0aGlzLl9vbkhlYXJ0QmVhdC5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICB9XG59O1xuXG4vKipcbiAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5LCDRgdC+0LfQtNCw0LLQsNC10LzRi9GFIGZsYXNoLdC/0LvQtdC10YDQvtC8XG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7aW50fSBpZCAtIGlkINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQstC80LXRgdGC0LUg0YEg0YHQvtCx0YvRgtC40LXQvFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25FdmVudCA9IGZ1bmN0aW9uKGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKSB7XG4gICAgaWYgKGV2ZW50ID09PSBcImRlYnVnXCIpIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZyhcImZsYXNoREVCVUdcIiwgaWQsIG9mZnNldCwgZGF0YSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFwiZmFpbGVkXCIpIHtcbiAgICAgICAgbG9nZ2VyLndhcm4odGhpcywgXCJvbkV2ZW50RmFpbGVkXCIsIGV2ZW50LCBpZCwgb2Zmc2V0LCBkYXRhKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcIm9uRXZlbnRcIiwgZXZlbnQsIGlkLCBvZmZzZXQpO1xuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfSU5JVCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25Jbml0KCk7XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50ID09PSBGbGFzaE1hbmFnZXIuRVZFTlRfRkFJTCkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcImZhaWxlZFwiLCBBdWRpb0Vycm9yLkZMQVNIX0lOVEVSTkFMX0VSUk9SKTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEF1ZGlvRXJyb3IoQXVkaW9FcnJvci5GTEFTSF9JTlRFUk5BTF9FUlJPUikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlkID09IC0xKSB7XG4gICAgICAgIHRoaXMuZW1taXRlcnMuZm9yRWFjaChmdW5jdGlvbihlbW1pdGVyKSB7XG4gICAgICAgICAgICBlbW1pdGVyLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5lbW1pdGVyc1tpZF0pIHtcbiAgICAgICAgdGhpcy5lbW1pdGVyc1tpZF0udHJpZ2dlcihldmVudCwgb2Zmc2V0LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgQXVkaW9FcnJvci5GTEFTSF9FTU1JVEVSX05PVF9GT1VORCwgaWQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LrQsCDQtNC+0YHRgtGD0L/QvdC+0YHRgtC4IGZsYXNoLdC/0LvQtdC10YDQsFxuICogQHByaXZhdGVcbiAqL1xuRmxhc2hNYW5hZ2VyLnByb3RvdHlwZS5fb25IZWFydEJlYXQgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgICB0aGlzLmZsYXNoLl9oZWFydEJlYXQoKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKHRoaXMsIFwiY3Jhc2hlZFwiLCBlKTtcbiAgICAgICAgdGhpcy5fb25FdmVudChBdWRpb1N0YXRpYy5FVkVOVF9DUkFTSEVELCAtMSwgZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQodC+0LfQtNCw0L3QuNC1INC90L7QstC+0LPQviDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7QXVkaW9GbGFzaH0gYXVkaW9GbGFzaCAtIGZsYXNoINCw0YPQtNC40L4t0L/Qu9C10LXRgCwg0LrQvtGC0L7RgNGL0Lkg0LHRg9C00LXRgiDQvtCx0YHQu9GD0LbQuNCy0LDRgtGMINGB0L7Qt9C00LDQvdC90YvQuSDQv9C70LXQtdGAXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0YDQsNC30YDQtdGI0LDQtdGC0YHRjyDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPINGB0L7Qt9C00LDQvdC40Y8g0L/Qu9C10LXRgNCwXG4gKi9cbkZsYXNoTWFuYWdlci5wcm90b3R5cGUuY3JlYXRlUGxheWVyID0gZnVuY3Rpb24oYXVkaW9GbGFzaCkge1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNyZWF0ZVBsYXllclwiKTtcblxuICAgIHZhciBwcm9taXNlID0gdGhpcy53aGVuUmVhZHkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgYXVkaW9GbGFzaC5pZCA9IHRoaXMuZmxhc2guX2FkZFBsYXllcigpO1xuICAgICAgICB0aGlzLmVtbWl0ZXJzW2F1ZGlvRmxhc2guaWRdID0gYXVkaW9GbGFzaDtcbiAgICAgICAgcmV0dXJuIGF1ZGlvRmxhc2guaWQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHByb21pc2UudGhlbihmdW5jdGlvbihwbGF5ZXJJZCkge1xuICAgICAgICBsb2dnZXIuZGVidWcodGhpcywgXCJjcmVhdGVQbGF5ZXJTdWNjZXNzXCIsIHBsYXllcklkKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IodGhpcywgXCJjcmVhdGVQbGF5ZXJFcnJvclwiLCBlcnIpO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hNYW5hZ2VyO1xuIiwiLyoqXG4gKiBAaWdub3JlXG4gKiBAZmlsZVxuICogVGhpcyBpcyBhIHdyYXBwZXIgZm9yIHN3Zm9iamVjdCB0aGF0IGRldGVjdHMgRmxhc2hCbG9jayBpbiBicm93c2VyLlxuICpcbiAqIFdyYXBwZXIgZGV0ZWN0czpcbiAqICAgLSBDaHJvbWVcbiAqICAgICAtIEZsYXNoQmxvY2sgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICogICAgIC0gRmxhc2hCbG9jayAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gKiAgICAgLSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICogICAtIEZpcmVmb3ggRmxhc2hibG9jayAoaHR0cHM6Ly9hZGRvbnMubW96aWxsYS5vcmcvcnUvZmlyZWZveC9hZGRvbi9mbGFzaGJsb2NrLylcbiAqICAgLSBPcGVyYSA+PSAxMS41IFwiRW5hYmxlIHBsdWdpbnMgb24gZGVtYW5kXCIgc2V0dGluZ1xuICogICAtIFNhZmFyaSBDbGlja1RvRmxhc2ggRXh0ZW5zaW9uIChodHRwOi8vaG95b2lzLmdpdGh1Yi5jb20vc2FmYXJpZXh0ZW5zaW9ucy9jbGlja3RvcGx1Z2luLylcbiAqICAgLSBTYWZhcmkgQ2xpY2tUb0ZsYXNoIFBsdWdpbiAoZm9yIFNhZmFyaSA8IDUuMC42KSAoaHR0cDovL3JlbnR6c2NoLmdpdGh1Yi5jb20vY2xpY2t0b2ZsYXNoLylcbiAqXG4gKiBUZXN0ZWQgb246XG4gKiAgIC0gQ2hyb21lIDEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IExleDEgMS4yLjExLjEyXG4gKiAgICAgLSBGbGFzaEJsb2NrIGJ5IGpvc29yZWsgMC45LjMxXG4gKiAgICAgLSBGbGFzaEZyZWUgMS4xLjNcbiAqICAgLSBGaXJlZm94IDUuMC4xICsgRmxhc2hibG9jayAxLjUuMTUuMVxuICogICAtIE9wZXJhIDExLjVcbiAqICAgLSBTYWZhcmkgNS4xICsgQ2xpY2tUb0ZsYXNoICgyLjMuMilcbiAqXG4gKiBBbHNvIHRoaXMgd3JhcHBlciBjYW4gcmVtb3ZlIGJsb2NrZWQgc3dmIGFuZCBsZXQgeW91IGRvd25ncmFkZSB0byBvdGhlciBvcHRpb25zLlxuICpcbiAqIEZlZWwgZnJlZSB0byBjb250YWN0IG1lIHZpYSBlbWFpbC5cbiAqXG4gKiBDb3B5cmlnaHQgMjAxMSwgQWxleGV5IEFuZHJvc292XG4gKiBEdWFsIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgKGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwKSBvciBHUEwgVmVyc2lvbiAzIChodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvZ3BsLmh0bWwpIGxpY2Vuc2VzLlxuICpcbiAqIFRoYW5rcyB0byBmbGFzaGJsb2NrZGV0ZWN0b3IgcHJvamVjdCAoaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2ZsYXNoYmxvY2tkZXRlY3RvcilcbiAqXG4gKiBAcmVxdWlyZXMgc3dmb2JqZWN0XG4gKiBAYXV0aG9yIEFsZXhleSBBbmRyb3NvdiA8ZG9vY2hpa0B5YS5ydT5cbiAqIEB2ZXJzaW9uIDEuMFxuICovXG5cbnZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcblxuZnVuY3Rpb24gcmVtb3ZlKG5vZGUpIHtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG59XG5cbi8qKlxuICog0JzQvtC00YPQu9GMINC30LDQs9GA0YPQt9C60Lgg0YTQu9C10Ygt0L/Qu9C10LXRgNCwINGBINCy0L7Qt9C80L7QttC90L7RgdGC0YzRjiDQvtGC0YHQu9C10LbQuNCy0LDQvdC40Y8g0LHQu9C+0LrQuNGA0L7QstGJ0LjQutC+0LJcbiAqIEBuYW1lc3BhY2VcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmYm4tc3dmLXdyYXBwZXJcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICBfX1NXRl9XUkFQUEVSX0NMQVNTOiAnZmJuLXN3Zi13cmFwcGVyJyxcblxuICAgIC8qKlxuICAgICAqIFRpbWVvdXQgZm9yIGZsYXNoIGJsb2NrIGRldGVjdFxuICAgICAqIEBkZWZhdWx0IDUwMFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICBfX1RJTUVPVVQ6IDUwMCxcblxuICAgIF9fVEVTVFM6IFtcbiAgICAgICAgLy8gQ2hvbWUgRmxhc2hCbG9jayBleHRlbnNpb24gKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2NkbmdpYWRtbmtoZ2Vta2lta2hpaWxnZmZiamlqY2llKVxuICAgICAgICAvLyBDaG9tZSBGbGFzaEJsb2NrIGV4dGVuc2lvbiAoaHR0cHM6Ly9jaHJvbWUuZ29vZ2xlLmNvbS93ZWJzdG9yZS9kZXRhaWwvZ29maGpram1rcGluaHBvaWFianBsb2JjYWlnbmFibmwpXG4gICAgICAgIGZ1bmN0aW9uKHN3Zk5vZGUsIHdyYXBwZXJOb2RlKSB7XG4gICAgICAgICAgICAvLyB3ZSBleHBlY3QgdGhhdCBzd2YgaXMgdGhlIG9ubHkgY2hpbGQgb2Ygd3JhcHBlclxuICAgICAgICAgICAgcmV0dXJuIHdyYXBwZXJOb2RlLmNoaWxkTm9kZXMubGVuZ3RoID4gMVxuICAgICAgICB9LCAvLyBvbGRlciBTYWZhcmkgQ2xpY2tUb0ZsYXNoIChodHRwOi8vcmVudHpzY2guZ2l0aHViLmNvbS9jbGlja3RvZmxhc2gvKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBJRSBoYXMgbm8gc3dmTm9kZS50eXBlXG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS50eXBlICYmIHN3Zk5vZGUudHlwZSAhPSAnYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2gnXG4gICAgICAgIH0sIC8vIEZsYXNoQmxvY2sgZm9yIEZpcmVmb3ggKGh0dHBzOi8vYWRkb25zLm1vemlsbGEub3JnL3J1L2ZpcmVmb3gvYWRkb24vZmxhc2hibG9jay8pXG4gICAgICAgIC8vIENocm9tZSBGbGFzaEZyZWUgKGh0dHBzOi8vY2hyb21lLmdvb2dsZS5jb20vd2Vic3RvcmUvZGV0YWlsL2VibWllY2tsbG1taWZqamJpcG5wcGlucGlvaHBmYWhtKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICAvLyBzd2YgaGF2ZSBiZWVuIGRldGFjaGVkIGZyb20gRE9NXG4gICAgICAgICAgICByZXR1cm4gIXN3Zk5vZGUucGFyZW50Tm9kZTtcbiAgICAgICAgfSwgLy8gU2FmYXJpIENsaWNrVG9GbGFzaCBFeHRlbnNpb24gKGh0dHA6Ly9ob3lvaXMuZ2l0aHViLmNvbS9zYWZhcmlleHRlbnNpb25zL2NsaWNrdG9wbHVnaW4vKVxuICAgICAgICBmdW5jdGlvbihzd2ZOb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gc3dmTm9kZS5wYXJlbnROb2RlLmNsYXNzTmFtZS5pbmRleE9mKCdDVEZub2Rpc3BsYXknKSA+IC0xO1xuICAgICAgICB9XG4gICAgXSxcblxuICAgIC8qKlxuICAgICAqIEVtYmVkIFNXRiBpbmZvIHBhZ2UuIFRoaXMgZnVuY3Rpb24gaGFzIHNhbWUgb3B0aW9ucyBhcyBzd2ZvYmplY3QuZW1iZWRTV0YgZXhjZXB0IGxhc3QgcGFyYW0gcmVtb3ZlQmxvY2tlZFNXRi5cbiAgICAgKiBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgKiBAcGFyYW0gc3dmVXJsU3RyXG4gICAgICogQHBhcmFtIHJlcGxhY2VFbGVtSWRTdHJcbiAgICAgKiBAcGFyYW0gd2lkdGhTdHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0U3RyXG4gICAgICogQHBhcmFtIHN3ZlZlcnNpb25TdHJcbiAgICAgKiBAcGFyYW0geGlTd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gZmxhc2h2YXJzT2JqXG4gICAgICogQHBhcmFtIHBhck9ialxuICAgICAqIEBwYXJhbSBhdHRPYmpcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tGblxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbW92ZUJsb2NrZWRTV0Y9dHJ1ZV0gUmVtb3ZlIHN3ZiBpZiBibG9ja2VkXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4sIHJlbW92ZUJsb2NrZWRTV0YpIHtcbiAgICAgICAgLy8gdmFyIHN3Zm9iamVjdCA9IHdpbmRvd1snc3dmb2JqZWN0J107XG5cbiAgICAgICAgaWYgKCFzd2ZvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3Zm9iamVjdC5hZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyZXBsYWNlRWxlbUlkU3RyKTtcbiAgICAgICAgICAgIGlmICghcmVwbGFjZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gY3JlYXRlIGRpdi13cmFwcGVyIGJlY2F1c2Ugc29tZSBmbGFzaCBibG9jayBwbHVnaW5zIHJlcGxhY2Ugc3dmIHdpdGggYW5vdGhlciBjb250ZW50LlxuICAgICAgICAgICAgLy8gQWxzbyBzb21lIGZsYXNoIHJlcXVpcmVzIHdyYXBwZXIgdG8gd29yayBwcm9wZXJseS5cbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN3ZkVsZW1lbnQgPSBlWydyZWYnXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmEgMTEuNSBhbmQgYWJvdmUgcmVwbGFjZXMgZmxhc2ggd2l0aCBTVkcgYnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIC8vIG1zaWUgKGFuZCBjYW5hcnkgY2hyb21lIDMyLjApIGNyYXNoZXMgb24gc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSgpXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBsYWNlZEJ5U1ZHID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBsYWNlZEJ5U1ZHID0gc3dmRWxlbWVudCAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddICYmIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZWRCeVNWRykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NldCB0aW1lb3V0IHRvIGxldCBGbGFzaEJsb2NrIHBsdWdpbiBkZXRlY3Qgc3dmIGFuZCByZXBsYWNlIGl0IHNvbWUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBURVNUUyA9IEZsYXNoQmxvY2tOb3RpZmllci5fX1RFU1RTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqID0gVEVTVFMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChURVNUU1tpXShzd2ZFbGVtZW50LCB3cmFwcGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GYWlsdXJlKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBGbGFzaEJsb2NrTm90aWZpZXIuX19USU1FT1VUKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG9uRmFpbHVyZShlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdmVCbG9ja2VkU1dGICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgc3dmXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2ZvYmplY3QucmVtb3ZlU1dGKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZW1vdmUgd3JhcHBlclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHdyYXBwZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JlbW92ZSBleHRlbnNpb24gYXJ0ZWZhY3RzXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2xpY2tUb0ZsYXNoIGFydGVmYWN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN0ZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdDVEZzdGFjaycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN0Zikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0Nocm9tZSBGbGFzaEJsb2NrIGFydGVmYWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdEJvZHlDaGlsZCA9IGRvY3VtZW50LmJvZHkubGFzdENoaWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RCb2R5Q2hpbGQgJiYgbGFzdEJvZHlDaGlsZC5jbGFzc05hbWUgPT0gJ3Vqc19mbGFzaGJsb2NrX3BsYWNlaG9sZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShsYXN0Qm9keUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlLnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZS5fX2ZibiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuIiwidmFyIHN3Zm9iamVjdCA9IHJlcXVpcmUoJy4uL2xpYi9icm93c2VyL3N3Zm9iamVjdCcpO1xuXG4vKipcbiAqINCc0L7QtNGD0LvRjCDQt9Cw0LPRgNGD0LfQutC4INGE0LvQtdGILdC/0LvQtdC10YDQsFxuICogQG5hbWVzcGFjZVxuICogQHByaXZhdGVcbiAqL1xudmFyIEZsYXNoRW1iZWRkZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBDU1MtY2xhc3MgZm9yIHN3ZiB3cmFwcGVyLlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAZGVmYXVsdCBmZW1iLXN3Zi13cmFwcGVyXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgX19TV0ZfV1JBUFBFUl9DTEFTUzogJ2ZlbWItc3dmLXdyYXBwZXInLFxuXG4gICAgLyoqXG4gICAgICogVGltZW91dCBmb3IgZmxhc2ggYmxvY2sgZGV0ZWN0XG4gICAgICogQGRlZmF1bHQgNTAwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIF9fVElNRU9VVDogNTAwLFxuXG4gICAgLyoqXG4gICAgICogRW1iZWQgU1dGIGluZm8gcGFnZS4gVGhpcyBmdW5jdGlvbiBoYXMgc2FtZSBvcHRpb25zIGFzIHN3Zm9iamVjdC5lbWJlZFNXRlxuICAgICAqIEBzZWUgaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3N3Zm9iamVjdC93aWtpL2FwaVxuICAgICAqIEBwYXJhbSBzd2ZVcmxTdHJcbiAgICAgKiBAcGFyYW0gcmVwbGFjZUVsZW1JZFN0clxuICAgICAqIEBwYXJhbSB3aWR0aFN0clxuICAgICAqIEBwYXJhbSBoZWlnaHRTdHJcbiAgICAgKiBAcGFyYW0gc3dmVmVyc2lvblN0clxuICAgICAqIEBwYXJhbSB4aVN3ZlVybFN0clxuICAgICAqIEBwYXJhbSBmbGFzaHZhcnNPYmpcbiAgICAgKiBAcGFyYW0gcGFyT2JqXG4gICAgICogQHBhcmFtIGF0dE9ialxuICAgICAqIEBwYXJhbSBjYWxsYmFja0ZuXG4gICAgICovXG4gICAgZW1iZWRTV0Y6IGZ1bmN0aW9uKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgcGFyT2JqLCBhdHRPYmosIGNhbGxiYWNrRm4pIHtcbiAgICAgICAgc3dmb2JqZWN0LmFkZERvbUxvYWRFdmVudChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXBsYWNlRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuICAgICAgICAgICAgaWYgKCFyZXBsYWNlRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBjcmVhdGUgZGl2LXdyYXBwZXIgYmVjYXVzZSBzb21lIGZsYXNoIGJsb2NrIHBsdWdpbnMgcmVwbGFjZSBzd2Ygd2l0aCBhbm90aGVyIGNvbnRlbnQuXG4gICAgICAgICAgICAvLyBBbHNvIHNvbWUgZmxhc2ggcmVxdWlyZXMgd3JhcHBlciB0byB3b3JrIHByb3Blcmx5LlxuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gRmxhc2hFbWJlZGRlci5fX1NXRl9XUkFQUEVSX0NMQVNTO1xuXG4gICAgICAgICAgICByZXBsYWNlRWxlbWVudC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh3cmFwcGVyLCByZXBsYWNlRWxlbWVudCk7XG4gICAgICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKHJlcGxhY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgc3dmb2JqZWN0LmVtYmVkU1dGKHN3ZlVybFN0ciwgcmVwbGFjZUVsZW1JZFN0ciwgd2lkdGhTdHIsIGhlaWdodFN0ciwgc3dmVmVyc2lvblN0ciwgeGlTd2ZVcmxTdHIsIGZsYXNodmFyc09iaiwgcGFyT2JqLCBhdHRPYmosIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlLnN1Y2Nlc3MgPT09IGZhbHNlIG1lYW5zIHRoYXQgYnJvd3NlciBkb24ndCBoYXZlIGZsYXNoIG9yIGZsYXNoIGlzIHRvbyBvbGRcbiAgICAgICAgICAgICAgICAvLyBAc2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9hcGlcbiAgICAgICAgICAgICAgICBpZiAoIWUgfHwgZS5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzd2ZFbGVtZW50ID0gZVsncmVmJ107XG4gICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhIDExLjUgYW5kIGFib3ZlIHJlcGxhY2VzIGZsYXNoIHdpdGggU1ZHIGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAvLyBtc2llIChhbmQgY2FuYXJ5IGNocm9tZSAzMi4wKSBjcmFzaGVzIG9uIHN3ZkVsZW1lbnRbJ2dldFNWR0RvY3VtZW50J10oKVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVwbGFjZWRCeVNWRyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZWRCeVNWRyA9IHN3ZkVsZW1lbnQgJiYgc3dmRWxlbWVudFsnZ2V0U1ZHRG9jdW1lbnQnXSAmJiBzd2ZFbGVtZW50WydnZXRTVkdEb2N1bWVudCddKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcGxhY2VkQnlTVkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRmFpbHVyZShlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9zZXQgdGltZW91dCB0byBsZXQgRmxhc2hCbG9jayBwbHVnaW4gZGV0ZWN0IHN3ZiBhbmQgcmVwbGFjZSBpdCBzb21lIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgRmxhc2hFbWJlZGRlci5fX1RJTUVPVVQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gb25GYWlsdXJlKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5zdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrRm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxhc2hFbWJlZGRlcjtcbiIsInZhciBzd2ZvYmplY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9zd2ZvYmplY3QnKTtcbnZhciBGbGFzaEJsb2NrTm90aWZpZXIgPSByZXF1aXJlKCcuL2ZsYXNoYmxvY2tub3RpZmllcicpO1xudmFyIEZsYXNoRW1iZWRkZXIgPSByZXF1aXJlKCcuL2ZsYXNoZW1iZWRkZXInKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcblxudmFyIHdpblNhZmFyaSA9IGRldGVjdC5wbGF0Zm9ybS5vcyA9PT0gJ3dpbmRvd3MnICYmIGRldGVjdC5icm93c2VyLm5hbWUgPT09ICdzYWZhcmknO1xuXG52YXIgQ09OVEFJTkVSX0NMQVNTID0gXCJ5YS1mbGFzaC1wbGF5ZXItd3JhcHBlclwiO1xuXG4vKipcbiAqINCX0LDQs9GA0YPQt9GH0LjQuiDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqXG4gKiBAYWxpYXMgRmxhc2hNYW5hZ2VyfmZsYXNoTG9hZGVyXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCAtINCh0YHRi9C70LrQsCDQvdCwINC/0LvQtdC10YDQsFxuICogQHBhcmFtIHtzdHJpbmd9IG1pblZlcnNpb24gLSDQvNC40L3QuNC80LDQu9GM0L3QsNGPINCy0LXRgNGB0LjRjyDQv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gaWQgLSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgCDQvdC+0LLQvtCz0L4g0L/Qu9C10LXRgNCwXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBsb2FkQ2FsbGJhY2sgLSDQutC+0LvQsdC10Log0LTQu9GPINGB0L7QsdGL0YLQuNGPINC30LDQs9GA0YPQt9C60LhcbiAqIEBwYXJhbSB7b2JqZWN0fSBmbGFzaFZhcnMgLSDQtNCw0L3QvdGL0LUg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9C1INCy0L4g0YTQu9C10YhcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lciAtINC60L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0LLQuNC00LjQvNC+0LPQviDRhNC70LXRiC3Qv9C70LXQtdGA0LBcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWCAtINGA0LDQt9C80LXRgCDQv9C+INCz0L7RgNC40LfQvtC90YLQsNC70LhcbiAqIEBwYXJhbSB7c3RyaW5nfSBzaXplWSAtINGA0LDQt9C80LXRgCDQv9C+INCy0LXRgNGC0LjQutCw0LvQuFxuICpcbiAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gLS0g0JrQvtC90YLQtdC50L3QtdGAINGE0LvQtdGILdC/0LvQtdC10YDQsFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHVybCwgbWluVmVyc2lvbiwgaWQsIGxvYWRDYWxsYmFjaywgZmxhc2hWYXJzLCBjb250YWluZXIsIHNpemVYLCBzaXplWSkge1xuICAgIHZhciAkZmxhc2hQbGF5ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICRmbGFzaFBsYXllci5pZCA9IFwid3JhcHBlcl9cIiArIGlkO1xuICAgICRmbGFzaFBsYXllci5pbm5lckhUTUwgPSAnPGRpdiBpZD1cIicgKyBpZCArICdcIj48L2Rpdj4nO1xuXG4gICAgc2l6ZVggPSBzaXplWCB8fCBcIjEwMDBcIjtcbiAgICBzaXplWSA9IHNpemVZIHx8IFwiMTAwMFwiO1xuXG4gICAgdmFyIGVtYmVkZGVyLFxuICAgICAgICBmbGFzaFNpemVYLFxuICAgICAgICBmbGFzaFNpemVZLFxuICAgICAgICBvcHRpb25zO1xuXG4gICAgaWYgKGNvbnRhaW5lciAmJiAhd2luU2FmYXJpKSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hFbWJlZGRlcjtcbiAgICAgICAgZmxhc2hTaXplWCA9IHNpemVYOyBmbGFzaFNpemVZID0gc2l6ZVk7XG4gICAgICAgIG9wdGlvbnMgPSB7IGFsbG93c2NyaXB0YWNjZXNzOiBcImFsd2F5c1wiLCB3bW9kZTogXCJ0cmFuc3BhcmVudFwiIH07XG5cbiAgICAgICAgJGZsYXNoUGxheWVyLmNsYXNzTmFtZSA9IENPTlRBSU5FUl9DTEFTUztcbiAgICAgICAgJGZsYXNoUGxheWVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IHJlbGF0aXZlOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvdmVyZmxvdzogaGlkZGVuOyc7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCgkZmxhc2hQbGF5ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVtYmVkZGVyID0gRmxhc2hCbG9ja05vdGlmaWVyO1xuICAgICAgICBmbGFzaFNpemVYID0gZmxhc2hTaXplWSA9IFwiMVwiO1xuICAgICAgICBvcHRpb25zID0geyBhbGxvd3NjcmlwdGFjY2VzczogXCJhbHdheXNcIiB9O1xuXG4gICAgICAgICRmbGFzaFBsYXllci5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogLTFweDsgdG9wOiAtMXB4OyB3aWR0aDogMHB4OyBoZWlnaHQ6IDBweDsgb3ZlcmZsb3c6IGhpZGRlbjsnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCRmbGFzaFBsYXllcik7XG4gICAgfVxuXG4gICAgZW1iZWRkZXIuZW1iZWRTV0YoXG4gICAgICAgIHVybCxcbiAgICAgICAgaWQsXG4gICAgICAgIGZsYXNoU2l6ZVgsXG4gICAgICAgIGZsYXNoU2l6ZVksXG4gICAgICAgIG1pblZlcnNpb24sXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGZsYXNoVmFycyxcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAge30sXG4gICAgICAgIGxvYWRDYWxsYmFja1xuICAgICk7XG5cbiAgICByZXR1cm4gJGZsYXNoUGxheWVyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHsgLy8g0YHQvtGF0YDQsNC90Y/QtdGC0YHRjyDQsiBsb2NhbHN0b3JhZ2VcbiAgICAgICAgXCJpZFwiOiBcImN1c3RvbVwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZGVmYXVsdFwiLFxuICAgICAgICBcInByZWFtcFwiOiAwLFxuICAgICAgICBcImJhbmRzXCI6IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiQ2xhc3NpY2FsXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0wLjUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0zLjUsIC0zLjUsIC0zLjUsIC00LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJDbHViXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjM1OTk5OTg5NTA5NTgyNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgLTAuNSwgNCwgMi41LCAyLjUsIDIuNSwgMS41LCAtMC41LCAtMC41LCAtMC41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRGFuY2VcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuMTU5OTk5ODQ3NDEyMTA5NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNC41LCAzLjUsIDEsIC0wLjUsIC0wLjUsIC0yLjUsIC0zLjUsIC0zLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJGdWxsIEJhc3NcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgNC41LCA0LjUsIDIuNSwgMC41LCAtMiwgLTQsIC01LCAtNS41LCAtNS41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiRnVsbCBCYXNzICYgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAyLjUsIC0wLjUsIC0zLjUsIC0yLCAwLjUsIDQsIDUuNSwgNiwgNl1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkZ1bGwgVHJlYmxlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC02LFxuICAgICAgICBcImJhbmRzXCI6IFstNC41LCAtNC41LCAtNC41LCAtMiwgMSwgNS41LCA4LCA4LCA4LCA4XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiTGFwdG9wIFNwZWFrZXJzIC8gSGVhZHBob25lXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00LjA3OTk5OTkyMzcwNjA1NSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgNS41LCAyLjUsIC0xLjUsIC0xLCAwLjUsIDIsIDQuNSwgNiwgN11cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIkxhcmdlIEhhbGxcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuNTk5OTk5OTA0NjMyNTY4NCxcbiAgICAgICAgXCJiYW5kc1wiOiBbNSwgNSwgMi41LCAyLjUsIC0wLjUsIC0yLCAtMiwgLTIsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJMaXZlXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0yLjYzOTk5OTg2NjQ4NTU5NTcsXG4gICAgICAgIFwiYmFuZHNcIjogWy0yLCAtMC41LCAyLCAyLjUsIDIuNSwgMi41LCAyLCAxLCAxLCAxXVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUGFydHlcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMy41LCAzLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIC0wLjUsIDMuNSwgMy41XVxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiUG9wXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC0zLjExOTk5OTg4NTU1OTA4MixcbiAgICAgICAgXCJiYW5kc1wiOiBbLTAuNSwgMiwgMy41LCA0LCAyLjUsIC0wLjUsIC0xLCAtMSwgLTAuNSwgLTAuNV1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIlJlZ2dhZVwiLFxuICAgICAgICBcInByZWFtcFwiOiAtNC4wNzk5OTk5MjM3MDYwNTUsXG4gICAgICAgIFwiYmFuZHNcIjogWy0wLjUsIC0wLjUsIC0wLjUsIC0yLjUsIC0wLjUsIDMsIDMsIC0wLjUsIC0wLjUsIC0wLjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJSb2NrXCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC01LjAzOTk5OTk2MTg1MzAyNyxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMiwgLTIuNSwgLTQsIC0xLjUsIDIsIDQsIDUuNSwgNS41LCA1LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTa2FcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTUuNTE5OTk5OTgwOTI2NTE0LFxuICAgICAgICBcImJhbmRzXCI6IFstMSwgLTIsIC0yLCAtMC41LCAyLCAyLjUsIDQsIDQuNSwgNS41LCA0LjVdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0XCIsXG4gICAgICAgIFwicHJlYW1wXCI6IC00Ljc5OTk5OTcxMzg5NzcwNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMC41LCAtMC41LCAtMSwgLTAuNSwgMiwgNCwgNC41LCA1LjUsIDZdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJTb2Z0IFJvY2tcIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTIuNjM5OTk5ODY2NDg1NTk1NyxcbiAgICAgICAgXCJiYW5kc1wiOiBbMiwgMiwgMSwgLTAuNSwgLTIsIC0yLjUsIC0xLjUsIC0wLjUsIDEsIDRdXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJUZWNobm9cIixcbiAgICAgICAgXCJwcmVhbXBcIjogLTMuODM5OTk5OTE0MTY5MzExNSxcbiAgICAgICAgXCJiYW5kc1wiOiBbNCwgMi41LCAtMC41LCAtMi41LCAtMiwgLTAuNSwgNCwgNC41LCA0LjUsIDRdXG4gICAgfVxuXTtcbiIsInZhciBFdmVudHMgPSByZXF1aXJlKCcuLi8uLi9saWIvYXN5bmMvZXZlbnRzJyk7XG5cbi8qKlxuICog0J7Qv9C40YHQsNC90LjQtSDQvdCw0YHRgtGA0L7QtdC6INGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXRcbiAqXG4gKiBAcHJvcGVydHkge1N0cmluZ30gW2lkXSAtINC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAINC90LDRgdGC0YDQvtC10LpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBwcmVhbXAgLSDQv9GA0LXQtNGD0YHQuNC70LjRgtC10LvRjFxuICogQHByb3BlcnR5IHtBcnJheS48TnVtYmVyPn0gLSDQt9C90LDRh9C10L3QuNGPINC00LvRjyDQv9C+0LvQvtGBINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqL1xuXG4vKipcbiAqINCh0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQv9C+0LvQvtGB0Ysg0L/RgNC+0L/Rg9GB0LrQsNC90LjRjyAoe0BsaW5rIHlhLkF1ZGlvLmZ4LkVxdWFsaXplci5FVkVOVF9DSEFOR0V9KVxuICogQGV2ZW50IHlhLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBmcmVxIC0g0YfQsNGB0YLQvtGC0LAg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICovXG5cbi8qKlxuICog0K3QutCy0LDQu9Cw0LnQt9C10YBcbiAqIEBhbGlhcyB5YS5BdWRpby5meC5FcXVhbGl6ZXJcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IGJhbmRzIC0g0YHQv9C40YHQvtC6INGH0LDRgdGC0L7RgiDQtNC70Y8g0L/QvtC70L7RgSDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKlxuICogQGV4dGVuZHMgRXZlbnRzXG4gKlxuICogQGZpcmVzIHlhLkF1ZGlvLmZ4LkVxdWFsaXplciNjaGFuZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEVxdWFsaXplciA9IGZ1bmN0aW9uKGF1ZGlvQ29udGV4dCwgYmFuZHMpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucHJlYW1wID0gbmV3IEVxdWFsaXplckJhbmQoYXVkaW9Db250ZXh0LCBcImhpZ2hzaGVsZlwiLCAwKTtcbiAgICB0aGlzLnByZWFtcC5vbihcIipcIiwgdGhpcy5fb25CYW5kRXZlbnQuYmluZCh0aGlzLCB0aGlzLnByZWFtcCkpO1xuXG4gICAgdmFyIHByZXY7XG4gICAgdGhpcy5iYW5kcyA9IGJhbmRzLm1hcChmdW5jdGlvbihmcmVxdWVuY3ksIGlkeCkge1xuICAgICAgICB2YXIgYmFuZCA9IG5ldyBFcXVhbGl6ZXJCYW5kKFxuICAgICAgICAgICAgYXVkaW9Db250ZXh0LFxuXG4gICAgICAgICAgICBpZHggPT0gMCA/ICdsb3dzaGVsZidcbiAgICAgICAgICAgICAgICA6IGlkeCArIDEgPCBiYW5kcy5sZW5ndGggPyBcInBlYWtpbmdcIlxuICAgICAgICAgICAgICAgIDogXCJoaWdoc2hlbGZcIixcblxuICAgICAgICAgICAgZnJlcXVlbmN5XG4gICAgICAgICk7XG4gICAgICAgIGJhbmQub24oXCIqXCIsIHRoaXMuX29uQmFuZEV2ZW50LmJpbmQodGhpcywgYmFuZCkpO1xuXG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgICAgdGhpcy5wcmVhbXAuZmlsdGVyLmNvbm5lY3QoYmFuZC5maWx0ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJldi5maWx0ZXIuY29ubmVjdChiYW5kLmZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2ID0gYmFuZDtcbiAgICAgICAgcmV0dXJuIGJhbmQ7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnByZWFtcC5maWx0ZXI7XG4gICAgdGhpcy5vdXRwdXQgPSB0aGlzLmJhbmRzW3RoaXMuYmFuZHMubGVuZ3RoIC0gMV0uZmlsdGVyO1xufTtcblxuRXZlbnRzLm1peGluKEVxdWFsaXplcik7XG5cbi8qKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5FVkVOVF9DSEFOR0UgPSBcImNoYW5nZVwiO1xuXG4vKiogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICogQGNvbnN0XG4gKi9cbkVxdWFsaXplci5ERUZBVUxUX0JBTkRTID0gWzYwLCAxNzAsIDMxMCwgNjAwLCAxMDAwLCAzMDAwLCA2MDAwLCAxMjAwMCwgMTQwMDAsIDE2MDAwXTtcblxuLyoqIEB0eXBlIHtPYmplY3QuPFN0cmluZywgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplclByZXNldD59XG4gKiBAY29uc3RcbiAqL1xuRXF1YWxpemVyLkRFRkFVTFRfUFJFU0VUUyA9IHJlcXVpcmUoJy4vZGVmYXVsdC5wcmVzZXRzLmpzJyk7XG5cbi8qKlxuICog0J7QsdGA0LDQsdC+0YLQutCwINGB0L7QsdGL0YLQuNGPINC/0L7Qu9C+0YHRiyDRjdC60LLQsNC70LDQudC30LXRgNCwXG4gKiBAcGFyYW0ge0VxdWFsaXplckJhbmR9IGJhbmQgLSDQv9C+0LvQvtGB0LAg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0YHQvtCx0YvRgtC40LVcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSDRgdC+0LHRi9GC0LjRj1xuICogQHByaXZhdGVcbiAqL1xuRXF1YWxpemVyLnByb3RvdHlwZS5fb25CYW5kRXZlbnQgPSBmdW5jdGlvbihiYW5kLCBldmVudCwgZGF0YSkge1xuICAgIHRoaXMudHJpZ2dlcihldmVudCwgYmFuZC5nZXRGcmVxKCksIGRhdGEpO1xufTtcblxuLyoqXG4gKiDQl9Cw0LPRgNGD0LfQuNGC0Ywg0L3QsNGB0YLRgNC+0LnQutC4XG4gKiBAcGFyYW0ge3lhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9IHByZXNldCAtINC90LDRgdGC0YDQvtC50LrQuFxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmxvYWRQcmVzZXQgPSBmdW5jdGlvbihwcmVzZXQpIHtcbiAgICBwcmVzZXQuYmFuZHMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgaWR4KSB7XG4gICAgICAgIHRoaXMuYmFuZHNbaWR4XS5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnByZWFtcC5zZXRWYWx1ZShwcmVzZXQucHJlYW1wKTtcbn07XG5cbi8qKlxuICog0KHQvtGF0YDQsNC90LjRgtGMINGC0LXQutGD0YnQuNC1INC90LDRgdGC0YDQvtC50LrQuFxuICogQHJldHVybnMge3lhLkF1ZGlvLmZ4LkVxdWFsaXplcn5FcXVhbGl6ZXJQcmVzZXR9XG4gKi9cbkVxdWFsaXplci5wcm90b3R5cGUuc2F2ZVByZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByZWFtcDogdGhpcy5wcmVhbXAuZ2V0VmFsdWUoKSxcbiAgICAgICAgYmFuZHM6IHRoaXMuYmFuZHMubWFwKGZ1bmN0aW9uKGJhbmQpIHsgcmV0dXJuIGJhbmQuZ2V0VmFsdWUoKTsgfSlcbiAgICB9O1xufTtcblxuLy9UT0RPOiDQv9GA0L7QstC10YDQuNGC0Ywg0L/RgNC10LTQv9C+0LvQvtC20LXQvdC40LUgKNGB0LrQvtGA0LXQtSDQstGB0LXQs9C+INC90YPQttC90LAg0LrQsNGA0YLQsCDQstC10YHQvtCyINC00LvRjyDRgNCw0LfQu9C40YfQvdGL0YUg0YfQsNGB0YLQvtGCINC40LvQuCDQtNCw0LbQtSDQvdC10LrQsNGPINGE0YPQvdC60YbQuNGPKVxuLyoqXG4gKiAqKtCt0LrRgdC/0LXRgNC40LzQtdC90YLQsNC70YzQvdC+KiogLSDQstGL0YfQuNC70Y/QtdGCINC+0L/RgtC40LzQsNC70YzQvdC+0LUg0LfQvdCw0YfQvdC40LUg0L/RgNC10LTRg9GB0LjQu9C10L3QuNGPXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5FcXVhbGl6ZXIucHJvdG90eXBlLmd1ZXNzUHJlYW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHYgPSAwO1xuICAgIGZvciAodmFyIGsgPSAwLCBsID0gdGhpcy5iYW5kcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcbiAgICAgICAgdiArPSB0aGlzLmJhbmRzW2tdLmdldFZhbHVlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIC12IC8gMjtcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vICDQpNC40LvRjNGC0YAg0Y3QutCy0LDQu9Cw0LnQt9C10YDQsFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiDQodC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LfQvdCw0YfQtdC90LjRjyDRg9GB0LjQu9C10L3QuNGPICh7QGxpbmsgeWEuQXVkaW8uZnguRXF1YWxpemVyLkVWRU5UX0NIQU5HRX0pXG4gKiBAZXZlbnQgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmQjY2hhbmdlXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSDQvdC+0LLQvtC1INC30L3QsNGH0LXQvdC40LVcbiAqL1xuXG4vKipcbiAqINCf0L7Qu9C+0YHQsCDQv9GA0L7Qv9GD0YHQutCw0L3QuNGPINGN0LrQstCw0LvQsNC50LfQtdGA0LBcbiAqIEBhbGlhcyB5YS5BdWRpby5meC5FcXVhbGl6ZXJ+RXF1YWxpemVyQmFuZFxuICpcbiAqIEBleHRlbmRzIEV2ZW50c1xuICpcbiAqIEBwYXJhbSB7QXVkaW9Db250ZXh0fSBhdWRpb0NvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0g0YLQuNC/INGE0LjQu9GM0YLRgNCwXG4gKiBAcGFyYW0ge051bWJlcn0gZnJlcXVlbmN5IC0g0YfQsNGB0YLQvtGC0LAg0YTQuNC70YzRgtGA0LBcbiAqXG4gKiBAZmlyZXMgeWEuQXVkaW8uZnguRXF1YWxpemVyfkVxdWFsaXplckJhbmQjY2hhbmdlXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBFcXVhbGl6ZXJCYW5kID0gZnVuY3Rpb24oYXVkaW9Db250ZXh0LCB0eXBlLCBmcmVxdWVuY3kpIHtcbiAgICBFdmVudHMuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMudHlwZSA9IHR5cGU7XG5cbiAgICB0aGlzLmZpbHRlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICB0aGlzLmZpbHRlci50eXBlID0gdHlwZTtcbiAgICB0aGlzLmZpbHRlci5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3k7XG4gICAgdGhpcy5maWx0ZXIuUS52YWx1ZSA9IDE7XG4gICAgdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZSA9IDA7XG59O1xuRXZlbnRzLm1peGluKEVxdWFsaXplckJhbmQpO1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0YfQsNGB0YLQvtGC0YMg0L/QvtC70L7RgdGLINC/0YDQvtC/0YPRgdC60LDQvdC40Y9cbiAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gKi9cbkVxdWFsaXplckJhbmQucHJvdG90eXBlLmdldEZyZXEgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZnJlcXVlbmN5LnZhbHVlO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0YPRgdC40LvQtdC90LjRj1xuICogQHJldHVybnMge051bWJlcn1cbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2Fpbi52YWx1ZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDRg9GB0LjQu9C10L3QuNGPXG4gKiBAcGFyYW0gdmFsdWVcbiAqL1xuRXF1YWxpemVyQmFuZC5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHRoaXMuZmlsdGVyLmdhaW4udmFsdWUgPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoRXF1YWxpemVyLkVWRU5UX0NIQU5HRSwgdmFsdWUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhbGl6ZXI7XG4iLCJyZXF1aXJlKCcuLi9leHBvcnQnKTtcblxueWEuQXVkaW8uZnguRXF1YWxpemVyID0gcmVxdWlyZSgnLi9lcXVhbGl6ZXInKTtcbiIsInJlcXVpcmUoJy4uL2V4cG9ydCcpO1xuXG55YS5BdWRpby5meCA9IHt9O1xuIiwidmFyIExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlci9sb2dnZXInKTtcbnZhciBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdWRpb0hUTUw1Jyk7XG5cbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9saWIvYnJvd3Nlci9kZXRlY3QnKTtcbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi9saWIvYXN5bmMvZXZlbnRzJyk7XG52YXIgQXVkaW9TdGF0aWMgPSByZXF1aXJlKCcuLi9hdWRpby1zdGF0aWMnKTtcbnZhciBQbGF5YmFja0Vycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IvcGxheWJhY2stZXJyb3InKTtcblxudmFyIHBsYXllcklkID0gMTtcblxuZXhwb3J0cy5hdmFpbGFibGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCR0LDQt9C+0LLQsNGPINC/0YDQvtCy0LXRgNC60LAg0L/QvtC00LTQtdGA0LbQutC4INCx0YDQsNGD0LfQtdGA0L7QvFxuICAgIHZhciBodG1sNV9hdmFpbGFibGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIC8vc29tZSBicm93c2VycyBkb2Vzbid0IHVuZGVyc3RhbmQgbmV3IEF1ZGlvKClcbiAgICAgICAgdmFyIGF1ZGlvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICAgICAgdmFyIGNhblBsYXkgPSBhdWRpby5jYW5QbGF5VHlwZShcImF1ZGlvL21wZWdcIik7XG4gICAgICAgIGlmICghY2FuUGxheSB8fCBjYW5QbGF5ID09PSAnbm8nKSB7XG5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIHJlYXNvblwiLCBjYW5QbGF5KTtcbiAgICAgICAgICAgIGh0bWw1X2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwiSFRNTDUgZGV0ZWN0aW9uIGZhaWxlZCB3aXRoIGVycm9yXCIsIGUpO1xuICAgICAgICBodG1sNV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcImRldGVjdGlvblwiLCBodG1sNV9hdmFpbGFibGUpO1xuICAgIHJldHVybiBodG1sNV9hdmFpbGFibGU7XG59KSgpO1xuXG50cnkge1xuICAgIHZhciBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgbG9nZ2VyLmluZm8odGhpcywgXCJXZW5BdWRpb0FQSSBjb250ZXh0IGNyZWF0ZWRcIik7XG59IGNhdGNoKGUpIHtcbiAgICBhdWRpb0NvbnRleHQgPSBudWxsO1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwiV2VuQXVkaW9BUEkgbm90IGRldGVjdGVkXCIpO1xufVxuXG4vKipcbiAqIEBjbGFzcyDQmtC70LDRgdGBIGh0bWw1INCw0YPQtNC40L4t0L/Qu9C10LXRgNCwXG4gKiBAZXh0ZW5kcyBJQXVkaW9JbXBsZW1lbnRhdGlvblxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwbGF5XG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jZW5kZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiN2b2x1bWVjaGFuZ2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNjcmFzaGVkXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jc3dhcFxuICpcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNzdG9wXG4gKiBAZmlyZXMgSUF1ZGlvSW1wbGVtZW50YXRpb24jcGF1c2VcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNwcm9ncmVzc1xuICogQGZpcmVzIElBdWRpb0ltcGxlbWVudGF0aW9uI2xvYWRpbmdcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNsb2FkZWRcbiAqIEBmaXJlcyBJQXVkaW9JbXBsZW1lbnRhdGlvbiNlcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEF1ZGlvSFRNTDUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm5hbWUgPSBwbGF5ZXJJZCsrO1xuICAgIGxvZ2dlci5kZWJ1Zyh0aGlzLCBcImNvbnN0cnVjdG9yXCIpO1xuXG4gICAgRXZlbnRzLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vbihcIipcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSBBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUykge1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwib25FdmVudFwiLCBldmVudCk7XG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy53ZWJBdWRpb0FwaSA9IGZhbHNlO1xuXG4gICAgdGhpcy5hY3RpdmVMb2FkZXIgPSAwO1xuXG4gICAgdGhpcy5sb2FkZXJzID0gW107XG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcblxuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuICAgIHRoaXMuX2FkZExvYWRlcigpO1xuXG4gICAgdGhpcy5fc2V0QWN0aXZlKDApO1xufTtcbkV2ZW50cy5taXhpbihBdWRpb0hUTUw1KTtcbkF1ZGlvSFRNTDUudHlwZSA9IEF1ZGlvSFRNTDUucHJvdG90eXBlLnR5cGUgPSBcImh0bWw1XCI7XG5cbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQvdCw0YfQsNC70LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX1BMQVkgPSBcInBsYXlcIjtcbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQv9Cw0YPQt9GLXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX1BBVVNFID0gXCJwYXVzZVwiO1xuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC+0LHQvdC+0LLQu9C10L3QuNC1INC/0L7Qt9C40YbQuNC4INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1LkVWRU5UX05BVElWRV9USU1FVVBEQVRFID0gXCJ0aW1ldXBkYXRlXCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1LkVWRU5UX05BVElWRV9FTkRFRCA9IFwiZW5kZWRcIjtcbi8qKlxuICog0J3QsNGC0LjQstC90L7QtSDRgdC+0LHRi9GC0LjQtSDQuNC30LzQtdC90LXQvdC40Y8g0LTQu9C40YLQtdC70YzQvdC+0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0RVUkFUSU9OID0gXCJkdXJhdGlvbmNoYW5nZVwiO1xuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INC40LfQvNC10L3QtdC90LjRjyDQtNC70LjRgtC10LvRjNC90L7RgdGC0Lgg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0xPQURJTkcgPSBcInByb2dyZXNzXCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0LTQvtGB0YLRg9C/0L3QvtGB0YLQuCDQvNC10YLQsC3QtNCw0L3QvdGL0YUg0YLRgNC10LrQsFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1LkVWRU5UX05BVElWRV9NRVRBID0gXCJsb2FkZWRtZXRhZGF0YVwiO1xuLyoqXG4gKiDQndCw0YLQuNCy0L3QvtC1INGB0L7QsdGL0YLQuNC1INCy0L7Qt9C80L7QttC90L7RgdGC0Lgg0L3QsNGH0LDRgtGMINCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjQtVxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5BdWRpb0hUTUw1LkVWRU5UX05BVElWRV9DQU5QTEFZID0gXCJjYW5wbGF5XCI7XG4vKipcbiAqINCd0LDRgtC40LLQvdC+0LUg0YHQvtCx0YvRgtC40LUg0L7RiNC40LHQutC4XG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNvbnN0XG4gKi9cbkF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0VSUk9SID0gXCJlcnJvclwiO1xuXG4vKipcbiAqINCU0L7QsdCw0LLQuNGC0Ywg0LfQsNCz0YDRg9C30YfQuNC6INCw0YPQtNC40L4t0YTQsNC50LvQvtCyXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fYWRkTG9hZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX2FkZExvYWRlclwiKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBsb2FkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhdWRpbycpO1xuICAgIHZhciBsaXN0ZW5lciA9IG5ldyBFdmVudHMoKTtcblxuICAgIGxvYWRlci5sb29wID0gZmFsc2U7IC8vIGZvciBJRVxuICAgIGxvYWRlci5wcmVsb2FkID0gbG9hZGVyLmF1dG9idWZmZXIgPSBcImF1dG9cIjsgLy8gMTAwJVxuXG4gICAgbG9hZGVyLnN0YXJ0UGxheSA9IGZ1bmN0aW9uKCkgeyAvL0lORk86INGN0YLQsCDQutC+0L3RgdGC0YDRg9C60YbQuNGPINC90YPQttC90LAsINGH0YLQvtCx0Ysg0L3QtSDQvNC10L3Rj9GC0Ywg0LvQvtCz0LjQutGDINC/0YDQuCByZXN1bWVcbiAgICAgICAgbG9hZGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfTUVUQSwgbG9hZGVyLnN0YXJ0UGxheSk7XG4gICAgICAgIGxvYWRlci5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0NBTlBMQVksIGxvYWRlci5zdGFydFBsYXkpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2FkZXIucGxheSgpO1xuICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKHNlbGYsIFwic3RhcnRQbGF5XCIpO1xuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihzZWxmLCBcImNyYXNoZWRcIiwgZSk7XG4gICAgICAgICAgICBsaXN0ZW5lci50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0NSQVNIRUQsIGUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBsYXN0VXBkYXRlID0gMDtcbiAgICB2YXIgdXBkYXRlUHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRUaW1lID0gK25ldyBEYXRlKCk7XG4gICAgICAgIGlmIChjdXJyZW50VGltZSAtIGxhc3RVcGRhdGUgPCAzMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdFVwZGF0ZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICBsaXN0ZW5lci50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1BST0dSRVNTKTtcbiAgICB9O1xuXG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfUEFVU0UsIGxpc3RlbmVyLnRyaWdnZXIuYmluZChsaXN0ZW5lciwgQXVkaW9TdGF0aWMuRVZFTlRfUEFVU0UpKTtcbiAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9QTEFZLCBsaXN0ZW5lci50cmlnZ2VyLmJpbmQobGlzdGVuZXIsIEF1ZGlvU3RhdGljLkVWRU5UX1BMQVkpKTtcblxuICAgIGxvYWRlci5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0VOREVELCBmdW5jdGlvbigpIHtcbiAgICAgICAgbGlzdGVuZXIudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9QUk9HUkVTUyk7XG4gICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfRU5ERUQpO1xuICAgIH0pO1xuXG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfVElNRVVQREFURSwgdXBkYXRlUHJvZ3Jlc3MpO1xuICAgIGxvYWRlci5hZGRFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0RVUkFUSU9OLCB1cGRhdGVQcm9ncmVzcyk7XG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfTE9BRElORywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHVwZGF0ZVByb2dyZXNzKCk7XG5cbiAgICAgICAgaWYgKGxvYWRlci5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBsb2FkZWQgPSBsb2FkZXIuYnVmZmVyZWQuZW5kKDApIC0gbG9hZGVyLmJ1ZmZlcmVkLnN0YXJ0KDApO1xuXG4gICAgICAgICAgICBpZiAobG9hZGVyLm5vdExvYWRpbmcgJiYgbG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyLm5vdExvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0xPQURJTkcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobG9hZGVkID49IGxvYWRlZC5kdXJhdGlvbiAtIDAuMSkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfTE9BREVEKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfRVJST1IsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCFsb2FkZXIuZmFrZSkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IFBsYXliYWNrRXJyb3IobG9hZGVyLmVycm9yXG4gICAgICAgICAgICAgICAgICAgID8gUGxheWJhY2tFcnJvci5odG1sNVtsb2FkZXIuZXJyb3IuY29kZV1cbiAgICAgICAgICAgICAgICAgICAgOiBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBlLFxuICAgICAgICAgICAgICAgIGxvYWRlci5zcmMpO1xuXG4gICAgICAgICAgICBsaXN0ZW5lci50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX0VSUk9SLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGxpc3RlbmVyLm9uKFwiKlwiLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgICB2YXIgb2Zmc2V0ID0gKHNlbGYubG9hZGVycy5sZW5ndGggKyBsb2FkZXIuaW5kZXggLSBzZWxmLmFjdGl2ZUxvYWRlcikgJSBzZWxmLmxvYWRlcnMubGVuZ3RoO1xuICAgICAgICBzZWxmLnRyaWdnZXIoZXZlbnQsIG9mZnNldCwgZGF0YSk7XG4gICAgfSk7XG5cbiAgICBsb2FkZXIuaW5kZXggPSB0aGlzLmxvYWRlcnMucHVzaChsb2FkZXIpIC0gMTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpKSB7XG4gICAgICAgIHRoaXMuX2FkZFNvdXJjZShsb2FkZXIpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0YwgKNC10YHQu9C4INC90LXQvtCx0YXQvtC00LjQvNC+KSDQuCDQv9C+0LTQutC70Y7Rh9C40YLRjCDQuNGB0YLQvtGH0L3QuNC6INC30LLRg9C60LAg0LTQu9GPIFdlYiBBdWRpbyBBUElcbiAqIEBwYXJhbSB7QXVkaW99IGxvYWRlciAtINC30LDQs9GA0YPQt9GH0LjQuiDQsNGD0LTQuNC+XG4gKiBAcGFyYW0ge0F1ZGlvTm9kZX0gc291cmNlIC0g0Y3QutC30LXQvNC/0LvRj9GAINC40YHRgtC+0YfQvdC40LrQsCDQt9Cy0YPQutCwXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fYWRkU291cmNlID0gZnVuY3Rpb24obG9hZGVyLCBzb3VyY2UpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfYWRkU291cmNlXCIsIGxvYWRlcik7XG5cbiAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICBzb3VyY2UgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFFbGVtZW50U291cmNlKGxvYWRlcik7XG4gICAgICAgIHRoaXMuc291cmNlcy5wdXNoKHNvdXJjZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc291cmNlLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5wcmVwcm9jZXNzb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNvdXJjZS5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0LDQutGC0LjQstC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwYXJhbSB7aW50fSBvZmZzZXQgLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9zZXRBY3RpdmUgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICBsb2dnZXIuZGVidWcodGhpcywgXCJfc2V0QWN0aXZlXCIsIG9mZnNldCk7XG5cbiAgICB0aGlzLmFjdGl2ZUxvYWRlciA9ICh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoO1xuICAgIHRoaXMudHJpZ2dlcihBdWRpb1N0YXRpYy5FVkVOVF9TV0FQLCBvZmZzZXQpO1xuXG4gICAgaWYgKG9mZnNldCAhPT0gMCkge1xuICAgICAgICAvL0lORk86INC10YHQu9C4INGA0LXQu9C40LfQvtCy0YvQstCw0YLRjCDQutC+0L3RhtC10L/RhtC40Y4g0LzQvdC+0LbQtdGB0YLQstCwINC30LDQs9GA0YPQt9GH0LjQutC+0LIsINGC0L4g0Y3RgtC+INC90YPQttC90L4g0LTQvtGA0LDQsdC+0YLQsNGC0YwuXG4gICAgICAgIHRoaXMuc3RvcChvZmZzZXQpO1xuICAgIH1cbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQt9Cw0LPRgNGD0LfRh9C40Log0Lgg0L7RgtC/0LjRgdCw0YLRjCDQtdCz0L4g0L7RgiDRgdC+0LHRi9GC0LjQuSDRgdGC0LDRgNGC0LAg0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHVuc3Vic2NyaWJlIC0g0L7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtpbnR9IG9mZnNldCAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge0F1ZGlvfVxuICogQHByaXZhdGVcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuX2dldExvYWRlciA9IGZ1bmN0aW9uKHVuc3Vic2NyaWJlLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5sb2FkZXJzWyh0aGlzLmFjdGl2ZUxvYWRlciArIG9mZnNldCkgJSB0aGlzLmxvYWRlcnMubGVuZ3RoXTtcbiAgICBpZiAodW5zdWJzY3JpYmUpIHtcbiAgICAgICAgbG9hZGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfTUVUQSwgbG9hZGVyLnN0YXJ0UGxheSk7XG4gICAgICAgIGxvYWRlci5yZW1vdmVFdmVudExpc3RlbmVyKEF1ZGlvSFRNTDUuRVZFTlRfTkFUSVZFX0NBTlBMQVksIGxvYWRlci5zdGFydFBsYXkpO1xuICAgIH1cblxuICAgIHJldHVybiBsb2FkZXI7XG59O1xuXG4vL0lORk86INGN0YLQsCDQutC+0L3RgdGC0YDRg9C60YbQuNGPINC90YPQttC90LAsINGH0YLQvtCx0Ysg0L3QtSDQvNC10L3Rj9GC0Ywg0LvQvtCz0LjQutGDINC/0YDQuCByZXN1bWVcbi8qKlxuICog0JfQsNC/0YPRgdC6INCy0L7RgdC/0YDQvtC40LfQstC10LTQtdC90LjRj1xuICogQHBhcmFtIHtBdWRpb30gbG9hZGVyIC0g0LfQsNCz0YDRg9C30YfQuNC6INCw0YPQtNC40L5cbiAqIEBwcml2YXRlXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLl9wbGF5ID0gZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgbG9nZ2VyLmRlYnVnKHRoaXMsIFwiX3BsYXlcIik7XG5cbiAgICBpZiAobG9hZGVyLnJlYWR5U3RhdGUgPiBsb2FkZXIuSEFWRV9NRVRBREFUQSkge1xuICAgICAgICBsb2FkZXIuc3RhcnRQbGF5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyZWZveCB3YWl0cyB0b28gbG9uZyB0aWxsICdjYW5wbGF5JyBvciAnY2FucGxheXRocm91Z2gnXG4gICAgICAgIC8vIGJ1dCBpdCBjYW4gcGxheSByaWdodCBhZnRlciAnbG9hZGVkbWV0YWRhdGEnXG4gICAgICAgIC8vIHNvIHdlIHVzZSBib3RoIGV2ZW50c1xuICAgICAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihBdWRpb0hUTUw1LkVWRU5UX05BVElWRV9NRVRBLCBsb2FkZXIuc3RhcnRQbGF5KTtcbiAgICAgICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoQXVkaW9IVE1MNS5FVkVOVF9OQVRJVkVfQ0FOUExBWSwgbG9hZGVyLnN0YXJ0UGxheSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiDQn9C10YDQtdC60LvRjtGH0LXQvdC40LUg0YDQtdC20LjQvNCwINC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPIFdlYiBBdWRpbyBBUEkuINCU0L7RgdGC0YPQv9C10L0g0YLQvtC70YzQutC+INC/0YDQuCBodG1sNS3RgNC10LDQu9C40LfQsNGG0LjQuCDQv9C70LXQtdGA0LAuXG4gKlxuICogKirQktC90LjQvNCw0L3QuNC1ISoqIC0g0L/QvtGB0LvQtSDQstC60LvRjtGH0LXQvdC40Y8g0YDQtdC20LjQvNCwIFdlYiBBdWRpbyBBUEkg0L7QvSDQvdC1INC+0YLQutC70Y7Rh9Cw0LXRgtGB0Y8g0L/QvtC70L3QvtGB0YLRjNGOLCDRgi7Qui4g0LTQu9GPINGN0YLQvtCz0L4g0YLRgNC10LHRg9C10YLRgdGPXG4gKiDRgNC10LjQvdC40YbQuNCw0LvQuNC30LDRhtC40Y8g0L/Qu9C10LXRgNCwLCDQutC+0YLQvtGA0L7QuSDRgtGA0LXQsdGD0LXRgtGB0Y8g0LrQu9C40Log0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GPLiDQn9GA0Lgg0L7RgtC60LvRjtGH0LXQvdC40Lgg0LjQtyDQs9GA0LDRhNCwINC+0LHRgNCw0LHQvtGC0LrQuCDQuNGB0LrQu9GO0YfQsNGO0YLRgdGPXG4gKiDQstGB0LUg0L3QvtC00Ysg0LrRgNC+0LzQtSDQvdC+0LQt0LjRgdGC0L7Rh9C90LjQutC+0LIg0Lgg0L3QvtC00Ysg0LLRi9Cy0L7QtNCwLCDRg9C/0YDQsNCy0LvQtdC90LjQtSDQs9GA0L7QvNC60L7RgdGC0YzRjiDQv9C10YDQtdC60LvRjtGH0LDQtdGC0YHRjyDQvdCwINGN0LvQtdC80LXQvdGC0YsgYXVkaW8sINCx0LXQt1xuICog0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y8gR2Fpbk5vZGVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc3RhdGUgLSDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvQuSDRgdGC0LDRgtGD0YFcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtLSDQuNGC0L7Qs9C+0LLRi9C5INGB0YLQsNGC0YPRgSDQv9C70LXQtdGA0LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUudG9nZ2xlV2ViQXVkaW9BUEkgPSBmdW5jdGlvbihzdGF0ZSkge1xuICAgIGlmICghYXVkaW9Db250ZXh0KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKHRoaXMsIFwidG9nZ2xlV2ViQXVkaW9BUElFcnJvclwiLCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIuaW5mbyh0aGlzLCBcInRvZ2dsZVdlYkF1ZGlvQVBJXCIsIHN0YXRlKTtcblxuICAgIGlmICh0aGlzLndlYkF1ZGlvQXBpID09IHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdGhpcy5hdWRpb091dHB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuYXVkaW9PdXRwdXQuZ2FpbiA9IHRoaXMudm9sdW1lO1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5jb25uZWN0KHRoaXMuYXVkaW9PdXRwdXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zb3VyY2VzID0gdGhpcy5zb3VyY2VzIHx8IFtdO1xuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIsIGlkeCkge1xuICAgICAgICAgICAgbG9hZGVyLnZvbHVtZSA9IDE7XG4gICAgICAgICAgICB2YXIgcHJlcGFyZWQgPSBsb2FkZXIuY3Jvc3NPcmlnaW47XG4gICAgICAgICAgICBsb2FkZXIuY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xuICAgICAgICAgICAgdGhpcy5fYWRkU291cmNlKGxvYWRlciwgdGhpcy5zb3VyY2VzW2lkeF0pO1xuXG4gICAgICAgICAgICBpZiAoIXByZXBhcmVkKSB7IC8vIElORk86INC/0L7RgdC70LUg0YLQvtCz0L4g0LrQsNC6INC80Ysg0LLQutC70Y7Rh9C40LvQuCB3ZWJBdWRpb0FQSSDQtdCz0L4g0YPQttC1INC90LXQu9GM0LfRjyDQv9C+0LvQvdC+0YHRgtGM0Y4g0LLRi9C60LvRjtGH0LjRgtGMLlxuICAgICAgICAgICAgICAgIHZhciBwb3MgPSBsb2FkZXIuY3VycmVudFRpbWU7XG4gICAgICAgICAgICAgICAgdmFyIHBhdXNlZCA9IGxvYWRlci5wYXVzZWQ7XG4gICAgICAgICAgICAgICAgbG9hZGVyLmxvYWQoKTtcbiAgICAgICAgICAgICAgICBsb2FkZXIuY3VycmVudFRpbWUgPSBwb3M7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZGVyLnBsYXkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMuYXVkaW9PdXRwdXQpIHtcbiAgICAgICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICB0aGlzLnByZXByb2Nlc3Nvci5vdXRwdXQuZGlzY29ubmVjdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdWRpb091dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmF1ZGlvT3V0cHV0O1xuXG4gICAgICAgIHRoaXMuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgICAgICAgc291cmNlLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vZGVsZXRlIHRoaXMuc291cmNlcztcblxuICAgICAgICB0aGlzLmxvYWRlcnMuZm9yRWFjaChmdW5jdGlvbihsb2FkZXIsIGlkeCkge1xuICAgICAgICAgICAgbG9hZGVyLnZvbHVtZSA9IHRoaXMudm9sdW1lO1xuXG4gICAgICAgICAgICB2YXIgc291cmNlID0gdGhpcy5zb3VyY2VzW2lkeF07XG4gICAgICAgICAgICBpZiAoc291cmNlKSB7IC8vIElORk86INC/0L7RgdC70LUg0YLQvtCz0L4g0LrQsNC6INC80Ysg0LLQutC70Y7Rh9C40LvQuCB3ZWJBdWRpb0FQSSDQtdCz0L4g0YPQttC1INC90LXQu9GM0LfRjyDQv9C+0LvQvdC+0YHRgtGM0Y4g0LLRi9C60LvRjtGH0LjRgtGMLlxuICAgICAgICAgICAgICAgIHNvdXJjZS5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgdGhpcy53ZWJBdWRpb0FwaSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHN0YXRlO1xufTtcblxuLyoqXG4gKiDQn9C+0LTQutC70Y7Rh9C10L3QuNC1INCw0YPQtNC40L4g0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAuINCS0YXQvtC0INC/0YDQtdC/0YDQvtGG0LXRgdGB0L7RgNCwINC/0L7QtNC60LvRjtGH0LDQtdGC0YHRjyDQuiDQsNGD0LTQuNC+LdGN0LvQtdC80LXQvdGC0YMg0YMg0LrQvtGC0L7RgNC+0LPQviDQstGL0YHRgtCw0LLQu9C10L3QsFxuICogMTAwJSDQs9GA0L7QvNC60L7RgdGC0YwuINCS0YvRhdC+0LQg0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGA0LAg0L/QvtC00LrQu9GO0YfQsNC10YLRgdGPINC6IEdhaW5Ob2RlLCDQutC+0YLQvtGA0LDRjyDRgNC10LPRg9C70LjRgNGD0LXRgiDQuNGC0L7Qs9C+0LLRg9GOINCz0YDQvtC80LrQvtGB0YLRjFxuICogQHBhcmFtIHt5YS5BdWRpb35BdWRpb1ByZXByb2Nlc3Nvcn0gcHJlcHJvY2Vzc29yIC0g0L/RgNC10L/RgNC+0YbQtdGB0YHQvtGAXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLS0g0YHRgtCw0YLRg9GBINGD0YHQv9C10YXQsFxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5zZXRBdWRpb1ByZXByb2Nlc3NvciA9IGZ1bmN0aW9uKHByZXByb2Nlc3Nvcikge1xuICAgIGlmICghdGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICBsb2dnZXIud2Fybih0aGlzLCBcInNldEF1ZGlvUHJlcHJvY2Vzc29yRXJyb3JcIiwgcHJlcHJvY2Vzc29yKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0QXVkaW9QcmVwcm9jZXNzb3JcIik7XG5cbiAgICBpZiAodGhpcy5wcmVwcm9jZXNzb3IgPT09IHByZXByb2Nlc3Nvcikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJlcHJvY2Vzc29yKSB7XG4gICAgICAgIHRoaXMucHJlcHJvY2Vzc29yLm91dHB1dC5kaXNjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wcmVwcm9jZXNzb3IgPSBwcmVwcm9jZXNzb3I7XG5cbiAgICBpZiAoIXByZXByb2Nlc3Nvcikge1xuICAgICAgICB0aGlzLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgICAgICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBzb3VyY2UuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgICBzb3VyY2UuZGlzY29ubmVjdCgpO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChwcmVwcm9jZXNzb3IuaW5wdXQpO1xuICAgIH0pO1xuICAgIHByZXByb2Nlc3Nvci5vdXRwdXQuY29ubmVjdCh0aGlzLmF1ZGlvT3V0cHV0KTtcbn07XG5cbi8qKlxuICog0J/RgNC+0LjQs9GA0LDRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oc3JjLCBkdXJhdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVwiLCBzcmMpO1xuXG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcih0cnVlKTtcblxuICAgIGxvYWRlci5mYWtlID0gZmFsc2U7XG4gICAgbG9hZGVyLnNyYyA9IHNyYztcbiAgICBsb2FkZXIuX3NyYyA9IHNyYztcbiAgICBsb2FkZXIubm90TG9hZGluZyA9IHRydWU7XG4gICAgbG9hZGVyLmxvYWQoKTtcblxuICAgIHRoaXMuX3BsYXkobG9hZGVyKTtcbn07XG5cbi8qKiDQn9C+0YHRgtCw0LLQuNGC0Ywg0YLRgNC10Log0L3QsCDQv9Cw0YPQt9GDICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGF1c2VcIik7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMuX2dldExvYWRlcih0cnVlKTtcbiAgICBsb2FkZXIucGF1c2UoKTtcbn07XG5cbi8qKiDQodC90Y/RgtGMINGC0YDQtdC6INGBINC/0LDRg9C30YsgKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicmVzdW1lXCIpO1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIodHJ1ZSk7XG4gICAgdGhpcy5fcGxheShsb2FkZXIpO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0Lgg0LfQsNCz0YDRg9C30LrRgyDRgtGA0LXQutCwXG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0wXSAtIDA6INC00LvRjyDRgtC10LrRg9GJ0LXQs9C+INC30LDQs9GA0YPQt9GH0LjQutCwLCAxOiDQtNC70Y8g0YHQu9C10LTRg9GO0YnQtdCz0L4g0LfQsNCz0YDRg9C30YfQuNC60LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic3RvcFwiKTtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKHRydWUsIG9mZnNldCB8fCAwKTtcblxuICAgIGxvYWRlci5mYWtlID0gdHJ1ZTtcbiAgICBsb2FkZXIuc3JjID0gXCJcIjtcbiAgICBsb2FkZXIuX3NyYyA9IGZhbHNlO1xuICAgIGxvYWRlci5ub3RMb2FkaW5nID0gdHJ1ZTtcbiAgICBsb2FkZXIubG9hZCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKEF1ZGlvU3RhdGljLkVWRU5UX1NUT1AsIG9mZnNldCk7XG59O1xuXG4vKipcbiAqINCf0YDQtdC00LfQsNCz0YDRg9C30LjRgtGMINGC0YDQtdC6XG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZHVyYXRpb25dIC0g0JTQu9C40YLQtdC70YzQvdC+0YHRgtGMINGC0YDQtdC60LAgKNC90LUg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPKVxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucHJlbG9hZCA9IGZ1bmN0aW9uKHNyYywgZHVyYXRpb24sIG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicHJlbG9hZFwiLCBzcmMsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIodHJ1ZSwgb2Zmc2V0KTtcblxuICAgIGxvYWRlci5zcmMgPSBzcmM7XG4gICAgbG9hZGVyLl9zcmMgPSBzcmM7XG4gICAgbG9hZGVyLm5vdExvYWRpbmcgPSB0cnVlO1xuICAgIGxvYWRlci5sb2FkKCk7XG59O1xuXG4vKipcbiAqINCf0YDQvtCy0LXRgNC40YLRjCDRh9GC0L4g0YLRgNC10Log0L/RgNC10LTQt9Cw0LPRgNGD0LbQsNC10YLRgdGPXG4gKiBAcGFyYW0ge1N0cmluZ30gc3JjIC0g0YHRgdGL0LvQutCwINC90LAg0YLRgNC10LpcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTFdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuaXNQcmVsb2FkZWQgPSBmdW5jdGlvbihzcmMsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKGZhbHNlLCBvZmZzZXQpO1xuICAgIHJldHVybiBsb2FkZXIuX3NyYyA9PT0gc3JjICYmICFsb2FkZXIubm90TG9hZGluZztcbn07XG5cbi8qKlxuICog0J/RgNC+0LLQtdGA0LjRgtGMINGH0YLQviDRgtGA0LXQuiDQvdCw0YfQsNC7INC/0YDQtdC00LfQsNCz0YDRg9C20LDRgtGM0YHRj1xuICogQHBhcmFtIHtTdHJpbmd9IHNyYyAtINGB0YHRi9C70LrQsCDQvdCwINGC0YDQtdC6XG4gKiBAcGFyYW0ge2ludH0gW29mZnNldD0xXSAtIDA6INGC0LXQutGD0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQuiwgMTog0YHQu9C10LTRg9GO0YnQuNC5INC30LDQs9GA0YPQt9GH0LjQulxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmlzUHJlbG9hZGluZyA9IGZ1bmN0aW9uKHNyYywgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID09IG51bGwgPyAxIDogb2Zmc2V0O1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLl9nZXRMb2FkZXIoZmFsc2UsIG9mZnNldCk7XG4gICAgcmV0dXJuIGxvYWRlci5fc3JjID09PSBzcmM7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDQstC+0YHQv9GA0L7QuNC30LLQtdC00LXQvdC40LUg0L/RgNC10LTQt9Cw0LPRgNGD0LbQtdC90L3QvtCz0L4g0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MV0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtib29sZWFufSAtLSDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMINC00LDQvdC90L7Qs9C+INC00LXQudGB0YLQstC40Y9cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUucGxheVByZWxvYWRlZCA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwicGxheVByZWxvYWRlZFwiLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IG9mZnNldCA9PSBudWxsID8gMSA6IG9mZnNldDtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKGZhbHNlLCBvZmZzZXQpO1xuXG4gICAgaWYgKCFsb2FkZXIuX3NyYykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdGhpcy5fc2V0QWN0aXZlKG9mZnNldCk7XG4gICAgdGhpcy5fcGxheSh0aGlzLl9nZXRMb2FkZXIodHJ1ZSwgMCkpO1xuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqINCf0L7Qu9GD0YfQuNGC0Ywg0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRMb2FkZXIoKS5jdXJyZW50VGltZTtcbn07XG5cbi8qKlxuICog0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0YLQtdC60YPRidGD0Y4g0L/QvtC30LjRhtC40Y4g0LLQvtGB0L/RgNC+0LjQt9Cy0LXQtNC10L3QuNGPXG4gKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0UG9zaXRpb25cIiwgcG9zaXRpb24pO1xuICAgIHRoaXMuX2dldExvYWRlcigpLmN1cnJlbnRUaW1lID0gcG9zaXRpb24gLSAwLjAwMTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0YLRgNC10LrQsFxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcihmYWxzZSwgb2Zmc2V0KS5kdXJhdGlvbjtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQtNC70LjRgtC10LvRjNC90L7RgdGC0Ywg0LfQsNCz0YDRg9C20LXQvdC90L7QuSDRh9Cw0YHRgtC4INGC0YDQtdC60LBcbiAqIEBwYXJhbSB7aW50fSBbb2Zmc2V0PTBdIC0gMDog0YLQtdC60YPRidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6LCAxOiDRgdC70LXQtNGD0Y7RidC40Lkg0LfQsNCz0YDRg9C30YfQuNC6XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRMb2FkZWQgPSBmdW5jdGlvbihvZmZzZXQpIHtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5fZ2V0TG9hZGVyKGZhbHNlLCBvZmZzZXQpO1xuXG4gICAgaWYgKGxvYWRlci5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGxvYWRlci5idWZmZXJlZC5lbmQoMCkgLSBsb2FkZXIuYnVmZmVyZWQuc3RhcnQoMCk7XG4gICAgfVxuICAgIHJldHVybiAwO1xufTtcblxuLyoqXG4gKiDQn9C+0LvRg9GH0LjRgtGMINGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52b2x1bWU7XG59O1xuXG4vKipcbiAqINCj0YHRgtCw0L3QvtCy0LjRgtGMINC30L3QsNGH0LXQvdC40LUg0LPRgNC+0LzQutC+0YHRgtC4XG4gKiBAcGFyYW0ge251bWJlcn0gdm9sdW1lXG4gKi9cbkF1ZGlvSFRNTDUucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uKHZvbHVtZSkge1xuICAgIGxvZ2dlci5pbmZvKHRoaXMsIFwic2V0Vm9sdW1lXCIsIHZvbHVtZSk7XG4gICAgdGhpcy52b2x1bWUgPSB2b2x1bWU7XG5cbiAgICBpZiAodGhpcy53ZWJBdWRpb0FwaSkge1xuICAgICAgICB0aGlzLmF1ZGlvT3V0cHV0LmdhaW4udmFsdWUgPSB2b2x1bWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2FkZXJzLmZvckVhY2goZnVuY3Rpb24obG9hZGVyKSB7XG4gICAgICAgICAgICBsb2FkZXIudm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRyaWdnZXIoQXVkaW9TdGF0aWMuRVZFTlRfVk9MVU1FKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDRgdGB0YvQu9C60YMg0L3QsCDRgtGA0LXQulxuICogQHBhcmFtIHtpbnR9IFtvZmZzZXQ9MF0gLSAwOiDRgtC10LrRg9GJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LosIDE6INGB0LvQtdC00YPRjtGJ0LjQuSDQt9Cw0LPRgNGD0LfRh9C40LpcbiAqIEByZXR1cm5zIHtTdHJpbmd8Qm9vbGVhbn0gLS0g0KHRgdGL0LvQutCwINC90LAg0YLRgNC10Log0LjQu9C4IGZhbHNlLCDQtdGB0LvQuCDQvdC10YIg0LfQsNCz0YDRg9C20LDQtdC80L7Qs9C+INGC0YDQtdC60LBcbiAqL1xuQXVkaW9IVE1MNS5wcm90b3R5cGUuZ2V0U3JjID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExvYWRlcihmYWxzZSwgb2Zmc2V0KS5fc3JjO1xufTtcblxuLyoqXG4gKiDQn9GA0L7QstC10YDQuNGC0Ywg0LTQvtGB0YLRg9C/0LXQvSDQu9C4INC/0YDQvtCz0YDQsNC80LzQvdGL0Lkg0LrQvtC90YLRgNC+0LvRjCDQs9GA0L7QvNC60L7RgdGC0LhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5pc0RldmljZVZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBkZXRlY3Qub25seURldmljZVZvbHVtZTtcbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINGB0L7RgdGC0L7Rj9C90LjRjyDQv9C70LXQtdGA0LAg0LIg0LvQvtCz0LUuXG4gKiBAcHJpdmF0ZVxuICovXG5BdWRpb0hUTUw1LnByb3RvdHlwZS5fbG9nZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1haW46IHRoaXMuZ2V0U3JjKDApLFxuICAgICAgICAgICAgcHJlbG9hZGVyOiB0aGlzLmdldFNyYygxKVxuICAgICAgICB9O1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbmV4cG9ydHMuQXVkaW9JbXBsZW1lbnRhdGlvbiA9IEF1ZGlvSFRNTDU7XG4iLCJ2YXIgWWFuZGV4QXVkaW8gPSByZXF1aXJlKCcuL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbGliL25ldC9lcnJvci9leHBvcnQnKTtcbnJlcXVpcmUoJy4vbG9nZ2VyL2V4cG9ydCcpO1xucmVxdWlyZSgnLi9meC9lcXVhbGl6ZXIvZXhwb3J0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWWFuZGV4QXVkaW87XG4iLCJ2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9ub29wJyk7XG5cbi8qKlxuICogQGNsYXNzINCe0YLQu9C+0LbQtdC90L3QvtC1INC00LXQudGB0YLQstC40LVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIERlZmVycmVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIF9wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiDQoNCw0LfRgNC10YjQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKiBAbWV0aG9kIERlZmVycmVkI3Jlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHsqfSBkYXRhIC0g0L/QtdGA0LXQtNCw0YLRjCDQtNCw0L3QvdGL0LUg0LIg0L7QsdC10YnQsNC90LjQtVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICog0J7RgtC60LvQvtC90LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAgICAgICAgICogQG1ldGhvZCBEZWZlcnJlZCNyZWplY3RcbiAgICAgICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSDQv9C10YDQtdC00LDRgtGMINC+0YjQuNCx0LrRg1xuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5yZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG5cbiAgICB2YXIgcHJvbWlzZSA9IF9wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBzZWxmLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBzZWxmLnJlamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgICBwcm9taXNlW1wiY2F0Y2hcIl0obm9vcCk7IC8vIERvbid0IHRocm93IGVycm9ycyB0byBjb25zb2xlXG5cbiAgICAvKipcbiAgICAgKiDQktGL0L/QvtC70L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiDQntGC0LrQu9C+0L3QuNC70L7RgdGMINC70Lgg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMucmVqZWN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqINCf0L7Qu9GD0YfQuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICAgICAqIEBtZXRob2QgRGVmZXJyZWQjcHJvbWlzZVxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHRoaXMucHJvbWlzZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcHJvbWlzZTsgfTtcbn07XG5cbi8qKlxuICog0J7QttC40LTQsNC90LjQtSDQstGL0L/QvtC70L3QtdC90LjRjyDRgdC/0LjRgdC60LAg0L7QsdC10YnQsNC90LjQuVxuICogQHBhcmFtIHsuLi4qfSBhcmdzIC0g0L7QsdC10YnQsNC90LjRjywg0LrQvtGC0L7RgNGL0LUg0YLRgNC10LHRg9C10YLRgdGPINC+0LbQuNC00LDRgtGMXG4gKiBAcmV0dXJucyBBYm9ydGFibGVQcm9taXNlXG4gKi9cbkRlZmVycmVkLndoZW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWQoKTtcblxuICAgIHZhciBsaXN0ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHZhciBwZW5kaW5nID0gbGlzdC5sZW5ndGg7XG5cbiAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBwZW5kaW5nLS07XG5cbiAgICAgICAgaWYgKHBlbmRpbmcgPD0gMCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QpO1xuICAgIH0pO1xuICAgIGxpc3QgPSBudWxsO1xuXG4gICAgZGVmZXJyZWQucHJvbWlzZS5hYm9ydCA9IGRlZmVycmVkLnJlamVjdDtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmVycmVkO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vZGF0YS9tZXJnZScpO1xuXG52YXIgTElTVEVORVJTX05BTUUgPSBcIl9saXN0ZW5lcnNcIjtcbnZhciBNVVRFX09QVElPTiA9IFwiX211dGVkXCI7XG5cbi8qKlxuICog0JTQuNGB0L/QtdGC0YfQtdGAINGB0L7QsdGL0YLQuNC5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qKiDQmtC+0L3RgtC10LnQvdC10YAg0LTQu9GPINGB0L/QuNGB0LrQvtCyINGB0LvRg9GI0LDRgtC10LvQtdC5INGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbGlzdGVuZXJzXG4gICAgICogQHR5cGUge09iamVjdC48U3RyaW5nLCBBcnJheS48RnVuY3Rpb24+Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTElTVEVORVJTX05BTUVdID0ge307XG5cbiAgICAvKiog0KTQu9Cw0LMg0LLQutC70Y7Rh9C10L3QuNGPL9Cy0YvQutC70Y7Rh9C10L3QuNGPINGB0L7QsdGL0YLQuNC5XG4gICAgICogQGFsaWFzIEV2ZW50cyNfbXV0ZXNcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXNbTVVURV9PUFRJT05dID0gZmFsc2U7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0LrQu9Cw0YHRgSDRgdCy0L7QudGB0YLQstCw0LzQuCDQtNC40YHQv9C10YLRh9C10YDQsCDRgdC+0LHRi9GC0LjQuVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2xhc3NDb25zdHJ1Y3RvciAtINC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0tINGC0L7RgiDQttC1INC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwLCDRgNCw0YHRiNC40YDQtdC90L3Ri9C5INGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKi9cbkV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKGNsYXNzQ29uc3RydWN0b3IpIHtcbiAgICBtZXJnZShjbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSwgRXZlbnRzLnByb3RvdHlwZSwgdHJ1ZSk7XG4gICAgcmV0dXJuIGNsYXNzQ29uc3RydWN0b3I7XG59O1xuXG4vKipcbiAqINCg0LDRgdGI0LjRgNC40YLRjCDQv9GA0L7QuNC30LLQvtC70YzQvdGL0Lkg0L7QsdGK0LXQutGCINGB0LLQvtC50YHRgtCy0LDQvNC4INC00LjRgdC/0LXRgtGH0LXRgNCwINGB0L7QsdGL0YLQuNC5XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IC0g0L7QsdGK0LXQutGCXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtLSDRgtC+0YIg0LbQtSDQvtCx0YrQtdC60YIsINGA0LDRgdGI0LjRgNC10L3QvdGL0Lkg0YHQstC+0LnRgdGC0LLQsNC80Lgg0LTQuNGB0L/QtdGC0YfQtdGA0LAg0YHQvtCx0YvRgtC40LlcbiAqL1xuRXZlbnRzLmV2ZW50aXplID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgbWVyZ2Uob2JqZWN0LCBFdmVudHMucHJvdG90eXBlLCB0cnVlKTtcbiAgICBFdmVudHMuY2FsbChvYmplY3QpO1xuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vKipcbiAqINCf0L7QtNC/0LjRgdCw0YLRjNGB0Y8g0L3QsCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdKSB7XG4gICAgICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSA9IFtdO1xuICAgIH1cblxuICAgIHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtINC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNGPXG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzW0xJU1RFTkVSU19OQU1FXVtldmVudF07XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3Nba10gPT09IGNhbGxiYWNrIHx8IGNhbGxiYWNrc1trXS5jYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpc1tMSVNURU5FUlNfTkFNRV1bZXZlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J/QvtC00L/QuNGB0LDRgtGM0YHRjyDQvdCwINGB0L7QsdGL0YLQuNC1LCDQvtGC0L/QuNGB0LDRgtGM0YHRjyDRgdGA0LDQt9GDINC/0L7RgdC70LUg0L/QtdGA0LLQvtCz0L4g0LLQvtC30L3QuNC60L3QvtCy0LXQvdC40Y8g0YHQvtCx0YvRgtC40Y9cbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtINC40LzRjyDRgdC+0LHRi9GC0LjRj1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjRj1xuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCB3cmFwcGVyKTtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgd3JhcHBlci5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHNlbGYub24oZXZlbnQsIHdyYXBwZXIpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCX0LDQv9GD0YHRgtC40YLRjCDRgdC+0LHRi9GC0LjQtVxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0g0LjQvNGPINGB0L7QsdGL0YLQuNGPXG4gKiBAcGFyYW0gey4uLmFyZ3N9IGFyZ3MgLSDQv9Cw0YDQsNC80LXRgtGA0Ysg0LTQu9GPINC/0LXRgNC10LTQsNGH0Lgg0LLQvNC10YHRgtC1INGBINGB0L7QsdGL0YLQuNC10LxcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihldmVudCwgYXJncykge1xuICAgIGlmICh0aGlzW01VVEVfT1BUSU9OXSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYgKGV2ZW50ICE9PSBcIipcIikge1xuICAgICAgICBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYXBwbHkodGhpcywgW1wiKlwiLCBldmVudF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tzID0gW10uY29uY2F0KHRoaXNbTElTVEVORVJTX05BTUVdW2V2ZW50XSk7XG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBjYWxsYmFja3MubGVuZ3RoOyBrIDwgbDsgaysrKSB7XG4gICAgICAgIGNhbGxiYWNrc1trXS5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICog0J7RgtC/0LjRgdCw0YLRjNGB0Y8g0L7RgiDQstGB0LXRhSDRgdC70YPRiNCw0YLQtdC70LXQuSDRgdC+0LHRi9GC0LjQuVxuICogQHJldHVybnMge0V2ZW50c30gLS0g0YbQtdC/0L7Rh9C90YvQuSDQvNC10YLQvtC0LCDQstC+0LfQstGA0LDRidCw0LXRgiDRgdGB0YvQu9C60YMg0L3QsCDQutC+0L3RgtC10LrRgdGCXG4gKi9cbkV2ZW50cy5wcm90b3R5cGUuY2xlYXJMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpc1tMSVNURU5FUlNfTkFNRV0pIHtcbiAgICAgICAgaWYgKHRoaXNbTElTVEVORVJTX05BTUVdLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzW0xJU1RFTkVSU19OQU1FXVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCU0LXQu9C10LPQuNGA0L7QstCw0YLRjCDQstGB0LUg0YHQvtCx0YvRgtC40Y8g0LTRgNGD0LPQvtC80YMg0LTQuNGB0L/QtdGC0YfQtdGA0YMg0YHQvtCx0YvRgtC40LlcbiAqIEBwYXJhbSB7RXZlbnRzfSBhY2NlcHRvciAtINC/0L7Qu9GD0YfQsNGC0LXQu9GMINGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS5waXBlRXZlbnRzID0gZnVuY3Rpb24oYWNjZXB0b3IpIHtcbiAgICB0aGlzLm9uKFwiKlwiLCBFdmVudHMucHJvdG90eXBlLnRyaWdnZXIuYmluZChhY2NlcHRvcikpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiDQntGB0YLQsNC90L7QstC40YLRjCDQt9Cw0L/Rg9GB0Log0YHQvtCx0YvRgtC40LlcbiAqIEByZXR1cm5zIHtFdmVudHN9IC0tINGG0LXQv9C+0YfQvdGL0Lkg0LzQtdGC0L7QtCwg0LLQvtC30LLRgNCw0YnQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0LrQvtC90YLQtdC60YHRglxuICovXG5FdmVudHMucHJvdG90eXBlLm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzW01VVEVfT1BUSU9OXSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqINCS0L7Qt9C+0LHQvdC+0LLQuNGC0Ywg0LfQsNC/0YPRgdC6INGB0L7QsdGL0YLQuNC5XG4gKiBAcmV0dXJucyB7RXZlbnRzfSAtLSDRhtC10L/QvtGH0L3Ri9C5INC80LXRgtC+0LQsINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINGB0YHRi9C70LrRgyDQvdCwINC60L7QvdGC0LXQutGB0YJcbiAqL1xuRXZlbnRzLnByb3RvdHlwZS51bm11dGVFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgICBkZWxldGUgdGhpc1tNVVRFX09QVElPTl07XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50cztcbiIsInZhciB2b3cgPSByZXF1aXJlKCd2b3cnKTtcbnZhciBkZXRlY3QgPSByZXF1aXJlKCcuLi9icm93c2VyL2RldGVjdCcpO1xuXG4vKipcbiAqIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9ydS9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9Qcm9taXNlfEVTLTYgUHJvbWlzZX1cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUHJvbWlzZTtcbmlmICh0eXBlb2Ygd2luZG93LlByb21pc2UgIT09IFwiZnVuY3Rpb25cIlxuICAgIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwibXNpZVwiIHx8IGRldGVjdC5icm93c2VyLm5hbWUgPT09IFwiZWRnZVwiIC8vINC80LXQu9C60LjQtSDQvNGP0LPQutC40LUg0LrQsNC6INCy0YHQtdCz0LTQsCDQvdC40YfQtdCz0L4g0L3QtSDRg9C80LXRjtGCINC00LXQu9Cw0YLRjCDQv9GA0LDQstC40LvRjNC90L5cbikge1xuICAgIFByb21pc2UgPSB2b3cuUHJvbWlzZTtcbn0gZWxzZSB7XG4gICAgUHJvbWlzZSA9IHdpbmRvdy5Qcm9taXNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDRgNCw0LfRgNC10YjRkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZXNvbHZlXG4gKiBAcGFyYW0geyp9IGRhdGEgLSDQtNCw0L3QvdGL0LUsINC60L7RgtC+0YDRi9C80Lgg0YDQsNC30YDQtdGI0LjRgtGMINC+0LHQtdGJ0LDQvdC40LVcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSDQvtGC0LrQu9C+0L3RkdC90L3QvtC1INC/0LXRgNC10LTQsNC90L3Ri9C80Lgg0LTQsNC90L3Ri9C80LhcbiAqIEBtZXRob2QgUHJvbWlzZS5yZWplY3RcbiAqIEBwYXJhbSB7Kn0gZGF0YSAtINC00LDQvdC90YvQtSwg0LrQvtGC0L7RgNGL0LzQuCDQvtGC0LrQu9C+0L3QuNGC0Ywg0L7QsdC10YnQsNC90LjQtVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQodC+0LfQtNCw0YLRjCDQvtCx0LXRidCw0L3QuNC1LCDQutC+0YLQvtGA0L7QtSDQstGL0L/QvtC70L3QuNGC0YHRjyDRgtC+0LPQtNCwLCDQutC+0LPQtNCwINCx0YPQtNGD0YIg0LLRi9C/0L7Qu9C90LXQvdGLINCy0YHQtSDQv9C10YDQtdC00LDQvdC90YvQtSDQvtCx0LXRidCw0L3QuNGPLlxuICogQG1ldGhvZCBQcm9taXNlLmFsbFxuICogQHBhcmFtIHtBcnJheS48UHJvbWlzZT59IHByb21pc2VzIC0g0YHQv9C40YHQvtC6INC+0LHQtdGJ0LDQvdC40LlcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L7QsdC10YnQsNC90LjQtSwg0LrQvtGC0L7RgNC+0LUg0LLRi9C/0L7Qu9C90LjRgtGB0Y8g0YLQvtCz0LTQsCwg0LrQvtCz0LTQsCDQsdGD0LTQtdGCINCy0YvQv9C+0LvQvdC10L3QviDRhdC+0YLRjyDQsdGLINC+0LTQvdC+INC40Lcg0L/QtdGA0LXQtNCw0L3QvdGL0YUg0L7QsdC10YnQsNC90LjQuS5cbiAqIEBtZXRob2QgUHJvbWlzZS5yYWNlXG4gKiBAcGFyYW0ge0FycmF5LjxQcm9taXNlPn0gcHJvbWlzZXMgLSDRgdC/0LjRgdC+0Log0L7QsdC10YnQsNC90LjQuVxuICogQHN0YXRpY1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40LrQuCDRgNCw0LfRgNC10YjQtdC90LjRjyDQuCDQvtGC0LrQu9C+0L3QtdC90LjRjyDQvtCx0LXRidCw0L3QuNGPXG4gKiBAbWV0aG9kIFByb21pc2UjdGhlblxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRg9GB0L/QtdGF0LBcbiAqIEBwYXJhbSB7bnVsbHxmdW5jdGlvbn0gW2VycmJhY2tdIC0g0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RiNC40LHQutC4XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gLS0g0L3QvtCy0L7QtSDQvtCx0LXRidCw0L3QuNC1INC40Lcg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQvtCx0YDQsNCx0L7RgtGH0LjQutCwXG4gKi9cblxuLyoqXG4gKiDQndCw0LfQvdCw0YfQuNGC0Ywg0L7QsdGA0LDQsdC+0YLRh9C40Log0L7RgtC60LvQvtC90LXQvdC40Y8g0L7QsdC10YnQsNC90LjRj1xuICogQG1ldGhvZCBQcm9taXNlI2NhdGNoXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBlcnJiYWNrIC0gINC+0LHRgNCw0LHQvtGC0YfQuNC6INC+0YjQuNCx0LrQuFxuICogQHJldHVybnMge1Byb21pc2V9IC0tINC90L7QstC+0LUg0L7QsdC10YnQsNC90LjQtSDQuNC3INGA0LXQt9GD0LvRjNGC0LDRgtC+0LIg0L7QsdGA0LDQsdC+0YLRh9C40LrQsFxuICovXG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBBYm9ydGFibGVQcm9taXNlXG4vKipcbiAqINCe0LHQtdGJ0LDQvdC40LUg0YEg0LLQvtC30LzQvtC20L3QvtGB0YLRjNGOINC+0YLQvNC10L3RiyDRgdCy0Y/Qt9Cw0L3QvdC+0LPQviDRgSDQvdC40Lwg0LTQtdC50YHRgtCy0LjRjy5cbiAqIEBjbGFzcyBBYm9ydGFibGVQcm9taXNlXG4gKiBAZXh0ZW5kcyBQcm9taXNlXG4gKi9cblxuLyoqXG4gKiDQntGC0LzQtdC90LAg0LTQtdC50YHRgtCy0LjRjyDRgdCy0Y/Qt9Cw0L3QvdC+0LPQviDRgSDQvtCx0LXRidCw0LXQvdC40LXQvFxuICogQGFic3RyYWN0XG4gKiBAbWV0aG9kIEFib3J0YWJsZVByb21pc2UjYWJvcnRcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSByZWFzb24gLSDQv9GA0LjRh9C40L3QsCDQvtGC0LzQtdC90Ysg0LTQtdC50YHRgtCy0LjRj1xuICovXG4iLCJ2YXIgbm9vcCA9IHJlcXVpcmUoJy4uL25vb3AnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QoZGF0YSk7XG4gICAgcHJvbWlzZVtcImNhdGNoXCJdKG5vb3ApO1xuICAgIHJldHVybiBwcm9taXNlO1xufTtcbiIsInZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIEJyb3dzZXIgZGV0ZWN0aW9uXG4vLyBVc2VyYWdlbnQgUmVnRXhwXG52YXIgcndlYmtpdCA9IC8od2Via2l0KVsgXFwvXShbXFx3Ll0rKS87XG52YXIgcnlhYnJvID0gLyh5YWJyb3dzZXIpWyBcXC9dKFtcXHcuXSspLztcbnZhciByb3BlcmEgPSAvKG9wZXJhKSg/Oi4qdmVyc2lvbik/WyBcXC9dKFtcXHcuXSspLztcbnZhciBybXNpZSA9IC8obXNpZSkgKFtcXHcuXSspLztcbnZhciByZWRnZSA9IC8oZWRnZSlcXC8oW1xcdy5dKykvO1xudmFyIHJtb3ppbGxhID0gLyhtb3ppbGxhKSg/Oi4qPyBydjooW1xcdy5dKykpPy87XG52YXIgcnNhZmFyaSA9IC9eKCg/IWNocm9tZSkuKSp2ZXJzaW9uXFwvKFtcXGRcXHdcXC5dKykuKihzYWZhcmkpLztcblxudmFyIG1hdGNoID0gcnNhZmFyaS5leGVjKHVhKSB8fCByeWFicm8uZXhlYyh1YSkgfHwgcmVkZ2UuZXhlYyh1YSkgfHwgcndlYmtpdC5leGVjKHVhKSB8fCByb3BlcmEuZXhlYyh1YSkgfHwgcm1zaWUuZXhlYyh1YSkgfHwgdWEuaW5kZXhPZihcImNvbXBhdGlibGVcIikgPCAwXG4gICAgJiYgcm1vemlsbGEuZXhlYyh1YSlcbiAgICB8fCBbXTtcblxudmFyIGJyb3dzZXIgPSB7bmFtZTogbWF0Y2hbMV0gfHwgXCJcIiwgdmVyc2lvbjogbWF0Y2hbMl0gfHwgXCIwXCJ9O1xuXG5pZiAobWF0Y2hbM10gPT09IFwic2FmYXJpXCIpIHtcbiAgICBicm93c2VyLm5hbWUgPSBtYXRjaFszXTtcbn1cblxuaWYgKGJyb3dzZXIubmFtZSA9PT0gJ21zaWUnKSB7XG4gICAgaWYgKGRvY3VtZW50LmRvY3VtZW50TW9kZSkgeyAvLyBJRTggb3IgbGF0ZXJcbiAgICAgICAgYnJvd3Nlci5kb2N1bWVudE1vZGUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgfSBlbHNlIHsgLy8gSUUgNS03XG4gICAgICAgIGJyb3dzZXIuZG9jdW1lbnRNb2RlID0gNTsgLy8gQXNzdW1lIHF1aXJrcyBtb2RlIHVubGVzcyBwcm92ZW4gb3RoZXJ3aXNlXG4gICAgICAgIGlmIChkb2N1bWVudC5jb21wYXRNb2RlKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuY29tcGF0TW9kZSA9PT0gXCJDU1MxQ29tcGF0XCIpIHtcbiAgICAgICAgICAgICAgICBicm93c2VyLmRvY3VtZW50TW9kZSA9IDc7IC8vIHN0YW5kYXJkcyBtb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBQbGF0Zm9ybSBkZXRlY3Rpb25cbi8vIFVzZXJhZ2VudCBSZWdFeHBcbnZhciBycGxhdGZvcm0gPSAvKGlwYWR8aXBob25lfGlwb2R8YW5kcm9pZHxibGFja2JlcnJ5fHBsYXlib29rfHdpbmRvd3MgY2V8d2Vib3MpLztcbnZhciBydGFibGV0ID0gLyhpcGFkfHBsYXlib29rKS87XG52YXIgcmFuZHJvaWQgPSAvKGFuZHJvaWQpLztcbnZhciBybW9iaWxlID0gLyhtb2JpbGUpLztcblxucGxhdGZvcm0gPSBycGxhdGZvcm0uZXhlYyh1YSkgfHwgW107XG52YXIgdGFibGV0ID0gcnRhYmxldC5leGVjKHVhKSB8fCAhcm1vYmlsZS5leGVjKHVhKSAmJiByYW5kcm9pZC5leGVjKHVhKSB8fCBbXTtcblxuaWYgKHBsYXRmb3JtWzFdKSB7XG4gICAgcGxhdGZvcm1bMV0gPSBwbGF0Zm9ybVsxXS5yZXBsYWNlKC9cXHMvZywgXCJfXCIpOyAvLyBDaGFuZ2Ugd2hpdGVzcGFjZSB0byB1bmRlcnNjb3JlLiBFbmFibGVzIGRvdCBub3RhdGlvbi5cbn1cblxudmFyIHBsYXRmb3JtID0ge1xuICAgIHR5cGU6IHBsYXRmb3JtWzFdIHx8IFwiXCIsXG4gICAgdGFibGV0OiAhIXRhYmxldFsxXSxcbiAgICBtb2JpbGU6IHBsYXRmb3JtWzFdICYmICF0YWJsZXRbMV0gfHwgZmFsc2Vcbn07XG5pZiAoIXBsYXRmb3JtLnR5cGUpIHtcbiAgICBwbGF0Zm9ybS50eXBlID0gJ3BjJztcbn1cblxucGxhdGZvcm0ub3MgPSBwbGF0Zm9ybS50eXBlO1xuaWYgKHBsYXRmb3JtLnR5cGUgPT09ICdpcGFkJyB8fCBwbGF0Zm9ybS50eXBlID09PSAnaXBob25lJyB8fCBwbGF0Zm9ybS50eXBlID09PSAnaXBvZCcpIHtcbiAgICBwbGF0Zm9ybS5vcyA9ICdpb3MnO1xufSBlbHNlIGlmIChwbGF0Zm9ybS50eXBlID09PSAnYW5kcm9pZCcpIHtcbiAgICBwbGF0Zm9ybS5vcyA9ICdhbmRyb2lkJztcbn0gZWxzZSBpZiAobmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIldpblwiKSAhPT0gLTEpIHtcbiAgICBwbGF0Zm9ybS5vcyA9IFwid2luZG93c1wiO1xuICAgIHBsYXRmb3JtLnZlcnNpb24gPSBuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC93aW5bXiBdKiAoW147XSopL2kpO1xuICAgIHBsYXRmb3JtLnZlcnNpb24gPSBwbGF0Zm9ybS52ZXJzaW9uICYmIHBsYXRmb3JtLnZlcnNpb25bMV07XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJNYWNcIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcIm1hY29zXCI7XG59IGVsc2UgaWYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJYMTFcIikgIT09IC0xKSB7XG4gICAgcGxhdGZvcm0ub3MgPSBcInVuaXhcIjtcbn0gZWxzZSBpZiAobmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIkxpbnV4XCIpICE9PSAtMSkge1xuICAgIHBsYXRmb3JtLm9zID0gXCJsaW51eFwiO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0g0JTQtdGC0LXQutGC0LjRgNC+0LLQsNC90LjQtSDQsdC70L7QutC40YDQvtCy0LrQuCDQs9GA0L7QvNC60L7RgdGC0LhcbnZhciBub1ZvbHVtZSA9IHRydWU7XG50cnkge1xuICAgIHZhciBhdWRpbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2F1ZGlvJyk7XG4gICAgYXVkaW8udm9sdW1lID0gMC42MztcbiAgICBub1ZvbHVtZSA9IE1hdGguYWJzKGF1ZGlvLnZvbHVtZSAtIDAuNjMpID4gMC4wMTtcbn0gY2F0Y2goZSkge1xuICAgIG5vVm9sdW1lID0gdHJ1ZTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tINCt0LrRgdC/0L7RgNGCXG4vKipcbiAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+0LEg0L7QutGA0YPQttC10L3QuNC4XG4gKiBAbmFtZXNwYWNlXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgZGV0ZWN0ID0ge1xuICAgIC8qKlxuICAgICAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+INCx0YDQsNGD0LfQtdGA0LVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBuYW1lIC0g0L3QsNC30LLQsNC90LjQtSDQsdGA0LDRg9C30LXRgNCwXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHZlcnNpb24gLSDQstC10YDRgdC40Y9cbiAgICAgKiBAcHJvcGVydHkge251bWJlcn0gW2RvY3VtZW50TW9kZV0gLSDQstC10YDRgdC40Y8g0LTQvtC60YPQvNC10L3RgtCwXG4gICAgICovXG4gICAgYnJvd3NlcjogYnJvd3NlcixcblxuICAgIC8qKlxuICAgICAqINCY0L3RhNC+0YDQvNCw0YbQuNGPINC+INC/0LvQsNGC0YTQvtGA0LzQtVxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG9zIC0g0YLQuNC/INC+0L/QtdGA0LDRhtC40L7QvdC90L7QuSDRgdC40YHRgtC10LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0eXBlIC0g0YLQuNC/INC/0LvQsNGC0YTQvtGA0LzRi1xuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGFibGV0IC0g0L/Qu9Cw0L3RiNC10YJcbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IG1vYmlsZSAtINC80L7QsdC40LvRjNC90YvQuVxuICAgICAqL1xuICAgIHBsYXRmb3JtOiBwbGF0Zm9ybSxcblxuICAgIC8qKlxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQsCDQs9GA0L7QvNC60L7RgdGC0LhcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvbmx5RGV2aWNlVm9sdW1lOiBub1ZvbHVtZVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBkZXRlY3Q7XG4iLCIvKipcbiAqIEBsaWNlbnNlIFNXRk9iamVjdCB2Mi4yIDxodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0Lz5cbiAqIGlzIHJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZSA8aHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHA+XG4gKiBAcHJpdmF0ZVxuKi9cbnZhciBzd2ZvYmplY3QgPSBmdW5jdGlvbigpIHtcblx0dmFyIFVOREVGID0gXCJ1bmRlZmluZWRcIixcblx0XHRPQkpFQ1QgPSBcIm9iamVjdFwiLFxuXHRcdFNIT0NLV0FWRV9GTEFTSCA9IFwiU2hvY2t3YXZlIEZsYXNoXCIsXG5cdFx0U0hPQ0tXQVZFX0ZMQVNIX0FYID0gXCJTaG9ja3dhdmVGbGFzaC5TaG9ja3dhdmVGbGFzaFwiLFxuXHRcdEZMQVNIX01JTUVfVFlQRSA9IFwiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIixcblx0XHRFWFBSRVNTX0lOU1RBTExfSUQgPSBcIlNXRk9iamVjdEV4cHJJbnN0XCIsXG5cdFx0T05fUkVBRFlfU1RBVEVfQ0hBTkdFID0gXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIixcblx0XHR3aW4gPSB3aW5kb3csXG5cdFx0ZG9jID0gZG9jdW1lbnQsXG5cdFx0bmF2ID0gbmF2aWdhdG9yLFxuXHRcdHBsdWdpbiA9IGZhbHNlLFxuXHRcdGRvbUxvYWRGbkFyciA9IFttYWluXSxcblx0XHRyZWdPYmpBcnIgPSBbXSxcblx0XHRvYmpJZEFyciA9IFtdLFxuXHRcdGxpc3RlbmVyc0FyciA9IFtdLFxuXHRcdHN0b3JlZEFsdENvbnRlbnQsXG5cdFx0c3RvcmVkQWx0Q29udGVudElkLFxuXHRcdHN0b3JlZENhbGxiYWNrRm4sXG5cdFx0c3RvcmVkQ2FsbGJhY2tPYmosXG5cdFx0aXNEb21Mb2FkZWQgPSBmYWxzZSxcblx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gZmFsc2UsXG5cdFx0ZHluYW1pY1N0eWxlc2hlZXQsXG5cdFx0ZHluYW1pY1N0eWxlc2hlZXRNZWRpYSxcblx0XHRhdXRvSGlkZVNob3cgPSB0cnVlLFxuXHQvKiBDZW50cmFsaXplZCBmdW5jdGlvbiBmb3IgYnJvd3NlciBmZWF0dXJlIGRldGVjdGlvblxuXHRcdC0gVXNlciBhZ2VudCBzdHJpbmcgZGV0ZWN0aW9uIGlzIG9ubHkgdXNlZCB3aGVuIG5vIGdvb2QgYWx0ZXJuYXRpdmUgaXMgcG9zc2libGVcblx0XHQtIElzIGV4ZWN1dGVkIGRpcmVjdGx5IGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlXG5cdCovXG5cdHVhID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHczY2RvbSA9IHR5cGVvZiBkb2MuZ2V0RWxlbWVudEJ5SWQgIT0gVU5ERUYgJiYgdHlwZW9mIGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSAhPSBVTkRFRiAmJiB0eXBlb2YgZG9jLmNyZWF0ZUVsZW1lbnQgIT0gVU5ERUYsXG5cdFx0XHR1ID0gbmF2LnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0cCA9IG5hdi5wbGF0Zm9ybS50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0d2luZG93cyA9IHAgPyAvd2luLy50ZXN0KHApIDogL3dpbi8udGVzdCh1KSxcblx0XHRcdG1hYyA9IHAgPyAvbWFjLy50ZXN0KHApIDogL21hYy8udGVzdCh1KSxcblx0XHRcdHdlYmtpdCA9IC93ZWJraXQvLnRlc3QodSkgPyBwYXJzZUZsb2F0KHUucmVwbGFjZSgvXi4qd2Via2l0XFwvKFxcZCsoXFwuXFxkKyk/KS4qJC8sIFwiJDFcIikpIDogZmFsc2UsIC8vIHJldHVybnMgZWl0aGVyIHRoZSB3ZWJraXQgdmVyc2lvbiBvciBmYWxzZSBpZiBub3Qgd2Via2l0XG5cdFx0XHRpZSA9ICErXCJcXHYxXCIsIC8vIGZlYXR1cmUgZGV0ZWN0aW9uIGJhc2VkIG9uIEFuZHJlYSBHaWFtbWFyY2hpJ3Mgc29sdXRpb246IGh0dHA6Ly93ZWJyZWZsZWN0aW9uLmJsb2dzcG90LmNvbS8yMDA5LzAxLzMyLWJ5dGVzLXRvLWtub3ctaWYteW91ci1icm93c2VyLWlzLWllLmh0bWxcblx0XHRcdHBsYXllclZlcnNpb24gPSBbMCwwLDBdLFxuXHRcdFx0ZCA9IG51bGw7XG5cdFx0aWYgKHR5cGVvZiBuYXYucGx1Z2lucyAhPSBVTkRFRiAmJiB0eXBlb2YgbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXSA9PSBPQkpFQ1QpIHtcblx0XHRcdGQgPSBuYXYucGx1Z2luc1tTSE9DS1dBVkVfRkxBU0hdLmRlc2NyaXB0aW9uO1xuXHRcdFx0aWYgKGQgJiYgISh0eXBlb2YgbmF2Lm1pbWVUeXBlcyAhPSBVTkRFRiAmJiBuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0gJiYgIW5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXS5lbmFibGVkUGx1Z2luKSkgeyAvLyBuYXZpZ2F0b3IubWltZVR5cGVzW1wiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIl0uZW5hYmxlZFBsdWdpbiBpbmRpY2F0ZXMgd2hldGhlciBwbHVnLWlucyBhcmUgZW5hYmxlZCBvciBkaXNhYmxlZCBpbiBTYWZhcmkgMytcblx0XHRcdFx0cGx1Z2luID0gdHJ1ZTtcblx0XHRcdFx0aWUgPSBmYWxzZTsgLy8gY2FzY2FkZWQgZmVhdHVyZSBkZXRlY3Rpb24gZm9yIEludGVybmV0IEV4cGxvcmVyXG5cdFx0XHRcdGQgPSBkLnJlcGxhY2UoL14uKlxccysoXFxTK1xccytcXFMrJCkvLCBcIiQxXCIpO1xuXHRcdFx0XHRwbGF5ZXJWZXJzaW9uWzBdID0gcGFyc2VJbnQoZC5yZXBsYWNlKC9eKC4qKVxcLi4qJC8sIFwiJDFcIiksIDEwKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblsxXSA9IHBhcnNlSW50KGQucmVwbGFjZSgvXi4qXFwuKC4qKVxccy4qJC8sIFwiJDFcIiksIDEwKTtcblx0XHRcdFx0cGxheWVyVmVyc2lvblsyXSA9IC9bYS16QS1aXS8udGVzdChkKSA/IHBhcnNlSW50KGQucmVwbGFjZSgvXi4qW2EtekEtWl0rKC4qKSQvLCBcIiQxXCIpLCAxMCkgOiAwO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLkFjdGl2ZVhPYmplY3QgIT0gVU5ERUYpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBhID0gbmV3IEFjdGl2ZVhPYmplY3QoU0hPQ0tXQVZFX0ZMQVNIX0FYKTtcblx0XHRcdFx0aWYgKGEpIHsgLy8gYSB3aWxsIHJldHVybiBudWxsIHdoZW4gQWN0aXZlWCBpcyBkaXNhYmxlZFxuXHRcdFx0XHRcdGQgPSBhLkdldFZhcmlhYmxlKFwiJHZlcnNpb25cIik7XG5cdFx0XHRcdFx0aWYgKGQpIHtcblx0XHRcdFx0XHRcdGllID0gdHJ1ZTsgLy8gY2FzY2FkZWQgZmVhdHVyZSBkZXRlY3Rpb24gZm9yIEludGVybmV0IEV4cGxvcmVyXG5cdFx0XHRcdFx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdFx0XHRcdFx0cGxheWVyVmVyc2lvbiA9IFtwYXJzZUludChkWzBdLCAxMCksIHBhcnNlSW50KGRbMV0sIDEwKSwgcGFyc2VJbnQoZFsyXSwgMTApXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhdGNoKGUpIHt9XG5cdFx0fVxuXHRcdHJldHVybiB7IHczOnczY2RvbSwgcHY6cGxheWVyVmVyc2lvbiwgd2s6d2Via2l0LCBpZTppZSwgd2luOndpbmRvd3MsIG1hYzptYWMgfTtcblx0fSgpLFxuXHQvKiBDcm9zcy1icm93c2VyIG9uRG9tTG9hZFxuXHRcdC0gV2lsbCBmaXJlIGFuIGV2ZW50IGFzIHNvb24gYXMgdGhlIERPTSBvZiBhIHdlYiBwYWdlIGlzIGxvYWRlZFxuXHRcdC0gSW50ZXJuZXQgRXhwbG9yZXIgd29ya2Fyb3VuZCBiYXNlZCBvbiBEaWVnbyBQZXJpbmkncyBzb2x1dGlvbjogaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL0lFQ29udGVudExvYWRlZC9cblx0XHQtIFJlZ3VsYXIgb25sb2FkIHNlcnZlcyBhcyBmYWxsYmFja1xuXHQqL1xuXHRvbkRvbUxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIXVhLnczKSB7IHJldHVybjsgfVxuXHRcdGlmICgodHlwZW9mIGRvYy5yZWFkeVN0YXRlICE9IFVOREVGICYmIGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikgfHwgKHR5cGVvZiBkb2MucmVhZHlTdGF0ZSA9PSBVTkRFRiAmJiAoZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXSB8fCBkb2MuYm9keSkpKSB7IC8vIGZ1bmN0aW9uIGlzIGZpcmVkIGFmdGVyIG9ubG9hZCwgZS5nLiB3aGVuIHNjcmlwdCBpcyBpbnNlcnRlZCBkeW5hbWljYWxseVxuXHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHR9XG5cdFx0aWYgKCFpc0RvbUxvYWRlZCkge1xuXHRcdFx0aWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgY2FsbERvbUxvYWRGdW5jdGlvbnMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdFx0ZG9jLmF0dGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKGRvYy5yZWFkeVN0YXRlID09IFwiY29tcGxldGVcIikge1xuXHRcdFx0XHRcdFx0ZG9jLmRldGFjaEV2ZW50KE9OX1JFQURZX1NUQVRFX0NIQU5HRSwgYXJndW1lbnRzLmNhbGxlZSk7XG5cdFx0XHRcdFx0XHRjYWxsRG9tTG9hZEZ1bmN0aW9ucygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICh3aW4gPT0gdG9wKSB7IC8vIGlmIG5vdCBpbnNpZGUgYW4gaWZyYW1lXG5cdFx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRkb2MuZG9jdW1lbnRFbGVtZW50LmRvU2Nyb2xsKFwibGVmdFwiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoKGUpIHtcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAwKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbERvbUxvYWRGdW5jdGlvbnMoKTtcblx0XHRcdFx0XHR9KSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodWEud2spIHtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKGlzRG9tTG9hZGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICghL2xvYWRlZHxjb21wbGV0ZS8udGVzdChkb2MucmVhZHlTdGF0ZSkpIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxEb21Mb2FkRnVuY3Rpb25zKCk7XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRhZGRMb2FkRXZlbnQoY2FsbERvbUxvYWRGdW5jdGlvbnMpO1xuXHRcdH1cblx0fSgpO1xuXHRmdW5jdGlvbiBjYWxsRG9tTG9hZEZ1bmN0aW9ucygpIHtcblx0XHRpZiAoaXNEb21Mb2FkZWQpIHsgcmV0dXJuOyB9XG5cdFx0dHJ5IHsgLy8gdGVzdCBpZiB3ZSBjYW4gcmVhbGx5IGFkZC9yZW1vdmUgZWxlbWVudHMgdG8vZnJvbSB0aGUgRE9NOyB3ZSBkb24ndCB3YW50IHRvIGZpcmUgaXQgdG9vIGVhcmx5XG5cdFx0XHR2YXIgdCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF0uYXBwZW5kQ2hpbGQoY3JlYXRlRWxlbWVudChcInNwYW5cIikpO1xuXHRcdFx0dC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkgeyByZXR1cm47IH1cblx0XHRpc0RvbUxvYWRlZCA9IHRydWU7XG5cdFx0dmFyIGRsID0gZG9tTG9hZEZuQXJyLmxlbmd0aDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRsOyBpKyspIHtcblx0XHRcdGRvbUxvYWRGbkFycltpXSgpO1xuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBhZGREb21Mb2FkRXZlbnQoZm4pIHtcblx0XHRpZiAoaXNEb21Mb2FkZWQpIHtcblx0XHRcdGZuKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZG9tTG9hZEZuQXJyW2RvbUxvYWRGbkFyci5sZW5ndGhdID0gZm47IC8vIEFycmF5LnB1c2goKSBpcyBvbmx5IGF2YWlsYWJsZSBpbiBJRTUuNStcblx0XHR9XG5cdH1cblx0LyogQ3Jvc3MtYnJvd3NlciBvbmxvYWRcblx0XHQtIEJhc2VkIG9uIEphbWVzIEVkd2FyZHMnIHNvbHV0aW9uOiBodHRwOi8vYnJvdGhlcmNha2UuY29tL3NpdGUvcmVzb3VyY2VzL3NjcmlwdHMvb25sb2FkL1xuXHRcdC0gV2lsbCBmaXJlIGFuIGV2ZW50IGFzIHNvb24gYXMgYSB3ZWIgcGFnZSBpbmNsdWRpbmcgYWxsIG9mIGl0cyBhc3NldHMgYXJlIGxvYWRlZFxuXHQgKi9cblx0ZnVuY3Rpb24gYWRkTG9hZEV2ZW50KGZuKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW4uYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0d2luLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZuLCBmYWxzZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiBkb2MuYWRkRXZlbnRMaXN0ZW5lciAhPSBVTkRFRikge1xuXHRcdFx0ZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZuLCBmYWxzZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB3aW4uYXR0YWNoRXZlbnQgIT0gVU5ERUYpIHtcblx0XHRcdGFkZExpc3RlbmVyKHdpbiwgXCJvbmxvYWRcIiwgZm4pO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2Ygd2luLm9ubG9hZCA9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHZhciBmbk9sZCA9IHdpbi5vbmxvYWQ7XG5cdFx0XHR3aW4ub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZuT2xkKCk7XG5cdFx0XHRcdGZuKCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHdpbi5vbmxvYWQgPSBmbjtcblx0XHR9XG5cdH1cblx0LyogTWFpbiBmdW5jdGlvblxuXHRcdC0gV2lsbCBwcmVmZXJhYmx5IGV4ZWN1dGUgb25Eb21Mb2FkLCBvdGhlcndpc2Ugb25sb2FkIChhcyBhIGZhbGxiYWNrKVxuXHQqL1xuXHRmdW5jdGlvbiBtYWluKCkge1xuXHRcdGlmIChwbHVnaW4pIHtcblx0XHRcdHRlc3RQbGF5ZXJWZXJzaW9uKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdH1cblx0fVxuXHQvKiBEZXRlY3QgdGhlIEZsYXNoIFBsYXllciB2ZXJzaW9uIGZvciBub24tSW50ZXJuZXQgRXhwbG9yZXIgYnJvd3NlcnNcblx0XHQtIERldGVjdGluZyB0aGUgcGx1Zy1pbiB2ZXJzaW9uIHZpYSB0aGUgb2JqZWN0IGVsZW1lbnQgaXMgbW9yZSBwcmVjaXNlIHRoYW4gdXNpbmcgdGhlIHBsdWdpbnMgY29sbGVjdGlvbiBpdGVtJ3MgZGVzY3JpcHRpb246XG5cdFx0ICBhLiBCb3RoIHJlbGVhc2UgYW5kIGJ1aWxkIG51bWJlcnMgY2FuIGJlIGRldGVjdGVkXG5cdFx0ICBiLiBBdm9pZCB3cm9uZyBkZXNjcmlwdGlvbnMgYnkgY29ycnVwdCBpbnN0YWxsZXJzIHByb3ZpZGVkIGJ5IEFkb2JlXG5cdFx0ICBjLiBBdm9pZCB3cm9uZyBkZXNjcmlwdGlvbnMgYnkgbXVsdGlwbGUgRmxhc2ggUGxheWVyIGVudHJpZXMgaW4gdGhlIHBsdWdpbiBBcnJheSwgY2F1c2VkIGJ5IGluY29ycmVjdCBicm93c2VyIGltcG9ydHNcblx0XHQtIERpc2FkdmFudGFnZSBvZiB0aGlzIG1ldGhvZCBpcyB0aGF0IGl0IGRlcGVuZHMgb24gdGhlIGF2YWlsYWJpbGl0eSBvZiB0aGUgRE9NLCB3aGlsZSB0aGUgcGx1Z2lucyBjb2xsZWN0aW9uIGlzIGltbWVkaWF0ZWx5IGF2YWlsYWJsZVxuXHQqL1xuXHRmdW5jdGlvbiB0ZXN0UGxheWVyVmVyc2lvbigpIHtcblx0XHR2YXIgYiA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF07XG5cdFx0dmFyIG8gPSBjcmVhdGVFbGVtZW50KE9CSkVDVCk7XG5cdFx0by5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIEZMQVNIX01JTUVfVFlQRSk7XG5cdFx0dmFyIHQgPSBiLmFwcGVuZENoaWxkKG8pO1xuXHRcdGlmICh0KSB7XG5cdFx0XHR2YXIgY291bnRlciA9IDA7XG5cdFx0XHQoZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKHR5cGVvZiB0LkdldFZhcmlhYmxlICE9IFVOREVGKSB7XG5cdFx0XHRcdFx0dmFyIGQgPSB0LkdldFZhcmlhYmxlKFwiJHZlcnNpb25cIik7XG5cdFx0XHRcdFx0aWYgKGQpIHtcblx0XHRcdFx0XHRcdGQgPSBkLnNwbGl0KFwiIFwiKVsxXS5zcGxpdChcIixcIik7XG5cdFx0XHRcdFx0XHR1YS5wdiA9IFtwYXJzZUludChkWzBdLCAxMCksIHBhcnNlSW50KGRbMV0sIDEwKSwgcGFyc2VJbnQoZFsyXSwgMTApXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoY291bnRlciA8IDEwKSB7XG5cdFx0XHRcdFx0Y291bnRlcisrO1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRiLnJlbW92ZUNoaWxkKG8pO1xuXHRcdFx0XHR0ID0gbnVsbDtcblx0XHRcdFx0bWF0Y2hWZXJzaW9ucygpO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRtYXRjaFZlcnNpb25zKCk7XG5cdFx0fVxuXHR9XG5cdC8qIFBlcmZvcm0gRmxhc2ggUGxheWVyIGFuZCBTV0YgdmVyc2lvbiBtYXRjaGluZzsgc3RhdGljIHB1Ymxpc2hpbmcgb25seVxuXHQqL1xuXHRmdW5jdGlvbiBtYXRjaFZlcnNpb25zKCkge1xuXHRcdHZhciBybCA9IHJlZ09iakFyci5sZW5ndGg7XG5cdFx0aWYgKHJsID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBybDsgaSsrKSB7IC8vIGZvciBlYWNoIHJlZ2lzdGVyZWQgb2JqZWN0IGVsZW1lbnRcblx0XHRcdFx0dmFyIGlkID0gcmVnT2JqQXJyW2ldLmlkO1xuXHRcdFx0XHR2YXIgY2IgPSByZWdPYmpBcnJbaV0uY2FsbGJhY2tGbjtcblx0XHRcdFx0dmFyIGNiT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOmlkfTtcblx0XHRcdFx0aWYgKHVhLnB2WzBdID4gMCkge1xuXHRcdFx0XHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0XHRcdFx0aWYgKG9iaikge1xuXHRcdFx0XHRcdFx0aWYgKGhhc1BsYXllclZlcnNpb24ocmVnT2JqQXJyW2ldLnN3ZlZlcnNpb24pICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpKSB7IC8vIEZsYXNoIFBsYXllciB2ZXJzaW9uID49IHB1Ymxpc2hlZCBTV0YgdmVyc2lvbjogSG91c3Rvbiwgd2UgaGF2ZSBhIG1hdGNoIVxuXHRcdFx0XHRcdFx0XHRzZXRWaXNpYmlsaXR5KGlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNiKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2JPYmouc3VjY2VzcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0Y2JPYmoucmVmID0gZ2V0T2JqZWN0QnlJZChpZCk7XG5cdFx0XHRcdFx0XHRcdFx0Y2IoY2JPYmopO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChyZWdPYmpBcnJbaV0uZXhwcmVzc0luc3RhbGwgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkgeyAvLyBzaG93IHRoZSBBZG9iZSBFeHByZXNzIEluc3RhbGwgZGlhbG9nIGlmIHNldCBieSB0aGUgd2ViIHBhZ2UgYXV0aG9yIGFuZCBpZiBzdXBwb3J0ZWRcblx0XHRcdFx0XHRcdFx0dmFyIGF0dCA9IHt9O1xuXHRcdFx0XHRcdFx0XHRhdHQuZGF0YSA9IHJlZ09iakFycltpXS5leHByZXNzSW5zdGFsbDtcblx0XHRcdFx0XHRcdFx0YXR0LndpZHRoID0gb2JqLmdldEF0dHJpYnV0ZShcIndpZHRoXCIpIHx8IFwiMFwiO1xuXHRcdFx0XHRcdFx0XHRhdHQuaGVpZ2h0ID0gb2JqLmdldEF0dHJpYnV0ZShcImhlaWdodFwiKSB8fCBcIjBcIjtcblx0XHRcdFx0XHRcdFx0aWYgKG9iai5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKSkgeyBhdHQuc3R5bGVjbGFzcyA9IG9iai5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTsgfVxuXHRcdFx0XHRcdFx0XHRpZiAob2JqLmdldEF0dHJpYnV0ZShcImFsaWduXCIpKSB7IGF0dC5hbGlnbiA9IG9iai5nZXRBdHRyaWJ1dGUoXCJhbGlnblwiKTsgfVxuXHRcdFx0XHRcdFx0XHQvLyBwYXJzZSBIVE1MIG9iamVjdCBwYXJhbSBlbGVtZW50J3MgbmFtZS12YWx1ZSBwYWlyc1xuXHRcdFx0XHRcdFx0XHR2YXIgcGFyID0ge307XG5cdFx0XHRcdFx0XHRcdHZhciBwID0gb2JqLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwicGFyYW1cIik7XG5cdFx0XHRcdFx0XHRcdHZhciBwbCA9IHAubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHBsOyBqKyspIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocFtqXS5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpLnRvTG93ZXJDYXNlKCkgIT0gXCJtb3ZpZVwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRwYXJbcFtqXS5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpXSA9IHBbal0uZ2V0QXR0cmlidXRlKFwidmFsdWVcIik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgaWQsIGNiKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgeyAvLyBGbGFzaCBQbGF5ZXIgYW5kIFNXRiB2ZXJzaW9uIG1pc21hdGNoIG9yIGFuIG9sZGVyIFdlYmtpdCBlbmdpbmUgdGhhdCBpZ25vcmVzIHRoZSBIVE1MIG9iamVjdCBlbGVtZW50J3MgbmVzdGVkIHBhcmFtIGVsZW1lbnRzOiBkaXNwbGF5IGFsdGVybmF0aXZlIGNvbnRlbnQgaW5zdGVhZCBvZiBTV0Zcblx0XHRcdFx0XHRcdFx0ZGlzcGxheUFsdENvbnRlbnQob2JqKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNiKSB7IGNiKGNiT2JqKTsgfVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcdC8vIGlmIG5vIEZsYXNoIFBsYXllciBpcyBpbnN0YWxsZWQgb3IgdGhlIGZwIHZlcnNpb24gY2Fubm90IGJlIGRldGVjdGVkIHdlIGxldCB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCBkbyBpdHMgam9iIChlaXRoZXIgc2hvdyBhIFNXRiBvciBhbHRlcm5hdGl2ZSBjb250ZW50KVxuXHRcdFx0XHRcdHNldFZpc2liaWxpdHkoaWQsIHRydWUpO1xuXHRcdFx0XHRcdGlmIChjYikge1xuXHRcdFx0XHRcdFx0dmFyIG8gPSBnZXRPYmplY3RCeUlkKGlkKTsgLy8gdGVzdCB3aGV0aGVyIHRoZXJlIGlzIGFuIEhUTUwgb2JqZWN0IGVsZW1lbnQgb3Igbm90XG5cdFx0XHRcdFx0XHRpZiAobyAmJiB0eXBlb2Ygby5TZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRcdFx0XHRjYk9iai5zdWNjZXNzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0Y2JPYmoucmVmID0gbztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNiKGNiT2JqKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gZ2V0T2JqZWN0QnlJZChvYmplY3RJZFN0cikge1xuXHRcdHZhciByID0gbnVsbDtcblx0XHR2YXIgbyA9IGdldEVsZW1lbnRCeUlkKG9iamVjdElkU3RyKTtcblx0XHRpZiAobyAmJiBvLm5vZGVOYW1lID09IFwiT0JKRUNUXCIpIHtcblx0XHRcdGlmICh0eXBlb2Ygby5TZXRWYXJpYWJsZSAhPSBVTkRFRikge1xuXHRcdFx0XHRyID0gbztcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgbiA9IG8uZ2V0RWxlbWVudHNCeVRhZ05hbWUoT0JKRUNUKVswXTtcblx0XHRcdFx0aWYgKG4pIHtcblx0XHRcdFx0XHRyID0gbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXHQvKiBSZXF1aXJlbWVudHMgZm9yIEFkb2JlIEV4cHJlc3MgSW5zdGFsbFxuXHRcdC0gb25seSBvbmUgaW5zdGFuY2UgY2FuIGJlIGFjdGl2ZSBhdCBhIHRpbWVcblx0XHQtIGZwIDYuMC42NSBvciBoaWdoZXJcblx0XHQtIFdpbi9NYWMgT1Mgb25seVxuXHRcdC0gbm8gV2Via2l0IGVuZ2luZXMgb2xkZXIgdGhhbiB2ZXJzaW9uIDMxMlxuXHQqL1xuXHRmdW5jdGlvbiBjYW5FeHByZXNzSW5zdGFsbCgpIHtcblx0XHRyZXR1cm4gIWlzRXhwcmVzc0luc3RhbGxBY3RpdmUgJiYgaGFzUGxheWVyVmVyc2lvbihcIjYuMC42NVwiKSAmJiAodWEud2luIHx8IHVhLm1hYykgJiYgISh1YS53ayAmJiB1YS53ayA8IDMxMik7XG5cdH1cblx0LyogU2hvdyB0aGUgQWRvYmUgRXhwcmVzcyBJbnN0YWxsIGRpYWxvZ1xuXHRcdC0gUmVmZXJlbmNlOiBodHRwOi8vd3d3LmFkb2JlLmNvbS9jZnVzaW9uL2tub3dsZWRnZWJhc2UvaW5kZXguY2ZtP2lkPTZhMjUzYjc1XG5cdCovXG5cdGZ1bmN0aW9uIHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbikge1xuXHRcdGlzRXhwcmVzc0luc3RhbGxBY3RpdmUgPSB0cnVlO1xuXHRcdHN0b3JlZENhbGxiYWNrRm4gPSBjYWxsYmFja0ZuIHx8IG51bGw7XG5cdFx0c3RvcmVkQ2FsbGJhY2tPYmogPSB7c3VjY2VzczpmYWxzZSwgaWQ6cmVwbGFjZUVsZW1JZFN0cn07XG5cdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdGlmIChvYmopIHtcblx0XHRcdGlmIChvYmoubm9kZU5hbWUgPT0gXCJPQkpFQ1RcIikgeyAvLyBzdGF0aWMgcHVibGlzaGluZ1xuXHRcdFx0XHRzdG9yZWRBbHRDb250ZW50ID0gYWJzdHJhY3RBbHRDb250ZW50KG9iaik7XG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnRJZCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHsgLy8gZHluYW1pYyBwdWJsaXNoaW5nXG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnQgPSBvYmo7XG5cdFx0XHRcdHN0b3JlZEFsdENvbnRlbnRJZCA9IHJlcGxhY2VFbGVtSWRTdHI7XG5cdFx0XHR9XG5cdFx0XHRhdHQuaWQgPSBFWFBSRVNTX0lOU1RBTExfSUQ7XG5cdFx0XHRpZiAodHlwZW9mIGF0dC53aWR0aCA9PSBVTkRFRiB8fCAoIS8lJC8udGVzdChhdHQud2lkdGgpICYmIHBhcnNlSW50KGF0dC53aWR0aCwgMTApIDwgMzEwKSkgeyBhdHQud2lkdGggPSBcIjMxMFwiOyB9XG5cdFx0XHRpZiAodHlwZW9mIGF0dC5oZWlnaHQgPT0gVU5ERUYgfHwgKCEvJSQvLnRlc3QoYXR0LmhlaWdodCkgJiYgcGFyc2VJbnQoYXR0LmhlaWdodCwgMTApIDwgMTM3KSkgeyBhdHQuaGVpZ2h0ID0gXCIxMzdcIjsgfVxuXHRcdFx0ZG9jLnRpdGxlID0gZG9jLnRpdGxlLnNsaWNlKDAsIDQ3KSArIFwiIC0gRmxhc2ggUGxheWVyIEluc3RhbGxhdGlvblwiO1xuXHRcdFx0dmFyIHB0ID0gdWEuaWUgJiYgdWEud2luID8gXCJBY3RpdmVYXCIgOiBcIlBsdWdJblwiLFxuXHRcdFx0XHRmdiA9IFwiTU1yZWRpcmVjdFVSTD1cIiArIHdpbi5sb2NhdGlvbi50b1N0cmluZygpLnJlcGxhY2UoLyYvZyxcIiUyNlwiKSArIFwiJk1NcGxheWVyVHlwZT1cIiArIHB0ICsgXCImTU1kb2N0aXRsZT1cIiArIGRvYy50aXRsZTtcblx0XHRcdGlmICh0eXBlb2YgcGFyLmZsYXNodmFycyAhPSBVTkRFRikge1xuXHRcdFx0XHRwYXIuZmxhc2h2YXJzICs9IFwiJlwiICsgZnY7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cGFyLmZsYXNodmFycyA9IGZ2O1xuXHRcdFx0fVxuXHRcdFx0Ly8gSUUgb25seTogd2hlbiBhIFNXRiBpcyBsb2FkaW5nIChBTkQ6IG5vdCBhdmFpbGFibGUgaW4gY2FjaGUpIHdhaXQgZm9yIHRoZSByZWFkeVN0YXRlIG9mIHRoZSBvYmplY3QgZWxlbWVudCB0byBiZWNvbWUgNCBiZWZvcmUgcmVtb3ZpbmcgaXQsXG5cdFx0XHQvLyBiZWNhdXNlIHlvdSBjYW5ub3QgcHJvcGVybHkgY2FuY2VsIGEgbG9hZGluZyBTV0YgZmlsZSB3aXRob3V0IGJyZWFraW5nIGJyb3dzZXIgbG9hZCByZWZlcmVuY2VzLCBhbHNvIG9iai5vbnJlYWR5c3RhdGVjaGFuZ2UgZG9lc24ndCB3b3JrXG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luICYmIG9iai5yZWFkeVN0YXRlICE9IDQpIHtcblx0XHRcdFx0dmFyIG5ld09iaiA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0XHRcdHJlcGxhY2VFbGVtSWRTdHIgKz0gXCJTV0ZPYmplY3ROZXdcIjtcblx0XHRcdFx0bmV3T2JqLnNldEF0dHJpYnV0ZShcImlkXCIsIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0XHRvYmoucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobmV3T2JqLCBvYmopOyAvLyBpbnNlcnQgcGxhY2Vob2xkZXIgZGl2IHRoYXQgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgb2JqZWN0IGVsZW1lbnQgdGhhdCBsb2FkcyBleHByZXNzaW5zdGFsbC5zd2Zcblx0XHRcdFx0b2JqLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdFx0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYgKG9iai5yZWFkeVN0YXRlID09IDQpIHtcblx0XHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpO1xuXHRcdFx0fVxuXHRcdFx0Y3JlYXRlU1dGKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyKTtcblx0XHR9XG5cdH1cblx0LyogRnVuY3Rpb25zIHRvIGFic3RyYWN0IGFuZCBkaXNwbGF5IGFsdGVybmF0aXZlIGNvbnRlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZGlzcGxheUFsdENvbnRlbnQob2JqKSB7XG5cdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiBvYmoucmVhZHlTdGF0ZSAhPSA0KSB7XG5cdFx0XHQvLyBJRSBvbmx5OiB3aGVuIGEgU1dGIGlzIGxvYWRpbmcgKEFORDogbm90IGF2YWlsYWJsZSBpbiBjYWNoZSkgd2FpdCBmb3IgdGhlIHJlYWR5U3RhdGUgb2YgdGhlIG9iamVjdCBlbGVtZW50IHRvIGJlY29tZSA0IGJlZm9yZSByZW1vdmluZyBpdCxcblx0XHRcdC8vIGJlY2F1c2UgeW91IGNhbm5vdCBwcm9wZXJseSBjYW5jZWwgYSBsb2FkaW5nIFNXRiBmaWxlIHdpdGhvdXQgYnJlYWtpbmcgYnJvd3NlciBsb2FkIHJlZmVyZW5jZXMsIGFsc28gb2JqLm9ucmVhZHlzdGF0ZWNoYW5nZSBkb2Vzbid0IHdvcmtcblx0XHRcdHZhciBlbCA9IGNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0XHRvYmoucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZWwsIG9iaik7IC8vIGluc2VydCBwbGFjZWhvbGRlciBkaXYgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBhbHRlcm5hdGl2ZSBjb250ZW50XG5cdFx0XHRlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChhYnN0cmFjdEFsdENvbnRlbnQob2JqKSwgZWwpO1xuXHRcdFx0b2JqLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRpZiAob2JqLnJlYWR5U3RhdGUgPT0gNCkge1xuXHRcdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0c2V0VGltZW91dChhcmd1bWVudHMuY2FsbGVlLCAxMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0b2JqLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGFic3RyYWN0QWx0Q29udGVudChvYmopLCBvYmopO1xuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBhYnN0cmFjdEFsdENvbnRlbnQob2JqKSB7XG5cdFx0dmFyIGFjID0gY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRpZiAodWEud2luICYmIHVhLmllKSB7XG5cdFx0XHRhYy5pbm5lckhUTUwgPSBvYmouaW5uZXJIVE1MO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHZhciBuZXN0ZWRPYmogPSBvYmouZ2V0RWxlbWVudHNCeVRhZ05hbWUoT0JKRUNUKVswXTtcblx0XHRcdGlmIChuZXN0ZWRPYmopIHtcblx0XHRcdFx0dmFyIGMgPSBuZXN0ZWRPYmouY2hpbGROb2Rlcztcblx0XHRcdFx0aWYgKGMpIHtcblx0XHRcdFx0XHR2YXIgY2wgPSBjLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNsOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmICghKGNbaV0ubm9kZVR5cGUgPT0gMSAmJiBjW2ldLm5vZGVOYW1lID09IFwiUEFSQU1cIikgJiYgIShjW2ldLm5vZGVUeXBlID09IDgpKSB7XG5cdFx0XHRcdFx0XHRcdGFjLmFwcGVuZENoaWxkKGNbaV0uY2xvbmVOb2RlKHRydWUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGFjO1xuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgZHluYW1pYyBTV0YgY3JlYXRpb25cblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlU1dGKGF0dE9iaiwgcGFyT2JqLCBpZCkge1xuXHRcdHZhciByLCBlbCA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRpZiAodWEud2sgJiYgdWEud2sgPCAzMTIpIHsgcmV0dXJuIHI7IH1cblx0XHRpZiAoZWwpIHtcblx0XHRcdGlmICh0eXBlb2YgYXR0T2JqLmlkID09IFVOREVGKSB7IC8vIGlmIG5vICdpZCcgaXMgZGVmaW5lZCBmb3IgdGhlIG9iamVjdCBlbGVtZW50LCBpdCB3aWxsIGluaGVyaXQgdGhlICdpZCcgZnJvbSB0aGUgYWx0ZXJuYXRpdmUgY29udGVudFxuXHRcdFx0XHRhdHRPYmouaWQgPSBpZDtcblx0XHRcdH1cblx0XHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHsgLy8gSW50ZXJuZXQgRXhwbG9yZXIgKyB0aGUgSFRNTCBvYmplY3QgZWxlbWVudCArIFczQyBET00gbWV0aG9kcyBkbyBub3QgY29tYmluZTogZmFsbCBiYWNrIHRvIG91dGVySFRNTFxuXHRcdFx0XHR2YXIgYXR0ID0gXCJcIjtcblx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhdHRPYmopIHtcblx0XHRcdFx0XHRpZiAoYXR0T2JqW2ldICE9IE9iamVjdC5wcm90b3R5cGVbaV0pIHsgLy8gZmlsdGVyIG91dCBwcm90b3R5cGUgYWRkaXRpb25zIGZyb20gb3RoZXIgcG90ZW50aWFsIGxpYnJhcmllc1xuXHRcdFx0XHRcdFx0aWYgKGkudG9Mb3dlckNhc2UoKSA9PSBcImRhdGFcIikge1xuXHRcdFx0XHRcdFx0XHRwYXJPYmoubW92aWUgPSBhdHRPYmpbaV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChpLnRvTG93ZXJDYXNlKCkgPT0gXCJzdHlsZWNsYXNzXCIpIHsgLy8gJ2NsYXNzJyBpcyBhbiBFQ01BNCByZXNlcnZlZCBrZXl3b3JkXG5cdFx0XHRcdFx0XHRcdGF0dCArPSAnIGNsYXNzPVwiJyArIGF0dE9ialtpXSArICdcIic7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChpLnRvTG93ZXJDYXNlKCkgIT0gXCJjbGFzc2lkXCIpIHtcblx0XHRcdFx0XHRcdFx0YXR0ICs9ICcgJyArIGkgKyAnPVwiJyArIGF0dE9ialtpXSArICdcIic7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBwYXIgPSBcIlwiO1xuXHRcdFx0XHRmb3IgKHZhciBqIGluIHBhck9iaikge1xuXHRcdFx0XHRcdGlmIChwYXJPYmpbal0gIT0gT2JqZWN0LnByb3RvdHlwZVtqXSkgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzXG5cdFx0XHRcdFx0XHRwYXIgKz0gJzxwYXJhbSBuYW1lPVwiJyArIGogKyAnXCIgdmFsdWU9XCInICsgcGFyT2JqW2pdICsgJ1wiIC8+Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWwub3V0ZXJIVE1MID0gJzxvYmplY3QgY2xhc3NpZD1cImNsc2lkOkQyN0NEQjZFLUFFNkQtMTFjZi05NkI4LTQ0NDU1MzU0MDAwMFwiJyArIGF0dCArICc+JyArIHBhciArICc8L29iamVjdD4nO1xuXHRcdFx0XHRvYmpJZEFycltvYmpJZEFyci5sZW5ndGhdID0gYXR0T2JqLmlkOyAvLyBzdG9yZWQgdG8gZml4IG9iamVjdCAnbGVha3MnIG9uIHVubG9hZCAoZHluYW1pYyBwdWJsaXNoaW5nIG9ubHkpXG5cdFx0XHRcdHIgPSBnZXRFbGVtZW50QnlJZChhdHRPYmouaWQpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7IC8vIHdlbGwtYmVoYXZpbmcgYnJvd3NlcnNcblx0XHRcdFx0dmFyIG8gPSBjcmVhdGVFbGVtZW50KE9CSkVDVCk7XG5cdFx0XHRcdG8uc2V0QXR0cmlidXRlKFwidHlwZVwiLCBGTEFTSF9NSU1FX1RZUEUpO1xuXHRcdFx0XHRmb3IgKHZhciBtIGluIGF0dE9iaikge1xuXHRcdFx0XHRcdGlmIChhdHRPYmpbbV0gIT0gT2JqZWN0LnByb3RvdHlwZVttXSkgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzXG5cdFx0XHRcdFx0XHRpZiAobS50b0xvd2VyQ2FzZSgpID09IFwic3R5bGVjbGFzc1wiKSB7IC8vICdjbGFzcycgaXMgYW4gRUNNQTQgcmVzZXJ2ZWQga2V5d29yZFxuXHRcdFx0XHRcdFx0XHRvLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIGF0dE9ialttXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmIChtLnRvTG93ZXJDYXNlKCkgIT0gXCJjbGFzc2lkXCIpIHsgLy8gZmlsdGVyIG91dCBJRSBzcGVjaWZpYyBhdHRyaWJ1dGVcblx0XHRcdFx0XHRcdFx0by5zZXRBdHRyaWJ1dGUobSwgYXR0T2JqW21dKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICh2YXIgbiBpbiBwYXJPYmopIHtcblx0XHRcdFx0XHRpZiAocGFyT2JqW25dICE9IE9iamVjdC5wcm90b3R5cGVbbl0gJiYgbi50b0xvd2VyQ2FzZSgpICE9IFwibW92aWVcIikgeyAvLyBmaWx0ZXIgb3V0IHByb3RvdHlwZSBhZGRpdGlvbnMgZnJvbSBvdGhlciBwb3RlbnRpYWwgbGlicmFyaWVzIGFuZCBJRSBzcGVjaWZpYyBwYXJhbSBlbGVtZW50XG5cdFx0XHRcdFx0XHRjcmVhdGVPYmpQYXJhbShvLCBuLCBwYXJPYmpbbl0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChvLCBlbCk7XG5cdFx0XHRcdHIgPSBvO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVPYmpQYXJhbShlbCwgcE5hbWUsIHBWYWx1ZSkge1xuXHRcdHZhciBwID0gY3JlYXRlRWxlbWVudChcInBhcmFtXCIpO1xuXHRcdHAuc2V0QXR0cmlidXRlKFwibmFtZVwiLCBwTmFtZSk7XG5cdFx0cC5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLCBwVmFsdWUpO1xuXHRcdGVsLmFwcGVuZENoaWxkKHApO1xuXHR9XG5cdC8qIENyb3NzLWJyb3dzZXIgU1dGIHJlbW92YWxcblx0XHQtIEVzcGVjaWFsbHkgbmVlZGVkIHRvIHNhZmVseSBhbmQgY29tcGxldGVseSByZW1vdmUgYSBTV0YgaW4gSW50ZXJuZXQgRXhwbG9yZXJcblx0Ki9cblx0ZnVuY3Rpb24gcmVtb3ZlU1dGKGlkKSB7XG5cdFx0dmFyIG9iaiA9IGdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRpZiAob2JqICYmIG9iai5ub2RlTmFtZSA9PSBcIk9CSkVDVFwiKSB7XG5cdFx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRyZW1vdmVPYmplY3RJbklFKGlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGFyZ3VtZW50cy5jYWxsZWUsIDEwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gcmVtb3ZlT2JqZWN0SW5JRShpZCkge1xuXHRcdHZhciBvYmogPSBnZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0Zm9yICh2YXIgaSBpbiBvYmopIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBvYmpbaV0gPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0b2JqW2ldID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHR9XG5cdH1cblx0LyogRnVuY3Rpb25zIHRvIG9wdGltaXplIEphdmFTY3JpcHQgY29tcHJlc3Npb25cblx0Ki9cblx0ZnVuY3Rpb24gZ2V0RWxlbWVudEJ5SWQoaWQpIHtcblx0XHR2YXIgZWwgPSBudWxsO1xuXHRcdHRyeSB7XG5cdFx0XHRlbCA9IGRvYy5nZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0fVxuXHRcdGNhdGNoIChlKSB7fVxuXHRcdHJldHVybiBlbDtcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVFbGVtZW50KGVsKSB7XG5cdFx0cmV0dXJuIGRvYy5jcmVhdGVFbGVtZW50KGVsKTtcblx0fVxuXHQvKiBVcGRhdGVkIGF0dGFjaEV2ZW50IGZ1bmN0aW9uIGZvciBJbnRlcm5ldCBFeHBsb3JlclxuXHRcdC0gU3RvcmVzIGF0dGFjaEV2ZW50IGluZm9ybWF0aW9uIGluIGFuIEFycmF5LCBzbyBvbiB1bmxvYWQgdGhlIGRldGFjaEV2ZW50IGZ1bmN0aW9ucyBjYW4gYmUgY2FsbGVkIHRvIGF2b2lkIG1lbW9yeSBsZWFrc1xuXHQqL1xuXHRmdW5jdGlvbiBhZGRMaXN0ZW5lcih0YXJnZXQsIGV2ZW50VHlwZSwgZm4pIHtcblx0XHR0YXJnZXQuYXR0YWNoRXZlbnQoZXZlbnRUeXBlLCBmbik7XG5cdFx0bGlzdGVuZXJzQXJyW2xpc3RlbmVyc0Fyci5sZW5ndGhdID0gW3RhcmdldCwgZXZlbnRUeXBlLCBmbl07XG5cdH1cblx0LyogRmxhc2ggUGxheWVyIGFuZCBTV0YgY29udGVudCB2ZXJzaW9uIG1hdGNoaW5nXG5cdCovXG5cdGZ1bmN0aW9uIGhhc1BsYXllclZlcnNpb24ocnYpIHtcblx0XHR2YXIgcHYgPSB1YS5wdiwgdiA9IHJ2LnNwbGl0KFwiLlwiKTtcblx0XHR2WzBdID0gcGFyc2VJbnQodlswXSwgMTApO1xuXHRcdHZbMV0gPSBwYXJzZUludCh2WzFdLCAxMCkgfHwgMDsgLy8gc3VwcG9ydHMgc2hvcnQgbm90YXRpb24sIGUuZy4gXCI5XCIgaW5zdGVhZCBvZiBcIjkuMC4wXCJcblx0XHR2WzJdID0gcGFyc2VJbnQodlsyXSwgMTApIHx8IDA7XG5cdFx0cmV0dXJuIChwdlswXSA+IHZbMF0gfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPiB2WzFdKSB8fCAocHZbMF0gPT0gdlswXSAmJiBwdlsxXSA9PSB2WzFdICYmIHB2WzJdID49IHZbMl0pKSA/IHRydWUgOiBmYWxzZTtcblx0fVxuXHQvKiBDcm9zcy1icm93c2VyIGR5bmFtaWMgQ1NTIGNyZWF0aW9uXG5cdFx0LSBCYXNlZCBvbiBCb2JieSB2YW4gZGVyIFNsdWlzJyBzb2x1dGlvbjogaHR0cDovL3d3dy5ib2JieXZhbmRlcnNsdWlzLmNvbS9hcnRpY2xlcy9keW5hbWljQ1NTLnBocFxuXHQqL1xuXHRmdW5jdGlvbiBjcmVhdGVDU1Moc2VsLCBkZWNsLCBtZWRpYSwgbmV3U3R5bGUpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEubWFjKSB7IHJldHVybjsgfVxuXHRcdHZhciBoID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaGVhZFwiKVswXTtcblx0XHRpZiAoIWgpIHsgcmV0dXJuOyB9IC8vIHRvIGFsc28gc3VwcG9ydCBiYWRseSBhdXRob3JlZCBIVE1MIHBhZ2VzIHRoYXQgbGFjayBhIGhlYWQgZWxlbWVudFxuXHRcdHZhciBtID0gKG1lZGlhICYmIHR5cGVvZiBtZWRpYSA9PSBcInN0cmluZ1wiKSA/IG1lZGlhIDogXCJzY3JlZW5cIjtcblx0XHRpZiAobmV3U3R5bGUpIHtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gbnVsbDtcblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoIWR5bmFtaWNTdHlsZXNoZWV0IHx8IGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgIT0gbSkge1xuXHRcdFx0Ly8gY3JlYXRlIGR5bmFtaWMgc3R5bGVzaGVldCArIGdldCBhIGdsb2JhbCByZWZlcmVuY2UgdG8gaXRcblx0XHRcdHZhciBzID0gY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuXHRcdFx0cy5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dC9jc3NcIik7XG5cdFx0XHRzLnNldEF0dHJpYnV0ZShcIm1lZGlhXCIsIG0pO1xuXHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQgPSBoLmFwcGVuZENoaWxkKHMpO1xuXHRcdFx0aWYgKHVhLmllICYmIHVhLndpbiAmJiB0eXBlb2YgZG9jLnN0eWxlU2hlZXRzICE9IFVOREVGICYmIGRvYy5zdHlsZVNoZWV0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0ID0gZG9jLnN0eWxlU2hlZXRzW2RvYy5zdHlsZVNoZWV0cy5sZW5ndGggLSAxXTtcblx0XHRcdH1cblx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0TWVkaWEgPSBtO1xuXHRcdH1cblx0XHQvLyBhZGQgc3R5bGUgcnVsZVxuXHRcdGlmICh1YS5pZSAmJiB1YS53aW4pIHtcblx0XHRcdGlmIChkeW5hbWljU3R5bGVzaGVldCAmJiB0eXBlb2YgZHluYW1pY1N0eWxlc2hlZXQuYWRkUnVsZSA9PSBPQkpFQ1QpIHtcblx0XHRcdFx0ZHluYW1pY1N0eWxlc2hlZXQuYWRkUnVsZShzZWwsIGRlY2wpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGlmIChkeW5hbWljU3R5bGVzaGVldCAmJiB0eXBlb2YgZG9jLmNyZWF0ZVRleHROb2RlICE9IFVOREVGKSB7XG5cdFx0XHRcdGR5bmFtaWNTdHlsZXNoZWV0LmFwcGVuZENoaWxkKGRvYy5jcmVhdGVUZXh0Tm9kZShzZWwgKyBcIiB7XCIgKyBkZWNsICsgXCJ9XCIpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gc2V0VmlzaWJpbGl0eShpZCwgaXNWaXNpYmxlKSB7XG5cdFx0aWYgKCFhdXRvSGlkZVNob3cpIHsgcmV0dXJuOyB9XG5cdFx0dmFyIHYgPSBpc1Zpc2libGUgPyBcInZpc2libGVcIiA6IFwiaGlkZGVuXCI7XG5cdFx0aWYgKGlzRG9tTG9hZGVkICYmIGdldEVsZW1lbnRCeUlkKGlkKSkge1xuXHRcdFx0Z2V0RWxlbWVudEJ5SWQoaWQpLnN0eWxlLnZpc2liaWxpdHkgPSB2O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNyZWF0ZUNTUyhcIiNcIiArIGlkLCBcInZpc2liaWxpdHk6XCIgKyB2KTtcblx0XHR9XG5cdH1cblx0LyogRmlsdGVyIHRvIGF2b2lkIFhTUyBhdHRhY2tzXG5cdCovXG5cdGZ1bmN0aW9uIHVybEVuY29kZUlmTmVjZXNzYXJ5KHMpIHtcblx0XHR2YXIgcmVnZXggPSAvW1xcXFxcXFwiPD5cXC47XS87XG5cdFx0dmFyIGhhc0JhZENoYXJzID0gcmVnZXguZXhlYyhzKSAhPSBudWxsO1xuXHRcdHJldHVybiBoYXNCYWRDaGFycyAmJiB0eXBlb2YgZW5jb2RlVVJJQ29tcG9uZW50ICE9IFVOREVGID8gZW5jb2RlVVJJQ29tcG9uZW50KHMpIDogcztcblx0fVxuXHQvKiBSZWxlYXNlIG1lbW9yeSB0byBhdm9pZCBtZW1vcnkgbGVha3MgY2F1c2VkIGJ5IGNsb3N1cmVzLCBmaXggaGFuZ2luZyBhdWRpby92aWRlbyB0aHJlYWRzIGFuZCBmb3JjZSBvcGVuIHNvY2tldHMvTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdCAoSW50ZXJuZXQgRXhwbG9yZXIgb25seSlcblx0Ki9cblx0dmFyIGNsZWFudXAgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAodWEuaWUgJiYgdWEud2luKSB7XG5cdFx0XHR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0dmFyIGxsID0gbGlzdGVuZXJzQXJyLmxlbmd0aDtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsbDsgaSsrKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzQXJyW2ldWzBdLmRldGFjaEV2ZW50KGxpc3RlbmVyc0FycltpXVsxXSwgbGlzdGVuZXJzQXJyW2ldWzJdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjbGVhbnVwIGR5bmFtaWNhbGx5IGVtYmVkZGVkIG9iamVjdHMgdG8gZml4IGF1ZGlvL3ZpZGVvIHRocmVhZHMgYW5kIGZvcmNlIG9wZW4gc29ja2V0cyBhbmQgTmV0Q29ubmVjdGlvbnMgdG8gZGlzY29ubmVjdFxuXHRcdFx0XHR2YXIgaWwgPSBvYmpJZEFyci5sZW5ndGg7XG5cdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgaWw7IGorKykge1xuXHRcdFx0XHRcdHJlbW92ZVNXRihvYmpJZEFycltqXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gY2xlYW51cCBsaWJyYXJ5J3MgbWFpbiBjbG9zdXJlcyB0byBhdm9pZCBtZW1vcnkgbGVha3Ncblx0XHRcdFx0Zm9yICh2YXIgayBpbiB1YSkge1xuXHRcdFx0XHRcdHVhW2tdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR1YSA9IG51bGw7XG5cdFx0XHRcdGZvciAodmFyIGwgaW4gc3dmb2JqZWN0KSB7XG5cdFx0XHRcdFx0c3dmb2JqZWN0W2xdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2ZvYmplY3QgPSBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KCk7XG5cdHJldHVybiB7XG5cdFx0LyogUHVibGljIEFQSVxuXHRcdFx0LSBSZWZlcmVuY2U6IGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9zd2ZvYmplY3Qvd2lraS9kb2N1bWVudGF0aW9uXG5cdFx0Ki9cblx0XHRyZWdpc3Rlck9iamVjdDogZnVuY3Rpb24ob2JqZWN0SWRTdHIsIHN3ZlZlcnNpb25TdHIsIHhpU3dmVXJsU3RyLCBjYWxsYmFja0ZuKSB7XG5cdFx0XHRpZiAodWEudzMgJiYgb2JqZWN0SWRTdHIgJiYgc3dmVmVyc2lvblN0cikge1xuXHRcdFx0XHR2YXIgcmVnT2JqID0ge307XG5cdFx0XHRcdHJlZ09iai5pZCA9IG9iamVjdElkU3RyO1xuXHRcdFx0XHRyZWdPYmouc3dmVmVyc2lvbiA9IHN3ZlZlcnNpb25TdHI7XG5cdFx0XHRcdHJlZ09iai5leHByZXNzSW5zdGFsbCA9IHhpU3dmVXJsU3RyO1xuXHRcdFx0XHRyZWdPYmouY2FsbGJhY2tGbiA9IGNhbGxiYWNrRm47XG5cdFx0XHRcdHJlZ09iakFycltyZWdPYmpBcnIubGVuZ3RoXSA9IHJlZ09iajtcblx0XHRcdFx0c2V0VmlzaWJpbGl0eShvYmplY3RJZFN0ciwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2FsbGJhY2tGbikge1xuXHRcdFx0XHRjYWxsYmFja0ZuKHtzdWNjZXNzOmZhbHNlLCBpZDpvYmplY3RJZFN0cn0pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0Z2V0T2JqZWN0QnlJZDogZnVuY3Rpb24ob2JqZWN0SWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZXR1cm4gZ2V0T2JqZWN0QnlJZChvYmplY3RJZFN0cik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRlbWJlZFNXRjogZnVuY3Rpb24oc3dmVXJsU3RyLCByZXBsYWNlRWxlbUlkU3RyLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBzd2ZWZXJzaW9uU3RyLCB4aVN3ZlVybFN0ciwgZmxhc2h2YXJzT2JqLCBwYXJPYmosIGF0dE9iaiwgY2FsbGJhY2tGbikge1xuXHRcdFx0dmFyIGNhbGxiYWNrT2JqID0ge3N1Y2Nlc3M6ZmFsc2UsIGlkOnJlcGxhY2VFbGVtSWRTdHJ9O1xuXHRcdFx0aWYgKHVhLnczICYmICEodWEud2sgJiYgdWEud2sgPCAzMTIpICYmIHN3ZlVybFN0ciAmJiByZXBsYWNlRWxlbUlkU3RyICYmIHdpZHRoU3RyICYmIGhlaWdodFN0ciAmJiBzd2ZWZXJzaW9uU3RyKSB7XG5cdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgZmFsc2UpO1xuXHRcdFx0XHRhZGREb21Mb2FkRXZlbnQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0d2lkdGhTdHIgKz0gXCJcIjsgLy8gYXV0by1jb252ZXJ0IHRvIHN0cmluZ1xuXHRcdFx0XHRcdGhlaWdodFN0ciArPSBcIlwiO1xuXHRcdFx0XHRcdHZhciBhdHQgPSB7fTtcblx0XHRcdFx0XHRpZiAoYXR0T2JqICYmIHR5cGVvZiBhdHRPYmogPT09IE9CSkVDVCkge1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhdHRPYmopIHsgLy8gY29weSBvYmplY3QgdG8gYXZvaWQgdGhlIHVzZSBvZiByZWZlcmVuY2VzLCBiZWNhdXNlIHdlYiBhdXRob3JzIG9mdGVuIHJldXNlIGF0dE9iaiBmb3IgbXVsdGlwbGUgU1dGc1xuXHRcdFx0XHRcdFx0XHRhdHRbaV0gPSBhdHRPYmpbaV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF0dC5kYXRhID0gc3dmVXJsU3RyO1xuXHRcdFx0XHRcdGF0dC53aWR0aCA9IHdpZHRoU3RyO1xuXHRcdFx0XHRcdGF0dC5oZWlnaHQgPSBoZWlnaHRTdHI7XG5cdFx0XHRcdFx0dmFyIHBhciA9IHt9O1xuXHRcdFx0XHRcdGlmIChwYXJPYmogJiYgdHlwZW9mIHBhck9iaiA9PT0gT0JKRUNUKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBqIGluIHBhck9iaikgeyAvLyBjb3B5IG9iamVjdCB0byBhdm9pZCB0aGUgdXNlIG9mIHJlZmVyZW5jZXMsIGJlY2F1c2Ugd2ViIGF1dGhvcnMgb2Z0ZW4gcmV1c2UgcGFyT2JqIGZvciBtdWx0aXBsZSBTV0ZzXG5cdFx0XHRcdFx0XHRcdHBhcltqXSA9IHBhck9ialtqXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGZsYXNodmFyc09iaiAmJiB0eXBlb2YgZmxhc2h2YXJzT2JqID09PSBPQkpFQ1QpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGsgaW4gZmxhc2h2YXJzT2JqKSB7IC8vIGNvcHkgb2JqZWN0IHRvIGF2b2lkIHRoZSB1c2Ugb2YgcmVmZXJlbmNlcywgYmVjYXVzZSB3ZWIgYXV0aG9ycyBvZnRlbiByZXVzZSBmbGFzaHZhcnNPYmogZm9yIG11bHRpcGxlIFNXRnNcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBwYXIuZmxhc2h2YXJzICE9IFVOREVGKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFyLmZsYXNodmFycyArPSBcIiZcIiArIGsgKyBcIj1cIiArIGZsYXNodmFyc09ialtrXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRwYXIuZmxhc2h2YXJzID0gayArIFwiPVwiICsgZmxhc2h2YXJzT2JqW2tdO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChoYXNQbGF5ZXJWZXJzaW9uKHN3ZlZlcnNpb25TdHIpKSB7IC8vIGNyZWF0ZSBTV0Zcblx0XHRcdFx0XHRcdHZhciBvYmogPSBjcmVhdGVTV0YoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0XHRcdFx0aWYgKGF0dC5pZCA9PSByZXBsYWNlRWxlbUlkU3RyKSB7XG5cdFx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsYmFja09iai5zdWNjZXNzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGNhbGxiYWNrT2JqLnJlZiA9IG9iajtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoeGlTd2ZVcmxTdHIgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkgeyAvLyBzaG93IEFkb2JlIEV4cHJlc3MgSW5zdGFsbFxuXHRcdFx0XHRcdFx0YXR0LmRhdGEgPSB4aVN3ZlVybFN0cjtcblx0XHRcdFx0XHRcdHNob3dFeHByZXNzSW5zdGFsbChhdHQsIHBhciwgcmVwbGFjZUVsZW1JZFN0ciwgY2FsbGJhY2tGbik7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgeyAvLyBzaG93IGFsdGVybmF0aXZlIGNvbnRlbnRcblx0XHRcdFx0XHRcdHNldFZpc2liaWxpdHkocmVwbGFjZUVsZW1JZFN0ciwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChjYWxsYmFja0ZuKSB7IGNhbGxiYWNrRm4oY2FsbGJhY2tPYmopOyB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2FsbGJhY2tGbikgeyBjYWxsYmFja0ZuKGNhbGxiYWNrT2JqKTtcdH1cblx0XHR9LFxuXHRcdHN3aXRjaE9mZkF1dG9IaWRlU2hvdzogZnVuY3Rpb24oKSB7XG5cdFx0XHRhdXRvSGlkZVNob3cgPSBmYWxzZTtcblx0XHR9LFxuXHRcdHVhOiB1YSxcblx0XHRnZXRGbGFzaFBsYXllclZlcnNpb246IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHsgbWFqb3I6dWEucHZbMF0sIG1pbm9yOnVhLnB2WzFdLCByZWxlYXNlOnVhLnB2WzJdIH07XG5cdFx0fSxcblx0XHRoYXNGbGFzaFBsYXllclZlcnNpb246IGhhc1BsYXllclZlcnNpb24sXG5cdFx0Y3JlYXRlU1dGOiBmdW5jdGlvbihhdHRPYmosIHBhck9iaiwgcmVwbGFjZUVsZW1JZFN0cikge1xuXHRcdFx0aWYgKHVhLnczKSB7XG5cdFx0XHRcdHJldHVybiBjcmVhdGVTV0YoYXR0T2JqLCBwYXJPYmosIHJlcGxhY2VFbGVtSWRTdHIpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRzaG93RXhwcmVzc0luc3RhbGw6IGZ1bmN0aW9uKGF0dCwgcGFyLCByZXBsYWNlRWxlbUlkU3RyLCBjYWxsYmFja0ZuKSB7XG5cdFx0XHRpZiAodWEudzMgJiYgY2FuRXhwcmVzc0luc3RhbGwoKSkge1xuXHRcdFx0XHRzaG93RXhwcmVzc0luc3RhbGwoYXR0LCBwYXIsIHJlcGxhY2VFbGVtSWRTdHIsIGNhbGxiYWNrRm4pO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cmVtb3ZlU1dGOiBmdW5jdGlvbihvYmpFbGVtSWRTdHIpIHtcblx0XHRcdGlmICh1YS53Mykge1xuXHRcdFx0XHRyZW1vdmVTV0Yob2JqRWxlbUlkU3RyKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGNyZWF0ZUNTUzogZnVuY3Rpb24oc2VsU3RyLCBkZWNsU3RyLCBtZWRpYVN0ciwgbmV3U3R5bGVCb29sZWFuKSB7XG5cdFx0XHRpZiAodWEudzMpIHtcblx0XHRcdFx0Y3JlYXRlQ1NTKHNlbFN0ciwgZGVjbFN0ciwgbWVkaWFTdHIsIG5ld1N0eWxlQm9vbGVhbik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhZGREb21Mb2FkRXZlbnQ6IGFkZERvbUxvYWRFdmVudCxcblx0XHRhZGRMb2FkRXZlbnQ6IGFkZExvYWRFdmVudCxcblx0XHRnZXRRdWVyeVBhcmFtVmFsdWU6IGZ1bmN0aW9uKHBhcmFtKSB7XG5cdFx0XHR2YXIgcSA9IGRvYy5sb2NhdGlvbi5zZWFyY2ggfHwgZG9jLmxvY2F0aW9uLmhhc2g7XG5cdFx0XHRpZiAocSkge1xuXHRcdFx0XHRpZiAoL1xcPy8udGVzdChxKSkgeyBxID0gcS5zcGxpdChcIj9cIilbMV07IH0gLy8gc3RyaXAgcXVlc3Rpb24gbWFya1xuXHRcdFx0XHRpZiAocGFyYW0gPT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybiB1cmxFbmNvZGVJZk5lY2Vzc2FyeShxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgcGFpcnMgPSBxLnNwbGl0KFwiJlwiKTtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChwYWlyc1tpXS5zdWJzdHJpbmcoMCwgcGFpcnNbaV0uaW5kZXhPZihcIj1cIikpID09IHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdXJsRW5jb2RlSWZOZWNlc3NhcnkocGFpcnNbaV0uc3Vic3RyaW5nKChwYWlyc1tpXS5pbmRleE9mKFwiPVwiKSArIDEpKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9LFxuXHRcdC8vIEZvciBpbnRlcm5hbCB1c2FnZSBvbmx5XG5cdFx0ZXhwcmVzc0luc3RhbGxDYWxsYmFjazogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoaXNFeHByZXNzSW5zdGFsbEFjdGl2ZSkge1xuXHRcdFx0XHR2YXIgb2JqID0gZ2V0RWxlbWVudEJ5SWQoRVhQUkVTU19JTlNUQUxMX0lEKTtcblx0XHRcdFx0aWYgKG9iaiAmJiBzdG9yZWRBbHRDb250ZW50KSB7XG5cdFx0XHRcdFx0b2JqLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHN0b3JlZEFsdENvbnRlbnQsIG9iaik7XG5cdFx0XHRcdFx0aWYgKHN0b3JlZEFsdENvbnRlbnRJZCkge1xuXHRcdFx0XHRcdFx0c2V0VmlzaWJpbGl0eShzdG9yZWRBbHRDb250ZW50SWQsIHRydWUpO1xuXHRcdFx0XHRcdFx0aWYgKHVhLmllICYmIHVhLndpbikgeyBzdG9yZWRBbHRDb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7IH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHN0b3JlZENhbGxiYWNrRm4pIHsgc3RvcmVkQ2FsbGJhY2tGbihzdG9yZWRDYWxsYmFja09iaik7IH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpc0V4cHJlc3NJbnN0YWxsQWN0aXZlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufSgpO1xubW9kdWxlLmV4cG9ydHMgPSBzd2ZvYmplY3Q7XG4iLCIvKipcbiAqINCh0L7Qt9C00LDRkdGCINGN0LrQt9C10LzQv9C70Y/RgCDQutC70LDRgdGB0LAsINC90L4g0L3QtSDQt9Cw0L/Rg9GB0LrQsNC10YIg0LXQs9C+INC60L7QvdGB0YLRgNGD0LrRgtC+0YBcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IE9yaWdpbmFsQ2xhc3MgLSDQutC70LDRgdGBXG4gKiBAcmV0dXJucyB7T3JpZ2luYWxDbGFzc31cbiAqIEBwcml2YXRlXG4gKi9cbnZhciBjbGVhckluc3RhbmNlID0gZnVuY3Rpb24oT3JpZ2luYWxDbGFzcykge1xuICAgIHZhciBDbGVhckNsYXNzID0gZnVuY3Rpb24oKXt9O1xuICAgIENsZWFyQ2xhc3MucHJvdG90eXBlID0gT3JpZ2luYWxDbGFzcy5wcm90b3R5cGU7XG4gICAgcmV0dXJuIG5ldyBDbGVhckNsYXNzKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNsZWFySW5zdGFuY2U7XG4iLCJ2YXIgY2xlYXJJbnN0YW5jZSA9IHJlcXVpcmUoJy4vY2xlYXItaW5zdGFuY2UnKTtcblxuLyoqXG4gKiBDbGFzc2ljIEVycm9yIGFjdHMgbGlrZSBhIGZhYnJpYzogRXJyb3IuY2FsbCh0aGlzLCBtZXNzYWdlKSBqdXN0IGNyZWF0ZSBuZXcgb2JqZWN0LlxuICogRXJyb3JDbGFzcyBhY3RzIG1vcmUgbGlrZSBhIGNsYXNzOiBFcnJvckNsYXNzLmNhbGwodGhpcywgbWVzc2FnZSkgbW9kaWZ5ICd0aGlzJyBvYmplY3QuXG4gKiBAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIC0gZXJyb3IgbWVzc2FnZVxuICogQHBhcmFtIHtOdW1iZXJ9IFtpZF0gLSBlcnJvciBpZFxuICogQGV4dGVuZHMgRXJyb3JcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIEVycm9yQ2xhc3MgPSBmdW5jdGlvbihtZXNzYWdlLCBpZCkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSwgaWQpO1xuICAgIGVyci5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgdGhpcy5tZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgdGhpcy5zdGFjayA9IGVyci5zdGFjaztcbn07XG5cbi8qKlxuICogU3VnYXIuIEp1c3QgY3JlYXRlIGluaGVyaXRhbmNlIGZyb20gRXJyb3JDbGFzcyBhbmQgZGVmaW5lIG5hbWUgcHJvcGVydHlcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gbmFtZSBvZiBlcnJvciB0eXBlXG4gKiBAcmV0dXJucyB7RXJyb3JDbGFzc31cbiAqL1xuRXJyb3JDbGFzcy5jcmVhdGUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGVyckNsYXNzID0gY2xlYXJJbnN0YW5jZShFcnJvckNsYXNzKTtcbiAgICBlcnJDbGFzcy5uYW1lID0gbmFtZTtcbiAgICByZXR1cm4gZXJyQ2xhc3M7XG59O1xuXG5FcnJvckNsYXNzLnByb3RvdHlwZSA9IGNsZWFySW5zdGFuY2UoRXJyb3IpO1xuRXJyb3JDbGFzcy5wcm90b3R5cGUubmFtZSA9IFwiRXJyb3JDbGFzc1wiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVycm9yQ2xhc3M7XG4iLCJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vYXN5bmMvZXZlbnRzJyk7XG5cbi8qKlxuICogQGNsYXNzINCf0YDQvtC60YHQuC3QutC70LDRgdGBLiDQktGL0LTQsNGR0YIg0L3QsNGA0YPQttGDINC70LjRiNGMINC/0YPQsdC70LjRh9C90YvQtSDQvNC10YLQvtC00Ysg0L7QsdGK0LXQutGC0LAg0Lgg0YHRgtCw0YLQuNGH0LXRgdC60LjQtSDRgdCy0L7QudGB0YLQstCwLlxuICog0J3QtSDQutC+0L/QuNGA0YPQtdGCINC80LXRgtC+0LTRiyDQuNC3IE9iamVjdC5wcm90b3R5cGUuINCS0YHQtSDQvNC10YLQvtC00Ysg0LjQvNC10Y7RgiDQv9GA0LjQstGP0LfQutGDINC60L7QvdGC0LXQutGB0YLQsCDQuiDQv9GA0L7QutGB0LjRgNGD0LXQvNC+0LzRgyDQvtCx0YrQtdC60YLRgy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdF0gLSDQvtCx0YrQtdC60YIsINC60L7RgtC+0YDRi9C5INGC0YDQtdCx0YPQtdGC0YHRjyDQv9GA0L7QutGB0LjRgNC+0LLQsNGC0YxcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xudmFyIFByb3h5ID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgaWYgKG9iamVjdCkge1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAoa2V5WzBdID09PSBcIl9cIlxuICAgICAgICAgICAgICAgIHx8IHR5cGVvZiBvYmplY3Rba2V5XSAhPT0gXCJmdW5jdGlvblwiXG4gICAgICAgICAgICAgICAgfHwgb2JqZWN0W2tleV0gPT09IE9iamVjdC5wcm90b3R5cGVba2V5XVxuICAgICAgICAgICAgICAgIHx8IG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpXG4gICAgICAgICAgICAgICAgfHwgRXZlbnRzLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXNba2V5XSA9IG9iamVjdFtrZXldLmJpbmQob2JqZWN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvYmplY3QucGlwZUV2ZW50cykge1xuICAgICAgICAgICAgRXZlbnRzLmNhbGwodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMub24gPSBFdmVudHMucHJvdG90eXBlLm9uO1xuICAgICAgICAgICAgdGhpcy5vbmNlID0gRXZlbnRzLnByb3RvdHlwZS5vbmNlO1xuICAgICAgICAgICAgdGhpcy5vZmYgPSBFdmVudHMucHJvdG90eXBlLm9mZjtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJMaXN0ZW5lcnMgPSBFdmVudHMucHJvdG90eXBlLmNsZWFyTGlzdGVuZXJzO1xuXG4gICAgICAgICAgICBvYmplY3QucGlwZUV2ZW50cyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICog0K3QutGB0L/QvtGA0YLQuNGA0YPQtdGCINGB0YLQsNGC0LjRh9C10YHQutC40LUg0YHQstC+0LnRgdGC0LLQsCDQuNC3INC+0LTQvdC+0LPQviDQvtCx0YrQtdC60YLQsCDQsiDQtNGA0YPQs9C+0LksINC40YHQutC70Y7Rh9Cw0Y8g0YPQutCw0LfQsNC90L3Ri9C1LCDQv9GA0LjQstCw0YLQvdGL0LUg0Lgg0L/RgNC+0YLQvtGC0LjQv1xuICogQHBhcmFtIHtPYmplY3R9IGZyb20gLSDQvtGC0LrRg9C00LAg0LrQvtC/0LjRgNC+0LLQsNGC0YxcbiAqIEBwYXJhbSB7T2JqZWN0fSB0byAtINC60YPQtNCwINC60L7Qv9C40YDQvtCy0LDRgtGMXG4gKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBbZXhjbHVkZV0gLSDRgdCy0L7QudGB0YLQstCwINC60L7RgtC+0YDRi9C1INGC0YDQtdCx0YPQtdGC0YHRjyDQuNGB0LrQu9GO0YfQuNGC0YxcbiAqL1xuUHJveHkuZXhwb3J0U3RhdGljID0gZnVuY3Rpb24oZnJvbSwgdG8sIGV4Y2x1ZGUpIHtcbiAgICBleGNsdWRlID0gZXhjbHVkZSB8fCBbXTtcblxuICAgIE9iamVjdC5rZXlzKGZyb20pLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGlmICghZnJvbS5oYXNPd25Qcm9wZXJ0eShrZXkpXG4gICAgICAgICAgICB8fCBrZXlbMF0gPT09IFwiX1wiXG4gICAgICAgICAgICB8fCBrZXkgPT09IFwicHJvdG90eXBlXCJcbiAgICAgICAgICAgIHx8IGV4Y2x1ZGUuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9ba2V5XSA9IGZyb21ba2V5XTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICog0KHQvtC30LTQsNC90LjQtSDQv9GA0L7QutGB0Lgt0L/Qu9Cw0YHRgdCwINC/0YDQuNCy0Y/Qt9Cw0L3QvdC+0LPQviDQuiDRg9C60LDQt9Cw0L3QvdC+0LzRgyDQutC70LDRgdGB0YMuINCc0L7QttC90L4g0L3QsNC30L3QsNGH0LjRgtGMINGA0L7QtNC40YLQtdC70YzRgdC60LjQuSDQutC70LDRgdGBLlxuICog0KMg0YDQvtC00LjRgtC10LvRjNGB0LrQvtCz0L4g0LrQu9Cw0YHRgdCwINC/0L7Rj9Cy0LvRj9C10YLRgdGPINC/0YDQuNCy0LDRgtC90YvQuSDQvNC10YLQvtC0IF9wcm94eSwg0LrQvtGC0L7RgNGL0Lkg0LLRi9C00LDRkdGCINC/0YDQvtC60YHQuC3QvtCx0YrQtdC60YIg0LTQu9GPXG4gKiDQtNCw0L3QvdC+0LPQviDRjdC60LfQtdC80LvRj9GA0LAuINCi0LDQutC20LUg0L/QvtGP0LLQu9GP0LXRgtGB0Y8g0YHQstC+0LnRgdGC0LLQviBfX3Byb3h5LCDRgdC+0LTQtdGA0LbQsNGJ0LXQtSDRgdGB0YvQu9C60YMg0L3QsCDRgdC+0LfQtNCw0L3QvdGL0Lkg0L/RgNC+0LrRgdC4LdC+0LHRitC10LrRglxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IE9yaWdpbmFsQ2xhc3MgLSDQvtGA0LjQs9C40L3QsNC70YzQvdGL0Lkg0LrQu9Cw0YHRgVxuICogQHBhcmFtIHtmdW5jdGlvbn0gUGFyZW50UHJveHlDbGFzcyAtINGA0L7QtNC40YLQtdC70YzRgdC60LjQuSDQutC70LDRgdGBXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IC0tINC60L7QvdGB0YLRgNGD0YLQvtGAINC/0YDQvtC60YHQuNGA0L7QstCw0L3QvdC+0LPQviDQutC70LDRgdGB0LBcbiAqL1xuUHJveHkuY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbihPcmlnaW5hbENsYXNzLCBQYXJlbnRQcm94eUNsYXNzKSB7XG5cbiAgICB2YXIgUHJveHlDbGFzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgT3JpZ2luYWxDbGFzc0NvbnN0cnVjdG9yLnByb3RvdHlwZSA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlO1xuXG4gICAgICAgIHZhciBvcmlnaW5hbCA9IG5ldyBPcmlnaW5hbENsYXNzQ29uc3RydWN0b3IoKTtcbiAgICAgICAgT3JpZ2luYWxDbGFzcy5hcHBseShvcmlnaW5hbCwgYXJndW1lbnRzKTtcblxuICAgICAgICByZXR1cm4gb3JpZ2luYWwuX3Byb3h5KCk7XG4gICAgfTtcblxuICAgIHZhciBQYXJlbnRQcm94eUNsYXNzQ29uc3RydWN0b3IgPSBmdW5jdGlvbigpIHt9O1xuICAgIFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSAoUGFyZW50UHJveHlDbGFzcyB8fCBQcm94eSkucHJvdG90eXBlO1xuICAgIFByb3h5Q2xhc3MucHJvdG90eXBlID0gbmV3IFBhcmVudFByb3h5Q2xhc3NDb25zdHJ1Y3RvcigpO1xuXG4gICAgdmFyIHZhbDtcbiAgICBmb3IgKHZhciBrIGluIE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlKSB7XG4gICAgICAgIHZhbCA9IE9yaWdpbmFsQ2xhc3MucHJvdG90eXBlW2tdO1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZVtrXSA9PSB2YWwgfHwgdHlwZW9mIHZhbCA9PT0gXCJmdW5jdGlvblwiIHx8IGtbMF0gPT09IFwiX1wiKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtrXSA9IHZhbDtcbiAgICB9XG5cbiAgICB2YXIgY3JlYXRlUHJveHkgPSBmdW5jdGlvbihvcmlnaW5hbCkge1xuICAgICAgICB2YXIgcHJvdG8gPSBQcm94eS5wcm90b3R5cGU7XG4gICAgICAgIFByb3h5LnByb3RvdHlwZSA9IFByb3h5Q2xhc3MucHJvdG90eXBlO1xuICAgICAgICB2YXIgcHJveHkgPSBuZXcgUHJveHkob3JpZ2luYWwpO1xuICAgICAgICBQcm94eS5wcm90b3R5cGUgPSBwcm90bztcbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgIH07XG5cbiAgICBPcmlnaW5hbENsYXNzLnByb3RvdHlwZS5fcHJveHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9fcHJveHkpIHtcbiAgICAgICAgICAgIHRoaXMuX19wcm94eSA9IGNyZWF0ZVByb3h5KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX19wcm94eTtcbiAgICB9O1xuXG4gICAgUHJveHkuZXhwb3J0U3RhdGljKE9yaWdpbmFsQ2xhc3MsIFByb3h5Q2xhc3MpO1xuXG4gICAgcmV0dXJuIFByb3h5Q2xhc3M7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5O1xuIiwiLyoqXG4gKiDQodC60L7Qv9C40YDQvtCy0LDRgtGMINGB0LLQvtC50YHRgtCy0LAg0LLRgdC10YUg0L/QtdGA0LXRh9C40YHQu9C10L3QvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQsiDQvtC00LjQvS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIC0g0LXRgdC70Lgg0L/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIgdHJ1ZSwg0YLQviDQvdC+0LLRi9C5INC+0LHRitC10LrRgiDQvdC1INGB0L7Qt9C00LDRkdGC0YHRjywg0LAg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC00LDQvdC90YvQuVxuICogQHBhcmFtIHsuLi5PYmplY3R8Qm9vbGVhbn0gYXJncyAtINGB0L/QuNGB0L7QuiDQvtCx0YrQtdC60YLQvtCyINC40Lcg0LrQvtGC0L7RgNGL0YUg0LrQvtC/0LjRgNC+0LLQsNGC0Ywg0YHQstC+0LnRgdGC0LLQsC4g0J/QvtGB0LvQtdC00L3QuNC5INCw0YDQs9GD0LzQtdC90YIg0LzQvtC20LXRgiDQsdGL0YLRjCDQu9C40LHQvlxuICog0L7QsdGK0LXQutGC0L7QvCwg0LvQuNCx0L4gdHJ1ZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbWVyZ2UgPSBmdW5jdGlvbiAoaW5pdGlhbCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGtleTtcblxuICAgIGlmIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IHRydWUpIHtcbiAgICAgICAgb2JqZWN0ID0gaW5pdGlhbDtcbiAgICAgICAgYXJncy5wb3AoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICAgICAgZm9yIChrZXkgaW4gaW5pdGlhbCkge1xuICAgICAgICAgICAgaWYgKGluaXRpYWwuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdFtrZXldID0gaW5pdGlhbFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgayA9IDAsIGwgPSBhcmdzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuICAgICAgICBmb3IgKGtleSBpbiBhcmdzW2tdKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1trXS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSBhcmdzW2tdW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInJlcXVpcmUoJy4uLy4uLy4uL2V4cG9ydCcpO1xuXG52YXIgTG9hZGVyRXJyb3IgPSByZXF1aXJlKCcuL2xvYWRlci1lcnJvcicpO1xuXG55YS5BdWRpby5Mb2FkZXJFcnJvciA9IExvYWRlckVycm9yO1xuIiwidmFyIEVycm9yQ2xhc3MgPSByZXF1aXJlKCcuLi8uLi9jbGFzcy9lcnJvci1jbGFzcycpO1xuXG4vKipcbiAqINCa0LvQsNGB0YEg0L7RiNC40LHQvtC6INC30LDQs9GA0YPQt9GH0LjQutCwXG4gKiBAYWxpYXMgeWEuQXVkaW8uTG9hZGVyRXJyb3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAtINGC0LXQutGB0YIg0L7RiNC40LHQutC60LhcbiAqXG4gKiBAZXh0ZW5kcyBFcnJvclxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTG9hZGVyRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgRXJyb3JDbGFzcy5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xufTtcbkxvYWRlckVycm9yLnByb3RvdHlwZSA9IEVycm9yQ2xhc3MuY3JlYXRlKFwiTG9hZGVyRXJyb3JcIik7XG5cbi8qKlxuICog0KLQsNC50LzQsNGD0YIg0LfQsNCz0YDRg9C30LrQuFxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5USU1FT1VUID0gXCJyZXF1ZXN0IHRpbWVvdXRcIjtcbi8qKlxuICog0J7RiNC40LHQutCwINC30LDQv9GA0L7RgdCwINC90LAg0LfQsNCz0YDRg9C30LrRg1xuICogQHR5cGUge3N0cmluZ31cbiAqIEBjb25zdFxuICovXG5Mb2FkZXJFcnJvci5GQUlMRUQgPSBcInJlcXVlc3QgZmFpbGVkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gTG9hZGVyRXJyb3I7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge307XG4iLCJyZXF1aXJlKFwiLi4vZXhwb3J0XCIpO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcblxueWEuQXVkaW8uTG9nZ2VyID0gTG9nZ2VyO1xuIiwidmFyIExFVkVMUyA9IFtcImRlYnVnXCIsIFwibG9nXCIsIFwiaW5mb1wiLCBcIndhcm5cIiwgXCJlcnJvclwiLCBcInRyYWNlXCJdO1xudmFyIG5vb3AgPSByZXF1aXJlKCcuLi9saWIvbm9vcCcpO1xuXG4vKipcbiAqINCd0LDRgdGC0YDQsNC40LLQsNC10LzRi9C1INC70L7Qs9Cz0LXRgCDQtNC70Y8g0LDRg9C00LjQvi3Qv9C70LXQtdGA0LBcbiAqIEBhbGlhcyB5YS5BdWRpby5Mb2dnZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBjaGFubmVsIC0g0LjQvNGPINC60LDQvdCw0LvQsCwg0LfQsCDQutC+0YLQvtGA0YvQuSDQsdGD0LTQtdGCINC+0YLQstC10YfQsNGC0Ywg0Y3QutC30LXQvNC70Y/RgCDQu9C+0LPQs9C10YDQsFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBMb2dnZXIgPSBmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbn07XG5cbi8qKlxuICog0KHQv9C40YHQvtC6INC40LPQvdC+0YDQuNGA0YPQtdC80YvRhSDQutCw0L3QsNC70L7QslxuICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxuICovXG5Mb2dnZXIuaWdub3JlcyA9IFtdO1xuXG4vKipcbiAqINCh0L/QuNGB0L7QuiDQvtGC0L7QsdGA0LDQttCw0LXQvNGL0YUg0LIg0LrQvtC90YHQvtC70Lgg0YPRgNC+0LLQvdC10Lkg0LvQvtCz0LBcbiAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cbiAqL1xuTG9nZ2VyLmxvZ0xldmVscyA9IFtdO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKipkZWJ1ZyoqXG4gKiBAbWV0aG9kIHlhLkF1ZGlvLkxvZ2dlciNkZWJ1Z1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmRlYnVnID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqbG9nKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI2xvZ1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmxvZyA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKmluZm8qKlxuICogQG1ldGhvZCB5YS5BdWRpby5Mb2dnZXIjaW5mb1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHBhcmFtIHsuLi4qfSBbYXJnc10gLSDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRi1xuICovXG5Mb2dnZXIucHJvdG90eXBlLmluZm8gPSBub29wO1xuXG4vKipcbiAqINCX0LDQv9C40YHRjCDQsiDQu9C+0LMg0YEg0YPRgNC+0LLQvdC10LwgKip3YXJuKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI3dhcm5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS53YXJuID0gbm9vcDtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCzINGBINGD0YDQvtCy0L3QtdC8ICoqZXJyb3IqKlxuICogQG1ldGhvZCB5YS5BdWRpby5Mb2dnZXIjZXJyb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLnByb3RvdHlwZS5lcnJvciA9IG5vb3A7XG5cbi8qKlxuICog0JfQsNC/0LjRgdGMINCyINC70L7QsyDRgSDRg9GA0L7QstC90LXQvCAqKnRyYWNlKipcbiAqIEBtZXRob2QgeWEuQXVkaW8uTG9nZ2VyI3RyYWNlXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCAtINC60L7QvdGC0LXQutGB0YIg0LLRi9C30L7QstCwXG4gKiBAcGFyYW0gey4uLip9IFthcmdzXSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKi9cbkxvZ2dlci5wcm90b3R5cGUudHJhY2UgPSBub29wO1xuXG4vKipcbiAqINCh0LTQtdC70LDRgtGMINC30LDQv9C40YHRjCDQsiDQu9C+0LNcbiAqIEBwYXJhbSB7U3RyaW5nfSBsZXZlbCAtINGD0YDQvtCy0LXQvdGMINC70L7Qs9CwXG4gKiBAcGFyYW0ge1N0cmluZ30gY2hhbm5lbCAtINC60LDQvdCw0LtcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IC0g0LrQvtC90YLQtdC60YHRgiDQstGL0LfQvtCy0LBcbiAqIEBwYXJhbSB7Li4uKn0gW2FyZ3NdIC0g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YtcbiAqL1xuTG9nZ2VyLmxvZyA9IGZ1bmN0aW9uKGxldmVsLCBjaGFubmVsLCBjb250ZXh0KSB7XG4gICAgdmFyIGRhdGEgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMykubWFwKGZ1bmN0aW9uKGR1bXBJdGVtKSB7XG4gICAgICAgIHJldHVybiBkdW1wSXRlbSAmJiBkdW1wSXRlbS5fbG9nZ2VyICYmIGR1bXBJdGVtLl9sb2dnZXIoKSB8fCBkdW1wSXRlbTtcbiAgICB9KTtcblxuICAgIHZhciBsb2dFbnRyeSA9IHtcbiAgICAgICAgdGltZXN0YW1wOiArbmV3IERhdGUoKSxcbiAgICAgICAgbGV2ZWw6IGxldmVsLFxuICAgICAgICBjaGFubmVsOiBjaGFubmVsLFxuICAgICAgICBjb250ZXh0OiBjb250ZXh0LFxuICAgICAgICBtZXNzYWdlOiBkYXRhXG4gICAgfTtcblxuICAgIGlmIChMb2dnZXIuaWdub3Jlc1tjaGFubmVsXSB8fCBMb2dnZXIubG9nTGV2ZWxzLmluZGV4T2YobGV2ZWwpID09PSAtMSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgTG9nZ2VyLl9kdW1wRW50cnkobG9nRW50cnkpO1xufTtcblxuLyoqXG4gKiDQl9Cw0L/QuNGB0Ywg0LIg0LvQvtCz0LVcbiAqIEB0eXBlZGVmIHtPYmplY3R9IHlhLkF1ZGlvLkxvZ2dlcn5Mb2dFbnRyeVxuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSB0aW1lc3RhbXAgLSDQstGA0LXQvNGPINCyIHRpbWVzdGFtcCDRhNC+0YDQvNCw0YLQtVxuICogQHByb3BlcnR5IHtTdHJpbmd9IGxldmVsIC0g0YPRgNC+0LLQtdC90Ywg0LvQvtCz0LBcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBjaGFubmVsIC0g0LrQsNC90LDQu1xuICogQHByb3BlcnR5IHtPYmplY3R9IGNvbnRleHQgLSDQutC+0L3RgtC10LrRgdGCINCy0YvQt9C+0LLQsFxuICogQHByb3BlcnR5IHtBcnJheX0gbWVzc2FnZSAtINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLXG4gKlxuICogQHByaXZhdGVcbiAqL1xuXG4vKipcbiAqINCX0LDQv9C40YHQsNGC0Ywg0YHQvtC+0LHRidC10L3QuNC1INC70L7Qs9CwINCyINC60L7QvdGB0L7Qu9GMXG4gKiBAcGFyYW0ge3lhLkF1ZGlvLkxvZ2dlcn5Mb2dFbnRyeX0gbG9nRW50cnkgLSDRgdC+0L7QsdGJ0LXQvdC40LUg0LvQvtCz0LBcbiAqIEBwcml2YXRlXG4gKi9cbkxvZ2dlci5fZHVtcEVudHJ5ID0gZnVuY3Rpb24obG9nRW50cnkpIHtcbiAgICB0cnkge1xuICAgICAgICB2YXIgbGV2ZWwgPSBsb2dFbnRyeS5sZXZlbDtcblxuICAgICAgICB2YXIgbmFtZSA9IGxvZ0VudHJ5LmNvbnRleHQgJiYgKGxvZ0VudHJ5LmNvbnRleHQudGFza05hbWUgfHwgbG9nRW50cnkuY29udGV4dC5uYW1lKTtcbiAgICAgICAgdmFyIGNvbnRleHQgPSBsb2dFbnRyeS5jb250ZXh0ICYmIChsb2dFbnRyeS5jb250ZXh0Ll9sb2dnZXIgPyBsb2dFbnRyeS5jb250ZXh0Ll9sb2dnZXIoKSA6IFwiXCIpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZVtsZXZlbF0gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgW1xuICAgICAgICAgICAgICAgIGxldmVsLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAobG9nRW50cnkudGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgICBcIltcIiArIGxvZ0VudHJ5LmNoYW5uZWwgKyAobmFtZSA/IFwiOlwiICsgbmFtZSA6IFwiXCIpICsgXCJdXCIsXG4gICAgICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgICAgXS5jb25jYXQobG9nRW50cnkubWVzc2FnZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZVtsZXZlbF0uYXBwbHkoY29uc29sZSwgW1xuICAgICAgICAgICAgICAgIExvZ2dlci5fZm9ybWF0VGltZXN0YW1wKGxvZ0VudHJ5LnRpbWVzdGFtcCksXG4gICAgICAgICAgICAgICAgXCJbXCIgKyBsb2dFbnRyeS5jaGFubmVsICsgKG5hbWUgPyBcIjpcIiArIG5hbWUgOiBcIlwiKSArIFwiXVwiLFxuICAgICAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICAgIF0uY29uY2F0KGxvZ0VudHJ5Lm1lc3NhZ2UpKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2goZSkge1xuICAgIH1cbn07XG5cbi8qKlxuICog0JLRgdC/0L7QvNC+0LPQsNGC0LXQu9GM0L3QsNGPINGE0YPQvdC60YbQuNGPINGE0L7RgNC80LDRgtC40YDQvtCy0LDQvdC40Y8g0LTQsNGC0Ysg0LTQu9GPINCy0YvQstC+0LTQsCDQsiDQutC+0L3QvtGB0L7Qu9GMXG4gKiBAcGFyYW0gdGltZXN0YW1wXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxuICogQHByaXZhdGVcbiAqL1xuTG9nZ2VyLl9mb3JtYXRUaW1lc3RhbXAgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHRpbWVzdGFtcCk7XG4gICAgdmFyIG1zID0gZGF0ZS5nZXRNaWxsaXNlY29uZHMoKTtcbiAgICBtcyA9IG1zID4gMTAwID8gbXMgOiBtcyA+IDEwID8gXCIwXCIgKyBtcyA6IFwiMDBcIiArIG1zO1xuICAgIHJldHVybiBkYXRlLnRvTG9jYWxlVGltZVN0cmluZygpICsgXCIuXCIgKyBtcztcbn07XG5cbkxFVkVMUy5mb3JFYWNoKGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgTG9nZ2VyLnByb3RvdHlwZVtsZXZlbF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmNoYW5uZWwpO1xuICAgICAgICBhcmdzLnVuc2hpZnQobGV2ZWwpO1xuICAgICAgICBMb2dnZXIubG9nLmFwcGx5KExvZ2dlciwgYXJncyk7XG4gICAgfTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiIsInZhciBNb2R1bGVzID0gcmVxdWlyZSgneW0nKTtcbnZhciBZYW5kZXhBdWRpbyA9IHJlcXVpcmUoXCIuL2luZGV4LmpzXCIpO1xuXG52YXIgbW9kdWxlcztcbmlmICh3aW5kb3cubW9kdWxlcykge1xuICAgIG1vZHVsZXMgPSB3aW5kb3cubW9kdWxlcztcbn0gZWxzZSB7XG4gICAgbW9kdWxlcyA9IHdpbmRvdy5tb2R1bGVzID0gTW9kdWxlcy5jcmVhdGUoKTtcbn1cblxubW9kdWxlcy5kZWZpbmUoJ1lhbmRleEF1ZGlvJywgZnVuY3Rpb24ocHJvdmlkZSkge1xuICAgIHByb3ZpZGUoWWFuZGV4QXVkaW8pO1xufSk7XG4iXX0=
