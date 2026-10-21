const rawDomain = process.env["EXPO_PUBLIC_DOMAIN"];
const rawApiUrl = process.env["EXPO_PUBLIC_API_URL"] || process.env["EXPO_PUBLIC_API_BASE_URL"];

const formatHost = (value: string) => {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return value.includes("localhost") ? `http://${value}` : `https://${value}`;
};

export const API_BASE_URL = rawDomain
  ? (() => {
      if (rawApiUrl) return formatHost(rawApiUrl);

      const normalizedDomain = formatHost(rawDomain);
      // In local web dev, EXPO_PUBLIC_DOMAIN may point at the web app host (808x).
      // API routes live on port 3000, so force that host/port unless explicitly overridden.
      if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedDomain)) {
        return "http://localhost:3000";
      }

      return normalizedDomain;
    })()
  : formatHost(rawApiUrl || "http://localhost:3000");
