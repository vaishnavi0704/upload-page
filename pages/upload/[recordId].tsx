
// import { useState, useEffect, useRef } from 'react';
// import { GetServerSideProps } from 'next';

// interface Message {
//   id: string;
//   type: 'agent' | 'user';
//   content: string;
//   documentType?: 'identity' | 'address' | 'offer';
//   timestamp: Date;
//   fileName?: string;
// }

// interface Props {
//   candidateName: string;
//   recordId: string;
//   error?: string;
// }

// export default function DocumentUploadChatbot({ candidateName, recordId, error }: Props) {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [currentStep, setCurrentStep] = useState<'identity' | 'address' | 'offer' | 'complete'>('identity');
//   const [isVerifying, setIsVerifying] = useState(false);
//   const [showCompletionPopup, setShowCompletionPopup] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isSpeaking, setIsSpeaking] = useState(false);
//   const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
//   const [audioLevel, setAudioLevel] = useState(0);
//   const [currentAgentMessage, setCurrentAgentMessage] = useState('');
//   const [conversationEnabled, setConversationEnabled] = useState(true);
  
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const messageCounterRef = useRef(0);
//   const wsRef = useRef<WebSocket | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const mediaStreamRef = useRef<MediaStream | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const processorRef = useRef<ScriptProcessorNode | null>(null);
//   const audioQueueRef = useRef<AudioBuffer[]>([]);
//   const isPlayingRef = useRef<boolean>(false);
//   const animationFrameRef = useRef<number | null>(null);
//   const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  
//   useEffect(() => {
//     if (error) {
//       addAgentMessage(`❌ Error: ${error}`);
//       return;
//     }
//     addAgentMessage(
//       `👋 Hello, ${candidateName}! I'm your AI onboarding assistant. Let's verify your documents.\n\nPlease upload your **Identity Proof** in Image format (PNG, JPG) (Driver's License, Passport, or Government ID).`
//     );
//   }, [candidateName, error]);

//   // WebSocket connection
//   useEffect(() => {
//     const connectWebSocket = () => {
//       wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);

//       wsRef.current.onopen = () => {
//         console.log('✅ WebSocket connected');
//         setIsConnected(true);
//         wsRef.current?.send(JSON.stringify({
//           type: 'start',
//           candidateName,
//           recordId,
//         }));
//       };

//       wsRef.current.onmessage = (event) => {
//         const data = JSON.parse(event.data);
//         console.log('📨 Received:', data.type);
        
//         if (data.type === 'agent_message') {
//           addAgentMessage(data.content);
//           setCurrentAgentMessage('');
//           setAgentIsSpeaking(false);
//         } else if (data.type === 'agent_transcript_delta') {
//           setCurrentAgentMessage(prev => prev + data.delta);
//           setAgentIsSpeaking(true);
//         } else if (data.type === 'agent_transcript_done') {
//           addAgentMessage(data.text);
//           setCurrentAgentMessage('');
//           setAgentIsSpeaking(false);
//         } else if (data.type === 'audio_delta') {
//           setAgentIsSpeaking(true);
//           playAudioDelta(data.delta);
//         } else if (data.type === 'audio_complete') {
//           setAgentIsSpeaking(false);
//           const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
//           audio.onended = () => setAgentIsSpeaking(false);
//           audio.play().catch(err => console.error('Audio playback failed:', err));
//         } else if (data.type === 'user_transcript') {
//           addUserMessage(data.content);
//         } else if (data.type === 'user_started_speaking') {
//           console.log('🎤 User started speaking - interrupting agent');
//           stopAgentAudio();
//         } else if (data.type === 'step_update') {
//           setCurrentStep(data.step);
//         } else if (data.type === 'complete') {
//           setCurrentStep('complete');
//           setShowCompletionPopup(true);
//           setConversationEnabled(false);
//         } else if (data.type === 'trigger_upload') {
//           fileInputRef.current?.click();
//         } else if (data.type === 'error') {
//           addAgentMessage(`Error: ${data.content}`);
//           setAgentIsSpeaking(false);
//         }
//       };

//       wsRef.current.onclose = () => {
//         console.log('❌ WebSocket disconnected');
//         setIsConnected(false);
//         setTimeout(connectWebSocket, 2000);
//       };

//       wsRef.current.onerror = (error) => {
//         console.error('❌ WebSocket error:', error);
//         setIsConnected(false);
//       };
//     };

//     connectWebSocket();

//     return () => {
//       wsRef.current?.close();
//     };
//   }, [candidateName, recordId]);

//   // Initialize audio with voice activity detection
//   useEffect(() => {
//     const initAudio = async () => {
//       try {
//         audioContextRef.current = new AudioContext({ sampleRate: 24000 });
//         const stream = await navigator.mediaDevices.getUserMedia({ 
//           audio: {
//             echoCancellation: true,
//             noiseSuppression: true,
//             autoGainControl: true
//           } 
//         });
//         mediaStreamRef.current = stream;

//         const source = audioContextRef.current.createMediaStreamSource(stream);
        
//         analyserRef.current = audioContextRef.current.createAnalyser();
//         analyserRef.current.fftSize = 2048;
//         analyserRef.current.smoothingTimeConstant = 0.8;
//         source.connect(analyserRef.current);

//         processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
//         processorRef.current.onaudioprocess = (e) => {
//           if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !conversationEnabled || agentIsSpeaking) return;
          
//           const inputData = e.inputBuffer.getChannelData(0);
//           const pcm16 = convertFloat32ToPCM16(inputData);
//           const base64Audio = arrayBufferToBase64(pcm16);
          
//           wsRef.current.send(JSON.stringify({
//             type: 'audio_input',
//             audio: base64Audio
//           }));
//         };

//         source.connect(processorRef.current);
//         processorRef.current.connect(audioContextRef.current.destination);
        
//         detectVoiceActivity();
        
//         console.log('🎤 Microphone initialized with voice detection');

//       } catch (err) {
//         console.error('❌ Microphone access denied:', err);
//         addAgentMessage('Microphone access denied. Please enable microphone permissions in your browser settings.');
//       }
//     };

//     if (isConnected) {
//       initAudio();
//     }

//     return () => {
//       if (animationFrameRef.current) {
//         cancelAnimationFrame(animationFrameRef.current);
//       }
//       mediaStreamRef.current?.getTracks().forEach(track => track.stop());
//       processorRef.current?.disconnect();
//       audioContextRef.current?.close();
//     };
//   }, [isConnected]);

//   const detectVoiceActivity = () => {
//     if (!analyserRef.current) return;

//     const bufferLength = analyserRef.current.frequencyBinCount;
//     const dataArray = new Uint8Array(bufferLength);
//     let lastSpeakingState = false;

//     const checkAudioLevel = () => {
//       if (!analyserRef.current) return;

//       analyserRef.current.getByteFrequencyData(dataArray);
      
//       const sum = dataArray.reduce((a, b) => a + b, 0);
//       const average = sum / bufferLength;
      
//       setAudioLevel(average);
      
//       const voiceThreshold = 20;
//       const currentlySpeaking = average > voiceThreshold && conversationEnabled && !agentIsSpeaking;
      
//       if (currentlySpeaking && !lastSpeakingState) {
//         console.log('🎤 User started speaking');
//         setIsSpeaking(true);
//         if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//           wsRef.current.send(JSON.stringify({
//             type: 'user_speech_start'
//           }));
//         }
//         stopAgentAudio();
//       } else if (!currentlySpeaking && lastSpeakingState) {
//         console.log('🔇 User stopped speaking');
//         setIsSpeaking(false);
//       }
      
//       lastSpeakingState = currentlySpeaking;
//       setIsSpeaking(currentlySpeaking);

//       animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
//     };

//     checkAudioLevel();
//   };

//   const convertFloat32ToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
//     const pcm16 = new Int16Array(float32Array.length);
//     for (let i = 0; i < float32Array.length; i++) {
//       const s = Math.max(-1, Math.min(1, float32Array[i]));
//       pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//     }
//     return pcm16.buffer;
//   };

//   const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
//     const bytes = new Uint8Array(buffer);
//     let binary = '';
//     for (let i = 0; i < bytes.byteLength; i++) {
//       binary += String.fromCharCode(bytes[i]);
//     }
//     return btoa(binary);
//   };

//   const playAudioDelta = async (base64Delta: string) => {
//     if (!audioContextRef.current) return;

//     try {
//       const binaryString = atob(base64Delta);
//       const bytes = new Uint8Array(binaryString.length);
//       for (let i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//       }

//       const pcm16 = new Int16Array(bytes.buffer);
//       const float32 = new Float32Array(pcm16.length);
//       for (let i = 0; i < pcm16.length; i++) {
//         float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
//       }

//       const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
//       audioBuffer.getChannelData(0).set(float32);

//       audioQueueRef.current.push(audioBuffer);
      
//       if (!isPlayingRef.current) {
//         playNextAudio();
//       }
//     } catch (err) {
//       console.error('Audio playback error:', err);
//     }
//   };

//   const playNextAudio = () => {
//     if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
//       isPlayingRef.current = false;
//       setAgentIsSpeaking(false);
//       return;
//     }

//     isPlayingRef.current = true;
//     setAgentIsSpeaking(true);
//     const audioBuffer = audioQueueRef.current.shift()!;
    
//     const source = audioContextRef.current.createBufferSource();
//     source.buffer = audioBuffer;
//     source.connect(audioContextRef.current.destination);
//     source.onended = () => {
//       currentAudioSourceRef.current = null;
//       playNextAudio();
//     };
//     currentAudioSourceRef.current = source;
//     source.start();
//   };

//   const stopAgentAudio = () => {
//     console.log('🛑 Stopping agent audio');
//     audioQueueRef.current = [];
//     isPlayingRef.current = false;
//     setAgentIsSpeaking(false);
//     setCurrentAgentMessage('');
    
//     if (currentAudioSourceRef.current) {
//       try {
//         currentAudioSourceRef.current.stop();
//         currentAudioSourceRef.current = null;
//       } catch (err) {
//         console.log('Could not stop audio source:', err);
//       }
//     }
//   };

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   const addAgentMessage = (content: string) => {
//     const newMessage: Message = {
//       id: `${Date.now()}-${messageCounterRef.current++}`,
//       type: 'agent',
//       content,
//       timestamp: new Date(),
//     };
//     setMessages((prev) => [...prev, newMessage]);
//   };

//   const addUserMessage = (content: string, fileName?: string) => {
//     const newMessage: Message = {
//       id: `${Date.now()}-${messageCounterRef.current++}`,
//       type: 'user',
//       content,
//       timestamp: new Date(),
//       fileName,
//     };
//     setMessages((prev) => [...prev, newMessage]);
//   };  

//   const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file || isVerifying || currentStep === 'complete') return;

//     if (file.size > 10 * 1024 * 1024) {
//       addAgentMessage('File size must be less than 10MB.');
//       return;
//     }

//     const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
//     if (!validTypes.includes(file.type)) {
//       addAgentMessage('Please upload a PDF or image file (JPG, PNG).');
//       return;
//     }

//     console.log('🔒 Disabling conversation for document verification');
//     setConversationEnabled(false);
//     stopAgentAudio();
    
//     audioQueueRef.current = [];
//     isPlayingRef.current = false;
    
//     if (audioContextRef.current) {
//       try {
//         await audioContextRef.current.suspend();
//       } catch (err) {
//         console.log('Could not suspend audio context:', err);
//       }
//     }

//     addUserMessage(`Uploaded: ${file.name}`, file.name);
//     addAgentMessage('Analyzing your document...');
//     setIsVerifying(true);

//     try {
//       const base64 = await fileToBase64(file);
      
//       const verifyResponse = await fetch('/api/verify-document', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           fileData: base64,
//           fileName: file.name,
//           fileType: file.type,
//           documentType: currentStep,
//           candidateName: candidateName,
//         }),
//       });

//       if (!verifyResponse.ok) throw new Error('Verification failed');
//       const verificationResult = await verifyResponse.json();

//       if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
//         try {
//           await audioContextRef.current.resume();
//         } catch (err) {
//           console.log('Could not resume audio context:', err);
//         }
//       }

//       console.log('🔓 Re-enabling conversation after verification');
//       setConversationEnabled(true);

//       wsRef.current?.send(JSON.stringify({
//         type: 'verification_result',
//         documentType: currentStep,
//         fileName: file.name,
//         recordId,
//         verificationData: {
//           confidence: verificationResult.confidence,
//           extractedData: verificationResult.extractedData || {},
//           aiAnalysis: verificationResult.aiAnalysis,
//           isValid: verificationResult.isValid,
//           issues: verificationResult.issues || [],
//           nameMatch: verificationResult.nameMatch || false,
//           extractedName: verificationResult.extractedName || '',
//         }
//       }));

//       if (verificationResult.nameMatch === false) {
//         let nameMismatchMessage = `❌ NAME VERIFICATION FAILED\n\n`;
//         nameMismatchMessage += `**Expected Name:** ${candidateName}\n`;
//         nameMismatchMessage += `**Name on Document:** ${verificationResult.extractedName || 'Not found'}\n\n`;
//         nameMismatchMessage += `⚠️ **CRITICAL:** The name on the document does not match your registered name.\n\n`;
        
//         if (verificationResult.issues && verificationResult.issues.length > 0) {
//           nameMismatchMessage += '**Issues:**\n';
//           verificationResult.issues.forEach((issue: string) => {
//             nameMismatchMessage += `• ${issue}\n`;
//           });
//         }
        
//         nameMismatchMessage += '\n**Please upload a document with YOUR name on it.**';
//         addAgentMessage(nameMismatchMessage);
        
//         return;
//       }

//       if (!verificationResult.isValid || verificationResult.confidence < 0.7) {
//         let failureMessage = `❌ Verification failed (${(verificationResult.confidence * 100).toFixed(0)}% confidence).\n\n`;
//         failureMessage += `${verificationResult.aiAnalysis}\n\n`;
        
//         if (verificationResult.issues && verificationResult.issues.length > 0) {
//           failureMessage += '**Issues found:**\n';
//           verificationResult.issues.forEach((issue: string) => {
//             failureMessage += `• ${issue}\n`;
//           });
//         }
        
//         failureMessage += '\n**The voice agent will explain what needs to be corrected.**';
//         addAgentMessage(failureMessage);
        
//         return;
//       }

//       const formData = new FormData();
//       formData.append('file', file);
//       formData.append('documentType', currentStep);
//       formData.append('recordId', recordId);

//       const uploadResponse = await fetch('/api/upload', {
//         method: 'POST',
//         body: formData
//       });

//       if (!uploadResponse.ok) {
//         throw new Error('Failed to upload to Airtable');
//       }

//       let successMessage = `✅ ${getDocumentLabel(currentStep)} verified successfully!\n\n`;
//       successMessage += `**Name Verified:** ${verificationResult.extractedName || candidateName} ✓\n`;
//       successMessage += `**Confidence Score:** ${(verificationResult.confidence * 100).toFixed(0)}%\n\n`;
      
//       if (Object.keys(verificationResult.extractedData).length > 0) {
//         successMessage += '**Extracted Information:**\n';
//         Object.entries(verificationResult.extractedData).forEach(([key, value]) => {
//           if (value) {
//             const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
//             successMessage += `• ${label}: ${value}\n`;
//           }
//         });
//       }

//       successMessage += '\n**The voice agent will guide you to the next step.**';
//       addAgentMessage(successMessage);

//     } catch (err) {
//       addAgentMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
//       if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
//         try {
//           await audioContextRef.current.resume();
//         } catch (resumeErr) {
//           console.log('Could not resume audio context:', resumeErr);
//         }
//       }
      
//       setConversationEnabled(true);
      
//       wsRef.current?.send(JSON.stringify({
//         type: 'verification_result',
//         documentType: currentStep,
//         fileName: file.name,
//         recordId,
//         verificationData: {
//           confidence: 0,
//           extractedData: {},
//           aiAnalysis: `Error during verification: ${err instanceof Error ? err.message : 'Unknown error'}`,
//           isValid: false,
//           issues: ['Technical error occurred during verification'],
//           nameMatch: false,
//           extractedName: ''
//         }
//       }));
//     } finally {
//       setIsVerifying(false);
//       if (fileInputRef.current) fileInputRef.current.value = '';
//     }
//   };

//   const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.readAsDataURL(file);
//       reader.onload = () => resolve(reader.result as string);
//       reader.onerror = reject;
//     });
//   };

//   const getDocumentLabel = (type: 'identity' | 'address' | 'offer') => {
//     const labels = {
//       identity: 'Identity Proof',
//       address: 'Address Proof',
//       offer: 'Offer Letter',
//     };
//     return labels[type];
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   if (error) {
//     return (
//       <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
//         <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
//           <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠</div>
//           <h2>Error</h2>
//           <p>{error}</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', fontFamily: 'system-ui' }}>
//       <div style={{ maxWidth: '800px', margin: '0 auto', height: '85vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
//         <div style={{ padding: '24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//             <div>
//               <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>AI Voice Document Assistant</h1>
//               <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
//                 {candidateName}
//               </p>
//             </div>
            
//             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
//               <div style={{
//                 width: '60px',
//                 height: '60px',
//                 borderRadius: '50%',
//                 background: !conversationEnabled ? '#9ca3af' : (agentIsSpeaking ? '#ef4444' : (isSpeaking ? '#10b981' : '#6b7280')),
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '24px',
//                 transition: 'all 0.2s ease',
//                 boxShadow: !conversationEnabled ? 'none' : (agentIsSpeaking ? '0 0 20px rgba(239, 68, 68, 0.8)' : (isSpeaking ? '0 0 20px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(107, 114, 128, 0.5)')),
//                 animation: (isSpeaking || agentIsSpeaking) ? 'pulse 1.5s infinite' : 'none'
//               }}>
//                 {!conversationEnabled ? '⏸️' : (agentIsSpeaking ? '🤖' : (isSpeaking ? '🎤' : '👤'))}
//               </div>
//               <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9 }}>
//                 {!conversationEnabled ? 'PAUSED' : (agentIsSpeaking ? 'AGENT SPEAKING' : (isSpeaking ? 'YOU SPEAKING' : 'READY'))}
//               </div>
//               <div style={{ 
//                 width: '60px', 
//                 height: '4px', 
//                 background: 'rgba(255,255,255,0.3)', 
//                 borderRadius: '2px',
//                 overflow: 'hidden'
//               }}>
//                 <div style={{
//                   height: '100%',
//                   width: `${Math.min((audioLevel / 100) * 100, 100)}%`,
//                   background: !conversationEnabled ? '#9ca3af' : (agentIsSpeaking ? '#ef4444' : (isSpeaking ? '#10b981' : '#6b7280')),
//                   transition: 'width 0.1s ease'
//                 }} />
//               </div>
//             </div>
//           </div>
          
//           <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
//             Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'} 
//             {isVerifying && ' | 📄 Verifying Document...'}
//           </div>
//         </div>

//         <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }}>
//           {messages.map((message) => (
//             <div key={message.id} style={{ marginBottom: '16px', display: 'flex', justifyContent: message.type === 'agent' ? 'flex-start' : 'flex-end' }}>
//               <div style={{
//                 background: message.type === 'agent' ? 'white' : 'linear-gradient(135deg, #667eea, #764ba2)',
//                 color: message.type === 'agent' ? '#1f2937' : 'white',
//                 padding: '14px 18px',
//                 borderRadius: message.type === 'agent' ? '0 16px 16px 16px' : '16px 0 16px 16px',
//                 maxWidth: '75%',
//                 boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
//                 whiteSpace: 'pre-wrap',
//                 fontSize: '14px',
//                 lineHeight: '1.6'
//               }}>
//                 {message.content}
//                 {message.fileName && (
//                   <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px' }}>
//                     📎 {message.fileName}
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}
          
//           {currentAgentMessage && (
//             <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
//               <div style={{
//                 background: 'white',
//                 color: '#1f2937',
//                 padding: '14px 18px',
//                 borderRadius: '0 16px 16px 16px',
//                 maxWidth: '75%',
//                 boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
//                 fontSize: '14px',
//                 lineHeight: '1.6',
//                 opacity: 0.7
//               }}>
//                 {currentAgentMessage}
//                 <span style={{ animation: 'blink 1s infinite' }}>▋</span>
//               </div>
//             </div>
//           )}
          
//           <div ref={messagesEndRef} />
//         </div>

//         {currentStep !== 'complete' && (
//           <div style={{ padding: '24px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="application/pdf,image/jpeg,image/jpg,image/png"
//               onChange={handleFileSelect}
//               style={{ display: 'none' }}
//               disabled={isVerifying}
//             />
//             <button
//               onClick={() => fileInputRef.current?.click()}
//               disabled={isVerifying || !isConnected}
//               style={{
//                 width: '100%',
//                 padding: '16px',
//                 background: (isVerifying || !isConnected) ? '#e5e7eb' : 'linear-gradient(135deg, #667eea, #764ba2)',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '12px',
//                 fontSize: '15px',
//                 fontWeight: '600',
//                 cursor: (isVerifying || !isConnected) ? 'not-allowed' : 'pointer',
//                 opacity: (isVerifying || !isConnected) ? 0.6 : 1
//               }}
//             >
//               {isVerifying ? 'Verifying...' : `Upload ${getDocumentLabel(currentStep)}`}
//             </button>
//             <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
//               Speak naturally or click to upload your document
//             </p>
//           </div>
//         )}
//       </div>

//       <style>{`
//         @keyframes blink {
//           0%, 50% { opacity: 1; }
//           51%, 100% { opacity: 0; }
//         }
//         @keyframes pulse {
//           0%, 100% { transform: scale(1); }
//           50% { transform: scale(1.1); }
//         }
//       `}</style>

//       {showCompletionPopup && (
//         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
//           <div style={{ background: 'white', borderRadius: '20px', padding: '50px 40px', maxWidth: '450px', textAlign: 'center', boxShadow: '0 25px 70px rgba(0,0,0,0.4)' }}>
//             <div style={{ fontSize: '70px', marginBottom: '20px' }}>✅</div>
//             <h2 style={{ margin: '0 0 15px', color: '#1f2937', fontSize: '28px', fontWeight: '700' }}>
//               All Documents Verified!
//             </h2>
//             <p style={{ color: '#6b7280', marginBottom: '35px', fontSize: '15px' }}>
//               Your preboarding is complete. HR will contact you within 24 hours.
//             </p>
//             <button
//               onClick={() => setShowCompletionPopup(false)}
//               style={{ padding: '14px 40px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
//             >
//               Done
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const { recordId } = context.params as { recordId: string };

//   if (!recordId || !recordId.match(/^[a-zA-Z0-9]+$/)) {
//     return { 
//       props: { 
//         candidateName: 'Guest',
//         recordId: recordId || '',
//         error: 'Invalid Record ID format' 
//       } 
//     };
//   }

//   try {
//     const response = await fetch(
//       `https://api.airtable.com/v0/appMvECrw7CrJFCO0/tblqaH9RrTO6JuG5N/${recordId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
//         },
//       }
//     );

//     if (!response.ok) {
//       throw new Error('Record not found');
//     }

//     const data = await response.json();
//     const candidateName = data.fields.Name || 'Candidate';

//     return { props: { candidateName, recordId } };
//   } catch (err) {
//     console.error('getServerSideProps Error:', err);
//     return { 
//       props: { 
//         candidateName: 'Guest',
//         recordId: recordId,
//         error: 'Failed to load candidate details. Please check your Record ID.' 
//       } 
//     };
//   }
// };



import { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';

interface Message {
  id: string;
  type: 'agent' | 'user';
  content: string;
  documentType?: 'identity' | 'address' | 'offer';
  timestamp: Date;
  fileName?: string;
}

interface Props {
  candidateName: string;
  recordId: string;
  error?: string;
}

export default function DocumentUploadChatbot({ candidateName, recordId, error }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<'identity' | 'address' | 'offer' | 'complete'>('identity');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentAgentMessage, setCurrentAgentMessage] = useState('');
  const [conversationEnabled, setConversationEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageCounterRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // NEW: Accumulate ALL audio chunks before playing
  const allAudioChunksRef = useRef<Float32Array[]>([]);
  const isReceivingAudioRef = useRef<boolean>(false);
  const audioCompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // NEW: Voice Activity Detection for sentence-level interruption
  const voiceActivityBufferRef = useRef<number[]>([]);
  const isSpeakingContinuouslyRef = useRef<boolean>(false);
  const speechStartTimeRef = useRef<number>(0);
  const MIN_SPEECH_DURATION_MS = 1500; // Only interrupt after 1.5 seconds of continuous speech

  
  useEffect(() => {
    if (error) {
      addAgentMessage(`❌ Error: ${error}`);
      return;
    }
    addAgentMessage(
      `👋 Hello, ${candidateName}! I'm your AI onboarding assistant. Let's verify your documents.\n\nPlease upload your **Identity Proof** in Image format (PNG, JPG) (Driver's License, Passport, or Government ID).`
    );
  }, [candidateName, error]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        wsRef.current?.send(JSON.stringify({
          type: 'start',
          candidateName,
          recordId,
        }));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data.type);
        
        if (data.type === 'agent_message') {
          addAgentMessage(data.content);
          setCurrentAgentMessage('');
          setAgentIsSpeaking(false);
        } else if (data.type === 'agent_transcript_delta') {
          setCurrentAgentMessage(prev => prev + data.delta);
          setAgentIsSpeaking(true);
        } else if (data.type === 'agent_transcript_done') {
          addAgentMessage(data.text);
          setCurrentAgentMessage('');
          // Don't immediately set agentIsSpeaking to false - wait for audio to finish
        } else if (data.type === 'audio_delta') {
          // Accumulate audio chunks - DON'T play yet
          isReceivingAudioRef.current = true;
          setAgentIsSpeaking(true);
          
          // Clear the completion timeout
          if (audioCompleteTimeoutRef.current) {
            clearTimeout(audioCompleteTimeoutRef.current);
          }
          
          // Store the chunk
          storeAudioChunk(data.delta);
          
          // Set timeout to detect when streaming is complete (300ms of no new data)
          audioCompleteTimeoutRef.current = setTimeout(() => {
            console.log('🎵 Audio streaming complete - playing accumulated audio');
            playAccumulatedAudio();
          }, 300);
          
        } else if (data.type === 'audio_complete') {
          // Server explicitly says audio is complete
          if (audioCompleteTimeoutRef.current) {
            clearTimeout(audioCompleteTimeoutRef.current);
          }
          
          console.log('🎵 Received audio_complete - playing all accumulated audio');
          isReceivingAudioRef.current = false;
          playAccumulatedAudio();
        } else if (data.type === 'user_transcript') {
          addUserMessage(data.content);
        } else if (data.type === 'user_started_speaking') {
          console.log('🎤 User started speaking - interrupting agent');
          stopAgentAudio();
        } else if (data.type === 'step_update') {
          setCurrentStep(data.step);
        } else if (data.type === 'complete') {
          setCurrentStep('complete');
          setShowCompletionPopup(true);
          setConversationEnabled(false);
        } else if (data.type === 'trigger_upload') {
          fileInputRef.current?.click();
        } else if (data.type === 'error') {
          addAgentMessage(`Error: ${data.content}`);
          setAgentIsSpeaking(false);
        }
      };

      wsRef.current.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        setTimeout(connectWebSocket, 2000);
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      wsRef.current?.close();
      if (audioCompleteTimeoutRef.current) {
        clearTimeout(audioCompleteTimeoutRef.current);
      }
    };
  }, [candidateName, recordId]);

  // Initialize audio with voice activity detection
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        mediaStreamRef.current = stream;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
        source.connect(analyserRef.current);

        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processorRef.current.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !conversationEnabled || agentIsSpeaking) return;
          
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = convertFloat32ToPCM16(inputData);
          const base64Audio = arrayBufferToBase64(pcm16);
          
          wsRef.current.send(JSON.stringify({
            type: 'audio_input',
            audio: base64Audio
          }));
        };

        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
        
        detectVoiceActivity();
        
        console.log('🎤 Microphone initialized with voice detection');

      } catch (err) {
        console.error('❌ Microphone access denied:', err);
        addAgentMessage('Microphone access denied. Please enable microphone permissions in your browser settings.');
      }
    };

    if (isConnected) {
      initAudio();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      processorRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, [isConnected]);

  const detectVoiceActivity = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / bufferLength;
      
      setAudioLevel(average);
      
      const voiceThreshold = 20;
      const isSpeakingNow = average > voiceThreshold && conversationEnabled && !agentIsSpeaking;
      
      // Add to rolling buffer (last 10 frames)
      voiceActivityBufferRef.current.push(isSpeakingNow ? 1 : 0);
      if (voiceActivityBufferRef.current.length > 10) {
        voiceActivityBufferRef.current.shift();
      }
      
      // Check if consistently speaking (7 out of 10 frames)
      const speakingFrames = voiceActivityBufferRef.current.reduce((a, b) => a + b, 0);
      const isConsistentlySpeaking = speakingFrames >= 7;
      
      // Track continuous speech duration
      if (isConsistentlySpeaking && !isSpeakingContinuouslyRef.current) {
        // Started speaking continuously
        isSpeakingContinuouslyRef.current = true;
        speechStartTimeRef.current = Date.now();
        setIsSpeaking(true);
        console.log('🎤 User started speaking continuously');
      } else if (!isConsistentlySpeaking && isSpeakingContinuouslyRef.current) {
        // Stopped speaking
        isSpeakingContinuouslyRef.current = false;
        setIsSpeaking(false);
        console.log('🔇 User stopped speaking');
      }
      
      // Only interrupt agent if user has been speaking for MIN_SPEECH_DURATION_MS
      if (isSpeakingContinuouslyRef.current) {
        const speechDuration = Date.now() - speechStartTimeRef.current;
        
        if (speechDuration >= MIN_SPEECH_DURATION_MS && agentIsSpeaking) {
          console.log(`🎤 User speaking for ${speechDuration}ms - interrupting agent`);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'user_speech_start'
            }));
          }
          stopAgentAudio();
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const convertFloat32ToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16.buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // NEW: Store audio chunk without playing
  const storeAudioChunk = (base64Delta: string) => {
    try {
      const binaryString = atob(base64Delta);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Just store it - don't play yet
      allAudioChunksRef.current.push(float32);
      console.log(`🎵 Stored chunk ${allAudioChunksRef.current.length}, size: ${float32.length}`);
    } catch (err) {
      console.error('Error storing audio chunk:', err);
    }
  };

  // NEW: Play all accumulated audio at once
  const playAccumulatedAudio = () => {
    if (!audioContextRef.current || allAudioChunksRef.current.length === 0) {
      console.log('⚠️ No audio to play');
      isReceivingAudioRef.current = false;
      setAgentIsSpeaking(false);
      return;
    }

    try {
      console.log(`🎵 Playing ${allAudioChunksRef.current.length} accumulated chunks`);
      
      // Combine ALL chunks into one complete audio buffer
      const totalLength = allAudioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of allAudioChunksRef.current) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Clear the accumulated chunks
      allAudioChunksRef.current = [];
      
      // Create one complete audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(1, combinedAudio.length, 24000);
      audioBuffer.getChannelData(0).set(combinedAudio);
      
      console.log(`🎵 Created complete audio buffer: ${audioBuffer.duration.toFixed(2)}s`);
      
      // Play it immediately
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        console.log('🎵 Audio playback complete');
        currentAudioSourceRef.current = null;
        isPlayingRef.current = false;
        setAgentIsSpeaking(false);
      };
      
      currentAudioSourceRef.current = source;
      isPlayingRef.current = true;
      setAgentIsSpeaking(true);
      
      source.start(0);
      console.log('🎵 Started playing complete audio from beginning');
      
    } catch (err) {
      console.error('Error playing accumulated audio:', err);
      allAudioChunksRef.current = [];
      isReceivingAudioRef.current = false;
      setAgentIsSpeaking(false);
    }
  };

  const playAudioDelta = async (base64Delta: string) => {
    // This function is deprecated - we now use storeAudioChunk and playAccumulatedAudio
    console.warn('playAudioDelta called but is deprecated');
  };

  const playNextAudio = () => {
    // This function is deprecated - we now play complete audio at once
    console.warn('playNextAudio called but is deprecated');
  };

  const stopAgentAudio = () => {
    console.log('🛑 Stopping agent audio');
    
    // Clear all audio-related state
    audioQueueRef.current = [];
    allAudioChunksRef.current = [];
    isPlayingRef.current = false;
    isReceivingAudioRef.current = false;
    
    if (audioCompleteTimeoutRef.current) {
      clearTimeout(audioCompleteTimeoutRef.current);
    }
    
    setAgentIsSpeaking(false);
    setCurrentAgentMessage('');
    
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current = null;
      } catch (err) {
        console.log('Could not stop audio source:', err);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addAgentMessage = (content: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${messageCounterRef.current++}`,
      type: 'agent',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const addUserMessage = (content: string, fileName?: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${messageCounterRef.current++}`,
      type: 'user',
      content,
      timestamp: new Date(),
      fileName,
    };
    setMessages((prev) => [...prev, newMessage]);
  };  

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isVerifying || currentStep === 'complete') return;

    if (file.size > 10 * 1024 * 1024) {
      addAgentMessage('File size must be less than 10MB.');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      addAgentMessage('Please upload a PDF or image file (JPG, PNG).');
      return;
    }

    console.log('🔒 Disabling conversation for document verification');
    setConversationEnabled(false);
    stopAgentAudio();
    
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.suspend();
      } catch (err) {
        console.log('Could not suspend audio context:', err);
      }
    }

    addUserMessage(`Uploaded: ${file.name}`, file.name);
    addAgentMessage('Analyzing your document...');
    setIsVerifying(true);

    try {
      const base64 = await fileToBase64(file);
      
      const verifyResponse = await fetch('/api/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64,
          fileName: file.name,
          fileType: file.type,
          documentType: currentStep,
          candidateName: candidateName,
        }),
      });

      if (!verifyResponse.ok) throw new Error('Verification failed');
      const verificationResult = await verifyResponse.json();

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (err) {
          console.log('Could not resume audio context:', err);
        }
      }

      console.log('🔓 Re-enabling conversation after verification');
      setConversationEnabled(true);

      wsRef.current?.send(JSON.stringify({
        type: 'verification_result',
        documentType: currentStep,
        fileName: file.name,
        recordId,
        verificationData: {
          confidence: verificationResult.confidence,
          extractedData: verificationResult.extractedData || {},
          aiAnalysis: verificationResult.aiAnalysis,
          isValid: verificationResult.isValid,
          issues: verificationResult.issues || [],
          nameMatch: verificationResult.nameMatch || false,
          extractedName: verificationResult.extractedName || '',
        }
      }));

      if (verificationResult.nameMatch === false) {
        let nameMismatchMessage = `❌ NAME VERIFICATION FAILED\n\n`;
        nameMismatchMessage += `**Expected Name:** ${candidateName}\n`;
        nameMismatchMessage += `**Name on Document:** ${verificationResult.extractedName || 'Not found'}\n\n`;
        nameMismatchMessage += `⚠️ **CRITICAL:** The name on the document does not match your registered name.\n\n`;
        
        if (verificationResult.issues && verificationResult.issues.length > 0) {
          nameMismatchMessage += '**Issues:**\n';
          verificationResult.issues.forEach((issue: string) => {
            nameMismatchMessage += `• ${issue}\n`;
          });
        }
        
        nameMismatchMessage += '\n**Please upload a document with YOUR name on it.**';
        addAgentMessage(nameMismatchMessage);
        
        return;
      }

      if (!verificationResult.isValid || verificationResult.confidence < 0.7) {
        let failureMessage = `❌ Verification failed (${(verificationResult.confidence * 100).toFixed(0)}% confidence).\n\n`;
        failureMessage += `${verificationResult.aiAnalysis}\n\n`;
        
        if (verificationResult.issues && verificationResult.issues.length > 0) {
          failureMessage += '**Issues found:**\n';
          verificationResult.issues.forEach((issue: string) => {
            failureMessage += `• ${issue}\n`;
          });
        }
        
        failureMessage += '\n**The voice agent will explain what needs to be corrected.**';
        addAgentMessage(failureMessage);
        
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', currentStep);
      formData.append('recordId', recordId);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to Airtable');
      }

      let successMessage = `✅ ${getDocumentLabel(currentStep)} verified successfully!\n\n`;
      successMessage += `**Name Verified:** ${verificationResult.extractedName || candidateName} ✓\n`;
      successMessage += `**Confidence Score:** ${(verificationResult.confidence * 100).toFixed(0)}%\n\n`;
      
      if (Object.keys(verificationResult.extractedData).length > 0) {
        successMessage += '**Extracted Information:**\n';
        Object.entries(verificationResult.extractedData).forEach(([key, value]) => {
          if (value) {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            successMessage += `• ${label}: ${value}\n`;
          }
        });
      }

      successMessage += '\n**The voice agent will guide you to the next step.**';
      addAgentMessage(successMessage);

    } catch (err) {
      addAgentMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (resumeErr) {
          console.log('Could not resume audio context:', resumeErr);
        }
      }
      
      setConversationEnabled(true);
      
      wsRef.current?.send(JSON.stringify({
        type: 'verification_result',
        documentType: currentStep,
        fileName: file.name,
        recordId,
        verificationData: {
          confidence: 0,
          extractedData: {},
          aiAnalysis: `Error during verification: ${err instanceof Error ? err.message : 'Unknown error'}`,
          isValid: false,
          issues: ['Technical error occurred during verification'],
          nameMatch: false,
          extractedName: ''
        }
      }));
    } finally {
      setIsVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const getDocumentLabel = (type: 'identity' | 'address' | 'offer') => {
    const labels = {
      identity: 'Identity Proof',
      address: 'Address Proof',
      offer: 'Offer Letter',
    };
    return labels[type];
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠</div>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', height: '85vh', background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>AI Voice Document Assistant</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                {candidateName}
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: !conversationEnabled ? '#9ca3af' : (agentIsSpeaking ? '#ef4444' : (isSpeaking ? '#10b981' : '#6b7280')),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                transition: 'all 0.2s ease',
                boxShadow: !conversationEnabled ? 'none' : (agentIsSpeaking ? '0 0 20px rgba(239, 68, 68, 0.8)' : (isSpeaking ? '0 0 20px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(107, 114, 128, 0.5)')),
                animation: (isSpeaking || agentIsSpeaking) ? 'pulse 1.5s infinite' : 'none'
              }}>
                {!conversationEnabled ? '⏸️' : (agentIsSpeaking ? '🤖' : (isSpeaking ? '🎤' : '👤'))}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9 }}>
                {!conversationEnabled ? 'PAUSED' : (agentIsSpeaking ? 'AGENT SPEAKING' : (isSpeaking ? 'YOU SPEAKING' : 'READY'))}
              </div>
              <div style={{ 
                width: '60px', 
                height: '4px', 
                background: 'rgba(255,255,255,0.3)', 
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((audioLevel / 100) * 100, 100)}%`,
                  background: !conversationEnabled ? '#9ca3af' : (agentIsSpeaking ? '#ef4444' : (isSpeaking ? '#10b981' : '#6b7280')),
                  transition: 'width 0.1s ease'
                }} />
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'} 
            {isVerifying && ' | 📄 Verifying Document...'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }}>
          {messages.map((message) => (
            <div key={message.id} style={{ marginBottom: '16px', display: 'flex', justifyContent: message.type === 'agent' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                background: message.type === 'agent' ? 'white' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: message.type === 'agent' ? '#1f2937' : 'white',
                padding: '14px 18px',
                borderRadius: message.type === 'agent' ? '0 16px 16px 16px' : '16px 0 16px 16px',
                maxWidth: '75%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {message.content}
                {message.fileName && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px' }}>
                    📎 {message.fileName}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {currentAgentMessage && (
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: 'white',
                color: '#1f2937',
                padding: '14px 18px',
                borderRadius: '0 16px 16px 16px',
                maxWidth: '75%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: '14px',
                lineHeight: '1.6',
                opacity: 0.7
              }}>
                {currentAgentMessage}
                <span style={{ animation: 'blink 1s infinite' }}>▋</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {currentStep !== 'complete' && (
          <div style={{ padding: '24px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isVerifying}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isVerifying || !isConnected}
              style={{
                width: '100%',
                padding: '16px',
                background: (isVerifying || !isConnected) ? '#e5e7eb' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (isVerifying || !isConnected) ? 'not-allowed' : 'pointer',
                opacity: (isVerifying || !isConnected) ? 0.6 : 1
              }}
            >
              {isVerifying ? 'Verifying...' : `Upload ${getDocumentLabel(currentStep)}`}
            </button>
            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
              Speak naturally or click to upload your document
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      {showCompletionPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '50px 40px', maxWidth: '450px', textAlign: 'center', boxShadow: '0 25px 70px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '70px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ margin: '0 0 15px', color: '#1f2937', fontSize: '28px', fontWeight: '700' }}>
              All Documents Verified!
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '35px', fontSize: '15px' }}>
              Your preboarding is complete. HR will contact you within 24 hours.
            </p>
            <button
              onClick={() => setShowCompletionPopup(false)}
              style={{ padding: '14px 40px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { recordId } = context.params as { recordId: string };

  if (!recordId || !recordId.match(/^[a-zA-Z0-9]+$/)) {
    return { 
      props: { 
        candidateName: 'Guest',
        recordId: recordId || '',
        error: 'Invalid Record ID format' 
      } 
    };
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/appMvECrw7CrJFCO0/tblqaH9RrTO6JuG5N/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Record not found');
    }

    const data = await response.json();
    const candidateName = data.fields.Name || 'Candidate';

    return { props: { candidateName, recordId } };
  } catch (err) {
    console.error('getServerSideProps Error:', err);
    return { 
      props: { 
        candidateName: 'Guest',
        recordId: recordId,
        error: 'Failed to load candidate details. Please check your Record ID.' 
      } 
    };
  }
};
