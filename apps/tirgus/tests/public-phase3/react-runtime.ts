import { createRequire } from "node:module";

// Playwright's TSX transform targets its component-test descriptor runtime.
// This suite renders actual React SSR without browsers; adapt only this worker.
const requireRuntime = createRequire(__filename);
Object.assign(requireRuntime("playwright/jsx-runtime"), requireRuntime("react/jsx-runtime"));
