import type { Deadline, Material } from '../../../domain/entities';
import type {
  CourseRepository,
  DeadlineRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import {
  isDueSoon,
  isOverdue,
  sortDeadlines,
} from '../../../domain/rules';
import type {
  AnnotatedDeadlineDto,
  CourseWeeksDto,
  GetCourseWeeksInput,
  WeekWithContentDto,
} from '../../dto/ContentDto';
import { AppError } from '../../errors/AppError';

function sortMaterials(items: readonly Material[]): Material[] {
  return [...items].sort((a, b) => {
    const aMs = Date.parse(a.createdAt);
    const bMs = Date.parse(b.createdAt);
    if (!Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs !== bMs) {
      return aMs - bMs;
    }
    return a.id.localeCompare(b.id);
  });
}

function annotateDeadlines(
  items: readonly Deadline[],
  nowIso: string,
): AnnotatedDeadlineDto[] {
  return sortDeadlines(items).map((deadline) => ({
    ...deadline,
    isOverdue: isOverdue(deadline.dueAt, nowIso),
    isDueSoon: isDueSoon(deadline.dueAt, nowIso),
  }));
}

export class GetCourseWeeks {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly deadlineRepository: DeadlineRepository,
    private readonly nowProvider: () => string = () => new Date().toISOString(),
  ) {}

  async execute(input: GetCourseWeeksInput): Promise<CourseWeeksDto> {
    const courseId = input.courseId.trim();
    if (courseId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Course ID is required.');
    }

    const course = await this.courseRepository.getById(courseId);
    if (!course || course.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    const userId = input.userId?.trim() ?? '';
    const [rawWeeks, rawMaterials, rawDeadlines, followedIds] = await Promise.all([
      this.weekRepository.listByCourseId(courseId),
      this.materialRepository.listByCourseId(courseId),
      this.deadlineRepository.listByCourseId(courseId),
      userId.length > 0
        ? this.courseRepository.listFollowedCourseIds(userId)
        : Promise.resolve<string[]>([]),
    ]);

    const nowIso = this.nowProvider();
    const activeWeeks = rawWeeks
      .filter((week) => week.deletedAt === null)
      .sort((a, b) => {
        if (a.weekNumber !== b.weekNumber) {
          return a.weekNumber - b.weekNumber;
        }
        return a.id.localeCompare(b.id);
      });

    const activeMaterials = rawMaterials.filter((m) => m.deletedAt === null);
    const activeDeadlines = rawDeadlines.filter((d) => d.deletedAt === null);

    const materialsByWeek = new Map<string, Material[]>();
    for (const material of activeMaterials) {
      const bucket = materialsByWeek.get(material.weekId) ?? [];
      bucket.push(material);
      materialsByWeek.set(material.weekId, bucket);
    }

    const deadlinesByWeek = new Map<string, Deadline[]>();
    const unassignedRaw: Deadline[] = [];
    for (const deadline of activeDeadlines) {
      if (deadline.weekId === null) {
        unassignedRaw.push(deadline);
      } else {
        const bucket = deadlinesByWeek.get(deadline.weekId) ?? [];
        bucket.push(deadline);
        deadlinesByWeek.set(deadline.weekId, bucket);
      }
    }

    const weeks: WeekWithContentDto[] = activeWeeks.map((week) => ({
      ...week,
      materials: sortMaterials(materialsByWeek.get(week.id) ?? []),
      deadlines: annotateDeadlines(deadlinesByWeek.get(week.id) ?? [], nowIso),
    }));

    return {
      course,
      isFollowed: followedIds.includes(course.id),
      weeks,
      unassignedDeadlines: annotateDeadlines(unassignedRaw, nowIso),
    };
  }
}
