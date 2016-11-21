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

var _require = require('./ReactFiberContext');

var getMaskedContext = _require.getMaskedContext;

var _require2 = require('./ReactFiberUpdateQueue');

var createUpdateQueue = _require2.createUpdateQueue;
var addToQueue = _require2.addToQueue;
var addCallbackToQueue = _require2.addCallbackToQueue;
var mergeUpdateQueue = _require2.mergeUpdateQueue;

var _require3 = require('./ReactFiberTreeReflection');

var getComponentName = _require3.getComponentName;
var isMounted = _require3.isMounted;

var ReactInstanceMap = require('./ReactInstanceMap');
var shallowEqual = require('fbjs/lib/shallowEqual');
var warning = require('fbjs/lib/warning');
var invariant = require('fbjs/lib/invariant');

var isArray = Array.isArray;

module.exports = function (scheduleUpdate) {

  function scheduleUpdateQueue(fiber, updateQueue) {
    fiber.updateQueue = updateQueue;
    // Schedule update on the alternate as well, since we don't know which tree
    // is current.
    if (fiber.alternate) {
      fiber.alternate.updateQueue = updateQueue;
    }
    scheduleUpdate(fiber);
  }

  // Class component state updater
  var updater = {
    isMounted: isMounted,
    enqueueSetState: function (instance, partialState) {
      var fiber = ReactInstanceMap.get(instance);
      var updateQueue = fiber.updateQueue ? addToQueue(fiber.updateQueue, partialState) : createUpdateQueue(partialState);
      scheduleUpdateQueue(fiber, updateQueue);
    },
    enqueueReplaceState: function (instance, state) {
      var fiber = ReactInstanceMap.get(instance);
      var updateQueue = createUpdateQueue(state);
      updateQueue.isReplace = true;
      scheduleUpdateQueue(fiber, updateQueue);
    },
    enqueueForceUpdate: function (instance) {
      var fiber = ReactInstanceMap.get(instance);
      var updateQueue = fiber.updateQueue || createUpdateQueue(null);
      updateQueue.isForced = true;
      scheduleUpdateQueue(fiber, updateQueue);
    },
    enqueueCallback: function (instance, callback) {
      var fiber = ReactInstanceMap.get(instance);
      var updateQueue = fiber.updateQueue ? fiber.updateQueue : createUpdateQueue(null);
      addCallbackToQueue(updateQueue, callback);
      scheduleUpdateQueue(fiber, updateQueue);
    }
  };

  function checkShouldComponentUpdate(workInProgress, oldProps, newProps, newState, newContext) {
    var updateQueue = workInProgress.updateQueue;
    if (oldProps === null || updateQueue && updateQueue.isForced) {
      return true;
    }

    var instance = workInProgress.stateNode;
    if (typeof instance.shouldComponentUpdate === 'function') {
      var shouldUpdate = instance.shouldComponentUpdate(newProps, newState, newContext);

      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(shouldUpdate !== undefined, '%s.shouldComponentUpdate(): Returned undefined instead of a ' + 'boolean value. Make sure to return true or false.', getComponentName(workInProgress)) : void 0;
      }

      return shouldUpdate;
    }

    var type = workInProgress.type;
    if (type.prototype && type.prototype.isPureReactComponent) {
      return !shallowEqual(oldProps, newProps) || !shallowEqual(instance.state, newState);
    }

    return true;
  }

  function checkClassInstance(workInProgress) {
    var instance = workInProgress.stateNode;
    if (process.env.NODE_ENV !== 'production') {
      var name = getComponentName(workInProgress);
      var renderPresent = instance.render;
      process.env.NODE_ENV !== 'production' ? warning(renderPresent, '%s(...): No `render` method found on the returned component ' + 'instance: you may have forgotten to define `render`.', name) : void 0;
      var noGetInitialStateOnES6 = !instance.getInitialState || instance.getInitialState.isReactClassApproved;
      process.env.NODE_ENV !== 'production' ? warning(noGetInitialStateOnES6, 'getInitialState was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Did you mean to define a state property instead?', name) : void 0;
      var noGetDefaultPropsOnES6 = !instance.getDefaultProps || instance.getDefaultProps.isReactClassApproved;
      process.env.NODE_ENV !== 'production' ? warning(noGetDefaultPropsOnES6, 'getDefaultProps was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Use a static property to define defaultProps instead.', name) : void 0;
      var noInstancePropTypes = !instance.propTypes;
      process.env.NODE_ENV !== 'production' ? warning(noInstancePropTypes, 'propTypes was defined as an instance property on %s. Use a static ' + 'property to define propTypes instead.', name) : void 0;
      var noInstanceContextTypes = !instance.contextTypes;
      process.env.NODE_ENV !== 'production' ? warning(noInstanceContextTypes, 'contextTypes was defined as an instance property on %s. Use a static ' + 'property to define contextTypes instead.', name) : void 0;
      var noComponentShouldUpdate = typeof instance.componentShouldUpdate !== 'function';
      process.env.NODE_ENV !== 'production' ? warning(noComponentShouldUpdate, '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', name) : void 0;
      var noComponentDidUnmount = typeof instance.componentDidUnmount !== 'function';
      process.env.NODE_ENV !== 'production' ? warning(noComponentDidUnmount, '%s has a method called ' + 'componentDidUnmount(). But there is no such lifecycle method. ' + 'Did you mean componentWillUnmount()?', name) : void 0;
      var noComponentWillRecieveProps = typeof instance.componentWillRecieveProps !== 'function';
      process.env.NODE_ENV !== 'production' ? warning(noComponentWillRecieveProps, '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', name) : void 0;
    }

    var state = instance.state;
    if (state && (typeof state !== 'object' || isArray(state))) {
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.state: must be set to an object or null', getComponentName(workInProgress)) : _prodInvariant('106', getComponentName(workInProgress)) : void 0;
    }
    if (typeof instance.getChildContext === 'function') {
      !(typeof workInProgress.type.childContextTypes === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getChildContext(): childContextTypes must be defined in order to use getChildContext().', getComponentName(workInProgress)) : _prodInvariant('107', getComponentName(workInProgress)) : void 0;
    }
  }

  function adoptClassInstance(workInProgress, instance) {
    instance.updater = updater;
    workInProgress.stateNode = instance;
    // The instance needs access to the fiber so that it can schedule updates
    ReactInstanceMap.set(instance, workInProgress);
  }

  function constructClassInstance(workInProgress) {
    var ctor = workInProgress.type;
    var props = workInProgress.pendingProps;
    var context = getMaskedContext(workInProgress);
    var instance = new ctor(props, context);
    adoptClassInstance(workInProgress, instance);
    checkClassInstance(workInProgress);
    return instance;
  }

  // Invokes the mount life-cycles on a previously never rendered instance.
  function mountClassInstance(workInProgress) {
    var instance = workInProgress.stateNode;
    var state = instance.state || null;

    var props = workInProgress.pendingProps;
    if (!props) {
      throw new Error('There must be pending props for an initial mount.');
    }

    instance.props = props;
    instance.state = state;
    instance.context = getMaskedContext(workInProgress);

    if (typeof instance.componentWillMount === 'function') {
      instance.componentWillMount();
      // If we had additional state updates during this life-cycle, let's
      // process them now.
      var updateQueue = workInProgress.updateQueue;
      if (updateQueue) {
        instance.state = mergeUpdateQueue(updateQueue, instance, state, props);
      }
    }
  }

  // Called on a preexisting class instance. Returns false if a resumed render
  // could be reused.
  function resumeMountClassInstance(workInProgress) {
    var newState = workInProgress.memoizedState;
    var newProps = workInProgress.pendingProps;
    if (!newProps) {
      // If there isn't any new props, then we'll reuse the memoized props.
      // This could be from already completed work.
      newProps = workInProgress.memoizedProps;
      if (!newProps) {
        throw new Error('There should always be pending or memoized props.');
      }
    }
    var newContext = getMaskedContext(workInProgress);

    // TODO: Should we deal with a setState that happened after the last
    // componentWillMount and before this componentWillMount? Probably
    // unsupported anyway.

    if (!checkShouldComponentUpdate(workInProgress, workInProgress.memoizedProps, newProps, newState, newContext)) {
      return false;
    }

    // If we didn't bail out we need to construct a new instance. We don't
    // want to reuse one that failed to fully mount.
    var newInstance = constructClassInstance(workInProgress);
    newInstance.props = newProps;
    newInstance.state = newState = newInstance.state || null;
    newInstance.context = getMaskedContext(workInProgress);

    if (typeof newInstance.componentWillMount === 'function') {
      newInstance.componentWillMount();
    }
    // If we had additional state updates, process them now.
    // They may be from componentWillMount() or from error boundary's setState()
    // during initial mounting.
    var newUpdateQueue = workInProgress.updateQueue;
    if (newUpdateQueue) {
      newInstance.state = mergeUpdateQueue(newUpdateQueue, newInstance, newState, newProps);
    }
    return true;
  }

  // Invokes the update life-cycles and returns false if it shouldn't rerender.
  function updateClassInstance(current, workInProgress) {
    var instance = workInProgress.stateNode;

    var oldProps = workInProgress.memoizedProps || current.memoizedProps;
    var newProps = workInProgress.pendingProps;
    if (!newProps) {
      // If there aren't any new props, then we'll reuse the memoized props.
      // This could be from already completed work.
      newProps = oldProps;
      if (!newProps) {
        throw new Error('There should always be pending or memoized props.');
      }
    }
    var oldContext = instance.context;
    var newContext = getMaskedContext(workInProgress);

    // Note: During these life-cycles, instance.props/instance.state are what
    // ever the previously attempted to render - not the "current". However,
    // during componentDidUpdate we pass the "current" props.

    if (oldProps !== newProps || oldContext !== newContext) {
      if (typeof instance.componentWillReceiveProps === 'function') {
        instance.componentWillReceiveProps(newProps, newContext);
      }
    }

    // Compute the next state using the memoized state and the update queue.
    var updateQueue = workInProgress.updateQueue;
    var oldState = workInProgress.memoizedState;
    // TODO: Previous state can be null.
    var newState = void 0;
    if (updateQueue) {
      if (!updateQueue.hasUpdate) {
        newState = oldState;
      } else {
        newState = mergeUpdateQueue(updateQueue, instance, oldState, newProps);
      }
    } else {
      newState = oldState;
    }

    if (oldProps === newProps && oldState === newState && oldContext === newContext && updateQueue && !updateQueue.isForced) {
      return false;
    }

    if (!checkShouldComponentUpdate(workInProgress, oldProps, newProps, newState, newContext)) {
      // TODO: Should this get the new props/state updated regardless?
      return false;
    }

    if (typeof instance.componentWillUpdate === 'function') {
      instance.componentWillUpdate(newProps, newState, newContext);
    }

    instance.props = newProps;
    instance.state = newState;
    instance.context = newContext;
    return true;
  }

  return {
    adoptClassInstance: adoptClassInstance,
    constructClassInstance: constructClassInstance,
    mountClassInstance: mountClassInstance,
    resumeMountClassInstance: resumeMountClassInstance,
    updateClassInstance: updateClassInstance
  };
};