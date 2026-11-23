import { fileToBase64 } from "./enrichmentSchemas";
import { flashcardImageByteLimit } from "./flashcards";

export type PreparedFlashcardImage = { data: string; blob: Blob };

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
export const flashcardImageAccept = [...acceptedImageTypes].join(",");
const workingImageSize = 960;

export async function prepareFlashcardImage(file: File): Promise<PreparedFlashcardImage> {
  if (!file.size || (file.type && !acceptedImageTypes.has(file.type))) throw new Error("flashcard_image_invalid");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context || !bitmap.width || !bitmap.height) throw new Error("flashcard_image_invalid");
    for (const maxEdge of [workingImageSize, 720, 480, 320]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.86));
      if (blob?.type === "image/webp" && blob.size > 0 && blob.size <= flashcardImageByteLimit) {
        return { blob, data: fileToBase64(new Uint8Array(await blob.arrayBuffer())) };
      }
    }
    throw new Error("flashcard_image_invalid");
  } finally {
    bitmap.close();
  }
}
