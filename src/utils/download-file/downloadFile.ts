import { hapticFeedback } from '@utils/haptics/haptics.ts';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const downloadFile = async (content: string, fileName: string, contentType: string): Promise<void> =>
  downloadBlob(new Blob([content], { type: contentType }), fileName);

export const downloadBlob = async (data: Blob, fileName: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    await shareBlob(data, fileName);
  } else {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);

    link.href = URL.createObjectURL(data);
    link.download = fileName;
    link.click();

    document.body.removeChild(link);
  }
};

// on android / ios there are no classic downloads, files are saved to the cache and passed to the share sheet
const shareBlob = async (data: Blob, fileName: string): Promise<void> => {
  hapticFeedback('medium');

  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(data),
    directory: Directory.Cache
  });

  await Share.share({ files: [uri] }).catch(() => {
    // the user dismissed the share sheet
  });
};

const blobToBase64 = async (data: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve((reader.result as string).replace(/^data:.*?;base64,/, ''));
    reader.readAsDataURL(data);
  });
