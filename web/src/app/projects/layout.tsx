import { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Projects | NexusQL",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
