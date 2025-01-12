"use client";

import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import Link from "next/link";

interface Table {
  table_id: string;
  table_name: string;
  is_public: boolean;
}

export default function DashboardPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const userTables = await api.getUserTables();
        setTables(userTables || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch tables");
        setTables([]); // Ensure tables is set to empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Tables</h1>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No tables found. Click "Create New Table" to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {tables.map((table) => (
            <Link
              key={table.table_id}
              href={`/tables/${table.table_id}`}
              className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">{table.table_name}</h2>
                  <p className="text-sm text-gray-500">
                    {table.is_public ? "Public" : "Private"} Table
                  </p>
                </div>
                <Button variant="ghost">View Table →</Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
