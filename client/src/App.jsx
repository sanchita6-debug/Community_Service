/**
 * ============================================================================
 * App - providers, routes, and the top-level error boundary
 * ============================================================================
 *
 * Provider order matters and is easy to get wrong:
 *
 *   AuthProvider      - who is signed in (needed for settings sync)
 *     SettingsProvider - language / text size / voice (needs the auth token)
 *       SpeechProvider  - TTS + STT, configured FROM settings
 *         ProgressProvider - lessons and practice, scoped to the active user
 *           ActivityProvider - the saved record of what the features did
 *             Layout -> Routes
 *
 * SpeechProvider sits below SettingsProvider on purpose: the voice speed and
 * whether to speak at all are themselves settings, so it cannot be built before
 * settings are known.
 */
import { Component, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth, LOCAL_TARGET_UID } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { SpeechProvider } from './context/SpeechContext.jsx';
import { ProgressProvider } from './context/ProgressContext.jsx';
import { ActivityProvider } from './context/ActivityContext.jsx';
import Layout from './components/Layout.jsx';

import Home from './pages/Home.jsx';
import SendMoney from './pages/SendMoney.jsx';
import TransactionExplainer from './pages/TransactionExplainer.jsx';
import SafetyChecker from './pages/SafetyChecker.jsx';
import Learn from './pages/Learn.jsx';
import LessonPlayer from './pages/LessonPlayer.jsx';
import ScamSimulator from './pages/ScamSimulator.jsx';
import FamilyHelper from './pages/FamilyHelper.jsx';
import History from './pages/History.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';
import GlassHeroDemo from './components/ui/glass-headline-hero.demo';

/**
 * Catches a render crash and shows something a non-technical person can act
 * on, instead of a blank white screen and a console full of stack traces.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[voicepay] render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="card max-w-lg text-center">
            <h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1>
            <p className="mt-3 text-lg text-ink-soft">
              Please close VoicePay and open it again. Your settings are safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-6 w-full"
            >
              Open VoicePay again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Bridges AuthContext into SettingsContext, which lives inside it.
 * The Family Helper target (whose phone a relative is configuring) becomes the
 * settings document that gets read and written.
 */
function SettingsBridge({ children }) {
  const { user, getAccessToken, helperTarget } = useAuth();
  const [token, setToken] = useState(null);

  // Fetch a fresh access token whenever the session changes, and whenever the
  // helper switches which phone it is configuring. Without this the server
  // cannot tell a signed-in helper apart from an anonymous caller.
  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setToken(null);
      return undefined;
    }

    (async () => {
      const fresh = await getAccessToken();
      if (!cancelled) setToken(fresh);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken, helperTarget?.uid]);

  const remoteTarget = user
    ? {
        // The document id is ALWAYS the local one, never the helper's own
        // account id. Every API request is stamped with 'demo-user'
        // (server/src/auth.js), so writing to any other id is refused with a
        // 403 - which is what used to happen on the first render after
        // sign-in, when helperTarget had not landed yet.
        //
        // Which person the phone belongs to is the LABEL on the target
        // (its email), not a different document. See LOCAL_TARGET_UID.
        uid: helperTarget?.uid || LOCAL_TARGET_UID,
        token,
      }
    : null;

  return (
    <SettingsProvider
      remoteTarget={remoteTarget}
      getToken={getAccessToken}
      authUser={user}
    >
      {children}
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SettingsBridge>
            <SpeechProvider>
              <ProgressProvider userId="demo-user">
                <ActivityProvider userId="demo-user">
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/send" element={<SendMoney />} />
                      <Route path="/explain" element={<TransactionExplainer />} />
                      <Route path="/safety" element={<SafetyChecker />} />
                      <Route path="/learn" element={<Learn />} />
                      <Route path="/learn/:lessonId" element={<LessonPlayer />} />
                      <Route path="/learn/simulator" element={<ScamSimulator />} />
                      <Route path="/family" element={<FamilyHelper />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/settings" element={<Settings />} />
                      {/* Component demo. Not in the navigation on purpose. */}
                      <Route path="/demo/glass-hero" element={<GlassHeroDemo />} />
                      <Route path="/home" element={<Navigate to="/" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </ActivityProvider>
              </ProgressProvider>
            </SpeechProvider>
          </SettingsBridge>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
