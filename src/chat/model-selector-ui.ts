import blessed from 'blessed';
import { PROVIDER_CATALOG } from '../providers/catalog.js';
import { getAuthManager } from '../auth/manager.js';

export interface ModelSelectorResult {
  provider: string; // provider key (e.g. 'Google AI Studio')
  model: string;    // model id (e.g. 'gemini-3.5-flash')
  apiKey?: string;  // if prompted and entered
}

export function showModelSelectorTUI(
  screen: blessed.Widgets.Screen,
  colors: any,
  config: any
): Promise<ModelSelectorResult | null> {
  return new Promise((resolve) => {
    let textbox: blessed.Widgets.TextboxElement | null = null;

    // Create a flat list of all models across all providers
    const allModels: Array<{
      providerKey: string;
      modelId: string;
      modelLabel: string;
    }> = [];

    for (const provider of PROVIDER_CATALOG) {
      for (const m of provider.models) {
        allModels.push({
          providerKey: provider.key,
          modelId: m.id,
          modelLabel: m.label,
        });
      }
    }

    const overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 20,
      border: 'line',
      style: {
        bg: colors.headerBg,
        fg: colors.inputFg,
        border: { fg: colors.accentFg, bold: true },
      },
      tags: true,
    });

    const header = blessed.box({
      parent: overlay,
      top: 1,
      left: 'center',
      width: '100%-4',
      height: 1,
      content: '{center}{bold}Select Model{/bold}{/center}',
      tags: true,
      style: {
        bg: colors.headerBg,
        fg: colors.systemTag,
      }
    });

    const promptText = blessed.box({
      parent: overlay,
      top: 3,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      style: { bg: colors.headerBg, fg: colors.inputFg }
    });

    const list = blessed.list({
      parent: overlay,
      top: 5,
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

    const showModelList = () => {
      if (textbox) {
        textbox.destroy();
        textbox = null;
      }
      header.setContent('{center}{bold}Select Model{/bold}{/center}');
      promptText.setContent('Choose a model:\n{gray-fg}(Up/Down, Enter to select, Esc to cancel){/gray-fg}');
      
      const items = allModels.map(
        (m) => `[${m.providerKey}] ${m.modelLabel}`
      );
      list.setItems(items);
      list.show();
      list.focus();
      list.select(0);
      screen.render();
    };

    const promptForKey = (providerKey: string, modelId: string) => {
      list.hide();
      header.setContent('{center}{bold}API Key Required{/bold}{/center}');
      promptText.setContent(`No API Key found for {cyan-fg}${providerKey}{/cyan-fg}.\nPlease enter API Key for {bold}${modelId}{/bold}\n{gray-fg}(Enter to submit, Esc to cancel){/gray-fg}:`);
      
      textbox = blessed.textbox({
        parent: overlay,
        top: 8,
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
        const apiKey = value.trim();
        process.nextTick(() => {
          cleanup();
          resolve({
            provider: providerKey,
            model: modelId,
            apiKey: apiKey || undefined,
          });
        });
      });

      textbox.on('cancel', () => {
        process.nextTick(() => {
          cleanup();
          resolve(null);
        });
      });

      textbox.focus();
      screen.render();
    };

    list.on('select', async (item: any, index: number) => {
      const selectedModel = allModels[index];
      if (!selectedModel) return;

      const pKey = selectedModel.providerKey;
      const mId = selectedModel.modelId;
      
      let hasKey = !!config.providers[pKey]?.apiKey;
      if (!hasKey) {
        const authManager = getAuthManager();
        hasKey = await authManager.isConfigured(pKey);
      }

      if (hasKey) {
        process.nextTick(() => {
          cleanup();
          resolve({
            provider: pKey,
            model: mId,
          });
        });
      } else {
        promptForKey(pKey, mId);
      }
    });

    list.on('cancel', () => {
      process.nextTick(() => {
        cleanup();
        resolve(null);
      });
    });

    showModelList();
  });
}
