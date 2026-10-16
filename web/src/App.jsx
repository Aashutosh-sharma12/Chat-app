import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { useChat } from './store/chat';
import { usePresence } from './store/presence';
import { setExpiredHandler } from './api/client';
import { connectSocket, disconnectSocket } from './socket';
import { hangupIfActive } from './callManager';
import CallScreen from './components/CallScreen.jsx';
import { SplashLoader } from './components/ui.jsx';

const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const Shell = lazy(() => import('./components/Shell.jsx'));

export default function App() {
  const { status, hydrate, expire } = useAuth();

  useEffect(() => {
    setExpiredHandler(expire);
    hydrate();
  }, [hydrate, expire]);

  // One socket per signed-in session; wipe cached chats on sign out.
  useEffect(() => {
    if (status === 'signedIn') {
      connectSocket();
      return () => {
        hangupIfActive();
        disconnectSocket();
      };
    }
    if (status === 'signedOut') {
      useChat.getState().reset();
      usePresence.getState().reset();
    }
  }, [status]);

  if (status === 'loading') return <SplashLoader />;
  return <Suspense fallback={<SplashLoader />}>{status === 'signedOut' ? <SignedOut /> : <SignedIn />}</Suspense>;
}

function SignedOut() {
  return (
    <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function SignedIn() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="/login" element={<Navigate to="/chats" replace />} />
        <Route path="/register" element={<Navigate to="/chats" replace />} />
        <Route path="/:section/:userId?" element={<Shell />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>
      <CallScreen />
    </>
  );
}
