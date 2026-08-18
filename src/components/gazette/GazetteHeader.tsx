import React from 'react';

interface GazetteHeaderProps {
  activePage?: 'verification' | 'news' | 'records' | 'editorials' | 'archives';
  onNavClick?: (page: string) => void;
}

export const GazetteHeader: React.FC<GazetteHeaderProps> = ({
  activePage = 'verification',
  onNavClick
}) => {
  const navLinks = [
    { id: 'verification', label: 'Verification' },
    { id: 'news', label: 'Latest News' },
    { id: 'records', label: 'Public Records' },
    { id: 'editorials', label: 'Editorials' },
    { id: 'archives', label: 'Archives' },
  ];

  return (
    <header style={{
      backgroundColor: 'var(--color-background)',
      width: '100%',
      paddingTop: '16px',
      paddingBottom: '8px',
      borderBottom: '4px solid var(--color-primary)',
      flexShrink: 0,
    }}>
      <div className="gazette-container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '8px',
        }}>
          <h1 className="gazette-masthead" style={{
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1,
          }}>
            The PRGI Gazette
          </h1>

          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', paddingBottom: '4px' }}>
            {navLinks.filter(link => link.id !== 'verification').map(link => (
              <a
                key={link.id}
                href="#"
                onClick={(e) => { e.preventDefault(); onNavClick?.(link.id); }}
                className="gazette-label-caps"
                style={{
                  color: activePage === link.id ? 'var(--color-secondary)' : 'var(--color-primary)',
                  borderBottom: activePage === link.id ? '2px solid var(--color-secondary)' : '2px solid transparent',
                  paddingBottom: '4px',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  flexShrink: 0,
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--color-primary)',
          marginTop: '8px',
        }} />
      </div>
    </header>
  );
};

export default GazetteHeader;
