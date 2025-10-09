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
  const [isSpeaking, setIsSpeaking] = useState(true); // Voice activity detection
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentAgentMessage, setCurrentAgentMessage] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageCounterRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const animationFrameRef = useRef<number>();
  
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
      wsRef.current = new WebSocket('ws://localhost:8080');

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
        const playMP3Audio = (base64Audio: string) => {
          const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
          audio.play().catch(err => console.error('Audio playback failed:', err));
        };
        
        if (data.type === 'agent_message') {
          addAgentMessage(data.content);
          setCurrentAgentMessage('');
        } else if (data.type === 'agent_transcript_delta') {
          setCurrentAgentMessage(prev => prev + data.delta);
        } else if (data.type === 'agent_transcript_done') {
          addAgentMessage(data.text);
          setCurrentAgentMessage('');
        } else if (data.type === 'audio_delta') {
          playAudioDelta(data.delta);
        } else if (data.type === 'user_transcript') {
          addUserMessage(data.content);
        } else if (data.type === 'step_update') {
          setCurrentStep(data.step);
        } else if (data.type === 'complete') {
          setCurrentStep('complete');
          setShowCompletionPopup(true);
        } else if (data.type === 'trigger_upload') {
          fileInputRef.current?.click();
        } else if (data.type === 'error') {
          addAgentMessage(`Error: ${data.content}`);
        }else if (data.type === 'audio_complete') {
          playMP3Audio(data.audio);
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
        
        // Create analyser for voice activity detection
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
        source.connect(analyserRef.current);

        // Create processor for sending audio
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processorRef.current.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          
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
        
        // Start voice activity detection visualization
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

  // Voice activity detection
  const detectVoiceActivity = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / bufferLength;
      
      setAudioLevel(average);
      
      // Threshold for voice detection (adjust as needed)
      const voiceThreshold = 20;
      setIsSpeaking(average > voiceThreshold);

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

  const playAudioDelta = async (base64Delta: string) => {
    if (!audioContextRef.current) return;

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

      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      audioQueueRef.current.push(audioBuffer);
      
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextAudio();
    source.start();
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

// 🔥 REPLACE YOUR handleFileSelect FUNCTION WITH THIS VERSION
// This version clears audio queue and stops playback during verification


// 🔥 ADD THIS TO YOUR COMPONENT - UPDATED handleFileSelect with Name Verification

// 🔥 ADD THIS TO YOUR COMPONENT - UPDATED handleFileSelect with Name Verification

// 🔥 ADD THIS TO YOUR COMPONENT - UPDATED handleFileSelect with Name Verification

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

      // 🔥 Clear audio queue and stop any playing audio
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      
      // Stop current audio context
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
        
        // 🔥 NEW: Call verification API with candidate name for name matching
        const verifyResponse = await fetch('/api/verify-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            fileName: file.name,
            fileType: file.type,
            documentType: currentStep,
            candidateName: candidateName, // 🔥 NEW: Send candidate name for verification
          }),
        });

        if (!verifyResponse.ok) throw new Error('Verification failed');
        const verificationResult = await verifyResponse.json();

        // Resume audio context for voice agent response
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
          } catch (err) {
            console.log('Could not resume audio context:', err);
          }
        }

        // 🔥 CRITICAL: Send verification result to voice agent IMMEDIATELY (success or failure)
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
            nameMatch: verificationResult.nameMatch || false, // 🔥 NEW: Name match status
            extractedName: verificationResult.extractedName || '', // 🔥 NEW: Name found in document
          }
        }));

        // 🔥 NEW: Check for NAME MISMATCH first (highest priority)
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
          
          // Voice agent will explain the name mismatch
          return;
        }

        // Check if verification FAILED (other reasons)
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

        // ✅ Verification SUCCESS - Upload to Airtable
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

        // Show success message in UI
        let successMessage = `✅ ${getDocumentLabel(currentStep)} verified successfully!\n\n`;
        successMessage += `**Name Verified:** ${verificationResult.extractedName || candidateName} ✓\n`; // 🔥 NEW
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
  // const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file || isVerifying || currentStep === 'complete') return;

  //   if (file.size > 10 * 1024 * 1024) {
  //     addAgentMessage('File size must be less than 10MB.');
  //     return;
  //   }

  //   const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  //   if (!validTypes.includes(file.type)) {
  //     addAgentMessage('Please upload a PDF or image file (JPG, PNG).');
  //     return;
  //   }

  //   addUserMessage(`Uploaded: ${file.name}`, file.name);
  //   addAgentMessage('Analyzing your document...');
  //   setIsVerifying(true);

  //   try {
  //     const base64 = await fileToBase64(file);
  //     const verifyResponse = await fetch('/api/verify-document', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         fileData: base64,
  //         fileName: file.name,
  //         fileType: file.type,
  //         documentType: currentStep,
  //       }),
  //     });

  //     if (!verifyResponse.ok) throw new Error('Verification failed');
  //     const verificationResult = await verifyResponse.json();

  //     if (!verificationResult.isValid || verificationResult.confidence < 0.7) {
  //       addAgentMessage(`Verification failed. ${verificationResult.aiAnalysis}\nPlease upload a clearer document.`);
  //       return;
  //     }

  //     // const formData = new FormData();
  //     // formData.append('file', file);
  //     // formData.append('documentType', currentStep);
  //     // formData.append('recordId', recordId);

  //     // const uploadResponse = await fetch('/api/upload', {
  //     //   method: 'POST',
  //     //   body: formData,
  //     // });

  //     // if (!uploadResponse.ok) throw new Error('Upload failed');
  //     const formData = new FormData();
  //     formData.append('file', file);
  //     formData.append('documentType', currentStep);
  //     formData.append('recordId', recordId);

  //     const uploadResponse = await fetch('/api/upload', {
  //       method: 'POST',
  //       body: formData
  //     });

  //     if (!uploadResponse.ok) {
  //       throw new Error('Failed to upload to Airtable');
  //     }

  //     // Success message
  //     let successMessage = `✅ ${getDocumentLabel(currentStep)} verified successfully!\n\n`;
  //     successMessage += `**AI Analysis:**\n${verificationResult.aiAnalysis}\n\n`;
  //     successMessage += `**Confidence Score:** ${(verificationResult.confidence * 100).toFixed(0)}%`;
      
  //     if (Object.keys(verificationResult.extractedData).length > 0) {
  //       successMessage += '\n\n**Extracted Information:**\n';
  //       Object.entries(verificationResult.extractedData).forEach(([key, value]) => {
  //         if (value) {
  //           const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  //           successMessage += `• ${label}: ${value}\n`;
  //         }
  //       });
  //     }

  //     addAgentMessage(`${getDocumentLabel(currentStep)} verified! Confidence: ${(verificationResult.confidence * 100).toFixed(0)}%`);

  //     wsRef.current?.send(JSON.stringify({
  //       type: 'file_verified',
  //       documentType: currentStep,
  //       fileName: file.name,
  //       recordId,
  //     }));

  //   } catch (err) {
  //     addAgentMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  //   } finally {
  //     setIsVerifying(false);
  //     if (fileInputRef.current) fileInputRef.current.value = '';
  //   }
  // };

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
        
        {/* Header with voice indicator */}
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>AI Voice Document Assistant</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                {candidateName}
              </p>
            </div>
            
            {/* Voice Activity Indicator */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: isSpeaking ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                transition: 'all 0.2s ease',
                boxShadow: isSpeaking ? '0 0 20px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(239, 68, 68, 0.5)',
                animation: isSpeaking ? 'pulse 1.5s infinite' : 'none'
              }}>
                {isSpeaking ? '🎤' : '🔇'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9 }}>
                {isSpeaking ? 'LISTENING' : 'SILENT'}
              </div>
              {/* Audio level bar */}
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
                  background: isSpeaking ? '#10b981' : '#ef4444',
                  transition: 'width 0.1s ease'
                }} />
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>

        {/* Messages */}
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

        {/* Upload button */}
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



// import { GetServerSideProps } from 'next';
// import { useState, useEffect } from 'react';

// interface Props {
//   candidateName: string;
//   recordId: string;
//   error?: string;
// }

// export default function UploadPage({ candidateName, recordId, error }: Props) {
//   const [status, setStatus] = useState('');
//   const [uploadError, setUploadError] = useState('');
//   const [isUploading, setIsUploading] = useState(false);
//   const [fileNames, setFileNames] = useState({ identityProof: '', addressProof: '', offerLetter: '' });
//   const [fileRefs, setFileRefs] = useState<{ identityProof: File | null, addressProof: File | null, offerLetter: File | null }>({ 
//     identityProof: null, 
//     addressProof: null, 
//     offerLetter: null 
//   });
//   const [aiVerificationStep, setAiVerificationStep] = useState(0);

//   useEffect(() => {
//     let timer: NodeJS.Timeout;
//     if (isUploading) {
//       setAiVerificationStep(0);
//       timer = setInterval(() => {
//         setAiVerificationStep((prev) => {
//           if (prev < 3) return prev + 1;
//           return prev;
//         });
//       }, 1500);
//     }
//     return () => clearInterval(timer);
//   }, [isUploading]);

//   if (error) {
//     return (
//       <div style={{
//         minHeight: '100vh',
//         background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         padding: '20px',
//         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
//       }}>
//         <div style={{
//           background: 'white',
//           borderRadius: '16px',
//           boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
//           padding: '40px',
//           maxWidth: '400px',
//           width: '100%',
//           textAlign: 'center'
//         }}>
//           <div style={{
//             width: '60px',
//             height: '60px',
//             background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
//             borderRadius: '50%',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             margin: '0 auto 20px',
//             color: 'white',
//             fontSize: '24px'
//           }}>
//             ⚠️
//           </div>
//           <h2 style={{ color: '#333', marginBottom: '10px', fontSize: '20px' }}>Oops! Something went wrong</h2>
//           <p style={{ color: '#666', fontSize: '14px' }}>{error}</p>
//         </div>
//       </div>
//     );
//   }

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       setFileNames(prev => ({ ...prev, [key]: file.name }));
//       setFileRefs(prev => ({ ...prev, [key]: file }));
//     }
//   };

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setIsUploading(true);
//     setStatus('Validating...');
//     setUploadError('');

//     const form = e.currentTarget;
//     const identityProof = fileRefs.identityProof || (form.elements.namedItem('identityProof') as HTMLInputElement).files?.[0];
//     const addressProof = fileRefs.addressProof || (form.elements.namedItem('addressProof') as HTMLInputElement).files?.[0];
//     const offerLetter = fileRefs.offerLetter || (form.elements.namedItem('offerLetter') as HTMLInputElement).files?.[0];

//     console.log('Form submission - Files found:', {
//       identityProof: identityProof?.name,
//       addressProof: addressProof?.name,
//       offerLetter: offerLetter?.name
//     });

//     const maxFileSize = 5 * 1024 * 1024; // 5MB
//     const validTypes = ['application/pdf'];

//     const hasAllFiles = identityProof && addressProof && offerLetter;
    
//     if (!hasAllFiles) {
//       console.log('Missing files:', {
//         identityProof: !!identityProof,
//         addressProof: !!addressProof,
//         offerLetter: !!offerLetter
//       });
//       setUploadError('All files are required.');
//       setStatus('');
//       setIsUploading(false);
//       return;
//     }

//     for (const [key, file] of Object.entries({ identityProof, addressProof, offerLetter })) {
//       if (file.size > maxFileSize) {
//         setUploadError(`File ${file.name} exceeds 5MB limit.`);
//         setStatus('');
//         setIsUploading(false);
//         return;
//       }
//       if (!validTypes.includes(file.type)) {
//         setUploadError(`Invalid file type for ${key}. Only PDFs are allowed.`);
//         setStatus('');
//         setIsUploading(false);
//         return;
//       }
//       if (!file.name.startsWith(`${recordId}_`)) {
//         setUploadError(`File ${file.name} must start with record ID: ${recordId}_`);
//         setStatus('');
//         setIsUploading(false);
//         return;
//       }
//     }

//     const formData = new FormData();
//     formData.append('identityProof', identityProof);
//     formData.append('addressProof', addressProof);
//     formData.append('offerLetter', offerLetter);
//     formData.append('recordId', recordId);

//     try {
//       setStatus('Uploading...');
//       const response = await fetch('/api/upload', {
//         method: 'POST',
//         body: formData,
//       });

//       const responseText = await response.text();
//       let errorMessage = 'Upload failed';

//       if (!response.ok) {
//         try {
//           const errorData = JSON.parse(responseText);
//           errorMessage = errorData.error || errorMessage;
//         } catch {
//           errorMessage = responseText || 'An unexpected error occurred';
//         }
//         throw new Error(errorMessage);
//       }

//       const data = JSON.parse(responseText);
//       setStatus(data.message || 'Documents uploaded successfully! Your onboarding status has been updated.');
//     } catch (err: unknown) {
//       const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
//       console.error('Upload Error:', errorMessage);
//       setUploadError(errorMessage);
//       setStatus('');
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const FileUploadCard = ({ 
//     id, 
//     name, 
//     title, 
//     description, 
//     icon, 
//     fileName, 
//     onChange 
//   }: { 
//     id: string; 
//     name: string; 
//     title: string; 
//     description: string; 
//     icon: string; 
//     fileName: string; 
//     onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
//   }) => (
//     <div style={{
//       background: 'white',
//       borderRadius: '12px',
//       padding: '24px',
//       border: fileName ? '2px solid #10b981' : '2px dashed #e5e7eb',
//       transition: 'all 0.3s ease',
//       position: 'relative',
//       cursor: 'pointer',
//       boxShadow: fileName ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)'
//     }}>
//       <input
//         type="file"
//         id={id}
//         name={name}
//         accept="application/pdf"
//         required
//         onChange={onChange}
//         style={{
//           position: 'absolute',
//           top: 0,
//           left: 0,
//           width: '100%',
//           height: '100%',
//           opacity: 0,
//           cursor: 'pointer',
//           zIndex: 10
//         }}
//       />
      
//       <div style={{ textAlign: 'center' }}>
//         <div style={{
//           fontSize: '32px',
//           marginBottom: '12px',
//           filter: fileName ? 'none' : 'grayscale(1)',
//           transition: 'all 0.3s ease'
//         }}>
//           {fileName ? '✅' : icon}
//         </div>
        
//         <h3 style={{
//           color: fileName ? '#059669' : '#374151',
//           fontSize: '16px',
//           fontWeight: '600',
//           marginBottom: '6px'
//         }}>
//           {title}
//         </h3>
        
//         <p style={{
//           color: '#6b7280',
//           fontSize: '13px',
//           marginBottom: '12px',
//           lineHeight: '1.4'
//         }}>
//           {description}
//         </p>
        
//         {fileName ? (
//           <div style={{
//             background: '#ecfdf5',
//             border: '1px solid #d1fae5',
//             borderRadius: '8px',
//             padding: '8px 12px',
//             fontSize: '12px',
//             color: '#065f46'
//           }}>
//             📄 {fileName}
//           </div>
//         ) : (
//           <div style={{
//             background: '#f9fafb',
//             border: '1px solid #e5e7eb',
//             borderRadius: '8px',
//             padding: '8px 12px',
//             fontSize: '12px',
//             color: '#6b7280'
//           }}>
//             Click to select PDF file
//           </div>
//         )}
//       </div>
//     </div>
//   );

//   return (
//     <div style={{
//       minHeight: '100vh',
//       background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//       fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
//       position: 'relative'
//     }}>
//       {/* AI Verification Popup */}
//       {isUploading && (
//         <div style={{
//           position: 'fixed',
//           top: '50%',
//           left: '50%',
//           transform: 'translate(-50%, -50%)',
//           background: 'rgba(255, 255, 255, 0.95)',
//           borderRadius: '16px',
//           padding: '24px',
//           boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
//           zIndex: 1000,
//           width: '350px',
//           maxWidth: '90%',
//           backdropFilter: 'blur(10px)'
//         }}>
//           <div style={{
//             display: 'flex',
//             alignItems: 'center',
//             gap: '12px',
//             marginBottom: '20px'
//           }}>
//             <div style={{
//               width: '40px',
//               height: '40px',
//               background: 'linear-gradient(135deg, #667eea, #764ba2)',
//               borderRadius: '50%',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               color: 'white',
//               fontSize: '20px'
//             }}>
//               🤖
//             </div>
//             <h3 style={{
//               color: '#1f2937',
//               fontSize: '18px',
//               fontWeight: '600',
//               margin: 0
//             }}>
//               AI Document Verification
//             </h3>
//           </div>
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//             {[
//               { label: 'Identity Proof', icon: '🆔' },
//               { label: 'Address Proof', icon: '🏠' },
//               { label: 'Offer Letter', icon: '📝' }
//             ].map((item, index) => (
//               <div key={item.label} style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '12px',
//                 padding: '8px',
//                 borderRadius: '8px',
//                 background: aiVerificationStep > index ? '#ecfdf5' : '#f9fafb',
//                 border: aiVerificationStep > index ? '1px solid #d1fae5' : '1px solid #e5e7eb'
//               }}>
//                 <div style={{
//                   width: '24px',
//                   height: '24px',
//                   borderRadius: '50%',
//                   background: aiVerificationStep > index ? '#10b981' : '#e5e7eb',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   fontSize: '14px',
//                   color: 'white'
//                 }}>
//                   {aiVerificationStep > index ? '✓' : item.icon}
//                 </div>
//                 <span style={{
//                   fontSize: '14px',
//                   color: aiVerificationStep > index ? '#065f46' : '#6b7280',
//                   fontWeight: aiVerificationStep > index ? '600' : '500'
//                 }}>
//                   {item.label} {aiVerificationStep === index ? 'Verifying...' : aiVerificationStep > index ? 'Verified' : 'Pending'}
//                 </span>
//                 {aiVerificationStep === index && (
//                   <div style={{
//                     width: '16px',
//                     height: '16px',
//                     border: '2px solid rgba(16, 185, 129, 0.3)',
//                     borderTop: '2px solid #10b981',
//                     borderRadius: '50%',
//                     animation: 'spin 1s linear infinite'
//                   }}></div>
//                 )}
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Header */}
//       <div style={{
//         background: 'rgba(255,255,255,0.95)',
//         backdropFilter: 'blur(10px)',
//         borderBottom: '1px solid rgba(255,255,255,0.2)',
//         padding: '20px 0'
//       }}>
//         <div style={{
//           maxWidth: '800px',
//           margin: '0 auto',
//           padding: '0 20px',
//           display: 'flex',
//           alignItems: 'center',
//           gap: '16px'
//         }}>
//           <div style={{
//             width: '48px',
//             height: '48px',
//             background: 'linear-gradient(135deg, #667eea, #764ba2)',
//             borderRadius: '12px',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             color: 'white',
//             fontSize: '20px'
//           }}>
//             📋
//           </div>
//           <div>
//             <h1 style={{
//               color: '#1f2937',
//               fontSize: '24px',
//               fontWeight: '700',
//               margin: 0,
//               marginBottom: '4px'
//             }}>
//               Document Upload Portal
//             </h1>
//             <p style={{
//               color: '#6b7280',
//               fontSize: '14px',
//               margin: 0
//             }}>
//               Secure onboarding document submission
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div style={{ padding: '40px 20px' }}>
//         <div style={{
//           maxWidth: '800px',
//           margin: '0 auto'
//         }}>
//           {/* Welcome Card */}
//           <div style={{
//             background: 'white',
//             borderRadius: '16px',
//             padding: '32px',
//             marginBottom: '32px',
//             boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
//             textAlign: 'center'
//           }}>
//             <div style={{
//               width: '80px',
//               height: '80px',
//               background: 'linear-gradient(135deg, #10b981, #059669)',
//               borderRadius: '50%',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               margin: '0 auto 20px',
//               fontSize: '32px'
//             }}>
//               👋
//             </div>
//             <h2 style={{
//               color: '#1f2937',
//               fontSize: '28px',
//               fontWeight: '700',
//               marginBottom: '8px'
//             }}>
//               Welcome, {candidateName}!
//             </h2>
//             <p style={{
//               color: '#6b7280',
//               fontSize: '16px',
//               lineHeight: '1.6',
//               marginBottom: '20px'
//             }}>
//               You&apos;re almost done! Please upload the required documents below to complete your onboarding process.
//             </p>
//             <div style={{
//               display: 'inline-block',
//               background: 'linear-gradient(135deg, #667eea, #764ba2)',
//               color: 'white',
//               padding: '8px 16px',
//               borderRadius: '20px',
//               fontSize: '12px',
//               fontWeight: '500'
//             }}>
//               Record ID: {recordId}
//             </div>
//           </div>

//           {/* Upload Form */}
//           <form onSubmit={handleSubmit} noValidate>
//             <div style={{
//               display: 'grid',
//               gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
//               gap: '24px',
//               marginBottom: '32px'
//             }}>
//               <FileUploadCard
//                 id="identityProof"
//                 name="identityProof"
//                 title="Identity Proof"
//                 description="Driver&apos;s License, Passport, or Government ID"
//                 icon="🆔"
//                 fileName={fileNames.identityProof}
//                 onChange={e => handleFileChange(e, 'identityProof')}
//               />

//               <FileUploadCard
//                 id="addressProof"
//                 name="addressProof"
//                 title="Address Proof"
//                 description="Utility Bill, Bank Statement, or Lease Agreement"
//                 icon="🏠"
//                 fileName={fileNames.addressProof}
//                 onChange={e => handleFileChange(e, 'addressProof')}
//               />

//               <FileUploadCard
//                 id="offerLetter"
//                 name="offerLetter"
//                 title="Signed Offer Letter"
//                 description="Your signed employment offer letter"
//                 icon="📝"
//                 fileName={fileNames.offerLetter}
//                 onChange={e => handleFileChange(e, 'offerLetter')}
//               />
//             </div>

//             {/* Requirements */}
//             <div style={{
//               background: 'rgba(251, 191, 36, 0.1)',
//               border: '1px solid rgba(251, 191, 36, 0.3)',
//               borderRadius: '12px',
//               padding: '20px',
//               marginBottom: '32px'
//             }}>
//               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
//                 <div style={{ fontSize: '20px', marginTop: '2px' }}>💡</div>
//                 <div>
//                   <h4 style={{
//                     color: '#92400e',
//                     fontSize: '14px',
//                     fontWeight: '600',
//                     marginBottom: '8px'
//                   }}>
//                     File Requirements
//                   </h4>
//                   <ul style={{
//                     color: '#92400e',
//                     fontSize: '13px',
//                     lineHeight: '1.5',
//                     margin: 0,
//                     paddingLeft: '16px'
//                   }}>
//                     <li>All files must be in PDF format</li>
//                     <li>Maximum file size: 5MB per file</li>
//                     <li>File names must start with: <code style={{ 
//                       background: 'rgba(251, 191, 36, 0.2)', 
//                       padding: '2px 4px', 
//                       borderRadius: '4px',
//                       fontSize: '12px'
//                     }}>{recordId}_</code></li>
//                   </ul>
//                 </div>
//               </div>
//             </div>

//             {/* File Upload Progress */}
//             <div style={{
//               background: 'white',
//               borderRadius: '12px',
//               padding: '20px',
//               marginBottom: '24px',
//               boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
//               border: '1px solid #e5e7eb'
//             }}>
//               <h4 style={{
//                 color: '#374151',
//                 fontSize: '14px',
//                 fontWeight: '600',
//                 marginBottom: '16px',
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '8px'
//               }}>
//                 📊 Upload Progress
//               </h4>
//               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//                 {['identityProof', 'addressProof', 'offerLetter'].map((key, index) => {
//                   const labels = ['Identity Proof', 'Address Proof', 'Offer Letter'];
//                   const isSelected = fileNames[key as keyof typeof fileNames];
//                   return (
//                     <div key={key} style={{
//                       display: 'flex',
//                       alignItems: 'center',
//                       gap: '12px',
//                       padding: '8px 12px',
//                       background: isSelected ? '#ecfdf5' : '#f9fafb',
//                       borderRadius: '8px',
//                       border: isSelected ? '1px solid #d1fae5' : '1px solid #e5e7eb',
//                       transition: 'all 0.3s ease'
//                     }}>
//                       <div style={{
//                         width: '20px',
//                         height: '20px',
//                         borderRadius: '50%',
//                         background: isSelected ? '#10b981' : '#e5e7eb',
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'center',
//                         fontSize: '12px',
//                         color: 'white',
//                         fontWeight: '600'
//                       }}>
//                         {isSelected ? '✓' : index + 1}
//                       </div>
//                       <span style={{
//                         fontSize: '13px',
//                         color: isSelected ? '#065f46' : '#6b7280',
//                         fontWeight: isSelected ? '600' : '500',
//                         flex: 1
//                       }}>
//                         {labels[index]}
//                       </span>
//                       {isSelected && (
//                         <span style={{
//                           fontSize: '11px',
//                           color: '#059669',
//                           background: '#d1fae5',
//                           padding: '2px 6px',
//                           borderRadius: '4px',
//                           fontWeight: '500'
//                         }}>
//                           Ready
//                         </span>
//                       )}
//                     </div>
//                   );
//                 })}
//               </div>
              
//               {/* Overall Progress Bar */}
//               <div style={{ marginTop: '16px' }}>
//                 <div style={{
//                   background: '#f3f4f6',
//                   borderRadius: '8px',
//                   height: '8px',
//                   overflow: 'hidden'
//                 }}>
//                   <div style={{
//                     background: 'linear-gradient(135deg, #10b981, #059669)',
//                     height: '100%',
//                     borderRadius: '8px',
//                     width: `${(Object.values(fileNames).filter(name => name).length / 3) * 100}%`,
//                     transition: 'width 0.5s ease'
//                   }}></div>
//                 </div>
//                 <p style={{
//                   fontSize: '12px',
//                   color: '#6b7280',
//                   marginTop: '6px',
//                   textAlign: 'center'
//                 }}>
//                   {Object.values(fileNames).filter(name => name).length} of 3 files selected
//                 </p>
//               </div>
//             </div>

//             {/* Submit Button */}
//             <div style={{ textAlign: 'center' }}>
//               {Object.values(fileNames).filter(name => name).length === 3 ? (
//                 <div style={{
//                   background: 'rgba(16, 185, 129, 0.1)',
//                   border: '1px solid rgba(16, 185, 129, 0.3)',
//                   borderRadius: '12px',
//                   padding: '12px',
//                   marginBottom: '16px'
//                 }}>
//                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
//                     <div style={{ fontSize: '16px' }}>🎉</div>
//                     <span style={{
//                       color: '#065f46',
//                       fontSize: '13px',
//                       fontWeight: '500'
//                     }}>
//                       All files selected! Ready to upload.
//                     </span>
//                   </div>
//                 </div>
//               ) : (
//                 <div style={{
//                   background: 'rgba(251, 191, 36, 0.1)',
//                   border: '1px solid rgba(251, 191, 36, 0.3)',
//                   borderRadius: '12px',
//                   padding: '12px',
//                   marginBottom: '16px'
//                 }}>
//                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
//                     <div style={{ fontSize: '16px' }}>📝</div>
//                     <span style={{
//                       color: '#92400e',
//                       fontSize: '13px',
//                       fontWeight: '500'
//                     }}>
//                       Please select all {3 - Object.values(fileNames).filter(name => name).length} remaining file(s) to continue.
//                     </span>
//                   </div>
//                 </div>
//               )}
              
//               <button
//                 type="submit"
//                 disabled={isUploading}
//                 style={{
//                   background: isUploading
//                     ? '#9ca3af' 
//                     : 'linear-gradient(135deg, #10b981, #059669)',
//                   color: 'white',
//                   border: 'none',
//                   borderRadius: '12px',
//                   padding: '16px 32px',
//                   fontSize: '16px',
//                   fontWeight: '600',
//                   cursor: isUploading ? 'not-allowed' : 'pointer',
//                   boxShadow: isUploading
//                     ? 'none' 
//                     : '0 4px 12px rgba(16, 185, 129, 0.4)',
//                   transition: 'all 0.3s ease',
//                   transform: isUploading ? 'none' : 'translateY(0)',
//                   minWidth: '200px',
//                   opacity: isUploading ? 0.6 : 1
//                 }}
//                 onMouseOver={(e) => {
//                   if (!isUploading) {
//                     e.currentTarget.style.transform = 'translateY(-2px)';
//                     e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
//                   }
//                 }}
//                 onMouseOut={(e) => {
//                   if (!isUploading) {
//                     e.currentTarget.style.transform = 'translateY(0)';
//                     e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
//                   }
//                 }}
//               >
//                 {isUploading ? (
//                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
//                     <div style={{
//                       width: '16px',
//                       height: '16px',
//                       border: '2px solid rgba(255,255,255,0.3)',
//                       borderTop: '2px solid white',
//                       borderRadius: '50%',
//                       animation: 'spin 1s linear infinite'
//                     }}></div>
//                     Uploading...
//                   </div>
//                 ) : (
//                   <>🚀 Upload Documents</>
//                 )}
//               </button>
//             </div>
//           </form>

//           {/* Status Messages */}
//           {status && (
//             <div style={{
//               background: 'rgba(16, 185, 129, 0.1)',
//               border: '1px solid rgba(16, 185, 129, 0.3)',
//               borderRadius: '12px',
//               padding: '16px',
//               marginTop: '24px',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '12px'
//             }}>
//               <div style={{ fontSize: '20px' }}>✅</div>
//               <p style={{
//                 color: '#065f46',
//                 fontSize: '14px',
//                 fontWeight: '500',
//                 margin: 0
//               }}>
//                 {status}
//               </p>
//             </div>
//           )}

//           {uploadError && (
//             <div style={{
//               background: 'rgba(239, 68, 68, 0.1)',
//               border: '1px solid rgba(239, 68, 68, 0.3)',
//               borderRadius: '12px',
//               padding: '16px',
//               marginTop: '24px',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '12px'
//             }}>
//               <div style={{ fontSize: '20px' }}>❌</div>
//               <p style={{
//                 color: '#991b1b',
//                 fontSize: '14px',
//                 fontWeight: '500',
//                 margin: 0
//               }}>
//                 {uploadError}
//               </p>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Footer */}
//       <div style={{
//         textAlign: 'center',
//         padding: '20px',
//         color: 'rgba(255,255,255,0.7)',
//         fontSize: '12px'
//       }}>
//         Need help? Contact our support team for assistance with your document upload.
//       </div>

//       <style jsx>{`
//         @keyframes spin {
//           0% { transform: rotate(0deg); }
//           100% { transform: rotate(360deg); }
//         }
//       `}</style>
//     </div>
//   );
// }

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const { recordId } = context.params as { recordId: string };

//   if (!recordId.match(/^[a-zA-Z0-9]+$/)) {
//     return { props: { error: 'Invalid Record ID format' } };
//   }

//   try {
//     const response = await fetch(
//       `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
//         },
//       }
//     );

//     if (!response.ok) {
//       const errorText = await response.text();
//       throw new Error(`Airtable fetch failed: ${errorText || 'Record not found'}`);
//     }

//     const data = await response.json();
//     const candidateName = data.fields.Name || 'Candidate';

//     return { props: { candidateName, recordId } };
//   } catch (err) {
//     console.error('getServerSideProps Error:', err);
//     return { props: { error: 'Failed to load candidate details. Please check your Record ID.' } };
//   }
// };


