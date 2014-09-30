// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
// limitations under the License.

(function(scope, testing) {
  var composeMatrix = (function() {
    function multiply(a, b) {
      var result = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
          for (var k = 0; k < 4; k++) {
            result[i][j] += b[i][k] * a[k][j];
          }
        }
      }
      return result;
    }

    function is2D(m) {
      return (
          m[0][2] == 0 &&
          m[0][3] == 0 &&
          m[1][2] == 0 &&
          m[1][3] == 0 &&
          m[2][0] == 0 &&
          m[2][1] == 0 &&
          m[2][2] == 1 &&
          m[2][3] == 0 &&
          m[3][2] == 0 &&
          m[3][3] == 1);
    }

    function composeMatrix(translate, scale, skew, quat, perspective) {
      var matrix = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

      for (var i = 0; i < 4; i++) {
        matrix[i][3] = perspective[i];
      }

      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          matrix[3][i] += translate[j] * matrix[j][i];
        }
      }

      var x = quat[0], y = quat[1], z = quat[2], w = quat[3];

      var rotMatrix = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

      rotMatrix[0][0] = 1 - 2 * (y * y + z * z);
      rotMatrix[0][1] = 2 * (x * y - z * w);
      rotMatrix[0][2] = 2 * (x * z + y * w);
      rotMatrix[1][0] = 2 * (x * y + z * w);
      rotMatrix[1][1] = 1 - 2 * (x * x + z * z);
      rotMatrix[1][2] = 2 * (y * z - x * w);
      rotMatrix[2][0] = 2 * (x * z - y * w);
      rotMatrix[2][1] = 2 * (y * z + x * w);
      rotMatrix[2][2] = 1 - 2 * (x * x + y * y);

      matrix = multiply(matrix, rotMatrix);

      var temp = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
      if (skew[2]) {
        temp[2][1] = skew[2];
        matrix = multiply(matrix, temp);
      }

      if (skew[1]) {
        temp[2][1] = 0;
        temp[2][0] = skew[0];
        matrix = multiply(matrix, temp);
      }

      if (skew[0]) {
        temp[2][0] = 0;
        temp[1][0] = skew[0];
        matrix = multiply(matrix, temp);
      }

      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          matrix[i][j] *= scale[i];
        }
      }

      if (is2D(matrix)) {
        return {
          t: 'matrix',
          d: [matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1],
              matrix[3][0], matrix[3][1]]
        };
      }
      return {
        t: 'matrix3d',
        d: matrix[0].concat(matrix[1], matrix[2], matrix[3])
      };
    }
    return composeMatrix;
  })();

  var isDefined = function(val) {
    return typeof val !== 'undefined';
  };

  var isDefinedAndNotNull = function(val) {
    return isDefined(val) && (val !== null);
  };

  var interp = function(from, to, f, type) {
    // console.log('from');
    // console.log(from);
    // console.log('to');
    // console.log(to);
    if (Array.isArray(from) || Array.isArray(to)) {
      return interpArray(from, to, f, type);
    }
    var zero = (type && type.indexOf('scale') === 0) ? 1 : 0;
    to = isDefinedAndNotNull(to) ? to : zero;
    from = isDefinedAndNotNull(from) ? from : zero;

    return to * f + from * (1 - f);
  };

  var interpArray = function(from, to, f, type) {
    // console.log('from array');
    // console.log(from);
    // console.log('to array');
    // console.log(to);
    WEB_ANIMATIONS_TESTING && console.assert(
        Array.isArray(from) || from === null,
        'From is not an array or null');
    WEB_ANIMATIONS_TESTING && console.assert(
        Array.isArray(to) || to === null,
        'To is not an array or null');
    WEB_ANIMATIONS_TESTING && console.assert(
        from === null || to === null || from.length === to.length,
        'Arrays differ in length ' + from + ' : ' + to);
    var length = from ? from.length : to.length;

    var result = [];
    for (var i = 0; i < length; i++) {
      result[i] = interp(from ? from[i] : null, to ? to[i] : null, f, type);
    }
    return result;
  };

  var clamp = function(x, min, max) {
    return Math.max(Math.min(x, max), min);
  };

  function interpolateDecomposedTransformsWithMatrices(fromM, toM, f) {
    var fromMValue = fromM.d;
    var toMValue = toM.d;
    // console.log('from matrix');
    // console.log(fromMValue);
    // console.log('to matrix');
    // console.log(toMValue);
    var product = scope.dot(fromMValue.quaternion, toMValue.quaternion);
    product = clamp(product, -1.0, 1.0);

    var quat = [];
    if (product === 1.0) {
      quat = fromMValue.quaternion;
    } else {
      var theta = Math.acos(product);
      var w = Math.sin(f * theta) * 1 / Math.sqrt(1 - product * product);

      for (var i = 0; i < 4; i++) {
        quat.push(fromMValue.quaternion[i] * (Math.cos(f * theta) - product * w) +
                  toMValue.quaternion[i] * w);
      }
    }

    var translate = interp(fromMValue.translate, toMValue.translate, f);
    var scale = interp(fromMValue.scale, toMValue.scale, f);
    var skew = interp(fromMValue.skew, toMValue.skew, f);
    var perspective = interp(fromMValue.perspective, toMValue.perspective, f);

    return composeMatrix(translate, scale, skew, quat, perspective);
  }

  scope.interpolateDecomposedTransformsWithMatrices = interpolateDecomposedTransformsWithMatrices;
  scope.interp = interp;

})(webAnimationsMinifill, webAnimationsTesting);
