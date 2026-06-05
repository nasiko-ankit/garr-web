import Link from "next/link";
import { Hero } from "@/components/Hero";
import { InfoCards } from "@/components/InfoCards";
import { ArchitectureSection } from "@/components/ArchitectureSection";
import { SectionHeading } from "@/components/SectionHeading";

const cards = [
  { href: "/register", title: "Register", desc: "Submit a new EntityOwner" },
  { href: "/registries", title: "Browse", desc: "View all registries" },
  { href: "/resolve", title: "Resolve", desc: "Lookup by domain" },
  { href: "/search", title: "Search", desc: "Keyword search" },
  { href: "/query", title: "Agent Query", desc: "All query modes" },
  { href: "/rap", title: "RAP Manager", desc: "Manage agents on your RAP" },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Quick actions"
          title="Build the front door first"
          description="The spec expects a clean, operational UI with all main entry points exposed."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <InfoCards />
      <ArchitectureSection />
    </>
  );
}