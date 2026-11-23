import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import { formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { Chip } from '../components/FigmaComponents';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconCloudCheck,
  IconCloudDownload,
  IconNote,
  IconRefresh,
  IconTrash,
} from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useMaterialDetail } from '../hooks/useMaterialDetail';
import { useMaterialNote } from '../hooks/useMaterialNote';
import { labels } from '../i18n/labels';
import {
  formatDateTime,
  formatWeekCode,
  isSafeHttpUrl,
} from '../utils/formatters';

export function MaterialDetailPage(): React.ReactElement {
  const { materialId } = useParams<{ materialId: string }>();
  const container = useAppContainer();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';

  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { detail, isLoading, isNotFound, error, reload } =
    useMaterialDetail(materialId);
  const privateNote = useMaterialNote(userId, materialId);

  useEffect(() => {
    const titlePrefix =
      detail?.material.title ?? labels.materialDetail.summaryHeading;
    document.title = `${titlePrefix} | ${labels.app.name}`;
  }, [detail?.material.title]);

  const handleDownload = async (): Promise<void> => {
    if (!materialId) {
      return;
    }
    setPdfError(null);
    setIsDownloading(true);
    try {
      await container.usecases.downloadMaterialFile.execute({ materialId });
      await reload();
      toast.success('PDF saved in IndexedDB. Ready offline.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not download this PDF right now.';
      setPdfError(message);
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenOfflinePdf = async (): Promise<void> => {
    if (!materialId) {
      return;
    }
    setPdfError(null);
    try {
      const stored = await container.usecases.getOfflineMaterialFile.execute({
        materialId,
      });
      if (!stored) {
        setPdfError(
          'Offline PDF file was not found in device storage. Download it again while online.',
        );
        await reload();
        return;
      }

      const bytesCopy = new Uint8Array(stored.bytes.byteLength);
      bytesCopy.set(stored.bytes);
      const pdfBlob = new Blob([bytesCopy], {
        type: stored.mimeType || 'application/pdf',
      });
      const blobUrl = URL.createObjectURL(pdfBlob);
      const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = stored.fileName;
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : 'Could not open offline PDF from device storage.',
      );
    }
  };

  const handleRemoveOfflinePdf = async (): Promise<void> => {
    if (!materialId) {
      return;
    }
    setPdfError(null);
    setIsRemoving(true);
    try {
      await container.usecases.removeOfflineMaterialFile.execute({ materialId });
      await reload();
      toast.info('Offline PDF removed from this device.');
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : 'Could not remove offline PDF right now.',
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSaveNote = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    const ok = await privateNote.save();
    if (ok) {
      toast.success('Private note saved on this device.');
    }
  };

  if (isLoading) {
    return (
      <div className="page-stack">
        <h1>{labels.materialDetail.summaryHeading}</h1>
        <LoadingState message={labels.materialDetail.loading} />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="page-stack">
        <h1>{labels.materialDetail.notFoundTitle}</h1>
        <EmptyState
          title={labels.materialDetail.notFoundTitle}
          body={labels.materialDetail.notFoundBody}
          actionLabel={labels.courseDetail.backToCourses}
          actionTo="/courses"
        />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-stack">
        <h1>{labels.materialDetail.errorTitle}</h1>
        <ErrorState
          title={labels.materialDetail.errorTitle}
          detail={error ?? undefined}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const { material, course, week } = detail;
  const safeExternalUrl = isSafeHttpUrl(material.externalUrl)
    ? material.externalUrl
    : null;
  const attachment = material.attachment;
  const safeRemotePdfUrl =
    attachment && isSafeHttpUrl(attachment.remoteUrl)
      ? attachment.remoteUrl
      : null;

  return (
    <div className="page-stack">
      <div className="breadcrumb-row">
        <Link to={`/courses/${course.id}`} className="breadcrumb-link">
          <IconArrowLeft size={15} />
          <span>{`${labels.materialDetail.backToCoursePrefix} ${course.code}`}</span>
        </Link>
      </div>

      <section className="index-card course-hero">
        <div className="card-tab-bar">
          <div className="breadcrumb-row">
            <span className="card-tab-code">
              {formatWeekCode(
                labels.courseDetail.weekTabPrefix,
                week.weekNumber,
              )}
            </span>
            <span className="status-chip mono-code">{course.code}</span>
          </div>
          {isRep ? (
            <Link
              to={`/manage?type=material&courseId=${course.id}&editId=${material.id}`}
              className="btn btn-secondary btn-compact"
            >
              {labels.materialDetail.editMaterialCta}
            </Link>
          ) : null}
        </div>

        <h1>{material.title}</h1>
        <p className="meta-text">{`${course.name} (${week.title})`}</p>
      </section>

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">SUMMARY</span>
        </div>
        <h2>{labels.materialDetail.summaryHeading}</h2>
        <p className="material-body">
          {material.description.trim().length > 0
            ? material.description
            : labels.materialDetail.noDescription}
        </p>
      </section>

      {safeExternalUrl ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">REFERENCE URL</span>
          </div>
          <h2>{labels.materialDetail.externalResourceHeading}</h2>
          <p className="mono-code">{safeExternalUrl}</p>
          <p className="meta-text">{labels.materialDetail.externalDataNotice}</p>
          <div className="action-row">
            <a
              href={safeExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              {labels.materialDetail.openExternalLinkCta}
            </a>
          </div>
        </section>
      ) : null}

      {attachment ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">
              {`${labels.courseDetail.pdfBadgePrefix} ${formatByteSize(attachment.sizeBytes)}`}
            </span>
            {material.isAvailableOffline ? (
              <Chip
                type="success"
                size="S"
                icon={<IconCloudCheck size={14} />}
                label={labels.materialDetail.savedOfflineBadge}
              />
            ) : (
              <Chip
                type="neutral"
                size="S"
                icon={<IconCloudDownload size={14} />}
                label="Not downloaded"
              />
            )}
          </div>
          <h2>{labels.materialDetail.attachmentHeading}</h2>
          <dl className="meta-dl">
            <div className="meta-dl__item">
              <dt>{labels.materialDetail.fileNameLabel}</dt>
              <dd className="mono-code">{attachment.name}</dd>
            </div>
            <div className="meta-dl__item">
              <dt>{labels.materialDetail.fileSizeLabel}</dt>
              <dd className="mono-code tabular-nums">
                {`${formatByteSize(attachment.sizeBytes)} (${attachment.sizeBytes.toLocaleString('en-US')} ${labels.materialDetail.bytesSuffix})`}
              </dd>
            </div>
          </dl>

          {pdfError ? (
            <div className="field-error" role="alert">
              {pdfError}
            </div>
          ) : null}

          <div className="action-row" style={{ marginTop: 'var(--space-3)' }}>
            {material.isAvailableOffline ? (
              <>
                <button
                  type="button"
                  className="figma-btn figma-btn--primary figma-btn--size-m"
                  onClick={() => void handleOpenOfflinePdf()}
                >
                  <IconCloudCheck size={16} />
                  <span>{labels.materialDetail.openOfflinePdfCta}</span>
                </button>
                <button
                  type="button"
                  className="figma-btn figma-btn--secondary figma-btn--size-m"
                  disabled={isRemoving}
                  onClick={() => void handleRemoveOfflinePdf()}
                >
                  <IconTrash size={16} />
                  <span>{labels.materialDetail.removeOfflinePdfCta}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="figma-btn figma-btn--primary figma-btn--size-m"
                disabled={isDownloading}
                onClick={() => void handleDownload()}
              >
                {isDownloading ? (
                  <>
                    <IconRefresh size={16} className="anim-spin" />
                    <span>{labels.materialDetail.downloadingPdf}</span>
                  </>
                ) : (
                  <>
                    <IconCloudDownload size={16} />
                    <span>
                      {`${labels.materialDetail.downloadPdfPrefix} (${formatByteSize(attachment.sizeBytes)})`}
                    </span>
                  </>
                )}
              </button>
            )}

            {safeRemotePdfUrl ? (
              <a
                href={safeRemotePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="figma-btn figma-btn--secondary figma-btn--size-m"
              >
                {labels.materialDetail.openOnlinePdfPrefix}
              </a>
            ) : null}
          </div>

          <p
            className="meta-text"
            style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}
          >
            {material.isAvailableOffline
              ? labels.materialDetail.savedOfflineNotice
              : labels.materialDetail.notDownloadedNotice}
          </p>
        </section>
      ) : null}

      {/* Private study notes stored locally in IndexedDB and queued for sync */}
      <section className="index-card notes-card" aria-labelledby="private-notes-heading">
        <div className="card-tab-bar">
          <span className="card-tab-code">PRIVATE NOTES</span>
          {privateNote.saveStatus === 'saved' && !privateNote.isDirty ? (
            <Chip
              type="success"
              size="S"
              icon={<IconCheckCircle size={14} />}
              label={labels.materialDetail.noteSavedStatus}
            />
          ) : privateNote.note ? (
            <Chip
              type="neutral"
              size="S"
              icon={<IconNote size={14} />}
              label={`Updated ${formatDateTime(privateNote.note.updatedAt)}`}
            />
          ) : null}
        </div>

        <h2 id="private-notes-heading">
          {labels.materialDetail.privateNotesHeading}
        </h2>
        <p className="meta-text" style={{ marginBottom: 'var(--space-3)' }}>
          {labels.materialDetail.privateNotesHint}
        </p>

        {privateNote.isLoading ? (
          <p className="meta-text">Loading private note from local storage...</p>
        ) : (
          <form className="form-stack" onSubmit={(e) => void handleSaveNote(e)}>
            <div className="field-group">
              <label htmlFor="private-note-textarea" className="sr-only">
                {labels.materialDetail.privateNotesHeading}
              </label>
              <textarea
                id="private-note-textarea"
                className="field-input"
                rows={5}
                placeholder={labels.materialDetail.privateNotesPlaceholder}
                value={privateNote.draft}
                onChange={(event) => privateNote.setDraft(event.target.value)}
                disabled={privateNote.isSaving}
              />
            </div>

            {privateNote.error ? (
              <div className="field-error" role="alert">
                {privateNote.error}
              </div>
            ) : null}

            <div className="action-row" style={{ marginTop: 0 }}>
              <button
                type="submit"
                className="figma-btn figma-btn--primary figma-btn--size-m"
                disabled={privateNote.isSaving || !privateNote.isDirty}
              >
                {privateNote.isSaving
                  ? labels.materialDetail.savingNoteCta
                  : labels.materialDetail.saveNoteCta}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default MaterialDetailPage;
