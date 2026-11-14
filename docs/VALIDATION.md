# Validation record

Local checks on 9 November 2026:

- TypeScript frontend/backend: passed.
- ESLint: passed.
- Mocked API/engine/provider suite: 28 tests passed; Firebase integration is skipped in the ordinary npm test command unless emulator environment variables are present.
- Firebase Auth and Firestore emulator integration: passed separately. Includes actual registration, verification OOB code, login, authenticated REST alert creation, concurrent transactional queue claims and delivery claims, one mocked email, completed status, user isolation, own-document reads and denied client writes. The emulator logged transaction lock timeouts under intentional concurrency and the SDK retried successfully.
- Production Vite + backend build: passed; dashboard is lazy-loaded. Upstream Zod pure-comment annotations cause harmless Rollup warnings.
- npm audit: zero vulnerabilities after dependency updates/overrides.
- Real Frankfurter adapter: all eight supported pairs and 31 history points returned; no keys required.
- Production HTTP smoke test: homepage and health returned 200, rates endpoint returned eight real rates, historical endpoint returned data.

Not established by these checks: real Firebase cloud configuration/IAM/index readiness, Google OAuth popup on a deployed hostname, actual Resend inbox delivery/bounces, a running hosted scheduler, Docker execution, or browser-rendered desktop/mobile visual/keyboard QA. No browser preview tool was available. No real emails were sent, cloud services provisioned, or app deployed. Configure your project and perform the launch smoke tests in SETUP.md and DEPLOYMENT.md.

The ignored .tools directory contains a portable Temurin Java 21 JRE for local emulator validation. It does not alter system Java. CI uses Java 21 and Node 24.
