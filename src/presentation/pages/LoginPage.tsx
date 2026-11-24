import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthSplitShell } from '../components/AuthSplitShell';
import { IconEye, IconEyeOff } from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { signIn, clearError } = useAuthSession();

  const [nim, setNim] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${labels.auth.modeSignInTab} | ${labels.app.name}`;
  }, []);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    clearError();

    const trimmedNim = nim.trim().toUpperCase();
    if (trimmedNim.length === 0 || password.length === 0) {
      setFormError(labels.auth.errors.missingFields);
      return;
    }

    setIsSubmitting(true);
    try {
      const nextSession = await signIn({ nim: trimmedNim, password });
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
    <AuthSplitShell mode="login">
      <section className="index-card">
        <div className="auth-panel__header">
          <h1>{labels.auth.signInHeading}</h1>
          <p className="meta-text">
            Enter your campus ID (NIM, Lecturer ID, or Admin ID) and password to open your workspace.
          </p>
        </div>

        <form
          className="form-stack"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div className="field-group">
            <label htmlFor="login-nim" className="field-label">
              {labels.auth.nimLabel}
            </label>
            <input
              id="login-nim"
              name="nim"
              type="text"
              autoCapitalize="characters"
              autoComplete="username"
              className="field-input mono-input"
              placeholder={labels.auth.nimPlaceholder}
              aria-describedby="login-nim-hint"
              value={nim}
              onChange={(event) => setNim(event.target.value)}
              disabled={isSubmitting}
            />
            <p id="login-nim-hint" className="field-hint">
              {labels.auth.nimHint}
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="login-password" className="field-label">
              {labels.auth.passwordLabel}
            </label>
            <div className="figma-field__control">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
            {isSubmitting
              ? labels.auth.signInSubmitting
              : labels.auth.signInCta}
          </button>
        </form>

        <div className="auth-switch-bar">
          <span>New to LiteLearn?</span>
          <Link to="/register" className="auth-switch-bar__link">
            Create an account
          </Link>
        </div>
      </section>
    </AuthSplitShell>
  );
}

export default LoginPage;
