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
let currentQuestions = [];

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
  callStartISO = new Date().toLocaleString("sv-SE", {
  timeZone: "Europe/London"
}).replace(" ", "T");

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

async function extractFields(conversation, questions) {
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        text: { format: { type: "json_object" } },
        input: `
You are extracting answers from a phone call.

Match user answers to the questions below.

Return ONLY JSON:

{
  "question": "answer or null"
}

Rules:
- Keys MUST match the questions EXACTLY
- Use null if no answer found
- Do NOT guess
- Only use USER responses

Questions:
${questions.map(q => `- ${q}`).join("\n")}

Conversation:
${conversation}
        `,
      }),
    });

    const data = await res.json();

    const textItem = data.output?.[0]?.content?.find(
      (c) => c.type === "output_text"
    );

    if (!textItem?.text) return {};

    return JSON.parse(textItem.text);

  } catch (err) {
    console.error("❌ FIELD EXTRACTION ERROR:", err.message);
    return {};
  }
}

/* =========================
   CALL END
========================= */
async function logCallEnd(callId, conversation) {
  const duration = Math.floor((Date.now() - callStartTime) / 1000);

  const endedAt = new Date().toLocaleString("sv-SE", {
  timeZone: "Europe/London"
}).replace(" ", "T");

  console.log("🆔 UPDATING CALL ID:", callId);

  const ai = await generateSummary(conversation);
  const fields = await extractFields(conversation, currentQuestions); 
console.log("📦 EXTRACTED FIELDS:", fields);
  

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
    collected_fields: fields,
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

    let config = {};

    try {
      config = await configRes.json();
    } catch (err) {
      console.error("❌ CONFIG PARSE ERROR:", err.message);
    }

    if (!config?.tenant_id || !config?.phone_number_id) {
      console.error("❌ INVALID CONFIG:", config);
      return res.status(500).json({ error: "Invalid config" });
    }

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

   let knowledgeText = "";

      if (Array.isArray(knowledgeData?.data)) {
        knowledgeText = knowledgeData.data
          .map(item => `${item.title}: ${item.content}`)
          .join("\n");
      }

      if (!knowledgeText) {
        console.warn("⚠️ No knowledge found, using fallback");
        knowledgeText = "No knowledge available.";
      }

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
    let questions = [];

    if (Array.isArray(questionData?.data)) {
      questions = questionData.data
        .map(q => q.question_text)
        .filter(Boolean);
    }

    if (questions.length === 0) {
      console.warn("⚠️ No questions found, using fallback");
      questions = ["What is your full name?"];
    }

currentQuestions = questions;

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

if (!Array.isArray(questions) || questions.length === 0) {
  console.error("❌ QUESTIONS INVALID — ABORTING SESSION");
  return res.status(500).json({ error: "No questions available" });
}

    
const instructions = `
You are a professional assistant.

Start with:
"${greeting}, you've reached ${companyName}. How can I help today?"

${knowledgeText}

------------------------
BOOKING SYSTEM RULES
------------------------

You must follow a strict structured booking flow.

You are collecting answers to THESE questions ONLY:
${questions.join("\n")}

RULES:

1. ONLY ask questions from the list above
- Do NOT invent new questions
- Do NOT rephrase them unnecessarily

2. ASK ONE QUESTION AT A TIME
- Wait for the user's response before continuing

3. DO NOT REPEAT QUESTIONS
- If the user has already answered a question, NEVER ask it again
- Only ask again if the answer is clearly invalid

4. DO NOT CONFIRM MULTIPLE TIMES
- Only confirm a value ONCE if needed
- If user confirms, move on immediately

5. VALIDATION RULES

- Full Name must include first and last name
- Phone must be a valid UK number (07, 01, 02 and 10–11 digits)
- Appointment time must be valid and within opening hours

If invalid:
→ Ask ONCE to repeat
→ If user insists, accept it and move on

6. OPTIONAL QUESTIONS
- Ask optional questions ONLY ONCE
- If user says "no", NEVER ask again

7. STOP CONDITION (VERY IMPORTANT)

When ALL required questions are answered:

→ STOP asking questions
→ DO NOT loop
→ DO NOT ask anything else

Then say:

"Perfect, you're booked in. Thank you."

8. BE NATURAL BUT CONTROLLED
- Short responses
- No over-talking
- No repeated confirmations

TIME RULE (CRITICAL):

- NEVER change, convert, or adjust times
- If the user says "2pm", you MUST keep it as "2pm"
- Do NOT adjust for timezone
- Always repeat the exact time the user provided

TIME CONFIRMATION RULE:

When a user gives a date/time:
- ALWAYS repeat it back and confirm before continuing
- Example: "Just to confirm, Friday at 2pm, is that correct?"
- DO NOT proceed unless confirmed

------------------------
FLOW
------------------------

1. Answer user enquiry
2. Ask to proceed with booking
3. Collect missing fields (one at a time)
4. Validate if needed
5. Stop when complete
`;

    /* SESSION */
  /* =========================
   OPENAI SESSION (ROBUST)
========================= */
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

/* =========================
   READ RAW RESPONSE
========================= */
const raw = await response.text();

/* =========================
   CHECK FOR API FAILURE
========================= */
if (!response.ok) {
  console.error("❌ OPENAI SESSION ERROR:", raw);
  return res.status(500).json({
    error: "OpenAI session failed",
    details: raw,
  });
}

/* =========================
   SAFE PARSE
========================= */
let data;

try {
  data = JSON.parse(raw);
} catch (err) {
  console.error("❌ OPENAI PARSE ERROR:", err.message);
  return res.status(500).json({
    error: "Invalid OpenAI response",
  });
}

console.log("RAW OPENAI RESPONSE:", JSON.stringify(data, null, 2));

/* =========================
   FINAL SAFETY CHECK
========================= */
if (!data?.client_secret?.value) {
  console.error("❌ MISSING CLIENT SECRET:", data);
  return res.status(500).json({
    error: "Invalid session response",
  });
}

/* =========================
   SEND TO FRONTEND
========================= */
return res.json({
  ...data,
  callId,
});
  } catch (err) {
    console.error("❌ SESSION ERROR:", err);
    return res.status(500).json({ error: "Session failed" });
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