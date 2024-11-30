export const CONFIG = {
  RELAY_SERVER_URL: process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '',
  SAMPLE_RATE: 24000,
  API_KEY_STORAGE_KEY: 'tmp::voice_api_key',
  BACKEND_URL: 'http://localhost:8000'
} as const;
