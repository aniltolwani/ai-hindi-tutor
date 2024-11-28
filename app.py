from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import json
import os
from dotenv import load_dotenv
import asyncio
import websockets

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

@app.get("/")
async def root():
    return {"status": "alive"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Connect to OpenAI's realtime API
    async with websockets.connect(
        "wss://api.openai.com/v1/realtime",
        extra_headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1"
        }
    ) as openai_ws:
        try:
            while True:
                # Receive audio from client
                data = await websocket.receive_text()
                
                # Forward to OpenAI
                await openai_ws.send(data)
                
                # Get response from OpenAI
                response = await openai_ws.recv()
                
                # Send back to client
                await websocket.send_text(response)
                
        except websockets.exceptions.ConnectionClosed:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)