// import { GetServerSideProps } from 'next';
// import { useState, useEffect, useRef, useCallback } from 'react';

// // Define the YouTube Player interface for TypeScript
// interface YouTubePlayer {
//   setPlaybackRate: (rate: number) => void;
//   getCurrentTime: () => number;
//   getDuration: () => number;
//   destroy: () => void;
// }

// // Extend the Window interface to include YouTube API
// declare global {
//   interface Window {
//     onYouTubeIframeAPIReady: () => void;
//     YT: {
//       Player: new (
//         elementId: string,
//         config: {
//           height: string;
//           width: string;
//           videoId: string;
//           playerVars: {
//             autoplay: number;
//             controls: number;
//             disablekb: number;
//             fs: number;
//             modestbranding: number;
//             rel: number;
//           };
//           events: {
//             onReady: (event: { target: YouTubePlayer }) => void;
//             onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
//           };
//         }
//       ) => YouTubePlayer;
//       PlayerState: {
//         PLAYING: number;
//         PAUSED: number;
//         ENDED: number;
//       };
//     };
//   }
// }

// interface Props {
//   candidateName: string;
//   recordId: string;
//   error?: string;
// }

// // Quiz questions related to the orientation video
// const QUIZ_QUESTIONS = [
//   {
//     id: 1,
//     question: "What are the core values mentioned in our company culture?",
//     options: [
//       "Innovation, Integrity, and Collaboration",
//       "Speed, Profit, and Growth",
//       "Competition, Success, and Excellence",
//       "Technology, Marketing, and Sales"
//     ],
//     correctAnswer: 0
//   },
//   {
//     id: 2,
//     question: "What is the expected dress code for office days?",
//     options: [
//       "Formal business attire",
//       "Business casual",
//       "Casual comfortable clothing",
//       "Uniform provided by company"
//     ],
//     correctAnswer: 1
//   },
//   {
//     id: 3,
//     question: "How many days of paid time off (PTO) do new employees receive annually?",
//     options: [
//       "10 days",
//       "15 days",
//       "20 days",
//       "25 days"
//     ],
//     correctAnswer: 2
//   }
// ];

// export default function OrientationVideo({ candidateName, recordId, error }: Props) {
//   const [videoWatched, setVideoWatched] = useState(false);
//   const [player, setPlayer] = useState<YouTubePlayer | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [watchProgress, setWatchProgress] = useState(0);
//   const [videoStarted, setVideoStarted] = useState(false);
//   const [submitSuccess, setSubmitSuccess] = useState(false);
  
//   // Quiz state
//   const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
//   const [showQuiz, setShowQuiz] = useState(false);
//   const [quizCompleted, setQuizCompleted] = useState(false);
  
//   const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

//   const startProgressTracking = useCallback((playerInstance: YouTubePlayer) => {
//     stopProgressTracking();

//     progressIntervalRef.current = setInterval(() => {
//       try {
//         const currentTime = playerInstance.getCurrentTime();
//         const duration = playerInstance.getDuration();
//         if (duration > 0) {
//           const progress = Math.min((currentTime / duration) * 100, 100);
//           setWatchProgress(progress);
//         }
//       } catch (error) {
//         console.error('Error tracking progress:', error);
//       }
//     }, 1000);
//   }, []);

//   const stopProgressTracking = useCallback(() => {
//     if (progressIntervalRef.current) {
//       clearInterval(progressIntervalRef.current);
//       progressIntervalRef.current = null;
//     }
//   }, []);

//   useEffect(() => {
//     const tag = document.createElement('script');
//     tag.src = 'https://www.youtube.com/iframe_api';
//     const firstScriptTag = document.getElementsByTagName('script')[0];
//     firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

//     window.onYouTubeIframeAPIReady = () => {
//       const newPlayer = new window.YT.Player('youtube-player', {
//         height: '450',
//         width: '100%',
//         videoId: 'kcckpWgkhP0',
//         playerVars: {
//           autoplay: 0,
//           controls: 1,
//           disablekb: 1,
//           fs: 1,
//           modestbranding: 1,
//           rel: 0,
//         },
//         events: {
//           onReady: (event: { target: YouTubePlayer }) => {
//             event.target.setPlaybackRate(1);
//           },
//           onStateChange: (event: { data: number; target: YouTubePlayer }) => {
//             if (event.data === window.YT.PlayerState.PLAYING) {
//               setVideoStarted(true);
//               startProgressTracking(event.target);
//             }
//             if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
//               stopProgressTracking();
//             }
//             if (event.data === window.YT.PlayerState.ENDED) {
//               setVideoWatched(true);
//               setWatchProgress(100);
//               setShowQuiz(true);
//             }
//           },
//         },
//       });
//       setPlayer(newPlayer);
//     };

//     return () => {
//       stopProgressTracking();
//       if (player) {
//         player.destroy();
//       }
//     };
//   }, [player, startProgressTracking, stopProgressTracking]);

//   const handleQuizAnswerChange = (questionId: number, answerIndex: number) => {
//     setQuizAnswers(prev => ({
//       ...prev,
//       [questionId]: answerIndex
//     }));
//   };

//   const handleQuizSubmit = () => {
//     // Check if all questions are answered
//     const allAnswered = QUIZ_QUESTIONS.every(q => quizAnswers[q.id] !== undefined);
    
//     if (!allAnswered) {
//       alert('Please answer all questions before proceeding.');
//       return;
//     }

//     setQuizCompleted(true);
//   };

//   const handleSubmit = async () => {
//     if (!videoWatched || !quizCompleted || isSubmitting) return;

//     setIsSubmitting(true);

//     try {
//       const response = await fetch('/api/submit-video-confirmation', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ 
//           recordId,
//           quizAnswers: quizAnswers
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to submit confirmation');
//       }

//       setSubmitSuccess(true);
      
//       setTimeout(() => {
//         alert('Orientation completed successfully! You will be redirected to the next step.');
//       }, 500);
//     } catch (error) {
//       console.error('Submission error:', error);
      
//       let errorMessage = 'Please try again.';
//       if (error instanceof Error) {
//         errorMessage = error.message;
//       }

//       alert(`Failed to submit confirmation: ${errorMessage}`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   if (error) {
//     return (
//       <div style={{
//         minHeight: '100vh',
//         background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         padding: '20px',
//         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
//       }}>
//         <div style={{
//           background: 'white',
//           borderRadius: '16px',
//           boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
//           padding: '40px',
//           maxWidth: '400px',
//           width: '100%',
//           textAlign: 'center'
//         }}>
//           <div style={{
//             width: '60px',
//             height: '60px',
//             background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
//             borderRadius: '50%',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             margin: '0 auto 20px',
//             color: 'white',
//             fontSize: '24px'
//           }}>
//             ⚠️
//           </div>
//           <h2 style={{ color: '#333', marginBottom: '10px', fontSize: '20px' }}>Oops! Something went wrong</h2>
//           <p style={{ color: '#666', fontSize: '14px' }}>{error}</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={{
//       minHeight: '100vh',
//       background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//       fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
//     }}>
//       {/* Header */}
//       <div style={{
//         background: 'rgba(255,255,255,0.95)',
//         backdropFilter: 'blur(10px)',
//         borderBottom: '1px solid rgba(255,255,255,0.2)',
//         padding: '20px 0'
//       }}>
//         <div style={{
//           maxWidth: '1000px',
//           margin: '0 auto',
//           padding: '0 20px',
//           display: 'flex',
//           alignItems: 'center',
//           gap: '16px'
//         }}>
//           <div style={{
//             width: '48px',
//             height: '48px',
//             background: 'linear-gradient(135deg, #667eea, #764ba2)',
//             borderRadius: '12px',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             color: 'white',
//             fontSize: '20px'
//           }}>
//             🎥
//           </div>
//           <div>
//             <h1 style={{
//               color: '#1f2937',
//               fontSize: '24px',
//               fontWeight: '700',
//               margin: 0,
//               marginBottom: '4px'
//             }}>
//               Orientation Video
//             </h1>
//             <p style={{
//               color: '#6b7280',
//               fontSize: '14px',
//               margin: 0
//             }}>
//               Complete your onboarding journey
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div style={{ padding: '40px 20px' }}>
//         <div style={{
//           maxWidth: '1000px',
//           margin: '0 auto'
//         }}>
//           {/* Welcome Card */}
//           <div style={{
//             background: 'white',
//             borderRadius: '16px',
//             padding: '32px',
//             marginBottom: '32px',
//             boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
//             textAlign: 'center'
//           }}>
//             <div style={{
//               width: '80px',
//               height: '80px',
//               background: submitSuccess
//                 ? 'linear-gradient(135deg, #10b981, #059669)'
//                 : 'linear-gradient(135deg, #f59e0b, #d97706)',
//               borderRadius: '50%',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               margin: '0 auto 20px',
//               fontSize: '32px'
//             }}>
//               {submitSuccess ? '✅' : '👋'}
//             </div>
//             <h2 style={{
//               color: '#1f2937',
//               fontSize: '28px',
//               fontWeight: '700',
//               marginBottom: '8px'
//             }}>
//               {submitSuccess ? 'Orientation Complete!' : `Welcome, ${candidateName}!`}
//             </h2>
//             <p style={{
//               color: '#6b7280',
//               fontSize: '16px',
//               lineHeight: '1.6',
//               marginBottom: '0'
//             }}>
//               {submitSuccess
//                 ? 'Thank you for completing the orientation video. Your onboarding process will continue shortly.'
//                 : 'Please watch our orientation video to learn about our company culture, values, and what to expect in your new role.'
//               }
//             </p>
//           </div>

//           {/* Video Section */}
//           <div style={{
//             background: 'white',
//             borderRadius: '16px',
//             padding: '32px',
//             marginBottom: '32px',
//             boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
//           }}>
//             <div style={{
//               display: 'flex',
//               alignItems: 'center',
//               gap: '12px',
//               marginBottom: '24px'
//             }}>
//               <div style={{
//                 width: '40px',
//                 height: '40px',
//                 background: videoWatched
//                   ? 'linear-gradient(135deg, #10b981, #059669)'
//                   : 'linear-gradient(135deg, #ef4444, #dc2626)',
//                 borderRadius: '10px',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '18px'
//               }}>
//                 {videoWatched ? '✅' : '📹'}
//               </div>
//               <div>
//                 <h3 style={{
//                   color: '#1f2937',
//                   fontSize: '20px',
//                   fontWeight: '600',
//                   margin: 0,
//                   marginBottom: '4px'
//                 }}>
//                   Company Orientation Video
//                 </h3>
//                 <p style={{
//                   color: '#6b7280',
//                   fontSize: '14px',
//                   margin: 0
//                 }}>
//                   {videoWatched ? 'Video completed! ✅' : videoStarted ? 'Currently watching...' : 'Ready to start'}
//                 </p>
//               </div>
//             </div>

//             {/* Video Container */}
//             <div style={{
//               position: 'relative',
//               width: '100%',
//               maxWidth: '800px',
//               margin: '0 auto',
//               borderRadius: '12px',
//               overflow: 'hidden',
//               boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
//             }}>
//               <div id="youtube-player" style={{
//                 borderRadius: '12px',
//                 overflow: 'hidden'
//               }}></div>
//             </div>

//             {/* Progress Bar */}
//             {videoStarted && !videoWatched && (
//               <div style={{ marginTop: '24px' }}>
//                 <div style={{
//                   display: 'flex',
//                   justifyContent: 'space-between',
//                   alignItems: 'center',
//                   marginBottom: '8px'
//                 }}>
//                   <span style={{
//                     fontSize: '14px',
//                     fontWeight: '500',
//                     color: '#374151'
//                   }}>
//                     Watch Progress
//                   </span>
//                   <span style={{
//                     fontSize: '14px',
//                     fontWeight: '600',
//                     color: '#667eea'
//                   }}>
//                     {Math.round(watchProgress)}%
//                   </span>
//                 </div>
//                 <div style={{
//                   background: '#f3f4f6',
//                   borderRadius: '8px',
//                   height: '8px',
//                   overflow: 'hidden'
//                 }}>
//                   <div style={{
//                     background: 'linear-gradient(135deg, #667eea, #764ba2)',
//                     height: '100%',
//                     borderRadius: '8px',
//                     width: `${watchProgress}%`,
//                     transition: 'width 0.3s ease'
//                   }}></div>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Instructions Card */}
//           {!videoWatched && (
//             <div style={{
//               background: 'rgba(59, 130, 246, 0.1)',
//               border: '1px solid rgba(59, 130, 246, 0.3)',
//               borderRadius: '12px',
//               padding: '20px',
//               marginBottom: '32px'
//             }}>
//               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
//                 <div style={{ fontSize: '20px', marginTop: '2px' }}>💡</div>
//                 <div>
//                   <h4 style={{
//                     color: '#1e40af',
//                     fontSize: '14px',
//                     fontWeight: '600',
//                     marginBottom: '8px'
//                   }}>
//                     Important Instructions
//                   </h4>
//                   <ul style={{
//                     color: '#FFFFFF',
//                     fontSize: '13px',
//                     lineHeight: '1.5',
//                     margin: 0,
//                     paddingLeft: '16px'
//                   }}>
//                     <li>Watch the complete orientation video from start to finish</li>
//                     <li>After the video ends, answer 3 questions about the content</li>
//                     <li>Once you complete the quiz, you can submit your orientation</li>
//                   </ul>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Quiz Section */}
//           {showQuiz && !submitSuccess && (
//             <div style={{
//               background: 'white',
//               borderRadius: '16px',
//               padding: '32px',
//               marginBottom: '32px',
//               boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
//             }}>
//               <div style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '12px',
//                 marginBottom: '24px'
//               }}>
//                 <div style={{
//                   width: '40px',
//                   height: '40px',
//                   background: quizCompleted
//                     ? 'linear-gradient(135deg, #10b981, #059669)'
//                     : 'linear-gradient(135deg, #f59e0b, #d97706)',
//                   borderRadius: '10px',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   fontSize: '18px'
//                 }}>
//                   {quizCompleted ? '✅' : '📝'}
//                 </div>
//                 <div>
//                   <h3 style={{
//                     color: '#1f2937',
//                     fontSize: '20px',
//                     fontWeight: '600',
//                     margin: 0,
//                     marginBottom: '4px'
//                   }}>
//                     Orientation Quiz
//                   </h3>
//                   <p style={{
//                     color: '#6b7280',
//                     fontSize: '14px',
//                     margin: 0
//                   }}>
//                     {quizCompleted ? 'Quiz completed! ✅' : 'Answer the following questions based on the video'}
//                   </p>
//                 </div>
//               </div>

//               {QUIZ_QUESTIONS.map((question, index) => (
//                 <div key={question.id} style={{
//                   marginBottom: '24px',
//                   paddingBottom: '24px',
//                   borderBottom: index < QUIZ_QUESTIONS.length - 1 ? '1px solid #e5e7eb' : 'none'
//                 }}>
//                   <p style={{
//                     color: '#1f2937',
//                     fontSize: '15px',
//                     fontWeight: '600',
//                     marginBottom: '12px'
//                   }}>
//                     {index + 1}. {question.question}
//                   </p>
//                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
//                     {question.options.map((option, optionIndex) => (
//                       <label
//                         key={optionIndex}
//                         style={{
//                           display: 'flex',
//                           alignItems: 'center',
//                           padding: '12px',
//                           background: quizAnswers[question.id] === optionIndex
//                             ? 'rgba(102, 126, 234, 0.1)'
//                             : '#f9fafb',
//                           border: quizAnswers[question.id] === optionIndex
//                             ? '2px solid #667eea'
//                             : '2px solid #e5e7eb',
//                           borderRadius: '8px',
//                           cursor: quizCompleted ? 'not-allowed' : 'pointer',
//                           transition: 'all 0.2s ease',
//                           opacity: quizCompleted ? 0.6 : 1
//                         }}
//                       >
//                         <input
//                           type="radio"
//                           name={`question-${question.id}`}
//                           value={optionIndex}
//                           checked={quizAnswers[question.id] === optionIndex}
//                           onChange={() => !quizCompleted && handleQuizAnswerChange(question.id, optionIndex)}
//                           disabled={quizCompleted}
//                           style={{ marginRight: '12px', cursor: quizCompleted ? 'not-allowed' : 'pointer' }}
//                         />
//                         <span style={{
//                           color: '#374151',
//                           fontSize: '14px'
//                         }}>
//                           {option}
//                         </span>
//                       </label>
//                     ))}
//                   </div>
//                 </div>
//               ))}

//               {!quizCompleted && (
//                 <button
//                   onClick={handleQuizSubmit}
//                   style={{
//                     width: '100%',
//                     background: 'linear-gradient(135deg, #667eea, #764ba2)',
//                     color: 'white',
//                     border: 'none',
//                     borderRadius: '12px',
//                     padding: '14px 24px',
//                     fontSize: '15px',
//                     fontWeight: '600',
//                     cursor: 'pointer',
//                     boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
//                     transition: 'all 0.3s ease'
//                   }}
//                   onMouseOver={(e) => {
//                     e.currentTarget.style.transform = 'translateY(-2px)';
//                     e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
//                   }}
//                   onMouseOut={(e) => {
//                     e.currentTarget.style.transform = 'translateY(0)';
//                     e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
//                   }}
//                 >
//                   Submit Quiz Answers
//                 </button>
//               )}
//             </div>
//           )}

//           {/* Submit Section */}
//           {videoWatched && quizCompleted && !submitSuccess && (
//             <div style={{
//               background: 'white',
//               borderRadius: '16px',
//               padding: '32px',
//               boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
//               textAlign: 'center'
//             }}>
//               <div style={{
//                 background: 'rgba(16, 185, 129, 0.1)',
//                 border: '1px solid rgba(16, 185, 129, 0.3)',
//                 borderRadius: '12px',
//                 padding: '16px',
//                 marginBottom: '24px'
//               }}>
//                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
//                   <div style={{ fontSize: '20px' }}>🎉</div>
//                   <span style={{
//                     color: '#065f46',
//                     fontSize: '14px',
//                     fontWeight: '500'
//                   }}>
//                     Great job! You&apos;ve completed the video and quiz.
//                   </span>
//                 </div>
//               </div>

//               <button
//                 onClick={handleSubmit}
//                 disabled={isSubmitting}
//                 style={{
//                   background: isSubmitting
//                     ? '#9ca3af'
//                     : 'linear-gradient(135deg, #10b981, #059669)',
//                   color: 'white',
//                   border: 'none',
//                   borderRadius: '12px',
//                   padding: '16px 32px',
//                   fontSize: '16px',
//                   fontWeight: '600',
//                   cursor: isSubmitting ? 'not-allowed' : 'pointer',
//                   boxShadow: isSubmitting
//                     ? 'none'
//                     : '0 4px 12px rgba(16, 185, 129, 0.4)',
//                   transition: 'all 0.3s ease',
//                   minWidth: '200px',
//                   opacity: isSubmitting ? 0.6 : 1
//                 }}
//                 onMouseOver={(e) => {
//                   if (!isSubmitting) {
//                     e.currentTarget.style.transform = 'translateY(-2px)';
//                     e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
//                   }
//                 }}
//                 onMouseOut={(e) => {
//                   if (!isSubmitting) {
//                     e.currentTarget.style.transform = 'translateY(0)';
//                     e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
//                   }
//                 }}
//               >
//                 {isSubmitting ? (
//                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
//                     <div style={{
//                       width: '16px',
//                       height: '16px',
//                       border: '2px solid rgba(255,255,255,0.3)',
//                       borderTop: '2px solid white',
//                       borderRadius: '50%',
//                       animation: 'spin 1s linear infinite'
//                     }}></div>
//                     Submitting...
//                   </div>
//                 ) : (
//                   <>✅ Complete Orientation</>
//                 )}
//               </button>

//               <p style={{
//                 color: '#6b7280',
//                 fontSize: '13px',
//                 marginTop: '16px',
//                 lineHeight: '1.4'
//               }}>
//                 Click the button above to confirm you&apos;ve completed the orientation.
//               </p>
//             </div>
//           )}

//           {/* Success Message */}
//           {submitSuccess && (
//             <div style={{
//               background: 'white',
//               borderRadius: '16px',
//               padding: '32px',
//               boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
//               textAlign: 'center'
//             }}>
//               <div style={{
//                 background: 'rgba(16, 185, 129, 0.1)',
//                 border: '1px solid rgba(16, 185, 129, 0.3)',
//                 borderRadius: '12px',
//                 padding: '24px'
//               }}>
//                 <div style={{
//                   width: '60px',
//                   height: '60px',
//                   background: 'linear-gradient(135deg, #10b981, #059669)',
//                   borderRadius: '50%',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   margin: '0 auto 16px',
//                   fontSize: '24px'
//                 }}>
//                   ✅
//                 </div>
//                 <h3 style={{
//                   color: '#065f46',
//                   fontSize: '18px',
//                   fontWeight: '600',
//                   marginBottom: '8px'
//                 }}>
//                   Orientation Successfully Completed!
//                 </h3>
//                 <p style={{
//                   color: '#065f46',
//                   fontSize: '14px',
//                   lineHeight: '1.5'
//                 }}>
//                   Your orientation video confirmation has been submitted. You will receive further instructions for the next steps in your onboarding process.
//                 </p>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Footer */}
//       <div style={{
//         textAlign: 'center',
//         padding: '20px',
//         color: 'rgba(255,255,255,0.8)',
//         fontSize: '13px'
//       }}>
//         Need help? Contact our HR team at support@company.com
//       </div>

//       <style jsx>{`
//         @keyframes spin {
//           0% { transform: rotate(0deg); }
//           100% { transform: rotate(360deg); }
//         }
//       `}</style>
//     </div>
//   );
// }

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const { recordId } = context.params as { recordId: string };

//   if (!recordId.match(/^[a-zA-Z0-9]+$/)) {
//     return { props: { candidateName: '', recordId: '', error: 'Invalid Record ID format' } };
//   }

//   try {
//     const response = await fetch(
//       `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}/${recordId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
//         },
//       }
//     );

//     if (!response.ok) {
//       throw new Error('Record not found');
//     }

//     const data = await response.json();
//     const candidateName = data.fields.Name || 'Candidate';

//     return { props: { candidateName, recordId } };
//   } catch (err) {
//     console.error('getServerSideProps Error:', err);
//     return { 
//       props: { 
//         candidateName: '', 
//         recordId: '', 
//         error: 'Failed to load candidate details. Please check your Record ID.' 
//       } 
//     };
//   }
// };



import { GetServerSideProps } from 'next';
import { useState, useEffect, useRef, useCallback } from 'react';

// --- SVG Icons ---
const IconVideoCamera = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
  </svg>
);
const IconUser = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="32" height="32" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A1.5 1.5 0 0118 21.75H6a1.5 1.5 0 01-1.499-1.632z" />
  </svg>
);
const IconPencil = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);
const IconLightBulb = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v.01M7.702 4.577a.75.75 0 01.043.96l-1.76 4.4a.75.75 0 00.32 1.018l3.6-1.8a.75.75 0 01.96.043l2.47 2.47a.75.75 0 01.043.96l-1.76 4.4a.75.75 0 00.32 1.018l3.6-1.8a.75.75 0 01.96.043l2.47 2.47a.75.75 0 01.043.96l-1.76 4.4a.75.75 0 00.32 1.018l3.6-1.8a.75.75 0 01.96.043c.41.41.62.97.62 1.56a3.75 3.75 0 01-3.75 3.75H9.75A3.75 3.75 0 016 18c0-.59.21-1.15.62-1.56.41-.41.62-.97.62-1.56l-1.76-4.4a.75.75 0 00.32-1.018l3.6 1.8a.75.75 0 01.96-.043l2.47-2.47a.75.75 0 01.043-.96l-1.76-4.4a.75.75 0 00.32-1.018l3.6 1.8a.75.75 0 01.96-.043l2.47-2.47a.75.75 0 01.043-.96l-1.76-4.4a.75.75 0 00-.32-1.018l-3.6 1.8a.75.75 0 01-.96.043L9.75 6.03a.75.75 0 01-.043-.96l1.76-4.4a.75.75 0 00-.32-1.018l-3.6 1.8a.75.75 0 01-.96.043z" />
  </svg>
);
const IconCheck = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="32" height="32" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
const IconWarning = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48" strokeWidth={1.5} style={{ color: '#ef4444', marginBottom: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);


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

// Quiz questions related to the orientation video
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "What are the core values mentioned in our company culture?",
    options: [
      "Innovation, Integrity, and Collaboration",
      "Speed, Profit, and Growth",
      "Competition, Success, and Excellence",
      "Technology, Marketing, and Sales"
    ],
    correctAnswer: 0
  },
  {
    id: 2,
    question: "What is the expected dress code for office days?",
    options: [
      "Formal business attire",
      "Business casual",
      "Casual comfortable clothing",
      "Uniform provided by company"
    ],
    correctAnswer: 1
  },
  {
    id: 3,
    question: "How many days of paid time off (PTO) do new employees receive annually?",
    options: [
      "10 days",
      "15 days",
      "20 days",
      "25 days"
    ],
    correctAnswer: 2
  }
];

export default function OrientationVideo({ candidateName, recordId, error }: Props) {
  const [videoWatched, setVideoWatched] = useState(false);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProgressTracking = useCallback((playerInstance: YouTubePlayer) => {
    stopProgressTracking();

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
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      const newPlayer = new window.YT.Player('youtube-player', {
        height: '450', // This height (450) is 16:9 for the 800px max-width container
        width: '100%',
        videoId: 'kcckpWgkhP0',
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
          },
          onStateChange: (event: { data: number; target: YouTubePlayer }) => {
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
              setShowQuiz(true);
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
  }, [player, startProgressTracking, stopProgressTracking]);

  const handleQuizAnswerChange = (questionId: number, answerIndex: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const handleQuizSubmit = () => {
    // Check if all questions are answered
    const allAnswered = QUIZ_QUESTIONS.every(q => quizAnswers[q.id] !== undefined);
    
    if (!allAnswered) {
      alert('Please answer all questions before proceeding.');
      return;
    }

    setQuizCompleted(true);
  };

  const handleSubmit = async () => {
    if (!videoWatched || !quizCompleted || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/submit-video-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recordId,
          quizAnswers: quizAnswers
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit confirmation');
      }

      setSubmitSuccess(true);
      
      setTimeout(() => {
        // In a real app, you might redirect: router.push('/next-step');
        alert('Orientation completed successfully! You will be redirected to the next step.');
      }, 500);
    } catch (error) {
      console.error('Submission error:', error);
      
      let errorMessage = 'Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
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
        background: '#f1f5f9', // Light gray background
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
          <IconWarning />
          <h2 style={{ color: '#1f2937', marginBottom: '10px', fontSize: '20px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9', // Light gray background
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // Dark blue header
        borderBottom: '1px solid #334155',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '800px', // Changed: Narrower container
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'rgba(255, 255, 255, 0.1)', // Translucent white
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}>
            <IconVideoCamera />
          </div>
          <div>
            <h1 style={{
              color: 'white',
              fontSize: '24px',
              fontWeight: '700',
              margin: 0,
              marginBottom: '4px'
            }}>
              Orientation Video
            </h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
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
          maxWidth: '800px', // Changed: Narrower container
          margin: '0 auto'
        }}>
          {/* Welcome Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: submitSuccess ? '#dcfce7' : '#dbeafe', // Light green or light blue
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: submitSuccess ? '#10b981' : '#2563eb' // Green or blue
            }}>
              {submitSuccess ? <IconCheck /> : <IconUser />}
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
              marginBottom: '0'
            }}>
              {submitSuccess
                ? 'Thank you for completing the orientation video. Your onboarding process will continue shortly.'
                : 'Please watch our orientation video to learn about our company culture, values, and what to expect in your new role.'
              }
            </p>
          </div>

          {/* Video Section */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
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
                background: videoWatched ? '#dcfce7' : '#fee2e2', // Light green or light red
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: videoWatched ? '#10b981' : '#ef4444' // Green or red
              }}>
                {videoWatched ? <IconCheck /> : <IconVideoCamera />}
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
                  {videoWatched ? 'Video completed!' : videoStarted ? 'Currently watching...' : 'Ready to start'}
                </p>
              </div>
            </div>

            {/* Video Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              margin: '0 auto',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
            }}>
              <div id="youtube-player" style={{
                borderRadius: '12px',
                overflow: 'hidden'
              }}></div>
            </div>

            {/* Progress Bar */}
            {videoStarted && !videoWatched && (
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
                    color: '#2563eb' // Blue accent
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
                    background: '#2563eb', // Blue accent
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
          {!videoWatched && (
            <div style={{
              background: '#f0f9ff', // Light blue
              border: '1px solid #dbeafe',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '32px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '20px', marginTop: '2px', color: '#2563eb' }}>
                  <IconLightBulb />
                </div>
                <div>
                  <h4 style={{
                    color: '#1e40af',
                    fontSize: '14px',
                    fontWeight: '600',
                    margin: 0,
                    marginBottom: '8px'
                  }}>
                    Important Instructions
                  </h4>
                  <ul style={{
                    color: '#0369a1',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    margin: 0,
                    paddingLeft: '16px'
                  }}>
                    <li>Watch the complete orientation video from start to finish</li>
                    <li>After the video ends, answer 3 questions about the content</li>
                    <li>Once you complete the quiz, you can submit your orientation</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Quiz Section */}
          {showQuiz && !submitSuccess && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
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
                  background: quizCompleted ? '#dcfce7' : '#dbeafe', // Light green or light blue
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: quizCompleted ? '#10b981' : '#2563eb' // Green or blue
                }}>
                  {quizCompleted ? <IconCheck /> : <IconPencil />}
                </div>
                <div>
                  <h3 style={{
                    color: '#1f2937',
                    fontSize: '20px',
                    fontWeight: '600',
                    margin: 0,
                    marginBottom: '4px'
                  }}>
                    Orientation Quiz
                  </h3>
                  <p style={{
                    color: '#6b7280',
                    fontSize: '14px',
                    margin: 0
                  }}>
                    {quizCompleted ? 'Quiz completed!' : 'Answer the following questions based on the video'}
                  </p>
                </div>
              </div>

              {QUIZ_QUESTIONS.map((question, index) => (
                <div key={question.id} style={{
                  marginBottom: '24px',
                  paddingBottom: '24px',
                  borderBottom: index < QUIZ_QUESTIONS.length - 1 ? '1px solid #e5e7eb' : 'none'
                }}>
                  <p style={{
                    color: '#1f2937',
                    fontSize: '15px',
                    fontWeight: '600',
                    marginBottom: '12px'
                  }}>
                    {index + 1}. {question.question}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={optionIndex}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          background: quizAnswers[question.id] === optionIndex
                            ? '#f0f9ff' // Light blue
                            : '#f9fafb',
                          border: quizAnswers[question.id] === optionIndex
                            ? '2px solid #2563eb' // Blue
                            : '2px solid #e5e7eb',
                          borderRadius: '8px',
                          cursor: quizCompleted ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: quizCompleted ? 0.6 : 1
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={optionIndex}
                          checked={quizAnswers[question.id] === optionIndex}
                          onChange={() => !quizCompleted && handleQuizAnswerChange(question.id, optionIndex)}
                          disabled={quizCompleted}
                          style={{ marginRight: '12px', cursor: quizCompleted ? 'not-allowed' : 'pointer', accentColor: '#2563eb' }}
                        />
                        <span style={{
                          color: '#374151',
                          fontSize: '14px'
                        }}>
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {!quizCompleted && (
                <button
                  onClick={handleQuizSubmit}
                  style={{
                    width: '100%',
                    background: '#2563eb', // Blue
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                  }}
                >
                  Submit Quiz Answers
                </button>
              )}
            </div>
          )}

          {/* Submit Section */}
          {videoWatched && quizCompleted && !submitSuccess && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              textAlign: 'center'
            }}>
              <div style={{
                background: '#f0fdf4', // Light green
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '20px', color: '#10b981' }}><IconCheck /></div>
                  <span style={{
                    color: '#065f46',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Great job! You&apos;ve completed the video and quiz.
                  </span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? '#9ca3af' : '#2563eb', // Blue
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: isSubmitting
                    ? 'none'
                    : '0 4px 12px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.3s ease',
                  minWidth: '200px',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
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
                ) : (
                  'Complete Orientation'
                )}
              </button>

              <p style={{
                color: '#6b7280',
                fontSize: '13px',
                marginTop: '16px',
                lineHeight: '1.4'
              }}>
                Click the button above to confirm you&apos;ve completed the orientation.
              </p>
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              textAlign: 'center'
            }}>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#dcfce7',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#10b981'
                }}>
                  <IconCheck />
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
        color: '#6b7280', // Dark gray text
        fontSize: '13px'
      }}>
        Need help? Contact our HR team at support@company.com
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
    return { props: { candidateName: '', recordId: '', error: 'Invalid Record ID format' } };
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
      throw new Error('Record not found');
    }

    const data = await response.json();
    const candidateName = data.fields.Name || 'Candidate';

    return { props: { candidateName, recordId } };
  } catch (err) {
    console.error('getServerSideProps Error:', err);
    return { 
      props: { 
        candidateName: '', 
        recordId: '', 
        error: 'Failed to load candidate details. Please check your Record ID.' 
      } 
    };
  }
};
