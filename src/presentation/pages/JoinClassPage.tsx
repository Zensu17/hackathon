import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { OnboardingLayout } from '../components/AppLayout';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';

type BusyAction = 'join' | 'create' | 'seed' | 'signout' | null;

export function JoinClassPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    joinClass,
    createClass,
    loadSampleSeed,
    signOut,
    clearError,
    isLocalFallbackMode,
  } = useAuthSession();

  const [joinCode, setJoinCode] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [customJoinCode, setCustomJoinCode] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  useEffect(() => {
    document.title = `${labels.joinClass.heading} | ${labels.app.name}`;
  }, []);

  const handleJoin = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setJoinError(null);
    setCreateError(null);
    setSeedError(null);
    clearError();

    if (joinCode.trim().length === 0) {
      setJoinError(labels.joinClass.errors.missingJoinCode);
      return;
    }

    setBusyAction('join');
    try {
      await joinClass(joinCode);
      navigate('/', { replace: true });
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : labels.joinClass.errors.unexpected,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setJoinError(null);
    setCreateError(null);
    setSeedError(null);
    clearError();

    if (className.trim().length === 0) {
      setCreateError(labels.joinClass.errors.missingClassName);
      return;
    }

    setBusyAction('create');
    try {
      await createClass(className, customJoinCode);
      navigate('/', { replace: true });
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : labels.joinClass.errors.unexpected,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleLoadSeed = async (): Promise<void> => {
    setJoinError(null);
    setCreateError(null);
    setSeedError(null);
    clearError();

    setBusyAction('seed');
    try {
      await loadSampleSeed();
      navigate('/', { replace: true });
    } catch (err) {
      setSeedError(
        err instanceof Error ? err.message : labels.joinClass.errors.unexpected,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setBusyAction('signout');
    try {
      await signOut();
      navigate('/signin', { replace: true });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <OnboardingLayout
      wideOnDesktop
      headerAction={
        <button
          type="button"
          className="btn btn-secondary app-theme-btn"
          onClick={() => void handleSignOut()}
          disabled={busyAction !== null}
        >
          {busyAction === 'signout'
            ? labels.common.signingOut
            : labels.common.signOut}
        </button>
      }
    >
      <div className="page-stack">
        <header className="page-header">
          <h1>{labels.joinClass.heading}</h1>
          <p className="page-lead">{labels.joinClass.intro}</p>
        </header>

        <div className="onboarding-grid onboarding-grid--two-col">
          <section className="index-card">
            <div className="card-tab-bar">
              <span className="card-tab-code">[STUDENT]</span>
            </div>
            <h2>{labels.joinClass.joinCardTitle}</h2>
            <p className="meta-text">{labels.joinClass.joinCardDescription}</p>

            <form
              className="form-stack"
              style={{ marginTop: 'var(--space-3)' }}
              noValidate
              onSubmit={(e) => void handleJoin(e)}
            >
              <div className="field-group">
                <label htmlFor="join-code-input" className="field-label">
                  {labels.joinClass.joinCodeLabel}
                </label>
                <input
                  id="join-code-input"
                  name="joinCode"
                  type="text"
                  className="field-input mono-input"
                  placeholder={labels.joinClass.joinCodePlaceholder}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  disabled={busyAction !== null}
                />
              </div>

              {joinError ? (
                <div className="field-error" role="alert">
                  {joinError}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={busyAction !== null}
              >
                {busyAction === 'join'
                  ? labels.joinClass.joining
                  : labels.joinClass.joinCta}
              </button>
            </form>
          </section>

          <section className="index-card">
            <div className="card-tab-bar">
              <span className="card-tab-code">[REP]</span>
            </div>
            <h2>{labels.joinClass.createCardTitle}</h2>
            <p className="meta-text">{labels.joinClass.createCardDescription}</p>

            <form
              className="form-stack"
              style={{ marginTop: 'var(--space-3)' }}
              noValidate
              onSubmit={(e) => void handleCreate(e)}
            >
              <div className="field-group">
                <label htmlFor="create-class-name" className="field-label">
                  {labels.joinClass.classNameLabel}
                </label>
                <input
                  id="create-class-name"
                  name="className"
                  type="text"
                  className="field-input"
                  placeholder={labels.joinClass.classNamePlaceholder}
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  disabled={busyAction !== null}
                />
              </div>

              <div className="field-group">
                <label htmlFor="create-join-code" className="field-label">
                  {labels.joinClass.customJoinCodeLabel}
                </label>
                <input
                  id="create-join-code"
                  name="customJoinCode"
                  type="text"
                  className="field-input mono-input"
                  placeholder={labels.joinClass.customJoinCodePlaceholder}
                  value={customJoinCode}
                  onChange={(event) => setCustomJoinCode(event.target.value)}
                  disabled={busyAction !== null}
                />
              </div>

              {createError ? (
                <div className="field-error" role="alert">
                  {createError}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={busyAction !== null}
              >
                {busyAction === 'create'
                  ? labels.joinClass.creating
                  : labels.joinClass.createCta}
              </button>
            </form>
          </section>
        </div>

        {isLocalFallbackMode ? (
          <section className="index-card">
            <div className="card-tab-bar">
              <span className="card-tab-code">[SAMPLE SEED]</span>
            </div>
            <h2>{labels.joinClass.demoCardTitle}</h2>
            <p className="meta-text">{labels.joinClass.demoCardDescription}</p>
            {seedError ? (
              <div className="field-error" role="alert">
                {seedError}
              </div>
            ) : null}
            <div className="action-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleLoadSeed()}
                disabled={busyAction !== null}
              >
                {busyAction === 'seed'
                  ? labels.joinClass.loadingSeed
                  : labels.joinClass.loadSeedCta}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </OnboardingLayout>
  );
}

export default JoinClassPage;
