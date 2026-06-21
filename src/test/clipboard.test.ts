// src/test/clipboard.test.ts
import { exec } from 'child_process';
import { copyToClipboard, pasteFromClipboard } from '../utils/clipboard.js';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const execMock = exec as unknown as jest.Mock;

describe('Clipboard utility', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  function setPlatform(platform: string) {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true,
    });
  }

  describe('copyToClipboard', () => {
    test('uses pbcopy on macOS (darwin)', async () => {
      setPlatform('darwin');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null));
        return { stdin: { write: jest.fn(), end: jest.fn() } } as any;
      });

      const success = await copyToClipboard('test mac');
      expect(success).toBe(true);
      expect(execMock).toHaveBeenCalledWith('pbcopy', expect.any(Function));
    });

    test('uses clip on Windows (win32)', async () => {
      setPlatform('win32');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null));
        return { stdin: { write: jest.fn(), end: jest.fn() } } as any;
      });

      const success = await copyToClipboard('test win');
      expect(success).toBe(true);
      expect(execMock).toHaveBeenCalledWith('clip', expect.any(Function));
    });

    test('uses xclip on Linux (linux)', async () => {
      setPlatform('linux');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null));
        return { stdin: { write: jest.fn(), end: jest.fn() } } as any;
      });

      const success = await copyToClipboard('test linux');
      expect(success).toBe(true);
      expect(execMock).toHaveBeenCalledWith('xclip -selection clipboard', expect.any(Function));
    });
  });

  describe('pasteFromClipboard', () => {
    test('uses pbpaste on macOS (darwin)', async () => {
      setPlatform('darwin');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null, 'mac pasted\n', ''));
      });

      const text = await pasteFromClipboard();
      expect(text).toBe('mac pasted');
      expect(execMock).toHaveBeenCalledWith('pbpaste', expect.any(Function));
    });

    test('uses powershell on Windows (win32)', async () => {
      setPlatform('win32');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null, 'win pasted\r\n', ''));
      });

      const text = await pasteFromClipboard();
      expect(text).toBe('win pasted');
      expect(execMock).toHaveBeenCalledWith('powershell -NoProfile -Command Get-Clipboard', expect.any(Function));
    });

    test('uses xclip/xsel on Linux (linux)', async () => {
      setPlatform('linux');
      execMock.mockImplementation((cmd, callback) => {
        setImmediate(() => callback(null, 'linux pasted', ''));
      });

      const text = await pasteFromClipboard();
      expect(text).toBe('linux pasted');
      expect(execMock).toHaveBeenCalledWith('xclip -selection clipboard -o || xsel --clipboard --output', expect.any(Function));
    });
  });
});
