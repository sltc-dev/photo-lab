import { createRequire } from 'node:module';

/** CLAuthorizationStatus 的取值，见 CoreLocation/CLLocationManager.h。 */
const enum MacLocationStatus {
  NotDetermined = 0,
  Restricted = 1,
  Denied = 2,
  AuthorizedAlways = 3,
  AuthorizedWhenInUse = 4,
}

export type MacLocationManager = {
  getStatus: () => number;
  /** 弹出系统授权框，在用户做出选择后返回新的授权状态。 */
  requestWhenInUse: () => Promise<number>;
};

const PROMPT_TIMEOUT_MS = 120_000;

let macLocationManager: MacLocationManager | null = null;

/**
 * macOS 上 Chromium 不会自己向系统申请定位授权，未决定状态下请求会一直挂到超时；
 * 因此在页面定位之前先由这里弹出系统授权框，并等待用户做出选择。
 */
export async function ensureSystemLocationAccess(
  platform: NodeJS.Platform = process.platform,
  load: () => MacLocationManager = loadMacLocationManager,
): Promise<boolean> {
  // Windows 等平台由操作系统和 Chromium 自行处理定位授权。
  if (platform !== 'darwin') return true;

  const manager = load();
  const status = manager.getStatus();
  if (status !== MacLocationStatus.NotDetermined) return isAuthorized(status);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<number>((resolve) => {
    timer = setTimeout(() => resolve(manager.getStatus()), PROMPT_TIMEOUT_MS);
  });
  try {
    return isAuthorized(await Promise.race([manager.requestWhenInUse(), timeout]));
  } finally {
    clearTimeout(timer);
  }
}

/** 同步读取系统授权状态，供 Chromium 的权限检查使用；不会弹窗。 */
export function isSystemLocationAuthorized(
  platform: NodeJS.Platform = process.platform,
  load: () => MacLocationManager = loadMacLocationManager,
): boolean {
  if (platform !== 'darwin') return true;

  try {
    return isAuthorized(load().getStatus());
  } catch {
    return false;
  }
}

function isAuthorized(status: number): boolean {
  return (
    status === MacLocationStatus.AuthorizedAlways ||
    status === MacLocationStatus.AuthorizedWhenInUse
  );
}

/** 通过 Objective-C 运行时调用 CoreLocation，必须在 Electron 主线程上执行。 */
function loadMacLocationManager(): MacLocationManager {
  if (macLocationManager) return macLocationManager;

  const koffi = createRequire(import.meta.url)('koffi') as typeof import('koffi');
  const objc = koffi.load('/usr/lib/libobjc.A.dylib');
  koffi.load('/System/Library/Frameworks/CoreLocation.framework/CoreLocation');

  const getClass = objc.func('void *objc_getClass(const char *name)');
  const selector = objc.func('void *sel_registerName(const char *name)');
  const allocateClassPair = objc.func(
    'void *objc_allocateClassPair(void *superclass, const char *name, size_t extraBytes)',
  );
  const registerClassPair = objc.func('void objc_registerClassPair(void *cls)');
  const DidChangeAuthorization = koffi.proto(
    'void DidChangeAuthorization(void *self, void *op, void *manager)',
  );
  const addMethod = objc.func(
    'bool class_addMethod(void *cls, void *name, DidChangeAuthorization *imp, const char *types)',
  );
  const sendObject = objc.func('void *objc_msgSend(void *self, void *op)');
  const sendInt = objc.func('int objc_msgSend(void *self, void *op)');
  const sendVoid = objc.func('void objc_msgSend(void *self, void *op)');
  const sendVoidWithObject = objc.func('void objc_msgSend(void *self, void *op, void *arg)');

  const managerClass: unknown = getClass('CLLocationManager');
  if (!managerClass) throw new Error('CoreLocation is unavailable.');

  const authorizationStatus = selector('authorizationStatus');
  const getStatus = () => sendInt(managerClass, authorizationStatus) as number;
  const waiters: Array<(status: number) => void> = [];

  // 用户在系统授权框里做出选择后，macOS 通过主线程消息循环调用 locationManagerDidChangeAuthorization:。
  const onAuthorizationChange = koffi.register(() => {
    const status = getStatus();
    if (status === MacLocationStatus.NotDetermined) return;
    for (const resolve of waiters.splice(0)) resolve(status);
  }, koffi.pointer(DidChangeAuthorization));

  const delegateClass: unknown = allocateClassPair(
    getClass('NSObject'),
    'PhotoLabLocationDelegate',
    0,
  );
  addMethod(
    delegateClass,
    selector('locationManagerDidChangeAuthorization:'),
    onAuthorizationChange,
    'v@:@',
  );
  registerClassPair(delegateClass);

  // manager 和 delegate 在授权框存在期间不能被释放，否则 macOS 会关闭弹窗；这里持有到进程结束。
  const delegate: unknown = sendObject(
    sendObject(delegateClass, selector('alloc')),
    selector('init'),
  );
  const instance: unknown = sendObject(
    sendObject(managerClass, selector('alloc')),
    selector('init'),
  );
  sendVoidWithObject(instance, selector('setDelegate:'), delegate);
  const requestWhenInUseAuthorization = selector('requestWhenInUseAuthorization');

  macLocationManager = {
    getStatus,
    requestWhenInUse: () =>
      new Promise((resolve) => {
        waiters.push(resolve);
        sendVoid(instance, requestWhenInUseAuthorization);
      }),
  };
  return macLocationManager;
}
