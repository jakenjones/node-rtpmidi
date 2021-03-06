// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var assert = require('assert');

process.stdin.setRawMode = function () {
    require('tty').setRawMode(true);
};

Buffer.prototype.readUInt8 = function (offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to read beyond buffer length');
    }

    return buffer[offset];
};

function readUInt16(buffer, offset, isBigEndian, noAssert) {
    var val = 0;


    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (isBigEndian) {
        val = buffer[offset] << 8;
        val |= buffer[offset + 1];
    } else {
        val = buffer[offset];
        val |= buffer[offset + 1] << 8;
    }

    return val;
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
    return readUInt16(this, offset, false, noAssert);
};

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
    return readUInt16(this, offset, true, noAssert);
};

function readUInt32(buffer, offset, isBigEndian, noAssert) {
    var val = 0;

    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (isBigEndian) {
        val = buffer[offset + 1] << 16;
        val |= buffer[offset + 2] << 8;
        val |= buffer[offset + 3];
        val = val + (buffer[offset] << 24 >>> 0);
    } else {
        val = buffer[offset + 2] << 16;
        val |= buffer[offset + 1] << 8;
        val |= buffer[offset];
        val = val + (buffer[offset + 3] << 24 >>> 0);
    }

    return val;
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
    return readUInt32(this, offset, false, noAssert);
};

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
    return readUInt32(this, offset, true, noAssert);
};


/*
 * Signed integer types, yay team! A reminder on how two's complement actually
 * works. The first bit is the signed bit, i.e. tells us whether or not the
 * number should be positive or negative. If the two's complement value is
 * positive, then we're done, as it's equivalent to the unsigned representation.
 *
 * Now if the number is positive, you're pretty much done, you can just leverage
 * the unsigned translations and return those. Unfortunately, negative numbers
 * aren't quite that straightforward.
 *
 * At first glance, one might be inclined to use the traditional formula to
 * translate binary numbers between the positive and negative values in two's
 * complement. (Though it doesn't quite work for the most negative value)
 * Mainly:
 *  - invert all the bits
 *  - add one to the result
 *
 * Of course, this doesn't quite work in Javascript. Take for example the value
 * of -128. This could be represented in 16 bits (big-endian) as 0xff80. But of
 * course, Javascript will do the following:
 *
 * > ~0xff80
 * -65409
 *
 * Whoh there, Javascript, that's not quite right. But wait, according to
 * Javascript that's perfectly correct. When Javascript ends up seeing the
 * constant 0xff80, it has no notion that it is actually a signed number. It
 * assumes that we've input the unsigned value 0xff80. Thus, when it does the
 * binary negation, it casts it into a signed value, (positive 0xff80). Then
 * when you perform binary negation on that, it turns it into a negative number.
 *
 * Instead, we're going to have to use the following general formula, that works
 * in a rather Javascript friendly way. I'm glad we don't support this kind of
 * weird numbering scheme in the kernel.
 *
 * (BIT-MAX - (unsigned)val + 1) * -1
 *
 * The astute observer, may think that this doesn't make sense for 8-bit numbers
 * (really it isn't necessary for them). However, when you get 16-bit numbers,
 * you do. Let's go back to our prior example and see how this will look:
 *
 * (0xffff - 0xff80 + 1) * -1
 * (0x007f + 1) * -1
 * (0x0080) * -1
 */
Buffer.prototype.readInt8 = function (offset, noAssert) {
    var buffer = this;
    var neg;

    if (!noAssert) {
        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to read beyond buffer length');
    }

    neg = buffer[offset] & 0x80;
    if (!neg) {
        return (buffer[offset]);
    }

    return ((0xff - buffer[offset] + 1) * -1);
};

function readInt16(buffer, offset, isBigEndian, noAssert) {
    var neg, val;

    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to read beyond buffer length');
    }

    val = readUInt16(buffer, offset, isBigEndian, noAssert);
    neg = val & 0x8000;
    if (!neg) {
        return val;
    }

    return (0xffff - val + 1) * -1;
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
    return readInt16(this, offset, false, noAssert);
};

Buffer.prototype.readInt16BE = function (offset, noAssert) {
    return readInt16(this, offset, true, noAssert);
};

function readInt32(buffer, offset, isBigEndian, noAssert) {
    var neg, val;

    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

    val = readUInt32(buffer, offset, isBigEndian, noAssert);
    neg = val & 0x80000000;
    if (!neg) {
        return (val);
    }

    return (0xffffffff - val + 1) * -1;
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
    return readInt32(this, offset, false, noAssert);
};

Buffer.prototype.readInt32BE = function (offset, noAssert) {
    return readInt32(this, offset, true, noAssert);
};

function readFloat(buffer, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

    return require('buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
        23, 4);
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
    return readFloat(this, offset, false, noAssert);
};

Buffer.prototype.readFloatBE = function (offset, noAssert) {
    return readFloat(this, offset, true, noAssert);
};

function readDouble(buffer, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset + 7 < buffer.length,
            'Trying to read beyond buffer length');
    }

    return require('buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
        52, 8);
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
    return readDouble(this, offset, false, noAssert);
};

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
    return readDouble(this, offset, true, noAssert);
};


/*
 * We have to make sure that the value is a valid integer. This means that it is
 * non-negative. It has no fractional component and that it does not exceed the
 * maximum allowed value.
 *
 *      value           The number to check for validity
 *
 *      max             The maximum value
 */
function verifuint(value, max) {
    assert.ok(typeof(value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value >= 0,
        'specified a negative value for writing an unsigned value');

    assert.ok(value <= max, 'value is larger than maximum value for type');

    assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xff);
    }

    buffer[offset] = value;
};

function writeUInt16(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xffff);
    }

    if (isBigEndian) {
        buffer[offset] = (value & 0xff00) >>> 8;
        buffer[offset + 1] = value & 0x00ff;
    } else {
        buffer[offset + 1] = (value & 0xff00) >>> 8;
        buffer[offset] = value & 0x00ff;
    }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
    writeUInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
    writeUInt16(this, value, offset, true, noAssert);
};

function writeUInt32(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xffffffff);
    }

    if (isBigEndian) {
        buffer[offset] = (value >>> 24) & 0xff;
        buffer[offset + 1] = (value >>> 16) & 0xff;
        buffer[offset + 2] = (value >>> 8) & 0xff;
        buffer[offset + 3] = value & 0xff;
    } else {
        buffer[offset + 3] = (value >>> 24) & 0xff;
        buffer[offset + 2] = (value >>> 16) & 0xff;
        buffer[offset + 1] = (value >>> 8) & 0xff;
        buffer[offset] = value & 0xff;
    }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
    writeUInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
    writeUInt32(this, value, offset, true, noAssert);
};


/*
 * We now move onto our friends in the signed number category. Unlike unsigned
 * numbers, we're going to have to worry a bit more about how we put values into
 * arrays. Since we are only worrying about signed 32-bit values, we're in
 * slightly better shape. Unfortunately, we really can't do our favorite binary
 * & in this system. It really seems to do the wrong thing. For example:
 *
 * > -32 & 0xff
 * 224
 *
 * What's happening above is really: 0xe0 & 0xff = 0xe0. However, the results of
 * this aren't treated as a signed number. Ultimately a bad thing.
 *
 * What we're going to want to do is basically create the unsigned equivalent of
 * our representation and pass that off to the wuint* functions. To do that
 * we're going to do the following:
 *
 *  - if the value is positive
 *      we can pass it directly off to the equivalent wuint
 *  - if the value is negative
 *      we do the following computation:
 *         mb + val + 1, where
 *         mb   is the maximum unsigned value in that byte size
 *         val  is the Javascript negative integer
 *
 *
 * As a concrete value, take -128. In signed 16 bits this would be 0xff80. If
 * you do out the computations:
 *
 * 0xffff - 128 + 1
 * 0xffff - 127
 * 0xff80
 *
 * You can then encode this value as the signed version. This is really rather
 * hacky, but it should work and get the job done which is our goal here.
 */

/*
 * A series of checks to make sure we actually have a signed 32-bit number
 */
function verifsint(value, max, min) {
    assert.ok(typeof(value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value <= max, 'value larger than maximum allowed value');

    assert.ok(value >= min, 'value smaller than minimum allowed value');

    assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

function verifIEEE754(value, max, min) {
    assert.ok(typeof(value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value <= max, 'value larger than maximum allowed value');

    assert.ok(value >= min, 'value smaller than minimum allowed value');
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7f, -0x80);
    }

    if (value >= 0) {
        buffer.writeUInt8(value, offset, noAssert);
    } else {
        buffer.writeUInt8(0xff + value + 1, offset, noAssert);
    }
};

function writeInt16(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7fff, -0x8000);
    }

    if (value >= 0) {
        writeUInt16(buffer, value, offset, isBigEndian, noAssert);
    } else {
        writeUInt16(buffer, 0xffff + value + 1, offset, isBigEndian, noAssert);
    }
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
    writeInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
    writeInt16(this, value, offset, true, noAssert);
};

function writeInt32(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7fffffff, -0x80000000);
    }

    if (value >= 0) {
        writeUInt32(buffer, value, offset, isBigEndian, noAssert);
    } else {
        writeUInt32(buffer, 0xffffffff + value + 1, offset, isBigEndian, noAssert);
    }
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
    writeInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
    writeInt32(this, value, offset, true, noAssert);
};

function writeFloat(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to write beyond buffer length');

        verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38);
    }

    require('buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
        23, 4);
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
    writeFloat(this, value, offset, false, noAssert);
};

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
    writeFloat(this, value, offset, true, noAssert);
};

function writeDouble(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof(isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 7 < buffer.length,
            'Trying to write beyond buffer length');

        verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308);
    }

    require('buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
        52, 8);
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
    writeDouble(this, value, offset, false, noAssert);
};

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
    writeDouble(this, value, offset, true, noAssert);
};
