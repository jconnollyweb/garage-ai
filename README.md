🚗 Garage AI Voice Assistant
Overview

This project is a real-time AI-powered voice assistant designed for garage and service-based businesses. It handles customer enquiries, collects booking details, and logs structured call data into a backend system.

The assistant uses OpenAI’s Realtime API for live voice interaction and integrates with a Laravel backend for call logging, analytics, and multi-tenant configuration.

⚙️ Core Features
🎤 Real-Time Voice Interaction
Uses OpenAI Realtime (gpt-realtime-mini)
Supports natural, back-and-forth conversation
Low latency streaming via WebRTC
Handles interruptions and turn-taking
🧠 Intelligent Conversation Flow
Answers customer enquiries using knowledge base
Smoothly transitions from enquiry → booking
Asks questions one at a time
Avoids robotic interrogation style
🏢 Multi-Tenant Support
Dynamically loads:
Tenant configuration
Knowledge base
Question bank
Behaviour adapts per phone number / tenant
No hardcoded business logic
📚 Knowledge Base Integration
Injects business-specific content into AI instructions
Supports:
Opening hours
Services
Pricing
Policies
AI responds using ONLY provided knowledge
❓ Dynamic Question Bank
Questions are fetched from backend
AI asks them sequentially during booking
Fully configurable per tenant
📞 Call Logging System
🔄 Call Lifecycle
Call Start
Creates call record in Laravel
Stores:
tenant_id
phone_number_id
start time
initial status
Live Conversation
Captures:
User speech (transcription)
AI responses (audio transcript)
Call End
Sends full transcript
Generates:
summary
intent
collected fields
📝 Transcript Capture

Includes both sides of the conversation:

Assistant: Good afternoon, you've reached JC Auto's...
User: Hi, what are your opening times?
Assistant: We're open Monday to Friday...
🧠 AI Analysis
📊 Summary + Intent Detection

Uses gpt-4o-mini to generate:

{
  "summary": "User enquired about opening times and booked an appointment.",
  "intent": "booking"
}
📦 Dynamic Field Extraction

Extracts answers based on the question bank, not hardcoded fields.

Example output:

{
  "What's your Full Name": "John Connolly",
  "What is your Phone Number": "078006344228",
  "What is your registration plate number": "WF6A PLZ",
  "What date and time would you like to book an appointment?": "Monday, 2pm"
}
✅ Validation System (AI-driven)

The assistant validates user input during the call:

🔍 Rules
Full Name
Must include first and last name
Phone Number
Must be a valid UK number
Starts with 07, 01, or 02
10–11 digits
Vehicle Registration
Must resemble UK plate format
Appointment Time
Must be a valid time (e.g. 2pm, 14:00)
🔁 Smart Re-Prompting

If input is invalid or unclear:

"I didn’t catch that properly, could you repeat your phone number?"
🧭 Conversation Intelligence
🚫 No Repetition
Does NOT ask questions already answered
Tracks collected information during the call
🎯 Context-Aware Flow
Only asks missing fields
Adapts based on user responses
Avoids unnecessary questions
⏱️ Time Handling Fix
All times treated as UK local time (Europe/London)
Prevents incorrect +1 hour shift
Uses exact user input (no conversion by AI)
🧱 Tech Stack
Frontend
React (Vite)
WebRTC (RTCPeerConnection)
OpenAI Realtime API
Backend (Node.js)
Express
OpenAI Responses API
Handles:
session creation
transcript processing
AI analysis
API integration
Backend (Laravel)
Stores:
call logs
transcripts
summaries
collected fields
Provides:
knowledge base
question bank
tenant config
🔄 API Flow
Frontend → Node (/session)
        → Laravel (config, KB, questions)

Frontend → OpenAI (Realtime)

Frontend → Node (/call-end)
        → OpenAI (summary + extraction)
        → Laravel (store results)
🚀 Future Improvements
Real-time field tracking (mid-call state)
Automatic booking confirmation
Calendar integration (Google Calendar)
Retry logic for unclear answers
Admin dashboard for call analytics
Structured field schema (optional mapping layer)
💡 Key Takeaways

This system is:

Fully dynamic (no hardcoding)
Multi-tenant ready
Voice-first UX
AI-enhanced but controlled
Designed for real-world booking workflows
👌 Status

✔ Real-time voice working
✔ Knowledge-based responses
✔ Structured call logging
✔ AI summary + intent
✔ Dynamic field extraction
✔ Validation + smart prompting

Built as a production-ready foundation for AI-powered customer service automation.