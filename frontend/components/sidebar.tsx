"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Plus } from "lucide-react";
import { FileDropBox } from "./file-drop-box";
import { api } from "../lib/api";

export function Sidebar() {
  const [isDropBoxOpen, setIsDropBoxOpen] = useState(false);
  const [tables, setTables] = useState<Array<{
    table_id: string;
    table_name: string;
    is_public: boolean;
  }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const userTables = await api.getUserTables();
        setTables(userTables);
        setError(null);
      } catch (error) {
        console.error("Error fetching tables:", error);
        setTables(null);
        setError("Failed to load tables");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
  }, []);

  const handleFilesAccepted = (files: File[]) => {
    // Here you would handle the uploaded files, e.g., send them to your backend
    console.log("Files accepted:", files);
    // You might want to add some state management here to update the list of tables
  };

  return (
    <div className="pb-12 w-64">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => setIsDropBoxOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Table
            </Button>
          </div>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Saved Tables
          </h2>
          <ScrollArea className="h-[300px] px-1">
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-sm text-gray-500 px-4">Loading...</div>
              ) : error ? (
                <div className="text-sm text-red-500 px-4">{error}</div>
              ) : !tables || tables.length === 0 ? (
                <div className="text-sm text-gray-500 px-4">
                  No saved tables
                </div>
              ) : (
                tables.map((table) => (
                  <Button
                    key={table.table_id}
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    asChild
                  >
                    <Link href={`/tables/${table.table_id}`}>
                      {table.table_name}
                      {table.is_public && (
                        <span className="ml-2 text-xs text-gray-500">
                          (Public)
                        </span>
                      )}
                    </Link>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
      <FileDropBox
        isOpen={isDropBoxOpen}
        onClose={() => setIsDropBoxOpen(false)}
        onFilesAccepted={handleFilesAccepted}
      />
    </div>
  );
}
