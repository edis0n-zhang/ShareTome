"use client"

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface FileDropBoxProps {
  isOpen: boolean
  onClose: () => void
  onFilesAccepted: (files: File[], tableName: string) => void
}

export function FileDropBox({ isOpen, onClose, onFilesAccepted }: FileDropBoxProps) {
  const [tableName, setTableName] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!tableName.trim()) {
      return
    }
    onFilesAccepted(acceptedFiles, tableName)
    onClose()
    setTableName('')
  }, [onFilesAccepted, onClose, tableName])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Enter a name for your table and drop your file to create a new table.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              placeholder="Enter table name..."
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isDragActive ? 'Drop the files here...' : 'Drag & drop files here, or click to select files'}
            </p>
          </div>
          <Button onClick={onClose} className="mt-4 w-full">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
