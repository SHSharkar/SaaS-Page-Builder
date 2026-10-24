const config = {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "node_modules/**",
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "dist/**",
  ],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "apply",
          "layer",
          "custom-variant",
          "utility",
          "variant",
          "source",
          "reference",
          "plugin",
          "config",
        ],
      },
    ],
    "at-rule-no-deprecated": [
      true,
      {
        ignoreAtRules: ["apply"],
      },
    ],
    "import-notation": null,
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
      {
        message: "Expected class selector to be kebab-case",
      },
    ],
    "custom-property-pattern": [
      "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
      {
        message: "Expected custom property name to be kebab-case",
      },
    ],
  },
};

export default config;
