import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Tab bar icons
  "house.fill": "home",
  "bubble.left.fill": "chat",
  "doc.text.fill": "description",
  "calendar": "event",
  "chart.line.uptrend.xyaxis": "trending-up",
  // Common actions
  "paperplane.fill": "send",
  "plus": "add",
  "xmark": "close",
  "checkmark": "check",
  "trash.fill": "delete",
  "pencil": "edit",
  "magnifyingglass": "search",
  "ellipsis": "more-horiz",
  // Navigation
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.left.forwardslash.chevron.right": "code",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "arrow.counterclockwise": "refresh",
  // Media / voice
  "mic.fill": "mic",
  "mic.slash.fill": "mic-off",
  "stop.fill": "stop",
  // Status / info
  "clock.fill": "access-time",
  "dollarsign.circle.fill": "attach-money",
  "person.fill": "person",
  "person.2.fill": "people",
  "flag.fill": "flag",
  "star.fill": "star",
  "bell.fill": "notifications",
  "bolt.fill": "flash-on",
  "sparkles": "auto-awesome",
  // Lists / charts
  "list.bullet": "format-list-bulleted",
  "line.3.horizontal.decrease": "filter-list",
  "chart.bar.fill": "bar-chart",
  // Communication
  "phone.fill": "phone",
  "envelope.fill": "email",
  // Export
  "square.and.arrow.up": "share",
  "arrow.down.doc.fill": "file-download",
  "doc.richtext": "article",
  // Misc
  "sun.max.fill": "wb-sunny",
  "moon.fill": "dark-mode",
  "gearshape.fill": "settings",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
