# Frontend Architecture

The desktop app contains two trust levels:

- `electron/`: trusted Electron Main/Preload code, authentication networking, and OS token storage.
- `src/`: sandboxed React renderer code that behaves like a browser application.

## Directory Roles

```text
apps/desktop/
  electron/              # Main, preload, IPC, auth coordinator, token storage
  src/
    api/                 # Generated-client adapter and server-state configuration
    components/          # Reusable UI components
    generated/           # OpenAPI-generated code; never edit by hand
    pages/                # Route-level screens
    schemas/              # Form validation
    stores/               # In-memory client/session state
    styles/               # Global CSS and CSS modules
```

## API Boundary

1. Renderer business code accesses generated operations only through `src/api`.
2. Authentication calls go through the narrow `window.auth` preload API.
3. Refresh tokens never enter the renderer.
4. Configure the generated client once at startup.
5. Inject Access Tokens and perform a single refresh retry in `src/api/http.ts`.
6. Clear the auth store and TanStack Query cache together when a session ends.

## State Rules

- TanStack Query stores remote server state.
- Zustand stores only the current access token, public user, and restoration status.
- Authentication is derived from the actual session fields; no duplicate boolean is stored.
- Module-level promises deduplicate session restore, refresh, and termination operations.

## Electron Security Rules

1. Keep `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
2. Expose specific preload functions, never raw `ipcRenderer`.
3. Validate every privileged IPC sender and payload.
4. Deny unexpected navigation and new windows.
5. Keep a restrictive CSP and allow only the configured API origin.
6. Use Electron `safeStorage` asynchronous APIs for the persisted refresh token.
7. Production builds connect through HTTPS or an explicitly controlled encrypted network path.

## Current Product Scope

Registration asks for email, username, and password. There are no invite-code components, role-based
routes, administrator menus, or user-management screens. Add those only after concrete product and
authorization requirements exist.
