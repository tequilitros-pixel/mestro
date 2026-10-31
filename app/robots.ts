import type { MetadataRoute } from "next";

const siteUrl = "https://www.destiladoradelnorte.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/tequilitros", "/TequilaElColotlense", "/privacy-policy", "/terms-of-service", "/llms.txt"],
        disallow: [
          "/administration/",
          "/api/",
          "/pospress/",
          "/timeclock/",
          "/liquors/",
          "/cash-cuts/",
        ],
      },
      {
        userAgent: [
          "GPTBot",
          "PerplexityBot",
          "ClaudeBot",
          "Claude-Web",
          "Google-Extended",
          "Applebot",
          "Applebot-Extended",
          "Bingbot",
        ],
        allow: ["/tequilitros", "/TequilaElColotlense", "/llms.txt"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
