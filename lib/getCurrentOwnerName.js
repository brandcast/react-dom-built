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

var ReactCurrentOwner = require('react/lib/ReactCurrentOwner');
var getComponentName = require('./getComponentName');

module.exports = function () {
  if (ReactCurrentOwner.current) {
    return getComponentName(ReactCurrentOwner.current);
  } else {
    return null;
  }
};