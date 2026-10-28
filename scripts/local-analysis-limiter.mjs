const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

export function createLocalAnalysisLimiter({
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
  now = () => performance.now(),
} = {}) {
  const requests = [];

  return {
    async limit() {
      const currentTime = now();
      while (requests.length && currentTime - requests[0] >= windowMs)
        requests.shift();
      if (requests.length >= maxRequests) return { success: false };
      requests.push(currentTime);
      return { success: true };
    },
  };
}
