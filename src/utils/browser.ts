import fs from 'fs-extra';
import path from 'path';
import * as readline from 'readline';
import { logger } from './logger.js';
import { ICONS } from './themes.js';

export class FileBrowser {
  private inBrowserMode = false;
  private browserCwd = process.cwd();
  private browserItems: { name: string; isDir: boolean }[] = [];
  private browserSelectedIndex = 0;
  private browserViewportStart = 0;
  private browserLineCount = 0;
  private savedRlListeners: any[] = [];
  private rl: readline.Interface;

  constructor(rl: readline.Interface) {
    this.rl = rl;
  }

  public getInBrowserMode(): boolean {
    return this.inBrowserMode;
  }

  public getBrowserCwd(): string {
    return this.browserCwd;
  }

  public getSelectedIndex(): number {
    return this.browserSelectedIndex;
  }

  public getBrowserItems(): { name: string; isDir: boolean }[] {
    return this.browserItems;
  }

  public async start(mainKeypressHandler: any) {
    this.inBrowserMode = true;
    this.browserCwd = process.cwd();

    // Save and remove other keypress listeners (readline's internal listeners)
    this.savedRlListeners = process.stdin.listeners('keypress').filter(l => l !== mainKeypressHandler);
    this.savedRlListeners.forEach(l => process.stdin.removeListener('keypress', l));

    await this.loadBrowserItems();
    this.renderBrowser();
  }

  public async loadBrowserItems() {
    try {
      const entries = await fs.readdir(this.browserCwd, { withFileTypes: true });
      const dirs: { name: string; isDir: boolean }[] = [];
      const files: { name: string; isDir: boolean }[] = [];

      const isRoot = path.resolve(this.browserCwd) === path.parse(this.browserCwd).root;
      if (!isRoot) {
        dirs.push({ name: '..', isDir: true });
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
          dirs.push({ name: entry.name, isDir: true });
        } else if (entry.isFile()) {
          files.push({ name: entry.name, isDir: false });
        }
      }

      dirs.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));

      this.browserItems = [...dirs, ...files];
      this.browserSelectedIndex = 0;
      this.browserViewportStart = 0;
    } catch (err: any) {
      this.browserItems = [];
      this.browserSelectedIndex = 0;
      this.browserViewportStart = 0;
      logger.error(`Error reading directory: ${err.message}`);
    }
  }

  public clearBrowserUI() {
    if (this.browserLineCount > 0) {
      readline.moveCursor(process.stdout, 0, -this.browserLineCount);
      readline.clearScreenDown(process.stdout);
      this.browserLineCount = 0;
    }
  }

  public renderBrowser() {
    this.clearBrowserUI();

    const lines: string[] = [];
    const relativeCwd = path.relative(process.cwd(), this.browserCwd) || '.';
    lines.push(`\n\x1b[36m${ICONS.dir} File Browser: ${relativeCwd}\x1b[0m`);
    lines.push(`\x1b[90mUse ↑/↓ to navigate | Enter to select/open | Space or Tab to insert hovered | Esc to cancel\x1b[0m`);
    lines.push(`─`.repeat(78));

    if (this.browserItems.length === 0) {
      lines.push(`  (empty directory)`);
    } else {
      const maxVisible = 10;
      if (this.browserSelectedIndex < this.browserViewportStart) {
        this.browserViewportStart = this.browserSelectedIndex;
      } else if (this.browserSelectedIndex >= this.browserViewportStart + maxVisible) {
        this.browserViewportStart = this.browserSelectedIndex - maxVisible + 1;
      }

      const endIdx = Math.min(this.browserViewportStart + maxVisible, this.browserItems.length);

      for (let i = this.browserViewportStart; i < endIdx; i++) {
        const item = this.browserItems[i];
        const isSelected = i === this.browserSelectedIndex;
        const prefix = isSelected ? ' \x1b[33m>\x1b[0m ' : '   ';
        const icon = item.isDir ? ICONS.dir : ICONS.file;
        const displayName = isSelected 
          ? `\x1b[1m\x1b[33m${item.name}\x1b[0m` 
          : item.name;
        lines.push(`${prefix}${icon} ${displayName}`);
      }

      if (this.browserItems.length > maxVisible) {
        lines.push(`\x1b[90m  ... (showing ${this.browserViewportStart + 1}-${endIdx} of ${this.browserItems.length}) ...\x1b[0m`);
      }
    }

    for (const line of lines) {
      process.stdout.write(line + '\n');
    }

    this.browserLineCount = lines.length;
  }

  public exitBrowserMode(selectedPath: string | null) {
    this.inBrowserMode = false;
    this.clearBrowserUI();

    // Restore readline keypress listeners
    this.savedRlListeners.forEach(l => process.stdin.on('keypress', l));
    this.savedRlListeners = [];

    if (selectedPath) {
      this.rl.write(selectedPath);
    } else {
      this.rl.prompt(true);
    }
  }

  public async handleKeyPress(str: string, key: any): Promise<boolean> {
    if (!this.inBrowserMode) return false;

    if (key) {
      if (key.name === 'up') {
        this.browserSelectedIndex = (this.browserSelectedIndex - 1 + this.browserItems.length) % this.browserItems.length;
        this.renderBrowser();
      } else if (key.name === 'down') {
        this.browserSelectedIndex = (this.browserSelectedIndex + 1) % this.browserItems.length;
        this.renderBrowser();
      } else if (key.name === 'return') {
        const selected = this.browserItems[this.browserSelectedIndex];
        if (selected) {
          if (selected.name === '..') {
            this.browserCwd = path.dirname(this.browserCwd);
            await this.loadBrowserItems();
            this.renderBrowser();
          } else if (selected.isDir) {
            this.browserCwd = path.join(this.browserCwd, selected.name);
            await this.loadBrowserItems();
            this.renderBrowser();
          } else {
            const relativePath = path.relative(process.cwd(), path.join(this.browserCwd, selected.name));
            this.exitBrowserMode(relativePath);
          }
        }
      } else if (key.name === 'space' || key.name === 'tab' || str === ' ') {
        const selected = this.browserItems[this.browserSelectedIndex];
        if (selected && selected.name !== '..') {
          const relativePath = path.relative(process.cwd(), path.join(this.browserCwd, selected.name));
          this.exitBrowserMode(relativePath);
        }
      } else if (key.name === 'right') {
        const selected = this.browserItems[this.browserSelectedIndex];
        if (selected && selected.isDir && selected.name !== '..') {
          this.browserCwd = path.join(this.browserCwd, selected.name);
          await this.loadBrowserItems();
          this.renderBrowser();
        }
      } else if (key.name === 'left' || key.name === 'backspace') {
        this.browserCwd = path.dirname(this.browserCwd);
        await this.loadBrowserItems();
        this.renderBrowser();
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        this.exitBrowserMode(null);
      }
    }
    return true;
  }
}
