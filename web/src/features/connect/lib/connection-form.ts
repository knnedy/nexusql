import { PROVIDERS, type DatabaseProvider } from "@/shared/types/provider";

/** The database a URI names by its scheme, or null while it names none yet. */
export function detectProvider(uri: string): DatabaseProvider | null {
  return PROVIDERS.find((p) => p.uriPrefixes.some((prefix) => uri.startsWith(prefix)))?.id ?? null;
}

export interface ConnectionErrors {
  name?: string;
  uri?: string;
}

/** What is wrong with the form, per field; empty when it can be sent. */
export function validateConnection(form: { name: string; uri: string; provider: DatabaseProvider }): ConnectionErrors {
  const errors: ConnectionErrors = {};
  if (!form.name.trim()) errors.name = "Give the project a name.";
  const meta = PROVIDERS.find((p) => p.id === form.provider)!;
  if (!form.uri.trim()) errors.uri = "Paste a connection URI.";
  else if (!meta.uriPrefixes.some((prefix) => form.uri.startsWith(prefix))) {
    errors.uri = `A ${meta.label} URI starts with ${meta.uriPrefixes.join(" or ")}.`;
  }
  return errors;
}
