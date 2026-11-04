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
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (mode === 'signup' && trimmedName.length === 0) {
      setFormError(labels.auth.errors.missingDisplayName);
      return;
    }

    if (trimmedEmail.length === 0 || password.length === 0) {
      setFormError(labels.auth.errors.missingFields);
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setFormError(labels.auth.errors.shortPassword);
      return;
    }

    setIsSubmitting(true);
    try {
      const nextSession =
        mode === 'signin'
          ? await signIn({ email: trimmedEmail, password })
          : await signUp({
              displayName: trimmedName,
              email: trimmedEmail,
              password,
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
          <p className="page-lead">{labels.auth.intro}</p>
        </header>

        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">
              {mode === 'signin' ? '[SIGN IN]' : '[NEW ACCOUNT]'}
            </span>
          </div>

          <div className="form-stack">
            <div className="mode-toggle" role="group" aria-label={labels.auth.modeSignInTab}>
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

            <form className="form-stack" noValidate onSubmit={(e) => void handleSubmit(e)}>
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
                <label htmlFor="auth-email" className="field-label">
                  {labels.auth.emailLabel}
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="field-input"
                  placeholder={labels.auth.emailPlaceholder}
                  aria-describedby="auth-email-hint"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
                <p id="auth-email-hint" className="field-hint">
                  {labels.auth.emailDomainHint}
                </p>
              </div>

              <div className="field-group">
                <label htmlFor="auth-password" className="field-label">
                  {labels.auth.passwordLabel}
                </label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
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
