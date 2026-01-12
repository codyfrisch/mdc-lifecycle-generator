interface WebhookResult {
  success: boolean;
  status: number;
  statusText: string;
  body: string;
  error?: string;
}

/**
 * Send webhook event via the Vite dev server proxy.
 * This bypasses CORS restrictions by making the request server-side.
 * In production, monday.com sends webhooks from their backend where CORS isn't a concern.
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  jwt: string,
): Promise<WebhookResult> {
  try {
    // Use the Vite dev server proxy to avoid CORS issues
    const response = await fetch("/api/webhook-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUrl: url,
        payload,
        jwt,
      }),
    });

    // The proxy returns the result as JSON
    const result = (await response.json()) as WebhookResult;
    return result;
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: "Network Error",
      body: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
