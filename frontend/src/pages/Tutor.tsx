'use client'

import { useState, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer} from '../lib/wavtools/index.js';
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic } from 'lucide-react'
import { CONFIG } from '../config/constants';
import { apiService } from '../services/api.service';
import { ConversationItem, SessionState } from '../types';

export default function AiHindiTutor(): JSX.Element {
  // Core state
  const [sessionState, setSessionState] = useState<SessionState>({
    isConnected: false,
    isRecording: false,
    sessionActive: false,
    currentPhraseIndex: -1
  });

  const [items, setItems] = useState<ConversationItem[]>([]);

  // Core refs for audio and communication
  const refs = {
    // openAI realtime client through our relay
    client: useRef<RealtimeClient>(
      new RealtimeClient(CONFIG.RELAY_SERVER_URL
        ? { url: CONFIG.RELAY_SERVER_URL }
        : { 
            apiKey: apiService.getApiKey(), 
            dangerouslyAllowAPIKeyInBrowser: true 
          }
    )),
    // audio recorder using WavqRecorder. This will work in browser, and lets us speak
    recorder: useRef<WavRecorder>(new WavRecorder({ 
      sampleRate: CONFIG.SAMPLE_RATE,
    })),
    // audio player using WavStreamPlayer. This will play audio from the server
    player: useRef<WavStreamPlayer>(
      new WavStreamPlayer({ sampleRate: CONFIG.SAMPLE_RATE })
    ),
    clientCanvas: useRef<HTMLCanvasElement | null>(null),
    serverCanvas: useRef<HTMLCanvasElement | null>(null)
  };


  const handleConversationUpdate = async ({ item, delta }: any) => {
    const { client, player } = refs;
    // Only process audio for assistant messages with audio
    if (delta?.audio) {
      player.current.add16BitPCM(delta.audio, item.id);
    }
    
    // Still process completed messages for the audio controls
    if (item.status === 'completed' && item.formatted.audio?.length) {
      const wavFile = await WavRecorder.decode(
        item.formatted.audio,
        CONFIG.SAMPLE_RATE,
        CONFIG.SAMPLE_RATE
      );
      item.formatted.file = wavFile;
    }
    
    // Only update items state on completion or when we have audio
    if (delta?.audio || item.status === 'completed') {
      const items = client.current.conversation.getItems();
      setItems(items);
    }
  };

  const handlePushToTalk = async () => {
    const { isRecording } = sessionState;
    const { client, recorder } = refs;

    if (!isRecording) {
      setSessionState(prev => ({ ...prev, isRecording: true }));
      await recorder.current.record((data) => client.current.appendInputAudio(data.mono));
    } else {
      setSessionState(prev => ({ ...prev, isRecording: false }));
      await recorder.current.pause();
      client.current.createResponse();
    }
  };

  const initializeSession = async () => {
    const { client, recorder, player } = refs;
    if (!client.current || !recorder.current) return;
  
    try {
      // 1. Initialize audio
      await recorder.current.begin();
      await player.current.connect();
  
      // 2. Load phrases first
      const phrases = await apiService.fetchDailyPhrases();
      const phrasesContext = `Today's phrases:\n${phrases.map(phrase => 
        `- ${phrase.hindi} (${phrase.english}) - ${phrase.context}`
      ).join('\n')}`;
  
      // 3. Connect to OpenAI and configure with combined prompt
      await client.current.connect();
      const baseSystemPrompt = await apiService.fetchSystemPrompt();
      await client.current.updateSession({
        instructions: `${baseSystemPrompt}\n\n${phrasesContext}`,
        input_audio_transcription: { model: 'whisper-1' }
      });
  
      // 4. Update state
      setSessionState(prev => ({ 
        ...prev, 
        currentPhraseIndex: 0,
        sessionActive: true,
        isConnected: true 
      }));
  
    } catch (error) {
      console.error('Session initialization failed:', error);
      await cleanup();
      throw error;
    }
  };

  const cleanup = async () => {
    try {
      const { client, recorder, player } = refs;
      
      if (recorder.current) {
        await recorder.current.end();
      }
      
      if (client.current) {
        await client.current.disconnect();
        client.current.reset();
      }

      if (player.current?.context) {
        await player.current.context.close();
      }

      setSessionState(prev => ({  
        ...prev, 
        isConnected: false,
        sessionActive: false 
      }));
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };

  // Initialize session and set up event handlers
  useEffect(() => {
    const client = refs.client.current;
    
    // Set up event handlers
    client.on('error', console.error);
    client.on('conversation.updated', handleConversationUpdate);

    // Initialize session
    initializeSession().catch(error => {
      console.error('Session initialization error:', error);
      cleanup();
    });

    // Cleanup function
    return () => {
      client.off('error', console.error);
      client.off('conversation.updated', handleConversationUpdate);
      cleanup();
    };
  }, []); // Empty deps - we want this to run only on mount/unmount

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">AI Hindi Tutor</h1>
          
          <div className="mb-4 h-16 flex gap-2">
            <canvas 
              id="client-canvas" 
              ref={refs.clientCanvas}
              width={400}
              height={64}
              className="flex-1 h-full rounded border"
            />
            <canvas 
              id="server-canvas" 
              ref={refs.serverCanvas}
              width={400}
              height={64}
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
                  {(item.formatted?.transcript || item.formatted?.text || 
                   (item.formatted?.audio?.length ? '(awaiting transcript)' : ''))}
                </div>
                {item.formatted?.file && (
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
                sessionState.isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
              } transition-colors duration-200 flex items-center justify-center`}
              aria-label={sessionState.isRecording ? "Stop recording" : "Start recording"}
            >
              <Mic className={`w-8 h-8 ${sessionState.isRecording ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}