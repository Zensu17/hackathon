import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { CourseListItemDto, WeekWithContentDto } from '../../application/dto';
import type { MaterialAttachment } from '../../domain/entities';
import { formatByteSize, validateMaterialFile } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { type RepEntityType, useRepForms } from '../hooks/useRepForms';
import { labels } from '../i18n/labels';
import { toDateTimeLocalValue } from '../utils/formatters';

const REP_ENTITY_TYPES: readonly RepEntityType[] = [
  'course',
  'week',
  'material',
  'deadline',
  'announcement',
];

function parseRepEntityType(raw: string | null): RepEntityType {
  if (raw && (REP_ENTITY_TYPES as readonly string[]).includes(raw)) {
    return raw as RepEntityType;
  }
  return 'course';
}

function formatWeekOptionLabel(weekNumber: number, title: string): string {
  const trimmed = title.trim();
  const prefix = `Week ${weekNumber}`;
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed;
  }
  return `${prefix}: ${trimmed}`;
}

export function RepFormPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuthSession();

  const activeType = parseRepEntityType(searchParams.get('type'));
  const queryCourseId = searchParams.get('courseId') ?? '';
  const queryWeekId = searchParams.get('weekId') ?? '';
  const editId = searchParams.get('editId') ?? '';
  const isEditMode = editId.trim().length > 0;

  const {
    isSaving,
    error: hookError,
    clearError,
    loadCoursesForClass,
    loadCourseWeeks,
    loadCourseAnnouncements,
    loadMaterialForEdit,
    saveCourse,
    saveWeek,
    saveMaterial,
    saveDeadline,
    saveAnnouncement,
  } = useRepForms();

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItemDto[]>([]);
  const [weeks, setWeeks] = useState<WeekWithContentDto[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');

  const [courseCode, setCourseCode] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');

  const [weekNumber, setWeekNumber] = useState<string>('1');
  const [weekTitle, setWeekTitle] = useState<string>('');
  const [weekSummary, setWeekSummary] = useState<string>('');

  const [materialTitle, setMaterialTitle] = useState<string>('');
  const [materialDescription, setMaterialDescription] = useState<string>('');
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(
    null,
  );
  const [existingAttachment, setExistingAttachment] =
    useState<MaterialAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState<boolean>(false);

  const [deadlineTitle, setDeadlineTitle] = useState<string>('');
  const [deadlineDescription, setDeadlineDescription] = useState<string>('');
  const [deadlineDueAt, setDeadlineDueAt] = useState<string>('');

  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementBody, setAnnouncementBody] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);

  const actor = session?.user ?? null;
  const isRep = actor?.role === 'rep' && Boolean(actor.classId);

  const heading = isEditMode
    ? labels.repForm.editHeading
    : labels.repForm.createHeading;

  useEffect(() => {
    document.title = `${isRep ? heading : labels.repForm.forbiddenTitle} | ${labels.app.name}`;
  }, [heading, isRep]);

  const hydrateForm = useCallback(async (): Promise<void> => {
    if (!actor || actor.role !== 'rep' || !actor.classId) {
      return;
    }

    setIsLoadingData(true);
    setLoadError(null);
    setFormError(null);
    setFileValidationError(null);
    setSelectedFile(null);
    clearError();

    try {
      const classCourses = await loadCoursesForClass(actor.classId, actor.id);
      setCourses(classCourses);

      if (activeType === 'course') {
        setWeeks([]);
        if (isEditMode) {
          const target = classCourses.find((item) => item.id === editId);
          if (!target) {
            setLoadError(labels.repForm.errors.notFound);
            return;
          }
          setSelectedCourseId(target.id);
          setCourseCode(target.code);
          setCourseName(target.name);
          setCourseDescription(target.description);
        } else {
          setSelectedCourseId(queryCourseId);
          setCourseCode('');
          setCourseName('');
          setCourseDescription('');
        }
        return;
      }

      if (classCourses.length === 0) {
        setSelectedCourseId('');
        setSelectedWeekId('');
        setWeeks([]);
        return;
      }

      if (activeType === 'material' && isEditMode) {
        const detail = await loadMaterialForEdit(editId);
        const courseWeeksDto = await loadCourseWeeks(
          detail.course.id,
          actor.id,
        );
        setSelectedCourseId(detail.course.id);
        setWeeks(courseWeeksDto.weeks);
        setSelectedWeekId(detail.week.id);
        setMaterialTitle(detail.material.title);
        setMaterialDescription(detail.material.description);
        setExternalUrl(detail.material.externalUrl ?? '');
        setExistingAttachment(detail.material.attachment);
        setRemoveAttachment(false);
        return;
      }

      const candidateCourseIds =
        queryCourseId && classCourses.some((c) => c.id === queryCourseId)
          ? [queryCourseId]
          : isEditMode
            ? classCourses.map((c) => c.id)
            : [classCourses[0]!.id];

      if (activeType === 'week') {
        if (isEditMode) {
          for (const candidateId of candidateCourseIds) {
            const dto = await loadCourseWeeks(candidateId, actor.id);
            const foundWeek = dto.weeks.find((w) => w.id === editId);
            if (foundWeek) {
              setSelectedCourseId(candidateId);
              setWeeks(dto.weeks);
              setWeekNumber(String(foundWeek.weekNumber));
              setWeekTitle(foundWeek.title);
              setWeekSummary(foundWeek.summary);
              return;
            }
          }
          setLoadError(labels.repForm.errors.notFound);
          return;
        }

        const resolvedCourseId = candidateCourseIds[0]!;
        const dto = await loadCourseWeeks(resolvedCourseId, actor.id);
        setSelectedCourseId(resolvedCourseId);
        setWeeks(dto.weeks);
        const maxNum = dto.weeks.reduce(
          (acc, w) => Math.max(acc, w.weekNumber),
          0,
        );
        setWeekNumber(String(maxNum + 1));
        setWeekTitle('');
        setWeekSummary('');
        return;
      }

      if (activeType === 'material') {
        const resolvedCourseId = candidateCourseIds[0]!;
        const dto = await loadCourseWeeks(resolvedCourseId, actor.id);
        setSelectedCourseId(resolvedCourseId);
        setWeeks(dto.weeks);
        const defaultWeekId =
          queryWeekId && dto.weeks.some((w) => w.id === queryWeekId)
            ? queryWeekId
            : (dto.weeks[0]?.id ?? '');
        setSelectedWeekId(defaultWeekId);
        setMaterialTitle('');
        setMaterialDescription('');
        setExternalUrl('');
        setExistingAttachment(null);
        setRemoveAttachment(false);
        return;
      }

      if (activeType === 'deadline') {
        if (isEditMode) {
          for (const candidateId of candidateCourseIds) {
            const dto = await loadCourseWeeks(candidateId, actor.id);
            const allDeadlines = [
              ...dto.weeks.flatMap((w) => w.deadlines),
              ...dto.unassignedDeadlines,
            ];
            const foundDeadline = allDeadlines.find((d) => d.id === editId);
            if (foundDeadline) {
              setSelectedCourseId(candidateId);
              setWeeks(dto.weeks);
              setSelectedWeekId(foundDeadline.weekId ?? '');
              setDeadlineTitle(foundDeadline.title);
              setDeadlineDescription(foundDeadline.description);
              setDeadlineDueAt(toDateTimeLocalValue(foundDeadline.dueAt));
              return;
            }
          }
          setLoadError(labels.repForm.errors.notFound);
          return;
        }

        const resolvedCourseId = candidateCourseIds[0]!;
        const dto = await loadCourseWeeks(resolvedCourseId, actor.id);
        setSelectedCourseId(resolvedCourseId);
        setWeeks(dto.weeks);
        const defaultWeekId =
          queryWeekId && dto.weeks.some((w) => w.id === queryWeekId)
            ? queryWeekId
            : '';
        setSelectedWeekId(defaultWeekId);
        setDeadlineTitle('');
        setDeadlineDescription('');
        setDeadlineDueAt('');
        return;
      }

      if (activeType === 'announcement') {
        if (isEditMode) {
          for (const candidateId of candidateCourseIds) {
            const list = await loadCourseAnnouncements(candidateId);
            const found = list.find((a) => a.id === editId);
            if (found) {
              setSelectedCourseId(candidateId);
              setWeeks([]);
              setAnnouncementTitle(found.title);
              setAnnouncementBody(found.body);
              return;
            }
          }
          setLoadError(labels.repForm.errors.notFound);
          return;
        }

        const resolvedCourseId = candidateCourseIds[0]!;
        setSelectedCourseId(resolvedCourseId);
        setWeeks([]);
        setAnnouncementTitle('');
        setAnnouncementBody('');
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : labels.repForm.loadErrorTitle,
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [
    activeType,
    actor,
    clearError,
    editId,
    isEditMode,
    loadCourseAnnouncements,
    loadCourseWeeks,
    loadCoursesForClass,
    loadMaterialForEdit,
    queryCourseId,
    queryWeekId,
  ]);

  useEffect(() => {
    void hydrateForm();
  }, [hydrateForm]);

  if (!actor || !isRep || !actor.classId) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1>{labels.repForm.forbiddenTitle}</h1>
        </header>
        <EmptyState
          title={labels.repForm.forbiddenTitle}
          body={labels.repForm.forbiddenBody}
          actionLabel={labels.repForm.returnHomeCta}
          actionTo="/"
        />
      </div>
    );
  }

  const switchType = (nextType: RepEntityType, nextCourseId?: string): void => {
    const params = new URLSearchParams();
    params.set('type', nextType);
    const keepCourse = nextCourseId ?? selectedCourseId;
    if (keepCourse && nextType !== 'course') {
      params.set('courseId', keepCourse);
    }
    setSearchParams(params);
  };

  const handleCourseSelectionChange = async (
    nextCourseId: string,
  ): Promise<void> => {
    setSelectedCourseId(nextCourseId);
    setFormError(null);
    clearError();

    if (
      nextCourseId &&
      (activeType === 'week' ||
        activeType === 'material' ||
        activeType === 'deadline')
    ) {
      try {
        const dto = await loadCourseWeeks(nextCourseId, actor.id);
        setWeeks(dto.weeks);
        if (activeType === 'material') {
          setSelectedWeekId(dto.weeks[0]?.id ?? '');
        } else if (activeType === 'deadline') {
          setSelectedWeekId('');
        } else if (activeType === 'week' && !isEditMode) {
          const maxNum = dto.weeks.reduce(
            (acc, w) => Math.max(acc, w.weekNumber),
            0,
          );
          setWeekNumber(String(maxNum + 1));
        }
      } catch {
        setWeeks([]);
      }
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0] ?? null;
    setFormError(null);
    clearError();

    if (!file) {
      setSelectedFile(null);
      setFileValidationError(null);
      return;
    }

    const check = validateMaterialFile({
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    });

    setSelectedFile(file);

    if (!check.valid) {
      const reasonMessage =
        check.reason === 'file_too_large'
          ? labels.repForm.errors.fileTooLarge
          : check.reason === 'invalid_mime_type'
            ? labels.repForm.errors.invalidFileType
            : labels.repForm.errors.emptyFile;
      setFileValidationError(reasonMessage);
      setFormError(reasonMessage);
      return;
    }

    setFileValidationError(null);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    clearError();

    try {
      if (activeType === 'course') {
        if (courseCode.trim().length === 0 || courseName.trim().length === 0) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const saved = await saveCourse({
          actor,
          classId: actor.classId!,
          code: courseCode,
          name: courseName,
          description: courseDescription,
          editId: isEditMode ? editId : undefined,
        });
        navigate(`/courses/${saved.id}`);
        return;
      }

      if (!selectedCourseId) {
        setFormError(labels.repForm.errors.validation);
        return;
      }

      if (activeType === 'week') {
        const parsedNumber = Number.parseInt(weekNumber, 10);
        if (
          !Number.isInteger(parsedNumber) ||
          parsedNumber < 1 ||
          weekTitle.trim().length === 0
        ) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const saved = await saveWeek({
          actor,
          courseId: selectedCourseId,
          weekNumber: parsedNumber,
          title: weekTitle,
          summary: weekSummary,
          editId: isEditMode ? editId : undefined,
        });
        navigate(`/courses/${saved.courseId}`, {
          state: { toast: 'Saved on this device. Will sync later.' },
        });
        return;
      }

      if (activeType === 'material') {
        if (fileValidationError) {
          setFormError(fileValidationError);
          return;
        }
        if (
          selectedWeekId.trim().length === 0 ||
          materialTitle.trim().length === 0
        ) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const saved = await saveMaterial({
          actor,
          courseId: selectedCourseId,
          weekId: selectedWeekId,
          title: materialTitle,
          description: materialDescription,
          externalUrl,
          file: selectedFile,
          removeAttachment,
          editId: isEditMode ? editId : undefined,
        });
        navigate(`/materials/${saved.id}`);
        return;
      }

      if (activeType === 'deadline') {
        if (
          deadlineTitle.trim().length === 0 ||
          deadlineDueAt.trim().length === 0
        ) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const parsedDueMs = Date.parse(deadlineDueAt);
        if (Number.isNaN(parsedDueMs)) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const saved = await saveDeadline({
          actor,
          courseId: selectedCourseId,
          weekId: selectedWeekId.trim().length > 0 ? selectedWeekId : null,
          title: deadlineTitle,
          description: deadlineDescription,
          dueAt: new Date(parsedDueMs).toISOString(),
          editId: isEditMode ? editId : undefined,
        });
        navigate(`/courses/${saved.courseId}`, {
          state: { toast: 'Saved on this device. Will sync later.' },
        });
        return;
      }

      if (activeType === 'announcement') {
        if (
          announcementTitle.trim().length === 0 ||
          announcementBody.trim().length === 0
        ) {
          setFormError(labels.repForm.errors.validation);
          return;
        }
        const saved = await saveAnnouncement({
          actor,
          courseId: selectedCourseId,
          title: announcementTitle,
          body: announcementBody,
          editId: isEditMode ? editId : undefined,
        });
        navigate(`/courses/${saved.courseId}`, {
          state: { toast: 'Saved on this device. Will sync later.' },
        });
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : labels.repForm.errors.storageFailed,
      );
    }
  };

  const activeErrorMessage = formError ?? hookError;
  const cancelDestination = selectedCourseId
    ? `/courses/${selectedCourseId}`
    : '/courses';

  const submitLabel = isSaving
    ? labels.common.saving
    : activeType === 'course'
      ? labels.repForm.ctas.saveCourse
      : activeType === 'week'
        ? labels.repForm.ctas.saveWeek
        : activeType === 'material'
          ? labels.repForm.ctas.saveMaterial
          : activeType === 'deadline'
            ? labels.repForm.ctas.saveDeadline
            : labels.repForm.ctas.postAnnouncement;

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>{heading}</h1>
      </header>

      <section className="index-card">
        <div className="card-tab-bar">
          <span className="card-tab-code">
            {isEditMode ? '[EDIT ITEM]' : '[MANAGE]'}
          </span>
        </div>
        <h2>{labels.repForm.typeSelectorLabel}</h2>
        <div
          className="type-selector"
          role="group"
          aria-label={labels.repForm.typeSelectorLabel}
        >
          {REP_ENTITY_TYPES.map((typeOption) => (
            <button
              key={typeOption}
              type="button"
              className="btn btn-secondary btn-compact btn-toggle"
              aria-pressed={activeType === typeOption}
              onClick={() => switchType(typeOption)}
              disabled={isSaving}
            >
              {labels.repForm.types[typeOption]}
            </button>
          ))}
        </div>
      </section>

      {isLoadingData ? (
        <LoadingState message={labels.repForm.loadingForm} />
      ) : null}

      {!isLoadingData && loadError ? (
        <ErrorState
          title={labels.repForm.loadErrorTitle}
          detail={loadError}
          onRetry={() => void hydrateForm()}
        />
      ) : null}

      {!isLoadingData &&
      !loadError &&
      activeType !== 'course' &&
      courses.length === 0 ? (
        <EmptyState
          title={labels.courses.emptyTitle}
          body={labels.repForm.noCoursesHint}
          actionLabel={labels.courses.emptyRepCta}
          onAction={() => switchType('course')}
        />
      ) : null}

      {!isLoadingData &&
      !loadError &&
      (activeType === 'course' || courses.length > 0) ? (
        <section className="index-card">
          <div className="card-tab-bar">
            <span className="card-tab-code">
              {`[${labels.repForm.types[activeType].toUpperCase()}]`}
            </span>
          </div>

          <form
            className="form-stack"
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
          >
            {activeType !== 'course' ? (
              <div className="field-group">
                <label htmlFor="rep-course-select" className="field-label">
                  {labels.repForm.courseSelectLabel}
                </label>
                <select
                  id="rep-course-select"
                  className="field-input"
                  value={selectedCourseId}
                  onChange={(e) =>
                    void handleCourseSelectionChange(e.target.value)
                  }
                  disabled={isSaving || isEditMode}
                >
                  {courses.map((courseItem) => (
                    <option key={courseItem.id} value={courseItem.id}>
                      {`${courseItem.code}: ${courseItem.name}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {activeType === 'material' && weeks.length === 0 ? (
              <EmptyState
                headingLevel="h3"
                title={labels.courseDetail.emptyNoWeeksTitle}
                body={labels.repForm.noWeeksHint}
                actionLabel={labels.courseDetail.addFirstWeekCta}
                onAction={() => switchType('week', selectedCourseId)}
              />
            ) : (
              <>
                {activeType === 'course' ? (
                  <>
                    <div className="field-group">
                      <label htmlFor="rep-course-code" className="field-label">
                        {labels.repForm.fields.courseCodeLabel}
                      </label>
                      <input
                        id="rep-course-code"
                        type="text"
                        className="field-input mono-input"
                        placeholder={labels.repForm.fields.courseCodePlaceholder}
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label htmlFor="rep-course-name" className="field-label">
                        {labels.repForm.fields.courseNameLabel}
                      </label>
                      <input
                        id="rep-course-name"
                        type="text"
                        className="field-input"
                        placeholder={labels.repForm.fields.courseNamePlaceholder}
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-course-description"
                        className="field-label"
                      >
                        {labels.repForm.fields.courseDescriptionLabel}
                      </label>
                      <textarea
                        id="rep-course-description"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.courseDescriptionPlaceholder
                        }
                        value={courseDescription}
                        onChange={(e) => setCourseDescription(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                ) : null}

                {activeType === 'week' ? (
                  <>
                    <div className="field-group">
                      <label htmlFor="rep-week-number" className="field-label">
                        {labels.repForm.fields.weekNumberLabel}
                      </label>
                      <input
                        id="rep-week-number"
                        type="number"
                        min={1}
                        step={1}
                        className="field-input mono-input"
                        placeholder={labels.repForm.fields.weekNumberPlaceholder}
                        value={weekNumber}
                        onChange={(e) => setWeekNumber(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label htmlFor="rep-week-title" className="field-label">
                        {labels.repForm.fields.weekTitleLabel}
                      </label>
                      <input
                        id="rep-week-title"
                        type="text"
                        className="field-input"
                        placeholder={labels.repForm.fields.weekTitlePlaceholder}
                        value={weekTitle}
                        onChange={(e) => setWeekTitle(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label htmlFor="rep-week-summary" className="field-label">
                        {labels.repForm.fields.weekSummaryLabel}
                      </label>
                      <textarea
                        id="rep-week-summary"
                        className="field-input"
                        placeholder={labels.repForm.fields.weekSummaryPlaceholder}
                        value={weekSummary}
                        onChange={(e) => setWeekSummary(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                ) : null}

                {activeType === 'material' ? (
                  <>
                    <div className="field-group">
                      <label htmlFor="rep-material-week" className="field-label">
                        {labels.repForm.weekSelectLabel}
                      </label>
                      <select
                        id="rep-material-week"
                        className="field-input"
                        value={selectedWeekId}
                        onChange={(e) => setSelectedWeekId(e.target.value)}
                        disabled={isSaving}
                      >
                        {weeks.map((weekItem) => (
                          <option key={weekItem.id} value={weekItem.id}>
                            {formatWeekOptionLabel(
                              weekItem.weekNumber,
                              weekItem.title,
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-material-title"
                        className="field-label"
                      >
                        {labels.repForm.fields.materialTitleLabel}
                      </label>
                      <input
                        id="rep-material-title"
                        type="text"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.materialTitlePlaceholder
                        }
                        value={materialTitle}
                        onChange={(e) => setMaterialTitle(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-material-description"
                        className="field-label"
                      >
                        {labels.repForm.fields.materialDescriptionLabel}
                      </label>
                      <textarea
                        id="rep-material-description"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.materialDescriptionPlaceholder
                        }
                        value={materialDescription}
                        onChange={(e) => setMaterialDescription(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-material-external-url"
                        className="field-label"
                      >
                        {labels.repForm.fields.externalUrlLabel}
                      </label>
                      <input
                        id="rep-material-external-url"
                        type="url"
                        className="field-input mono-input"
                        placeholder={
                          labels.repForm.fields.externalUrlPlaceholder
                        }
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label htmlFor="rep-material-pdf" className="field-label">
                        {labels.repForm.fields.pdfFileLabel}
                      </label>
                      <input
                        id="rep-material-pdf"
                        type="file"
                        accept="application/pdf,.pdf"
                        className="field-input"
                        onChange={handleFileChange}
                        disabled={isSaving}
                      />
                      {selectedFile && !fileValidationError ? (
                        <p className="field-hint mono-code">
                          {`${selectedFile.name} (${formatByteSize(selectedFile.size)}, ${selectedFile.size.toLocaleString('en-US')} ${labels.materialDetail.bytesSuffix})`}
                        </p>
                      ) : null}
                      {existingAttachment && !selectedFile ? (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <p className="meta-text mono-code">
                            {`${labels.repForm.fields.currentAttachmentPrefix} ${existingAttachment.name} (${formatByteSize(existingAttachment.sizeBytes)})`}
                          </p>
                          <div className="checkbox-row">
                            <input
                              id="rep-remove-attachment"
                              type="checkbox"
                              checked={removeAttachment}
                              onChange={(e) =>
                                setRemoveAttachment(e.target.checked)
                              }
                              disabled={isSaving}
                            />
                            <label htmlFor="rep-remove-attachment">
                              {labels.repForm.fields.removeAttachmentLabel}
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {activeType === 'deadline' ? (
                  <>
                    <div className="field-group">
                      <label htmlFor="rep-deadline-week" className="field-label">
                        {labels.repForm.weekSelectOptionalLabel}
                      </label>
                      <select
                        id="rep-deadline-week"
                        className="field-input"
                        value={selectedWeekId}
                        onChange={(e) => setSelectedWeekId(e.target.value)}
                        disabled={isSaving}
                      >
                        <option value="">
                          {labels.repForm.weekSelectNoneOption}
                        </option>
                        {weeks.map((weekItem) => (
                          <option key={weekItem.id} value={weekItem.id}>
                            {formatWeekOptionLabel(
                              weekItem.weekNumber,
                              weekItem.title,
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-deadline-title"
                        className="field-label"
                      >
                        {labels.repForm.fields.deadlineTitleLabel}
                      </label>
                      <input
                        id="rep-deadline-title"
                        type="text"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.deadlineTitlePlaceholder
                        }
                        value={deadlineTitle}
                        onChange={(e) => setDeadlineTitle(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-deadline-due-at"
                        className="field-label"
                      >
                        {labels.repForm.fields.deadlineDueAtLabel}
                      </label>
                      <input
                        id="rep-deadline-due-at"
                        type="datetime-local"
                        className="field-input mono-input"
                        value={deadlineDueAt}
                        onChange={(e) => setDeadlineDueAt(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-deadline-description"
                        className="field-label"
                      >
                        {labels.repForm.fields.deadlineDescriptionLabel}
                      </label>
                      <textarea
                        id="rep-deadline-description"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.deadlineDescriptionPlaceholder
                        }
                        value={deadlineDescription}
                        onChange={(e) => setDeadlineDescription(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                ) : null}

                {activeType === 'announcement' ? (
                  <>
                    <div className="field-group">
                      <label
                        htmlFor="rep-announcement-title"
                        className="field-label"
                      >
                        {labels.repForm.fields.announcementTitleLabel}
                      </label>
                      <input
                        id="rep-announcement-title"
                        type="text"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.announcementTitlePlaceholder
                        }
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="field-group">
                      <label
                        htmlFor="rep-announcement-body"
                        className="field-label"
                      >
                        {labels.repForm.fields.announcementBodyLabel}
                      </label>
                      <textarea
                        id="rep-announcement-body"
                        className="field-input"
                        placeholder={
                          labels.repForm.fields.announcementBodyPlaceholder
                        }
                        value={announcementBody}
                        onChange={(e) => setAnnouncementBody(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                ) : null}

                {activeErrorMessage ? (
                  <div className="field-error" role="alert">
                    {activeErrorMessage}
                  </div>
                ) : null}

                <div className="action-row">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                  >
                    {submitLabel}
                  </button>
                  <Link to={cancelDestination} className="btn btn-secondary">
                    {labels.common.cancel}
                  </Link>
                </div>
              </>
            )}
          </form>
        </section>
      ) : null}
    </div>
  );
}

export default RepFormPage;
