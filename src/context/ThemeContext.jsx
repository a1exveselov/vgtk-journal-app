import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { ThemeContext } from './useTheme';

const STORAGE_KEY = 'vgtk_theme_preference';

function applyThemeToDOM(targetTheme) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(targetTheme);
  root.style.colorScheme = targetTheme;
}

export function ThemeProvider({ children }) {
  const fallbackTimeoutRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Игнорируем ограничения хранилища
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      const hasExplicitPreference = window.localStorage.getItem(STORAGE_KEY);
      if (!hasExplicitPreference) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = async (event) => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const root = window.document.documentElement;

    // 1. Вычисляем координаты центра кнопки (или точки клика)
    let x = window.innerWidth - 40;
    let y = 28;

    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
      x = event.clientX;
      y = event.clientY;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Если браузер поддерживает View Transitions API — запускаем круговую волну
    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
      // Отключаем обычные CSS-переходы на время снятия слепка новой темы
      root.classList.add('vt-no-transitions');

      // Вычисляем максимальный радиус до самого дальнего угла экрана
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
        applyThemeToDOM(nextTheme);
      });

      try {
        await transition.ready;

        // Анимируем круговое раскрытие нового слоя поверх старого
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 560,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );

        await transition.finished;
      } finally {
        root.classList.remove('vt-no-transitions');
      }
      return;
    }

    // 3. Фолбэк для браузеров без View Transitions API
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
    root.classList.add('theme-transition');
    setTheme(nextTheme);
    fallbackTimeoutRef.current = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
