import JSZip from 'jszip';
import { join as tauriJoin } from '@tauri-apps/api/path';
import { writeFile as tauriWriteFile, writeTextFile as tauriWriteTextFile, mkdir as tauriMkdir, exists as tauriExists } from '@tauri-apps/plugin-fs';
import { injectStorageShim } from './storageShim.js';
import { LauncherError, unsafePath } from './safety.js';

export async function extractZipBundle(
  zipBytes,
  targetDir,
  gameId,
  entryPoint = 'index.html',
  customOps = {}
) {
  const exists = customOps.exists || tauriExists;
  const mkdir = customOps.mkdir || tauriMkdir;
  const writeFile = customOps.writeFile || tauriWriteFile;
  const writeTextFile = customOps.writeTextFile || tauriWriteTextFile;
  const join = customOps.join || tauriJoin;

  let zip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch {
    throw new LauncherError('err_damaged', 'The download is not a valid zip file');
  }
  const files = Object.keys(zip.files);

  // R1: every name is checked before anything is written; one bad name rejects the whole archive.
  for (const name of files) {
    const why = unsafePath(name.replace(/\/$/, ''));
    if (why) throw new LauncherError('err_damaged', `Unsafe path in zip (${why}): ${name.slice(0, 60)}`);
  }

  if (!(await exists(targetDir))) {
    await mkdir(targetDir, { recursive: true });
  }

  for (const relativePath of files) {
    const entry = zip.files[relativePath];
    const fullPath = await join(targetDir, relativePath);

    if (entry.dir) {
      if (!(await exists(fullPath))) {
        await mkdir(fullPath, { recursive: true });
      }
      continue;
    }

    const segments = relativePath.split('/');
    if (segments.length > 1) {
      segments.pop();
      const parentDir = await join(targetDir, segments.join('/'));
      if (!(await exists(parentDir))) {
        await mkdir(parentDir, { recursive: true });
      }
    }

    if (relativePath === entryPoint) {
      await writeTextFile(fullPath, injectStorageShim(await entry.async('string'), gameId));
    } else {
      await writeFile(fullPath, await entry.async('uint8array'));
    }
  }
}
