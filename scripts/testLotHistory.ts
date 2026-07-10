import "dotenv/config";
import { analyzeLotHistory } from "../lib/brain/analyzeLotHistory";

async function main() {
  const result = await analyzeLotHistory();
  console.log(JSON.stringify(result, null, 2));
}

main();
