import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio | NexusQL",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-screen h-screen overflow-hidden">{children}</div>;
}
