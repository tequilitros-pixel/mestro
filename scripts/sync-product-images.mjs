import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.MAESTRO_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL en .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const IMAGE_MAPPINGS = [
  { names: ["vampiro"], icon: "/tequilitros/productos/vampiro.png" },
  { names: ["paloma"], icon: "/tequilitros/productos/paloma.png" },
  { names: ["cantarito"], icon: "/tequilitros/productos/cantarito.png" },
  { names: ["tequimiche"], icon: "/tequilitros/productos/tequimiche.png" },
  { names: ["tequimora"], icon: "/tequilitros/productos/tequimora.png" },
  { names: ["tequimojito"], icon: "/tequilitros/productos/tequimojito.png" },
  { names: ["mango", "tequimango"], icon: "/tequilitros/tequimango.jpg" },
  { names: ["blanco"], icon: "/tequilitros/blanco.jpg" },
  { names: ["reposado"], icon: "/tequilitros/reposado.jpg" },
  { names: ["zarzamora"], icon: "/tequilitros/zarzamora.jpg" },
  { names: ["coscorrón", "coscorron"], icon: "/tequilitros/cantarito.jpg" },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log("🍹 Asignando imágenes oficiales a los productos de Tequilitros...");
    for (const mapping of IMAGE_MAPPINGS) {
      const res = await client.query(
        `UPDATE "PosProduct" SET "icon" = $1 WHERE LOWER(name) = ANY($2::text[]) RETURNING name`,
        [mapping.icon, mapping.names]
      );
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✓ ${res.rows.map((r) => r.name).join(", ")} → ${mapping.icon}`);
      }
    }
    console.log("✨ Imágenes oficiales asignadas en la base de datos.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error sincronizando imágenes:", err);
  process.exit(1);
});
