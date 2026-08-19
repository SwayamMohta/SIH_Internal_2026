import React, { useState } from 'react';
import { GazetteHeader } from '../gazette/GazetteHeader';
import { registerPending } from '../../services/api';
import type { VerificationData } from './SubmitPage';
import type { CandidateBreakdown, VerifyResponse } from '../../services/api';

interface ResultsPageProps {
  data: VerificationData;
  onBack: () => void;
  onNewVerification: () => void;
  onTrackPending?: (refNum: string) => void;
  onViewPending?: () => void;
}

function verdictColor(status: VerifyResponse['status']): string {
  switch (status) {
    case 'REJECTED':
      return '#b91c1c';
    case 'INVALID_INPUT':
      return '#b02d21';
    case 'REVIEW':
      return '#b45309';
    case 'LIKELY_APPROVED':
    default:
      return '#15803d';
  }
}

function num(value: number | null | undefined, digits = 4): string {
  return value == null ? 'N/A' : value.toFixed(digits);
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  data,
  onBack,
  onNewVerification,
  onTrackPending,
  onViewPending,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<{ ok: boolean; text: string; refNum?: string } | null>(null);

  const { result } = data;
  const bd: CandidateBreakdown | null = result.closest_match_breakdown;
  const color = verdictColor(result.status);

  const handleRegisterPending = async () => {
    if (registering) return;
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const res = await registerPending({
        title: data.title,
        language: data.language,
        state: data.state,
        periodicity: data.periodicity,
      });
      if (res.registered) {
        const refId = res.id ? `PRGI-2026-PENDING-${String(res.id).padStart(5, '0')}` : data.title;
        setRegisterMsg({
          ok: true,
          text: `Successfully registered in PRGI Pending Registry.`,
          refNum: refId,
        });
      } else {
        setRegisterMsg({ ok: false, text: res.error || 'Could not register as pending.' });
      }
    } catch (err) {
      setRegisterMsg({ ok: false, text: err instanceof Error ? err.message : 'Registration failed.' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)',
    }}>
      <GazetteHeader activePage="verification" onNavClick={id => id === 'verification' && onBack()} />

      {/* Two-column body */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '28px 48px',
        gap: '32px',
        minHeight: 0,
      }}>

        {/* LEFT: submitted values recap */}
        <div style={{
          flex: '7 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <section style={{ flexShrink: 0 }}>
            <h1 className="gazette-headline-lg" style={{
              color: 'var(--color-primary)',
              borderBottom: '4px solid var(--color-primary)',
              paddingBottom: '8px',
              margin: '0 0 10px 0',
            }}>
              PRGI Title Verification
            </h1>
            <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0 }}>
              Automated preliminary assessment against the locally imported PRGI corpus and pending applications.
            </p>
          </section>

          {/* Submitted form (read-only) */}
          <section style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}>
            <div>
              <label className="gazette-label-caps" style={{
                color: 'var(--color-primary)',
                display: 'block',
                borderBottom: '1px solid var(--color-outline)',
                paddingBottom: '4px',
                marginBottom: '8px',
              }}>
                Proposed title <span style={{ color: 'var(--color-secondary)' }}>*</span>
              </label>
              <div style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '22px',
                fontWeight: '700',
                color: 'var(--color-primary)',
                padding: '6px 12px',
                backgroundColor: 'var(--color-surface-bright)',
                border: '1px solid var(--color-outline)',
              }}>
                {data.title}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {[
                { label: 'Language', value: data.language },
                { label: 'State', value: data.state },
                { label: 'Periodicity', value: data.periodicity },
              ].map(f => (
                <div key={f.label}>
                  <label className="gazette-label-caps" style={{
                    color: 'var(--color-primary)',
                    display: 'block',
                    borderBottom: '1px solid var(--color-outline)',
                    paddingBottom: '4px',
                    marginBottom: '8px',
                  }}>
                    {f.label}
                  </label>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '16px',
                    color: 'var(--color-primary)',
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-surface-bright)',
                    border: '1px solid var(--color-outline)',
                  }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            {result.reasons.length > 0 && (
              <div style={{
                border: '1px solid var(--color-outline)',
                backgroundColor: 'var(--color-surface-bright)',
                padding: '12px 14px',
              }}>
                <label className="gazette-label-caps" style={{
                  color: 'var(--color-primary)',
                  display: 'block',
                  marginBottom: '6px',
                }}>
                  Reasons
                </label>
                {result.reasons.map((reason, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    • {reason}
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '14px',
              paddingTop: '14px',
              borderTop: '1px solid var(--color-outline)',
              flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', gap: '14px' }}>
                <button className="btn-gazette-primary" onClick={onNewVerification} id="new-verification-btn" style={{ justifyContent: 'center' }}>
                  New Verification
                </button>
                <button
                  className="btn-gazette-secondary"
                  onClick={handleRegisterPending}
                  disabled={registering || result.status === 'REJECTED' || result.status === 'INVALID_INPUT'}
                  style={{
                    justifyContent: 'center',
                    opacity: registerMsg ? 0.7 : 1,
                    cursor: registering || result.status === 'REJECTED' || result.status === 'INVALID_INPUT' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {registering ? 'Registering…' : 'Register as pending'}
                </button>
              </div>
              {registerMsg && (
                <div style={{
                  border: `1px solid ${registerMsg.ok ? '#15803d' : '#b91c1c'}`,
                  backgroundColor: registerMsg.ok ? '#f0fdf4' : '#fef2f2',
                  color: registerMsg.ok ? '#15803d' : '#b91c1c',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontWeight: '600' }}>
                    {registerMsg.text} {registerMsg.refNum && `(Ref: ${registerMsg.refNum})`}
                  </div>
                  {registerMsg.ok && registerMsg.refNum && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      {onTrackPending && (
                        <button
                          className="btn-gazette-primary"
                          onClick={() => onTrackPending(registerMsg.refNum!)}
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        >
                          Track Application Status
                        </button>
                      )}
                      {onViewPending && (
                        <button
                          className="btn-gazette-secondary"
                          onClick={onViewPending}
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        >
                          View Pending List
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', fontSize: '12px', margin: 0 }}>
                {result.disclaimer}
              </p>
            </div>
          </section>
        </div>

        {/* RIGHT: Results dashboard */}
        <div style={{
          flex: '5 1 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <section style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '2px 2px 0px rgba(0,0,0,1)',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}>
            {/* Report header */}
            <div style={{ borderBottom: '4px solid var(--color-primary)', paddingBottom: '14px', flexShrink: 0 }}>
              <h2 className="gazette-label-caps" style={{ color: 'var(--color-primary)', margin: '0 0 12px 0' }}>
                Verification Report
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="gazette-label-caps" style={{
                  backgroundColor: color,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '2px',
                }}>
                  {result.status}
                </span>
                <span className="gazette-headline-lg" style={{ color: 'var(--color-primary)' }}>
                  {num(result.verification_probability, 1)}%
                </span>
              </div>
            </div>

            {/* Closest conflict */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderBottom: '1px solid var(--color-outline)',
              paddingBottom: '14px',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="gazette-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>Closest conflict</span>
                <span className="gazette-headline-md" style={{ color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{result.closest_match || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="gazette-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>Closest match status</span>
                <span className="gazette-label-caps" style={{
                  fontWeight: 'bold',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  padding: '2px 8px',
                }}>
                  {result.closest_match_status || 'N/A'}
                </span>
              </div>
            </div>

            {/* Similarity table */}
            <div style={{ flexShrink: 0, overflowY: 'auto' }}>
              <h3 className="gazette-label-caps" style={{
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-primary)',
                paddingBottom: '4px',
                margin: '0 0 4px 0',
              }}>
                Similarity Breakdown{result.closest_match && ` — ${result.closest_match}`}
              </h3>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-primary)' }}>
                    <th className="gazette-label-caps" style={{ padding: '6px 0', fontWeight: 400, color: 'var(--color-on-surface-variant)' }}>Metric</th>
                    <th className="gazette-label-caps" style={{ padding: '6px 0', fontWeight: 400, color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Value</th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                  {[
                    { label: 'Edit similarity', val: num(bd?.edit_similarity) },
                    { label: 'Phonetic similarity', val: num(bd?.phonetic_similarity) },
                    { label: 'Semantic similarity', val: num(bd?.semantic_similarity) },
                    { label: 'Token overlap', val: num(bd?.token_overlap_similarity) },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-outline)' }}>
                      <td style={{ padding: '6px 0' }}>{row.label}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{row.val}</td>
                    </tr>
                  ))}
                  <tr style={{
                    borderBottom: '4px solid var(--color-primary)',
                    backgroundColor: 'var(--color-surface-container-high)',
                    fontWeight: 700,
                  }}>
                    <td className="gazette-label-caps" style={{ padding: '6px 8px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>Combined</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-primary)' }}>{num(bd?.combined_similarity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Technical details */}
            <details
              style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '8px', flexShrink: 0 }}
              onToggle={e => setShowTechnical((e.target as HTMLDetailsElement).open)}
            >
              <summary className="gazette-label-caps" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', color: 'var(--color-primary)', outline: 'none', listStyle: 'none',
              }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: '16px',
                  transform: showTechnical ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>
                  arrow_drop_down
                </span>
                Technical details
              </summary>
              <div style={{ paddingLeft: '20px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid var(--color-outline)', marginLeft: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>Candidates compared</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>{result.candidate_count}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>Served from cache</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>{result.from_cache ? 'yes' : 'no'}</span>
                </div>
                {result.requires_manual_semantic_review && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>Manual semantic review</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>required</span>
                  </div>
                )}
                {result.top_conflicts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>Top conflicts</span>
                    {result.top_conflicts.map((c, i) => (
                      <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>• {c}</span>
                    ))}
                  </div>
                )}
              </div>
            </details>

          </section>
        </div>

      </div>
    </div>
  );
};

export default ResultsPage;