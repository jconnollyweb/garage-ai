import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { google } from "googleapis";
import { authorize } from "./googleAuth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CALENDAR_ID =
  "c_241f75eaf238d48723bcef17ee6a026ff2807206ae38020731fb955b8754a6ca@group.calendar.google.com";

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.send("Garage AI server running");
});

/* =========================
   REALTIME SESSION
========================= */
app.get("/session", async (req, res) => {
  try {
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

          instructions: `
You are a professional and friendly garage assistant.

BOOKINGS:

Collect step-by-step:

• name  
• phone  
• vehicle registration  
• service  
• preferred day/time  

Rules:

• Ask ONE question at a time  
• ALWAYS wait for reply  
• NEVER assume silence  
• Confirm details once  

FLOW:

When user gives time:

→ FIRST call check_availability  

If available:

→ immediately call create_booking  

If NOT available:

→ apologise and ask for another time  

After every tool call:

→ Read the tool response carefully  
→ Base reply ONLY on tool response  
→ Never assume success  

Only confirm booking if success = true
`,

          tools: [
            {
              type: "function",
              name: "check_availability",
              description: "Check if booking slot is available",
              parameters: {
                type: "object",
                properties: { time: { type: "string" } },
                required: ["time"],
              },
            },
            {
              type: "function",
              name: "create_booking",
              description: "Create a garage booking",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  phone: { type: "string" },
                  reg: { type: "string" },
                  service: { type: "string" },
                  time: { type: "string" },
                },
                required: ["name", "phone", "service", "time"],
              },
            },
          ],
        }),
      }
    );

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("SESSION ERROR:", err.message);
    return res.status(500).send("Session creation failed");
  }
});

/* =========================
   SAFE TIME PARSER (FINAL)
========================= */

function parseNaturalTime(input) {
  const now = new Date();
  const text = input.toLowerCase();

  const openingHour = 8;
  const closingHour = 18;

  /* DAY DETECT */
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  let targetDate = new Date(now);

  for (let i = 0; i < days.length; i++) {
    if (text.includes(days[i])) {
      while (targetDate.getDay() !== i) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }
  }

  /* TIME DETECT */
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (!match) throw new Error("Invalid time");

  let hour = parseInt(match[1]);
  let minute = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  /* SMART DEFAULT */
  if (!ampm && hour < 8) hour += 12;

  targetDate.setHours(hour, minute, 0, 0);

  /* must be future */
  if (targetDate <= now) targetDate.setDate(targetDate.getDate() + 1);

  /* opening hours */
  if (hour < openingHour || hour >= closingHour) {
    throw new Error("Outside opening hours");
  }

  return targetDate;
}

/* =========================
   CHECK AVAILABILITY
========================= */

app.post("/tool/check_availability", async (req, res) => {
  try {
    const { time } = req.body;

    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    const startTime = parseNaturalTime(time);
    const endTime = new Date(startTime.getTime() + 60 * 60000);

    console.log("CHECK SLOT:", startTime.toISOString());

    const events = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
    });

    return res.json({
      available: events.data.items.length === 0,
    });
  } catch (err) {
    console.error("CHECK ERROR:", err.message);
    return res.json({ available: false });
  }
});

/* =========================
   CREATE BOOKING
========================= */

app.post("/tool/create_booking", async (req, res) => {
  try {
    const { name, phone, reg, service, time } = req.body;

    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    let startTime;

    try {
      startTime = parseNaturalTime(time);
    } catch {
      return res.json({
        success: false,
        message: "Invalid time. Please say a clearer time.",
      });
    }

    const endTime = new Date(startTime.getTime() + 60 * 60000);

    /* FINAL DOUBLE CHECK */
    const existing = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
    });

    if (existing.data.items.length > 0) {
      console.log("DOUBLE BOOK BLOCKED");
      return res.json({
        success: false,
        message: "That time is already booked. Please choose another.",
      });
    }

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `${service} - ${name}`,
        description: `Phone: ${phone}\nReg: ${reg}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "Europe/London",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Europe/London",
        },
      },
    });

    console.log("BOOKED:", event.data.htmlLink);

    return res.json({
      success: true,
      message: "Booking confirmed.",
    });
  } catch (err) {
    console.error("BOOKING ERROR:", err.message);
    return res.json({ success: false });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(3001, () => {
  console.log("Server running on port 3001");
});