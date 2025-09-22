declare module '@/lib/wavtools' {
  export class WavRecorder {
    recording: boolean;
    constructor(options?: { sampleRate?: number; outputToSpeakers?: boolean; debug?: boolean });
    begin(): Promise<void>;
    record(cb: (data: { mono: Float32Array }) => void): Promise<void>;
    pause(): Promise<void>;
    getFrequencies(mode: string): { values: Float32Array };
    static decode(
      audioData: Blob | Float32Array | Int16Array | ArrayBuffer | number[],
      sampleRate: number,
      fromSampleRate: number
    ): Promise<{ blob: Blob; url: string; values: Float32Array; audioBuffer: AudioBuffer }>;
  }
  export class WavStreamPlayer {
    constructor(options?: { sampleRate?: number });
    connect(): Promise<void>;
    add16BitPCM(data: Int16Array, id?: string): void;
  }
}
declare module '@/lib/wavtools/index.js' {
  export * from '@/lib/wavtools';
}
declare module '@/lib/wavtools/wav_renderer.js' {
  export class WavRenderer {
    static drawBars(
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      values: Float32Array,
      color: string,
      barWidth: number,
      gap: number,
      scale: number
    ): void;
  }
}
