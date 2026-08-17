import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { selectIsAuthenticated, useAuthStore } from './stores/auth.store';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectPhotosPage } from './pages/ProjectPhotosPage';
import { RegisterPage } from './pages/RegisterPage';
import { MaterialUsersPage } from './pages/MaterialUsersPage';
import { MaterialUserProjectsPage } from './pages/MaterialUserProjectsPage';
import { MaterialProjectPhotosPage } from './pages/MaterialProjectPhotosPage';
import { FavoritesPage } from './pages/FavoritesPage';

const PhotoEditorPage = lazy(() =>
  import('./pages/PhotoEditorPage').then((module) => ({ default: module.PhotoEditorPage })),
);

export function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    // 应用启动时尝试用主进程保存的 Refresh Token 恢复会话。
    void restoreSession();
  }, [restoreSession]);

  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
            path="/login"
          />
          <Route
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
            path="/register"
          />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route element={<HomePage />} path="/" />
            <Route element={<ProjectPhotosPage />} path="/projects/:projectId" />
            <Route element={<PhotoEditorPage />} path="/projects/:projectId/photos/:photoId/edit" />
            <Route element={<MaterialUsersPage />} path="/materials" />
            <Route element={<MaterialUserProjectsPage />} path="/materials/users/:userId" />
            <Route
              element={<MaterialProjectPhotosPage />}
              path="/materials/users/:userId/projects/:projectId"
            />
            <Route element={<FavoritesPage />} path="/favorites" />
            <Route element={<ProfilePage />} path="/profile" />
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (status === 'restoring') {
    // 恢复结果出来前不跳登录页，避免界面先闪一下再回首页。
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return children;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (status === 'restoring') {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    // 已登录用户访问登录/注册页时直接回到工作台。
    return <Navigate replace to="/" />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <Center mih="100vh">
      <Loader />
    </Center>
  );
}
