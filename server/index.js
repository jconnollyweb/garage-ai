import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let callStartTime = null;
let currentConfig = null;
let callStartISO = null;

function cleanTranscript(text = "") {
  return text
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* =========================
   CALL LOG START
========================= */
async function logCallStart({ tenant_id, phone_number_id }) {
  const callId = `call_${Date.now()}`;

  // set start times properly
  callStartTime = Date.now();
  callStartISO = new Date().toISOString();

  console.log("🆔 CREATED CALL ID:", callId);
  console.log("🕐 STARTED AT:", callStartISO);

  const payload = {
    tenant_id,
    phone_number_id,
    external_event_id: callId,
    caller_number: "+447700900123",
    duration_seconds: 0,
    intent: "unknown",
    outcome: "in_progress",
    summary: "Call started",
    started_at: callStartISO,
  };

  try {
    console.log("📤 START PAYLOAD:", payload);

    const response = await fetch(
      "http://127.0.0.1:8000/api/internal/calls",
      {
        method: "POST",
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await response.text();

    console.log("📥 START STATUS:", response.status);
    console.log("📥 START BODY:", text);

    if (!response.ok) {
      throw new Error("Failed to log call start");
    }

    console.log("CALL LOGGED (START) ✅");

    return callId;

  } catch (err) {
    console.error("❌ CALL START ERROR:", err.message);
    throw err; // fail fast 
  }
}

/* =========================
   AI SUMMARY
========================= */
async function generateSummary(conversation) {
  try {
    console.log("📞 CONVERSATION RECEIVED:\n", conversation);

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        text: {
          format: { type: "json_object" },
        },
input: `
You are analysing a phone call transcript.

IMPORTANT RULES:
- Use ONLY what the user actually said
- Do NOT guess or correct words
- Do NOT invent details
- If unclear, keep it generic

Classify intent as exactly one of:
- booking
- enquiry
- support

Return ONLY JSON:

{
  "summary": "short factual sentence based only on transcript",
  "intent": "booking | enquiry | support"
}

Transcript:
${conversation}
        `,
      }),
    });

    const data = await res.json();

    console.log("🧠 SUMMARY RAW RESPONSE:", JSON.stringify(data, null, 2));

    let parsed = {
      summary: "Call completed",
      intent: "unknown",
    };

    try {
      const content = data.output?.[0]?.content;
      const textItem = content?.find(c => c.type === "output_text");

      if (textItem?.text) {
        parsed = JSON.parse(textItem.text);
      }
    } catch (err) {
      console.error("❌ PARSE ERROR:", err.message);
    }

    console.log("✅ AI SUMMARY:", parsed);

    return parsed;

  } catch (err) {
    console.error("❌ AI SUMMARY ERROR:", err.message);

    return {
      summary: "Call completed",
      intent: "unknown",
    };
  }
}

/* =========================
   CALL END
========================= */
async function logCallEnd(callId, conversation) {
  const duration = Math.floor((Date.now() - callStartTime) / 1000);

  const endedAt = new Date().toISOString(); 

  console.log("🆔 UPDATING CALL ID:", callId);

  const ai = await generateSummary(conversation);
  

// fallback safety 
const finalIntent = ["booking", "enquiry", "support"].includes(ai.intent)
  ? ai.intent
  : "enquiry";

const finalSummary =
  typeof ai.summary === "string" && ai.summary.length > 5
    ? ai.summary
    : "Call completed";
  const cleanedConversation = cleanTranscript(conversation);

  const payload = {
    tenant_id: currentConfig.tenant_id,
    phone_number_id: currentConfig.phone_number_id,
    external_event_id: callId,
    duration_seconds: duration,
    intent: finalIntent,
    outcome: "completed",
    summary: finalSummary,
    transcript: cleanedConversation,
    started_at: callStartISO, 
    ended_at: endedAt,        
  };

  console.log("📤 SENDING TO API:", payload);

  const response = await fetch("http://127.0.0.1:8000/api/internal/calls/summary", {
    method: "POST",
    headers: {
      "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  console.log("📥 STATUS:", response.status);
  console.log("📥 BODY:", text);

  if (response.ok) {
    console.log("✅ CALL UPDATED (END)");
  } else {
    console.error("❌ UPDATE FAILED");
  }
}

/* =========================
   SESSION
========================= */
app.get("/session", async (req, res) => {
  try {
    const incomingNumber = req.query.number || "+441234560001";

    console.log("Incoming number:", incomingNumber);

    /* CONFIG */
    const configRes = await fetch(
      `http://127.0.0.1:8000/api/internal/runtime/voice-config?phone_number=${encodeURIComponent(incomingNumber)}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
        },
      }
    );

    const config = await configRes.json();
    currentConfig = config;

    /* START CALL */
    const callId = await logCallStart({
      tenant_id: config.tenant_id,
      phone_number_id: config.phone_number_id,
    });

    /* KNOWLEDGE */
    const knowledgeRes = await fetch(
      `http://127.0.0.1:8000/api/internal/knowledge-base?tenant_id=${config.tenant_id}&phone_number_id=${config.phone_number_id}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
        },
      }
    );

    const knowledgeData = await knowledgeRes.json();

    const knowledgeText = (knowledgeData.data || [])
      .map(item => `${item.title}: ${item.content}`)
      .join("\n");

    /* QUESTIONS */
    const questionRes = await fetch(
      `http://127.0.0.1:8000/api/internal/question-bank?tenant_id=${config.tenant_id}&phone_number_id=${config.phone_number_id}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
        },
      }
    );

    const questionData = await questionRes.json();
    const questions = (questionData.data || []).map(q => q.question_text);

    /* GREETING */
    const londonHour = Number(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    hour12: false,
  }).format(new Date())
);

let greeting =
  londonHour < 12
    ? "Good morning"
    : londonHour < 18
    ? "Good afternoon"
    : "Good evening";

// extract company name 
let companyName = "our service";
const match = knowledgeText.match(/Company Name:\s*(.*)/i);
if (match && match[1]) {
  companyName = match[1].trim();
}

    const instructions = `
You are a professional assistant.

Start with:
"${greeting}, you've reached ${companyName}. How can I help today?"

${knowledgeText}

Ask questions one at a time:
${questions.join("\n")}

IMPORTANT FLOW:

1. First, answer the user's question naturally
2. Then transition smoothly into booking if relevant
3. Only ask for details AFTER the user agrees to proceed

BOOKING FLOW:
- Ask ONE question at a time
- Wait for response
- Be conversational, not robotic

DO NOT:
- Jump straight into all questions
- Ask questions if user is only enquiring
`;

    /* SESSION */
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-realtime-mini",
          voice: "marin",
          instructions,
          input_audio_transcription: {
            model: "gpt-4o-mini-transcribe",
          },
        }),
      }
    );

    const data = await response.json();

    console.log("RAW OPENAI RESPONSE:", JSON.stringify(data, null, 2));

    res.json({
      ...data,
      callId, // SEND TO FRONTEND
    });

  } catch (err) {
    console.error("SESSION ERROR:", err.message);
    res.status(500).json({ error: "Session failed" });
  }
});

/* =========================
   CALL END
========================= */
app.post("/call-end", async (req, res) => {
  const { conversation, callId } = req.body;

  console.log("🆔 RECEIVED CALL ID:", callId);

  await logCallEnd(callId, conversation);

  res.json({ success: true });
});

/* ========================= */
app.listen(3001, () => {
  console.log("Server running on port 3001");
});