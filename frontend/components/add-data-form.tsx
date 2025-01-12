"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { fetchWithAuth } from "@/lib/api";
import { getSession } from "next-auth/react";

interface Document {
  filePath: string;
  fileName: string;
}

interface FileDropBoxProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesAccepted: (files: File[], tableName: string) => void;
  tableName: string;
}

interface FileWithPath extends File {
  path?: string;
}

export function AddDataForm({
  isOpen,
  onClose,
  onFilesAccepted,
  tableName,
}: FileDropBoxProps) {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
  }, []);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const session = await getSession();
    if (!session?.user?.email) {
      throw new Error("Not authenticated");
    }

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded * 100) / event.total);
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: progress,
          }));
        }
      });

      console.log("xhr 1");

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("Upload successful:", response);
            if (
              response &&
              typeof response === "object" &&
              "filePath" in response
            ) {
              resolve({ filePath: response.filePath });
            } else {
              console.error("Unexpected response format:", response);
              reject(new Error("Invalid response format from server"));
            }
          } catch (error) {
            console.error("Failed to parse server response:", xhr.responseText);
            reject(new Error("Invalid response from server"));
          }
        } else {
          console.error(
            "Upload failed with status:",
            xhr.status,
            xhr.statusText
          );
          console.error("Server response:", xhr.responseText);
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", (e) => {
        console.error("Network error during upload:", e);
        reject(new Error("Network error occurred"));
      });

      console.log("xhr 2");

      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/upload`);
      console.log("Uploading to:", `${process.env.NEXT_PUBLIC_API_URL}/upload`);
      console.log("Auth header:", `Bearer ${session.user.email}`);
      console.log("xhr 3");
      xhr.setRequestHeader("Authorization", `Bearer ${session.user.email}`);
      xhr.send(formData);
    });
  };

  const validateFiles = (filesToValidate: File[]) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    for (const file of filesToValidate) {
      if (file.size > maxSize) {
        throw new Error(`File ${file.name} is too large. Maximum size is 50MB`);
      }
      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          `File ${file.name} has unsupported format. Allowed formats are PDF, TXT, DOC, and DOCX`
        );
      }
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({});

    try {
      validateFiles(files);

      const uploadPromises = files.map(async (file) => {
        const { filePath } = await uploadFile(file);
        return {
          file_name: file.name,
          file_path: filePath,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      const createTableResponse = await fetchWithAuth("/create_table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table_name: tableName,
          is_public: false,
          documents: uploadedFiles,
          skip_table_creation: true,
        }),
      });

      if (!createTableResponse.ok) {
        throw new Error("Failed to create table. Please try again.");
      }

      const result = await createTableResponse.json();
      onFilesAccepted(files, tableName);
      onClose();
      setFiles([]);
    } catch (error) {
      console.error("Error creating table and uploading files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleAddMoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(
      event.target.files || []
    ) as FileWithPath[];
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Data</DialogTitle>
          <DialogDescription>
            Add files to add data to the current table.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {files.length === 0 ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop the files here..."
                  : "Drag & drop files here, or click to select files"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center mb-2">
                <button
                  onClick={handleAddMoreClick}
                  className="text-sm text-primary hover:text-primary/80 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add more files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  multiple
                />
              </div>
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col space-y-4">
            {isUploading && Object.keys(uploadProgress).length > 0 && (
              <div className="space-y-2">
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="truncate">{fileName}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full">
                      <div
                        className="bg-primary h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={files.length === 0 || isUploading}
              >
                {isUploading ? "Uploading..." : "Add to Table"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
