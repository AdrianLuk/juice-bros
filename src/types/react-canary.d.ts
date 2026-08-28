// The App Router runs on a React canary build (see AGENTS.md / Next 16), which
// ships `<ViewTransition>` and friends. `@types/react` keeps those behind the
// `react/canary` entry point; this reference pulls the augmentation in project
// wide so `import { ViewTransition } from "react"` type-checks.
/// <reference types="react/canary" />
