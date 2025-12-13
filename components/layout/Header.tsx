"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/shadcn";
import { Input } from "@/components/ui/shadcn";
import { Search, Wallet, BookOpen, Sparkles, Gavel, Network } from "lucide-react";
import { cn, truncateAddress } from "@/lib/utils";

export function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const handleConnect = () => {
    if (isConnected) {
      setIsConnected(false);
      setWalletAddress("");
    } else {
      setIsConnected(true);
      setWalletAddress("0xA1b2C3D4E5F678901234567890AbCdEf12349C0D");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">Ω</span>
            <span className="hidden font-bold sm:inline-block text-white tracking-tight">
              Omega Institute
            </span>
            <span className="hidden 2xl:inline text-[10px] font-mono text-zinc-500">
              Evidence alignment as currency
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              type="search"
              placeholder="Search by DOI, Hypothesis, Keyword, or Code Hash..."
              className="w-full bg-zinc-900 pl-9 font-mono text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-emerald-500 border-zinc-800"
            />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Link href="/arxiv">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-emerald-500">
                <Sparkles className="h-5 w-5" />
                <span className="sr-only">AI Review</span>
              </Button>
            </Link>

            <Link href="/map">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-emerald-500">
                <Network className="h-5 w-5" />
                <span className="sr-only">Keyword Map</span>
              </Button>
            </Link>

            <Link href="/market">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-emerald-500">
                <Gavel className="h-5 w-5" />
                <span className="sr-only">Bounty Market</span>
              </Button>
            </Link>

            <Link href="/policies">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-emerald-500">
                <BookOpen className="h-5 w-5" />
                <span className="sr-only">Policies</span>
              </Button>
            </Link>
            
            <Link href="/submit" className="hidden sm:flex">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
              >
                Submit Research
              </Button>
            </Link>
            
            <Button
              variant={isConnected ? "outline" : "emerald"}
              size="sm"
              onClick={handleConnect}
              className={cn(
                "font-mono transition-all",
                isConnected ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10" : ""
              )}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnected ? truncateAddress(walletAddress) : "Connect Wallet"}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
