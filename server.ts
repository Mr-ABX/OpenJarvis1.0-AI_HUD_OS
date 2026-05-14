import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const server = http.createServer(app);
  
  const wss = new WebSocketServer({ server, path: '/ws/voice' });

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
  }

  const SYSTEM_PROMPT = `#Role
You are a general-purpose virtual assistant speaking to users. Your task is to help them find accurate, helpful information across a wide range of everyday topics.

#General Guidelines
-Be warm, friendly, and professional.
-Speak clearly and naturally in plain language.
-Keep most responses to 1–2 sentences.
-Do not use markdown formatting, like code blocks, quotes, bold, links, or italics.
-Use line breaks in lists.
-Use varied phrasing; avoid repetition.
-If unclear, ask for clarification.
-If the user’s message is empty, respond with an empty message.
-If asked about your well-being, respond briefly and kindly.

#Voice-Specific Instructions
-Speak in a conversational tone—your responses will be spoken aloud.
-Pause after questions to allow for replies.
-Confirm what the customer said if uncertain.

#Call Flow Objective
-Your primary goal is to help users quickly find the information they’re looking for.

### IMPORTANT FORMATTING RULES ###
You MUST format your response EXACTLY like this:
USER: [Transcribe exactly what the user said]
AI: [Your spoken response here]`;

  wss.on('connection', (ws) => {
    console.log('Client connected to /ws/voice');
    
    let latestFrame: string | null = null;

    const sendLog = (text: string) => {
       if(ws.readyState === ws.OPEN) {
         ws.send(JSON.stringify({ type: 'log', text }));
       }
    };

    const sendError = (text: string) => {
       if(ws.readyState === ws.OPEN) {
         ws.send(JSON.stringify({ type: 'error', text }));
         ws.send(JSON.stringify({ type: 'status', text: 'AWAITING INPUT' }));
       }
    };

    const generateAndSendTTS = async (text: string, voiceName: string, isWakeWord: boolean = false) => {
        try {
            // Option 1: Deepgram TTS (Requires DEEPGRAM_API_KEY)
            const deepgramKey = process.env.DEEPGRAM_API_KEY;
            if (deepgramKey) {
                const dgVoice = voiceName === 'Fenrir' ? 'aura-orion-en' : 'aura-asteria-en';
                const dgRes = await fetch(`https://api.deepgram.com/v1/speak?model=${dgVoice}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${deepgramKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text })
                });
                if (dgRes.ok) {
                    const arrayBuffer = await dgRes.arrayBuffer();
                    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'audio_tts', data: base64Audio, isWakeWord, text }));
                    }
                    return;
                } else {
                    console.error("Deepgram TTS Error:", await dgRes.text());
                }
            }

            // Option 2: Gemini TTS
            if (ai) {
                const prompt = `Say naturally: ${text}`;
                const response = await ai.models.generateContent({
                  model: "gemini-2.5-flash",
                  contents: [{ parts: [{ text: prompt }] }],
                  config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName }
                        }
                    }
                  }
                });
                const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (base64Audio && ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'audio_tts', data: base64Audio, isWakeWord, text }));
                    return;
                }
            }
            
            throw new Error("No primary TTS succeeded.");

        } catch (e: any) {
            console.log("Note: API key does not support TTS or audio generation failed. Falling back to browser TTS.", e.message);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'fallback_tts', text, isWakeWord }));
            }
        }
    };
    
    ws.on('message', async (messageData) => {
      try {
        const message = JSON.parse(messageData.toString());
        
        if (message.type === 'video_frame') {
          latestFrame = message.data;
        } else if (message.type === 'wake_word') {
          ws.send(JSON.stringify({ type: 'status', text: 'WAKING...' }));
          const voice = message.voice || "Fenrir";
          const greetings = [
             "Hi sir, systems are online. How can I help you?",
             "I am here, sir. Would you like to know the agenda for today?",
             "At your service. How may I assist you today?"
          ];
          const greet = greetings[Math.floor(Math.random() * greetings.length)];
          
          ws.send(JSON.stringify({ type: 'response', user: "[AUDIO SPIKE TRIGGERED]", text: greet }));
          await generateAndSendTTS(greet, voice, true);

        } else if (message.type === 'audio_prompt') {
          ws.send(JSON.stringify({ type: 'status', text: 'THINKING...' }));

          if (!ai) {
              sendError('Missing API Key.');
              return;
          }

          try {
              let audioBase64 = message.audio;
              if (audioBase64.includes(',')) {
                 audioBase64 = audioBase64.split(',')[1];
              }

              const contents: any[] = [{
                 inlineData: {
                   data: audioBase64,
                   mimeType: message.mimeType || "audio/webm"
                 }
              }];

              if (latestFrame) {
                const base64Data = latestFrame.replace(/^data:image\/\w+;base64,/, "");
                contents.push({
                  inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg"
                  }
                });
              }

              contents.push("Listen to the user's voice message and reply concisely. Follow the exact USER: / AI: formatting. If there is an image, consider it as what the user is looking at. Identify requests to 'open spotify', 'open chrome', or 'search youtube for [query]'.");

              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: {
                  systemInstruction: SYSTEM_PROMPT,
                  temperature: 0.7,
                }
              });

              const responseText = response.text || '';
              
              let aiSpokenText = responseText;
              let aiSubtitle = responseText;
              let userSubtitle = "";

              const match = responseText.match(/USER:\s*(.*?)\s*AI:\s*(.*)/is);
              if (match) {
                  userSubtitle = match[1];
                  aiSpokenText = match[2];
                  aiSubtitle = match[2];
              }

              // Handle OS Tools
              const p = aiSpokenText.toLowerCase();
              if (p.includes('open spotify')) {
                  exec('python3 backend/os_tools.py open Spotify', (error, stdout) => {
                      if (error) exec('python backend/os_tools.py open Spotify', (e2, out2) => sendLog(out2 || e2?.message || ""));
                      else sendLog(stdout);
                  });
              } else if (p.includes('open chrome') || p.includes('open browser')) {
                  exec('python3 backend/os_tools.py open "Google Chrome"', (error, stdout) => {
                      if (error) exec('python backend/os_tools.py open "Google Chrome"', (e2, out2) => sendLog(out2 || e2?.message || ""));
                      else sendLog(stdout);
                  });
              } else if (p.includes('search youtube for ')) {
                  const query = p.split('search youtube for ')[1];
                  if (query) {
                      exec(`python3 backend/os_tools.py search "${query}"`, (error, stdout) => {
                          if (error) exec(`python backend/os_tools.py search "${query}"`, (e2, out2) => sendLog(out2 || e2?.message || ""));
                          else sendLog(stdout);
                      });
                  }
              }

              ws.send(JSON.stringify({ type: 'response', user: userSubtitle, text: aiSubtitle }));
              if (aiSpokenText.trim().length > 0) {
                 await generateAndSendTTS(aiSpokenText, message.voice || "Fenrir", false);
              } else {
                 ws.send(JSON.stringify({ type: 'status', text: 'AWAITING INPUT' }));
              }

          } catch (apiError: any) {
             console.error("Gemini API Error:", apiError);
             if (apiError.message?.includes('API key not valid')) {
                 sendError("Invalid API Key. Please update GEMINI_API_KEY in the Settings -> Secrets panel.");
             } else {
                 sendError(`AI Error: ${apiError.message}`);
             }
          }
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (req, res) => {
    res.json({ geminiApiKey: process.env.GEMINI_API_KEY });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
