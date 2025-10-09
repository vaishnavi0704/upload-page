import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Fields, Files } from 'formidable';
import fs from 'fs';
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

interface ResponseData {
  success?: boolean;
  url?: string;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await new Promise<[Fields, Files]>(
      (resolve, reject) => form.parse(req, (err, f, files) => (err ? reject(err) : resolve([f, files])))
    );

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const documentType = Array.isArray(fields.documentType) ? fields.documentType[0] : fields.documentType;
    const recordId = Array.isArray(fields.recordId) ? fields.recordId[0] : fields.recordId;

    if (!file || !documentType || !recordId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Uploading ${documentType} to Blob for record ${recordId}`);

    const airtableToken = process.env.AIRTABLE_TOKEN;
    if (!airtableToken) {
      console.error('AIRTABLE_TOKEN is not set');
      return res.status(500).json({ error: 'Airtable not configured. Check AIRTABLE_TOKEN.' });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const filename = `${recordId}_${documentType}_${Date.now()}_${file.originalFilename?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'file'}`;
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    console.log('Blob URL:', blob.url);

    const fieldIds: Record<string, string> = {
      identity: 'fldfBioSTVdXUeaNr',
      address: 'fldFx6Do3NigG9Inl',
      offer: 'fldoyXqUuC2AFAfqO',
    };

    const fieldId = fieldIds[documentType];
    if (!fieldId) {
      throw new Error(`Invalid document type: ${documentType}`);
    }

    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/appMvECrw7CrJFCO0/tblqaH9RrTO6JuG5N/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${airtableToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [fieldId]: [{ url: blob.url, filename: file.originalFilename }],
          },
        }),
      }
    );

    const airtableResponseText = await airtableResponse.text();
    console.log(`Airtable Response Status: ${airtableResponse.status}`);
    console.log(`Airtable Response Body: ${airtableResponseText}`);

    if (!airtableResponse.ok) {
      let errorMessage = `Airtable API error (${airtableResponse.status}): ${airtableResponseText}`;
      try {
        const errorData = JSON.parse(airtableResponseText) as { error?: string };
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Keep default error message
      }
      throw new Error(errorMessage);
    }

    fs.unlinkSync(file.filepath);
    console.log(`Success! Updated Airtable field ${fieldId} for record ${recordId}`);
    return res.status(200).json({ success: true, url: blob.url });

  } catch (error) {
    const err = error as Error;
    console.error('Upload Error:', err.message, err.stack);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
// import type { NextApiRequest, NextApiResponse } from 'next';
// import formidable from 'formidable';
// import fs from 'fs/promises';
// import path from 'path';
// import { put } from '@vercel/blob';
// import os from 'os';

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   console.log('=== Upload API Called ===');
//   console.log('Method:', req.method);
//   console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
//   if (req.method !== 'POST') {
//     console.log('❌ Method not allowed:', req.method);
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const filesToDelete: string[] = [];

//   try {
//     // ✅ Check environment variables first
//     console.log('🔍 Checking environment variables...');
//     const requiredEnvVars = [
//       'BLOB_READ_WRITE_TOKEN',
//       'AIRTABLE_TOKEN',
//       'AIRTABLE_BASE_ID',
//       'AIRTABLE_TABLE_ID',
//       'AIRTABLE_IDENTITY_PROOF_FIELD_ID',
//       'AIRTABLE_ADDRESS_PROOF_FIELD_ID',
//       'AIRTABLE_OFFER_LETTER_FIELD_ID',
//     ];
    
//     const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
//     if (missingEnvVars.length > 0) {
//       console.error('❌ Missing environment variables:', missingEnvVars);
//       return res.status(500).json({ 
//         error: 'Server configuration error',
//         details: `Missing environment variables: ${missingEnvVars.join(', ')}`
//       });
//     }
//     console.log('✅ All environment variables present');

//     // ✅ Use OS temp directory for Vercel compatibility
//     const uploadDir = path.join(os.tmpdir(), 'uploads');
//     console.log('📁 Upload directory:', uploadDir);
    
//     try {
//       await fs.mkdir(uploadDir, { recursive: true });
//       console.log('✅ Upload directory created/verified');
//     } catch (dirError) {
//       console.error('❌ Failed to create upload directory:', dirError);
//       return res.status(500).json({ error: 'Failed to create upload directory' });
//     }

//     // ✅ Configure formidable with better error handling
//     const form = formidable({ 
//       multiples: true, 
//       uploadDir,
//       maxFileSize: 10 * 1024 * 1024, // 10MB limit
//       keepExtensions: true,
//       allowEmptyFiles: false,
//     });

//     console.log('📋 Parsing form data...');
    
//     // ✅ Parse form with better error handling
//     const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
//       form.parse(req, (err, fields, files) => {
//         if (err) {
//           console.error('❌ Form parsing error:', err);
//           reject(new Error(`Form parsing failed: ${err.message}`));
//         } else {
//           console.log('✅ Form parsed successfully');
//           console.log('Fields received:', Object.keys(fields));
//           console.log('Files received:', Object.keys(files));
//           resolve([fields, files]);
//         }
//       });
//     });

//     // ✅ Extract recordId with better validation
//     const recordId = Array.isArray(fields.recordId) ? fields.recordId[0] : fields.recordId;
//     console.log('📝 Record ID:', recordId);
    
//     if (!recordId || typeof recordId !== 'string') {
//       console.error('❌ Invalid recordId:', recordId);
//       return res.status(400).json({ error: 'Missing or invalid recordId in form data' });
//     }

//     // ✅ Validate all required files
//     const fileKeys = ['identityProof', 'addressProof', 'offerLetter'];
//     console.log('🔍 Validating required files...');
    
//     for (const key of fileKeys) {
//       const file = Array.isArray(files[key]) ? files[key]?.[0] : files[key];
//       if (!file) {
//         console.error(`❌ Missing file for ${key}`);
//         return res.status(400).json({ error: `Missing file for ${key}` });
//       }
//       console.log(`✅ File found for ${key}:`, (file as formidable.File).originalFilename);
//     }

//     // ✅ Upload files to Vercel Blob
//     console.log('☁️ Starting file uploads to Vercel Blob...');
//     const attachments: { [key: string]: { filename: string; url: string } } = {};

//     for (const key of fileKeys) {
//       try {
//         const file = (Array.isArray(files[key]) ? files[key]?.[0] : files[key]) as formidable.File;
        
//         console.log(`📤 Uploading ${key}:`, {
//           originalFilename: file.originalFilename,
//           size: file.size,
//           mimetype: file.mimetype
//         });

//         // Add to cleanup list
//         filesToDelete.push(file.filepath);

//         // Create unique filename
//         const timestamp = Date.now();
//         const originalName = file.originalFilename || `${key}.pdf`;
//         const fileExtension = path.extname(originalName);
//         const baseName = path.basename(originalName, fileExtension);
//         const filename = `${recordId}_${key}_${timestamp}_${baseName}${fileExtension}`;

//         // Read file and upload to blob
//         const fileBuffer = await fs.readFile(file.filepath);
//         console.log(`📖 File read successfully, size: ${fileBuffer.length} bytes`);

//         const blob = await put(filename, fileBuffer, {
//           access: 'public',
//           token: process.env.BLOB_READ_WRITE_TOKEN,
//           addRandomSuffix: true,
//         });

//         attachments[key] = { filename, url: blob.url };
//         console.log(`✅ ${key} uploaded successfully:`, blob.url);

//       } catch (uploadError) {
//         console.error(`❌ Failed to upload ${key}:`, uploadError);
//         throw new Error(`Failed to upload ${key}: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
//       }
//     }

//     console.log('✅ All files uploaded to Vercel Blob');
//     console.log('📎 Attachment URLs:', attachments);

//     // ✅ Update Airtable with detailed logging
//     console.log('📋 Preparing Airtable update...');
    
//     const airtablePayload = {
//       fields: {
//         [process.env.AIRTABLE_IDENTITY_PROOF_FIELD_ID!]: [{ 
//           url: attachments.identityProof.url,
//           filename: attachments.identityProof.filename 
//         }],
//         [process.env.AIRTABLE_ADDRESS_PROOF_FIELD_ID!]: [{ 
//           url: attachments.addressProof.url,
//           filename: attachments.addressProof.filename 
//         }],
//         [process.env.AIRTABLE_OFFER_LETTER_FIELD_ID!]: [{ 
//           url: attachments.offerLetter.url,
//           filename: attachments.offerLetter.filename 
//         }],
//         DocumentsSubmitted: true,
//         Status: 'Documents Submitted',
//       },
//     };

//     console.log('📤 Airtable payload:', JSON.stringify(airtablePayload, null, 2));

//     const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`;
//     console.log('🔗 Airtable URL:', airtableUrl);

//     const patchResponse = await fetch(airtableUrl, {
//       method: 'PATCH',
//       headers: {
//         Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(airtablePayload),
//     });

//     console.log('📡 Airtable response status:', patchResponse.status, patchResponse.statusText);

//     // ✅ Handle Airtable response
//     const responseText = await patchResponse.text();
//     console.log('📄 Airtable response body:', responseText);
    
//     if (!patchResponse.ok) {
//       console.error('❌ Airtable update failed:', {
//         status: patchResponse.status,
//         statusText: patchResponse.statusText,
//         body: responseText,
//       });
      
//       return res.status(500).json({
//         error: 'Failed to update Airtable',
//         details: `Status: ${patchResponse.status}, Response: ${responseText}`,
//         attachments: Object.keys(attachments).reduce((acc, key) => {
//           acc[key] = attachments[key].url;
//           return acc;
//         }, {} as { [key: string]: string }),
//       });
//     }

//     // ✅ Parse successful response
//     let airtableData;
//     try {
//       airtableData = JSON.parse(responseText);
//       console.log('✅ Airtable update successful:', airtableData);
//     } catch {
//       console.warn('⚠️ Could not parse Airtable response as JSON, but update was successful');
//       airtableData = { message: 'Update successful but response not parseable as JSON' };
//     }

//     console.log('🎉 Upload process completed successfully');

//     return res.status(200).json({
//       success: true,
//       message: 'Documents uploaded and Airtable updated successfully',
//       airtableData,
//       attachments: Object.keys(attachments).reduce((acc, key) => {
//         acc[key] = attachments[key].url;
//         return acc;
//       }, {} as { [key: string]: string }),
//     });

//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
//     console.error('💥 Upload API Error:', errorMessage);
//     console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
//     return res.status(500).json({ 
//       error: errorMessage,
//       timestamp: new Date().toISOString(),
//     });
    
//   } finally {
//     // ✅ Cleanup temporary files
//     console.log('🧹 Cleaning up temporary files...');
//     if (filesToDelete.length > 0) {
//       const cleanupResults = await Promise.allSettled(
//         filesToDelete.map(async (filePath) => {
//           try {
//             await fs.unlink(filePath);
//             console.log(`🗑️ Deleted: ${filePath}`);
//           } catch (cleanupError) {
//             console.warn(`⚠️ Could not delete ${filePath}:`, cleanupError);
//           }
//         })
//       );
//       console.log(`🧹 Cleanup completed. ${cleanupResults.length} files processed.`);
//     }
//   }
// }






