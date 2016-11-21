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

var _extends = _assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _prodInvariant = require('./reactProdInvariant'),
    _assign = require('object-assign');

var emptyObject = require('fbjs/lib/emptyObject');
var invariant = require('fbjs/lib/invariant');

var _require = require('./ReactFiberTreeReflection');

var getComponentName = _require.getComponentName;

var _require2 = require('./ReactTypeOfWork');

var ClassComponent = _require2.ClassComponent;


if (process.env.NODE_ENV !== 'production') {
  var checkReactTypeSpec = require('./checkReactTypeSpec');
}

var index = -1;
var contextStack = [];
var didPerformWorkStack = [];

function getUnmaskedContext() {
  if (index === -1) {
    return emptyObject;
  }
  return contextStack[index];
}

exports.getMaskedContext = function (fiber) {
  var type = fiber.type;
  var contextTypes = type.contextTypes;
  if (!contextTypes) {
    return emptyObject;
  }

  var unmaskedContext = getUnmaskedContext();
  var context = {};
  for (var key in contextTypes) {
    context[key] = unmaskedContext[key];
  }

  if (process.env.NODE_ENV !== 'production') {
    var name = getComponentName(fiber);
    var debugID = 0; // TODO: pass a real ID
    checkReactTypeSpec(contextTypes, context, 'context', name, null, debugID);
  }

  return context;
};

exports.hasContextChanged = function () {
  return index > -1 && didPerformWorkStack[index];
};

exports.isContextProvider = function (fiber) {
  return fiber.tag === ClassComponent && typeof fiber.stateNode.getChildContext === 'function';
};

exports.popContextProvider = function () {
  contextStack[index] = emptyObject;
  didPerformWorkStack[index] = false;
  index--;
};

exports.pushContextProvider = function (fiber, didPerformWork) {
  var instance = fiber.stateNode;
  var childContextTypes = fiber.type.childContextTypes;

  var memoizedMergedChildContext = instance.__reactInternalMemoizedMergedChildContext;
  var canReuseMergedChildContext = !didPerformWork && memoizedMergedChildContext != null;

  var mergedContext = null;
  if (canReuseMergedChildContext) {
    mergedContext = memoizedMergedChildContext;
  } else {
    var childContext = instance.getChildContext();
    for (var contextKey in childContext) {
      !(contextKey in childContextTypes) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getChildContext(): key "%s" is not defined in childContextTypes.', getComponentName(fiber), contextKey) : _prodInvariant('108', getComponentName(fiber), contextKey) : void 0;
    }
    if (process.env.NODE_ENV !== 'production') {
      var name = getComponentName(fiber);
      var debugID = 0; // TODO: pass a real ID
      checkReactTypeSpec(childContextTypes, childContext, 'childContext', name, null, debugID);
    }
    mergedContext = _extends({}, getUnmaskedContext(), childContext);
    instance.__reactInternalMemoizedMergedChildContext = mergedContext;
  }

  index++;
  contextStack[index] = mergedContext;
  didPerformWorkStack[index] = didPerformWork;
};

exports.resetContext = function () {
  index = -1;
};