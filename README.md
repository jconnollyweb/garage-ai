Garage AI Voice Assistant
What it is

A real-time AI voice assistant for garages.

It answers customer questions, takes bookings, and logs the call.

Each phone number loads its own business (multi-tenant), so the same system works for multiple garages.

What it does
Talks to users in real time (voice)
Answers questions using a knowledge base
Collects booking details step-by-step
Logs the full call (transcript, summary, intent)
Pulls config, questions, and content per phone number
Tech used
Frontend: React + WebRTC
Backend: Node (Express)
AI: OpenAI Realtime + Responses API
Main backend: Laravel (stores data + config)
How it works (simple)
Frontend sends a phone number
Backend figures out which business it belongs to
Loads:
knowledge base
questions
Starts AI voice session
At the end, logs the call + generates summary
Run locally
1. Start Laravel (API)

Make sure your Laravel app is running:

php artisan serve

Runs on:

http://127.0.0.1:8000
2. Start Node backend
cd server
npm install
node server.js

Runs on:

http://localhost:3001

Make sure you have:

OPENAI_API_KEY
INTERNAL_API_KEY

in your .env

3. Start frontend
cd client
npm install
npm run dev

Runs on:

http://localhost:5173
4. Test it

Click Start Talking

It will:

use the active phone number
load the correct tenant
start the AI call
Notes
Phone number → tenant mapping is handled by Laravel
If that breaks, nothing else works
Everything is dynamic (no hardcoded questions or content)