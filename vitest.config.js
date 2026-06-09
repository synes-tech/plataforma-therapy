import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', 'dist', 'tests/e2e', 'tests/integration'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/app/routes.tsx'],
            thresholds: {
                branches: 70,
                functions: 70,
                lines: 70,
                statements: 70,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@containers': path.resolve(__dirname, './src/containers'),
            '@features': path.resolve(__dirname, './src/features'),
        },
    },
});
