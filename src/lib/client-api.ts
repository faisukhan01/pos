// Small typed fetch wrapper for client components.
// Always reads { error } responses and throws friendly Error objects.

async function handle<T>(res: Response): Promise<T> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg =
      (body as { error?: string } | null)?.error ||
      (res.status === 401
        ? 'Please sign in to continue.'
        : res.status >= 500
          ? 'Something went wrong on our side. Please try again.'
          : 'The request could not be completed.')
    throw new Error(msg)
  }
  return body as T
}

export const api = {
  get: <T>(url: string) => fetch(url, { cache: 'no-store' }).then((r) => handle<T>(r)),
  post: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  put: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  del: <T>(url: string) => fetch(url, { method: 'DELETE' }).then((r) => handle<T>(r)),
}
