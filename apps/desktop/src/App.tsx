import { useEffect, type ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { selectIsAuthenticated, useAuthStore } from './stores/auth.store';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    // 应用启动时尝试用主进程保存的 Refresh Token 恢复会话。
    void restoreSession();
  }, [restoreSession]);

  return (
    <HashRouter>
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
              <HomePage />
            </RequireAuth>
          }
          path="/"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
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
