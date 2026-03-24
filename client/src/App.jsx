import { useState, useRef } from "react";

function App() {
  const [started, setStarted] = useState(false);

  const pcRef = useRef(null);
  const streamRef = useRef(null);

  async function startSession() {
    setStarted(true);

    const incomingNumber = "+441234560001";

    const tokenResponse = await fetch(
      `http://localhost:3001/session?number=${encodeURIComponent(incomingNumber)}`
    );

    const sessionData = await tokenResponse.json();

    console.log("SESSION DATA:", sessionData);

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    /* =========================
       DATA CHANNEL
    ========================= */

    const dc = pc.createDataChannel("oai-events");

   dc.onopen = () => {
      console.log("DATA CHANNEL OPEN");

      /* 🔥 FORCE FIRST RESPONSE */
      dc.send(JSON.stringify({
        type: "response.create"
      }));
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