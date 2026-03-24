import { useState, useRef } from "react";

function App() {
  const [started, setStarted] = useState(false);

  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const dcRef = useRef(null);

  async function startSession() {
    setStarted(true);

    const tokenResponse = await fetch("http://localhost:3001/session");
    const sessionData = await tokenResponse.json();

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    /* =========================
       DATA CHANNEL (TOOLS)
    ========================= */

    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;

    dc.onopen = () => {
      console.log("DATA CHANNEL OPEN");

        const hour = new Date().getHours();

      const greeting =
        hour < 12 ? "Good morning" :
        hour < 18 ? "Good afternoon" :
        "Good evening";

      dc.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            `${greeting}, you've reached John’s Big Honker’s Garage. How can I help today?`
        }
      }));
    };

    dc.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type !== "response.function_call_arguments.done") return;

      const args = JSON.parse(msg.arguments);

      /* =========================
         CHECK AVAILABILITY
      ========================= */

      if (msg.name === "check_availability") {

        const res = await fetch("http://localhost:3001/tool/check_availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        });

        const data = await res.json();

        dc.send(JSON.stringify({
          type: "response.function_call_output",
          call_id: msg.call_id,
          output: JSON.stringify(data)
        }));

        dc.send(JSON.stringify({ type: "response.create" }));

        return;
      }

      /* =========================
         CREATE BOOKING (FIXED)
      ========================= */

      if (msg.name === "create_booking") {

        console.log("CREATE BOOKING TRIGGERED");

        const res = await fetch("http://localhost:3001/tool/create_booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        });

        const data = await res.json();

        /* SEND TOOL RESULT BACK */
        dc.send(JSON.stringify({
          type: "response.function_call_output",
          call_id: msg.call_id,
          output: JSON.stringify(data)
        }));

        /* 🔥 FORCE CORRECT RESPONSE */

        if (data.success) {
          dc.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: "Confirm the booking politely."
            }
          }));
        } else {
          dc.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Do NOT confirm the booking. Tell the caller: ${data.message}`
            }
          }));
        }

        return;
      }
    };

    /* =========================
       MIC STREAM
    ========================= */

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;

    pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime?model=gpt-realtime-mini";

    const sdpResponse = await fetch(baseUrl, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${sessionData.client_secret.value}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };

    await pc.setRemoteDescription(answer);
  }

  function stopSession() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setStarted(false);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Garage AI Prototype</h1>

      {!started ? (
        <button onClick={startSession}>Start Talking</button>
      ) : (
        <button onClick={stopSession}>Stop</button>
      )}
    </div>
  );
}

export default App;