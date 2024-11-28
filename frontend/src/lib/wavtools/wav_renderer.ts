const dataMap = new WeakMap();

/**
 * Normalizes a Float32Array to Array(m): We use this to draw amplitudes on a graph
 * If we're rendering the same audio data, then we'll often be using
 * the same (data, m, downsamplePeaks) triplets so we give option to memoize
 */
const normalizeArray = (
  data: Float32Array,
  m: number,
  downsamplePeaks: boolean = false,
  memoize: boolean = true
): number[] => {
  if (memoize) {
    const key = { data, m, downsamplePeaks };
    const cached = dataMap.get(key);
    if (cached) return cached;
    const result = normalizeArray(data, m, downsamplePeaks, false);
    dataMap.set(key, result);
    return result;
  }

  const n = data.length;
  const result = new Array(m);
  const stride = Math.floor(n / m);

  if (downsamplePeaks) {
    for (let i = 0; i < m; i++) {
      const start = i * stride;
      const end = Math.min(start + stride, n);
      let max = -Infinity;
      let min = Infinity;
      for (let j = start; j < end; j++) {
        const value = data[j];
        if (value > max) max = value;
        if (value < min) min = value;
      }
      result[i] = Math.max(Math.abs(max), Math.abs(min));
    }
  } else {
    for (let i = 0; i < m; i++) {
      const start = i * stride;
      const end = Math.min(start + stride, n);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += Math.abs(data[j]);
      }
      result[i] = sum / (end - start);
    }
  }

  return result;
};

export const WavRenderer = {
  /**
   * Renders a point-in-time snapshot of an audio sample, usually frequency values
   * @param canvas
   * @param ctx
   * @param data
   * @param color
   * @param pointCount number of bars to render
   * @param barWidth width of bars in px
   * @param barSpacing spacing between bars in px
   * @param center vertically center the bars
   */
  drawBars(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    color: string,
    pointCount: number = 0,
    barWidth: number = 0,
    barSpacing: number = 0,
    center: boolean = false
  ) {
    const width = canvas.width;
    const height = canvas.height;

    if (!pointCount) {
      pointCount = Math.floor(width / 3);
    }
    if (!barWidth) {
      barWidth = 2;
    }
    if (!barSpacing) {
      barSpacing = 1;
    }

    const values = normalizeArray(data, pointCount, true);
    const maxValue = Math.max(...values);
    const scale = maxValue ? height / maxValue / (center ? 2 : 1) : 1;

    ctx.fillStyle = color;
    values.forEach((value, i) => {
      const scaledValue = value * scale;
      const x = i * (barWidth + barSpacing);
      const y = center ? height / 2 - scaledValue / 2 : height - scaledValue;
      ctx.fillRect(x, y, barWidth, scaledValue);
    });
  },
};
