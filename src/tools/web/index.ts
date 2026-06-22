import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const MAX_RESPONSE_SIZE = 500_000; // 500KB
const DEFAULT_TIMEOUT = 30_000; // 30s

/** Strip HTML tags and decode common entities for plain text output. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert HTML to simple markdown-ish format. */
function htmlToMarkdown(html: string): string {
  const md = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

const webfetch: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'webfetch',
      description: 'Fetch content from a URL as text, markdown, or HTML. Useful for reading documentation and web content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Output format (default: text)' },
          timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
        },
        required: ['url'],
      },
    },
  } as any,
  metadata: { category: 'web', permissionKey: 'read' },
  execute: async (args) => {
    const url = args.url as string;
    const format = (args.format as string) || 'text';
    const timeout = (args.timeout as number) || DEFAULT_TIMEOUT;

    if (!url) return { output: '', error: 'url is required' };

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { output: '', error: `Invalid URL: ${url}` };
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { output: '', error: `Unsupported protocol: ${parsedUrl.protocol}. Only http/https supported.` };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Qode/1.0 (AI coding assistant)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      clearTimeout(timer);

      if (!response.ok) {
        return { output: '', error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') ?? '';
      let body = await response.text();

      // Truncate large responses
      if (body.length > MAX_RESPONSE_SIZE) {
        body = body.slice(0, MAX_RESPONSE_SIZE) + '\n\n[... truncated — response was ' + body.length + ' chars]';
      }

      // Convert based on format
      let output: string;
      switch (format) {
        case 'html':
          output = body;
          break;
        case 'markdown':
          output = contentType.includes('text/html')
            ? htmlToMarkdown(body)
            : body;
          break;
        case 'text':
        default:
          output = contentType.includes('text/html')
            ? htmlToText(body)
            : body;
          break;
      }

      // Add metadata header
      const header = `URL: ${url}\nStatus: ${response.status} ${response.statusText}\nContent-Type: ${contentType}\n${'─'.repeat(60)}\n`;

      return { output: header + output };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { output: '', error: `Request timed out after ${timeout}ms` };
      }
      return { output: '', error: `Fetch failed: ${e.message}` };
    }
  },
};

/** Register web tools. */
export function registerWebTools(): void {
  globalRegistry.register(webfetch);
}
