import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

export { after, assert, before, describe, test };

export interface CapturedConsole<T> {
  readonly result: T;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs `fn` while recording everything written through console.log / console.error.
 */
export async function captureConsole<T>(fn: () => Promise<T>): Promise<CapturedConsole<T>> {
  const originalLog = console.log;
  const originalError = console.error;
  const out: string[] = [];
  const err: string[] = [];
  console.log = (...args: unknown[]) => {
    out.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    err.push(args.map(String).join(' '));
  };

  try {
    const result = await fn();
    return { result, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/** Minimal Jest-style assertions on top of node:assert, shared by every test file. */
export const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(actual, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
  toBeDefined: () => assert.notStrictEqual(actual, undefined),
  toHaveLength: (len: number) => assert.strictEqual((actual as { length: number }).length, len),
  toContain: (item: unknown) => {
    if (typeof actual === 'string') {
      assert.ok(
        typeof item === 'string' && actual.includes(item),
        `Expected "${actual}" to contain "${item}"`
      );
    } else if (Array.isArray(actual)) {
      assert.ok(actual.includes(item), `Expected array to contain ${item}`);
    } else {
      assert.ok(false, 'Unsupported type for toContain');
    }
  },
  toBeGreaterThan: (num: number) =>
    assert.ok((actual as number) > num, `Expected ${actual} > ${num}`),
  toBeGreaterThanOrEqual: (num: number) =>
    assert.ok((actual as number) >= num, `Expected ${actual} >= ${num}`),
  toBeInstanceOf: (ctor: abstract new (...args: never[]) => unknown) =>
    assert.ok(actual instanceof ctor, `Expected value to be instance of ${ctor.name}`),
  toThrow: (pattern?: RegExp | string) => {
    const fn = actual as () => unknown;
    if (pattern instanceof RegExp) {
      assert.throws(fn, pattern);
    } else if (typeof pattern === 'string') {
      assert.throws(fn, new RegExp(pattern));
    } else {
      assert.throws(fn);
    }
  },
});
