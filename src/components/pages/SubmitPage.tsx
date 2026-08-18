import React, { useState } from 'react';
import { GazetteHeader } from '../gazette/GazetteHeader';

interface SubmitPageProps {
  onVerify: (data: VerificationData) => void;
  onBack: () => void;
}

export interface VerificationData {
  title: string;
  language: string;
  state: string;
  periodicity: string;
}

export const SubmitPage: React.FC<SubmitPageProps> = ({ onVerify, onBack }) => {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [state, setState] = useState('Telangana');
  const [periodicity, setPeriodicity] = useState('Weekly');
  const [activeTab, setActiveTab] = useState<'verify' | 'guidelines' | 'corpus' | 'status' | 'help'>('verify');
  const [trackId, setTrackId] = useState('');
  const [trackResult, setTrackResult] = useState<string | null>(null);

  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();

  const handleVerify = () => {
    if (!title.trim()) return;
    onVerify({ title, language, state, periodicity });
  };

  const handleTrackSearch = () => {
    if (!trackId.trim()) return;
    setTrackResult(`Application #${trackId.trim().toUpperCase()} — Status: Pending Preliminary Assessment (PRGI Bureau)`);
  };

  const sidebarLinks = [
    { id: 'verify', icon: 'fact_check', label: 'Title Verification' },
    { id: 'guidelines', icon: 'gavel', label: 'PRGI Guidelines' },
    { id: 'corpus', icon: 'dataset', label: 'Corpus Database' },
    { id: 'status', icon: 'find_in_page', label: 'Track Application' },
    { id: 'help', icon: 'help', label: 'Help & FAQ' },
  ];

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)',
    }}>
      <GazetteHeader activePage="verification" onNavClick={id => id === 'verification' && onBack()} />

      {/* Body: sidebar + form side by side, filling remaining height */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '0 48px',
        gap: '0',
      }}>

        {/* Sidebar */}
        <aside style={{
          width: '220px',
          flexShrink: 0,
          backgroundColor: 'var(--color-surface-container-low)',
          borderRight: '1px solid var(--color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
          gap: '16px',
          overflow: 'hidden',
        }}>
          {/* Bureau Seal Header */}
          <div style={{
            borderBottom: '1px solid var(--color-outline-variant)',
            paddingBottom: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', filter: 'grayscale(1)', opacity: 0.4 }}>🏛️</div>
            <h2 className="gazette-headline-sm" style={{ color: 'var(--color-primary)', textTransform: 'uppercase', margin: 0, fontSize: '13px', letterSpacing: '0.04em' }}>
              Verification Bureau
            </h2>
            <div className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', fontSize: '12px' }}>
              Press Registration of India
            </div>
          </div>

          {/* Functional Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sidebarLinks.map(link => {
              const isActive = activeTab === link.id;
              return (
                <a
                  key={link.id}
                  href="#"
                  onClick={e => { e.preventDefault(); setActiveTab(link.id as any); }}
                  className="gazette-label-caps"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'var(--color-secondary)' : 'transparent',
                    color: isActive ? 'var(--color-on-secondary)' : 'var(--color-on-surface-variant)',
                    borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'all 0.15s',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--color-surface-variant)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{link.icon}</span>
                  {link.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--color-outline-variant)',
          borderRight: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          padding: '28px 36px',
          overflowY: 'auto',
          gap: '18px',
        }}>

          {/* TAB 1: Title Verification */}
          {activeTab === 'verify' && (
            <>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '16px', flexShrink: 0 }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0' }}>
                  PRGI Title Verification
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0 }}>
                  Automated preliminary assessment against the locally imported PRGI corpus and pending applications.
                </p>
              </section>

              {/* Form fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', flex: 1 }}>

                {/* Title input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="gazette-label-caps" htmlFor="proposed-title" style={{
                    color: 'var(--color-on-surface)',
                    borderBottom: '1px solid var(--color-outline-variant)',
                    paddingBottom: '4px',
                  }}>
                    Proposed title <span style={{ color: 'var(--color-secondary)' }}>*</span>
                  </label>
                  <input
                    id="proposed-title"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Enter proposed title..."
                    autoFocus
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: '1px solid var(--color-primary)',
                      background: 'transparent',
                      padding: '6px 0',
                      fontFamily: 'var(--font-headline)',
                      fontSize: '22px',
                      fontWeight: '700',
                      color: 'var(--color-primary)',
                      outline: 'none',
                      borderRadius: 0,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = 'var(--color-secondary)'}
                    onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = 'var(--color-primary)'}
                  />
                  {normalized && (
                    <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', fontSize: '11px' }}>
                      Normalized: {normalized}
                    </span>
                  )}
                </div>

                {/* Three selects */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
                  {[
                    { id: 'language', label: 'Language', value: language, set: setLanguage, opts: ['English', 'Hindi', 'Telugu', 'Marathi', 'Tamil', 'Kannada'] },
                    { id: 'state', label: 'State', value: state, set: setState, opts: ['Telangana', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh'] },
                    { id: 'periodicity', label: 'Periodicity', value: periodicity, set: setPeriodicity, opts: ['Weekly', 'Daily', 'Monthly', 'Fortnightly', 'Quarterly'] },
                  ].map(field => (
                    <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="gazette-label-caps" htmlFor={field.id} style={{
                        color: 'var(--color-on-surface)',
                        borderBottom: '1px solid var(--color-outline-variant)',
                        paddingBottom: '4px',
                      }}>
                        {field.label}
                      </label>
                      <select
                        id={field.id}
                        value={field.value}
                        onChange={e => field.set(e.target.value)}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderBottom: '1px solid var(--color-primary)',
                          background: 'transparent',
                          padding: '6px 0',
                          fontFamily: 'var(--font-body)',
                          fontSize: '16px',
                          color: 'var(--color-primary)',
                          outline: 'none',
                          borderRadius: 0,
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {field.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{
                  display: 'flex',
                  gap: '14px',
                  paddingTop: '16px',
                  borderTop: '1px dashed var(--color-outline-variant)',
                }}>
                  <button
                    id="verify-btn"
                    className="btn-gazette-red"
                    onClick={handleVerify}
                    disabled={!title.trim()}
                    style={{ opacity: title.trim() ? 1 : 0.45, cursor: title.trim() ? 'pointer' : 'not-allowed', borderRadius: '6px' }}
                  >
                    Verify Title
                  </button>
                  <button className="btn-gazette-outline" onClick={onBack} style={{ borderRadius: '6px' }}>
                    Back to Home
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PRGI Guidelines */}
          {activeTab === 'guidelines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  PRGI Title Allocation Guidelines
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Official rules governing the registration and preliminary screening of publication titles in India.
                </p>
              </section>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '22px' }}>
                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '18px' }}>1. Phonetic & Soundex Matching</h3>
                  <p style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
                    Proposed titles must not be phonetically similar to existing registered titles within the same state or language. Soundex algorithms evaluate phonetic proximity to prevent public confusion.
                  </p>
                </div>

                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '18px' }}>2. Disambiguation of Common Prefixes/Suffixes</h3>
                  <p style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
                    Adding generic terms like <em>Daily, National, Herald, Times, Post, Express</em> to an existing registered title root is prohibited unless distinct ownership or authorization is established.
                  </p>
                </div>

                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '18px' }}>3. Jurisdiction &amp; Periodicity Rules</h3>
                  <p style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
                    Titles registered for daily newspapers undergo national cross-reference checks, whereas regional periodics are evaluated against state-level registries.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Corpus Database */}
          {activeTab === 'corpus' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  PRGI Registered Title Corpus
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Locally imported database of registered press publications and pending applications.
                </p>
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)' }}>1,420,000+</div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Total Titles Indexed</div>
                </div>
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)' }}>28 States</div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Regional Coverage</div>
                </div>
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)' }}>22 Languages</div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Official Vernaculars</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-outline-variant)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '16px' }}>Database Synchronization</h3>
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  The corpus is automatically synchronized with the central Press Registration of India registry to ensure preliminary screening against all active, suspended, and pending title registrations.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Track Application */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  Track Application Status
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Enter your PRGI verification reference number to check application status.
                </p>
              </section>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={trackId}
                  onChange={e => setTrackId(e.target.value)}
                  placeholder="e.g. PRGI-2026-89412"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid var(--color-primary)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-headline)',
                    fontSize: '16px',
                  }}
                />
                <button
                  className="btn-gazette-primary"
                  onClick={handleTrackSearch}
                  style={{ padding: '10px 20px', borderRadius: '4px' }}
                >
                  Search Status
                </button>
              </div>

              {trackResult && (
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <span className="gazette-label-caps" style={{ color: 'var(--color-secondary)', display: 'block', marginBottom: '6px' }}>
                    Status Report
                  </span>
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-primary)' }}>
                    {trackResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Help & FAQ */}
          {activeTab === 'help' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  PRGI Help &amp; Support
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Frequently asked questions regarding publication title verification.
                </p>
              </section>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '14px 16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>What happens if a title is flagged as SIMILAR?</strong>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>If a proposed title conflicts phonetically with an existing title, the system will highlight the exact overlapping terms and suggest alternative available variations.</span>
                </div>

                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '14px 16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>How long does PRGI title verification take?</strong>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>This automated studio provides instant preliminary screening. Official bureau processing typically takes 5–7 working days upon formal submission.</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default SubmitPage;
