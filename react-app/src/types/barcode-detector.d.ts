// BarcodeDetector aún no viene en las libs de TypeScript (es API experimental
// de Chromium; spec: https://wicg.github.io/shape-detection-api/).
// Declaración mínima de lo que usa scanner.web.ts.

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  static getSupportedFormats(): Promise<string[]>
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}
