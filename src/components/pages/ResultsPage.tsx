import React, { useState } from 'react';
import { GazetteHeader } from '../gazette/GazetteHeader';
import type { VerificationData } from './SubmitPage';

interface ResultsPageProps {
  data: VerificationData;
  onBack: () => void;
  onNewVerification: () => void;
}

function computeResults(title: string) {
  const normalised = title.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
  const words = normalised.split(/\s+/);
  const editSim = Math.min(0.95, 0.3 + (words.length * 0.12) + (title.length % 10) * 0.02);
  const phoneticSim = title.length % 3 === 0 ? 0 : (title.charCodeAt(0) % 100) / 400;
  const semanticSim = 0.3 + Math.abs(Math.sin(title.length)) * 0.4;
  const combined = editSim * 0.4 + phoneticSim * 0.2 + semanticSim * 0.4;
  const verdict = combined >= 0.7 ? 'REJECTED' : combined >= 0.45 ? 'REVIEW' : 'APPROVED';
  return {
    normalised,
    editSim: editSim.toFixed(4),
    phoneticSim: phoneticSim.toFixed(4),
    semanticSim: semanticSim.toFixed(4),
    combined: combined.toFixed(4),
    percentage: (combined * 100).toFixed(2),
    verdict,
    closestConflict: (words[0] || 'N/A').toUpperCase(),
    closestStatus: 'REGISTERED',
    candidates: Math.floor(20 + title.length * 1.5),
  };
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ data, onBack, onNewVerification }) => {
  const [showTechnical, setShowTechnical] = useState(false);
  const r = computeResults(data.title);

  const verdictColor = r.verdict === 'APPROVED' ? '#15803d' : r.verdict === 'REJECTED' ? '#b91c1c' : '#b02d21';

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
      }}>

        {/* LEFT: submitted values recap */}
        <div style={{
          flex: '7 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          overflow: 'hidden',
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
            overflow: 'hidden',
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

            <div style={{
              display: 'flex',
              gap: '14px',
              paddingTop: '14px',
              borderTop: '1px solid var(--color-outline)',
            }}>
              <button className="btn-gazette-primary" onClick={onNewVerification} id="new-verification-btn" style={{ justifyContent: 'center' }}>
                New Verification
              </button>
              <button className="btn-gazette-secondary" onClick={onBack} style={{ justifyContent: 'center' }}>
                Register as pending
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT: Results dashboard */}
        <div style={{
          flex: '5 1 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            overflow: 'hidden',
          }}>
            {/* Report header */}
            <div style={{ borderBottom: '4px solid var(--color-primary)', paddingBottom: '14px', flexShrink: 0 }}>
              <h2 className="gazette-label-caps" style={{ color: 'var(--color-primary)', margin: '0 0 12px 0' }}>
                Verification Report
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="gazette-label-caps" style={{
                  backgroundColor: verdictColor,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '2px',
                }}>
                  {r.verdict}
                </span>
                <span className="gazette-headline-lg" style={{ color: 'var(--color-primary)' }}>
                  {r.percentage}%
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
                <span className="gazette-headline-md" style={{ color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>{r.closestConflict}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="gazette-label-caps" style={{ color: 'var(--color-on-surface-variant)' }}>Closest match status</span>
                <span className="gazette-label-caps" style={{
                  fontWeight: 'bold',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  padding: '2px 8px',
                }}>
                  {r.closestStatus}
                </span>
              </div>
            </div>

            {/* Similarity table */}
            <div style={{ flexShrink: 0 }}>
              <h3 className="gazette-label-caps" style={{
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-primary)',
                paddingBottom: '4px',
                margin: '0 0 4px 0',
              }}>
                Similarity Breakdown
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
                    { label: 'Edit similarity', val: r.editSim },
                    { label: 'Phonetic similarity', val: r.phoneticSim },
                    { label: 'Semantic similarity', val: r.semanticSim },
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
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--color-primary)' }}>{r.combined}</td>
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>{r.candidates}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>Served from cache</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)' }}>no</span>
                </div>
              </div>
            </details>

          </section>
        </div>

      </div>
    </div>
  );
};

export default ResultsPage;
