import blessed from 'blessed';
import { PROVIDER_CATALOG } from '../providers/catalog.js';

export interface SetupResult {
  provider: string;
  model: string;
  apiKey: string;
}

export function runSetupTUI(screen: blessed.Widgets.Screen, colors: any): Promise<SetupResult | null> {
  return new Promise((resolve) => {
    let currentProvider: string | null = null;
    let currentModel: string | null = null;

    const overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      border: 'line',
      style: {
        bg: colors.headerBg,
        fg: colors.inputFg,
        border: { fg: colors.accentFg },
      },
      tags: true,
      content: '{bold}Welcome to Qode Setup{/}\n\nSelect a provider (Up/Down, Enter to select, Esc to cancel):',
    });

    const list = blessed.list({
      parent: overlay,
      top: 3,
      left: 1,
      right: 1,
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
      items: PROVIDER_CATALOG.filter(p => p.models.length > 0).map(p => p.key),
    });

    const cleanup = () => {
      screen.remove(overlay);
      screen.render();
    };

    list.on('select', (item: any) => {
      const selectedText = item.getText();
      if (!currentProvider) {
        currentProvider = selectedText;
        const providerData = PROVIDER_CATALOG.find(p => p.key === currentProvider);
        
        overlay.setContent(`{bold}Setup: ${currentProvider}{/}\n\nSelect a model (Up/Down, Enter to select, Esc to cancel):`);
        list.setItems(providerData?.models.map(m => m.label) || []);
        list.select(0);
        screen.render();
      } else if (!currentModel) {
        currentModel = selectedText;
        const providerData = PROVIDER_CATALOG.find(p => p.key === currentProvider);
        const modelData = providerData?.models.find(m => m.label === currentModel);
        
        list.hide();
        overlay.setContent(`{bold}Setup: ${currentProvider} -> ${currentModel}{/}\n\nEnter API Key (will be masked, Enter to submit, Esc to cancel):`);
        
        const textbox = blessed.textbox({
          parent: overlay,
          top: 4,
          left: 1,
          right: 1,
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
          cleanup();
          resolve({ provider: currentProvider!, model: modelData!.id, apiKey: value.trim() });
        });
        
        textbox.on('cancel', () => {
          cleanup();
          resolve(null);
        });

        textbox.focus();
        screen.render();
      }
    });

    list.on('cancel', () => {
      cleanup();
      resolve(null);
    });

    list.focus();
    screen.render();
  });
}
