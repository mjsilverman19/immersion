import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditProfileForm from "./EditProfileForm";

interface Props {
  params: { username: string };
}

export default async function EditProfilePage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) notFound();

  // Only the profile owner can edit
  if (profile.username !== params.username) {
    redirect(`/profile/${params.username}`);
  }

  return (
    <div className="bg-cream min-h-screen p-4">
      <h1 className="mb-6 font-serif text-2xl text-ink">Edit Profile</h1>
      <EditProfileForm profile={profile} />
    </div>
  );
}
