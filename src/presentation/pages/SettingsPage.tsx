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
  IconCloudDownload,
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

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">THEME</span>
          <span className="status-chip">
            {`${labels.settings.activeThemePrefix} ${activeThemeLabel}`}
          </span>
        </div>
        <h2>{labels.settings.themeCardTitle}</h2>
        <p className="meta-text" style={{ marginBottom: 'var(--space-3)' }}>
          {labels.settings.themeCardDescription}
        </p>
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
      </section>

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">DATA &amp; SYNC</span>
          <Chip
            type={pendingChanges > 0 ? 'warning' : 'success'}
            size="S"
            label={
              pendingChanges > 0
                ? `${pendingChanges} queued`
                : isLocalFallbackMode
                  ? 'Local device store'
                  : 'Synced'
            }
          />
        </div>
        <h2>{labels.settings.dataStorageCardTitle}</h2>

        <div className="settings-row" style={{ marginBottom: 'var(--space-3)' }}>
          <div>
            <strong>{labels.settings.dataSaverLabel}</strong>
            <p className="meta-text" style={{ marginTop: '2px' }}>
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

        <div className="action-row" style={{ marginTop: 0 }}>
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

        <p
          className="meta-text tabular-nums"
          style={{ marginTop: 'var(--space-2)' }}
        >
          {`${labels.settings.lastUpdatedPrefix} ${lastSyncAt ? formatDateTime(lastSyncAt) : labels.settings.neverSynced}`}
          {pendingChanges > 0
            ? ` | ${pendingChanges} change${pendingChanges === 1 ? '' : 's'} waiting to sync.`
            : ''}
        </p>

        {lastError ? (
          <div className="field-error" role="alert">
            {lastError}
          </div>
        ) : null}

        <div
          className="settings-row"
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div>
            <p className="meta-text tabular-nums" style={{ margin: 0 }}>
              <strong>{labels.settings.offlineFilesLabel}</strong>{' '}
              {`${storageStats.fileCount} file${storageStats.fileCount === 1 ? '' : 's'} (${formatByteSize(storageStats.totalBytes)})`}
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
          <div
            className="settings-row"
            style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div>
              <strong>{labels.settings.installAppTitle}</strong>
              <p className="meta-text" style={{ marginTop: '2px' }}>
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
      </section>

      {user ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">ACCOUNT</span>
          </div>
          <div className="settings-profile-banner">
            <span className="user-avatar user-avatar--lg" aria-hidden="true">
              {getInitials(user.displayName)}
            </span>
            <div>
              <h2 style={{ margin: 0 }}>{user.displayName}</h2>
              <p className="meta-text">{`${roleLabel} / ${user.nim}`}</p>
            </div>
          </div>
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
            <span className="card-tab-code">CLASS</span>
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
          <span className="card-tab-code">SESSION</span>
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
