import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function AppHeader({ roles }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const sections = [
    { to: '/', label: 'Преподаватель' },
    ...(roles.includes('CURATOR') ? [{ to: '/curator', label: 'Куратор' }] : []),
    { to: '/student', label: 'Учащийся' },
  ];
  const activeSection = pathname.startsWith('/journal/') ? '/' : pathname;

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link to="/" className="college-brand">
          <img src="/favicon.svg" width="34" height="40" alt="" />
          <span className="brand-copy">
            <strong>Электронный журнал</strong>
            <small>Витебский государственный технический колледж</small>
          </span>
        </Link>
        <nav aria-label="Кабинеты журнала" className="role-nav">
          {sections.map(({ to, label }) => (
            <Link key={to} to={to} aria-current={activeSection === to ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
