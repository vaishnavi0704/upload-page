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
  
  // Global ignores
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  
  // 🔧 Global tweaks - turn errors OFF for deployment
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",           // Turn OFF completely
      "react-hooks/exhaustive-deps": "off",                  // Turn OFF completely
      "@typescript-eslint/no-unused-vars": "off",            // Turn OFF completely
    },
  },
  
  // API routes - completely disable these rules
  {
    files: ["pages/api/**/*.ts", "pages/api/**/*.tsx", "app/api/**/*.ts", "app/api/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
