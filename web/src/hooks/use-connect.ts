import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ConnectRequest } from "@/lib/types";

export function useConnect() {
  const router = useRouter();

  return useMutation({
    mutationFn: (req: ConnectRequest) => api.connect(req),
    onSuccess: (data) => {
      sessionStorage.setItem("nexusql_provider", data.provider);
      router.push("/canvas");
    },
  });
}
