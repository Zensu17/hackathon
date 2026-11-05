import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  IconAlertCircle,
  IconCalendarCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronRight,
  IconCloudCheck,
  IconCloudDownload,
  IconEye,
  IconEyeOff,
  IconNote,
  IconRefresh,
  IconSignalLow,
  IconWifi,
  IconWifiOff,
} from './Icons';
import './FigmaComponents.css';

/* 1. Button */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'M' | 'L';
  iconLeft?: React.ReactNode;
  label?: string;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'M',
  iconLeft,
  label,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps): React.ReactElement {
  const sizeClass = size === 'L' ? 'figma-btn--size-l' : 'figma-btn--size-m';
  const variantClass = `figma-btn--${variant}`;

  return (
    <button
      type="button"
      className={`figma-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner-icon" aria-hidden="true">
          <IconRefresh size={18} className="anim-spin" />
        </span>
      ) : (
        iconLeft
      )}
      <span>{label ?? children}</span>
    </button>
  );
}

/* 2. Chip */
export interface ChipProps {
  type?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'S' | 'M';
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

export function Chip({
  type = 'neutral',
  size = 'S',
  icon,
  label,
  className = '',
}: ChipProps): React.ReactElement {
  const sizeClass = size === 'M' ? 'figma-chip--size-m' : 'figma-chip--size-s';
  const typeClass = `figma-chip--${type}`;

  return (
    <span className={`figma-chip ${typeClass} ${sizeClass} ${className}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

/* 3. Network Status */
export interface NetworkStatusProps {
  state: 'online' | 'slow' | 'offline';
  className?: string;
}

export function NetworkStatus({
  state,
  className = '',
}: NetworkStatusProps): React.ReactElement {
  let icon: React.ReactNode = <IconWifi size={14} />;
  let labelText = 'Online';

  if (state === 'slow') {
    icon = <IconSignalLow size={14} />;
    labelText = 'Slow (Degraded)';
  } else if (state === 'offline') {
    icon = <IconWifiOff size={14} />;
    labelText = 'Offline (Local Cache)';
  }

  return (
    <div
      className={`figma-network-status figma-network-status--${state} ${className}`}
      role="status"
    >
      {icon}
      <span>{labelText}</span>
    </div>
  );
}

/* 4. Input */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  errorText?: string;
  showHelper?: boolean;
}

export function Input({
  label,
  helperText,
  errorText,
  showHelper = true,
  id,
  className = '',
  disabled,
  ...props
}: InputProps): React.ReactElement {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = Boolean(errorText);

  let controlClass = 'figma-field__control';
  if (hasError) controlClass += ' figma-field__control--error';
  if (disabled) controlClass += ' figma-field__control--disabled';

  return (
    <div className={`figma-field ${className}`}>
      <label htmlFor={inputId} className="figma-field__label">
        {label}
      </label>
      <div className={controlClass}>
        <input
          id={inputId}
          className="figma-field__input"
          disabled={disabled}
          aria-invalid={hasError ? 'true' : 'false'}
          {...props}
        />
      </div>
      {hasError ? (
        <p className="figma-field__error" role="alert">
          {errorText}
        </p>
      ) : showHelper && helperText ? (
        <p className="figma-field__helper">{helperText}</p>
      ) : null}
    </div>
  );
}

/* 5. Password Input */
export function PasswordInput({
  label,
  helperText,
  errorText,
  showHelper = true,
  id,
  className = '',
  disabled,
  ...props
}: InputProps): React.ReactElement {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id ?? `field-pass-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = Boolean(errorText);

  let controlClass = 'figma-field__control';
  if (hasError) controlClass += ' figma-field__control--error';
  if (disabled) controlClass += ' figma-field__control--disabled';

  return (
    <div className={`figma-field ${className}`}>
      <label htmlFor={inputId} className="figma-field__label">
        {label}
      </label>
      <div className={controlClass}>
        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          className="figma-field__input"
          disabled={disabled}
          aria-invalid={hasError ? 'true' : 'false'}
          {...props}
        />
        <button
          type="button"
          className="figma-field__action"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
      {hasError ? (
        <p className="figma-field__error" role="alert">
          {errorText}
        </p>
      ) : showHelper && helperText ? (
        <p className="figma-field__helper">{helperText}</p>
      ) : null}
    </div>
  );
}

/* 6. Card */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({
  interactive = false,
  className = '',
  children,
  ...props
}: CardProps): React.ReactElement {
  return (
    <div
      className={`figma-card ${interactive ? 'figma-card--interactive' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* 7. Toggle */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel = 'Toggle setting',
}: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`figma-toggle ${checked ? 'figma-toggle--on' : 'figma-toggle--off'}`}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
    >
      <span className="figma-toggle__track">
        <span className="figma-toggle__thumb" />
      </span>
    </button>
  );
}

/* 8. Segmented Control */
export interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  active: T;
  onChange: (value: T) => void;
  labelsMap?: Record<T, string>;
}

export function SegmentedControl<T extends string>({
  options,
  active,
  onChange,
  labelsMap,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div className="figma-segmented" role="tablist">
      {options.map((opt) => {
        const isActive = opt === active;
        const displayLabel = labelsMap ? labelsMap[opt] ?? opt : opt;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`figma-segmented__btn ${isActive ? 'figma-segmented__btn--active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}

/* 9. Course Card */
export interface CourseCardProps {
  name: string;
  code: string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
  followed: boolean;
  offlineReady?: boolean;
  courseId: string;
  onToggleFollow?: () => void;
}

export function CourseCard({
  name,
  code,
  accent = 1,
  followed,
  offlineReady = false,
  courseId,
  onToggleFollow,
}: CourseCardProps): React.ReactElement {
  return (
    <div className="figma-course-card">
      <div
        className="figma-course-card__accent-bar"
        style={{ backgroundColor: `var(--course-${accent})` }}
      />
      <div className="figma-course-card__header">
        <span className="figma-course-card__code">[{code}]</span>
        {offlineReady ? (
          <Chip
            type="success"
            size="S"
            icon={<IconCloudCheck size={14} />}
            label="Available offline"
          />
        ) : null}
      </div>

      <h3 className="figma-course-card__title">
        <Link to={`/courses/${courseId}`} className="card-title-link">
          {name}
        </Link>
      </h3>

      <div className="figma-course-card__actions">
        <Link
          to={`/courses/${courseId}`}
          className="figma-btn figma-btn--secondary figma-btn--size-m"
        >
          View syllabus
        </Link>
        {onToggleFollow ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 600 }}>
              {followed ? 'Following' : 'Follow'}
            </span>
            <Toggle
              checked={followed}
              onChange={() => onToggleFollow()}
              ariaLabel={`Follow course ${name}`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* 10. Deadline Item */
export interface DeadlineItemProps {
  title: string;
  course: string;
  dueText: string;
  urgency: 'overdue' | 'due soon' | 'normal';
  courseId?: string;
}

export function DeadlineItem({
  title,
  course,
  dueText,
  urgency,
  courseId,
}: DeadlineItemProps): React.ReactElement {
  const urgencyClass = `figma-deadline-item--${urgency.replace(/\s+/g, '-')}`;

  let iconNode = <IconCalendarCheck size={18} className="figma-deadline-item__icon" />;
  if (urgency === 'overdue') {
    iconNode = <IconAlertCircle size={18} className="figma-deadline-item__icon" style={{ color: 'var(--color-danger)' }} />;
  }

  return (
    <div className={`figma-deadline-item ${urgencyClass}`}>
      {iconNode}
      <div className="figma-deadline-item__content">
        <h4 className="figma-deadline-item__title">
          {courseId ? (
            <Link to={`/courses/${courseId}`} className="card-title-link">
              {title}
            </Link>
          ) : (
            title
          )}
        </h4>
        <p className="figma-deadline-item__meta">{course}</p>
        <span className="figma-deadline-item__due">
          {urgency === 'overdue' ? 'Overdue. ' : ''}
          {dueText}
        </span>
      </div>
    </div>
  );
}

/* 11. Material Row */
export interface MaterialRowProps {
  title: string;
  size?: string;
  state: 'text only' | 'file not downloaded' | 'file downloaded' | 'downloading';
  materialId: string;
  onDownloadClick?: (e: React.MouseEvent) => void;
}

export function MaterialRow({
  title,
  size,
  state,
  materialId,
  onDownloadClick,
}: MaterialRowProps): React.ReactElement {
  let statusIcon = <IconNote size={16} />;
  let stateTag: React.ReactNode = null;

  if (state === 'file not downloaded') {
    statusIcon = <IconCloudDownload size={16} />;
    stateTag = (
      <Chip
        type="neutral"
        size="S"
        icon={<IconCloudDownload size={12} />}
        label="Download"
      />
    );
  } else if (state === 'downloading') {
    statusIcon = <IconRefresh size={16} className="anim-spin" />;
    stateTag = <Chip type="warning" size="S" label="Downloading..." />;
  } else if (state === 'file downloaded') {
    statusIcon = <IconCloudCheck size={16} />;
    stateTag = (
      <Chip
        type="success"
        size="S"
        icon={<IconCheckCircle size={12} />}
        label="Saved on device"
      />
    );
  }

  return (
    <Link to={`/materials/${materialId}`} className="figma-material-row">
      <div className="figma-material-row__left">
        {statusIcon}
        <span className="figma-material-row__title">{title}</span>
        {size ? <span className="figma-material-row__size">{size}</span> : null}
      </div>
      {stateTag ? (
        <div
          onClick={(e) => {
            if (onDownloadClick && state === 'file not downloaded') {
              e.preventDefault();
              onDownloadClick(e);
            }
          }}
        >
          {stateTag}
        </div>
      ) : (
        <IconChevronRight size={16} color="var(--color-text-muted)" />
      )}
    </Link>
  );
}

/* 12. Week Section */
export interface WeekSectionProps {
  title: string;
  thisWeek?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function WeekSection({
  title,
  thisWeek = false,
  defaultExpanded = false,
  children,
}: WeekSectionProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="figma-week-section">
      <button
        type="button"
        className="figma-week-section__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="figma-week-section__title-group">
          <h3 className="figma-week-section__title">{title}</h3>
          {thisWeek ? (
            <Chip type="info" size="S" label="Current week" />
          ) : null}
        </div>
        {expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
      </button>
      {expanded ? (
        <div className="figma-week-section__body">{children}</div>
      ) : null}
    </div>
  );
}

/* 13. Toast */
export interface ToastProps {
  type?: 'info' | 'success' | 'error';
  message: string;
  className?: string;
}

export function Toast({
  type = 'info',
  message,
  className = '',
}: ToastProps): React.ReactElement {
  let iconNode = <IconCheckCircle size={18} style={{ color: 'var(--color-success)' }} />;
  if (type === 'error') {
    iconNode = <IconAlertCircle size={18} style={{ color: 'var(--color-danger)' }} />;
  }

  return (
    <div className={`figma-toast figma-toast--${type} ${className}`} role="status">
      {iconNode}
      <span>{message}</span>
    </div>
  );
}

/* 14. Skeleton */
export interface SkeletonProps {
  shape?: 'line' | 'card' | 'row';
  className?: string;
}

export function Skeleton({
  shape = 'line',
  className = '',
}: SkeletonProps): React.ReactElement {
  return (
    <div
      className={`figma-skeleton figma-skeleton--${shape} ${className}`}
      aria-hidden="true"
    />
  );
}
