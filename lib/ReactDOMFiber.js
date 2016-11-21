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

var ReactControlledComponent = require('./ReactControlledComponent');
var ReactFiberReconciler = require('./ReactFiberReconciler');
var ReactDOMComponentTree = require('./ReactDOMComponentTree');
var ReactDOMFeatureFlags = require('./ReactDOMFeatureFlags');
var ReactDOMFiberComponent = require('./ReactDOMFiberComponent');
var ReactDOMInjection = require('./ReactDOMInjection');

var findDOMNode = require('./findDOMNode');
var warning = require('fbjs/lib/warning');

var createElement = ReactDOMFiberComponent.createElement;
var setInitialProperties = ReactDOMFiberComponent.setInitialProperties;
var updateProperties = ReactDOMFiberComponent.updateProperties;
var precacheFiberNode = ReactDOMComponentTree.precacheFiberNode;


ReactDOMInjection.inject();
ReactControlledComponent.injection.injectFiberControlledHostComponent(ReactDOMFiberComponent);
findDOMNode._injectFiber(function (fiber) {
  return DOMRenderer.findHostInstance(fiber);
});

function recursivelyAppendChildren(parent, child) {
  if (!child) {
    return;
  }
  /* $FlowFixMe: Element and Text should have this property. */
  if (child.nodeType === 1 || child.nodeType === 3) {
    /* $FlowFixMe: Refinement issue. I don't know how to express different. */
    parent.appendChild(child);
  } else {
    /* As a result of the refinement issue this type isn't known. */
    var node = child;
    do {
      recursivelyAppendChildren(parent, node.output);
    } while (node = node.sibling);
  }
}

var DOMRenderer = ReactFiberReconciler({
  updateContainer: function (container, children) {
    // TODO: Containers should update similarly to other parents.
    container.innerHTML = '';
    recursivelyAppendChildren(container, children);
  },
  createInstance: function (type, props, children, internalInstanceHandle) {
    var root = document.body; // HACK

    var domElement = createElement(type, props, root);
    precacheFiberNode(internalInstanceHandle, domElement);
    recursivelyAppendChildren(domElement, children);
    setInitialProperties(domElement, type, props, root);
    return domElement;
  },
  prepareUpdate: function (domElement, oldProps, newProps) {
    return true;
  },
  commitUpdate: function (domElement, oldProps, newProps) {
    var type = domElement.tagName.toLowerCase(); // HACK
    var root = document.body; // HACK
    updateProperties(domElement, type, oldProps, newProps, root);
  },
  createTextInstance: function (text, internalInstanceHandle) {
    var textNode = document.createTextNode(text);
    precacheFiberNode(internalInstanceHandle, textNode);
    return textNode;
  },
  commitTextUpdate: function (textInstance, oldText, newText) {
    textInstance.nodeValue = newText;
  },
  appendChild: function (parentInstance, child) {
    parentInstance.appendChild(child);
  },
  insertBefore: function (parentInstance, child, beforeChild) {
    parentInstance.insertBefore(child, beforeChild);
  },
  removeChild: function (parentInstance, child) {
    parentInstance.removeChild(child);
  },


  scheduleAnimationCallback: window.requestAnimationFrame,

  scheduleDeferredCallback: window.requestIdleCallback,

  useSyncScheduling: true

});

var warned = false;

function warnAboutUnstableUse() {
  // Ignore this warning is the feature flag is turned on. E.g. for tests.
  process.env.NODE_ENV !== 'production' ? warning(warned || ReactDOMFeatureFlags.useFiber, 'You are using React DOM Fiber which is an experimental renderer. ' + 'It is likely to have bugs, breaking changes and is unsupported.') : void 0;
  warned = true;
}

var ReactDOM = {
  render: function (element, container, callback) {
    warnAboutUnstableUse();
    var root = void 0;

    if (!container._reactRootContainer) {
      root = container._reactRootContainer = DOMRenderer.mountContainer(element, container, callback);
    } else {
      DOMRenderer.updateContainer(element, root = container._reactRootContainer, callback);
    }
    return DOMRenderer.getPublicRootInstance(root);
  },
  unmountComponentAtNode: function (container) {
    warnAboutUnstableUse();
    var root = container._reactRootContainer;
    if (root) {
      // TODO: Is it safe to reset this now or should I wait since this
      // unmount could be deferred?
      container._reactRootContainer = null;
      DOMRenderer.unmountContainer(root);
    }
  },


  findDOMNode: findDOMNode,

  unstable_batchedUpdates: function (fn) {
    return DOMRenderer.batchedUpdates(fn);
  }
};

module.exports = ReactDOM;