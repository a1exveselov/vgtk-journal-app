import { useTheme } from '../../context/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  return (
    <button type="button" className="theme-control" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={label}>
      <span aria-hidden="true" className="theme-swatch" /><span>{label}</span>
    </button>
  );
}
