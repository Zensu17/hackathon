import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { OnboardingLayout } from '../components/AppLayout';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';

type AuthMode = 'signin' | 'signup';

export function SignInPage(): React.ReactElement {
  const navigate = useNavigate();
  const { signIn, signUp, clearError, isLocalFallbackMode } = useAuthSession();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [nim, setNim] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [classCode, setClassCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const heading =
    mode === 'signin' ? labels.auth.signInHeading : labels.auth.signUpHeading;

  useEffect(() => {
    document.title = `${heading} | ${labels.app.name}`;
  }, [heading]);

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setFormError(null);
    clearError();
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    clearError();

    const trimmedNim = nim.trim().toUpperCase();
    const trimmedName = displayName.trim();
    const trimmedClassCode = classCode.trim().toUpperCase();

    if (trimmedNim.length === 0 || password.length === 0) {
      setFormError(labels.auth.errors.missingFields);
      return;
    }

    if (mode === 'signup') {
      if (
        typeof navigator !== 'undefined' &&
        !navigator.onLine &&
        !isLocalFallbackMode
      ) {
        setFormError(labels.auth.errors.offlineSignUp);
        return;
      }

      if (trimmedName.length === 0) {
        setFormError(labels.auth.errors.missingDisplayName);
        return;
      }

      if (password.length < 8) {
        setFormError(labels.auth.errors.shortPassword);
        return;
      }

      if (confirmPassword !== password) {
        setFormError(labels.auth.errors.passwordMismatch);
        return;
      }

      if (trimmedClassCode.length === 0) {
        setFormError(labels.auth.errors.missingClassCode);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const nextSession =
        mode === 'signin'
          ? await signIn({ nim: trimmedNim, password })
          : await signUp({
              nim: trimmedNim,
              displayName: trimmedName,
              password,
              confirmPassword,
              classCode: trimmedClassCode,
            });

      if (nextSession.user.classId && nextSession.currentClass) {
        navigate('/', { replace: true });
      } else {
        navigate('/join-class', { replace: true });
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : labels.auth.errors.unexpected,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout>
      <div className="page-stack">
        <header className="page-header">
          <h1>{heading}</h1>
          <p className="page-lead">{labels.auth.tagline}</p>
        </header>

        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">
              {mode === 'signin' ? '[SIGN IN]' : '[NEW ACCOUNT]'}
            </span>
          </div>

          <div className="form-stack">
            <div
              className="mode-toggle"
              role="group"
              aria-label={labels.auth.modeSignInTab}
            >
              <button
                type="button"
                className="btn btn-secondary btn-toggle"
                aria-pressed={mode === 'signin'}
                onClick={() => switchMode('signin')}
              >
                {labels.auth.modeSignInTab}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-toggle"
                aria-pressed={mode === 'signup'}
                onClick={() => switchMode('signup')}
              >
                {labels.auth.modeSignUpTab}
              </button>
            </div>

            <form
              className="form-stack"
              noValidate
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="field-group">
                <label htmlFor="auth-nim" className="field-label">
                  {labels.auth.nimLabel}
                </label>
                <input
                  id="auth-nim"
                  name="nim"
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="username"
                  className="field-input mono-input"
                  placeholder={labels.auth.nimPlaceholder}
                  aria-describedby="auth-nim-hint"
                  value={nim}
                  onChange={(event) => setNim(event.target.value)}
                  disabled={isSubmitting}
                />
                <p id="auth-nim-hint" className="field-hint">
                  {labels.auth.nimHint}
                </p>
              </div>

              {mode === 'signup' ? (
                <div className="field-group">
                  <label htmlFor="auth-display-name" className="field-label">
                    {labels.auth.displayNameLabel}
                  </label>
                  <input
                    id="auth-display-name"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    className="field-input"
                    placeholder={labels.auth.displayNamePlaceholder}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}

              <div className="field-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  <label htmlFor="auth-password" className="field-label" style={{ margin: 0 }}>
                    {labels.auth.passwordLabel}
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    style={{ minHeight: '32px', padding: '2px 8px', fontSize: 'var(--text-meta)' }}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? labels.auth.hidePasswordAria
                        : labels.auth.showPasswordAria
                    }
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  className="field-input"
                  placeholder={labels.auth.passwordPlaceholder}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {mode === 'signup' ? (
                <>
                  <div className="field-group">
                    <label
                      htmlFor="auth-confirm-password"
                      className="field-label"
                    >
                      {labels.auth.confirmPasswordLabel}
                    </label>
                    <input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="field-input"
                      placeholder={labels.auth.confirmPasswordPlaceholder}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="auth-class-code" className="field-label">
                      {labels.auth.classCodeLabel}
                    </label>
                    <input
                      id="auth-class-code"
                      name="classCode"
                      type="text"
                      autoCapitalize="characters"
                      className="field-input mono-input"
                      placeholder={labels.auth.classCodePlaceholder}
                      aria-describedby="auth-class-code-hint"
                      value={classCode}
                      onChange={(event) => setClassCode(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <p id="auth-class-code-hint" className="field-hint">
                      {labels.auth.classCodeHint}
                    </p>
                  </div>
                </>
              ) : null}

              {formError ? (
                <div className="field-error" role="alert">
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={isSubmitting}
              >
                {mode === 'signin'
                  ? isSubmitting
                    ? labels.auth.signInSubmitting
                    : labels.auth.signInCta
                  : isSubmitting
                    ? labels.auth.signUpSubmitting
                    : labels.auth.signUpCta}
              </button>
            </form>
          </div>
        </section>

        {isLocalFallbackMode ? (
          <p className="notice-banner">{labels.app.localModeNotice}</p>
        ) : null}
      </div>
    </OnboardingLayout>
  );
}

export default SignInPage;
