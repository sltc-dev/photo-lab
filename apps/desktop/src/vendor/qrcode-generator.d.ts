type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

type QrCodeModel = {
  addData(data: string): void;
  createSvgTag(cellSize?: number, margin?: number): string;
  make(): void;
};

declare function qrcode(typeNumber: number, errorCorrectionLevel: QrErrorCorrectionLevel): QrCodeModel;

export default qrcode;
