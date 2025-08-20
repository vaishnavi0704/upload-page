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
  const form = formidable({ multiples: true, uploadDir }); // Set uploadDir here
  const maxFileSize = 5 * 1024 * 1024; // 5MB limit for Airtable

  const filesToDelete: string[] = [];

  try {
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const recordId = fields.recordId?.[0];
    if (!recordId) {
      throw new Error('Missing recordId');
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

      // Upload to Vercel Blob
      const blob = await put(file.originalFilename || key, await fs.readFile(file.filepath), {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN,
      });

      attachments[key] = { filename: file.originalFilename || key, url: blob.url };
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
      const errorData = await patchResponse.json();
      throw new Error(`Record update failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    res.status(200).json({ success: true });
  } catch (err: unknown) { // Changed 'Error' to 'unknown'
    // Safely access error message
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  } finally {
    // Clean up temporary files
    await Promise.all(filesToDelete.map(filePath => fs.unlink(filePath).catch(() => {})));
  }
}