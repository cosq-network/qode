import blessed from 'blessed';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROVIDER_CATALOG } from '../providers/catalog.js';

export interface SetupResult {
  provider: string;
  model: string;
  apiKey: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../../assets/logo.png');

export function runSetupTUI(screen: blessed.Widgets.Screen, colors: any): Promise<SetupResult | null> {
  return new Promise((resolve) => {
    let currentProvider: string | null = null;
    let currentModel: string | null = null;
    let textbox: blessed.Widgets.TextboxElement | null = null;

    const overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 64,
      height: 30,
      border: 'line',
      style: {
        bg: colors.headerBg,
        fg: colors.inputFg,
        border: { fg: colors.accentFg },
      },
      tags: true,
    });

    (blessed as any).image({
      parent: overlay,
      top: 1,
      left: 'center',
      width: 40,
      height: 12,
      file: LOGO_PATH,
      type: 'ansi',
      style: {
        bg: colors.headerBg,
      }
    });

    const header = blessed.box({
      parent: overlay,
      top: 14,
      left: 'center',
      width: '100%-4',
      height: 1,
      content: '{center}{bold}Welcome to Qode Setup{/bold}{/center}',
      tags: true,
      style: {
        bg: colors.headerBg,
        fg: colors.systemTag,
      }
    });

    const promptText = blessed.box({
      parent: overlay,
      top: 16,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      style: { bg: colors.headerBg, fg: colors.inputFg }
    });

    const list = blessed.list({
      parent: overlay,
      top: 18,
      left: 2,
      right: 2,
      bottom: 1,
      keys: true,
      vi: true,
      style: {
        bg: colors.headerBg,
        fg: colors.inputFg,
        selected: {
          bg: colors.accentFg,
          fg: '#000000',
          bold: true,
        },
      },
    });

    const cleanup = () => {
      if (textbox) {
        textbox.destroy();
      }
      screen.remove(overlay);
      screen.render();
    };

    const showProviders = () => {
      currentProvider = null;
      currentModel = null;
      if (textbox) {
        textbox.destroy();
        textbox = null;
      }
      header.setContent('{center}{bold}Qode Setup - Step 1/3{/bold}{/center}');
      promptText.setContent('Select a provider:\n{gray-fg}(Up/Down, Enter to select, Esc to cancel){/gray-fg}');
      list.setItems(PROVIDER_CATALOG.filter(p => p.models.length > 0).map(p => p.key));
      list.show();
      list.focus();
      list.select(0);
      screen.render();
    };

    const showModels = () => {
      currentModel = null;
      if (textbox) {
        textbox.destroy();
        textbox = null;
      }
      const providerData = PROVIDER_CATALOG.find(p => p.key === currentProvider);
      header.setContent('{center}{bold}Qode Setup - Step 2/3{/bold}{/center}');
      promptText.setContent(`Provider: {cyan-fg}${currentProvider}{/cyan-fg}\nSelect a model {gray-fg}(Up/Down, Enter to select, Esc to go back){/gray-fg}:`);
      list.setItems(providerData?.models.map(m => m.label) || []);
      list.show();
      list.focus();
      list.select(0);
      screen.render();
    };

    const showApiKey = () => {
      const providerData = PROVIDER_CATALOG.find(p => p.key === currentProvider);
      const modelData = providerData?.models.find(m => m.label === currentModel);
      list.hide();
      header.setContent('{center}{bold}Qode Setup - Step 3/3{/bold}{/center}');
      promptText.setContent(`Model: {cyan-fg}${currentProvider} -> ${currentModel}{/cyan-fg}\nEnter API Key {gray-fg}(Enter to submit, Esc to go back){/gray-fg}:`);
      
      textbox = blessed.textbox({
        parent: overlay,
        top: 20,
        left: 2,
        right: 2,
        height: 3,
        keys: true,
        inputOnFocus: true,
        censor: true,
        border: 'line',
        style: {
          bg: colors.inputBg,
          fg: colors.inputFg,
          border: { fg: colors.accentFg },
          focus: { border: { fg: colors.systemTag } },
        },
      });
      
      textbox.on('submit', (value: string) => {
        process.nextTick(() => {
          cleanup();
          resolve({ provider: currentProvider!, model: modelData!.id, apiKey: value.trim() });
        });
      });
      
      textbox.on('cancel', () => {
        showModels();
      });

      textbox.focus();
      screen.render();
    };

    list.on('select', (item: any) => {
      const selectedText = item.getText();
      if (!currentProvider) {
        currentProvider = selectedText;
        showModels();
      } else if (!currentModel) {
        currentModel = selectedText;
        showApiKey();
      }
    });

    list.on('cancel', () => {
      if (currentProvider) {
        showProviders();
      } else {
        process.nextTick(() => {
          cleanup();
          resolve(null);
        });
      }
    });

    showProviders();
  });
}
