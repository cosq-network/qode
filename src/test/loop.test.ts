// src/test/loop.test.ts
jest.mock('../config.js', () => ({
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
}));

import { completer } from '../chat/loop.js';

describe('Chat Loop Completer', () => {
  test('completes commands starting with matching characters', () => {
    const [hits, line] = completer('/th');
    expect(line).toBe('/th');
    expect(hits).toContain('/theme');
    expect(hits.length).toBe(1);
  });

  test('returns multiple hits for common prefixes', () => {
    const [hits, line] = completer('/c');
    expect(line).toBe('/c');
    // should contain /compress, /clear, /copy, /cancel
    expect(hits).toContain('/compress');
    expect(hits).toContain('/clear');
    expect(hits).toContain('/copy');
    expect(hits).toContain('/cancel');
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });

  test('returns all completions if no match is found', () => {
    const [hits, line] = completer('/invalid');
    expect(line).toBe('/invalid');
    expect(hits).toContain('/model');
    expect(hits).toContain('/exit');
    expect(hits).toContain('/status');
    expect(hits.length).toBeGreaterThan(10);
  });

  test('returns matching completions for /s', () => {
    const [hits, line] = completer('/s');
    expect(line).toBe('/s');
    expect(hits).toContain('/status');
    expect(hits).toContain('/suggest');
    expect(hits).toContain('/save');
    expect(hits).toContain('/skills');
  });
});
