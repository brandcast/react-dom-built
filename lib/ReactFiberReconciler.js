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

var _require = require('./ReactFiberRoot');

var createFiberRoot = _require.createFiberRoot;

var ReactFiberScheduler = require('./ReactFiberScheduler');

var _require2 = require('./ReactFiberUpdateQueue');

var createUpdateQueue = _require2.createUpdateQueue;
var addCallbackToQueue = _require2.addCallbackToQueue;


if (process.env.NODE_ENV !== 'production') {
  var ReactFiberInstrumentation = require('./ReactFiberInstrumentation');
}

var _require3 = require('./ReactFiberTreeReflection');

var findCurrentHostFiber = _require3.findCurrentHostFiber;


module.exports = function (config) {
  var _ReactFiberScheduler = ReactFiberScheduler(config);

  var scheduleWork = _ReactFiberScheduler.scheduleWork;
  var performWithPriority = _ReactFiberScheduler.performWithPriority;
  var batchedUpdates = _ReactFiberScheduler.batchedUpdates;
  var syncUpdates = _ReactFiberScheduler.syncUpdates;


  return {
    mountContainer: function (element, containerInfo, callback) {
      var root = createFiberRoot(containerInfo);
      var container = root.current;
      if (callback) {
        var queue = createUpdateQueue(null);
        addCallbackToQueue(queue, callback);
        root.callbackList = queue;
      }
      // TODO: Use pending work/state instead of props.
      // TODO: This should not override the pendingWorkPriority if there is
      // higher priority work in the subtree.
      container.pendingProps = element;

      scheduleWork(root);

      if (process.env.NODE_ENV !== 'production' && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onMountContainer(root);
      }

      // It may seem strange that we don't return the root here, but that will
      // allow us to have containers that are in the middle of the tree instead
      // of being roots.
      return container;
    },
    updateContainer: function (element, container, callback) {
      // TODO: If this is a nested container, this won't be the root.
      var root = container.stateNode;
      if (callback) {
        var queue = root.callbackList ? root.callbackList : createUpdateQueue(null);
        addCallbackToQueue(queue, callback);
        root.callbackList = queue;
      }
      // TODO: Use pending work/state instead of props.
      root.current.pendingProps = element;

      scheduleWork(root);

      if (process.env.NODE_ENV !== 'production' && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onUpdateContainer(root);
      }
    },
    unmountContainer: function (container) {
      // TODO: If this is a nested container, this won't be the root.
      var root = container.stateNode;
      // TODO: Use pending work/state instead of props.
      root.current.pendingProps = [];

      scheduleWork(root);

      if (process.env.NODE_ENV !== 'production' && ReactFiberInstrumentation.debugTool) {
        ReactFiberInstrumentation.debugTool.onUnmountContainer(root);
      }
    },


    performWithPriority: performWithPriority,

    batchedUpdates: batchedUpdates,

    syncUpdates: syncUpdates,

    getPublicRootInstance: function (container) {
      var root = container.stateNode;
      var containerFiber = root.current;
      if (!containerFiber.child) {
        return null;
      }
      return containerFiber.child.stateNode;
    },
    findHostInstance: function (fiber) {
      var hostFiber = findCurrentHostFiber(fiber);
      if (!hostFiber) {
        return null;
      }
      return hostFiber.stateNode;
    }
  };
};