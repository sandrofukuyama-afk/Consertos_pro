// Reduz a foto no proprio celular antes de enviar: fotos do iPhone passam de
// 3-5 MB e o envio para a Vercel tem limite de ~4,5 MB por pedido. 1600 px no
// lado maior ainda deixa legivel o codigo dos componentes.
const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.82;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    // Formato que o navegador nao abre: envia como esta.
    return file;
  }
}
