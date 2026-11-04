import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useMaterialDetail } from '../hooks/useMaterialDetail';
import { labels } from '../i18n/labels';
import { formatWeekCode, isSafeHttpUrl } from '../utils/formatters';

export function MaterialDetailPage(): React.ReactElement {
  const { materialId } = useParams<{ materialId: string }>();
  const { session } = useAuthSession();
  const isRep = session?.user.role === 'rep';

  const { detail, isLoading, isNotFound, error, reload } =
    useMaterialDetail(materialId);

  useEffect(() => {
    const titlePrefix =
      detail?.material.title ?? labels.materialDetail.summaryHeading;
    document.title = `${titlePrefix} | ${labels.app.name}`;
  }, [detail?.material.title]);

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
          {`${labels.materialDetail.backToCoursePrefix} ${course.code}`}
        </Link>
      </div>

      <section className="index-card">
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
          <span className="card-tab-code">[SUMMARY]</span>
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
            <span className="card-tab-code">[REFERENCE URL]</span>
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
              {`[${labels.courseDetail.pdfBadgePrefix} ${formatByteSize(attachment.sizeBytes)}]`}
            </span>
          </div>
          <h2>{labels.materialDetail.attachmentHeading}</h2>
          <dl className="meta-dl">
            <div className="meta-dl__item">
              <dt>{labels.materialDetail.fileNameLabel}</dt>
              <dd className="mono-code">{attachment.name}</dd>
            </div>
            <div className="meta-dl__item">
              <dt>{labels.materialDetail.fileSizeLabel}</dt>
              <dd className="mono-code">
                {`${formatByteSize(attachment.sizeBytes)} (${attachment.sizeBytes.toLocaleString('en-US')} ${labels.materialDetail.bytesSuffix})`}
              </dd>
            </div>
          </dl>

          {safeRemotePdfUrl ? (
            <div className="action-row">
              <a
                href={safeRemotePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                {`${labels.materialDetail.openOnlinePdfPrefix} (${formatByteSize(attachment.sizeBytes)})`}
              </a>
            </div>
          ) : null}

          <p
            className="notice-banner"
            style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}
          >
            {labels.materialDetail.phaseOneOfflineNote}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default MaterialDetailPage;
