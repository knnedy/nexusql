import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDisconnect() {
  return useMutation({
    mutationFn: () => api.disconnect(),
  });
}
