import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.send("AI Knowledge Server running");
});

/* =========================
   REALTIME SESSION
========================= */
app.get("/session", async (req, res) => {
  try {
    const incomingNumber =
      req.query.number || "+441234560001";

    console.log("Incoming number:", incomingNumber);

    /* =========================
       1. GET RUNTIME CONFIG
    ========================= */
    const configRes = await fetch(
      `http://127.0.0.1:8000/api/internal/runtime/voice-config?phone_number=${encodeURIComponent(incomingNumber)}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!configRes.ok) throw new Error("Voice config failed");

    const config = await configRes.json();
    console.log("VOICE CONFIG:", config);

    if (!config.tenant_id) {
      return res.status(400).json({
        error: "Phone number not found",
      });
    }

    /* =========================
       2. GET KNOWLEDGE BASE
    ========================= */
    const knowledgeRes = await fetch(
      `http://127.0.0.1:8000/api/internal/knowledge-base?tenant_id=${config.tenant_id}&phone_number_id=${config.phone_number_id}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!knowledgeRes.ok) throw new Error("Knowledge fetch failed");

    const knowledgeData = await knowledgeRes.json();

    const knowledgeText = (knowledgeData.data || [])
      .map(item => `${item.title}: ${item.content}`)
      .join("\n");

    console.log("Knowledge loaded");

    /* =========================
       3. GET QUESTION BANK
    ========================= */
    const questionRes = await fetch(
      `http://127.0.0.1:8000/api/internal/question-bank?tenant_id=${config.tenant_id}&phone_number_id=${config.phone_number_id}`,
      {
        headers: {
          "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!questionRes.ok) throw new Error("Question fetch failed");

    const questionData = await questionRes.json();

    // ✅ SAFE mapping
    const questions = (questionData.data || []).map(q => q.question_text);

    console.log("Questions:", questions);

    /* =========================
       4. EXTRACT COMPANY NAME
    ========================= */
    let companyName = "our service";

    const match = knowledgeText.match(/Company Name:\s*(.*)/i);
    if (match && match[1]) {
      companyName = match[1].trim();
    }

    console.log("Company:", companyName);

    const hour = new Date().getHours();

      let greeting = "Hello";

      if (hour < 12) greeting = "Good morning";
      else if (hour < 18) greeting = "Good afternoon";
      else greeting = "Good evening";

    /* =========================
       5. BUILD INSTRUCTIONS
    ========================= */
    const instructions = `
     You are a professional and friendly assistant.

      When the call starts, say:
      "${greeting}, you've reached ${companyName}. How can I help today?"

---

KNOWLEDGE BASE:
${knowledgeText}

---

IMPORTANT TASK:

Ask ALL of these questions before ending the call:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

---

RULES:

- Ask ONE question at a time
- Wait for response
- Do NOT skip questions
- Answer user questions first
- Then continue questions
- Do NOT end until done
- Keep responses short
`;

    /* =========================
       6. CREATE SESSION
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
        }),
      }
    );

    const data = await response.json();

    return res.json(data);

  } catch (err) {
    console.error("SESSION ERROR:", err.message);
    return res.status(500).json({
      error: "Session creation failed",
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(3001, () => {
  console.log("Server running on port 3001");
});