import type {
  CourseRepository,
  DeadlineRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import { isOverdue } from '../../../domain/rules';
import type {
  CourseOfflineSummaryDto,
  GetOfflineStudyOverviewInput,
  OfflineStudyOverviewDto,
} from '../../dto';
import { AppError } from '../../errors/AppError';

export class GetOfflineStudyOverview {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly deadlineRepository: DeadlineRepository,
  ) {}

  async execute(
    input: GetOfflineStudyOverviewInput,
  ): Promise<OfflineStudyOverviewDto> {
    const userId = input.userId.trim();
    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    const nowIso = (input.now ?? new Date()).toISOString();
    const followedCourseIds =
      await this.courseRepository.listFollowedCourseIds(userId);
    if (followedCourseIds.length === 0) {
      return {
        followedCourseCount: 0,
        totalMaterials: 0,
        totalPdfMaterials: 0,
        downloadedPdfCount: 0,
        courses: [],
      };
    }

    const courses = (
      await Promise.all(
        followedCourseIds.map((id) => this.courseRepository.getById(id)),
      )
    ).filter(
      (course): course is NonNullable<typeof course> =>
        course !== null && course.deletedAt === null,
    );

    const summaries: CourseOfflineSummaryDto[] = [];
    let totalMaterials = 0;
    let totalPdfMaterials = 0;
    let downloadedPdfCount = 0;

    for (const course of courses) {
      const [weeks, materials, deadlines] = await Promise.all([
        this.weekRepository.listByCourseId(course.id),
        this.materialRepository.listByCourseId(course.id),
        this.deadlineRepository.listByCourseId(course.id),
      ]);

      const activeWeeks = weeks.filter((w) => w.deletedAt === null);
      const activeMaterials = materials.filter((m) => m.deletedAt === null);
      const pdfMaterials = activeMaterials.filter((m) => m.attachment !== null);
      const downloadedPdfs = pdfMaterials.filter((m) => m.isAvailableOffline);
      const upcomingDeadlines = deadlines.filter(
        (d) => d.deletedAt === null && !isOverdue(d.dueAt, nowIso),
      );

      totalMaterials += activeMaterials.length;
      totalPdfMaterials += pdfMaterials.length;
      downloadedPdfCount += downloadedPdfs.length;

      summaries.push({
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        weekCount: activeWeeks.length,
        materialCount: activeMaterials.length,
        pdfCount: pdfMaterials.length,
        downloadedPdfCount: downloadedPdfs.length,
        upcomingDeadlineCount: upcomingDeadlines.length,
      });
    }

    summaries.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    return {
      followedCourseCount: summaries.length,
      totalMaterials,
      totalPdfMaterials,
      downloadedPdfCount,
      courses: summaries,
    };
  }
}
