"use client"

import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'

interface AddDataFormProps {
  isOpen: boolean
  onClose: () => void
  onFilesAccepted: (files: File[]) => void
}

export function AddDataForm({ isOpen, onClose, onFilesAccepted }: AddDataFormProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAccepted(acceptedFiles)
    onClose()
  }, [onFilesAccepted, onClose])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Data to Table</DialogTitle>
          <DialogDescription>
            Drop your file here or click to select files to add data to the table.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
