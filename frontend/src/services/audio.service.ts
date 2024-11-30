import { WavRecorder, WavStreamPlayer } from '../lib/wavtools';
import { WavRenderer } from '@/lib/wavtools/wav_renderer.js';

export const audioService = {
  setupVisualization(
    recorder: WavRecorder,
    clientCanvas: HTMLCanvasElement | null,
  ) {
    let isLoaded = true;
    const render = () => {
      if (!isLoaded) return;
      this.drawClientAudio(recorder, clientCanvas);
      window.requestAnimationFrame(render);
    };
    render();
    return () => { isLoaded = false; };
  },

  drawClientAudio(recorder: WavRecorder, canvas: HTMLCanvasElement | null) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (!canvas.width || !canvas.height) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const result = recorder.recording
      ? recorder.getFrequencies('voice')
      : { values: new Float32Array([0]) };
    WavRenderer.drawBars(canvas, ctx, result.values, '#0099ff', 10, 0, 8);
  },

};
