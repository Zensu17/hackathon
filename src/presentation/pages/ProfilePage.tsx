import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import { canManageClassContent, isAdminRole } from '../../domain/rules';
import { Chip } from '../components/FigmaComponents';
import {
  IconArrowLeft,
  IconCamera,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconShield,
  IconTrash,
  IconUser,
  IconUsers,
} from '../components/Icons';
import { UserAvatar } from '../components/UserAvatar';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';
import { getRoleLabel, getRoleSummary } from '../utils/formatters';

const AVATAR_COLOR_OPTIONS: ReadonlyArray<{ hex: string; name: string }> = [
  { hex: '#2563EB', name: 'Cobalt Blue' },
  { hex: '#0F766E', name: 'Deep Teal' },
  { hex: '#6D28D9', name: 'Academic Violet' },
  { hex: '#B45309', name: 'Warm Ochre' },
  { hex: '#BE185D', name: 'Berry Rose' },
  { hex: '#1E293B', name: 'Slate Charcoal' },
];

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Could not read the selected image file.'));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error('Please choose a valid PNG, JPEG, or WebP image.'));
      };
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas image processing is unavailable.'));
          return;
        }

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.length > 120_000) {
          reject(
            new Error('Compressed image is still too large. Pick a simpler photo.'),
          );
          return;
        }
        resolve(dataUrl);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage(): React.ReactElement {
  const container = useAppContainer();
  const { session, updateProfile, isLocalFallbackMode } = useAuthSession();
  const user = session?.user ?? null;
  const currentClass = session?.currentClass ?? null;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState<string>(user?.displayName ?? '');
  const [studyProgram, setStudyProgram] = useState<string>(user?.studyProgram ?? '');
  const [bio, setBio] = useState<string>(user?.bio ?? '');
  const [avatarColor, setAvatarColor] = useState<string>(
    user?.avatarColor ?? '#2563EB',
  );
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(
    user?.avatarDataUrl ?? null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [showCurrentPw, setShowCurrentPw] = useState<boolean>(false);
  const [showNewPw, setShowNewPw] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${labels.profile.heading} | ${labels.app.name}`;
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    setDisplayName(user.displayName);
    setStudyProgram(user.studyProgram ?? '');
    setBio(user.bio ?? '');
    setAvatarColor(user.avatarColor ?? '#2563EB');
    setAvatarDataUrl(user.avatarDataUrl ?? null);
  }, [user]);

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setFormError(null);
    if (!file.type.startsWith('image/')) {
      setFormError('Select a PNG, JPEG, or WebP image file.');
      return;
    }

    try {
      const compactDataUrl = await resizeImageToDataUrl(file);
      setAvatarDataUrl(compactDataUrl);
      toast.info('Photo ready. Save changes to apply.');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not process selected photo.',
      );
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    if (displayName.trim().length === 0) {
      setFormError('Display name is required.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        studyProgram: studyProgram.trim(),
        bio: bio.trim(),
        avatarColor,
        avatarDataUrl,
      });
      toast.success(labels.profile.savedToast);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not save profile changes.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!user) {
      return;
    }
    setPasswordError(null);

    if (currentPassword.length === 0) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (confirmNewPassword !== newPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError(
        'Choose a new password different from your current password.',
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      await container.changeOwnPassword({
        userId: user.id,
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success(labels.profile.passwordChangedToast);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Could not update password.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="page-stack">
        <p className="meta-text">{labels.common.loadingPage}</p>
      </div>
    );
  }

  const previewName = displayName.trim() || user.displayName;
  const activeRole = user.role ?? 'student';
  const activeRoleLabel = getRoleLabel(activeRole);
  const isAdmin = isAdminRole(user.role);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{labels.profile.heading}</h1>
            <p className="page-lead">{labels.profile.intro}</p>
          </div>
          <div className="breadcrumb-row">
            <Link to="/settings" className="breadcrumb-link">
              <IconArrowLeft size={15} />
              <span>{labels.nav.settings}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="profile-grid">
        <aside
          className="index-card profile-preview-card"
          aria-label={labels.profile.previewHeading}
        >
          <div className="card-tab-bar" style={{ marginBottom: 0 }}>
            <span className="card-tab-code">{user.nim}</span>
            <Chip
              type={canManageClassContent(activeRole) ? 'info' : 'neutral'}
              size="S"
              icon={<IconUser size={13} />}
              label={activeRoleLabel}
            />
          </div>

          <div className="profile-preview-card__top">
            <UserAvatar
              displayName={previewName}
              avatarColor={avatarColor}
              avatarDataUrl={avatarDataUrl}
              size="xl"
            />
            <div className="profile-preview-card__identity">
              <h2>{previewName}</h2>
              <p className="meta-text" style={{ fontWeight: 600 }}>
                {studyProgram.trim() || 'Program not set yet'}
              </p>
              {currentClass ? (
                <span className="status-chip mono-code">
                  {`${currentClass.name} (${currentClass.joinCode})`}
                </span>
              ) : null}
            </div>
          </div>

          <p className="profile-preview-card__bio">
            {bio.trim() ||
              'Add a short study focus, lab group, or contact note so teammates know your role.'}
          </p>

          <p className="field-hint" style={{ margin: 0 }}>
            {getRoleSummary(activeRole)}
          </p>
        </aside>

        <div className="card-stack">
          <section
            className="index-card"
            aria-labelledby="profile-form-heading"
          >
            <div className="card-tab-bar">
              <span className="card-tab-code">IDENTITY</span>
              <Chip
                type="success"
                size="S"
                icon={<IconCheckCircle size={13} />}
                label={isLocalFallbackMode ? 'Saved on device' : 'Synced profile'}
              />
            </div>

            <h2 id="profile-form-heading" style={{ marginBottom: '16px' }}>
              {labels.profile.formHeading}
            </h2>

            <form
              className="form-stack"
              noValidate
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="field-group">
                <label htmlFor="profile-display-name" className="field-label">
                  {labels.profile.displayNameLabel}
                </label>
                <input
                  id="profile-display-name"
                  name="displayName"
                  type="text"
                  maxLength={80}
                  className="field-input"
                  placeholder={labels.profile.displayNamePlaceholder}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="field-group">
                <label htmlFor="profile-study-program" className="field-label">
                  {labels.profile.studyProgramLabel}
                </label>
                <input
                  id="profile-study-program"
                  name="studyProgram"
                  type="text"
                  maxLength={80}
                  className="field-input"
                  placeholder={labels.profile.studyProgramPlaceholder}
                  value={studyProgram}
                  onChange={(e) => setStudyProgram(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="field-group">
                <label htmlFor="profile-bio" className="field-label">
                  {labels.profile.bioLabel}
                </label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  maxLength={240}
                  className="field-input"
                  placeholder={labels.profile.bioPlaceholder}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isSaving}
                />
                <div className="bio-counter-row">
                  <span>Visible on your profile card</span>
                  <span className="tabular-nums">{`${bio.length}/240`}</span>
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">
                  {labels.profile.avatarColorLabel}
                </span>
                <div
                  className="avatar-swatch-row"
                  role="radiogroup"
                  aria-label={labels.profile.avatarColorLabel}
                >
                  {AVATAR_COLOR_OPTIONS.map((swatch) => {
                    const isActive =
                      avatarColor.toUpperCase() === swatch.hex.toUpperCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={swatch.name}
                        title={swatch.name}
                        className={
                          isActive
                            ? 'avatar-swatch avatar-swatch--active'
                            : 'avatar-swatch'
                        }
                        style={{ backgroundColor: swatch.hex }}
                        onClick={() => setAvatarColor(swatch.hex)}
                        disabled={isSaving}
                      >
                        {isActive ? <IconCheckCircle size={16} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">
                  {labels.profile.avatarPhotoLabel}
                </span>
                <div className="avatar-upload-row">
                  <input
                    ref={fileInputRef}
                    id="profile-avatar-upload"
                    name="avatarFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => void handlePhotoChange(e)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    <IconCamera size={15} />
                    <span>{labels.profile.uploadPhotoCta}</span>
                  </button>
                  {avatarDataUrl ? (
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-compact"
                      onClick={() => setAvatarDataUrl(null)}
                      disabled={isSaving}
                    >
                      <IconTrash size={15} />
                      <span>{labels.profile.removePhotoCta}</span>
                    </button>
                  ) : null}
                </div>
                <p className="field-hint">{labels.profile.photoHint}</p>
              </div>

              <div className="profile-role-readonly">
                <div className="profile-role-readonly__head">
                  <span className="field-label" style={{ marginBottom: 0 }}>
                    {labels.profile.roleLabel}
                  </span>
                  <Chip
                    type={canManageClassContent(activeRole) ? 'info' : 'neutral'}
                    size="S"
                    icon={<IconShield size={13} />}
                    label={activeRoleLabel}
                  />
                </div>
                <p className="field-hint" style={{ margin: 0 }}>
                  {labels.profile.roleManagedHint}
                </p>
                {isAdmin ? (
                  <div style={{ marginTop: '4px' }}>
                    <Link
                      to="/admin/users"
                      className="btn btn-secondary btn-compact"
                    >
                      <IconUsers size={15} />
                      <span>Open Admin Users</span>
                    </Link>
                  </div>
                ) : null}
              </div>

              {formError ? (
                <div className="field-error" role="alert">
                  {formError}
                </div>
              ) : null}

              <div className="action-row">
                <button
                  type="submit"
                  className="figma-btn figma-btn--primary figma-btn--size-m"
                  disabled={isSaving}
                >
                  {isSaving ? labels.profile.savingCta : labels.profile.saveCta}
                </button>
                <Link to="/" className="btn btn-secondary">
                  {labels.repForm.returnHomeCta}
                </Link>
              </div>
            </form>
          </section>

          <section
            className="index-card"
            aria-labelledby="profile-password-heading"
          >
            <div className="card-tab-bar">
              <span className="card-tab-code">SECURITY</span>
            </div>
            <h2 id="profile-password-heading" style={{ marginBottom: '6px' }}>
              {labels.profile.passwordSectionHeading}
            </h2>
            <p className="meta-text" style={{ marginBottom: '16px' }}>
              Update your account password. Requires at least 8 characters.
            </p>

            <form
              className="form-stack"
              noValidate
              onSubmit={(e) => void handlePasswordSubmit(e)}
            >
              <div className="field-group">
                <label htmlFor="profile-current-password" className="field-label">
                  {labels.profile.currentPasswordLabel}
                </label>
                <div className="figma-field__control">
                  <input
                    id="profile-current-password"
                    name="currentPassword"
                    type={showCurrentPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="figma-field__input"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    className="figma-field__action"
                    onClick={() => setShowCurrentPw((prev) => !prev)}
                    aria-label={
                      showCurrentPw
                        ? labels.auth.hidePasswordAria
                        : labels.auth.showPasswordAria
                    }
                  >
                    {showCurrentPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              <div className="admin-inline-form-grid">
                <div className="field-group">
                  <label htmlFor="profile-new-password" className="field-label">
                    {labels.profile.newPasswordLabel}
                  </label>
                  <div className="figma-field__control">
                    <input
                      id="profile-new-password"
                      name="newPassword"
                      type={showNewPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="figma-field__input"
                      placeholder={labels.auth.passwordPlaceholder}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                    <button
                      type="button"
                      className="figma-field__action"
                      onClick={() => setShowNewPw((prev) => !prev)}
                      aria-label={
                        showNewPw
                          ? labels.auth.hidePasswordAria
                          : labels.auth.showPasswordAria
                      }
                    >
                      {showNewPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="field-group">
                  <label
                    htmlFor="profile-confirm-new-password"
                    className="field-label"
                  >
                    {labels.profile.confirmNewPasswordLabel}
                  </label>
                  <input
                    id="profile-confirm-new-password"
                    name="confirmNewPassword"
                    type={showNewPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="field-input"
                    placeholder="Re-enter new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={isChangingPassword}
                  />
                </div>
              </div>

              {passwordError ? (
                <div className="field-error" role="alert">
                  {passwordError}
                </div>
              ) : null}

              <div className="action-row" style={{ marginTop: 0 }}>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword
                    ? labels.profile.changingPasswordCta
                    : labels.profile.changePasswordCta}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
