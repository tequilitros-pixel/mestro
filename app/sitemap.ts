import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${siteUrl}/tequilitros`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      images: [
        `${siteUrl}/tequilitros/productos/cantarito.png`,
        `${siteUrl}/tequilitros/productos/paloma.png`,
        `${siteUrl}/tequilitros/productos/vampiro.png`,
        `${siteUrl}/tequilitros/productos/tequimojito.png`,
        `${siteUrl}/tequilitros/productos/tequimora.png`,
        `${siteUrl}/tequilitros/productos/tequimiche.png`,
        `${siteUrl}/tequilitros/cantarito.jpg`,
        `${siteUrl}/tequilitros/blanco.jpg`,
        `${siteUrl}/tequilitros/reposado.jpg`,
      ],
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms-of-service`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
