import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing for multipart
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize formidable with uploadDir
  const uploadDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(uploadDir, { recursive: true });
  const form = formidable({ multiples: true, uploadDir });
  const maxFileSize = 5 * 1024 * 1024; // 5MB limit for Airtable

  const filesToDelete: string[] = [];

  try {
    // Validate environment variables
    const requiredEnvVars = [
      'BLOB_READ_WRITE_TOKEN',
      'AIRTABLE_TOKEN',
      'AIRTABLE_BASE_ID',
      'AIRTABLE_TABLE_ID',
      'AIRTABLE_IDENTITY_PROOF_FIELD_ID',
      'AIRTABLE_ADDRESS_PROOF_FIELD_ID',
      'AIRTABLE_OFFER_LETTER_FIELD_ID',
    ];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
    }

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(new Error(`Form parsing failed: ${err.message}`));
        resolve([fields, files]);
      });
    });

    const recordId = fields.recordId?.[0];
    if (!recordId) {
      throw new Error('Missing recordId in form data');
    }

    const fileKeys = ['identityProof', 'addressProof', 'offerLetter'];
    // Validate that all three files are provided
    for (const key of fileKeys) {
      if (!files[key]?.[0]) {
        throw new Error(`Missing file for ${key}`);
      }
    }

    const attachments: { [key: string]: { filename: string; url: string } } = {};

    // Upload each file to Vercel Blob and collect URLs
    for (const key of fileKeys) {
      const file = files[key]?.[0] as formidable.File;
      if (file.size > maxFileSize) {
        throw new Error(`File ${file.originalFilename} exceeds 5MB limit`);
      }

      filesToDelete.push(file.filepath);

      // Use original filename or fallback to key, without prepending recordId
      const filename = file.originalFilename || `${key}.pdf`;

      // Upload to Vercel Blob
      const blob = await put(filename, await fs.readFile(file.filepath), {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      attachments[key] = { filename, url: blob.url };
    }

    // Update the Airtable record with each file in its respective field
    const patchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [process.env.AIRTABLE_IDENTITY_PROOF_FIELD_ID as string]: [{ url: attachments.identityProof.url }],
            [process.env.AIRTABLE_ADDRESS_PROOF_FIELD_ID as string]: [{ url: attachments.addressProof.url }],
            [process.env.AIRTABLE_OFFER_LETTER_FIELD_ID as string]: [{ url: attachments.offerLetter.url }],
            DocumentsSubmitted: true,
            Status: 'Documents Submitted',
          },
        }),
      }
    );

    if (!patchResponse.ok) {
      const errorData = await patchResponse.text(); // Use text() to avoid JSON parsing issues
      throw new Error(`Airtable update failed: ${errorData || 'Unknown error'}`);
    }

    res.status(200).json({ success: true, message: 'Documents uploaded and Airtable updated successfully' });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('Upload API Error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  } finally {
    // Clean up temporary files
    await Promise.all(filesToDelete.map(filePath => fs.unlink(filePath).catch(() => {})));
  }
}