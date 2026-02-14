import LogClient from "./log-client";

export default function LogPage() {
  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-bold">Log a Place</h1>
      <LogClient />
    </div>
  );
}
