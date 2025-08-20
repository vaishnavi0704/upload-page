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
  const [isUploading, setIsUploading] = useState(false);
  const [fileNames, setFileNames] = useState({ identityProof: '', addressProof: '', offerLetter: '' });

  if (error) {
    return <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      Error: {error}
    </div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileNames(prev => ({ ...prev, [key]: file.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    setStatus('Validating...');
    setUploadError('');

    const form = e.currentTarget;
    const identityProof = (form.elements.namedItem('identityProof') as HTMLInputElement).files?.[0];
    const addressProof = (form.elements.namedItem('addressProof') as HTMLInputElement).files?.[0];
    const offerLetter = (form.elements.namedItem('offerLetter') as HTMLInputElement).files?.[0];

    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const validTypes = ['application/pdf'];

    if (!identityProof || !addressProof || !offerLetter) {
      setUploadError('All files are required.');
      setStatus('');
      setIsUploading(false);
      return;
    }

    for (const [key, file] of Object.entries({ identityProof, addressProof, offerLetter })) {
      if (file.size > maxFileSize) {
        setUploadError(`File ${file.name} exceeds 5MB limit.`);
        setStatus('');
        setIsUploading(false);
        return;
      }
      if (!validTypes.includes(file.type)) {
        setUploadError(`Invalid file type for ${key}. Only PDFs are allowed.`);
        setStatus('');
        setIsUploading(false);
        return;
      }
      if (!file.name.startsWith(`${recordId}_`)) {
        setUploadError(`File ${file.name} must start with record ID: ${recordId}_`);
        setStatus('');
        setIsUploading(false);
        return;
      }
    }

    const formData = new FormData(form);
    formData.append('recordId', recordId);

    try {
      setStatus('Uploading...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      let errorMessage = 'Upload failed';

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || 'An unexpected error occurred';
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      setStatus(data.message || 'Documents uploaded successfully! Your onboarding status has been updated.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Upload Error:', errorMessage);
      setUploadError(errorMessage);
      setStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Welcome, {candidateName}!</h1>
      <p>Please upload your required documents below to complete onboarding.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="identityProof">Identity Proof (Driver&apos;s License, Passport, or Government ID):</label><br />
        <input
          type="file"
          id="identityProof"
          name="identityProof"
          accept="application/pdf"
          required
          onChange={e => handleFileChange(e, 'identityProof')}
        /><br />
        {fileNames.identityProof && <p style={{ margin: '5px 0' }}>Selected: {fileNames.identityProof}</p>}
        <br />

        <label htmlFor="addressProof">Address Proof (Utility Bill, Bank Statement, or Lease Agreement):</label><br />
        <input
          type="file"
          id="addressProof"
          name="addressProof"
          accept="application/pdf"
          required
          onChange={e => handleFileChange(e, 'addressProof')}
        /><br />
        {fileNames.addressProof && <p style={{ margin: '5px 0' }}>Selected: {fileNames.addressProof}</p>}
        <br />

        <label htmlFor="offerLetter">Signed Offer Letter:</label><br />
        <input
          type="file"
          id="offerLetter"
          name="offerLetter"
          accept="application/pdf"
          required
          onChange={e => handleFileChange(e, 'offerLetter')}
        /><br />
        {fileNames.offerLetter && <p style={{ margin: '5px 0' }}>Selected: {fileNames.offerLetter}</p>}
        <br />

        <button
          type="submit"
          disabled={isUploading}
          style={{
            padding: '10px',
            backgroundColor: isUploading ? '#ccc' : '#6366f1',
            color: 'white',
            border: 'none',
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload Documents'}
        </button>
      </form>

      {status && <div style={{ marginTop: '20px', color: 'green' }}>{status}</div>}
      {uploadError && <div style={{ marginTop: '20px', color: 'red' }}>{uploadError}</div>}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { recordId } = context.params as { recordId: string };

  if (!recordId.match(/^[a-zA-Z0-9]+$/)) {
    return { props: { error: 'Invalid Record ID format' } };
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable fetch failed: ${errorText || 'Record not found'}`);
    }

    const data = await response.json();
    const candidateName = data.fields.Name || 'Candidate';

    return { props: { candidateName, recordId } };
  } catch (err) {
    console.error('getServerSideProps Error:', err);
    return { props: { error: 'Failed to load candidate details. Please check your Record ID.' } };
  }
};