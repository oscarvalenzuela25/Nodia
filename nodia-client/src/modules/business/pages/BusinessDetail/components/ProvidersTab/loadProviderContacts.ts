export type ProviderContactsModule = typeof import("./components/ProviderContacts");
export type ProviderContactsLoader = () => Promise<ProviderContactsModule>;

/** Share a successful import; a rejected download must permit a local retry. */
export const createProviderContactsLoader = (
  importModule: ProviderContactsLoader = () => import("./components/ProviderContacts"),
): ProviderContactsLoader => {
  let pending: Promise<ProviderContactsModule> | undefined;
  return () => {
    pending ??= importModule().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
};

export const loadProviderContacts = createProviderContactsLoader();
