const createApiRequest = async (
   endpoint: string,
   options?: RequestInit
): Promise<Response> => {
   return fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`, {
      credentials: "include",
      headers: {
         "Content-Type": "application/json",
      },
      ...options,
   });
};

const handleApiError = async (response: Response): Promise<never> => {
   const { message, error } = await response.json().catch(() => ({}));
   throw new Error(error ?? message ?? `Request failed (${response.status})`);
};

export { createApiRequest, handleApiError };
