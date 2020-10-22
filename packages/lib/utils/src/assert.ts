// tslint:disable: no-any no-use-before-declare

import BigNumber from "bignumber.js";

export const assert = (
    assertion: boolean,
    sentence?: string,
): assertion is true => {
    if (!assertion) {
        throw new Error(`Failed assertion${sentence ? `: ${sentence}` : ""}`);
    }
    return true;
};

/**
 * The following is a set of rudimentary type validation functions.
 *
 * The main function is `assertType`, which accepts a type and a dictionary of
 * values.
 *
 * The type must be a string that matches the following pattern:
 *
 * ```
 * TYPE:
 *   | TYPE '|' TYPE
 *   | Array<TYPE>
 *   | TYPE[]
 *   | PRIMITIVE_TYPE
 *
 * PRIMITIVE_TYPE:
 *   | "string"
 *   | "number"
 *   | "bigint"
 *   | "boolean"
 *   | "symbol"
 *   | "undefined"
 *   | "object"
 *   | "function"
 *   | "null"
 *   | "any"
 *   | "Buffer"
 *   | "BigNumber"
 * ```
 *
 * Types are matched by a regex so '|' can't be used at multiple levels, e.g.
 * `string | Array<string | number>`.
 */
export const assertType = <
    // Type extends string,
    // T = Type extends "Buffer" ? Buffer : any
    T = any
>(
    type: string,
    objects: {
        [value: string]: T;
    },
): objects is { [value: string]: T } => {
    if (isArrayType(type)) {
        return assertArray(
            type,
            (objects as unknown) as { [value: string]: T[] },
        );
    }
    if (isUnionType(type)) {
        return assertTypeUnion(type, objects);
    }

    return assertTypeCheck(is(type as PrimitiveTypeName), objects, type);
};

type PrimitiveTypeName =
    | "string"
    | "number"
    | "bigint"
    | "boolean"
    | "symbol"
    | "undefined"
    | "object"
    | "function"
    | "null"
    | "any"
    | "BigNumber"
    | "Buffer";

const typeOf = (v: any): PrimitiveTypeName =>
    v === null
        ? "null"
        : BigNumber.isBigNumber(v)
        ? "BigNumber"
        : Buffer.isBuffer(v)
        ? "Buffer"
        : typeof v;

const assertTypeCheck = <T = any>(
    type: (t: any, key: string) => boolean,
    objects: {
        [value: string]: T;
    },
    typeDescription: string,
): objects is { [value: string]: T } => {
    for (const key of Object.keys(objects)) {
        const value = objects[key];
        if (!type(value, key)) {
            const readableType = Array.isArray(value) ? "any[]" : typeOf(value);
            throw new Error(
                `Expected ${key} to be of type '${typeDescription}', instead got '${readableType}'.`,
            );
        }
    }
    return true;
};

const is = (type: PrimitiveTypeName) => (v: any) =>
    type === "any" ? true : typeOf(v) === type;

const isUnionType = (unionType: string): string[] | false => {
    const types = unionType.split(" | ") as PrimitiveTypeName[];
    return types.length > 1 ? types : false;
};

const isArrayType = (arrayType: string): string | false => {
    // Check with simple string operations to avoid running slow RegExs if there
    // isn't a match.

    const isArray =
        arrayType.slice(0, 6) === "Array<" && arrayType.slice(-1) === ">";

    if (isArray) {
        const arrayMatch = arrayType.match(/^Array<(.*)>$/);
        if (arrayMatch) {
            let type: string;
            [, type] = arrayMatch;
            return type;
        }
    }

    const isBracketArray =
        arrayType.indexOf(" ") === -1 && arrayType.slice(-2) === "[]";
    if (isBracketArray) {
        const bracketMatch = arrayType.match(/^([^ ]*)\[\]$/);
        if (bracketMatch) {
            let type: string;
            [, type] = bracketMatch;
            return type;
        }
    }
    return false;
};

const assertTypeUnion = <T = any>(
    unionType: string,
    objects: {
        [value: string]: T;
    },
): objects is { [value: string]: T } => {
    const types = unionType.split(" | ") as PrimitiveTypeName[];
    return assertTypeCheck(
        (v, key) =>
            types.reduce<boolean>((acc, type) => {
                if (acc) {
                    return acc;
                }
                if (isArrayType(type)) {
                    try {
                        assertArray(type, { [key]: v });
                        return true;
                    } catch (error) {
                        return false;
                    }
                }
                return is(type)(v);
            }, false),
        objects,
        unionType,
    );
};

const assertArray = <T = any>(
    arrayType: string,
    objects: {
        [value: string]: T[];
    },
): objects is { [value: string]: T[] } => {
    const type = isArrayType(arrayType);
    if (!type) {
        throw new Error(`Invalid array type ${arrayType}`);
    }

    for (const key of Object.keys(objects)) {
        const value = objects[key];
        assertTypeCheck((v: any) => Array.isArray(v), { value }, "any[]");

        for (let i = 0; i < value.length; i++) {
            assertType(type, { [`${key}[${i}]`]: value[i] });
        }
    }
    return true;
};

type ObjectDefinition = { [key: string]: string | ObjectDefinition };

export const assertObject = <T extends { [key: string]: any }>(
    fieldTypes: ObjectDefinition,
    objects: {
        [value: string]: T;
    },
): boolean => {
    for (const key of Object.keys(objects)) {
        const value = objects[key];

        for (const field of Object.keys(fieldTypes)) {
            if (typeof fieldTypes[field] === "object") {
                assertObject(fieldTypes[field] as ObjectDefinition, {
                    [`${key}["${field}"]`]: value[field],
                });
            } else if (typeof fieldTypes[field] === "string") {
                assertType(fieldTypes[field] as string, {
                    [`${key}["${field}"]`]: value[field],
                });
            } else {
                throw new Error(
                    `Invalid object type definition ${typeof fieldTypes[
                        field
                    ]}`,
                );
            }
        }
    }
    return true;
};
