// DPR-aware canvas sizing with a fixed logical coordinate space (360x450),
// so scene-drawing code never touches device pixels directly.
export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 450;

export function attachCamera(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const parent = canvas.parentElement;
    const cssWidth = parent.clientWidth;
    const cssHeight = parent.clientHeight;
    const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT);
    const drawWidth = LOGICAL_WIDTH * scale;
    const drawHeight = LOGICAL_HEIGHT * scale;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.translate((cssWidth - drawWidth) / 2, (cssHeight - drawHeight) / 2);
    ctx.scale(scale, scale);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();

  return { ctx, resize };
}
