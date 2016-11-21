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

var REACT_ELEMENT_TYPE = require('./ReactElementSymbol');

var _require = require('./ReactCoroutine');

var REACT_COROUTINE_TYPE = _require.REACT_COROUTINE_TYPE;
var REACT_YIELD_TYPE = _require.REACT_YIELD_TYPE;


var ReactFiber = require('./ReactFiber');
var ReactReifiedYield = require('./ReactReifiedYield');
var ReactTypeOfSideEffect = require('./ReactTypeOfSideEffect');
var ReactTypeOfWork = require('./ReactTypeOfWork');

var emptyObject = require('fbjs/lib/emptyObject');
var getIteratorFn = require('./getIteratorFn');

var cloneFiber = ReactFiber.cloneFiber;
var createFiberFromElement = ReactFiber.createFiberFromElement;
var createFiberFromFragment = ReactFiber.createFiberFromFragment;
var createFiberFromText = ReactFiber.createFiberFromText;
var createFiberFromCoroutine = ReactFiber.createFiberFromCoroutine;
var createFiberFromYield = ReactFiber.createFiberFromYield;
var createReifiedYield = ReactReifiedYield.createReifiedYield;
var createUpdatedReifiedYield = ReactReifiedYield.createUpdatedReifiedYield;


var isArray = Array.isArray;

var ClassComponent = ReactTypeOfWork.ClassComponent;
var HostText = ReactTypeOfWork.HostText;
var CoroutineComponent = ReactTypeOfWork.CoroutineComponent;
var YieldComponent = ReactTypeOfWork.YieldComponent;
var Fragment = ReactTypeOfWork.Fragment;
var NoEffect = ReactTypeOfSideEffect.NoEffect;
var Placement = ReactTypeOfSideEffect.Placement;
var Deletion = ReactTypeOfSideEffect.Deletion;


function coerceRef(current, element) {
  var mixedRef = element.ref;
  if (mixedRef != null && typeof mixedRef !== 'function') {
    if (element._owner) {
      var ownerFiber = element._owner;
      if (ownerFiber && ownerFiber.tag === ClassComponent) {
        var _ret = function () {
          var stringRef = String(mixedRef);
          // Check if previous string ref matches new string ref
          if (current && current.ref && current.ref._stringRef === stringRef) {
            return {
              v: current.ref
            };
          }
          var inst = ownerFiber.stateNode;
          var ref = function (value) {
            var refs = inst.refs === emptyObject ? inst.refs = {} : inst.refs;
            refs[stringRef] = value;
          };
          ref._stringRef = stringRef;
          return {
            v: ref
          };
        }();

        if (typeof _ret === "object") return _ret.v;
      }
    }
  }
  return mixedRef;
}

// This wrapper function exists because I expect to clone the code in each path
// to be able to optimize each path individually by branching early. This needs
// a compiler or we can do it manually. Helpers that don't need this branching
// live outside of this function.
function ChildReconciler(shouldClone, shouldTrackSideEffects) {

  function deleteChild(returnFiber, childToDelete) {
    if (!shouldTrackSideEffects) {
      // Noop.
      return;
    }
    if (!shouldClone) {
      // When we're reconciling in place we have a work in progress copy. We
      // actually want the current copy. If there is no current copy, then we
      // don't need to track deletion side-effects.
      if (!childToDelete.alternate) {
        return;
      }
      childToDelete = childToDelete.alternate;
    }
    // Deletions are added in reversed order so we add it to the front.
    var last = returnFiber.progressedLastDeletion;
    if (last) {
      last.nextEffect = childToDelete;
      returnFiber.progressedLastDeletion = childToDelete;
    } else {
      returnFiber.progressedFirstDeletion = returnFiber.progressedLastDeletion = childToDelete;
    }
    childToDelete.nextEffect = null;
    childToDelete.effectTag = Deletion;
  }

  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    if (!shouldTrackSideEffects) {
      // Noop.
      return null;
    }

    // TODO: For the shouldClone case, this could be micro-optimized a bit by
    // assuming that after the first child we've already added everything.
    var childToDelete = currentFirstChild;
    while (childToDelete) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function mapRemainingChildren(returnFiber, currentFirstChild) {
    // Add the remaining children to a temporary map so that we can find them by
    // keys quickly. Implicit (null) keys get added to this set with their index
    var existingChildren = new Map();

    var existingChild = currentFirstChild;
    while (existingChild) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function useFiber(fiber, priority) {
    // We currently set sibling to null and index to 0 here because it is easy
    // to forget to do before returning it. E.g. for the single child case.
    if (shouldClone) {
      var clone = cloneFiber(fiber, priority);
      clone.index = 0;
      clone.sibling = null;
      return clone;
    } else {
      // We override the pending priority even if it is higher, because if
      // we're reconciling at a lower priority that means that this was
      // down-prioritized.
      fiber.pendingWorkPriority = priority;
      fiber.effectTag = NoEffect;
      fiber.index = 0;
      fiber.sibling = null;
      return fiber;
    }
  }

  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      // Noop.
      return lastPlacedIndex;
    }
    var current = newFiber.alternate;
    if (current) {
      var oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move.
        newFiber.effectTag = Placement;
        return lastPlacedIndex;
      } else {
        // This item can stay in place.
        return oldIndex;
      }
    } else {
      // This is an insertion.
      newFiber.effectTag = Placement;
      return lastPlacedIndex;
    }
  }

  function placeSingleChild(newFiber) {
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    if (shouldTrackSideEffects && !newFiber.alternate) {
      newFiber.effectTag = Placement;
    }
    return newFiber;
  }

  function updateTextNode(returnFiber, current, textContent, priority) {
    if (current == null || current.tag !== HostText) {
      // Insert
      var created = createFiberFromText(textContent, priority);
      created['return'] = returnFiber;
      return created;
    } else {
      // Update
      var existing = useFiber(current, priority);
      existing.pendingProps = textContent;
      existing['return'] = returnFiber;
      return existing;
    }
  }

  function updateElement(returnFiber, current, element, priority) {
    if (current == null || current.type !== element.type) {
      // Insert
      var created = createFiberFromElement(element, priority);
      created.ref = coerceRef(current, element);
      created['return'] = returnFiber;
      return created;
    } else {
      // Move based on index
      var existing = useFiber(current, priority);
      existing.ref = coerceRef(current, element);
      existing.pendingProps = element.props;
      existing['return'] = returnFiber;
      return existing;
    }
  }

  function updateCoroutine(returnFiber, current, coroutine, priority) {
    // TODO: Should this also compare handler to determine whether to reuse?
    if (current == null || current.tag !== CoroutineComponent) {
      // Insert
      var created = createFiberFromCoroutine(coroutine, priority);
      created['return'] = returnFiber;
      return created;
    } else {
      // Move based on index
      var existing = useFiber(current, priority);
      existing.pendingProps = coroutine;
      existing['return'] = returnFiber;
      return existing;
    }
  }

  function updateYield(returnFiber, current, yieldNode, priority) {
    // TODO: Should this also compare continuation to determine whether to reuse?
    if (current == null || current.tag !== YieldComponent) {
      // Insert
      var reifiedYield = createReifiedYield(yieldNode);
      var created = createFiberFromYield(yieldNode, priority);
      created.output = reifiedYield;
      created['return'] = returnFiber;
      return created;
    } else {
      // Move based on index
      var existing = useFiber(current, priority);
      existing.output = createUpdatedReifiedYield(current.output, yieldNode);
      existing['return'] = returnFiber;
      return existing;
    }
  }

  function updateFragment(returnFiber, current, fragment, priority) {
    if (current == null || current.tag !== Fragment) {
      // Insert
      var created = createFiberFromFragment(fragment, priority);
      created['return'] = returnFiber;
      return created;
    } else {
      // Update
      var existing = useFiber(current, priority);
      existing.pendingProps = fragment;
      existing['return'] = returnFiber;
      return existing;
    }
  }

  function createChild(returnFiber, newChild, priority) {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      var created = createFiberFromText('' + newChild, priority);
      created['return'] = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          {
            var _created = createFiberFromElement(newChild, priority);
            _created.ref = coerceRef(null, newChild);
            _created['return'] = returnFiber;
            return _created;
          }

        case REACT_COROUTINE_TYPE:
          {
            var _created2 = createFiberFromCoroutine(newChild, priority);
            _created2['return'] = returnFiber;
            return _created2;
          }

        case REACT_YIELD_TYPE:
          {
            var reifiedYield = createReifiedYield(newChild);
            var _created3 = createFiberFromYield(newChild, priority);
            _created3.output = reifiedYield;
            _created3['return'] = returnFiber;
            return _created3;
          }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        var _created4 = createFiberFromFragment(newChild, priority);
        _created4['return'] = returnFiber;
        return _created4;
      }
    }

    return null;
  }

  function updateSlot(returnFiber, oldFiber, newChild, priority) {
    // Update the fiber if the keys match, otherwise return null.

    var key = oldFiber ? oldFiber.key : null;

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      if (key !== null) {
        return null;
      }
      return updateTextNode(returnFiber, oldFiber, '' + newChild, priority);
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          {
            if (newChild.key === key) {
              return updateElement(returnFiber, oldFiber, newChild, priority);
            } else {
              return null;
            }
          }

        case REACT_COROUTINE_TYPE:
          {
            if (newChild.key === key) {
              return updateCoroutine(returnFiber, oldFiber, newChild, priority);
            } else {
              return null;
            }
          }

        case REACT_YIELD_TYPE:
          {
            if (newChild.key === key) {
              return updateYield(returnFiber, oldFiber, newChild, priority);
            } else {
              return null;
            }
          }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        // Fragments doesn't have keys so if the previous key is implicit we can
        // update it.
        if (key !== null) {
          return null;
        }
        return updateFragment(returnFiber, oldFiber, newChild, priority);
      }
    }

    return null;
  }

  function updateFromMap(existingChildren, returnFiber, newIdx, newChild, priority) {

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes doesn't have keys, so we neither have to check the old nor
      // new node for the key. If both are text nodes, they match.
      var matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, '' + newChild, priority);
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          {
            var _matchedFiber = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null;
            return updateElement(returnFiber, _matchedFiber, newChild, priority);
          }

        case REACT_COROUTINE_TYPE:
          {
            var _matchedFiber2 = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null;
            return updateCoroutine(returnFiber, _matchedFiber2, newChild, priority);
          }

        case REACT_YIELD_TYPE:
          {
            var _matchedFiber3 = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null;
            return updateYield(returnFiber, _matchedFiber3, newChild, priority);
          }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        var _matchedFiber4 = existingChildren.get(newIdx) || null;
        return updateFragment(returnFiber, _matchedFiber4, newChild, priority);
      }
    }

    return null;
  }

  function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, priority) {

    // This algorithm can't optimize by searching from boths ends since we
    // don't have backpointers on fibers. I'm trying to see how far we can get
    // with that model. If it ends up not being worth the tradeoffs, we can
    // add it later.

    // Even with a two ended optimization, we'd want to optimize for the case
    // where there are few changes and brute force the comparison instead of
    // going for the Map. It'd like to explore hitting that path first in
    // forward-only mode and only go for the Map once we notice that we need
    // lots of look ahead. This doesn't handle reversal as well as two ended
    // search but that's unusual. Besides, for the two ended optimization to
    // work on Iterables, we'd need to copy the whole set.

    // In this first iteration, we'll just live with hitting the bad case
    var resultingFirstChild = null;
    var previousNewFiber = null;

    var oldFiber = currentFirstChild;
    var lastPlacedIndex = 0;
    var newIdx = 0;
    var nextOldFiber = null;
    for (; oldFiber && newIdx < newChildren.length; newIdx++) {
      if (oldFiber) {
        if (oldFiber.index > newIdx) {
          nextOldFiber = oldFiber;
          oldFiber = null;
        } else {
          nextOldFiber = oldFiber.sibling;
        }
      }
      var newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], priority);
      if (!newFiber) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (!oldFiber) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && !newFiber.alternate) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (!previousNewFiber) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber;
      } else {
        // TODO: Defer siblings if we're not at the right index for this slot.
        // I.e. if we had null values before, then we want to defer this
        // for each null value. However, we also don't want to call updateSlot
        // with the previous one.
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (newIdx === newChildren.length) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (!oldFiber) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; newIdx < newChildren.length; newIdx++) {
        var _newFiber = createChild(returnFiber, newChildren[newIdx], priority);
        if (!_newFiber) {
          continue;
        }
        lastPlacedIndex = placeChild(_newFiber, lastPlacedIndex, newIdx);
        if (!previousNewFiber) {
          // TODO: Move out of the loop. This only happens for the first run.
          resultingFirstChild = _newFiber;
        } else {
          previousNewFiber.sibling = _newFiber;
        }
        previousNewFiber = _newFiber;
      }
      return resultingFirstChild;
    }

    // Add all children to a key map for quick lookups.
    var existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // Keep scanning and use the map to restore deleted items as moves.
    for (; newIdx < newChildren.length; newIdx++) {
      var _newFiber2 = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], priority);
      if (_newFiber2) {
        if (shouldTrackSideEffects) {
          if (_newFiber2.alternate) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren['delete'](_newFiber2.key === null ? newIdx : _newFiber2.key);
          }
        }
        lastPlacedIndex = placeChild(_newFiber2, lastPlacedIndex, newIdx);
        if (!previousNewFiber) {
          resultingFirstChild = _newFiber2;
        } else {
          previousNewFiber.sibling = _newFiber2;
        }
        previousNewFiber = _newFiber2;
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(function (child) {
        return deleteChild(returnFiber, child);
      });
    }

    return resultingFirstChild;
  }

  function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, priority) {
    // TODO: Copy everything from reconcileChildrenArray but use the iterator
    // instead.
    return null;
  }

  function reconcileSingleTextNode(returnFiber, currentFirstChild, textContent, priority) {
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    if (currentFirstChild && currentFirstChild.tag === HostText) {
      // We already have an existing node so let's just update it and delete
      // the rest.
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      var existing = useFiber(currentFirstChild, priority);
      existing.pendingProps = textContent;
      existing['return'] = returnFiber;
      return existing;
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild);
    var created = createFiberFromText(textContent, priority);
    created['return'] = returnFiber;
    return created;
  }

  function reconcileSingleElement(returnFiber, currentFirstChild, element, priority) {
    var key = element.key;
    var child = currentFirstChild;
    while (child) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (child.type === element.type) {
          deleteRemainingChildren(returnFiber, child.sibling);
          var existing = useFiber(child, priority);
          existing.ref = coerceRef(child, element);
          existing.pendingProps = element.props;
          existing['return'] = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    var created = createFiberFromElement(element, priority);
    created.ref = coerceRef(currentFirstChild, element);
    created['return'] = returnFiber;
    return created;
  }

  function reconcileSingleCoroutine(returnFiber, currentFirstChild, coroutine, priority) {
    var key = coroutine.key;
    var child = currentFirstChild;
    while (child) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (child.tag === CoroutineComponent) {
          deleteRemainingChildren(returnFiber, child.sibling);
          var existing = useFiber(child, priority);
          existing.pendingProps = coroutine;
          existing['return'] = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    var created = createFiberFromCoroutine(coroutine, priority);
    created['return'] = returnFiber;
    return created;
  }

  function reconcileSingleYield(returnFiber, currentFirstChild, yieldNode, priority) {
    var key = yieldNode.key;
    var child = currentFirstChild;
    while (child) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (child.tag === YieldComponent) {
          deleteRemainingChildren(returnFiber, child.sibling);
          var existing = useFiber(child, priority);
          existing.output = createUpdatedReifiedYield(child.output, yieldNode);
          existing['return'] = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    var reifiedYield = createReifiedYield(yieldNode);
    var created = createFiberFromYield(yieldNode, priority);
    created.output = reifiedYield;
    created['return'] = returnFiber;
    return created;
  }

  // This API will tag the children with the side-effect of the reconciliation
  // itself. They will be added to the side-effect list as we pass through the
  // children and the parent.
  function reconcileChildFibers(returnFiber, currentFirstChild, newChild, priority) {
    // This function is not recursive.
    // If the top level item is an array, we treat it as a set of children,
    // not as a fragment. Nested arrays on the other hand will be treated as
    // fragment nodes. Recursion happens at the normal flow.

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFirstChild, '' + newChild, priority));
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild, priority));

        case REACT_COROUTINE_TYPE:
          return placeSingleChild(reconcileSingleCoroutine(returnFiber, currentFirstChild, newChild, priority));

        case REACT_YIELD_TYPE:
          return placeSingleChild(reconcileSingleYield(returnFiber, currentFirstChild, newChild, priority));
      }

      if (isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, priority);
      }

      var iteratorFn = getIteratorFn(newChild);
      if (iteratorFn) {
        return reconcileChildrenIterator(returnFiber, currentFirstChild, newChild, priority);
      }
    }

    // Remaining cases are all treated as empty.
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

exports.reconcileChildFibers = ChildReconciler(true, true);

exports.reconcileChildFibersInPlace = ChildReconciler(false, true);

exports.mountChildFibersInPlace = ChildReconciler(false, false);

exports.cloneChildFibers = function (current, workInProgress) {
  if (!workInProgress.child) {
    return;
  }
  if (current && workInProgress.child === current.child) {
    // We use workInProgress.child since that lets Flow know that it can't be
    // null since we validated that already. However, as the line above suggests
    // they're actually the same thing.
    var currentChild = workInProgress.child;
    // TODO: This used to reset the pending priority. Not sure if that is needed.
    // workInProgress.pendingWorkPriority = current.pendingWorkPriority;
    // TODO: The below priority used to be set to NoWork which would've
    // dropped work. This is currently unobservable but will become
    // observable when the first sibling has lower priority work remaining
    // than the next sibling. At that point we should add tests that catches
    // this.
    var newChild = cloneFiber(currentChild, currentChild.pendingWorkPriority);
    workInProgress.child = newChild;

    newChild['return'] = workInProgress;
    while (currentChild.sibling) {
      currentChild = currentChild.sibling;
      newChild = newChild.sibling = cloneFiber(currentChild, currentChild.pendingWorkPriority);
      newChild['return'] = workInProgress;
    }
    newChild.sibling = null;
  }

  // If there is no alternate, then we don't need to clone the children.
  // If the children of the alternate fiber is a different set, then we don't
  // need to clone. We need to reset the return fiber though since we'll
  // traverse down into them.
  var child = workInProgress.child;
  while (child) {
    child['return'] = workInProgress;
    child = child.sibling;
  }
};