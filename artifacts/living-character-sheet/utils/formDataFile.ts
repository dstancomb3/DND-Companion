import { Platform } from "react-native";

type NativeFileDescriptor = {
  uri: string;
  name: string;
  type: string;
};

export function appendFileToFormData(
  formData: FormData,
  fieldName: string,
  descriptor: NativeFileDescriptor,
  base64?: string
): void {
  if (Platform.OS === "web" && base64) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: descriptor.type });
    formData.append(fieldName, blob, descriptor.name);
  } else {
    (formData as unknown as { append(key: string, value: NativeFileDescriptor): void }).append(
      fieldName,
      descriptor
    );
  }
}
