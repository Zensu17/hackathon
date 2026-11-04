import { useCallback, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type {
  CourseListItemDto,
  CourseWeeksDto,
  MaterialDetailDto,
} from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import type {
  Announcement,
  Course,
  Deadline,
  Material,
  MaterialUploadInput,
  User,
  Week,
} from '../../domain/entities';
import { validateMaterialFile } from '../../domain/rules';
import { labels } from '../i18n/labels';

export type RepEntityType =
  | 'course'
  | 'week'
  | 'material'
  | 'deadline'
  | 'announcement';

export interface SaveMaterialFormInput {
  actor: User;
  courseId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string;
  file: File | null;
  removeAttachment?: boolean;
  editId?: string;
}

export function mapRepError(error: unknown): string {
  if (isAppError(error)) {
    if (error.code === 'FILE_TOO_LARGE') {
      return labels.repForm.errors.fileTooLarge;
    }
    if (error.code === 'INVALID_FILE_TYPE') {
      return labels.repForm.errors.invalidFileType;
    }
    if (error.code === 'FORBIDDEN_ROLE') {
      return labels.repForm.errors.forbidden;
    }
    if (error.code === 'NOT_FOUND') {
      return labels.repForm.errors.notFound;
    }
    if (error.code === 'VALIDATION_ERROR') {
      const lower = error.message.toLowerCase();
      if (lower.includes('http://') || lower.includes('https://') || lower.includes('url')) {
        return labels.repForm.errors.invalidUrl;
      }
      if (lower.includes('empty') && lower.includes('pdf')) {
        return labels.repForm.errors.emptyFile;
      }
      return error.message || labels.repForm.errors.validation;
    }
    if (error.code === 'STORAGE_ERROR') {
      return labels.repForm.errors.storageFailed;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return labels.repForm.errors.storageFailed;
}

// Convert browser File into platform-neutral Uint8Array upload input after domain rule validation.
async function fileToUploadInput(file: File): Promise<MaterialUploadInput> {
  const check = validateMaterialFile({
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  });

  if (!check.valid) {
    if (check.reason === 'file_too_large') {
      throw new Error(labels.repForm.errors.fileTooLarge);
    }
    if (check.reason === 'invalid_mime_type') {
      throw new Error(labels.repForm.errors.invalidFileType);
    }
    throw new Error(labels.repForm.errors.emptyFile);
  }

  const buffer = await file.arrayBuffer();
  return {
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'application/pdf',
    bytes: new Uint8Array(buffer),
  };
}

export function useRepForms() {
  const container = useAppContainer();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadCoursesForClass = useCallback(
    async (classId: string, userId: string): Promise<CourseListItemDto[]> => {
      return container.usecases.listCourses.execute({ classId, userId });
    },
    [container],
  );

  const loadCourseWeeks = useCallback(
    async (courseId: string, userId: string): Promise<CourseWeeksDto> => {
      return container.usecases.getCourseWeeks.execute({ courseId, userId });
    },
    [container],
  );

  const loadCourseAnnouncements = useCallback(
    async (courseId: string): Promise<Announcement[]> => {
      return container.usecases.listAnnouncements.execute({ courseId });
    },
    [container],
  );

  const loadMaterialForEdit = useCallback(
    async (materialId: string): Promise<MaterialDetailDto> => {
      return container.usecases.getMaterial.execute({ materialId });
    },
    [container],
  );

  const saveCourse = useCallback(
    async (params: {
      actor: User;
      classId: string;
      code: string;
      name: string;
      description: string;
      editId?: string;
    }): Promise<Course> => {
      setIsSaving(true);
      setError(null);
      try {
        if (params.editId) {
          return await container.usecases.updateCourse.execute({
            actor: params.actor,
            courseId: params.editId,
            code: params.code,
            name: params.name,
            description: params.description,
          });
        }
        return await container.usecases.createCourse.execute({
          actor: params.actor,
          classId: params.classId,
          code: params.code,
          name: params.name,
          description: params.description,
        });
      } catch (err) {
        const message = mapRepError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [container],
  );

  const saveWeek = useCallback(
    async (params: {
      actor: User;
      courseId: string;
      weekNumber: number;
      title: string;
      summary: string;
      editId?: string;
    }): Promise<Week> => {
      setIsSaving(true);
      setError(null);
      try {
        if (params.editId) {
          return await container.usecases.updateWeek.execute({
            actor: params.actor,
            weekId: params.editId,
            weekNumber: params.weekNumber,
            title: params.title,
            summary: params.summary,
          });
        }
        return await container.usecases.createWeek.execute({
          actor: params.actor,
          courseId: params.courseId,
          weekNumber: params.weekNumber,
          title: params.title,
          summary: params.summary,
        });
      } catch (err) {
        const message = mapRepError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [container],
  );

  const saveMaterial = useCallback(
    async (params: SaveMaterialFormInput): Promise<Material> => {
      setIsSaving(true);
      setError(null);
      try {
        const uploadInput = params.file
          ? await fileToUploadInput(params.file)
          : null;
        const normalizedUrl = params.externalUrl.trim().length > 0
          ? params.externalUrl.trim()
          : null;

        if (params.editId) {
          return await container.usecases.updateMaterial.execute({
            actor: params.actor,
            materialId: params.editId,
            weekId: params.weekId,
            title: params.title,
            description: params.description,
            externalUrl: normalizedUrl,
            file: uploadInput,
            removeAttachment: params.removeAttachment,
          });
        }
        return await container.usecases.createMaterial.execute({
          actor: params.actor,
          courseId: params.courseId,
          weekId: params.weekId,
          title: params.title,
          description: params.description,
          externalUrl: normalizedUrl,
          file: uploadInput,
        });
      } catch (err) {
        const message = mapRepError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [container],
  );

  const saveDeadline = useCallback(
    async (params: {
      actor: User;
      courseId: string;
      weekId: string | null;
      title: string;
      description: string;
      dueAt: string;
      editId?: string;
    }): Promise<Deadline> => {
      setIsSaving(true);
      setError(null);
      try {
        if (params.editId) {
          return await container.usecases.updateDeadline.execute({
            actor: params.actor,
            deadlineId: params.editId,
            weekId: params.weekId,
            title: params.title,
            description: params.description,
            dueAt: params.dueAt,
          });
        }
        return await container.usecases.createDeadline.execute({
          actor: params.actor,
          courseId: params.courseId,
          weekId: params.weekId,
          title: params.title,
          description: params.description,
          dueAt: params.dueAt,
        });
      } catch (err) {
        const message = mapRepError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [container],
  );

  const saveAnnouncement = useCallback(
    async (params: {
      actor: User;
      courseId: string;
      title: string;
      body: string;
      editId?: string;
    }): Promise<Announcement> => {
      setIsSaving(true);
      setError(null);
      try {
        if (params.editId) {
          return await container.usecases.updateAnnouncement.execute({
            actor: params.actor,
            announcementId: params.editId,
            title: params.title,
            body: params.body,
          });
        }
        return await container.usecases.createAnnouncement.execute({
          actor: params.actor,
          courseId: params.courseId,
          title: params.title,
          body: params.body,
        });
      } catch (err) {
        const message = mapRepError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [container],
  );

  return {
    isSaving,
    error,
    clearError,
    setError,
    loadCoursesForClass,
    loadCourseWeeks,
    loadCourseAnnouncements,
    loadMaterialForEdit,
    saveCourse,
    saveWeek,
    saveMaterial,
    saveDeadline,
    saveAnnouncement,
  };
}
