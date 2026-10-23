/** Stops the in-memory MongoDB started by `mongo-global-setup.ts`. */
export default async function globalTeardown(): Promise<void> {
  await globalThis.__E2E_MONGO__?.stop();
}
