import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
) {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.user.email}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || response.statusText);
  }

  return response.json();
}

interface DocumentResponse {
  _source: {
    properties: {
      path: string;
      page_number: number;
    };
    text_representation: string;
  };
}

// Helper functions for specific API endpoints
export const api = {
  getUserTables: async () => {
    return fetchWithAuth("/api/v1/tables");
  },

  createUserTable: async (tableName: string) => {
    return fetchWithAuth("/api/v1/tables", {
      method: "POST",
      body: JSON.stringify({ tableName }),
    });
  },

  getAllDocuments: async () => {
    return fetchWithAuth("/es/all");
  },

  searchDocuments: async (query: string) => {
    console.log('Constructing search URL with query:', query);
    const url = `/es/search?q=${encodeURIComponent(query)}`;
    console.log('Final search URL:', url);
    try {
      const response = await fetchWithAuth(url);
      console.log('Search response:', response);
      return response;
    } catch (error) {
      console.error('Search request failed:', error);
      throw error;
    }
  },
};
