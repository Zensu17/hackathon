import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useTheme } from '../hooks/useTheme';
import { labels } from '../i18n/labels';

export function SettingsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, signOut, isLocalFallbackMode } = useAuthSession();
  const { theme, setTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${labels.settings.heading} | ${labels.app.name}`;
  }, []);

  const user = session?.user ?? null;
  const currentClass = session?.currentClass ?? null;
  const roleLabel =
    user?.role === 'rep' ? labels.app.roleRep : labels.app.roleStudent;
  const activeThemeLabel =
    theme === 'dark' ? labels.settings.darkModeButton : labels.settings.lightModeButton;

  const handleCopyCode = async (): Promise<void> => {
    if (!currentClass?.joinCode) {
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(currentClass.joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard write failure
    }
  };

  const handleSignOut = async (clearLocalData = false): Promise<void> => {
    if (clearLocalData) {
      setIsClearing(true);
    } else {
      setIsSigningOut(true);
    }
    try {
      await signOut({ clearLocalData });
      navigate('/signin', { replace: true });
    } finally {
      setIsSigningOut(false);
      setIsClearing(false);
    }
  };

  return (
    <div className="page-stack settings-workspace">
      <header className="page-header">
        <h1>{labels.settings.heading}</h1>
      </header>

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">[THEME]</span>
          <span className="status-chip">
            {`${labels.settings.activeThemePrefix} ${activeThemeLabel}`}
          </span>
        </div>
        <h2>{labels.settings.themeCardTitle}</h2>
        <p className="meta-text">{labels.settings.themeCardDescription}</p>
        <div className="action-row" role="group" aria-label={labels.settings.themeCardTitle}>
          <button
            type="button"
            className="btn btn-secondary btn-toggle"
            aria-pressed={theme === 'light'}
            onClick={() => void setTheme('light')}
          >
            {labels.settings.lightModeButton}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-toggle"
            aria-pressed={theme === 'dark'}
            onClick={() => void setTheme('dark')}
          >
            {labels.settings.darkModeButton}
          </button>
        </div>
      </section>

      {user ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">[ACCOUNT]</span>
          </div>
          <h2>{labels.settings.profileCardTitle}</h2>
          <dl className="meta-dl">
            <div className="meta-dl__item">
              <dt>{labels.settings.nameLabel}</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div className="meta-dl__item">
              <dt>{labels.settings.nimLabel}</dt>
              <dd className="mono-code">{user.nim}</dd>
            </div>
            <div className="meta-dl__item">
              <dt>{labels.settings.roleLabel}</dt>
              <dd>{roleLabel}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {currentClass ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">[CLASS]</span>
          </div>
          <h2>{labels.settings.classCardTitle}</h2>
          <dl className="meta-dl">
            <div className="meta-dl__item">
              <dt>{labels.settings.classNameLabel}</dt>
              <dd>{currentClass.name}</dd>
            </div>
            <div className="meta-dl__item">
              <dt>{labels.settings.joinCodeLabel}</dt>
              <dd
                className="mono-code"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <span>{currentClass.joinCode}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => void handleCopyCode()}
                  aria-live="polite"
                >
                  {copied
                    ? labels.settings.codeCopied
                    : labels.settings.copyCodeButton}
                </button>
              </dd>
            </div>
          </dl>
          <p className="field-hint" style={{ marginTop: 'var(--space-3)' }}>
            {labels.settings.joinCodeShareHint}
          </p>
        </section>
      ) : null}

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">[STORAGE]</span>
        </div>
        <h2>{labels.settings.environmentCardTitle}</h2>
        <p className="meta-text">
          {isLocalFallbackMode
            ? labels.app.localModeNotice
            : labels.settings.onlineModeDescription}
        </p>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleSignOut(false)}
            disabled={isSigningOut || isClearing}
          >
            {isSigningOut ? labels.common.signingOut : labels.common.signOut}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleSignOut(true)}
            disabled={isSigningOut || isClearing}
          >
            {isClearing
              ? labels.common.signingOutAndClearing
              : labels.common.signOutAndClear}
          </button>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
