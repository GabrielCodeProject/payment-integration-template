import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "out/**",
      ".env*",
      "**/*.d.ts",
      "coverage/**",
      ".turbo/**",
    ],
  },

  // Next.js and TypeScript configurations
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),

  // Additional rules
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // General code quality - Console logs allowed for development
      "no-console": "off", // Disabled for development debugging
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  // API routes specific rules
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-console": "off", // Allow console logs in API routes for debugging
    },
  },

  // Test files specific rules
  {
    files: ["**/*.test.{js,jsx,ts,tsx}", "**/__tests__/**"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Prisma seed files
  {
    files: ["prisma/seed.ts", "prisma/seeds/**/*.ts"],
    rules: {
      "no-console": "off", // Allow console logs in seed scripts
      "@typescript-eslint/no-unused-vars": "off", // Seed data variables are intentionally unused
    },
  },

  // Layout and page files
  {
    files: [
      "src/app/**/layout.tsx",
      "src/app/**/page.tsx",
      "src/app/**/error.tsx",
      "src/app/**/not-found.tsx",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },

  // Development environment - Allow all console methods
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-console": "off", // Allow console.log, console.error, console.warn, etc. for development
      "no-alert": "off", // Allow alert() for development debugging
    },
  },
];

export default eslintConfig;
