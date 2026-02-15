import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import LogFormWrapper from "./LogFormWrapper";

interface Props {
  params: { id: string };
}

export default async function LogPlacePage({ params }: Props) {
  const supabase = createClient();

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!place) notFound();

  return (
    <div className="bg-cream min-h-screen p-4 pb-24">
      <LogFormWrapper place={place} />
    </div>
  );
}
