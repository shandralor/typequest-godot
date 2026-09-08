// Island editor entry (editor.html). Everything lives in App; this just boots it and surfaces
// a boot failure on the page for the screenshot harness.
import { App } from "./app";

try {
  (window as unknown as { __app: App }).__app = new App();
} catch (err) {
  console.error(err);
  document.body.setAttribute("data-error", String(err));
}
