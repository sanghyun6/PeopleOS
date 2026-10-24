import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">PeopleOS</h1>
      <p className="text-neutral-500">Every call changes the venue.</p>
      <nav className="flex gap-4">
        <Link className="rounded-md bg-foreground px-4 py-2 text-background" href="/ops">
          Ops dashboard
        </Link>
        <Link className="rounded-md border px-4 py-2" href="/staff">
          Staff phones
        </Link>
      </nav>
    </main>
  );
}
