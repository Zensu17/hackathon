import React from 'react';
import { Link } from 'react-router';
import { OnboardingLayout } from './AppLayout';
import {
  BrandMark,
  IconCalendarCheck,
  IconCloudCheck,
  IconNote,
} from './Icons';
import { labels } from '../i18n/labels';

export interface AuthSplitShellProps {
  mode: 'login' | 'register';
  children: React.ReactNode;
}

export function AuthSplitShell({
  mode,
  children,
}: AuthSplitShellProps): React.ReactElement {
  const headerAction =
    mode === 'login' ? (
      <Link to="/register" className="btn btn-secondary app-theme-btn">
        {labels.auth.modeSignUpTab}
      </Link>
    ) : (
      <Link to="/login" className="btn btn-secondary app-theme-btn">
        {labels.auth.modeSignInTab}
      </Link>
    );

  return (
    <OnboardingLayout headerAction={headerAction}>
      <div className="auth-split">
        <section
          className="auth-editorial"
          aria-label="How LiteLearn works"
        >
          <div>
            <div className="auth-editorial__brand">
              <BrandMark size={40} className="brand-lockup__mark" />
              <div>
                <div className="auth-editorial__brand-name">
                  {labels.app.name}
                </div>
                <div className="auth-editorial__brand-sub">
                  Offline-first study workspace
                </div>
              </div>
            </div>

            <div className="auth-editorial__rule" aria-hidden="true" />
            <h2 className="auth-editorial__headline">{labels.auth.tagline}</h2>
            <p className="auth-editorial__desc">{labels.auth.intro}</p>
          </div>

          <ul className="auth-pillars">
            <li className="auth-pillar">
              <IconCalendarCheck size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">
                  Student sign-up, Admin role control
                </span>
                <span className="auth-pillar__body">
                  New registrations join as Student with an 8-character NIM (such as 11S22001) and class code. Administrators assign Lecturer, Assistant, Class Rep, or Admin roles later.
                </span>
              </div>
            </li>
            <li className="auth-pillar">
              <IconCloudCheck size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">
                  Follow courses &amp; save PDFs on demand
                </span>
                <span className="auth-pillar__body">
                  Follow the courses you take this semester so outlines stay on your device while Data Saver skips automatic file downloads.
                </span>
              </div>
            </li>
            <li className="auth-pillar">
              <IconNote size={20} className="auth-pillar__icon" />
              <div>
                <span className="auth-pillar__title">
                  Track deadlines, profiles &amp; private notes
                </span>
                <span className="auth-pillar__body">
                  Check off finished work, customize your profile, and write personal notes offline. Changes save locally and sync when online.
                </span>
              </div>
            </li>
          </ul>
        </section>

        <div className="auth-panel">{children}</div>
      </div>
    </OnboardingLayout>
  );
}
