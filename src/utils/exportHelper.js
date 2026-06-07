import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AlertService } from './AlertService';

/**
 * Saves a file and optionally shares it, handling both Web and Mobile.
 * @param {string} fileName The name of the file
 * @param {string} base64Data The base64 data of the file (without the data:mime/type;base64, prefix)
 * @param {string} mimeType The mime type (e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 */
export const saveAndShareFile = async (fileName, base64Data, mimeType) => {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Write the file to device cache directory
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // 2. Share the file so the user can save to Drive, send to WhatsApp, or save to Downloads
      await Share.share({
        title: fileName,
        text: `File: ${fileName}`,
        url: result.uri,
        dialogTitle: 'Simpan / Bagikan File'
      });
    } else {
      // For web, convert base64 to a blob and trigger download
      const byteCharacters = atob(base64Data);
      const byteArrays = [];

      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }

      const blob = new Blob(byteArrays, { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error saving/sharing file:', error);
    AlertService.error('Gagal', 'Gagal mengekspor file: ' + error.message);
  }
};
