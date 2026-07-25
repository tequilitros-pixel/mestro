"use client";

import { useEffect } from "react";

export default function AutoPrint() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}