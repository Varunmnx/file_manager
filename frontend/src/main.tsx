import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n.ts";
import { MantineProvider } from "@mantine/core";
import { theme } from "./theme/index.ts";
import App from "./App.tsx";
// core styles are required for all packages
import '@mantine/core/styles.css';

// other css files are required only if
// you are using components from the corresponding package
// import '@mantine/dates/styles.css';
// import '@mantine/dropzone/styles.css';
// import '@mantine/code-highlight/styles.css';
// ...

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme}>
     <App />
  </MantineProvider>,
);


