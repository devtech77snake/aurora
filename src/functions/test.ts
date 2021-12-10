
   
import {
    ConnectorType,
    DataSource,
    DMMF,
    EnvValue,
    GeneratorConfig
  } from '@prisma/generator-helper/dist';
function valueIs(value: any, types: any[]) {
    return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}
const renderAttribute = (field: DMMF.Field): Record<string, any> => {
    const { kind, type } = field;
    return {
      default: (value: any) => {
        if (value == null || value == undefined) return '';
        // convert value to a string, only if kind is scalar and NOT a BigInt
        if (kind === 'scalar' && type !== 'BigInt' && typeof value == 'string') value = `"${value}"`;
        // if number, string or boolean we are ready to return!
        if (valueIs(value, [Number, String, Boolean]) || kind === 'enum') return `@default(${value})`;
        // haven't yet found where this is actually useful — will get back on that
        if (typeof value === 'object') return `@default(${value.name}(${value.args}))`;
  
        throw new Error(`Prismix: Unsupported field attribute ${value}`);
      },
      isId: (value: any) => (value ? '@id' : ''),
      isUnique: (value: any) => (value ? '@unique' : ''),
      isUpdatedAt: (value: any) => (value ? '@updatedAt' : ''),
      columnName: (value: any) => (value ? `@map("${value}")` : '')
    };
  };
  
  // Render a line of field attributes
  function renderAttributes(field: DMMF.Field): string {
    const { relationFromFields, relationToFields, relationName, kind } = field;
    // handle attributes for scalar and enum fields
    if (kind == 'scalar' || kind == 'enum') {
      return `${Object.keys(field)
        // if we have a method defined above with that property, call the method
        .map(
          (property) =>
            renderAttribute(field)[property] && renderAttribute(field)[property](field[property])
        )
        // filter out empty strings
        .filter((x) => !!x)
        .join(' ')}`;
    }
    // handle relation syntax
    if (relationFromFields && kind === 'object') {
      return relationFromFields.length > 0
        ? `@relation(name: "${relationName}", fields: [${relationFromFields}], references: [${relationToFields}])`
        : `@relation(name: "${relationName}")`;
    }
    return '';
  }
  
  // render all fields present on a model
  function renderModelFields(fields: DMMF.Field[]): string[] {
    return fields.map((field) => {
      const { name, kind, type, isRequired, isList } = field;
  
      if (kind == 'scalar')
        return `${name} ${type}${isRequired ? '' : '?'} ${renderAttributes(field)}`;
  
      if (kind == 'object' || kind == 'enum')
        return `${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${renderAttributes(field)}`;
  
      throw new Error(`Prismix: Unsupported field kind "${kind}"`);
    });
  }
  
  function renderIdFieldsOrPrimaryKey(idFields: string[]): string {
    // as of Prisma version ^2.30.0 idFields has become primaryKey, we should support both
    if (!idFields) return ''; // <- this is a hotfix until it can be looked into
    return idFields.length > 0 ? `@@id([${idFields.join(', ')}])` : '';
  }
  function renderUniqueFields(uniqueFields: string[][]): string[] {
    return uniqueFields.length > 0
      ? uniqueFields.map((eachUniqueField) => `@@unique([${eachUniqueField.join(', ')}])`)
      : [];
  }
  function renderDbName(dbName: string | null): string {
    return dbName ? `@@map("${dbName}")` : '';
  }
  function renderUrl(envValue: EnvValue): string {
    const value = envValue.fromEnvVar ? `env("${envValue.fromEnvVar}")` : `"${envValue.value}"`;
  
    return `url = ${value}`;
  }
  function renderProvider(provider: ConnectorType | string): string {
    return `provider = "${provider}"`;
  }
  function renderOutput(path: string | null): string {
    return path ? `output = "${path}"` : '';
  }
  function renderBinaryTargets(binaryTargets?: string[]): string {
    return binaryTargets?.length ? `binaryTargets = ${JSON.stringify(binaryTargets)}` : '';
  }
  function renderPreviewFeatures(previewFeatures: GeneratorConfig['previewFeatures']): string {
    return previewFeatures.length ? `previewFeatures = ${JSON.stringify(previewFeatures)}` : '';
  }
  
  // This function will render a code block with suitable indenting
  function renderBlock(type: string, name: string, things: string[]): string {
    return `${type} ${name} {\n${things
      .filter((thing) => thing.length > 1)
      .map((thing) => `\t${thing}`)
      .join('\n')}\n}`;
  }
  
  function deserializeModel(model: DMMF.Model): string {
    const { name, fields, uniqueFields, dbName, idFields, primaryKey } = model;
    return renderBlock('model', name, [
      ...renderModelFields(fields),
      ...renderUniqueFields(uniqueFields),
      renderDbName(dbName),
      renderIdFieldsOrPrimaryKey(idFields || primaryKey?.fields)
    ]);
  }
  
  function deserializeDatasource(datasource: DataSource): string {
    const { activeProvider: provider, name, url } = datasource;
    return renderBlock('datasource', name, [renderProvider(provider), renderUrl(url)]);
  }
  
  function deserializeGenerator(generator: GeneratorConfig): string {
    const { binaryTargets, name, output, provider, previewFeatures } = generator;
    return renderBlock('generator', name, [
      renderProvider(provider.value),
      renderOutput(output?.value || null),
      renderBinaryTargets(binaryTargets as unknown as string[]),
      renderPreviewFeatures(previewFeatures)
    ]);
  }
  
  function deserializeEnum({ name, values, dbName }: DMMF.DatamodelEnum) {
    const outputValues = values.map(({ name, dbName }) => {
      let result = name;
      if (name !== dbName && dbName) result += `@map("${dbName}")`;
      return result;
    });
    return renderBlock('enum', name, [...outputValues, renderDbName(dbName || null)]);
  }
  
  // Exportable methods
  export async function deserializeModels(models: DMMF.Model[]) {
    return models.map((model) => deserializeModel(model)).join('\n');
  }
  export async function deserializeDatasources(datasources: DataSource[]) {
    return datasources.map((datasource) => deserializeDatasource(datasource)).join('\n');
  }
  export async function deserializeGenerators(generators: GeneratorConfig[]) {
    return generators.map((generator) => deserializeGenerator(generator)).join('\n');
  }
  export async function deserializeEnums(enums: DMMF.DatamodelEnum[]) {
    return enums.map((each) => deserializeEnum(each)).join('\n');
  }