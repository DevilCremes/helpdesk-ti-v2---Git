import * as FS from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const DIR = new FS.Directory(FS.Paths.document, 'attachments');

export async function ensureDir(): Promise<void> {
  if (!DIR.exists) DIR.create({ intermediates: true });
}

export async function saveFile(uri: string, name: string): Promise<string> {
  await ensureDir();
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = new FS.File(DIR, `${Crypto.randomUUID()}_${safe}`);
  const src = new FS.File(uri);
  src.copy(dest);
  return dest.uri;
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const f = new FS.File(path);
    if (f.exists) f.delete();
  } catch {}
}

export async function readBase64(path: string): Promise<string> {
  const f = new FS.File(path);
  return f.base64();
}

export function isImage(name: string, mimeType?: string | null): boolean {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
}
