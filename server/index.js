import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

import { getPhoneContext } from "./phoneRouter.js";
import { getKnowledge } from "./knowledgeService.js";

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

    const context = getPhoneContext(incomingNumber);

    if (!context) {
      return res.status(400).json({
        error: "Unknown phone number",
      });
    }

    /* =========================
       FETCH KNOWLEDGE
    ========================= */
    const knowledgeText = await getKnowledge(
      context.tenant_id,
      context.phone_number_id
    );

    console.log("Knowledge loaded:\n", knowledgeText);

    /* =========================
       EXTRACT COMPANY (FIXED ORDER)
    ========================= */
    let companyName = "our service";

    const lines = knowledgeText.split("\n");

    for (const line of lines) {
      if (line.toLowerCase().includes("company name")) {
        companyName = line.split(":")[1]?.trim();
        break;
      }
    }

    console.log("Extracted company:", companyName);

    /* =========================
       BUILD INSTRUCTIONS
    ========================= */
    const instructions = `
You are a professional and friendly assistant.

When the call starts, immediately greet the caller by saying:
"Good morning, good afternoon, or good evening depending on time, and say: you've reached ${companyName}. How can I help today?"

Use the knowledge base below to answer questions.

KNOWLEDGE BASE:
${knowledgeText}

Rules:
- Use this knowledge when relevant
- If unsure, say you don't know
- Keep answers short and clear
`;

    /* =========================
       CREATE SESSION
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

    return res.json({
      ...data,
      companyName
    });

  } catch (err) {
    console.error("SESSION ERROR:", err);
    return res.status(500).send("Session creation failed");
  }
});

/* =========================
   START SERVER
========================= */
app.listen(3001, () => {
  console.log("Server running on port 3001");
});