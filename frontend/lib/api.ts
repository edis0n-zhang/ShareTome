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

export async function fetchPublicTable(endpoint: string, options: RequestInit = {}) {
  const headers = {
    "Content-Type": "application/json",
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

interface UserTable {
  table_id: string;
  table_name: string;
}

// Helper functions for specific API endpoints
export const api = {
  getUserTables: async (tableId: string): Promise<UserTable[]> => {
    return fetchWithAuth(`/tables`);
  },

  getTableByID: async (tableId: string): Promise<UserTable> => {
    try {
      return await fetchWithAuth(`/table?table_id=${tableId}`);
    } catch (error) {
      // If authentication fails, try fetching as public table
      return await fetchPublicTable(`/table?table_id=${tableId}`);
    }
  },

  createUserTable: async (
    tableName: string,
    isPublic: boolean = false,
    skipTableCreation: boolean = false
  ) => {
    return fetch("/create_table", {
      method: "POST",
      body: JSON.stringify({
        table_name: tableName,
        is_public: isPublic,
        skip_table_creation: skipTableCreation,
      }),
    });
  },

  getAllDocuments: async (tableId: string) => {
    try {
      return await fetchWithAuth(`/es/all?table_id=${tableId}`);
    } catch (error) {
      // If authentication fails, try fetching as public table
      return await fetchPublicTable(`/es/all?table_id=${tableId}`);
    }
  },

  searchDocuments: async (query: string, tableId: string) => {
    console.log(
      "Constructing search URL with query:",
      query,
      "and tableId:",
      tableId
    );
    const url = `/es/search?q=${encodeURIComponent(
      query
    )}&table_id=${encodeURIComponent(tableId)}`;
    console.log("Final search URL:", url);
    try {
      return await fetchWithAuth(url);
    } catch (error) {
      // If authentication fails, try fetching as public table
      return await fetchPublicTable(url);
    }
  },

  updateTableVisibility: async (
    tableId: string,
    makePublic: boolean
  ): Promise<void> => {
    try {
      const session = await getSession();
      if (!session?.user) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${API_BASE_URL}/table/${tableId}/visibility`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.user.email}`,
          },
          body: JSON.stringify({ is_public: makePublic }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
    } catch (error) {
      console.error("Error updating table visibility:", error);
      throw error;
    }
  },
};
