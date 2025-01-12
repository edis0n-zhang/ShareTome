"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { Plus } from 'lucide-react'
import { FileDropBox } from './file-drop-box'

export function Sidebar() {
  const [isDropBoxOpen, setIsDropBoxOpen] = useState(false)

  // This would be fetched from your backend in a real application
  const tables = [
    { id: 1, name: "Project Tasks" },
    { id: 2, name: "Employee Directory" },
    { id: 3, name: "Inventory List" },
  ]

  const handleFilesAccepted = (files: File[]) => {
    // Here you would handle the uploaded files, e.g., send them to your backend
    console.log('Files accepted:', files)
    // You might want to add some state management here to update the list of tables
  }

  return (
    <div className="pb-12 w-64">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Your Tables
          </h2>
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
              {tables.map((table) => (
                <Button
                  key={table.id}
                  variant="ghost"
                  className="w-full justify-start font-normal"
                  asChild
                >
                  <Link href={`/dashboard/table/${table.id}`}>
                    {table.name}
                  </Link>
                </Button>
              ))}
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
  )
}

