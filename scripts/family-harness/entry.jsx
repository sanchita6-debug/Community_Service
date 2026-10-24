/**
 * ============================================================================
 * Test entry for scripts/verify-family.mjs
 * ============================================================================
 *
 * Mounts the REAL <App /> so the test drives the whole provider chain
 * (Auth -> SettingsBridge -> Speech) rather than a mock of it. A mock would
 * happily pass while the real providers disagree about who the user is,
 * which is exactly the bug this test exists to catch.
 *
 * The bundle is built by esbuild with the app's own aliases, so '@shared' and
 * '@' resolve the same way they do in the real build.
 */
import { createRoot } from 'react-dom/client';
import App from '../../client/src/App.jsx';

export function mount(container) {
  const root = createRoot(container);
  root.render(<App />);
  return root;
}
