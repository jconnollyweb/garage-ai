import { google } from "googleapis";
import fs from "fs";

const credentials = JSON.parse(fs.readFileSync("google-credentials.json"));
const token = JSON.parse(fs.readFileSync("google-token.json"));

const auth = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);

auth.setCredentials(token);

const calendar = google.calendar({ version: "v3", auth });

/* =========================
   CHECK AVAILABILITY
========================= */
export async function checkAvailability(startISO, endISO) {
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: startISO,
    timeMax: endISO,
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items.length === 0; // true = free
}

/* =========================
   CREATE BOOKING
========================= */
export async function createBooking({
  name,
  phone,
  service,
  startISO,
  endISO,
}) {
  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${service} - ${name}`,
      description: `Name: ${name}\nPhone: ${phone}\nService: ${service}`,
      start: { dateTime: startISO, timeZone: "Europe/London" },
      end: { dateTime: endISO, timeZone: "Europe/London" },
    },
  });

  return event.data;
}