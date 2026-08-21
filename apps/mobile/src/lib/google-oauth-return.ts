type Listener = () => void;

const listeners = new Set<Listener>();
let pending: string | null = null;

export function deliverGoogleIdToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return;
  pending = trimmed;
  listeners.forEach((listener) => listener());
}

export function consumeGoogleIdToken() {
  const token = pending;
  pending = null;
  return token;
}

export function subscribeGoogleIdToken(listener: Listener) {
  listeners.add(listener);
  if (pending) listener();
  return () => {
    listeners.delete(listener);
  };
}
