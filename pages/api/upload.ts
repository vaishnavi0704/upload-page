import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

// Define response type
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Augment ProcessEnv (ensure next-env.d.ts is configured)
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

  const validMimeTypes = ['application/pdf', 'application/octet-stream'];
  const validExtensions = ['.pdf'];
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

    if (!process.env.AIRTABLE_BASE_ID.startsWith('app')) {
      throw new Error('Invalid AIRTABLE_BASE_ID: Must start with "app"');
    }

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parsing error:', err);
          if (err.httpCode === 413) {
            reject(new Error('File size exceeds 5MB limit'));
          } else if (err.httpCode === 400) {
            reject(new Error('Invalid form data'));
          } else {
            reject(new Error(`Form parsing failed: ${err.message}`));
          }
        }
        resolve([fields, files]);
      });
    });

    const recordId = fields.recordId?.[0];
    if (!recordId || typeof recordId !== 'string' || !/^rec[a-zA-Z0-9]{14}$/.test(recordId)) {
      throw new Error('Invalid or missing recordId: Must be an Airtable record ID (e.g., rec12345678901234)');
    }

    const fileKeys = ['identityProof', 'addressProof', 'offerLetter'];
    for (const key of fileKeys) {
      const file = files[key]?.[0] as formidable.File | undefined;
      if (!file) {
        throw new Error(`Missing file for ${key}`);
      }
      const extension = path.extname(file.originalFilename || '').toLowerCase();
      if (!file.mimetype || (!validMimeTypes.includes(file.mimetype) && !validExtensions.includes(extension))) {
        throw new Error(`Invalid file type for ${key}. Only PDFs are allowed.`);
      }
      filesToDelete.push(file.filepath);
    }

    const attachments: { [key: string]: { filename: string; url: string } } = {};

    for (const key of fileKeys) {
      const file = files[key]![0] as formidable.File;
      const filename = `${recordId}_${key}.pdf`;

      try {
        await fs.access(file.filepath, fs.constants.R_OK);
      } catch {
        throw new Error(`Cannot access file for ${key} at ${file.filepath}`);
      }

      const fileBuffer = await fs.readFile(file.filepath);
      const blob = await put(filename, fileBuffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      if (!blob.url || !blob.pathname) {
        throw new Error(`Failed to upload ${filename} to Vercel Blob: Invalid response`);
      }

      console.log(`Uploaded ${filename} to Vercel Blob: ${blob.url} (pathname: ${blob.pathname})`);
      attachments[key] = { filename, url: blob.url };
    }

    // Retry logic for Airtable
    const maxRetries = 3;
    const retryDelay = 1000;

    async function fetchWithRetry(url: string, options: RequestInit, retries: number = maxRetries): Promise<Response> {
      for (let i = 0; i < retries; i++) {
        const response = await fetch(url, options);
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, i)));
          continue;
        }
        return response;
      }
      throw new Error('Airtable API rate limit exceeded after retries');
    }

    // Verify Airtable record exists
    const checkResponse = await fetchWithRetry(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
      }
    );
    if (!checkResponse.ok) {
      const errorData = await checkResponse.text();
      throw new Error(`Airtable record check failed: ${errorData}`);
    }

    // Update Airtable record
    const patchResponse = await fetchWithRetry(
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
      const errorData = await patchResponse.text();
      let errorMessage = errorData;
      try {
        errorMessage = JSON.parse(errorData).error?.message || errorData;
      } catch {
        // Use raw text if JSON parsing fails
      }
      throw new Error(`Airtable update failed: ${errorMessage}`);
    }

    const responseData = await patchResponse.json();
    if (!responseData.id || responseData.id !== recordId) {
      throw new Error('Airtable update failed: Invalid response or record ID mismatch');
    }

    return res.status(200).json({
      success: true,
      message: 'Documents uploaded and Airtable updated successfully',
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    // console.error('Upload API Error:', { error: errorMessage, recordId, timestamp: new Date().toISOString() });
    return res.status(500).json({ success: false, error: errorMessage });
  } finally {
    await Promise.all(
      filesToDelete.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
          console.log(`Deleted temporary file: ${filePath}`);
        } catch (err) {
          console.error(`Failed to delete temporary file ${filePath}:`, err);
        }
      })
    );
  }
}