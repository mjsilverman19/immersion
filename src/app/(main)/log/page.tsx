import LogClient from "./log-client";

export default function LogPage() {
  return (
    <div className="bg-cream min-h-screen p-4">
      <h1 className="mb-6 font-serif text-2xl text-ink">Log a Place</h1>
      <LogClient />
    </div>
  );
}
