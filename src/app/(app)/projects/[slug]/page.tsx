import { redirect } from "next/navigation";
import { workspacePage } from "@/lib/authz";

export default async function ProjectIndex({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const { workspace } = await workspacePage(slug);
  redirect(`/projects/${workspace.slug}/dashboard`);
}
