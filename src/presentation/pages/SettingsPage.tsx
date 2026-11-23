import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { type ThemePreference, useAppContainer } from '../../app/di';
import { formatByteSize } from '../../domain/rules';
import {
  Chip,
  SegmentedControl,
  Toggle,
} from '../components/FigmaComponents';
import {
  IconCheckCircle,
  IconCloudCheck,
  IconCloudDownload,
  IconLogout,
  IconRefresh,
  IconTrash,
} from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTheme } from '../hooks/useTheme';
import { labels } from '../i18n/labels';
import { formatDateTime, getInitials } from '../utils/formatters';

export function SettingsPage(): React.ReactElement {
  const navigate = useNavigate();
  const container = useAppContainer();
  const { session, signOut, isLocalFallbackMode } = useAuthSession();
  const { preference, theme, setTheme } = useTheme();
  const networkState = useNetworkStatus();
  const {
    isSyncing,
    lastSyncAt,
    pendingChanges,
    lastError,
    syncNow,
  } = useSyncStatus();
  const { canInstall, isInstalled, install } = useInstallPrompt();

  const [dataSaver, setDataSaver] = useState<boolean>(true);
  const [storageStats, setStorageStats] = useState<{
    fileCount: number;
    totalBytes: number;
  }>({ fileCount: 0, totalBytes: 0 });
  const [isClearingPdfs, setIsClearingPdfs] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const loadStorageInfo = useCallback(async (): Promise<void> => {
    const [saver, stats] = await Promise.all([
      container.getDataSaverEnabled(),
      container.getOfflineStorageStats(),
    ]);
    setDataSaver(saver);
    setStorageStats(stats);
  }, [container]);

  useEffect(() => {
    document.title = `${labels.settings.heading} | ${labels.app.name}`;
    void loadStorageInfo();
  }, [loadStorageInfo]);

  const user = session?.user ?? null;
  const currentClass = session?.currentClass ?? null;
  const roleLabel =
    user?.role === 'rep' ? labels.app.roleRep : labels.app.roleStudent;
  const activeThemeLabel =
    preference === 'system'
      ? `${labels.settings.systemModeButton} (${theme === 'dark' ? labels.settings.darkModeButton : labels.settings.lightModeButton})`
      : theme === 'dark'
        ? labels.settings.darkModeButton
        : labels.settings.lightModeButton;

  const handleToggleDataSaver = async (next: boolean): Promise<void> => {
    setDataSaver(next);
    await container.setDataSaverEnabled(next);
    toast.info(
      next
        ? 'Data saver enabled. PDFs download only when requested.'
        : 'Data saver disabled.',
    );
  };

  const handleSyncNow = async (): Promise<void> => {
    await syncNow();
    await loadStorageInfo();
    toast.success('Workspace sync check complete.');
  };

  const handleClearDownloads = async (): Promise<void> => {
    setIsClearingPdfs(true);
    try {
      await container.clearAllOfflineFiles();
      await loadStorageInfo();
      toast.info('Downloaded PDFs cleared from this device.');
    } finally {
      setIsClearingPdfs(false);
    }
  };

  const handleCopyCode = async (): Promise<void> => {
    if (!currentClass?.joinCode) {
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(currentClass.joinCode);
        setCopied(true);
        toast.success(`Copied join code ${currentClass.joinCode}`);
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

      {/* Unified Student & Class Identity Hero Card */}
      {user ? (
        <section className="settings-profile-hero" aria-label={labels.settings.profileCardTitle}>
          <div className="settings-profile-hero__top">
            <div className="settings-profile-hero__identity">
              <span className="user-avatar user-avatar--lg" aria-hidden="true">
                {getInitials(user.displayName)}
              </span>
              <div>
                <h2 style={{ margin: 0 }}>{user.displayName}</h2>
                <div className="settings-profile-hero__meta">
                  <span className="card-tab-code">{user.nim}</span>
                  <Chip
                    type={user.role === 'rep' ? 'info' : 'neutral'}
                    size="S"
                    label={roleLabel}
                  />
                </div>
              </div>
            </div>
          </div>

          {currentClass ? (
            <div className="settings-class-pill">
              <div className="settings-class-pill__info">
                <span className="settings-item__title">{currentClass.name}</span>
                <span className="settings-item__desc">
                  {labels.settings.joinCodeShareHint}
                </span>
              </div>
              <div className="settings-class-pill__code-group">
                <span className="card-tab-code">{currentClass.joinCode}</span>
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
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Group 1: Appearance */}
      <section className="settings-group" aria-labelledby="settings-appearance-label">
        <h2 id="settings-appearance-label" className="settings-group__label">
          {labels.settings.themeCardTitle}
        </h2>
        <div className="settings-group__card">
          <div className="settings-item settings-item--column">
            <div className="settings-row">
              <div className="settings-item__info">
                <p className="settings-item__title">Color theme</p>
                <p className="settings-item__desc">
                  {labels.settings.themeCardDescription}
                </p>
              </div>
              <span className="status-chip">
                {`${labels.settings.activeThemePrefix} ${activeThemeLabel}`}
              </span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <SegmentedControl<ThemePreference>
                options={['system', 'light', 'dark']}
                active={preference}
                onChange={(next) => void setTheme(next)}
                labelsMap={{
                  system: labels.settings.systemModeButton,
                  light: labels.settings.lightModeButton,
                  dark: labels.settings.darkModeButton,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Group 2: Data, Offline Storage & Sync */}
      <section className="settings-group" aria-labelledby="settings-storage-label">
        <h2 id="settings-storage-label" className="settings-group__label">
          {labels.settings.dataStorageCardTitle}
        </h2>
        <div className="settings-group__card">
          <div className="settings-item">
            <div className="settings-item__info">
              <p className="settings-item__title">{labels.settings.dataSaverLabel}</p>
              <p className="settings-item__desc">
                {dataSaver
                  ? labels.settings.dataSaverOnHint
                  : labels.settings.dataSaverOffHint}
              </p>
            </div>
            <Toggle
              checked={dataSaver}
              onChange={(next) => void handleToggleDataSaver(next)}
              ariaLabel={labels.settings.dataSaverLabel}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item__info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <p className="settings-item__title">Workspace sync</p>
                <Chip
                  type={pendingChanges > 0 ? 'warning' : 'success'}
                  size="S"
                  icon={<IconCloudCheck size={13} />}
                  label={
                    pendingChanges > 0
                      ? `${pendingChanges} queued`
                      : isLocalFallbackMode
                        ? 'Local IndexedDB'
                        : 'Synced'
                  }
                />
              </div>
              <p className="settings-item__desc tabular-nums">
                {`${labels.settings.lastUpdatedPrefix} ${lastSyncAt ? formatDateTime(lastSyncAt) : labels.settings.neverSynced}`}
                {pendingChanges > 0
                  ? ` (${pendingChanges} change${pendingChanges === 1 ? '' : 's'} waiting to sync)`
                  : ''}
              </p>
              {lastError ? (
                <div className="field-error" role="alert">
                  {lastError}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="figma-btn figma-btn--secondary figma-btn--size-m"
              disabled={isSyncing || networkState === 'offline'}
              onClick={() => void handleSyncNow()}
            >
              <IconRefresh size={16} className={isSyncing ? 'anim-spin' : undefined} />
              <span>
                {isSyncing
                  ? labels.settings.syncingCta
                  : labels.settings.syncNowCta}
              </span>
            </button>
          </div>

          <div className="settings-item">
            <div className="settings-item__info">
              <p className="settings-item__title">{labels.settings.offlineFilesLabel}</p>
              <p className="settings-item__desc tabular-nums">
                {`${storageStats.fileCount} file${storageStats.fileCount === 1 ? '' : 's'} cached in IndexedDB (${formatByteSize(storageStats.totalBytes)})`}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              disabled={isClearingPdfs || storageStats.fileCount === 0}
              onClick={() => void handleClearDownloads()}
            >
              <IconTrash size={14} />
              <span>
                {isClearingPdfs
                  ? labels.settings.clearingDownloadsCta
                  : labels.settings.clearDownloadsCta}
              </span>
            </button>
          </div>

          {canInstall || isInstalled ? (
            <div className="settings-item">
              <div className="settings-item__info">
                <p className="settings-item__title">{labels.settings.installAppTitle}</p>
                <p className="settings-item__desc">
                  {labels.settings.installAppDescription}
                </p>
              </div>
              {isInstalled ? (
                <Chip
                  type="success"
                  size="S"
                  icon={<IconCheckCircle size={14} />}
                  label={labels.settings.installedBadge}
                />
              ) : (
                <button
                  type="button"
                  className="figma-btn figma-btn--primary figma-btn--size-m"
                  onClick={() => void install()}
                >
                  <IconCloudDownload size={16} />
                  <span>{labels.settings.installAppCta}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* Group 3: Storage Environment & Session */}
      <section className="settings-group" aria-labelledby="settings-session-label">
        <h2 id="settings-session-label" className="settings-group__label">
          {labels.settings.sessionActionsTitle}
        </h2>
        <div className="settings-group__card">
          <div className="settings-item">
            <div className="settings-item__info">
              <p className="settings-item__title">{labels.settings.environmentCardTitle}</p>
              <p className="settings-item__desc">
                {isLocalFallbackMode
                  ? labels.app.localModeNotice
                  : labels.settings.onlineModeDescription}
              </p>
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-item__info">
              <p className="settings-item__title">Account session</p>
              <p className="settings-item__desc">
                Sign out while keeping cached PDFs, or clear all local device data.
              </p>
            </div>
            <div className="action-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleSignOut(false)}
                disabled={isSigningOut || isClearing}
              >
                <IconLogout size={15} />
                <span>
                  {isSigningOut ? labels.common.signingOut : labels.common.signOut}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={() => void handleSignOut(true)}
                disabled={isSigningOut || isClearing}
              >
                <IconTrash size={15} />
                <span>
                  {isClearing
                    ? labels.common.signingOutAndClearing
                    : labels.common.signOutAndClear}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
