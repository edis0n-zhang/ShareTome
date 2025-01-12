"use client";

import * as React from "react";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

interface SearchBarProps {
  onSubmit: (value: string) => void;
  className?: string;
  value?: string;
}

export function SearchBar({
  onSubmit,
  className = "",
  value = "",
}: SearchBarProps) {
  const [searchValue, setSearchValue] = React.useState(value);
  const [isSemanticSearch, setIsSemanticSearch] = React.useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(searchValue);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center space-x-2 ${className}`}
    >
      <Input
        placeholder="Search..."
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        className="max-w-sm"
      />
      {/* <div className="flex items-center space-x-2">
        <Switch
          id="semantic-search"
          checked={isSemanticSearch}
          onCheckedChange={setIsSemanticSearch}
        />
        <Label htmlFor="semantic-search">Semantic Search</Label>
      </div> */}
      <button type="submit" hidden />
    </form>
  );
}
