import { useEffect } from 'react';
import { usePMS } from '@/hooks/usePMS';

export function ThemeApplicator() {
    const { useThemeSettings } = usePMS();
    const { data: theme } = useThemeSettings();

    useEffect(() => {
        if (!theme) return;

        const root = document.documentElement;

        if (theme.primary_color) {
            root.style.setProperty('--primary', theme.primary_color);
        }

        if (theme.primary_foreground) {
            root.style.setProperty('--primary-foreground', theme.primary_foreground);
        }

        if (theme.radius) {
            root.style.setProperty('--radius', theme.radius);
        }

        if (theme.font_family) {
            root.style.setProperty('--font-sans', theme.font_family);
        }

    }, [theme]);

    return null;
}
