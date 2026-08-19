import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroNewspaperRoll } from './components/hero/HeroNewspaperRoll';
import { LandingPage } from './components/pages/LandingPage';
import { SubmitPage } from './components/pages/SubmitPage';
import { ResultsPage } from './components/pages/ResultsPage';
import type { VerificationData } from './components/pages/SubmitPage';

type AppState = 'intro' | 'circle-wipe' | 'landing' | 'submit' | 'results';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('intro');
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [circleSize, setCircleSize] = useState(0);

  // When newspaper roll animation is done → trigger the circle iris wipe
  const handleRollComplete = useCallback(() => {
    setAppState('circle-wipe');
  }, []);

  // Animate the circle expanding from center to cover the screen
  useEffect(() => {
    if (appState !== 'circle-wipe') return;

    // Calculate the diagonal of the viewport (maximum radius needed)
    const maxRadius = Math.ceil(Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2)) * 2 + 100;

    // Animate: start tiny, expand to cover everything
    const duration = 380; // ms
    const start = performance.now();
    let animId: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setCircleSize(eased * maxRadius);

      if (t < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        // Circle has fully covered the screen — switch to landing page
        setCircleSize(maxRadius);
        setTimeout(() => {
          setAppState('landing');
        }, 30);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [appState]);

  const [submitInitialTab, setSubmitInitialTab] = useState<'verify' | 'pending' | 'guidelines' | 'corpus' | 'status' | 'help'>('verify');
  const [submitTrackQuery, setSubmitTrackQuery] = useState('');

  const handleStartVerification = useCallback(() => {
    setSubmitInitialTab('verify');
    setAppState('submit');
  }, []);

  const handleVerify = useCallback((data: VerificationData) => {
    setVerificationData(data);
    setAppState('results');
  }, []);

  const handleBackToSubmit = useCallback(() => {
    setSubmitInitialTab('verify');
    setAppState('submit');
  }, []);

  const handleNewVerification = useCallback(() => {
    setVerificationData(null);
    setSubmitInitialTab('verify');
    setAppState('submit');
  }, []);

  const handleBackToLanding = useCallback(() => {
    setAppState('landing');
  }, []);

  const handleTrackPending = useCallback((refNum: string) => {
    setSubmitTrackQuery(refNum);
    setSubmitInitialTab('status');
    setAppState('submit');
  }, []);

  const handleViewPending = useCallback(() => {
    setSubmitInitialTab('pending');
    setAppState('submit');
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', minHeight: '100vh', overflow: 'hidden' }}>

      {/* ── INTRO: 3D Newspaper Roll ── */}
      {(appState === 'intro' || appState === 'circle-wipe') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }}>
          <main className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#f6f2e8' }}>
            <HeroNewspaperRoll
              isBackground={false}
              onComplete={handleRollComplete}
            />
          </main>
        </div>
      )}

      {/* ── CIRCLE WIPE OVERLAY ── */}
      {appState === 'circle-wipe' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              borderRadius: '50%',
              backgroundColor: '#fbf9f8', // matches landing page background
              position: 'absolute',
              // Centered on screen
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'none',
            }}
          />
        </div>
      )}

      {/* ── LANDING PAGE ── */}
      <AnimatePresence>
        {appState === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'relative', zIndex: 20 }}
          >
            <LandingPage onStartVerification={handleStartVerification} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SUBMIT PAGE ── */}
      <AnimatePresence>
        {appState === 'submit' && (
          <motion.div
            key="submit"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            style={{ position: 'relative', zIndex: 20 }}
          >
            <SubmitPage
              onVerify={handleVerify}
              onBack={handleBackToLanding}
              initialTab={submitInitialTab}
              initialTrackQuery={submitTrackQuery}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULTS PAGE ── */}
      <AnimatePresence>
        {appState === 'results' && verificationData && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            style={{ position: 'relative', zIndex: 20 }}
          >
            <ResultsPage
              data={verificationData}
              onBack={handleBackToSubmit}
              onNewVerification={handleNewVerification}
              onTrackPending={handleTrackPending}
              onViewPending={handleViewPending}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
