
const assert = require('assert');

const RandExp = require('../lib/randexp');


describe('Initialize RandExp with global()', () => {
    describe('Create a regular expression', () => {
        var regexp = /^[a-c]{3,5}gg(ddd[4-9]{0,3})r{5,}$/;
        var randexp = new RandExp(regexp);

        it('Run a tst for my debug', () => {
            for (var i = 0 ; i < 1000 ; i++) {
                var valid = randexp.genValid();
                if (!regexp.test(valid)) {
                    console.log("#" + i + " - not valid: " + valid);
                    assert.equal(regexp.test(valid), true);
                }

                var invalid = randexp.genInvalid();
                if (regexp.test(invalid)) {
                    console.log("#" + i + " not invalid: " + invalid);
                    assert.equal(regexp.test(invalid), false);
                }
            }
        });

    });
});
