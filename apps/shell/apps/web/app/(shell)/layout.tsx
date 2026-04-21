import { ShellFrame } from "@/components/shell/shell-frame";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ShellFrame>{children}</ShellFrame>;
}
