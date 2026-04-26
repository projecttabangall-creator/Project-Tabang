/**
 * Converts a File to a base64 data URL.
 * Stores as base64 in Firestore, so Firebase Storage permissions are not needed.
 * Images are resized to max 400x400 and compressed to about 70% JPEG quality.
 * PDFs and other documents are kept as-is so they remain previewable.
 */
export async function uploadFile(_path: string, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      if (!file.type.startsWith("image/")) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();

      img.onload = () => {
        const maxSize = 400;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
