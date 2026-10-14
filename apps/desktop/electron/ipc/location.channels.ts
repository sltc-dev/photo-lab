export const locationIpcChannels = {
  requestAccess: 'location:request-access',
  revokeAccess: 'location:revoke-access',
} as const;

export type DesktopLocationControl = {
  /** 允许当前窗口定位，并在需要时弹出系统授权框；返回系统是否已授权。 */
  requestAccess: () => Promise<boolean>;
  revokeAccess: () => Promise<void>;
};
