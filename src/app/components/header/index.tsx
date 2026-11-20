"use client";
import Link from "next/link";
import { House } from "lucide-react";

export function Header() {
  return (
    <div>
      <div className=" h-[90px] bg-orange-600 w-full flex justify-center items-center">
        <h1 className="text-white text-3xl font-bold">Gama </h1>
        <img src="/icon-192.png" alt="lanches" className=" h-[90px]" />
      </div>
    </div>
  );
}
