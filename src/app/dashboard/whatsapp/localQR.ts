import { create } from "qrcode";

/** Render only numeric SVG geometry locally; payloads never become URLs, markup or logs. */
export function localQRGeometry(payload: string): { size: number; path: string } {
  if (!payload || payload.length > 4096) throw new Error("QR indisponível");
  const { modules } = create(payload, { errorCorrectionLevel: "M" });
  const paths: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.data[row * modules.size + column]) paths.push(`M${column + 4} ${row + 4}h1v1h-1z`);
    }
  }
  return { size: modules.size + 8, path: paths.join("") };
}
