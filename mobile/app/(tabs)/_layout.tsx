import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "總覽",
          headerTitle: "₿ BTC 分析儀表板",
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chart"
        options={{
          title: "圖表",
          headerTitle: "價格走勢",
          tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="signals"
        options={{
          title: "買賣訊號",
          headerTitle: "買賣訊號分析",
          tabBarIcon: ({ color, size }) => <TabIcon name="flag" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="backtest"
        options={{
          title: "回測",
          headerTitle: "策略模擬回測",
          tabBarIcon: ({ color, size }) => <TabIcon name="play-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="advisor"
        options={{
          title: "顧問",
          headerTitle: "AI 投資顧問",
          tabBarIcon: ({ color, size }) => <TabIcon name="bulb" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
