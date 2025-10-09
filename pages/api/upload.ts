
// pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => form.parse(req, (err, f, files) => (err ? reject(err) : resolve([f, files])))
    );

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const documentType = Array.isArray(fields.documentType) ? fields.documentType[0] : fields.documentType;
    const recordId = Array.isArray(fields.recordId) ? fields.recordId[0] : fields.recordId;

    if (!file || !documentType || !recordId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Uploading ${documentType} to Blob for record ${recordId}`);

    // Validate Airtable token
    const airtableToken = process.env.AIRTABLE_TOKEN;
    if (!airtableToken) {
      console.error('AIRTABLE_TOKEN is not set');
      return res.status(500).json({ error: 'Airtable not configured. Check AIRTABLE_TOKEN.' });
    }

    // Upload to Vercel Blob (your previous fix should handle this)
    const fileBuffer = fs.readFileSync(file.filepath);
    const filename = `${recordId}_${documentType}_${Date.now()}_${file.originalFilename?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'file'}`;
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    console.log('Blob URL:', blob.url);

    // Detailed Airtable update with error logging
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

    // Log full response for debugging
    const airtableResponseText = await airtableResponse.text();
    console.log(`Airtable Response Status: ${airtableResponse.status}`);
    console.log(`Airtable Response Body: ${airtableResponseText}`);

    if (!airtableResponse.ok) {
      let errorMessage = `Airtable API error (${airtableResponse.status}): ${airtableResponseText}`;
      try {
        const errorData = JSON.parse(airtableResponseText);
        errorMessage = errorData.error || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    fs.unlinkSync(file.filepath);
    console.log(`Success! Updated Airtable field ${fieldId} for record ${recordId}`);
    return res.status(200).json({ success: true, url: blob.url });

  } catch (error) {
    console.error('Upload Error:', error.message, error.stack);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}
