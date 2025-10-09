require('dotenv').config({ path: '.env.local' });

const WebSocket = require('ws');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const wss = new WebSocket.Server({ port: 8080 });
const sessions = new Map();
const realtimeConnections = new Map();

// Track conversation transcripts
const conversationLogs = new Map();

// Store document verification data per session
const documentKnowledge = new Map();
// When user's microphone detects voice activity

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  let sessionId = null;
  let useRealtimeAPI = true;
  let isProcessingVerification = false; // 🔥 NEW: Prevent overlapping responses

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Received message type:', data.type);

      if (data.type === 'start') {
        sessionId = data.recordId;
        
        sessions.set(sessionId, {
          currentStep: 'identity',
          candidateName: data.candidateName,
          ws: ws
        });

        // Initialize conversation log
        conversationLogs.set(sessionId, {
          candidate: data.candidateName,
          messages: [],
          startTime: new Date()
        });

        // Initialize document knowledge storage
        documentKnowledge.set(sessionId, {
          identity: null,
          address: null,
          offer: null,
          verificationAttempts: {
            identity: 0,
            address: 0,
            offer: 0
          }
        });

        console.log(`✅ Session created for ${data.candidateName} (${sessionId})`);

        // Try connecting to Realtime API
        try {
          const realtimeWs = new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
            {
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
              }
            }
          );

          let connectionTimeout = setTimeout(() => {
            console.log('⏱️ Realtime API connection timeout - using fallback');
            useRealtimeAPI = false;
            realtimeWs.close();
            sendFallbackGreeting(ws, data.candidateName, sessionId);
          }, 5000);

          realtimeConnections.set(sessionId, realtimeWs);

          realtimeWs.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('🔊 Connected to OpenAI Realtime API');
            useRealtimeAPI = true;
            
            const initialInstructions = buildInstructions(data.candidateName, 'identity', null);
            
            realtimeWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: initialInstructions,
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'whisper-1'
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                  create_response: true,
                  interrupt_response: true
                },
                temperature: 0.9
              }
            }));

            setTimeout(() => {
              realtimeWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{
                    type: 'input_text',
                    text: `Greet ${data.candidateName} warmly and ask them to upload their Identity Proof document (like a driver's license, passport, or government ID). Tell them they can also speak to you.`
                  }]
                }
              }));

              realtimeWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio']
                }
              }));
            }, 300);
          });

          realtimeWs.on('message', (msg) => {
            const event = JSON.parse(msg.toString());

            // 🔥 NEW: Only process audio when not handling verification
            if (event.type === 'response.audio.delta' && !isProcessingVerification) {
              ws.send(JSON.stringify({
                type: 'audio_delta',
                delta: event.delta
              }));
            }

            if (event.type === 'response.text.delta' && !isProcessingVerification) {
              ws.send(JSON.stringify({
                type: 'agent_transcript_delta',
                delta: event.delta
              }));
            }

            if (event.type === 'response.done') {
              const output = event.response.output || [];
              for (const item of output) {
                if (item.type === 'message') {
                  for (const content of item.content || []) {
                    if (content.type === 'text' && content.text) {
                      console.log('🤖 Agent:', content.text);
                      logMessage(sessionId, 'agent', content.text);
                      if (!isProcessingVerification) {
                        ws.send(JSON.stringify({
                          type: 'agent_message',
                          content: content.text
                        }));
                      }
                    }
                  }
                }
              }
            }

            // if (event.type === 'conversation.item.input_audio_transcription.completed') {
            //   console.log('👤 User:', event.transcript);
            //   logMessage(sessionId, 'user', event.transcript);
            //   ws.send(JSON.stringify({
            //     type: 'user_transcript',
            //     content: event.transcript
            //   }));
              
            //   const text = event.transcript.toLowerCase();
            //   if (text.includes('upload') || text.includes('ready') || text.includes('yes') || text.includes('start')) {
            //     ws.send(JSON.stringify({ type: 'trigger_upload' }));
            //   }
            // }

            if (event.type === 'conversation.item.input_audio_transcription.completed') {
              console.log('👤 User:', event.transcript);
              logMessage(sessionId, 'user', event.transcript);
              
              // 🔥 ALWAYS send user transcript regardless of verification state
              ws.send(JSON.stringify({
                type: 'user_transcript',
                content: event.transcript
              }));
              
              // Only trigger actions if not processing verification
              if (!isProcessingVerification) {
                const text = event.transcript.toLowerCase();
                if (text.includes('upload') || text.includes('ready') || text.includes('yes') || text.includes('start')) {
                  ws.send(JSON.stringify({ type: 'trigger_upload' }));
                }
              }
            }

          });

          realtimeWs.on('error', (error) => {
            console.error('❌ Realtime API error:', error.message);
            useRealtimeAPI = false;
            clearTimeout(connectionTimeout);
            sendFallbackGreeting(ws, data.candidateName, sessionId);
          });

          realtimeWs.on('close', () => {
            console.log('🔇 Realtime API disconnected');
            realtimeConnections.delete(sessionId);
          });

        } catch (realtimeError) {
          console.error('❌ Failed to connect to Realtime API:', realtimeError.message);
          useRealtimeAPI = false;
          sendFallbackGreeting(ws, data.candidateName, sessionId);
        }

      } else if (data.type === 'document_uploading') {
        // 🔥 NEW: Immediately stop voice agent when document is uploaded
        console.log('📤 Document upload detected - pausing voice agent');
        
        isProcessingVerification = true; // Block all audio immediately
        
        const realtimeWs = realtimeConnections.get(sessionId || data.recordId);
        
        if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN) {
          try {
            // Cancel any ongoing response immediately
            realtimeWs.send(JSON.stringify({
              type: 'response.cancel'
            }));
            console.log('🛑 Voice agent response cancelled - analyzing document...');
            
            // Clear the input audio buffer to prevent queued speech
            realtimeWs.send(JSON.stringify({
              type: 'input_audio_buffer.clear'
            }));
            console.log('🧹 Audio buffer cleared');
            
          } catch (err) {
            console.log('⚠️ Could not cancel response:', err.message);
          }
        }
        
        // Send acknowledgment to frontend
        ws.send(JSON.stringify({
          type: 'agent_message',
          content: '🔍 Analyzing your document...'
        }));

      } else if (data.type === 'audio_input') {
        const realtimeWs = realtimeConnections.get(sessionId || data.recordId);
        
        // 🔥 NEW: Only process audio input when not handling verification
        if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN && !isProcessingVerification) {
          realtimeWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: data.audio
          }));
        }

      } else if (data.type === 'audio_commit') {
        if (!useRealtimeAPI) {
          await processFallbackConversation(ws, sessionId, data.audioData);
        }

      } else if (data.type === 'verification_result') {
        // 🔥 CRITICAL: Set processing flag to prevent audio overlaps
        isProcessingVerification = true;
        
        const session = sessions.get(sessionId || data.recordId);
        if (!session) {
          console.error('❌ Session not found');
          isProcessingVerification = false;
          return;
        }

        const docKnowledge = documentKnowledge.get(sessionId || data.recordId);
        const realtimeWs = realtimeConnections.get(sessionId || data.recordId);
        
        // 🔥 NEW: Cancel any ongoing response before processing verification
        if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN) {
          try {
            realtimeWs.send(JSON.stringify({
              type: 'response.cancel'
            }));
            console.log('🛑 Cancelled ongoing response to prevent overlap');
          } catch (err) {
            console.log('⚠️ Could not cancel response:', err.message);
          }
        }
        
        // Track verification attempts
        if (docKnowledge) {
          docKnowledge.verificationAttempts[session.currentStep]++;
        }

        // Store the verification result (success or failure)
        if (docKnowledge && data.verificationData) {
          const attemptNumber = docKnowledge.verificationAttempts[session.currentStep];
          
          if (!docKnowledge[`${session.currentStep}_attempts`]) {
            docKnowledge[`${session.currentStep}_attempts`] = [];
          }
          
          docKnowledge[`${session.currentStep}_attempts`].push({
            attemptNumber,
            timestamp: new Date(),
            ...data.verificationData
          });

          console.log(`📝 Verification attempt #${attemptNumber} for ${session.currentStep}:`);
          console.log(JSON.stringify(data.verificationData, null, 2));
        }

        // 🔥 NEW: Check for NAME MISMATCH first (highest priority failure)
        if (data.verificationData.nameMatch === false) {
          console.log('❌ NAME VERIFICATION FAILED - Name mismatch detected');
          
          if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN) {
            const updatedInstructions = buildInstructions(
              session.candidateName,
              session.currentStep,
              documentKnowledge.get(sessionId || data.recordId)
            );

            realtimeWs.send(JSON.stringify({
              type: 'session.update',
              session: { instructions: updatedInstructions }
            }));

            let nameMismatchPrompt = `🚨 CRITICAL: NAME VERIFICATION FAILED for ${session.currentStep} document.\n\n`;
            nameMismatchPrompt += `Expected name: "${session.candidateName}"\n`;
            nameMismatchPrompt += `Name found on document: "${data.verificationData.extractedName}"\n\n`;
            nameMismatchPrompt += `This is a CRITICAL security issue. The document does not belong to ${session.candidateName}.\n\n`;
            
            if (data.verificationData.issues && data.verificationData.issues.length > 0) {
              nameMismatchPrompt += `Issues:\n`;
              data.verificationData.issues.forEach((issue, i) => {
                nameMismatchPrompt += `${i + 1}. ${issue}\n`;
              });
            }

            nameMismatchPrompt += `\n\nEXPLAIN TO ${session.candidateName}: "I'm sorry, but I cannot verify this document. The name on the document does not match your registered name '${session.candidateName}'. Please upload a document that has YOUR name on it. This is required for security and compliance purposes."`;

            await new Promise(resolve => setTimeout(resolve, 300));

            realtimeWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: nameMismatchPrompt }]
              }
            }));

            realtimeWs.send(JSON.stringify({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            }));

            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            const nameMismatchMessage = `I'm sorry, but the name on the ${session.currentStep} document does not match your registered name "${session.candidateName}". The document shows "${data.verificationData.extractedName}". Please upload a document with YOUR name on it.`;
            await sendFallbackResponse(ws, sessionId, nameMismatchMessage);
          }

          isProcessingVerification = false;
          return;
        }

        // Check if verification FAILED (other reasons)
        if (!data.verificationData.isValid || data.verificationData.confidence < 0.7) {
          console.log('❌ Document verification FAILED');
          
          // Update AI with failure information
          if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN) {
            // First, update instructions with all knowledge
            const updatedInstructions = buildInstructions(
              session.candidateName,
              session.currentStep,
              documentKnowledge.get(sessionId || data.recordId)
            );

            realtimeWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: updatedInstructions
              }
            }));

            // Build detailed failure message
            let failurePrompt = `IMPORTANT: The ${session.currentStep} document verification just FAILED. `;
            failurePrompt += `Confidence score: ${(data.verificationData.confidence * 100).toFixed(0)}%. `;
            
            if (data.verificationData.issues && data.verificationData.issues.length > 0) {
              failurePrompt += `\n\nIssues found:\n`;
              data.verificationData.issues.forEach((issue, i) => {
                failurePrompt += `${i + 1}. ${issue}\n`;
              });
            }
            
            if (data.verificationData.aiAnalysis) {
              failurePrompt += `\n\nAI Analysis: ${data.verificationData.aiAnalysis}\n`;
            }

            failurePrompt += `\n\nPlease explain these issues to ${session.candidateName} in a friendly way and ask them to upload a CORRECT ${session.currentStep} document. Be specific about what was wrong.`;

            // Wait a moment for session update to process
            await new Promise(resolve => setTimeout(resolve, 300));

            realtimeWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: failurePrompt }]
              }
            }));

            realtimeWs.send(JSON.stringify({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            }));

            // Wait for response to complete before allowing more audio
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // Fallback mode
            const failureMessage = `I'm sorry, but the ${session.currentStep} document verification failed. ${data.verificationData.aiAnalysis} Please upload a clearer and correct document.`;
            await sendFallbackResponse(ws, sessionId, failureMessage);
          }

          // 🔥 Reset processing flag after handling failure
          isProcessingVerification = false;

        } else {
          // ✅ Verification SUCCESS
          console.log('✅ Document verification SUCCESSFUL');
          
          // Store successful verification
          if (docKnowledge) {
            docKnowledge[session.currentStep] = data.verificationData;
          }

          let nextStep, promptText;

          // Build success prompts with extracted data
          if (session.currentStep === 'identity') {
            nextStep = 'address';
            const identityInfo = data.verificationData.extractedData || {};
            
            promptText = `Excellent! The identity document was successfully verified with ${(data.verificationData.confidence * 100).toFixed(0)}% confidence. `;
            
            if (identityInfo.name) {
              promptText += `I confirmed the name as ${identityInfo.name}. `;
            }
            if (identityInfo.idNumber) {
              promptText += `ID number ${identityInfo.idNumber} was verified. `;
            }
            
            promptText += `Congratulate ${session.candidateName} warmly and ask them to upload their Address Proof next (like a utility bill, bank statement, or lease agreement).`;
            
          } else if (session.currentStep === 'address') {
            nextStep = 'offer';
            const addressInfo = data.verificationData.extractedData || {};
            
            promptText = `Great! The address proof was verified with ${(data.verificationData.confidence * 100).toFixed(0)}% confidence. `;
            
            if (addressInfo.address) {
              promptText += `I confirmed the address as ${addressInfo.address}. `;
            }
            if (addressInfo.name) {
              promptText += `Name on document: ${addressInfo.name}. `;
            }
            
            promptText += `Congratulate ${session.candidateName} and ask them to upload their signed Offer Letter as the final step.`;
            
          } else if (session.currentStep === 'offer') {
            nextStep = 'complete';
            const offerInfo = data.verificationData.extractedData || {};
            
            promptText = `Perfect! All documents are verified! The offer letter was verified with ${(data.verificationData.confidence * 100).toFixed(0)}% confidence. `;
            
            if (offerInfo.position) {
              promptText += `Position: ${offerInfo.position}. `;
            }
            if (offerInfo.companyName) {
              promptText += `Company: ${offerInfo.companyName}. `;
            }
            
            promptText += `Congratulate ${session.candidateName} enthusiastically and tell them their preboarding is complete. Mention they will be contacted by HR within 24 hours.`;
          }

          if (nextStep) {
            session.currentStep = nextStep;

            if (useRealtimeAPI && realtimeWs?.readyState === WebSocket.OPEN) {
              // Update session instructions with all document knowledge
              const updatedInstructions = buildInstructions(
                session.candidateName,
                nextStep,
                documentKnowledge.get(sessionId || data.recordId)
              );

              realtimeWs.send(JSON.stringify({
                type: 'session.update',
                session: {
                  instructions: updatedInstructions
                }
              }));

              // Wait for session update
              await new Promise(resolve => setTimeout(resolve, 300));

              // Send the progression prompt
              realtimeWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: promptText }]
                }
              }));

              realtimeWs.send(JSON.stringify({
                type: 'response.create',
                response: { modalities: ['text', 'audio'] }
              }));

              // Wait for response to complete
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              await sendFallbackResponse(ws, sessionId, promptText);
            }

            ws.send(JSON.stringify({ type: 'step_update', step: nextStep }));
            
            if (nextStep === 'complete') {
              ws.send(JSON.stringify({ type: 'complete' }));
              printConversationLog(sessionId);
              printDocumentSummary(sessionId);
            }
          }

          // 🔥 Reset processing flag after success
          isProcessingVerification = false;
        }
      }
    } catch (error) {
      console.error('❌ Error:', error);
      isProcessingVerification = false; // 🔥 Reset on error
      ws.send(JSON.stringify({ 
        type: 'agent_message', 
        content: `Error: ${error.message}` 
      }));
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    if (sessionId) {
      const realtimeWs = realtimeConnections.get(sessionId);
      if (realtimeWs) {
        realtimeWs.close();
        realtimeConnections.delete(sessionId);
      }
      printConversationLog(sessionId);
      printDocumentSummary(sessionId);
      sessions.delete(sessionId);
      documentKnowledge.delete(sessionId);
    }
  });
});

// Build dynamic instructions with document knowledge
function buildInstructions(candidateName, currentStep, docKnowledge) {
  let instructions = `You are a friendly and professional document verification assistant helping ${candidateName} with their onboarding process. `;
  
  instructions += `\n\n🔐 CRITICAL SECURITY RULE: ALL documents MUST have "${candidateName}" as the name. If any document shows a different name, it MUST be rejected immediately for security compliance.\n`;
  
  // Add document knowledge context if available
  if (docKnowledge) {
    instructions += '\n\n=== VERIFIED DOCUMENT INFORMATION ===\n';
    
    // Show successful verifications
    if (docKnowledge.identity) {
      instructions += '\n📋 IDENTITY DOCUMENT (✅ VERIFIED):\n';
      const identity = docKnowledge.identity.extractedData || {};
      if (identity.name) instructions += `  • Full Name: ${identity.name}\n`;
      if (identity.idNumber) instructions += `  • ID Number: ${identity.idNumber}\n`;
      if (identity.dateOfBirth) instructions += `  • Date of Birth: ${identity.dateOfBirth}\n`;
      if (identity.expiryDate) instructions += `  • Expiry Date: ${identity.expiryDate}\n`;
      if (docKnowledge.identity.confidence) {
        instructions += `  • Verification Confidence: ${(docKnowledge.identity.confidence * 100).toFixed(0)}%\n`;
      }
    }
    
    if (docKnowledge.address) {
      instructions += '\n🏠 ADDRESS DOCUMENT (✅ VERIFIED):\n';
      const address = docKnowledge.address.extractedData || {};
      if (address.name) instructions += `  • Name on Document: ${address.name}\n`;
      if (address.address) instructions += `  • Address: ${address.address}\n`;
      if (address.issueDate) instructions += `  • Issue Date: ${address.issueDate}\n`;
      if (docKnowledge.address.confidence) {
        instructions += `  • Verification Confidence: ${(docKnowledge.address.confidence * 100).toFixed(0)}%\n`;
      }
    }
    
    if (docKnowledge.offer) {
      instructions += '\n💼 OFFER LETTER (✅ VERIFIED):\n';
      const offer = docKnowledge.offer.extractedData || {};
      if (offer.companyName) instructions += `  • Company: ${offer.companyName}\n`;
      if (offer.position) instructions += `  • Position: ${offer.position}\n`;
      if (offer.name) instructions += `  • Candidate Name: ${offer.name}\n`;
      if (docKnowledge.offer.confidence) {
        instructions += `  • Verification Confidence: ${(docKnowledge.offer.confidence * 100).toFixed(0)}%\n`;
      }
    }

    // Show failed verification attempts if any
    const attemptKeys = ['identity_attempts', 'address_attempts', 'offer_attempts'];
    let hasFailedAttempts = false;
    
    attemptKeys.forEach(key => {
      if (docKnowledge[key] && docKnowledge[key].length > 0) {
        const failedAttempts = docKnowledge[key].filter(a => !a.isValid || a.confidence < 0.7);
        if (failedAttempts.length > 0) {
          hasFailedAttempts = true;
          const docType = key.replace('_attempts', '').toUpperCase();
          instructions += `\n⚠️ ${docType} - FAILED ATTEMPTS (${failedAttempts.length}):\n`;
          
          failedAttempts.forEach((attempt, i) => {
            instructions += `  Attempt #${attempt.attemptNumber}:\n`;
            instructions += `    • Confidence: ${(attempt.confidence * 100).toFixed(0)}%\n`;
            if (attempt.issues && attempt.issues.length > 0) {
              instructions += `    • Issues: ${attempt.issues.join(', ')}\n`;
            }
            if (attempt.aiAnalysis) {
              instructions += `    • Analysis: ${attempt.aiAnalysis}\n`;
            }
          });
        }
      }
    });
    
    instructions += '\n=== END OF DOCUMENT INFORMATION ===\n\n';
    
    if (hasFailedAttempts) {
      instructions += '⚠️ IMPORTANT: When discussing failed verification attempts, explain the specific issues clearly and guide the user on what needs to be corrected.\n\n';
    }
    
    instructions += 'IMPORTANT: You have access to all the verified information above, including any failed attempts. When the candidate asks questions about their documents or if verification fails, provide EXACT and SPECIFIC information from the data above.\n\n';
  }
  
  instructions += `\n🎯 CURRENT STEP: ${currentStep.toUpperCase()}\n`;
  
  // Add step-specific instructions
  const stepInstructions = {
    identity: '👤 Guide them to upload their Identity Proof (Driver\'s License, Passport, or Government ID). This must include a photo, full name, and ID number. The document should be clear, not blurry, and all text must be readable.',
    address: '🏠 Guide them to upload their Address Proof (Utility Bill, Bank Statement, or Lease Agreement). This must show their complete residential address with the candidate\'s name. The document should be recent (within 3 months) and clearly readable.',
    offer: '💼 Guide them to upload their signed Offer Letter from the company. This should include the position, company name, candidate name, and signature. All text must be clearly visible.',
    complete: '✅ All documents have been successfully verified! Congratulate them warmly on completing the preboarding process.'
  };
  
  instructions += stepInstructions[currentStep] || '';
  instructions += '\n\n📝 CONVERSATION STYLE:\n';
  instructions += '• Be warm, friendly, and encouraging\n';
  instructions += '• Keep responses concise (under 3 sentences) unless answering specific questions or explaining verification failures\n';
  instructions += '• 🔐 NAME MISMATCH: If a document has the wrong name, be firm but polite: "For security reasons, I cannot accept documents with a different name. Please upload a document that shows YOUR name."\n';
  instructions += '• When verification FAILS for other reasons, be empathetic but clear about the issues\n';
  instructions += '• Explain specifically what was wrong with failed documents (e.g., "The text was too blurry", "ID number was not visible", "Document appears to be expired")\n';
  instructions += '• Guide users on how to take better photos or provide correct documents\n';
  instructions += '• When users ask about their verified information, provide complete and accurate details\n';
  instructions += '• Celebrate their progress after each successful verification\n';
  
  return instructions;
}

// Helper: Log messages
function logMessage(sessionId, speaker, text) {
  const log = conversationLogs.get(sessionId);
  if (log) {
    log.messages.push({
      speaker,
      text,
      timestamp: new Date()
    });
  }
}

// Helper: Print conversation log
function printConversationLog(sessionId) {
  const log = conversationLogs.get(sessionId);
  if (!log) return;

  console.log('\n========== CONVERSATION TRANSCRIPT ==========');
  console.log(`Candidate: ${log.candidate}`);
  console.log(`Started: ${log.startTime.toLocaleString()}`);
  console.log('=============================================\n');

  log.messages.forEach((msg, i) => {
    const speaker = msg.speaker === 'agent' ? '🤖 AGENT' : '👤 USER';
    console.log(`[${msg.timestamp.toLocaleTimeString()}] ${speaker}:`);
    console.log(`   ${msg.text}\n`);
  });

  console.log('=============================================\n');
  conversationLogs.delete(sessionId);
}

// Print document summary
function printDocumentSummary(sessionId) {
  const docKnowledge = documentKnowledge.get(sessionId);
  if (!docKnowledge) return;

  console.log('\n========== DOCUMENT VERIFICATION SUMMARY ==========');
  
  // Show verification attempts
  console.log('\n📊 VERIFICATION ATTEMPTS:');
  console.log(`  Identity: ${docKnowledge.verificationAttempts.identity} attempts`);
  console.log(`  Address: ${docKnowledge.verificationAttempts.address} attempts`);
  console.log(`  Offer: ${docKnowledge.verificationAttempts.offer} attempts`);
  
  if (docKnowledge.identity) {
    console.log('\n📋 IDENTITY DOCUMENT (VERIFIED):');
    console.log(JSON.stringify(docKnowledge.identity, null, 2));
  }
  
  if (docKnowledge.address) {
    console.log('\n🏠 ADDRESS DOCUMENT (VERIFIED):');
    console.log(JSON.stringify(docKnowledge.address, null, 2));
  }
  
  if (docKnowledge.offer) {
    console.log('\n💼 OFFER LETTER (VERIFIED):');
    console.log(JSON.stringify(docKnowledge.offer, null, 2));
  }

  // Show failed attempts
  ['identity_attempts', 'address_attempts', 'offer_attempts'].forEach(key => {
    if (docKnowledge[key] && docKnowledge[key].length > 0) {
      const docType = key.replace('_attempts', '').toUpperCase();
      console.log(`\n⚠️ ${docType} - ALL ATTEMPTS (${docKnowledge[key].length}):`);
      docKnowledge[key].forEach(attempt => {
        console.log(`  Attempt #${attempt.attemptNumber} [${attempt.isValid ? '✅ PASSED' : '❌ FAILED'}]:`);
        console.log(`    Confidence: ${(attempt.confidence * 100).toFixed(0)}%`);
        if (attempt.issues) console.log(`    Issues: ${attempt.issues.join(', ')}`);
      });
    }
  });
  
  console.log('\n===================================================\n');
}

// Helper: Send fallback greeting using standard TTS
async function sendFallbackGreeting(ws, candidateName, sessionId) {
  const greetingText = `Hello ${candidateName}! I'm your document verification assistant. Let's get started with your onboarding. Please upload your Identity Proof, such as a driver's license, passport, or government ID. You can also speak to me.`;
  
  console.log('🤖 Agent (fallback):', greetingText);
  logMessage(sessionId, 'agent', greetingText);

  ws.send(JSON.stringify({
    type: 'agent_message',
    content: greetingText
  }));

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: greetingText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    ws.send(JSON.stringify({
      type: 'audio_complete',
      audio: base64Audio,
      format: 'mp3'
    }));
  } catch (err) {
    console.error('TTS error:', err.message);
  }
}

// Helper: Send fallback response
async function sendFallbackResponse(ws, sessionId, promptText) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a friendly document verification assistant. Be concise and warm.' },
        { role: 'user', content: promptText }
      ],
      max_tokens: 150
    });

    const responseText = completion.choices[0].message.content;
    
    console.log('🤖 Agent (fallback):', responseText);
    logMessage(sessionId, 'agent', responseText);

    ws.send(JSON.stringify({
      type: 'agent_message',
      content: responseText
    }));

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: responseText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    ws.send(JSON.stringify({
      type: 'audio_complete',
      audio: base64Audio,
      format: 'mp3'
    }));
  } catch (err) {
    console.error('Fallback response error:', err.message);
  }
}

console.log('🚀 WebSocket server running on ws://localhost:8080');
console.log('💡 Waiting for connections...');
