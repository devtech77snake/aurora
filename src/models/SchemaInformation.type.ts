import type { DMMF } from '@prisma/client/runtime';
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper';

export type SchemaInformation = {
  models: DMMF.Model[];
  enums: DMMF.DatamodelEnum[];
  datasources: DataSource[];
  generators: GeneratorConfig[];
};
