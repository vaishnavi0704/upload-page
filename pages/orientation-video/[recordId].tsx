import { GetServerSideProps } from 'next';
import { useState, useEffect, useRef, useCallback } from 'react';

// Define the YouTube Player interface for TypeScript
interface YouTubePlayer {
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

// Extend the Window interface to include YouTube API
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: {
      Player: new (
        elementId: string,
        config: {
          height: string;
          width: string;
          videoId: string;
          playerVars: {
            autoplay: number;
            controls: number;
            disablekb: number;
            fs: number;
            modestbranding: number;
            rel: number;
          };
          events: {
            onReady: (event: { target: YouTubePlayer }) => void;
            onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
  }
}

interface Props {
  candidateName: string;
  recordId: string;
  error?: string;
}

export default function OrientationVideo({ candidateName, recordId, error }: Props) {
  const [videoWatched, setVideoWatched] = useState(false);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProgressTracking = useCallback((playerInstance: YouTubePlayer) => {
    stopProgressTracking(); // Clear any existing interval

    progressIntervalRef.current = setInterval(() => {
      try {
        const currentTime = playerInstance.getCurrentTime();
        const duration = playerInstance.getDuration();
        if (duration > 0) {
          const progress = Math.min((currentTime / duration) * 100, 100);
          setWatchProgress(progress);
        }
      } catch (error) {
        console.error('Error tracking progress:', error);
      }
    }, 1000);
  }, []); // Empty dependency array since startProgressTracking doesn't depend on props/state

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []); // Empty dependency array for stability

  useEffect(() => {
    // Load YouTube API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      const newPlayer = new window.YT.Player('youtube-player', {
        height: '450',
        width: '100%',
        videoId: 'p7iwXvBnbIE',
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 1,
          fs: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event: { target: YouTubePlayer }) => {
            event.target.setPlaybackRate(1);
            console.log('YouTube player ready');
          },
          onStateChange: (event: { data: number; target: YouTubePlayer }) => {
            console.log('Player state changed:', event.data);
            if (event.data === window.YT.PlayerState.PLAYING) {
              setVideoStarted(true);
              startProgressTracking(event.target);
            }
            if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              stopProgressTracking();
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              setVideoWatched(true);
              setWatchProgress(100);
            }
          },
        },
      });
      setPlayer(newPlayer);
    };

    return () => {
      stopProgressTracking();
      if (player) {
        player.destroy();
      }
    };
  }, [player, startProgressTracking, stopProgressTracking]); // Include stable dependencies

  const handleSubmit = async () => {
    if (!videoWatched || isSubmitting) return;

    setIsSubmitting(true);
    console.log('Starting video confirmation submission for recordId:', recordId);

    try {
      const response = await fetch('/api/submit-video-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recordId }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const responseText = await response.text();
      console.log('Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Server returned invalid response: ${responseText}`);
      }

      if (!response.ok) {
        console.error('API Error:', data);
        throw new Error(data.error || `HTTP ${response.status}: ${data.details || 'Unknown error'}`);
      }

      setSubmitSuccess(true);
      console.log('Submission successful:', data);

      // Show success message
      setTimeout(() => {
        alert('Video confirmation submitted successfully! Your onboarding will continue to the next step.');
      }, 500);
    } catch (error) {
      console.error('Submission error details:', error);

      let errorMessage = 'Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      alert(`Failed to submit confirmation: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '1000px',
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
            🎥
          </div>
          <div>
            <h1 style={{
              color: '#1f2937',
              fontSize: '24px',
              fontWeight: '700',
              margin: 0,
              marginBottom: '4px'
            }}>
              Orientation Video
            </h1>
            <p style={{
              color: '#6b7280',
              fontSize: '14px',
              margin: 0
            }}>
              Complete your onboarding journey
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '40px 20px' }}>
        <div style={{
          maxWidth: '1000px',
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
              background: submitSuccess
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '32px'
            }}>
              {submitSuccess ? '✅' : '👋'}
            </div>
            <h2 style={{
              color: '#1f2937',
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '8px'
            }}>
              {submitSuccess ? 'Orientation Complete!' : `Welcome, ${candidateName}!`}
            </h2>
            <p style={{
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '20px'
            }}>
              {submitSuccess
                ? 'Thank you for completing the orientation video. Your onboarding process will continue shortly.'
                : 'Please watch our orientation video to learn about our company culture, values, and what to expect in your new role.'
              }
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

          {/* Video Section */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: videoWatched
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                {videoWatched ? '✅' : '📹'}
              </div>
              <div>
                <h3 style={{
                  color: '#1f2937',
                  fontSize: '20px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '4px'
                }}>
                  Company Orientation Video
                </h3>
                <p style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  margin: 0
                }}>
                  {videoWatched ? 'Video completed! ✅' : videoStarted ? 'Currently watching...' : 'Ready to start'}
                </p>
              </div>
            </div>

            {/* Video Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '800px',
              margin: '0 auto',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
            }}>
              <div id="youtube-player" style={{
                borderRadius: '12px',
                overflow: 'hidden'
              }}></div>
            </div>

            {/* Progress Bar */}
            {videoStarted && (
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Watch Progress
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: videoWatched ? '#059669' : '#667eea'
                  }}>
                    {Math.round(watchProgress)}%
                  </span>
                </div>
                <div style={{
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  height: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    background: videoWatched
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #667eea, #764ba2)',
                    height: '100%',
                    borderRadius: '8px',
                    width: `${watchProgress}%`,
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions Card */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '20px', marginTop: '2px' }}>💡</div>
              <div>
                <h4 style={{
                  color: '#1e40af',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Important Instructions
                </h4>
                <ul style={{
                  color: '#1e40af',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  margin: 0,
                  paddingLeft: '16px'
                }}>
                  <li>Please watch the entire video from start to finish</li>
                  <li>The video cannot be skipped or fast-forwarded</li>
                  <li>You must complete the full video to proceed</li>
                  <li>Click &quot;Complete Orientation&quot; once the video has finished</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Section */}
          {!submitSuccess && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              {videoWatched ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '20px' }}>🎉</div>
                    <span style={{
                      color: '#065f46',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      Congratulations! You&apos;ve completed the orientation video.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '20px' }}>⏳</div>
                    <span style={{
                      color: '#92400e',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      Please watch the complete video before proceeding.
                    </span>
                  </div>
                </div>
              )}

              {/* Debug Info */}
              <div style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#374151'
              }}>
                <strong>Debug Info:</strong><br />
                Record ID: {recordId}<br />
                Video Watched: {videoWatched ? 'Yes' : 'No'}<br />
                Video Started: {videoStarted ? 'Yes' : 'No'}<br />
                Progress: {watchProgress.toFixed(1)}%
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
                {/* Test API Button */}
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/submit-video-confirmation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recordId }),
                      });
                      const data = await response.text();
                      alert(`API Test Result:\nStatus: ${response.status}\nResponse: ${data}`);
                    } catch (error) {
                      alert(`API Test Error: ${error}`);
                    }
                  }}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🧪 Test API
                </button>

                {/* Force Complete Button (for testing) */}
                <button
                  onClick={() => {
                    setVideoWatched(true);
                    setWatchProgress(100);
                    alert('Video marked as watched for testing');
                  }}
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🎯 Force Complete
                </button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!videoWatched || isSubmitting}
                style={{
                  background: (!videoWatched || isSubmitting)
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (!videoWatched || isSubmitting) ? 'not-allowed' : 'pointer',
                  boxShadow: (!videoWatched || isSubmitting)
                    ? 'none'
                    : '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease',
                  transform: (!videoWatched || isSubmitting) ? 'none' : 'translateY(0)',
                  minWidth: '200px',
                  opacity: (!videoWatched || isSubmitting) ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (videoWatched && !isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (videoWatched && !isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                {isSubmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Submitting...
                  </div>
                ) : videoWatched ? (
                  <>✅ Complete Orientation</>
                ) : (
                  <>⏳ Watch Video First</>
                )}
              </button>

              <p style={{
                color: '#6b7280',
                fontSize: '13px',
                marginTop: '16px',
                lineHeight: '1.4'
              }}>
                {videoWatched
                  ? 'Click the button above to confirm you&apos;ve completed the orientation video.'
                  : 'The button will become available once you finish watching the video.'
                }
              </p>
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '24px'
                }}>
                  ✅
                </div>
                <h3 style={{
                  color: '#065f46',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Orientation Successfully Completed!
                </h3>
                <p style={{
                  color: '#065f46',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  Your orientation video confirmation has been submitted. You will receive further instructions for the next steps in your onboarding process.
                </p>
              </div>
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
        Need help? Contact our support team for assistance.
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
