import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { OnboardingLayout } from '../components/AppLayout';
import { SegmentedControl } from '../components/FigmaComponents';
import {
  BrandMark,
  IconCalendarCheck,
  IconCloudCheck,
  IconEye,
  IconEyeOff,
  IconNote,
} from '../components/Icons';
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
      <div className="auth-split">
        {/* Editorial Brand Identity Panel */}
        <section className="auth-editorial" aria-label="LiteLearn workspace overview">
          <div>
            <div className="auth-editorial__brand" style={{ marginBottom: '22px' }}>
              <BrandMark size={38} className="brand-lockup__mark" />
              <div>
                <div className="auth-editorial__brand-name">{labels.app.name}</div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--masthead-text-muted)',
                    fontWeight: 500,
                  }}
                >
                  IT Del Dormitory Study Index
                </div>
              </div>
            </div>

            <div className="auth-editorial__rule" aria-hidden="true" />
            <h2 className="auth-editorial__headline">{labels.auth.tagline}</h2>
            <p className="auth-editorial__desc">{labels.auth.intro}</p>
          </div>

          <ul className="auth-pillars">
            <li className="auth-pillar">
              <IconCloudCheck size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">Local-first IndexedDB cache</span>
                <span className="auth-pillar__body">
                  Courses, weekly summaries, and deadlines open immediately even when campus signal drops.
                </span>
              </div>
            </li>
            <li className="auth-pillar">
              <IconCalendarCheck size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">On-demand PDFs with Data Saver</span>
                <span className="auth-pillar__body">
                  Zero automatic downloads. Save only the lecture slides you need to your device.
                </span>
              </div>
            </li>
            <li className="auth-pillar">
              <IconNote size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">Private study notes &amp; queued sync</span>
                <span className="auth-pillar__body">
                  Write notes offline; updates stay safe locally and sync when your connection returns.
                </span>
              </div>
            </li>
          </ul>
        </section>

        {/* Tactile Sign-In / Sign-Up Desk */}
        <div className="auth-panel">
          <section className="index-card">
            <div className="auth-panel__header">
              <h1>{heading}</h1>
              <p className="meta-text">
                {mode === 'signin'
                  ? 'Use your IT Del student NIM and password.'
                  : 'Register with your NIM and class join code.'}
              </p>
            </div>

            <div className="form-stack">
              <SegmentedControl<AuthMode>
                options={['signin', 'signup']}
                active={mode}
                onChange={switchMode}
                labelsMap={{
                  signin: labels.auth.modeSignInTab,
                  signup: labels.auth.modeSignUpTab,
                }}
              />

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
                  <label htmlFor="auth-password" className="field-label">
                    {labels.auth.passwordLabel}
                  </label>
                  <div className="figma-field__control">
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        mode === 'signin' ? 'current-password' : 'new-password'
                      }
                      className="figma-field__input"
                      placeholder={labels.auth.passwordPlaceholder}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="figma-field__action"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? labels.auth.hidePasswordAria
                          : labels.auth.showPasswordAria
                      }
                    >
                      {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
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
                  className="figma-btn figma-btn--primary figma-btn--size-l btn-block"
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
            <section className="demo-credentials-box" aria-label="Local demo accounts">
              <p className="meta-text" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                Local demo mode (Class A sample data)
              </p>
              <p className="meta-text">{labels.app.localModeNotice}</p>
              <div className="action-row" style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    switchMode('signin');
                    setNim('11S22001');
                    setPassword('password123');
                  }}
                >
                  Fill Student (11S22001)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    switchMode('signin');
                    setNim('11S22002');
                    setPassword('password123');
                  }}
                >
                  Fill Class Rep (11S22002)
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </OnboardingLayout>
  );
}

export default SignInPage;
