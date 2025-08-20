import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

// Define response types for consistency
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Define environment variables type
interface EnvVars {
  BLOB_READ_WRITE_TOKEN: string;
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_TABLE_ID: string;
  AIRTABLE_IDENTITY_PROOF_FIELD_ID: string;
  AIRTABLE_ADDRESS_PROOF_FIELD_ID: string;
  AIRTABLE_OFFER_LETTER_FIELD_ID: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvVars {}
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const uploadDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    multiples: true,
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 3,
    maxFields: 10,
    keepExtensions: true,
  });

  const validMimeTypes = ['application/pdf'];
  const filesToDelete: string[] = [];

  try {
    // Validate environment variables
    const requiredEnvVars: (keyof EnvVars)[] = [
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
    if (!recordId || typeof recordId !== 'string' || !/^[a-zA-Z0-9]+$/.test(recordId)) {
      throw new Error('Invalid or missing recordId in form data');
    }

    const fileKeys = ['identityProof', 'addressProof', 'offerLetter'];
    for (const key of fileKeys) {
      const file = files[key]?.[0] as formidable.File | undefined;
      if (!file) {
        throw new Error(`Missing file for ${key}`);
      }
      if (!file.mimetype || !validMimeTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type for ${key}. Only PDFs are allowed.`);
      }
      filesToDelete.push(file.filepath);
    }

    const attachments: { [key: string]: { filename: string; url: string } } = {};

    for (const key of fileKeys) {
      const file = files[key]![0] as formidable.File;
      const filename = `${recordId}_${key}.pdf`;

      // Verify file exists before reading
      try {
        await fs.access(file.filepath, fs.constants.R_OK);
      } catch {
        throw new Error(`Cannot access file for ${key} at ${file.filepath}`);
      }

      // Upload to Vercel Blob
      try {
        const blob = await put(filename, await fs.readFile(file.filepath), {
          access: 'public', // Changed to 'public' or omit for private (default behavior)
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        if (!blob.url) {
          throw new Error(`Failed to upload ${filename} to Vercel Blob: No URL returned`);
        }

        attachments[key] = { filename, url: blob.url };
      } catch (blobError) {
        throw new Error(`Failed to upload ${filename} to Vercel Blob: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
      }
    }

    // Update Airtable record (unchanged from original)
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
            [process.env.AIRTABLE_IDENTITY_PROOF_FIELD_ID]: [{ url: attachments.identityProof.url }],
            [process.env.AIRTABLE_ADDRESS_PROOF_FIELD_ID]: [{ url: attachments.addressProof.url }],
            [process.env.AIRTABLE_OFFER_LETTER_FIELD_ID]: [{ url: attachments.offerLetter.url }],
            DocumentsSubmitted: true,
            Status: 'Documents Submitted',
          },
        }),
      }
    );

    if (!patchResponse.ok) {
      let errorData: string | object = await patchResponse.text();
      try {
        errorData = JSON.parse(errorData);
      } catch {
        // If parsing fails, use raw text
      }
      throw new Error(`Airtable update failed: ${JSON.stringify(errorData)}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Documents uploaded and Airtable updated successfully',
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('Upload API Error:', errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  } finally {
    await Promise.all(
      filesToDelete.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error(`Failed to delete temporary file ${filePath}:`, err);
        }
      })
    );
  }
}