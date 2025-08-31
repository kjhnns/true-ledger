import { Stack } from "expo-router";
import { useEffect } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import { initDb } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);
  return (
    <PaperProvider>
      <Stack />
    </PaperProvider>
  );
}
