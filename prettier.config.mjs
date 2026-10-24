const config = {
  printWidth: 80,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  trailingComma: "all",
  endOfLine: "lf",
  proseWrap: "never",
  plugins: ["prettier-plugin-sql", "prettier-plugin-tailwindcss"],
  language: "postgresql",
  keywordCase: "upper",
  expressionWidth: 50,
  tailwindStylesheet: "./app/globals.css",
  tailwindFunctions: ["clsx", "cn", "cva", "twMerge"],
};

export default config;
