import { VectorStore } from '../search/vector-store.js';

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  test('adds and retrieves documents', () => {
    store.addDocument({
      id: 'doc1',
      content: 'function calculate sum of two numbers',
      metadata: { filePath: 'src/math.ts', type: 'chunk' },
      vector: [],
    });
    expect(store.size()).toBe(1);
    expect(store.getDocumentIds()).toContain('doc1');
  });

  test('search returns relevant results after rebuild', () => {
    store.addDocument({
      id: 'doc1',
      content: 'function calculate sum of two numbers in TypeScript',
      metadata: { filePath: 'src/math.ts', type: 'chunk' },
      vector: [],
    });
    store.addDocument({
      id: 'doc2',
      content: 'database connection pool configuration settings',
      metadata: { filePath: 'src/db.ts', type: 'chunk' },
      vector: [],
    });
    store.addDocument({
      id: 'doc3',
      content: 'sum calculation arithmetic addition operation',
      metadata: { filePath: 'src/calc.ts', type: 'chunk' },
      vector: [],
    });

    // Search for "calculate sum" - should find doc1 and doc3
    const results = store.search('calculate sum');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // doc1 or doc3 should be in results (both mention sum/calculate)
    const resultIds = results.map((r) => r.document.id);
    expect(resultIds).toEqual(expect.arrayContaining(['doc1']));
    // All scores should be positive
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  test('search returns empty for unrelated queries', () => {
    store.addDocument({
      id: 'doc1',
      content: 'database connection pool configuration',
      metadata: { filePath: 'src/db.ts', type: 'chunk' },
      vector: [],
    });

    const results = store.search('quantum physics entanglement');
    // Should return no results or very low scores
    expect(results.length).toBe(0);
  });

  test('removeDocument removes a document', () => {
    store.addDocument({
      id: 'doc1',
      content: 'test content one',
      metadata: { filePath: 'a.ts', type: 'chunk' },
      vector: [],
    });
    store.addDocument({
      id: 'doc2',
      content: 'test content two',
      metadata: { filePath: 'b.ts', type: 'chunk' },
      vector: [],
    });
    expect(store.size()).toBe(2);
    store.removeDocument('doc1');
    expect(store.size()).toBe(1);
    expect(store.getDocumentIds()).not.toContain('doc1');
  });

  test('clear removes all documents', () => {
    store.addDocument({
      id: 'doc1',
      content: 'test content',
      metadata: { filePath: 'a.ts', type: 'chunk' },
      vector: [],
    });
    store.clear();
    expect(store.size()).toBe(0);
  });

  test('search respects topK limit', () => {
    for (let i = 0; i < 10; i++) {
      store.addDocument({
        id: `doc${i}`,
        content: `test function implementation number ${i}`,
        metadata: { filePath: `src/${i}.ts`, type: 'chunk' },
        vector: [],
      });
    }
    const results = store.search('test function', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('cosineSimilarity returns correct values', () => {
    expect(store.cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    expect(store.cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    expect(store.cosineSimilarity([], [])).toBe(0);
  });

  test('tokenize produces correct tokens', () => {
    const tokens = store.tokenize('Hello World! This is a TEST.');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('test');
    // "is" has length 2 so it passes the > 1 filter
    expect(tokens).toContain('is');
    // "a" has length 1 so it's filtered out
    expect(tokens).not.toContain('a');
  });

  test('dirty flag triggers rebuild on search', () => {
    store.addDocument({
      id: 'doc1',
      content: 'searchable content here',
      metadata: { filePath: 'a.ts', type: 'chunk' },
      vector: [],
    });
    // After add, dirty should be true
    const results = store.search('searchable content');
    // Results should exist because rebuild was triggered
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
