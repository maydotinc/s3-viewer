import * as React from "react";

// vitest compiles .tsx with the classic JSX runtime, which reads React from scope
(globalThis as { React?: typeof React }).React = React;
