import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ✅ keep this */
app.get("/", (req, res) => {
  res.send("Garage AI server running");
});

app.get("/garage-info", (req, res) => {
  const data = fs.readFileSync("./garage-info.json");
  res.json(JSON.parse(data));
});

/* ✅ ADD this under it */
app.get("/session", async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
     body: JSON.stringify({
  model: "gpt-realtime-mini",
  voice: "alloy",

  instructions: `
You are a professional and friendly garage assistant.

Garage Information (always use this):

Name: Smith’s Garage  
Location: 123 High Street, London  

Opening Hours:
- Monday–Friday: 8am – 6pm
- Saturday: 8am – 1pm
- Sunday: Closed

Services:
- MOT
- Servicing
- Diagnostics
- Brakes
- Tyres

Rules:

• NEVER guess information  
• ONLY use the information above  
• If unsure, say you don’t know  

Speak naturally and keep answers short.
`
})
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send("Session creation failed");
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});

app.post("/tool/get_garage_info", (req, res) => {
  try {
    const data = fs.readFileSync("./garage-info.json");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load garage info");
  }
});