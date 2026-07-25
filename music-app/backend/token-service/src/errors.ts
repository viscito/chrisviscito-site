/** A structured API error mapped to the error model in ../../TOKEN_SERVICE.md §5.6. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export const Errors = {
  unauthenticated: () => new ApiError(401, "unauthenticated", "Missing or invalid Crossfade session"),
  invalidUserToken: () => new ApiError(400, "invalid_user_token", "Apple rejected the Music User Token"),
  insufficientPlan: () => new ApiError(402, "insufficient_plan", "This action needs an active subscription"),
  notConnected: () => new ApiError(404, "not_connected", "This service is not connected"),
  rateLimited: (retryAfter: number) =>
    new ApiError(429, "rate_limited", "Too many requests", { retryAfter }),
  upstreamApple: (detail?: string) =>
    new ApiError(502, "upstream_apple_error", detail ?? "Apple Music API error"),
  badRequest: (message: string) => new ApiError(400, "bad_request", message),
};
