import type {
  Announcement,
  Course,
  Deadline,
  Material,
  Week,
} from '../../../domain/entities';
import type {
  AnnouncementRepository,
  CourseRepository,
  DeadlineRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type {
  SearchWorkspaceInput,
  WorkspaceSearchResultDto,
} from '../../dto';
import { AppError } from '../../errors/AppError';

function includesQuery(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

export class SearchWorkspace {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly deadlineRepository: DeadlineRepository,
    private readonly announcementRepository: AnnouncementRepository,
  ) {}

  async execute(input: SearchWorkspaceInput): Promise<WorkspaceSearchResultDto> {
    const classId = input.classId.trim();
    const userId = input.userId.trim();
    const query = input.query.trim();

    if (classId.length === 0 || userId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Class ID and user ID are required for search.',
      );
    }

    if (query.length === 0) {
      return {
        query: '',
        courses: [],
        materials: [],
        deadlines: [],
        announcements: [],
        totalCount: 0,
      };
    }

    const needle = query.toLowerCase();
    const [classCourses, followedIds] = await Promise.all([
      this.courseRepository.listByClassId(classId),
      this.courseRepository.listFollowedCourseIds(userId),
    ]);

    const activeCourses = classCourses.filter((c) => c.deletedAt === null);
    const courseById = new Map<string, Course>(
      activeCourses.map((course) => [course.id, course]),
    );

    const matchedCourses = activeCourses
      .filter(
        (course) =>
          includesQuery(course.code, needle) ||
          includesQuery(course.name, needle) ||
          includesQuery(course.description, needle),
      )
      .sort((a, b) => a.code.localeCompare(b.code));

    const followedActiveIds = followedIds.filter((id) => courseById.has(id));
    if (followedActiveIds.length === 0) {
      return {
        query,
        courses: matchedCourses,
        materials: [],
        deadlines: [],
        announcements: [],
        totalCount: matchedCourses.length,
      };
    }

    const [weekLists, materialLists, allDeadlines, announcementLists] =
      await Promise.all([
        Promise.all(
          followedActiveIds.map((id) => this.weekRepository.listByCourseId(id)),
        ),
        Promise.all(
          followedActiveIds.map((id) =>
            this.materialRepository.listByCourseId(id),
          ),
        ),
        this.deadlineRepository.listByCourseIds(followedActiveIds),
        Promise.all(
          followedActiveIds.map((id) =>
            this.announcementRepository.listByCourseId(id),
          ),
        ),
      ]);

    const weekById = new Map<string, Week>();
    for (const week of weekLists.flat()) {
      if (week.deletedAt === null) {
        weekById.set(week.id, week);
      }
    }

    const matchedMaterials = materialLists
      .flat()
      .filter((material: Material) => {
        if (material.deletedAt !== null) {
          return false;
        }
        const week = weekById.get(material.weekId);
        return (
          includesQuery(material.title, needle) ||
          includesQuery(material.description, needle) ||
          (material.attachment !== null &&
            includesQuery(material.attachment.name, needle)) ||
          (week !== undefined && includesQuery(week.title, needle))
        );
      })
      .map((material) => {
        const course = courseById.get(material.courseId)!;
        const week = weekById.get(material.weekId) ?? null;
        return {
          material,
          courseCode: course.code,
          courseName: course.name,
          weekNumber: week?.weekNumber ?? null,
          weekTitle: week?.title ?? null,
        };
      });

    const matchedDeadlines = allDeadlines
      .filter((deadline: Deadline) => {
        if (deadline.deletedAt !== null || !courseById.has(deadline.courseId)) {
          return false;
        }
        return (
          includesQuery(deadline.title, needle) ||
          includesQuery(deadline.description, needle)
        );
      })
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
      .map((deadline) => {
        const course = courseById.get(deadline.courseId)!;
        return {
          deadline,
          courseCode: course.code,
          courseName: course.name,
        };
      });

    const matchedAnnouncements = announcementLists
      .flat()
      .filter((announcement: Announcement) => {
        if (
          announcement.deletedAt !== null ||
          !courseById.has(announcement.courseId)
        ) {
          return false;
        }
        return (
          includesQuery(announcement.title, needle) ||
          includesQuery(announcement.body, needle)
        );
      })
      .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
      .map((announcement) => {
        const course = courseById.get(announcement.courseId)!;
        return {
          announcement,
          courseCode: course.code,
          courseName: course.name,
        };
      });

    return {
      query,
      courses: matchedCourses,
      materials: matchedMaterials,
      deadlines: matchedDeadlines,
      announcements: matchedAnnouncements,
      totalCount:
        matchedCourses.length +
        matchedMaterials.length +
        matchedDeadlines.length +
        matchedAnnouncements.length,
    };
  }
}
