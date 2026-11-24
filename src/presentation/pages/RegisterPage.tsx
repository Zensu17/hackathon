import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { UserRole } from '../../domain/entities';
import { isValidNim, USER_ROLES } from '../../domain/rules';
import { AuthSplitShell } from '../components/AuthSplitShell';
import { IconCheckCircle, IconEye, IconEyeOff } from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';
import { getRoleLabel, getRoleSummary } from '../utils/formatters';

function getIdExampleForRole(role: UserRole): {
  placeholder: string;
  hint: string;
} {
  if (role === 'lecturer') {
    return {
      placeholder: '01D10001',
      hint: 'Enter your 8-character lecturer ID: 2 digits, 1 letter, 5 digits (e.g. 01D10001).',
    };
  }
  if (role === 'admin') {
    return {
      placeholder: '00A00001',
      hint: 'Enter your 8-character admin ID: 2 digits, 1 letter, 5 digits (e.g. 00A00001).',
    };
  }
  return {
    placeholder: '11S22001',
    hint: labels.auth.nimHint,
  };
}

export function RegisterPage(): React.ReactElement {
  const navigate = useNavigate();
  const { signUp, clearError, isLocalFallbackMode } = useAuthSession();

  const [role, setRole] = useState<UserRole>('student');
  const [nim, setNim] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [classCode, setClassCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${labels.auth.modeSignUpTab} | ${labels.app.name}`;
  }, []);

  const trimmedNim = nim.trim().toUpperCase();
  const hasNimInput = trimmedNim.length > 0;
  const nimLooksValid = isValidNim(trimmedNim);
  const idCopy = getIdExampleForRole(role);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    clearError();

    const trimmedName = displayName.trim();
    const trimmedClassCode = classCode.trim().toUpperCase();

    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine === false &&
      !isLocalFallbackMode
    ) {
      setFormError(labels.auth.errors.offlineSignUp);
      return;
    }

    if (trimmedNim.length === 0) {
      setFormError(labels.auth.errors.missingFields);
      return;
    }

    if (!nimLooksValid) {
      setFormError(labels.auth.errors.invalidNim);
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

    setIsSubmitting(true);
    try {
      const nextSession = await signUp({
        nim: trimmedNim,
        displayName: trimmedName,
        password,
        confirmPassword,
        classCode: trimmedClassCode,
        role,
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
    <AuthSplitShell mode="register">
      <section className="index-card">
        <div className="auth-panel__header">
          <h1>{labels.auth.signUpHeading}</h1>
          <p className="meta-text">
            Choose your campus role, enter your ID and class code, and start studying offline.
          </p>
        </div>

        <form
          className="form-stack"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <fieldset
            className="field-group"
            style={{ border: 'none', padding: 0, margin: 0 }}
          >
            <legend className="field-label">{labels.auth.roleLabel}</legend>
            <div className="role-picker-grid" role="radiogroup" aria-label={labels.auth.roleLabel}>
              {USER_ROLES.map((candidate) => {
                const isSelected = role === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={
                      isSelected
                        ? 'role-option-card role-option-card--active'
                        : 'role-option-card'
                    }
                    onClick={() => setRole(candidate)}
                    disabled={isSubmitting}
                  >
                    <span className="role-option-card__title">
                      {getRoleLabel(candidate)}
                    </span>
                    <span className="role-option-card__desc">
                      {candidate === 'student'
                        ? 'Courses & notes'
                        : candidate === 'rep'
                          ? 'Cohort updates'
                          : candidate === 'lecturer'
                            ? 'Publish lectures'
                            : candidate === 'assistant'
                              ? 'Labs & tutorials'
                              : 'Manage roles'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="field-hint" style={{ marginTop: '8px' }}>
              {getRoleSummary(role)}
            </p>
          </fieldset>

          <div className="field-group">
            <label htmlFor="register-nim" className="field-label">
              {labels.auth.nimLabel}
            </label>
            <input
              id="register-nim"
              name="nim"
              type="text"
              autoCapitalize="characters"
              autoComplete="username"
              className="field-input mono-input"
              placeholder={idCopy.placeholder}
              aria-describedby="register-nim-hint"
              value={nim}
              onChange={(event) => setNim(event.target.value)}
              disabled={isSubmitting}
            />
            {hasNimInput && nimLooksValid ? (
              <p
                id="register-nim-hint"
                className="field-status-hint field-status-hint--valid"
              >
                <IconCheckCircle size={15} />
                <span>Valid 8-character ID format</span>
              </p>
            ) : (
              <p id="register-nim-hint" className="field-hint">
                {hasNimInput
                  ? `Use 2 digits, 1 letter, and 5 digits (e.g. ${idCopy.placeholder}).`
                  : idCopy.hint}
              </p>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="register-display-name" className="field-label">
              {labels.auth.displayNameLabel}
            </label>
            <input
              id="register-display-name"
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

          <div className="field-group">
            <label htmlFor="register-password" className="field-label">
              {labels.auth.passwordLabel}
            </label>
            <div className="figma-field__control">
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="figma-field__input"
                placeholder={labels.auth.passwordPlaceholder}
                aria-describedby="register-password-hint"
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
            <p id="register-password-hint" className="field-hint">
              Use at least 8 characters.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="register-confirm-password" className="field-label">
              {labels.auth.confirmPasswordLabel}
            </label>
            <div className="figma-field__control">
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="figma-field__input"
                placeholder={labels.auth.confirmPasswordPlaceholder}
                aria-describedby="register-confirm-hint"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="figma-field__action"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? labels.auth.hidePasswordAria
                    : labels.auth.showPasswordAria
                }
              >
                {showConfirmPassword ? (
                  <IconEyeOff size={18} />
                ) : (
                  <IconEye size={18} />
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword === password ? (
              <p
                id="register-confirm-hint"
                className="field-status-hint field-status-hint--valid"
              >
                <IconCheckCircle size={15} />
                <span>Passwords match</span>
              </p>
            ) : confirmPassword.length > 0 ? (
              <p id="register-confirm-hint" className="field-hint">
                Make sure both password fields match.
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="register-class-code" className="field-label">
              {labels.auth.classCodeLabel}
            </label>
            <input
              id="register-class-code"
              name="classCode"
              type="text"
              autoCapitalize="characters"
              className="field-input mono-input"
              placeholder={labels.auth.classCodePlaceholder}
              aria-describedby="register-class-code-hint"
              value={classCode}
              onChange={(event) => setClassCode(event.target.value)}
              disabled={isSubmitting}
            />
            <p id="register-class-code-hint" className="field-hint">
              {isLocalFallbackMode
                ? labels.auth.classCodeHintLocal
                : labels.auth.classCodeHintOnline}
            </p>
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
              ? labels.auth.signUpSubmitting
              : labels.auth.signUpCta}
          </button>
        </form>

        <div className="auth-switch-bar">
          <span>Already have an account?</span>
          <Link to="/login" className="auth-switch-bar__link">
            Sign in
          </Link>
        </div>
      </section>
    </AuthSplitShell>
  );
}

export default RegisterPage;
