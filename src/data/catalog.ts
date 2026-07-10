import rawCatalog from "./generated/catalog.json";
import { catalogSchema } from "./schema";
import type { Catalog } from "../domain/types";

export const catalog = catalogSchema.parse(rawCatalog) as Catalog;
