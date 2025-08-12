import { Button, Text, View } from "react-native";
import { router } from "expo-router";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
      <View style={{ height: 16 }} />
      <Button
        title="Bank accounts"
        onPress={() => router.push("/bank-accounts")}
      />
      <View style={{ height: 16 }} />
      <Button
        title="Go to Settings"
        onPress={() => router.push("/settings")}
      />
    </View>
  );
}
