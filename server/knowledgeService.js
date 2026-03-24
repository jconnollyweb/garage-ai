import fetch from "node-fetch";

export async function getKnowledge(tenant_id, phone_number_id) {
  const url = `https://dev.available.titeknit.work/api/internal/knowledge-base?tenant_id=${tenant_id}&phone_number_id=${phone_number_id}`;

  /* 🔐 Build Basic Auth header */
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;

  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(url, {
    headers: {
      "X-Internal-Api-Key": process.env.INTERNAL_API_KEY,
      "Authorization": `Basic ${basicAuth}`,
      "Accept": "application/json"
    },
  });

  const text = await res.text();

  console.log("RAW KB RESPONSE:", text);

  const data = JSON.parse(text);

  if (!data.data) return "No knowledge available.";

  return data.data
    .map(item => `- ${item.title}: ${item.content}`)
    .join("\n");
}