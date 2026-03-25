import fetch from "node-fetch";

export async function getQuestions(tenant_id, phone_number_id) {
  const url = `http://127.0.0.1:8000/api/internal/question-bank?tenant_id=${tenant_id}&phone_number_id=${phone_number_id}`;

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

  const data = await res.json();

  if (!data.data) return [];

  return data.data.map(q => q.question);
}