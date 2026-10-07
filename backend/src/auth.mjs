import "dotenv/config";
import pg from "pg";
import { createCustomerAuth } from "./auth-config.mjs";
import { createDelivery } from "./auth-delivery.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for authentication");
export const authDatabase = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export const delivery = createDelivery();
export const auth = createCustomerAuth({ database: authDatabase, delivery });
