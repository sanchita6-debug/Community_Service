from fastapi import FastAPI
from pydantic import BaseModel
import requests

app = FastAPI()
conversation_history = {}

class ChatMessage(BaseModel):
    session_id: str
    message: str


SYSTEM_PROMPT = """
You are a supportive mental health assistant for college students.

Rules:
- Be empathetic, calm and supportive.
- Do not diagnose mental health conditions.
- Do not claim to be a doctor or therapist.
- Keep responses concise and conversational.
- You understand English, Hindi and Hinglish.
- Do not overwhelm the user with long lists unless requested.
- Encourage professional support when appropriate.
"""


@app.get("/")
def home():
    return {
        "message": "Mental Health Support Chatbot API is running!"
    }


@app.post("/chat")
def chat(data: ChatMessage):

    # Create history for a new session
    if data.session_id not in conversation_history:
        conversation_history[data.session_id] = []

    history = conversation_history[data.session_id]

    # Add current user message
    history.append({
        "role": "user",
        "content": data.message
    })

    # Keep only recent messages so the model doesn't get overloaded
    recent_history = history[-10:]

    messages = [
        {
            "role": "system",
            "content": """
You are a supportive mental-health support assistant for college students.

Rules:
- Be empathetic, calm, and supportive.
- Do not diagnose mental health conditions.
- Do not claim to be a doctor or therapist.
- Reply in the same language as the user.
- Keep responses concise and natural.
- Give practical suggestions when appropriate.
"""
        }
    ] + recent_history

    response = requests.post(
        "http://localhost:11434/api/chat",
        json={
            "model": "qwen2.5:3b",
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": 150,
                "temperature": 0.7,
                "num_ctx": 2048
            }
        }
    )

    result = response.json()

    assistant_reply = result["message"]["content"]

    # Save assistant response in memory
    history.append({
        "role": "assistant",
        "content": assistant_reply
    })

    return {
        "reply": assistant_reply,
        "session_id": data.session_id
    }