"use client"

import { useState } from 'react'
import { DataTable } from "../../components/data-table"
import { AddDataForm } from "../../components/add-data-form"
import { Button } from "../../components/ui/button"

// This would typically come from your database or API
const initialData = [
  { id: 1, name: "John Doe", email: "john@example.com", role: "Admin" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", role: "User" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "User" },
]

const columns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
  },
]

export default function DashboardPage() {
  const [data, setData] = useState(initialData)
  const [isAddDataFormOpen, setIsAddDataFormOpen] = useState(false)

  const handleAddData = (newData: Record<string, string>) => {
    const newId = Math.max(...data.map(item => item.id)) + 1
    setData([...data, { id: newId, ...newData }])
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="space-x-2">
          <Button onClick={() => setIsAddDataFormOpen(true)}>Add Data</Button>
          <Button variant="secondary" onClick={() => window.navigator.clipboard.writeText(JSON.stringify(data))}>
            Share Table
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={data} />
      <AddDataForm
        isOpen={isAddDataFormOpen}
        onClose={() => setIsAddDataFormOpen(false)}
        onSubmit={handleAddData}
        columns={columns.map(col => col.accessorKey as string)}
      />
    </div>
  )
}
