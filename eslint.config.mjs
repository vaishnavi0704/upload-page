import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Bring in Next.js + TS recommended rules
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Global ignores (as you had)
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },

  // 🔧 Global tweaks (turn “any” errors into warnings, relax hooks deps)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // was error
      "react-hooks/exhaustive-deps": "warn",        // was warning already, keep as warn
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // (Optional) Narrower tweaks for API routes only
  {
    files: ["pages/api/**/*.ts", "pages/api/**/*.tsx", "app/api/**/*.ts", "app/api/**/*.tsx"],
    rules: {
      // If you truly need it in API routes, you can turn it off just there:
      // "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
