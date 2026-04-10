import CryptoJS from 'crypto-js';

const arrayBufferToWordArray = (ab: ArrayBuffer) => {
  const u8 = new Uint8Array(ab);
  const len = u8.length;
  const words: number[] = [];
  for (let i = 0; i < len; i += 4) {
    words.push(
      ((u8[i] ?? 0) << 24) |
        ((u8[i + 1] ?? 0) << 16) |
        ((u8[i + 2] ?? 0) << 8) |
        (u8[i + 3] ?? 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, len);
};

export const computeFileMd5 = async (file: File) => {
  const ab = await file.arrayBuffer();
  const wa = arrayBufferToWordArray(ab);
  return CryptoJS.MD5(wa).toString();
};

