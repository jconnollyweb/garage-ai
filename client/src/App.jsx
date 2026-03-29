import { useState, useRef } from "react";

const ACTIVE_NUMBER = "+441234560099";
//const ACTIVE_NUMBER = "+441234560001";

let conversation = [];

function App() {
  const [started, setStarted] = useState(false);
  const [callId, setCallId] = useState(null); 

  const pcRef = useRef(null);
  const streamRef = useRef(null);

  async function startSession() {
    console.log("🚀 STARTING SESSION");
    setStarted(true);
    conversation = [];

    const tokenResponse = await fetch(
      `http://localhost:3001/session?number=${encodeURIComponent(ACTIVE_NUMBER)}`
    );

    const sessionData = await tokenResponse.json();
    console.log("🔑 SESSION DATA:", sessionData);

    // STORE CALL ID
    setCallId(sessionData.callId);
    console.log("🆔 CALL ID SET:", sessionData.callId);

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const dc = pc.createDataChannel("oai-events");

    let currentAiMessage = "";

    dc.onopen = () => {
      console.log("🟢 DATA CHANNEL OPEN");

      dc.send(JSON.stringify({
        type: "response.create"
      }));
    };

    dc.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("📩 EVENT:", msg.type);

      if (msg.type === "response.output_text.delta") {
        currentAiMessage += msg.delta;
      }

      if (msg.type === "response.output_text.done") {
        if (currentAiMessage.trim()) {
          conversation.push(`AI: ${currentAiMessage.trim()}`);
          currentAiMessage = "";
        }
      }

      if (msg.type === "conversation.item.input_audio_transcription.completed") {
        const text = msg.transcript;
        if (text?.trim()) {
          conversation.push(`User: ${text.trim()}`);
        }
      }

      if (conversation.length > 0) {
        console.log("📊 CURRENT CONVERSATION:", conversation);
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;

    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(
      "https://api.openai.com/v1/realtime?model=gpt-realtime-mini",
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${sessionData.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
      }
    );

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };

    await pc.setRemoteDescription(answer);

    console.log("✅ REALTIME CONNECTED");
  }

  async function stopSession() {
    console.log("🛑 STOPPING SESSION");

    const transcript = conversation.join("\n");

    console.log("📞 FINAL CONVERSATION:\n", transcript);
    console.log("🆔 SENDING CALL ID:", callId);

    await fetch("http://localhost:3001/call-end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation: transcript,
        callId: callId, 
      }),
    });

    if (pcRef.current) pcRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

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