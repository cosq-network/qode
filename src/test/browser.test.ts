import { FileBrowser } from '../utils/browser.js';
import fs from 'fs-extra';
import * as readline from 'readline';

jest.mock('fs-extra', () => ({
  readdir: jest.fn(),
}));

describe('FileBrowser', () => {
  let rlMock: any;
  let browser: FileBrowser;
  let mockWrite: jest.Mock;
  let mockPrompt: jest.Mock;
  let originalStdoutWrite: any;
  let originalStderrWrite: any;

  beforeAll(() => {
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;
    process.stdout.write = jest.fn();
    process.stderr.write = jest.fn();
  });

  afterAll(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockWrite = jest.fn();
    mockPrompt = jest.fn();

    rlMock = {
      write: mockWrite,
      prompt: mockPrompt,
    } as unknown as readline.Interface;

    browser = new FileBrowser(rlMock);
  });

  test('initial state', () => {
    expect(browser.getInBrowserMode()).toBe(false);
    expect(browser.getSelectedIndex()).toBe(0);
  });

  test('loadBrowserItems reads directory files and directories', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([
      { name: 'src', isDirectory: () => true, isFile: () => false },
      { name: 'package.json', isDirectory: () => false, isFile: () => true },
      { name: '.git', isDirectory: () => true, isFile: () => false },
    ]);

    await browser.loadBrowserItems();

    const items = browser.getBrowserItems();
    expect(items.some(item => item.name === '..')).toBe(true);
    expect(items.some(item => item.name === 'src')).toBe(true);
    expect(items.some(item => item.name === 'package.json')).toBe(true);
    expect(items.some(item => item.name === '.git')).toBe(false);
  });

  test('keypress up/down arrow changes selected index', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([
      { name: 'folderA', isDirectory: () => true, isFile: () => false },
      { name: 'fileB.txt', isDirectory: () => false, isFile: () => true },
    ]);

    await browser.start(jest.fn());
    const items = browser.getBrowserItems();
    expect(items.length).toBeGreaterThan(1);

    expect(browser.getSelectedIndex()).toBe(0);

    await browser.handleKeyPress('', { name: 'down' });
    expect(browser.getSelectedIndex()).toBe(1);

    await browser.handleKeyPress('', { name: 'up' });
    expect(browser.getSelectedIndex()).toBe(0);
  });

  test('keypress escape exits browser mode', async () => {
    await browser.start(jest.fn());
    expect(browser.getInBrowserMode()).toBe(true);

    await browser.handleKeyPress('', { name: 'escape' });
    expect(browser.getInBrowserMode()).toBe(false);
    expect(mockPrompt).toHaveBeenCalledWith(true);
  });

  test('keypress space/tab on file exits browser mode and inserts path', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([
      { name: 'fileB.txt', isDirectory: () => false, isFile: () => true },
    ]);

    await browser.start(jest.fn());
    const items = browser.getBrowserItems();
    const txtFileIdx = items.findIndex(item => item.name === 'fileB.txt');
    expect(txtFileIdx).toBeGreaterThanOrEqual(0);
    
    for (let i = 0; i < txtFileIdx; i++) {
      await browser.handleKeyPress('', { name: 'down' });
    }

    await browser.handleKeyPress('', { name: 'space' });
    expect(browser.getInBrowserMode()).toBe(false);
    expect(mockWrite).toHaveBeenCalled();
  });
});
