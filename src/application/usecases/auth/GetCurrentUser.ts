import type {
  AuthRepository,
  ClassRepository,
} from '../../../domain/repositories';
import type { AuthSessionDto } from '../../dto/AuthDto';

export class GetCurrentUser {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(): Promise<AuthSessionDto | null> {
    const user = await this.authRepository.getCurrentUser();
    if (!user || user.deletedAt !== null) {
      return null;
    }

    if (!user.classId) {
      return {
        user,
        currentClass: null,
      };
    }

    const foundClass = await this.classRepository.getById(user.classId);
    const currentClass =
      foundClass && foundClass.deletedAt === null ? foundClass : null;

    return {
      user,
      currentClass,
    };
  }
}
