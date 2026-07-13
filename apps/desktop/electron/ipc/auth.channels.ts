export type DesktopAuthUser = {
  createdAt: string;
  email: string;
  id: string;
  updatedAt: string;
  username: string;
};

export type DesktopAuthSession = {
  // 故意没有 refreshToken：这个类型定义了允许跨进程返回给 React 的最小会话。
  accessToken: string;
  user: DesktopAuthUser;
};

export type DesktopLoginInput = {
  email: string;
  password: string;
};

export type DesktopRegisterInput = DesktopLoginInput & {
  username: string;
};

export const authIpcChannels = {
  // 集中定义频道名，避免 preload 和 main 使用不同字符串而静默失联。
  login: 'auth.login',
  logoutSession: 'auth.logoutSession',
  register: 'auth.register',
  refreshSession: 'auth.refreshSession',
} as const;

export type DesktopAuthApi = {
  login: (input: DesktopLoginInput) => Promise<DesktopAuthSession>;
  logoutSession: () => Promise<void>;
  register: (input: DesktopRegisterInput) => Promise<DesktopAuthSession>;
  refreshSession: () => Promise<DesktopAuthSession>;
};
