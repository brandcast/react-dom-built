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

var _prodInvariant = require('./reactProdInvariant');

var ReactInstanceMap = require('./ReactInstanceMap');

var invariant = require('fbjs/lib/invariant');

var _require = require('./ReactTypeOfWork');

var HostContainer = _require.HostContainer;
var HostComponent = _require.HostComponent;
var HostText = _require.HostText;

var _require2 = require('./ReactTypeOfSideEffect');

var NoEffect = _require2.NoEffect;
var Placement = _require2.Placement;


var MOUNTING = 1;
var MOUNTED = 2;
var UNMOUNTED = 3;

function isFiberMounted(fiber) {
  var node = fiber;
  if (!fiber.alternate) {
    // If there is no alternate, this might be a new tree that isn't inserted
    // yet. If it is, then it will have a pending insertion effect on it.
    if ((node.effectTag & Placement) !== NoEffect) {
      return MOUNTING;
    }
    while (node['return']) {
      node = node['return'];
      if ((node.effectTag & Placement) !== NoEffect) {
        return MOUNTING;
      }
    }
  } else {
    while (node['return']) {
      node = node['return'];
    }
  }
  if (node.tag === HostContainer) {
    // TODO: Check if this was a nested HostContainer when used with
    // renderContainerIntoSubtree.
    return MOUNTED;
  }
  // If we didn't hit the root, that means that we're in an disconnected tree
  // that has been unmounted.
  return UNMOUNTED;
}

exports.isMounted = function (component) {
  var fiber = ReactInstanceMap.get(component);
  if (!fiber) {
    return false;
  }
  return isFiberMounted(fiber) === MOUNTED;
};

exports.findCurrentHostFiber = function (parent) {
  // First check if this node itself is mounted.
  var state = isFiberMounted(parent, true);
  if (state === UNMOUNTED) {
    !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Unable to find node on an unmounted component.') : _prodInvariant('148') : void 0;
  } else if (state === MOUNTING) {
    return null;
  }

  var didTryOtherTree = false;

  // Next we'll drill down this component to find the first HostComponent/Text.
  var node = parent;
  while (true) {
    if ((node.effectTag & Placement) !== NoEffect || !node['return']) {
      // If any node along the way was deleted, or is an insertion, that means
      // that we're actually in a work in progress to update this component with
      // a different component. We need to look in the "current" fiber instead.
      if (!parent.alternate) {
        return null;
      }
      if (didTryOtherTree) {
        // Safety, to avoid an infinite loop if something goes wrong.
        throw new Error('This should never hit this infinite loop.');
      }
      didTryOtherTree = true;
      node = parent = parent.alternate;
      continue;
    }
    if (node.tag === HostComponent || node.tag === HostText) {
      return node;
    } else if (node.child) {
      // TODO: Coroutines need to visit the stateNode.
      node = node.child;
      continue;
    }
    if (node === parent) {
      return null;
    }
    while (!node.sibling) {
      if (!node['return'] || node['return'] === parent) {
        return null;
      }
      node = node['return'];
    }
    node = node.sibling;
  }
  // Flow needs the return null here, but ESLint complains about it.
  // eslint-disable-next-line no-unreachable
  return null;
};

exports.getComponentName = function (fiber) {
  var type = fiber.type;
  var instance = fiber.stateNode;
  var constructor = instance && instance.constructor;
  return type.displayName || constructor && constructor.displayName || type.name || constructor && constructor.name || 'A Component';
};