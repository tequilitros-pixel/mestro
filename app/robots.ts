import type { MetadataRoute } from "next";

const siteUrl = "https://www.destiladoradelnorte.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/tequilitros", "/privacy-policy", "/terms-of-service"],
        disallow: [
          "/administration/",
          "/api/",
          "/pospress/",
          "/timeclock/",
          "/liquors/",
          "/cash-cuts/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
