// src/test/archive.test.ts
const path = require('path');
const { downloadFile, extractArchive, compressDirectory, listArchive, checksumFile, downloadAndExtract, Archive } = require('../utils/archive');
const { exec } = require('child_process');

// Mock child_process.exec globally
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, optionsOrCallback, maybeCallback) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback !== 'function') {
      throw new Error('Callback is not a function');
    }
    setImmediate(() => callback(null, { stdout: cmd, stderr: '' }));
    return { pid: 123 };
  }),
}));

const execMock = exec as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('downloadFile creates directory and uses curl', async () => {
  const url = 'https://example.com/file.txt';
  const dest = '/tmp/dir/file.txt';
  await downloadFile(url, dest);
  const dir = path.dirname(dest);
  expect(execMock).toHaveBeenCalledTimes(2);
  expect(execMock.mock.calls[0][0]).toBe(`mkdir -p \"${dir}\"`);
  expect(execMock.mock.calls[1][0]).toBe(`curl -L -o \"${dest}\" \"${url}\"`);
});

test('extractArchive uses unzip for zip files', async () => {
  const archive = '/tmp/archive.zip';
  const out = '/tmp/out';
  await extractArchive(archive, out);
  expect(execMock).toHaveBeenCalledTimes(2);
  expect(execMock.mock.calls[0][0]).toBe(`mkdir -p \"${out}\"`);
  expect(execMock.mock.calls[1][0]).toBe(`unzip -q \"${archive}\" -d \"${out}\"`);
});

test('compressDirectory zip creates zip archive', async () => {
  const src = '/tmp/src';
  const dest = '/tmp/out.zip';
  await compressDirectory(src, dest, 'zip');
  expect(execMock).toHaveBeenCalledTimes(1);
  expect(execMock.mock.calls[0][0]).toBe(`cd \"${src}\" && zip -r \"${dest}\" .`);
});

test('listArchive zip lists contents via unzip -l', async () => {
  const archive = '/tmp/archive.zip';
  const result = await listArchive(archive);
  expect(execMock).toHaveBeenCalledTimes(1);
  expect(execMock.mock.calls[0][0]).toBe(`unzip -l \"${archive}\"`);
  expect(result).toContain('unzip -l');
});

test('checksumFile uses shasum', async () => {
  const file = '/tmp/file.txt';
  const hash = await checksumFile(file);
  expect(execMock).toHaveBeenCalledTimes(1);
  expect(execMock.mock.calls[0][0]).toBe(`shasum -a 256 \"${file}\"`);
  // checksumFile returns only the hash portion
  expect(hash).toBe('shasum');
});

test('downloadAndExtract orchestrates download and extract', async () => {
  const url = 'https://example.com/archive.tgz';
  const out = '/tmp/outdir';
  const dlSpy = jest.spyOn(Archive, 'downloadFile').mockResolvedValue(undefined);
  const exSpy = jest.spyOn(Archive, 'extractArchive').mockResolvedValue(undefined);
  await downloadAndExtract(url, out);
  expect(dlSpy).toHaveBeenCalledTimes(1);
  expect(exSpy).toHaveBeenCalledTimes(1);
  dlSpy.mockRestore();
  exSpy.mockRestore();
});
