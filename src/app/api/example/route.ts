/**
 * Example API Route with Full Database Session Validation
 * 
 * This demonstrates how to use the server-side session validation
 * in API routes after the Edge Runtime middleware has done basic checks.
 */

import { NextRequest } from "next/server";
import { withAuth, createApiErrorResponse } from "@/lib/auth/server-session";

// Example protected API route (requires authentication)
export const GET = withAuth(async (_request: NextRequest, session) => {
  // At this point, we have a fully validated session from the database
  return Response.json({
    message: "Success! You are authenticated.",
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
    timestamp: new Date().toISOString(),
  });
});

// Example admin-only API route
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    
    // Perform admin operations here
    return Response.json({
      message: "Admin operation completed successfully",
      data: body,
      performedBy: {
        id: session.user.id,
        role: session.user.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return createApiErrorResponse(400, "Invalid JSON body");
  }
}, "ADMIN"); // Requires ADMIN role

// Example manual session validation (if you need more control)
export const PUT = async (request: NextRequest) => {
  // Import here to avoid Edge Runtime issues
  const { validateApiAccess } = await import("@/lib/auth/server-session");
  
  const { isValid, session, error } = await validateApiAccess(request, "CUSTOMER");
  
  if (!isValid || !session) {
    return createApiErrorResponse(
      error?.code || 401,
      error?.message || "Unauthorized"
    );
  }
  
  // Custom logic here
  return Response.json({
    message: "Custom validation successful",
    user: session.user,
    timestamp: new Date().toISOString(),
  });
};