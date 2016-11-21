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

var ReactTypeOfWork = require('./ReactTypeOfWork');
var ClassComponent = ReactTypeOfWork.ClassComponent;
var HostContainer = ReactTypeOfWork.HostContainer;
var HostComponent = ReactTypeOfWork.HostComponent;
var HostText = ReactTypeOfWork.HostText;

var _require = require('./ReactFiberUpdateQueue');

var callCallbacks = _require.callCallbacks;

var _require2 = require('./ReactTypeOfSideEffect');

var Placement = _require2.Placement;
var Update = _require2.Update;
var Callback = _require2.Callback;


module.exports = function (config, trapError) {

  var updateContainer = config.updateContainer;
  var commitUpdate = config.commitUpdate;
  var commitTextUpdate = config.commitTextUpdate;

  var appendChild = config.appendChild;
  var insertBefore = config.insertBefore;
  var removeChild = config.removeChild;

  function detachRef(current) {
    var ref = current.ref;
    if (ref) {
      ref(null);
    }
  }

  function detachRefIfNeeded(current, finishedWork) {
    if (current) {
      var currentRef = current.ref;
      if (currentRef && currentRef !== finishedWork.ref) {
        currentRef(null);
      }
    }
  }

  function attachRef(current, finishedWork, instance) {
    var ref = finishedWork.ref;
    if (ref && (!current || current.ref !== ref)) {
      ref(instance);
    }
  }

  function getHostParent(fiber) {
    var parent = fiber['return'];
    while (parent) {
      switch (parent.tag) {
        case HostComponent:
          return parent.stateNode;
        case HostContainer:
          // TODO: Currently we use the updateContainer feature to update these,
          // but we should be able to handle this case too.
          return null;
      }
      parent = parent['return'];
    }
    return null;
  }

  function getHostSibling(fiber) {
    // We're going to search forward into the tree until we find a sibling host
    // node. Unfortunately, if multiple insertions are done in a row we have to
    // search past them. This leads to exponential search for the next sibling.
    var node = fiber;
    siblings: while (true) {
      // If we didn't find anything, let's try the next sibling.
      while (!node.sibling) {
        if (!node['return'] || node['return'].tag === HostComponent) {
          // If we pop out of the root or hit the parent the fiber we are the
          // last sibling.
          return null;
        }
        node = node['return'];
      }
      node = node.sibling;
      while (node.tag !== HostComponent && node.tag !== HostText) {
        // If it is not host node and, we might have a host node inside it.
        // Try to search down until we find one.
        // TODO: For coroutines, this will have to search the stateNode.
        if (node.effectTag & Placement) {
          // If we don't have a child, try the siblings instead.
          continue siblings;
        }
        if (!node.child) {
          continue siblings;
        } else {
          node = node.child;
        }
      }
      // Check if this host node is stable or about to be placed.
      if (!(node.effectTag & Placement)) {
        // Found it!
        return node.stateNode;
      }
    }
  }

  function commitInsertion(finishedWork) {
    // Recursively insert all host nodes into the parent.
    var parent = getHostParent(finishedWork);
    if (!parent) {
      return;
    }
    var before = getHostSibling(finishedWork);
    // We only have the top Fiber that was inserted but we need recurse down its
    // children to find all the terminal nodes.
    var node = finishedWork;
    while (true) {
      if (node.tag === HostComponent || node.tag === HostText) {
        if (before) {
          insertBefore(parent, node.stateNode, before);
        } else {
          appendChild(parent, node.stateNode);
        }
      } else if (node.child) {
        // TODO: Coroutines need to visit the stateNode.
        node = node.child;
        continue;
      }
      if (node === finishedWork) {
        return;
      }
      while (!node.sibling) {
        if (!node['return'] || node['return'] === finishedWork) {
          return;
        }
        node = node['return'];
      }
      node = node.sibling;
    }
  }

  function commitNestedUnmounts(root) {
    // While we're inside a removed host node we don't want to call
    // removeChild on the inner nodes because they're removed by the top
    // call anyway. We also want to call componentWillUnmount on all
    // composites before this host node is removed from the tree. Therefore
    var node = root;
    while (true) {
      commitUnmount(node);
      if (node.child) {
        // TODO: Coroutines need to visit the stateNode.
        node = node.child;
        continue;
      }
      if (node === root) {
        return;
      }
      while (!node.sibling) {
        if (!node['return'] || node['return'] === root) {
          return;
        }
        node = node['return'];
      }
      node = node.sibling;
    }
  }

  function unmountHostComponents(parent, current) {
    // We only have the top Fiber that was inserted but we need recurse down its
    var node = current;
    while (true) {
      if (node.tag === HostComponent || node.tag === HostText) {
        commitNestedUnmounts(node);
        // After all the children have unmounted, it is now safe to remove the
        // node from the tree.
        if (parent) {
          removeChild(parent, node.stateNode);
        }
      } else {
        commitUnmount(node);
        if (node.child) {
          // TODO: Coroutines need to visit the stateNode.
          node = node.child;
          continue;
        }
      }
      if (node === current) {
        return;
      }
      while (!node.sibling) {
        if (!node['return'] || node['return'] === current) {
          return;
        }
        node = node['return'];
      }
      node = node.sibling;
    }
  }

  function commitDeletion(current) {
    // Recursively delete all host nodes from the parent.
    var parent = getHostParent(current);
    // Detach refs and call componentWillUnmount() on the whole subtree.
    unmountHostComponents(parent, current);

    // Cut off the return pointers to disconnect it from the tree. Ideally, we
    // should clear the child pointer of the parent alternate to let this
    // get GC:ed but we don't know which for sure which parent is the current
    // one so we'll settle for GC:ing the subtree of this child. This child
    // itself will be GC:ed when the parent updates the next time.
    current['return'] = null;
    current.child = null;
    if (current.alternate) {
      current.alternate.child = null;
      current.alternate['return'] = null;
    }
  }

  function commitUnmount(current) {
    switch (current.tag) {
      case ClassComponent:
        {
          detachRef(current);
          var instance = current.stateNode;
          if (typeof instance.componentWillUnmount === 'function') {
            var _error = tryCallComponentWillUnmount(instance);
            if (_error) {
              trapError(current, _error, true);
            }
          }
          return;
        }
      case HostComponent:
        {
          detachRef(current);
          return;
        }
    }
  }

  function commitWork(current, finishedWork) {
    switch (finishedWork.tag) {
      case ClassComponent:
        {
          detachRefIfNeeded(current, finishedWork);
          return;
        }
      case HostContainer:
        {
          // TODO: Attach children to root container.
          var children = finishedWork.output;
          var root = finishedWork.stateNode;
          var containerInfo = root.containerInfo;
          updateContainer(containerInfo, children);
          return;
        }
      case HostComponent:
        {
          var instance = finishedWork.stateNode;
          if (instance != null && current) {
            // Commit the work prepared earlier.
            var newProps = finishedWork.memoizedProps;
            var oldProps = current.memoizedProps;
            commitUpdate(instance, oldProps, newProps);
          }
          detachRefIfNeeded(current, finishedWork);
          return;
        }
      case HostText:
        {
          if (finishedWork.stateNode == null || !current) {
            throw new Error('This should only be done during updates.');
          }
          var textInstance = finishedWork.stateNode;
          var newText = finishedWork.memoizedProps;
          var oldText = current.memoizedProps;
          commitTextUpdate(textInstance, oldText, newText);
          return;
        }
      default:
        throw new Error('This unit of work tag should not have side-effects.');
    }
  }

  function commitLifeCycles(current, finishedWork) {
    switch (finishedWork.tag) {
      case ClassComponent:
        {
          var instance = finishedWork.stateNode;
          var firstError = null;
          if (finishedWork.effectTag & Update) {
            if (!current) {
              if (typeof instance.componentDidMount === 'function') {
                firstError = tryCallComponentDidMount(instance);
              }
            } else {
              if (typeof instance.componentDidUpdate === 'function') {
                var prevProps = current.memoizedProps;
                var prevState = current.memoizedState;
                firstError = tryCallComponentDidUpdate(instance, prevProps, prevState);
              }
            }
            attachRef(current, finishedWork, instance);
          }
          // Clear updates from current fiber.
          if (finishedWork.alternate) {
            finishedWork.alternate.updateQueue = null;
          }
          if (finishedWork.effectTag & Callback) {
            if (finishedWork.callbackList) {
              var callbackError = callCallbacks(finishedWork.callbackList, instance);
              firstError = firstError || callbackError;
              finishedWork.callbackList = null;
            }
          }
          if (firstError) {
            trapError(finishedWork, firstError, false);
          }
          return;
        }
      case HostContainer:
        {
          var rootFiber = finishedWork.stateNode;
          var _firstError = null;
          if (rootFiber.callbackList) {
            var callbackList = rootFiber.callbackList;

            rootFiber.callbackList = null;
            _firstError = callCallbacks(callbackList, rootFiber.current.child.stateNode);
          }
          if (_firstError) {
            trapError(rootFiber, _firstError, false);
          }
          return;
        }
      case HostComponent:
        {
          var _instance = finishedWork.stateNode;
          attachRef(current, finishedWork, _instance);
          return;
        }
      case HostText:
        {
          // We have no life-cycles associated with text.
          return;
        }
      default:
        throw new Error('This unit of work tag should not have side-effects.');
    }
  }

  function tryCallComponentDidMount(instance) {
    try {
      instance.componentDidMount();
      return null;
    } catch (error) {
      return error;
    }
  }

  function tryCallComponentDidUpdate(instance, prevProps, prevState) {
    try {
      instance.componentDidUpdate(prevProps, prevState);
      return null;
    } catch (error) {
      return error;
    }
  }

  function tryCallComponentWillUnmount(instance) {
    try {
      instance.componentWillUnmount();
      return null;
    } catch (error) {
      return error;
    }
  }

  return {
    commitInsertion: commitInsertion,
    commitDeletion: commitDeletion,
    commitWork: commitWork,
    commitLifeCycles: commitLifeCycles
  };
};