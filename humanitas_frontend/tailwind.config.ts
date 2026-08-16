export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    light: 'var(--primary)', // Use CSS var (or define a lighter shade var) or just rely on transparency
                    DEFAULT: 'var(--primary)',
                    dark: 'var(--primary)', // Could define --primary-dark if needed, but for now map to main to standard
                },
            },
            fontFamily: {
                roboto: ['Roboto', 'sans-serif'],
            },
        },
    },
    plugins: [],
}