import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { FileMessage } from './bridge';

const EXTENSIONS: Record<string, string> = {
  'text/calendar': 'ics',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/** A safe file name that keeps the page's name and has an extension the OS recognises. */
export function safeFilename(name: string, mimeType: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^[.\s-]+/, '')
    .trim()
    .slice(0, 120);
  const base = cleaned || 'download';
  if (/\.[a-z0-9]{1,5}$/i.test(base)) return base;
  const extension = EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()];
  return extension ? `${base}.${extension}` : base;
}

/**
 * Save a file from the page to the cache and open the share sheet, from which the student
 * can save it to Files or Photos, add an .ics to their calendar, or send it on.
 */
export async function shareFile({ filename, mimeType, base64 }: FileMessage) {
  try {
    if (!(await Sharing.isAvailableAsync())) return;
    const directory = new Directory(Paths.cache, 'downloads');
    if (!directory.exists) directory.create({ intermediates: true });
    const name = safeFilename(filename, mimeType);
    const file = new File(directory, name);
    file.create({ overwrite: true });
    file.write(base64, { encoding: 'base64' });
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeType.split(';')[0].trim() || undefined,
      dialogTitle: name,
    });
  } catch {
    // Dismissed, or the file couldn't be written; the page carries on either way.
  }
}
