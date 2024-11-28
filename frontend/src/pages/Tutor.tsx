'use client'

import { WavRecorder, WavStreamPlayer, WavRenderer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic } from 'lucide-react'
import { RealtimeClient } from '@openai/realtime-api-beta';

const LOCAL_RELAY_SERVER_URL: string = process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

interface ConversationItem {
  id: string;
  role?: string;
  type?: string;
  status?: string;
  formatted: {
    text?: string;
    transcript?: string;
    audio?: any;
    file?: {
      url: string;
    };
  };
}

export default function AiHindiTutor() {
  // API key handling
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  // Audio and API refs
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );
  
  // Canvas refs for visualization
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [items, setItems] = useState<ConversationItem[]>([]);

  // Connect to conversation
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    setIsConnected(true);

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();

    // Set transcription
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Send initial greeting
    client.sendUserMessageContent([
      {
        type: 'input_text',
        text: 'Hello! I want to learn Hindi. Please help me practice these phrases.',
      },
    ]);

    setItems(client.conversation.getItems());
  }, []);

  // Disconnect conversation
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);
    
    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  // Handle push-to-talk
  const handlePushToTalk = async () => {
    if (!isRecording) {
      setIsRecording(true);
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;
      
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    } else {
      setIsRecording(false);
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      await wavRecorder.pause();
      client.createResponse();
    }
  };

  // Set up audio visualization
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  // Set up client event handlers
  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.on('error', (event: any) => console.error(event));
    
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    connectConversation();

    return () => {
      disconnectConversation();
      client.reset();
    };
  }, []);

  // Auto-scroll conversation
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">AI Hindi Tutor</h1>
          
          <div className="mb-4 h-16 flex gap-2">
            <canvas 
              ref={clientCanvasRef} 
              className="flex-1 h-full rounded border"
            />
            <canvas 
              ref={serverCanvasRef} 
              className="flex-1 h-full rounded border"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md p-4 mb-4" data-conversation-content>
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`mb-4 last:mb-0 ${
                  item.role === 'assistant' ? 'text-blue-600' : 'text-gray-700'
                }`}
              >
                <div className="font-medium mb-1">
                  {item.role === 'assistant' ? 'Tutor' : 'You'}:
                </div>
                <div>
                  {item.formatted.transcript || item.formatted.text || 
                   (item.formatted.audio?.length ? '(awaiting transcript)' : '')}
                </div>
                {item.formatted.file && (
                  <audio
                    src={item.formatted.file.url}
                    controls
                    className="mt-2 w-full"
                  />
                )}
              </div>
            ))}
          </ScrollArea>

          <div className="flex justify-center">
            <Button
              onClick={handlePushToTalk}
              className={`w-16 h-16 rounded-full ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
              } transition-colors duration-200 flex items-center justify-center`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              <Mic className={`w-8 h-8 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
