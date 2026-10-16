// Creates or updates the tables. Safe to run any number of times.
import { sql } from "../src/db.ts";

const schema = await Deno.readTextFile(new URL("../db/schema.sql", import.meta.url));
await sql.unsafe(schema);
console.log("Database schema is up to date.");
await sql.end();
