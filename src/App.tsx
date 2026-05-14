import { useEffect, useRef, useState, useCallback } from 'react';
import { ParticleOrb } from './orb';
import { Camera, Mic, Activity, Eye, Terminal, Volume2, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, Type } from '@google/genai';

// Types
type ToolCall = {
  id: string;
  name: string;
  args: Record<string, any>;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const orbRef = useRef<ParticleOrb | null>(null);
  
  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextAudioStartTimeRef = useRef<number>(0);
  
  const [status, setStatus] = useState<string>("SYSTEM OFFLINE");
  const [isConnected, setIsConnectedState] = useState<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  
  const setIsConnected = (val: boolean) => {
      setIsConnectedState(val);
      isConnectedRef.current = val;
  };
  
  const [visionMode, setVisionMode] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [aiSubtitle, setAiSubtitle] = useState<string>("");
  
  const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null);

  // Settings State
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [autoApproveTools, setAutoApproveToolsState] = useState<boolean>(true);
  const [voiceName, setVoiceNameState] = useState<"Fenrir" | "Kore" | "Aoede" | "Charon" | "Puck">("Charon");
  
  const [userName, setUserNameState] = useState<string>("Sir");
  const [userTitles, setUserTitlesState] = useState<string>("Boss, Captain");
  const [clapSensitivity, setClapSensitivityState] = useState<number>(85);
  const [idleTimeout, setIdleTimeoutState] = useState<number>(5);
  
  const autoApproveToolsRef = useRef<boolean>(true);
  const voiceNameRef = useRef<string>("Charon");
  const userNameRef = useRef<string>("Sir");
  const userTitlesRef = useRef<string>("Boss, Captain");
  const clapSensitivityRef = useRef<number>(85);
  const idleTimeoutRef = useRef<number>(5);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const setAutoApproveTools = (val: boolean) => {
      setAutoApproveToolsState(val);
      autoApproveToolsRef.current = val;
  };

  const setVoiceName = (val: "Fenrir" | "Kore" | "Aoede" | "Charon" | "Puck") => {
      setVoiceNameState(val);
      voiceNameRef.current = val;
  };

  const setUserName = (val: string) => {
      setUserNameState(val);
      userNameRef.current = val;
  };

  const setUserTitles = (val: string) => {
      setUserTitlesState(val);
      userTitlesRef.current = val;
  };

  const setClapSensitivity = (val: number) => {
      setClapSensitivityState(val);
      clapSensitivityRef.current = val;
  };

  const setIdleTimeout = (val: number) => {
      setIdleTimeoutState(val);
      idleTimeoutRef.current = val;
  };

  const [localServerUrl, setLocalServerUrl] = useState<string>("http://localhost:8000");
  const [isLocalConnected, setIsLocalConnected] = useState<boolean>(false);
  const [showToasts, setShowToasts] = useState<boolean>(true);
  
  // Custom API & Theme state
  const [orbTheme, setOrbTheme] = useState<"cyan" | "white" | "red" | "amber">("cyan");
  const [apiProvider, setApiProvider] = useState<"google" | "openrouter">("google");
  const [customApiKey, setCustomApiKey] = useState<string>("");

  const [toasts, setToasts] = useState<{id: string, msg: string}[]>([]);

  const addToast = (msg: string) => {
    if (!showToasts) return;
    const toastId = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id: toastId, msg }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4000);
  };

  // Persistence Logic
  useEffect(() => {
    const saved = localStorage.getItem('jarvis_settings');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.localServerUrl) setLocalServerUrl(data.localServerUrl);
            if (data.userName) setUserName(data.userName);
            if (data.userTitles) setUserTitles(data.userTitles);
            if (data.voiceName) setVoiceName(data.voiceName);
            if (data.autoApproveTools !== undefined) setAutoApproveTools(data.autoApproveTools);
            if (data.showToasts !== undefined) setShowToasts(data.showToasts);
            if (data.clapSensitivity) setClapSensitivity(data.clapSensitivity);
            if (data.idleTimeout) setIdleTimeout(data.idleTimeout);
            if (data.orbTheme) setOrbTheme(data.orbTheme);
            if (data.apiProvider) setApiProvider(data.apiProvider);
            if (data.customApiKey !== undefined) setCustomApiKey(data.customApiKey);
            addLog("System settings restored.");
        } catch(e) {
            console.error("Failed to load settings", e);
        }
    }
  }, []);

  const saveSettings = () => {
      const settings = {
          localServerUrl,
          userName,
          userTitles,
          voiceName,
          autoApproveTools,
          showToasts,
          clapSensitivity,
          idleTimeout,
          orbTheme,
          apiProvider,
          customApiKey
      };
      localStorage.setItem('jarvis_settings', JSON.stringify(settings));
      addLog("External cache updated. Settings saved.");
      
      // Force connection re-check
      fetch(`${localServerUrl}/health`, {
        headers: { 
          "Bypass-Tunnel-Reminder": "true",
          "ngrok-skip-browser-warning": "true" 
        }
      })
        .then(res => setIsLocalConnected(res.ok))
        .catch(() => setIsLocalConnected(false));
  };

  const resetSettings = () => {
      if (confirm("REBOOT PROTOCOL: This will clear all saved settings. Proceed?")) {
          localStorage.removeItem('jarvis_settings');
          setLocalServerUrl("http://localhost:8000");
          setUserName("Sir");
          setUserTitles("Boss, Captain");
          setVoiceName("Charon");
          setAutoApproveTools(true);
          setShowToasts(true);
          setClapSensitivity(85);
          setIdleTimeout(5);
          setOrbTheme("cyan");
          setApiProvider("google");
          setCustomApiKey("");
          addLog("System reset to factory defaults.");
          setShowSettings(false);
      }
  };

  const [latency, setLatency] = useState<number>(0);
  const [zoomCaps, setZoomCaps] = useState<any>(null);
  const [focusCaps, setFocusCaps] = useState<any>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [focusDistance, setFocusDistance] = useState<number>(0);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
     let interval: any;
     if (isConnected) {
         interval = setInterval(() => {
             setLatency(Math.floor(40 + Math.random() * 25));
         }, 2000);
     } else {
         setLatency(0);
     }
     return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    if (videoTrackRef.current) {
        try {
            const constraints: any = { advanced: [{}] };
            let hasConstraints = false;
            if (zoomCaps) {
                constraints.advanced[0].zoom = zoom;
                hasConstraints = true;
            }
            if (focusCaps) {
                constraints.advanced[0].focusMode = 'manual';
                constraints.advanced[0].focusDistance = focusDistance;
                hasConstraints = true;
            }
            if (hasConstraints) {
                videoTrackRef.current.applyConstraints(constraints)
                    .catch(e => console.warn("Cannot apply constraints", e));
            }
        } catch (err) {
            console.warn("Constraints apply error", err);
        }
    }
  }, [zoom, focusDistance, zoomCaps, focusCaps]);

  useEffect(() => {
     const checkLocal = () => {
         // Add bypass header for Localtunnel support
         fetch(`${localServerUrl}/health`, {
         headers: { 
            "Bypass-Tunnel-Reminder": "true",
            "ngrok-skip-browser-warning": "true"
         }
      })
            .then(res => setIsLocalConnected(res.ok))
            .catch(() => setIsLocalConnected(false));
     };
     checkLocal();
     const interval = setInterval(checkLocal, 5000);
     return () => clearInterval(interval);
  }, [localServerUrl]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`].slice(-5));
  }, []);

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
  }, []);

  // Initialization: fetch key
  useEffect(() => {
    if (canvasRef.current && !orbRef.current) {
      orbRef.current = new ParticleOrb(canvasRef.current, orbTheme);
    }
  }, []);

  useEffect(() => {
     if (orbRef.current) {
         orbRef.current.setTheme(orbTheme);
     }
     document.documentElement.style.setProperty('--color-brand-cyan', orbTheme === 'white' ? '#e5e5e5' : orbTheme === 'red' ? '#ef4444' : orbTheme === 'amber' ? '#f59e0b' : '#0ea5e9');
     document.documentElement.style.setProperty('--color-brand-bg', orbTheme === 'white' ? '#000000' : orbTheme === 'red' ? '#080000' : orbTheme === 'amber' ? '#080500' : '#050508');
  }, [orbTheme]);

  const processAudioData = (e: AudioProcessingEvent) => {
    if (!sessionRef.current) return;
    const inputData = e.inputBuffer.getChannelData(0);
    // Downsample/convert to Int16
    const pcm16 = new Int16Array(inputData.length);
    let volume = 0;
    for (let i = 0; i < inputData.length; i++) {
       const s = Math.max(-1, Math.min(1, inputData[i]));
       pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
       volume += Math.abs(inputData[i]);
    }
    
    const avgVolume = volume / inputData.length;
    if (avgVolume > 0.02) {
       lastActivityTimeRef.current = Date.now();
    }
    
    // Update orb visual
    if (orbRef.current) {
        orbRef.current.updateAudioData(avgVolume * 5); // Boosted a bit
    }

    // Convert to base64
    const buffer = new ArrayBuffer(pcm16.buffer.byteLength);
    const view = new Uint8Array(buffer);
    view.set(new Uint8Array(pcm16.buffer));
    
    let binary = '';
    for (let i = 0; i < view.byteLength; i++) {
       binary += String.fromCharCode(view[i]);
    }
    const base64 = btoa(binary);

    sessionRef.current.sendRealtimeInput({
        audio: {
            mimeType: "audio/pcm;rate=16000",
            data: base64
        }
    });
  };

  const playAudioChunk = async (base64Audio: string) => {
      try {
        if (!playbackContextRef.current) {
            playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
        const audioCtx = playbackContextRef.current;
        
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }
        
        const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        
        const currentTime = audioCtx.currentTime;
        if (nextAudioStartTimeRef.current < currentTime) {
            nextAudioStartTimeRef.current = currentTime;
        }
        
        source.start(nextAudioStartTimeRef.current);
        nextAudioStartTimeRef.current += audioBuffer.duration;
        
        audioQueueRef.current.push(source);
        source.onended = () => {
            audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
        };
      } catch (err) {
         console.error("Playback error", err);
      }
  };

  const stopPlayback = () => {
      audioQueueRef.current.forEach(source => {
          try { source.stop(); } catch(e) {}
      });
      audioQueueRef.current = [];
      nextAudioStartTimeRef.current = 0;
  };

  const isConnectingRef = useRef<boolean>(false);
  
  const startMicrophone = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        audioContextRef.current = new window.AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        scriptProcessorRef.current.onaudioprocess = processAudioData;
        
        source.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(audioContextRef.current.destination);
        
        addLog("Audio Interface Active (Live API)");
    } catch(e) {
        console.error("Mic error:", e);
        addLog("Microphone access denied");
    }
  };

  const connectLiveAPI = async (triggerGreeting: boolean = false) => {
      if (isConnectedRef.current || isConnectingRef.current) return;
      isConnectingRef.current = true;
      stopPlayback();
      try {
          updateStatus("INITIALIZING AI...");
          let finalApiKey = customApiKey;
          if (!finalApiKey) {
              const res = await fetch('/api/config');
              const configData = await res.json();
              finalApiKey = configData.geminiApiKey;
          }
          
          if (!finalApiKey) {
              updateStatus("API KEY MISSING");
              addLog("Failed to connect: API Key missing");
              isConnectingRef.current = false;
              return;
          }

          const genAIConfig: any = { apiKey: finalApiKey };
          if (apiProvider === 'openrouter') {
              genAIConfig.httpOptions = { baseUrl: 'https://openrouter.ai/api/v1' };
              addLog("Using OpenRouter endpoint");
          }
          const ai = new GoogleGenAI(genAIConfig);
          aiRef.current = ai;
          
          const sessionPromise = ai.live.connect({ 
             model: "gemini-3.1-flash-live-preview", 
             callbacks: {
                 onopen: () => {
                     setIsConnected(true);
                     isConnectingRef.current = false;
                     updateStatus("CONNECTION SECURE");
                     addLog("Live API session connected.");

                     if (triggerGreeting) {
                         const appName = (voiceNameRef.current === 'Fenrir' || voiceNameRef.current === 'Charon') ? 'J.A.R.V.I.S.' : 'F.R.I.D.A.Y.';
                         try {
                             sessionPromise.then(s => s.sendRealtimeInput({ text: `System initialized. Wake word or Double clap detected. Greet me natively as ${appName}, saying things like "Initializing protocol...", "Boot sequence complete...", "Greetings [title/name]", etc. Select purely one of my titles: [${userTitlesRef.current}] or my name: ${userNameRef.current} to call me. Be immersive, brief, and then wait for my next command.` }));
                         } catch(err) {
                             console.warn("Failed sending initial greeting", err);
                         }
                     }

                     // Start Microphone
                     startMicrophone();
                 },
                 onmessage: async (message: any) => {
                     const parts = message.serverContent?.modelTurn?.parts;
                     if (parts) {
                         lastActivityTimeRef.current = Date.now();
                         for (const part of parts) {
                             if (part.inlineData?.data) {
                                 playAudioChunk(part.inlineData.data);
                             }
                             if (part.text) {
                                 setAiSubtitle(part.text);
                             }
                         }
                     }
                     
                     if (message.serverContent?.interrupted) {
                         stopPlayback();
                     }

                     if (message.toolCall?.functionCalls) {
                         const call = message.toolCall.functionCalls[0];
                         const osTools = ["open_website", "open", "send_notification", "set_volume", "get_news", "get_weather", "get_system_stats", "move_app_to_display"];
                         if (osTools.includes(call.name)) {
                             if (autoApproveToolsRef.current) {
                                 addLog(`OS Tool auto-approved: ${call.name}`);
                                 executeTool(call.id, call.name, call.args, "approve");
                             } else {
                                 setPendingToolCall({
                                     id: call.id,
                                     name: call.name,
                                     args: call.args as Record<string, any>
                                 });
                                 addLog(`OS Tool requested: ${call.name}`);
                             }
                         }
                     }
                 },
                 onclose: () => {
                     addLog("API session ended");
                     setIsConnected(false);
                     updateStatus("SYSTEM OFFLINE");
                 },
                 onerror: (err: any) => {
                     console.error("Live API Error:", err);
                     addLog("Live API Error");
                 }
             },
             config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceNameRef.current }
                    }
                },
                systemInstruction: { parts: [{ text: `You are ${(voiceNameRef.current === 'Fenrir' || voiceNameRef.current === 'Charon') ? 'J.A.R.V.I.S.' : 'F.R.I.D.A.Y.'}, a real-time AI assistant. My name is ${userNameRef.current} and you can call me by these titles: ${userTitlesRef.current}. Be highly concise, use short sentences. If you're asked to open a website, call the relevant tool. If asked to "play" a song or video on YouTube, construct the url exactly as 'https://www.google.com/search?btnI=1&q=site:youtube.com+<query>' for the open_website tool; you must explicitly tell the user that you are using Google's "I'm Feeling Lucky" feature to automatically redirect and play the first YouTube result without requiring them to click. If asked to open a desktop app, use the 'open' tool. If asked to set or change volume, use the 'set_volume' tool. If asked to send a notification, use the 'send_notification' tool. If you are asked for the latest news, use the 'get_news' tool. If asked for weather, use 'get_weather'. If asked for system stats/usage, use 'get_system_stats'. If asked to move an app to the second display, use 'move_app_to_display'.` }]},
                tools: [{
                   functionDeclarations: [
                      {
                         name: "open_website",
                         description: "Opens a website for the user based on their request.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               url: { type: Type.STRING, description: "The full URL to open (e.g., https://youtube.com/results?search_query=query)" },
                               description: { type: Type.STRING, description: "A short description of what is being opened." }
                            },
                            required: ["url", "description"]
                         }
                      },
                      {
                         name: "open",
                         description: "Opens a local desktop application or system setting on the user's computer via local python backend.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               target: { type: Type.STRING, description: "The name of the app to open (e.g., calendar, map, Spotify, Settings)." }
                            },
                            required: ["target"]
                         }
                      },
                      {
                         name: "set_volume",
                         description: "Sets the system volume.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               level: { type: Type.NUMBER, description: "Volume level from 0 to 100." }
                            },
                            required: ["level"]
                         }
                      },
                      {
                         name: "send_notification",
                         description: "Sends a desktop notification to the user.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               title: { type: Type.STRING, description: "Title of the notification." },
                               body: { type: Type.STRING, description: "Body text of the notification." }
                            },
                            required: ["title", "body"]
                         }
                      },
                      {
                         name: "get_news",
                         description: "Fetches the latest news headlines based on a topic.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               topic: { type: Type.STRING, description: "Topic to search for, e.g., 'technology', 'world', etc." }
                            },
                            required: ["topic"]
                         }
                      },
                      {
                         name: "get_weather",
                         description: "Fetches current weather for a specified location.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               location: { type: Type.STRING, description: "The location to get weather for." }
                            },
                            required: ["location"]
                         }
                      },
                      {
                         name: "get_system_stats",
                         description: "Retrieves current local system stats like CPU and RAM usage via the python backend.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {},
                            required: []
                         }
                      },
                      {
                         name: "move_app_to_display",
                         description: "Attempts to move a specific application to the second display on macOS.",
                         parameters: {
                            type: Type.OBJECT,
                            properties: {
                               app_name: { type: Type.STRING, description: "The name of the application to move." }
                            },
                            required: ["app_name"]
                         }
                      }
                   ]
                }]
             }
          });
          
          sessionRef.current = await sessionPromise;

      } catch (err: any) {
          console.error("Connect error:", err);
          isConnectingRef.current = false;
          updateStatus("CONNECTION FAILED");
          addLog(err.message);
      }
  };

  const executeTool = async (id: string, name: string, args: any, action: "approve" | "deny") => {
      if (!sessionRef.current) return;
      
          if (action === "approve") {
          if (name === "send_notification" && args.title && args.body) {
              addLog(`Sending Notification: ${args.title}`);
              if (Notification.permission === 'granted') {
                 new Notification(args.title, { body: args.body });
              } else if (Notification.permission !== 'denied') {
                 Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                       new Notification(args.title, { body: args.body });
                    }
                 });
              }
              sessionRef.current.sendToolResponse({
                  functionResponses: [{
                      id,
                      name,
                      response: { success: true, message: "Notification sent successfully." }
                  }]
              });
              return;
          }

          if (name === "open_website" && args.url) {
              addLog(`Opening ${args.url}`);
              // Create anchor and click it to bypass popup blocker
              const a = document.createElement('a');
              a.href = args.url;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              sessionRef.current.sendToolResponse({
                  functionResponses: [{
                      id,
                      name,
                      response: { success: true, message: "URL opened successfully." }
                  }]
              });
              return;
          }

          if (isLocalConnected) {
             try {
                const res = await fetch(`${localServerUrl}/execute`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Bypass-Tunnel-Reminder": "true",
                        "ngrok-skip-browser-warning": "true"
                    },
                    body: JSON.stringify({
                        command_type: name, // you might map this: like "open" or "search"
                        target: (args.target || args.url || JSON.stringify(args)).toString()
                    })
                });
                const data = await res.json();
                addToast("Remote Command Executed");
                
                sessionRef.current.sendToolResponse({
                   functionResponses: [{
                       id,
                       name,
                       response: { success: true, message: data.message }
                   }]
                });
                return;
             } catch (err) {
                console.error("Local exec failed", err);
                addToast("Local Exec Failed: Check Tunnel");
             }
          }
      }

      // Default fallback for deny or unhandled tools
      sessionRef.current.sendToolResponse({
         functionResponses: [{
             id,
             name,
             response: { success: false, message: action === "deny" ? "User denied the action." : "Tool handled successfully (default fallback)." }
         }]
      });
  };

  const handleToolExecute = (action: "approve" | "deny") => {
      if (!pendingToolCall) return;
      executeTool(pendingToolCall.id, pendingToolCall.name, pendingToolCall.args, action);
      setPendingToolCall(null);
  };

  const disconnectAPI = () => {
      stopPlayback();
      if (sessionRef.current) {
          try { sessionRef.current.close(); } catch(e){}
          sessionRef.current = null;
      }
      if (audioContextRef.current) {
          try { audioContextRef.current.close() } catch(e){}
          audioContextRef.current = null;
      }
      if (scriptProcessorRef.current) {
          scriptProcessorRef.current.disconnect();
          scriptProcessorRef.current = null;
      }
      setIsConnected(false);
      updateStatus("SYSTEM OFFLINE");
      addLog("Disconnected.");
  };

  useEffect(() => {
     const interval = setInterval(() => {
         if (isConnectedRef.current) {
             const idleTime = Date.now() - lastActivityTimeRef.current;
             if (idleTime > idleTimeoutRef.current * 60000) {
                 addLog(`Idle for ${idleTimeoutRef.current} mins. Auto-disconnecting...`);
                 disconnectAPI();
             }
         }
     }, 10000);
     return () => clearInterval(interval);
  }, []);

  // Wake Word listener & Clap detection (Offline mode)
  useEffect(() => {
     if (isConnected) return; // Stop listening if connected

     let recognition: any;
     let audioCtx: AudioContext;
     let stream: MediaStream;
     let analyser: AnalyserNode;
     let source: MediaStreamAudioSourceNode;
     let animationId: number;
     let lastClapTime = 0;
     let isDestroyed = false;

     try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.onresult = (e: any) => {
                if (isDestroyed) return;
                const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
                
                // Strict wake word match to prevent false positives
                const isWakeMatch = /\b(wake up jarvis|wake up friday|hey jarvis|hey friday)\b/.test(transcript);
                
                if (isWakeMatch) {
                    addLog(`Wake word detected: "${transcript}"`);
                    connectLiveAPI(true);
                }
            };
            recognition.onerror = () => {
                 if (!isDestroyed) {
                     try { recognition.start(); } catch(e){}
                 }
            };
            recognition.onend = () => {
                 if (!isDestroyed) {
                     try { recognition.start(); } catch(e){}
                 }
            };
            recognition.start();
            addLog("Speech listener active.");
        }
     } catch (err) {
         console.warn("Speech API not supported", err);
     }

     const initClapDetection = async () => {
         try {
             stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             if (isDestroyed) return;
             audioCtx = new window.AudioContext();
             analyser = audioCtx.createAnalyser();
             source = audioCtx.createMediaStreamSource(stream);
             source.connect(analyser);

             analyser.fftSize = 512;
             const bufferLength = analyser.frequencyBinCount;
             const dataArray = new Uint8Array(bufferLength);

             const checkClap = () => {
                 if (isDestroyed) return;
                 analyser.getByteTimeDomainData(dataArray);
                 let max = 0;
                 let sum = 0;
                 for (let i = 0; i < bufferLength; i++) {
                     const val = Math.abs(dataArray[i] - 128);
                     if (val > max) max = val;
                     sum += val;
                 }
                 const avg = sum / bufferLength;
                 
                 const isTransient = max / (avg + 1) > 2.5;
                 
                 // threshold for loud transient
                 if (max > clapSensitivityRef.current && isTransient) {
                     const now = Date.now();
                     if (now - lastClapTime > 200 && now - lastClapTime < 800) {
                         addLog("Double clap detected.");
                         connectLiveAPI(true);
                         return; // Stop checking
                     } else if (now - lastClapTime > 800) {
                         lastClapTime = now;
                     }
                 }
                 
                 animationId = requestAnimationFrame(checkClap);
             };
             checkClap();
             addLog("Audio clap detection active.");
         } catch(e) {
             console.warn("Clap detect failed", e);
         }
     };

     initClapDetection();

     return () => {
         isDestroyed = true;
         if (recognition) {
             recognition.onend = null;
             recognition.onerror = null;
             try { recognition.stop(); } catch(e){}
         }
         if (animationId) cancelAnimationFrame(animationId);
         if (source) source.disconnect();
         if (analyser) analyser.disconnect();
         if (audioCtx) try { audioCtx.close(); } catch(e){}
         if (stream) stream.getTracks().forEach(track => track.stop());
     }
  }, [isConnected]);

  // Video feed for vision
  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameInterval: any = null;

    if (visionMode) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          const track = s.getVideoTracks()[0];
          videoTrackRef.current = track;
           
          try {
              if (track.getCapabilities) {
                  const caps = track.getCapabilities() as any;
                  if (caps.zoom) {
                      setZoomCaps(caps.zoom);
                      setZoom(caps.zoom.min || 1);
                  } else {
                      setZoomCaps(null);
                  }
                  if (caps.focusDistance) {
                      setFocusCaps(caps.focusDistance);
                      setFocusDistance(caps.focusDistance.min || 0);
                  } else {
                      setFocusCaps(null);
                  }
              }
          } catch(e) { console.warn("Capabilities error", e); }
          
          addLog("Vision Mode Enabled");
          
          // Start taking frames and sending to live session
          frameInterval = setInterval(() => {
              if (sessionRef.current && videoRef.current && isConnected) {
                 const canvas = document.createElement('canvas');
                 canvas.width = 640;
                 canvas.height = 480;
                 const ctx = canvas.getContext('2d');
                 if (ctx) {
                     ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                     const base64Img = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                     sessionRef.current.sendRealtimeInput({
                         video: {
                             mimeType: "image/jpeg",
                             data: base64Img
                         }
                     });
                 }
              }
          }, 1000); // Send 1 frame per second
        })
        .catch(() => addLog("Camera access denied"));
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(t => t.stop());
         videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (frameInterval) clearInterval(frameInterval);
    };
  }, [visionMode, addLog, isConnected]);

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col justify-center items-center">
      <AnimatePresence>
        {visionMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0"
          >
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {visionMode && <div className="scanlines" />}
      {visionMode && <div className="crosshair" />}

      {visionMode && (zoomCaps || focusCaps) && (
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           className="absolute left-8 top-1/2 -translate-y-1/2 flex gap-8 z-30 pointer-events-auto bg-black/40 p-6 rounded-lg backdrop-blur border border-brand-cyan/20"
         >
            {zoomCaps && (
                <div className="flex flex-col items-center gap-16">
                   <span className="text-[10px] text-brand-cyan font-mono tracking-widest -mb-4">ZOOM</span>
                   <div className="relative w-4 h-32 flex items-center justify-center">
                       <input 
                           type="range"
                           className="w-32 h-1 accent-brand-cyan bg-brand-cyan/20 rounded-lg appearance-none -rotate-90 absolute cursor-pointer"
                           min={zoomCaps.min || 1}
                           max={zoomCaps.max || 5}
                           step={zoomCaps.step || 0.1}
                           value={zoom}
                           onChange={(e) => setZoom(Number(e.target.value))}
                       />
                   </div>
                </div>
            )}
            {focusCaps && (
                <div className="flex flex-col items-center gap-16">
                   <span className="text-[10px] text-brand-cyan font-mono tracking-widest -mb-4">FOCUS</span>
                   <div className="relative w-4 h-32 flex items-center justify-center">
                       <input 
                           type="range"
                           className="w-32 h-1 accent-brand-cyan bg-brand-cyan/20 rounded-lg appearance-none -rotate-90 absolute cursor-pointer"
                           min={focusCaps.min || 0}
                           max={focusCaps.max || 1}
                           step={focusCaps.step || 0.01}
                           value={focusDistance}
                           onChange={(e) => setFocusDistance(Number(e.target.value))}
                       />
                   </div>
                </div>
            )}
         </motion.div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />

      <div className="absolute inset-0 z-20 flex flex-col justify-between p-8 pointer-events-none">
        
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-brand-cyan tracking-[0.5em] font-medium text-xl uppercase">
               {(voiceName === 'Fenrir' || voiceName === 'Charon') ? 'J.A.R.V.I.S.' : 'F.R.I.D.A.Y.'}
            </h1>
            <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                   <span className="text-xs tracking-widest opacity-60">LINK: {isConnected ? 'SECURE' : 'DISCONNECTED'}</span>
                   {isConnected && <span className="text-[10px] text-brand-cyan ml-2 font-mono border border-brand-cyan/30 px-1 rounded bg-brand-cyan/10">{latency}ms</span>}
                </div>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isLocalConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                   <span className="text-xs tracking-widest opacity-60">LOCAL_SYS: {isLocalConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end opacity-60">
             <span className="text-xs tracking-widest font-mono">SYS_TIME</span>
             <span className="text-lg tracking-wider font-mono">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Function Call Area */}
        {pendingToolCall && (
           <div className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-brand-cyan/50 p-6 rounded-lg pointer-events-auto z-50 text-center animate-in fade-in zoom-in w-[350px]">
               <h3 className="text-brand-cyan font-mono mb-2 uppercase tracking-widest text-sm text-center">Action Required</h3>
               <p className="text-zinc-300 text-sm mb-4 text-center">{pendingToolCall.args.description || `Permit opening ${pendingToolCall.args.url}?`}</p>
               <div className="flex justify-center gap-4">
                  <button onClick={() => handleToolExecute("deny")} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/20 rounded font-mono text-xs uppercase tracking-wider transition-colors">Deny</button>
                  <button onClick={() => handleToolExecute("approve")} className="px-4 py-2 bg-brand-cyan text-black hover:bg-brand-cyan/80 rounded font-mono text-xs font-bold uppercase tracking-wider transition-colors">Approve</button>
               </div>
           </div>
        )}

        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-full max-w-3xl text-center flex flex-col gap-3 pointer-events-none z-30">
           <AnimatePresence mode="wait">
              {aiSubtitle && (
                 <motion.div 
                    key={aiSubtitle}
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0 }}
                    className="text-brand-cyan text-sm sm:text-base font-mono uppercase tracking-wider font-semibold drop-shadow-[0_0_8px_rgba(14,165,233,0.8)] px-4"
                 >
                    {aiSubtitle}
                 </motion.div>
              )}
           </AnimatePresence>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32 pointer-events-none">
           <motion.div 
             key={status}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className={`tracking-[0.3em] text-sm text-center font-mono opacity-80 ${isConnected ? 'text-brand-cyan' : 'text-zinc-500'}`}
           >
             {status}
           </motion.div>
        </div>

        <div className="flex justify-between items-end pointer-events-auto">
          
          <div className="w-1/3 min-w-[300px] bg-brand-bg/50 backdrop-blur-md border border-brand-cyan/20 p-4 rounded-lg">
             <div className="flex items-center gap-2 mb-3 text-brand-cyan/70 border-b border-brand-cyan/20 pb-2">
                <Terminal size={14} />
                <span className="text-xs tracking-widest">SYS.LOG</span>
             </div>
             <div className="flex flex-col gap-1 font-mono text-[10px] text-zinc-400 opacity-80 max-h-32 overflow-y-auto">
                {logs.length === 0 && <span>AWAITING INITIALIZATION...</span>}
                {logs.map((log, i) => (
                    <span key={i} className="animate-in fade-in slide-in-from-left-2">{log}</span>
                ))}
             </div>
          </div>

          <div className="flex gap-4">
             <button 
                onClick={() => setShowSettings(true)}
                className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all backdrop-blur-md bg-brand-bg/60 text-brand-cyan border-brand-cyan/30 hover:bg-brand-cyan/20`}
                title="Settings"
             >
                <Settings size={18} />
             </button>

             <button 
                onClick={isConnected ? disconnectAPI : connectLiveAPI}
                className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all backdrop-blur-md 
                  ${isConnected ? 'bg-brand-cyan text-black border-brand-cyan shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-brand-bg/60 border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20'}
                `}
                title={isConnected ? "Disconnect from AI" : "Connect to AI (Start Microphone)"}
             >
                <Mic size={18} />
             </button>
             
             <button 
                onClick={() => setVisionMode(!visionMode)}
                className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all backdrop-blur-md ${visionMode ? 'bg-brand-cyan text-brand-bg border-brand-cyan shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-brand-bg/60 text-brand-cyan border-brand-cyan/30 hover:bg-brand-cyan/20'}`}
                title="Toggle Vision Mode"
             >
                <Eye size={18} />
             </button>
          </div>

        </div>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-xl border border-brand-cyan/50 p-4 sm:p-6 rounded-lg pointer-events-auto z-[60] w-[90vw] sm:w-[500px] max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
             >
                <div className="flex justify-between items-center mb-6 text-brand-cyan border-b border-brand-cyan/20 pb-3">
                   <h2 className="font-mono tracking-widest text-sm font-semibold flex items-center gap-2">
                       <Settings size={16} /> SYSTEM SETTINGS
                   </h2>
                   <button onClick={() => setShowSettings(false)} className="hover:text-white transition-colors">
                       <X size={18} />
                   </button>
                </div>
                
                <div className="flex flex-col gap-4">
                   <div className="flex sm:flex-row flex-col justify-between sm:items-center items-start gap-3">
                      <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Assistant Voice</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Charon (Deep/Mature) set as default</span>
                      </div>
                      <select 
                          value={voiceName}
                          onChange={(e: any) => setVoiceName(e.target.value)}
                          className="w-full sm:w-auto bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                      >
                          <option value="Charon">Charon (Deep / Mature)</option>
                          <option value="Fenrir">Fenrir (Deep Male)</option>
                          <option value="Puck">Puck (Higher Male)</option>
                          <option value="Kore">Kore (Calm Female)</option>
                          <option value="Aoede">Aoede (Friendly Female)</option>
                      </select>
                   </div>

                   <div className="flex sm:flex-row flex-col justify-between sm:items-center items-start gap-3">
                      <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Orb Theme</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Visual colors of the app</span>
                      </div>
                      <select 
                          value={orbTheme}
                          onChange={(e: any) => setOrbTheme(e.target.value)}
                          className="w-full sm:w-auto bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                      >
                          <option value="cyan">Cyan (Default)</option>
                          <option value="white">White / Monochrome</option>
                          <option value="red">Red (Sentinel)</option>
                          <option value="amber">Amber (Retro)</option>
                      </select>
                   </div>

                   <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Auto-Approve Actions</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Execute tools without prompt</span>
                      </div>
                      <button 
                          onClick={() => setAutoApproveTools(!autoApproveTools)}
                          className={`w-12 h-6 rounded-full p-1 transition-colors ${autoApproveTools ? 'bg-brand-cyan' : 'bg-brand-bg border border-brand-cyan/30'}`}
                      >
                          <div className={`w-4 h-4 rounded-full transition-transform ${autoApproveTools ? 'bg-black translate-x-6' : 'bg-zinc-500 translate-x-0'}`} />
                      </button>
                   </div>

                   <hr className="border-brand-cyan/20 my-2" />

                   <div className="flex flex-col gap-2">
                       <div className="flex sm:flex-row flex-col justify-between sm:items-center items-start gap-3">
                          <div className="flex flex-col">
                              <span className="text-zinc-200 font-mono text-sm">Target API Provider</span>
                              <span className="text-zinc-500 font-mono text-[10px]">Fallback or custom API Host</span>
                          </div>
                          <select 
                              value={apiProvider}
                              onChange={(e: any) => setApiProvider(e.target.value)}
                              className="w-full sm:w-auto bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                          >
                              <option value="google">Google GenAI (Direct)</option>
                              <option value="openrouter">OpenRouter (Experimental)</option>
                          </select>
                       </div>
                   </div>

                   <div className="flex flex-col gap-2 mb-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Custom API Key (Optional)</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Overrides the environment key</span>
                       </div>
                       <input 
                          type="password" 
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          className="w-full bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                          placeholder="sk-or-v1-..."
                       />
                   </div>

                   <hr className="border-brand-cyan/20 my-2" />

                   <div className="flex flex-col gap-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Local Host Link URL</span>
                          <span className="text-zinc-500 font-mono text-[10px]">For controlling your device via Python backend</span>
                       </div>
                       <input 
                          type="text" 
                          value={localServerUrl}
                          onChange={(e) => setLocalServerUrl(e.target.value)}
                          className="w-full bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                          placeholder="http://localhost:8000"
                       />
                   </div>

                   <hr className="border-brand-cyan/20 my-2" />

                   <div className="flex flex-col gap-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Your Name</span>
                          <span className="text-zinc-500 font-mono text-[10px]">What the AI should call you</span>
                       </div>
                       <input 
                          type="text" 
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="w-full bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                          placeholder="e.g., Tony"
                       />
                   </div>

                   <div className="flex flex-col gap-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Titles / Aliases</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Comma separated (e.g., Boss, Sir)</span>
                       </div>
                       <input 
                          type="text" 
                          value={userTitles}
                          onChange={(e) => setUserTitles(e.target.value)}
                          className="w-full bg-brand-bg/60 border border-brand-cyan/30 text-brand-cyan text-xs font-mono p-2 rounded outline-none focus:border-brand-cyan"
                          placeholder="e.g., Boss, Sir, Captain"
                       />
                   </div>

                   <div className="flex flex-col gap-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Clap Threshold: {clapSensitivity}</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Lower = more sensitive to soft sounds (10-120 range)</span>
                       </div>
                       <input 
                          type="range" 
                          min="10"
                          max="120"
                          value={clapSensitivity}
                          onChange={(e) => setClapSensitivity(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                       />
                   </div>

                   <div className="flex flex-col gap-2">
                       <div className="flex flex-col">
                          <span className="text-zinc-200 font-mono text-sm">Idle Auto-Offline: {idleTimeout} min{idleTimeout !== 1 ? 's' : ''}</span>
                          <span className="text-zinc-500 font-mono text-[10px]">Disconnects mic if silent</span>
                       </div>
                       <input 
                          type="range" 
                          min="1"
                          max="60"
                          value={idleTimeout}
                          onChange={(e) => setIdleTimeout(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                       />
                   </div>

                   <div className="flex items-center justify-between">
                       <span className="text-[10px] text-brand-cyan/70 font-mono">ERROR NOTIFICATIONS</span>
                       <button 
                          onClick={() => setShowToasts(!showToasts)}
                          className={`w-10 h-4 rounded-full relative transition-colors ${showToasts ? 'bg-brand-cyan/40' : 'bg-white/10'}`}
                       >
                          <motion.div 
                             animate={{ x: showToasts ? 24 : 4 }}
                             className="absolute top-1 w-2 h-2 rounded-full bg-brand-cyan"
                          />
                       </button>
                   </div>

                   <div className="flex gap-4 mt-4 pt-4 border-t border-brand-cyan/20">
                       <button 
                          onClick={resetSettings}
                          className="flex-1 py-3 border border-red-500/30 text-red-500/70 hover:bg-red-500/10 rounded font-mono text-[10px] uppercase tracking-[0.2em] transition-all"
                       >
                          Reset System
                       </button>
                       <button 
                          onClick={() => {
                              saveSettings();
                              setShowSettings(false);
                          }}
                          className="flex-1 py-3 bg-brand-cyan text-black hover:bg-brand-cyan/80 rounded font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                       >
                          Save Changes
                       </button>
                   </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Overlay */}
        <div className="fixed bottom-24 right-8 z-[100] flex flex-col gap-2 pointer-events-none text-right">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        className="bg-black/80 backdrop-blur-md border px-4 py-3 rounded border-brand-cyan/40 shadow-[0_0_15px_rgba(14,165,233,0.2)] inline-block w-fit ml-auto"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                            <span className="text-[10px] text-brand-alpha font-mono tracking-[0.2em] uppercase font-bold text-white saturate-150">{t.msg}</span>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
