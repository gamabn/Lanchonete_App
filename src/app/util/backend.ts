// Keep API handlers and middleware on the same authentication authority.
export const backendUrl =
  process.env.NEXT_PUBLIC_API_LOCAL || process.env.NEXT_PUBLIC_API_RENDER;
