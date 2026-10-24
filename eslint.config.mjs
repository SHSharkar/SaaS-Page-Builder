import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const ALLOWED_DIRECTIVE_PREFIXES = [
  "eslint-disable",
  "eslint-enable",
  "@ts-expect-error",
];

const noSourceCommentsRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid source comments except explicit directive comments or file shebangs",
    },
    schema: [],
    messages: {
      forbidden:
        "Source comments are forbidden by house rule. Express intent through naming and types.",
    },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode;
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Shebang") {
            continue;
          }
          const trimmed = comment.value.trim();
          const allowed = ALLOWED_DIRECTIVE_PREFIXES.some((prefix) =>
            trimmed.startsWith(prefix),
          );
          if (!allowed) {
            context.report({
              loc: comment.loc,
              messageId: "forbidden",
            });
          }
        }
      },
    };
  },
};

const RAW_PALETTE_REGEX =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const noRawTailwindPaletteRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid raw Tailwind color palette classes; use semantic tokens defined in app/globals.css",
    },
    schema: [],
    messages: {
      rawPalette:
        "Raw Tailwind palette class detected. Use semantic design tokens (bg-canvas, bg-card, bg-muted, bg-accent, text-ink, text-subtle, border-border-subtle).",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (
          typeof node.value === "string" &&
          RAW_PALETTE_REGEX.test(node.value)
        ) {
          context.report({ node, messageId: "rawPalette" });
        }
      },
      TemplateElement(node) {
        if (RAW_PALETTE_REGEX.test(node.value.raw)) {
          context.report({ node, messageId: "rawPalette" });
        }
      },
    };
  },
};

export const housePlugin = {
  rules: {
    "no-source-comments": noSourceCommentsRule,
    "no-raw-tailwind-palette": noRawTailwindPaletteRule,
  },
};

export const ALLOWED_JSX_LITERALS = [
  "SaaS Page Builder",
  "/",
  "-",
  ":",
  ",",
  ".",
  "|",
  "+",
  "#",
  "(",
  ")",
];

const WRAPPED_HTML_SELECTORS = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: "Use <Button> from @/components/ui instead of raw <button>.",
  },
  {
    selector: "JSXOpeningElement[name.name='input']",
    message:
      "Use <Input>, <DatePicker>, or <TimePicker> from @/components/ui instead of raw <input>.",
  },
  {
    selector: "JSXOpeningElement[name.name='textarea']",
    message: "Use <Textarea> from @/components/ui instead of raw <textarea>.",
  },
  {
    selector: "JSXOpeningElement[name.name='label']",
    message: "Use <Label> from @/components/ui instead of raw <label>.",
  },
  {
    selector: "JSXOpeningElement[name.name='form']",
    message: "Use <Form> from @/components/ui instead of raw <form>.",
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message:
      "Use <FormSelect> or <SearchableSelect> from @/components/ui instead of raw <select>.",
  },
  {
    selector: "JSXOpeningElement[name.name='option']",
    message: "Use <FormSelect> from @/components/ui instead of raw <option>.",
  },
  {
    selector: "JSXOpeningElement[name.name='optgroup']",
    message: "Use <FormSelect> from @/components/ui instead of raw <optgroup>.",
  },
  {
    selector: "JSXOpeningElement[name.name='table']",
    message: "Use <DataTable> from @/components/ui instead of raw <table>.",
  },
  {
    selector: "JSXOpeningElement[name.name='fieldset']",
    message: "Use <Fieldset> from @/components/ui instead of raw <fieldset>.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='a']:has(JSXAttribute[name.name='className'])",
    message: "Use <AppLink> from @/components/ui instead of styled raw <a>.",
  },
  {
    selector: "JSXAttribute[name.name='aria-live']",
    message:
      "Use <LiveRegion> from @/components/ui instead of raw aria-live attributes.",
  },
];

const GLOBAL_SYNTAX_RESTRICTIONS = [
  {
    selector: "CallExpression[callee.name='revalidatePath']",
    message:
      "revalidatePath is forbidden. Publish changes via publishAccountChange() and pg_notify.",
  },
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
    message: "Instantiate Intl.NumberFormat exclusively inside lib/money.ts.",
  },
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
    message: "Instantiate Intl.DateTimeFormat exclusively inside lib/dates.ts.",
  },
];

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".verify-logs/**",
      "drizzle/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      house: housePlugin,
      "jsx-a11y": jsxA11y,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      complexity: ["error", { max: 15 }],
      eqeqeq: ["error", "always"],
      "house/no-raw-tailwind-palette": "error",
      "house/no-source-comments": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@electric-sql/pglite",
              message:
                "Embedded PGlite is forbidden. PostgreSQL 18 is the sole database.",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...GLOBAL_SYNTAX_RESTRICTIONS],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
        },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-sort-props": [
        "error",
        {
          callbacksLast: false,
          ignoreCase: false,
          noSortAlphabetically: false,
          reservedFirst: false,
          shorthandFirst: false,
          shorthandLast: false,
        },
      ],
    },
  },
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/**", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...GLOBAL_SYNTAX_RESTRICTIONS,
        ...WRAPPED_HTML_SELECTORS,
      ],
      "react/jsx-no-literals": [
        "error",
        {
          allowedStrings: ALLOWED_JSX_LITERALS,
          ignoreProps: true,
          noAttributeStrings: false,
          noStrings: false,
        },
      ],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message: "lib/ must stay pure and client-safe.",
            },
            {
              name: "@electric-sql/pglite",
              message: "Embedded PGlite is forbidden.",
            },
          ],
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "@/hooks/*"],
              message: "lib/ cannot depend on app/, components/, or hooks/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/dates.ts", "lib/money.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["eslint.config.test.ts"],
    rules: {
      "house/no-raw-tailwind-palette": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      complexity: "off",
    },
  },
  eslintConfigPrettier,
];
