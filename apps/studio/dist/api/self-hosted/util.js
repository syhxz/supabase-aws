"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSelfHosted = assertSelfHosted;
exports.encryptString = encryptString;
exports.getConnectionString = getConnectionString;
const crypto_js_1 = __importDefault(require("crypto-js"));
const constants_1 = require("../../constants");
const constants_2 = require("./constants");
/**
 * Asserts that the current environment is self-hosted.
 */
function assertSelfHosted() {
    if (constants_1.IS_PLATFORM) {
        throw new Error('This function can only be called in self-hosted environments');
    }
}
function encryptString(stringToEncrypt) {
    return crypto_js_1.default.AES.encrypt(stringToEncrypt, constants_2.ENCRYPTION_KEY).toString();
}
function getConnectionString({ readOnly, databaseName, }) {
    const postgresUser = readOnly ? constants_2.POSTGRES_USER_READ_ONLY : constants_2.POSTGRES_USER_READ_WRITE;
    const database = databaseName || constants_2.POSTGRES_DATABASE;
    // For pg-meta access, use internal Docker network host and port
    // pg-meta runs inside Docker and needs to connect to 'db:5432'
    const host = constants_2.POSTGRES_HOST === 'localhost' ? 'db' : constants_2.POSTGRES_HOST;
    const port = constants_2.POSTGRES_PORT === '54322' || constants_2.POSTGRES_PORT === 54322 ? 5432 : constants_2.POSTGRES_PORT;
    return `postgresql://${postgresUser}:${constants_2.POSTGRES_PASSWORD}@${host}:${port}/${database}`;
}
