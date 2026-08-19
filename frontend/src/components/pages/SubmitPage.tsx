import React, { useState, useEffect, useCallback } from 'react';
import { GazetteHeader } from '../gazette/GazetteHeader';
import {
  verifyTitle,
  getHealth,
  getPendingApplications,
  getAllApplications,
  trackApplication,
  updateApplicationStatus,
  PendingApplicationRecord,
  HealthResponse,
  VerifyResponse
} from '../../services/api';

interface SubmitPageProps {
  onVerify: (data: VerificationData) => void;
  onBack: () => void;
  initialTab?: 'verify' | 'pending' | 'guidelines' | 'corpus' | 'status' | 'help';
  initialTrackQuery?: string;
}

export interface VerificationData {
  title: string;
  language: string;
  state: string;
  periodicity: string;
  result: VerifyResponse;
}

export const SubmitPage: React.FC<SubmitPageProps> = ({
  onVerify,
  onBack,
  initialTab = 'verify',
  initialTrackQuery = ''
}) => {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [state, setState] = useState('Telangana');
  const [periodicity, setPeriodicity] = useState('Weekly');
  const [activeTab, setActiveTab] = useState<'verify' | 'pending' | 'guidelines' | 'corpus' | 'status' | 'help'>(initialTab);
  
  // Track Application State
  const [trackId, setTrackId] = useState(initialTrackQuery);
  const [trackResults, setTrackResults] = useState<PendingApplicationRecord[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [stageMap, setStageMap] = useState<Record<string, number>>({});

  // Applications Registry List State
  const [pendingList, setPendingList] = useState<PendingApplicationRecord[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingFilter, setPendingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'registered' | 'rejected'>('all');

  // Verification Form State
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  // Synchronize initialTab & initialTrackQuery when props change
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialTrackQuery) {
      setTrackId(initialTrackQuery);
      handleTrackSearch(initialTrackQuery);
    }
  }, [initialTab, initialTrackQuery]);

  // Load health on mount
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Fetch applications list when tab is switched or filter changes
  const loadPendingList = useCallback(async (filterVal = statusFilter) => {
    setLoadingPending(true);
    try {
      const res = await getAllApplications(filterVal);
      if (res.success && res.applications) {
        setPendingList(res.applications);
      }
    } catch {
      // Fallback empty if backend offline
    } finally {
      setLoadingPending(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'pending' || activeTab === 'status' || activeTab === 'corpus') {
      loadPendingList(statusFilter);
    }
  }, [activeTab, statusFilter, loadPendingList]);

  const handleTrackPendingItem = (item: PendingApplicationRecord) => {
    setTrackId(item.ref_number || item.title);
    setActiveTab('status');
    setTrackResults([item]);
    setHasSearched(true);
  };

  const handleUpdateStatus = async (item: PendingApplicationRecord, newStatus: 'pending' | 'registered' | 'rejected', newStage?: number) => {
    try {
      await updateApplicationStatus(item.id, item.ref_number, newStatus);
    } catch {
      // ignore offline backend
    }
    const updatedRef = newStatus === 'registered' 
      ? item.ref_number.replace('PRGI-2026-PENDING-', 'PRGI-2026-REG-')
      : item.ref_number;
      
    const updatedRecord = { ...item, status: newStatus, ref_number: updatedRef };

    setPendingList(prev => prev.map(p => p.id === item.id || p.ref_number === item.ref_number ? updatedRecord : p));
    setTrackResults(prev => prev.map(p => p.id === item.id || p.ref_number === item.ref_number ? updatedRecord : p));
    if (newStage !== undefined) {
      setStageMap(prev => ({ ...prev, [item.ref_number]: newStage, [updatedRef]: newStage }));
    }
  };

  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();

  const handleVerify = async () => {
    if (!title.trim() || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyTitle(title.trim());
      onVerify({ title: title.trim(), language, state, periodicity, result });
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
      setVerifying(false);
    }
  };

  const handleTrackSearch = async (overrideQuery?: string) => {
    const query = (overrideQuery !== undefined ? overrideQuery : trackId).trim();
    if (!query) return;
    setTrackingLoading(true);
    setHasSearched(true);
    try {
      const res = await trackApplication(query);
      if (res.success && res.results && res.results.length > 0) {
        setTrackResults(res.results);
      } else {
        // Generate a fallback structured response for search demo
        const cleanRef = query.startsWith('PRGI') ? query : `PRGI-2026-PENDING-${query.replace(/\D/g, '').padStart(5, '0') || '00104'}`;
        setTrackResults([
          {
            id: 104,
            ref_number: cleanRef,
            title: query,
            title_normalized: query.toLowerCase(),
            language: 'English',
            state: 'Telangana',
            periodicity: 'Weekly',
            status: 'pending',
            created_at: new Date().toISOString().split('T')[0]
          }
        ]);
      }
    } catch {
      const cleanRef = query.startsWith('PRGI') ? query : `PRGI-2026-PENDING-00104`;
      setTrackResults([
        {
          id: 104,
          ref_number: cleanRef,
          title: query,
          title_normalized: query.toLowerCase(),
          language: 'English',
          state: 'Telangana',
          periodicity: 'Weekly',
          status: 'pending',
          created_at: new Date().toISOString().split('T')[0]
        }
      ]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const sidebarLinks = [
    { id: 'verify', icon: 'fact_check', label: 'Title Verification' },
    { id: 'pending', icon: 'inventory_2', label: 'Applications Registry' },
    { id: 'status', icon: 'find_in_page', label: 'Track Application' },
    { id: 'guidelines', icon: 'gavel', label: 'PRGI Guidelines' },
    { id: 'corpus', icon: 'dataset', label: 'Corpus Database' },
    { id: 'help', icon: 'help', label: 'Help & FAQ' },
  ];

  const filteredPendingList = pendingList.filter(item => {
    if (!pendingFilter.trim()) return true;
    const q = pendingFilter.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.ref_number.toLowerCase().includes(q) ||
      item.state.toLowerCase().includes(q) ||
      item.language.toLowerCase().includes(q)
    );
  });

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
        minHeight: 0,
      }}>

        {/* Sidebar */}
        <aside style={{
          width: '230px',
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

          {/* Navigation Links */}
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
          minHeight: 0,
        }}>

          {/* TAB 1: Title Verification */}
          {activeTab === 'verify' && (
            <>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px', flexShrink: 0 }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '32px' }}>
                  Title Verification Request
                </h1>
                <p className="gazette-body-md" style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>
                  Fill in the publication details below to check title availability against the PRGI database.
                </p>
              </section>

              {/* Form Card Container */}
              <div className="gazette-form-card" style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '14px' }}>
                  <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', margin: 0, color: 'var(--color-primary)' }}>
                    Publication Metadata
                  </h2>
                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    All fields marked with an asterisk (<span className="gazette-field-required">*</span>) are required.
                  </span>
                </div>

                {/* Proposed Title Input */}
                <div className="gazette-field-group">
                  <label className="gazette-field-label" htmlFor="proposed-title">
                    Proposed Publication Title <span className="gazette-field-required">*</span>
                  </label>
                  <input
                    id="proposed-title"
                    className="gazette-input-field"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. The Deccan Times"
                    autoFocus
                    style={{ fontSize: '18px', fontWeight: '600' }}
                  />
                  {normalized && (
                    <span className="gazette-body-sm" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>
                      Cleaned search query: <strong>{normalized}</strong>
                    </span>
                  )}
                </div>

                {/* Dropdown Selects */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  {[
                    { id: 'language', label: 'Publication Language', value: language, set: setLanguage, opts: ['English', 'Hindi', 'Telugu', 'Marathi', 'Tamil', 'Kannada'] },
                    { id: 'state', label: 'Registration State', value: state, set: setState, opts: ['Telangana', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh'] },
                    { id: 'periodicity', label: 'Publication Frequency', value: periodicity, set: setPeriodicity, opts: ['Weekly', 'Daily', 'Monthly', 'Fortnightly', 'Quarterly'] },
                  ].map(field => (
                    <div key={field.id} className="gazette-field-group">
                      <label className="gazette-field-label" htmlFor={field.id}>
                        {field.label} <span className="gazette-field-required">*</span>
                      </label>
                      <div className="gazette-select-wrapper">
                        <select
                          id={field.id}
                          className="gazette-select-field"
                          value={field.value}
                          onChange={e => field.set(e.target.value)}
                        >
                          {field.opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--color-outline-variant)',
                  marginTop: '8px',
                }}>
                  <button
                    id="verify-btn"
                    className="btn-gazette-red"
                    onClick={handleVerify}
                    disabled={!title.trim() || verifying}
                    style={{
                      opacity: title.trim() && !verifying ? 1 : 0.5,
                      cursor: title.trim() && !verifying ? 'pointer' : 'not-allowed',
                      borderRadius: '6px',
                      padding: '12px 28px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{verifying ? 'progress_activity' : 'search'}</span>
                    {verifying ? 'Verifying…' : 'Verify Title Availability'}
                  </button>
                  <button
                    className="btn-gazette-outline"
                    onClick={onBack}
                    style={{ borderRadius: '6px', padding: '12px 24px' }}
                  >
                    Back to Home
                  </button>
                </div>

                {verifyError && (
                  <div style={{
                    border: '1px solid #b91c1c',
                    backgroundColor: '#fef2f2',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                  }}>
                    {verifyError}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: APPLICATIONS REGISTRY */}
          {activeTab === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                      PRGI Applications Registry
                    </h1>
                    <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                      Registry of all press publication applications — filter between pending, approved (registered), and closed/rejected titles.
                    </p>
                  </div>
                  <button
                    className="btn-gazette-primary"
                    onClick={() => loadPendingList(statusFilter)}
                    disabled={loadingPending}
                    style={{ padding: '8px 16px', fontSize: '11px', borderRadius: '4px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                    Refresh Registry
                  </button>
                </div>
              </section>

              {/* Status Filter Tabs & Search Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(
                    [
                      { key: 'all', label: 'All Applications', icon: 'all_inclusive' },
                      { key: 'pending', label: 'Pending Review', icon: 'pending_actions' },
                      { key: 'registered', label: 'Approved & Registered', icon: 'check_circle' },
                      { key: 'rejected', label: 'Closed / Rejected', icon: 'cancel' },
                    ] as const
                  ).map(tab => {
                    const isSel = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setStatusFilter(tab.key);
                          loadPendingList(tab.key);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: isSel ? '2px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                          backgroundColor: isSel ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: isSel ? '#ffffff' : 'var(--color-on-surface-variant)',
                          fontFamily: 'var(--font-label)',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Search Text Input */}
                <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 280px' }}>
                  <input
                    type="text"
                    value={pendingFilter}
                    onChange={e => setPendingFilter(e.target.value)}
                    placeholder="Filter registry by title, state, language..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      border: '1px solid var(--color-outline)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                    }}
                  />
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--color-on-surface-variant)' }}>
                    filter_alt
                  </span>
                </div>
              </div>

              {/* Applications Table */}
              <div style={{ border: '1px solid var(--color-outline)', backgroundColor: '#fff', borderRadius: '4px', overflowX: 'auto', maxWidth: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-container-high)', borderBottom: '2px solid var(--color-primary)' }}>
                      <th className="gazette-label-caps" style={{ padding: '12px 16px', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>Ref Number</th>
                      <th className="gazette-label-caps" style={{ padding: '12px 16px', color: 'var(--color-primary)' }}>Proposed Title</th>
                      <th className="gazette-label-caps" style={{ padding: '12px 16px', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>Status</th>
                      <th className="gazette-label-caps" style={{ padding: '12px 16px', color: 'var(--color-primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPending ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-body)', color: 'var(--color-on-surface-variant)' }}>
                          Loading PRGI applications registry...
                        </td>
                      </tr>
                    ) : filteredPendingList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px 24px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', color: 'var(--color-primary)', marginBottom: '8px' }}>
                            No Applications Found for &quot;{statusFilter.toUpperCase()}&quot; Filter
                          </div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-on-surface-variant)', margin: '0 0 16px 0' }}>
                            Verify a proposed publication title or adjust status filters to view records in the registry!
                          </p>
                          <button
                            className="btn-gazette-red"
                            onClick={() => setActiveTab('verify')}
                            style={{ borderRadius: '4px', padding: '8px 20px', fontSize: '12px' }}
                          >
                            Submit New Verification
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredPendingList.map((item, idx) => {
                        const isReg = item.status === 'registered';
                        const isRej = item.status === 'rejected';
                        return (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                            <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 'bold', color: isReg ? '#15803d' : isRej ? '#b91c1c' : 'var(--color-secondary)', whiteSpace: 'nowrap' }}>
                              {item.ref_number}
                            </td>
                            <td style={{ padding: '12px 16px', fontFamily: 'var(--font-headline)', fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)' }}>
                              {item.title}
                            </td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <span className="gazette-label-caps" style={{
                                backgroundColor: isReg ? '#f0fdf4' : isRej ? '#fef2f2' : '#fef3c7',
                                color: isReg ? '#15803d' : isRej ? '#b91c1c' : '#92400e',
                                border: `1px solid ${isReg ? '#16a34a' : isRej ? '#dc2626' : '#f59e0b'}`,
                                padding: '4px 8px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}>
                                {isReg ? 'REGISTERED' : isRej ? 'REJECTED' : 'PENDING'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                className="btn-gazette-primary"
                                onClick={() => handleTrackPendingItem(item)}
                                style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', whiteSpace: 'nowrap' }}
                              >
                                Track Status
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TRACK APPLICATION */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  Track PRGI Application Status
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Enter your PRGI verification reference number or title name to check official application progress.
                </p>
              </section>

              {/* Search Bar Container */}
              <div style={{ border: '1px solid var(--color-outline)', padding: '20px', backgroundColor: '#fff', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="gazette-label-caps" style={{ color: 'var(--color-primary)' }}>
                  Search by Reference Number or Proposed Title
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={trackId}
                    onChange={e => setTrackId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTrackSearch()}
                    placeholder="e.g. PRGI-2026-PENDING-00012 or Samaya Mithra"
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: '1px solid var(--color-primary)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-headline)',
                      fontSize: '16px',
                    }}
                  />
                  <button
                    className="btn-gazette-red"
                    onClick={() => handleTrackSearch()}
                    disabled={trackingLoading || !trackId.trim()}
                    style={{ padding: '12px 24px', borderRadius: '4px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                    {trackingLoading ? 'Searching…' : 'Track Status'}
                  </button>
                </div>


              </div>

              {/* Track Results View */}
              {hasSearched && trackResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
                  {trackResults.map((item, idx) => {
                    const currentStage = stageMap[item.ref_number] || (item.status === 'registered' ? 4 : 3);
                    const isApproved = currentStage === 4;

                    const steps = [
                      { num: 1, title: 'Submitted & Digitized', desc: 'Logged in Central Database' },
                      { num: 2, title: 'AI Duplicate Screening', desc: 'Passed Soundex & Vector Check' },
                      { num: 3, title: 'Officer Legal Review', desc: 'Regional Registrar Assessment' },
                      { num: 4, title: 'Gazette Publication', desc: 'Final Allocation Certificate' },
                    ];

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          border: '2px solid var(--color-primary)',
                          backgroundColor: '#fff',
                          borderRadius: '6px',
                          padding: '24px',
                          boxShadow: '3px 3px 0px rgba(0,0,0,1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '20px',
                        }}
                      >
                        {/* Application Header Badge & Close Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                          <div>
                            <div className="gazette-label-caps" style={{ color: 'var(--color-secondary)', fontSize: '11px', marginBottom: '4px' }}>
                              PRGI OFFICIAL REGISTRATION STATUS SHEET
                            </div>
                            <h2 className="gazette-headline-md" style={{ color: 'var(--color-primary)', margin: 0 }}>
                              {item.title}
                            </h2>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                              Reference Code: <strong>{item.ref_number}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="gazette-label-caps" style={{
                              backgroundColor: isApproved ? '#15803d' : currentStage === 3 ? '#b45309' : '#1d4ed8',
                              color: '#ffffff',
                              padding: '6px 14px',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}>
                              {isApproved ? 'APPROVED & REGISTERED' : currentStage === 3 ? 'PENDING REGISTRAR REVIEW' : `STAGE ${currentStage} IN PROGRESS`}
                            </span>

                            {/* Close Report Button */}
                            <button
                              onClick={() => {
                                setHasSearched(false);
                                setTrackResults([]);
                                setTrackId('');
                                setActiveTab('pending');
                              }}
                              title="Close Status Sheet & Return to Pending Registry"
                              style={{
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-primary)',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-label)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'var(--color-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                              Close &amp; Return to Pending Registry
                            </button>
                          </div>
                        </div>

                        {/* 4-Step Milestone Progress Stepper */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="gazette-label-caps" style={{ color: 'var(--color-primary)' }}>
                              Verification Timeline &amp; Milestone Progress (Click step or use buttons to advance)
                            </div>
                            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-on-surface-variant)' }}>
                              Stage <strong>{currentStage}</strong> of 4
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {steps.map((st) => {
                              const isDone = currentStage > st.num || (currentStage === 4 && st.num === 4);
                              const isCurrent = currentStage === st.num && currentStage !== 4;
                              return (
                                <div
                                  key={st.num}
                                  onClick={() => {
                                    const nextSt = st.num;
                                    const newSt = nextSt === 4 ? 'registered' : item.status === 'rejected' ? 'rejected' : 'pending';
                                    handleUpdateStatus(item, newSt, nextSt);
                                  }}
                                  title={`Click to set stage to Step ${st.num}`}
                                  style={{
                                    border: isCurrent ? '2px solid var(--color-secondary)' : isDone ? '1px solid #15803d' : '1px solid var(--color-outline-variant)',
                                    backgroundColor: isCurrent ? '#fff1f0' : isDone ? '#f0fdf4' : 'var(--color-surface-container-low)',
                                    padding: '14px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', color: isCurrent ? 'var(--color-secondary)' : isDone ? '#15803d' : 'var(--color-on-surface-variant)' }}>
                                      STEP 0{st.num}
                                    </span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isDone ? '#15803d' : isCurrent ? 'var(--color-secondary)' : 'var(--color-outline)' }}>
                                      {isDone ? 'check_circle' : isCurrent ? 'pending' : 'lock'}
                                    </span>
                                  </div>
                                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    {st.title}
                                  </div>
                                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                                    {st.desc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bureau Stage Advancement Action Toolbar */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'var(--color-surface-container-low)',
                          padding: '12px 16px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-outline-variant)'
                        }}>
                          <div style={{ fontFamily: 'var(--font-headline)', fontSize: '13px', color: 'var(--color-primary)' }}>
                            <strong>Processing Stage:</strong> {isApproved ? 'All 4 Stages Completed — Final Approval Granted' : `Currently at Stage ${currentStage} (${steps[currentStage - 1].title})`}
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {currentStage > 1 && (
                              <button
                                className="btn-gazette-outline"
                                onClick={() => {
                                  const prevStage = currentStage - 1;
                                  handleUpdateStatus(item, 'pending', prevStage);
                                }}
                                style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px' }}
                              >
                                ← Previous Stage
                              </button>
                            )}
                            {currentStage < 4 ? (
                              <button
                                className="btn-gazette-red"
                                onClick={() => {
                                  const nextStage = currentStage + 1;
                                  const newStatus = nextStage === 4 ? 'registered' : 'pending';
                                  handleUpdateStatus(item, newStatus, nextStage);
                                }}
                                style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px' }}
                              >
                                Advance to Stage {currentStage + 1} ({steps[currentStage].title}) →
                              </button>
                            ) : (
                              <button
                                className="btn-gazette-outline"
                                onClick={() => handleUpdateStatus(item, 'pending', 3)}
                                style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px' }}
                              >
                                Reopen Review Stage
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                className="btn-gazette-outline"
                                onClick={() => handleUpdateStatus(item, 'rejected', 3)}
                                style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px', borderColor: '#b91c1c', color: '#b91c1c' }}
                              >
                                Reject &amp; Close Title
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Approved Certificate Banner */}
                        {isApproved && (
                          <div style={{
                            border: '2px solid #15803d',
                            backgroundColor: '#f0fdf4',
                            color: '#15803d',
                            padding: '16px',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <div>
                              <div className="gazette-label-caps" style={{ color: '#15803d', fontSize: '11px', marginBottom: '4px' }}>
                                OFFICIAL ALLOCATION CERTIFICATE ISSUED
                              </div>
                              <div style={{ fontFamily: 'var(--font-headline)', fontSize: '15px', fontWeight: 'bold' }}>
                                Title &quot;{item.title}&quot; is officially allocated and published in Gazette of India.
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '2px' }}>
                                Certificate Serial: PRGI-2026-CERT-{(item.id || 77675) * 3}
                              </div>
                            </div>
                            <button
                              className="btn-gazette-primary"
                              onClick={() => alert(`Certificate PRGI-2026-CERT-${(item.id || 77675) * 3} for "${item.title}" verified and ready for download.`)}
                              style={{ padding: '8px 16px', fontSize: '11px', borderRadius: '4px', backgroundColor: '#15803d', borderColor: '#15803d' }}
                            >
                              Download Certificate
                            </button>
                          </div>
                        )}

                        {/* Application Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)' }}>
                          <div>
                            <span className="gazette-label-caps" style={{ fontSize: '10px', color: 'var(--color-on-surface-variant)', display: 'block' }}>Language</span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>{item.language}</span>
                          </div>
                          <div>
                            <span className="gazette-label-caps" style={{ fontSize: '10px', color: 'var(--color-on-surface-variant)', display: 'block' }}>State</span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>{item.state}</span>
                          </div>
                          <div>
                            <span className="gazette-label-caps" style={{ fontSize: '10px', color: 'var(--color-on-surface-variant)', display: 'block' }}>Periodicity</span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>{item.periodicity}</span>
                          </div>
                          <div>
                            <span className="gazette-label-caps" style={{ fontSize: '10px', color: 'var(--color-on-surface-variant)', display: 'block' }}>Processing Unit</span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-primary)' }}>PRGI {item.state} Zone</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRGI Guidelines */}
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
                  <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '18px' }}>1. Phonetic &amp; Soundex Matching</h3>
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

          {/* TAB 5: Corpus Database */}
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
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {health ? health.total_titles.toLocaleString() : '—'}
                  </div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Total Titles Indexed</div>
                </div>
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {health ? health.registered_titles.toLocaleString() : '—'}
                  </div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Registered Titles</div>
                </div>
                <div style={{ border: '1px solid var(--color-primary)', padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setActiveTab('pending')}>
                  <div style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 800, color: 'var(--color-secondary)' }}>
                    {health ? health.pending_titles.toLocaleString() : pendingList.length || '—'}
                  </div>
                  <div className="gazette-label-caps" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>Pending Applications (View All →)</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-outline-variant)', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                <h3 style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '16px' }}>Database Synchronization</h3>
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  The corpus is automatically synchronized with the central Press Registration of India registry to ensure preliminary screening against all active, suspended, and pending title registrations.
                </p>
                <span className="gazette-label-caps" style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', color: health?.database_ready ? 'var(--color-secondary)' : '#b91c1c' }}>
                  {health ? (health.database_ready ? `Backend connected · ${health.status.toUpperCase()}` : 'Backend degraded') : 'Backend unreachable — start it with `python app.py` in /backend'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: Help & FAQ */}
          {activeTab === 'help' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <section style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '14px' }}>
                <h1 className="gazette-headline-lg" style={{ color: 'var(--color-primary)', margin: '0 0 6px 0', fontSize: '28px' }}>
                  PRGI Help &amp; Support
                </h1>
                <p className="gazette-body-lg" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0, fontSize: '15px' }}>
                  Frequently asked questions regarding publication title verification and pending applications.
                </p>
              </section>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '14px 16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>How do I track my registered pending application?</strong>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Click on &quot;Track Application&quot; in the left navigation sidebar and enter your PRGI reference code (e.g., PRGI-2026-PENDING-00012) or title name to view real-time status.</span>
                </div>

                <div style={{ border: '1px solid var(--color-outline-variant)', padding: '14px 16px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>Where can I view all pending applications?</strong>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Go to the &quot;Pending Applications&quot; tab in the sidebar to browse, search, and filter all press titles currently undergoing preliminary PRGI screening.</span>
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
