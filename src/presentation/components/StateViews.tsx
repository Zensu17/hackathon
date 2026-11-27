import React from 'react';
import { Link } from 'react-router';
import { IconRefresh } from './Icons';
import { labels } from '../i18n/labels';

export interface LoadingStateProps {
  message: string;
}

export function LoadingState({ message }: LoadingStateProps): React.ReactElement {
  return (
    <div className="index-card state-card" role="status" aria-live="polite">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <IconRefresh
          size={16}
          className="anim-spin"
          style={{ color: 'var(--color-primary)', flexShrink: 0 }}
        />
        <p className="state-card__body" style={{ margin: 0 }}>
          {message}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '14px',
        }}
        aria-hidden="true"
      >
        <div
          className="figma-skeleton figma-skeleton--line"
          style={{ width: '82%', height: '12px' }}
        />
        <div
          className="figma-skeleton figma-skeleton--line"
          style={{ width: '54%', height: '12px' }}
        />
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  headingLevel?: 'h2' | 'h3';
}

export function EmptyState({
  title,
  body,
  actionLabel,
  actionTo,
  onAction,
  actionDisabled = false,
  headingLevel = 'h2',
}: EmptyStateProps): React.ReactElement {
  const HeadingTag = headingLevel;

  return (
    <section className="index-card state-card">
      <HeadingTag className="state-card__title">{title}</HeadingTag>
      <p className="state-card__body">{body}</p>
      {actionLabel && actionTo ? (
        <div className="state-card__actions">
          <Link to={actionTo} className="btn btn-primary">
            {actionLabel}
          </Link>
        </div>
      ) : null}
      {actionLabel && !actionTo && onAction ? (
        <div className="state-card__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export interface ErrorStateProps {
  title: string;
  detail?: string;
  onRetry?: () => void;
  headingLevel?: 'h2' | 'h3';
}

export function ErrorState({
  title,
  detail,
  onRetry,
  headingLevel = 'h2',
}: ErrorStateProps): React.ReactElement {
  const HeadingTag = headingLevel;

  return (
    <div className="index-card index-card--urgent state-card" role="alert">
      <HeadingTag className="state-card__title">{title}</HeadingTag>
      {detail && detail !== title ? (
        <p className="state-card__body">{detail}</p>
      ) : null}
      {onRetry ? (
        <div className="state-card__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRetry}
          >
            {labels.common.tryAgain}
          </button>
        </div>
      ) : null}
    </div>
  );
}
