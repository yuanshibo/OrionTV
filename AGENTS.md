# Repository Guidelines

## Project Structure & Module Organization
OrionTV is an Expo Router React Native TV app. Runtime routes live in `app/`, shared UI in `components/`, domain logic in `services/` and `stores/`, and reusable helpers in `utils/`. Hooks live under `hooks/`, global values in `constants/`, and static media in `assets/`. Android native overrides sit in `android/`, with channel XML templates in `xml/` copied during builds. Tests stay close to features, notably `components/__tests__/` and `utils/__tests__/`. Reference docs and UI captures live in `docs/` and `screenshot/`.

## Build, Test, and Development Commands
Use Yarn scripts in `package.json`.
- `yarn start`: Launch Expo dev server with TV flags (`EXPO_TV=1`).
- `yarn android` / `yarn ios`: Build and deploy the native app to devices or emulators.
- `yarn prebuild`: Regenerate native projects and sync XML configs into `android/app/src`.
- `yarn build` / `yarn build-debug`: Produce release or debug Android packages via Gradle.
- `yarn lint`, `yarn typecheck`: Run Expo ESLint preset and TypeScript project checks.
- `yarn test`, `yarn test-ci`: Execute Jest; CI mode runs coverage and disables watch.

## Coding Style & Naming Conventions
TypeScript is required; components use `.tsx`, logic modules `.ts`. Prettier enforces two-space indentation, double quotes, and 120-character lines; run `yarn lint --fix` or editor format on save. Follow Expo ESLint defaults; resolve warnings before review. Use PascalCase for components and screens, camelCase for hooks and store actions, and UPPER_SNAKE_CASE for shared constants. Snapshot files under `__snapshots__/` are auto-generated; never edit them manually.

## Testing Guidelines
Jest with the `jest-expo` preset powers unit, render, and snapshot tests. Name files `*.test.ts` or `*-test.tsx` and colocate them with the code they cover. Favor behavior-driven assertions with React Testing Library helpers; mock TV-specific native modules when tests depend on them. Run `yarn test` locally while iterating and `yarn test-ci` before opening a PR to confirm clean coverage output.

## Commit & Pull Request Guidelines
Recent history favors concise, lower-case summaries (e.g., `search add`). Keep commit messages imperative and scoped to one change; add context in the body when referencing issues or build impacts. Before requesting review, ensure lint, typecheck, and `yarn test-ci` all pass. PR descriptions should outline motivation, link related issues, and include screenshots or recordings for UI updates, plus notes about XML or Gradle adjustments.

## Configuration Notes
TV-specific environment flags (`EXPO_TV`, `EXPO_USE_METRO_WORKSPACE_ROOT`) are wired into the scripts; avoid overriding them manually. Update XML templates in `xml/` rather than editing generated Android files, and keep `eas.json` profiles aligned with Gradle changes. Never commit secrets; rely on Expo config or CI stores for credentials.
