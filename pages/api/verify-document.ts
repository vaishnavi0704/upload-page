

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import pdf from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';

// 🔥 NEW: Helper function to check if names match
function namesMatch(candidateName: string, extractedName: string): boolean {
  if (!candidateName || !extractedName) return false;

  // Normalize both names: lowercase, remove extra spaces, special characters
  const normalize = (name: string) => 
    name.toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove non-alphabetic characters
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim();

  const normalizedCandidate = normalize(candidateName);
  const normalizedExtracted = normalize(extractedName);

  // Direct match
  if (normalizedCandidate === normalizedExtracted) return true;

  // Split names into parts
  const candidateParts = normalizedCandidate.split(' ').filter(p => p.length > 0);
  const extractedParts = normalizedExtracted.split(' ').filter(p => p.length > 0);

  // Check if all candidate name parts exist in extracted name
  const allPartsMatch = candidateParts.every(part => 
    extractedParts.some(extractedPart => 
      extractedPart.includes(part) || part.includes(extractedPart)
    )
  );

  if (allPartsMatch && candidateParts.length >= 2) return true;

  // Check for partial match (at least first and last name)
  if (candidateParts.length >= 2 && extractedParts.length >= 2) {
    const firstNameMatch = candidateParts[0] === extractedParts[0] || 
                          candidateParts[0].includes(extractedParts[0]) ||
                          extractedParts[0].includes(candidateParts[0]);
    
    const lastNameMatch = candidateParts[candidateParts.length - 1] === extractedParts[extractedParts.length - 1] ||
                         candidateParts[candidateParts.length - 1].includes(extractedParts[extractedParts.length - 1]) ||
                         extractedParts[extractedParts.length - 1].includes(candidateParts[candidateParts.length - 1]);
    
    if (firstNameMatch && lastNameMatch) return true;
  }

  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, fileName, fileType, documentType, candidateName } = req.body; // 🔥 NEW: candidateName

    if (!fileData || !documentType) {
      return res.status(400).json({ error: 'Missing fileData or documentType' });
    }

    if (!candidateName) {
      return res.status(400).json({ error: 'Missing candidateName for verification' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let base64Data = fileData;
    if (fileData.includes('base64,')) {
      base64Data = fileData.split('base64,')[1];
    }

    const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

    console.log(`📄 Verifying ${documentType} for ${candidateName} - ${fileName} (PDF: ${isPDF})`);

    if (isPDF) {
      const buffer = Buffer.from(base64Data, 'base64');
      
      let extractedText = '';
      try {
        const data = await pdf(buffer);
        extractedText = data.text.trim();
        console.log(`📝 PDF text extracted: ${extractedText.length} chars`);
      } catch (err: any) {
        console.log(`⚠️ Text extraction failed: ${err.message}`);
      }

      if (extractedText.length >= 100) {
        console.log('✅ Using extracted text for verification');
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Analyze this ${documentType} document text and verify it.

🔥 CRITICAL: The candidate's registered name is "${candidateName}". You MUST verify that this name appears on the document.

Return ONLY valid JSON:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "extractedData": {
    "name": "EXACT full name as it appears on document",
    "idNumber": "ID number if found",
    "address": "address if found",
    "dateOfBirth": "DOB if found"
  },
  "issues": ["list any issues"],
  "aiAnalysis": "brief analysis",
  "nameMatch": boolean (true if name matches "${candidateName}", false otherwise),
  "extractedName": "The exact name found on the document"
}

NAME VERIFICATION RULES:
- Compare the extracted name with "${candidateName}"
- Allow for minor variations (middle names, initials, order)
- Set nameMatch to FALSE if the name is completely different
- If nameMatch is FALSE, set isValid to FALSE regardless of other factors
- Add "Name does not match candidate: ${candidateName}" to issues array

For ${documentType} documents:
- Identity: Must contain name matching "${candidateName}", ID number, or photo reference
- Address: Must contain name matching "${candidateName}" and complete address  
- Offer: Must contain company name, position, and candidate name matching "${candidateName}"

Set isValid to TRUE only if:
1. The name matches "${candidateName}"
2. The document contains relevant ${documentType} information
3. The document is clear and readable

Set confidence 0.85-0.95 for clear PDFs with complete information.`,
            },
            {
              role: 'user',
              content: `Verify this ${documentType} document for candidate "${candidateName}":\n\n${extractedText.substring(0, 4000)}`,
            },
          ],
          max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          return res.status(500).json({ error: 'No response from OpenAI' });
        }

        const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
        const result = JSON.parse(cleaned);

        // 🔥 NEW: Double-check name matching on backend
        if (result.extractedName) {
          const backendNameMatch = namesMatch(candidateName, result.extractedName);
          
          if (!backendNameMatch) {
            result.nameMatch = false;
            result.isValid = false;
            result.confidence = Math.min(result.confidence, 0.5);
            
            if (!result.issues) result.issues = [];
            if (!result.issues.includes(`Name mismatch: Expected "${candidateName}", found "${result.extractedName}"`)) {
              result.issues.unshift(`Name mismatch: Expected "${candidateName}", found "${result.extractedName}"`);
            }
            
            result.aiAnalysis = `NAME MISMATCH: Document shows "${result.extractedName}" but candidate is registered as "${candidateName}". ` + result.aiAnalysis;
          }
        }

        console.log(`✅ PDF verification: ${result.isValid ? 'VALID' : 'INVALID'} | Name Match: ${result.nameMatch} (confidence: ${result.confidence})`);
        return res.status(200).json(result);
      }

      // Scanned PDF handling (same as before but with name check)
      console.log('📸 PDF appears to be scanned/image-based...');
      
      return res.status(200).json({
        isValid: false,
        confidence: 0.2,
        extractedData: {},
        issues: [
          'Scanned PDF detected.',
          'Please upload as IMAGE (JPG/PNG/WebP) for better verification.'
        ],
        aiAnalysis: 'Scanned PDF requires image format for OCR processing.',
        nameMatch: false,
        extractedName: ''
      });
    }

    // Handle image files (JPG, PNG, WebP)
    console.log('🖼️ Processing image file with Vision API');

    const prompts: Record<string, string> = {
      identity: `Analyze this identity document image carefully.

🔥 CRITICAL: The candidate's registered name is "${candidateName}". You MUST verify this name appears on the document.

Return ONLY valid JSON:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "extractedData": {
    "name": "EXACT full name from document",
    "idNumber": "ID number",
    "dateOfBirth": "DOB",
    "expiryDate": "expiry date"
  },
  "issues": ["issues list"],
  "aiAnalysis": "brief analysis",
  "nameMatch": boolean (does name match "${candidateName}"?),
  "extractedName": "exact name from document"
}

NAME VERIFICATION:
- Compare extracted name with "${candidateName}"
- If names don't match, set nameMatch=false and isValid=false
- Add name mismatch to issues array

Set isValid to TRUE only if: name matches "${candidateName}" AND image shows photo, name, ID number.
Confidence: 0.9+ for excellent quality, 0.8+ for good, 0.7+ for acceptable.`,

      address: `Analyze this address proof image carefully.

🔥 CRITICAL: Candidate name is "${candidateName}". Verify this name is on the document.

Return ONLY valid JSON with: isValid, confidence, extractedData (name, address, issueDate), issues, aiAnalysis, nameMatch (boolean), extractedName.

Set isValid to TRUE only if: name matches "${candidateName}" AND readable complete address shown.`,

      offer: `Analyze this offer letter image carefully.

🔥 CRITICAL: Candidate name is "${candidateName}". Verify this name is on the letter.

Return ONLY valid JSON with: isValid, confidence, extractedData (name, companyName, position), issues, aiAnalysis, nameMatch (boolean), extractedName.

Set isValid to TRUE only if: name matches "${candidateName}" AND shows company info, position.`,
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: prompts[documentType] || prompts.identity,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Verify this ${documentType} document for candidate "${candidateName}"` },
            {
              type: 'image_url',
              image_url: { 
                url: `data:${fileType};base64,${base64Data}`,
                detail: 'high'
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // 🔥 NEW: Backend name verification as final check
    if (result.extractedName) {
      const backendNameMatch = namesMatch(candidateName, result.extractedName);
      
      if (!backendNameMatch) {
        result.nameMatch = false;
        result.isValid = false;
        result.confidence = Math.min(result.confidence, 0.5);
        
        if (!result.issues) result.issues = [];
        if (!result.issues.includes(`Name mismatch: Expected "${candidateName}", found "${result.extractedName}"`)) {
          result.issues.unshift(`❌ CRITICAL: Name mismatch - Expected "${candidateName}", found "${result.extractedName}"`);
        }
        
        result.aiAnalysis = `NAME VERIFICATION FAILED: Document shows "${result.extractedName}" but you are registered as "${candidateName}". Please upload a document with YOUR name.`;
      }
    } else {
      // No name extracted at all
      result.nameMatch = false;
      result.isValid = false;
      result.confidence = Math.min(result.confidence, 0.4);
      result.issues = result.issues || [];
      result.issues.unshift('❌ No name found on document');
      result.aiAnalysis = 'Unable to extract name from document. ' + result.aiAnalysis;
      result.extractedName = 'Not found';
    }

    console.log(`✅ Image verification: ${result.isValid ? 'VALID' : 'INVALID'} | Name Match: ${result.nameMatch} (confidence: ${result.confidence})`);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('❌ Verification error:', error.message);
    return res.status(500).json({ 
      error: error.message || 'Verification failed',
      isValid: false,
      confidence: 0,
      issues: ['An error occurred during verification. Please try again.'],
      aiAnalysis: `Error: ${error.message}`,
      nameMatch: false,
      extractedName: ''
    });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};
