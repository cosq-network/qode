import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';

marked.use(markedTerminal({
  code: chalk.blue,
  firstHeading: chalk.bold.underline.green,
  heading: chalk.bold.green,
  showSectionPrefix: false,
  reflowText: true,
  width: 80,
}) as any);

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}
