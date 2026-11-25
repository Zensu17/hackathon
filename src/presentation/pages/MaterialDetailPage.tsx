import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import { canManageClassContent, formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { Chip } from '../components/FigmaComponents';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconChevronRight,
  IconCloudCheck,
  IconCloudDownload,
  IconLink,
  IconNote,
  IconPrinter,
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
import { openOfflinePdfBlob } from '../utils/openOfflinePdf';

export function MaterialDetailPage(): React.ReactElement {
  const { materialId } = useParams<{ materialId: string }>();
  const container = useAppContainer();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const isRep = canManageClassContent(session?.user.role);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const {
    detail,
    prevMaterial,
    nextMaterial,
    isLoading,
    isNotFound,
    error,
    reload,
  } = useMaterialDetail(materialId);
  const privateNote = useMaterialNote(userId, materialId);

  useEffect(() => {
    const titlePrefix =
      detail?.material.title ?? labels.materialDetail.summaryHeading;
    document.title = `${titlePrefix} | ${labels.app.name}`;
  }, [detail?.material.title]);

  const wordCount = useMemo(() => {
    const trimmed = privateNote.draft.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [privateNote.draft]);

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

      openOfflinePdfBlob(stored.bytes, stored.fileName);
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
    event?: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event?.preventDefault();
    const ok = await privateNote.save();
    if (ok) {
      toast.success('Private note saved on this device.');
    }
  };

  const appendNoteSnippet = (snippet: string): void => {
    const current = privateNote.draft;
    const prefix =
      current.length > 0 && !current.endsWith('\n') ? `${current}\n` : current;
    privateNote.setDraft(`${prefix}${snippet}`);
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
      <div className="breadcrumb-row" style={{ justifyContent: 'space-between' }}>
        <Link to={`/courses/${course.id}`} className="breadcrumb-link">
          <IconArrowLeft size={15} />
          <span>{`${labels.materialDetail.backToCoursePrefix} ${course.code}`}</span>
        </Link>
        <div className="action-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => window.print()}
          >
            <IconPrinter size={15} />
            <span>Print study sheet</span>
          </button>
          {isRep ? (
            <Link
              to={`/manage?type=material&courseId=${course.id}&editId=${material.id}`}
              className="btn btn-secondary btn-compact"
            >
              {labels.materialDetail.editMaterialCta}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Editorial 2-Column Study Reader */}
      <div className="study-reader-grid">
        {/* Left Column: Clean Reading Canvas + Sequential Prev/Next Navigation */}
        <div className="card-stack">
          <article className="study-reader-article">
            <header className="study-reader-article__header">
              <div className="breadcrumb-row">
                <span className="card-tab-code">
                  {formatWeekCode(
                    labels.courseDetail.weekTabPrefix,
                    week.weekNumber,
                  )}
                </span>
                <span className="status-chip mono-code">{course.code}</span>
                {attachment ? (
                  <Chip
                    type={material.isAvailableOffline ? 'success' : 'neutral'}
                    size="S"
                    icon={
                      material.isAvailableOffline ? (
                        <IconCloudCheck size={13} />
                      ) : (
                        <IconCloudDownload size={13} />
                      )
                    }
                    label={
                      material.isAvailableOffline
                        ? `PDF offline (${formatByteSize(attachment.sizeBytes)})`
                        : `PDF ${formatByteSize(attachment.sizeBytes)}`
                    }
                  />
                ) : null}
              </div>

              <h1>{material.title}</h1>
              <p className="study-reader-article__course">
                {`${course.name} / ${week.title}`}
              </p>
            </header>

            <div className="study-reader-article__content">
              <h2 className="study-reader-article__subhead">
                {labels.materialDetail.summaryHeading}
              </h2>
              <p className="material-body">
                {material.description.trim().length > 0
                  ? material.description
                  : labels.materialDetail.noDescription}
              </p>
            </div>

            {safeExternalUrl ? (
              <div className="study-reader-link-box">
                <div className="study-reader-link-box__info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconLink size={16} style={{ color: 'var(--color-primary)' }} />
                    <strong>{labels.materialDetail.externalResourceHeading}</strong>
                  </div>
                  <span className="mono-code" style={{ fontSize: '12px' }}>
                    {safeExternalUrl}
                  </span>
                  <span className="meta-text" style={{ fontSize: '12px' }}>
                    {labels.materialDetail.externalDataNotice}
                  </span>
                </div>
                <a
                  href={safeExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-compact"
                >
                  {labels.materialDetail.openExternalLinkCta}
                </a>
              </div>
            ) : null}
          </article>

          {/* Sequential Prev / Next Material Study Bar */}
          {prevMaterial || nextMaterial ? (
            <nav
              className="study-reader-seq-nav"
              aria-label="Adjacent course materials"
            >
              {prevMaterial ? (
                <Link
                  to={`/materials/${prevMaterial.id}`}
                  className="study-seq-card"
                >
                  <span className="study-seq-card__dir">
                    <IconArrowLeft size={14} />
                    <span>{`Previous (Week ${prevMaterial.weekNumber})`}</span>
                  </span>
                  <strong className="study-seq-card__title">
                    {prevMaterial.title}
                  </strong>
                </Link>
              ) : (
                <div />
              )}

              {nextMaterial ? (
                <Link
                  to={`/materials/${nextMaterial.id}`}
                  className="study-seq-card study-seq-card--next"
                >
                  <span className="study-seq-card__dir">
                    <span>{`Next (Week ${nextMaterial.weekNumber})`}</span>
                    <IconChevronRight size={14} />
                  </span>
                  <strong className="study-seq-card__title">
                    {nextMaterial.title}
                  </strong>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>

        {/* Right Column: Sticky Study Dock (PDF Pack + Auto-Saving Private Notebook) */}
        <aside className="study-reader-dock" aria-label="Study tools and notes">
          {attachment ? (
            <section className="study-dock-card">
              <div className="study-dock-card__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconCloudDownload size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 style={{ margin: 0, fontSize: '17px' }}>
                    {labels.materialDetail.attachmentHeading}
                  </h2>
                </div>
                {material.isAvailableOffline ? (
                  <Chip
                    type="success"
                    size="S"
                    icon={<IconCloudCheck size={13} />}
                    label={labels.materialDetail.savedOfflineBadge}
                  />
                ) : (
                  <Chip type="neutral" size="S" label="Not cached" />
                )}
              </div>

              <div className="study-pdf-meta-chip">
                <span className="mono-code" style={{ fontWeight: 600 }}>
                  {attachment.name}
                </span>
                <span className="status-chip tabular-nums">
                  {`${formatByteSize(attachment.sizeBytes)} (${attachment.sizeBytes.toLocaleString('en-US')} ${labels.materialDetail.bytesSuffix})`}
                </span>
              </div>

              {pdfError ? (
                <div className="field-error" role="alert">
                  {pdfError}
                </div>
              ) : null}

              <div className="action-row" style={{ marginTop: 0 }}>
                {material.isAvailableOffline ? (
                  <>
                    <button
                      type="button"
                      className="figma-btn figma-btn--primary figma-btn--size-m pdf-action-btn"
                      onClick={() => void handleOpenOfflinePdf()}
                    >
                      <IconCloudCheck size={16} />
                      <span>{labels.materialDetail.openOfflinePdfCta}</span>
                    </button>
                    <button
                      type="button"
                      className="figma-btn figma-btn--secondary figma-btn--size-m pdf-action-btn"
                      disabled={isRemoving}
                      onClick={() => void handleRemoveOfflinePdf()}
                    >
                      <IconTrash size={15} />
                      <span>{labels.materialDetail.removeOfflinePdfCta}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="figma-btn figma-btn--primary figma-btn--size-m"
                    style={{ width: '100%' }}
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
                    style={{ width: '100%' }}
                  >
                    {labels.materialDetail.openOnlinePdfPrefix}
                  </a>
                ) : null}
              </div>

              <p className="meta-text" style={{ fontSize: '12px', margin: 0 }}>
                {material.isAvailableOffline
                  ? labels.materialDetail.savedOfflineNotice
                  : labels.materialDetail.notDownloadedNotice}
              </p>
            </section>
          ) : null}

          {/* Auto-Saving Private Study Notebook */}
          <section
            className="study-dock-card notes-card"
            aria-labelledby="private-notes-heading"
          >
            <div className="study-dock-card__head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconNote size={18} style={{ color: 'var(--color-accent)' }} />
                <h2 id="private-notes-heading" style={{ margin: 0, fontSize: '17px' }}>
                  {labels.materialDetail.privateNotesHeading}
                </h2>
              </div>
              {privateNote.isSaving ? (
                <Chip
                  type="info"
                  size="S"
                  icon={<IconRefresh size={12} className="anim-spin" />}
                  label="Auto-saving..."
                />
              ) : privateNote.isDirty ? (
                <Chip type="warning" size="S" label="Typing..." />
              ) : privateNote.saveStatus === 'saved' || privateNote.note ? (
                <Chip
                  type="success"
                  size="S"
                  icon={<IconCheckCircle size={13} />}
                  label={labels.materialDetail.noteSavedStatus}
                />
              ) : null}
            </div>

            <p className="meta-text" style={{ fontSize: '12px', margin: 0 }}>
              Auto-saves to IndexedDB as you type.
              <span className="desktop-only-hint"> Press Ctrl+S to save anytime.</span>
            </p>

            {/* Quick Study Prompt Chips */}
            <div className="notebook-quick-chips" role="group" aria-label="Quick note snippets">
              <button
                type="button"
                className="notebook-chip-btn"
                onClick={() => appendNoteSnippet('* Key concept: ')}
              >
                + Key concept
              </button>
              <button
                type="button"
                className="notebook-chip-btn"
                onClick={() => appendNoteSnippet('? Question for lecturer: ')}
              >
                + Question
              </button>
              <button
                type="button"
                className="notebook-chip-btn"
                onClick={() => appendNoteSnippet('[TODO] Review for exam: ')}
              >
                + Exam review
              </button>
            </div>

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
                    rows={7}
                    placeholder={labels.materialDetail.privateNotesPlaceholder}
                    value={privateNote.draft}
                    onChange={(event) => privateNote.setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.ctrlKey || event.metaKey) &&
                        event.key.toLowerCase() === 's'
                      ) {
                        event.preventDefault();
                        if (!privateNote.isSaving && privateNote.isDirty) {
                          void handleSaveNote();
                        }
                      }
                    }}
                  />
                </div>

                {privateNote.error ? (
                  <div className="field-error" role="alert">
                    {privateNote.error}
                  </div>
                ) : null}

                <div className="notebook-footer">
                  <span className="meta-text tabular-nums" style={{ fontSize: '12px' }}>
                    {`${wordCount} word${wordCount === 1 ? '' : 's'} / ${privateNote.draft.length} chars`}
                    {privateNote.note
                      ? ` / ${formatDateTime(privateNote.note.updatedAt)}`
                      : ''}
                  </span>
                  <button
                    type="submit"
                    className="btn btn-secondary btn-compact"
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
        </aside>
      </div>
    </div>
  );
}

export default MaterialDetailPage;
