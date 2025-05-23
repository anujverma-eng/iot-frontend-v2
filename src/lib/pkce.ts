export function createVerifier(): string {
  const array = new Uint32Array(56/2);
  crypto.getRandomValues(array);
  return Array.from(array, dec => (`0${dec.toString(16)}`).slice(-2)).join('');
}

export async function toChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
