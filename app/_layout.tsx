import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDb } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);
  return <Stack />;
}
