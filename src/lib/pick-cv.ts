import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { CV_MAX_BYTES, CV_TYPES, isCvFile } from '@/lib/ai-tools';
import type { UploadedFile } from '@/lib/site-api';

/**
 * Let the student pick their CV from Files (or Drive, or wherever), read as base64 for the
 * site's CV tools. Null when they back out; throws a message they can act on otherwise.
 */
export async function pickCv(): Promise<UploadedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: CV_TYPES, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!isCvFile(asset.name)) throw new Error('Pick your CV as a PDF, Word (.docx) or text file.');
  if (asset.size != null && asset.size > CV_MAX_BYTES) throw new Error('That file is too large. Keep your CV under 5 MB.');
  const fileBase64 = await new File(asset.uri).base64();
  return { fileName: asset.name, fileBase64 };
}
