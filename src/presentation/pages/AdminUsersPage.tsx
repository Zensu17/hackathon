import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import type { Class, User, UserRole } from '../../domain/entities';
import {
  canManageClassContent,
  isAdminRole,
  isValidNim,
  USER_ROLES,
} from '../../domain/rules';
import { Chip } from '../components/FigmaComponents';
import {
  IconCheckCircle,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconUser,
  IconUsers,
} from '../components/Icons';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { UserAvatar } from '../components/UserAvatar';
import { useAuthSession } from '../hooks/useAuthSession';
import { labels } from '../i18n/labels';
import {
  formatDateTime,
  getRoleLabel,
  getRoleSummary,
} from '../utils/formatters';

type RoleFilter = 'all' | UserRole | 'inactive';

export function AdminUsersPage(): React.ReactElement {
  const container = useAppContainer();
  const { session, refreshSession, isLocalFallbackMode } = useAuthSession();

  const actor = session?.user ?? null;
  const isAdmin = isAdminRole(actor?.role);

  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newNim, setNewNim] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [newClassId, setNewClassId] = useState<string>('');
  const [newStudyProgram, setNewStudyProgram] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const [showCreateClassForm, setShowCreateClassForm] = useState<boolean>(false);
  const [classNameInput, setClassNameInput] = useState<string>('');
  const [classCodeInput, setClassCodeInput] = useState<string>('');
  const [createClassError, setCreateClassError] = useState<string | null>(null);
  const [isCreatingClass, setIsCreatingClass] = useState<boolean>(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('student');
  const [editClassId, setEditClassId] = useState<string>('');
  const [editStudyProgram, setEditStudyProgram] = useState<string>('');
  const [resetPasswordValue, setResetPasswordValue] = useState<string>('');
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(
    null,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${labels.adminUsers.heading} | ${labels.app.name}`;
  }, []);

  const loadDirectory = useCallback(async (): Promise<void> => {
    if (!actor || !isAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [userList, classList] = await Promise.all([
        container.listAllUsers(actor.id),
        container.listAllClasses(actor.id),
      ]);
      setUsers(userList);
      setClasses(classList);
      setNewClassId((prev) =>
        prev || actor.classId || classList[0]?.id || '',
      );
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Could not load user directory.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [actor, container, isAdmin]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );

  const activeAdminCount = useMemo(
    () =>
      users.filter((u) => u.deletedAt === null && u.role === 'admin').length,
    [users],
  );

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.deletedAt === null);
    const inactiveCount = users.length - activeUsers.length;
    const studentCount = activeUsers.filter((u) => u.role === 'student').length;
    const educatorCount = activeUsers.filter(
      (u) =>
        u.role === 'rep' || u.role === 'lecturer' || u.role === 'assistant',
    ).length;
    const adminCount = activeUsers.filter((u) => u.role === 'admin').length;
    return {
      totalActive: activeUsers.length,
      inactiveCount,
      studentCount,
      educatorCount,
      adminCount,
    };
  }, [users]);

  const filterCounts = useMemo(() => {
    const activeUsers = users.filter((u) => u.deletedAt === null);
    return {
      all: activeUsers.length,
      student: activeUsers.filter((u) => u.role === 'student').length,
      rep: activeUsers.filter((u) => u.role === 'rep').length,
      lecturer: activeUsers.filter((u) => u.role === 'lecturer').length,
      assistant: activeUsers.filter((u) => u.role === 'assistant').length,
      admin: activeUsers.filter((u) => u.role === 'admin').length,
      inactive: users.filter((u) => u.deletedAt !== null).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter === 'inactive') {
        if (u.deletedAt === null) return false;
      } else {
        if (u.deletedAt !== null) return false;
        if (roleFilter !== 'all' && u.role !== roleFilter) {
          return false;
        }
      }

      if (classFilter === 'unassigned') {
        if (u.classId !== null) return false;
      } else if (classFilter !== 'all') {
        if (u.classId !== classFilter) return false;
      }

      if (q.length === 0) return true;
      const cls = u.classId ? classById.get(u.classId) : undefined;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.nim.toLowerCase().includes(q) ||
        (u.studyProgram ?? '').toLowerCase().includes(q) ||
        (cls?.name ?? '').toLowerCase().includes(q) ||
        (cls?.joinCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [classById, classFilter, roleFilter, searchQuery, users]);

  const openEditor = (target: User): void => {
    if (editingUserId === target.id) {
      setEditingUserId(null);
      setConfirmDeactivateId(null);
      return;
    }
    setEditingUserId(target.id);
    setEditDisplayName(target.displayName);
    setEditRole(target.role ?? 'student');
    setEditClassId(target.classId ?? '');
    setEditStudyProgram(target.studyProgram ?? '');
    setResetPasswordValue('');
    setConfirmDeactivateId(null);
  };

  const handleQuickRoleChange = async (
    target: User,
    nextRole: UserRole,
  ): Promise<void> => {
    if (!actor || target.role === nextRole) {
      return;
    }
    setBusyUserId(target.id);
    try {
      await container.adminUpdateUser({
        actorId: actor.id,
        targetUserId: target.id,
        role: nextRole,
      });
      await loadDirectory();
      if (target.id === actor.id) {
        await refreshSession();
      }
      toast.success(
        `Updated ${target.displayName} to ${getRoleLabel(nextRole)}.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not change user role.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSaveUserEdit = async (target: User): Promise<void> => {
    if (!actor) {
      return;
    }
    if (editDisplayName.trim().length === 0) {
      toast.error('Display name is required.');
      return;
    }

    setBusyUserId(target.id);
    try {
      await container.adminUpdateUser({
        actorId: actor.id,
        targetUserId: target.id,
        displayName: editDisplayName.trim(),
        role: editRole,
        classId: editClassId.trim().length > 0 ? editClassId.trim() : null,
        studyProgram: editStudyProgram.trim(),
      });
      await loadDirectory();
      if (target.id === actor.id) {
        await refreshSession();
      }
      setEditingUserId(null);
      toast.success(`Saved updates for ${editDisplayName.trim()}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not update user profile.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (target: User): Promise<void> => {
    if (!actor) {
      return;
    }
    if (resetPasswordValue.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setBusyUserId(target.id);
    try {
      await container.adminResetPassword({
        actorId: actor.id,
        targetUserId: target.id,
        newPassword: resetPasswordValue,
      });
      setResetPasswordValue('');
      toast.success(`Password updated for ${target.displayName}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not reset password.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSetUserActive = async (
    target: User,
    active: boolean,
  ): Promise<void> => {
    if (!actor) {
      return;
    }
    setBusyUserId(target.id);
    try {
      await container.adminSetUserActive({
        actorId: actor.id,
        targetUserId: target.id,
        active,
      });
      setConfirmDeactivateId(null);
      if (active && roleFilter === 'inactive') {
        setRoleFilter('all');
      }
      await loadDirectory();
      toast.success(
        active
          ? `Restored account for ${target.displayName}.`
          : `Deactivated account for ${target.displayName}.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not update account status.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCreateUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!actor) {
      return;
    }
    setCreateUserError(null);

    const normalizedNim = newNim.trim().toUpperCase();
    if (!isValidNim(normalizedNim)) {
      setCreateUserError(
        'Enter a valid 8-character ID (2 digits, 1 letter, 5 digits, e.g. 01D10002).',
      );
      return;
    }
    if (newDisplayName.trim().length === 0) {
      setCreateUserError('Full name is required.');
      return;
    }
    if (newPassword.length < 8) {
      setCreateUserError('Password must be at least 8 characters.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const created = await container.adminCreateUser({
        actorId: actor.id,
        nim: normalizedNim,
        displayName: newDisplayName.trim(),
        password: newPassword,
        role: newRole,
        classId: newClassId.trim().length > 0 ? newClassId.trim() : null,
        studyProgram: newStudyProgram.trim(),
      });
      setNewNim('');
      setNewDisplayName('');
      setNewRole('student');
      setNewStudyProgram('');
      setNewPassword('');
      setShowAddUserForm(false);
      await loadDirectory();
      toast.success(
        `Created ${created.displayName} as ${getRoleLabel(created.role)}.`,
      );
    } catch (err) {
      setCreateUserError(
        err instanceof Error ? err.message : 'Could not create user account.',
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCreateClass = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!actor) {
      return;
    }
    setCreateClassError(null);
    if (classNameInput.trim().length === 0) {
      setCreateClassError('Class name is required.');
      return;
    }

    setIsCreatingClass(true);
    try {
      const created = await container.adminCreateClass({
        actorId: actor.id,
        name: classNameInput.trim(),
        joinCode: classCodeInput.trim(),
      });
      setClassNameInput('');
      setClassCodeInput('');
      setShowCreateClassForm(false);
      await loadDirectory();
      toast.success(
        `Created class ${created.name} (join code: ${created.joinCode}).`,
      );
    } catch (err) {
      setCreateClassError(
        err instanceof Error ? err.message : 'Could not create class.',
      );
    } finally {
      setIsCreatingClass(false);
    }
  };

  if (!actor || !isAdmin) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1>{labels.adminUsers.forbiddenTitle}</h1>
        </header>
        <EmptyState
          title={labels.adminUsers.forbiddenTitle}
          body={labels.adminUsers.forbiddenBody}
          actionLabel={labels.repForm.returnHomeCta}
          actionTo="/"
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Chip
                type="info"
                size="S"
                icon={<IconShield size={13} />}
                label="Administrator"
              />
              <span className="meta-text" style={{ fontSize: '13px' }}>
                {isLocalFallbackMode ? 'Local IndexedDB' : 'Cloud synced'}
              </span>
            </div>
            <h1>{labels.adminUsers.heading}</h1>
            <p className="page-lead">{labels.adminUsers.intro}</p>
          </div>
          <div className="action-row" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowAddUserForm((prev) => !prev);
                setShowCreateClassForm(false);
              }}
            >
              <IconPlus size={16} />
              <span>{labels.adminUsers.addUserCta}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowCreateClassForm((prev) => !prev);
                setShowAddUserForm(false);
              }}
            >
              <IconPlus size={16} />
              <span>{labels.adminUsers.createClassCta}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadDirectory()}
              disabled={isLoading}
              aria-label="Refresh user directory"
            >
              <IconRefresh size={16} className={isLoading ? 'anim-spin' : undefined} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live Directory Metrics */}
      {!isLoading && !loadError ? (
        <section className="admin-stats-grid" aria-label="User directory summary">
          <div className="admin-stat-card">
            <span className="admin-stat-card__value tabular-nums">
              {stats.totalActive}
            </span>
            <span className="admin-stat-card__label">Active users</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-card__value tabular-nums">
              {stats.studentCount}
            </span>
            <span className="admin-stat-card__label">Students</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-card__value tabular-nums">
              {stats.educatorCount}
            </span>
            <span className="admin-stat-card__label">
              Lecturers, Assistants &amp; Reps
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-card__value tabular-nums">
              {stats.adminCount}
            </span>
            <span className="admin-stat-card__label">
              {stats.inactiveCount > 0
                ? `Admins (${stats.inactiveCount} inactive)`
                : `Admins across ${classes.length} class${classes.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </section>
      ) : null}

      {/* Create User Form */}
      {showAddUserForm ? (
        <section className="index-card" aria-labelledby="admin-add-user-heading">
          <div className="card-tab-bar">
            <span className="card-tab-code">NEW USER</span>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => setShowAddUserForm(false)}
            >
              {labels.common.cancel}
            </button>
          </div>
          <h2 id="admin-add-user-heading">Create campus account</h2>
          {isLocalFallbackMode ? (
            <form
              className="form-stack"
              style={{ marginTop: '14px' }}
              noValidate
              onSubmit={(e) => void handleCreateUser(e)}
            >
              <div className="admin-inline-form-grid">
                <div className="field-group">
                  <label htmlFor="admin-new-nim" className="field-label">
                    {labels.auth.nimLabel}
                  </label>
                  <input
                    id="admin-new-nim"
                    type="text"
                    autoCapitalize="characters"
                    className="field-input mono-input"
                    placeholder="01D10002"
                    value={newNim}
                    onChange={(e) => setNewNim(e.target.value)}
                    disabled={isCreatingUser}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="admin-new-name" className="field-label">
                    {labels.auth.displayNameLabel}
                  </label>
                  <input
                    id="admin-new-name"
                    type="text"
                    className="field-input"
                    placeholder="Full name or lecturer title"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    disabled={isCreatingUser}
                  />
                </div>
              </div>

              <div className="admin-inline-form-grid">
                <div className="field-group">
                  <label htmlFor="admin-new-role" className="field-label">
                    Assigned role
                  </label>
                  <select
                    id="admin-new-role"
                    className="field-input"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    disabled={isCreatingUser}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {getRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="admin-new-class" className="field-label">
                    Assigned class
                  </label>
                  <select
                    id="admin-new-class"
                    className="field-input"
                    value={newClassId}
                    onChange={(e) => setNewClassId(e.target.value)}
                    disabled={isCreatingUser}
                  >
                    <option value="">{labels.adminUsers.unassignedClassOption}</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.name} (${c.joinCode})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-inline-form-grid">
                <div className="field-group">
                  <label htmlFor="admin-new-program" className="field-label">
                    Study program / Unit (optional)
                  </label>
                  <input
                    id="admin-new-program"
                    type="text"
                    className="field-input"
                    placeholder="e.g. Faculty of Informatics"
                    value={newStudyProgram}
                    onChange={(e) => setNewStudyProgram(e.target.value)}
                    disabled={isCreatingUser}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="admin-new-password" className="field-label">
                    Initial password
                  </label>
                  <div className="figma-field__control">
                    <input
                      id="admin-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      className="figma-field__input"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isCreatingUser}
                    />
                    <button
                      type="button"
                      className="figma-field__action"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={
                        showNewPassword
                          ? labels.auth.hidePasswordAria
                          : labels.auth.showPasswordAria
                      }
                    >
                      {showNewPassword ? (
                        <IconEyeOff size={18} />
                      ) : (
                        <IconEye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {createUserError ? (
                <div className="field-error" role="alert">
                  {createUserError}
                </div>
              ) : null}

              <div className="action-row" style={{ marginTop: 0 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? 'Creating account...' : 'Create user account'}
                </button>
              </div>
            </form>
          ) : (
            <p className="meta-text">
              In online mode, new users register on the sign-up screen as Student first. Once they register, promote them to Lecturer, Teaching Assistant, Class Representative, or Admin in the directory below.
            </p>
          )}
        </section>
      ) : null}

      {/* Create Class Form */}
      {showCreateClassForm ? (
        <section className="index-card" aria-labelledby="admin-create-class-heading">
          <div className="card-tab-bar">
            <span className="card-tab-code">NEW CLASS</span>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => setShowCreateClassForm(false)}
            >
              {labels.common.cancel}
            </button>
          </div>
          <h2 id="admin-create-class-heading">Create class workspace</h2>
          <p className="meta-text">
            Add a new class cohort and share its join code. Creating a class here keeps your Administrator role unchanged.
          </p>
          <form
            className="form-stack"
            style={{ marginTop: '14px' }}
            noValidate
            onSubmit={(e) => void handleCreateClass(e)}
          >
            <div className="admin-inline-form-grid">
              <div className="field-group">
                <label htmlFor="admin-class-name" className="field-label">
                  {labels.joinClass.classNameLabel}
                </label>
                <input
                  id="admin-class-name"
                  type="text"
                  className="field-input"
                  placeholder="S1 Informatika 2026"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  disabled={isCreatingClass}
                />
              </div>
              <div className="field-group">
                <label htmlFor="admin-class-code" className="field-label">
                  {labels.joinClass.customJoinCodeLabel}
                </label>
                <input
                  id="admin-class-code"
                  type="text"
                  autoCapitalize="characters"
                  className="field-input mono-input"
                  placeholder="IF2026 (optional)"
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value)}
                  disabled={isCreatingClass}
                />
              </div>
            </div>
            {createClassError ? (
              <div className="field-error" role="alert">
                {createClassError}
              </div>
            ) : null}
            <div className="action-row" style={{ marginTop: 0 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreatingClass}
              >
                {isCreatingClass ? 'Creating class...' : 'Create class'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Class Join Codes Bar */}
      {!isLoading && !loadError && classes.length > 0 ? (
        <section className="index-card" aria-label="Registered classes">
          <div className="section-heading-row">
            <h2 style={{ fontSize: '17px' }}>
              {`Classes (${classes.length})`}
            </h2>
          </div>
          <div className="admin-class-chips">
            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    void navigator.clipboard.writeText(cls.joinCode).then(() => {
                      toast.success(`Copied join code ${cls.joinCode}`);
                    });
                  }
                }}
                title={`Copy join code ${cls.joinCode}`}
              >
                <span>{cls.name}</span>
                <span className="card-tab-code">{cls.joinCode}</span>
                <IconCopy size={13} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Search & Filter Controls */}
      <section className="admin-toolbar" aria-label="Filter users">
        <div className="admin-toolbar__top">
          <div className="search-bar" style={{ flex: '1 1 260px' }}>
            <IconSearch size={18} style={{ color: 'var(--color-text-muted)' }} />
            <input
              id="admin-user-search"
              name="adminUserSearch"
              type="search"
              className="search-bar__input"
              placeholder={labels.adminUsers.searchPlaceholder}
              aria-label="Search registered users"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim().length > 0 ? (
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => setSearchQuery('')}
              >
                {labels.home.searchClear}
              </button>
            ) : null}
          </div>

          <select
            id="admin-class-filter"
            name="adminClassFilter"
            aria-label="Filter by class"
            className="member-role-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">{labels.adminUsers.allClassesOption}</option>
            <option value="unassigned">
              {labels.adminUsers.unassignedClassOption}
            </option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {`${cls.name} (${cls.joinCode})`}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-pills" role="tablist" aria-label="Filter users by role">
          {(
            [
              ['all', `All active (${filterCounts.all})`],
              ['student', `Student (${filterCounts.student})`],
              ['rep', `Class Rep (${filterCounts.rep})`],
              ['lecturer', `Lecturer (${filterCounts.lecturer})`],
              ['assistant', `Assistant (${filterCounts.assistant})`],
              ['admin', `Admin (${filterCounts.admin})`],
              ...(filterCounts.inactive > 0
                ? ([['inactive', `Inactive (${filterCounts.inactive})`]] as const)
                : []),
            ] as ReadonlyArray<[RoleFilter, string]>
          ).map(([key, labelText]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={roleFilter === key}
              className={
                roleFilter === key
                  ? 'admin-filter-pill admin-filter-pill--active'
                  : 'admin-filter-pill'
              }
              onClick={() => setRoleFilter(key)}
            >
              {labelText}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? <LoadingState message="Loading all registered users..." /> : null}

      {!isLoading && loadError ? (
        <ErrorState
          title="Could not load user directory"
          detail={loadError}
          onRetry={() => void loadDirectory()}
        />
      ) : null}

      {!isLoading && !loadError && filteredUsers.length === 0 ? (
        <EmptyState
          title="No matching users found"
          body="Try clearing the search box or switching role and class filters."
        />
      ) : null}

      {!isLoading && !loadError && filteredUsers.length > 0 ? (
        <ul className="admin-users-list">
          {filteredUsers.map((member) => {
            const isSelf = member.id === actor.id;
            const isInactive = member.deletedAt !== null;
            const isLastActiveAdmin =
              !isInactive && member.role === 'admin' && activeAdminCount <= 1;
            const assignedClass = member.classId
              ? classById.get(member.classId)
              : undefined;
            const isExpanded = editingUserId === member.id;
            const isBusy = busyUserId === member.id;

            return (
              <li
                key={member.id}
                className={
                  isInactive
                    ? 'index-card admin-user-card admin-user-card--inactive'
                    : 'index-card admin-user-card'
                }
              >
                <div className="admin-user-card__main">
                  <div className="member-row__identity">
                    <UserAvatar
                      displayName={member.displayName}
                      avatarColor={member.avatarColor}
                      avatarDataUrl={member.avatarDataUrl}
                      size="md"
                    />
                    <div className="member-row__meta">
                      <div className="admin-user-card__name-row">
                        <strong>
                          {member.displayName}
                          {isSelf ? ' (You)' : ''}
                        </strong>
                        <span className="card-tab-code">{member.nim}</span>
                        {isInactive ? (
                          <Chip type="danger" size="S" label="Inactive" />
                        ) : (
                          <Chip
                            type={
                              canManageClassContent(member.role)
                                ? 'info'
                                : 'neutral'
                            }
                            size="S"
                            label={getRoleLabel(member.role)}
                          />
                        )}
                      </div>
                      <span className="meta-text" style={{ fontSize: '13.5px' }}>
                        {assignedClass
                          ? `${assignedClass.name} (${assignedClass.joinCode})`
                          : 'No class assigned'}
                        {member.studyProgram ? ` / ${member.studyProgram}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="member-row__controls">
                    <select
                      aria-label={`Assign role for ${member.displayName}`}
                      name={`admin-role-${member.id}`}
                      className="member-role-select"
                      value={member.role ?? 'student'}
                      disabled={isBusy || isInactive || isLastActiveAdmin}
                      title={
                        isLastActiveAdmin
                          ? 'At least one active Admin must remain.'
                          : undefined
                      }
                      onChange={(e) =>
                        void handleQuickRoleChange(
                          member,
                          e.target.value as UserRole,
                        )
                      }
                    >
                      {USER_ROLES.map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt}>
                          {getRoleLabel(roleOpt)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      onClick={() => openEditor(member)}
                      aria-expanded={isExpanded}
                    >
                      <IconUser size={14} />
                      <span>{isExpanded ? 'Close' : labels.common.edit}</span>
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="admin-user-editor">
                    <div className="admin-inline-form-grid">
                      <div className="field-group">
                        <label
                          htmlFor={`edit-name-${member.id}`}
                          className="field-label"
                        >
                          {labels.profile.displayNameLabel}
                        </label>
                        <input
                          id={`edit-name-${member.id}`}
                          type="text"
                          maxLength={80}
                          className="field-input"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          disabled={isBusy}
                        />
                      </div>

                      <div className="field-group">
                        <label
                          htmlFor={`edit-role-${member.id}`}
                          className="field-label"
                        >
                          Role
                        </label>
                        <select
                          id={`edit-role-${member.id}`}
                          className="field-input"
                          value={editRole}
                          onChange={(e) =>
                            setEditRole(e.target.value as UserRole)
                          }
                          disabled={isBusy || isLastActiveAdmin}
                        >
                          {USER_ROLES.map((roleOpt) => (
                            <option key={roleOpt} value={roleOpt}>
                              {getRoleLabel(roleOpt)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="admin-inline-form-grid">
                      <div className="field-group">
                        <label
                          htmlFor={`edit-class-${member.id}`}
                          className="field-label"
                        >
                          Assigned class
                        </label>
                        <select
                          id={`edit-class-${member.id}`}
                          className="field-input"
                          value={editClassId}
                          onChange={(e) => setEditClassId(e.target.value)}
                          disabled={isBusy}
                        >
                          <option value="">
                            {labels.adminUsers.unassignedClassOption}
                          </option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {`${cls.name} (${cls.joinCode})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field-group">
                        <label
                          htmlFor={`edit-program-${member.id}`}
                          className="field-label"
                        >
                          {labels.profile.studyProgramLabel}
                        </label>
                        <input
                          id={`edit-program-${member.id}`}
                          type="text"
                          maxLength={80}
                          className="field-input"
                          placeholder="e.g. S1 Informatika"
                          value={editStudyProgram}
                          onChange={(e) => setEditStudyProgram(e.target.value)}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    <div className="admin-user-editor__actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-compact"
                        disabled={isBusy}
                        onClick={() => void handleSaveUserEdit(member)}
                      >
                        <IconCheckCircle size={14} />
                        <span>
                          {isBusy
                            ? labels.adminUsers.savingUserCta
                            : labels.adminUsers.saveUserCta}
                        </span>
                      </button>

                      <span className="meta-text" style={{ fontSize: '12.5px' }}>
                        {`Updated ${formatDateTime(member.updatedAt)}`}
                      </span>
                    </div>

                    {isLocalFallbackMode ? (
                      <div className="admin-user-editor__subrow">
                        <div style={{ flex: '1 1 220px' }}>
                          <label
                            htmlFor={`reset-pw-${member.id}`}
                            className="field-label"
                          >
                            Reset account password (local)
                          </label>
                          <input
                            id={`reset-pw-${member.id}`}
                            type="password"
                            className="field-input"
                            placeholder="New password (min 8 chars)"
                            value={resetPasswordValue}
                            onChange={(e) =>
                              setResetPasswordValue(e.target.value)
                            }
                            disabled={isBusy}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          disabled={isBusy || resetPasswordValue.length < 8}
                          onClick={() => void handleResetPassword(member)}
                        >
                          {labels.adminUsers.resetPasswordCta}
                        </button>
                      </div>
                    ) : null}

                    <div className="admin-user-editor__subrow">
                      {isInactive ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          disabled={isBusy}
                          onClick={() => void handleSetUserActive(member, true)}
                        >
                          {labels.adminUsers.restoreCta}
                        </button>
                      ) : confirmDeactivateId === member.id ? (
                        <div className="action-row" style={{ marginTop: 0 }}>
                          <span className="meta-text" style={{ fontWeight: 600 }}>
                            Confirm account deactivation?
                          </span>
                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            disabled={isBusy}
                            onClick={() =>
                              void handleSetUserActive(member, false)
                            }
                          >
                            Confirm deactivate
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            disabled={isBusy}
                            onClick={() => setConfirmDeactivateId(null)}
                          >
                            {labels.common.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-compact"
                          disabled={isBusy || isSelf || isLastActiveAdmin}
                          title={
                            isSelf
                              ? 'You cannot deactivate your own active session.'
                              : isLastActiveAdmin
                                ? 'Cannot deactivate the last active Admin.'
                                : undefined
                          }
                          onClick={() => setConfirmDeactivateId(member.id)}
                        >
                          {labels.adminUsers.deactivateCta}
                        </button>
                      )}
                      {isSelf || isLastActiveAdmin ? (
                        <span className="meta-text" style={{ fontSize: '12.5px' }}>
                          {isSelf
                            ? 'Active Admin session cannot deactivate itself.'
                            : 'At least one active Admin must remain.'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Role Permissions Reference */}
      <section className="index-card" aria-labelledby="role-guide-heading">
        <div className="section-heading-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconUsers size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 id="role-guide-heading" style={{ margin: 0 }}>
              Role permissions reference
            </h2>
          </div>
          <Link to="/manage" className="btn btn-secondary btn-compact">
            Open Manage studio
          </Link>
        </div>
        <div className="role-legend-grid" style={{ marginTop: '12px' }}>
          {USER_ROLES.map((roleOpt) => (
            <div key={roleOpt} className="role-legend-item">
              <strong className="role-legend-item__title">
                {getRoleLabel(roleOpt)}
              </strong>
              <p className="role-legend-item__desc">
                {getRoleSummary(roleOpt)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminUsersPage;
