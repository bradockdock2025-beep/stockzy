import { registerDecorator, ValidationOptions, isURL } from 'class-validator';

/**
 * Aceita URL absoluta (https://...) OU caminho interno da loja (/new-arrivals) — usado em
 * campos de link que apontam tanto pra fora quanto pra rotas do próprio site. `@IsUrl()`
 * sozinho rejeita caminho interno (exige protocolo), o que quebrava a criação de anúncio
 * pra rota interna.
 */
export function IsUrlOrInternalPath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUrlOrInternalPath',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }
          // Caminho interno: começa com "/" mas não "//" (evita URL protocol-relative disfarçada de caminho)
          if (value.startsWith('/') && !value.startsWith('//')) {
            return true;
          }
          return isURL(value, { require_protocol: true });
        },
        defaultMessage() {
          return '$property must be a valid URL or an internal path starting with /';
        },
      },
    });
  };
}
