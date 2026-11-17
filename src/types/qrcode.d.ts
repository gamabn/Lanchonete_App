declare module "qrcode" {
  export function create(text: string, options: { errorCorrectionLevel: "M" }): { modules: { size: number; data: Uint8Array } };
}
