type Capture = (caption: string[]) => Promise<Blob | null>

let handler: Capture | null = null

/** The scene registers how to take a picture of itself; the UI, which has no access to the scene, asks through here. */
export function setCaptureHandler(fn: Capture | null) {
  handler = fn
}

/** A PNG of the sky as drawn now (the sky layers and labels, not the buttons and panels), with `caption` lines at the bottom left. */
export function captureImage(caption: string[]): Promise<Blob | null> {
  return handler ? handler(caption) : Promise.resolve(null)
}
