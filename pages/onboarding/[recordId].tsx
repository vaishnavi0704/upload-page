import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CandidateData {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  position: string;
  department: string;
  startDate: string;
  buddyName: string;
  buddyEmail: string;
  hrRep: string;
  recordId: string;
  formUrl: string;
  identityProofUrl?: string;
  addressProofUrl?: string;
  offerLetterUrl?: string;
}

interface Props {
  candidateData?: CandidateData;
  error?: string;
}

export default function OnboardingDashboard({ candidateData, error }: Props) {
  const [showModal, setShowModal] = useState(false);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Trigger onboarding simulation
  const triggerOnboarding = () => {
    console.log('Triggering onboarding for:', candidateData);
    setShowModal(true);
    // In a real implementation, you would call an API here
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const modal = document.getElementById('successModal');
      if (modal && event.target === modal) {
        setShowModal(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  if (error || !candidateData) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h2>Oops! Something went wrong</h2>
          <p>{error || 'No candidate data available.'}</p>
        </div>
        <style jsx>{`
          .error-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .error-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
          }
          .error-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            color: white;
            font-size: 24px;
          }
          h2 {
            color: #333;
            margin-bottom: 10px;
            font-size: 20px;
          }
          p {
            color: #666;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <h1>🏢 HR Onboarding Dashboard</h1>
        <p>Manage and track candidate onboarding processes</p>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Candidate Information Card */}
        <div className="candidate-card">
          <div className="card-header">
            <div className="avatar">👩‍💼</div>
            <div className="candidate-info">
              <h2>{candidateData.candidateName}</h2>
              <div className="position">{candidateData.position}</div>
            </div>
          </div>

          <div className="details-grid">
            <div className="detail-item">
              <div className="detail-label">Email</div>
              <div className="detail-value">{candidateData.candidateEmail}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Phone</div>
              <div className="detail-value">{candidateData.candidatePhone}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Department</div>
              <div className="detail-value">{candidateData.department}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Start Date</div>
              <div className="detail-value">{formatDate(candidateData.startDate)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Buddy</div>
              <div className="detail-value">{candidateData.buddyName}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">HR Rep</div>
              <div className="detail-value">{candidateData.hrRep}</div>
            </div>
          </div>

          <div className="action-buttons">
            {candidateData.identityProofUrl && (
              <Link href={candidateData.identityProofUrl} target="_blank" className="btn btn-secondary">
                🆔 Identity Proof
              </Link>
            )}
            {candidateData.addressProofUrl && (
              <Link href={candidateData.addressProofUrl} target="_blank" className="btn btn-secondary">
                🏠 Address Proof
              </Link>
            )}
            {candidateData.offerLetterUrl && (
              <Link href={candidateData.offerLetterUrl} target="_blank" className="btn btn-secondary">
                📄 Offer Letter
              </Link>
            )}
            <Link
              href="http://localhost:5678/webhook-test/e956f14f-3a07-4c8d-aeae-1af687a8dff3"
              target="_blank"
              className="btn btn-secondary"
            >
              📄 Click to Start Onboard
            </Link>
          </div>
        </div>

        {/* Status Card */}
        <div className="status-card">
          <div className="status-header">
            <div className="status-icon">📋</div>
            <div className="status-title">Onboarding Status</div>
          </div>

          <ul className="status-list">
            <li className="status-item">
              <div className="status-badge completed"></div>
              <span>Candidate Information Collected</span>
            </li>
            <li className="status-item">
              <div className="status-badge pending"></div>
              <span>Document Upload Link Sent</span>
            </li>
            <li className="status-item">
              <div className="status-badge pending"></div>
              <span>Documents Received</span>
            </li>
            <li className="status-item">
              <div className="status-badge pending"></div>
              <span>Background Check</span>
            </li>
            <li className="status-item">
              <div className="status-badge pending"></div>
              <span>Onboarding Complete</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Onboarding Flow */}
      <div className="onboarding-flow">
        <div className="flow-header">
          <div className="flow-title">Onboarding Process Flow</div>
          <div className="flow-subtitle">Track the candidate's journey through the onboarding process</div>
        </div>

        <div className="steps">
          <div className="step completed">
            <div className="step-circle">✓</div>
            <div className="step-label">Pre-boarding<br />Setup</div>
            <div className="step-line"></div>
          </div>
          <div className="step active">
            <div className="step-circle">2</div>
            <div className="step-label">Document<br />Collection</div>
            <div className="step-line"></div>
          </div>
          <div className="step">
            <div className="step-circle">3</div>
            <div className="step-label">Verification &<br />Review</div>
            <div className="step-line"></div>
          </div>
          <div className="step">
            <div className="step-circle">4</div>
            <div className="step-label">Background<br />Check</div>
            <div className="step-line"></div>
          </div>
          <div className="step">
            <div className="step-circle">5</div>
            <div className="step-label">Welcome &<br />Integration</div>
          </div>
        </div>

        <div className="trigger-section">
          <div className="trigger-title">🚀 Ready to Start Onboarding?</div>
          <div className="trigger-description">
            Send the document upload link to the candidate to begin the next phase of onboarding.
            <br />
            <strong>Upload URL:</strong> {candidateData.formUrl}
          </div>
          <button className="btn btn-primary" onClick={triggerOnboarding}>
            🎯 Trigger Onboarding Process
          </button>
        </div>
      </div>

      {/* Success Modal */}
      <div id="successModal" className="modal" style={{ display: showModal ? 'block' : 'none' }}>
        <div className="modal-content">
          <span className="close" onClick={closeModal}>&times;</span>
          <div className="modal-header">
            <div className="modal-icon">✅</div>
            <h2>Onboarding Triggered Successfully!</h2>
          </div>
          <p>The candidate has been notified and will receive the document upload link shortly.</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={closeModal}>Continue</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }

        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
          color: #1f2937;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .header p {
          color: #6b7280;
          font-size: 16px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }

        .candidate-card {
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .avatar {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
        }

        .candidate-info h2 {
          color: #1f2937;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .candidate-info .position {
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .detail-item {
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 3px solid #10b981;
        }

        .detail-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .detail-value {
          font-size: 14px;
          color: #1f2937;
          font-weight: 600;
        }

        .status-card {
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .status-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .status-title {
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
        }

        .status-list {
          list-style: none;
          padding: 12px 0;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .status-item:last-child {
          border-bottom: none;
        }

        .status-badge {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }

        .status-badge.pending {
          background: #f59e0b;
        }

        .action-buttons {
          display: flex;
          gap: 16px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 14px 24px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .onboarding-flow {
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          grid-column: 1 / -1;
        }

        .flow-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .flow-title {
          color: #1f2937;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .flow-subtitle {
          color: #6b7280;
          font-size: 14px;
        }

        .steps {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          position: relative;
        }

        .step-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .step.active .step-circle {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }

        .step.completed .step-circle {
          background: #10b981;
          color: white;
        }

        .step-line {
          position: absolute;
          top: 20px;
          left: 60%;
          right: -40%;
          height: 2px;
          background: #e5e7eb;
          z-index: -1;
        }

        .step:last-child .step-line {
          display: none;
        }

        .step.completed .step-line {
          background: #10b981;
        }

        .step-label {
          font-size: 12px;
          color: #6b7280;
          text-align: center;
          font-weight: 500;
        }

        .trigger-section {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: white;
        }

        .trigger-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .trigger-description {
          font-size: 14px;
          margin-bottom: 20px;
          opacity: 0.9;
        }

        .modal {
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
        }

        .modal-content {
          background-color: white;
          margin: 5% auto;
          padding: 30px;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .modal-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .modal-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 24px;
        }

        .modal-actions {
          text-align: center;
        }

        .close {
          color: #aaa;
          float: right;
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
          line-height: 1;
        }

        .close:hover {
          color: #000;
        }

        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .steps {
            flex-direction: column;
            gap: 20px;
          }

          .step-line {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  console.log('context.params:', context.params); // Debug: Log params
  const { recordId } = (context.params || {}) as { recordId?: string };

  // Check if recordId is missing or not a string
  if (!recordId || typeof recordId !== 'string') {
    console.error('Error: recordId is missing or invalid', context.params);
    return {
      props: {
        error: 'Invalid or missing Record ID. Please ensure the URL is correct.',
      },
    };
  }

  // Validate recordId format
  if (!recordId.match(/^[a-zA-Z0-9]+$/)) {
    console.log('Invalid recordId format:', recordId);
    return { props: { error: 'Invalid Record ID format' } };
  }

  // Check environment variables
  if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_TABLE_ID || !process.env.AIRTABLE_TOKEN) {
    console.error('Missing Airtable environment variables', {
      baseId: process.env.AIRTABLE_BASE_ID,
      tableId: process.env.AIRTABLE_TABLE_ID,
      token: process.env.AIRTABLE_TOKEN ? '[REDACTED]' : 'undefined',
    });
    return {
      props: {
        error: 'Server configuration error: Missing Airtable credentials.',
      },
    };
  }

  try {
    console.log('Fetching Airtable record for ID:', recordId);
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
      console.error('Airtable fetch failed:', response.status, errorText);
      throw new Error(`Airtable fetch failed: ${errorText || 'Record not found'}`);
    }

    const data = await response.json();
    console.log('Airtable data:', data);
    const candidateData: CandidateData = {
      candidateName: data.fields['Name'] || 'Unknown Candidate',
      candidateEmail: data.fields['Email'] || 'N/A',
      candidatePhone: data.fields['Phone'] || 'N/A',
      position: data.fields['Position'] || 'N/A',
      department: data.fields['Department'] || 'N/A',
      startDate: data.fields['Start Date'] || new Date().toISOString(),
      buddyName: data.fields['Buddy'] || 'N/A',
      buddyEmail: data.fields['Buddy Email'] || 'N/A',
      hrRep: data.fields['HR Rep'] || 'N/A',
      recordId: recordId,
      formUrl: data.fields['Form URL'] || '#',
      identityProofUrl: data.fields['Identity Proof']?.[0]?.url || undefined,
      addressProofUrl: data.fields['Address Proof']?.[0]?.url || undefined,
      offerLetterUrl: data.fields['Offer Letter']?.[0]?.url || undefined,
    };

    return { props: { candidateData } };
  } catch (err) {
    console.error('getServerSideProps Error:', err);
    return {
      props: {
        error: 'Failed to load candidate details. Please check your Record ID or Airtable configuration.',
      },
    };
  }
};
