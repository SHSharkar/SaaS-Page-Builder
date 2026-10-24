const config = {
  "*.{js,mjs,ts,tsx}": [
    "bunx --bun eslint --fix --max-warnings 0",
    "bunx --bun prettier --write",
  ],
  "*.css": ["bunx --bun stylelint --fix", "bunx --bun prettier --write"],
  "*.{json,md,yml,yaml,sql}": ["bunx --bun prettier --write"],
  "*.sh": ["shfmt -i 2 -ci -w", "shellcheck"],
  ".husky/{pre-commit,commit-msg,post-merge,pre-push}": [
    "shfmt -i 2 -ci -w",
    "shellcheck",
  ],
};

export default config;
