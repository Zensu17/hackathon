import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientLoader } from './supabaseClient';
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
  Note,
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
  remoteNoteToDomain,
  remoteWeekToDomain,
  type RemoteAnnouncementRow,
  type RemoteDeadlineRow,
  type RemoteMaterialRow,
  type RemoteNoteRow,
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

function nimToHiddenAuthEmail(nim: string): string {
  return `${nim.trim().toLowerCase()}@nim.litelearn.local`;
}

export class SupabaseRemoteDataSource {
  constructor(
    private readonly clientSource: SupabaseClient | SupabaseClientLoader,
  ) {}

  private async getClient(): Promise<SupabaseClient> {
    if (typeof this.clientSource === 'function') {
      return this.clientSource();
    }
    return this.clientSource;
  }

  async signUp(input: SignUpCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    const hiddenEmail = nimToHiddenAuthEmail(normalizedNim);
    const { data, error } = await (await this.getClient()).auth.signUp({
      email: hiddenEmail,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName,
          nim: normalizedNim,
        },
      },
    });

    if (error || !data.user) {
      if (
        error?.message?.toLowerCase().includes('already registered') ||
        error?.message?.toLowerCase().includes('already exists')
      ) {
        throw new AppError(
          'DUPLICATE_NIM',
          'This NIM is already registered. Try signing in.',
        );
      }
      throw mapRemoteError(error ?? new Error('Account creation failed.'), 'AUTH_ERROR');
    }

    if (input.classCode && input.classCode.trim().length > 0) {
      const onboarding = await this.joinClassByCode(input.classCode);
      return onboarding.user;
    }

    const profile = await this.fetchProfileById(data.user.id);
    if (profile) {
      return profile;
    }

    const now = new Date().toISOString();
    return {
      id: data.user.id,
      nim: normalizedNim,
      displayName: input.displayName,
      classId: null,
      role: null,
      createdAt: data.user.created_at ?? now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  async signIn(input: SignInCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    const hiddenEmail = nimToHiddenAuthEmail(normalizedNim);
    const { data, error } = await (await this.getClient()).auth.signInWithPassword({
      email: hiddenEmail,
      password: input.password,
    });

    if (error || !data.user) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }

    const profile = await this.fetchProfileById(data.user.id);
    if (!profile) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }
    return profile;
  }

  async signOut(): Promise<void> {
    const { error } = await (await this.getClient()).auth.signOut();
    if (error) {
      throw mapRemoteError(error, 'AUTH_ERROR');
    }
  }

  async getSessionUserId(): Promise<string | null> {
    const { data, error } = await (await this.getClient()).auth.getSession();
    if (error) {
      return null;
    }
    return data.session?.user.id ?? null;
  }

  async fetchProfileById(userId: string): Promise<User | null> {
    const { data, error } = await (await this.getClient())
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
    const { data, error } = await (await this.getClient())
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
    const { data, error } = await (await this.getClient()).rpc('create_class_as_rep', {
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
    const { data, error } = await (await this.getClient()).rpc('join_class_by_code', {
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

  async fetchCoursesByClassId(
    classId: string,
    sinceIso?: string | null,
  ): Promise<Course[]> {
    let query = (await this.getClient()).from('courses').select('*').eq('class_id', classId);
    if (sinceIso) {
      query = query.gt('updated_at', sinceIso);
    }
    const { data, error } = await query;

    if (error) {
      throw mapRemoteError(error);
    }
    return ((data ?? []) as RemoteCourseRow[]).map(remoteCourseToDomain);
  }

  async fetchCourseFollowsByUserId(userId: string): Promise<CourseFollow[]> {
    const { data, error } = await (await this.getClient())
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
    const { data, error } = await (await this.getClient())
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
    const { error } = await (await this.getClient())
      .from('course_follows')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (error) {
      throw mapRemoteError(error);
    }
  }

  async createCourse(input: CreateCourseRecordInput): Promise<Course> {
    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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
    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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

    const { error: uploadError } = await (await this.getClient()).storage
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
    const { data, error } = await (await this.getClient()).storage
      .from('materials')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  }

  async deleteMaterialPdf(storagePath: string): Promise<void> {
    const { error } = await (await this.getClient()).storage
      .from('materials')
      .remove([storagePath]);
    if (error) {
      console.warn('Could not delete superseded PDF from storage:', error.message);
    }
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

    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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
    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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

    const { data, error } = await (await this.getClient())
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
    sinceIso?: string | null,
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
    let weeksQuery = (await this.getClient()).from('weeks').select('*').in('course_id', ids);
    let materialsQuery = (await this.getClient()).from('materials').select('*').in('course_id', ids);
    let deadlinesQuery = (await this.getClient()).from('deadlines').select('*').in('course_id', ids);
    let announcementsQuery = (await this.getClient())
      .from('announcements')
      .select('*')
      .in('course_id', ids);

    if (sinceIso) {
      weeksQuery = weeksQuery.gt('updated_at', sinceIso);
      materialsQuery = materialsQuery.gt('updated_at', sinceIso);
      deadlinesQuery = deadlinesQuery.gt('updated_at', sinceIso);
      announcementsQuery = announcementsQuery.gt('updated_at', sinceIso);
    }

    const [weeksRes, materialsRes, deadlinesRes, announcementsRes] =
      await Promise.all([
        weeksQuery,
        materialsQuery,
        deadlinesQuery,
        announcementsQuery,
      ]);

    const firstError =
      weeksRes.error ??
      materialsRes.error ??
      deadlinesRes.error ??
      announcementsRes.error;
    if (firstError) {
      throw mapRemoteError(firstError);
    }

    // Signed URLs are minted on demand during download to avoid N+1 requests and expired cached links.
    const rawMaterials = (materialsRes.data ?? []) as RemoteMaterialRow[];
    const materials = rawMaterials.map((row) =>
      remoteMaterialToDomain(row, { remoteUrl: null }),
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

  async fetchUserNotes(
    userId: string,
    sinceIso?: string | null,
  ): Promise<Note[]> {
    let query = (await this.getClient()).from('notes').select('*').eq('user_id', userId);
    if (sinceIso) {
      query = query.gt('updated_at', sinceIso);
    }
    const { data, error } = await query;

    if (error) {
      throw mapRemoteError(error);
    }
    return ((data ?? []) as RemoteNoteRow[]).map(remoteNoteToDomain);
  }

  async upsertNote(input: {
    userId: string;
    materialId: string;
    body: string;
  }): Promise<void> {
    const { error } = await (await this.getClient()).from('notes').upsert(
      {
        user_id: input.userId,
        material_id: input.materialId,
        body: input.body,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      { onConflict: 'user_id,material_id' },
    );

    if (error) {
      throw mapRemoteError(error);
    }
  }

  async upsertCoursePayload(payload: Record<string, unknown>): Promise<void> {
    const { error } = await (await this.getClient()).from('courses').upsert({
      id: payload.id,
      class_id: payload.classId,
      code: payload.code,
      name: payload.name,
      description: payload.description ?? '',
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      deleted_at: payload.deletedAt ?? null,
    });
    if (error) {
      throw mapRemoteError(error);
    }
  }

  async upsertWeekPayload(payload: Record<string, unknown>): Promise<void> {
    const { error } = await (await this.getClient()).from('weeks').upsert({
      id: payload.id,
      course_id: payload.courseId,
      week_number: payload.weekNumber,
      title: payload.title,
      summary: payload.summary ?? '',
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      deleted_at: payload.deletedAt ?? null,
    });
    if (error) {
      throw mapRemoteError(error);
    }
  }

  async upsertDeadlinePayload(payload: Record<string, unknown>): Promise<void> {
    const { error } = await (await this.getClient()).from('deadlines').upsert({
      id: payload.id,
      course_id: payload.courseId,
      week_id: payload.weekId ?? null,
      title: payload.title,
      description: payload.description ?? '',
      due_at: payload.dueAt,
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      deleted_at: payload.deletedAt ?? null,
    });
    if (error) {
      throw mapRemoteError(error);
    }
  }

  async upsertAnnouncementPayload(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await (await this.getClient()).from('announcements').upsert({
      id: payload.id,
      course_id: payload.courseId,
      title: payload.title,
      body: payload.body,
      posted_at: payload.postedAt ?? new Date().toISOString(),
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      deleted_at: payload.deletedAt ?? null,
    });
    if (error) {
      throw mapRemoteError(error);
    }
  }

  async upsertMaterialPayload(payload: Record<string, unknown>): Promise<void> {
    const row: Record<string, unknown> = {
      id: payload.id,
      course_id: payload.courseId,
      week_id: payload.weekId,
      title: payload.title,
      description: payload.description ?? '',
      external_url: payload.externalUrl ?? null,
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      deleted_at: payload.deletedAt ?? null,
    };

    if (payload.removeAttachment === true) {
      row.attachment_name = null;
      row.attachment_size_bytes = null;
      row.attachment_mime_type = null;
      row.attachment_storage_path = null;
    } else if (payload.attachmentStoragePath) {
      row.attachment_name = payload.attachmentName ?? null;
      row.attachment_size_bytes = payload.attachmentSizeBytes ?? null;
      row.attachment_mime_type = payload.attachmentMimeType ?? 'application/pdf';
      row.attachment_storage_path = payload.attachmentStoragePath;
    }

    const { error } = await (await this.getClient()).from('materials').upsert(row);
    if (error) {
      throw mapRemoteError(error);
    }
  }
}
