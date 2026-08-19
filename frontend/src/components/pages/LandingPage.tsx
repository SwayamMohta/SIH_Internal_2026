import React from 'react';
import { GazetteHeader } from '../gazette/GazetteHeader';

interface LandingPageProps {
  onStartVerification: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartVerification }) => {
  return (
    <div className="newspaper-bg-texture" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <GazetteHeader activePage="verification" />

      {/* Main Container */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 0 60px 0',
      }}>
        <div className="gazette-container">

          {/* ── Hero Section ── */}
          <section style={{
            display: 'flex',
            gap: '48px',
            alignItems: 'stretch',
          }}>
            {/* Left Column: Typography & Action */}
            <div style={{
              flex: '1 1 0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: '48px',
              borderRight: '1px solid var(--color-primary)',
              gap: '24px',
            }}>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '52px',
                  lineHeight: '1.12',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-primary)',
                  margin: '0 0 18px 0',
                }}>
                  Verify Your Publication Title
                </h1>
                
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '20px',
                  lineHeight: '32px',
                  fontStyle: 'italic',
                  color: 'var(--color-on-surface-variant)',
                  margin: '0 0 28px 0',
                  maxWidth: '780px',
                }}>
                  Automated preliminary assessment of a proposed publication title against the locally imported PRGI corpus and pending applications.
                </p>

                {/* Primary CTA */}
                <div>
                  <button
                    className="btn-gazette-primary"
                    onClick={onStartVerification}
                    id="start-verification-btn"
                    style={{
                      padding: '14px 28px',
                      fontSize: '13px',
                      letterSpacing: '0.06em',
                      borderRadius: '6px',
                    }}
                  >
                    Start New Verification
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Matching PRGI Press Engraving Illustration */}
            <div style={{
              width: '320px',
              flexShrink: 0,
              border: '1px solid var(--color-primary)',
              borderRadius: '6px',
              padding: '6px',
              backgroundColor: '#f4f1ea',
              boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              alignSelf: 'center',
            }}>
              <img 
                src="/prgi_gazette_press_illustration.jpg" 
                alt="Press Registration of India Vintage Printing Press Engraving Illustration"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '400px',
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: '4px',
                  border: '1px solid var(--color-primary)',
                }}
              />
            </div>
          </section>



        </div>
      </main>
    </div>
  );
};

export default LandingPage;
