"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgMetaDatabaseError = exports.databaseErrorSchema = void 0;
const v4_1 = __importDefault(require("zod/v4"));
exports.databaseErrorSchema = v4_1.default.object({
    message: v4_1.default.string(),
    code: v4_1.default.string(),
    formattedError: v4_1.default.string(),
});
class PgMetaDatabaseError extends Error {
    constructor(message, code, statusCode, formattedError) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.formattedError = formattedError;
        this.name = 'PgMetaDatabaseError';
    }
}
exports.PgMetaDatabaseError = PgMetaDatabaseError;
