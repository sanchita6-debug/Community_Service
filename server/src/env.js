/**
 * Environment bootstrap.
 * ---------------------------------------------------------------------------
 * VoicePay keeps ONE `.env` file, in the repo root, shared by the client and
 * the API. That is deliberate: two files is two places to forget half of.
 *
 * `dotenv/config` on its own would only find `.env` relative to the process
 * cwd, so running the API from inside `server/` would silently fall back to
 * running with no configuration at all. Loading the path explicitly makes it
 * cwd-independent.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '..', '..', '.env');

// A missing .env is a supported state, not an error: the app runs on
// localStorage plus the API's in-memory store. See .env.example.
dotenv.config({ path: rootEnv });
