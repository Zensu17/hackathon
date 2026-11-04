import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AppError,
  isAppError,
  type AppErrorCode,
} from '../../application/errors/AppError';
import type {
  Announcement,
  Class,
  Course,
  CourseFollow,
  Deadline,
  Material,
  MaterialUploadInput,
  User,
  Week,
} from '../../domain/entities';
import type {
  ClassOnboardingResult,
  CreateAnnouncementRecordInput,
  CreateCourseRecordInput,
  CreateDeadlineRecordInput,
  CreateMaterialRecordInput,
  CreateWeekRecordInput,
  SignInCredentials,
  SignUpCredentials,
  UpdateAnnouncementRecordInput,
  UpdateCourseRecordInput,
  UpdateDeadlineRecordInput,
  UpdateMaterialRecordInput,
  UpdateWeekRecordInput,
} from '../../domain/repositories';
import { validateMaterialFile } from '../../domain/rules';
import {
  remoteClassToDomain,
  type RemoteClassRow,
} from '../mappers/classMapper';
import {
  remoteAnnouncementToDomain,
  remoteDeadlineToDomain,
  remoteMaterialToDomain,
  remoteWeekToDomain,
  type RemoteAnnouncementRow,
  type RemoteDeadlineRow,
  type RemoteMaterialRow,
  type RemoteWeekRow,
} from '../mappers/contentMapper';
import {
  remoteCourseFollowToDomain,
  remoteCourseToDomain,
  type RemoteCourseFollowRow,
  type RemoteCourseRow,
} from '../mappers/courseMapper';
import {
  remoteProfileToDomain,
  type RemoteProfileRow,
} from '../mappers/userMapper';

interface OnboardingRpcPayload {
  class: RemoteClassRow;
  profile: RemoteProfileRow;
}

export interface HydratedCoursesContent {
  weeks: Week[];
  materials: Material[];
  deadlines: Deadline[];
  announcements: Announcement[];
}

function sanitizePathSegment(segment: string): string {
  const cleaned = segment
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_');
  if (cleaned.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Invalid storage path segment.');
  }
  return cleaned;
}

// Sanitize PDF filenames before building storage keys to block path traversal.
export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? 'attachment.pdf';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_');
  if (cleaned.length === 0 || !cleaned.toLowerCase().endsWith('.pdf')) {
    return `${cleaned || 'attachment'}.pdf`;
  }
  return cleaned;
}

function mapRemoteError(
  error: unknown,
  fallbackCode: AppErrorCode = 'STORAGE_ERROR',
): AppError {
  if (isAppError(error)) {
    return error;
  }

  const record =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : {};
  const code = record.code ?? '';
  const message =
    typeof record.message === 'string' && record.message.length > 0
      ? record.message
      : error instanceof Error
        ? error.message
        : 'Remote storage request failed.';

  if (code === '23505') {
    return new AppError('DUPLICATE_JOIN_CODE', message);
  }
  if (code === 'P0002' || code === 'PGRST116') {
    return new AppError('NOT_FOUND', message);
  }
  if (code === '42501') {
    return new AppError('FORBIDDEN_ROLE', message);
  }

  return new AppError(fallbackCode, message);
}

export class SupabaseRemoteDataSource {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(input: SignUpCredentials): Promise<User> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName,
        },
      },
    });

    if (error || !data.user) {
      throw mapRemoteError(error ?? new Error('Account creation failed.'), 'AUTH_ERROR');
    }

    const profile = await this.fetchProfileById(data.user.id);
    if (profile) {
      return profile;
    }

    const now = new Date().toISOString();
    return {
      id: data.user.id,
      email: (data.user.email ?? input.email).toLowerCase(),
      displayName: input.displayName,
      classId: null,
      role: null,
      createdAt: data.user.created_at ?? now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  async signIn(input: SignInCredentials): Promise<User> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      throw mapRemoteError(error ?? new Error('Sign-in failed.'), 'AUTH_ERROR');
    }

    const profile = await this.fetchProfileById(data.user.id);
    if (!profile) {
      throw new AppError('AUTH_ERROR', 'User profile could not be loaded.');
    }
    return profile;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw mapRemoteError(error, 'AUTH_ERROR');
    }
  }

  async getSessionUserId(): Promise<string | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      return null;
    }
    return data.session?.user.id ?? null;
  }

  async fetchProfileById(userId: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw mapRemoteError(error, 'AUTH_ERROR');
    }
    if (!data) {
      return null;
    }
    return remoteProfileToDomain(data as RemoteProfileRow);
  }

  async fetchClassById(classId: string): Promise<Class | null> {
    const { data, error } = await this.client
      .from('classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    if (error) {
      throw mapRemoteError(error);
    }
    if (!data) {
      return null;
    }
    return remoteClassToDomain(data as RemoteClassRow);
  }

  async createClassAsRep(
    name: string,
    joinCode: string,
  ): Promise<ClassOnboardingResult> {
    const { data, error } = await this.client.rpc('create_class_as_rep', {
      p_name: name,
      p_join_code: joinCode,
    });

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not create class.'));
    }

    const payload = data as OnboardingRpcPayload;
    return {
      currentClass: remoteClassToDomain(payload.class),
      user: remoteProfileToDomain(payload.profile),
    };
  }

  async joinClassByCode(joinCode: string): Promise<ClassOnboardingResult> {
    const { data, error } = await this.client.rpc('join_class_by_code', {
      p_join_code: joinCode,
    });

    if (error || !data) {
      throw mapRemoteError(
        error ?? new Error('No class matched that join code.'),
        'NOT_FOUND',
      );
    }

    const payload = data as OnboardingRpcPayload;
    return {
      currentClass: remoteClassToDomain(payload.class),
      user: remoteProfileToDomain(payload.profile),
    };
  }

  async fetchCoursesByClassId(classId: string): Promise<Course[]> {
    const { data, error } = await this.client
      .from('courses')
      .select('*')
      .eq('class_id', classId);

    if (error) {
      throw mapRemoteError(error);
    }
    return ((data ?? []) as RemoteCourseRow[]).map(remoteCourseToDomain);
  }

  async fetchCourseFollowsByUserId(userId: string): Promise<CourseFollow[]> {
    const { data, error } = await this.client
      .from('course_follows')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw mapRemoteError(error);
    }
    return ((data ?? []) as RemoteCourseFollowRow[]).map(
      remoteCourseFollowToDomain,
    );
  }

  async insertCourseFollow(
    userId: string,
    courseId: string,
  ): Promise<CourseFollow> {
    const { data, error } = await this.client
      .from('course_follows')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
        },
        { onConflict: 'user_id,course_id' },
      )
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not follow course.'));
    }
    return remoteCourseFollowToDomain(data as RemoteCourseFollowRow);
  }

  async deleteCourseFollow(userId: string, courseId: string): Promise<void> {
    const { error } = await this.client
      .from('course_follows')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (error) {
      throw mapRemoteError(error);
    }
  }

  async createCourse(input: CreateCourseRecordInput): Promise<Course> {
    const { data, error } = await this.client
      .from('courses')
      .insert({
        class_id: input.classId,
        code: input.code,
        name: input.name,
        description: input.description,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not create course.'));
    }
    return remoteCourseToDomain(data as RemoteCourseRow);
  }

  async updateCourse(
    id: string,
    input: UpdateCourseRecordInput,
  ): Promise<Course> {
    const patch: Record<string, unknown> = {
      code: input.code,
      name: input.name,
      description: input.description,
      updated_at: new Date().toISOString(),
    };
    if (input.deletedAt !== undefined) {
      patch.deleted_at = input.deletedAt;
    }

    const { data, error } = await this.client
      .from('courses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not update course.'));
    }
    return remoteCourseToDomain(data as RemoteCourseRow);
  }

  async createWeek(input: CreateWeekRecordInput): Promise<Week> {
    const { data, error } = await this.client
      .from('weeks')
      .insert({
        course_id: input.courseId,
        week_number: input.weekNumber,
        title: input.title,
        summary: input.summary,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not create week.'));
    }
    return remoteWeekToDomain(data as RemoteWeekRow);
  }

  async updateWeek(id: string, input: UpdateWeekRecordInput): Promise<Week> {
    const patch: Record<string, unknown> = {
      week_number: input.weekNumber,
      title: input.title,
      summary: input.summary,
      updated_at: new Date().toISOString(),
    };
    if (input.deletedAt !== undefined) {
      patch.deleted_at = input.deletedAt;
    }

    const { data, error } = await this.client
      .from('weeks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not update week.'));
    }
    return remoteWeekToDomain(data as RemoteWeekRow);
  }

  async uploadMaterialPdf(params: {
    classId: string;
    courseId: string;
    materialId: string;
    file: MaterialUploadInput;
  }): Promise<{ storagePath: string; remoteUrl: string | null }> {
    const check = validateMaterialFile(params.file);
    if (!check.valid) {
      if (check.reason === 'file_too_large') {
        throw new AppError(
          'FILE_TOO_LARGE',
          'PDF attachment exceeds the 5 MB limit.',
        );
      }
      throw new AppError(
        'INVALID_FILE_TYPE',
        'Only PDF files (.pdf) up to 5 MB are accepted.',
      );
    }

    const safeClassId = sanitizePathSegment(params.classId);
    const safeCourseId = sanitizePathSegment(params.courseId);
    const safeMaterialId = sanitizePathSegment(params.materialId);
    const safeFileName = sanitizeStorageFileName(params.file.name);
    const storagePath = `${safeClassId}/${safeCourseId}/${safeMaterialId}/${safeFileName}`;

    const { error: uploadError } = await this.client.storage
      .from('materials')
      .upload(storagePath, params.file.bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw mapRemoteError(uploadError);
    }

    const remoteUrl = await this.getSignedMaterialUrl(storagePath);
    return { storagePath, remoteUrl };
  }

  async getSignedMaterialUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from('materials')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  }

  async createMaterial(params: {
    id: string;
    classId: string;
    input: CreateMaterialRecordInput;
  }): Promise<Material> {
    let attachmentName: string | null = null;
    let attachmentSizeBytes: number | null = null;
    let attachmentMimeType: string | null = null;
    let attachmentStoragePath: string | null = null;
    let remoteUrl: string | null = null;

    if (params.input.file) {
      const uploaded = await this.uploadMaterialPdf({
        classId: params.classId,
        courseId: params.input.courseId,
        materialId: params.id,
        file: params.input.file,
      });
      attachmentName = sanitizeStorageFileName(params.input.file.name);
      attachmentSizeBytes = params.input.file.sizeBytes;
      attachmentMimeType = 'application/pdf';
      attachmentStoragePath = uploaded.storagePath;
      remoteUrl = uploaded.remoteUrl;
    }

    const { data, error } = await this.client
      .from('materials')
      .insert({
        id: params.id,
        course_id: params.input.courseId,
        week_id: params.input.weekId,
        title: params.input.title,
        description: params.input.description,
        external_url: params.input.externalUrl,
        attachment_name: attachmentName,
        attachment_size_bytes: attachmentSizeBytes,
        attachment_mime_type: attachmentMimeType,
        attachment_storage_path: attachmentStoragePath,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not create material.'));
    }

    return remoteMaterialToDomain(data as RemoteMaterialRow, { remoteUrl });
  }

  async updateMaterial(params: {
    id: string;
    classId: string;
    existing: Material;
    input: UpdateMaterialRecordInput;
  }): Promise<Material> {
    let attachmentName = params.existing.attachment?.name ?? null;
    let attachmentSizeBytes = params.existing.attachment?.sizeBytes ?? null;
    let attachmentMimeType = params.existing.attachment?.mimeType ?? null;
    let attachmentStoragePath = params.existing.attachment?.storagePath ?? null;
    let remoteUrl = params.existing.attachment?.remoteUrl ?? null;

    if (params.input.removeAttachment) {
      attachmentName = null;
      attachmentSizeBytes = null;
      attachmentMimeType = null;
      attachmentStoragePath = null;
      remoteUrl = null;
    }

    if (params.input.file) {
      const uploaded = await this.uploadMaterialPdf({
        classId: params.classId,
        courseId: params.existing.courseId,
        materialId: params.id,
        file: params.input.file,
      });
      attachmentName = sanitizeStorageFileName(params.input.file.name);
      attachmentSizeBytes = params.input.file.sizeBytes;
      attachmentMimeType = 'application/pdf';
      attachmentStoragePath = uploaded.storagePath;
      remoteUrl = uploaded.remoteUrl;
    }

    const patch: Record<string, unknown> = {
      week_id: params.input.weekId,
      title: params.input.title,
      description: params.input.description,
      external_url: params.input.externalUrl,
      attachment_name: attachmentName,
      attachment_size_bytes: attachmentSizeBytes,
      attachment_mime_type: attachmentMimeType,
      attachment_storage_path: attachmentStoragePath,
      updated_at: new Date().toISOString(),
    };
    if (params.input.deletedAt !== undefined) {
      patch.deleted_at = params.input.deletedAt;
    }

    const { data, error } = await this.client
      .from('materials')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not update material.'));
    }

    return remoteMaterialToDomain(data as RemoteMaterialRow, {
      remoteUrl,
      isAvailableOffline: params.existing.isAvailableOffline,
    });
  }

  async createDeadline(input: CreateDeadlineRecordInput): Promise<Deadline> {
    const { data, error } = await this.client
      .from('deadlines')
      .insert({
        course_id: input.courseId,
        week_id: input.weekId,
        title: input.title,
        description: input.description,
        due_at: input.dueAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not create deadline.'));
    }
    return remoteDeadlineToDomain(data as RemoteDeadlineRow);
  }

  async updateDeadline(
    id: string,
    input: UpdateDeadlineRecordInput,
  ): Promise<Deadline> {
    const patch: Record<string, unknown> = {
      week_id: input.weekId,
      title: input.title,
      description: input.description,
      due_at: input.dueAt,
      updated_at: new Date().toISOString(),
    };
    if (input.deletedAt !== undefined) {
      patch.deleted_at = input.deletedAt;
    }

    const { data, error } = await this.client
      .from('deadlines')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(error ?? new Error('Could not update deadline.'));
    }
    return remoteDeadlineToDomain(data as RemoteDeadlineRow);
  }

  async createAnnouncement(
    input: CreateAnnouncementRecordInput,
  ): Promise<Announcement> {
    const payload: Record<string, unknown> = {
      course_id: input.courseId,
      title: input.title,
      body: input.body,
    };
    if (input.postedAt) {
      payload.posted_at = input.postedAt;
    }

    const { data, error } = await this.client
      .from('announcements')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(
        error ?? new Error('Could not create announcement.'),
      );
    }
    return remoteAnnouncementToDomain(data as RemoteAnnouncementRow);
  }

  async updateAnnouncement(
    id: string,
    input: UpdateAnnouncementRecordInput,
  ): Promise<Announcement> {
    const patch: Record<string, unknown> = {
      title: input.title,
      body: input.body,
      updated_at: new Date().toISOString(),
    };
    if (input.postedAt !== undefined) {
      patch.posted_at = input.postedAt;
    }
    if (input.deletedAt !== undefined) {
      patch.deleted_at = input.deletedAt;
    }

    const { data, error } = await this.client
      .from('announcements')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw mapRemoteError(
        error ?? new Error('Could not update announcement.'),
      );
    }
    return remoteAnnouncementToDomain(data as RemoteAnnouncementRow);
  }

  async fetchFollowedCoursesContent(
    courseIds: readonly string[],
  ): Promise<HydratedCoursesContent> {
    if (courseIds.length === 0) {
      return {
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      };
    }

    const ids = [...courseIds];
    const [weeksRes, materialsRes, deadlinesRes, announcementsRes] =
      await Promise.all([
        this.client.from('weeks').select('*').in('course_id', ids),
        this.client.from('materials').select('*').in('course_id', ids),
        this.client.from('deadlines').select('*').in('course_id', ids),
        this.client.from('announcements').select('*').in('course_id', ids),
      ]);

    const firstError =
      weeksRes.error ??
      materialsRes.error ??
      deadlinesRes.error ??
      announcementsRes.error;
    if (firstError) {
      throw mapRemoteError(firstError);
    }

    const rawMaterials = (materialsRes.data ?? []) as RemoteMaterialRow[];
    const materials = await Promise.all(
      rawMaterials.map(async (row) => {
        const remoteUrl = row.attachment_storage_path
          ? await this.getSignedMaterialUrl(row.attachment_storage_path)
          : null;
        return remoteMaterialToDomain(row, { remoteUrl });
      }),
    );

    return {
      weeks: ((weeksRes.data ?? []) as RemoteWeekRow[]).map(remoteWeekToDomain),
      materials,
      deadlines: ((deadlinesRes.data ?? []) as RemoteDeadlineRow[]).map(
        remoteDeadlineToDomain,
      ),
      announcements: (
        (announcementsRes.data ?? []) as RemoteAnnouncementRow[]
      ).map(remoteAnnouncementToDomain),
    };
  }
}
