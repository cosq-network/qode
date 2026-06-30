import { showModelSelectorTUI } from '../model-selector-ui.js';
import blessed from 'blessed';
import { getAuthManager } from '../../auth/manager.js';

jest.mock('blessed', () => {
  const mockBox = {
    on: jest.fn(),
    destroy: jest.fn(),
    setContent: jest.fn(),
  };
  const mockList = {
    on: jest.fn(),
    setItems: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    select: jest.fn(),
  };
  const mockTextbox = {
    on: jest.fn(),
    focus: jest.fn(),
    destroy: jest.fn(),
  };
  return {
    box: jest.fn(() => mockBox),
    list: jest.fn(() => mockList),
    textbox: jest.fn(() => mockTextbox),
  };
});

const mockAuthManager = {
  isConfigured: jest.fn().mockResolvedValue(true),
};

jest.mock('../../auth/manager.js', () => ({
  getAuthManager: jest.fn(() => mockAuthManager),
}));

describe('showModelSelectorTUI', () => {
  let mockScreen: any;
  let mockColors: any;
  let mockConfig: any;

  beforeEach(() => {
    mockScreen = {
      remove: jest.fn(),
      render: jest.fn(),
    };
    mockColors = {
      headerBg: '#000',
      inputFg: '#fff',
      accentFg: '#aaa',
      systemTag: '#bbb',
    };
    mockConfig = {
      providers: {
        'Google AI Studio': { apiKey: 'mock-key' },
      },
    };
    jest.clearAllMocks();
  });

  test('creates UI elements and lists models', () => {
    void showModelSelectorTUI(mockScreen, mockColors, mockConfig);
    
    expect(blessed.box).toHaveBeenCalled();
    expect(blessed.list).toHaveBeenCalled();
    
    const listMock = (blessed.list as jest.Mock).mock.results[0].value;
    expect(listMock.setItems).toHaveBeenCalled();
    const items = listMock.setItems.mock.calls[0][0];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toContain('Gemini');
  });

  test('handles select when API Key exists', async () => {
    const promise = showModelSelectorTUI(mockScreen, mockColors, mockConfig);
    const listMock = (blessed.list as jest.Mock).mock.results[0].value;
    
    const selectCb = listMock.on.mock.calls.find((c: any) => c[0] === 'select')[1];
    
    // Simulate select of the first item (Gemini 2.5 Pro)
    selectCb({}, 0);
    
    const result = await promise;
    expect(result).toEqual({
      provider: 'Google AI Studio',
      model: 'gemini-2.5-pro',
    });
  });

  test('prompts for API key when none exists, and resolves with entered key', async () => {
    // Empty config providers to simulate missing key
    mockConfig.providers = {};
    const authSpy = getAuthManager().isConfigured as jest.Mock;
    authSpy.mockResolvedValueOnce(false);

    const promise = showModelSelectorTUI(mockScreen, mockColors, mockConfig);
    const listMock = (blessed.list as jest.Mock).mock.results[0].value;
    
    const selectCb = listMock.on.mock.calls.find((c: any) => c[0] === 'select')[1];
    await selectCb({}, 0);

    expect(blessed.textbox).toHaveBeenCalled();
    const textboxMock = (blessed.textbox as jest.Mock).mock.results[0].value;
    
    const submitCb = textboxMock.on.mock.calls.find((c: any) => c[0] === 'submit')[1];
    submitCb('new-entered-api-key');

    const result = await promise;
    expect(result).toEqual({
      provider: 'Google AI Studio',
      model: 'gemini-2.5-pro',
      apiKey: 'new-entered-api-key',
    });
  });

  test('textbox cancel resolves with null', async () => {
    mockConfig.providers = {};
    const authSpy = getAuthManager().isConfigured as jest.Mock;
    authSpy.mockResolvedValueOnce(false);

    const promise = showModelSelectorTUI(mockScreen, mockColors, mockConfig);
    const listMock = (blessed.list as jest.Mock).mock.results[0].value;
    
    const selectCb = listMock.on.mock.calls.find((c: any) => c[0] === 'select')[1];
    await selectCb({}, 0);

    const textboxMock = (blessed.textbox as jest.Mock).mock.results[0].value;
    const cancelCb = textboxMock.on.mock.calls.find((c: any) => c[0] === 'cancel')[1];
    cancelCb();

    const result = await promise;
    expect(result).toBeNull();
  });

  test('list cancel resolves with null', async () => {
    const promise = showModelSelectorTUI(mockScreen, mockColors, mockConfig);
    const listMock = (blessed.list as jest.Mock).mock.results[0].value;
    
    const cancelCb = listMock.on.mock.calls.find((c: any) => c[0] === 'cancel')[1];
    cancelCb();

    const result = await promise;
    expect(result).toBeNull();
  });
});
