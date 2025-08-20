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
    setStatus('');
    setUploadError('');

    const formData = new FormData(e.currentTarget);
    formData.append('recordId', recordId);

    try {
      setStatus('Uploading...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setStatus('Documents uploaded successfully! Your onboarding status has been updated.');
    } catch (err: unknown) { // Changed 'any' to 'unknown'
      // Safely access error message
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
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
      throw new Error('Record not found');
    }

    const data = await response.json();
    const candidateName = data.fields.Name || 'Candidate';

    return { props: { candidateName, recordId } };
  } catch (_err) {
    return { props: { error: 'Failed to load candidate details. Please check your Record ID.' } };
  }
};