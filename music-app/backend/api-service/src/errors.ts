/** Structured API error — same model as the token-service (openapi.yaml §Error). */
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
  badRequest: (m: string) => new ApiError(400, "bad_request", m),
  notFound: (what = "Resource") => new ApiError(404, "not_found", `${what} not found`),
  notConnected: () => new ApiError(404, "not_connected", "This service is not connected"),
  insufficientPlan: () => new ApiError(402, "insufficient_plan", "This action needs an active subscription"),
  notSynced: () => new ApiError(409, "not_synced", "This playlist is not an imported/synced playlist"),
};
