/**
 * Send webhook event as HTTP POST request
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  jwt: string,
): Promise<{
  success: boolean;
  status: number;
  statusText: string;
  body: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: jwt,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
    };
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
