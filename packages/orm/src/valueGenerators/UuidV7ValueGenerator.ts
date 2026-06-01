import type { ValueGenerator, ValueGeneratorContext } from '@ts-linq/types';
import { randomBytes } from 'crypto';

function toHex(n: number, len: number): string {
  return n.toString(16).padStart(len, '0');
}

export class UuidV7ValueGenerator implements ValueGenerator<string> {
  next(_context: ValueGeneratorContext): string {
    const now = Date.now();
    const msHigh = Math.floor(now / 0x1000);
    const msLow = now & 0xfff;

    const rand = randomBytes(10);

    // UUIDv7 layout (RFC 9562):
    // time_high (32 bits) | time_mid (16 bits) | ver(4) + time_low(12) | var(2) + rand_a(14) | rand_b(48)
    const timeHigh = toHex(msHigh >>> 0, 8);
    const timeMid = toHex((msHigh / 0x100000000) & 0xffff, 4);
    const timeLowVer = toHex((0x7000 | msLow) >>> 0, 4);
    const randA = toHex(((rand[0] & 0x3f) << 8) | rand[1], 4);
    const randB =
      toHex(rand[2], 2) +
      toHex(rand[3], 2) +
      toHex(rand[4], 2) +
      toHex(rand[5], 2) +
      toHex(rand[6], 2) +
      toHex(rand[7], 2);

    return `${timeHigh}-${timeMid}-${timeLowVer}-${randA}-${randB}`;
  }
}
