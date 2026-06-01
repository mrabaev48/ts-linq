import type { ValueGenerator, ValueGeneratorContext } from '@ts-linq/types';
import { randomBytes } from 'crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len: number): string {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    str = ENCODING[now % 32] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = randomBytes(Math.ceil((len * 5) / 8));
  let bits = 0;
  let bitsLen = 0;
  let result = '';
  let byteIdx = 0;
  while (result.length < len) {
    if (bitsLen < 5) {
      bits = (bits << 8) | bytes[byteIdx++];
      bitsLen += 8;
    }
    bitsLen -= 5;
    result += ENCODING[(bits >>> bitsLen) & 31];
  }
  return result;
}

export class UlidValueGenerator implements ValueGenerator<string> {
  next(_context: ValueGeneratorContext): string {
    return encodeTime(Date.now(), 10) + encodeRandom(16);
  }
}
