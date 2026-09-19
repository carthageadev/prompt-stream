import React from 'react';
import App from './App';
import CompositionStudio from './components/CompositionStudio';
import PublicStackPage from './components/PublicStackPage';
import SessionEditorPage from './components/sessions/SessionEditorPage';
import SessionsListPage from './components/sessions/SessionsListPage';

const AppRouter: React.FC = () => {
  const [pathname, setPathname] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  if (pathname.startsWith('/s/')) {
    const slug = decodeURIComponent(pathname.replace(/^\/s\//, ''));
    return <PublicStackPage slug={slug} />;
  }

  if (pathname.startsWith('/compose/')) {
    const compositionId = decodeURIComponent(pathname.replace(/^\/compose\//, ''));
    return <CompositionStudio compositionId={compositionId} />;
  }

  if (pathname === '/sessions') {
    return <SessionsListPage />;
  }

  if (pathname.startsWith('/sessions/')) {
    const sessionId = decodeURIComponent(pathname.replace(/^\/sessions\//, ''));
    return <SessionEditorPage sessionId={sessionId} />;
  }

  return <App />;
};

export default AppRouter;
