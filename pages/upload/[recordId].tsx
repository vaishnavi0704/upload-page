import { GetServerSideProps } from 'next';
import { useState } from 'react';

interface Props {
  candidateName: string;
  recordId: string;
  error?: string;
}

export default function UploadPage({ candidateName, recordId, error }: Props) {
  const [status, setStatus] = useState('');
  const [uploadError, setUploadError] = useState('');

  if (error) {
    return <div>Error: {error}</div>;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('Uploading...');
    setUploadError('');

    const formData = new FormData(e.currentTarget);
    formData.append('recordId', recordId);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // Handle non-JSON responses
          const errorText = await response.text();
          errorMessage = errorText || 'An unexpected error occurred';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setStatus(data.message || 'Documents uploaded successfully! Your onboarding status has been updated.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Upload Error:', errorMessage);
      setUploadError(errorMessage);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Welcome, {candidateName}!</h1>
      <p>Please upload your required documents below to complete onboarding.</p>
      
      <form onSubmit={handleSubmit}>
        <label htmlFor="identityProof">Identity Proof (Driver&apos;s License, Passport, or Government ID):</label><br />
        <input type="file" id="identityProof" name="identityProof" accept="image/*,application/pdf" required /><br /><br />
        
        <label htmlFor="addressProof">Address Proof (Utility Bill, Bank Statement, or Lease Agreement):</label><br />
        <input type="file" id="addressProof" name="addressProof" accept="image/*,application/pdf" required /><br /><br />
        
        <label htmlFor="offerLetter">Signed Offer Letter:</label><br />
        <input type="file" id="offerLetter" name="offerLetter" accept="application/pdf" required /><br /><br />
        
        <button type="submit" style={{ padding: '10px', backgroundColor: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}>
          Upload Documents
        </button>
      </form>
      
      {status && <div style={{ marginTop: '20px', color: 'green' }}>{status}</div>}
      {uploadError && <div style={{ marginTop: '20px', color: 'red' }}>{uploadError}</div>}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { recordId } = context.params as { recordId: string };

  try {
    const response = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable fetch failed: ${errorText || 'Record not found'}`);
    }

    const data = await response.json();
    const candidateName = data.fields.Name || 'Candidate';

    return { props: { candidateName, recordId } };
  } catch (_err) {
    return { props: { error: 'Failed to load candidate details. Please check your Record ID.' } };
  }
};