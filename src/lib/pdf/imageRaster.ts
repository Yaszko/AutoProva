// Carrega qualquer fonte de imagem usada no app (URL http(s), data URI, ou uma string SVG crua já
// normalizada para data URI por normalizeImageSource) e a rasteriza para PNG, para uso com
// jsPDF's addImage — que não aceita SVG diretamente. Usado tanto para logos de escola quanto para
// imagens de questão.
export interface RasterImage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

export async function rasterizeImageSource(source: string): Promise<RasterImage | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${source}`));
      img.src = source;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

    ctx.drawImage(img, 0, 0);
    // canvas.toDataURL lança SecurityError se a imagem "contaminou" o canvas (ex: URL remota sem
    // cabeçalhos CORS corretos) — mesma limitação que a antiga captura via html-to-image já tinha.
    const dataUrl = canvas.toDataURL("image/png");
    return { dataUrl, widthPx: canvas.width, heightPx: canvas.height };
  } catch {
    return null;
  }
}
