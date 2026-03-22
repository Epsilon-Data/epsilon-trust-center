import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Header() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) {
      navigate(`/verify/${trimmed}`);
      setSearch("");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Shield className="h-5 w-5 text-primary" />
          <span>EPSILON</span>
          <span className="text-muted-foreground font-normal text-sm hidden sm:inline">
            Trust Hub
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Job ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px] lg:w-[280px] h-9"
              />
            </div>
          </form>

          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">Jobs</Button>
            </Link>
            {/* Transparency Log — hidden until ATL integration is complete
            <Link href="/transparency">
              <Button variant="ghost" size="sm">Log</Button>
            </Link>
            */}
            <Link href="/verify">
              <Button variant="ghost" size="sm">Verify</Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost" size="sm">About</Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
