/**
 * BetterAuth API Route Handler
 *
 * This route handles all BetterAuth endpoints:
 * - /api/auth/signin
 * - /api/auth/signup
 * - /api/auth/signout
 * - /api/auth/session
 * - /api/auth/verify-email
 * - etc.
 */

import { auth } from "@/auth/config";

export const GET = auth.handler;
export const POST = auth.handler;
