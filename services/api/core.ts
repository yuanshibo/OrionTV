import Logger from "@/utils/Logger";

export const NETWORK_STATUS_ZERO_MESSAGE = "Network request failed (status 0)";
export const NETWORK_STATUS_ZERO_ERROR_NAME = "NetworkStatusZeroError";

export const isNetworkStatusZeroError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === NETWORK_STATUS_ZERO_ERROR_NAME) {
    return true;
  }

  if (error.message === NETWORK_STATUS_ZERO_MESSAGE) {
    return true;
  }

  return /status provided \(0\)/i.test(error.message);
};

const logger = Logger.withTag("API");

const isStatusZeroRangeError = (error: unknown): error is RangeError =>
  error instanceof RangeError && /status provided \(0\)/i.test(error.message);

const createNetworkStatusZeroError = (cause?: unknown): Error => {
  const networkError = new Error(NETWORK_STATUS_ZERO_MESSAGE);
  networkError.name = NETWORK_STATUS_ZERO_ERROR_NAME;
  if (cause) {
    (networkError as any).cause = cause;
  }
  return networkError;
};

export class ApiClient {
  public baseURL: string = "";

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }
  }

  public setBaseUrl(url: string) {
    this.baseURL = url;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.baseURL) {
      throw new Error("API_URL_NOT_SET");
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseURL}${url}`, options);
    } catch (error) {
      if (isStatusZeroRangeError(error)) {
        logger.warn(
          `[WARN] fetch failed with status 0 for ${url} (baseURL: ${this.baseURL}), treating as network error`
        );
        throw createNetworkStatusZeroError(error);
      }
      throw error;
    }

    if (response.status === 0) {
      logger.warn(
        `[WARN] fetch resolved with status 0 for ${url} (baseURL: ${this.baseURL}), treating as network error`
      );
      throw createNetworkStatusZeroError();
    }

    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }
}
