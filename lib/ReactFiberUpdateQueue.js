/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var _assign = require('object-assign');

exports.createUpdateQueue = function (partialState) {
  var queue = {
    partialState: partialState,
    callback: null,
    isReplace: false,
    next: null,
    isForced: false,
    hasUpdate: partialState != null,
    hasCallback: false,
    tail: null
  };
  queue.tail = queue;
  return queue;
};

function addToQueue(queue, partialState) {
  var node = {
    partialState: partialState,
    callback: null,
    isReplace: false,
    next: null
  };
  queue.tail.next = node;
  queue.tail = node;
  queue.hasUpdate = queue.hasUpdate || partialState != null;
  return queue;
}

exports.addToQueue = addToQueue;

exports.addCallbackToQueue = function (queue, callback) {
  if (queue.tail.callback) {
    // If the tail already as a callback, add an empty node to queue
    addToQueue(queue, null);
  }
  queue.tail.callback = callback;
  queue.hasCallback = true;
  return queue;
};

exports.callCallbacks = function (queue, context) {
  var node = queue;
  var firstError = null;
  while (node) {
    var _callback = node.callback;
    if (_callback) {
      try {
        if (typeof context !== 'undefined') {
          _callback.call(context);
        } else {
          _callback();
        }
      } catch (error) {
        firstError = firstError || error;
      }
    }
    node = node.next;
  }
  return firstError;
};

exports.mergeUpdateQueue = function (queue, instance, prevState, props) {
  var node = queue;
  var state = _assign({}, prevState);
  while (node) {
    state = node.isReplace ? null : state;
    var _partialState = void 0;
    if (typeof node.partialState === 'function') {
      var updateFn = node.partialState;
      _partialState = updateFn.call(instance, state, props);
    } else {
      _partialState = node.partialState;
    }
    state = _assign(state || {}, _partialState);
    node = node.next;
  }
  return state;
};