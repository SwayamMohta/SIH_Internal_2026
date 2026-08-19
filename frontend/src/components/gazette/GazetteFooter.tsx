import React from 'react';

export const GazetteFooter: React.FC = () => {
  return (
    <footer className="gazette-footer">
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <p className="gazette-body-sm" style={{ color: 'var(--color-on-primary-container)', margin: 0 }}>
          © 2024 The PRGI Gazette. All Rights Reserved. Verification Edition.
        </p>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Imprint', 'Legal Disclaimers', 'Privacy Policy', 'Contact Editor', 'Sitemap'].map(link => (
            <a
              key={link}
              href="#"
              className="gazette-label-caps"
              style={{
                color: 'var(--color-on-primary-container)',
                opacity: 0.8,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.target as HTMLAnchorElement).style.opacity = '1'}
              onMouseLeave={e => (e.target as HTMLAnchorElement).style.opacity = '0.8'}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default GazetteFooter;
