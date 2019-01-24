const ret    = require('ret');
const DRange = require('drange');
const types  = ret.types;


module.exports = class RandExp {
  /**
   * @constructor
   * @param {RegExp|String} regexp
   * @param {String} m
   */
  constructor(regexp, m) {
    this._setDefaults(regexp);
    if (regexp instanceof RegExp) {
      this.ignoreCase = regexp.ignoreCase;
      this.multiline = regexp.multiline;
      regexp = regexp.source;

    } else if (typeof regexp === 'string') {
      this.ignoreCase = m && m.indexOf('i') !== -1;
      this.multiline = m && m.indexOf('m') !== -1;
    } else {
      throw new Error('Expected a regexp or string');
    }

    this.tokens = ret(regexp);
  }


  /**
   * Checks if some custom properties have been set for this regexp.
   *
   * @param {RandExp} randexp
   * @param {RegExp} regexp
   */
  _setDefaults(regexp) {
    // When a repetitional token has its max set to Infinite,
    // randexp won't actually generate a random amount between min and Infinite
    // instead it will see Infinite as min + 100.
    this.max = regexp.max != null ? regexp.max :
      RandExp.prototype.max != null ? RandExp.prototype.max : 100;

    // This allows expanding to include additional characters
    // for instance: RandExp.defaultRange.add(0, 65535);
    this.defaultRange = regexp.defaultRange ?
      regexp.defaultRange : this.defaultRange.clone();

    if (regexp.randInt) {
      this.randInt = regexp.randInt;
    }
  }


  /**
   * Generates the random invalid string.
   *
   * @return {String}
   */
  genInvalid(invalidGroups) {
    return this._genInput(true, invalidGroups);
  }

  /**
   * Generates the random valid string.
   *
   * @return {String}
   */
  genValid() {
    return this._genInput();
  }


  _genInput(invalid = false, invalidGroups = []) {
    if (invalid) {
      if (invalidGroups) {
        if (!Array.isArray(invalidGroups)) {
          throw new Error("InvalidGroup has to be array.")
        }

        // Get rid of duplicity.
        invalidGroups = [...new Set(invalidGroups)];

        for (var index in invalidGroups) {
          if (!Number.isInteger(invalidGroups[index])) {
            throw new Error("All indexes in invalid groups have to be integers.")
          }

          if (invalidGroups[index] < 0 && invalidGroups[index] > this.getGroupSize() -1) {
            throw new Error("All indexes in invalid groups have to be inbound.")
          }
        }
      } else {
        // At least one group has to be invalid.
        var certainlyInvalidGroup = this.randInt(0, this.getGroupSize() -1);
        for (var i = 0 ; i < this.getGroupSize() -1; i++) {
          if (i !== certainlyInvalidGroup && this._randBool()) {
            invalidGroups.push(i);
          } else {
            invalidGroups.push(i);
          }
        }
      }
    } else {
      invalidGroups = [];
    }
    return this._gen(this.tokens, [], invalidGroups, {currentGroup: 0});
  }

  /**
   * Generate random string modeled after given tokens.
   *
   * @param {Object} token
   * @param {Array.<String>} groups
   * @return {String}
   */
  _gen(token, groups, invalidGroups = [], groupWatcher) {
    var stack, str, n, i, l;

    switch (token.type) {
      case types.ROOT:
      case types.GROUP:
        // Ignore lookaheads for now.
        if (token.followedBy || token.notFollowedBy) { return ''; }

        // Insert placeholder until group string is generated.
        if (token.remember && token.groupNumber === undefined) {
          token.groupNumber = groups.push(null) - 1;
        }

        stack = token.options ?
          this._randSelect(token.options) : token.stack;

        str = '';
        for (i = 0, l = stack.length; i < l; i++) {
          str += this._gen(stack[i], groups, invalidGroups, groupWatcher);
          groupWatcher.currentGroup++;
        }

        if (token.remember) {
          groups[token.groupNumber] = str;
        }
        return str;

      case types.POSITION:
        // Do nothing for now.
        return '';

      case types.SET:
        var expandedSet = this._expand(token);
        if (!expandedSet.length) { return ''; }
        return String.fromCharCode(this._randSelect(expandedSet));

      case types.REPETITION:
        if (invalidGroups.includes(groupWatcher.currentGroup)) {
          var invalidRanges = [];

          if (token.min > 0) {
              invalidRanges.push({
                  min: 0,
                  max: token.min - 1
              });
          }

          if (token.max !== Infinity) {
            invalidRanges.push({
              min: token.max + 1,
              max: Infinity
            });
          }
          var invalidRange = invalidRanges[this.randInt(0, invalidRanges.length -1)];
          token.min = invalidRange.min;
          token.max = invalidRange.max;
        }
        // Randomly generate number between min and max.
        n = this.randInt(token.min,
          token.max === Infinity ? token.min + this.max : token.max);

        str = '';
        for (i = 0; i < n; i++) {
          str += this._gen(token.value, groups, invalidGroups, groupWatcher);
        }
        return str;

      case types.REFERENCE:
        return groups[token.value - 1] || '';

      case types.CHAR:
        var code;
        if (invalidGroups.includes(groupWatcher.currentGroup)) {
          var newRange = new DRange(32, 126).subtract(token.value);
          if (this.ignoreCase) {
            newRange.subtract(this._toOtherCase(token.value));
          }
          code = newRange.index(this.randInt(0, newRange.length - 1));
        } else {
          code = this.ignoreCase && this._randBool() ? this._toOtherCase(token.value) : token.value;
        }

        return String.fromCharCode(code);
    }
  }


  getGroupSize() {
    return this.tokens.stack.length;
  }

  /**
   * If code is alphabetic, converts to other case.
   * If not alphabetic, returns back code.
   *
   * @param {Number} code
   * @return {Number}
   */
  _toOtherCase(code) {
    return code + (97 <= code && code <= 122 ? -32 :
      65 <= code && code <= 90  ?  32 : 0);
  }


  /**
   * Randomly returns a true or false value.
   *
   * @return {Boolean}
   */
  _randBool() {
    return !this.randInt(0, 1);
  }


  /**
   * Randomly selects and returns a value from the array.
   *
   * @param {Array.<Object>} arr
   * @return {Object}
   */
  _randSelect(arr) {
    if (arr instanceof DRange) {
      if (this.reverse) {
        arr = new DRange(32, 126).subtract(arr);
      }
      return arr.index(this.randInt(0, arr.length - 1));
    }
    return arr[this.randInt(0, arr.length - 1)];
  }


  /**
   * expands a token to a DiscontinuousRange of characters which has a
   * length and an index function (for random selecting)
   *
   * @param {Object} token
   * @return {DiscontinuousRange}
   */
  _expand(token) {
    if (token.type === ret.types.CHAR) {
      return new DRange(token.value);
    } else if (token.type === ret.types.RANGE) {
      return new DRange(token.from, token.to);
    } else {
      let drange = new DRange();
      for (let i = 0; i < token.set.length; i++) {
        let subrange = this._expand(token.set[i]);
        drange.add(subrange);
        if (this.ignoreCase) {
          for (let j = 0; j < subrange.length; j++) {
            let code = subrange.index(j);
            let otherCaseCode = this._toOtherCase(code);
            if (code !== otherCaseCode) {
              drange.add(otherCaseCode);
            }
          }
        }
      }
      if (token.not) {
        return this.defaultRange.clone().subtract(drange);
      } else {
        return this.defaultRange.clone().intersect(drange);
      }
    }
  }


  /**
   * Randomly generates and returns a number between a and b (inclusive).
   *
   * @param {Number} a
   * @param {Number} b
   * @return {Number}
   */
  randInt(a, b) {
    return a + Math.floor(Math.random() * (1 + b - a));
  }


  /**
   * Default range of characters to generate from.
   */
  get defaultRange() {
    return this._range = this._range || new DRange(32, 126);
  }

  set defaultRange(range) {
    this._range = range;
  }

};
