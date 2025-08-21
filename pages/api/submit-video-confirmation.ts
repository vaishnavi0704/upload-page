import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recordId } = req.body;

  if (!recordId) {
    return res.status(400).json({ error: 'Missing recordId' });
  }

  try {
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`;
    const patchResponse = await fetch(airtableUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Video Watched': 'Yes', // Update this field name to match your Airtable setup
        },
      }),
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      throw new Error(`Airtable update failed: ${errorText}`);
    }

    res.status(200).json({ message: 'Video confirmation submitted successfully' });
  } catch (error) {
    console.error('Submit video confirmation error:', error);
    res.status(500).json({ error: 'Failed to submit video confirmation' });
  }
}