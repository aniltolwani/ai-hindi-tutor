'use client'

import { useState, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer} from '../lib/wavtools/index.js';
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic } from 'lucide-react'
import { CONFIG } from '../config/constants';
import { apiService } from '../services/api.service';
import { ConversationItem, SessionState} from '../types';
import { phraseManager } from '@/services/phraseManager.js';

export default function AiHindiTutor(): JSX.Element {
  // Core state
  const [sessionState, setSessionState] = useState<SessionState>({
    isConnected: false,
    isRecording: false,
    sessionActive: false,
  });

  const [items, setItems] = useState<ConversationItem[]>([]);

  // Core refs for audio and communication
  const refs = {
    client: useRef<RealtimeClient | null>(null),
    recorder: useRef<WavRecorder | null>(null),
    player: useRef<WavStreamPlayer | null>(null),
    toolAdded: useRef<boolean>(false),
    clientCanvas: useRef<HTMLCanvasElement | null>(null),
    serverCanvas: useRef<HTMLCanvasElement | null>(null),
  };


  const handleConversationUpdate = async ({ item, delta }: any) => {
    const { client, player } = refs;
    // Only process audio for assistant messages with audio
    if (delta?.audio) {
      player.current?.add16BitPCM(delta.audio, item.id);
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
      const items = client.current?.conversation.getItems();
      setItems(items || []);
    }
  };

  const handlePushToTalk = async () => {
    const { isRecording } = sessionState;
    const { client, recorder } = refs;

    if (!isRecording) {
      setSessionState(prev => ({ ...prev, isRecording: true }));
      await recorder.current?.record((data) => client.current?.appendInputAudio(data.mono));
    } else {
      setSessionState(prev => ({ ...prev, isRecording: false }));
      await recorder.current?.pause();
      client.current?.createResponse();
    }
  };

  const initializeSession = async () => {
    const { client, recorder, player, toolAdded } = refs;
    if (!client.current || !recorder.current) {
      console.error('Client or recorder not initialized');
      return;
    }
  
    try {
      // 1. Initialize audio
      await recorder.current.begin();
      await player.current.connect();
  
      // Initialize phraase manager
      const phrases = await phraseManager.init();
      
      // 3. Load system prompt
      const baseSystemPrompt = await apiService.fetchSystemPrompt();
      console.log('Loaded system prompt');
      
      const phrasesContext = `Today's phrases:\n${phrases.map(phrase => 
        `[ID: ${phrase.id}] ${phrase.hindi} (${phrase.english}) - ${phrase.context}`
      ).join('\n')}`;
  
      // 4. Connect to OpenAI and add tool
      await client.current.connect();
      
      if (!toolAdded.current) {
        console.log('Adding submit_phrase_response tool...');
          client.current.addTool(
          {
            name: 'submit_phrase_response',
            description: 'Submit feedback about whether a phrase was correctly used/pronounced, and get the next phrase.',
            parameters: {
              type: 'object',
              properties: {
                wasCorrect: {
                  type: 'boolean',
                  description: 'Whether the phrase was correctly used/pronounced'
                }
              },
              required: ['wasCorrect']
            }
          },
          async ({ wasCorrect }) => {
            const next_phrase = await phraseManager.handleFeedback(wasCorrect);
            return {
              "next_phrase": next_phrase,
            };
          }
          );
          toolAdded.current = true;
      }

      // 5. Update session with prompts
      console.log('Updating session with prompts...');
      await client.current.updateSession({
        instructions: `${baseSystemPrompt}\n\n${phrasesContext}`,
        input_audio_transcription: { model: 'whisper-1' }
      });
      console.log('Session updated with prompts');
  
      // 6. Update state
      setSessionState(prev => {
        const newState = { 
          ...prev,
          sessionActive: true,
          isConnected: true 
        };
        console.log('Initializing session state:', newState);
        return newState;
      });
  
    } catch (error) {
      console.error('Session initialization failed:', error);
      throw error;
    }
  };

  // Initialize once on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      refs.client.current = new RealtimeClient({ apiKey: apiService.getApiKey(), dangerouslyAllowAPIKeyInBrowser: true});
      refs.recorder.current = new WavRecorder({ sampleRate: CONFIG.SAMPLE_RATE });
      refs.player.current = new WavStreamPlayer({ sampleRate: CONFIG.SAMPLE_RATE });
      
      if (mounted) {
        await initializeSession();
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []); // Empty deps array - only run once

  // Initialize session and set up event handlers
  useEffect(() => {
    const client = refs.client.current;
    
    // Set up event handlers
    client?.on('error', console.error);
    client?.on('conversation.updated', handleConversationUpdate);

    // Cleanup function
    return () => {
      client?.off('error', console.error);
      client?.off('conversation.updated', handleConversationUpdate);
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
                <p>{typeof item.content === 'string' ? item.content : 
                   item.formatted?.transcript || item.formatted?.text || 
                   (item.formatted?.audio?.length ? '(awaiting transcript)' : '')}</p>
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