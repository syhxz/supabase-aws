"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSnakeCase = void 0;
exports.constructHeaders = constructHeaders;
exports.fromNodeHeaders = fromNodeHeaders;
exports.zBooleanString = zBooleanString;
exports.commaSeparatedStringIntoArray = commaSeparatedStringIntoArray;
const constants_1 = require("lib/constants");
const lodash_1 = require("lodash");
const zod_1 = __importDefault(require("zod"));
/**
 * Construct headers for api request.
 * For platform, it will include apiKey into the provided headers.
 *
 * To prevent relay frontend request headers like useragent, referrer... into the middleware requests.
 * We will only keep the header keys that are in this list: Accept, Authorization, Content-Type, x-connection-encrypted
 */
function constructHeaders(headers) {
    if (headers) {
        const cleansedHeaders = {
            Accept: headers.Accept,
            Authorization: headers.Authorization,
            cookie: headers.cookie,
            'Content-Type': headers['Content-Type'],
            'x-connection-encrypted': headers['x-connection-encrypted'],
        };
        // clean up key with underfined value
        Object.keys(cleansedHeaders).forEach((key) => cleansedHeaders[key] === undefined ? delete cleansedHeaders[key] : {});
        return {
            ...cleansedHeaders,
            ...(constants_1.IS_PLATFORM
                ? { apiKey: `${process.env.READ_ONLY_API_KEY}` }
                : { apiKey: `${process.env.SUPABASE_SERVICE_KEY}` }),
        };
    }
    else {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
    }
}
// Typically for HTTP payloads
// @ts-ignore
const toSnakeCase = (object) => {
    const snakeCaseObject = {};
    const snakeCaseArray = [];
    if (!object)
        return null;
    if (Array.isArray(object)) {
        for (const item of object) {
            if (typeof item === 'object') {
                snakeCaseArray.push((0, exports.toSnakeCase)(item));
            }
            else {
                snakeCaseArray.push(item);
            }
        }
        return snakeCaseArray;
    }
    else if (typeof object === 'object') {
        for (const key of Object.keys(object)) {
            if (typeof object[key] === 'object') {
                // @ts-ignore
                snakeCaseObject[(0, lodash_1.snakeCase)(key)] = (0, exports.toSnakeCase)(object[key]);
            }
            else {
                // @ts-ignore
                snakeCaseObject[(0, lodash_1.snakeCase)(key)] = object[key];
            }
        }
        return snakeCaseObject;
    }
    else {
        return object;
    }
};
exports.toSnakeCase = toSnakeCase;
/**
 * Converts Node.js `IncomingHttpHeaders` to Fetch API `Headers`.
 */
function fromNodeHeaders(nodeHeaders) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(nodeHeaders)) {
        if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
        }
        else if (value !== undefined) {
            headers.append(key, value);
        }
    }
    return headers;
}
/**
 * Zod transformer to parse boolean values from strings.
 *
 * Use when accepting a boolean value in a query parameter.
 */
function zBooleanString(errorMsg) {
    return zod_1.default.string().transform((value, ctx) => {
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        ctx.addIssue({
            code: zod_1.default.ZodIssueCode.custom,
            message: errorMsg || 'must be a boolean string',
        });
        return zod_1.default.NEVER;
    });
}
/**
 * Transform a comma-separated string into an array of strings.
 *
 * Use when accepting a list of values in a query parameter.
 */
function commaSeparatedStringIntoArray(value) {
    return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
}
