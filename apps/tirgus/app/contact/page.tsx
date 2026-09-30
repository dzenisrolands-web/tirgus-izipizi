import type { Metadata } from "next";
import { Mail, Phone, Clock, MapPin, MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Sazināties | tirgus.izipizi.lv",
  description: "Sazinies ar tirgus.izipizi.lv komandu — jautājumi, ieteikumi, kļūdas ziņojumi.",
};

const contacts = [
  {
    icon: <Mail size={20} />,
    label: "E-pasts",
    value: "tirgus@izipizi.lv",
    href: "mailto:tirgus@izipizi.lv",
    desc: "Atbildam darba dienās 4–8h laikā",
  },
  {
    icon: <Phone size={20} />,
    label: "Telefons",
    value: "+371 20031552",
    href: "tel:+37120031552",
    desc: "Darba dienās 9:00–18:00",
  },
  {
    icon: <MapPin size={20} />,
    label: "Adrese",
    value: "Rīga, Latvija",
    href: null,
    desc: "IziPizi SIA, LV-1000",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Sazināties</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-500">
          Jautājums, ieteikums vai tehniskie problēma — raksti mums. Atbildam ātri.
        </p>
      </div>

      {/* Contact cards */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {contacts.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              {c.icon}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{c.label}</p>
            {c.href ? (
              <a href={c.href} className="mt-1 block font-semibold text-gray-900 hover:text-brand-600 transition">
                {c.value}
              </a>
            ) : (
              <p className="mt-1 font-semibold text-gray-900">{c.value}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Working hours */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
        <Clock size={18} className="shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Darba laiks</p>
          <p className="text-sm text-gray-500">Pirmdiena – Piektdiena: 9:00 – 18:00. Sestdiena, Svētdiena: slēgts.</p>
        </div>
      </div>

      {/* Contact form */}
      <div className="mt-10 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <MessageSquare size={18} className="text-brand-600" />
          <h2 className="font-bold text-gray-900">Raksti mums</h2>
        </div>

        <form
          action="mailto:tirgus@izipizi.lv"
          method="get"
          encType="text/plain"
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vārds</label>
              <input
                name="name"
                type="text"
                className="input mt-1 w-full"
                placeholder="Jānis Bērziņš"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">E-pasts</label>
              <input
                name="email"
                type="email"
                className="input mt-1 w-full"
                placeholder="janis@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Temats</label>
            <select name="subject" className="input mt-1 w-full">
              <option value="Vispārīgs jautājums">Vispārīgs jautājums</option>
              <option value="Pasūtījums">Pasūtījums</option>
              <option value="Pārdevēja reģistrācija">Pārdevēja reģistrācija</option>
              <option value="Tehniska problēma">Tehniska problēma</option>
              <option value="Cits">Cits</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ziņa</label>
            <textarea
              name="body"
              rows={5}
              className="input mt-1 w-full resize-y"
              placeholder="Apraksti savu jautājumu vai problēmu..."
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Nosūtīt ziņu
          </button>
        </form>
      </div>

      {/* Social / external links */}
      <div className="mt-8 rounded-2xl bg-[#192635] px-6 py-6 text-white">
        <p className="font-semibold">Seko mums</p>
        <p className="mt-1 text-sm text-gray-400">Jaunākās ziņas, sezonālie produkti un akcijas.</p>
        <div className="mt-4 flex gap-3">
          <a
            href="https://izipizi.lv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            izipizi.lv
          </a>
        </div>
      </div>

    </div>
  );
}
