import JSZip from 'jszip';
import { join as tauriJoin } from '@tauri-apps/api/path';
import { writeFile as tauriWriteFile, writeTextFile as tauriWriteTextFile, mkdir as tauriMkdir, exists as tauriExists } from '@tauri-apps/plugin-fs';
import { generateStorageShim } from './storageShim.js';

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

  if (!(await exists(targetDir))) {
    await mkdir(targetDir, { recursive: true });
  }

  const zip = await JSZip.loadAsync(zipBytes);
  const files = Object.keys(zip.files);

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

    if (relativePath === entryPoint || relativePath.endsWith('/' + entryPoint)) {
      let htmlContent = await entry.async('string');
      const shim = generateStorageShim(gameId);
      if (htmlContent.includes('<head>')) {
        htmlContent = htmlContent.replace('<head>', `<head>${shim}`);
      } else {
        htmlContent = shim + htmlContent;
      }
      await writeTextFile(fullPath, htmlContent);
    } else {
      const data = await entry.async('uint8array');
      await writeFile(fullPath, data);
    }
  }
}
