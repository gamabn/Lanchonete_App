// Keep API handlers and middleware on the same authentication authority.
export const backendUrl =
  //"http://localhost:3333";
  // process.env.NEXT_PUBLIC_API_LOCAL;
  process.env.NEXT_PUBLIC_API_RENDER || process.env.NEXT_PUBLIC_API_LOCAL;

// process.env.NEXT_PUBLIC_API_RENDER;
