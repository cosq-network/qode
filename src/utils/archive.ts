// src/utils/archive.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/** Execute a shell command and return stdout */
async function runCmd(cmd: string, cwd?: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { cwd, shell: '/bin/bash' });
  return stdout.trim();
}

/** Download a file from a URL to a destination path using curl */
export async function downloadFile(url: string, dest: string): Promise<void> {
  // Ensure parent directory exists
  const dir = path.dirname(dest);
  await execAsync(`mkdir -p "${dir}"`);
  // Use curl for reliable download, follow redirects, write to dest
  await runCmd(`curl -L -o "${dest}" "${url}"`);
}

/** Resolve the best available 7z binary, or null if none found */
async function detect7zBinary(): Promise<string | null> {
  const candidates = ['7z', '7za', '7zr'];

  for (const binary of candidates) {
    try {
      const { stdout } = await execAsync(`command -v ${binary}`, { shell: '/bin/bash' });
      const resolved = stdout.trim();
      if (resolved) {
        return resolved;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

/** Extract an archive (zip, tar.gz, tar.xz, tar.bz2, 7z) to a target directory */
export async function extractArchive(archivePath: string, outDir: string): Promise<void> {
  await execAsync(`mkdir -p "${outDir}"`);

  if (archivePath.endsWith('.7z') || archivePath.endsWith('.7z.001')) {
    const binary = await detect7zBinary();

    if (!binary) {
      throw new Error(
        '7zip is required to extract this archive. Install p7zip (Linux), p7zip-full (Debian/Ubuntu), or 7-Zip (macOS).'
      );
    }

    await runCmd(`"${binary}" x -y -o"${outDir}" "${archivePath}"`);
    return;
  }

  if (archivePath.endsWith('.zip')) {
    await runCmd(`unzip -q "${archivePath}" -d "${outDir}"`);
  } else {
    // tar handles .tar, .tar.gz, .tgz, .tar.xz, .txz, .tar.bz2, .tbz2
    await runCmd(`tar -xf "${archivePath}" -C "${outDir}"`);
  }
}

/** Compress a directory into the requested format */
export type ArchiveFormat = 'zip' | 'tgz' | 'txz' | '7z';
export async function compressDirectory(srcDir: string, destFile: string, format: ArchiveFormat): Promise<void> {
  if (format === 'zip') {
    await runCmd(`cd "${srcDir}" && zip -r "${destFile}" .`);
  } else if (format === 'tgz') {
    await runCmd(`tar -czf "${destFile}" -C "${srcDir}" .`);
  } else if (format === 'txz') {
    await runCmd(`tar -cJf "${destFile}" -C "${srcDir}" .`);
  } else if (format === '7z') {
    const binary = await detect7zBinary();

    if (!binary) {
      throw new Error(
        '7zip is required to create this archive. Install p7zip (Linux), p7zip-full (Debian/Ubuntu), or 7-Zip (macOS).'
      );
    }

    await runCmd(`"${binary}" a -t7z -r "${destFile}" "${srcDir}"`);
  } else {
    throw new Error(`Unsupported archive format: ${format}`);
  }
}

/** List contents of an archive without extracting */
export async function listArchive(archivePath: string): Promise<string> {
  if (archivePath.endsWith('.7z') || archivePath.endsWith('.7z.001')) {
    const binary = await detect7zBinary();

    if (!binary) {
      throw new Error(
        '7zip is required to list this archive. Install p7zip (Linux), p7zip-full (Debian/Ubuntu), or 7-Zip (macOS).'
      );
    }

    return await runCmd(`"${binary}" l "${archivePath}"`);
  }

  if (archivePath.endsWith('.zip')) {
    return await runCmd(`unzip -l "${archivePath}"`);
  }

  // Default to tar for other formats
  return await runCmd(`tar -tvf "${archivePath}"`);
}

/** Compute SHA-256 checksum of a file */
export async function checksumFile(filePath: string): Promise<string> {
  // macOS provides shasum, Linux may have sha256sum – both accept -a 256
  const out = await runCmd(`shasum -a 256 "${filePath}"`);
  // Output format: "<hash>  <filename>"
  return out.split(/\s+/)[0];
}

/** Convenience: download an archive and extract it */
export async function downloadAndExtract(url: string, outDir: string): Promise<void> {
  const tmpFile = path.join(outDir, 'tmp_download_' + Date.now());
  await Archive.downloadFile(url, tmpFile);
  await Archive.extractArchive(tmpFile, outDir);
  // Clean up the temporary archive file
  await execAsync(`rm -f "${tmpFile}"`);
}

// Export a simple namespace for easier imports
export const Archive = {
  downloadFile,
  extractArchive,
  compressDirectory,
  listArchive,
  checksumFile,
  downloadAndExtract,
};
