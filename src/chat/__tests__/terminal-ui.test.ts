import { TerminalChatUI } from '../terminal-ui';
import blessed from 'blessed';
import clipboardy from 'clipboardy';

jest.mock('clipboardy');

// Helper to create a minimal mock box with required properties
function createMockBox(content: string, top: number = 0, left: number = 0) {
  return {
    getContent: () => content,
    at: top, // blessed internal top offset
    al: left, // blessed internal left offset
    height: content.split('\\n').length,
    // The following are only needed for the scroll tests, not used here
    scroll: jest.fn(),
    scrollTo: jest.fn(),
    destroy: jest.fn(),
    setContent: jest.fn(),
    // Event handling placeholders
    on: jest.fn(),
    emit: jest.fn(),
  } as unknown as blessed.Widgets.BoxElement;
}

describe('TerminalChatUI - selection copy utilities', () => {
  let ui: TerminalChatUI;
  const dummyScreen = {
    render: jest.fn(),
    key: jest.fn(),
    destroy: jest.fn(),
  } as unknown as blessed.Widgets.Screen;

  beforeEach(() => {
    // Minimal stubs for constructor arguments
    const actionsStub = {} as any;
    const colorsStub = {} as any;
    ui = new TerminalChatUI(actionsStub, colorsStub);
    // Replace internal screen with mock to avoid side‑effects.
    (ui as any).screen = dummyScreen;
    // Attach mock transcript and input boxes.
    (ui as any).transcriptBox = createMockBox('line1\\nline2\\nline3', 0, 0);
    (ui as any).inputBox = createMockBox('input line', 0, 0);
  });

  test('extractSelection returns correct single‑line text', () => {
    const box = createMockBox('abcdef\\nghijkl');
    const result = (ui as any).extractSelection(box, { x: 2, y: 1 }, { x: 5, y: 1 });
    expect(result).toBe('bcde'); // characters 2‑5 (1‑based) of first line
  });

  test('extractSelection handles multi‑line selection', () => {
    const box = createMockBox('first line\\nsecond line\\nthird line');
    const start = { x: 7, y: 1 }; // after "first "
    const end = { x: 5, y: 3 };   // up to "third"
    const result = (ui as any).extractSelection(box, start, end);
    // Expected: "line" from first line, whole second line, "thir" from third
    expect(result).toBe('line\\nsecond line\\nthir');
  });

  test('enableSelectionCopy registers mouse events and copies on mouseup', () => {
    const box = (ui as any).transcriptBox;
    const onMock = jest.fn();
    (box as any).on = onMock;

    // Spy on the private alert method
    const alertSpy = jest.spyOn(ui as any, 'showCopyAlert').mockImplementation(() => {});

    (ui as any).enableSelectionCopy();

    // Expect two listeners (mousedown, mouseup) to be attached to the box
    expect(onMock).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('mouseup', expect.any(Function));

    // Retrieve the registered callbacks
    const mousedownCb = onMock.mock.calls.find(c => c[0] === 'mousedown')[1];
    const mouseupCb = onMock.mock.calls.find(c => c[0] === 'mouseup')[1];

    // Simulate a drag selection from (1,1) to (5,1) – selects "line"
    mousedownCb({ x: 1, y: 1 });
    mouseupCb({ x: 5, y: 1 });

    // Clipboard should have been called with selected text
    expect(clipboardy.writeSync).toHaveBeenCalledWith('line');
    // Alert should have been shown
    expect(alertSpy).toHaveBeenCalledWith('Copied to clipboard');
  });

  test('renderHeader correctly formats custom header with qode name, model, token usage, and percentage', () => {
    const mockHeaderBox = {
      setContent: jest.fn(),
      style: {}
    } as any;
    (ui as any).headerBox = mockHeaderBox;

    const mockState = {
      cwd: '/mock/cwd',
      modelName: 'gemini-1.5-pro',
      providerName: 'google',
      mode: 'chat',
      tokenUsage: '1200 / 80000',
    };

    (ui as any).renderHeader(mockState);

    expect(mockHeaderBox.setContent).toHaveBeenCalled();
    const content = mockHeaderBox.setContent.mock.calls[0][0];
    
    // Check that it contains "qode"
    expect(content).toContain('qode');
    // Check that it contains model name
    expect(content).toContain('gemini-1.5-pro');
    // Check that it contains provider name
    expect(content).toContain('google');
    // Check that it contains parsed token usage with formatted values
    expect(content).toContain('1,200 / 80,000');
    // Check that it contains correct percentage calculation: (1200 / 80000) * 100 = 1.50%
    expect(content).toContain('1.50%');
    // Check that it contains the clock/duration icon
    expect(content).toContain('🕒');
  });
});
