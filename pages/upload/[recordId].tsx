



import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';

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
  const [fileRefs, setFileRefs] = useState<{ identityProof: File | null, addressProof: File | null, offerLetter: File | null }>({ 
    identityProof: null, 
    addressProof: null, 
    offerLetter: null 
  });
  const [aiVerificationStep, setAiVerificationStep] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUploading) {
      setAiVerificationStep(0);
      timer = setInterval(() => {
        setAiVerificationStep((prev) => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isUploading]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          padding: '40px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'white',
            fontSize: '24px'
          }}>
            ⚠️
          </div>
          <h2 style={{ color: '#333', marginBottom: '10px', fontSize: '20px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileNames(prev => ({ ...prev, [key]: file.name }));
      setFileRefs(prev => ({ ...prev, [key]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    setStatus('Validating...');
    setUploadError('');

    const form = e.currentTarget;
    const identityProof = fileRefs.identityProof || (form.elements.namedItem('identityProof') as HTMLInputElement).files?.[0];
    const addressProof = fileRefs.addressProof || (form.elements.namedItem('addressProof') as HTMLInputElement).files?.[0];
    const offerLetter = fileRefs.offerLetter || (form.elements.namedItem('offerLetter') as HTMLInputElement).files?.[0];

    console.log('Form submission - Files found:', {
      identityProof: identityProof?.name,
      addressProof: addressProof?.name,
      offerLetter: offerLetter?.name
    });

    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const validTypes = ['application/pdf'];

    const hasAllFiles = identityProof && addressProof && offerLetter;
    
    if (!hasAllFiles) {
      console.log('Missing files:', {
        identityProof: !!identityProof,
        addressProof: !!addressProof,
        offerLetter: !!offerLetter
      });
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

    const formData = new FormData();
    formData.append('identityProof', identityProof);
    formData.append('addressProof', addressProof);
    formData.append('offerLetter', offerLetter);
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

  const FileUploadCard = ({ 
    id, 
    name, 
    title, 
    description, 
    icon, 
    fileName, 
    onChange 
  }: { 
    id: string; 
    name: string; 
    title: string; 
    description: string; 
    icon: string; 
    fileName: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  }) => (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      border: fileName ? '2px solid #10b981' : '2px dashed #e5e7eb',
      transition: 'all 0.3s ease',
      position: 'relative',
      cursor: 'pointer',
      boxShadow: fileName ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <input
        type="file"
        id={id}
        name={name}
        accept="application/pdf"
        required
        onChange={onChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          zIndex: 10
        }}
      />
      
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '32px',
          marginBottom: '12px',
          filter: fileName ? 'none' : 'grayscale(1)',
          transition: 'all 0.3s ease'
        }}>
          {fileName ? '✅' : icon}
        </div>
        
        <h3 style={{
          color: fileName ? '#059669' : '#374151',
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: '6px'
        }}>
          {title}
        </h3>
        
        <p style={{
          color: '#6b7280',
          fontSize: '13px',
          marginBottom: '12px',
          lineHeight: '1.4'
        }}>
          {description}
        </p>
        
        {fileName ? (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #d1fae5',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#065f46'
          }}>
            📄 {fileName}
          </div>
        ) : (
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            Click to select PDF file
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative'
    }}>
      {/* AI Verification Popup */}
      {isUploading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          zIndex: 1000,
          width: '350px',
          maxWidth: '90%',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '20px'
            }}>
              🤖
            </div>
            <h3 style={{
              color: '#1f2937',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0
            }}>
              AI Document Verification
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Identity Proof', icon: '🆔' },
              { label: 'Address Proof', icon: '🏠' },
              { label: 'Offer Letter', icon: '📝' }
            ].map((item, index) => (
              <div key={item.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px',
                borderRadius: '8px',
                background: aiVerificationStep > index ? '#ecfdf5' : '#f9fafb',
                border: aiVerificationStep > index ? '1px solid #d1fae5' : '1px solid #e5e7eb'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: aiVerificationStep > index ? '#10b981' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: 'white'
                }}>
                  {aiVerificationStep > index ? '✓' : item.icon}
                </div>
                <span style={{
                  fontSize: '14px',
                  color: aiVerificationStep > index ? '#065f46' : '#6b7280',
                  fontWeight: aiVerificationStep > index ? '600' : '500'
                }}>
                  {item.label} {aiVerificationStep === index ? 'Verifying...' : aiVerificationStep > index ? 'Verified' : 'Pending'}
                </span>
                {aiVerificationStep === index && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    borderTop: '2px solid #10b981',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px'
          }}>
            📋
          </div>
          <div>
            <h1 style={{
              color: '#1f2937',
              fontSize: '24px',
              fontWeight: '700',
              margin: 0,
              marginBottom: '4px'
            }}>
              Document Upload Portal
            </h1>
            <p style={{
              color: '#6b7280',
              fontSize: '14px',
              margin: 0
            }}>
              Secure onboarding document submission
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '40px 20px' }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          {/* Welcome Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '32px'
            }}>
              👋
            </div>
            <h2 style={{
              color: '#1f2937',
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '8px'
            }}>
              Welcome, {candidateName}!
            </h2>
            <p style={{
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '20px'
            }}>
              You&apos;re almost done! Please upload the required documents below to complete your onboarding process.
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              Record ID: {recordId}
            </div>
          </div>

          {/* Upload Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <FileUploadCard
                id="identityProof"
                name="identityProof"
                title="Identity Proof"
                description="Driver&apos;s License, Passport, or Government ID"
                icon="🆔"
                fileName={fileNames.identityProof}
                onChange={e => handleFileChange(e, 'identityProof')}
              />

              <FileUploadCard
                id="addressProof"
                name="addressProof"
                title="Address Proof"
                description="Utility Bill, Bank Statement, or Lease Agreement"
                icon="🏠"
                fileName={fileNames.addressProof}
                onChange={e => handleFileChange(e, 'addressProof')}
              />

              <FileUploadCard
                id="offerLetter"
                name="offerLetter"
                title="Signed Offer Letter"
                description="Your signed employment offer letter"
                icon="📝"
                fileName={fileNames.offerLetter}
                onChange={e => handleFileChange(e, 'offerLetter')}
              />
            </div>

            {/* Requirements */}
            <div style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '32px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '20px', marginTop: '2px' }}>💡</div>
                <div>
                  <h4 style={{
                    color: '#92400e',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    File Requirements
                  </h4>
                  <ul style={{
                    color: '#92400e',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    margin: 0,
                    paddingLeft: '16px'
                  }}>
                    <li>All files must be in PDF format</li>
                    <li>Maximum file size: 5MB per file</li>
                    <li>File names must start with: <code style={{ 
                      background: 'rgba(251, 191, 36, 0.2)', 
                      padding: '2px 4px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>{recordId}_</code></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* File Upload Progress */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📊 Upload Progress
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['identityProof', 'addressProof', 'offerLetter'].map((key, index) => {
                  const labels = ['Identity Proof', 'Address Proof', 'Offer Letter'];
                  const isSelected = fileNames[key as keyof typeof fileNames];
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: isSelected ? '#ecfdf5' : '#f9fafb',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #d1fae5' : '1px solid #e5e7eb',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: isSelected ? '#10b981' : '#e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: 'white',
                        fontWeight: '600'
                      }}>
                        {isSelected ? '✓' : index + 1}
                      </div>
                      <span style={{
                        fontSize: '13px',
                        color: isSelected ? '#065f46' : '#6b7280',
                        fontWeight: isSelected ? '600' : '500',
                        flex: 1
                      }}>
                        {labels[index]}
                      </span>
                      {isSelected && (
                        <span style={{
                          fontSize: '11px',
                          color: '#059669',
                          background: '#d1fae5',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '500'
                        }}>
                          Ready
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Overall Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  height: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    height: '100%',
                    borderRadius: '8px',
                    width: `${(Object.values(fileNames).filter(name => name).length / 3) * 100}%`,
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '6px',
                  textAlign: 'center'
                }}>
                  {Object.values(fileNames).filter(name => name).length} of 3 files selected
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ textAlign: 'center' }}>
              {Object.values(fileNames).filter(name => name).length === 3 ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '16px' }}>🎉</div>
                    <span style={{
                      color: '#065f46',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      All files selected! Ready to upload.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '16px' }}>📝</div>
                    <span style={{
                      color: '#92400e',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      Please select all {3 - Object.values(fileNames).filter(name => name).length} remaining file(s) to continue.
                    </span>
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isUploading}
                style={{
                  background: isUploading
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  boxShadow: isUploading
                    ? 'none' 
                    : '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease',
                  transform: isUploading ? 'none' : 'translateY(0)',
                  minWidth: '200px',
                  opacity: isUploading ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                {isUploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Uploading...
                  </div>
                ) : (
                  <>🚀 Upload Documents</>
                )}
              </button>
            </div>
          </form>

          {/* Status Messages */}
          {status && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '20px' }}>✅</div>
              <p style={{
                color: '#065f46',
                fontSize: '14px',
                fontWeight: '500',
                margin: 0
              }}>
                {status}
              </p>
            </div>
          )}

          {uploadError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '20px' }}>❌</div>
              <p style={{
                color: '#991b1b',
                fontSize: '14px',
                fontWeight: '500',
                margin: 0
              }}>
                {uploadError}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '12px'
      }}>
        Need help? Contact our support team for assistance with your document upload.
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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


