import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type {
  AnnotatedDeadlineDto,
  CourseListItemDto,
  WeekWithContentDto,
} from '../../application/dto';
import type { Announcement, MaterialAttachment } from '../../domain/entities';
import { formatByteSize, validateMaterialFile } from '../../domain/rules';
import { Chip, SegmentedControl } from '../components/FigmaComponents';
import {
  IconArrowLeft,
  IconCloudDownload,
  IconNote,
  IconPlus,
  IconTrash,
} from '../components/Icons';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { type RepEntityType, useRepForms } from '../hooks/useRepForms';
import { labels } from '../i18n/labels';
import {
  formatDateTime,
  formatWeekCode,
  toDateTimeLocalValue,
} from '../utils/formatters';

type DeleteTargetSnapshot =
  | {
      type: 'course';
      id: string;
      code: string;
      name: string;
      description: string;
    }
  | {
      type: 'week';
      id: string;
      courseId: string;
      weekNumber: number;
      title: string;
      summary: string;
    }
  | {
      type: 'material';
      id: string;
      courseId: string;
      weekId: string;
      title: string;
      description: string;
      externalUrl: string | null;
    }
  | {
      type: 'deadline';
      id: string;
      courseId: string;
      weekId: string | null;
      title: string;
      description: string;
      dueAt: string;
    }
  | {
      type: 'announcement';
      id: string;
      courseId: string;
      title: string;
      body: string;
    };

interface BrowserItemSummary {
  id: string;
  courseId?: string;
  badge: string;
  title: string;
  subtitle: string;
}

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
    isDeleting,
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
    deleteCourse,
    deleteWeek,
    deleteMaterial,
    deleteDeadline,
    deleteAnnouncement,
  } = useRepForms();

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItemDto[]>([]);
  const [weeks, setWeeks] = useState<WeekWithContentDto[]>([]);
  const [unassignedDeadlines, setUnassignedDeadlines] = useState<
    AnnotatedDeadlineDto[]
  >([]);
  const [courseAnnouncements, setCourseAnnouncements] = useState<
    Announcement[]
  >([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetSnapshot | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [isDragOverPdf, setIsDragOverPdf] = useState<boolean>(false);

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
    setDeleteTarget(null);
    setConfirmingDelete(false);
    clearError();

    try {
      const classCourses = await loadCoursesForClass(actor.classId, actor.id);
      setCourses(classCourses);

      if (activeType === 'course') {
        setWeeks([]);
        setUnassignedDeadlines([]);
        setCourseAnnouncements([]);
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
          setDeleteTarget({
            type: 'course',
            id: target.id,
            code: target.code,
            name: target.name,
            description: target.description,
          });
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
        setUnassignedDeadlines([]);
        setCourseAnnouncements([]);
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
        setUnassignedDeadlines(courseWeeksDto.unassignedDeadlines);
        setSelectedWeekId(detail.week.id);
        setMaterialTitle(detail.material.title);
        setMaterialDescription(detail.material.description);
        setExternalUrl(detail.material.externalUrl ?? '');
        setExistingAttachment(detail.material.attachment);
        setRemoveAttachment(false);
        setDeleteTarget({
          type: 'material',
          id: detail.material.id,
          courseId: detail.course.id,
          weekId: detail.week.id,
          title: detail.material.title,
          description: detail.material.description,
          externalUrl: detail.material.externalUrl,
        });
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
              setUnassignedDeadlines(dto.unassignedDeadlines);
              setWeekNumber(String(foundWeek.weekNumber));
              setWeekTitle(foundWeek.title);
              setWeekSummary(foundWeek.summary);
              setDeleteTarget({
                type: 'week',
                id: foundWeek.id,
                courseId: candidateId,
                weekNumber: foundWeek.weekNumber,
                title: foundWeek.title,
                summary: foundWeek.summary,
              });
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
        setUnassignedDeadlines(dto.unassignedDeadlines);
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
        setUnassignedDeadlines(dto.unassignedDeadlines);
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
              setUnassignedDeadlines(dto.unassignedDeadlines);
              setSelectedWeekId(foundDeadline.weekId ?? '');
              setDeadlineTitle(foundDeadline.title);
              setDeadlineDescription(foundDeadline.description);
              setDeadlineDueAt(toDateTimeLocalValue(foundDeadline.dueAt));
              setDeleteTarget({
                type: 'deadline',
                id: foundDeadline.id,
                courseId: candidateId,
                weekId: foundDeadline.weekId,
                title: foundDeadline.title,
                description: foundDeadline.description,
                dueAt: foundDeadline.dueAt,
              });
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
        setUnassignedDeadlines(dto.unassignedDeadlines);
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
              setUnassignedDeadlines([]);
              setCourseAnnouncements(list);
              setAnnouncementTitle(found.title);
              setAnnouncementBody(found.body);
              setDeleteTarget({
                type: 'announcement',
                id: found.id,
                courseId: candidateId,
                title: found.title,
                body: found.body,
              });
              return;
            }
          }
          setLoadError(labels.repForm.errors.notFound);
          return;
        }

        const resolvedCourseId = candidateCourseIds[0]!;
        const list = await loadCourseAnnouncements(resolvedCourseId);
        setSelectedCourseId(resolvedCourseId);
        setWeeks([]);
        setUnassignedDeadlines([]);
        setCourseAnnouncements(list);
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

  const browserItems = useMemo<BrowserItemSummary[]>(() => {
    if (activeType === 'course') {
      return courses.map((c) => ({
        id: c.id,
        courseId: c.id,
        badge: c.code,
        title: c.name,
        subtitle: c.description || 'Class course',
      }));
    }
    if (activeType === 'week') {
      return weeks.map((w) => ({
        id: w.id,
        courseId: selectedCourseId,
        badge: formatWeekCode('WEEK', w.weekNumber),
        title: w.title,
        subtitle: `${w.materials.length} material${w.materials.length === 1 ? '' : 's'} / ${w.deadlines.length} deadline${w.deadlines.length === 1 ? '' : 's'}`,
      }));
    }
    if (activeType === 'material') {
      return weeks.flatMap((w) =>
        w.materials.map((m) => ({
          id: m.id,
          courseId: selectedCourseId,
          badge: `W${w.weekNumber}`,
          title: m.title,
          subtitle: m.attachment
            ? `PDF (${formatByteSize(m.attachment.sizeBytes)})`
            : 'Text summary',
        })),
      );
    }
    if (activeType === 'deadline') {
      const weekById = new Map(weeks.map((w) => [w.id, w.weekNumber]));
      const allDeadlines = [
        ...weeks.flatMap((w) => w.deadlines),
        ...unassignedDeadlines,
      ];
      return allDeadlines.map((d) => ({
        id: d.id,
        courseId: selectedCourseId,
        badge:
          d.weekId && weekById.has(d.weekId)
            ? `W${weekById.get(d.weekId)}`
            : 'COURSE',
        title: d.title,
        subtitle: `Due: ${formatDateTime(d.dueAt)}`,
      }));
    }
    return courseAnnouncements.map((a) => ({
      id: a.id,
      courseId: selectedCourseId,
      badge: 'POST',
      title: a.title,
      subtitle: formatDateTime(a.postedAt),
    }));
  }, [
    activeType,
    courseAnnouncements,
    courses,
    selectedCourseId,
    unassignedDeadlines,
    weeks,
  ]);

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

  const selectItemToEdit = (targetId: string, targetCourseId?: string): void => {
    const params = new URLSearchParams();
    params.set('type', activeType);
    if (activeType !== 'course' && (targetCourseId || selectedCourseId)) {
      params.set('courseId', targetCourseId || selectedCourseId);
    }
    params.set('editId', targetId);
    setSearchParams(params);
  };

  const switchToCreateNew = (): void => {
    switchType(activeType, selectedCourseId);
  };

  const handleCourseSelectionChange = async (
    nextCourseId: string,
  ): Promise<void> => {
    setSelectedCourseId(nextCourseId);
    setFormError(null);
    clearError();

    if (!nextCourseId) {
      return;
    }

    if (
      activeType === 'week' ||
      activeType === 'material' ||
      activeType === 'deadline'
    ) {
      try {
        const dto = await loadCourseWeeks(nextCourseId, actor.id);
        setWeeks(dto.weeks);
        setUnassignedDeadlines(dto.unassignedDeadlines);
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
        setUnassignedDeadlines([]);
      }
    } else if (activeType === 'announcement') {
      try {
        const list = await loadCourseAnnouncements(nextCourseId);
        setCourseAnnouncements(list);
      } catch {
        setCourseAnnouncements([]);
      }
    }
  };

  const applySelectedPdfFile = (file: File | null): void => {
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
    setRemoveAttachment(false);

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

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0] ?? null;
    applySelectedPdfFile(file);
  };

  const handlePdfDrop = (event: React.DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragOverPdf(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) {
      applySelectedPdfFile(file);
    }
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
        toast.success('Course saved on this device.');
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
          removeAttachment: selectedFile ? false : removeAttachment,
          editId: isEditMode ? editId : undefined,
        });
        toast.success('Material saved on this device.');
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

  const handleConfirmDelete = async (): Promise<void> => {
    if (!actor || !deleteTarget) {
      return;
    }
    setFormError(null);
    clearError();

    try {
      if (deleteTarget.type === 'course') {
        await deleteCourse({
          actor,
          courseId: deleteTarget.id,
          code: deleteTarget.code,
          name: deleteTarget.name,
          description: deleteTarget.description,
        });
        toast.success(labels.repForm.delete.deletedToast);
        navigate('/courses', { replace: true });
        return;
      }

      if (deleteTarget.type === 'week') {
        await deleteWeek({
          actor,
          weekId: deleteTarget.id,
          weekNumber: deleteTarget.weekNumber,
          title: deleteTarget.title,
          summary: deleteTarget.summary,
        });
        toast.success(labels.repForm.delete.deletedToast);
        navigate(`/courses/${deleteTarget.courseId}`, { replace: true });
        return;
      }

      if (deleteTarget.type === 'material') {
        await deleteMaterial({
          actor,
          materialId: deleteTarget.id,
          weekId: deleteTarget.weekId,
          title: deleteTarget.title,
          description: deleteTarget.description,
          externalUrl: deleteTarget.externalUrl,
        });
        toast.success(labels.repForm.delete.deletedToast);
        navigate(`/courses/${deleteTarget.courseId}`, { replace: true });
        return;
      }

      if (deleteTarget.type === 'deadline') {
        await deleteDeadline({
          actor,
          deadlineId: deleteTarget.id,
          weekId: deleteTarget.weekId,
          title: deleteTarget.title,
          description: deleteTarget.description,
          dueAt: deleteTarget.dueAt,
        });
        toast.success(labels.repForm.delete.deletedToast);
        navigate(`/courses/${deleteTarget.courseId}`, { replace: true });
        return;
      }

      await deleteAnnouncement({
        actor,
        announcementId: deleteTarget.id,
        title: deleteTarget.title,
        body: deleteTarget.body,
      });
      toast.success(labels.repForm.delete.deletedToast);
      navigate(`/courses/${deleteTarget.courseId}`, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : labels.repForm.errors.storageFailed,
      );
      setConfirmingDelete(false);
    }
  };

  const isBusy = isSaving || isDeleting;
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
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{heading}</h1>
            <p className="page-lead">
              Publish or update courses, weekly materials, deadlines, and announcements for your class.
            </p>
          </div>
          <div className="breadcrumb-row">
            {isEditMode ? (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={switchToCreateNew}
              >
                <IconPlus size={15} />
                <span>{`New ${labels.repForm.types[activeType].toLowerCase()}`}</span>
              </button>
            ) : null}
            <Link to={cancelDestination} className="breadcrumb-link">
              <IconArrowLeft size={15} />
              <span>
                {selectedCourseId ? 'Back to course' : labels.courseDetail.backToCourses}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Spring-Animated Content Type Segmented Bar */}
      <div
        role="group"
        aria-label={labels.repForm.typeSelectorLabel}
        style={{ maxWidth: '680px' }}
      >
        <SegmentedControl<RepEntityType>
          options={REP_ENTITY_TYPES}
          active={activeType}
          onChange={(next) => switchType(next)}
          labelsMap={labels.repForm.types}
        />
      </div>

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
        <div className="rep-studio-grid">
          {/* Left Column: Main Editor Form + Guarded Remove Card */}
          <div className="card-stack">
            <section className="index-card">
              <div className="section-heading-row" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="card-tab-code">
                    {labels.repForm.types[activeType].toUpperCase()}
                  </span>
                  <Chip
                    type={isEditMode ? 'info' : 'neutral'}
                    size="S"
                    label={isEditMode ? 'Editing existing item' : 'Creating new item'}
                  />
                </div>
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
                      disabled={isBusy || isEditMode}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
                          />
                        </div>

                        <div className="field-group">
                          <span className="field-label">
                            {labels.repForm.fields.pdfFileLabel}
                          </span>
                          <label
                            htmlFor="rep-material-pdf"
                            className={
                              isDragOverPdf
                                ? 'pdf-dropzone pdf-dropzone--drag'
                                : 'pdf-dropzone'
                            }
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOverPdf(true);
                            }}
                            onDragLeave={() => setIsDragOverPdf(false)}
                            onDrop={handlePdfDrop}
                          >
                            <IconCloudDownload
                              size={22}
                              style={{ color: 'var(--color-primary)' }}
                            />
                            <span className="pdf-dropzone__title">
                              {selectedFile
                                ? selectedFile.name
                                : 'Click to choose a PDF or drag and drop here'}
                            </span>
                            <span className="pdf-dropzone__sub">
                              {selectedFile
                                ? `${formatByteSize(selectedFile.size)} (${selectedFile.size.toLocaleString('en-US')} ${labels.materialDetail.bytesSuffix})`
                                : 'Accepted format: .pdf up to 5 MB'}
                            </span>
                            <input
                              id="rep-material-pdf"
                              type="file"
                              accept="application/pdf,.pdf"
                              className="sr-only"
                              onChange={handleFileChange}
                              disabled={isBusy}
                            />
                          </label>

                          {selectedFile ? (
                            <div
                              className="action-row"
                              style={{ marginTop: '8px', justifyContent: 'space-between' }}
                            >
                              <span className="field-hint mono-code" style={{ margin: 0 }}>
                                {`${selectedFile.name} (${formatByteSize(selectedFile.size)})`}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-compact"
                                onClick={() => applySelectedPdfFile(null)}
                              >
                                <IconTrash size={13} />
                                <span>Clear selected file</span>
                              </button>
                            </div>
                          ) : null}

                          {existingAttachment && !selectedFile ? (
                            <div className="pdf-existing-pill">
                              <div>
                                <p className="meta-text mono-code" style={{ margin: 0 }}>
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
                                    disabled={isBusy}
                                  />
                                  <label htmlFor="rep-remove-attachment">
                                    {labels.repForm.fields.removeAttachmentLabel}
                                  </label>
                                </div>
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                            disabled={isBusy}
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
                        disabled={isBusy}
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

            {isEditMode && deleteTarget ? (
              <section className="index-card index-card--urgent section-block">
                <div className="card-tab-bar" style={{ marginBottom: 0 }}>
                  <span className="card-tab-code">REMOVE</span>
                </div>
                <h2>{labels.repForm.delete.sectionHeading}</h2>
                <p className="meta-text">{labels.repForm.delete.sectionHint}</p>

                {confirmingDelete ? (
                  <div className="section-block" role="alert">
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {labels.repForm.delete.confirmPrompt}
                    </p>
                    <div className="action-row" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={isBusy}
                        onClick={() => void handleConfirmDelete()}
                      >
                        {isDeleting
                          ? labels.repForm.delete.deleting
                          : labels.repForm.delete.confirmCta}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isBusy}
                        onClick={() => setConfirmingDelete(false)}
                      >
                        {labels.common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="action-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      disabled={isBusy}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      {labels.repForm.delete.triggerCta}
                    </button>
                  </div>
                )}
              </section>
            ) : null}
          </div>

          {/* Right Column: Live Existing Items Browser in Selected Course/Class */}
          <aside className="rep-studio-browser" aria-label="Existing items in workspace">
            <div className="rep-studio-browser__head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconNote size={16} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ margin: 0, fontSize: '16px' }}>
                  {`Existing ${labels.repForm.types[activeType].toLowerCase()}s (${browserItems.length})`}
                </h2>
              </div>
              {isEditMode ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={switchToCreateNew}
                >
                  <IconPlus size={14} />
                  <span>New</span>
                </button>
              ) : null}
            </div>

            <p className="meta-text" style={{ fontSize: '12px', margin: 0 }}>
              Click any item below to load it into the editor for quick updates or removal.
            </p>

            {browserItems.length === 0 ? (
              <p className="meta-text" style={{ fontSize: '13px', margin: 0 }}>
                {`No ${labels.repForm.types[activeType].toLowerCase()}s posted here yet.`}
              </p>
            ) : (
              <ul className="rep-browser-list">
                {browserItems.map((item) => {
                  const isEditingThis = isEditMode && editId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={
                          isEditingThis
                            ? 'rep-browser-item rep-browser-item--active'
                            : 'rep-browser-item'
                        }
                        onClick={() => selectItemToEdit(item.id, item.courseId)}
                      >
                        <div className="rep-browser-item__top">
                          <span className="card-tab-code">{item.badge}</span>
                          {isEditingThis ? (
                            <Chip type="info" size="S" label="Editing" />
                          ) : (
                            <span className="rep-browser-item__action">Edit</span>
                          )}
                        </div>
                        <strong className="rep-browser-item__title">
                          {item.title}
                        </strong>
                        <span className="rep-browser-item__sub">
                          {item.subtitle}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default RepFormPage;
