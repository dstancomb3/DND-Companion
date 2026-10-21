import { ScrollViewProps } from "react-native";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";

type Props = ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  return (
    <ScrollHintScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </ScrollHintScrollView>
  );
}
