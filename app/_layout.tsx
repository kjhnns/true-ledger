import { Stack } from "expo-router";
import { useEffect } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import { bwTheme } from "./theme";
import { initDb } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);
  return (
    <PaperProvider theme={bwTheme}>
      <Stack />
    </PaperProvider>
  );
}
