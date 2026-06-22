import fs from 'fs-extra';
import path from 'path';

/** A document in the vector store. */
export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    lineStart?: number;
    lineEnd?: number;
    type: 'file' | 'chunk';
  };
  vector: number[];
}

/** Search result with similarity score. */
export interface SearchResult {
  document: VectorDocument;
  score: number;
}

/**
 * Simple in-memory vector store with cosine similarity search.
 * Uses TF-IDF for embeddings (no external API required).
 */
export class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private dirty: boolean = false;

  /** Add a document to the store. Vectors are computed lazily on search. */
  addDocument(doc: VectorDocument): void {
    this.documents.set(doc.id, doc);
    this.updateVocabulary(doc.content);
    this.dirty = true;
  }

  /** Remove a document from the store. */
  removeDocument(id: string): void {
    this.documents.delete(id);
    this.dirty = true;
  }

  /** Get all document IDs. */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }

  /** Get document count. */
  size(): number {
    return this.documents.size;
  }

  /** Clear all documents. */
  clear(): void {
    this.documents.clear();
    this.vocabulary.clear();
    this.idf.clear();
  }

  /** Update vocabulary with new text. */
  private updateVocabulary(text: string): void {
    const tokens = this.tokenize(text);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.vocabulary.set(token, (this.vocabulary.get(token) ?? 0) + 1);
    }
  }

  /** Compute IDF values for all terms. */
  computeIDF(): void {
    const totalDocs = this.documents.size;
    for (const [term, docCount] of this.vocabulary) {
      this.idf.set(term, Math.log((totalDocs + 1) / (docCount + 1)) + 1);
    }
  }

  /** Rebuild IDF and recompute all document vectors. Call after bulk adds. */
  rebuild(): void {
    this.computeIDF();
    for (const [, doc] of this.documents) {
      doc.vector = this.computeTFIDF(doc.content);
    }
    this.dirty = false;
  }

  /** Tokenize text into terms. */
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /** Compute TF-IDF vector for text. */
  computeTFIDF(text: string): number[] {
    const tokens = this.tokenize(text);
    const tf = new Map<string, number>();

    // Term frequency
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // TF-IDF vector
    const vocabArray = Array.from(this.vocabulary.keys());
    const vector: number[] = vocabArray.map((term) => {
      const termFreq = (tf.get(term) ?? 0) / tokens.length;
      const inverseDocFreq = this.idf.get(term) ?? 1;
      return termFreq * inverseDocFreq;
    });

    return vector;
  }

  /** Compute cosine similarity between two vectors. */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /** Search for similar documents. */
  search(query: string, topK: number = 5): SearchResult[] {
    // Rebuild vectors if documents were added/removed since last search
    if (this.dirty) {
      this.rebuild();
    }

    const queryVector = this.computeTFIDF(query);

    const results: SearchResult[] = [];
    for (const [, doc] of this.documents) {
      const score = this.cosineSimilarity(queryVector, doc.vector);
      if (score > 0.01) { // Minimum similarity threshold
        results.push({ document: doc, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /** Save the store to disk. */
  async save(filePath: string): Promise<void> {
    const data = {
      documents: Array.from(this.documents.entries()),
      vocabulary: Array.from(this.vocabulary.entries()),
    };
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data);
  }

  /** Load the store from disk. */
  async load(filePath: string): Promise<void> {
    try {
      const data = await fs.readJson(filePath);
      this.documents = new Map(data.documents);
      this.vocabulary = new Map(data.vocabulary);
      this.rebuild();
    } catch {
      // Start fresh if file doesn't exist
    }
  }
}

/** Singleton instance. */
let store: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!store) {
    store = new VectorStore();
  }
  return store;
}
