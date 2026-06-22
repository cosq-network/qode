import { globalRegistry } from '../registry.js';
import { buildIndex, loadIndex, searchIndex } from '../../search/indexer.js';
import type { RegisteredTool } from '../registry.js';

const semanticSearchTool: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'semantic_search',
      description: 'Search the codebase using semantic similarity. Finds code that matches the meaning of your query, not just keywords.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'The search query describing what you are looking for',
          },
          topK: {
            type: 'number',
            description: 'Number of results to return (default: 10)',
          },
          rebuild: {
            type: 'boolean',
            description: 'Force rebuild the search index before searching',
          },
        },
        required: ['query'],
      },
    },
  },
  metadata: {
    category: 'search',
    permissionKey: 'read',
  },
  execute: async (args: Record<string, unknown>) => {
    const query = args.query as string;
    const topK = (args.topK as number) ?? 10;
    const rebuild = args.rebuild as boolean ?? false;

    // Build or load index
    if (rebuild) {
      await buildIndex();
    } else {
      const loaded = await loadIndex();
      if (!loaded) {
        await buildIndex();
      }
    }

    // Search
    const results = searchIndex(query, topK);

    if (results.length === 0) {
      return `No results found for: "${query}"`;
    }

    // Format results
    const lines: string[] = [`# Search Results for "${query}"`, ''];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const { filePath, lineStart, lineEnd } = result.document.metadata;
      const score = (result.score * 100).toFixed(1);
      const location = lineStart ? `${filePath}:${lineStart}-${lineEnd}` : filePath;

      lines.push(`## ${i + 1}. ${location} (${score}% match)`);
      lines.push('```');
      // Show first 20 lines of content
      const contentLines = result.document.content.split('\n').slice(0, 20);
      lines.push(contentLines.join('\n'));
      if (result.document.content.split('\n').length > 20) {
        lines.push('...');
      }
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  },
};

export function registerSemanticSearchTool(): void {
  globalRegistry.register(semanticSearchTool);
}
