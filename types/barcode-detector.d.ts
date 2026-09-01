type BarcodeFormat = "qr_code";

type BarcodeDetectorOptions = {
  formats?: BarcodeFormat[];
};

type DetectedBarcode = {
  rawValue: string;
  format: BarcodeFormat | string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: Array<{ x: number; y: number }>;
};

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
  static getSupportedFormats?: () => Promise<string[]>;
}
